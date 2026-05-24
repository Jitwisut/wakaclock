//! โมดูลการจัดการ Vector Request (Vector Request Module)
//!
//! ไฟล์นี้รวบรวมและส่งออก (re-export) โครงสร้างและฟังก์ชันต่างๆ
//! ที่เกี่ยวข้องกับการจัดการเวกเตอร์ในระบบ Gateway
//!
//! ## โมดูลย่อย (Sub-modules)
//! - `search`: การค้นหาเวกเตอร์
//! - `sync`: การซิงค์เวกเตอร์
//! - `upsert`: การ Insert/Update เวกเตอร์
//!
//! ## การใช้งาน
//! - ค้นหาสินค้าที่คล้ายคลึงด้วย AI/Semantic Search
//! - บันทึกและอัพเดตเวกเตอร์สินค้า
//! - ติดตามสถานะการซิงค์เวกเตอร์
//!
//! ## ไดเรกทอรี
//! `src/model/v1/gateway/request/vector/`

pub mod search;
pub mod sync;
pub mod upsert;

pub use search::VectorSearchRequest;
pub use sync::{GetProductVectorQuery, SyncStatusQuery};
pub use upsert::UpsertRequest;
