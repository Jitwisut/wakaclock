//! # Backpressure Manager - ตัวจัดการ Rate Limiting และ Backpressure
//!
//! Service สำหรับจัดการ rate limiting และ backpressure แยกตามแพลตฟอร์ม
//! เพื่อป้องกันการเรียก API เกินขีดจำกัดและจัดการ traffic อย่างมีประสิทธิภาพ
//!
//! ## หน้าที่หลัก
//! - จัดการ rate limiting สำหรับแต่ละแพลตฟอร์ม
//! - ควบคุม concurrent requests
//! - จัดการ backoff strategies เมื่อเกิด rate limit
//! - ติดตาม usage statistics และ metrics

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, Semaphore};
use tracing::{info, instrument, warn};

use crate::{
    infrastructure::logger::Logger,
    model::v1::platfrom::entries::{AppError, AppResult},
};

/// Platform-specific rate limiting and backpressure configuration - การกำหนดค่า rate limiting ตามแพลตฟอร์ม
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformLimits {
    pub platform: String,

    // Rate limiting
    pub requests_per_second: f64,
    pub requests_per_minute: u32,
    pub requests_per_hour: u32,
    pub burst_capacity: u32,

    // Concurrency limits
    pub max_concurrent_requests: usize,
    pub max_concurrent_list_requests: usize,
    pub max_concurrent_detail_requests: usize,

    // Backoff configuration
    pub base_backoff_ms: u64,
    pub max_backoff_ms: u64,
    pub backoff_multiplier: f64,
    pub jitter_enabled: bool,

    // Queue limits
    pub max_pending_requests: usize,
    pub queue_timeout_seconds: u64,

    // Health thresholds
    pub error_rate_threshold: f64, // 0.0-1.0
    pub latency_threshold_ms: u64,
    pub consecutive_errors_threshold: u32,
}

impl PlatformLimits {
    /// Default limits for different platform types
    pub fn for_platform(platform: &str) -> Self {
        match platform.to_lowercase().as_str() {
            "tiktok" => Self::tiktok_limits(),
            "shopify" => Self::shopify_limits(),
            "amazon" => Self::amazon_limits(),
            "lazada" => Self::lazada_limits(),
            "shopee" => Self::shopee_limits(),
            _ => Self::default_limits(),
        }
    }

    fn tiktok_limits() -> Self {
        Self {
            platform: "tiktok".to_string(),
            requests_per_second: 2.0, // Conservative for TikTok
            requests_per_minute: 120,
            requests_per_hour: 3600,
            burst_capacity: 10,
            max_concurrent_requests: 5,
            max_concurrent_list_requests: 2,
            max_concurrent_detail_requests: 3,
            base_backoff_ms: 1000,
            max_backoff_ms: 30000,
            backoff_multiplier: 2.0,
            jitter_enabled: true,
            max_pending_requests: 1000,
            queue_timeout_seconds: 300,
            error_rate_threshold: 0.1,
            latency_threshold_ms: 5000,
            consecutive_errors_threshold: 5,
        }
    }

    fn shopify_limits() -> Self {
        Self {
            platform: "shopify".to_string(),
            requests_per_second: 4.0, // Shopify is more generous
            requests_per_minute: 200,
            requests_per_hour: 10000,
            burst_capacity: 20,
            max_concurrent_requests: 10,
            max_concurrent_list_requests: 4,
            max_concurrent_detail_requests: 6,
            base_backoff_ms: 500,
            max_backoff_ms: 15000,
            backoff_multiplier: 1.5,
            jitter_enabled: true,
            max_pending_requests: 2000,
            queue_timeout_seconds: 180,
            error_rate_threshold: 0.15,
            latency_threshold_ms: 3000,
            consecutive_errors_threshold: 10,
        }
    }

    fn amazon_limits() -> Self {
        Self {
            platform: "amazon".to_string(),
            requests_per_second: 1.0, // Amazon SP-API is strict
            requests_per_minute: 60,
            requests_per_hour: 3600,
            burst_capacity: 5,
            max_concurrent_requests: 3,
            max_concurrent_list_requests: 1,
            max_concurrent_detail_requests: 2,
            base_backoff_ms: 2000,
            max_backoff_ms: 60000,
            backoff_multiplier: 2.5,
            jitter_enabled: true,
            max_pending_requests: 500,
            queue_timeout_seconds: 600,
            error_rate_threshold: 0.05,
            latency_threshold_ms: 10000,
            consecutive_errors_threshold: 3,
        }
    }

