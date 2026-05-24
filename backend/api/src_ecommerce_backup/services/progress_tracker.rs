//! # Progress Tracker - บริการติดตามความคืบหน้า
//!
//! Service สำหรับติดตามความคืบหน้าของ sync jobs และจัดเก็บ metrics
//! รวมถึงการให้ข้อมูล real-time progress สำหรับ background operations
//!
//! ## หน้าที่หลัก
//! - ติดตามความคืบหน้าของ sync jobs แบบ real-time
//! - จัดเก็บ metrics และ performance data
//! - ให้บริการ progress APIs สำหรับ frontend
//! - จัดการ event-driven progress updates

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{error, info, instrument, warn};

use crate::{
    infrastructure::logger::Logger,
    model::v1::{
        platfrom::entries::product_sync::messages::{ProgressEventMessage, ProgressPhase},
        platfrom::entries::{AppError, AppResult},
    },
    AppState,
};

/// Progress tracking and observability service - บริการติดตามความคืบหน้าและการสังเกตการณ์
/// Handles real-time sync progress, metrics collection, and monitoring
pub struct ProgressTracker {
    state: Arc<AppState>,
    clickhouse_client: Arc<clickhouse::Client>,
    logger: Arc<Logger>,
    metrics_buffer: Arc<tokio::sync::RwLock<HashMap<String, SyncMetrics>>>,
}

/// Real-time sync metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMetrics {
    pub tenant_id: String,
    pub platform: String,
    pub shop_id: String,
    pub batch_id: String,

    // Progress counters
    pub pages_processed: u32,
    pub products_discovered: u32,
    pub products_list_only: u32,
    pub products_detail_needed: u32,
    pub products_detail_completed: u32,
    pub products_failed: u32,

    // Performance metrics
    pub avg_page_processing_time_ms: f64,
    pub avg_products_per_page: f64,
    pub current_throughput_per_sec: f64,
    pub estimated_completion_time: Option<DateTime<Utc>>,

    // Queue and lag metrics
    pub pending_detail_requests: u64,
    pub detail_consumer_lag: u64,
    pub rate_limit_hits: u32,
    pub api_quota_remaining: Option<u64>,

    // Error tracking
    pub consecutive_errors: u32,
    pub last_error_at: Option<DateTime<Utc>>,
    pub error_rate_per_hour: f64,

    // Timestamps
    pub sync_started_at: DateTime<Utc>,
    pub last_activity_at: DateTime<Utc>,
    pub last_page_completed_at: Option<DateTime<Utc>>,

    // Status
    pub current_status: String, // "running", "rate_limited", "error", "completed"
    pub current_phase: String,  // "list_pagination", "detail_processing", "finalizing"
}

impl ProgressTracker {
    pub fn new(state: Arc<AppState>) -> Self {
        let clickhouse_client = Arc::new(
            clickhouse::Client::default()
                .with_url(&state.config.database.clickhouse_url)
                .with_user("default")
                .with_password("default")
                .with_database(&state.config.database.clickhouse_database),
        );

        Self {
            state,
            clickhouse_client,
            logger: crate::infrastructure::logger::global(),
            metrics_buffer: Arc::new(tokio::sync::RwLock::new(HashMap::new())),
        }
    }

    /// Handle incoming progress events and update metrics
    #[instrument(skip(self, event), fields(trace_id = %event.trace_id))]
    pub async fn handle_progress_event(&self, event: ProgressEventMessage) -> AppResult<()> {
        let batch_key = format!("{}:{}:{}", event.tenant_id, event.platform, event.shop_id);

        // Update in-memory metrics

        self.logger.info(
            &format!(
                "Processed progress event: {:?} - {} for batch {}",
                event.phase, event.tenant_id, batch_key
            ),
            None,
        );
        {
            let mut metrics_guard = self.metrics_buffer.write().await;
            let metrics = metrics_guard
                .entry(batch_key.clone())
                .or_insert_with(|| self.create_initial_metrics(&event));

            self.update_metrics_from_event(metrics, &event).await?;
        }

        // Persist to ClickHouse for historical tracking
        self.persist_progress_event(&event).await?;

        // Update sync_stats table
        self.update_sync_stats(&event).await?;

        // Check for alerts and anomalies
        self.check_alerts(&event).await?;

        // Publish real-time metrics to dashboards (WebSocket, etc.)
        self.publish_realtime_metrics(&batch_key).await?;

        info!(
            "Processed progress event: {} - {} for batch {}",
            event.phase as i32, event.tenant_id, batch_key
        );

        Ok(())
    }

