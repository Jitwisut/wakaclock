//! โมดูล Gateway Metrics Collector (Gateway Metrics Collector Module)
//!
//! ไฟล์นี้ประกอบด้วยระบบเก็บรวบรวมและส่งออก Metrics สำหรับการดำเนินงาน
//! ของ Platform Gateway operations ผ่าน Prometheus metrics
//!
//! ## ความสามารถ (Features)
//! - เก็บ Metrics สำหรับ HTTP Requests, OAuth, Product Sync
//! - คำนวณเวลาตอบสนอง (Response Time) และ Throughput
//! - ติดตามอัตราความสำเร็จและข้อผิดพลาด
//! - รายงาน Metrics แบบ Real-time ผ่าน Prometheus HTTP endpoint
//! - จัดการ Labels และ Tags สำหรับ Grouping และ Filtering
//!
//! ## ประเภท Metrics
//! - **Request Metrics**: Total requests, success/failure counts, duration histograms
//! - **OAuth Metrics**: Authentication attempts, success rates, token refresh
//! - **Product Sync Metrics**: Sync jobs, product counts, sync duration
//! - **Queue Metrics**: Message counts, processing latency, dead letter queue
//! - **Rate Limiting**: Rate limit hits, throttling events
//!
//! ## ส่วนของ Sprint 6, Task 6.1
//! เก็บรวบรวมและส่งออก metrics สำหรับ Platform Gateway operations
//!
//! ## ไดเรกทอรี
//! `src/infrastructure/observability/`

// Gateway Metrics Collector - Sprint 6, Task 6.1
// Collects and exposes metrics for platform gateway operations

use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use prometheus::{
    GaugeVec, HistogramOpts, HistogramVec, IntCounter, IntCounterVec, IntGaugeVec, Opts, Registry,
};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, info};

// use crate::model::v1::platfrom::entries::PlatformType;

lazy_static::lazy_static! {
    static ref GATEWAY_METRICS: GatewayMetrics = GatewayMetrics::new();
}

/// ตัวเก็บ Metrics สำหรับ Gateway Operations (Gateway Metrics Collector)
///
/// เก็บรวบรวมและจัดการ Metrics สำหรับการติดตาม Performance และ
/// สถานะของระบบ Gateway ผ่าน Prometheus metrics
pub struct GatewayMetrics {
    // Request metrics
    pub requests_total: IntCounterVec,
    pub requests_success: IntCounterVec,
    pub requests_failed: IntCounterVec,
    pub request_duration: HistogramVec,

    // OAuth metrics
    pub oauth_auth_attempts: IntCounterVec,
    pub oauth_auth_success: IntCounterVec,
    pub oauth_auth_failed: IntCounterVec,
    pub oauth_token_refreshes: IntCounterVec,

    // Product sync metrics
    pub products_fetched: IntCounterVec,
    pub products_created: IntCounterVec,
    pub products_updated: IntCounterVec,
    pub products_deleted: IntCounterVec,
    pub sync_duration: HistogramVec,

    // Rate limiting metrics
    pub rate_limit_hits: IntCounterVec,
    pub rate_limit_remaining: IntGaugeVec,

    // Circuit breaker metrics
    pub circuit_breaker_state: IntGaugeVec,
    pub circuit_breaker_trips: IntCounterVec,
    pub circuit_breaker_recoveries: IntCounterVec,

    // Token encryption metrics
    pub tokens_encrypted: IntCounter,
    pub tokens_decrypted: IntCounter,
    pub token_rotation_count: IntCounter,

    // Active connections
    pub active_connections: IntGaugeVec,

    // Error tracking
    pub errors_by_type: IntCounterVec,

    // Platform availability
    pub platform_availability: GaugeVec,

    // Custom metrics storage
    custom_metrics: Arc<RwLock<HashMap<String, f64>>>,
}

impl Default for GatewayMetrics {
    fn default() -> Self {
        Self::new()
    }
}

