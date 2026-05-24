use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::project_rule::ProjectRuleRow;

pub struct ProjectRuleRepository {
    client: Arc<ClickHouseClient>,
}

impl ProjectRuleRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    pub async fn migrate(&self) -> Result<()> {
        let ch_client = self.client.get_client();
        ch_client
            .query(
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.project_rules (
                    user_id UUID,
                    rule_id UUID,
                    pattern String,
                    project_name String,
                    priority Int32,
                    is_active Bool,
                    created_at UInt32,
                    updated_at UInt32
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY (user_id, priority, rule_id)
                "#,
            )
            .execute()
            .await
            .context("Failed to create project_rules table")?;

        Ok(())
    }

    pub async fn list_by_user(&self, user_id: Uuid) -> Result<Vec<ProjectRuleRow>> {
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT
                    user_id, rule_id, pattern, project_name, priority, is_active, created_at, updated_at
                 FROM wakaclock.project_rules
                 WHERE user_id = ?
                 ORDER BY priority DESC, updated_at DESC",
            )
            .bind(user_id)
            .fetch_all::<ProjectRuleRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(rows)
    }

    pub async fn upsert(&self, row: &ProjectRuleRow) -> Result<()> {
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.project_rules")
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

    pub async fn delete(&self, user_id: Uuid, rule_id: Uuid) -> Result<()> {
        self.client
            .get_client()
            .query("ALTER TABLE wakaclock.project_rules DELETE WHERE user_id = ? AND rule_id = ?")
            .bind(user_id)
            .bind(rule_id)
            .execute()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse delete error: {e}"))?;

        Ok(())
    }
}
