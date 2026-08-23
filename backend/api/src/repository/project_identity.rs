use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::project_identity::{ProjectAliasRow, ProjectIdentityRow, UnresolvedProjectRow};

pub struct ProjectIdentityRepository {
    client: Arc<ClickHouseClient>,
}

impl ProjectIdentityRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    /// Creates the identity tables and widens the existing ones with a nullable
    /// `project_id`, matching how every other table on this database is created (see
    /// `main.rs`, where the repository `migrate()` calls run at startup).
    ///
    /// Everything here is `IF NOT EXISTS`. There is no migration-tracking table on this
    /// database, so `migrate()` runs on every boot and must stay a no-op after the first.
    pub async fn migrate(&self) -> Result<()> {
        // Deliberately a new table rather than an evolution of `wakaclock.projects`:
        // ClickHouse can only append columns to a sorting key, and this needs
        // (user_id, name) -> (user_id, project_id), which replaces a key column. Leaving
        // `projects` untouched is also what keeps this migration reversible — the read
        // path still uses it until PR 9.9 backfills history.
        self.client
            .get_client()
            .query(
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.project_identities (
                    user_id UUID,
                    project_id UUID,
                    canonical_name String,
                    display_name String,
                    repository String DEFAULT '',
                    root_fingerprint String DEFAULT '',
                    first_heartbeat_at UInt32,
                    last_heartbeat_at UInt32,
                    created_at UInt32,
                    updated_at UInt32,
                    version UInt64
                ) ENGINE = ReplacingMergeTree(version)
                ORDER BY (user_id, project_id)
                "#,
            )
            .execute()
            .await
            .context("Failed to create project_identities table")?;

        self.client
            .get_client()
            .query(
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.project_aliases (
                    user_id UUID,
                    alias String,
                    project_id UUID,
                    created_at UInt32,
                    updated_at UInt32
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY (user_id, alias)
                "#,
            )
            .execute()
            .await
            .context("Failed to create project_aliases table")?;

        // Nullable so existing rows stay valid: NULL means "not yet resolved", which is
        // exactly what every historical heartbeat is until PR 9.9 runs. Adding a nullable
        // column in ClickHouse is a metadata-only operation, so this is cheap even on a
        // large live `heartbeats` table.
        // `heartbeats_incoming` is included because the reprocess path inserts a whole
        // `HeartbeatRow` into it: the client derives the column list from the struct, so a
        // table missing this column would fail every reprocess insert, not silently skip it.
        for table in ["heartbeats", "heartbeats_incoming", "project_daily"] {
            self.client
                .get_client()
                .query(&format!(
                    "ALTER TABLE wakaclock.{table} ADD COLUMN IF NOT EXISTS project_id Nullable(UUID)"
                ))
                .execute()
                .await
                .with_context(|| format!("Failed to add project_id to {table}"))?;
        }

        Ok(())
    }

    /// Backs `ProjectIdentityService::verify_ownership`; unused until the `project_id`-keyed
    /// endpoints land in PR 9.7/9.8.
    #[allow(dead_code)]
    pub async fn find_by_project_id(
        &self,
        user_id: Uuid,
        project_id: Uuid,
    ) -> Result<Option<ProjectIdentityRow>> {
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT
                    user_id, project_id, canonical_name, display_name, repository,
                    root_fingerprint, first_heartbeat_at, last_heartbeat_at,
                    created_at, updated_at, version
                 FROM wakaclock.project_identities FINAL
                 WHERE user_id = ? AND project_id = ?
                 LIMIT 1",
            )
            .bind(user_id)
            .bind(project_id)
            .fetch_all::<ProjectIdentityRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse project identity query error: {e}"))?;

        Ok(rows.into_iter().next())
    }

    pub async fn find_by_canonical_name(
        &self,
        user_id: Uuid,
        canonical_name: &str,
    ) -> Result<Option<ProjectIdentityRow>> {
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT
                    user_id, project_id, canonical_name, display_name, repository,
                    root_fingerprint, first_heartbeat_at, last_heartbeat_at,
                    created_at, updated_at, version
                 FROM wakaclock.project_identities FINAL
                 WHERE user_id = ? AND canonical_name = ?
                 LIMIT 1",
            )
            .bind(user_id)
            .bind(canonical_name)
            .fetch_all::<ProjectIdentityRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse project identity query error: {e}"))?;

        Ok(rows.into_iter().next())
    }

    pub async fn find_alias(&self, user_id: Uuid, alias: &str) -> Result<Option<ProjectAliasRow>> {
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT user_id, alias, project_id, created_at, updated_at
                 FROM wakaclock.project_aliases FINAL
                 WHERE user_id = ? AND alias = ?
                 LIMIT 1",
            )
            .bind(user_id)
            .bind(alias)
            .fetch_all::<ProjectAliasRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse project alias query error: {e}"))?;

        Ok(rows.into_iter().next())
    }

    pub async fn upsert_identity(&self, row: &ProjectIdentityRow) -> Result<()> {
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.project_identities")
            .map_err(|e| anyhow::anyhow!("ClickHouse insert Error: {e}"))?;

        insert
            .write(row)
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse write row Error: {e}"))?;

        insert
            .end()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse end insert Error: {e}"))?;

        Ok(())
    }

    pub async fn upsert_alias(&self, row: &ProjectAliasRow) -> Result<()> {
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.project_aliases")
            .map_err(|e| anyhow::anyhow!("ClickHouse insert Error: {e}"))?;

        insert
            .write(row)
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse write row Error: {e}"))?;

        insert
            .end()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse end insert Error: {e}"))?;

        Ok(())
    }

    /// Distinct project names on heartbeats that carry no `project_id` yet, with how much
    /// history each accounts for. Read-only — this is the input to the backfill dry-run.
    pub async fn list_unresolved_projects(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<UnresolvedProjectRow>> {
        self.client
            .get_client()
            .query(
                "SELECT
                    ifNull(project, '') AS project,
                    count() AS heartbeat_count
                 FROM wakaclock.heartbeats
                 WHERE user_id = ? AND project_id IS NULL
                 GROUP BY project
                 ORDER BY heartbeat_count DESC, project ASC",
            )
            .bind(user_id)
            .fetch_all::<UnresolvedProjectRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse unresolved projects query error: {e}"))
    }

    /// The historical reprocess path is deliberately both account- and date-scoped.  A
    /// project rename should never trigger a mutation across another account's history.
    pub async fn set_project_id_for_range(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
        project: &str,
        project_id: Uuid,
    ) -> Result<()> {
        self.client
            .get_client()
            .query(
                "ALTER TABLE wakaclock.heartbeats
                 UPDATE project_id = ?
                 WHERE user_id = ?
                   AND toDate(date) BETWEEN toDate(?) AND toDate(?)
                   AND project_id IS NULL
                   AND ifNull(project, '') = ?
                 SETTINGS mutations_sync = 1",
            )
            .bind(project_id)
            .bind(user_id)
            .bind(start)
            .bind(end)
            .bind(project)
            .execute()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse project-id backfill mutation failed: {e}"))
    }
}
