//! โมดูลการจัดการ Token ใน Request (Token Request Module)
//!
//! ไฟล์นี้เป็นตัวรวบรวมและส่งออก (re-export) โครงสร้างและคำนิยาม
//! ที่เกี่ยวข้องกับการจัดการ Token ในระบบ Gateway
//!
//! ## โครงสร้างหลัก
//! - `RefreshTokenResponse`: การตอบสนองการอัพเดต Refresh Token
//! - `AuthToken`: โครงสร้าง Authentication Token
//!
//! ## ไดเรกทอรี
//! `src/model/v1/gateway/request/token/`

/// โครงสร้างการตอบสนองการอัพเดต Refresh Token
///
/// ใช้สำหรับส่งข้อมูลการอัพเดต Token กลับไปยัง Client
pub struct RefreshTokenResponse;

/// โครงสร้าง Authentication Token
///
/// ใช้สำหรับเก็บและจัดการข้อมูล Token ที่ใช้ในการยืนยันตัวตน
pub struct AuthToken;
