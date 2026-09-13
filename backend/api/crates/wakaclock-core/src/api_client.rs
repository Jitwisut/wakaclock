use crate::{
    ai::{
        normalize_identity_agent, normalize_identity_model, normalize_identity_provider,
        normalize_identity_reason, normalize_identity_reference, normalize_identity_source,
        normalize_identity_status, resolve_identity, AiDiagnosticsReport, AiDiagnosticsReportV2,
        AiUsageIngestReport, AiUsageRecord, IDENTITY_SCHEMA_VERSION,
    },
    config::Config,
    error::{AppError, AppResult},
    heartbeat::{Heartbeat, DEDUP_WINDOW_SECONDS},
    queue::Queue,
};
use reqwest::{header, Client};
use serde::{Deserialize, Serialize};
use serde_json::Value;
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
    #[serde(default)]
    pub last_increment_seconds: Option<f64>,
    #[serde(default)]
    pub last_increment_source: Option<String>,
    #[serde(default)]
    pub discarded_seconds: f64,
}

/// Why the server last refused a heartbeat, and when. Persisted so a refusal outlives the
/// process that saw it.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryFailure {
    pub at: f64,
    pub message: String,
}

/// `wakaclock doctor ai` reports a delivery refusal split into `401` (bad/expired
/// credential), `402` (entitlement — trial or subscription lapsed, *not* a detection
/// failure), a network/transport problem, and a request the server rejected as
/// malformed. Collapsing these hides the one case — 402 — where local capture is
/// working perfectly and only billing is wrong.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryFailureKind {
    Auth401,
    Payment402,
    Network,
    Validation,
    Other,
}

impl DeliveryFailureKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Auth401 => "auth_401",
            Self::Payment402 => "payment_402",
            Self::Network => "network",
            Self::Validation => "validation",
            Self::Other => "other",
        }
    }
}

