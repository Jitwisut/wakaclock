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
}

#[derive(Debug, Serialize)]
pub struct AllTimeResponse {
    pub data: AllTimeData,
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
}
