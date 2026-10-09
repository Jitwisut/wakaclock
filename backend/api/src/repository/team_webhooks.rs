use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::services::team_webhooks::GithubMetadata;

pub struct TeamWebhookRepository {
    postgres: Arc<PostgresClient>,
}

impl TeamWebhookRepository {
    pub fn new(postgres: Arc<PostgresClient>) -> Self {
        Self { postgres }
    }

    /// A successful return is the durable acceptance boundary. A lost HTTP
    /// response can replay the same delivery, but never replace its metadata.
    pub async fn accept_github(
        &self,
        id: &str,
        hash: &str,
        metadata: &GithubMetadata,
    ) -> Result<()> {
        anyhow::ensure!(
            !id.is_empty() && id.len() <= 200 && !id.chars().any(char::is_control),
            "invalid delivery identity"
        );
        let mut client = self.postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        // Serialize redelivery with retention disposition + deletion, even across processes.
        tx.query_one("SELECT pg_advisory_xact_lock(74103032)", &[])
            .await?;
        if let Some(row)=tx.query_opt("SELECT payload_hash FROM team_webhook_dispositions WHERE provider='github' AND delivery_id=$1",&[&id]).await? {
            anyhow::ensure!(row.get::<_,String>(0)==hash,"delivery identity conflict");
            tx.commit().await?;
            return Ok(());
        }
        let value = serde_json::to_value(metadata)?;
        let row = tx
            .query_opt(
                "INSERT INTO team_webhook_inbox(provider, delivery_id, payload_hash, metadata)
             VALUES ('github', $1, $2, $3) ON CONFLICT(provider, delivery_id)
             DO UPDATE SET delivery_id = EXCLUDED.delivery_id
             WHERE team_webhook_inbox.payload_hash = EXCLUDED.payload_hash RETURNING delivery_id",
                &[&id, &hash, &value],
            )
            .await
            .context("durable webhook acceptance failed")?;
        anyhow::ensure!(row.is_some(), "delivery identity conflict");
        // Revocations close reads at durable acceptance, not after a delayed worker tick.
        if metadata.event == "installation"
            && matches!(metadata.action.as_str(), "deleted" | "suspend")
        {
            tx.execute("UPDATE team_github_installations SET status=$2,generation=generation+1,updated_at=now() WHERE installation_id=$1 AND status<>$2",&[&metadata.installation_id,&if metadata.action=="deleted"{"removed"}else{"suspended"}]).await?;
            tx.execute("UPDATE team_repository_scopes SET enabled=false WHERE github_installation_id=$1 AND enabled",&[&metadata.installation_id]).await?;
        }
        if let Some(details) = &metadata.details {
            if let Some(id) = details.revoked_user_id {
                tx.execute("UPDATE team_github_identities SET revoked_at=now(),credentials=NULL,refresh_lease=NULL,refresh_until=NULL WHERE github_user_id=$1",&[&id]).await?;
            }
            if !details.removed_repository_ids.is_empty() {
                tx.execute("UPDATE team_repository_scopes SET enabled=false WHERE github_installation_id=$1 AND github_repository_id=ANY($2) AND enabled",&[&metadata.installation_id,&details.removed_repository_ids]).await?;
            }
        }
        tx.commit().await?;
        Ok(())
    }

