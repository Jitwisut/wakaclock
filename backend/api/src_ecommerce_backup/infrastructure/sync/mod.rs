use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Sync state management trait for Redis operations
#[async_trait]
pub trait SyncStateManager: Send + Sync {
    /// Update sync stats atomically
    async fn update_sync_stats(&self, key: &SyncStatsKey, stats: &SyncStats) -> anyhow::Result<()>;

    /// Get sync stats
    async fn get_sync_stats(&self, key: &SyncStatsKey) -> anyhow::Result<Option<SyncStats>>;

    /// Get idempotency set for processed products
    async fn check_processed(
        &self,
        key: &IdempotencyKey,
        product_ids: &[String],
    ) -> anyhow::Result<Vec<bool>>;

    /// Add product IDs to idempotency set
    async fn mark_processed(
        &self,
        key: &IdempotencyKey,
        product_ids: &[String],
    ) -> anyhow::Result<()>;

    /// Update live run status with heartbeat
    async fn update_run_status(&self, key: &RunStatusKey, status: &RunStatus)
        -> anyhow::Result<()>;

    /// Get live run status
    async fn get_run_status(&self, key: &RunStatusKey) -> anyhow::Result<Option<RunStatus>>;

    /// Acquire distributed lock
    async fn acquire_lock(&self, key: &LockKey, token: &str, ttl_ms: u64) -> anyhow::Result<bool>;

    /// Renew distributed lock
    async fn renew_lock(&self, key: &LockKey, token: &str, ttl_ms: u64) -> anyhow::Result<bool>;

    /// Release distributed lock
    async fn release_lock(&self, key: &LockKey, token: &str) -> anyhow::Result<bool>;

    /// Add entry to progress stream
    async fn add_progress_entry(
        &self,
        key: &ProgressKey,
        entry: &ProgressEntry,
    ) -> anyhow::Result<()>;

    /// Fetch progress entries for real-time monitoring
    async fn list_progress_entries(
        &self,
        key: &ProgressKey,
        limit: usize,
        cursor: Option<String>,
    ) -> anyhow::Result<Vec<ProgressRecord>>;
}

/// Sync stats key structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatsKey {
    pub tenant: String,
    pub platform: String,
    pub shop: String,
}

impl SyncStatsKey {
    pub fn to_key(&self) -> String {
        format!("sync:stats:{}:{}:{}", self.tenant, self.platform, self.shop)
    }
}

/// Sync statistics structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStats {
    pub last_committed_lower: Option<String>, // ISO8601
    pub last_committed_upper: Option<String>, // ISO8601
    pub current_cursor: Option<String>,
    pub current_offset: Option<i64>,
    pub page_seq: u32,
    pub status: String,
    pub total_items: u64,
    pub version: u64,
    pub resource: String, // "list" or "detail"
    pub updated_at: u64,  // Unix timestamp in milliseconds
}

/// Idempotency key for processed products
#[derive(Debug, Clone)]
pub struct IdempotencyKey {
    pub tenant: String,
    pub platform: String,
    pub shop: String,
    pub checkpint_batch: String,
}

impl IdempotencyKey {
    pub fn to_key(&self) -> String {
        format!(
            "sync:seen:{}:{}:{}:{}",
            self.tenant, self.platform, self.shop, self.checkpint_batch
        )
    }
}

/// Run status key for live execution tracking
#[derive(Debug, Clone)]
pub struct RunStatusKey {
    pub tenant: String,
    pub platform: String,
    pub shop: String,
}

impl RunStatusKey {
    pub fn to_key(&self) -> String {
        format!("sync:run:{}:{}:{}", self.tenant, self.platform, self.shop)
    }
}

/// Live run status structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunStatus {
    pub state: RunState,
    pub run_id: String, // UUID
    pub worker_id: String,
    pub lower_ts: Option<String>, // ISO8601
    pub upper_ts: Option<String>, // ISO8601
    pub page_seq: u32,
    pub current_cursor: Option<String>,
    pub current_offset: Option<i64>,
    // Counters
    pub items_total: u64,
    pub items_list_only: u64,
    pub items_detail_enqueued: u64,
    pub items_detail_skipped: u64,
    pub lag_detail_consumer: u64,
    pub backoff_seconds: u32,
    // Timestamps
    pub started_at: u64,   // Unix timestamp in milliseconds
    pub updated_at: u64,   // Unix timestamp in milliseconds
    pub heartbeat_ts: u64, // Unix timestamp in milliseconds
    // Error info
    pub last_error_code: Option<String>,
    pub last_error_msg: Option<String>,
}

/// Run state enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RunState {
    Idle,
    Running,
    Throttled,
    Error,
    Paused,
}

