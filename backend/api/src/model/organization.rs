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
pub struct OrganizationTeamMember {
    pub user_id: Uuid,
    pub username: String,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InviteOrganizationMemberRequest {
    pub username: String,
    pub role: Option<String>,
    pub seat_type: Option<String>,
}

/// A pending username invite, as the organization's admins or the invitee see it.
#[derive(Debug, Clone, Serialize)]
pub struct OrganizationUserInvite {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub organization_name: String,
    pub username: String,
    pub invited_by: Option<String>,
    pub role: String,
    pub seat_type: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// What accepting an invite produced.
#[derive(Debug, Clone, Serialize)]
pub struct AcceptedOrganizationInvite {
    pub organization_id: Uuid,
    pub role: String,
    pub seat_type: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AddOrganizationTeamMemberRequest {
    pub user_id: Uuid,
    /// `lead`, `member` (default) or `viewer`.
    pub role: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrganizationAnalytics {
    pub organization_id: Uuid,
    pub member_count: i64,
    pub active_developer_seats: i64,
    pub team_count: i64,
    pub data_freshness: &'static str,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct OrganizationAnalyticsSharing {
    pub share_aggregate: bool,
    pub share_individual: bool,
}
