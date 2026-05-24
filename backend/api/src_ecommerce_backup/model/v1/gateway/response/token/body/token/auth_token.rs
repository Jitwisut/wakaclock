/// โมดูลสำหรับ Authentication Token
///
/// โมดูลนี้จัดการโครงสร้างข้อมูล token ที่ใช้ในการยืนยันตัวตน
/// และการเข้าถึง API ของแพลตฟอร์มต่างๆ
use serde::{Deserialize, Serialize};

/// โครงสร้างข้อมูล Authentication Token
///
/// รวมข้อมูล access token, refresh token, วันหมดอายุ และประเภท token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub token_type: String,
}
