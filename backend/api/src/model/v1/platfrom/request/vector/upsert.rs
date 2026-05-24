/// โมดูลสำหรับการ upsert vector data
///
/// โมดูลนี้จัดการการสร้างและอัพเดท vector embeddings ใน vector database
/// สำหรับการค้นหาสินค้าด้วย AI
use serde::Deserialize;
use utoipa::ToSchema;

/// Request สำหรับการ upsert vector data
///
/// ใช้ในการเพิ่มหรืออัพเดท vector embeddings ของสินค้าใน vector database
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpsertRequest {
    pub platform: String,
    pub shop_id: String,
    pub product_id: String,
    pub vector: Vec<f32>,
    pub metadata: serde_json::Value,
}
