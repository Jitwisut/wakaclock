use clickhouse::Row;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct AllTimeData {
    pub total_seconds: f64,
    pub hours: f64,
    pub text: String,
    pub days_with_activity: u64,
    pub since: Option<String>,
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
}
