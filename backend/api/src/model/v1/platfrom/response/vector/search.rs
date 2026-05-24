/// ไฟล์ search.rs - Vector Search Response Models
/// โครงสร้าง responses สำหรับ vector similarity search
/// ใช้ใน semantic product search และ AI-powered recommendations
/// รวม similarity scores และ ranking information
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// ผลลัพธ์จาก vector similarity search
/// รวม matching products และ performance metrics
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VectorSearchResult {
    /// Product ID ของผลลัพธ์หลัก
    pub product_id: String,
    /// คะแนนความคล้ายคลึง (0.0 - 1.0)
    pub score: f32,
    /// Metadata เพิ่มเติมของสินค้า
    pub metadata: serde_json::Value,
    /// รายการ matches ทั้งหมด
    pub matches: Option<Vec<VectorMatch>>,
    /// จำนวน matches ทั้งหมด
    pub total: Option<usize>,
    /// เวลาที่ใช้ในการ query (มิลลิวินาที)
    pub query_time_ms: Option<u64>,
}

/// สินค้าที่ match จาก vector search
/// รวม similarity score และ metadata
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VectorMatch {
    /// Product ID ของสินค้าที่ match
    pub product_id: String,
    /// คะแนนความคล้ายคลึง
    pub score: f32,
    /// Metadata ของสินค้า
    pub metadata: serde_json::Value,
}
