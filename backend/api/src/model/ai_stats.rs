use clickhouse::Row;
use serde::{Deserialize, Serialize};

/// Additive response version for the attribution partition contract. Older clients can
/// continue reading the existing totals while newer clients use `coverage` to distinguish
/// a measured zero from an unavailable partition.
pub const AI_STATS_SCHEMA_VERSION: u32 = 2;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AiCoverageStatus {
    Complete,
    Partial,
    NoActivity,
}

/// Denominators and mutually exclusive actor buckets for the AI stats response.
///
/// Heartbeat buckets always sum to `heartbeat_denominator`. Line-change buckets use the
/// same canonical winner rows as the totals query; unknown lines stay unknown instead of
/// being silently assigned to AI or Human.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct AiStatsCoverage {
    pub attributed_line_changes: u64,
    pub ai_inferred_heartbeats: u64,
    pub ai_verified_heartbeats: u64,
    pub heartbeat_denominator: u64,
    pub human_heartbeats: u64,
    pub line_change_denominator: u64,
    pub line_coverage_percent: Option<f64>,
    pub status: AiCoverageStatus,
    pub unknown_heartbeats: u64,
    pub unknown_line_changes: u64,
}

#[derive(Debug, Serialize)]
pub struct AiAgentItem {
    pub agent: String,
    pub actor_type: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    /// Completeness of the evidence for the provider/model tuple. Optional so
    /// clients can still consume pre-identity servers.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity_source: Option<String>,
    pub ai_lines_added: u64,
    pub ai_lines_deleted: u64,
    pub human_lines_added: u64,
    pub human_lines_deleted: u64,
    pub unknown_lines_added: u64,
    pub unknown_lines_deleted: u64,
    /// Deprecated aliases retained for clients that still use the old name.
    pub unattributed_lines_added: u64,
    pub unattributed_lines_deleted: u64,
    pub heartbeat_count: u64,
}

#[derive(Debug, Serialize)]
pub struct AiDailyItem {
    pub date: String,
    pub ai_lines_added: u64,
    pub ai_lines_deleted: u64,
    pub ai_verified_lines_added: u64,
    pub ai_verified_lines_deleted: u64,
    pub ai_inferred_lines_added: u64,
    pub ai_inferred_lines_deleted: u64,
    pub human_lines_added: u64,
    pub human_lines_deleted: u64,
    pub unknown_lines_added: u64,
    pub unknown_lines_deleted: u64,
    /// Deprecated aliases retained for clients that still use the old name.
    pub unattributed_lines_added: u64,
    pub unattributed_lines_deleted: u64,
    pub human_keystrokes: u64,
    pub human_chars_added: u64,
    pub heartbeat_count: u64,
}

#[derive(Debug, Serialize)]
pub struct AiStatsData {
    pub total_ai_lines_added: u64,
    pub total_ai_lines_deleted: u64,
    pub total_ai_verified_lines_added: u64,
    pub total_ai_verified_lines_deleted: u64,
    pub total_ai_inferred_lines_added: u64,
    pub total_ai_inferred_lines_deleted: u64,
    pub total_human_lines_added: u64,
    pub total_human_lines_deleted: u64,
    pub total_unknown_lines_added: u64,
    pub total_unknown_lines_deleted: u64,
    /// Deprecated aliases retained for clients that still use the old name.
    pub total_unattributed_lines_added: u64,
    pub total_unattributed_lines_deleted: u64,
    pub total_human_keystrokes: u64,
    pub total_human_chars_added: u64,
    pub total_heartbeats: u64,
    pub total_prompt_characters: Option<u64>,
    pub total_input_tokens: Option<u64>,
    pub total_output_tokens: Option<u64>,
    pub total_cache_read_tokens: Option<u64>,
    pub total_cache_write_tokens: Option<u64>,
    pub total_estimated_cost_microusd: Option<u64>,
    /// เปอร์เซ็นต์ heartbeat ที่มาจาก AI agent เทียบกับ heartbeat ทั้งหมดในช่วงเวลานี้
    pub ai_heartbeat_percentage: f64,
    pub ai_verified_heartbeat_percentage: f64,
    pub ai_inferred_heartbeat_percentage: f64,
    pub human_heartbeat_percentage: f64,
    pub unknown_heartbeat_percentage: f64,
    /// Deprecated alias retained for clients that still use the old name.
    pub unattributed_heartbeat_percentage: f64,
    /// Explicit actor/line partitions. This field is additive to the legacy totals above.
    pub coverage: AiStatsCoverage,
    /// Identity partitions are additive to the legacy actor totals. Incomplete
    /// rows remain counted here and in `agents` so no activity disappears.
    pub identity: AiIdentitySummary,
    pub agents: Vec<AiAgentItem>,
    pub daily: Vec<AiDailyItem>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Default)]