    fn lazada_limits() -> Self {
        Self {
            platform: "lazada".to_string(),
            requests_per_second: 3.0,
            requests_per_minute: 150,
            requests_per_hour: 5000,
            burst_capacity: 15,
            max_concurrent_requests: 8,
            max_concurrent_list_requests: 3,
            max_concurrent_detail_requests: 5,
            base_backoff_ms: 800,
            max_backoff_ms: 20000,
            backoff_multiplier: 1.8,
            jitter_enabled: true,
            max_pending_requests: 1500,
            queue_timeout_seconds: 240,
            error_rate_threshold: 0.12,
            latency_threshold_ms: 4000,
            consecutive_errors_threshold: 7,
        }
    }

    fn shopee_limits() -> Self {
        Self {
            platform: "shopee".to_string(),
            requests_per_second: 2.5,
            requests_per_minute: 100,
            requests_per_hour: 4000,
            burst_capacity: 12,
            max_concurrent_requests: 6,
            max_concurrent_list_requests: 2,
            max_concurrent_detail_requests: 4,
            base_backoff_ms: 1200,
            max_backoff_ms: 25000,
            backoff_multiplier: 2.2,
            jitter_enabled: true,
            max_pending_requests: 1200,
            queue_timeout_seconds: 300,
            error_rate_threshold: 0.08,
            latency_threshold_ms: 6000,
            consecutive_errors_threshold: 5,
        }
    }

    fn default_limits() -> Self {
        Self {
            platform: "default".to_string(),
            requests_per_second: 2.0,
            requests_per_minute: 100,
            requests_per_hour: 3000,
            burst_capacity: 10,
            max_concurrent_requests: 5,
            max_concurrent_list_requests: 2,
            max_concurrent_detail_requests: 3,
            base_backoff_ms: 1000,
            max_backoff_ms: 30000,
            backoff_multiplier: 2.0,
            jitter_enabled: true,
            max_pending_requests: 1000,
            queue_timeout_seconds: 300,
            error_rate_threshold: 0.1,
            latency_threshold_ms: 5000,
            consecutive_errors_threshold: 5,
        }
    }
}

/// Rate limiter using token bucket algorithm
pub struct TokenBucket {
    capacity: u32,
    tokens: Arc<RwLock<f64>>,
    refill_rate: f64, // tokens per second
    last_refill: Arc<RwLock<DateTime<Utc>>>,
}

impl TokenBucket {
    pub fn new(capacity: u32, refill_rate: f64) -> Self {
        Self {
            capacity,
            tokens: Arc::new(RwLock::new(capacity as f64)),
            refill_rate,
            last_refill: Arc::new(RwLock::new(Utc::now())),
        }
    }

    /// Try to acquire tokens, returns true if successful
    pub async fn try_acquire(&self, tokens_needed: u32) -> bool {
        self.refill_tokens().await;

        let mut tokens_guard = self.tokens.write().await;
        if *tokens_guard >= tokens_needed as f64 {
            *tokens_guard -= tokens_needed as f64;
            true
        } else {
            false
        }
    }

    /// Wait until tokens are available, with timeout
    pub async fn acquire_with_timeout(
        &self,
        tokens_needed: u32,
        timeout: Duration,
    ) -> AppResult<()> {
        let start_time = Utc::now();

        while (Utc::now() - start_time) < timeout {
            if self.try_acquire(tokens_needed).await {
                return Ok(());
            }

            // Wait for token refill
            let wait_time = 1000.0 / self.refill_rate; // milliseconds to wait for 1 token
            tokio::time::sleep(std::time::Duration::from_millis(wait_time as u64)).await;
        }

        Err(AppError::RateLimitError("Token bucket timeout".to_string()))
    }

    async fn refill_tokens(&self) {
        let now = Utc::now();
        let mut last_refill_guard = self.last_refill.write().await;
        let time_elapsed = (now - *last_refill_guard).num_milliseconds() as f64 / 1000.0;

        if time_elapsed > 0.0 {
            let tokens_to_add = time_elapsed * self.refill_rate;
            let mut tokens_guard = self.tokens.write().await;
            *tokens_guard = (*tokens_guard + tokens_to_add).min(self.capacity as f64);
            *last_refill_guard = now;
        }
    }
}

