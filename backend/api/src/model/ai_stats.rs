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
    /// Canonical AI rows with a measured counter. Zero and missing stay distinct.
    pub ai_added_measured_heartbeats: u64,
    pub ai_deleted_measured_heartbeats: u64,
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
    pub usage_coverage: UsageCoverage,
    pub line_measurements: LineMeasurementCounts,
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

#[derive(Debug, Serialize)]
pub struct LineMeasurementCounts {
    pub ai_added: u64,
    pub ai_deleted: u64,
    pub human_added: u64,
    pub human_deleted: u64,
    pub human_keystrokes: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct AiTotalsRow {
    pub ai_added_measured: u64,
    pub ai_deleted_measured: u64,
    pub human_added_measured: u64,
    pub human_deleted_measured: u64,
    pub human_keystrokes_measured: u64,
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
    pub event_count: u64,
    pub prompt_measured: u64,
    pub input_measured: u64,
    pub output_measured: u64,
    pub cache_read_measured: u64,
    pub cache_write_measured: u64,
    pub cost_measured: u64,
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
    /// Canonical AI rows with a measured counter. Zero and missing stay distinct.
    pub ai_added_measured_heartbeats: u64,
    pub ai_deleted_measured_heartbeats: u64,
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

/// Coverage is over received usage facts, never a claim that all vendor activity arrived.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct FieldCoverage {
    pub reported_events: u64,
    pub total_events: u64,
    pub status: &'static str,
}
impl FieldCoverage {
    pub fn new(reported_events: u64, total_events: u64) -> Self {
        Self {
            reported_events,
            total_events,
            status: match (reported_events, total_events) {
                (_, 0) => "no_data",
                (0, _) => "unavailable",
                (r, t) if r == t => "complete",
                _ => "partial",
            },
        }
    }
}
#[derive(Debug, Clone, Serialize)]
pub struct UsageCoverage {
    pub event_count: u64,
    pub prompt_characters: FieldCoverage,
    pub input_tokens: FieldCoverage,
    pub output_tokens: FieldCoverage,
    pub cache_read_tokens: FieldCoverage,
    pub cache_write_tokens: FieldCoverage,
    pub estimated_cost: FieldCoverage,
}
impl AiUsageMetricsRow {
    pub fn coverage(&self) -> UsageCoverage {
        let c = |n| FieldCoverage::new(n, self.event_count);
        UsageCoverage {
            event_count: self.event_count,
            prompt_characters: c(self.prompt_measured),
            input_tokens: c(self.input_measured),
            output_tokens: c(self.output_measured),
            cache_read_tokens: c(self.cache_read_measured),
            cache_write_tokens: c(self.cache_write_measured),
            estimated_cost: c(self.cost_measured),
        }
    }
}

/// Additive replacement for legacy shares, whose non-null numeric shape is preserved.
#[derive(Debug, Serialize)]
pub struct EffectivenessMetricsV2 {
    pub semantics_version: &'static str,
    pub ai_line_share: Option<f64>,
    pub human_line_share: Option<f64>,
    pub unknown_line_share: Option<f64>,
    pub denominator: u64,
    pub denominator_kind: &'static str,
    pub unavailable_reason: Option<&'static str>,
}
impl EffectivenessMetricsV2 {
    pub fn new(ai: u64, human: u64, unknown: u64, denominator: u64) -> Self {
        Self {
            semantics_version: "line-change-share-v2",
            ai_line_share: measured_ratio(Some(ai), denominator),
            human_line_share: measured_ratio(Some(human), denominator),
            unknown_line_share: measured_ratio(Some(unknown), denominator),
            denominator,
            denominator_kind: "measured_additions_and_deletions",
            unavailable_reason: (denominator == 0).then_some("no_measured_line_changes"),
        }
    }
}
pub fn measured_ratio(numerator: Option<u64>, denominator: u64) -> Option<f64> {
    numerator
        .filter(|_| denominator > 0)
        .map(|n| n as f64 / denominator as f64)
}

#[cfg(test)]
mod measurement_semantics_tests {
    use super::*;
    #[test]
    fn zero_denominator_and_missing_values_are_unavailable() {
        assert_eq!(measured_ratio(Some(500), 0), None);
        assert_eq!(measured_ratio(None, 5), None);
        assert_eq!(measured_ratio(Some(0), 5), Some(0.0));
        let metrics = EffectivenessMetricsV2::new(0, 0, 0, 0);
        assert!(metrics.ai_line_share.is_none());
        assert!(serde_json::to_value(metrics).unwrap()["human_line_share"].is_null());
    }
    #[test]
    fn received_coverage_distinguishes_empty_missing_partial_and_complete() {
        assert_eq!(FieldCoverage::new(0, 0).status, "no_data");
        assert_eq!(FieldCoverage::new(0, 3).status, "unavailable");
        assert_eq!(FieldCoverage::new(1, 3).status, "partial");
        assert_eq!(FieldCoverage::new(3, 3).status, "complete");
    }
    #[test]
    fn unknown_remains_in_share_denominator() {
        let m = EffectivenessMetricsV2::new(3, 2, 5, 10);
        assert_eq!(m.ai_line_share, Some(0.3));
        assert_eq!(m.human_line_share, Some(0.2));
        assert_eq!(m.unknown_line_share, Some(0.5));
    }
}
