/// ไฟล์ search.rs - Vector Search Response Models
/// โครงสร้างข้อมูลสำหรับผลลัพธ์การค้นหาด้วย vector similarity
/// รวมข้อมูล similarity score, metadata และ product matches
/// ใช้สำหรับ AI-powered product recommendations และ semantic search
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VectorSearchResult {
    pub product_id: String,
    pub score: f32,
    pub metadata: serde_json::Value,
    pub matches: Option<Vec<VectorMatch>>,
    pub total: Option<usize>,
    pub query_time_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VectorMatch {
    pub product_id: String,
    pub score: f32,
    pub metadata: serde_json::Value,
}
