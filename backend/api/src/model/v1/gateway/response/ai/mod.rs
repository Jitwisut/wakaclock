//! Gateway AI Response Models
//!
//! Response structures returned by the AI orchestration endpoints including
//! embedding payloads, structured completions, product chat responses and
//! unified sync output destined for MCP compatible clients.

use serde::{Deserialize, Serialize};

/// Response payload for embedding generation requests.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingResponsePayload {
    pub model: String,
    pub embedding: Vec<f32>,
}

/// Lightweight summary of an attachment provided as part of the completion
/// workflow.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentSummary {
    pub filename: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub preview: String,
    pub source_url: Option<String>,
}

/// Structured completion response adhering to the provided schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionResponsePayload {
    pub model: String,
    pub content: serde_json::Value,
    pub schema: serde_json::Value,
    pub attachments: Vec<AttachmentSummary>,
}

/// Product summary returned in chat recommendations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductSummary {
    pub product_id: String,
    pub title: String,
    pub description: String,
    pub price: String,
    pub currency: String,
    pub image_url: String,
    pub score: f32,
}

/// Response payload for chat based recommendations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductChatResponse {
    pub conversation_id: String,
    pub model: String,
    pub reply: String,
    pub query_embedding: Vec<f32>,
    pub products: Vec<ProductSummary>,
}

/// Vector payload emitted during unified sync operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpProductVector {
    pub product_id: String,
    pub platform: String,
    pub shop_id: String,
    pub vector: Vec<f32>,
    pub metadata: serde_json::Value,
}

/// Unified sync response containing Qdrant + MCP metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedSyncResult {
    pub synced: usize,
    pub vectors: Vec<McpProductVector>,
    pub platform: String,
    pub shop_id: String,
}
