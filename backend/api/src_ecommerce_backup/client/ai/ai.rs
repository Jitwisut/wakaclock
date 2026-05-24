//! Gateway AI HTTP handlers.
//!
//! The functions in this module expose the AI orchestration capabilities via
//! Axum handlers. They delegate to `AiService` for the heavy lifting so that
//! the HTTP layer remains thin.

use std::{convert::Infallible, sync::Arc};

use axum::{
    extract::State,
    response::sse::{Event, KeepAlive, Sse},
    Extension, Json,
};
use futures::{Stream, StreamExt};
use serde_json::json;

use crate::{
    model::{
        error::AppResult,
        v1::{
            gateway::{
                request::ai::{
                    CompletionRequestPayload, EmbeddingRequestPayload, ProductChatRequest,
                    UnifiedProductSyncRequest,
                },
                response::ai::{
                    CompletionResponsePayload, EmbeddingResponsePayload, ProductChatResponse,
                    UnifiedSyncResult,
                },
            },
            platfrom::entries::AuthClaims,
        },
    },
    services::ai::AiService,
    AppState,
};

/// Generate deterministic embeddings for the supplied payload.
pub async fn embedding(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<AuthClaims>,
    Json(request): Json<EmbeddingRequestPayload>,
) -> AppResult<Json<EmbeddingResponsePayload>> {
    let service = AiService::new(state);
    let response = service.embed_text(&request.text, request.model.as_deref())?;
    Ok(Json(response))
}

/// Produce a structured completion that adheres to a JSON schema.
pub async fn completion(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<AuthClaims>,
    Json(request): Json<CompletionRequestPayload>,
) -> AppResult<Json<CompletionResponsePayload>> {
    let service = AiService::new(state);
    let response = service.completion(request)?;
    Ok(Json(response))
}

/// Trigger a unified product sync and return MCP ready payloads.
pub async fn sync_products(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Json(request): Json<UnifiedProductSyncRequest>,
) -> AppResult<Json<UnifiedSyncResult>> {
    let tenant_id = claims
        .org_id
        .clone()
        .unwrap_or_else(|| "default-tenant".to_string());
    let service = AiService::new(state);
    let response = service.sync_products_to_vector(&tenant_id, request).await?;
    Ok(Json(response))
}

/// Generate a chat oriented product recommendation response.
pub async fn chat_products(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Json(request): Json<ProductChatRequest>,
) -> AppResult<Json<ProductChatResponse>> {
    let tenant_id = claims
        .org_id
        .clone()
        .unwrap_or_else(|| "default-tenant".to_string());
    let service = AiService::new(state);
    let response = service.chat_recommend_products(&tenant_id, request).await?;
    Ok(Json(response))
}

/// Stream chat replies chunk by chunk for a richer UX.
pub async fn chat_products_stream(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Json(request): Json<ProductChatRequest>,
) -> AppResult<Sse<impl Stream<Item = Result<Event, Infallible>>>> {
    let tenant_id = claims
        .org_id
        .clone()
        .unwrap_or_else(|| "default-tenant".to_string());
    let service = AiService::new(state);
    let stream = service
        .chat_recommend_products_stream(&tenant_id, request)
        .await?;

    let mapped = stream.map(|chunk| {
        Ok(Event::default()
            .data(json!({ "chunk": chunk }).to_string())
            .event("message"))
    });

    Ok(Sse::new(mapped).keep_alive(KeepAlive::default()))
}