    /// Create initial metrics for a new sync batch
    fn create_initial_metrics(&self, event: &ProgressEventMessage) -> SyncMetrics {
        SyncMetrics {
            tenant_id: event.tenant_id.clone(),
            platform: event.platform.clone(),
            shop_id: event.shop_id.clone(),
            batch_id: "".to_string(), // Will be updated from event
            pages_processed: 0,
            products_discovered: 0,
            products_list_only: 0,
            products_detail_needed: 0,
            products_detail_completed: 0,
            products_failed: 0,
            avg_page_processing_time_ms: 0.0,
            avg_products_per_page: 0.0,
            current_throughput_per_sec: 0.0,
            estimated_completion_time: None,
            pending_detail_requests: 0,
            detail_consumer_lag: 0,
            rate_limit_hits: 0,
            api_quota_remaining: None,
            consecutive_errors: 0,
            last_error_at: None,
            error_rate_per_hour: 0.0,
            sync_started_at: Utc::now(),
            last_activity_at: Utc::now(),
            last_page_completed_at: None,
            current_status: "running".to_string(),
            current_phase: "list_pagination".to_string(),
        }
    }

    /// Update metrics based on progress event
    async fn update_metrics_from_event(
        &self,
        metrics: &mut SyncMetrics,
        event: &ProgressEventMessage,
    ) -> AppResult<()> {
        metrics.last_activity_at = event.timestamp;

        match event.phase {
            ProgressPhase::ListPageStarted => {
                metrics.current_phase = "list_pagination".to_string();
                metrics.current_status = "running".to_string();
            }
            ProgressPhase::ListPageDone => {
                metrics.pages_processed += 1;
                metrics.last_page_completed_at = Some(event.timestamp);

                if let Some(items_emitted) = event.items_emitted {
                    metrics.products_discovered += items_emitted;

                    // Update average products per page
                    metrics.avg_products_per_page =
                        metrics.products_discovered as f64 / metrics.pages_processed as f64;
                }

                // Update throughput if processing time is available
                if let Some(processing_time_ms) = event.processing_time_ms {
                    metrics.avg_page_processing_time_ms = (metrics.avg_page_processing_time_ms
                        * (metrics.pages_processed - 1) as f64
                        + processing_time_ms as f64)
                        / metrics.pages_processed as f64;

                    if let Some(items) = event.items_emitted {
                        metrics.current_throughput_per_sec =
                            items as f64 / (processing_time_ms as f64 / 1000.0);
                    }
                }

                // Update lag metrics
                if let Some(lag) = event.lag_detail_consumer {
                    metrics.detail_consumer_lag = lag;
                }

                // Estimate completion time
                self.update_completion_estimate(metrics, event).await;
            }
            ProgressPhase::DetailBatchStarted => {
                metrics.current_phase = "detail_processing".to_string();
            }
            ProgressPhase::DetailBatchDone => {
                if let Some(processed) = event.items_processed {
                    metrics.products_detail_completed += processed;
                }
                if let Some(failed) = event.items_failed {
                    metrics.products_failed += failed;
                }
            }
            ProgressPhase::SyncCompleted => {
                metrics.current_status = "completed".to_string();
                metrics.current_phase = "completed".to_string();
                metrics.estimated_completion_time = Some(event.timestamp);
            }
            ProgressPhase::SyncFailed => {
                metrics.current_status = "failed".to_string();
                metrics.consecutive_errors += 1;
                metrics.last_error_at = Some(event.timestamp);

                // Calculate error rate
                let hours_since_start = (event.timestamp - metrics.sync_started_at)
                    .num_hours()
                    .max(1) as f64;
                metrics.error_rate_per_hour = metrics.consecutive_errors as f64 / hours_since_start;
            }
        }

        Ok(())
    }

    /// Update estimated completion time based on current progress
    async fn update_completion_estimate(
        &self,
        metrics: &mut SyncMetrics,
        _event: &ProgressEventMessage,
    ) {
        if metrics.current_throughput_per_sec > 0.0 && metrics.detail_consumer_lag > 0 {
            let remaining_items = metrics.detail_consumer_lag as f64;
            let estimated_seconds = remaining_items / metrics.current_throughput_per_sec;

            metrics.estimated_completion_time =
                Some(Utc::now() + chrono::Duration::seconds(estimated_seconds as i64));
        }
    }