/// Platform health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformHealth {
    pub platform: String,
    pub status: HealthStatus,
    pub error_rate: f64,
    pub avg_latency_ms: f64,
    pub consecutive_errors: u32,
    pub last_success_at: Option<DateTime<Utc>>,
    pub last_error_at: Option<DateTime<Utc>>,
    pub current_backoff_ms: u64,
    pub next_allowed_request: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
    CircuitOpen,
}

/// Backpressure manager for handling platform limits and health
pub struct BackpressureManager {
    platform_limits: HashMap<String, PlatformLimits>,
    token_buckets: HashMap<String, Arc<TokenBucket>>,
    concurrency_limiters: HashMap<String, Arc<Semaphore>>,
    platform_health: Arc<RwLock<HashMap<String, PlatformHealth>>>,
    logger: Arc<Logger>,
}

impl BackpressureManager {
    pub fn new() -> Self {
        Self {
            platform_limits: HashMap::new(),
            token_buckets: HashMap::new(),
            concurrency_limiters: HashMap::new(),
            platform_health: Arc::new(RwLock::new(HashMap::new())),
            logger: crate::infrastructure::logger::global(),
        }
    }

    /// Initialize platform with its limits
    pub fn add_platform(&mut self, platform: &str) {
        let limits = PlatformLimits::for_platform(platform);

        // Create token bucket for rate limiting
        let token_bucket = Arc::new(TokenBucket::new(
            limits.burst_capacity,
            limits.requests_per_second,
        ));

        // Create semaphore for concurrency limiting
        let semaphore = Arc::new(Semaphore::new(limits.max_concurrent_requests));

        // Initialize health status
        let health = PlatformHealth {
            platform: platform.to_string(),
            status: HealthStatus::Healthy,
            error_rate: 0.0,
            avg_latency_ms: 0.0,
            consecutive_errors: 0,
            last_success_at: None,
            last_error_at: None,
            current_backoff_ms: 0,
            next_allowed_request: Utc::now(),
        };
        self.logger.info(
            &format!(
                "Initialized backpressure management for platform: {}",
                platform
            ),
            None,
        );
        tokio::spawn({
            let platform_health = self.platform_health.clone();
            let platform_name = platform.to_string();
            async move {
                let mut health_guard = platform_health.write().await;
                health_guard.insert(platform_name, health);
            }
        });

        self.platform_limits.insert(platform.to_string(), limits);
        self.token_buckets
            .insert(platform.to_string(), token_bucket);
        self.concurrency_limiters
            .insert(platform.to_string(), semaphore);

        self.logger.info(
            &format!(
                "Initialized backpressure management for platform: {}",
                platform
            ),
            None,
        );
    }

    /// Acquire permission to make a request to a platform
    #[instrument(skip(self))]
    pub async fn acquire_request_permission(
        &self,
        platform: &str,
        request_type: RequestType,
    ) -> AppResult<RequestPermit> {
        // Check platform health first
        self.check_platform_health(platform).await?;

        // Get platform limits
        let limits = self
            .platform_limits
            .get(platform)
            .ok_or_else(|| AppError::BadRequest(format!("Platform {} not configured", platform)))?;

        // Apply rate limiting
        let token_bucket = self
            .token_buckets
            .get(platform)
            .ok_or_else(|| AppError::InternalError("Token bucket not found".to_string()))?;

        let timeout = Duration::seconds(limits.queue_timeout_seconds as i64);
        token_bucket.acquire_with_timeout(1, timeout).await?;

        // Apply concurrency limiting
        let semaphore = self
            .concurrency_limiters
            .get(platform)
            .ok_or_else(|| AppError::InternalError("Semaphore not found".to_string()))?;

        let permit = semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|_| AppError::RateLimitError("Concurrency limit reached".to_string()))?;

        info!(
            "Acquired request permission for {} ({})",
            platform, request_type as u8
        );

