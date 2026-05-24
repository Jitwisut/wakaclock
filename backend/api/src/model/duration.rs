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
