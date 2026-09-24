use crate::{
    ai::{
        normalize_identity_agent, normalize_identity_model, normalize_identity_provider,
        normalize_identity_reason, normalize_identity_reference, normalize_identity_source,
        normalize_identity_status, resolve_identity, AiDiagnosticsReport, AiDiagnosticsReportV2,
        AiUsageIngestReport, AiUsageIngestReportV2, AiUsageProcessingState, AiUsageRecord,
        IDENTITY_SCHEMA_VERSION,
    },
    config::Config,
    error::{AppError, AppResult},
    heartbeat::{Heartbeat, DEDUP_WINDOW_SECONDS},
    queue::{DeliveryFailureRecord, Queue, QueueScope},
};
use reqwest::{header, Client};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::{collections::HashMap, fs, path::PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusBarSnapshot {
    pub total_seconds: f64,
    pub human_readable: String,
    pub heartbeat_count: u64,
    #[serde(default)]
    pub confirmed_seconds: Option<f64>,
    /// Additive fields returned by newer servers. Older servers omit them and the
    /// client treats the missing values as zero/unknown.
    #[serde(default)]
    pub queued_seconds: f64,
    #[serde(default)]
    pub last_heartbeat_at: Option<f64>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub buffered_seconds: f64,
    #[serde(default)]
    pub agent_health: Option<serde_json::Value>,
    #[serde(default)]
    pub covered_intervals: Vec<crate::heartbeat::ActivitySegment>,
    /// Raw strict Active v1 intervals. These exclude idle-bridge time and are used to
    /// union server-confirmed activity with local queue entries after a crash/retry.
    #[serde(default)]
    pub active_intervals: Vec<crate::heartbeat::ActivitySegment>,
    #[serde(default)]
    pub last_increment_seconds: Option<f64>,
    #[serde(default)]
    pub last_increment_source: Option<String>,
    #[serde(default)]
    pub discarded_seconds: f64,
    /// Strict Active v1 timing, when the server has at least one explicit v1
    /// evidence marker in the requested range. Older servers omit these fields.
    #[serde(default)]
    pub active_seconds: Option<f64>,
    #[serde(default)]
    pub active_coverage: Option<String>,
    #[serde(default)]
    pub wakatime_compatible_seconds: Option<f64>,
    /// Opaque, server-issued account identity for queue ownership. Stable across
    /// API-key rotation and different for every account; older servers omit it.
    #[serde(default)]
    pub queue_owner_id: Option<String>,
}

/// Why the server last refused a heartbeat, and when. Persisted so a refusal outlives the
/// process that saw it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryFailure {
    pub at: f64,
    pub message: String,
    /// Classified from the typed error when the failure was recorded. Records written
    /// by older binaries omit it and fall back to [`classify_delivery_failure`]; a
    /// value this binary does not know (written by a newer one) is read as absent
    /// rather than discarding the whole record.
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        deserialize_with = "deserialize_known_failure_kind"
    )]
    pub kind: Option<DeliveryFailureKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub http_status: Option<u16>,
}

fn deserialize_known_failure_kind<'de, D>(
    deserializer: D,
) -> Result<Option<DeliveryFailureKind>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let value = Option::<Value>::deserialize(deserializer)?;
    Ok(value.and_then(|value| serde_json::from_value(value).ok()))
}

/// `wakaclock doctor ai` reports a delivery refusal split into `401` (bad/expired
/// credential), `402` (entitlement — trial or subscription lapsed, *not* a detection
/// failure), a network/transport problem, and a request the server rejected as
/// malformed. Collapsing these hides the one case — 402 — where local capture is
/// working perfectly and only billing is wrong.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryFailureKind {
    #[serde(rename = "auth_401")]
    Auth401,
    #[serde(rename = "payment_402")]
    Payment402,
    Network,
    Validation,
    /// 408, 429 or 5xx: the server answered but asked the client to retry later.
    ServerError,
    Other,
}

impl DeliveryFailureKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Auth401 => "auth_401",
            Self::Payment402 => "payment_402",
            Self::Network => "network",
            Self::Validation => "validation",
            Self::ServerError => "server_error",
            Self::Other => "other",
        }
    }

    /// Classify an HTTP status the server actually returned.
    pub fn from_http_status(status: u16) -> Self {
        match status {
            401 | 403 => Self::Auth401,
            402 => Self::Payment402,
            400 | 422 => Self::Validation,
            408 | 429 | 500..=599 => Self::ServerError,
            _ => Self::Other,
        }
    }

    /// Classify a typed delivery/probe error. This is the source of truth: a
    /// transport error without an HTTP response is `Network` no matter what its
    /// URL or message happens to contain.
    pub fn from_error(error: &AppError) -> Self {
        match error {
            AppError::Http(inner) => inner
                .status()
                .map(|status| Self::from_http_status(status.as_u16()))
                .unwrap_or(Self::Network),
            AppError::HttpStatus { status, .. } | AppError::HttpStatusRetry { status, .. } => {
                Self::from_http_status(*status)
            }
            AppError::Auth(_) => Self::Auth401,
            AppError::Validation(_) => Self::Validation,
            _ => Self::Other,
        }
    }
}

/// Scope used for a refusal migrated from the pre-scope JSON file. Deliberately not
/// a real origin/owner so it can never match a live scope's lookup.
pub const LEGACY_UNSCOPED_DESTINATION: &str = "legacy_unscoped";
pub const LEGACY_UNSCOPED_OWNER: &str = "legacy_unscoped";

/// Short stable code for a delivery failure. UI decisions use `kind`/`http_status`;
/// this narrows "why" without exposing a free-form message.
pub fn delivery_message_code(error: &AppError) -> &'static str {
    match error {
        AppError::Http(inner) => {
            if inner.is_timeout() {
                "timeout"
            } else if inner.is_connect() {
                "connect_failed"
            } else if inner.status().is_some() {
                "http_status"
            } else {
                "transport_failed"
            }
        }
        AppError::HttpStatus { .. } | AppError::HttpStatusRetry { .. } => "http_status",
        AppError::Auth(_) => "credential_rejected",
        AppError::Validation(_) => "payload_rejected",
        AppError::Protocol(_) => "protocol_mismatch",
        _ => "unknown",
    }
}

/// A server `queue_owner_id` is a lowercase SHA-256 hex digest; anything else is
/// ignored rather than trusted as ownership proof.
fn is_valid_queue_owner_id(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
}

/// The HTTP status carried by an error, when the server returned one.
pub fn http_status_of(error: &AppError) -> Option<u16> {
    match error {
        AppError::Http(inner) => inner.status().map(|status| status.as_u16()),
        AppError::HttpStatus { status, .. } | AppError::HttpStatusRetry { status, .. } => {
            Some(*status)
        }
        AppError::Auth(_) => Some(401),
        _ => None,
    }
}

/// User-facing connection state shared by `wakaclock today --json`, `verify` and
/// editor clients. Decisions are made on this enum, never on free-form messages.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionState {
    Online,
    Offline,
    AuthRejected,
    SubscriptionRequired,
    RetryableServerError,
    ValidationRejected,
    UnknownError,
}

impl ConnectionState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Online => "online",
            Self::Offline => "offline",
            Self::AuthRejected => "auth_rejected",
            Self::SubscriptionRequired => "subscription_required",
            Self::RetryableServerError => "retryable_server_error",
            Self::ValidationRejected => "validation_rejected",
            Self::UnknownError => "unknown_error",
        }
    }

    pub fn from_failure_kind(kind: DeliveryFailureKind) -> Self {
        match kind {
            DeliveryFailureKind::Network => Self::Offline,
            DeliveryFailureKind::Auth401 => Self::AuthRejected,
            DeliveryFailureKind::Payment402 => Self::SubscriptionRequired,
            DeliveryFailureKind::ServerError => Self::RetryableServerError,
            DeliveryFailureKind::Validation => Self::ValidationRejected,
            DeliveryFailureKind::Other => Self::UnknownError,
        }
    }
}

/// Classify a recorded failure message from a record that predates the typed
/// `kind` field. The messages come from `AppError`'s `Display`
/// (`"HTTP status <code>: <body>"`, `"HTTP error: <reqwest error>"`), so a status
/// code is read only from those explicit shapes — never from an arbitrary "402"
/// substring, which a URL port such as `:40213` would otherwise match.
pub fn classify_delivery_failure(message: &str) -> DeliveryFailureKind {
    let lower = message.to_ascii_lowercase();
    if let Some(status) = http_status_in_message(&lower) {
        return DeliveryFailureKind::from_http_status(status);
    }
    if lower.contains("trial expired") || lower.contains("subscription inactive") {
        DeliveryFailureKind::Payment402
    } else if lower.contains("unauthorized")
        || lower.contains("invalid api key")
        || lower.contains("api key was rejected")
        || lower.contains("api key rejected")
        || lower.contains("authentication failed")
    {
        DeliveryFailureKind::Auth401
    } else if lower.contains("validation")
        || lower.contains("malformed")
        || lower.contains("invalid heartbeat")
    {
        DeliveryFailureKind::Validation
    } else if lower.contains("error sending request")
        || lower.contains("dns")
        || lower.contains("timed out")
        || lower.contains("timeout")
        || lower.contains("connection")
        || lower.contains("connect")
        || lower.contains("network")
        || lower.contains("unreachable")
        || lower.contains("could not reach")
    {
        DeliveryFailureKind::Network
    } else {
        DeliveryFailureKind::Other
    }
}

