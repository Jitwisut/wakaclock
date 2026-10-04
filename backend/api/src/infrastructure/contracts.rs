//! Provider-neutral contracts for the message-broker data plane.
//!
//! Kafka carries continuous telemetry (heartbeats, AI usage, AI edits); RabbitMQ
//! carries bounded background jobs with an explicit completion. Neither is a
//! fallback for the other. Services depend on these interfaces rather than on a
//! broker SDK, so adapters can be selected from configuration without moving
//! domain code or weakening tenant checks. The decisions behind this shape are
//! recorded in `plans/plan-kafka-rabbitmq-adoption.md` (D1–D4).

use async_trait::async_trait;
use chrono::{DateTime, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, time::Duration};
use uuid::Uuid;
use wakaclock_core::{ai::AiUsageRecord, heartbeat::Heartbeat};

/// Wire version of [`EventEnvelope`]. A field may be added without a bump; a
/// field may not be removed or reinterpreted without one.
pub const EVENT_ENVELOPE_VERSION: u16 = 1;
pub const HEARTBEAT_EVENT_TYPE: &str = "heartbeat.recorded";
pub const AI_USAGE_EVENT_TYPE: &str = "ai.usage.recorded";
pub const MAX_EVENT_PAYLOAD_BYTES: usize = 256 * 1024;

/// Upper bound for a source record ID folded into a [`StableEventId`]. Matches
/// the per-ID bound `DELETE /api/v1/heartbeats.bulk` already enforces, so any ID
/// a user can delete is also one that can travel through the event bus.
pub const MAX_SOURCE_ID_LEN: usize = wakaclock_core::heartbeat::MAX_HEARTBEAT_ID_LEN;
pub const MAX_USAGE_ID_LEN: usize = wakaclock_core::ai::MAX_USAGE_IDENTIFIER_BYTES;

/// Kafka topics. The record key is always the envelope's `tenant_id`, which keeps
/// one account's events ordered while spreading accounts across partitions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum EventTopic {
    Heartbeat,
    AiUsage,
    AiEdit,
    IdentityChange,
    /// Records a consumer could not apply for a permanent reason. Read only by
    /// restricted repair tooling; never replayed automatically.
    IngestDeadLetter,
}

impl EventTopic {
    pub const ALL: [EventTopic; 5] = [
        EventTopic::Heartbeat,
        EventTopic::AiUsage,
        EventTopic::AiEdit,
        EventTopic::IdentityChange,
        EventTopic::IngestDeadLetter,
    ];

    pub const fn name(self) -> &'static str {
        match self {
            EventTopic::Heartbeat => "wakaclock.heartbeat.v1",
            EventTopic::AiUsage => "wakaclock.ai-usage.v1",
            EventTopic::AiEdit => "wakaclock.ai-edit.v1",
            EventTopic::IdentityChange => "wakaclock.identity-change.v1",
            EventTopic::IngestDeadLetter => "wakaclock.ingest.dlq.v1",
        }
    }
}

/// Durable topic exchange every job is published to, routed by [`JobKind::routing_key`].
pub const JOB_EXCHANGE: &str = "wakaclock.jobs";
/// Dead-letter exchange for jobs that exhausted [`JOB_RETRY_DELAYS`] or failed permanently.
pub const JOB_DEAD_LETTER_EXCHANGE: &str = "wakaclock.jobs.dlx";

/// Backoff between attempts. A job is attempted once plus once per entry here,
/// then dead-lettered. Adapters realise each delay as a TTL queue, so the set of
/// distinct delays is deliberately small and fixed rather than computed.
pub const JOB_RETRY_DELAYS: [Duration; 4] = [
    Duration::from_secs(5),
    Duration::from_secs(30),
    Duration::from_secs(120),
    Duration::from_secs(600),
];

/// Every background job type. The serialized form is the RabbitMQ routing key.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum JobKind {
    #[serde(rename = "analytics.reprocess")]
    AnalyticsReprocess,
    #[serde(rename = "projection.rebuild")]
    ProjectionRebuild,
    #[serde(rename = "ai.session.reconcile")]
    AiSessionReconcile,
    #[serde(rename = "pricing.reconcile")]
    PricingReconcile,
    #[serde(rename = "export.generate")]
    ExportGenerate,
    #[serde(rename = "report.deliver")]
    ReportDeliver,
    #[serde(rename = "integration.sync")]
    IntegrationSync,
    #[serde(rename = "account.delete")]
    AccountDelete,
    #[serde(rename = "billing.reconcile")]
    BillingReconcile,
}

impl JobKind {
    pub const ALL: [JobKind; 9] = [
        JobKind::AnalyticsReprocess,
        JobKind::ProjectionRebuild,
        JobKind::AiSessionReconcile,
        JobKind::PricingReconcile,
        JobKind::ExportGenerate,
        JobKind::ReportDeliver,
        JobKind::IntegrationSync,
        JobKind::AccountDelete,
        JobKind::BillingReconcile,
    ];

    pub const fn routing_key(self) -> &'static str {
        match self {
            JobKind::AnalyticsReprocess => "analytics.reprocess",
            JobKind::ProjectionRebuild => "projection.rebuild",
            JobKind::AiSessionReconcile => "ai.session.reconcile",
            JobKind::PricingReconcile => "pricing.reconcile",
            JobKind::ExportGenerate => "export.generate",
            JobKind::ReportDeliver => "report.deliver",
            JobKind::IntegrationSync => "integration.sync",
            JobKind::AccountDelete => "account.delete",
            JobKind::BillingReconcile => "billing.reconcile",
        }
    }

    pub fn from_routing_key(key: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|kind| kind.routing_key() == key)
    }

    /// System jobs act on no single account. They carry [`SYSTEM_TENANT_ID`]; every
    /// other kind must name the account whose data it touches, so a worker never
    /// has to infer scope from the payload.
    pub const fn is_system_scoped(self) -> bool {
        matches!(
            self,
            JobKind::PricingReconcile | JobKind::AccountDelete | JobKind::BillingReconcile
        )
    }
}

