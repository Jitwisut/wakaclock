use clickhouse::Row;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct StatsBreakdownItem {
    pub name: String,
    pub total_seconds: f64,
    pub hours: f64,
    pub text: String,
    pub heartbeats: u64,
    /// WakaTime item fields, added alongside the AtoAxis ones (`hours` stays a float
    /// and `text` keeps the AtoAxis format the dashboard already shows).
    pub percent: f64,
    pub digital: String,
    pub decimal: String,
    pub minutes: u64,
    pub seconds: u64,
}

impl StatsBreakdownItem {
    pub fn new(
        name: String,
        total_seconds: f64,
        heartbeats: u64,
        range_total: f64,
        text: String,
    ) -> Self {
        let whole = total_seconds.max(0.0) as u64;
        let (hours, minutes) = crate::model::summary::hours_minutes(total_seconds);
        let seconds = whole % 60;
        Self {
            name,
            total_seconds,
            hours: total_seconds / 3600.0,
            text,
            heartbeats,
            percent: if range_total > 0.0 {
                (total_seconds / range_total * 10_000.0).round() / 100.0
            } else {
                0.0
            },
            digital: format!("{hours}:{minutes:02}:{seconds:02}"),
            decimal: crate::model::summary::wakatime_decimal(total_seconds),
            minutes,
            seconds,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct BestDay {
    pub date: String,
    pub total_seconds: f64,
    pub text: String,
}

#[derive(Debug, Serialize)]
pub struct StatsData {
    pub total_seconds: f64,
    pub hours: f64,
    pub text: String,
    pub days_included: u64,
    pub days_with_activity: u64,
    pub daily_average_seconds: f64,
    pub daily_average_text: String,
    pub best_day: Option<BestDay>,
    pub languages: Vec<StatsBreakdownItem>,
    pub projects: Vec<StatsBreakdownItem>,
    pub editors: Vec<StatsBreakdownItem>,
    pub operating_systems: Vec<StatsBreakdownItem>,
    /// Additive; WakaTime's stats payload has no categories array.
    pub categories: Vec<StatsBreakdownItem>,
    /// Optional duration-v2 metrics. The values are measured at second precision before
    /// the presentation fields above are rounded for display.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comparable_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_measured_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_additional_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub calculation_version: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_human_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_human_only_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_ai_only_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_ai_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_overlap_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_coverage: Option<&'static str>,
    /// Additive: how much of `total_seconds` was measured rather than inferred, and
    /// how much was attended by a human rather than produced by an agent.
    pub evidence: crate::services::activity_timeline::EvidenceSplit,
    /// WakaTime's `stats` fields that do not collide with the AtoAxis ones above.
    #[serde(flatten)]
    pub wakatime: WakaTimeStatsFields,
}

/// https://wakatime.com/developers#stats — every key that is not already an AtoAxis
/// field. Visibility/caching flags describe this deployment honestly: stats are
/// computed on request, so they are never cached, stuck or partially calculated.
#[derive(Debug, Serialize)]
pub struct WakaTimeStatsFields {
    pub total_seconds_including_other_language: f64,
    pub human_readable_total: String,
    pub human_readable_total_including_other_language: String,
    pub daily_average: f64,
    pub daily_average_including_other_language: f64,
    pub human_readable_daily_average: String,
    pub human_readable_daily_average_including_other_language: String,
    pub machines: Vec<StatsBreakdownItem>,
    /// Not tracked per interval by AtoAxis; empty rather than invented.
    pub dependencies: Vec<StatsBreakdownItem>,
    pub range: String,
    pub human_readable_range: String,
    pub holidays: u64,
    pub days_including_holidays: u64,
    pub days_minus_holidays: u64,
    pub status: &'static str,
    pub percent_calculated: u8,
    pub is_already_updating: bool,
    pub is_cached: bool,
    pub is_coding_activity_visible: bool,
    pub is_language_usage_visible: bool,
    pub is_editor_usage_visible: bool,
    pub is_category_usage_visible: bool,
    pub is_os_usage_visible: bool,
    pub is_stuck: bool,
    pub is_including_today: bool,
    pub is_up_to_date: bool,
    pub start: String,
    pub end: String,
    pub timezone: String,
    /// Keystroke timeout in minutes.
    pub timeout: u64,
    pub writes_only: bool,
    pub user_id: uuid::Uuid,
    /// Filled in by the v1 handler; `null` when the account lookup is unavailable.
    pub username: Option<String>,
    /// Stats are computed per request, so both are the calculation time.
    pub created_at: String,
    pub modified_at: String,
}

#[derive(Debug, Serialize)]
pub struct StatsResponse {
    pub range: String,
    pub start: String,
    pub end: String,
    pub data: StatsData,
}

#[derive(Debug, Deserialize, Row)]
pub struct AllTimeRangeRow {
    #[serde(rename = "start_day")]
    pub start: Option<String>,
    #[serde(rename = "end_day")]
    pub end: Option<String>,
}