/// Read a status code from `http status 402: ...` (`AppError::HttpStatus`) or
/// reqwest's `http status client error (402 payment required) ...`.
fn http_status_in_message(lower: &str) -> Option<u16> {
    let rest = &lower[lower.find("http status ")? + "http status ".len()..];
    let digits = rest
        .strip_prefix("client error (")
        .or_else(|| rest.strip_prefix("server error ("))
        .unwrap_or(rest);
    let code: String = digits.chars().take_while(char::is_ascii_digit).collect();
    if code.len() == 3 {
        code.parse().ok()
    } else {
        None
    }
}

/// Whether a failed HTTP delivery should remain in the durable retry queue.
///
/// A transport error has no response and is safe to retry.  For an HTTP
/// response, only the statuses explicitly called out by the ingest contract
/// are generally retryable. Heartbeat flushes additionally preserve credential
/// failures because a repaired key can make the same captured activity valid.
pub fn is_retryable_delivery_error(error: &AppError) -> bool {
    match error {
        AppError::Http(_) => true,
        AppError::HttpStatus { status, .. } => {
            *status == 408 || *status == 429 || (500..=599).contains(status)
        }
        AppError::HttpStatusRetry { status, .. } => {
            *status == 408 || *status == 429 || (500..=599).contains(status)
        }
        AppError::Protocol(_) => true,
        _ => false,
    }
}

/// Heartbeat delivery has one additional durable-capture case: HTTP 402 means
/// the account entitlement is inactive, not that the captured activity is
/// invalid. Keep that heartbeat in the local queue so it can be delivered when
/// billing is restored. AI usage uses `is_retryable_delivery_error` directly;
/// its permanent-4xx dead-letter contract must remain stricter.
fn is_retryable_heartbeat_delivery_error(error: &AppError) -> bool {
    match error {
        AppError::HttpStatus { status, .. } | AppError::HttpStatusRetry { status, .. }
            if *status == 402 =>
        {
            true
        }
        _ => is_retryable_delivery_error(error),
    }
}

fn is_credential_delivery_error(error: &AppError) -> bool {
    matches!(
        error,
        AppError::Auth(_)
            | AppError::HttpStatus {
                status: 401 | 403,
                ..
            }
            | AppError::HttpStatusRetry {
                status: 401 | 403,
                ..
            }
    )
}

pub fn retry_after_seconds(error: &AppError) -> Option<u64> {
    match error {
        AppError::HttpStatusRetry {
            retry_after_seconds,
            ..
        } => *retry_after_seconds,
        _ => None,
    }
}

