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
    /// The same key in retrievable form, so it can be shown to its owner again.
    /// Empty when no key exists, or for keys issued before this column existed.
    pub api_key_plain: String,
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

/// Plaintext key is returned exactly once, at generation time — only its hash is ever
/// persisted, so it cannot be recovered later. Losing it means regenerating.
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
