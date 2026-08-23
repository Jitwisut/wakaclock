use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct PublicProfile {
    pub user_id: Uuid,
    pub username: String,
    pub is_public: bool,
    pub show_projects: bool,
    pub show_languages: bool,
    pub show_ai_metrics: bool,
    pub badge: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateProfileRequest {
    pub username: Option<String>,
    pub is_public: Option<bool>,
    pub show_projects: Option<bool>,
    pub show_languages: Option<bool>,
    pub show_ai_metrics: Option<bool>,
    pub badge: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateShareLinkRequest {
    pub resource_type: String,
    pub resource_id: Uuid,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ShareLink {
    pub id: Uuid,
    pub resource_type: String,
    pub resource_id: Uuid,
    pub token: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PublicShare {
    pub resource_type: String,
    pub resource_id: Uuid,
    pub owner_user_id: Option<Uuid>,
    pub profile: Option<PublicProfile>,
    pub expires_at: Option<DateTime<Utc>>,
}
