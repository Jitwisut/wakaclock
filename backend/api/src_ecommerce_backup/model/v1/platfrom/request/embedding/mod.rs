/// ไฟล์ mod.rs - AI Embedding Request Models
/// โครงสร้าง requests สำหรับ AI embedding generation
/// ใช้กับ LiteLLM service และ vector search
/// สำหรับการแปลง text เป็น embeddings
use serde::{Deserialize, Serialize};

/// Request สำหรับการสร้าง embedding จาก text
/// ส่ง text input ไป AI model เพื่อได้ vector representation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingRequest {
    /// Text input ที่ต้องการแปลงเป็น embedding
    pub text: String,
    /// AI model ที่ต้องการใช้ (optional, ใช้ default ถ้าไม่ระบุ)
    pub model: Option<String>,
}
