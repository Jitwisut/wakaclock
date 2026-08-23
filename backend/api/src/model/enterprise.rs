use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct SsoConnection {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub protocol: String,
    pub issuer: Option<String>,
    pub entity_id: Option<String>,
    pub enforced: bool,
    pub verified_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpsertSsoRequest {
    pub protocol: String,
    pub issuer: Option<String>,
    pub entity_id: Option<String>,
    /// Client/KMS envelope-encrypted configuration. Raw client secrets and
    /// signing keys are never accepted as individual JSON fields.
    pub encrypted_config: String,
    #[serde(default)]
    pub enforced: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScimTokenSummary {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScimTokenCreated {
    pub token: ScimTokenSummary,
    /// Returned only once. It is deliberately omitted from ScimTokenSummary.
    pub plaintext: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScimUserRecord {
    pub id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ScimUserInput {
    #[serde(rename = "userName")]
    pub username: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    pub emails: Option<Vec<ScimEmail>>,
    pub active: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ScimEmail {
    pub value: String,
    #[serde(default)]
    pub primary: bool,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ScimPatchRequest {
    pub active: Option<bool>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    pub emails: Option<Vec<ScimEmail>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScimGroupRecord {
    pub id: Uuid,
    pub display_name: String,
    pub member_count: i64,
    pub created_at: DateTime<Utc>,
}
