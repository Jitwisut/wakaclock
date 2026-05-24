/// ไฟล์ search.rs - Vector Search Request Models
/// โครงสร้างข้อมูลสำหรับการค้นหาสินค้าด้วย vector similarity
/// รองรับการค้นหาแบบ semantic search และ metadata filtering
/// ใช้งานร่วมกับ Qdrant vector database
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VectorSearchRequest {
    pub query: Vec<f32>,
    pub platform: Option<String>,
    pub shop_id: Option<String>,
    pub limit: Option<usize>,
    pub metadata_filter: Option<serde_json::Value>,
}
