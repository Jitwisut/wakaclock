//! Durable metadata verification. Never creates or modifies canonical usage/heartbeats.
use crate::repository::{
    team_github::GithubRepositoryStore, team_insights::TeamInsightsRepository,
};
use anyhow::Result;
use std::sync::Arc;
use uuid::Uuid;

pub struct ContextVerifier {
    pub store: Arc<GithubRepositoryStore>,
    pub usage: Arc<TeamInsightsRepository>,
}
impl ContextVerifier {
    pub async fn tick(&self) -> Result<bool> {
        let lease = Uuid::now_v7();
        let row = self.store.claim_context(lease).await?;
        let Some(row) = row else { return Ok(false) };
        let user: Uuid = row.get("user_id");
        let org: Uuid = row.get("organization_id");
        let event: String = row.get("event_id");
        let session: String = row.get("session_id");
        let collector: Uuid = row.get("collector_id");
        let project: Uuid = row.get("project_id");
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(10),
            self.usage.session_facts(user, &session),
        )
        .await
        .unwrap_or_else(|_| Err(anyhow::anyhow!("canonical store timeout")));
        let (state, reason, wait) = match result {
            Ok(facts)
                if facts.iter().any(|f| {
                    f.collector_id.as_deref() == Some(collector.to_string().as_str())
                        && f.project_id == Some(project)
                        && f.project_attribution_method.as_deref() == Some("explicit_project_hint")
                }) =>
            {
                ("verified", None, 0)
            }
            Ok(_) if row.get::<_, i32>("verification_attempts") >= 60 => (
                "dead_letter",
                Some("canonical_session_evidence_unconfirmed"),
                0,
            ),
            Ok(_) => (
                "pending",
                Some("waiting_for_canonical_session"),
                60_i64
                    .saturating_mul(1_i64 << row.get::<_, i32>("verification_attempts").min(6))
                    .min(3600),
            ),
            Err(_) => ("pending", Some("canonical_store_unavailable"), 60),
        };
        self.store
            .finish_context(user, org, &event, lease, (state, reason, wait))
            .await
    }
}
