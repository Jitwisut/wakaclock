/// ไฟล์ auth_token.rs - Authentication Token Structure
/// โครงสร้าง authentication token จาก OAuth providers
/// รวมข้อมูล access token, refresh token และอายุการใช้งาน

use serde::{Deserialize, Serialize};

/// โครงสร้าง OAuth authentication token
/// เก็บ access token และ refresh token จาก platform
/// ใช้สำหรับ API authentication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    /// Access token สำหรับ API calls
    pub access_token: String,
    /// Refresh token สำหรับต่ออายุ session (optional)
    pub refresh_token: Option<String>,
    /// เวลาหมดอายุของ token
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    /// ประเภทของ token (เช่น "Bearer")
    pub token_type: String,
}
