/// ไฟล์ mod.rs - Authentication Response Models
/// โครงสร้าง responses สำหรับ authentication endpoints
/// รวม OAuth config, login, register responses
/// ใช้กับ Strapi authentication system
use serde::{Deserialize, Serialize};

/// Response สำหรับ OAuth configuration
/// ส่งค่า config ไปยัง frontend สำหรับ OAuth flow
#[derive(Debug, Serialize, Deserialize)]
pub struct AuthConfigResponse {
    /// URLs ที่อนุญาตให้ redirect กลับมา
    pub allowed_redirect_uris: Vec<String>,
    /// Origins ที่อนุญาตให้เข้าถึง API
    pub allowed_origins: Vec<String>,
    /// OAuth scopes ที่รองรับ
    pub scopes: Vec<String>,
    /// OAuth client ID
    pub client_id: String,
    /// เปิดใช้ PKCE หรือไม่
    pub enable_pkce: bool,
}

/// Response จากการ login สำเร็จ
/// ส่ง tokens กลับไปยัง client
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    /// Access token สำหรับ API calls
    pub access_token: String,
    /// Refresh token สำหรับต่ออายุ session
    pub refresh_token: String,
    /// ระยะเวลาหมดอายุในวินาที
    pub expires_in: i64,
    /// ประเภทของ token
    pub token_type: String,
}

/// Response จากการลงทะเบียนสำเร็จ
/// ส่งข้อมูล user ที่สร้างใหม่
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterResponse {
    /// User ID ที่สร้างใหม่
    pub user_id: String,
    /// Username ที่เลือก
    pub username: String,
    /// Email address
    pub email: String,
    /// เวลาที่สร้าง account
    pub created_at: String,
}
