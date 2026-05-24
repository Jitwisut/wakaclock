/// ไฟล์ vector.rs - Vector Search และ AI Embeddings
/// โครงสร้างข้อมูลสำหรับ vector search
/// ใช้กับ Qdrant vector database
/// รองรับ product embeddings สำหรับ semantic search
use serde::Serialize;

/// Vector representation ของสินค้า
/// ใช้สำหรับ AI-powered search และ recommendations
/// เก็บ embedding จาก AI model พร้อม metadata
#[derive(Debug, Serialize)]
pub struct ProductVector {
    /// Product ID ที่ vector นี้เป็นตัวแทน
    pub product_id: String,
    /// Vector embeddings (f32 array)
    pub vector: Vec<f32>,
    /// Metadata เพิ่มเติมสำหรับ search filtering
    pub metadata: serde_json::Value,
    /// Model ที่ใช้สร้าง embedding
    pub embedding_model: String,
    /// Timestamp เมื่อสร้าง vector
    pub created_at: String,
}
