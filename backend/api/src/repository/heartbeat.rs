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
                    date Date DEFAULT toDate(toDateTime(toUInt32(time))),
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
    ///
    /// Binds the raw string and lets ClickHouse's `toDate()` parse it — matching every
    /// other date-filtered query in this codebase (see services/duration.rs,
    /// services/summary.rs, etc.). This function used to convert the string to a
    /// days-since-epoch `u16` in Rust and bind that instead; ClickHouse 24.x's `equals()`
    /// rejects comparing `Date` against a bare `UInt16` ("Illegal types of arguments
    /// (Date, UInt16) of function equals"), so every call failed.
    pub async fn get_by_date(
        &self,
        user_id: uuid::Uuid,
        date_str: &str, // "2026-04-10"
    ) -> Result<Vec<HeartbeatRow>> {
        let ch_client = self.client.get_client();

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
                WHERE user_id = ? AND date = toDate(?)
                ORDER BY time ASC",
            )
            .bind(user_id)
            .bind(date_str)
            .fetch_all::<HeartbeatRow>()
            .await
            .map_err(|e| anyhow::anyhow!("ClickHouse query error: {e}"))?;

        Ok(rows)
    }
}
