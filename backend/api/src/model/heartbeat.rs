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
    pub ai_lines_added: Option<u32>,
    pub ai_lines_deleted: Option<u32>,
    pub created_at: u32,
}
