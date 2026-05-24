use anyhow::{Context, Result};
use std::sync::Arc;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::heartbeat::HeartbeatRow;

pub struct HeartbeatRepository {
    client: Arc<ClickHouseClient>,
}

impl HeartbeatRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    /// รัน Migration สร้างตาราง
    pub async fn migrate(&self) -> Result<()> {
        let ch_client = self.client.get_client();
        ch_client
            .query(
                r#"
                CREATE TABLE IF NOT EXISTS wakaclock.heartbeats (
                    user_id UUID,
                    entity String,
                    entity_type String,
                    time Float64,
                    date UInt16,
                    project Nullable(String),
                    branch Nullable(String),
                    language Nullable(String),
                    dependencies Array(String),
                    lines Nullable(UInt32),
                    line_number Nullable(UInt32),
                    cursor_position Nullable(UInt32),
                    is_write UInt8,
                    category String,
                    editor String,
                    operating_system String,
                    machine String,
                    user_agent String,
                    ast_language Nullable(String),
                    ast_confidence Nullable(Float32),
                    keystrokes Nullable(UInt32),
                    chars_added Nullable(UInt32),
                    chars_deleted Nullable(UInt32),
                    active_seconds Nullable(Float64),
                    is_ai_generated UInt8,
                    ai_agent Nullable(String),
                    ai_lines_added Nullable(UInt32),
                    ai_lines_deleted Nullable(UInt32),
                    created_at UInt32
                ) ENGINE = MergeTree()
                ORDER BY (user_id, date, time)
                "#,
            )
            .execute()
            .await
            .context("Failed to create heartbeats table")?;

        ch_client
            .query(
                "ALTER TABLE wakaclock.heartbeats
                 ADD COLUMN IF NOT EXISTS active_seconds Nullable(Float64)
                 AFTER chars_deleted",
            )
            .execute()
            .await
            .context("Failed to add heartbeats.active_seconds column")?;

        ch_client
            .query(
                "CREATE TABLE IF NOT EXISTS wakaclock.heartbeats_incoming
                 AS wakaclock.heartbeats
                 ENGINE = Null",
            )
            .execute()
            .await
            .context("Failed to create heartbeats_incoming table")?;

        ch_client
            .query(
                "ALTER TABLE wakaclock.heartbeats_incoming
                 ADD COLUMN IF NOT EXISTS active_seconds Nullable(Float64)
                 AFTER chars_deleted",
            )
            .execute()
            .await
            .context("Failed to add heartbeats_incoming.active_seconds column")?;

        Ok(())
    }

    /// Insert heartbeats ลงใน ClickHouse
    pub async fn insert_batch(&self, rows: Vec<HeartbeatRow>) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }

        let ch_client = self.client.get_client();
        let mut insert = ch_client
            .insert("wakaclock.heartbeats")
            .map_err(|e| anyhow::anyhow!("ClickHouse insert Error: {e}"))?;

        for row in rows {
            insert
                .write(&row)
                .await
                .map_err(|e| anyhow::anyhow!("ClickHouse write row Error: {e}"))?;
        }

        insert
            .end()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse end insert Error: {e}"))?;

        Ok(())
    }

    /// Query heartbeats ตาม date string "YYYY-MM-DD"
    /// date ใน ClickHouse เก็บเป็น UInt16 (days since 1970-01-01)
    pub async fn get_by_date(
        &self,
        user_id: uuid::Uuid,
        date_str: &str, // "2026-04-10"
    ) -> Result<Vec<HeartbeatRow>> {
        let ch_client = self.client.get_client();

        // แปลง "YYYY-MM-DD" → days since epoch (UInt16)
        let date_u16 =
            date_str_to_u16(date_str).context("Invalid date format, expected YYYY-MM-DD")?;

        let rows = ch_client
            .query(
                "SELECT
                    user_id, entity, entity_type, time, date,
                    project, branch, language, dependencies,
                    lines, line_number, cursor_position,
                    is_write, category, editor, operating_system,
                    machine, user_agent,
                    ast_language, ast_confidence,
                    keystrokes, chars_added, chars_deleted, active_seconds,
                    is_ai_generated, ai_agent, ai_lines_added, ai_lines_deleted,
                    created_at
                FROM wakaclock.heartbeats
                WHERE user_id = ? AND date = ?
                ORDER BY time ASC",
            )
            .bind(user_id)
            .bind(date_u16)
            .fetch_all::<HeartbeatRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(rows)
    }
}

/// แปลง "YYYY-MM-DD" → UInt16 (days since 1970-01-01)
fn date_str_to_u16(date_str: &str) -> Option<u16> {
    let parts: Vec<&str> = date_str.split('-').collect();
    if parts.len() != 3 {
        return None;
    }
    let y: i32 = parts[0].parse().ok()?;
    let m: u32 = parts[1].parse().ok()?;
    let d: u32 = parts[2].parse().ok()?;

    use chrono::NaiveDate;
    let date = NaiveDate::from_ymd_opt(y, m, d)?;
    let epoch = NaiveDate::from_ymd_opt(1970, 1, 1)?;
    let days = (date - epoch).num_days();

    u16::try_from(days).ok()
}
