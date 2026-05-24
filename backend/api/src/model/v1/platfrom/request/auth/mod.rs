/// ไฟล์ mod.rs - Authentication Request Models
/// โครงสร้าง requests สำหรับ authentication operations
/// รวม login, register, token refresh และ config updates
/// ใช้กับ Strapi authentication system

use serde::{Deserialize, Serialize};

/// Request สำหรับการอัปเดท OAuth configuration
/// ใช้ในการกำหนด allowed URLs และ CORS settings
#[derive(Debug, Deserialize)]
pub struct UpdateAuthConfigRequest {
    /// URLs ที่อนุญาตให้ redirect กลับมา
    pub allowed_redirect_uris: Vec<String>,
    /// Origins ที่อนุญาตให้เข้าถึง API
    pub allowed_origins: Vec<String>,
    /// OAuth scopes ที่รองรับ
    pub scopes: Vec<String>,
    /// เปิดใช้ PKCE หรือไม่
    pub enable_pkce: bool,
}

/// Request สำหรับการ login
/// รับ username/password สำหรับ authentication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    /// Username หรือ email
    pub username: String,
    /// Password
    pub password: String,
}

/// Request สำหรับการลงทะเบียนผู้ใช้ใหม่
/// สร้าง account ใหม่ในระบบ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRequest {
    /// Username ที่ต้องการ
    pub username: String,
    /// Email address
    pub email: String,
    /// Password สำหรับ login
    pub password: String,
}

/// Request สำหรับการ refresh access token
/// ใช้เมื่อ access token หมดอายุ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshTokenRequest {
    /// Refresh token จาก login response
    pub refresh_token: String,
}
