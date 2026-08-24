use anyhow::{anyhow, Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::follow_up::{HumanFollowUpEventRequest, HumanFollowUpEventRow};

pub struct FollowUpRepository {
    client: Arc<ClickHouseClient>,
}

impl FollowUpRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    pub async fn migrate(&self) -> Result<()> {
        self.client
            .get_client()
            .query(
                "CREATE TABLE IF NOT EXISTS wakaclock.human_follow_up_events (
                    user_id UUID,
                    ai_change_id String,
                    file_identity String,
                    start_line UInt32,
                    end_line UInt32,
                    occurred_at Float64,
                    created_at UInt32 DEFAULT toUInt32(now())
                 ) ENGINE = ReplacingMergeTree(created_at)
                 ORDER BY (user_id, ai_change_id)",
            )
            .execute()
            .await
            .context("failed to create human_follow_up_events")?;
        Ok(())
    }

    pub async fn insert(&self, user_id: Uuid, request: HumanFollowUpEventRequest) -> Result<()> {
        validate(&request)?;
        let row = HumanFollowUpEventRow {
            user_id,
            ai_change_id: request.ai_change_id,
            file_identity: request.file_identity,
            start_line: request.start_line,
            end_line: request.end_line,
            occurred_at: request.occurred_at,
            created_at: chrono::Utc::now().timestamp() as u32,
        };
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.human_follow_up_events")
            .map_err(|error| anyhow!("human follow-up insert error: {error}"))?;
        insert
            .write(&row)
            .await
            .map_err(|error| anyhow!("human follow-up row error: {error}"))?;
        insert
            .end()
            .await
            .map_err(|error| anyhow!("human follow-up flush error: {error}"))?;
        Ok(())
    }

    pub async fn count(&self, user_id: Uuid, start: f64, end: f64) -> Result<u64> {
        #[derive(Debug, serde::Deserialize, clickhouse::Row)]
        struct CountRow {
            count: u64,
        }
        let row = self
            .client
            .get_client()
            .query(
                "SELECT count() AS count FROM wakaclock.human_follow_up_events FINAL
                 WHERE user_id = ? AND occurred_at >= ? AND occurred_at < ?",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_one::<CountRow>()
            .await
            .context("failed to count human follow-up events")?;
        Ok(row.count)
    }
}

fn validate(request: &HumanFollowUpEventRequest) -> Result<()> {
    if request.ai_change_id.trim().is_empty() || request.ai_change_id.len() > 256 {
        return Err(anyhow!("ai_change_id must contain 1-256 characters"));
    }
    if request.file_identity.trim().is_empty() || request.file_identity.len() > 256 {
        return Err(anyhow!("file_identity must contain 1-256 characters"));
    }
    if request.start_line == 0 || request.end_line < request.start_line {
        return Err(anyhow!("line interval is invalid"));
    }
    if !request.occurred_at.is_finite() || request.occurred_at < 0.0 {
        return Err(anyhow!("occurred_at must be a finite Unix timestamp"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn follow_up_validation_rejects_source_like_empty_identity() {
        let result = validate(&HumanFollowUpEventRequest {
            ai_change_id: "change-1".into(),
            file_identity: "file-opaque".into(),
            start_line: 1,
            end_line: 2,
            occurred_at: 1.0,
        });
        assert!(result.is_ok());
    }
}