/// Tenant carried by system-scoped jobs. Rejected for every tenant-scoped kind.
pub const SYSTEM_TENANT_ID: Uuid = Uuid::nil();

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

/// An event identity derived from the source record, never from the moment of
/// publishing.
///
/// There is deliberately no way to mint a random one. The previous contract's
/// `EventEnvelope::new` generated a fresh UUIDv7 per call, so an HTTP retry, an
/// offline-queue replay or a Kafka redelivery of the same heartbeat became a
/// different event and would have been counted twice downstream.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct StableEventId(String);

impl StableEventId {
    /// `hb:{heartbeat_id}:{revision}`. A correction is a new event; a retry of the
    /// same revision is the same event. Splitting at the last `:` recovers the
    /// pair unambiguously because the revision is always numeric. The ID is used
    /// verbatim, not trimmed: ClickHouse stores it verbatim, so two IDs differing
    /// only in whitespace are different heartbeats and must stay different events.
    pub fn heartbeat(heartbeat_id: &str, revision: u32) -> InfrastructureResult<Self> {
        if heartbeat_id.trim().is_empty() || heartbeat_id.len() > MAX_SOURCE_ID_LEN {
            return Err(InfrastructureError::InvalidEnvelope(format!(
                "heartbeat_id must be 1..={MAX_SOURCE_ID_LEN} bytes"
            )));
        }
        Ok(Self(format!("hb:{heartbeat_id}:{revision}")))
    }

    /// `au:v1:<sha256(raw usage_event_id bytes)>`. The source id is intentionally
    /// hashed without trimming or normalisation so provider identifiers up to the
    /// API's 512-byte compatibility limit remain stable across retries.
    pub fn ai_usage(usage_event_id: &str) -> InfrastructureResult<Self> {
        if usage_event_id.trim().is_empty() || usage_event_id.len() > MAX_USAGE_ID_LEN {
            return Err(InfrastructureError::InvalidEnvelope(format!(
                "usage_event_id must be 1..={MAX_USAGE_ID_LEN} bytes"
            )));
        }
        let digest = Sha256::digest(usage_event_id.as_bytes());
        Ok(Self(format!("au:v1:{digest:x}")))
    }

    /// Stable identity for a metadata-only dead-letter record.  Partition and
    /// offset alone are not globally unique when several source topics share the
    /// same DLQ, so the source topic is length-framed into the digest as well.
    pub fn dead_letter(source_topic: &str, partition: i32, offset: i64) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(b"dlq:v1\0");
        hasher.update((source_topic.len() as u64).to_be_bytes());
        hasher.update(source_topic.as_bytes());
        hasher.update(partition.to_be_bytes());
        hasher.update(offset.to_be_bytes());
        let digest = hasher.finalize();
        Self(format!("dlq:v1:{digest:x}"))
    }

    /// `job:{job_id}`. The job ID comes from the `async_jobs` row written in the
    /// same transaction as its outbox row, so a relay republish after a crash
    /// carries the same identity.
    pub fn job(job_id: Uuid) -> Self {
        Self(format!("job:{job_id}"))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Every message crossing a process boundary carries this replay-safe envelope.
/// `tenant_id` is mandatory so a consumer never has to infer tenant scope from an
/// untrusted payload field; for personal telemetry it is the account's `user_id`
/// as resolved by `auth::resolve_user_id`, never a client-supplied value.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EventEnvelope {
    pub event_id: StableEventId,
    pub event_version: u16,
    /// What happened, e.g. `heartbeat.recorded`, or the routing key for a job.
    pub event_type: String,
    pub tenant_id: Uuid,
    /// Controls analytics time.
    pub occurred_at: DateTime<Utc>,
    /// Observability only; never part of an identity or an analytics bucket.
    pub received_at: DateTime<Utc>,
    /// Emitting client or principal (`vscode`, `cli`, `scheduler`, …). Explicitly
    /// absent when unknown rather than defaulted to a guess.
    pub source: Option<String>,
    pub trace_id: String,
    pub idempotency_key: String,
    /// Metadata only: counts, dimensions, opaque hashes and relative keys. Never
    /// prompts, responses, patches, source code, credentials or absolute paths.
    pub payload: serde_json::Value,
}

impl EventEnvelope {
    /// `trace_id` and `idempotency_key` default to the event ID; override them with
    /// [`Self::with_trace_id`] / [`Self::with_idempotency_key`] when the request
    /// carries its own.
    pub fn new(
        event_id: StableEventId,
        event_type: impl Into<String>,
        tenant_id: Uuid,
        occurred_at: DateTime<Utc>,
        payload: serde_json::Value,
    ) -> Self {
        let id = event_id.as_str().to_string();
        Self {
            event_id,
            event_version: EVENT_ENVELOPE_VERSION,
            event_type: event_type.into(),
            tenant_id,
            occurred_at,
            received_at: Utc::now(),
            source: None,
            trace_id: id.clone(),
            idempotency_key: id,
            payload,
        }
    }

    pub fn with_source(mut self, source: impl Into<String>) -> Self {
        self.source = Some(source.into());
        self
    }

    pub fn with_trace_id(mut self, trace_id: impl Into<String>) -> Self {
        self.trace_id = trace_id.into();
        self
    }

    pub fn with_idempotency_key(mut self, idempotency_key: impl Into<String>) -> Self {
        self.idempotency_key = idempotency_key.into();
        self
    }

