//! # Vector Upsert Response Models
//!
//! โมดูลนี้กำหนดโครงสร้างข้อมูลสำหรับการตอบกลับของ vector upsert operations
//! ใช้สำหรับการจัดการการเพิ่มและอัพเดต vector embeddings
//!
//! ## ฟีเจอร์หลัก
//! - Vector upsert operation responses
//! - Batch processing results
//! - Error handling และ validation feedback
//! - Performance metrics และ statistics
//! - Success และ failure tracking

use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Serialize, ToSchema)]
pub struct UpsertResponse {
    pub success: bool,
    pub product_id: String,
}
