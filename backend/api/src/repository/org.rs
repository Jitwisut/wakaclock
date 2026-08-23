use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::org::{OrgMemberRow, OrgRow};

pub struct OrgRepository {
    client: Arc<ClickHouseClient>,
}

impl OrgRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    pub async fn migrate(&self) -> Result<()> {
        let ch_client = self.client.get_client();

        ch_client
            .query(
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.orgs (
                    org_id UUID,
                    name String,
                    owner_user_id UUID,
                    created_at UInt32,
                    updated_at UInt32
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY (org_id)
                "#,
            )
            .execute()
            .await
            .context("Failed to create orgs table")?;

        ch_client
            .query(
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.org_members (
                    org_id UUID,
                    user_id UUID,
                    role String,
                    joined_at UInt32,
                    updated_at UInt32
                ) ENGINE = ReplacingMergeTree(updated_at)
                ORDER BY (org_id, user_id)
                "#,
            )
            .execute()
            .await
            .context("Failed to create org_members table")?;

        Ok(())
    }

    pub async fn insert_org(&self, row: &OrgRow) -> Result<()> {
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.orgs")
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

    pub async fn upsert_member(&self, row: &OrgMemberRow) -> Result<()> {
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.org_members")
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

    /// `FINAL` because a permission decision — "is this person allowed to create a
    /// team?" — must never read a stale pre-merge row from `ReplacingMergeTree`. Same
    /// reasoning `AuthKeyCache`'s doc comment gives for why it doesn't query the users
    /// table directly per-request.
    pub async fn member_role(&self, org_id: Uuid, user_id: Uuid) -> Result<Option<String>> {
        let row = self
            .client
            .get_client()
            .query(
                "SELECT role FROM wakaclock.org_members FINAL
                 WHERE org_id = ? AND user_id = ?
                 LIMIT 1",
            )
            .bind(org_id)
            .bind(user_id)
            .fetch_optional::<String>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(row)
    }

    pub async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<OrgRow>> {
        let rows = self
            .client
            .get_client()
            .query(
                "SELECT o.org_id, o.name, o.owner_user_id, o.created_at, o.updated_at
                 FROM wakaclock.orgs FINAL AS o
                 INNER JOIN wakaclock.org_members FINAL AS m ON m.org_id = o.org_id
                 WHERE m.user_id = ?
                 ORDER BY o.created_at ASC",
            )
            .bind(user_id)
            .fetch_all::<OrgRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(rows)
    }

    pub async fn get(&self, org_id: Uuid) -> Result<Option<OrgRow>> {
        let row = self
            .client
            .get_client()
            .query(
                "SELECT org_id, name, owner_user_id, created_at, updated_at
                 FROM wakaclock.orgs FINAL
                 WHERE org_id = ?
                 LIMIT 1",
            )
            .bind(org_id)
            .fetch_optional::<OrgRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(row)
    }
}
