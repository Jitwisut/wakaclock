use std::sync::Arc;

use anyhow::{anyhow, Result};
use chrono::Utc;
use serde_json::json;
use tracing::info;

use crate::{
    config::IngestionConfig,
    infrastructure::{cache::CacheManager, logger::Logger, queue::MessageQueue},
    model::ingestion::{ProductBatchItem, ProductBatchMessage},
    AppState,
};

/// Service responsible for webhook ingestion orchestration (idempotency + enqueue).
pub struct ProductIngestionService {
    cache: Arc<dyn CacheManager>,
    queue: Arc<dyn MessageQueue>,
    logger: Arc<Logger>,
    config: IngestionConfig,
}

impl ProductIngestionService {
    pub fn new(state: Arc<AppState>) -> Self {
        Self {
            cache: state.cache.clone(),
            queue: state.queue.clone(),
            logger: state.logger.clone(),
            config: state.config.ingestion.clone(),
        }
    }

    fn cache_key(&self, tenant_id: &str, idempotency_key: &str, body_hash: &str) -> String {
        format!(
            "ingest:idempotency:{}:{}:{}",
            tenant_id, idempotency_key, body_hash
        )
    }

    pub async fn check_or_store_idempotency(
        &self,
        tenant_id: &str,
        idempotency_key: &str,
        body_hash: &str,
        job_id: &str,
    ) -> Result<Option<String>> {
        let key = self.cache_key(tenant_id, idempotency_key, body_hash);

        if let Some(existing) = self.cache.get_bytes(&key).await? {
            let existing_id = String::from_utf8(existing)?;
            self.logger.debug(
                &format!(
                    "duplicate webhook batch detected for tenant={} idempotency_key={}",
                    tenant_id, idempotency_key
                ),
                None,
            );
            return Ok(Some(existing_id));
        }

        self.cache
            .set_bytes(
                &key,
                job_id.as_bytes().to_vec(),
                Some(self.config.webhook_idempotency_ttl_secs),
            )
            .await?;

        Ok(None)
    }

    pub async fn enqueue_webhook_batch(&self, message: &ProductBatchMessage) -> Result<()> {
        let payload = serde_json::to_vec(message)?;
        self.queue
            .publish_bytes(&self.config.webhook_queue_routing_key, payload)
            .await?;
        info!(job_id = %message.job_id, batch_size = message.items.len(), "published webhook batch to queue");
        Ok(())
    }

    pub fn build_queue_message(
        &self,
        job_id: String,
        tenant_id: String,
        idempotency_key: String,
        body_hash: String,
        mut items: Vec<ProductBatchItem>,
    ) -> ProductBatchMessage {
        let dedupe_key = format!("{}:{}", idempotency_key, body_hash);
        for item in &mut items {
            item.job_id = Some(job_id.clone());
            item.idempotency_key = Some(idempotency_key.clone());
            item.body_hash = Some(body_hash.clone());
        }

        ProductBatchMessage {
            job_id,
            tenant_id,
            dedupe_key,
            items,
            received_at: Utc::now(),
        }
    }

    fn secrets_cache_key(&self, tenant_id: &str) -> String {
        format!("webhook:tenant:{}:whsec", tenant_id)
    }

    async fn cached_secrets(&self, tenant_id: &str) -> Result<Option<Vec<String>>> {
        let key = self.secrets_cache_key(tenant_id);
        if let Some(value) = self.cache.get_json(&key).await? {
            if let Some(array) = value.as_array() {
                let secrets: Vec<String> = array
                    .iter()
                    .filter_map(|entry| entry.as_str().map(|s| s.to_string()))
                    .collect();
                if !secrets.is_empty() {
                    return Ok(Some(secrets));
                }
            } else if let Some(secret) = value.as_str() {
                return Ok(Some(vec![secret.to_string()]));
            }
        }
        Ok(None)
    }

    async fn persist_secrets(&self, tenant_id: &str, secrets: &[String]) -> Result<()> {
        let key = self.secrets_cache_key(tenant_id);
        self.cache
            .set_json(&key, json!(secrets), None)
            .await
            .map_err(|err| anyhow!("failed to persist webhook secrets: {err}"))
    }

    pub async fn lookup_shared_secrets(&self, tenant_id: &str) -> Result<Vec<String>> {
        if let Some(secrets) = self.cached_secrets(tenant_id).await? {
            return Ok(secrets);
        }

        let fallback = self
            .config
            .webhook_shared_secrets
            .get(tenant_id)
            .cloned()
            .or_else(|| self.config.webhook_shared_secrets.get("default").cloned());

        if let Some(secrets) = fallback {
            let _ = self.persist_secrets(tenant_id, &secrets).await;
            return Ok(secrets);
        }

        Err(anyhow!(
            "unknown tenant '{}': no webhook secret configured",
            tenant_id
        ))
    }
}
