use chrono::{DateTime, Utc};
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, instrument};
use uuid::Uuid;

use crate::{
    client::{
        database::clickhouse::ClickHouseClient,
        ecommerce::connector::{ConnectContext, StateEnvelope, StateFlavor},
    },
    infrastructure::{
        cache::Cache,
        queue::{jetstream_config::SubjectBuilder, MessageQueue},
        sync::{RunState, RunStatus, RunStatusKey, SyncConfig, SyncStateManager},
    },
    model::v1::{
        platfrom::entries::product_sync::messages::{
            ListRequestMessage, PaginationMode, ProgressEventMessage, ProgressPhase, Synccheckpint,
        },
        platfrom::entries::{AppError, AppResult},
    },
    services::{
        backpressure_manager::BackpressureManager, dlq_manager::DlqManager,
        progress_tracker::ProgressTracker,
    },
};
use serde_json::json;

/// Product sync coordinator service
/// Orchestrates the entire product synchronization pipeline
pub struct ProductSyncCoordinator {
    #[allow(dead_code)]
    clickhouse: Arc<ClickHouseClient>,
    cache: Arc<dyn Cache>,
    queue: Arc<dyn MessageQueue>,
    state_manager: Arc<dyn SyncStateManager>,
    backpressure_manager: Arc<BackpressureManager>,
    #[allow(dead_code)]
    progress_tracker: Arc<ProgressTracker>,
    #[allow(dead_code)]
    dlq_manager: Arc<DlqManager>,
    config: SyncConfig,
}

