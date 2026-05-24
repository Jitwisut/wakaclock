/// ไฟล์ upsert.rs - Vector Upsert Response Model
/// Response สำหรับ vector upsert operations
/// ใช้เมื่อ insert หรือ update vector ใน Qdrant database
/// Confirm ความสำเร็จของ operation
use serde::Serialize;
use utoipa::ToSchema;

/// Response จาก vector upsert operation
/// ยืนยันความสำเร็จในการบันทึก vector
#[derive(Debug, Serialize, ToSchema)]
pub struct UpsertResponse {
    /// สถานะความสำเร็จของ operation
    pub success: bool,
    /// Product ID ที่ทำ upsert
    pub product_id: String,
}
