use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct Organization {
    pub id: Uuid,
    pub slug: String,
    pub name: String,
    pub personal_owner_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateOrganizationRequest {
    pub name: String,
    pub slug: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateOrganizationRequest {
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrganizationMember {
    pub user_id: Uuid,
    pub username: String,
    pub email: Option<String>,
    pub role: String,
    pub seat_type: String,
    pub joined_at: DateTime<Utc>,
    pub deactivated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AddOrganizationMemberRequest {
    pub user_id: Uuid,
    pub role: Option<String>,
    pub seat_type: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrganizationTeam {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub name: String,
    pub slug: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateOrganizationTeamRequest {
    pub name: String,
    pub slug: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrganizationAnalytics {
    pub organization_id: Uuid,
    pub member_count: i64,
    pub active_developer_seats: i64,
    pub team_count: i64,
    pub data_freshness: &'static str,
}
