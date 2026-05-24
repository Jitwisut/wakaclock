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
}

#[derive(Debug, Serialize)]
pub struct StatsResponse {
    pub range: String,
    pub start: String,
    pub end: String,
    pub data: StatsData,
}

#[derive(Debug, Deserialize, Row)]
pub struct TotalsRow {
    pub total_seconds: f64,
    pub days_with_activity: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct BestDayRow {
    #[serde(rename = "day")]
    pub date: String,
    pub total_seconds: f64,
}

#[derive(Debug, Deserialize, Row)]
pub struct BreakdownRow {
    pub name: String,
    pub total_seconds: f64,
    pub heartbeat_count: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct AllTimeRangeRow {
    #[serde(rename = "start_day")]
    pub start: Option<String>,
    #[serde(rename = "end_day")]
    pub end: Option<String>,
}
