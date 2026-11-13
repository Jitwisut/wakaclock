use crate::infrastructure::database::ClickHouseClient;
use crate::repository::canonical::canonical_winner_relation;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone, Debug, Deserialize, Serialize, clickhouse::Row)]
pub struct MatchEvent {
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    pub heartbeat_id: String,
    pub base_revision: u32,
    pub agent: String,
    pub evidence_id: String,
    pub proof: String,
    pub digest: String,
    pub operation: String,
}
#[derive(Debug, Deserialize, clickhouse::Row)]
pub struct MatchBase {
    pub heartbeat_id: String,
    pub revision: u32,
    pub actor_type: String,
    pub entity_type: String,
    pub editor: String,
    pub activity_segments: String,
    pub ai_source: Option<String>,
}
pub struct MatchedAuthorshipRepository {
    client: Arc<ClickHouseClient>,
}
impl MatchedAuthorshipRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }
    pub async fn migrate(&self) -> Result<()> {
        self.client
            .get_client()
            .query(
                "CREATE TABLE IF NOT EXISTS wakaclock.heartbeat_matched_authorship (
            user_id UUID, heartbeat_id String, base_revision UInt32, agent String,
            evidence_id String, proof String, digest String, operation String
        ) ENGINE = MergeTree ORDER BY (user_id, heartbeat_id, digest)",
            )
            .execute()
            .await?;
        Ok(())
    }
    pub async fn insert(&self, event: &MatchEvent) -> Result<()> {
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.heartbeat_matched_authorship")?;
        insert.write(event).await?;
        insert.end().await?;
        Ok(())
    }
    pub async fn bases(&self, user: Uuid, ids: &[String]) -> Result<Vec<MatchBase>> {
        let relation = canonical_winner_relation("h.user_id = ?", "h");
        // Filter IDs only AFTER canonicalization: a later correction may change an ID.
        let sql = format!("SELECT assumeNotNull(heartbeat_id) AS heartbeat_id, revision, actor_type, entity_type, editor, activity_segments, ai_source FROM {relation} WHERE heartbeat_id IN ?");
        Ok(self
            .client
            .get_client()
            .query(&sql)
            .bind(user)
            .bind(ids)
            .fetch_all::<MatchBase>()
            .await?)
    }
    pub async fn events(&self, user: Uuid, ids: &[String]) -> Result<Vec<MatchEvent>> {
        // Include reuse of a digest/evidence reference elsewhere in THIS account.
        // Such reuse is an immutable conflict, including after a revocation.
        let sql = "SELECT DISTINCT ?fields FROM wakaclock.heartbeat_matched_authorship WHERE user_id = ? AND (
            heartbeat_id IN ? OR digest IN (SELECT digest FROM wakaclock.heartbeat_matched_authorship WHERE user_id = ? AND heartbeat_id IN ?)
            OR evidence_id IN (SELECT evidence_id FROM wakaclock.heartbeat_matched_authorship WHERE user_id = ? AND heartbeat_id IN ?))";
        Ok(self
            .client
            .get_client()
            .query(sql)
            .bind(user)
            .bind(ids)
            .bind(user)
            .bind(ids)
            .bind(user)
            .bind(ids)
            .fetch_all::<MatchEvent>()
            .await?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    #[ignore = "requires isolated CLICKHOUSE_TEST_URL"]
    async fn matched_authorship_ledger_reads_are_account_scoped() {
        let client = crate::test_support::clickhouse_client().await;
        let repo = MatchedAuthorshipRepository::new(client);
        repo.migrate().await.unwrap();
        repo.migrate().await.unwrap();
        let user = Uuid::now_v7();
        let other = Uuid::now_v7();
        let mut event = MatchEvent {
            user_id: user,
            heartbeat_id: "same-id".into(),
            base_revision: 0,
            agent: "claude-code".into(),
            evidence_id: "same-evidence".into(),
            proof: "fingerprint".into(),
            digest: "a".repeat(64),
            operation: "match".into(),
        };
        repo.insert(&event).await.unwrap();
        repo.insert(&event).await.unwrap();
        event.user_id = other;
        event.operation = "revoke".into();
        repo.insert(&event).await.unwrap();
        let rows = repo.events(user, &["same-id".into()]).await.unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].user_id, user);
        assert_eq!(rows[0].operation, "match");
        assert!(repo
            .events(Uuid::now_v7(), &["same-id".into()])
            .await
            .unwrap()
            .is_empty());
    }
}