/// Classify a recorded refusal message. The messages come from `AppError`'s
/// `Display` (`"HTTP status <code>: <body>"`) and from `reqwest` transport errors,
/// so this matches on the shapes those produce rather than parsing structured data.
pub fn classify_delivery_failure(message: &str) -> DeliveryFailureKind {
    let lower = message.to_ascii_lowercase();
    if lower.contains("402")
        || lower.contains("trial expired")
        || lower.contains("subscription inactive")
    {
        DeliveryFailureKind::Payment402
    } else if lower.contains("401")
        || lower.contains("unauthorized")
        || lower.contains("invalid api key")
        || lower.contains("api key was rejected")
        || lower.contains("api key rejected")
        || lower.contains("authentication failed")
    {
        DeliveryFailureKind::Auth401
    } else if lower.contains("400")
        || lower.contains("422")
        || lower.contains("validation")
        || lower.contains("malformed")
        || lower.contains("invalid heartbeat")
    {
        DeliveryFailureKind::Validation
    } else if lower.contains("dns")
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

/// Whether a failed HTTP delivery should remain in the durable retry queue.
///
/// A transport error has no response and is safe to retry.  For an HTTP
/// response, only the statuses explicitly called out by the ingest contract
/// are retryable; validation/auth/permission/conflict errors are permanent and
/// retrying them would create an infinite local queue.
pub fn is_retryable_delivery_error(error: &AppError) -> bool {
    match error {
        AppError::Http(_) => true,
        AppError::HttpStatus { status, .. } => {
            *status == 408 || *status == 429 || (500..=599).contains(status)
        }
        AppError::HttpStatusRetry { status, .. } => {
            *status == 408 || *status == 429 || (500..=599).contains(status)
        }
        _ => false,
    }
}

fn retry_after_seconds(error: &AppError) -> Option<u64> {
    match error {
        AppError::HttpStatusRetry {
            retry_after_seconds, ..
        } => *retry_after_seconds,
        _ => None,
    }
}

impl DeliveryFailure {
    pub fn kind(&self) -> DeliveryFailureKind {
        classify_delivery_failure(&self.message)
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

        let client = Client::builder().default_headers(headers).build()?;
        Ok(Self { config, client })
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
            let flush = match self.flush_queue_inner(&queue).await {
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

        let send_result = if payloads.len() == 1 {
            self.post_json("/api/v1/heartbeats", &payloads[0]).await
        } else {
            self.post_json("/api/v1/heartbeats.bulk", &payloads).await
        };

        match send_result {
            Ok(()) => {
                self.clear_delivery_failure();
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
                let flush = match self.flush_queue_inner(&queue).await {
                    Ok(flush) => flush,
                    Err(error) => FlushReport {
                        flushed: 0,
                        stopped_because: Some(format!("could not flush offline queue: {error}")),
                    },
                };
                let error = match (cache_error, flush.stopped_because) {
                    (Some(cache_error), Some(flush_error)) => {
                        Some(format!("{cache_error}; {flush_error}"))
                    }
                    (Some(cache_error), None) => Some(cache_error),
                    (None, flush_error) => flush_error,
                };
                Ok(SendReport {
                    sent: payloads.len(),
                    deduped,
                    queued: 0,
                    flushed: flush.flushed,
                    error,
                })
            }
            Err(error) => {
                self.record_delivery_failure(&error.to_string());
                if is_retryable_delivery_error(&error) {
                    for payload in &payloads {
                        queue.push(payload)?;
                    }
                    // Do not persist a failed payload in the local last-heartbeat
                    // cache: the stable ID must remain retryable, and the durable
                    // queue already provides the deduplication needed while the
                    // server is offline.
                    Ok(SendReport::queued(
                        0,
                        deduped,
                        payloads.len(),
                        Some(error.to_string()),
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
        self.flush_queue_inner(&queue).await
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
        response.error_for_status()?;
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
        Ok(response.json::<StatusBarSnapshot>().await?)
    }

    /// Upload sanitized token/session usage parsed from an agent transcript. Unlike
    /// heartbeats this stream is not placed in the offline heartbeat queue: each event
    /// has its own stable provider id, so a failed or retried batch can simply be sent
    /// again without ever duplicating usage at the server.
    pub async fn send_ai_usage(&self, records: &[AiUsageRecord]) -> AppResult<AiUsageIngestReport> {
        let response = self
            .client
            .post(format!("{}/api/v1/ai/usage", self.config.server_url))
            .json(records)
            .send()
            .await?;
        let response = Self::reject_unauthorized(response)?;
        let response = Self::error_for_status_with_body(response).await?;
        Ok(response.json::<AiUsageIngestReport>().await?)
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
            .post(format!("{}/api/v1/ai/identity/repair", self.config.server_url))
            .json(request)
            .send()
            .await?;
        let response = Self::reject_unauthorized(response)?;
        Ok(response
            .error_for_status()?
            .json::<AiIdentityRepairReport>()
            .await?)
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

    async fn flush_queue_inner(&self, queue: &Queue) -> AppResult<FlushReport> {
        let pending = queue.pop_all()?;
        let mut flushed = 0;
        let mut stopped_because = None;

        for (id, payload) in pending {
            // Queue entries may have been written by a pre-policy client. Reapply the
            // boundary at the broker flush so an upgrade cannot publish a stale inferred
            // name simply because it was already offline when the client was upgraded.
            let payload = sanitize_queued_heartbeat_payload(payload);
            match self.post_json("/api/v1/heartbeats", &payload).await {
                Ok(()) => {
                    queue.remove(id)?;
                    flushed += 1;
                }
                Err(error) => {
                    stopped_because = Some(error.to_string());
                    if is_retryable_delivery_error(&error) {
                        queue.mark_retry_after(id, retry_after_seconds(&error))?;
                    } else {
                        // A queued row that now receives a permanent 4xx is
                        // quarantined by removal.  Keeping it would cause every
                        // future flush to repeat the same rejected request.
                        queue.remove(id)?;
                    }
                    break;
                }
            }
        }

        Ok(FlushReport {
            flushed,
            stopped_because,
        })
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

    /// The last recorded refusal, if the server has not accepted anything since.
    pub fn last_delivery_failure() -> Option<DeliveryFailure> {
        let path = Self::delivery_failure_path().ok()?;
        let raw = fs::read_to_string(path).ok()?;
        serde_json::from_str(&raw).ok()
    }

    /// Without this, a real 402 (trial/subscription lapsed) or 401 (bad key) shows up
    /// only as a light day in the dashboard — the heartbeat is captured and durably
    /// queued, so nothing looks broken locally, but the server keeps refusing it.
    /// Writing the reason down is what lets `wakaclock status` and `doctor ai` say "the
    /// server is refusing these" instead of nothing at all. Best-effort: failing to
    /// record a failure must never turn into a second failure.
    fn record_delivery_failure(&self, message: &str) {
        let Ok(path) = Self::delivery_failure_path() else {
            return;
        };
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let failure = DeliveryFailure {
            at: chrono::Utc::now().timestamp() as f64,
            message: message.to_string(),
        };
        if let Ok(serialized) = serde_json::to_string(&failure) {
            let _ = fs::write(&path, serialized);
        }
    }

    /// A send got through, so whatever was wrong no longer is.
    fn clear_delivery_failure(&self) {
        if let Ok(path) = Self::delivery_failure_path() {
            let _ = fs::remove_file(path);
        }
    }
}

/// Apply the transport-level attribution boundary to a JSON payload that predates the
/// current client binary. The normal path works with the typed [`Heartbeat`] value; a
/// queue flush intentionally works with JSON because old queue rows may omit fields that
/// were added after they were written. Only identity/provenance labels are changed.
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
    let _identity_reason = normalize_identity_reason(queued_string_value(object, "identity_reason"));
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

fn queued_string_value<'a>(object: &'a serde_json::Map<String, Value>, key: &str) -> Option<&'a str> {
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
        assert!(!is_retryable_delivery_error(&AppError::Conflict("duplicate".to_string())));
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
        for forbidden in ["prompt", "response", "patch", "content", "source_text", "time"] {
            assert!(!object.contains_key(forbidden));
        }
        assert_eq!(serde_json::from_value::<AiIdentityRepairRequest>(value).unwrap(), request);
    }
}