    pub async fn accept_disposition(&self, id: &str, hash: &str, reason: &str) -> Result<()> {
        anyhow::ensure!(
            !id.is_empty() && id.len() <= 200 && !id.chars().any(char::is_control),
            "invalid delivery identity"
        );
        let mut client = self.postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        tx.query_one("SELECT pg_advisory_xact_lock(74103032)", &[])
            .await?;
        if let Some(row)=tx.query_opt("SELECT payload_hash FROM team_webhook_inbox WHERE provider='github' AND delivery_id=$1",&[&id]).await?{anyhow::ensure!(row.get::<_,String>(0)==hash,"delivery identity conflict");}
        anyhow::ensure!(tx.query_opt("INSERT INTO team_webhook_dispositions(provider,delivery_id,payload_hash,reason,disposed_at) VALUES('github',$1,$2,$3,now()) ON CONFLICT(provider,delivery_id) DO UPDATE SET delivery_id=EXCLUDED.delivery_id WHERE team_webhook_dispositions.payload_hash=EXCLUDED.payload_hash RETURNING delivery_id",&[&id,&hash,&reason]).await?.is_some(),"delivery identity conflict");
        tx.commit().await?;
        Ok(())
    }
    /// Each metadata event and its ACK commit in one PostgreSQL transaction.
    /// Row locks are process-safe leases that disappear on crash. No external
    /// requests occur under the lock; provider reconciliation is a separate task.
    pub async fn process_github(&self) -> Result<bool> {
        let mut client = self.postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let Some(row) = tx
            .query_opt(
                "SELECT delivery_id, metadata, received_at FROM team_webhook_inbox
             WHERE provider = 'github' AND processed_at IS NULL AND dead_letter_at IS NULL
             AND retry_at <= now() ORDER BY received_at FOR UPDATE SKIP LOCKED LIMIT 1",
                &[],
            )
            .await?
        else {
            return Ok(false);
        };
        let id: String = row.get("delivery_id");
        let observed_at: chrono::DateTime<chrono::Utc> = row.get("received_at");
        let metadata: serde_json::Value = row.get("metadata");
        let event = match serde_json::from_value::<GithubMetadata>(metadata) {
            Ok(event) => event,
            Err(_) => {
                tx.execute("UPDATE team_webhook_inbox SET dead_letter_at = now(), error_code = 'metadata_schema'
                    WHERE provider = 'github' AND delivery_id = $1", &[&id]).await?;
                tx.commit().await?;
                return Ok(true);
            }
        };
        if event.event == "installation" && matches!(event.action.as_str(), "deleted" | "suspend") {
            tx.execute("UPDATE team_repository_scopes SET enabled = FALSE WHERE github_installation_id = $1",
                &[&event.installation_id]).await?;
        } else if let (Some(repository), Some(item)) = (event.repository_id, &event.item) {
            let scopes = tx.query(
                "SELECT organization_id, repository_id FROM team_repository_scopes
                 WHERE github_installation_id = $1 AND github_repository_id = $2 AND enabled FOR SHARE",
                &[&event.installation_id, &repository]).await?;
            for scope in scopes {
                let org: Uuid = scope.get("organization_id");
                let repo: Uuid = scope.get("repository_id");
                tx.execute(
                    "INSERT INTO team_work_items(organization_id, repository_id, external_id,
                     kind, number, state, head_branch, author_github_id, opened_at, ready_at,
                     merged_at, closed_at, provider_updated_at, first_review_at, head_sha, head_repository_id, draft)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
                     ON CONFLICT(organization_id, repository_id, external_id) DO UPDATE SET
                       state = CASE WHEN EXCLUDED.provider_updated_at > team_work_items.provider_updated_at
                         THEN EXCLUDED.state ELSE team_work_items.state END,
                       head_branch = CASE WHEN EXCLUDED.provider_updated_at > team_work_items.provider_updated_at
                         THEN EXCLUDED.head_branch ELSE team_work_items.head_branch END,
                       head_sha = CASE WHEN EXCLUDED.provider_updated_at > team_work_items.provider_updated_at THEN EXCLUDED.head_sha ELSE team_work_items.head_sha END,
                       head_repository_id = CASE WHEN EXCLUDED.provider_updated_at > team_work_items.provider_updated_at THEN EXCLUDED.head_repository_id ELSE team_work_items.head_repository_id END,
                       draft = CASE WHEN EXCLUDED.provider_updated_at > team_work_items.provider_updated_at THEN EXCLUDED.draft ELSE team_work_items.draft END,
                       lifecycle_coverage = CASE WHEN EXCLUDED.provider_updated_at = team_work_items.provider_updated_at AND (EXCLUDED.state IS DISTINCT FROM team_work_items.state OR EXCLUDED.head_sha IS DISTINCT FROM team_work_items.head_sha OR EXCLUDED.draft IS DISTINCT FROM team_work_items.draft) THEN 'unconfirmed' ELSE team_work_items.lifecycle_coverage END,
                       ready_at = LEAST(team_work_items.ready_at, EXCLUDED.ready_at),
                       first_review_at = LEAST(team_work_items.first_review_at, EXCLUDED.first_review_at),
                       merged_at = COALESCE(team_work_items.merged_at, EXCLUDED.merged_at),
                       closed_at = CASE WHEN EXCLUDED.provider_updated_at > team_work_items.provider_updated_at
                         THEN EXCLUDED.closed_at ELSE team_work_items.closed_at END,
                       provider_updated_at = GREATEST(team_work_items.provider_updated_at, EXCLUDED.provider_updated_at),
                       synced_at = now()",
                    &[&org, &repo, &item.external_id, &item.kind, &item.number, &item.state,
                      &item.branch, &item.author_id, &item.opened_at, &item.ready_at,
                      &item.merged_at, &item.closed_at, &item.updated_at, &None::<chrono::DateTime<chrono::Utc>>, &event.details.as_ref().and_then(|d|d.head_sha.clone()), &event.details.as_ref().and_then(|d|d.head_repository_id), &event.details.as_ref().and_then(|d|d.draft)]).await?;
                if let Some(details) = &event.details {
                    if let Some(review) = &details.review {
                        super::team_github::upsert_fact(
                            &tx,
                            org,
                            repo,
                            &super::team_github::SyncFact {
                                kind: "review".into(),
                                external_id: review.id.to_string(),
                                work_item: Some(item.external_id),
                                at: review.submitted_at,
                                metadata: serde_json::to_value(review)?,
                            },
                            observed_at,
                        )
                        .await?;
                    }
                }
                if item.kind == "pull_request" {
                    let head = event.details.as_ref().and_then(|d| d.head_sha.clone());
                    let checkpoint = serde_json::json!({"phase":"current","number":item.number,"external_id":item.external_id,"head_sha":head,"author_id":item.author_id});
                    tx.execute("INSERT INTO team_github_sync_jobs(id,installation_id,organization_id,repository_id,generation,kind,target_key,checkpoint) SELECT gen_random_uuid(),i.installation_id,$1,$2,i.generation,'detail',$3,$4 FROM team_github_installations i JOIN team_rollouts r USING(organization_id) WHERE i.installation_id=$5 AND i.status='active' AND r.enabled ON CONFLICT DO NOTHING",&[&org,&repo,&format!("{}:{}",item.external_id,head.as_deref().unwrap_or("unconfirmed")),&checkpoint,&event.installation_id]).await?;
                }
                // Work metadata changes do not invalidate unrelated closed-week usage reports.
                // Timeline corrections are separately marked by the reconciliation processor.
            }
        }
        if let (Some(repository), Some(check)) = (
            event.repository_id,
            event.details.as_ref().and_then(|d| d.check.as_ref()),
        ) {
            let scopes=tx.query("SELECT organization_id,repository_id FROM team_repository_scopes WHERE github_installation_id=$1 AND github_repository_id=$2 AND enabled FOR SHARE",&[&event.installation_id,&repository]).await?;
            for scope in scopes {
                let org: Uuid = scope.get(0);
                let repo: Uuid = scope.get(1);
                super::team_github::upsert_fact(
                    &tx,
                    org,
                    repo,
                    &super::team_github::SyncFact {
                        kind: check.kind.clone(),
                        external_id: check.id.clone(),
                        work_item: None,
                        at: check.at.unwrap_or(observed_at),
                        metadata: serde_json::to_value(check)?,
                    },
                    observed_at,
                )
                .await?;
            }
        }
        tx.execute(
            "UPDATE team_webhook_inbox SET processed_at = now(), error_code = NULL
            WHERE provider = 'github' AND delivery_id = $1",
            &[&id],
        )
        .await?;
        tx.commit().await?;
        Ok(true)
    }
}
