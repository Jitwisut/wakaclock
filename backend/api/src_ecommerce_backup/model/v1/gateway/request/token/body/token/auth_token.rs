//! โมดูลโครงสร้าง Authentication Token (Authentication Token Module)
//!
//! ไฟล์นี้ประกอบด้วยโครงสร้างข้อมูลและคำนิยามของ Authentication Token
//! ที่ใช้สำหรับการยืนยันตัวตนและการเข้าถึง API
//!
//! ## คำอธิบาย
//! Token นี้จะมีข้อมูล Access Token, Refresh Token, วันหมดอายุ,
//! และประเภทของ Token ที่ใช้ในการยืนยันตัวตน
//!
//! ## ไดเรกทอรี
//! `src/model/v1/gateway/request/token/body/token/`

use serde::{Deserialize, Serialize};

/// โครงสร้าง Authentication Token (Authentication Token Structure)
///
/// เก็บข้อมูลที่จำเป็นสำหรับการยืนยันตัวตน รวมถึง Access Token,
/// Refresh Token, วันหมดอายุ และประเภทของ Token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    /// Access Token สำหรับการเข้าถึง API
    pub access_token: String,
    /// Refresh Token สำหรับการขอ Token ใหม่ (ถ้ามี)
    pub refresh_token: Option<String>,
    /// วันที่หมดอายุของ Token (ถ้ามี)
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    /// ประเภทของ Token (เช่น "Bearer")
    pub token_type: String,
}
