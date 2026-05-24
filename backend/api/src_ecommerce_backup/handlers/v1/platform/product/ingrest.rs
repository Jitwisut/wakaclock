//! Inbound product ingestion handler (partners call us).
//!
//! This endpoint differentiates inbound flows from outbound platform
//! webhooks: outbound webhooks are managed under
//! `/api/v1/platform/webhook/*`, whereas inbound marketplace pushes now
//! live under `/api/v1/platform/products/:app/ingrest`.
use std::sync::Arc;

use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use chrono::{DateTime, Utc};
use hmac::{Hmac, Mac};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tracing::warn;
use uuid::Uuid;

use crate::{
    model::error::{AppError, AppResult},
    model::ingestion::{IngestionSource, InventoryStatus, Marketplace, ProductBatchItem},
    services::product_ingest::ProductIngestionService,
    AppState,
};

type HmacSha256 = Hmac<Sha256>;

/// Register inbound ingestion routes (`/products/:app/ingrest`).
pub(super) fn ingrest_routes() -> Router<Arc<AppState>> {
    Router::new().route("/:app/ingrest", post(handle_product_ingrest))
}

#[derive(Debug, Deserialize)]
struct AppPath {
    app: String,
}

#[derive(Debug, Clone, Deserialize)]
struct ProductIngrestPayload {
    marketplace: Marketplace,
    #[serde(default)]
    sku: Option<String>,
    #[serde(default)]
    idea_key: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    brand: Option<String>,
    #[serde(default)]
    price_amount: Option<Decimal>,
    #[serde(default)]
    price_currency: Option<String>,
    #[serde(default)]
    inventory_quantity: Option<i32>,
    #[serde(default)]
    inventory_status: Option<InventoryStatus>,
    #[serde(default)]
    images: Vec<String>,
    #[serde(default = "empty_object")]
    attributes: Value,
    #[serde(default)]
    version_ts: Option<DateTime<Utc>>,
}

impl From<ProductIngrestPayload> for ProductBatchItem {
    fn from(payload: ProductIngrestPayload) -> Self {
        Self {
            marketplace: payload.marketplace,
            sku: payload.sku,
            idea_key: payload.idea_key,
            url: payload.url,
            title: payload.title,
            brand: payload.brand,
            price_amount: payload.price_amount,
            price_currency: payload.price_currency,
            inventory_quantity: payload.inventory_quantity,
            inventory_status: payload.inventory_status,
            images: payload.images,
            attributes: payload.attributes,
            version_ts: payload.version_ts.unwrap_or_else(Utc::now),
            source: IngestionSource::Webhook,
            job_id: None,
            batch_id: None,
            idempotency_key: None,
            body_hash: None,
        }
    }
}

#[derive(Debug, Serialize)]
struct ProductIngrestResponse {
    job_id: String,
    tenant_id: String,
    received: usize,
    duplicate: bool,
    status: &'static str,
}

fn empty_object() -> Value {
    Value::Object(Default::default())
}

fn header_str<'a>(headers: &'a HeaderMap, key: &str) -> AppResult<&'a str> {
    headers
        .get(key)
        .ok_or_else(|| AppError::BadRequest(format!("Missing {key} header")))
        .and_then(|value| {
            value
                .to_str()
                .map_err(|_| AppError::BadRequest(format!("Invalid {key} header encoding")))
        })
}

fn hmac_signature(secret: &str, payload: &[u8]) -> Result<String, AppError> {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|err| AppError::InternalError(format!("Failed to init HMAC: {err}")))?;
    mac.update(payload);
    Ok(hex::encode(mac.finalize().into_bytes()))
}

fn signature_matches(secret: &str, payload: &[u8], provided: &str) -> bool {
    let expected = match hmac_signature(secret, payload) {
        Ok(sig) => sig,
        Err(err) => {
            warn!(error = %err, "unable to compute ingestion signature");
            return false;
        }
    };
    let expected_bytes = expected.as_bytes();
    let provided_clean = provided.strip_prefix("sha256=").unwrap_or(provided).trim();
    use subtle::ConstantTimeEq;
    expected_bytes.ct_eq(provided_clean.as_bytes()).into()
}

fn body_sha256(payload: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(payload);
    hex::encode(hasher.finalize())
}

