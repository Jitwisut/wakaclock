/// Observability metrics for Redis operations and sync progress
/// ระบบเก็บ metrics สำหรับติดตามการทำงานของ sync operations และ Redis
/// Based on specifications in prompt/002.md section 13
///
/// รองรับการเก็บ metrics หลายประเภท:
/// - Page processing metrics
/// - API call metrics
/// - Database insertion metrics
/// - Backpressure และ rate limiting metrics
use prometheus::{
    GaugeVec, HistogramOpts, HistogramVec, IntCounterVec, IntGaugeVec, Opts, Registry,
};
use std::sync::Arc;

/// Sync metrics collector - ตัวเก็บ metrics สำหรับการซิงค์ข้อมูล
///
/// รวบรวม metrics ทั้งหมดที่เกี่ยวข้องกับการซิงค์สินค้าจาก platforms
/// ใช้ Prometheus format สำหรับ monitoring และ alerting
pub struct SyncMetrics {
    // Page processing metrics
    pub list_pages_total: IntCounterVec,
    pub products_enqueued_total: IntCounterVec,

    // API call metrics
    pub api_calls_total: IntCounterVec,
    pub api_call_duration: HistogramVec,

    // Consumer lag and backlog
    pub detail_consumer_lag: IntGaugeVec,
    pub outbox_backlog: IntGaugeVec,

    // ClickHouse insertion metrics
    pub ch_insert_rows_total: IntCounterVec,
    pub ch_insert_errors_total: IntCounterVec,
    pub ch_insert_duration: HistogramVec,

    // Business logic metrics
    pub needs_detail_ratio: GaugeVec,

    // Redis operation metrics
    pub redis_status_writes_total: IntCounterVec,
    pub redis_status_write_errors_total: IntCounterVec,
    pub redis_heartbeat_stale_gauge: IntGaugeVec,
    pub redis_lock_conflicts_total: IntCounterVec,
    pub redis_lock_renew_failures_total: IntCounterVec,

    // Stream processing metrics
    pub redis_stream_messages_total: IntCounterVec,
    pub redis_stream_processing_duration: HistogramVec,

    // Sync state metrics
    pub sync_runs_total: IntCounterVec,
    pub sync_run_duration: HistogramVec,
    pub sync_errors_total: IntCounterVec,

    // Rate limiting metrics
    pub rate_limit_hits_total: IntCounterVec,
    pub backpressure_throttle_events_total: IntCounterVec,
    pub backpressure_pause_events_total: IntCounterVec,
}