/// Lock key for distributed locking
#[derive(Debug, Clone)]
pub struct LockKey {
    pub tenant: String,
    pub platform: String,
    pub shop: String,
}

impl LockKey {
    pub fn to_key(&self) -> String {
        format!("sync:lock:{}:{}:{}", self.tenant, self.platform, self.shop)
    }
}

/// Progress key for progress stream
#[derive(Debug, Clone)]
pub struct ProgressKey {
    pub tenant: String,
    pub platform: String,
    pub shop: String,
}

impl ProgressKey {
    pub fn to_key(&self) -> String {
        format!(
            "sync:progress:{}:{}:{}",
            self.tenant, self.platform, self.shop
        )
    }
}

/// Progress entry for progress stream
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEntry {
    pub page_seq: u32,
    pub items_emitted: u64,
    pub cursor: Option<String>,
    pub offset: Option<i64>,
    pub duration_ms: u64,
    pub detail_enqueued: u64,
    pub snapshot_upserts: u64,
    pub errors: u64,
}

/// Progress record including stream identifier
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressRecord {
    pub id: String,
    pub entry: ProgressEntry,
}

/// Sync configuration constants
pub struct SyncConfig {
    pub status_ttl_secs: u64,
    pub lock_ttl_ms: u64,
    pub heartbeat_interval_secs: u64,
    pub stream_maxlen: u64,
}

/// Noop implementation used when Redis is unavailable
#[derive(Default)]
pub struct NoopSyncStateManager;

#[async_trait]
impl SyncStateManager for NoopSyncStateManager {
    async fn update_sync_stats(
        &self,
        _key: &SyncStatsKey,
        _stats: &SyncStats,
    ) -> anyhow::Result<()> {
        Ok(())
    }

    async fn get_sync_stats(&self, _key: &SyncStatsKey) -> anyhow::Result<Option<SyncStats>> {
        Ok(None)
    }

    async fn check_processed(
        &self,
        _key: &IdempotencyKey,
        product_ids: &[String],
    ) -> anyhow::Result<Vec<bool>> {
        Ok(vec![false; product_ids.len()])
    }

    async fn mark_processed(
        &self,
        _key: &IdempotencyKey,
        _product_ids: &[String],
    ) -> anyhow::Result<()> {
        Ok(())
    }

    async fn update_run_status(
        &self,
        _key: &RunStatusKey,
        _status: &RunStatus,
    ) -> anyhow::Result<()> {
        Ok(())
    }

    async fn get_run_status(&self, _key: &RunStatusKey) -> anyhow::Result<Option<RunStatus>> {
        Ok(None)
    }

    async fn acquire_lock(
        &self,
        _key: &LockKey,
        _token: &str,
        _ttl_ms: u64,
    ) -> anyhow::Result<bool> {
        Ok(true)
    }

    async fn renew_lock(&self, _key: &LockKey, _token: &str, _ttl_ms: u64) -> anyhow::Result<bool> {
        Ok(true)
    }

    async fn release_lock(&self, _key: &LockKey, _token: &str) -> anyhow::Result<bool> {
        Ok(true)
    }

    async fn add_progress_entry(
        &self,
        _key: &ProgressKey,
        _entry: &ProgressEntry,
    ) -> anyhow::Result<()> {
        Ok(())
    }

    async fn list_progress_entries(
        &self,
        _key: &ProgressKey,
        _limit: usize,
        _cursor: Option<String>,
    ) -> anyhow::Result<Vec<ProgressRecord>> {
        Ok(Vec::new())
    }
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            status_ttl_secs: 86400, // 24 hours
            lock_ttl_ms: 15000,     // 15 seconds
            heartbeat_interval_secs: 5,
            stream_maxlen: 10000,
        }
    }
}

pub mod backpressure;
pub mod metrics;
pub mod pagination;
pub mod redis_sync;
pub mod selective_detail;

pub use backpressure::{
    BackpressureController, BackpressureState, BackpressureThresholds, GlobalRateLimitManager,
    PlatformRateLimitConfigs, PlatformRateLimiter, RateLimitConfig, TenantConcurrencyLimiter,
    TokenBucket,
};
pub use metrics::{get_sync_metrics, init_sync_metrics, MetricsContext, MetricsTimer, SyncMetrics};
pub use pagination::{
    PaginationConfig, PaginationMode, PaginationState, PaginationStrategy,
    PlatformPaginationConfigs, SyncBounds,
};
pub use redis_sync::RedisSyncStateManager;
pub use selective_detail::{
    FieldId, ItemDetailDecision, PlatformCapabilities, PlatformCapability, SelectiveDetailLogic,
    StandardTenantRequirements, SyncDecision, TenantRequirement,
};
