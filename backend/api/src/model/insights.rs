use clickhouse::Row;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct InsightItem {
    pub name: String,
    pub total_seconds: f64,
    pub hours: f64,
    pub text: String,
    pub heartbeats: u64,
    pub days: u64,
}

#[derive(Debug, Serialize)]
pub struct InsightsResponse {
    pub r#type: String,
    pub range: String,
    pub start: String,
    pub end: String,
    pub data: Vec<InsightItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comparable_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_measured_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_additional_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub calculation_version: Option<&'static str>,
}

#[derive(Debug, Deserialize, Row)]
pub struct InsightRow {
    pub name: String,
    pub total_seconds: f64,
    pub heartbeat_count: u64,
    pub days: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct InsightsAllTimeRangeRow {
    #[serde(rename = "start_day")]
    pub start: Option<String>,
    #[serde(rename = "end_day")]
    pub end: Option<String>,
}