    /// Kafka record key: one account's events stay on one partition, in order.
    pub fn partition_key(&self) -> String {
        self.tenant_id.to_string()
    }

    pub fn validate(&self) -> InfrastructureResult<()> {
        if self.event_version == 0 || self.event_version > EVENT_ENVELOPE_VERSION {
            return Err(InfrastructureError::InvalidEnvelope(format!(
                "unsupported event_version {}",
                self.event_version
            )));
        }
        // Deserialized envelopes bypass the `StableEventId` constructors.
        let event_id = self.event_id.as_str();
        if event_id.trim().is_empty() || event_id.len() > MAX_SOURCE_ID_LEN + 32 {
            return Err(InfrastructureError::InvalidEnvelope(
                "event_id is empty or too long".to_string(),
            ));
        }
        if self.event_type.trim().is_empty()
            || self.trace_id.trim().is_empty()
            || self.idempotency_key.trim().is_empty()
        {
            return Err(InfrastructureError::InvalidEnvelope(
                "event_type, trace_id and idempotency_key are required".to_string(),
            ));
        }
        // Validation also runs on deserialized broker messages. Enforcing the
        // payload bound here prevents a malformed or manually inserted envelope
        // from bypassing the producer-side checks and reaching RabbitMQ/Kafka.
        let payload_bytes =
            serde_json::to_vec(&self.payload).map_err(InfrastructureError::Serialization)?;
        if payload_bytes.len() > MAX_EVENT_PAYLOAD_BYTES {
            return Err(InfrastructureError::InvalidEnvelope(
                "event payload exceeds the broker limit".to_string(),
            ));
        }
        Ok(())
    }
}

/// Versioned heartbeat payload carried by Kafka.
///
/// The domain heartbeat remains the source of truth for normalization and
/// validation, but this wrapper gives the broker contract a typed boundary and
/// prevents the authenticated `user_id` from ever being serialized into a
/// client-controlled event.  Deserialization adds the tenant ID back only after
/// the envelope has authenticated it.
#[derive(Debug, Clone)]
pub struct HeartbeatEventV1 {
    pub heartbeat: Heartbeat,
}

impl HeartbeatEventV1 {
    pub fn from_heartbeat(mut heartbeat: Heartbeat) -> InfrastructureResult<Self> {
        heartbeat
            .validate()
            .map_err(InfrastructureError::InvalidEnvelope)?;
        let heartbeat_id = heartbeat.heartbeat_id.as_deref().ok_or_else(|| {
            InfrastructureError::InvalidEnvelope("heartbeat_id is required for Kafka".to_string())
        })?;
        StableEventId::heartbeat(heartbeat_id, heartbeat.revision)?;
        heartbeat.entity = safe_event_entity(&heartbeat.entity);
        heartbeat.project_id = None;
        Ok(Self { heartbeat })
    }

    pub fn event_for_tenant(
        &self,
        tenant_id: Uuid,
        source: Option<&str>,
    ) -> InfrastructureResult<EventEnvelope> {
        let heartbeat_id = self.heartbeat.heartbeat_id.as_deref().ok_or_else(|| {
            InfrastructureError::InvalidEnvelope("heartbeat_id is required".to_string())
        })?;
        let event_id = StableEventId::heartbeat(heartbeat_id, self.heartbeat.revision)?;
        let occurred_at = timestamp_to_utc(self.heartbeat.time);
        let payload = serde_json::to_value(self).map_err(InfrastructureError::Serialization)?;
        let payload_bytes =
            serde_json::to_vec(&payload).map_err(InfrastructureError::Serialization)?;
        if payload_bytes.len() > MAX_EVENT_PAYLOAD_BYTES {
            return Err(InfrastructureError::InvalidEnvelope(
                "heartbeat event payload exceeds the broker limit".to_string(),
            ));
        }
        let mut envelope = EventEnvelope::new(
            event_id,
            HEARTBEAT_EVENT_TYPE,
            tenant_id,
            occurred_at,
            payload,
        );
        envelope.source = normalize_event_source(source);
        envelope.validate()?;
        Ok(envelope)
    }

    pub fn into_heartbeat(self, tenant_id: Uuid) -> Heartbeat {
        let mut heartbeat = self.heartbeat;
        heartbeat.user_id = tenant_id;
        heartbeat
    }

    /// Validate the relationship between the typed payload and its authenticated
    /// envelope.  The event ID is the replay identity, so accepting a payload whose
    /// heartbeat ID/revision does not match it would make an otherwise stable retry
    /// look like a different logical record to the consumer.
    pub fn validate_envelope(&self, envelope: &EventEnvelope) -> InfrastructureResult<()> {
        envelope.validate()?;
        if envelope.event_type != HEARTBEAT_EVENT_TYPE || envelope.tenant_id == Uuid::nil() {
            return Err(InfrastructureError::InvalidEnvelope(
                "heartbeat event envelope has an invalid type or tenant".to_string(),
            ));
        }
        let heartbeat_id = self.heartbeat.heartbeat_id.as_deref().ok_or_else(|| {
            InfrastructureError::InvalidEnvelope("heartbeat_id is required".to_string())
        })?;
        let expected = StableEventId::heartbeat(heartbeat_id, self.heartbeat.revision)?;
        if envelope.event_id != expected || envelope.idempotency_key != expected.as_str() {
            return Err(InfrastructureError::InvalidEnvelope(
                "heartbeat event identity does not match its payload".to_string(),
            ));
        }
        Ok(())
    }
}

