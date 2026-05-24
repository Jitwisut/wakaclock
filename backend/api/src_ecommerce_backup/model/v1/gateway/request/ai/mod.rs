//! Gateway AI Request Models
//!
//! Defines the request payloads used by the AI orchestration endpoints exposed
//! to external clients. The structures focus on schema driven completions,
//! attachment handling, product chat requests and unified sync triggers.

use serde::{Deserialize, Serialize};

use crate::model::v1::platfrom::request::embedding::EmbeddingRequest;

/// Attachment payload containing optional base64 data or a remote source URL.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AttachmentPayload {
    pub filename: Option<String>,
    pub mime_type: Option<String>,
    pub data_base64: Option<String>,
    pub source_url: Option<String>,
}

/// Chat style message used for completions and chat requests.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessagePayload {
    pub role: String,
    pub content: String,
}

/// Request to produce a structured completion that conforms to a JSON schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionRequestPayload {
    pub model: Option<String>,
    pub instructions: Option<String>,
    pub messages: Vec<ChatMessagePayload>,
    pub schema: serde_json::Value,
    #[serde(default)]
    pub attachments: Vec<AttachmentPayload>,
}

/// Filter options for chat based product recommendations.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProductChatFilter {
    pub limit: Option<usize>,
}

/// Product recommendation chat request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductChatRequest {
    pub shop_id: String,
    pub platform: String,
    pub query: Option<String>,
    pub model: Option<String>,
    #[serde(default)]
    pub conversation_id: Option<String>,
    #[serde(default)]
    pub filters: Option<ProductChatFilter>,
    #[serde(default)]
    pub history: Vec<ChatMessagePayload>,
}

/// Trigger a unified product sync from ClickHouse to the vector store.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedProductSyncRequest {
    pub shop_id: String,
    pub platform: String,
    pub model: Option<String>,
    pub limit: Option<usize>,
}

/// Re-export embedding request for convenience.
pub type EmbeddingRequestPayload = EmbeddingRequest;