impl GatewayMetrics {
    pub fn new() -> Self {
        Self {
            requests_total: IntCounterVec::new(
                Opts::new("gateway_requests_total", "Total number of gateway requests"),
                &["platform", "operation"],
            )
            .unwrap(),

            requests_success: IntCounterVec::new(
                Opts::new("gateway_requests_success", "Successful gateway requests"),
                &["platform", "operation"],
            )
            .unwrap(),

            requests_failed: IntCounterVec::new(
                Opts::new("gateway_requests_failed", "Failed gateway requests"),
                &["platform", "operation", "error_type"],
            )
            .unwrap(),

            request_duration: HistogramVec::new(
                HistogramOpts::new(
                    "gateway_request_duration_seconds",
                    "Request duration in seconds",
                ),
                &["platform", "operation"],
            )
            .unwrap(),

            oauth_auth_attempts: IntCounterVec::new(
                Opts::new(
                    "gateway_oauth_auth_attempts",
                    "OAuth authentication attempts",
                ),
                &["platform"],
            )
            .unwrap(),

            oauth_auth_success: IntCounterVec::new(
                Opts::new(
                    "gateway_oauth_auth_success",
                    "Successful OAuth authentications",
                ),
                &["platform"],
            )
            .unwrap(),

            oauth_auth_failed: IntCounterVec::new(
                Opts::new("gateway_oauth_auth_failed", "Failed OAuth authentications"),
                &["platform", "error_type"],
            )
            .unwrap(),

            oauth_token_refreshes: IntCounterVec::new(
                Opts::new("gateway_oauth_token_refreshes", "OAuth token refresh count"),
                &["platform"],
            )
            .unwrap(),

            products_fetched: IntCounterVec::new(
                Opts::new("gateway_products_fetched", "Products fetched from platform"),
                &["platform"],
            )
            .unwrap(),

            products_created: IntCounterVec::new(
                Opts::new("gateway_products_created", "Products created on platform"),
                &["platform"],
            )
            .unwrap(),

            products_updated: IntCounterVec::new(
                Opts::new("gateway_products_updated", "Products updated on platform"),
                &["platform"],
            )
            .unwrap(),

            products_deleted: IntCounterVec::new(
                Opts::new("gateway_products_deleted", "Products deleted from platform"),
                &["platform"],
            )
            .unwrap(),

            sync_duration: HistogramVec::new(
                HistogramOpts::new(
                    "gateway_sync_duration_seconds",
                    "Product sync duration in seconds",
                ),
                &["platform", "operation"],
            )
            .unwrap(),

            rate_limit_hits: IntCounterVec::new(
                Opts::new("gateway_rate_limit_hits", "Rate limit hits"),
                &["platform"],
            )
            .unwrap(),

            rate_limit_remaining: IntGaugeVec::new(
                Opts::new("gateway_rate_limit_remaining", "Remaining rate limit quota"),
                &["platform"],
            )
            .unwrap(),

            circuit_breaker_state: IntGaugeVec::new(
                Opts::new(
                    "gateway_circuit_breaker_state",
                    "Circuit breaker state (0=closed, 1=open, 2=half-open)",
                ),
                &["platform", "service"],
            )
            .unwrap(),

            circuit_breaker_trips: IntCounterVec::new(
                Opts::new(
                    "gateway_circuit_breaker_trips",
                    "Circuit breaker trip count",
                ),
                &["platform", "service"],
            )
            .unwrap(),

            circuit_breaker_recoveries: IntCounterVec::new(
                Opts::new(
                    "gateway_circuit_breaker_recoveries",
                    "Circuit breaker recovery count",
                ),
                &["platform", "service"],
            )
            .unwrap(),

            tokens_encrypted: IntCounter::with_opts(Opts::new(
                "gateway_tokens_encrypted",
                "Total tokens encrypted",
            ))
            .unwrap(),

            tokens_decrypted: IntCounter::with_opts(Opts::new(
                "gateway_tokens_decrypted",
                "Total tokens decrypted",
            ))
            .unwrap(),

            token_rotation_count: IntCounter::with_opts(Opts::new(
                "gateway_token_rotations",
                "Token rotation count",
            ))
            .unwrap(),

            active_connections: IntGaugeVec::new(
                Opts::new("gateway_active_connections", "Active platform connections"),
                &["platform"],
            )
            .unwrap(),

            errors_by_type: IntCounterVec::new(
                Opts::new("gateway_errors", "Gateway errors by type"),
                &["platform", "error_type"],
            )
            .unwrap(),

            platform_availability: GaugeVec::new(
                Opts::new(
                    "gateway_platform_availability",
                    "Platform availability (0=down, 1=up)",
                ),
                &["platform"],
            )
            .unwrap(),

            custom_metrics: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Record a gateway request
    pub fn record_request(&self, platform: &str, operation: &str, success: bool, duration: f64) {
        self.requests_total
            .with_label_values(&[platform, operation])
            .inc();

        if success {
            self.requests_success
                .with_label_values(&[platform, operation])
                .inc();
        }

        self.request_duration
            .with_label_values(&[platform, operation])
            .observe(duration);

        debug!(
            "Recorded {} request for {}: success={}, duration={}s",
            operation, platform, success, duration
        );
    }

    /// Record a failed request
    pub fn record_failure(&self, platform: &str, operation: &str, error_type: &str) {
        self.requests_failed
            .with_label_values(&[platform, operation, error_type])
            .inc();

        self.errors_by_type
            .with_label_values(&[platform, error_type])
            .inc();
    }

    /// Record OAuth authentication attempt
    pub fn record_oauth_auth(&self, platform: &str, success: bool, error: Option<&str>) {
        self.oauth_auth_attempts
            .with_label_values(&[platform])
            .inc();

        if success {
            self.oauth_auth_success.with_label_values(&[platform]).inc();
        } else if let Some(error_type) = error {
            self.oauth_auth_failed
                .with_label_values(&[platform, error_type])
                .inc();
        }
    }

    /// Record token refresh
    pub fn record_token_refresh(&self, platform: &str) {
        self.oauth_token_refreshes
            .with_label_values(&[platform])
            .inc();
    }

    /// Record products operation
    pub fn record_products_operation(&self, platform: &str, operation: &str, count: i64) {
        match operation {
            "fetch" => self
                .products_fetched
                .with_label_values(&[platform])
                .inc_by(count as u64),
            "create" => self
                .products_created
                .with_label_values(&[platform])
                .inc_by(count as u64),
            "update" => self
                .products_updated
                .with_label_values(&[platform])
                .inc_by(count as u64),
            "delete" => self
                .products_deleted
                .with_label_values(&[platform])
                .inc_by(count as u64),
            _ => {}
        }
    }

    /// Record rate limit hit
    pub fn record_rate_limit(&self, platform: &str, remaining: i64) {
        self.rate_limit_hits.with_label_values(&[platform]).inc();

        self.rate_limit_remaining
            .with_label_values(&[platform])
            .set(remaining);
    }

    /// Record circuit breaker state change
    pub fn record_circuit_breaker(
        &self,
        platform: &str,
        service: &str,
        state: CircuitBreakerState,
    ) {
        let state_value = match state {
            CircuitBreakerState::Closed => 0,
            CircuitBreakerState::Open => 1,
            CircuitBreakerState::HalfOpen => 2,
        };

        self.circuit_breaker_state
            .with_label_values(&[platform, service])
            .set(state_value);

        match state {
            CircuitBreakerState::Open => {
                self.circuit_breaker_trips
                    .with_label_values(&[platform, service])
                    .inc();
            }
            CircuitBreakerState::Closed => {
                self.circuit_breaker_recoveries
                    .with_label_values(&[platform, service])
                    .inc();
            }
            _ => {}
        }
    }

    /// Record token encryption operation
    pub fn record_token_operation(&self, operation: TokenOperation) {
        match operation {
            TokenOperation::Encrypt => self.tokens_encrypted.inc(),
            TokenOperation::Decrypt => self.tokens_decrypted.inc(),
            TokenOperation::Rotate => self.token_rotation_count.inc(),
        }
    }

    /// Update active connections
    pub fn update_active_connections(&self, platform: &str, count: i64) {
        self.active_connections
            .with_label_values(&[platform])
            .set(count);
    }

    /// Update platform availability
    pub fn update_platform_availability(&self, platform: &str, available: bool) {
        let value = if available { 1.0 } else { 0.0 };
        self.platform_availability
            .with_label_values(&[platform])
            .set(value);

        info!(
            "Platform {} availability: {}",
            platform,
            if available { "UP" } else { "DOWN" }
        );
    }

    /// Record custom metric
    pub fn record_custom(&self, name: &str, value: f64) {
        self.custom_metrics.write().insert(name.to_string(), value);
    }

    /// Get custom metric
    pub fn get_custom(&self, name: &str) -> Option<f64> {
        self.custom_metrics.read().get(name).copied()
    }

    /// Register all metrics with Prometheus registry
    pub fn register(&self, registry: &Registry) -> Result<(), Box<dyn std::error::Error>> {
        registry.register(Box::new(self.requests_total.clone()))?;
        registry.register(Box::new(self.requests_success.clone()))?;
        registry.register(Box::new(self.requests_failed.clone()))?;
        registry.register(Box::new(self.request_duration.clone()))?;
        registry.register(Box::new(self.oauth_auth_attempts.clone()))?;
        registry.register(Box::new(self.oauth_auth_success.clone()))?;
        registry.register(Box::new(self.oauth_auth_failed.clone()))?;
        registry.register(Box::new(self.oauth_token_refreshes.clone()))?;
        registry.register(Box::new(self.products_fetched.clone()))?;
        registry.register(Box::new(self.products_created.clone()))?;
        registry.register(Box::new(self.products_updated.clone()))?;
        registry.register(Box::new(self.products_deleted.clone()))?;
        registry.register(Box::new(self.sync_duration.clone()))?;
        registry.register(Box::new(self.rate_limit_hits.clone()))?;
        registry.register(Box::new(self.rate_limit_remaining.clone()))?;
        registry.register(Box::new(self.circuit_breaker_state.clone()))?;
        registry.register(Box::new(self.circuit_breaker_trips.clone()))?;
        registry.register(Box::new(self.circuit_breaker_recoveries.clone()))?;
        registry.register(Box::new(self.tokens_encrypted.clone()))?;
        registry.register(Box::new(self.tokens_decrypted.clone()))?;
        registry.register(Box::new(self.token_rotation_count.clone()))?;
        registry.register(Box::new(self.active_connections.clone()))?;
        registry.register(Box::new(self.errors_by_type.clone()))?;
        registry.register(Box::new(self.platform_availability.clone()))?;

        info!("Gateway metrics registered with Prometheus");
        Ok(())
    }
}

/// Circuit breaker states for metrics
#[derive(Debug, Clone, Copy)]
pub enum CircuitBreakerState {
    Closed,
    Open,
    HalfOpen,
}

/// Token operations for metrics
#[derive(Debug, Clone, Copy)]
pub enum TokenOperation {
    Encrypt,
    Decrypt,
    Rotate,
}

/// Get global metrics instance
pub fn metrics() -> &'static GatewayMetrics {
    &GATEWAY_METRICS
}

/// Request timer for automatic duration tracking
pub struct RequestTimer {
    platform: String,
    operation: String,
    start: DateTime<Utc>,
}

impl RequestTimer {
    pub fn start(platform: impl Into<String>, operation: impl Into<String>) -> Self {
        Self {
            platform: platform.into(),
            operation: operation.into(),
            start: Utc::now(),
        }
    }