impl Serialize for HeartbeatEventV1 {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let mut value = serde_json::to_value(&self.heartbeat).map_err(serde::ser::Error::custom)?;
        let object = value
            .as_object_mut()
            .ok_or_else(|| serde::ser::Error::custom("heartbeat is not an object"))?;
        object.remove("user_id");
        object.remove("project_id");
        // The consumer recomputes the project identity from PostgreSQL rules;
        // retaining only the resolved display name preserves legacy parity while
        // preventing a client-supplied project ID from crossing the boundary.
        value.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for HeartbeatEventV1 {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let mut value = serde_json::Value::deserialize(deserializer)?;
        let object = value
            .as_object_mut()
            .ok_or_else(|| serde::de::Error::custom("heartbeat event payload must be an object"))?;
        if object.contains_key("user_id") {
            return Err(serde::de::Error::custom(
                "heartbeat event payload must not contain user_id",
            ));
        }
        object.insert(
            "user_id".to_string(),
            serde_json::Value::String(Uuid::nil().to_string()),
        );
        let heartbeat: Heartbeat =
            serde_json::from_value(value).map_err(serde::de::Error::custom)?;
        heartbeat.validate().map_err(serde::de::Error::custom)?;
        if heartbeat.heartbeat_id.is_none() {
            return Err(serde::de::Error::custom("heartbeat_id is required"));
        }
        Ok(Self { heartbeat })
    }
}

/// Versioned, content-free AI usage payload carried by the `wakaclock.ai-usage.v1`
/// topic. `flatten` keeps the public payload compatible with the HTTP record shape;
/// authenticated tenant scope lives only in the envelope.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AiUsageEventV1 {
    #[serde(flatten)]
    pub record: AiUsageRecord,
}

impl AiUsageEventV1 {
    pub fn from_record(record: AiUsageRecord) -> InfrastructureResult<Self> {
        record
            .validate()
            .map_err(InfrastructureError::InvalidEnvelope)?;
        Ok(Self { record })
    }

    pub fn event_for_tenant(
        &self,
        tenant_id: Uuid,
        source: Option<&str>,
    ) -> InfrastructureResult<EventEnvelope> {
        if tenant_id == Uuid::nil() {
            return Err(InfrastructureError::InvalidEnvelope(
                "AI usage tenant cannot be nil".to_string(),
            ));
        }
        let event_id = StableEventId::ai_usage(&self.record.usage_event_id)?;
        let payload = serde_json::to_value(self).map_err(InfrastructureError::Serialization)?;
        let payload_bytes =
            serde_json::to_vec(&payload).map_err(InfrastructureError::Serialization)?;
        if payload_bytes.len() > MAX_EVENT_PAYLOAD_BYTES {
            return Err(InfrastructureError::InvalidEnvelope(
                "AI usage event payload exceeds the broker limit".to_string(),
            ));
        }
        let mut envelope = EventEnvelope::new(
            event_id,
            AI_USAGE_EVENT_TYPE,
            tenant_id,
            self.record.occurred_at,
            payload,
        );
        envelope.source = normalize_event_source(source);
        envelope.validate()?;
        Ok(envelope)
    }

    pub fn into_record(self) -> AiUsageRecord {
        self.record
    }

    pub fn payload_hash(&self) -> InfrastructureResult<String> {
        let payload =
            serde_json::to_vec(&self.record).map_err(InfrastructureError::Serialization)?;
        let digest = Sha256::digest(payload);
        Ok(format!("{digest:x}"))
    }

    /// Consumers must recompute the stable identity from the decoded payload and
    /// reject a forged/misaligned envelope before touching ClickHouse.
    pub fn validate_envelope(&self, envelope: &EventEnvelope) -> InfrastructureResult<()> {
        envelope.validate()?;
        if envelope.event_type != AI_USAGE_EVENT_TYPE || envelope.tenant_id == Uuid::nil() {
            return Err(InfrastructureError::InvalidEnvelope(
                "AI usage event envelope has an invalid type or tenant".to_string(),
            ));
        }
        validate_ai_usage_payload_shape(&envelope.payload)?;
        self.record
            .validate()
            .map_err(InfrastructureError::InvalidEnvelope)?;
        let expected = StableEventId::ai_usage(&self.record.usage_event_id)?;
        if envelope.event_id != expected
            || envelope.idempotency_key != expected.as_str()
            || envelope.occurred_at != self.record.occurred_at
        {
            return Err(InfrastructureError::InvalidEnvelope(
                "AI usage event identity does not match its payload".to_string(),
            ));
        }
        Ok(())
    }
}

/// The typed decoder intentionally ignores unknown serde fields so an API can
/// evolve additively without copying them into ClickHouse. At the Kafka boundary,
/// however, silently accepting a field named `prompt` or `transcript` would still
/// put sensitive data in the envelope. Keep the v1 payload allowlist explicit and
/// fail closed for both privacy-sensitive and future-unversioned fields.
fn validate_ai_usage_payload_shape(payload: &serde_json::Value) -> InfrastructureResult<()> {
    const ALLOWED_FIELDS: &[&str] = &[
        "usage_event_id",
        "ai_session_id",
        "occurred_at",
        "agent",
        "provider",
        "model",
        "prompt_count",
        "prompt_character_count",
        "input_tokens",
        "output_tokens",
        "cache_read_tokens",
        "cache_write_tokens",
        "token_source",
        "project_hint",
    ];
    let object = payload.as_object().ok_or_else(|| {
        InfrastructureError::InvalidEnvelope("AI usage payload must be an object".to_string())
    })?;
    if object
        .keys()
        .any(|field| !ALLOWED_FIELDS.contains(&field.as_str()))
    {
        return Err(InfrastructureError::InvalidEnvelope(
            "AI usage payload contains an unsupported field".to_string(),
        ));
    }
    Ok(())
}

