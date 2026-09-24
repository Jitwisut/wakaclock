use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// ClickHouse Row Type สำหรับ heartbeat
#[derive(Clone, Debug, Serialize, Deserialize, clickhouse::Row)]
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
    pub head_revision: Option<String>,
    #[serde(with = "clickhouse::serde::uuid::option")]
    pub repository_id: Option<Uuid>,
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
    pub machine_name_hash: Option<String>,
    pub hostname_hash: Option<String>,
    pub timezone: Option<String>,
    pub feature_id: Option<String>,
    pub feature_name: Option<String>,
    pub heartbeat_id: Option<String>,
    pub ast_language: Option<String>,
    pub ast_confidence: Option<f32>,
    pub keystrokes: Option<u32>,
    pub chars_added: Option<u32>,
    pub chars_deleted: Option<u32>,
    /// Clamped to `MAX_ACTIVITY_GAP_SECONDS` at ingest, so it means the same thing as
    /// the evidence written to `activity_intervals`. The `mv_*_summary` views sum this
    /// column; before the clamp moved here they summed a raw client claim that the
    /// canonical timeline had already rejected, and no MV-backed surface could agree
    /// with a duration endpoint. The unclamped claim is kept in `active_seconds_claimed`.
    pub active_seconds: Option<f64>,
    /// What the client actually claimed, retained for audit. Never summed into a total.
    pub active_seconds_claimed: Option<f64>,
    pub activity_segments: String,
    pub is_ai_generated: bool,
    pub ai_agent: Option<String>,
    pub ai_provider: Option<String>,
    pub ai_model: Option<String>,
    pub identity_status: Option<String>,
    pub identity_reason: Option<String>,
    pub identity_source: Option<String>,
    pub identity_schema_version: Option<u8>,
    pub identity_turn_id: Option<String>,
    pub identity_message_id: Option<String>,
    pub ai_source: Option<String>,
    pub ai_confidence: Option<String>,
    pub ai_event_id: Option<String>,
    pub ai_change_id: Option<String>,
    pub prompt_character_count: Option<u64>,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cache_read_tokens: Option<u64>,
    pub cache_write_tokens: Option<u64>,
    pub ai_subscription_plan: Option<String>,
    pub token_source: Option<String>,
    pub attribution_source: Option<String>,
    pub attribution_confidence: Option<f32>,
    pub ai_event_fingerprint: Option<String>,
    pub ai_lines_added: Option<u32>,
    pub ai_lines_deleted: Option<u32>,
    pub human_lines_added: Option<u32>,
    pub human_lines_deleted: Option<u32>,
    pub unattributed_lines_added: Option<u32>,
    pub unattributed_lines_deleted: Option<u32>,
    pub created_at: u32,
    /// Canonical attribution state. Kept at the end so the additive ClickHouse
    /// migration remains compatible with the existing column order.
    pub actor_type: String,
    pub actor_confidence: f32,
    pub clipboard_tracking_version: Option<u8>,
    pub copy_actions: Option<u32>,
    pub paste_actions: Option<u32>,
    pub copied_chars: Option<u32>,
    pub copied_lines: Option<u32>,
    pub pasted_chars: Option<u32>,
    pub pasted_lines: Option<u32>,
    pub paste_same_file_actions: Option<u32>,
    pub paste_same_workspace_actions: Option<u32>,
    pub paste_external_or_unknown_actions: Option<u32>,
    /// Attribution correction revision. Existing rows and first observations are
    /// revision 0; later full-value corrections append a higher revision for the same
    /// canonical operation and readers must select the max revision before summing.
    pub revision: u32,
    /// Stable agent session scope. Added at the end so existing ClickHouse rows keep
    /// their positional layout while the additive migration catches up.
    pub session_id: Option<String>,
    /// Version and state for any line counters measured by a producer with a known
    /// definition. Null means legacy/unversioned or unavailable data.
    pub line_metric_version: Option<String>,
    pub line_measurement_status: Option<String>,
    pub line_measurement_reason: Option<String>,
    pub measurement_window_id: Option<String>,
}

/// Normalized interval projection used for fast canonical timeline reads. Raw heartbeat
/// JSON remains the audit source; this table is additive and can be rebuilt at any time.
#[derive(Debug, Serialize, Deserialize, clickhouse::Row)]
pub struct ActivityIntervalRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    pub segment_id: String,
    pub heartbeat_id: String,
    pub start: f64,
    pub end: f64,
    pub source: String,
    pub entity: String,
    pub project: Option<String>,
    /// Carried alongside the display name so a project breakdown can group by the stable
    /// identity the project pages key on. Without it those pages could not be built from
    /// this timeline at all and had to keep summing `active_seconds`.
    #[serde(with = "clickhouse::serde::uuid::option")]
    pub project_id: Option<Uuid>,
    /// Carried so a branch-filtered project view can be served from this timeline instead
    /// of falling back to `sum(active_seconds)` and disagreeing with every other surface.
    pub branch: Option<String>,
    pub language: Option<String>,
    pub category: String,
    pub editor: String,
    pub operating_system: String,
    pub created_at: u32,
    /// Canonical actor state for the projected interval. `source` remains a legacy
    /// duration dimension and is derived from this value on new writes.
    pub actor_type: String,
    pub actor_confidence: f32,
}
