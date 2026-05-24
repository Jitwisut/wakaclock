use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::project_merge::ProjectMergeRow;

pub struct ProjectMergeRepository {
    client: Arc<ClickHouseClient>,
}

impl ProjectMergeRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    pub async fn migrate(&self) -> Result<()> {
        self.client
            .get_client()
            .query(
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.project_merges (
                    user_id UUID,
                    merge_id UUID,
                    source_project String,
                    target_project String,
                    created_at UInt32,
                    updated_at UInt32
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY (user_id, source_project)
                "#,
            )
            .execute()
            .await
            .context("Failed to create project_merges table")?;

        Ok(())
    }

    pub async fn list_by_user(&self, user_id: Uuid) -> Result<Vec<ProjectMergeRow>> {
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT
                    user_id, merge_id, source_project, target_project, created_at, updated_at
                 FROM wakaclock.project_merges
                 WHERE user_id = ?
                 ORDER BY source_project ASC, updated_at DESC",
            )
            .bind(user_id)
            .fetch_all::<ProjectMergeRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(rows)
    }

    pub async fn upsert(&self, row: &ProjectMergeRow) -> Result<()> {
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.project_merges")
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

    pub async fn delete(&self, user_id: Uuid, merge_id: Uuid) -> Result<()> {
        self.client
            .get_client()
            .query("ALTER TABLE wakaclock.project_merges DELETE WHERE user_id = ? AND merge_id = ?")
            .bind(user_id)
            .bind(merge_id)
            .execute()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse delete error: {e}"))?;

        Ok(())
    }
}
