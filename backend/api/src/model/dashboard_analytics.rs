//! Response shape for `GET /api/v1/dashboard/analytics` (plan.md 9.9).

use clickhouse::Row;
use serde::{Deserialize, Serialize};

use crate::model::date_range::RangeInfo;
use crate::model::metrics::{Breakdown, DailyAverages, PeriodComparison};

/// Schema version, so the frontend can migrate without guessing which shape it received
/// (plan.md 9.8). Bump on any breaking or semantic contract change to this response.
pub const DASHBOARD_SCHEMA_VERSION: u32 = 3;

#[derive(Debug, Serialize)]
pub struct DashboardAnalyticsResponse {
    pub data_version: u64,
    pub daily_attribution: Vec<DailyAttribution>,
    pub schema_version: u32,
    pub generated_at: String,
    pub range: RangeInfo,
    pub summary: DashboardSummary,
    pub breakdowns: DashboardBreakdowns,
    pub coverage: DashboardCoverage,
    pub usage: DashboardUsageSummary,
}

#[derive(Debug, Serialize)]
pub struct DashboardUsageSummary {
    pub prompts: Option<u64>,
    pub sessions: Option<u64>,
    pub tokens: DashboardTokenTotals,
    pub estimated_spend: DashboardEstimatedSpend,
}

#[derive(Debug, Serialize)]
pub struct DashboardTokenTotals {
    pub input: Option<u64>,
    pub output: Option<u64>,
    pub cache_read: Option<u64>,
    pub cache_write: Option<u64>,
    pub total: Option<u64>,
    pub coverage_percent: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct DashboardEstimatedSpend {
    pub amount_microusd: Option<u64>,
    pub coverage_percent: Option<f64>,
    pub currency: &'static str,
}

#[derive(Debug, Serialize)]
pub struct DailyAttribution {
    pub ai_added: u64,
    pub ai_deleted: u64,
    pub ai_verified_added: u64,
    pub ai_verified_deleted: u64,
    pub ai_inferred_added: u64,
    pub ai_inferred_deleted: u64,
    pub date: String,
    pub human_added: u64,
    pub human_deleted: u64,
    pub unknown_added: u64,
    pub unknown_deleted: u64,
    /// Historical heartbeats do not carry explicit unknown provenance. `null` protects
    /// the UI from presenting that absence as a measured zero.
    pub unattributed_added: Option<u64>,
    pub unattributed_deleted: Option<u64>,
    pub unit: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AttributionCoverageStatus {
    Complete,
    Partial,
    NoActivity,
}

#[derive(Debug, Serialize)]
pub struct DashboardCoverage {
    /// Share of measured code changes attributed to either AI or Human. This remains
    /// meaningful for partial historical data, while `attribution_status` and
    /// `attribution_data_coverage_percent` disclose the completeness of that evidence.
    pub attribution_percent: Option<f64>,
    pub attribution_status: AttributionCoverageStatus,
    pub attribution_data_coverage_percent: Option<f64>,
    pub attributed_changes: u64,
    pub unattributed_changes: u64,
    pub attribution_relevant_rows: u64,
    pub incomplete_attribution_rows: u64,
    pub cost_percent: Option<f64>,
    pub token_percent: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct DashboardSummary {
    pub today_seconds: i64,
    pub today_text: String,
    /// Optional duration-v2 diagnostics for the selected range. Dashboard totals remain
    /// integer presentation values, while these fields preserve second precision.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comparable_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_measured_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_additional_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub calculation_version: Option<&'static str>,
    #[serde(flatten)]
    pub averages: DailyAverages,
    /// `None` for a range with no activity at all — a "best day" of zero would be a
    /// fabricated answer to a question that has none.
    pub most_active_day: Option<MostActiveDay>,
    pub previous_period: PeriodComparison,
}

#[derive(Debug, Serialize)]
pub struct MostActiveDay {
    pub date: String,
    pub total_seconds: i64,
    pub text: String,
}

/// Each breakdown states its own metric and unit. `models` is counted in AI line
/// changes while the rest are active seconds, so nothing here may be summed across
/// breakdowns or percentaged against a different one (plan.md 9.0).
#[derive(Debug, Serialize)]
pub struct DashboardBreakdowns {
    pub models: Breakdown,
    pub editors: Breakdown,
    pub languages: Breakdown,
    pub operating_systems: Breakdown,
    pub machines: Breakdown,
    pub weekdays: Breakdown,
}

#[derive(Debug, Deserialize, Row)]
pub struct NamedTotalRow {
    pub name: String,
    pub total: i64,
}

#[derive(Debug, Deserialize, Row)]
pub struct DailyTotalRow {
    pub day: String,
    pub total: i64,
}

#[derive(Clone, Debug, Deserialize, Row)]
pub struct DailyAttributionRow {
    pub day: String,
    pub ai_added: u64,
    pub ai_deleted: u64,
    pub ai_verified_added: u64,
    pub ai_verified_deleted: u64,
    pub ai_inferred_added: u64,
    pub ai_inferred_deleted: u64,
    pub human_added: u64,
    pub human_deleted: u64,
    pub unknown_added: u64,
    pub unknown_deleted: u64,
    pub unknown_attribution_rows: u64,
    pub attribution_relevant_rows: u64,
    pub complete_attribution_rows: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct UsageSummaryRow {
    pub usage_events: u64,
    pub prompts: u64,
    pub sessions: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub reported_tokens: u64,
    pub priced_tokens: u64,
    pub estimated_cost_microusd: u64,
    pub priced_events: u64,
}
