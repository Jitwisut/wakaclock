//! Provider-neutral contracts for the Phase 10 data plane.
//!
//! Handlers depend on these interfaces rather than on Kafka, RabbitMQ, Redis,
//! S3 or a particular KMS SDK. Production adapters can therefore be selected
//! from configuration without moving domain code or weakening tenant checks.

#![expect(
    dead_code,
    reason = "provider-neutral contracts are linked by deployment-specific adapters"
)]

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, time::Duration};
use uuid::Uuid;

pub const TELEMETRY_HEARTBEATS_TOPIC: &str = "telemetry.heartbeats.v1";
pub const TRANSACTION_OUTBOX_TOPIC: &str = "transaction.outbox.v1";
pub const EXPORT_JOBS_TOPIC: &str = "jobs.export.v1";
pub const INTEGRATION_SYNC_JOBS_TOPIC: &str = "jobs.integration-sync.v1";
pub const REPORT_JOBS_TOPIC: &str = "jobs.report.v1";
pub const BILLING_RECONCILE_JOBS_TOPIC: &str = "jobs.billing-reconcile.v1";
pub const ACCOUNT_DELETION_JOBS_TOPIC: &str = "jobs.account-deletion.v1";

#[derive(Debug, thiserror::Error)]
pub enum InfrastructureError {
    #[error("provider unavailable: {0}")]
    Unavailable(String),
    #[error("invalid envelope: {0}")]
    InvalidEnvelope(String),
    #[error("duplicate idempotency key: {0}")]
    Duplicate(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("serialization failed: {0}")]
    Serialization(#[from] serde_json::Error),
}

pub type InfrastructureResult<T> = Result<T, InfrastructureError>;

/// Every message crossing a process boundary carries the same replay-safe
/// envelope. `tenant_id` is mandatory so a consumer never has to infer tenant
/// scope from an untrusted payload field.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EventEnvelope {
    pub event_id: Uuid,
    pub event_version: u16,
    pub tenant_id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub trace_id: String,
    pub idempotency_key: String,
    pub payload: serde_json::Value,
}

impl EventEnvelope {
    pub fn new(tenant_id: Uuid, payload: serde_json::Value) -> Self {
        let event_id = Uuid::now_v7();
        Self {
            event_id,
            event_version: 1,
            tenant_id,
            occurred_at: Utc::now(),
            trace_id: event_id.to_string(),
            idempotency_key: event_id.to_string(),
            payload,
        }
    }

