use clickhouse::Row;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct UserData {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub is_active: bool,
    pub subscription_status: String,
    /// Unix seconds. Meaningless once `subscription_status` is no longer "trialing",
    /// but always present for a simpler frontend type.
    pub trial_ends_at: u32,
    /// Unix seconds — set by whatever external payment system calls
    /// POST /internal/subscription; `None` until a subscription has ever been active.
    pub subscription_period_end: Option<u32>,
    /// WakaTime's profile keys, filled by `GET /users/current` only.
    #[serde(flatten)]
    pub wakatime: Option<WakaTimeUserFields>,
}

/// https://wakatime.com/developers#users — the keys AtoAxis can answer honestly.
/// Public-profile and social fields are not AtoAxis features, so they are null or
/// false rather than invented; `timezone` is UTC because no per-account zone is
/// stored.
#[derive(Debug, Serialize)]
pub struct WakaTimeUserFields {
    pub display_name: String,
    pub full_name: Option<String>,
    pub bio: Option<String>,
    pub photo: Option<String>,
    pub public_email: Option<String>,
    pub is_email_public: bool,
    pub is_photo_public: bool,
    pub is_email_confirmed: bool,
    pub has_premium_features: bool,
    pub plan: String,
    pub timezone: String,
    pub last_heartbeat_at: Option<String>,
    pub last_plugin: Option<String>,
    pub last_plugin_name: Option<String>,
    pub last_project: Option<String>,
    pub last_branch: Option<String>,
    pub website: Option<String>,
    pub human_readable_website: Option<String>,
    pub wonderfuldev_username: Option<String>,
    pub github_username: Option<String>,
    pub twitter_username: Option<String>,
    pub linkedin_username: Option<String>,
    pub city: Option<serde_json::Value>,
    pub logged_time_public: bool,
    pub languages_used_public: bool,
    pub editors_used_public: bool,
    pub categories_used_public: bool,
    pub os_used_public: bool,
    pub is_hireable: bool,
    pub created_at: Option<String>,
    pub modified_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub data: UserData,
}

#[derive(Debug, Deserialize, Row)]
pub struct UserRow {
    pub username: String,
    pub email: String,
    pub is_active: bool,
    pub subscription_status: String,
    pub trial_ends_at: u32,
    pub subscription_period_end: Option<u32>,
}

#[derive(Debug, Deserialize, Row)]
pub struct ExistingUserRow {
    pub username: String,
    pub email: String,
    pub password_hash: String,
    /// SHA-256 hash — what authentication compares against.
    pub api_key: String,
    pub subscription_status: String,
    pub trial_ends_at: u32,
    pub subscription_period_end: Option<u32>,
}

#[derive(Debug, Deserialize, Row)]
pub struct CredentialsRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    pub password_hash: String,
}

/// The plaintext key is returned exactly once when generated.
#[derive(Debug, Serialize)]
pub struct GenerateApiKeyData {
    pub user_id: Uuid,
    pub api_key: String,
}

#[derive(Debug, Serialize)]
pub struct GenerateApiKeyResponse {
    pub data: GenerateApiKeyData,
}

#[derive(Debug, Serialize)]
pub struct RevokeApiKeyResponse {
    pub status: String,
}
