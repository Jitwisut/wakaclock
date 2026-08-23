use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
pub struct CreateReportScheduleRequest {
    pub report_type: String,
    pub timezone: Option<String>,
    pub delivery_hour: Option<i16>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReportSchedule {
    pub id: Uuid,
    pub report_type: String,
    pub timezone: String,
    pub delivery_hour: i16,
    pub enabled: bool,
    pub last_sent_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}
