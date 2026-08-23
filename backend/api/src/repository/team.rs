use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::team::{TeamMemberRow, TeamRow};

pub struct TeamRepository {
    client: Arc<ClickHouseClient>,
}

impl TeamRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    pub async fn migrate(&self) -> Result<()> {
        let ch_client = self.client.get_client();

        ch_client
            .query(
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.teams (
                    team_id UUID,
                    org_id UUID,
                    name String,
                    created_at UInt32,
                    updated_at UInt32
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY (org_id, team_id)
                "#,
            )
            .execute()
            .await
            .context("Failed to create teams table")?;

        ch_client
            .query(
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.team_members (
                    team_id UUID,
                    user_id UUID,
                    role String,
                    joined_at UInt32,
                    updated_at UInt32
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY (team_id, user_id)
                "#,
            )
            .execute()
            .await
            .context("Failed to create team_members table")?;

        Ok(())
    }

    pub async fn insert_team(&self, row: &TeamRow) -> Result<()> {
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.teams")
            .map_err(|e| anyhow::anyhow!("ClickHouse insert error: {e}"))?;
        insert
            .write(row)
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse write row error: {e}"))?;
        insert
            .end()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse end insert error: {e}"))?;
        Ok(())
    }

    pub async fn upsert_member(&self, row: &TeamMemberRow) -> Result<()> {
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.team_members")
            .map_err(|e| anyhow::anyhow!("ClickHouse insert error: {e}"))?;
        insert
            .write(row)
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse write row error: {e}"))?;
        insert
            .end()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse end insert error: {e}"))?;
        Ok(())
    }

    pub async fn is_member(&self, team_id: Uuid, user_id: Uuid) -> Result<bool> {
        let role = self
            .client
            .get_client()
            .query(
                "SELECT role FROM wakaclock.team_members FINAL
                 WHERE team_id = ? AND user_id = ?
                 LIMIT 1",
            )
            .bind(team_id)
            .bind(user_id)
            .fetch_optional::<String>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(role.is_some())
    }

    pub async fn list_for_org(&self, org_id: Uuid) -> Result<Vec<TeamRow>> {
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT team_id, org_id, name, created_at, updated_at
                 FROM wakaclock.teams FINAL
                 WHERE org_id = ?
                 ORDER BY created_at ASC",
            )
            .bind(org_id)
            .fetch_all::<TeamRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(rows)
    }

    pub async fn get(&self, team_id: Uuid) -> Result<Option<TeamRow>> {
        let row = self
            .client
            .get_client()
            .query(
                "SELECT team_id, org_id, name, created_at, updated_at
                 FROM wakaclock.teams FINAL
                 WHERE team_id = ?
                 LIMIT 1",
            )
            .bind(team_id)
            .fetch_optional::<TeamRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(row)
    }
}
