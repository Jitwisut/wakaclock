use clickhouse::Row;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct UserData {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub is_active: bool,
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
}

#[derive(Debug, Deserialize, Row)]
pub struct ExistingUserRow {
    pub username: String,
    pub email: String,
    pub password_hash: String,
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