    pub fn success(self) {
        let duration = (Utc::now() - self.start).num_milliseconds() as f64 / 1000.0;
        metrics().record_request(&self.platform, &self.operation, true, duration);
    }

    pub fn failure(self, error_type: &str) {
        let duration = (Utc::now() - self.start).num_milliseconds() as f64 / 1000.0;
        metrics().record_request(&self.platform, &self.operation, false, duration);
        metrics().record_failure(&self.platform, &self.operation, error_type);
    }
}

/// Platform metrics summary
#[derive(Debug, Clone)]
pub struct PlatformMetricsSummary {
    pub platform: String,
    pub total_requests: u64,
    pub success_rate: f64,
    pub avg_response_time: f64,
    pub error_rate: f64,
    pub availability: f64,
    pub active_connections: i64,
}

/// Metrics aggregator for reporting
pub struct MetricsAggregator {
    #[allow(dead_code)]
    metrics: Arc<GatewayMetrics>,
}

impl MetricsAggregator {
    pub fn new(metrics: Arc<GatewayMetrics>) -> Self {
        Self { metrics }
    }

    /// Get platform summary
    pub fn platform_summary(&self, platform: &str) -> PlatformMetricsSummary {
        // This would aggregate from Prometheus metrics
        // Simplified version for demonstration
        PlatformMetricsSummary {
            platform: platform.to_string(),
            total_requests: 0,
            success_rate: 0.0,
            avg_response_time: 0.0,
            error_rate: 0.0,
            availability: 1.0,
            active_connections: 0,
        }
    }

    /// Get all platform summaries
    pub fn all_summaries(&self) -> Vec<PlatformMetricsSummary> {
        vec![
            self.platform_summary("tiktok"),
            self.platform_summary("lazada"),
            self.platform_summary("shopee"),
            self.platform_summary("amazon"),
            self.platform_summary("shopify"),
            self.platform_summary("woocommerce"),
            self.platform_summary("esty"),
        ]
    }
}
