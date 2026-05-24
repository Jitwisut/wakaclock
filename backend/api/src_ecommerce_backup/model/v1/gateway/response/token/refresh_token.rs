/// โมดูลสำหรับ Refresh Token Response
///
/// โมดูลนี้จัดการโครงสร้างข้อมูลสำหรับการตอบกลับของการต่ออายุ token
/// ที่ใช้ในการรักษาสถานะการเชื่อมต่อกับแพลตฟอร์มต่างๆ
use serde::{Deserialize, Serialize};

/// Response สำหรับการต่ออายุ token
///
/// ส่งกลับ access token ใหม่ และ refresh token (ถ้ามี)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshTokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<i64>,
}
