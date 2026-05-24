//! AI Orchestration Service
//!
//! This module provides a high-level service that brings together product
//! metadata from ClickHouse, deterministic embedding generation, vector store
//! synchronisation with Qdrant, and structured LLM style responses. The
//! implementation is designed so it works in offline CI environments while
//! keeping the integration points explicit for real deployments.

use base64::Engine;
use chrono::Utc;
use futures::{stream::Stream, StreamExt};
use qdrant_client::Qdrant;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::HashSet, sync::Arc, time::Duration};
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use tracing::warn;
use uuid::Uuid;

use crate::{
    model::{
        error::{AppError, AppResult},
        v1::gateway::{
            request::ai::{
                AttachmentPayload, ChatMessagePayload, CompletionRequestPayload, ProductChatFilter,
                ProductChatRequest, UnifiedProductSyncRequest,
            },
            response::ai::{
                AttachmentSummary, CompletionResponsePayload, EmbeddingResponsePayload,
                McpProductVector, ProductChatResponse, ProductSummary, UnifiedSyncResult,
            },
        },
    },
    repository::{
        clickhouse::{ChatMessageRecord, ClickHouseRepository},
        qdrant::QdrantRepository,
        traits::ProductRepository,
        VectorRepository,
    },
    AppState,
};

const DEFAULT_EMBEDDING_MODEL: &str = "lite-embedding";
const DEFAULT_COMPLETION_MODEL: &str = "lite-chat";

/// Lightweight helper describing an embedding model configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct EmbeddingModelConfig {
    name: String,
    dimensions: usize,
}

#[derive(Debug, Clone, Serialize)]
struct ChatCompletionMessage {
    role: String,
    content: String,
}

#[derive(Debug, Clone)]
struct ChatContext {
    conversation_id: String,
    user_query: String,
    completion_model: String,
    embedding: EmbeddingResponsePayload,
    products: Vec<ProductSummary>,
    messages: Vec<ChatCompletionMessage>,
}

