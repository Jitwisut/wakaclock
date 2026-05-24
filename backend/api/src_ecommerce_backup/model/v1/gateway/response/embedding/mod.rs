/// โมดูลสำหรับ Embedding Response
///
/// โมดูลนี้จัดการโครงสร้างข้อมูลสำหรับการตอบกลับของ embedding operations
/// ที่ใช้ในการสร้าง vector representations ของข้อมูลสินค้า
use serde::{Deserialize, Serialize};

/// Response สำหรับการสร้าง embedding
///
/// ส่งกลับ vector embedding และชื่อ model ที่ใช้ในการสร้าง
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    pub embedding: Vec<f32>,
    pub model: String,
}
