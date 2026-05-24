//! โมดูลการอัพเดต Refresh Token (Refresh Token Module)
//!
//! ไฟล์นี้ประกอบด้วยโครงสร้างและฟังก์ชันที่เกี่ยวข้องกับการอัพเดต
//! Refresh Token สำหรับการขอ Token ใหม่เมื่อ Token เดิมหมดอายุ
//!
//! ## การใช้งาน
//! - รับและส่ง Access Token ใหม่จาก Refresh Token
//! - จัดการอายุการใช้งานของ Token
//!
//! ## ไดเรกทอรี
//! `src/model/v1/gateway/request/token/`

use serde::{Deserialize, Serialize};

/// โครงสร้างการตอบสนองสำหรับการอัพเดต Refresh Token (Refresh Token Response)
///
/// ใช้สำหรับส่ง Access Token ใหม่และข้อมูลที่เกี่ยวข้องหลังจากการอัพเดต Token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshTokenResponse {
    /// Access Token ใหม่ที่ได้รับ
    pub access_token: String,
    /// Refresh Token ใหม่ (ถ้ามี)
    pub refresh_token: Option<String>,
    /// อายุของ Token ในหน่วยวินาที (ถ้ามี)
    pub expires_in: Option<i64>,
}
