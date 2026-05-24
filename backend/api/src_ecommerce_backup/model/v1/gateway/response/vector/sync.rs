/// โมดูลสำหรับ Vector Sync Response
///
/// โมดูลนี้จัดการโครงสร้างข้อมูลสำหรับการตอบกลับของ vector sync operations
/// รวมถึงสถานะการซิงค์และข้อมูล product vectors
use serde::Serialize;
use utoipa::ToSchema;

/// ข้อมูล Product Vector ที่เก็บใน vector database
///
/// รวมข้อมูล vector embedding, metadata และข้อมูล model ที่ใช้สร้าง
#[derive(Debug, Serialize, ToSchema)]
pub struct ProductVector {
    pub product_id: String,
    pub vector: Vec<f32>,
    pub metadata: serde_json::Value,
    pub embedding_model: String,
    pub created_at: String,
}

/// สถานะการซิงค์ vector data
///
/// แสดงความคืบหน้าและสถานะปัจจุบันของการซิงค์ข้อมูลไปยัง vector database
#[derive(Debug, Serialize, ToSchema)]
pub struct SyncStatus {
    pub job_id: Option<String>,
    pub status: String,
    pub total_items: u32,
    pub processed_items: u32,
    pub started_at: Option<String>,
    pub updated_at: Option<String>,
    pub completed_at: Option<String>,
    pub error_message: Option<String>,
}
