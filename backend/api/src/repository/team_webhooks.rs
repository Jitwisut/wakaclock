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
                "SELECT delivery_id, metadata FROM team_webhook_inbox
             WHERE provider = 'github' AND processed_at IS NULL AND dead_letter_at IS NULL
             AND retry_at <= now() ORDER BY received_at FOR UPDATE SKIP LOCKED LIMIT 1",
                &[],
            )
            .await?
        else {
            return Ok(false);
        };
        let id: String = row.get("delivery_id");
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
                     merged_at, closed_at, provider_updated_at, first_review_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
                     ON CONFLICT(organization_id, repository_id, external_id) DO UPDATE SET
                       state = CASE WHEN EXCLUDED.provider_updated_at >= team_work_items.provider_updated_at
                         THEN EXCLUDED.state ELSE team_work_items.state END,
                       head_branch = CASE WHEN EXCLUDED.provider_updated_at >= team_work_items.provider_updated_at
                         THEN EXCLUDED.head_branch ELSE team_work_items.head_branch END,
                       ready_at = LEAST(team_work_items.ready_at, EXCLUDED.ready_at),
                       first_review_at = LEAST(team_work_items.first_review_at, EXCLUDED.first_review_at),
                       merged_at = COALESCE(team_work_items.merged_at, EXCLUDED.merged_at),
                       closed_at = CASE WHEN EXCLUDED.provider_updated_at >= team_work_items.provider_updated_at
                         THEN EXCLUDED.closed_at ELSE team_work_items.closed_at END,
                       provider_updated_at = GREATEST(team_work_items.provider_updated_at, EXCLUDED.provider_updated_at),
                       synced_at = now()",
                    &[&org, &repo, &item.external_id, &item.kind, &item.number, &item.state,
                      &item.branch, &item.author_id, &item.opened_at, &item.ready_at,
                      &item.merged_at, &item.closed_at, &item.updated_at, &event.review_at]).await?;
                tx.execute("SELECT team_bump_generation($1)", &[&org])
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
