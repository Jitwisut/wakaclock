//! # Health Check Module - โมดูล Health Check
//!
//! โมดูลสำหรับจัดการ health check endpoints ที่ใช้ในการติดตาม
//! สถานะของ service และ monitoring ระบบโดยรวม
//!
//! ## หน้าที่หลัก
//! - ให้บริการ health status endpoints
//! - รองรับ readiness และ liveness probes สำหรับ Kubernetes
//! - ตรวจสอบสถานะของ dependencies ต่างๆ

pub mod handler;

pub use handler::HealthHandler;
