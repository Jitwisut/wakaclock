//! Platform Models Module
//! โมดูลสำหรับ platform-specific models และ integrations
//!
//! ประกอบด้วย:
//! - `config`: platform configuration models
//! - `entries`: domain entities สำหรับ platforms
//! - `request`: platform request models
//! - `response`: platform response models

/// Platform configuration models
pub mod config;

/// Platform domain entities
pub mod entries;

/// Platform request models
pub mod request;

/// Platform response models
pub mod response;

/// Country and region support models
pub mod country;

/// โครงสร้างหลักสำหรับ platform product
/// ใช้เป็น base structure สำหรับ product data จาก platforms
pub struct PlatformProduct;
