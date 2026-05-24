/// ไฟล์ refresh_token.rs - OAuth Refresh Token Response
/// โครงสร้าง response เมื่อ refresh OAuth token
/// ใช้ในการต่อ session หลัง access token หมดอายุ
use serde::{Deserialize, Serialize};

/// Response จากการ refresh OAuth token
/// ใช้เมื่อ access token หมดอายุแล้วต้องขอ token ใหม่
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshTokenResponse {
    /// Access token ใหม่
    pub access_token: String,
    /// Refresh token ใหม่ (optional)
    pub refresh_token: Option<String>,
    /// ระยะเวลาหมดอายุในวินาที
    pub expires_in: Option<i64>,
}
