//! Only delivery summaries are requested. Request/response bodies never enter storage.
use crate::{
    infrastructure::github::{GithubClient, GithubConfig, GithubFailure},
    repository::team_github::GithubRepositoryStore,
};
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use reqwest::Method;
use std::sync::Arc;
use uuid::Uuid;

pub struct GithubRedeliveryWorker {
    repo: Arc<GithubRepositoryStore>,
    config: GithubConfig,
    client: GithubClient,
}
impl GithubRedeliveryWorker {
    pub fn new(repo: Arc<GithubRepositoryStore>, config: GithubConfig) -> Result<Self> {
        Ok(Self {
            repo,
            config,
            client: GithubClient::new()?,
        })
    }
    pub async fn tick(&self) -> Result<bool> {
        self.repo
            .pg
            .execute(
                "INSERT INTO team_github_app_checkpoint(app_id) VALUES($1) ON CONFLICT DO NOTHING",
                &[&self.config.app_id],
            )
            .await?;
        let lease = Uuid::now_v7();
        let Some(row)=self.repo.pg.query_opt("UPDATE team_github_app_checkpoint SET lease_token=$2,lease_until=now()+interval '90 seconds' WHERE app_id=$1 AND (retry_at<=now() OR EXISTS(SELECT 1 FROM team_github_delivery_recovery d JOIN team_github_installations i USING(installation_id) JOIN team_rollouts o USING(organization_id) WHERE d.acknowledged_at IS NULL AND d.retry_at<=now() AND d.attempts<3 AND i.status='active' AND o.enabled)) AND (lease_until IS NULL OR lease_until<now()) RETURNING next_url,retry_at<=now() AS discovery_due",&[&self.config.app_id,&lease]).await? else{return Ok(false)};
        let next: Option<String> = row.get(0);
        let result = self
            .page(next.as_deref(), lease, row.get("discovery_due"))
            .await;
        if let Err(error) = result {
            let (code, seconds) = error
                .downcast_ref::<GithubFailure>()
                .map(|e| (e.code, e.retry_seconds.max(300)))
                .unwrap_or(("delivery_recovery_unconfirmed", 300));
            self.repo.pg.execute("UPDATE team_github_app_checkpoint SET retry_at=now()+$3*interval '1 second',error_code=$4,lease_token=NULL,lease_until=NULL WHERE app_id=$1 AND lease_token=$2",&[&self.config.app_id,&lease,&seconds,&code]).await?;
        }
        Ok(true)
    }
    async fn page(&self, next: Option<&str>, lease: Uuid, discovery_due: bool) -> Result<()> {
        let jwt = self.config.app_jwt()?;
        if discovery_due {
            let page = self
                .client
                .request(
                    &jwt,
                    Method::GET,
                    next.unwrap_or("/app/hook/deliveries?per_page=100"),
                    None,
                    None,
                )
                .await?;
            let rows = page.value.as_array().context("delivery summary schema")?;
            let mut oldest = Utc::now();
            let mut client = self.repo.pg.transaction_client().await?;
            let tx = client.transaction().await?;
            anyhow::ensure!(tx.query_opt("SELECT 1 FROM team_github_app_checkpoint WHERE app_id=$1 AND lease_token=$2 AND lease_until>now() FOR UPDATE",&[&self.config.app_id,&lease]).await?.is_some(),"delivery recovery lease lost");
            for r in rows {
                let at: DateTime<Utc> = r["delivered_at"]
                    .as_str()
                    .context("delivery timestamp unavailable")?
                    .parse()?;
                oldest = oldest.min(at);
                let Some(installation) = r["installation_id"].as_i64() else {
                    continue;
                };
                let Some(id) = r["id"].as_i64() else { continue };
                if tx.query_opt("SELECT 1 FROM team_github_installations i JOIN team_rollouts o USING(organization_id) WHERE installation_id=$1 AND i.status='active' AND o.enabled",&[&installation]).await?.is_none(){continue;}
                if r["status_code"]
                    .as_i64()
                    .is_some_and(|s| (200..300).contains(&s))
                {
                    continue;
                }
                let guid = r["guid"].as_str().context("delivery GUID unavailable")?;
                tx.execute("INSERT INTO team_github_delivery_recovery(delivery_id,installation_id,delivery_guid,delivered_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",&[&id,&installation,&guid,&at]).await?;
            }
            // GitHub's retained summaries are bounded. Older gaps remain covered by API sweep,
            // never claimed recovered simply because a redelivery summary disappeared.
            let next = page
                .next
                .filter(|_| oldest > Utc::now() - chrono::Duration::days(3));
            tx.execute("UPDATE team_github_app_checkpoint SET next_url=$3,last_success_at=CASE WHEN $3::text IS NULL THEN now() ELSE last_success_at END,retry_at=CASE WHEN $3::text IS NULL THEN now()+interval '5 minutes' ELSE now() END,error_code=NULL WHERE app_id=$1 AND lease_token=$2",&[&self.config.app_id,&lease,&next]).await?;
            tx.commit().await?;
        }
        // An accepted local delivery is the ACK, not a successful redelivery request.
        self.repo.pg.execute("UPDATE team_github_delivery_recovery d SET acknowledged_at=now(),error_code=NULL WHERE d.acknowledged_at IS NULL AND (EXISTS(SELECT 1 FROM team_webhook_inbox w WHERE w.provider='github' AND w.delivery_id=d.delivery_guid) OR EXISTS(SELECT 1 FROM team_webhook_dispositions w WHERE w.provider='github' AND w.delivery_id=d.delivery_guid))",&[]).await?;
        let start = std::time::Instant::now();
        for _ in 0..20 {
            // A committed retry intent survives response loss. Renew the process lease
            // before each bounded network request; a second process cannot drain it.
            anyhow::ensure!(self.repo.pg.execute("UPDATE team_github_app_checkpoint SET lease_until=now()+interval '90 seconds' WHERE app_id=$1 AND lease_token=$2 AND lease_until>now()",&[&self.config.app_id,&lease]).await?==1,"delivery recovery lease lost");
            let job=self.repo.pg.query_opt("UPDATE team_github_delivery_recovery SET attempts=attempts+1,retry_at=now()+interval '10 minutes' WHERE delivery_id=(SELECT d.delivery_id FROM team_github_delivery_recovery d JOIN team_github_installations i USING(installation_id) JOIN team_rollouts o USING(organization_id) WHERE d.acknowledged_at IS NULL AND d.retry_at<=now() AND d.attempts<3 AND i.status='active' AND o.enabled ORDER BY d.delivered_at LIMIT 1) RETURNING delivery_id",&[]).await?;
            let Some(job) = job else {
                break;
            };
            {
                let id: i64 = job.get(0);
                let result = self
                    .client
                    .request(
                        &jwt,
                        Method::POST,
                        &format!("/app/hook/deliveries/{id}/attempts"),
                        Some(&serde_json::json!({})),
                        None,
                    )
                    .await;
                match result {
                    Ok(_) => {
                        self.repo.pg.execute("UPDATE team_github_delivery_recovery SET requested_at=now(),error_code=NULL WHERE delivery_id=$1",&[&id]).await?;
                    }
                    Err(e) => {
                        let failure = e.downcast_ref::<GithubFailure>();
                        let code = failure.map_or("redelivery_response_unconfirmed", |e| e.code);
                        let wait = failure.map_or(600, |e| e.retry_seconds.max(600));
                        self.repo.pg.execute("UPDATE team_github_delivery_recovery SET error_code=$2,retry_at=now()+$3*interval '1 second' WHERE delivery_id=$1",&[&id,&code,&wait]).await?;
                    }
                }
            }
            if start.elapsed() >= std::time::Duration::from_secs(10) {
                break;
            }
        }
        self.repo.pg.execute("UPDATE team_github_app_checkpoint SET lease_token=NULL,lease_until=NULL WHERE app_id=$1 AND lease_token=$2",&[&self.config.app_id,&lease]).await?;
        Ok(())
    }
}
