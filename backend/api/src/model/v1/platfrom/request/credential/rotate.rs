use chrono::{DateTime, Utc};
/// ไฟล์ rotate.rs - Credential Rotation Request Models
/// โครงสร้าง requests สำหรับ credential rotation และ management
/// รวม OAuth และ API key credential types
/// ใช้ในการรักษาความปลอดภัยของ credentials
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Request สำหรับการ rotate credential
/// อนุญาตให้เก็บ credential เก่าไว้ชั่วคราวสำหรับ security
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RotateCredentialRequest {
    /// ID ของ credential ที่ต้องการ rotate
    pub credential_id: Uuid,
    /// OAuth credential ใหม่ (optional)
    pub new_oauth_data: Option<OAuthCredential>,
    /// API key credential ใหม่ (optional)
    pub new_api_key_data: Option<ApiKeyCredential>,
    /// เก็บ version เก่าไว้นานกี่นาที (สำหรับ graceful transition)
    pub keep_old_version_minutes: Option<i32>,
}

/// OAuth credential structure
/// รวม access token, refresh token และ expiration info
/// ใช้สำหรับ OAuth-based platforms
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthCredential {
    /// Access token สำหรับ API calls
    pub access_token: String,
    /// Refresh token สำหรับต่ออายุ session
    pub refresh_token: Option<String>,
    /// เวลาหมดอายุของ token
    pub expires_at: DateTime<Utc>,
    /// ประเภทของ token (เช่น "Bearer")
    pub token_type: Option<String>,
    /// OAuth scope ที่ได้รับอนุญาต
    pub scope: Option<String>,
}

/// API key credential structure
/// ใช้สำหรับ platforms ที่ใช้ API key/secret authentication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyCredential {
    /// API key หลัก
    pub api_key: String,
    /// API secret (optional)
    pub api_secret: Option<String>,
}
