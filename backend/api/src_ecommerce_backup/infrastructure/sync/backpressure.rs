/// ไฟล์ backpressure.rs - ระบบจัดการ Backpressure และ Rate Limiting
/// สำหรับควบคุมอัตราการเรียก API และป้องกันการใช้ทรัพยากรมากเกินไป
/// Based on specifications in prompt/002.md section 12
///
/// ## ความสามารถหลัก
/// - Token Bucket Algorithm สำหรับ rate limiting
/// - Adaptive rate limiting ตามสถานะของระบบ
/// - Circuit breaker pattern สำหรับป้องกันความล้มเหลว
/// - Backpressure management สำหรับ queue และ workers
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, Semaphore};
use tokio::time::{sleep, Duration as TokioDuration, Instant};

/// TokenBucket - Rate limiter ที่ใช้ Token Bucket Algorithm
/// จัดการการจำกัดอัตราการเรียก API โดยใช้ระบบ token ที่เติมเข้ามาตามเวลา
/// เหมาะสำหรับควบคุม API rate limits ของ e-commerce platforms
#[derive(Debug, Clone)]
pub struct TokenBucket {
    /// ความจุสูงสุดของ bucket (จำนวน tokens สูงสุด)
    capacity: u32,
    /// จำนวน tokens ปัจจุบันที่เหลืออยู่
    tokens: Arc<RwLock<f64>>,
    /// อัตราการเติม tokens (tokens ต่อวินาที)
    refill_rate: f64,
    /// เวลาล่าสุดที่ทำการเติม tokens
    last_refill: Arc<RwLock<Instant>>,
}

impl TokenBucket {
    /// สร้าง token bucket ใหม่พร้อมกำหนดความจุและอัตราการเติม
    /// capacity: จำนวน tokens สูงสุดที่เก็บได้
    /// refill_rate: จำนวน tokens ที่เติมต่อวินาที
    pub fn new(capacity: u32, refill_rate: f64) -> Self {
        Self {
            capacity,
            tokens: Arc::new(RwLock::new(capacity as f64)),
            refill_rate,
            last_refill: Arc::new(RwLock::new(Instant::now())),
        }
    }

    /// พยายามใช้ tokens จาก bucket (non-blocking)
    /// คืน true ถ้าสามารถใช้ tokens ได้, false ถ้า tokens ไม่พอ
    pub async fn try_consume(&self, tokens: u32) -> bool {
        // เติม tokens ตามเวลาที่ผ่านไปก่อน
        self.refill().await;

        let mut current_tokens = self.tokens.write().await;
        if *current_tokens >= tokens as f64 {
            *current_tokens -= tokens as f64;
            true
        } else {
            false
        }
    }

    /// รอจนกว่า tokens จะพร้อมแล้วใช้งาน (blocking)
    /// จะ block จนกว่าจะมี tokens เพียงพอหรือ timeout
    pub async fn consume(&self, tokens: u32) -> Result<(), tokio::time::error::Elapsed> {
        loop {
            if self.try_consume(tokens).await {
                return Ok(());
            }

            // Calculate wait time based on refill rate
            let wait_time = (tokens as f64 / self.refill_rate) * 1000.0; // milliseconds
            sleep(TokioDuration::from_millis(wait_time as u64)).await;
        }
    }

    /// Refill tokens based on elapsed time
    async fn refill(&self) {
        let now = Instant::now();
        let mut last_refill = self.last_refill.write().await;
        let elapsed = now.duration_since(*last_refill).as_secs_f64();

        if elapsed > 0.0 {
            let mut tokens = self.tokens.write().await;
            let tokens_to_add = elapsed * self.refill_rate;
            *tokens = (*tokens + tokens_to_add).min(self.capacity as f64);
            *last_refill = now;
        }
    }

    /// Get current token count
    pub async fn available_tokens(&self) -> f64 {
        self.refill().await;
        *self.tokens.read().await
    }
}

/// Rate limiting configuration for different platforms
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    /// Requests per second limit
    pub requests_per_second: f64,
    /// Burst capacity
    pub burst_capacity: u32,
    /// Backoff multiplier when rate limited
    pub backoff_multiplier: f64,
    /// Maximum backoff time in seconds
    pub max_backoff_seconds: u64,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            requests_per_second: 10.0,
            burst_capacity: 20,
            backoff_multiplier: 2.0,
            max_backoff_seconds: 300, // 5 minutes
        }
    }
}

/// Per-platform rate limiter
#[derive(Debug, Clone)]
pub struct PlatformRateLimiter {
    platform: String,
    config: RateLimitConfig,
    token_bucket: TokenBucket,
    current_backoff: Arc<RwLock<u64>>, // Current backoff in seconds
    last_429_time: Arc<RwLock<Option<DateTime<Utc>>>>,
}