impl ProductSyncCoordinator {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        clickhouse: Arc<ClickHouseClient>,
        cache: Arc<dyn Cache>,
        queue: Arc<dyn MessageQueue>,
        state_manager: Arc<dyn SyncStateManager>,
        backpressure_manager: Arc<BackpressureManager>,
        progress_tracker: Arc<ProgressTracker>,
        dlq_manager: Arc<DlqManager>,
        config: Option<SyncConfig>,
    ) -> Self {
        Self {
            clickhouse,
            cache,
            queue,
            state_manager,
            backpressure_manager,
            progress_tracker,
            dlq_manager,
            config: config.unwrap_or_default(),
        }
    }

    /// Initiate a product sync job
    #[instrument(skip(self, credentials))]
    pub async fn start_sync(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        sync_type: &str,
        checkpint: Synccheckpint,
        credentials: serde_json::Value,
    ) -> AppResult<String> {
        let run_id = Uuid::new_v4().to_string();
        let worker_id = format!("worker_{}", std::process::id());

        let mut sync_ctx = ConnectContext::new(
            platform.to_string(),
            tenant_id.to_string(),
            shop_id.to_string(),
            run_id.clone(),
        );
        sync_ctx.insert_metadata("sync_type", json!(sync_type));
        sync_ctx.insert_metadata("checkpoint_lower", json!(checkpint.lower_inclusive));
        sync_ctx.insert_metadata("checkpoint_upper", json!(checkpint.upper_exclusive));
        let connect_state_token =
            StateEnvelope::from_context(&sync_ctx, StateFlavor::Base64Json)?.token;

        info!(
            "Starting sync job: tenant={}, platform={}, shop={}, type={}, run_id={}",
            tenant_id, platform, shop_id, sync_type, run_id
        );

        // Try to acquire lock
        let lock_key = self.build_lock_key(tenant_id, platform, shop_id);
        let lock_token = Uuid::new_v4().to_string();

        if !self
            .state_manager
            .acquire_lock(&lock_key, &lock_token, self.config.lock_ttl_ms)
            .await?
        {
            return Err(AppError::ConflictError(
                "Another sync is already running for this shop".to_string(),
            ));
        }

        // Initialize run status
        let run_status = RunStatus {
            state: RunState::Running,
            run_id: run_id.clone(),
            worker_id,
            lower_ts: Some(checkpint.lower_inclusive.to_rfc3339()),
            upper_ts: Some(checkpint.upper_exclusive.to_rfc3339()),
            page_seq: 0,
            current_cursor: None,
            current_offset: None,
            items_total: 0,
            items_list_only: 0,
            items_detail_enqueued: 0,
            items_detail_skipped: 0,
            lag_detail_consumer: 0,
            backoff_seconds: 0,
            started_at: chrono::Utc::now().timestamp_millis() as u64,
            updated_at: chrono::Utc::now().timestamp_millis() as u64,
            heartbeat_ts: chrono::Utc::now().timestamp_millis() as u64,
            last_error_code: None,
            last_error_msg: None,
        };

        let run_key = RunStatusKey {
            tenant: tenant_id.to_string(),
            platform: platform.to_string(),
            shop: shop_id.to_string(),
        };

        self.state_manager
            .update_run_status(&run_key, &run_status)
            .await?;

        // Create initial list request message
        let list_request = ListRequestMessage {
            tenant_id: tenant_id.to_string(),
            platform: platform.to_string(),
            shop_id: shop_id.to_string(),
            sync_type: sync_type.to_string(),
            checkpint,
            pagination_mode: self.get_platform_pagination_mode(platform),
            backfill: false,
            trace_id: run_id.clone(),
            credentials: serde_json::from_value(credentials)
                .map_err(|e| AppError::ValidationError(format!("Invalid credentials: {}", e)))?,
            page_token: None,
            cursor: None,
            offset: None,
            batch_id: Some(run_id.clone()),
            page_seq: Some(0),
            connect_state: Some(connect_state_token.clone()),
        };

        // Publish to list queue
        let subject = SubjectBuilder::list_request(tenant_id, platform);
        let message_id = format!("{}|{}|{}|{}", tenant_id, platform, shop_id, run_id);

        // Publish to list queue with deduplication ID in message
        let message_with_id = list_request.clone();
        if let Ok(val) = serde_json::to_value(&message_with_id) {
            if let Some(mut obj) = val.as_object().cloned() {
                obj.insert(
                    "queue_msg_id".to_string(),
                    serde_json::Value::String(message_id),
                );
                let payload = serde_json::to_vec(&obj)?;
                self.queue.publish_bytes(&subject, payload).await?;
            } else {
                self.queue
                    .publish_bytes(&subject, serde_json::to_vec(&list_request)?)
                    .await?;
            }
        } else {
            self.queue
                .publish_bytes(&subject, serde_json::to_vec(&list_request)?)
                .await?;
        }

        // Start background heartbeat task
        let state_manager = self.state_manager.clone();
        let run_key_clone = run_key.clone();
        let lock_key_clone = lock_key.clone();
        let lock_token_clone = lock_token.clone();
        let lock_ttl_ms = self.config.lock_ttl_ms;
        let heartbeat_interval = self.config.heartbeat_interval_secs;

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(heartbeat_interval));
            loop {
                interval.tick().await;

                // Renew lock
                if let Err(e) = state_manager
                    .renew_lock(&lock_key_clone, &lock_token_clone, lock_ttl_ms)
                    .await
                {
                    error!("Failed to renew lock: {:?}", e);
                    break;
                }

                // Update heartbeat
                if let Ok(Some(mut status)) = state_manager.get_run_status(&run_key_clone).await {
                    status.heartbeat_ts = chrono::Utc::now().timestamp_millis() as u64;
                    status.updated_at = chrono::Utc::now().timestamp_millis() as u64;

                    if let Err(e) = state_manager
                        .update_run_status(&run_key_clone, &status)
                        .await
                    {
                        error!("Failed to update heartbeat: {:?}", e);
                        break;
                    }
                }
            }
        });

        info!("Sync job started successfully: {}", run_id);
        Ok(run_id)
    }

    /// Stop a running sync job
    #[instrument(skip(self))]
    pub async fn stop_sync(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        reason: Option<String>,
    ) -> AppResult<()> {
        let run_key = RunStatusKey {
            tenant: tenant_id.to_string(),
            platform: platform.to_string(),
            shop: shop_id.to_string(),
        };

        // Get current status
        let mut status = self
            .state_manager
            .get_run_status(&run_key)
            .await?
            .ok_or_else(|| AppError::NotFound("No active sync found".to_string()))?;

        // Update status to paused
        status.state = RunState::Paused;
        status.last_error_msg = reason.clone();
        status.updated_at = chrono::Utc::now().timestamp_millis() as u64;

        self.state_manager
            .update_run_status(&run_key, &status)
            .await?;

        // Release lock
        let lock_key = self.build_lock_key(tenant_id, platform, shop_id);
        self.state_manager
            .release_lock(&lock_key, &status.worker_id)
            .await?;

        info!(
            "Sync stopped for {}/{}/{}: {:?}",
            tenant_id, platform, shop_id, reason
        );

        Ok(())
    }

    /// Get sync status
    #[instrument(skip(self))]
    pub async fn get_sync_status(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
    ) -> AppResult<Option<SyncStatusResponse>> {
        let run_key = RunStatusKey {
            tenant: tenant_id.to_string(),
            platform: platform.to_string(),
            shop: shop_id.to_string(),
        };

        let status = self.state_manager.get_run_status(&run_key).await?;

        if let Some(status) = status {
            Ok(Some(SyncStatusResponse::from_run_status(status)))
        } else {
            Ok(None)
        }
    }

    /// Handle sync completion
    #[instrument(skip(self))]
    pub async fn complete_sync(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        run_id: &str,
        success: bool,
        error: Option<String>,
    ) -> AppResult<()> {
        let run_key = RunStatusKey {
            tenant: tenant_id.to_string(),
            platform: platform.to_string(),
            shop: shop_id.to_string(),
        };

        // Get current status
        let mut status = self
            .state_manager
            .get_run_status(&run_key)
            .await?
            .ok_or_else(|| AppError::NotFound("Sync not found".to_string()))?;

        // Update final status
        status.state = if success {
            RunState::Idle
        } else {
            RunState::Error
        };
        status.last_error_msg = error.clone();
        status.updated_at = chrono::Utc::now().timestamp_millis() as u64;

        self.state_manager
            .update_run_status(&run_key, &status)
            .await?;

        // Save to last_success if successful
        if success {
            let last_success_key =
                format!("sync:last_success:{}:{}:{}", tenant_id, platform, shop_id);
            self.cache
                .set_bytes(&last_success_key, serde_json::to_vec(&status)?, None)
                .await?;
        }

        // Release lock
        let lock_key = self.build_lock_key(tenant_id, platform, shop_id);
        self.state_manager
            .release_lock(&lock_key, &status.worker_id)
            .await?;

        // Emit completion event
        let progress_event = if success {
            ProgressEventMessage {
                tenant_id: tenant_id.to_string(),
                platform: platform.to_string(),
                shop_id: shop_id.to_string(),
                phase: ProgressPhase::SyncCompleted,
                trace_id: run_id.to_string(),
                page_seq: Some(status.page_seq),
                items_emitted: None,
                items_processed: Some(status.items_total as u32),
                items_failed: None,
                next_page: None,
                has_more_pages: Some(false),
                lag_detail_consumer: Some(status.lag_detail_consumer),
                processing_time_ms: Some(status.updated_at - status.started_at),
                throughput_items_per_sec: None,
                error_message: None,
                error_code: None,
                timestamp: Utc::now(),
            }
        } else {
            ProgressEventMessage::sync_failed(
                tenant_id.to_string(),
                platform.to_string(),
                shop_id.to_string(),
                run_id.to_string(),
                error.unwrap_or_else(|| "Unknown error".to_string()),
                None,
            )
        };

        let subject = SubjectBuilder::list_progress(tenant_id, platform);
        self.queue
            .publish_bytes(&subject, serde_json::to_vec(&progress_event)?)
            .await?;

        info!(
            "Sync completed for {}/{}/{}: success={}, run_id={}",
            tenant_id, platform, shop_id, success, run_id
        );

        Ok(())
    }

    /// Check if sync can proceed based on backpressure
    #[instrument(skip(self))]
    pub async fn check_backpressure(
        &self,
        tenant_id: &str,
        platform: &str,
    ) -> AppResult<BackpressureStatus> {
        self.backpressure_manager
            .check_backpressure(tenant_id, platform)
            .await
    }

    /// Process messages directly (outbox pattern removed - using RabbitMQ)
    #[instrument(skip(self))]
    pub async fn process_messages(&self, _batch_size: usize) -> AppResult<usize> {
        // Messages are now processed directly via RabbitMQ
        // This method is kept for API compatibility but returns 0
        Ok(0)
    }

    /// Get platform-specific pagination mode
    fn get_platform_pagination_mode(&self, platform: &str) -> PaginationMode {
        match platform {
            "shopify" | "woocommerce" | "magento" => PaginationMode::Offset { limit: Some(250) },
            "tiktok" | "lazada" | "shopee" => PaginationMode::Cursor { cursor: None },
            _ => PaginationMode::Token { token: None },
        }
    }

    /// Build lock key for distributed locking
    fn build_lock_key(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
    ) -> crate::infrastructure::sync::LockKey {
        crate::infrastructure::sync::LockKey {
            tenant: tenant_id.to_string(),
            platform: platform.to_string(),
            shop: shop_id.to_string(),
        }
    }
}

