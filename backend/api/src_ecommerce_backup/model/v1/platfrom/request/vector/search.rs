/// โมดูลสำหรับการค้นหา vector data
///
/// โมดูลนี้จัดการการค้นหาสินค้าโดยใช้ vector similarity search
/// สำหรับการค้นหาสินค้าที่คล้ายกันด้วย AI
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Request สำหรับการค้นหา vector
///
/// ใช้ในการค้นหาสินค้าที่คล้ายกันโดยใช้ vector similarity
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VectorSearchRequest {
    pub query: Vec<f32>,
    pub platform: Option<String>,
    pub shop_id: Option<String>,
    pub limit: Option<usize>,
    pub metadata_filter: Option<serde_json::Value>,
}