    pub fn validate(&self) -> InfrastructureResult<()> {
        if self.event_version == 0 {
            return Err(InfrastructureError::InvalidEnvelope(
                "event_version must be positive".to_string(),
            ));
        }
        if self.trace_id.trim().is_empty() || self.idempotency_key.trim().is_empty() {
            return Err(InfrastructureError::InvalidEnvelope(
                "trace_id and idempotency_key are required".to_string(),
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct JobEnvelope {
    pub job_id: Uuid,
    pub queue: String,
    pub event: EventEnvelope,
    pub attempt: u16,
    pub max_attempts: u16,
    pub available_at: DateTime<Utc>,
}

impl JobEnvelope {
    pub fn new(queue: impl Into<String>, event: EventEnvelope) -> Self {
        Self {
            job_id: Uuid::now_v7(),
            queue: queue.into(),
            event,
            attempt: 0,
            max_attempts: 3,
            available_at: Utc::now(),
        }
    }

    pub fn retry_delay(&self) -> Duration {
        // Bounded exponential backoff: 1s, 2s, 4s ... 5m maximum.
        let seconds = 2_u64.saturating_pow(self.attempt.min(9) as u32).min(300);
        Duration::from_secs(seconds)
    }
}

#[async_trait]
pub trait EventBus: Send + Sync {
    async fn publish(&self, topic: &str, event: EventEnvelope) -> InfrastructureResult<()>;
}

#[async_trait]
pub trait JobQueue: Send + Sync {
    async fn enqueue(&self, job: JobEnvelope) -> InfrastructureResult<()>;
    async fn acknowledge(&self, job_id: Uuid) -> InfrastructureResult<()>;
    async fn retry_or_dead_letter(&self, job: JobEnvelope) -> InfrastructureResult<()>;
}

#[async_trait]
pub trait CacheStore: Send + Sync {
    async fn get(&self, key: &str) -> InfrastructureResult<Option<Vec<u8>>>;
    async fn set(&self, key: &str, value: Vec<u8>, ttl: Duration) -> InfrastructureResult<()>;
    async fn delete(&self, key: &str) -> InfrastructureResult<()>;
}

#[async_trait]
pub trait DistributedLock: Send + Sync {
    async fn try_acquire(&self, key: &str, ttl: Duration) -> InfrastructureResult<bool>;
    async fn release(&self, key: &str) -> InfrastructureResult<()>;
}

#[async_trait]
pub trait ObjectStore: Send + Sync {
    async fn put(
        &self,
        key: &str,
        content: Vec<u8>,
        content_type: &str,
    ) -> InfrastructureResult<()>;
    async fn signed_get_url(&self, key: &str, ttl: Duration) -> InfrastructureResult<String>;
    async fn delete(&self, key: &str) -> InfrastructureResult<()>;
}

/// KMS/Vault adapters receive plaintext only for the duration of the call and
/// return an opaque ciphertext envelope. Callers must never persist the raw
/// provider token or include it in a response.
#[async_trait]
pub trait CredentialVault: Send + Sync {
    async fn seal(&self, tenant_id: Uuid, secret: &[u8]) -> InfrastructureResult<Vec<u8>>;
    async fn open(&self, tenant_id: Uuid, ciphertext: &[u8]) -> InfrastructureResult<Vec<u8>>;
}

/// Minimal in-memory cache for unit tests and local development. It is
/// deliberately not durable and must not be selected for production.
#[derive(Default)]
pub struct MemoryCache {
    entries: tokio::sync::RwLock<HashMap<String, (Vec<u8>, std::time::Instant)>>,
}

#[async_trait]
impl CacheStore for MemoryCache {
    async fn get(&self, key: &str) -> InfrastructureResult<Option<Vec<u8>>> {
        let mut entries = self.entries.write().await;
        let Some((value, expires_at)) = entries.get(key).cloned() else {
            return Ok(None);
        };
        if expires_at <= std::time::Instant::now() {
            entries.remove(key);
            return Ok(None);
        }
        Ok(Some(value))
    }

    async fn set(&self, key: &str, value: Vec<u8>, ttl: Duration) -> InfrastructureResult<()> {
        self.entries
            .write()
            .await
            .insert(key.to_string(), (value, std::time::Instant::now() + ttl));
        Ok(())
    }

    async fn delete(&self, key: &str) -> InfrastructureResult<()> {
        self.entries.write().await.remove(key);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn envelope_has_required_metadata_and_is_replay_safe() {
        let tenant_id = Uuid::now_v7();
        let event = EventEnvelope::new(tenant_id, serde_json::json!({"kind": "heartbeat"}));
        assert_eq!(event.tenant_id, tenant_id);
        assert_ne!(event.trace_id, "");
        assert!(event.validate().is_ok());
    }

    #[tokio::test]
    async fn memory_cache_expires_values() {
        let cache = MemoryCache::default();
        cache
            .set("tenant:key", b"value".to_vec(), Duration::from_millis(1))
            .await
            .unwrap();
        tokio::time::sleep(Duration::from_millis(5)).await;
        assert_eq!(cache.get("tenant:key").await.unwrap(), None);
    }

    #[test]
    fn retry_delay_is_bounded() {
        let mut job = JobEnvelope::new(
            "jobs.export.v1",
            EventEnvelope::new(Uuid::now_v7(), serde_json::Value::Null),
        );
        job.attempt = 99;
        assert_eq!(job.retry_delay(), Duration::from_secs(300));
    }
}
