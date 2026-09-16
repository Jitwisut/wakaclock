use clickhouse::Row;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct DurationBlock {
    pub start: f64,
    pub end: f64,
    pub duration_seconds: f64,
    pub heartbeat_count: u64,
    pub project: Option<String>,
    pub language: Option<String>,
    pub category: String,
    pub entity: String,
}

#[derive(Debug, Serialize)]
pub struct DurationsResponse {
    pub date: String,
    pub total: usize,
    pub data: Vec<DurationBlock>,
    /// Optional duration-v2 diagnostics. Legacy clients can ignore these additive fields.
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wakatime_compatible_seconds: Option<f64>,
}

#[derive(Debug, Deserialize, Row)]
pub struct DurationBlockRow {
    pub start: f64,
    pub end: f64,
    pub duration_seconds: f64,
    pub heartbeat_count: u64,
    pub project: Option<String>,
    pub language: Option<String>,
    pub category: String,
    pub entity: String,
}
