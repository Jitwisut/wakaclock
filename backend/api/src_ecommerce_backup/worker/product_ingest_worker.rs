use std::sync::Arc;

use anyhow::{anyhow, Context, Result};
use async_trait::async_trait;
use tracing::{error, info};

use crate::{
    model::{
        error::{AppError, AppResult},
        ingestion::{ProductBatchMessage, ProductCurrentRow, ProductEventRow},
    },
    worker::{resolve_binding, QueueBinding, Worker},
    AppState,
};

/// Worker responsible for consuming webhook product batches and persisting them to ClickHouse.
pub struct ProductIngestWorker {
    state: Arc<AppState>,
    consumer_name: String,
}

impl ProductIngestWorker {
    pub fn new(state: Arc<AppState>, consumer_name: impl Into<String>) -> Self {
        Self {
            state,
            consumer_name: consumer_name.into(),
        }
    }

    async fn setup_subscription(&self) -> Result<()> {
        let queue = self.state.queue.clone();
        let routing_key = self
            .state
            .config
            .ingestion
            .webhook_queue_routing_key
            .clone();

        let binding = resolve_binding(
            "CONSUMER_WEBHOOK",
            QueueBinding::new("product_ingest", &self.consumer_name, &routing_key),
        );

        queue
            .create_durable_consumer(&binding.stream, &binding.consumer, &binding.routing_key)
            .await?;

        let state = self.state.clone();
        queue
            .subscribe_bytes(
                &binding.routing_key,
                Box::new(move |payload| {
                    let state = state.clone();
                    tokio::task::block_in_place(|| {
                        tokio::runtime::Handle::current().block_on(async move {
                            if let Err(err) = process_payload(state, payload).await {
                                error!("product ingest worker failed: {err:?}");
                                return Err(err);
                            }
                            Ok(())
                        })
                    })
                }),
            )
            .await?;

        info!(
            consumer = %binding.consumer,
            subject = %binding.routing_key,
            "product ingest worker subscribed"
        );
        Ok(())
    }
}

#[async_trait]
impl Worker for ProductIngestWorker {
    async fn start(&self) -> AppResult<()> {
        self.setup_subscription()
            .await
            .map_err(|e| AppError::QueueError(e.to_string()))?;

        tokio::signal::ctrl_c()
            .await
            .map_err(|e| AppError::InternalError(e.to_string()))?;

        Ok(())
    }

    async fn stop(&self) -> AppResult<()> {
        Ok(())
    }

    async fn process_job(&self, _job_data: Vec<u8>) -> AppResult<()> {
        Ok(())
    }
}

async fn process_payload(state: Arc<AppState>, payload: Vec<u8>) -> Result<()> {
    let message: ProductBatchMessage =
        serde_json::from_slice(&payload).context("failed to deserialize ProductBatchMessage")?;

    if message.items.is_empty() {
        return Err(anyhow!("ingest batch contains no items"));
    }

    let repo = state.product_ingestion_repository();
    let events: Vec<ProductEventRow> = message
        .items
        .iter()
        .map(ProductEventRow::from_item)
        .collect();
    let snapshots: Vec<ProductCurrentRow> = message
        .items
        .iter()
        .map(ProductCurrentRow::from_item)
        .collect();

    repo.persist_batch(&events, &snapshots)
        .await
        .context("failed to persist batch to ClickHouse")?;

    info!(job_id = %message.job_id, tenant_id = %message.tenant_id, count = events.len(), "persisted webhook batch");
    Ok(())
}
