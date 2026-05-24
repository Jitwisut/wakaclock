//! # Middleware Module - โมดูลระบบ Middleware
//!
//! โมดูลนี้รวมรวม middleware ต่างๆ ที่ใช้ในการประมวลผลคำขอ HTTP
//! รวมถึงการยืนยันตัวตน, การจัดการสิทธิ์, CORS, การจัดการข้อผิดพลาด
//! และการจำกัดอัตราการเรียกใช้งาน
//!
//! ## Middleware Components:
//! - **Authentication**: ตรวจสอบ x-auth-token
//! - **Authorization**: จัดการสิทธิ์และ permissions
//! - **CORS**: Cross-Origin Resource Sharing configuration
//! - **Error Handler**: จัดการข้อผิดพลาดแบบ global
//! - **Rate Limiting**: จำกัดอัตราการเรียกใช้ API
//! - **Pipeline**: ระบบจัดการ middleware chain
//!
//! ## การทำงาน:
//! Middleware ทำงานแบบ chain of responsibility pattern
//! โดยแต่ละ middleware จะประมวลผล request และส่งต่อไปยัง middleware ถัดไป
pub mod auth_middleware;
/// โมดูลสำหรับการตั้งค่า Cross-Origin Resource Sharing (CORS)
pub mod cors;
/// โมดูลสำหรับการจัดการข้อผิดพลาดในระดับ middleware
pub mod error_handler;
/// โมดูลสำหรับการจำกัดอัตราการเรียกใช้งาน API
pub mod rate_limit;
/// โมดูลสำหรับ logging incoming requests
pub mod request_logger;
/// โมดูลสำหรับการติดตามการใช้งาน API
pub mod usage_tracking;
/// Extractor สำหรับ user context จาก Strapi JWT
pub mod user_ctx;

// pub use auth_permissions::*;
pub use cors::*;
pub use error_handler::*;
pub use rate_limit::*;
pub use request_logger::*;
pub use usage_tracking::*;
pub use user_ctx::UserCtx;
