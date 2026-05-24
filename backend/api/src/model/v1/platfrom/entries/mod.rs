//! ไฟล์ mod.rs - Platform Entries Module
//! รวบรวมและจัดการ submodules สำหรับโครงสร้างข้อมูล platform entities
//! จัดการ re-export types และ common patterns สำหรับ platform layer
//! ประกอบด้วย authentication, products, shops, และ sync-related entities

/// Module สำหรับ authentication entities
pub mod auth;
/// Module สำหรับ common types ที่ใช้ร่วมกัน
pub mod common;
/// Module สำหรับ domain events
pub mod events;
/// Module สำหรับ platform-specific types
pub mod platfrom;
/// Module สำหรับ product entities
pub mod product;
/// Module สำหรับ shop entities
pub mod shop;
/// Module สำหรับ vector search entities
pub mod vector;
// Module สำหรับ product sync entities
pub mod product_sync;

// Re-export types สำหรับใช้งานสะดวก
pub use auth::*;
pub use common::*;
pub use platfrom::*;
pub use product::*;
pub use product_sync::*;
pub use shop::*;
