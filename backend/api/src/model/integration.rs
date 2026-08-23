use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct IntegrationProvider {
    pub id: &'static str,
    pub display_name: &'static str,
    pub auth: &'static str,
    pub supports_webhooks: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateIntegrationRequest {
    pub display_name: String,
    /// Credentials must already be envelope-encrypted by the client/KMS. The
    /// API never accepts a raw OAuth access/refresh token field.
    pub encrypted_credentials: String,
    #[serde(default)]
    pub scopes: Vec<String>,
    pub organization_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize)]
pub struct IntegrationConnection {
    pub id: Uuid,
    pub provider: String,
    pub display_name: String,
    pub status: String,
    pub scopes: Vec<String>,
    pub last_synced_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub disconnected_at: Option<DateTime<Utc>>,
}

