use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct Leaderboard {
    pub id: Uuid,
    pub organization_id: Option<Uuid>,
    pub owner_user_id: Option<Uuid>,
    pub visibility: String,
    pub metric: String,
    pub period: String,
    pub language: Option<String>,
    pub country: Option<String>,
    pub anonymous: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateLeaderboardRequest {
    pub organization_id: Option<Uuid>,
    pub visibility: String,
    pub metric: String,
    pub period: String,
    pub language: Option<String>,
    pub country: Option<String>,
    pub anonymous: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LeaderboardMember {
    pub user_id: Uuid,
    pub username: String,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LeaderboardMemberRequest {
    pub user_id: Uuid,
}
