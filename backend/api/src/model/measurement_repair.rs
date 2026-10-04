use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StartMeasurementRepair {
    pub repair_id: Uuid,
    pub start: String,
    pub end: String,
    pub timezone: String,
    pub candidates: Vec<MeasurementRepairCandidate>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct MeasurementRepairCandidate {
    /// Opaque operation reference from `/me/ai/operation-evidence`.
    pub repair_reference: String,
    pub outcome: MeasurementRepairOutcome,
    pub lines_added: Option<u32>,
    pub lines_deleted: Option<u32>,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MeasurementRepairOutcome {
    Success,
    Partial,
    Failed,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
pub struct MeasurementRepairJobView {
    pub repair_id: Uuid,
    pub status: String,
    pub start: String,
    pub end: String,
    pub timezone: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub requested: usize,
    pub ready: usize,
    pub unchanged: usize,
    pub unresolved: usize,
    pub applied: usize,
    pub rolled_back: usize,
    pub conflict_count: usize,
    pub before_added_total: Option<u64>,
    pub before_deleted_total: Option<u64>,
    pub after_added_total: Option<u64>,
    pub after_deleted_total: Option<u64>,
    pub items: Vec<MeasurementRepairItemView>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MeasurementRepairItemView {
    pub repair_reference: String,
    pub status: String,
    pub reason: Option<String>,
    pub outcome: String,
    pub base_revision: Option<u32>,
    pub applied_revision: Option<u32>,
    pub rolled_back_revision: Option<u32>,
    pub before: Option<MeasurementRepairValues>,
    pub after: Option<MeasurementRepairValues>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MeasurementRepairValues {
    pub ai_lines_added: Option<u32>,
    pub ai_lines_deleted: Option<u32>,
    pub line_metric_version: Option<String>,
    pub line_measurement_status: Option<String>,
    pub line_measurement_reason: Option<String>,
    pub measurement_window_id: Option<String>,
}
