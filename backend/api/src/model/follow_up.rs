use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
pub struct HumanFollowUpEventRequest {
    pub ai_change_id: String,
    /// Opaque client-side file identity. This must not be a path or source hash that
    /// can be compared across projects.
    pub file_identity: String,
    pub start_line: u32,
    pub end_line: u32,
    pub occurred_at: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct HumanFollowUpStats {
    pub event_count: u64,
    pub eligible_ai_changes: Option<u64>,
    pub human_follow_up_rate: Option<f64>,
    pub coverage: &'static str,
}

#[derive(Debug, Clone, Serialize, clickhouse::Row)]
pub struct HumanFollowUpEventRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    pub ai_change_id: String,
    pub file_identity: String,
    pub start_line: u32,
    pub end_line: u32,
    pub occurred_at: f64,
    pub created_at: u32,
}