async fn handle_product_ingrest(
    Path(AppPath { app: _app }): Path<AppPath>,
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> AppResult<impl IntoResponse> {
    let ingestion_service = ProductIngestionService::new(state.clone());
    let config = &state.config.ingestion;

    if body.len() > config.webhook_max_body_bytes {
        return Err(AppError::BadRequest(format!(
            "Request body exceeds {} bytes limit",
            config.webhook_max_body_bytes
        )));
    }

    let tenant_id = header_str(&headers, "x-tenant-id")?;
    let idempotency_key = header_str(&headers, "idempotency-key")?;
    let signature = header_str(&headers, "x-signature")?;

    let secrets = ingestion_service
        .lookup_shared_secrets(tenant_id)
        .await
        .map_err(|_| {
            AppError::Unauthorized(format!(
                "Unknown tenant '{tenant_id}' for product ingestion"
            ))
        })?;

    let signature_valid = secrets
        .iter()
        .any(|secret| signature_matches(secret, &body, signature));

    if !signature_valid {
        return Err(AppError::Unauthorized(
            "Invalid ingestion signature".to_string(),
        ));
    }

    let payload: Vec<ProductIngrestPayload> = serde_json::from_slice(&body)
        .map_err(|err| AppError::BadRequest(format!("Invalid JSON payload: {err}")))?;

    if payload.is_empty() {
        return Err(AppError::BadRequest(
            "Payload must contain at least one item".to_string(),
        ));
    }

    if payload.len() > config.webhook_max_batch_items {
        return Err(AppError::BadRequest(format!(
            "Payload contains {} items, exceeding the {} limit",
            payload.len(),
            config.webhook_max_batch_items
        )));
    }

    let items: Vec<ProductBatchItem> = payload.into_iter().map(ProductBatchItem::from).collect();

    let body_hash = body_sha256(&body);
    let job_id = Uuid::new_v4().to_string();

    if let Some(existing_job) = ingestion_service
        .check_or_store_idempotency(tenant_id, idempotency_key, &body_hash, &job_id)
        .await
        .map_err(|err| {
            AppError::InternalError(format!("Failed to persist idempotency key: {err}"))
        })?
    {
        let response = ProductIngrestResponse {
            job_id: existing_job,
            tenant_id: tenant_id.to_string(),
            received: 0,
            duplicate: true,
            status: "duplicate",
        };
        return Ok((StatusCode::ACCEPTED, Json(response)));
    }

    let message = ingestion_service.build_queue_message(
        job_id.clone(),
        tenant_id.to_string(),
        idempotency_key.to_string(),
        body_hash,
        items,
    );

    ingestion_service
        .enqueue_webhook_batch(&message)
        .await
        .map_err(|err| {
            AppError::InternalError(format!("Failed to enqueue product ingestion batch: {err}"))
        })?;

    let response = ProductIngrestResponse {
        job_id,
        tenant_id: tenant_id.to_string(),
        received: message.items.len(),
        duplicate: false,
        status: "accepted",
    };

    Ok((StatusCode::ACCEPTED, Json(response)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_payload_into_batch_item() {
        let payload = ProductIngrestPayload {
            marketplace: Marketplace::Shopee,
            sku: Some("SKU-123".to_string()),
            idea_key: None,
            url: Some("https://example.com/item".to_string()),
            title: Some("Demo".to_string()),
            brand: Some("ACME".to_string()),
            price_amount: Some(Decimal::new(1999, 2)),
            price_currency: Some("THB".to_string()),
            inventory_quantity: Some(10),
            inventory_status: Some(InventoryStatus::InStock),
            images: vec!["https://img.example.com/sku.jpg".to_string()],
            attributes: empty_object(),
            version_ts: None,
        };

        let item: ProductBatchItem = payload.into();
        assert_eq!(item.marketplace, Marketplace::Shopee);
        assert_eq!(item.sku.as_deref(), Some("SKU-123"));
        assert_eq!(item.source, IngestionSource::Webhook);
    }

    #[test]
    fn signature_helper_matches() {
        let secret = "topsecret";
        let body = br#"{"foo":"bar"}"#;
        let sig = hmac_signature(secret, body).unwrap();
        assert!(signature_matches(secret, body, &sig));
        assert!(signature_matches(secret, body, &format!("sha256={sig}")));
        assert!(!signature_matches(secret, br#"{"foo":"baz"}"#, &sig));
    }
}
