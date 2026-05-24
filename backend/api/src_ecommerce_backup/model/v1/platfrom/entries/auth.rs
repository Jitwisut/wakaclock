//! ไฟล์ auth.rs - Authentication Claims และ JWT Payload
//! จัดการโครงสร้าง claims และ payload สำหรับ JWT tokens
//! ใช้ในระบบ authentication middleware และ authorization
//! รองรับ multi-tenancy กับ user และ organization context
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// JWT Claims สำหรับระบบ authentication
/// ใช้มาตรฐาน JWT claims (sub, exp, iat)
/// เพิ่ม user_id และ org_id สำหรับ multi-tenancy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthClaims {
    /// Subject (user identifier)
    pub sub: String,
    /// Expiration time (Unix timestamp)
    pub exp: i64,
    /// Issued at time (Unix timestamp)
    pub iat: i64,
    /// Internal user ID (optional)
    pub user_id: Option<String>,
    /// Organization ID (optional for multi-tenancy)
    pub org_id: Option<String>,
    /// Email address from JWT (if provided)
    pub email: Option<String>,
    /// Permissions or scopes provided by upstream identity provider
    pub permissions: Vec<String>,
    /// Roles attached to the current identity
    pub roles: Vec<String>,
    /// Raw JWT payload for downstream services that need extended claims
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw: Option<Value>,
}