impl SyncMetrics {
    pub fn new(registry: &Registry) -> anyhow::Result<Self> {
        let metrics = Self {
            // Page processing metrics
            list_pages_total: IntCounterVec::new(
                Opts::new(
                    "sync_list_pages_total",
                    "Total number of list pages processed",
                ),
                &["tenant", "platform", "shop"],
            )?,

            products_enqueued_total: IntCounterVec::new(
                Opts::new(
                    "sync_products_enqueued_total",
                    "Total number of products enqueued for processing",
                ),
                &["source", "tenant", "platform"], // source = list|detail
            )?,

            // API call metrics
            api_calls_total: IntCounterVec::new(
                Opts::new("sync_api_calls_total", "Total number of platform API calls"),
                &["platform", "endpoint", "status"],
            )?,

            api_call_duration: HistogramVec::new(
                HistogramOpts::new(
                    "sync_api_call_duration_seconds",
                    "Duration of platform API calls",
                ),
                &["platform", "endpoint"],
            )?,

            // Consumer lag and backlog
            detail_consumer_lag: IntGaugeVec::new(
                Opts::new(
                    "sync_detail_consumer_lag",
                    "Number of messages pending in detail consumer",
                ),
                &["tenant", "platform"],
            )?,

            outbox_backlog: IntGaugeVec::new(
                Opts::new(
                    "sync_outbox_backlog",
                    "Number of messages pending in outbox stream",
                ),
                &["tenant", "platform"],
            )?,

            // ClickHouse insertion metrics
            ch_insert_rows_total: IntCounterVec::new(
                Opts::new(
                    "sync_clickhouse_insert_rows_total",
                    "Total number of rows inserted into ClickHouse",
                ),
                &["table", "tenant"],
            )?,

            ch_insert_errors_total: IntCounterVec::new(
                Opts::new(
                    "sync_clickhouse_insert_errors_total",
                    "Total number of ClickHouse insertion errors",
                ),
                &["table", "error_type"],
            )?,

            ch_insert_duration: HistogramVec::new(
                HistogramOpts::new(
                    "sync_clickhouse_insert_duration_seconds",
                    "Duration of ClickHouse insertions",
                ),
                &["table"],
            )?,

            // Business logic metrics
            needs_detail_ratio: GaugeVec::new(
                Opts::new(
                    "sync_needs_detail_ratio",
                    "Ratio of products requiring detail API calls",
                ),
                &["tenant", "platform"],
            )?,

            // Redis operation metrics
            redis_status_writes_total: IntCounterVec::new(
                Opts::new(
                    "sync_redis_status_writes_total",
                    "Total number of Redis status writes",
                ),
                &["operation"], // operation = heartbeat|page_update|final_update
            )?,

            redis_status_write_errors_total: IntCounterVec::new(
                Opts::new(
                    "sync_redis_status_write_errors_total",
                    "Total number of Redis status write errors",
                ),
                &["operation", "error_type"],
            )?,

            redis_heartbeat_stale_gauge: IntGaugeVec::new(
                Opts::new(
                    "sync_redis_heartbeat_stale",
                    "Number of stale heartbeat keys",
                ),
                &["tenant", "platform"],
            )?,

            redis_lock_conflicts_total: IntCounterVec::new(
                Opts::new(
                    "sync_redis_lock_conflicts_total",
                    "Total number of Redis lock conflicts",
                ),
                &["tenant", "platform", "shop"],
            )?,

            redis_lock_renew_failures_total: IntCounterVec::new(
                Opts::new(
                    "sync_redis_lock_renew_failures_total",
                    "Total number of Redis lock renewal failures",
                ),
                &["tenant", "platform", "shop"],
            )?,

            // Stream processing metrics
            redis_stream_messages_total: IntCounterVec::new(
                Opts::new(
                    "sync_redis_stream_messages_total",
                    "Total number of Redis stream messages processed",
                ),
                &["stream_type"], // stream_type = outbox|progress
            )?,

            redis_stream_processing_duration: HistogramVec::new(
                HistogramOpts::new(
                    "sync_redis_stream_processing_duration_seconds",
                    "Duration of Redis stream message processing",
                ),
                &["stream_type"],
            )?,

            // Sync state metrics
            sync_runs_total: IntCounterVec::new(
                Opts::new("sync_runs_total", "Total number of sync runs"),
                &["tenant", "platform", "shop", "status"], // status = success|failure|partial
            )?,

            sync_run_duration: HistogramVec::new(
                HistogramOpts::new(
                    "sync_run_duration_seconds",
                    "Duration of complete sync runs",
                ),
                &["tenant", "platform"],
            )?,

            sync_errors_total: IntCounterVec::new(
                Opts::new("sync_errors_total", "Total number of sync errors"),
                &["tenant", "platform", "error_type"],
            )?,

            // Rate limiting metrics
            rate_limit_hits_total: IntCounterVec::new(
                Opts::new(
                    "sync_rate_limit_hits_total",
                    "Total number of rate limit hits",
                ),
                &["platform"],
            )?,

            backpressure_throttle_events_total: IntCounterVec::new(
                Opts::new(
                    "sync_backpressure_throttle_events_total",
                    "Total number of backpressure throttle events",
                ),
                &["reason"], // reason = consumer_lag|api_rate_limit
            )?,

            backpressure_pause_events_total: IntCounterVec::new(
                Opts::new(
                    "sync_backpressure_pause_events_total",
                    "Total number of backpressure pause events",
                ),
                &["reason"],
            )?,
        };

        // Register all metrics with Prometheus
        registry.register(Box::new(metrics.list_pages_total.clone()))?;
        registry.register(Box::new(metrics.products_enqueued_total.clone()))?;
        registry.register(Box::new(metrics.api_calls_total.clone()))?;
        registry.register(Box::new(metrics.api_call_duration.clone()))?;
        registry.register(Box::new(metrics.detail_consumer_lag.clone()))?;
        registry.register(Box::new(metrics.outbox_backlog.clone()))?;
        registry.register(Box::new(metrics.ch_insert_rows_total.clone()))?;
        registry.register(Box::new(metrics.ch_insert_errors_total.clone()))?;
        registry.register(Box::new(metrics.ch_insert_duration.clone()))?;
        registry.register(Box::new(metrics.needs_detail_ratio.clone()))?;
        registry.register(Box::new(metrics.redis_status_writes_total.clone()))?;
        registry.register(Box::new(metrics.redis_status_write_errors_total.clone()))?;
        registry.register(Box::new(metrics.redis_heartbeat_stale_gauge.clone()))?;
        registry.register(Box::new(metrics.redis_lock_conflicts_total.clone()))?;
        registry.register(Box::new(metrics.redis_lock_renew_failures_total.clone()))?;
        registry.register(Box::new(metrics.redis_stream_messages_total.clone()))?;
        registry.register(Box::new(metrics.redis_stream_processing_duration.clone()))?;
        registry.register(Box::new(metrics.sync_runs_total.clone()))?;
        registry.register(Box::new(metrics.sync_run_duration.clone()))?;
        registry.register(Box::new(metrics.sync_errors_total.clone()))?;
        registry.register(Box::new(metrics.rate_limit_hits_total.clone()))?;
        registry.register(Box::new(metrics.backpressure_throttle_events_total.clone()))?;
        registry.register(Box::new(metrics.backpressure_pause_events_total.clone()))?;

        Ok(metrics)
    }

