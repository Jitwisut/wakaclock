/// ไฟล์ sync.rs - Vector Sync Response Models
/// โครงสร้าง responses สำหรับ vector sync operations
/// ใช้ในการ sync product embeddings ไป Qdrant vector database
/// รวม progress tracking และ status reporting
use serde::Serialize;
use utoipa::ToSchema;

/// Vector representation ของสินค้าใน vector database
/// เก็บ embeddings และ metadata สำหรับ semantic search
#[derive(Debug, Serialize, ToSchema)]
pub struct ProductVector {
    /// Product ID ที่ vector นี้เป็นตัวแทน
    pub product_id: String,
    /// Vector embeddings (f32 array)
    pub vector: Vec<f32>,
    /// Metadata เพิ่มเติมสำหรับ search filtering
    pub metadata: serde_json::Value,
    /// AI model ที่ใช้สร้าง embedding
    pub embedding_model: String,
    /// เวลาที่สร้าง vector
    pub created_at: String,
}

/// สถานะของ vector sync job
/// ติดตาม progress และสถานะการทำงาน
#[derive(Debug, Serialize, ToSchema)]
pub struct SyncStatus {
    /// Job ID (optional)
    pub job_id: Option<String>,
    /// สถานะปัจจุบัน (pending/running/completed/failed)
    pub status: String,
    /// จำนวน items ทั้งหมด
    pub total_items: u32,
    /// จำนวน items ที่ดำเนินการแล้ว
    pub processed_items: u32,
    /// เวลาเริ่มต้น job
    pub started_at: Option<String>,
    /// เวลาอัปเดทล่าสุด
    pub updated_at: Option<String>,
    /// เวลาเสร็จสิ้น job
    pub completed_at: Option<String>,
    /// ข้อความ error (ถ้ามี)
    pub error_message: Option<String>,
}