/// Sync status response DTO
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SyncStatusResponse {
    pub state: String,
    pub run_id: String,
    pub worker_id: String,
    pub started_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub progress: SyncProgressInfo,
    pub metrics: SyncMetricsInfo,
    pub error: Option<SyncErrorInfo>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SyncProgressInfo {
    pub page_seq: u32,
    pub current_cursor: Option<String>,
    pub current_offset: Option<i64>,
    pub time_range: Option<TimeRange>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TimeRange {
    pub lower_inclusive: String,
    pub upper_exclusive: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SyncMetricsInfo {
    pub items_total: u64,
    pub items_list_only: u64,
    pub items_detail_enqueued: u64,
    pub items_detail_skipped: u64,
    pub lag_detail_consumer: u64,
    pub backoff_seconds: u32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SyncErrorInfo {
    pub code: Option<String>,
    pub message: String,
}

impl SyncStatusResponse {
    fn from_run_status(status: RunStatus) -> Self {
        Self {
            state: format!("{:?}", status.state).to_lowercase(),
            run_id: status.run_id,
            worker_id: status.worker_id,
            started_at: DateTime::from_timestamp_millis(status.started_at as i64)
                .unwrap_or_else(Utc::now),
            updated_at: DateTime::from_timestamp_millis(status.updated_at as i64)
                .unwrap_or_else(Utc::now),
            progress: SyncProgressInfo {
                page_seq: status.page_seq,
                current_cursor: status.current_cursor,
                current_offset: status.current_offset,
                time_range: match (status.lower_ts, status.upper_ts) {
                    (Some(lower), Some(upper)) => Some(TimeRange {
                        lower_inclusive: lower,
                        upper_exclusive: upper,
                    }),
                    _ => None,
                },
            },
            metrics: SyncMetricsInfo {
                items_total: status.items_total,
                items_list_only: status.items_list_only,
                items_detail_enqueued: status.items_detail_enqueued,
                items_detail_skipped: status.items_detail_skipped,
                lag_detail_consumer: status.lag_detail_consumer,
                backoff_seconds: status.backoff_seconds,
            },
            error: status.last_error_msg.map(|msg| SyncErrorInfo {
                code: status.last_error_code,
                message: msg,
            }),
        }
    }
}

/// Backpressure status
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BackpressureStatus {
    pub can_proceed: bool,
    pub reason: Option<String>,
    pub suggested_delay_ms: Option<u64>,
    pub metrics: BackpressureMetrics,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BackpressureMetrics {
    pub detail_queue_depth: u64,
    pub current_throughput: f64,
    pub error_rate: f64,
    pub platform_rate_limit_remaining: Option<u32>,
}