    /// Record a successful page processing
    pub fn record_page_processed(
        &self,
        tenant: &str,
        platform: &str,
        shop: &str,
        products_count: u64,
    ) {
        self.list_pages_total
            .with_label_values(&[tenant, platform, shop])
            .inc();

        self.products_enqueued_total
            .with_label_values(&["list", tenant, platform])
            .inc_by(products_count);
    }

    /// Record an API call
    pub fn record_api_call(
        &self,
        platform: &str,
        endpoint: &str,
        status: &str,
        duration_seconds: f64,
    ) {
        self.api_calls_total
            .with_label_values(&[platform, endpoint, status])
            .inc();

        self.api_call_duration
            .with_label_values(&[platform, endpoint])
            .observe(duration_seconds);
    }

    /// Record consumer lag
    pub fn record_consumer_lag(&self, tenant: &str, platform: &str, lag: i64) {
        self.detail_consumer_lag
            .with_label_values(&[tenant, platform])
            .set(lag);
    }

    /// Record ClickHouse insertion
    pub fn record_ch_insert(
        &self,
        table: &str,
        tenant: &str,
        rows_inserted: u64,
        duration_seconds: f64,
    ) {
        self.ch_insert_rows_total
            .with_label_values(&[table, tenant])
            .inc_by(rows_inserted);

        self.ch_insert_duration
            .with_label_values(&[table])
            .observe(duration_seconds);
    }

    /// Record ClickHouse insertion error
    pub fn record_ch_insert_error(&self, table: &str, error_type: &str) {
        self.ch_insert_errors_total
            .with_label_values(&[table, error_type])
            .inc();
    }

    /// Record detail need ratio
    pub fn record_detail_ratio(&self, tenant: &str, platform: &str, ratio: f64) {
        self.needs_detail_ratio
            .with_label_values(&[tenant, platform])
            .set(ratio);
    }

    /// Record Redis status write
    pub fn record_redis_status_write(&self, operation: &str, success: bool) {
        self.redis_status_writes_total
            .with_label_values(&[operation])
            .inc();

        if !success {
            self.redis_status_write_errors_total
                .with_label_values(&[operation, "write_failed"])
                .inc();
        }
    }

    /// Record stale heartbeats
    pub fn record_stale_heartbeats(&self, tenant: &str, platform: &str, count: i64) {
        self.redis_heartbeat_stale_gauge
            .with_label_values(&[tenant, platform])
            .set(count);
    }