impl DeliveryFailure {
    pub fn kind(&self) -> DeliveryFailureKind {
        self.kind
            .unwrap_or_else(|| classify_delivery_failure(&self.message))
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SendReport {
    pub sent: usize,
    pub deduped: usize,
    pub queued: usize,
    pub flushed: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// What a queue flush actually did. `flushed` alone was ambiguous in the one place it
/// matters most — `wakaclock status` printing "Queued: 2 / Flushed now: 0" gave no hint
/// whether the server was down, the key was rejected, or the queue was simply empty.
#[derive(Debug, Clone)]
pub struct FlushReport {
    pub flushed: usize,
    /// Why the flush stopped before draining the queue, if it did. Flushing sends one
    /// heartbeat at a time and stops at the first failure, so the remaining entries keep
    /// their order and a dead server is not hammered; this carries that first failure's
    /// message instead of discarding it.
    pub stopped_because: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepairDayReport {
    pub date: String,
    pub timezone: String,
    pub before_seconds: f64,
    pub after_seconds: f64,
    pub duplicate_heartbeats: u64,
    pub overlap_seconds: f64,
    pub long_gap_seconds: f64,
    #[serde(default)]
    pub revision_id: Option<String>,
    pub applied: bool,
    #[serde(default)]
    pub dry_run: bool,
}

/// Metadata-only correction for one already-ingested AI activity event.  The
/// server uses `ai_event_id` to locate the canonical heartbeat and copies its
/// measured values into the next revision; this payload never carries prompts,
/// patches, source text, or a replacement activity duration.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AiIdentityCorrection {
    pub ai_event_id: String,
    pub agent: String,
    pub provider: String,
    pub model: String,
    pub source: String,
    /// Optional stable session scope. When present, the server must match both
    /// `ai_event_id` and this value so a reused tool id cannot repair another session.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub turn_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AiIdentityRepairRequest {
    pub repair_run_id: String,
    pub corrections: Vec<AiIdentityCorrection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AiIdentityRepairReport {
    pub repair_run_id: String,
    pub requested: u64,
    pub matched: u64,
    pub corrected: u64,
    pub unchanged: u64,
    pub unresolved: u64,
    pub conflicts: u64,
    pub preserved_heartbeats: u64,
    pub preserved_lines_added: u64,
    pub preserved_lines_deleted: u64,
    pub applied: bool,
    pub dry_run: bool,
}

impl SendReport {
    fn queued(sent: usize, deduped: usize, queued: usize, error: Option<String>) -> Self {
        Self {
            sent,
            deduped,
            queued,
            flushed: 0,
            error,
        }
    }
}

pub struct ApiClient {
    config: Config,
    client: Client,
    line_metric_capability: Arc<Mutex<Option<(Instant, bool)>>>,
}

impl ApiClient {
    pub fn new(config: Config) -> AppResult<Self> {
        let mut headers = header::HeaderMap::new();
        if let Some(api_key) = config.api_key.as_deref() {
            let mut value = header::HeaderValue::from_str(&format!("Bearer {api_key}"))
                .map_err(|e| AppError::Auth(e.to_string()))?;
            value.set_sensitive(true);
            headers.insert(header::AUTHORIZATION, value);
        }

        let client = Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .default_headers(headers)
            .build()?;
        Ok(Self {
            config,
            client,
            line_metric_capability: Arc::new(Mutex::new(None)),
        })
    }

    pub fn queue_scope(&self) -> QueueScope {
        let owner = self
            .config
            .api_key
            .as_deref()
            .map(|key| format!("key:{:x}", Sha256::digest(key.as_bytes())))
            .unwrap_or_else(|| format!("anonymous:{}", self.config.user_id));
        QueueScope {
            destination: self.config.server_url.trim_end_matches('/').to_string(),
            owner,
        }
    }

    /// Capability probes are cached briefly to avoid adding a round trip to every
    /// editor heartbeat. An unavailable or older server is treated as unsupported;
    /// versioned line data is retained locally while the time heartbeat still ships.
    async fn supports_editor_line_metrics(&self) -> bool {
        if let Ok(cache) = self.line_metric_capability.lock() {
            if let Some((checked_at, supported)) = *cache {
                // Recheck negative results more often: they can mean a rolling
                // deployment or a temporary capability endpoint failure.
                let ttl = if supported { 300 } else { 30 };
                if checked_at.elapsed() < Duration::from_secs(ttl) {
                    return supported;
                }
            }
        }

        let url = format!(
            "{}/api/v2/capabilities",
            self.config.server_url.trim_end_matches('/')
        );
        let probe = async {
            let response = self
                .client
                .get(url)
                .send()
                .await
                .ok()?
                .error_for_status()
                .ok()?;
            let data = response.json::<Value>().await.ok()?;
            data.get("data")?
                .get("line_metric_versions")?
                .as_array()?
                .iter()
                .any(|version| {
                    version.get("version").and_then(Value::as_str) == Some("editor-before-after-v1")
                        && version.get("status").and_then(Value::as_str) == Some("supported")
                })
                .then_some(())
        };
        let supported = tokio::time::timeout(Duration::from_secs(3), probe)
            .await
            .ok()
            .flatten()
            .is_some();
        if let Ok(mut cache) = self.line_metric_capability.lock() {
            *cache = Some((Instant::now(), supported));
        }
        supported
    }

    pub async fn send_heartbeat(&self, heartbeat: Heartbeat) -> AppResult<SendReport> {
        self.send_heartbeats(vec![heartbeat]).await
    }

    pub async fn send_heartbeats(&self, mut heartbeats: Vec<Heartbeat>) -> AppResult<SendReport> {
        // Every transport payload gets an identity before it touches the dedup cache or
        // durable queue. This makes a retry/restart indistinguishable from the original
        // request at the backend even for older callers that did not know the field yet.
        for heartbeat in &mut heartbeats {
            // Apply the accuracy-first boundary before the payload can be queued or
            // retried. Verified hook/MCP/transcript events keep their identity; all
            // observer/editor-telemetry claims become unattributed AI activity.
            heartbeat.enforce_attribution_policy();
            if heartbeat.heartbeat_id.is_none() {
                heartbeat.heartbeat_id = Some(uuid::Uuid::new_v4().to_string());
            }
        }
        let queue = Queue::open()?;
        let filtered = self.filter_duplicates(heartbeats)?;
        let deduped = filtered.deduped;

        if filtered.heartbeats.is_empty() {
            // A previous attempt may have queued this same stable heartbeat ID after
            // the server was unreachable. The local cache can call the retry a
            // duplicate, but that must not prevent the durable queue from being
            // drained (otherwise it waits for an unrelated heartbeat).
            let flush = match self.flush_queue_inner(&queue, false).await {
                Ok(flush) => flush,
                Err(error) => FlushReport {
                    flushed: 0,
                    stopped_because: Some(format!("could not flush offline queue: {error}")),
                },
            };
            return Ok(SendReport {
                sent: 0,
                deduped,
                queued: 0,
                flushed: flush.flushed,
                error: flush.stopped_because,
            });
        }

        let payloads: Vec<serde_json::Value> = filtered
            .heartbeats
            .iter()
            .map(serde_json::to_value)
            .collect::<Result<_, _>>()?;

        let has_versioned_metrics = payloads.iter().any(has_editor_line_metrics);
        let mut deferred_line_metrics = 0usize;
        let wire_payloads = if has_versioned_metrics && !self.supports_editor_line_metrics().await {
            let scope = self.queue_scope();
            let mut wire_payloads = payloads.clone();
            for (source, wire) in payloads.iter().zip(&mut wire_payloads) {
                if !has_editor_line_metrics(source) {
                    continue;
                }
                queue.retain_line_measurement_scoped(&scope, source)?;
                strip_editor_line_metrics(wire);
                deferred_line_metrics += 1;
            }
            wire_payloads
        } else {
            payloads.clone()
        };
        let compatibility_warning = (deferred_line_metrics > 0).then(|| {
            format!(
                "server does not advertise editor-before-after-v1; retained {deferred_line_metrics} line measurement correction(s) locally"
            )
        });

        let send_result = if wire_payloads.len() == 1 {
            self.post_json("/api/v1/heartbeats", &wire_payloads[0])
                .await
        } else {
            self.post_json("/api/v1/heartbeats.bulk", &wire_payloads)
                .await
        };

        match send_result {
            Ok(()) => {
                self.clear_delivery_failure(&queue);
                let mut last_by_entity = filtered.last_by_entity;
                prune_stale_entries(&mut last_by_entity, chrono::Utc::now().timestamp() as f64);
                // The server has accepted the current payload at this point. Cache and
                // queue-maintenance failures are reported to the caller but must not turn
                // that confirmed send into a non-zero exit (which would make an editor
                // retry and double-count the heartbeat).
                let cache_error = self
                    .store_last_heartbeats(&last_by_entity)
                    .err()
                    .map(|error| format!("could not persist local dedup cache: {error}"));
                let retained_error = payloads
                    .iter()
                    .filter_map(|payload| {
                        payload
                            .get("heartbeat_id")
                            .and_then(Value::as_str)
                            .map(|heartbeat_id| {
                                queue.mark_line_measurement_base_accepted(
                                    &self.queue_scope(),
                                    heartbeat_id,
                                )
                            })
                    })
                    .find_map(Result::err)
                    .map(|error| {
                        format!("could not mark retained line metric base as accepted: {error}")
                    });
                let flush = match self.flush_queue_inner(&queue, true).await {
                    Ok(flush) => flush,
                    Err(error) => FlushReport {
                        flushed: 0,
                        stopped_because: Some(format!("could not flush offline queue: {error}")),
                    },
                };
                let error = [
                    cache_error,
                    retained_error,
                    flush.stopped_because,
                    compatibility_warning,
                ]
                .into_iter()
                .flatten()
                .collect::<Vec<_>>();
                Ok(SendReport {
                    sent: wire_payloads.len(),
                    deduped,
                    queued: 0,
                    flushed: flush.flushed,
                    error: (!error.is_empty()).then(|| error.join("; ")),
                })
            }
            Err(error) => {
                self.record_delivery_failure(&queue, &error);
                if is_retryable_heartbeat_delivery_error(&error) {
                    // A `Retry-After` applies to this first attempt too: without it the
                    // row is eligible again immediately and the next flush ignores what
                    // the server just asked for.
                    let retry_after = retry_after_seconds(&error);
                    for payload in &wire_payloads {
                        queue.push_scoped_after(payload, &self.queue_scope(), retry_after)?;
                    }
                    self.schedule_delivery_snapshot(false);
                    // Do not persist a failed payload in the local last-heartbeat
                    // cache: the stable ID must remain retryable, and the durable
                    // queue already provides the deduplication needed while the
                    // server is offline.
                    Ok(SendReport::queued(
                        0,
                        deduped,
                        wire_payloads.len(),
                        Some(
                            [Some(error.to_string()), compatibility_warning]
                                .into_iter()
                                .flatten()
                                .collect::<Vec<_>>()
                                .join("; "),
                        ),
                    ))
                } else {
                    // Permanent validation/auth/conflict responses are reported to
                    // the caller and deliberately never enter the retry queue.
                    Err(error)
                }
            }
        }
    }

    pub async fn flush_queue(&self) -> AppResult<FlushReport> {
        let queue = Queue::open()?;
        self.flush_queue_inner(&queue, false).await
    }

    pub async fn today(&self) -> AppResult<StatusBarSnapshot> {
        self.today_with_timezone(None).await
    }

    /// Probe authentication without requiring the status payload to be decoded.
    /// The CLI uses this for first-run onboarding, where a machine-readable result
    /// is more useful than an exit code and an opaque reqwest error.
    pub async fn verify(&self) -> AppResult<()> {
        let response = self
            .client
            .get(format!(
                "{}/api/v1/status_bar/today",
                self.config.server_url
            ))
            .send()
            .await?;
        let response = Self::reject_unauthorized(response)?;
        let response = response.error_for_status()?;
        // The body is optional for verification; only the ownership proof is read.
        let owner_id = response.json::<Value>().await.ok().and_then(|body| {
            body.get("queue_owner_id")
                .and_then(Value::as_str)
                .map(str::to_string)
        });
        self.on_successful_probe(owner_id.as_deref());
        Ok(())
    }

    /// Pings `POST /api/v2/me/presence/heartbeat` so a coworking room shows this user as
    /// active without requiring the dashboard tab to be open (an open tab already renews
    /// its own presence lease via the SSE stream). Best-effort: the caller decides how to
    /// treat a failure, since a missed presence ping should never affect time tracking.
    pub async fn presence_heartbeat(&self) -> AppResult<()> {
        let response = self
            .client
            .post(format!(
                "{}/api/v2/me/presence/heartbeat",
                self.config.server_url
            ))
            .send()
            .await?;
        let response = Self::reject_unauthorized(response)?;
        Self::error_for_status_with_body(response).await?;
        Ok(())
    }

    pub async fn today_with_timezone(
        &self,
        timezone: Option<&str>,
    ) -> AppResult<StatusBarSnapshot> {
        let mut request = self.client.get(format!(
            "{}/api/v1/status_bar/today",
            self.config.server_url
        ));
        if let Some(timezone) = timezone.filter(|value| !value.trim().is_empty()) {
            request = request.query(&[("timezone", timezone)]);
        }
        let response = request.send().await?;
        let response = Self::reject_unauthorized(response)?;
        let response = response.error_for_status()?;
        let snapshot = response.json::<StatusBarSnapshot>().await?;
        self.on_successful_probe(snapshot.queue_owner_id.as_deref());
        Ok(snapshot)
    }

    /// An authenticated read succeeded for this scope.
    ///
    /// That proves the server is reachable and the credential works, so a recorded
    /// network/server failure for this scope is stale and is cleared. A 401/402 is
    /// **not** cleared here: reading today's total keeps working while delivery is
    /// refused, so only a successful delivery resolves those.
    fn on_successful_probe(&self, owner_id: Option<&str>) {
        if let Ok(queue) = Queue::open() {
            Self::migrate_legacy_delivery_failure(&queue);
            if let Err(error) = queue.clear_delivery_failure(
                &self.queue_scope(),
                Some(&[
                    DeliveryFailureKind::Network.as_str(),
                    DeliveryFailureKind::ServerError.as_str(),
                ]),
            ) {
                tracing::warn!(%error, "could not clear a stale delivery failure");
            }
        }
        if let Some(owner_id) = owner_id {
            self.adopt_verified_owner(owner_id);
        }
    }

    /// Record the server's proof of this credential's account and move rows queued
    /// under an earlier credential of the same account onto it (API-key rotation).
    ///
    /// Only called with an owner id from a response the server authenticated with
    /// this client's own key. Best-effort: a local queue problem must never turn a
    /// successful probe into a failure.
    fn adopt_verified_owner(&self, owner_id: &str) {
        if self.config.api_key.is_none() || !is_valid_queue_owner_id(owner_id) {
            return;
        }
        let queue = match Queue::open() {
            Ok(queue) => queue,
            Err(error) => {
                tracing::warn!(%error, "could not open queue to record credential owner");
                return;
            }
        };
        let scope = self.queue_scope();
        if let Err(error) = queue.record_credential_owner(&scope, owner_id) {
            tracing::warn!(%error, "could not record credential owner");
            return;
        }
        match queue.rebind_same_owner(&scope, owner_id) {
            Ok(report) if report.rows_moved + report.duplicates_dropped > 0 => {
                tracing::info!(
                    rows_moved = report.rows_moved,
                    duplicates_dropped = report.duplicates_dropped,
                    "rebound queued heartbeats from a rotated API key of the same account"
                );
            }
            Ok(_) => {}
            Err(error) => tracing::warn!(%error, "same-account queue rebind failed"),
        }
    }

    /// Upload sanitized token/session usage parsed from an agent transcript. The
    /// capability header opts the caller into the nullable response contract used by
    /// the Kafka cutover; older binaries that omit it continue to receive the legacy
    /// direct-path response.
    pub async fn send_ai_usage(
        &self,
        records: &[AiUsageRecord],
    ) -> AppResult<AiUsageIngestReportV2> {
        let response = self
            .client
            .post(format!("{}/api/v1/ai/usage", self.config.server_url))
            .header("X-AtoAxis-Ai-Usage-Contract", "2")
            .json(records)
            .send()
            .await?;
        let response = Self::reject_unauthorized(response)?;
        let response = Self::error_for_status_with_body(response).await?;
        let body = response.json::<Value>().await.map_err(|_| {
            AppError::Protocol("AI usage response could not be decoded".to_string())
        })?;
        if let Ok(report) = serde_json::from_value::<AiUsageIngestReportV2>(body.clone()) {
            return Ok(report);
        }
        // During a rolling server upgrade an API replica may still return the
        // legacy direct-path shape. Treat that successful response as stored so
        // the durable client queue is not needlessly retried or dead-lettered.
        let legacy = serde_json::from_value::<AiUsageIngestReport>(body).map_err(|_| {
            AppError::Protocol("AI usage response did not match a known contract".to_string())
        })?;
        Ok(AiUsageIngestReportV2 {
            contract_version: 2,
            processing_state: AiUsageProcessingState::Stored,
            received: legacy.received,
            accepted: legacy.received.saturating_sub(legacy.duplicates_in_batch),
            duplicates_in_batch: legacy.duplicates_in_batch,
            stored: Some(legacy.stored),
            unpriced: Some(legacy.unpriced),
            sessions_touched: Some(legacy.sessions_touched),
        })
    }

    /// Upload a metadata-only AI diagnostics snapshot.  Diagnostics are optional
    /// health telemetry; callers should treat a failed upload as non-fatal and keep
    /// local setup/doctor output available.
    pub async fn send_ai_diagnostics(&self, report: &AiDiagnosticsReport) -> AppResult<()> {
        self.post_json("/api/v1/ai/diagnostics", report).await
    }

    /// Upload the typed diagnostics contract.  The v1 endpoint remains available
    /// for older clients, while new collectors send v2 so the server can preserve
    /// unavailable measurements as `null` and order snapshots by device sequence.
    pub async fn send_ai_diagnostics_v2(&self, report: &AiDiagnosticsReportV2) -> AppResult<()> {
        self.post_json("/api/v1/ai/diagnostics/v2", report).await
    }

    pub async fn repair_day(
        &self,
        date: &str,
        timezone: Option<&str>,
        apply: bool,
    ) -> AppResult<RepairDayReport> {
        let response = self
            .client
            .post(format!("{}/api/v1/repair/day", self.config.server_url))
            .json(&serde_json::json!({
                "date": date,
                "timezone": timezone,
                "apply": apply,
            }))
            .send()
            .await?;
        let response = Self::reject_unauthorized(response)?;
        Ok(response
            .error_for_status()?
            .json::<RepairDayReport>()
            .await?)
    }

    /// Apply identity-only corrections against existing canonical heartbeats.
    /// Retrying the same request is idempotent: the server returns `unchanged`
    /// once the canonical row already carries the requested tuple.
    pub async fn repair_ai_identity(
        &self,
        request: &AiIdentityRepairRequest,
    ) -> AppResult<AiIdentityRepairReport> {
        let response = self
            .client
            .post(format!(
                "{}/api/v1/ai/identity/repair",
                self.config.server_url
            ))
            .json(request)
            .send()
            .await?;
        let response = Self::reject_unauthorized(response)?;
        Ok(response
            .error_for_status()?
            .json::<AiIdentityRepairReport>()
            .await?)
    }

    /// Submit locally reparsed, metadata-only line candidates for an owner-scoped
    /// server preview. Applying or rolling back the returned job remains a
    /// first-party session action in Trust Center.
    pub async fn preview_measurement_repair(
        &self,
        repair_id: &str,
        start: &str,
        end: &str,
        timezone: &str,
        candidates: &[Value],
    ) -> AppResult<Value> {
        let response = self
            .client
            .post(format!(
                "{}/api/v2/me/measurement-repairs",
                self.config.server_url.trim_end_matches('/')
            ))
            .json(&serde_json::json!({
                "repair_id": repair_id,
                "start": start,
                "end": end,
                "timezone": timezone,
                "candidates": candidates,
            }))
            .send()
            .await?;
        let response = Self::reject_unauthorized(response)?;
        Self::error_for_status_with_body(response)
            .await?
            .json::<Value>()
            .await
            .map_err(|_| {
                AppError::Protocol("measurement repair preview could not be decoded".to_string())
            })
    }

    /// Turns a 401 into a message that actually says what to do about it, instead of
    /// letting it fall through to `error_for_status()` and print as an opaque
    /// `Http(reqwest::Error { kind: Status(401, None), .. })` — which was indistinguishable
    /// from "server unreachable" to a VS Code user (both surfaced as the same generic
    /// wakaclock-cli exit-code-1 toast). The most common real cause: the API key stored
    /// in the editor's own SecretStorage (set via "Wakaclock: Set API Key") doesn't match
    /// what the server currently recognizes — e.g. it was regenerated on the dashboard,
    /// which invalidates the previous key.
    fn reject_unauthorized(response: reqwest::Response) -> AppResult<reqwest::Response> {
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(AppError::Auth(
                "API key was rejected by the server. If you regenerated your API key on \
                 the dashboard, the old one stopped working — run \"Wakaclock: Set API Key\" \
                 again with a fresh key from Settings → API key."
                    .to_string(),
            ));
        }
        Ok(response)
    }

    fn filter_duplicates(&self, heartbeats: Vec<Heartbeat>) -> AppResult<FilteredHeartbeats> {
        let mut last_by_entity = self.load_last_heartbeats();
        let (filtered, deduped) = filter_duplicates_against(heartbeats, &mut last_by_entity)?;

        Ok(FilteredHeartbeats {
            heartbeats: filtered,
            deduped,
            last_by_entity,
        })
    }

    async fn flush_queue_inner(
        &self,
        queue: &Queue,
        accepted_direct: bool,
    ) -> AppResult<FlushReport> {
        let scope = self.queue_scope();
        let lease_owner = uuid::Uuid::new_v4().to_string();
        let pending = queue.claim_batch_scoped(&scope, &lease_owner)?;
        let mut flushed = 0;
        let mut stopped_because = None;

        // Queue entries may have been written by a pre-policy client. Reapply the
        // boundary at the broker flush so an upgrade cannot publish a stale inferred
        // name simply because it was already offline when the client was upgraded.
        let pending: Vec<_> = pending
            .into_iter()
            .map(|(id, payload)| (id, sanitize_queued_heartbeat_payload(payload)))
            .collect();
        let sidecar_count = queue.status_scoped(&scope)?.line_metrics_pending;
        let has_versioned_metrics = pending
            .iter()
            .any(|(_, payload)| has_editor_line_metrics(payload));
        let supports_line_metrics = (has_versioned_metrics || sidecar_count > 0)
            && self.supports_editor_line_metrics().await;
        let mut wire_pending = pending.clone();
        if !supports_line_metrics {
            for ((_, source), (_, wire)) in pending.iter().zip(wire_pending.iter_mut()) {
                if has_editor_line_metrics(source) {
                    queue.retain_line_measurement_scoped(&scope, source)?;
                    strip_editor_line_metrics(wire);
                }
            }
        }
        let payloads: Vec<_> = wire_pending
            .iter()
            .map(|(_, payload)| payload.clone())
            .collect();

        let delivery = match payloads.as_slice() {
            [] => Ok(()),
            [payload] => self.post_json("/api/v1/heartbeats", payload).await,
            payloads => self.post_json("/api/v1/heartbeats.bulk", payloads).await,
        };

        let main_delivery_accepted = delivery.is_ok();
        match delivery {
            Ok(()) => {
                for (id, _) in &pending {
                    queue.remove(*id)?;
                }
                for (_, payload) in &pending {
                    if let Some(heartbeat_id) = payload
                        .get("heartbeat_id")
                        .and_then(Value::as_str)
                        .filter(|_| has_editor_line_metrics(payload))
                    {
                        queue.mark_line_measurement_base_accepted(&scope, heartbeat_id)?;
                    }
                }
                flushed = pending.len();
            }
            Err(error)
                if is_credential_delivery_error(&error)
                    || is_retryable_heartbeat_delivery_error(&error) =>
            {
                stopped_because = Some(error.to_string());
                self.record_delivery_failure(queue, &error);
                for (id, _) in &pending {
                    if is_credential_delivery_error(&error) {
                        // Credentials may be repaired. Keep the only durable copy and
                        // pause this owner-bound queue rather than deleting activity.
                        queue.mark_retry_after(*id, Some(300))?;
                    } else {
                        queue.mark_retry_after(*id, retry_after_seconds(&error))?;
                    }
                }
            }
            Err(error) if pending.len() > 1 => {
                // Bulk validation is atomic, but one malformed legacy row must not
                // dead-letter valid siblings. Isolate permanent failures only; normal
                // recovery stays one bounded bulk request.
                self.record_delivery_failure(queue, &error);
                for (id, payload) in &pending {
                    match self.post_json("/api/v1/heartbeats", payload).await {
                        Ok(()) => {
                            queue.remove(*id)?;
                            flushed += 1;
                        }
                        Err(item_error) => {
                            stopped_because.get_or_insert_with(|| item_error.to_string());
                            self.record_delivery_failure(queue, &item_error);
                            if is_credential_delivery_error(&item_error) {
                                queue.mark_retry_after(*id, Some(300))?;
                                break;
                            } else if is_retryable_heartbeat_delivery_error(&item_error) {
                                queue.mark_retry_after(*id, retry_after_seconds(&item_error))?;
                                break;
                            } else {
                                queue.dead_letter(*id, &item_error.to_string())?;
                            }
                        }
                    }
                }
            }
            Err(error) => {
                stopped_because = Some(error.to_string());
                self.record_delivery_failure(queue, &error);
                if let Some((id, _)) = pending.first() {
                    queue.dead_letter(*id, &error.to_string())?;
                }
            }
        }

        queue.release_claim(&lease_owner)?;

        // Corrections are separate higher revisions. Send them only after the base
        // heartbeat is known to exist and the live server advertises this exact
        // version. Keep failures in the outbox; a retry must never create a second
        // line-count set or erase the original time heartbeat.
        if supports_line_metrics {
            for (id, correction) in queue.pending_line_measurements_scoped(&scope, 500)? {
                match self.post_json("/api/v1/heartbeats", &correction).await {
                    Ok(()) => queue.remove_pending_line_measurement(id)?,
                    Err(error) => {
                        self.record_delivery_failure(queue, &error);
                        stopped_because.get_or_insert_with(|| {
                            format!("retained line metric correction is still pending: {error}")
                        });
                        break;
                    }
                }
            }
        }

        // `wakaclock status` may be the only command that drains a backlog. Clear
        // the persisted refusal only after every currently eligible row was
        // accepted; a partial flush must continue to show its latest failure.
        let accepted_queued = main_delivery_accepted && flushed > 0;
        if accepted_queued {
            self.clear_delivery_failure(queue);
        }

        self.schedule_delivery_snapshot(accepted_direct || accepted_queued);

        Ok(FlushReport {
            flushed,
            stopped_because,
        })
    }

    /// Queue status is ancillary telemetry. Read it synchronously from the local
    /// queue, reserve at most one upload per minute, and send in the background so
    /// diagnostics never delays heartbeat collection or delivery.
    fn schedule_delivery_snapshot(&self, delivery_succeeded: bool) {
        let scope = self.queue_scope();
        let client = self.client.clone();
        let url = format!(
            "{}/api/v2/me/delivery-status",
            self.config.server_url.trim_end_matches('/')
        );
        tokio::spawn(async move {
            let snapshot = tokio::task::spawn_blocking(move || {
                let queue = Queue::open()?;
                if delivery_succeeded {
                    queue.record_scope_delivery_success(&scope)?;
                }
                queue.capture_delivery_snapshot_scoped(&scope)
            })
            .await;
            let snapshot = match snapshot {
                Ok(Ok(Some(snapshot))) => snapshot,
                Ok(Ok(None)) => return,
                Ok(Err(error)) => {
                    tracing::debug!(%error, "could not read local delivery queue for status snapshot");
                    return;
                }
                Err(error) => {
                    tracing::debug!(%error, "delivery status queue probe task failed");
                    return;
                }
            };
            let result = client
                .post(url)
                .json(&snapshot)
                .send()
                .await
                .and_then(reqwest::Response::error_for_status);
            if let Err(error) = result {
                tracing::debug!(%error, "delivery status snapshot upload failed");
            }
        });
    }

    async fn post_json<T: Serialize + ?Sized>(&self, path: &str, payload: &T) -> AppResult<()> {
        let response = self
            .client
            .post(format!("{}{}", self.config.server_url, path))
            .json(payload)
            .send()
            .await?;

        let response = Self::reject_unauthorized(response)?;
        Self::error_for_status_with_body(response).await?;
        Ok(())
    }

    /// Preserve the API's bounded JSON/text error body instead of returning only
    /// reqwest's status label. This is especially important for the transcript
    /// agent: its server-side ingest path can fail in several independent
    /// ClickHouse operations, and the response body identifies which one failed.
    async fn error_for_status_with_body(
        response: reqwest::Response,
    ) -> AppResult<reqwest::Response> {
        let status = response.status();
        if !status.is_client_error() && !status.is_server_error() {
            return Ok(response);
        }

        let retry_after_seconds = response
            .headers()
            .get(header::RETRY_AFTER)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.trim().parse::<u64>().ok());
        let body = response.text().await.unwrap_or_default();
        let body = body.trim();
        let message = if body.is_empty() {
            status
                .canonical_reason()
                .unwrap_or("request failed")
                .to_string()
        } else {
            body.chars().take(2_048).collect::<String>()
        };
        Err(AppError::HttpStatusRetry {
            status: status.as_u16(),
            message,
            retry_after_seconds,
        })
    }

    /// Read the per-entity dedup cache.
    ///
    /// Deliberately infallible: this is a cache, and a missing, corrupt, or
    /// wrong-schema file must degrade to "nothing seen yet" rather than abort the send.
    /// The previous version propagated a parse error, which meant one bad
    /// `last_heartbeat.json` — including the older single-record format this replaced —
    /// would block every heartbeat until the file was deleted by hand.
    fn load_last_heartbeats(&self) -> HashMap<String, Heartbeat> {
        let Ok(path) = Self::last_heartbeat_path() else {
            return HashMap::new();
        };
        let Ok(content) = fs::read_to_string(&path) else {
            return HashMap::new();
        };

        if let Ok(map) = serde_json::from_str::<HashMap<String, Heartbeat>>(&content) {
            return map;
        }

        // Migration from the single-heartbeat format written by earlier versions: keep
        // the one record it held rather than discarding it, so an upgrade mid-session
        // doesn't briefly forget the file the user is actively editing.
        match serde_json::from_str::<Heartbeat>(&content) {
            Ok(legacy) => HashMap::from([(legacy.entity.clone(), legacy)]),
            Err(_) => HashMap::new(),
        }
    }

    fn store_last_heartbeats(&self, last_by_entity: &HashMap<String, Heartbeat>) -> AppResult<()> {
        let path = Self::last_heartbeat_path()?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let content = serde_json::to_string_pretty(last_by_entity)?;
        fs::write(path, content)?;
        Ok(())
    }

    fn last_heartbeat_path() -> AppResult<PathBuf> {
        let home =
            dirs::home_dir().ok_or_else(|| AppError::NotFound("home directory".to_string()))?;
        Ok(home.join(".wakaclock").join("last_heartbeat.json"))
    }

    fn delivery_failure_path() -> AppResult<PathBuf> {
        let home =
            dirs::home_dir().ok_or_else(|| AppError::NotFound("home directory".to_string()))?;
        Ok(home.join(".wakaclock").join("last-delivery-failure.json"))
    }

    /// The legacy, unscoped refusal file written by binaries before delivery state
    /// moved into the queue database. Only read for the one-time migration and for
    /// diagnostics; it must never drive user-facing state, because it cannot say
    /// which server or account it was about.
    pub fn last_delivery_failure() -> Option<DeliveryFailure> {
        let path = Self::delivery_failure_path().ok()?;
        let raw = fs::read_to_string(path).ok()?;
        serde_json::from_str(&raw).ok()
    }

    /// This client's own (origin + credential) delivery failure, if unresolved.
    pub fn delivery_failure(&self) -> Option<DeliveryFailureRecord> {
        let queue = Queue::open().ok()?;
        Self::migrate_legacy_delivery_failure(&queue);
        queue
            .delivery_failure_for(&self.queue_scope())
            .ok()
            .flatten()
    }

    /// A refusal migrated from the pre-scope file, if one was ever recorded.
    ///
    /// Diagnostics only (`wakaclock doctor ai`): it cannot say which server or
    /// account it was about, so it must never drive user-facing state.
    pub fn legacy_unscoped_delivery_failure(&self) -> Option<DeliveryFailureRecord> {
        let queue = Queue::open().ok()?;
        Self::migrate_legacy_delivery_failure(&queue);
        queue
            .delivery_failure_for(&QueueScope {
                destination: LEGACY_UNSCOPED_DESTINATION.to_string(),
                owner: LEGACY_UNSCOPED_OWNER.to_string(),
            })
            .ok()
            .flatten()
    }

    /// Move a pre-scope refusal file into the queue database once, under a scope that
    /// is explicitly not any real origin/account, then delete the file. Nothing reads
    /// `LEGACY_UNSCOPED_*` for status; it exists so the record is not silently lost.
    fn migrate_legacy_delivery_failure(queue: &Queue) {
        let Ok(path) = Self::delivery_failure_path() else {
            return;
        };
        let Some(failure) = Self::last_delivery_failure() else {
            return;
        };
        let kind = failure.kind();
        let scope = QueueScope {
            destination: LEGACY_UNSCOPED_DESTINATION.to_string(),
            owner: LEGACY_UNSCOPED_OWNER.to_string(),
        };
        let record = DeliveryFailureRecord::new(
            kind.as_str(),
            failure.http_status,
            "legacy_unscoped_record",
        )
        .with_detail(failure.message.clone());
        // Delete only after the record is safely persisted.
        if queue.record_delivery_failure(&scope, &record).is_ok() {
            let _ = fs::remove_file(path);
        }
    }

    /// Without this, a real 402 (trial/subscription lapsed) or 401 (bad key) shows up
    /// only as a light day in the dashboard — the heartbeat is captured and durably
    /// queued, so nothing looks broken locally, but the server keeps refusing it.
    /// Recorded per origin + credential so one account's refusal never describes
    /// another's. Best-effort: failing to record a failure must never become a second
    /// failure.
    fn record_delivery_failure(&self, queue: &Queue, error: &AppError) {
        let record = DeliveryFailureRecord::new(
            DeliveryFailureKind::from_error(error).as_str(),
            http_status_of(error),
            delivery_message_code(error),
        )
        .with_detail(error.to_string());
        if let Err(error) = queue.record_delivery_failure(&self.queue_scope(), &record) {
            tracing::warn!(%error, "could not record delivery failure");
        }
    }

    /// A delivery got through for this scope, so nothing about it is failing.
    fn clear_delivery_failure(&self, queue: &Queue) {
        if let Err(error) = queue.clear_delivery_failure(&self.queue_scope(), None) {
            tracing::warn!(%error, "could not clear delivery failure");
        }
    }
}

/// Apply the transport-level attribution boundary to a JSON payload that predates the
/// current client binary. The normal path works with the typed [`Heartbeat`] value; a
/// queue flush intentionally works with JSON because old queue rows may omit fields that
/// were added after they were written. Only identity/provenance labels are changed.
fn has_editor_line_metrics(payload: &Value) -> bool {
    payload.get("line_metric_version").and_then(Value::as_str) == Some("editor-before-after-v1")
}

/// Old servers may accept the time heartbeat while silently ignoring fields they do
/// not know. Strip the entire line-measurement contract from that wire copy; the full
/// payload is separately held in SQLite until a compatible server is available.
fn strip_editor_line_metrics(payload: &mut Value) {
    let Some(object) = payload.as_object_mut() else {
        return;
    };
    for key in [
        "line_metric_version",
        "line_measurement_status",
        "line_measurement_reason",
        "measurement_window_id",
        "ai_lines_added",
        "ai_lines_deleted",
        "human_lines_added",
        "human_lines_deleted",
        "unattributed_lines_added",
        "unattributed_lines_deleted",
        "revision",
    ] {
        object.remove(key);
    }
}

fn sanitize_queued_heartbeat_payload(mut payload: Value) -> Value {
    let Some(object) = payload.as_object_mut() else {
        return payload;
    };

    let is_ai = object
        .get("is_ai_generated")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let raw_agent = queued_string_value(object, "ai_agent").map(str::to_string);
    let raw_provider = queued_string_value(object, "ai_provider").map(str::to_string);
    let raw_model = queued_string_value(object, "ai_model").map(str::to_string);
    let agent = normalize_identity_agent(raw_agent.as_deref());
    let provider = normalize_identity_provider(raw_provider.as_deref());
    let model = normalize_identity_model(raw_model.as_deref());
    let has_identity = raw_agent.is_some() || raw_provider.is_some() || raw_model.is_some();
    let source = queued_string_value(object, "ai_source").map(|value| value.to_ascii_lowercase());
    let identity_source = normalize_identity_source(queued_string_value(object, "identity_source"))
        .or_else(|| normalize_identity_source(source.as_deref()));
    let identity_status = normalize_identity_status(queued_string_value(object, "identity_status"));
    let _identity_reason =
        normalize_identity_reason(queued_string_value(object, "identity_reason"));
    for key in ["identity_turn_id", "identity_message_id"] {
        let normalized = object
            .get(key)
            .and_then(Value::as_str)
            .and_then(|value| normalize_identity_reference(Some(value)))
            .map(Value::String)
            .unwrap_or(Value::Null);
        object.insert(key.to_string(), normalized);
    }
    let confidence = queued_string_value(object, "ai_confidence");
    let trusted_source = identity_source
        .as_deref()
        .or(source.as_deref())
        .is_some_and(|value| {
            matches!(
                value,
                "agent_hook" | "mcp" | "structured_mcp" | "transcript"
            )
        });
    let explicit_conflict = identity_status.as_deref() == Some("conflict") && trusted_source;
    let resolution = if has_identity || is_ai {
        Some(resolve_identity(
            agent.as_deref(),
            &[provider.as_deref()],
            &[model.as_deref()],
            identity_source.as_deref().or(source.as_deref()),
            confidence,
        ))
    } else {
        None
    };
    let verified = resolution
        .as_ref()
        .is_some_and(|identity| identity.status.as_str() == "confirmed")
        && !explicit_conflict
        && trusted_source;
    let trusted_partial = agent.is_some() && trusted_source;
    let legacy_inferred = queued_string_value(object, "actor_type").is_some_and(|value| {
        matches!(
            value.to_ascii_lowercase().as_str(),
            "ai_inferred" | "inferred" | "correlated"
        )
    });
    let legacy_unknown = queued_string_value(object, "actor_type").is_some_and(|value| {
        matches!(
            value.to_ascii_lowercase().as_str(),
            "unknown" | "unattributed"
        )
    });

    if explicit_conflict {
        // Preserve the conflict diagnostic while removing both sides of the
        // contradictory tuple. A queue flush must not silently turn it into a
        // latest-wins model label.
        object.insert(
            "ai_agent".to_string(),
            agent.map(Value::String).unwrap_or(Value::Null),
        );
        object.insert("ai_provider".to_string(), Value::Null);
        object.insert("ai_model".to_string(), Value::Null);
        object.insert(
            "identity_status".to_string(),
            Value::String("conflict".to_string()),
        );
        object.insert(
            "identity_reason".to_string(),
            Value::String("conflicting_evidence".to_string()),
        );
        object.insert(
            "identity_source".to_string(),
            identity_source.map(Value::String).unwrap_or(Value::Null),
        );
        object.insert(
            "identity_schema_version".to_string(),
            Value::Number(serde_json::Number::from(IDENTITY_SCHEMA_VERSION)),
        );
    } else if (has_identity && !verified && !trusted_partial)
        || legacy_inferred
        || (legacy_unknown && (has_identity || is_ai))
    {
        object.insert("is_ai_generated".to_string(), Value::Bool(true));
        for key in ["ai_agent", "ai_provider", "ai_model"] {
            object.insert(key.to_string(), Value::Null);
        }
        object.insert(
            "ai_confidence".to_string(),
            Value::String("inferred".to_string()),
        );
        object.insert(
            "ai_source".to_string(),
            Value::String("observer".to_string()),
        );
        object.insert("attribution_source".to_string(), Value::Null);
        object.insert("attribution_confidence".to_string(), Value::Null);
        object.insert(
            "identity_status".to_string(),
            Value::String("unavailable".to_string()),
        );
        object.insert(
            "identity_reason".to_string(),
            Value::String("context_unavailable".to_string()),
        );
        object.insert("identity_source".to_string(), Value::Null);
        object.insert(
            "identity_schema_version".to_string(),
            Value::Number(serde_json::Number::from(IDENTITY_SCHEMA_VERSION)),
        );
    } else if let Some(identity) = resolution {
        // Persist the same normalized status/reason that a live typed heartbeat
        // receives. This also removes marker values from old queued JSON before
        // they reach the server.
        object.insert(
            "ai_agent".to_string(),
            agent.map(Value::String).unwrap_or(Value::Null),
        );
        object.insert(
            "ai_provider".to_string(),
            provider.map(Value::String).unwrap_or(Value::Null),
        );
        object.insert(
            "ai_model".to_string(),
            model.map(Value::String).unwrap_or(Value::Null),
        );
        object.insert(
            "identity_status".to_string(),
            Value::String(identity.status.as_str().to_string()),
        );
        object.insert(
            "identity_reason".to_string(),
            identity
                .reason
                .map(|reason| Value::String(reason.to_string()))
                .unwrap_or(Value::Null),
        );
        object.insert(
            "identity_schema_version".to_string(),
            Value::Number(serde_json::Number::from(IDENTITY_SCHEMA_VERSION)),
        );
        object.insert(
            "identity_source".to_string(),
            identity_source.map(Value::String).unwrap_or(Value::Null),
        );
        if is_ai && identity.status.as_str() == "unavailable" {
            object.insert(
                "ai_confidence".to_string(),
                Value::String("inferred".to_string()),
            );
        }
    } else if is_ai {
        object.insert("ai_provider".to_string(), Value::Null);
        object.insert("ai_model".to_string(), Value::Null);
        object.insert(
            "ai_confidence".to_string(),
            Value::String("inferred".to_string()),
        );
        object.insert(
            "identity_status".to_string(),
            Value::String("unavailable".to_string()),
        );
        object.insert(
            "identity_reason".to_string(),
            Value::String("context_unavailable".to_string()),
        );
        object.insert(
            "identity_schema_version".to_string(),
            Value::Number(serde_json::Number::from(IDENTITY_SCHEMA_VERSION)),
        );
        object.insert("identity_source".to_string(), Value::Null);
    } else {
        // Identity metadata is meaningful only for an AI activity. Clear stale
        // values in a legacy queue row so they cannot reappear on a Human/Unknown
        // history response after a retry.
        for key in [
            "identity_status",
            "identity_reason",
            "identity_source",
            "identity_schema_version",
            "identity_turn_id",
            "identity_message_id",
        ] {
            object.insert(key.to_string(), Value::Null);
        }
    }

    payload
}

fn queued_string_value<'a>(
    object: &'a serde_json::Map<String, Value>,
    key: &str,
) -> Option<&'a str> {
    object
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

struct FilteredHeartbeats {
    heartbeats: Vec<Heartbeat>,
    deduped: usize,
    /// The dedup cache updated with everything accepted in this batch, ready to persist
    /// once the send actually succeeds.
    last_by_entity: HashMap<String, Heartbeat>,
}

/// Decide which heartbeats survive dedup, comparing each against the last accepted
/// heartbeat **for its own entity**.
///
/// Keying on entity is what makes the window mean the same thing it does in WakaTime,
/// whose plugins track the last heartbeat per file. The earlier implementation kept a
/// single most-recent heartbeat for all files, so alternating between two files
/// (A→B→A→B) never matched — every heartbeat's predecessor was a different entity —
/// and dedup silently stopped applying during exactly the split-attention editing where
/// it matters most.
///
/// Pure and I/O-free so the rule can be tested without touching `~/.wakaclock`.
fn filter_duplicates_against(
    heartbeats: Vec<Heartbeat>,
    last_by_entity: &mut HashMap<String, Heartbeat>,
) -> AppResult<(Vec<Heartbeat>, usize)> {
    let mut filtered = Vec::with_capacity(heartbeats.len());
    let mut deduped = 0;

    for heartbeat in heartbeats {
        heartbeat.validate().map_err(AppError::Validation)?;

        let duplicate = last_by_entity
            .get(&heartbeat.entity)
            .map(|last| heartbeat.is_duplicate_of(last))
            .unwrap_or(false);

        if duplicate {
            deduped += 1;
            continue;
        }

        last_by_entity.insert(heartbeat.entity.clone(), heartbeat.clone());
        filtered.push(heartbeat);
    }

    Ok((filtered, deduped))
}

/// Drop cache entries too old to ever match again.
///
/// An entry older than the dedup window cannot make any future heartbeat a duplicate,
/// so keeping it only grows the file. This makes the cache self-bounding — it holds
/// roughly "files touched in the last two minutes" — with no LRU or size cap to tune.
fn prune_stale_entries(last_by_entity: &mut HashMap<String, Heartbeat>, now: f64) {
    last_by_entity.retain(|_, heartbeat| (now - heartbeat.time).abs() < DEDUP_WINDOW_SECONDS);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::heartbeat::EntityType;
    use uuid::Uuid;

    fn heartbeat(entity: &str, time: f64) -> Heartbeat {
        let mut hb = Heartbeat::new(
            Uuid::nil(),
            entity.to_string(),
            EntityType::File,
            "test".to_string(),
        );
        hb.time = time;
        hb
    }

    #[test]
    fn unsupported_line_contract_is_removed_from_wire_copy_but_time_is_preserved() {
        let mut payload = serde_json::json!({
            "heartbeat_id": "window-1",
            "time": 1_000.0,
            "active_seconds": 42.0,
            "line_metric_version": "editor-before-after-v1",
            "line_measurement_status": "measured",
            "line_measurement_reason": null,
            "measurement_window_id": "window-1",
            "ai_lines_added": 0,
            "human_lines_deleted": 2,
            "revision": 0
        });
        assert!(has_editor_line_metrics(&payload));

        strip_editor_line_metrics(&mut payload);

        assert!(!has_editor_line_metrics(&payload));
        assert_eq!(payload["heartbeat_id"], "window-1");
        assert_eq!(payload["time"], 1_000.0);
        assert_eq!(payload["active_seconds"], 42.0);
        assert!(payload.get("ai_lines_added").is_none());
        assert!(payload.get("line_metric_version").is_none());
    }

    /// The bug this per-entity cache exists to fix: with a single shared "last
    /// heartbeat", alternating between two files defeated dedup completely.
    #[test]
    fn alternating_files_still_dedup_per_file() {
        let mut cache = HashMap::new();
        let batch = vec![
            heartbeat("a.rs", 1_000.0),
            heartbeat("b.rs", 1_010.0),
            heartbeat("a.rs", 1_020.0), // duplicate of a.rs @1000
            heartbeat("b.rs", 1_030.0), // duplicate of b.rs @1010
        ];

        let (filtered, deduped) = filter_duplicates_against(batch, &mut cache).unwrap();

        assert_eq!(deduped, 2, "the two repeats must be recognised per file");
        assert_eq!(filtered.len(), 2);
        assert_eq!(cache.len(), 2, "one entry per distinct file");
    }

    #[test]
    fn each_file_keeps_its_own_window() {
        let mut cache = HashMap::new();
        filter_duplicates_against(vec![heartbeat("a.rs", 1_000.0)], &mut cache).unwrap();

        // Well outside a.rs's window, so not a duplicate even though a.rs is cached.
        let (filtered, deduped) =
            filter_duplicates_against(vec![heartbeat("a.rs", 1_200.0)], &mut cache).unwrap();
        assert_eq!(deduped, 0);
        assert_eq!(filtered.len(), 1);
        assert_eq!(
            cache["a.rs"].time, 1_200.0,
            "cache advances to the newest accepted"
        );
    }

    #[test]
    fn prune_drops_only_entries_past_the_window() {
        let mut cache = HashMap::from([
            ("old.rs".to_string(), heartbeat("old.rs", 1_000.0)),
            ("fresh.rs".to_string(), heartbeat("fresh.rs", 1_500.0)),
        ]);

        prune_stale_entries(&mut cache, 1_550.0);

        assert!(
            !cache.contains_key("old.rs"),
            "cannot match again, so dropped"
        );
        assert!(cache.contains_key("fresh.rs"));
    }

    #[test]
    fn queued_legacy_inference_is_sanitized_before_flush() {
        let payload = serde_json::json!({
            "is_ai_generated": false,
            "ai_agent": "codex",
            "ai_provider": "openai",
            "ai_model": "gpt-test",
            "ai_source": "ide_telemetry",
            "ai_confidence": "correlated",
            "actor_type": "ai_inferred"
        });

        let sanitized = sanitize_queued_heartbeat_payload(payload);
        assert_eq!(sanitized["is_ai_generated"], true);
        assert!(sanitized["ai_agent"].is_null());
        assert!(sanitized["ai_provider"].is_null());
        assert!(sanitized["ai_model"].is_null());
        assert_eq!(sanitized["ai_source"], "observer");
        assert_eq!(sanitized["ai_confidence"], "inferred");
    }

    #[test]
    fn queued_verified_hook_identity_is_preserved() {
        let payload = serde_json::json!({
            "is_ai_generated": true,
            "ai_agent": "codex",
            "ai_provider": "openai",
            "ai_model": "gpt-test",
            "ai_source": "agent_hook",
            "ai_confidence": "verified"
        });

        let sanitized = sanitize_queued_heartbeat_payload(payload);
        assert_eq!(sanitized["ai_agent"], "codex");
        assert_eq!(sanitized["ai_provider"], "openai");
        assert_eq!(sanitized["ai_model"], "gpt-test");
        assert_eq!(sanitized["identity_status"], "confirmed");
    }

    #[test]
    fn queued_internal_model_marker_becomes_partial_identity() {
        let payload = serde_json::json!({
            "is_ai_generated": true,
            "ai_agent": "codex",
            "ai_provider": "openai",
            "ai_model": "Model not reported",
            "ai_source": "transcript",
            "ai_confidence": "verified"
        });

        let sanitized = sanitize_queued_heartbeat_payload(payload);
        assert_eq!(sanitized["ai_agent"], "codex");
        assert_eq!(sanitized["ai_provider"], "openai");
        assert!(sanitized["ai_model"].is_null());
        assert_eq!(sanitized["identity_status"], "partial");
        assert_eq!(sanitized["identity_reason"], "missing_model");
    }

    #[test]
    fn classifies_authentication_error_from_local_config() {
        assert_eq!(
            classify_delivery_failure("Authentication failed: API key was rejected by the server"),
            DeliveryFailureKind::Auth401
        );
    }

    fn status_error(status: u16) -> AppError {
        AppError::HttpStatusRetry {
            status,
            message: "fixture".to_string(),
            retry_after_seconds: None,
        }
    }

    #[test]
    fn network_transport_maps_to_offline() {
        // A real transport error with no HTTP response (nothing listens on port 1).
        let error = AppError::Http(
            reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .unwrap()
                .get("http://127.0.0.1:1/api/v1/status_bar/today")
                .send()
                .expect_err("port 1 must refuse the connection"),
        );
        assert_eq!(
            DeliveryFailureKind::from_error(&error),
            DeliveryFailureKind::Network
        );
        assert_eq!(http_status_of(&error), None);
        assert_eq!(
            ConnectionState::from_failure_kind(DeliveryFailureKind::from_error(&error)),
            ConnectionState::Offline
        );
        // The persisted message form classifies the same way.
        assert_eq!(
            classify_delivery_failure(&error.to_string()),
            DeliveryFailureKind::Network
        );
    }

    #[test]
    fn http_402_maps_only_to_subscription_required() {
        let kind = DeliveryFailureKind::from_error(&status_error(402));
        assert_eq!(kind, DeliveryFailureKind::Payment402);
        assert_eq!(
            ConnectionState::from_failure_kind(kind),
            ConnectionState::SubscriptionRequired
        );
        for status in [400, 401, 403, 408, 422, 429, 500, 503] {
            assert_ne!(
                DeliveryFailureKind::from_http_status(status),
                DeliveryFailureKind::Payment402,
                "{status}"
            );
        }
    }

    #[test]
    fn http_401_maps_only_to_auth_rejected() {
        for error in [
            status_error(401),
            status_error(403),
            AppError::Auth("API key was rejected by the server".into()),
        ] {
            assert_eq!(
                ConnectionState::from_failure_kind(DeliveryFailureKind::from_error(&error)),
                ConnectionState::AuthRejected
            );
        }
        for status in [402, 408, 429, 500, 503] {
            assert_ne!(
                DeliveryFailureKind::from_http_status(status),
                DeliveryFailureKind::Auth401,
                "{status}"
            );
        }
    }

    #[test]
    fn http_429_and_503_are_retryable_server_errors() {
        for status in [408, 429, 500, 503] {
            let error = status_error(status);
            assert_eq!(
                ConnectionState::from_failure_kind(DeliveryFailureKind::from_error(&error)),
                ConnectionState::RetryableServerError,
                "{status}"
            );
            // The status mapping must agree with the unchanged retry policy.
            assert!(is_retryable_delivery_error(&error), "{status}");
        }
    }

    #[test]
    fn persisted_failure_prefers_the_recorded_kind_and_reads_legacy_records() {
        let future: DeliveryFailure = serde_json::from_str(
            r#"{"at":1.0,"message":"HTTP status 402: {}","kind":"a_kind_from_a_newer_binary"}"#,
        )
        .expect("an unknown kind must not discard the record");
        assert_eq!(future.kind, None);
        assert_eq!(future.kind(), DeliveryFailureKind::Payment402);

        // The persisted names match `as_str()`.
        for kind in [
            DeliveryFailureKind::Auth401,
            DeliveryFailureKind::Payment402,
            DeliveryFailureKind::Network,
            DeliveryFailureKind::Validation,
            DeliveryFailureKind::ServerError,
            DeliveryFailureKind::Other,
        ] {
            assert_eq!(serde_json::to_value(kind).unwrap(), kind.as_str());
        }

        let future: DeliveryFailure = serde_json::from_str(
            r#"{"at":1.0,"message":"HTTP status 402: {}","kind":"a_kind_from_a_newer_binary"}"#,
        )
        .expect("an unknown kind must not discard the record");
        assert_eq!(future.kind, None);
        assert_eq!(future.kind(), DeliveryFailureKind::Payment402);

        let typed: DeliveryFailure = serde_json::from_str(
            r#"{"at":1.0,"message":"HTTP error: error sending request for url (http://127.0.0.1:40213/)","kind":"network"}"#,
        )
        .unwrap();
        assert_eq!(typed.kind(), DeliveryFailureKind::Network);

        // Written by an older binary: no `kind`, message-only.
        let legacy: DeliveryFailure = serde_json::from_str(
            r#"{"at":1.0,"message":"HTTP status 402: {\"error\":\"trial expired\"}"}"#,
        )
        .unwrap();
        assert_eq!(legacy.kind(), DeliveryFailureKind::Payment402);
        assert_eq!(
            classify_delivery_failure(
                "HTTP error: HTTP status server error (503 Service Unavailable) for url (http://x/)"
            ),
            DeliveryFailureKind::ServerError
        );
    }

    #[test]
    fn only_transport_and_retryable_statuses_are_queued() {
        assert!(is_retryable_delivery_error(&AppError::HttpStatus {
            status: 408,
            message: "timeout".to_string(),
        }));
        assert!(is_retryable_delivery_error(&AppError::HttpStatus {
            status: 429,
            message: "rate limited".to_string(),
        }));
        assert!(is_retryable_delivery_error(&AppError::HttpStatus {
            status: 503,
            message: "unavailable".to_string(),
        }));
        assert!(!is_retryable_delivery_error(&AppError::HttpStatus {
            status: 400,
            message: "invalid heartbeat".to_string(),
        }));
        assert!(!is_retryable_delivery_error(&AppError::HttpStatus {
            status: 401,
            message: "unauthorized".to_string(),
        }));
        assert!(is_retryable_delivery_error(&AppError::HttpStatusRetry {
            status: 503,
            message: "down".to_string(),
            retry_after_seconds: Some(5),
        }));
        assert!(is_retryable_delivery_error(&AppError::Protocol(
            "AI usage response did not match a known contract".to_string(),
        )));
        assert!(!is_retryable_delivery_error(&AppError::Conflict(
            "duplicate".to_string()
        )));
        assert!(is_credential_delivery_error(&AppError::HttpStatus {
            status: 401,
            message: "replace the key".to_string(),
        }));
        assert!(is_credential_delivery_error(&AppError::HttpStatusRetry {
            status: 403,
            message: "permission changed".to_string(),
            retry_after_seconds: None,
        }));
    }

    #[test]
    fn identity_repair_payload_is_metadata_only_and_round_trips() {
        let request = AiIdentityRepairRequest {
            repair_run_id: "00000000-0000-0000-0000-000000000001".to_string(),
            corrections: vec![AiIdentityCorrection {
                ai_event_id: "codex-v1:event".to_string(),
                agent: "codex".to_string(),
                provider: "openai".to_string(),
                model: "gpt-5.6-sol".to_string(),
                source: "transcript".to_string(),
                session_id: Some("session-1".to_string()),
                turn_id: Some("turn-1".to_string()),
                message_id: Some("call-1".to_string()),
            }],
        };
        let value = serde_json::to_value(&request).expect("serializes");
        let object = value.as_object().expect("object");
        for forbidden in [
            "prompt",
            "response",
            "patch",
            "content",
            "source_text",
            "time",
        ] {
            assert!(!object.contains_key(forbidden));
        }
        assert_eq!(
            serde_json::from_value::<AiIdentityRepairRequest>(value).unwrap(),
            request
        );
    }
}
