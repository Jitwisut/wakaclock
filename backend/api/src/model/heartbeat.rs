use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// ClickHouse Row Type สำหรับ heartbeat
#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct HeartbeatRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    pub entity: String,
    pub entity_type: String,
    pub time: f64,
    pub date: u16,
    pub project: Option<String>,
    /// Stable identity for `project` (plan.md 9.3), resolved server-side at write time.
    /// Nullable because every heartbeat recorded before this column existed has none —
    /// PR 9.9 backfills those. NULL means unresolved, never "no project".
    #[serde(with = "clickhouse::serde::uuid::option")]
    pub project_id: Option<Uuid>,
    pub branch: Option<String>,
    pub language: Option<String>,
    pub dependencies: Vec<String>,
    pub lines: Option<u32>,
    pub line_number: Option<u32>,
    pub cursor_position: Option<u32>,
    pub is_write: bool,
    pub category: String,
    pub editor: String,
    pub operating_system: String,
    pub machine: String,
    pub user_agent: String,
    pub ast_language: Option<String>,
    pub ast_confidence: Option<f32>,
    pub keystrokes: Option<u32>,
    pub chars_added: Option<u32>,
    pub chars_deleted: Option<u32>,
    pub active_seconds: Option<f64>,
    pub is_ai_generated: bool,
    pub ai_agent: Option<String>,
    pub ai_provider: Option<String>,
    pub ai_model: Option<String>,
    pub ai_source: Option<String>,
    pub ai_confidence: Option<String>,
    pub ai_event_id: Option<String>,
    pub ai_event_fingerprint: Option<String>,
    pub ai_lines_added: Option<u32>,
    pub ai_lines_deleted: Option<u32>,
    pub human_lines_added: Option<u32>,
    pub human_lines_deleted: Option<u32>,
    pub unattributed_lines_added: Option<u32>,
    pub unattributed_lines_deleted: Option<u32>,
    pub created_at: u32,
}
