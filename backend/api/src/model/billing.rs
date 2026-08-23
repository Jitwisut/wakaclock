use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct OrganizationBilling {
    pub organization_id: Uuid,
    pub provider: String,
    pub plan: Option<String>,
    pub status: Option<String>,
    pub current_period_start: Option<DateTime<Utc>>,
    pub current_period_end: Option<DateTime<Utc>>,
    pub developer_seats: i64,
    pub viewer_seats: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Invoice {
    pub id: Uuid,
    pub number: Option<String>,
    pub currency: String,
    pub subtotal_microusd: i64,
    pub total_microusd: i64,
    pub status: String,
    pub period_start: Option<DateTime<Utc>>,
    pub period_end: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

