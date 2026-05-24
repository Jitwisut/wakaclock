/// ไฟล์ mod.rs - AI Embedding Response Models
/// โครงสร้าง response สำหรับ AI embedding generation
/// ใช้กับ LiteLLM และ vector search systems
/// ส่ง embeddings ไปยัง Qdrant vector database
use serde::{Deserialize, Serialize};

/// Response จาก AI embedding service
/// เก็บ vector embeddings จาก text input
/// ใช้สำหรับ semantic search และ product matching
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    /// Vector embeddings (array ของ f32)
    pub embedding: Vec<f32>,
    /// AI model ที่ใช้สร้าง embedding
    pub model: String,
}
