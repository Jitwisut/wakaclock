use clickhouse::Row;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct SummaryItem {
    pub name: String,
    pub total_seconds: f64,
    pub hours: f64,
    pub text: String,
    pub heartbeats: u64,
}

#[derive(Debug, Serialize)]
pub struct SummaryGrandTotal {
    pub total_seconds: f64,
    pub hours: f64,
    pub text: String,
    pub heartbeats: u64,
}

#[derive(Debug, Serialize)]
pub struct SummaryDay {
    pub date: String,
    pub grand_total: SummaryGrandTotal,
    pub languages: Vec<SummaryItem>,
    pub projects: Vec<SummaryItem>,
    pub editors: Vec<SummaryItem>,
    pub operating_systems: Vec<SummaryItem>,
}

#[derive(Debug, Serialize)]
pub struct SummariesResponse {
    pub start: String,
    pub end: String,
    pub days: Vec<SummaryDay>,
}

#[derive(Debug, Deserialize, Row)]
pub struct DailyTotalRow {
    #[serde(rename = "day")]
    pub date: String,
    pub total_seconds: f64,
    pub heartbeat_count: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct LanguageDailyRow {
    #[serde(rename = "day")]
    pub date: String,
    pub language: String,
    pub total_seconds: f64,
    pub heartbeat_count: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct ProjectDailyRow {
    #[serde(rename = "day")]
    pub date: String,
    pub project: String,
    pub total_seconds: f64,
    pub heartbeat_count: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct EditorDailyRow {
    #[serde(rename = "day")]
    pub date: String,
    pub editor: String,
    pub total_seconds: f64,
    pub heartbeat_count: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct OsDailyRow {
    #[serde(rename = "day")]
    pub date: String,
    pub os: String,
    pub total_seconds: f64,
    pub heartbeat_count: u64,
}
