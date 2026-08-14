//! Response shape for `GET /api/v1/dashboard/analytics` (plan.md 9.9).

use clickhouse::Row;
use serde::{Deserialize, Serialize};

use crate::model::date_range::RangeInfo;
use crate::model::metrics::{Breakdown, DailyAverages, PeriodComparison};

/// Schema version, so the frontend can migrate without guessing which shape it received
/// (plan.md 9.8). Bump on any breaking change to this response.
pub const DASHBOARD_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Serialize)]
pub struct DashboardAnalyticsResponse {
    pub schema_version: u32,
    pub generated_at: String,
    pub range: RangeInfo,
    pub summary: DashboardSummary,
    pub breakdowns: DashboardBreakdowns,
}

#[derive(Debug, Serialize)]
pub struct DashboardSummary {
    pub today_seconds: i64,
    pub today_text: String,
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
