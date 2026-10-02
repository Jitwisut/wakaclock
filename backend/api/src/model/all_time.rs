use clickhouse::Row;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct AllTimeData {
    pub total_seconds: f64,
    pub hours: f64,
    pub text: String,
    pub days_with_activity: u64,
    pub since: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comparable_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_measured_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_additional_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub calculation_version: Option<String>,
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
    pub active_coverage: Option<String>,
    #[serde(flatten)]
    pub wakatime: Option<WakaTimeAllTimeFields>,
}

#[derive(Debug, Serialize)]
pub struct AllTimeResponse {
    pub data: AllTimeData,
}

/// https://wakatime.com/developers#all_time_since_today — the keys that do not
/// collide with AtoAxis fields (`text` keeps the AtoAxis format the dashboard shows).
/// Filled by the v1 handler, which knows the requested zone and timeout.
#[derive(Debug, Serialize)]
pub struct WakaTimeAllTimeFields {
    pub decimal: String,
    pub digital: String,
    pub daily_average: f64,
    pub is_up_to_date: bool,
    pub percent_calculated: u8,
    pub range: WakaTimeAllTimeRange,
    /// Keystroke timeout in minutes.
    pub timeout: u64,
}

#[derive(Debug, Serialize)]
pub struct WakaTimeAllTimeRange {
    pub start: String,
    pub start_date: String,
    pub start_text: String,
    pub end: String,
    pub end_date: String,
    pub end_text: String,
    pub timezone: String,
}

#[derive(Debug, Deserialize, Row)]
pub struct AllTimeRow {
    pub total_seconds: f64,
    pub days_with_activity: u64,
    pub since: Option<String>,
    pub comparable_seconds: f64,
    pub ai_measured_seconds: f64,
    pub ai_additional_seconds: f64,
    pub calculation_version: String,
    pub active_seconds: f64,
    pub active_human_seconds: f64,
    pub active_human_only_seconds: f64,
    pub active_ai_only_seconds: f64,
    pub active_ai_seconds: f64,
    pub active_overlap_seconds: f64,
    pub active_coverage: String,
}