    /// Record lock conflict
    pub fn record_lock_conflict(&self, tenant: &str, platform: &str, shop: &str) {
        self.redis_lock_conflicts_total
            .with_label_values(&[tenant, platform, shop])
            .inc();
    }

    /// Record lock renewal failure
    pub fn record_lock_renewal_failure(&self, tenant: &str, platform: &str, shop: &str) {
        self.redis_lock_renew_failures_total
            .with_label_values(&[tenant, platform, shop])
            .inc();
    }

    /// Record sync run completion
    pub fn record_sync_run(
        &self,
        tenant: &str,
        platform: &str,
        shop: &str,
        status: &str,
        duration_seconds: f64,
    ) {
        self.sync_runs_total
            .with_label_values(&[tenant, platform, shop, status])
            .inc();

        self.sync_run_duration
            .with_label_values(&[tenant, platform])
            .observe(duration_seconds);
    }

    /// Record sync error
    pub fn record_sync_error(&self, tenant: &str, platform: &str, error_type: &str) {
        self.sync_errors_total
            .with_label_values(&[tenant, platform, error_type])
            .inc();
    }

    /// Record rate limit hit
    pub fn record_rate_limit_hit(&self, platform: &str) {
        self.rate_limit_hits_total
            .with_label_values(&[platform])
            .inc();
    }

    /// Record backpressure event
    pub fn record_backpressure_throttle(&self, reason: &str) {
        self.backpressure_throttle_events_total
            .with_label_values(&[reason])
            .inc();
    }

    /// Record backpressure pause
    pub fn record_backpressure_pause(&self, reason: &str) {
        self.backpressure_pause_events_total
            .with_label_values(&[reason])
            .inc();
    }

    /// Record stream message processing
    pub fn record_stream_processing(&self, stream_type: &str, duration_seconds: f64) {
        self.redis_stream_messages_total
            .with_label_values(&[stream_type])
            .inc();

        self.redis_stream_processing_duration
            .with_label_values(&[stream_type])
            .observe(duration_seconds);
    }
}

/// Metrics context for passing around sync operation metadata
#[derive(Debug, Clone)]
pub struct MetricsContext {
    pub tenant_id: String,
    pub platform: String,
    pub shop_id: String,
    pub sync_run_id: String,
    pub start_time: std::time::Instant,
}

impl MetricsContext {
    pub fn new(tenant_id: String, platform: String, shop_id: String, sync_run_id: String) -> Self {
        Self {
            tenant_id,
            platform,
            shop_id,
            sync_run_id,
            start_time: std::time::Instant::now(),
        }
    }

    pub fn elapsed(&self) -> f64 {
        self.start_time.elapsed().as_secs_f64()
    }
}

/// Timer helper for measuring operation duration
pub struct MetricsTimer {
    start_time: std::time::Instant,
}

impl Default for MetricsTimer {
    fn default() -> Self {
        Self::new()
    }
}

impl MetricsTimer {
    pub fn new() -> Self {
        Self {
            start_time: std::time::Instant::now(),
        }
    }

    pub fn elapsed_seconds(&self) -> f64 {
        self.start_time.elapsed().as_secs_f64()
    }

    pub fn record_and_finish<F>(&self, record_fn: F)
    where
        F: FnOnce(f64),
    {
        let duration = self.elapsed_seconds();
        record_fn(duration);
    }
}

/// Global metrics instance
pub static SYNC_METRICS: std::sync::OnceLock<Arc<SyncMetrics>> = std::sync::OnceLock::new();

/// Initialize global metrics
pub fn init_sync_metrics(registry: &Registry) -> anyhow::Result<()> {
    let metrics = Arc::new(SyncMetrics::new(registry)?);
    SYNC_METRICS
        .set(metrics)
        .map_err(|_| anyhow::anyhow!("Metrics already initialized"))?;
    Ok(())
}

/// Get global metrics instance
pub fn get_sync_metrics() -> Option<&'static Arc<SyncMetrics>> {
    SYNC_METRICS.get()
}
