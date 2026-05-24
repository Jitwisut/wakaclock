//! โมดูลการตอบสนองสำหรับการทำงานกับเวกเตอร์ (Vector Response Module)
//!
//! ไฟล์นี้เป็นตัวรวบรวมและส่งออก (re-export) ของโครงสร้างข้อมูลและฟังก์ชันต่างๆ
//! ที่เกี่ยวข้องกับการตอบสนองการทำงานกับเวกเตอร์ในระบบ Gateway
//!
//! ## โมดูลย่อย (Sub-modules)
//! - `search`: การค้นหาเวกเตอร์และผลลัพธ์
//! - `sync`: การซิงค์เวกเตอร์และสถานะ
//! - `upsert`: การตอบสนองการอัปเซิร์ต (insert/update)
//!
//! ## ไดเรกทอรี
//! `src/model/v1/gateway/response/vector/`

pub mod search;
pub mod sync;
pub mod upsert;

pub use search::{VectorMatch, VectorSearchResult};
pub use sync::{ProductVector, SyncStatus};
pub use upsert::UpsertResponse;