        Ok(RequestPermit {
            platform: platform.to_string(),
            request_type,
            acquired_at: Utc::now(),
            _permit: permit,
        })
    }

    /// Check if platform is healthy enough to accept requests
    async fn check_platform_health(&self, platform: &str) -> AppResult<()> {
        let health_guard = self.platform_health.read().await;

        if let Some(health) = health_guard.get(platform) {
            match health.status {
                HealthStatus::CircuitOpen => {
                    if Utc::now() < health.next_allowed_request {
                        return Err(AppError::RateLimitError(format!(
                            "Circuit breaker open for {} until {}",
                            platform, health.next_allowed_request
                        )));
                    }
                }
                HealthStatus::Unhealthy => {
                    if health.consecutive_errors > 10 {
                        return Err(AppError::ExternalServiceError(format!(
                            "Platform {} is unhealthy",
                            platform
                        )));
                    }
                }
                _ => {} // Healthy or degraded - allow requests
            }
        }

        Ok(())
    }

    /// Record successful request for health tracking
    #[instrument(skip(self))]
    pub async fn record_success(&self, platform: &str, latency_ms: u64) -> AppResult<()> {
        let mut health_guard = self.platform_health.write().await;

        if let Some(health) = health_guard.get_mut(platform) {
            health.last_success_at = Some(Utc::now());
            health.consecutive_errors = 0;
            health.current_backoff_ms = 0;
            health.next_allowed_request = Utc::now();

            // Update moving average for latency
            health.avg_latency_ms = (health.avg_latency_ms * 0.9) + (latency_ms as f64 * 0.1);

            // Update health status based on latency
            let limits = self.platform_limits.get(platform).unwrap();
            if health.avg_latency_ms > limits.latency_threshold_ms as f64 {
                health.status = HealthStatus::Degraded;
            } else {
                health.status = HealthStatus::Healthy;
            }

            info!(
                "Recorded success for {} (latency: {}ms)",
                platform, latency_ms
            );
        }

        Ok(())
    }

    /// Record failed request for health tracking and backoff calculation
    #[instrument(skip(self))]
    pub async fn record_failure(&self, platform: &str, error: &AppError) -> AppResult<()> {
        let mut health_guard = self.platform_health.write().await;

        if let Some(health) = health_guard.get_mut(platform) {
            health.last_error_at = Some(Utc::now());
            health.consecutive_errors += 1;

            let limits = self.platform_limits.get(platform).unwrap();

            // Calculate exponential backoff
            let backoff_base = limits.base_backoff_ms as f64;
            let multiplier = limits.backoff_multiplier;
            let max_backoff = limits.max_backoff_ms as f64;

            health.current_backoff_ms = (backoff_base
                * multiplier.powi(health.consecutive_errors as i32 - 1))
            .min(max_backoff) as u64;

            // Add jitter if enabled
            if limits.jitter_enabled {
                use rand::Rng;
                let mut rng = rand::thread_rng();
                let jitter: f64 = rng.gen::<f64>() * 0.1; // 10% jitter
                health.current_backoff_ms =
                    (health.current_backoff_ms as f64 * (1.0 + jitter)) as u64;
            }

            health.next_allowed_request =
                Utc::now() + Duration::milliseconds(health.current_backoff_ms as i64);

            // Update health status
            if health.consecutive_errors >= limits.consecutive_errors_threshold {
                health.status = HealthStatus::CircuitOpen;
                warn!(
                    "Circuit breaker opened for {} after {} consecutive errors",
                    platform, health.consecutive_errors
                );
            } else if health.consecutive_errors > 2 {
                health.status = HealthStatus::Unhealthy;
            } else {
                health.status = HealthStatus::Degraded;
            }

            warn!(
                "Recorded failure for {} (consecutive errors: {}, backoff: {}ms)",
                platform, health.consecutive_errors, health.current_backoff_ms
            );
        }

        Ok(())
    }

    /// Get current platform health status
    pub async fn get_platform_health(&self, platform: &str) -> AppResult<PlatformHealth> {
        let health_guard = self.platform_health.read().await;
        health_guard
            .get(platform)
            .cloned()
            .ok_or_else(|| AppError::BadRequest(format!("Platform {} not found", platform)))
    }

    /// Get health status for all platforms
    pub async fn get_all_platform_health(&self) -> HashMap<String, PlatformHealth> {
        let health_guard = self.platform_health.read().await;
        health_guard.clone()
    }

    /// Check if platform should be throttled based on downstream lag
    pub async fn should_throttle_based_on_lag(&self, platform: &str, downstream_lag: u64) -> bool {
        // Throttle if downstream consumer has too much lag
        let lag_threshold = 5000; // Configurable threshold

        if downstream_lag > lag_threshold {
            warn!(
                "Throttling {} due to downstream lag: {}",
                platform, downstream_lag
            );
            return true;
        }

        false
    }

    /// Reset circuit breaker manually (admin operation)
    pub async fn reset_circuit_breaker(&self, platform: &str) -> AppResult<()> {
        let mut health_guard = self.platform_health.write().await;

        if let Some(health) = health_guard.get_mut(platform) {
            health.status = HealthStatus::Healthy;
            health.consecutive_errors = 0;
            health.current_backoff_ms = 0;
            health.next_allowed_request = Utc::now();

            info!("Circuit breaker reset for platform: {}", platform);
        }

        Ok(())
    }

    /// Update platform limits dynamically
    pub async fn update_platform_limits(
        &mut self,
        platform: &str,
        new_limits: PlatformLimits,
    ) -> AppResult<()> {
        // Update token bucket
        let new_bucket = Arc::new(TokenBucket::new(
            new_limits.burst_capacity,
            new_limits.requests_per_second,
        ));

        // Update semaphore
        let new_semaphore = Arc::new(Semaphore::new(new_limits.max_concurrent_requests));

        self.platform_limits
            .insert(platform.to_string(), new_limits);
        self.token_buckets.insert(platform.to_string(), new_bucket);
        self.concurrency_limiters
            .insert(platform.to_string(), new_semaphore);

        info!("Updated limits for platform: {}", platform);
        Ok(())
    }

    /// Check if a sync can proceed based on backpressure
    pub async fn check_backpressure(
        &self,
        _tenant_id: &str,
        platform: &str,
    ) -> AppResult<crate::services::product_sync::coordinator::BackpressureStatus> {
        use crate::services::product_sync::coordinator::{BackpressureMetrics, BackpressureStatus};

        let health = self.get_platform_health(platform).await?;
        let mut can_proceed = true;
        let mut reason = None;
        let mut suggested_delay_ms = None;

        // Check circuit breaker status
        match health.status {
            HealthStatus::CircuitOpen => {
                can_proceed = false;
                reason = Some(format!(
                    "Circuit breaker open until {}",
                    health.next_allowed_request
                ));
                suggested_delay_ms = Some(health.current_backoff_ms);
            }
            HealthStatus::Unhealthy => {
                if health.consecutive_errors > 5 {
                    can_proceed = false;
                    reason = Some(format!(
                        "Too many consecutive errors: {}",
                        health.consecutive_errors
                    ));
                    suggested_delay_ms = Some(health.current_backoff_ms);
                }
            }
            _ => {}
        }

        let metrics = BackpressureMetrics {
            detail_queue_depth: 0,   // TODO: get from actual queue
            current_throughput: 0.0, // TODO: calculate actual throughput
            error_rate: health.error_rate,
            platform_rate_limit_remaining: None, // TODO: track actual rate limits
        };

        Ok(BackpressureStatus {
            can_proceed,
            reason,
            suggested_delay_ms,
            metrics,
        })
    }
}

/// Request type for different types of API calls
#[derive(Debug, Clone, Copy)]
pub enum RequestType {
    ListProducts = 1,
    GetProductDetail = 2,
    OAuth = 3,
    Other = 4,
}

/// Request permit that must be held while making API calls
pub struct RequestPermit {
    pub platform: String,
    pub request_type: RequestType,
    pub acquired_at: DateTime<Utc>,
    _permit: tokio::sync::OwnedSemaphorePermit,
}

impl Drop for RequestPermit {
    fn drop(&mut self) {
        // Permit is automatically released when dropped
    }
}

impl Default for BackpressureManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Builder for configuring backpressure manager
pub struct BackpressureManagerBuilder {
    platforms: Vec<String>,
}

impl BackpressureManagerBuilder {
    pub fn new() -> Self {
        Self {
            platforms: Vec::new(),
        }
    }

    pub fn add_platform(mut self, platform: &str) -> Self {
        self.platforms.push(platform.to_string());
        self
    }

    pub fn build(self) -> BackpressureManager {
        let mut manager = BackpressureManager::new();

        for platform in self.platforms {
            manager.add_platform(&platform);
        }

        manager
    }
}

impl Default for BackpressureManagerBuilder {
    fn default() -> Self {
        Self::new()
    }
}