pub struct AiIdentitySummary {
    pub confirmed_ai_heartbeats: u64,
    /// All heartbeats whose canonical actor is `ai_verified`, including rows
    /// with partial or conflicting identity evidence. This is the denominator
    /// for the confirmation percentage.
    pub ai_verified_heartbeat_denominator: u64,
    pub confirmed_ai_heartbeat_percentage: f64,
    pub incomplete_ai_heartbeats: u64,
    pub incomplete_ai_lines_added: u64,
    pub incomplete_ai_lines_deleted: u64,
    pub conflict_heartbeats: u64,
    pub reason_counts: Vec<AiIdentityReasonCount>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct AiIdentityReasonCount {
    pub reason: String,
    pub heartbeats: u64,
}

#[derive(Debug, Serialize)]
pub struct AiStatsResponse {
    pub start: String,
    pub end: String,
    pub schema_version: u32,
    pub data: AiStatsData,
}

#[derive(Debug, Deserialize, Row)]
pub struct AiTotalsRow {
    pub total_ai_lines_added: u64,
    pub total_ai_lines_deleted: u64,
    pub total_ai_verified_lines_added: u64,
    pub total_ai_verified_lines_deleted: u64,
    pub total_ai_inferred_lines_added: u64,
    pub total_ai_inferred_lines_deleted: u64,
    pub total_human_lines_added: u64,
    pub total_human_lines_deleted: u64,
    pub total_unattributed_lines_added: u64,
    pub total_unattributed_lines_deleted: u64,
    pub total_human_keystrokes: u64,
    pub total_human_chars_added: u64,
    pub total_heartbeats: u64,
    pub ai_heartbeats: u64,
    pub ai_verified_heartbeats: u64,
    pub ai_inferred_heartbeats: u64,
    pub human_heartbeats: u64,
    pub unattributed_heartbeats: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct AiUsageMetricsRow {
    pub prompt_characters: Option<u64>,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cache_read_tokens: Option<u64>,
    pub cache_write_tokens: Option<u64>,
    pub estimated_cost_microusd: Option<u64>,
}

#[derive(Debug, Deserialize, Row)]
pub struct AiAgentRow {
    pub agent: String,
    pub actor_type: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub identity_status: Option<String>,
    pub identity_reason: Option<String>,
    pub identity_source: Option<String>,
    pub ai_lines_added: u64,
    pub ai_lines_deleted: u64,
    pub human_lines_added: u64,
    pub human_lines_deleted: u64,
    pub unattributed_lines_added: u64,
    pub unattributed_lines_deleted: u64,
    pub heartbeat_count: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct AiDailyRow {
    #[serde(rename = "day")]
    pub date: String,
    pub ai_lines_added: u64,
    pub ai_lines_deleted: u64,
    pub ai_verified_lines_added: u64,
    pub ai_verified_lines_deleted: u64,
    pub ai_inferred_lines_added: u64,
    pub ai_inferred_lines_deleted: u64,
    pub human_lines_added: u64,
    pub human_lines_deleted: u64,
    pub unattributed_lines_added: u64,
    pub unattributed_lines_deleted: u64,
    pub human_keystrokes: u64,
    pub human_chars_added: u64,
    pub heartbeat_count: u64,
}
