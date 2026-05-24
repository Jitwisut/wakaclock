/// ไฟล์ mod.rs - Platform Response Models Module
/// รวมทุก response models สำหรับ API endpoints
/// จัดการตาม domain areas: auth, shop, product, vector, etc.
/// ใช้ใน HTTP response serialization

/// Module สำหรับ audit log responses
pub mod audit;
/// Module สำหรับ authentication responses
pub mod auth;
/// Module สำหรับ AI embedding responses
pub mod embedding;
/// Module สำหรับ API gateway responses
pub mod gateway;
/// Module สำหรับ product management responses
pub mod product;
/// Module สำหรับ shop management responses
pub mod shop;
/// Module สำหรับ token/OAuth responses
pub mod token;
/// Module สำหรับ vector search responses
pub mod vector;
/// Module สำหรับ webhook responses
pub mod webhook;