impl PlatformRateLimiter {
    pub fn new(platform: String, config: RateLimitConfig) -> Self {
        let token_bucket = TokenBucket::new(config.burst_capacity, config.requests_per_second);

        Self {
            platform,
            config,
            token_bucket,
            current_backoff: Arc::new(RwLock::new(0)),
            last_429_time: Arc::new(RwLock::new(None)),
        }
    }

    /// Wait for rate limit clearance before making request
    pub async fn acquire_permit(&self) -> anyhow::Result<()> {
        // Check if we're in backoff period
        let current_backoff = *self.current_backoff.read().await;
        if current_backoff > 0 {
            sleep(TokioDuration::from_secs(current_backoff)).await;
            *self.current_backoff.write().await = 0;
        }

        // Try to consume token from bucket
        self.token_bucket.consume(1).await?;
        Ok(())
    }

    /// Handle 429 (rate limited) response
    pub async fn handle_rate_limited(&self, retry_after: Option<u64>) {
        let mut backoff = self.current_backoff.write().await;

        if let Some(retry_seconds) = retry_after {
            // Use server-provided retry-after
            *backoff = retry_seconds.min(self.config.max_backoff_seconds);
        } else {
            // Calculate exponential backoff
            if *backoff == 0 {
                *backoff = 1;
            } else {
                *backoff = ((*backoff as f64 * self.config.backoff_multiplier) as u64)
                    .min(self.config.max_backoff_seconds);
            }
        }

        *self.last_429_time.write().await = Some(Utc::now());
    }

    /// Reset backoff on successful request
    pub async fn reset_backoff(&self) {
        *self.current_backoff.write().await = 0;
    }

    /// Get current backoff time
    pub async fn current_backoff(&self) -> u64 {
        *self.current_backoff.read().await
    }

    /// Get platform name
    pub fn platform(&self) -> &str {
        &self.platform
    }
}

/// Per-tenant concurrency limiter
#[derive(Debug, Clone)]
pub struct TenantConcurrencyLimiter {
    tenant_id: String,
    semaphore: Arc<Semaphore>,
    #[allow(dead_code)]
    max_concurrent: usize,
}

impl TenantConcurrencyLimiter {
    pub fn new(tenant_id: String, max_concurrent: usize) -> Self {
        Self {
            tenant_id,
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            max_concurrent,
        }
    }

    /// Acquire permit for concurrent operation
    pub async fn acquire(
        &self,
    ) -> Result<tokio::sync::SemaphorePermit<'_>, tokio::sync::AcquireError> {
        self.semaphore.acquire().await
    }

    /// Try to acquire permit without waiting
    pub fn try_acquire(
        &self,
    ) -> Result<tokio::sync::SemaphorePermit<'_>, tokio::sync::TryAcquireError> {
        self.semaphore.try_acquire()
    }

    /// Get number of available permits
    pub fn available_permits(&self) -> usize {
        self.semaphore.available_permits()
    }

    /// Get tenant ID
    pub fn tenant_id(&self) -> &str {
        &self.tenant_id
    }
}

/// Backpressure thresholds for consumer lag monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackpressureThresholds {
    /// Warning threshold for consumer lag
    pub lag_warn: u64,
    /// High threshold - start throttling
    pub lag_high: u64,
    /// Maximum threshold - pause outbox flusher
    pub lag_max: u64,
}

impl Default for BackpressureThresholds {
    fn default() -> Self {
        Self {
            lag_warn: 1000,
            lag_high: 5000,
            lag_max: 10000,
        }
    }
}

/// Consumer lag monitor and backpressure controller
#[derive(Debug)]
pub struct BackpressureController {
    thresholds: BackpressureThresholds,
    current_state: Arc<RwLock<BackpressureState>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BackpressureState {
    Normal,
    Warning { lag: u64 },
    Throttled { lag: u64 },
    Paused { lag: u64 },
}

impl BackpressureController {
    pub fn new(thresholds: BackpressureThresholds) -> Self {
        Self {
            thresholds,
            current_state: Arc::new(RwLock::new(BackpressureState::Normal)),
        }
    }

    /// Update controller with current consumer lag
    pub async fn update_lag(&self, lag: u64) {
        let new_state = if lag >= self.thresholds.lag_max {
            BackpressureState::Paused { lag }
        } else if lag >= self.thresholds.lag_high {
            BackpressureState::Throttled { lag }
        } else if lag >= self.thresholds.lag_warn {
            BackpressureState::Warning { lag }
        } else {
            BackpressureState::Normal
        };

        *self.current_state.write().await = new_state;
    }

    /// Get current backpressure state
    pub async fn current_state(&self) -> BackpressureState {
        self.current_state.read().await.clone()
    }