#[derive(Debug, Deserialize)]
struct OpenAiCompletionResponse {
    choices: Vec<OpenAiCompletionChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAiCompletionChoice {
    message: OpenAiCompletionChoiceMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAiCompletionChoiceMessage {
    role: String,
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiStreamResponse {
    choices: Vec<OpenAiStreamChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAiStreamChoice {
    delta: Option<OpenAiStreamDelta>,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiStreamDelta {
    content: Option<String>,
    role: Option<String>,
}

/// Core AI orchestration service.
pub struct AiService {
    state: Arc<AppState>,
    product_repo: Arc<ClickHouseRepository>,
}

impl AiService {
    /// Create a new AI service instance.
    pub fn new(state: Arc<AppState>) -> Self {
        let product_repo = state.product_repository();
        Self {
            state,
            product_repo,
        }
    }

    fn embedding_model_config(&self, requested: Option<&str>) -> EmbeddingModelConfig {
        let ai_config = &self.state.config.ai;
        let requested_name = requested
            .map(str::to_string)
            .unwrap_or_else(|| DEFAULT_EMBEDDING_MODEL.to_string());

        if let Some(model) = ai_config.embedding_models.get(&requested_name) {
            EmbeddingModelConfig {
                name: requested_name,
                dimensions: model.dimensions.max(4),
            }
        } else if let Some((name, model)) = ai_config.embedding_models.iter().next() {
            EmbeddingModelConfig {
                name: name.clone(),
                dimensions: model.dimensions.max(4),
            }
        } else {
            EmbeddingModelConfig {
                name: requested_name,
                dimensions: 32,
            }
        }
    }

    fn completion_model_name(&self, requested: Option<&str>) -> String {
        let ai_config = &self.state.config.ai;
        if let Some(name) = requested {
            if ai_config.completion_models.contains_key(name) {
                return name.to_string();
            }
        }
        ai_config
            .default_completion_model
            .clone()
            .unwrap_or_else(|| DEFAULT_COMPLETION_MODEL.to_string())
    }

    /// Deterministically generate an embedding for the supplied text.
    pub fn embed_text(
        &self,
        text: &str,
        model: Option<&str>,
    ) -> AppResult<EmbeddingResponsePayload> {
        let config = self.embedding_model_config(model);
        let mut hasher = Sha256::new();
        hasher.update(text.as_bytes());
        let digest = hasher.finalize();

        let mut vector = Vec::with_capacity(config.dimensions);
        let bytes = digest.as_slice();
        let total = bytes.len();
        for i in 0..config.dimensions {
            let idx = (i * 4) % total;
            let chunk = [
                bytes[idx],
                bytes[(idx + 1) % total],
                bytes[(idx + 2) % total],
                bytes[(idx + 3) % total],
            ];
            let raw = u32::from_le_bytes(chunk);
            let normalised = (raw as f64 / u32::MAX as f64) * 2.0 - 1.0;
            vector.push(normalised as f32);
        }

        Ok(EmbeddingResponsePayload {
            model: config.name,
            embedding: vector,
        })
    }

    /// Generate a structured completion that matches the provided JSON schema.
    pub fn completion(
        &self,
        request: CompletionRequestPayload,
    ) -> AppResult<CompletionResponsePayload> {
        let model = self.completion_model_name(request.model.as_deref());
        let mut transcript = String::new();
        if let Some(instructions) = &request.instructions {
            transcript.push_str(instructions);
            transcript.push('\n');
        }

        for message in &request.messages {
            transcript.push_str(&format!("{}: {}\n", message.role, message.content));
        }

        let attachments = self.summarise_attachments(&request.attachments);
        if !attachments.is_empty() {
            transcript.push_str("Attachments provided:\n");
            for attachment in &attachments {
                transcript.push_str(&format!(
                    "- {} ({} bytes)\n",
                    attachment.filename, attachment.size_bytes
                ));
            }
        }

        let content = self.fill_schema(&request.schema, &transcript, &attachments);

        Ok(CompletionResponsePayload {
            model,
            content,
            schema: request.schema,
            attachments,
        })
    }

    fn build_llm_client(&self) -> AppResult<Client> {
        Client::builder()
            .timeout(Duration::from_millis(
                self.state.config.ai.llm_timeout_ms.max(1),
            ))
            .build()
            .map_err(|err| AppError::InternalError(format!("failed to build HTTP client: {}", err)))
    }

    fn llm_api_key(&self) -> AppResult<String> {
        let key = self.state.config.ai.llm_api_key.trim();
        if key.is_empty() {
            return Err(AppError::ConfigError(
                "LLM API key is not configured".to_string(),
            ));
        }
        Ok(key.to_string())
    }

    fn chat_completion_url(&self) -> String {
        format!(
            "{}/chat/completions",
            self.state.config.ai.llm_api_base_url.trim_end_matches('/')
        )
    }

    fn build_system_prompt(&self, products: &[ProductSummary]) -> String {
        let mut prompt = String::from("You are an ecommerce copilot that recommends products. ");
        prompt.push_str(
            "Always ground your answers in the supplied product list, highlighting pricing, ",
        );
        prompt.push_str(
            "availability, and differentiators. Be concise and explain why items match the request.\n",
        );

        if products.is_empty() {
            prompt.push_str(
                "If no products are available, ask clarifying questions before suggesting next steps.",
            );
            return prompt;
        }

        prompt.push_str("Here are the current candidates:\n");
        for product in products {
            prompt.push_str(&format!(
                "- {} ({} {})\n",
                product.title, product.price, product.currency
            ));
        }
        prompt.push_str(
            "Use this catalogue to tailor your response. Offer at most five suggestions and invite the user to explore further if needed.",
        );
        prompt
    }

    async fn prepare_chat_context(
        &self,
        tenant_id: &str,
        request: &ProductChatRequest,
    ) -> AppResult<ChatContext> {
        let limit = request
            .filters
            .as_ref()
            .and_then(|f| f.limit)
            .unwrap_or(5)
            .max(1);
        let user_query = request
            .query
            .as_ref()
            .map(|q| q.trim())
            .filter(|q| !q.is_empty())
            .map(str::to_string)
            .or_else(|| request.history.last().map(|entry| entry.content.clone()))
            .ok_or_else(|| AppError::BadRequest("Chat query cannot be empty".to_string()))?;

        let conversation_id = request
            .conversation_id
            .as_ref()
            .map(|id| id.trim())
            .filter(|id| !id.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let embedding = self.embed_text(&user_query, request.model.as_deref())?;
        let mut products = self
            .fetch_product_summaries(tenant_id, request, &embedding, limit)
            .await?;

        if products.is_empty() {
            products = self
                .fallback_product_summaries(tenant_id, request, limit)
                .await
                .unwrap_or_default();
        }

        let completion_model = self.completion_model_name(request.model.as_deref());
        let system_prompt = self.build_system_prompt(&products);
        let mut messages = Vec::new();
        messages.push(ChatCompletionMessage {
            role: "system".to_string(),
            content: system_prompt,
        });

        for entry in &request.history {
            messages.push(ChatCompletionMessage {
                role: entry.role.clone(),
                content: entry.content.clone(),
            });
        }

        messages.push(ChatCompletionMessage {
            role: "user".to_string(),
            content: user_query.clone(),
        });

        Ok(ChatContext {
            conversation_id,
            user_query,
            completion_model,
            embedding,
            products,
            messages,
        })
    }

    async fn fetch_product_summaries(
        &self,
        tenant_id: &str,
        request: &ProductChatRequest,
        embedding: &EmbeddingResponsePayload,
        limit: usize,
    ) -> AppResult<Vec<ProductSummary>> {
        let vector_repo = self.build_vector_repository()?;
        let collection = self.collection_name(&request.platform, &embedding.model);
        let results = vector_repo
            .search_vectors(&collection, &embedding.embedding, limit)
            .await
            .unwrap_or_default();

        let mut summaries = Vec::new();
        let mut seen = HashSet::new();

        for (index, (_id, _score, metadata)) in results.into_iter().enumerate() {
            let (product_id, title, description, price, currency, image_url) =
                if let Value::Object(map) = metadata {
                    let product_id = map
                        .get("product_id")
                        .and_then(|v| v.as_str())
                        .map(str::to_string)
                        .unwrap_or_else(|| format!("{}-{}", request.platform, index));
                    let title = map
                        .get("title")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Untitled product")
                        .to_string();
                    let description = map
                        .get("description")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Description not available")
                        .to_string();
                    let price = match map.get("price") {
                        Some(Value::Number(num)) => {
                            format!("{:.2}", num.as_f64().unwrap_or_default())
                        }
                        Some(Value::String(s)) => s.clone(),
                        _ => "—".to_string(),
                    };
                    let currency = map
                        .get("currency")
                        .and_then(|v| v.as_str())
                        .unwrap_or("USD")
                        .to_string();
                    let image_url = map
                        .get("image_url")
                        .and_then(|v| v.as_str())
                        .unwrap_or_default()
                        .to_string();
                    (product_id, title, description, price, currency, image_url)
                } else {
                    (
                        format!("{}-{}", request.platform, index),
                        "Catalogue item".to_string(),
                        "Description not available".to_string(),
                        "—".to_string(),
                        "USD".to_string(),
                        String::new(),
                    )
                };

            if !seen.insert(product_id.clone()) {
                continue;
            }

            let summary = ProductSummary {
                product_id,
                title,
                description,
                price,
                currency,
                image_url,
                score: (1.0 - (index as f32 / limit as f32))
                    .max(0.0)
                    .max(0.01)
                    .min(1.0),
            };
            summaries.push(summary);
        }

        if summaries.is_empty() {
            return Ok(Vec::new());
        }

        Ok(summaries)
    }

    async fn fallback_product_summaries(
        &self,
        tenant_id: &str,
        request: &ProductChatRequest,
        limit: usize,
    ) -> AppResult<Vec<ProductSummary>> {
        let products = self
            .product_repo
            .list_products(
                tenant_id,
                &request.platform,
                &request.shop_id,
                1,
                limit.max(1) as u32,
            )
            .await
            .unwrap_or_default();

        Ok(products
            .into_iter()
            .enumerate()
            .map(|(index, product)| {
                let primary_image = product
                    .images
                    .first()
                    .map(|img| img.url.clone())
                    .unwrap_or_default();
                ProductSummary {
                    product_id: product.product_id.clone(),
                    title: product.title.clone(),
                    description: product
                        .description
                        .clone()
                        .unwrap_or_else(|| "Description not available".to_string()),
                    price: product.price.amount.to_string(),
                    currency: product.currency.clone(),
                    image_url: primary_image,
                    score: 1.0 - (index as f32 * 0.05),
                }
            })
            .collect())
    }

    fn build_chat_records(
        tenant_id: &str,
        request: &ProductChatRequest,
        context: &ChatContext,
        assistant_reply: Option<&str>,
    ) -> Vec<ChatMessageRecord> {
        let mut records = Vec::new();
        let timestamp = chrono::Utc::now();
        let base_metadata = json!({
            "platform": request.platform,
            "shop_id": request.shop_id,
            "completion_model": context.completion_model,
            "embedding_model": context.embedding.model,
            "products": context.products,
        });

        if !context.user_query.trim().is_empty() {
            let mut user_metadata = base_metadata.clone();
            if let Some(object) = user_metadata.as_object_mut() {
                object.insert("message_role".into(), Value::String("user".into()));
            }
            records.push(ChatMessageRecord {
                conversation_id: context.conversation_id.clone(),
                message_id: Uuid::new_v4().to_string(),
                tenant_id: tenant_id.to_string(),
                shop_id: request.shop_id.clone(),
                platform: request.platform.clone(),
                role: "user".into(),
                content: context.user_query.clone(),
                model: request.model.clone(),
                metadata: user_metadata,
                created_at: timestamp,
            });
        }

        if let Some(reply) = assistant_reply.filter(|r| !r.trim().is_empty()) {
            let mut assistant_metadata = base_metadata;
            if let Some(object) = assistant_metadata.as_object_mut() {
                object.insert("message_role".into(), Value::String("assistant".into()));
                object.insert(
                    "query_embedding".into(),
                    Value::Array(
                        context
                            .embedding
                            .embedding
                            .iter()
                            .map(|value| Value::from(*value))
                            .collect(),
                    ),
                );
            }

            records.push(ChatMessageRecord {
                conversation_id: context.conversation_id.clone(),
                message_id: Uuid::new_v4().to_string(),
                tenant_id: tenant_id.to_string(),
                shop_id: request.shop_id.clone(),
                platform: request.platform.clone(),
                role: "assistant".into(),
                content: reply.to_string(),
                model: Some(context.completion_model.clone()),
                metadata: assistant_metadata,
                created_at: timestamp,
            });
        }

        records
    }

    /// Build a conversational product recommendation using available catalogue
    /// data and live LLM completions.
    pub async fn chat_recommend_products(
        &self,
        tenant_id: &str,
        request: ProductChatRequest,
    ) -> AppResult<ProductChatResponse> {
        let context = self.prepare_chat_context(tenant_id, &request).await?;
        let client = self.build_llm_client()?;
        let api_key = self.llm_api_key()?;
        let url = self.chat_completion_url();

        #[derive(Serialize)]
        struct CompletionPayload<'a> {
            model: &'a str,
            messages: &'a [ChatCompletionMessage],
            temperature: f32,
        }

        let payload = CompletionPayload {
            model: &context.completion_model,
            messages: &context.messages,
            temperature: 0.2,
        };

        let response = client
            .post(url)
            .bearer_auth(api_key)
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "LLM completion failed (status {}): {}",
                status, body
            )));
        }

        let completion: OpenAiCompletionResponse = response.json().await?;
        let reply = completion
            .choices
            .first()
            .and_then(|choice| choice.message.content.clone())
            .unwrap_or_else(|| "I could not generate a response at this time.".to_string());

        let records = Self::build_chat_records(tenant_id, &request, &context, Some(reply.as_str()));
        if let Err(err) = self.product_repo.insert_chat_messages(&records).await {
            warn!("failed to persist chat transcript: {}", err);
        }

        let ChatContext {
            conversation_id,
            completion_model,
            embedding,
            products,
            ..
        } = context;

        Ok(ProductChatResponse {
            conversation_id,
            model: completion_model,
            reply,
            query_embedding: embedding.embedding,
            products,
        })
    }

    /// Provide a streaming view over the recommendation reply.
    pub async fn chat_recommend_products_stream(
        &self,
        tenant_id: &str,
        request: ProductChatRequest,
    ) -> AppResult<impl Stream<Item = String>> {
        let context = self.prepare_chat_context(tenant_id, &request).await?;
        let client = self.build_llm_client()?;
        let api_key = self.llm_api_key()?;
        let url = self.chat_completion_url();

        #[derive(Serialize)]
        struct StreamPayload<'a> {
            model: &'a str,
            messages: &'a [ChatCompletionMessage],
            temperature: f32,
            stream: bool,
        }

        let payload = StreamPayload {
            model: &context.completion_model,
            messages: &context.messages,
            temperature: 0.2,
            stream: true,
        };

        let response = client
            .post(url)
            .bearer_auth(&api_key)
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "LLM streaming request failed (status {}): {}",
                status, body
            )));
        }

        let mut stream = response.bytes_stream();
        let (tx, rx) = mpsc::channel(32);
        let repo = self.product_repo.clone();
        let tenant = tenant_id.to_string();
        let request_clone = request.clone();
        let context_clone = context.clone();

        tokio::spawn(async move {
            let metadata_event = json!({
                "type": "metadata",
                "conversationId": context_clone.conversation_id.clone(),
                "model": context_clone.completion_model.clone(),
                "embeddingModel": context_clone.embedding.model.clone(),
                "queryEmbedding": context_clone.embedding.embedding.clone(),
                "products": context_clone.products.clone(),
            })
            .to_string();

            if tx.send(metadata_event).await.is_err() {
                return;
            }

            let mut aggregated = String::new();
            let mut buffer = String::new();

            while let Some(chunk_result) = stream.next().await {
                match chunk_result {
                    Ok(bytes) => {
                        buffer.push_str(&String::from_utf8_lossy(&bytes));
                        while let Some(idx) = buffer.find("\n\n") {
                            let raw = buffer[..idx].to_string();
                            buffer.drain(..idx + 2);
                            for line in raw.lines() {
                                let Some(data) = line.strip_prefix("data: ") else {
                                    continue;
                                };
                                if data.trim() == "[DONE]" {
                                    let done_event = json!({"type": "done"}).to_string();
                                    let _ = tx.send(done_event).await;
                                    let records = Self::build_chat_records(
                                        &tenant,
                                        &request_clone,
                                        &context_clone,
                                        Some(aggregated.as_str()),
                                    );
                                    if let Err(err) = repo.insert_chat_messages(&records).await {
                                        warn!("failed to persist chat transcript: {}", err);
                                    }
                                    return;
                                }
                                match serde_json::from_str::<OpenAiStreamResponse>(data) {
                                    Ok(payload) => {
                                        if let Some(delta) =
                                            payload.choices.first().and_then(|c| c.delta.as_ref())
                                        {
                                            if let Some(content) = &delta.content {
                                                aggregated.push_str(content);
                                                let event = json!({
                                                    "type": "delta",
                                                    "content": content,
                                                })
                                                .to_string();
                                                if tx.send(event).await.is_err() {
                                                    return;
                                                }
                                            }
                                        }
                                    }
                                    Err(err) => {
                                        let warn_event = json!({
                                            "type": "error",
                                            "message": format!(
                                                "Failed to parse stream chunk: {}",
                                                err
                                            ),
                                        })
                                        .to_string();
                                        if tx.send(warn_event).await.is_err() {
                                            return;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(err) => {
                        let _ = tx
                            .send(
                                json!({
                                    "type": "error",
                                    "message": format!("Stream error: {}", err),
                                })
                                .to_string(),
                            )
                            .await;
                        let records = if aggregated.is_empty() {
                            Self::build_chat_records(&tenant, &request_clone, &context_clone, None)
                        } else {
                            Self::build_chat_records(
                                &tenant,
                                &request_clone,
                                &context_clone,
                                Some(aggregated.as_str()),
                            )
                        };
                        if let Err(err) = repo.insert_chat_messages(&records).await {
                            warn!("failed to persist chat transcript: {}", err);
                        }
                        return;
                    }
                }
            }

            let _ = tx.send(json!({"type": "done"}).to_string()).await;
            let records = Self::build_chat_records(
                &tenant,
                &request_clone,
                &context_clone,
                Some(aggregated.as_str()),
            );
            if let Err(err) = repo.insert_chat_messages(&records).await {
                warn!("failed to persist chat transcript: {}", err);
            }
        });

        Ok(ReceiverStream::new(rx))
    }

    /// Synchronise products into the Qdrant vector store and emit MCP ready
    /// payloads that can be consumed by downstream tools.
    pub async fn sync_products_to_vector(
        &self,
        tenant_id: &str,
        request: UnifiedProductSyncRequest,
    ) -> AppResult<UnifiedSyncResult> {
        let products = self
            .product_repo
            .list_products(
                tenant_id,
                &request.platform,
                &request.shop_id,
                1,
                request.limit.unwrap_or(50) as u32,
            )
            .await?;

        if products.is_empty() {
            return Ok(UnifiedSyncResult {
                synced: 0,
                vectors: Vec::new(),
                platform: request.platform,
                shop_id: request.shop_id,
            });
        }

        let vector_repo = self.build_vector_repository()?;
        let mut vectors = Vec::new();
        for product in products {
            let combined_text = format!(
                "{}\n{}",
                product.title,
                product.description.clone().unwrap_or_default()
            );
            let embedding = self.embed_text(&combined_text, request.model.as_deref())?;

            let metadata = json!({
                "product_id": product.product_id,
                "shop_id": product.shop_id,
                "platform": request.platform,
                "title": product.title,
                "currency": product.currency,
                "price": product.price.amount,
                "synced_at": chrono::Utc::now().to_rfc3339(),
            });

            vector_repo
                .upsert_vector(
                    &self.collection_name(&request.platform, &embedding.model),
                    &product.product_id,
                    &embedding.embedding,
                    &metadata,
                )
                .await?;

            vectors.push(McpProductVector {
                product_id: product.product_id,
                platform: request.platform.clone(),
                shop_id: request.shop_id.clone(),
                vector: embedding.embedding,
                metadata,
            });
        }

        Ok(UnifiedSyncResult {
            synced: vectors.len(),
            vectors,
            platform: request.platform,
            shop_id: request.shop_id,
        })
    }

    fn build_vector_repository(&self) -> AppResult<Arc<dyn VectorRepository>> {
        let config = &self.state.config.qdrant;
        let mut builder = Qdrant::from_url(&config.url);
        if let Some(api_key) = &config.api_key {
            builder = builder.api_key(api_key.clone());
        }
        let client = builder.build().map_err(|err| {
            AppError::ExternalServiceError(format!("failed to initialise Qdrant client: {}", err))
        })?;
        let repo = QdrantRepository::new(Arc::new(client), config.collection_prefix.clone());
        Ok(Arc::new(repo))
    }

    fn collection_name(&self, platform: &str, model: &str) -> String {
        let normalised_model = model.replace(['-', '.'], "_");
        format!("{}_{}", platform, normalised_model)
    }

    fn summarise_attachments(&self, attachments: &[AttachmentPayload]) -> Vec<AttachmentSummary> {
        attachments
            .iter()
            .map(|payload| {
                let mut preview_text = String::new();
                let mut bytes = Vec::new();
                if let Some(data) = &payload.data_base64 {
                    if let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(data) {
                        let snippet_len = decoded.len().min(120);
                        let preview = &decoded[..snippet_len];
                        preview_text = String::from_utf8_lossy(preview).to_string();
                        bytes = decoded;
                    }
                }

                AttachmentSummary {
                    filename: payload
                        .filename
                        .clone()
                        .unwrap_or_else(|| "attachment".to_string()),
                    mime_type: payload.mime_type.clone().unwrap_or_default(),
                    size_bytes: bytes.len() as u64,
                    preview: preview_text,
                    source_url: payload.source_url.clone(),
                }
            })
            .collect()
    }

    fn fill_schema(
        &self,
        schema: &Value,
        transcript: &str,
        attachments: &[AttachmentSummary],
    ) -> Value {
        match schema.get("type").and_then(|v| v.as_str()) {
            Some("object") => {
                let mut map = serde_json::Map::new();
                if let Some(properties) = schema.get("properties").and_then(|v| v.as_object()) {
                    for (key, property_schema) in properties {
                        map.insert(
                            key.clone(),
                            self.fill_schema(property_schema, transcript, attachments),
                        );
                    }
                }
                Value::Object(map)
            }
            Some("array") => {
                if let Some(items_schema) = schema.get("items") {
                    let item = self.fill_schema(items_schema, transcript, attachments);
                    Value::Array(vec![item])
                } else {
                    Value::Array(vec![])
                }
            }
            Some("number") => Value::Number(serde_json::Number::from(transcript.len() as u64)),
            Some("integer") => Value::Number((attachments.len() as u64).into()),
            Some("boolean") => Value::Bool(!attachments.is_empty()),
            _ => Value::String(transcript.trim().to_string()),
        }
    }
}