fn timestamp_to_utc(time: f64) -> DateTime<Utc> {
    if time.is_finite() && time >= 0.0 {
        let seconds = time.trunc() as i64;
        let nanos = ((time.fract().max(0.0)) * 1_000_000_000.0).round() as u32;
        if let Some(value) = Utc.timestamp_opt(seconds, nanos.min(999_999_999)).single() {
            return value;
        }
    }
    Utc::now()
}

/// Keep only a normalized producer label in the envelope.  All other client
/// strings are intentionally represented as absent rather than copied into the
/// broker metadata.
pub fn normalize_event_source(source: Option<&str>) -> Option<String> {
    let normalized = source?.trim().to_ascii_lowercase();
    matches!(
        normalized.as_str(),
        "cli" | "vscode" | "agent_hook" | "mcp" | "transcript" | "api"
    )
    .then_some(normalized)
}

pub fn safe_event_entity(entity: &str) -> String {
    let normalized = entity.replace('\\', "/");
    let absolute = normalized.starts_with('/')
        || normalized.starts_with("~/")
        || normalized.starts_with("file://")
        || normalized.as_bytes().get(1) == Some(&b':');
    let traversal = normalized.split('/').any(|part| part == "..");
    if absolute || traversal {
        normalized
            .rsplit('/')
            .find(|part| !part.is_empty() && *part != "." && *part != "..")
            .unwrap_or("unknown")
            .to_string()
    } else {
        normalized
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct JobEnvelope {
    pub job_id: Uuid,
    pub kind: JobKind,
    pub event: EventEnvelope,
    /// Zero on the first delivery; incremented each time the job is rescheduled.
    pub attempt: u16,
}

impl JobEnvelope {
    /// The envelope never invents a `job_id`: it is the ID of the `async_jobs` row,
    /// which is what lets a worker treat an already completed job as done.
    pub fn new(
        job_id: Uuid,
        kind: JobKind,
        tenant_id: Uuid,
        payload: serde_json::Value,
    ) -> InfrastructureResult<Self> {
        let job = Self {
            job_id,
            kind,
            event: EventEnvelope::new(
                StableEventId::job(job_id),
                kind.routing_key(),
                tenant_id,
                Utc::now(),
                payload,
            ),
            attempt: 0,
        };
        job.validate()?;
        Ok(job)
    }

    /// `None` once every entry of [`JOB_RETRY_DELAYS`] has been used; the job is then
    /// dead-lettered instead of retried.
    pub fn next_retry_delay(&self) -> Option<Duration> {
        JOB_RETRY_DELAYS.get(usize::from(self.attempt)).copied()
    }

    pub fn validate(&self) -> InfrastructureResult<()> {
        self.event.validate()?;
        if usize::from(self.attempt) > JOB_RETRY_DELAYS.len() {
            return Err(InfrastructureError::InvalidEnvelope(
                "job attempt exceeds the retry budget".to_string(),
            ));
        }
        if self.event.event_type != self.kind.routing_key() {
            return Err(InfrastructureError::InvalidEnvelope(
                "event_type must equal the job routing key".to_string(),
            ));
        }
        if self.event.event_id != StableEventId::job(self.job_id) {
            return Err(InfrastructureError::InvalidEnvelope(
                "event_id must be derived from job_id".to_string(),
            ));
        }
        let is_system_tenant = self.event.tenant_id == SYSTEM_TENANT_ID;
        if is_system_tenant != self.kind.is_system_scoped() {
            return Err(InfrastructureError::InvalidEnvelope(format!(
                "{} jobs must {}carry the system tenant",
                self.kind.routing_key(),
                if self.kind.is_system_scoped() {
                    ""
                } else {
                    "not "
                }
            )));
        }
        Ok(())
    }
}

/// Publishes telemetry to Kafka.
#[async_trait]
pub trait EventBus: Send + Sync {
    /// Returns only after the broker acknowledged durable receipt (`acks=all`).
    /// The API confirms acceptance to a client only after this returns `Ok`.
    async fn publish(&self, topic: EventTopic, event: &EventEnvelope) -> InfrastructureResult<()>;

    /// Enqueue a batch in caller order and return only after every broker
    /// acknowledgement is received. Implementations may pipeline the sends, but
    /// partial failure must remain visible so the caller retries the full stable-id
    /// batch safely.
    async fn publish_batch(
        &self,
        topic: EventTopic,
        events: &[EventEnvelope],
    ) -> InfrastructureResult<()> {
        let mut first_error = None;
        for event in events {
            if let Err(error) = self.publish(topic, event).await {
                // Continue enqueueing the remainder so a partial batch is
                // observable to the caller. Stable event IDs make retrying the
                // whole request safe even when earlier records were acknowledged.
                if first_error.is_none() {
                    first_error = Some(error);
                }
            }
        }
        first_error.map_or(Ok(()), Err)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EventDelivery {
    pub topic: EventTopic,
    pub partition: i32,
    pub offset: i64,
    pub event: EventEnvelope,
}

/// Consumes one Kafka consumer group. Offsets are committed manually: auto-commit
/// would acknowledge records whose side effects were never written.
#[async_trait]
pub trait EventConsumer: Send + Sync {
    /// Records that fail to decode or validate are routed to
    /// [`EventTopic::IngestDeadLetter`] by the adapter and are not returned here.
    async fn poll_batch(
        &self,
        max_records: usize,
        max_wait: Duration,
    ) -> InfrastructureResult<Vec<EventDelivery>>;

    /// Commits offsets through `deliveries`. Call only after every side effect of
    /// those deliveries is durable; a crash before this replays them.
    async fn commit(&self, deliveries: &[EventDelivery]) -> InfrastructureResult<()>;
}

/// Publishes jobs to RabbitMQ.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum JobPublishTarget {
    Primary,
    Retry(Duration),
    DeadLetter(String),
}

#[async_trait]
pub trait JobPublisher: Send + Sync {
    /// Returns after a publisher confirm. The outbox relay marks its row published
    /// only after this returns `Ok`; a crash in between republishes the same
    /// `job_id`, which the worker's completed-job check makes harmless.
    async fn publish(&self, job: &JobEnvelope) -> InfrastructureResult<()>;

    /// Publishes an outbox row to its durable destination. The default keeps simple
    /// test publishers source-compatible while real broker adapters explicitly
    /// support retry and dead-letter exchanges.
    async fn publish_to(
        &self,
        job: &JobEnvelope,
        target: &JobPublishTarget,
    ) -> InfrastructureResult<()> {
        match target {
            JobPublishTarget::Primary => self.publish(job).await,
            JobPublishTarget::Retry(_) | JobPublishTarget::DeadLetter(_) => {
                Err(InfrastructureError::Unavailable(
                    "job publisher does not support the requested outbox target".to_string(),
                ))
            }
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RetryOutcome {
    Scheduled(Duration),
    /// [`JOB_RETRY_DELAYS`] was exhausted, so the job went to the dead-letter exchange.
    DeadLettered,
}

/// One in-flight job. Settling methods consume the delivery so it cannot be
/// acknowledged twice.
#[async_trait]
pub trait JobDelivery: Send {
    fn job(&self) -> &JobEnvelope;

    /// Call only after the job's durable effects and status are written.
    async fn ack(self: Box<Self>) -> InfrastructureResult<()>;

    /// Return the original delivery to the broker when the worker could not
    /// consult or update the authoritative PostgreSQL state. Leaving a delivery
    /// merely unacknowledged can exhaust the channel's prefetch window without
    /// causing an immediate redelivery.
    async fn requeue(self: Box<Self>) -> InfrastructureResult<()>;

    /// Reschedules with `attempt + 1` after [`JobEnvelope::next_retry_delay`], or
    /// dead-letters once the schedule is exhausted.
    async fn retry(self: Box<Self>) -> InfrastructureResult<RetryOutcome>;

    /// `category` is `&'static str` on purpose: dead-letter metadata is visible to
    /// operators, so it must be a fixed sanitized code, never formatted error text
    /// that could carry user data.
    async fn dead_letter(self: Box<Self>, category: &'static str) -> InfrastructureResult<()>;
}

#[async_trait]
pub trait JobConsumer: Send + Sync {
    /// `None` once the consumer has shut down and no further deliveries will arrive.
    async fn next_delivery(&self) -> InfrastructureResult<Option<Box<dyn JobDelivery>>>;
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
    use std::collections::HashSet;

    const EVENT_FIXTURE: &str =
        include_str!("../../../../fixtures/message-envelopes/event-envelope-v1.json");
    const AI_USAGE_FIXTURE: &str =
        include_str!("../../../../fixtures/message-envelopes/ai-usage-event-v1.json");
    const JOB_FIXTURE: &str =
        include_str!("../../../../fixtures/message-envelopes/job-envelope-v1.json");

    fn fixed_time(rfc3339: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(rfc3339)
            .unwrap()
            .with_timezone(&Utc)
    }

    #[test]
    fn heartbeat_event_is_typed_and_privacy_safe() {
        let mut heartbeat = Heartbeat::new(
            Uuid::now_v7(),
            "/Users/alice/project/src/main.rs".to_string(),
            wakaclock_core::heartbeat::EntityType::File,
            "wakaclock-cli/1.0".to_string(),
        );
        heartbeat.heartbeat_id = Some("event-1".to_string());
        let event = HeartbeatEventV1::from_heartbeat(heartbeat).unwrap();
        let envelope = event.event_for_tenant(Uuid::now_v7(), Some("cli")).unwrap();
        assert_eq!(envelope.event_type, HEARTBEAT_EVENT_TYPE);
        assert_eq!(envelope.source.as_deref(), Some("cli"));
        assert_eq!(envelope.payload["entity"], "main.rs");
        assert!(envelope.payload.get("user_id").is_none());
        let decoded: HeartbeatEventV1 = serde_json::from_value(envelope.payload.clone()).unwrap();
        assert_eq!(decoded.heartbeat.entity, "main.rs");
        decoded.validate_envelope(&envelope).unwrap();
    }

    #[test]
    fn unsafe_event_entities_are_reduced_to_basename_and_sources_allowlisted() {
        assert_eq!(safe_event_entity("src\\main.rs"), "src/main.rs");
        assert_eq!(safe_event_entity("../../secrets.env"), "secrets.env");
        assert_eq!(safe_event_entity("/Users/alice/project/main.rs"), "main.rs");
        assert_eq!(
            safe_event_entity("file:///Users/alice/project/main.rs"),
            "main.rs"
        );
        assert_eq!(
            normalize_event_source(Some("VSCode")),
            Some("vscode".to_string())
        );
        assert_eq!(normalize_event_source(Some("window-title")), None);
    }

    #[test]
    fn same_heartbeat_revision_always_yields_the_same_event() {
        let tenant_id = Uuid::now_v7();
        let first = EventEnvelope::new(
            StableEventId::heartbeat("operation-1", 0).unwrap(),
            "heartbeat.recorded",
            tenant_id,
            Utc::now(),
            serde_json::Value::Null,
        );
        let replay = EventEnvelope::new(
            StableEventId::heartbeat("operation-1", 0).unwrap(),
            "heartbeat.recorded",
            tenant_id,
            Utc::now(),
            serde_json::Value::Null,
        );
        assert_eq!(first.event_id, replay.event_id);
        assert_eq!(first.idempotency_key, replay.idempotency_key);
        assert_eq!(first.event_id.as_str(), "hb:operation-1:0");
    }

    #[test]
    fn heartbeat_event_rejects_an_envelope_identity_mismatch() {
        let mut heartbeat = Heartbeat::new(
            Uuid::now_v7(),
            "src/main.rs".to_string(),
            wakaclock_core::heartbeat::EntityType::File,
            "wakaclock-cli/1.0".to_string(),
        );
        heartbeat.heartbeat_id = Some("event-1".to_string());
        let event = HeartbeatEventV1::from_heartbeat(heartbeat).unwrap();
        let mut envelope = event.event_for_tenant(Uuid::now_v7(), Some("cli")).unwrap();
        envelope.event_id = StableEventId::heartbeat("event-2", 0).unwrap();
        assert!(event.validate_envelope(&envelope).is_err());
    }

    #[test]
    fn a_correction_is_a_different_event() {
        assert_ne!(
            StableEventId::heartbeat("operation-1", 0).unwrap(),
            StableEventId::heartbeat("operation-1", 1).unwrap()
        );
    }

    #[test]
    fn heartbeat_identity_rejects_empty_and_oversized_ids() {
        assert!(StableEventId::heartbeat("  ", 0).is_err());
        assert!(StableEventId::heartbeat(&"x".repeat(MAX_SOURCE_ID_LEN), 0).is_ok());
        assert!(StableEventId::heartbeat(&"x".repeat(MAX_SOURCE_ID_LEN + 1), 0).is_err());
    }

    #[test]
    fn dead_letter_identity_includes_source_topic_and_is_replay_stable() {
        let first = StableEventId::dead_letter("wakaclock.ai-usage.v1", 3, 42);
        let replay = StableEventId::dead_letter("wakaclock.ai-usage.v1", 3, 42);
        let other_topic = StableEventId::dead_letter("wakaclock.heartbeat.v1", 3, 42);
        assert_eq!(first, replay);
        assert_ne!(first, other_topic);
        assert!(first.as_str().starts_with("dlq:v1:"));
    }

    #[test]
    fn envelope_validation_rejects_unknown_versions_and_missing_metadata() {
        let valid = EventEnvelope::new(
            StableEventId::heartbeat("operation-1", 0).unwrap(),
            "heartbeat.recorded",
            Uuid::now_v7(),
            Utc::now(),
            serde_json::Value::Null,
        );
        assert!(valid.validate().is_ok());

        for version in [0, EVENT_ENVELOPE_VERSION + 1] {
            let mut envelope = valid.clone();
            envelope.event_version = version;
            assert!(envelope.validate().is_err(), "version {version}");
        }
        let mut envelope = valid.clone();
        envelope.event_type = " ".to_string();
        assert!(envelope.validate().is_err());
        let mut envelope = valid;
        envelope.event_id = StableEventId(String::new());
        assert!(envelope.validate().is_err());
    }

    #[test]
    fn envelope_validation_rejects_oversized_payloads_before_broker_publish() {
        let envelope = EventEnvelope::new(
            StableEventId::heartbeat("operation-1", 0).unwrap(),
            "heartbeat.recorded",
            Uuid::now_v7(),
            Utc::now(),
            serde_json::json!({ "bounded": "x".repeat(MAX_EVENT_PAYLOAD_BYTES) }),
        );
        assert!(matches!(
            envelope.validate(),
            Err(InfrastructureError::InvalidEnvelope(message))
                if message == "event payload exceeds the broker limit"
        ));
    }

    #[test]
    fn event_wire_format_matches_the_v1_fixture() {
        let fixture: serde_json::Value = serde_json::from_str(EVENT_FIXTURE).unwrap();
        let decoded: EventEnvelope = serde_json::from_value(fixture.clone()).unwrap();
        assert!(decoded.validate().is_ok());

        let mut built = EventEnvelope::new(
            StableEventId::heartbeat("0190f3a1-7c2e-7b4a-9d1e-2f6a8c3b5d70", 2).unwrap(),
            "heartbeat.recorded",
            Uuid::parse_str("0190f3a1-0000-7000-8000-000000000001").unwrap(),
            fixed_time("2026-09-10T03:15:00Z"),
            // Payload schemas land with their producers; this pins only the envelope.
            serde_json::json!({}),
        )
        .with_source("vscode");
        built.received_at = fixed_time("2026-09-10T03:15:01.250Z");
        assert_eq!(decoded, built);
        assert_eq!(serde_json::to_value(&built).unwrap(), fixture);
    }

    #[test]
    fn job_wire_format_matches_the_v1_fixture() {
        let fixture: serde_json::Value = serde_json::from_str(JOB_FIXTURE).unwrap();
        let decoded: JobEnvelope = serde_json::from_value(fixture.clone()).unwrap();
        assert!(decoded.validate().is_ok());
        assert_eq!(serde_json::to_value(&decoded).unwrap(), fixture);
        assert_eq!(decoded.kind, JobKind::AnalyticsReprocess);
    }

    #[test]
    fn ai_usage_wire_format_has_stable_identity_and_no_tenant_in_payload() {
        let fixture: serde_json::Value = serde_json::from_str(AI_USAGE_FIXTURE).unwrap();
        let envelope: EventEnvelope = serde_json::from_value(fixture.clone()).unwrap();
        let payload: AiUsageEventV1 = serde_json::from_value(envelope.payload.clone()).unwrap();
        payload.validate_envelope(&envelope).unwrap();
        assert_eq!(envelope.event_type, AI_USAGE_EVENT_TYPE);
        assert_eq!(
            envelope.event_id.as_str(),
            "au:v1:ef27c902bfbb8fdfa8e18db17c151ed753b8b2ab7a0fad9a3ce2bf9e280a0611"
        );
        assert!(envelope.payload.get("tenant_id").is_none());
        assert!(envelope.payload.get("user_id").is_none());
        assert!(payload.record.validate().is_ok());
    }

    #[test]
    fn ai_usage_identity_hash_preserves_raw_bytes_and_supports_512_bytes() {
        let id = "x".repeat(MAX_USAGE_ID_LEN);
        let stable = StableEventId::ai_usage(&id).unwrap();
        assert!(stable.as_str().starts_with("au:v1:"));
        assert!(StableEventId::ai_usage(&format!("{id}x")).is_err());
        assert_ne!(
            StableEventId::ai_usage("msg").unwrap(),
            StableEventId::ai_usage(" msg").unwrap()
        );
    }

    #[test]
    fn ai_usage_payload_rejects_content_like_or_future_unversioned_fields() {
        let record = wakaclock_core::ai::AiUsageRecord {
            collector_id: None,
            usage_event_id: "message-1".to_string(),
            ai_session_id: "session-1".to_string(),
            occurred_at: fixed_time("2026-09-10T03:15:00Z"),
            agent: "codex".to_string(),
            provider: Some("openai".to_string()),
            model: Some("gpt-5.6-sol".to_string()),
            prompt_count: 1,
            prompt_character_count: Some(12),
            input_tokens: Some(10),
            output_tokens: Some(5),
            cache_read_tokens: None,
            cache_write_tokens: None,
            token_source: wakaclock_core::ai::TokenSource::Transcript,
            project_hint: None,
        };
        let event = AiUsageEventV1::from_record(record).unwrap();
        let mut envelope = event.event_for_tenant(Uuid::now_v7(), Some("api")).unwrap();
        envelope.payload["prompt"] =
            serde_json::Value::String("must not cross the boundary".into());
        assert!(event.validate_envelope(&envelope).is_err());

        envelope.payload.as_object_mut().unwrap().remove("prompt");
        envelope.payload["future_field"] = serde_json::Value::Bool(true);
        assert!(event.validate_envelope(&envelope).is_err());
    }

    #[test]
    fn job_identity_is_derived_from_the_job_row() {
        let job_id = Uuid::now_v7();
        let job = JobEnvelope::new(
            job_id,
            JobKind::AnalyticsReprocess,
            Uuid::now_v7(),
            serde_json::Value::Null,
        )
        .unwrap();
        assert_eq!(job.event.event_id.as_str(), format!("job:{job_id}"));
        assert_eq!(job.event.event_type, "analytics.reprocess");

        let mut forged = job.clone();
        forged.event.event_id = StableEventId::job(Uuid::now_v7());
        assert!(forged.validate().is_err());
    }

    #[test]
    fn tenant_scope_follows_the_job_kind() {
        let user = Uuid::now_v7();
        let payload = serde_json::Value::Null;
        assert!(JobEnvelope::new(
            Uuid::now_v7(),
            JobKind::ExportGenerate,
            user,
            payload.clone()
        )
        .is_ok());
        assert!(JobEnvelope::new(
            Uuid::now_v7(),
            JobKind::ExportGenerate,
            SYSTEM_TENANT_ID,
            payload.clone()
        )
        .is_err());
        assert!(JobEnvelope::new(
            Uuid::now_v7(),
            JobKind::PricingReconcile,
            SYSTEM_TENANT_ID,
            payload.clone()
        )
        .is_ok());
        assert!(
            JobEnvelope::new(Uuid::now_v7(), JobKind::PricingReconcile, user, payload).is_err()
        );

        assert!(JobEnvelope::new(
            Uuid::now_v7(),
            JobKind::AccountDelete,
            SYSTEM_TENANT_ID,
            serde_json::Value::Null
        )
        .is_ok());
        assert!(JobEnvelope::new(
            Uuid::now_v7(),
            JobKind::AccountDelete,
            user,
            serde_json::Value::Null
        )
        .is_err());
    }

    #[test]
    fn retry_schedule_is_bounded_then_dead_letters() {
        let mut job = JobEnvelope::new(
            Uuid::now_v7(),
            JobKind::AnalyticsReprocess,
            Uuid::now_v7(),
            serde_json::Value::Null,
        )
        .unwrap();
        let mut delays = Vec::new();
        while let Some(delay) = job.next_retry_delay() {
            delays.push(delay);
            job.attempt += 1;
        }
        assert_eq!(delays, JOB_RETRY_DELAYS);
        assert_eq!(job.attempt as usize, JOB_RETRY_DELAYS.len());
    }

    #[test]
    fn job_envelope_rejects_attempts_beyond_the_retry_budget() {
        let mut job = JobEnvelope::new(
            Uuid::now_v7(),
            JobKind::AnalyticsReprocess,
            Uuid::now_v7(),
            serde_json::Value::Null,
        )
        .unwrap();
        job.attempt = (JOB_RETRY_DELAYS.len() as u16) + 1;
        assert!(job.validate().is_err());
    }

    #[test]
    fn routing_keys_are_unique_and_round_trip() {
        let keys: HashSet<_> = JobKind::ALL.iter().map(|kind| kind.routing_key()).collect();
        assert_eq!(keys.len(), JobKind::ALL.len());
        for kind in JobKind::ALL {
            assert_eq!(JobKind::from_routing_key(kind.routing_key()), Some(kind));
            assert_eq!(
                serde_json::to_value(kind).unwrap(),
                serde_json::Value::String(kind.routing_key().to_string())
            );
        }
        assert_eq!(JobKind::from_routing_key("jobs.export.v1"), None);
    }

    #[test]
    fn topic_names_are_unique_and_versioned() {
        let names: HashSet<_> = EventTopic::ALL.iter().map(|topic| topic.name()).collect();
        assert_eq!(names.len(), EventTopic::ALL.len());
        for name in names {
            assert!(
                name.starts_with("wakaclock.") && name.ends_with(".v1"),
                "{name}"
            );
        }
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
}