    /// Persist progress event to ClickHouse for historical analysis
    async fn persist_progress_event(&self, event: &ProgressEventMessage) -> AppResult<()> {
        let query = r#"
            INSERT INTO sync_progress_events (
                tenant_id, platform, shop_id, phase, trace_id,
                page_seq, items_emitted, items_processed, items_failed,
                has_more_pages, lag_detail_consumer, processing_time_ms,
                throughput_items_per_sec, error_message, error_code, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        self.clickhouse_client
            .query(query)
            .bind(&event.tenant_id)
            .bind(&event.platform)
            .bind(&event.shop_id)
            .bind(format!("{:?}", event.phase))
            .bind(&event.trace_id)
            .bind(event.page_seq)
            .bind(event.items_emitted)
            .bind(event.items_processed)
            .bind(event.items_failed)
            .bind(event.has_more_pages)
            .bind(event.lag_detail_consumer)
            .bind(event.processing_time_ms)
            .bind(event.throughput_items_per_sec)
            .bind(&event.error_message)
            .bind(&event.error_code)
            .bind(event.timestamp)
            .execute()
            .await
            .map_err(|e| {
                AppError::DatabaseError(format!("Failed to persist progress event: {}", e))
            })?;

        Ok(())
    }

    /// Update sync_stats table with latest metrics
    async fn update_sync_stats(&self, event: &ProgressEventMessage) -> AppResult<()> {
        let batch_key = format!("{}:{}:{}", event.tenant_id, event.platform, event.shop_id);

        let metrics_guard = self.metrics_buffer.read().await;
        if let Some(metrics) = metrics_guard.get(&batch_key) {
            let query = r#"
                ALTER TABLE sync_stats
                UPDATE
                    current_page = ?,
                    products_discovered = ?,
                    products_list_only = ?,
                    products_detail_needed = ?,
                    products_detail_completed = ?,
                    products_failed = ?,
                    avg_list_response_time_ms = ?,
                    throughput_products_per_sec = ?,
                    last_activity_at = ?,
                    error_count = ?
                WHERE tenant_id = ? AND platform = ? AND shop_id = ?
            "#;

            self.clickhouse_client
                .query(query)
                .bind(metrics.pages_processed)
                .bind(metrics.products_discovered)
                .bind(metrics.products_list_only)
                .bind(metrics.products_detail_needed)
                .bind(metrics.products_detail_completed)
                .bind(metrics.products_failed)
                .bind(metrics.avg_page_processing_time_ms)
                .bind(metrics.current_throughput_per_sec)
                .bind(metrics.last_activity_at)
                .bind(metrics.consecutive_errors)
                .bind(&event.tenant_id)
                .bind(&event.platform)
                .bind(&event.shop_id)
                .execute()
                .await
                .map_err(|e| {
                    AppError::DatabaseError(format!("Failed to update sync stats: {}", e))
                })?;
        }

        Ok(())
    }

    /// Check for alerts and anomalies
    async fn check_alerts(&self, event: &ProgressEventMessage) -> AppResult<()> {
        let batch_key = format!("{}:{}:{}", event.tenant_id, event.platform, event.shop_id);

        let metrics_guard = self.metrics_buffer.read().await;
        if let Some(metrics) = metrics_guard.get(&batch_key) {
            // Check for high error rate
            if metrics.error_rate_per_hour > 10.0 {
                self.send_alert(
                    &event.tenant_id,
                    "HIGH_ERROR_RATE",
                    &format!("Sync has {} errors per hour", metrics.error_rate_per_hour),
                )
                .await?;
            }

            // Check for stalled sync
            let minutes_since_activity = (Utc::now() - metrics.last_activity_at).num_minutes();
            if minutes_since_activity > 10 && metrics.current_status == "running" {
                self.send_alert(
                    &event.tenant_id,
                    "SYNC_STALLED",
                    &format!("No activity for {} minutes", minutes_since_activity),
                )
                .await?;
            }

            // Check for high consumer lag
            if metrics.detail_consumer_lag > 10000 {
                self.send_alert(
                    &event.tenant_id,
                    "HIGH_CONSUMER_LAG",
                    &format!(
                        "Detail consumer lag: {} messages",
                        metrics.detail_consumer_lag
                    ),
                )
                .await?;
            }

            // Check for low throughput
            if metrics.current_throughput_per_sec < 1.0 && metrics.pages_processed > 5 {
                self.send_alert(
                    &event.tenant_id,
                    "LOW_THROUGHPUT",
                    &format!(
                        "Throughput: {:.2} products/sec",
                        metrics.current_throughput_per_sec
                    ),
                )
                .await?;
            }
        }

        Ok(())
    }

    /// Send alert to monitoring systems
    async fn send_alert(&self, tenant_id: &str, alert_type: &str, message: &str) -> AppResult<()> {
        warn!(
            "ALERT [{}] for tenant {}: {}",
            alert_type, tenant_id, message
        );

        // In a real implementation, this would:
        // - Send to Slack/Discord webhooks
        // - Create PagerDuty incidents
        // - Send emails to admins
        // - Update monitoring dashboards

        Ok(())
    }

    /// Publish real-time metrics to dashboards
    async fn publish_realtime_metrics(&self, batch_key: &str) -> AppResult<()> {
        let metrics_guard = self.metrics_buffer.read().await;
        if let Some(metrics) = metrics_guard.get(batch_key) {
            let metrics_json = serde_json::to_value(metrics).map_err(|e| {
                AppError::SerializationError(format!("Failed to serialize metrics: {}", e))
            })?;

            // Publish to WebSocket clients for real-time dashboards
            let subject = format!(
                "metrics.realtime.{}.{}",
                metrics.tenant_id, metrics.platform
            );
            let payload = serde_json::to_vec(&metrics_json).map_err(|e| {
                AppError::SerializationError(format!("Failed to serialize metrics payload: {}", e))
            })?;

            self.state
                .queue
                .publish_bytes(&subject, payload)
                .await
                .map_err(|e| {
                    AppError::QueueError(format!("Failed to publish realtime metrics: {}", e))
                })?;
        }

        Ok(())
    }

    /// Get current metrics for a sync batch
    pub async fn get_batch_metrics(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
    ) -> AppResult<Option<SyncMetrics>> {
        let batch_key = format!("{}:{}:{}", tenant_id, platform, shop_id);
        let metrics_guard = self.metrics_buffer.read().await;
        Ok(metrics_guard.get(&batch_key).cloned())
    }

    /// Get aggregated metrics across all active syncs
    pub async fn get_global_metrics(&self) -> AppResult<GlobalMetrics> {
        let metrics_guard = self.metrics_buffer.read().await;

        let mut global = GlobalMetrics::default();

        for metrics in metrics_guard.values() {
            global.total_active_syncs += 1;
            global.total_products_processed += metrics.products_discovered;
            global.total_errors += metrics.consecutive_errors;

            if metrics.current_status == "running" {
                global.active_running_syncs += 1;
                global.total_throughput += metrics.current_throughput_per_sec;
            }

            global.total_consumer_lag += metrics.detail_consumer_lag;
        }

        Ok(global)
    }

    /// Clean up old metrics from memory
    pub async fn cleanup_old_metrics(&self, max_age_hours: i64) -> AppResult<()> {
        let cutoff_time = Utc::now() - chrono::Duration::hours(max_age_hours);
        let mut metrics_guard = self.metrics_buffer.write().await;

        metrics_guard.retain(|_, metrics| {
            metrics.last_activity_at > cutoff_time || metrics.current_status == "running"
        });

        info!(
            "Cleaned up old metrics, {} batches remaining",
            metrics_guard.len()
        );
        Ok(())
    }
}

/// Global metrics across all syncs
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct GlobalMetrics {
    pub total_active_syncs: u32,
    pub active_running_syncs: u32,
    pub total_products_processed: u32,
    pub total_throughput: f64,
    pub total_errors: u32,
    pub total_consumer_lag: u64,
    pub avg_completion_time_minutes: Option<f64>,
}

/// Progress subscriber that listens to RabbitMQ progress events
pub struct ProgressSubscriber {
    tracker: Arc<ProgressTracker>,
}

impl ProgressSubscriber {
    pub fn new(tracker: Arc<ProgressTracker>) -> Self {
        Self { tracker }
    }

    /// Start subscribing to progress events
    pub async fn start(&self) -> AppResult<()> {
        info!("Starting Progress Subscriber");

        // Subscribe to all progress subjects
        let progress_subjects = vec![
            "sync.products.list.progress.>",
            "sync.products.detail.progress.>",
        ];

        for subject in progress_subjects {
            let tracker_clone = self.tracker.clone();
            self.tracker
                .state
                .queue
                .subscribe_bytes(
                    subject,
                    Box::new(move |payload| {
                        let tracker = tracker_clone.clone();
                        tokio::spawn(async move {
                            if let Ok(event) =
                                serde_json::from_slice::<ProgressEventMessage>(&payload)
                            {
                                if let Err(e) = tracker.handle_progress_event(event).await {
                                    error!("Failed to handle progress event: {:?}", e);
                                }
                            }
                        });
                        Ok(())
                    }),
                )
                .await?;
        }

        info!("Progress Subscriber started successfully");
        Ok(())
    }
}
