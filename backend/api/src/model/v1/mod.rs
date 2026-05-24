//! Model Version 1 Module
//! โมดูลหลักสำหรับ API models เวอร์ชัน 1
//!
//! แบ่งออกเป็น 2 ส่วนหลัก:
//! - `gateway`: models สำหรับ API gateway และ public APIs
//! - `platfrom`: models สำหรับ platform-specific integrations

/// Gateway API models
/// โมเดลสำหรับ API gateway, public endpoints
pub mod gateway;

/// Platform-specific models
/// โมเดลสำหรับ platform integrations (TikTok, Shopee, Lazada ฯลฯ)
pub mod platfrom;
