use clickhouse::Row;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct StatsBreakdownItem {
    pub name: String,
    pub total_seconds: f64,
    pub hours: f64,
    pub text: String,
    pub heartbeats: u64,
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