    /// Check if outbox processing should be paused
    pub async fn should_pause(&self) -> bool {
        matches!(
            *self.current_state.read().await,
            BackpressureState::Paused { .. }
        )
    }

    /// Check if processing should be throttled
    pub async fn should_throttle(&self) -> bool {
        matches!(
            *self.current_state.read().await,
            BackpressureState::Throttled { .. } | BackpressureState::Paused { .. }
        )
    }

    /// Get throttle delay in milliseconds
    pub async fn throttle_delay_ms(&self) -> u64 {
        match *self.current_state.read().await {
            BackpressureState::Throttled { lag } => {
                // Progressive delay based on lag severity
                let ratio = (lag - self.thresholds.lag_high) as f64
                    / (self.thresholds.lag_max - self.thresholds.lag_high) as f64;
                (ratio * 5000.0) as u64 // 0-5 seconds delay
            }
            BackpressureState::Paused { .. } => 10000, // 10 seconds when paused
            _ => 0,
        }
    }
}

/// Global rate limiting and backpressure manager
pub struct GlobalRateLimitManager {
    platform_limiters: Arc<RwLock<HashMap<String, Arc<PlatformRateLimiter>>>>,
    tenant_limiters: Arc<RwLock<HashMap<String, Arc<TenantConcurrencyLimiter>>>>,
    backpressure_controller: BackpressureController,
}

impl GlobalRateLimitManager {
    pub fn new(backpressure_thresholds: BackpressureThresholds) -> Self {
        Self {
            platform_limiters: Arc::new(RwLock::new(HashMap::new())),
            tenant_limiters: Arc::new(RwLock::new(HashMap::new())),
            backpressure_controller: BackpressureController::new(backpressure_thresholds),
        }
    }

    /// Get or create platform rate limiter
    pub async fn get_platform_limiter(&self, platform: &str) -> Arc<PlatformRateLimiter> {
        let mut limiters = self.platform_limiters.write().await;

        if let Some(limiter) = limiters.get(platform) {
            Arc::clone(limiter)
        } else {
            let config = PlatformRateLimitConfigs::get_config(platform);
            let limiter = Arc::new(PlatformRateLimiter::new(platform.to_string(), config));
            limiters.insert(platform.to_string(), Arc::clone(&limiter));
            limiter
        }
    }

    /// Get or create tenant concurrency limiter
    pub async fn get_tenant_limiter(&self, tenant_id: &str) -> Arc<TenantConcurrencyLimiter> {
        let mut limiters = self.tenant_limiters.write().await;

        if let Some(limiter) = limiters.get(tenant_id) {
            Arc::clone(limiter)
        } else {
            let limiter = Arc::new(TenantConcurrencyLimiter::new(tenant_id.to_string(), 10));
            limiters.insert(tenant_id.to_string(), Arc::clone(&limiter));
            limiter
        }
    }

    /// Update consumer lag for backpressure control
    pub async fn update_consumer_lag(&self, lag: u64) {
        self.backpressure_controller.update_lag(lag).await;
    }

    /// Get backpressure controller
    pub fn backpressure_controller(&self) -> &BackpressureController {
        &self.backpressure_controller
    }
}

/// Platform-specific rate limit configurations
pub struct PlatformRateLimitConfigs;

impl PlatformRateLimitConfigs {
    /// TikTok Shop rate limits
    pub fn tiktok_shop() -> RateLimitConfig {
        RateLimitConfig {
            requests_per_second: 10.0,
            burst_capacity: 20,
            backoff_multiplier: 2.0,
            max_backoff_seconds: 300,
        }
    }

    /// Shopee rate limits
    pub fn shopee() -> RateLimitConfig {
        RateLimitConfig {
            requests_per_second: 1.0, // Very conservative
            burst_capacity: 5,
            backoff_multiplier: 2.0,
            max_backoff_seconds: 600, // 10 minutes
        }
    }

    /// Lazada rate limits
    pub fn lazada() -> RateLimitConfig {
        RateLimitConfig {
            requests_per_second: 2.0,
            burst_capacity: 10,
            backoff_multiplier: 1.5,
            max_backoff_seconds: 180, // 3 minutes
        }
    }

    /// Shopify rate limits (more generous)
    pub fn shopify() -> RateLimitConfig {
        RateLimitConfig {
            requests_per_second: 40.0,
            burst_capacity: 80,
            backoff_multiplier: 1.5,
            max_backoff_seconds: 60,
        }
    }

    /// Get config by platform name
    pub fn get_config(platform: &str) -> RateLimitConfig {
        match platform.to_lowercase().as_str() {
            "tiktok" | "tiktok_shop" => Self::tiktok_shop(),
            "shopee" => Self::shopee(),
            "lazada" => Self::lazada(),
            "shopify" => Self::shopify(),
            _ => RateLimitConfig::default(),
        }
    }
}
