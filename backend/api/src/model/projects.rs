use clickhouse::Row;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct ProjectItem {
    pub name: String,
    pub total_seconds: f64,
    pub hours: f64,
    pub text: String,
    pub heartbeats: u64,
}

#[derive(Debug, Serialize)]
pub struct ProjectsResponse {
    pub start: String,
    pub end: String,
    pub data: Vec<ProjectItem>,
}

#[derive(Debug, Deserialize, Row)]
pub struct ProjectRow {
    pub name: String,
    pub total_seconds: f64,
    pub heartbeat_count: u64,
}
