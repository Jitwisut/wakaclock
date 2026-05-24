use clickhouse::Row;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct KeystrokeProjectItem {
    pub name: String,
    pub keystrokes: u64,
    pub chars_added: u64,
    pub chars_deleted: u64,
}

#[derive(Debug, Serialize)]
pub struct KeystrokeDailyItem {
    pub date: String,
    pub keystrokes: u64,
    pub chars_added: u64,
    pub chars_deleted: u64,
}

#[derive(Debug, Serialize)]
pub struct KeystrokeStatsData {
    pub total_keystrokes: u64,
    pub total_chars_added: u64,
    pub total_chars_deleted: u64,
    pub days_with_activity: u64,
    pub projects: Vec<KeystrokeProjectItem>,
    pub daily: Vec<KeystrokeDailyItem>,
}

#[derive(Debug, Serialize)]
pub struct KeystrokeStatsResponse {
    pub start: String,
    pub end: String,
    pub data: KeystrokeStatsData,
}

#[derive(Debug, Deserialize, Row)]
pub struct KeystrokeTotalsRow {
    pub total_keystrokes: u64,
    pub total_chars_added: u64,
    pub total_chars_deleted: u64,
    pub days_with_activity: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct KeystrokeProjectRow {
    pub name: String,
    pub keystrokes: u64,
    pub chars_added: u64,
    pub chars_deleted: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct KeystrokeDailyRow {
    #[serde(rename = "day")]
    pub date: String,
    pub keystrokes: u64,
    pub chars_added: u64,
    pub chars_deleted: u64,
}
