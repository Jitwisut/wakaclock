// backend/api/src/services/heartbeat.rs
//
// Heartbeat service — แปลง Heartbeat domain object เป็น ClickHouse row และ insert
// ย้ายมาจาก crates/wakaclock-server/src/services/heartbeat_service.rs
// ใช้ clickhouse::Client ดิบจาก App.clickhouse.get_client()

use chrono::{DateTime, NaiveDate, Utc};
use clickhouse::Row;
use serde::Serialize;
use std::sync::Arc;
use uuid::Uuid;
use wakaclock_core::heartbeat::Heartbeat;

use crate::infrastructure::app::App;

/// Row struct ที่ตรงกับ schema ของ wakaclock.heartbeats ทุก column
#[derive(Row, Serialize)]
struct HeartbeatRow {
    #[serde(with = "clickhouse::serde::uuid")]
    user_id: Uuid,
    entity: String,
    entity_type: String,
    time: f64,
    #[serde(with = "clickhouse::serde::chrono::date")]
    date: NaiveDate,
    project: Option<String>,
    branch: Option<String>,
    language: Option<String>,
    dependencies: Vec<String>,
    lines: Option<u32>,
    line_number: Option<u32>,
    cursor_position: Option<u32>,
    is_write: bool,
    category: String,
    editor: String,
    operating_system: String,
    machine: String,
    user_agent: String,
    ast_language: Option<String>,
    ast_confidence: Option<f32>,
    keystrokes: Option<u32>,
    chars_added: Option<u32>,
    chars_deleted: Option<u32>,
    is_ai_generated: bool,
    ai_agent: Option<String>,
    ai_lines_added: Option<u32>,
    ai_lines_deleted: Option<u32>,
    #[serde(with = "clickhouse::serde::chrono::datetime")]
    created_at: DateTime<Utc>,
}

/// Insert heartbeats ลง ClickHouse
/// ใช้ clickhouse::Client ดิบจาก App.clickhouse.get_client()
pub async fn insert_heartbeats(
    state: &Arc<App>,
    heartbeats: Vec<Heartbeat>,
    user_id: Uuid,
) -> Result<(), String> {
    // ดึง raw clickhouse::Client จาก AppState
    let ch_client = state.clickhouse.get_client();

    let mut insert = ch_client
        .insert("wakaclock.heartbeats")
        .map_err(|e| format!("ClickHouse insert error: {e}"))?;

    for hb in heartbeats {
        let date = NaiveDate::from_num_days_from_ce_opt(
            (hb.time as i64 / 86400 + 719163) as i32,
        )
        .unwrap_or_else(|| Utc::now().date_naive());

        let row = HeartbeatRow {
            user_id,
            entity: hb.entity,
            entity_type: format!("{:?}", hb.entity_type).to_lowercase(),
            time: hb.time,
            date,
            project: hb.project,
            branch: hb.branch,
            language: hb.language,
            dependencies: hb.dependencies,
            lines: hb.lines,
            line_number: hb.line_number,
            cursor_position: hb.cursor_position,
            is_write: hb.is_write,
            category: format!("{:?}", hb.category).to_lowercase(),
            editor: hb.editor,
            operating_system: hb.operating_system,
            machine: hb.machine,
            user_agent: hb.user_agent,
            ast_language: hb.ast_language,
            ast_confidence: hb.ast_confidence,
            keystrokes: hb.keystrokes,
            chars_added: hb.chars_added,
            chars_deleted: hb.chars_deleted,
            is_ai_generated: hb.is_ai_generated,
            ai_agent: hb.ai_agent,
            ai_lines_added: hb.ai_lines_added,
            ai_lines_deleted: hb.ai_lines_deleted,
            created_at: Utc::now(),
        };

        insert
            .write(&row)
            .await
            .map_err(|e| format!("ClickHouse write error: {e}"))?;
    }

    insert
        .end()
        .await
        .map_err(|e| format!("ClickHouse end error: {e}"))?;

    Ok(())
}

/// Run ClickHouse migration — สร้าง heartbeats table ถ้ายังไม่มี
pub async fn run_migrations(state: &Arc<App>) -> Result<(), String> {
    let ch_client = state.clickhouse.get_client();

    ch_client
        .query(
            "CREATE TABLE IF NOT EXISTS wakaclock.heartbeats (
                user_id          UUID,
                entity           String,
                entity_type      String,
                time             Float64,
                date             Date,
                project          Nullable(String),
                branch           Nullable(String),
                language         Nullable(String),
                dependencies     Array(String),
                lines            Nullable(UInt32),
                line_number      Nullable(UInt32),
                cursor_position  Nullable(UInt32),
                is_write         Bool,
                category         String,
                editor           String,
                operating_system String,
                machine          String,
                user_agent       String,
                ast_language     Nullable(String),
                ast_confidence   Nullable(Float32),
                keystrokes       Nullable(UInt32),
                chars_added      Nullable(UInt32),
                chars_deleted    Nullable(UInt32),
                is_ai_generated  Bool,
                ai_agent         Nullable(String),
                ai_lines_added   Nullable(UInt32),
                ai_lines_deleted Nullable(UInt32),
                created_at       DateTime DEFAULT now()
            ) ENGINE = MergeTree()
            ORDER BY (user_id, time)",
        )
        .execute()
        .await
        .map_err(|e| format!("Migration error: {e}"))?;

    Ok(())
}
