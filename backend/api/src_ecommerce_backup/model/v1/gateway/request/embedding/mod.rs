//! AI Embedding Request Models
//!
//! โมดูลนี้จัดการโครงสร้างข้อมูลสำหรับ AI embedding requests
//! ใช้สำหรับสร้าง text embeddings จาก product descriptions
//!
//! # Features
//! - Text embedding generation
//! - Multiple AI model support
//! - Custom model selection
//! - Vector representation สำหรับ semantic search

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingRequest {
    pub text: String,
    pub model: Option<String>,
}
