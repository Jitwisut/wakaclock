use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthData {
    pub user_id: Uuid,
    pub username: String,
    /// Short-lived (24h) session JWT — separate from a CLI/extension API key, though it
    /// authenticates the same `Authorization` header via `resolve_user_id`. Meant for the
    /// dashboard's own requests, not for long-running CLI/editor processes.
    pub token: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub data: AuthData,
}
