//! PostgreSQL request-path state for Kafka ingest (plan K0.5).
//!
//! The repository contains only the small access/rule surface needed before a
//! heartbeat is published.  Analytics data remains in ClickHouse; this module
//! makes the authorization decision available while ClickHouse is unavailable.

use anyhow::Result;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::model::project_rule::ProjectRuleRow;

#[derive(Clone)]
pub struct IngestStateRepository {
    postgres: Arc<PostgresClient>,
}

#[derive(Debug, Clone)]
pub struct AccessState {
    pub status: String,
    pub trial_ends_at: Option<chrono::DateTime<chrono::Utc>>,
    pub subscription_period_end: Option<chrono::DateTime<chrono::Utc>>,
}

impl IngestStateRepository {
    pub fn new(postgres: Arc<PostgresClient>) -> Self {
        Self { postgres }
    }

    pub async fn has_active_access(&self, user_id: Uuid) -> Result<bool> {
        let Some(state) = self.get_access(user_id).await? else {
            return Ok(false);
        };
        let now = chrono::Utc::now();
        Ok(state.status == "active"
            || (state.status == "trialing" && state.trial_ends_at.is_some_and(|value| value > now)))
    }

    pub async fn has_user(&self, user_id: Uuid) -> Result<bool> {
        Ok(self
            .postgres
            .query_opt(
                "SELECT 1 FROM users WHERE id=$1 AND is_active AND deleted_at IS NULL",
                &[&user_id],
            )
            .await?
            .is_some())
    }

    pub async fn get_access(&self, user_id: Uuid) -> Result<Option<AccessState>> {
        let row = self
            .postgres
            .query_opt(
                "SELECT status, trial_ends_at, subscription_period_end
                 FROM user_ingest_access WHERE user_id=$1",
                &[&user_id],
            )
            .await?;
        Ok(row.map(|row| AccessState {
            status: row.get(0),
            trial_ends_at: row.get(1),
            subscription_period_end: row.get(2),
        }))
    }

    /// Load the complete access mirror for the K0.5 backfill/parity command.
    /// Callers receive only product-state fields; credentials and account labels
    /// never cross this repository boundary.
    pub async fn list_access(&self) -> Result<HashMap<Uuid, AccessState>> {
        let rows = self
            .postgres
            .query(
                "SELECT user_id, status, trial_ends_at, subscription_period_end
                 FROM user_ingest_access",
                &[],
            )
            .await?;
        Ok(rows
            .into_iter()
            .map(|row| {
                (
                    row.get(0),
                    AccessState {
                        status: row.get(1),
                        trial_ends_at: row.get(2),
                        subscription_period_end: row.get(3),
                    },
                )
            })
            .collect())
    }

    pub async fn upsert_access(
        &self,
        user_id: Uuid,
        status: &str,
        trial_ends_at: Option<chrono::DateTime<chrono::Utc>>,
        subscription_period_end: Option<chrono::DateTime<chrono::Utc>>,
    ) -> Result<()> {
        self.postgres
            .execute(
                "INSERT INTO user_ingest_access
                    (user_id,status,trial_ends_at,subscription_period_end,updated_at)
                 VALUES ($1,$2,$3,$4,now())
                 ON CONFLICT (user_id) DO UPDATE SET
                    status=excluded.status,
                    trial_ends_at=excluded.trial_ends_at,
                    subscription_period_end=excluded.subscription_period_end,
                    updated_at=now()",
                &[&user_id, &status, &trial_ends_at, &subscription_period_end],
            )
            .await?;
        Ok(())
    }

    pub async fn list_rules(&self, user_id: Uuid) -> Result<Vec<ProjectRuleRow>> {
        self.list_rules_query(
            "SELECT user_id, rule_id, pattern, project_name, priority, is_active,
                    EXTRACT(EPOCH FROM created_at)::bigint,
                    EXTRACT(EPOCH FROM updated_at)::bigint
             FROM project_rules WHERE user_id=$1
             ORDER BY priority DESC, updated_at DESC, rule_id",
            &[&user_id],
        )
        .await
    }

    /// Load every mirrored rule for the K0.5 backfill/parity command.  Ordering is
    /// deterministic so a mismatch report can be compared across runs without
    /// exposing rule patterns or project names.
    pub async fn list_rules_all(&self) -> Result<Vec<ProjectRuleRow>> {
        self.list_rules_query(
            "SELECT user_id, rule_id, pattern, project_name, priority, is_active,
                    EXTRACT(EPOCH FROM created_at)::bigint,
                    EXTRACT(EPOCH FROM updated_at)::bigint
             FROM project_rules
             ORDER BY user_id, priority DESC, updated_at DESC, rule_id",
            &[],
        )
        .await
    }

    async fn list_rules_query(
        &self,
        sql: &str,
        params: &[&(dyn tokio_postgres::types::ToSql + Sync)],
    ) -> Result<Vec<ProjectRuleRow>> {
        let rows = self.postgres.query(sql, params).await?;
        Ok(rows
            .into_iter()
            .map(|row| ProjectRuleRow {
                user_id: row.get(0),
                rule_id: row.get(1),
                pattern: row.get(2),
                project_name: row.get(3),
                priority: row.get(4),
                is_active: row.get(5),
                created_at: row.get::<_, i64>(6).max(0) as u32,
                updated_at: row.get::<_, i64>(7).max(0) as u32,
            })
            .collect())
    }

    pub async fn upsert_rule(&self, row: &ProjectRuleRow) -> Result<()> {
        let created_at =
            chrono::DateTime::<chrono::Utc>::from_timestamp(i64::from(row.created_at), 0)
                .unwrap_or_else(chrono::Utc::now);
        let updated_at =
            chrono::DateTime::<chrono::Utc>::from_timestamp(i64::from(row.updated_at), 0)
                .unwrap_or_else(chrono::Utc::now);
        self.postgres
            .execute(
                "INSERT INTO project_rules
                    (user_id,rule_id,pattern,project_name,priority,is_active,created_at,updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                 ON CONFLICT (user_id,rule_id) DO UPDATE SET
                    pattern=excluded.pattern,
                    project_name=excluded.project_name,
                    priority=excluded.priority,
                    is_active=excluded.is_active,
                    updated_at=excluded.updated_at",
                &[
                    &row.user_id,
                    &row.rule_id,
                    &row.pattern,
                    &row.project_name,
                    &row.priority,
                    &row.is_active,
                    &created_at,
                    &updated_at,
                ],
            )
            .await?;
        Ok(())
    }

    pub async fn delete_rule(&self, user_id: Uuid, rule_id: Uuid) -> Result<()> {
        self.postgres
            .execute(
                "DELETE FROM project_rules WHERE user_id=$1 AND rule_id=$2",
                &[&user_id, &rule_id],
            )
            .await?;
        Ok(())
    }
}
