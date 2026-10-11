//! Local AI Activity Broker runtime.
//!
//! The shared event contract and inbox live in `wakaclock-core::broker`.  This
//! module keeps legacy HTTP contracts as test fixtures and owns
//! the durable inbox, and the adapter that turns a broker event into the existing
//! normalized heartbeat path. Producers always use the on-demand SQLite path;
//! no producer discovers or contacts a local broker process.

#[cfg(test)]
use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, Path as AxumPath, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Serialize;
#[cfg(test)]
use std::sync::Arc;
use std::{
    error::Error,
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
};
#[cfg(test)]
use wakaclock_core::broker::{
    QuarantineDiagnostic, MAX_BATCH_BYTES, MAX_EDITOR_OBSERVATION_BYTES, MAX_EVENT_BYTES,
};
use wakaclock_core::{
    ai::{AiAttributionState, AiEditEvent},
    api_client::ApiClient,
    broker::{
        broker_discovery_path, broker_runtime_dir, BrokerBatchAck, BrokerDiscovery, BrokerEventAck,
        BrokerEventStatus, BrokerEventV1, BrokerIngestOutcome, BrokerStore, BrokerStoreStats,
        EditorObservationAck, EditorObservationIngestOutcome, EditorObservationV1, TransportKind,
        AI_SIDECAR_SCHEMA_VERSION, BROKER_SCHEMA_VERSION, EDITOR_WAIT_SECONDS,
        MAX_BATCH_EVENTS as CORE_MAX_BATCH_EVENTS,
    },
    config::Config,
    error::AppError,
    heartbeat::{
        ActivitySegment, ActorType, MAX_ACTIVITY_GAP_SECONDS, MAX_AI_TOOL_DURATION_SECONDS,
    },
    queue::Queue,
};

/// Maximum number of durable inbox rows a one-shot invocation claims per pass.
/// Re-export the core limit to the CLI so `sync` and the legacy compatibility
/// worker cannot accidentally drift to different batch sizes.
pub(crate) const MAX_BATCH_EVENTS: usize = CORE_MAX_BATCH_EVENTS;

use crate::agent_service;

const BROKER_AI_ACTIVITY_STREAM: &str = "broker-ai";

#[derive(Debug, Clone, Serialize)]
pub(crate) struct BrokerProcessReport {
    pub claimed: usize,
    pub processed: usize,
    pub retried: usize,
    pub dead_lettered: usize,
    pub pending: u64,
    pub retained_dead_letters: u64,
    pub owner_unconfirmed: u64,
}

#[cfg(test)]
#[derive(Clone)]
struct BrokerHttpState {
    token: Arc<str>,
    /// Production uses the canonical broker database. Tests may inject an isolated
    /// path without mutating process-global HOME state.
    store_path: Option<PathBuf>,
}

/// Convert a parser event into the versioned broker envelope.  Active seconds are
/// calculated by the caller's cursor when available; keeping them in the event makes
/// a durable retry independent from a later cursor update.
pub(crate) fn event_from_ai_edit(event: &AiEditEvent, active_seconds: f64) -> BrokerEventV1 {
    BrokerEventV1 {
        schema_version: BROKER_SCHEMA_VERSION,
        producer_version: None,
        event_type: wakaclock_core::broker::BrokerEventType::FileChange,
        event_id: event.event_id.clone(),
        occurred_at: event.occurred_at,
        entity: event.entity.to_string_lossy().into_owned(),
        project_root: event
            .project_root
            .as_ref()
            .map(|path| path.to_string_lossy().into_owned()),
        change_kind: event.change_kind,
        previous_entity: event
            .previous_entity
            .as_ref()
            .map(|path| path.to_string_lossy().into_owned()),
        agent: event.agent.clone(),
        provider: event.provider.clone(),
        model: event.model.clone(),
        session_id: event.session_id.clone(),
        turn_id: event.turn_id.clone(),
        identity_message_id: event.identity_message_id.clone(),
        identity_status: event.identity_status.clone(),
        identity_reason: event.identity_reason.clone(),
        identity_source: event.identity_source.clone(),
        source: event.source.clone(),
        confidence: event.confidence.clone(),
        actor_type: None,
        actor_confidence: None,
        lines_added: event.lines_added,
        lines_deleted: event.lines_deleted,
        content_fingerprint: None,
        active_seconds: Some(active_seconds.clamp(0.0, MAX_ACTIVITY_GAP_SECONDS)),
        transport: None,
        tool: None,
        tool_event_id: event.tool_event_id.clone(),
        // Transcript discovery is async/replayed, minutes or longer after the edit, so
        // there is no live env to declare an editor from — let `build_ai_heartbeat`'s
        // fallback (env, else agent name) decide when this is eventually processed.
        editor: None,
        producer_surface: event.producer_surface.clone(),
    }
}

/// Write the normalized event directly to the durable SQLite inbox and make one
/// best-effort processing pass. This is intentionally a one-shot operation: the
/// producer never discovers, opens a socket to, or starts a local broker process.
/// Validation/conflict responses are returned to the producer and are never silently
/// converted into a successful delivery.
pub(crate) async fn submit_events(
    config: &Config,
    api_client: &ApiClient,
    events: &[BrokerEventV1],
) -> Result<BrokerBatchAck, AppError> {
    if events.is_empty() {
        return Ok(BrokerBatchAck {
            accepted: 0,
            duplicate: 0,
            results: Vec::new(),
        });
    }
    let normalized = events
        .iter()
        .cloned()
        .map(BrokerEventV1::normalize)
        .collect::<Result<Vec<_>, _>>()?;

    let mut store = BrokerStore::open()?;
    let scope = wakaclock_core::editor_health::scope_id(&api_client.queue_scope());
    let outcomes = store.ingest_normalized_batch_scoped(&normalized, Some(&scope))?;
    let ack = batch_ack(&normalized, &outcomes);
    drop(store);

    // The inbox commit is the success boundary. A processor error leaves the row
    // retryable and therefore must not make the successful producer retry its edit.
    if let Err(error) = process_pending(config, api_client, MAX_BATCH_EVENTS).await {
        eprintln!(
            "Warning: broker fallback processing deferred code={}",
            error_code(&error)
        );
    }
    Ok(ack)
}

pub(crate) async fn submit_event(
    config: &Config,
    api_client: &ApiClient,
    event: BrokerEventV1,
) -> Result<BrokerEventAck, AppError> {
    let ack = submit_events(config, api_client, std::slice::from_ref(&event)).await?;
    ack.results
        .into_iter()
        .next()
        .ok_or_else(|| AppError::Validation("broker returned an empty acknowledgement".to_string()))
}

pub(crate) async fn submit_editor_observation_from_stdin(
    config: &Config,
    api_client: &ApiClient,
) -> Result<EditorObservationAck, AppError> {
    let mut stdin = String::new();
    std::io::stdin().read_to_string(&mut stdin)?;
    let observation = serde_json::from_str::<EditorObservationV1>(&stdin).map_err(|_| {
        AppError::Validation("editor observation failed metadata validation".to_string())
    })?;
    let observation = observation.normalize()?;
    let (outcome, status) = BrokerStore::open()?.ingest_editor_observation_scoped(
        &observation,
        Some(&wakaclock_core::editor_health::scope_id(
            &api_client.queue_scope(),
        )),
    )?;
    if matches!(
        outcome,
        EditorObservationIngestOutcome::Accepted
            | EditorObservationIngestOutcome::Duplicate
            | EditorObservationIngestOutcome::Matched
    ) {
        let _ = process_pending(config, api_client, MAX_BATCH_EVENTS).await;
    }
    Ok(status)
}

pub(crate) async fn editor_observation_status_for_cli(
    api_client: &ApiClient,
    observation_id: &str,
) -> Result<EditorObservationAck, AppError> {
    if !wakaclock_core::ai::event::is_safe_event_id(observation_id) {
        return Err(AppError::NotFound(
            "editor observation was not found".to_string(),
        ));
    }
    let current = api_client.queue_scope();
    let mut scopes = vec![wakaclock_core::editor_health::scope_id(&current)];
    scopes.extend(
        Queue::open()?
            .verified_editor_journal_scopes(&current)?
            .iter()
            .map(wakaclock_core::editor_health::scope_id),
    );
    BrokerStore::open()?
        .editor_observation_status_scoped(observation_id, &scopes)?
        .ok_or_else(|| AppError::NotFound("editor observation was not found".to_string()))
}

pub(crate) async fn submit_events_chunked(
    config: &Config,
    api_client: &ApiClient,
    events: &[BrokerEventV1],
) -> Result<BrokerBatchAck, AppError> {
    let mut combined = BrokerBatchAck {
        accepted: 0,
        duplicate: 0,
        results: Vec::with_capacity(events.len()),
    };
    for chunk in events.chunks(MAX_BATCH_EVENTS) {
        let ack = submit_events(config, api_client, chunk).await?;
        combined.accepted += ack.accepted;
        combined.duplicate += ack.duplicate;
        combined.results.extend(ack.results);
    }
    Ok(combined)
}

fn batch_ack(events: &[BrokerEventV1], outcomes: &[BrokerIngestOutcome]) -> BrokerBatchAck {
    let mut accepted = 0;
    let mut duplicate = 0;
    let results = events
        .iter()
        .zip(outcomes.iter())
        .map(|(event, outcome)| {
            let status = match outcome {
                BrokerIngestOutcome::Accepted => {
                    accepted += 1;
                    "accepted"
                }
                BrokerIngestOutcome::Duplicate => {
                    duplicate += 1;
                    "duplicate"
                }
                BrokerIngestOutcome::Conflict => "conflict",
            };
            BrokerEventAck {
                event_id: event.event_id.clone(),
                status: status.to_string(),
                actor_type: event.actor_type.unwrap_or(ActorType::Unknown),
                actor_confidence: event.actor_confidence.unwrap_or(0.0),
            }
        })
        .collect();
    BrokerBatchAck {
        accepted,
        duplicate,
        results,
    }
}

/// Process pending inbox rows.  SQLite handles the short claim/mark transactions;
/// no SQLite connection is held across an HTTP await, so the worker is Send-safe and
/// a crashed process leaves only an expiring lease behind.
pub(crate) async fn process_pending(
    config: &Config,
    api_client: &ApiClient,
    limit: usize,
) -> Result<BrokerProcessReport, AppError> {
    process_pending_inner(config, api_client, limit, false).await
}
pub(crate) async fn queue_pending(
    config: &Config,
    api_client: &ApiClient,
    limit: usize,
) -> Result<BrokerProcessReport, AppError> {
    process_pending_inner(config, api_client, limit, true).await
}
async fn process_pending_inner(
    config: &Config,
    api_client: &ApiClient,
    limit: usize,
    queue_only: bool,
) -> Result<BrokerProcessReport, AppError> {
    let (records, scopes) = {
        let mut store = BrokerStore::open()?;
        let current = api_client.queue_scope();
        let mut scopes = vec![wakaclock_core::editor_health::scope_id(&current)];
        scopes.extend(
            Queue::open()?
                .verified_editor_journal_scopes(&current)?
                .iter()
                .map(wakaclock_core::editor_health::scope_id),
        );
        (store.claim_ready_scoped(limit, Some(&scopes))?, scopes)
    };
    let mut report = BrokerProcessReport {
        claimed: records.len(),
        processed: 0,
        retried: 0,
        dead_lettered: 0,
        pending: 0,
        retained_dead_letters: 0,
        owner_unconfirmed: 0,
    };

    for record in records {
        match process_record(config, api_client, &record, queue_only).await {
            Ok(ProcessRecordOutcome::Processed) => {
                if BrokerStore::open()?
                    .mark_processed_for_attempt(&record.event_id, record.attempt_count)?
                {
                    report.processed += 1;
                }
            }
            Ok(ProcessRecordOutcome::Deferred) => {}
            Err(error) => {
                let status = BrokerStore::open()?.mark_retry_for_attempt(
                    &record.event_id,
                    record.attempt_count,
                    error_code(&error),
                    &error.to_string(),
                )?;
                if let Some(status) = status {
                    if status == BrokerEventStatus::DeadLetter {
                        report.dead_lettered += 1;
                    } else {
                        report.retried += 1;
                    }
                }
            }
        }
    }

    let store = BrokerStore::open()?;
    store.compact()?;
    (
        report.pending,
        report.retained_dead_letters,
        report.owner_unconfirmed,
    ) = store.handoff_health(&scopes)?;
    Ok(report)
}

enum ProcessRecordOutcome {
    Processed,
    Deferred,
}

fn error_code(error: &AppError) -> &'static str {
    match error {
        AppError::RuntimePaused => "paused_by_user",
        AppError::Validation(_) => "validation",
        AppError::Auth(_) => "auth",
        AppError::Http(_) | AppError::HttpStatus { .. } | AppError::HttpStatusRetry { .. } => {
            "delivery"
        }
        AppError::Queue(_) => "queue",
        AppError::Io(_) => "io",
        AppError::Serde(_) => "serialization",
        AppError::Conflict(_) => "conflict",
        AppError::ClickHouse(_) => "clickhouse",
        AppError::NotFound(_) => "not_found",
        AppError::Protocol(_) => "protocol",
    }
}

async fn process_record(
    config: &Config,
    api_client: &ApiClient,
    record: &wakaclock_core::broker::BrokerRecord,
    queue_only: bool,
) -> Result<ProcessRecordOutcome, AppError> {
    let event = &record.event;
    let event_time = event.occurred_at.timestamp_millis() as f64 / 1000.0;

    // Write correlation evidence as soon as the durable inbox has handed the event to
    // the processor, before any backend request. This keeps an external AI edit from
    // being classified as Human while the API is offline. The append is idempotent by
    // event_id so a lease recovery after a crash cannot grow duplicate correlation
    // records.
    append_broker_sidecar(event, record.scope_id.as_deref())
        .map_err(|_| AppError::Io(std::io::Error::other("broker_sidecar_unavailable")))?;

    let mut matched_editor = if event
        .editor
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
    {
        event.editor.clone()
    } else {
        BrokerStore::open()?.match_editor_observation_for_event(&record.event_id, event)?
    };
    // An observation can arrive between the first lookup and the defer write. Recheck
    // immediately before parking the event so a just-arrived VS Code signal is used
    // in this attempt instead of adding an unnecessary three-second delay.
    if matched_editor.is_none()
        && event.editor.is_none()
        && event.agent == "codex"
        && record.editor_wait_until.is_none()
    {
        matched_editor =
            BrokerStore::open()?.match_editor_observation_for_event(&record.event_id, event)?;
    }
    if matched_editor.is_none()
        && event.editor.is_none()
        && event.agent == "codex"
        && record.editor_wait_until.is_none()
    {
        let wait_until = Utc::now().timestamp().saturating_add(EDITOR_WAIT_SECONDS);
        BrokerStore::open()?.defer_for_editor(
            &record.event_id,
            record.attempt_count,
            wait_until,
        )?;
        return Ok(ProcessRecordOutcome::Deferred);
    }

    // Only a completed tool operation with an explicit elapsed duration carries
    // start/end evidence. A native PostToolUse hook can have a tool id and transport
    // but no start timestamp; keep that event on the legacy point/cadence stream so
    // it cannot manufacture a 120-second Active interval merely because a hook fired.
    let tool_duration_evidence = has_explicit_tool_duration_evidence(event);
    let active_seconds = if let Some(seconds) = event.active_seconds {
        seconds.min(if tool_duration_evidence {
            MAX_AI_TOOL_DURATION_SECONDS
        } else {
            MAX_ACTIVITY_GAP_SECONDS
        })
    } else {
        let mut state = AiAttributionState::open()?;
        state.record_activity(
            &record
                .scope_id
                .as_ref()
                .map(|scope| format!("{BROKER_AI_ACTIVITY_STREAM}|owner:{scope}"))
                .unwrap_or_else(|| BROKER_AI_ACTIVITY_STREAM.to_string()),
            event_time,
            MAX_ACTIVITY_GAP_SECONDS,
        )?
    };

    let ai_event = AiEditEvent {
        event_id: event.event_id.clone(),
        agent: event.agent.clone(),
        provider: event.provider.clone(),
        model: event.model.clone(),
        session_id: event.session_id.clone(),
        turn_id: event.turn_id.clone(),
        identity_message_id: event.identity_message_id.clone(),
        identity_status: event.identity_status.clone(),
        identity_reason: event.identity_reason.clone(),
        identity_source: event.identity_source.clone(),
        tool_event_id: event.tool_event_id.clone(),
        producer_surface: event.producer_surface.clone(),
        occurred_at: event.occurred_at,
        entity: PathBuf::from(&event.entity),
        project_root: event.project_root.as_deref().map(PathBuf::from),
        change_kind: event.change_kind,
        previous_entity: event.previous_entity.as_deref().map(PathBuf::from),
        lines_added: event.lines_added,
        lines_deleted: event.lines_deleted,
        input_tokens: None,
        output_tokens: None,
        source: event.source.clone(),
        confidence: event.confidence.clone(),
    };
    let mut heartbeat = crate::build_ai_heartbeat(config, &ai_event, active_seconds);
    // The hook declared its own editor context (env var, captured at fire time) when
    // one exists — that beats `build_ai_heartbeat`'s own env/agent-name fallback,
    // which only sees *this* daemon process's (editor-less) environment.
    if let Some(editor) = event
        .editor
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        heartbeat.editor = editor.to_string();
    }
    if let Some(editor) = matched_editor {
        heartbeat.editor = editor;
    } else if let Some(surface) = event
        .producer_surface
        .as_deref()
        .filter(|surface| *surface == "codex-desktop")
    {
        heartbeat.editor = surface.to_string();
    }
    heartbeat.heartbeat_id = Some(event.heartbeat_id());
    heartbeat.ai_change_id = event.tool_event_id.clone();
    // `BrokerEventV1::normalize` resolves the actor when the event enters the
    // durable inbox. Keep the actor inferred by `build_ai_heartbeat` for old
    // inbox rows that predate the enum fields; defaulting an absent value to
    // `Unknown` here used to erase a verified transcript identity just before
    // upload.
    heartbeat.actor_type = event.actor_type.unwrap_or(heartbeat.actor_type);
    heartbeat.actor_confidence = event.actor_confidence.unwrap_or_else(|| {
        heartbeat
            .actor_type
            .default_confidence(Some(event.source.as_str()), Some(event.confidence.as_str()))
    });
    heartbeat.is_ai_generated = heartbeat.actor_type.is_ai();
    if heartbeat.actor_type == ActorType::Unknown {
        // Legacy or weak transcript events can carry AI-shaped metadata without
        // enough provenance to enter either AI bucket. Remove the producer labels
        // before the API client applies its transport policy; otherwise that policy
        // would correctly scrub the labels but temporarily set the legacy boolean
        // to true, violating the unknown actor invariant before delivery.
        heartbeat.ai_agent = None;
        heartbeat.ai_provider = None;
        heartbeat.ai_model = None;
        heartbeat.ai_source = Some("observer".to_string());
        heartbeat.ai_confidence = Some("inferred".to_string());
        heartbeat.is_ai_generated = false;
    }
    heartbeat.activity_segments = if active_seconds > 0.0 {
        vec![ActivitySegment {
            segment_id: format!("{}:segment", event.heartbeat_id()),
            start: (heartbeat.time - active_seconds).max(0.0),
            end: heartbeat.time,
            source: Some(if tool_duration_evidence {
                "ai_tool_v1".to_string()
            } else {
                "ai".to_string()
            }),
        }]
    } else {
        Vec::new()
    };

    let report = if queue_only {
        api_client.queue_heartbeats(vec![heartbeat])?
    } else {
        api_client.send_heartbeats(vec![heartbeat]).await?
    };
    if report.sent == 0 && report.queued == 0 && report.deduped == 0 {
        return Err(AppError::Validation(
            "broker heartbeat was neither sent, queued nor deduplicated".to_string(),
        ));
    }

    let state = AiAttributionState::open()?;
    let delivery_id = record.event_id.clone();
    state.mark_delivered(&delivery_id, "broker")?;
    agent_service::record_heartbeat();
    Ok(ProcessRecordOutcome::Processed)
}

/// A tool id identifies an operation for attribution, but it does not by itself
/// identify an operation duration. The strict Active marker requires the producer
/// to provide the elapsed start/end measurement explicitly.
fn has_explicit_tool_duration_evidence(event: &BrokerEventV1) -> bool {
    let transport_is_tool_evidence = matches!(
        TransportKind::classify(event.transport.as_deref()),
        TransportKind::NativePlugin
            | TransportKind::Mcp
            | TransportKind::ToolSnapshot
            | TransportKind::Filesystem
            | TransportKind::Editor
    );
    transport_is_tool_evidence
        && event.tool_event_id.is_some()
        && event.transport.is_some()
        && event
            .active_seconds
            .is_some_and(|seconds| seconds.is_finite() && seconds >= 0.0)
}

fn append_broker_sidecar(
    event: &BrokerEventV1,
    owner_scope: Option<&str>,
) -> Result<(), Box<dyn Error>> {
    // The sequence is reserved in the broker's durable inbox database before this
    // append. A retry therefore reuses the same stream/sequence pair without an
    // O(n) scan of the JSONL file; the reader deduplicates a crash-boundary duplicate.
    let state_dir = broker_runtime_dir();
    fs::create_dir_all(&state_dir)?;
    let path = state_dir.join("ai-events.jsonl");
    let mut store = BrokerStore::open()?;
    let sidecar_session = owner_scope.map(|scope| {
        format!(
            "{}|owner:{scope}",
            event.session_id.as_deref().unwrap_or("")
        )
    });
    let sidecar_session = sidecar_session.as_deref().or(event.session_id.as_deref());
    let cursor = store.reserve_sidecar_cursor_scoped(&event.event_id, sidecar_session)?;
    if cursor.already_written {
        return Ok(());
    }
    let mut options = OpenOptions::new();
    options.create(true).append(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&path)?;
    set_private_permissions(&path)?;
    // Replay never reads today's file to manufacture historical edit identity.
    // Use only a producer fingerprint observed at the actual hook boundary.
    let content_fingerprint = event.content_fingerprint.as_deref();
    let payload = serde_json::json!({
        "schema_version": AI_SIDECAR_SCHEMA_VERSION,
        "owner_scope_id": owner_scope,
        "stream_id": cursor.stream_id,
        "sequence": cursor.sequence,
        "event_id": event.event_id,
        "entity": event.entity,
        "time": event.occurred_at.timestamp_millis() as f64 / 1000.0,
        "lines_added": event.lines_added,
        "lines_deleted": event.lines_deleted,
        "agent": event.agent,
        "provider": event.provider,
        "model": event.model,
        "session_id": event.session_id,
        "identity_message_id": event.identity_message_id,
        "source": event.source.as_str(),
        "confidence": event.confidence.as_str(),
        "identity_status": event.identity_status,
        "identity_reason": event.identity_reason,
        "identity_source": event.identity_source,
        "actor_type": event.actor_type,
        "actor_confidence": event.actor_confidence,
        "transport": event.transport,
        "tool": event.tool,
        "tool_event_id": event.tool_event_id,
        "producer_surface": event.producer_surface,
        "content_fingerprint": content_fingerprint,
        "change_kind": event.change_kind.as_str(),
        "previous_entity": event.previous_entity,
    });
    writeln!(file, "{}", serde_json::to_string(&payload)?)?;
    file.sync_all()?;
    set_private_permissions(&path)?;
    drop(file);
    #[cfg(unix)]
    fs::File::open(&state_dir)?.sync_all()?;
    store.mark_sidecar_written_scoped(&event.event_id, sidecar_session)?;
    Ok(())
}

#[cfg(test)]
fn router(state: BrokerHttpState) -> Router {
    Router::new()
        .route("/v1/health", get(health_handler))
        .route("/v1/status", get(status_handler))
        .route("/v1/events", post(event_handler))
        .route("/v1/events/batch", post(batch_handler))
        .route("/v1/editor-observations", post(editor_observation_handler))
        .route(
            "/v1/editor-observations/:observation_id",
            get(editor_observation_status_handler),
        )
        .layer(DefaultBodyLimit::max(MAX_BATCH_BYTES))
        .with_state(state)
}

#[cfg(test)]
fn open_store(state: Option<&BrokerHttpState>) -> Result<BrokerStore, AppError> {
    match state.and_then(|value| value.store_path.as_deref()) {
        Some(path) => BrokerStore::open_at(path),
        None => BrokerStore::open(),
    }
}

pub(crate) fn status_for_cli() -> Result<serde_json::Value, AppError> {
    let stats = BrokerStore::open()?.stats()?;
    let queue_count = Queue::open()
        .and_then(|queue| queue.len())
        .unwrap_or_default();
    // Status is intentionally about the supported runtime, not whether a legacy
    // LaunchAgent happens to still exist. A migration can expose the old service
    // for cleanup without making the extension believe that a collector is active.
    let legacy_service = agent_service::status();
    cleanup_discovery();
    let mut status = status_json(stats, queue_count, None, false);
    if let Some(object) = status.as_object_mut() {
        object.insert(
            "service_installed".to_string(),
            serde_json::Value::Bool(legacy_service.installed),
        );
        object.insert(
            "service_running".to_string(),
            serde_json::Value::Bool(legacy_service.running),
        );
        object.insert(
            "legacy_service_present".to_string(),
            serde_json::Value::Bool(legacy_service.installed || legacy_service.running),
        );
    }
    Ok(status)
}

#[cfg(test)]
async fn health_handler() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "protocol": BROKER_SCHEMA_VERSION,
        "cli_version": env!("CARGO_PKG_VERSION"),
    }))
}

#[cfg(test)]
async fn status_handler(headers: HeaderMap, State(state): State<BrokerHttpState>) -> Response {
    if !authorize(&headers, &state) {
        return error_response(StatusCode::UNAUTHORIZED, "broker token is invalid");
    }
    let stats = match open_store(Some(&state)).and_then(|store| store.stats()) {
        Ok(stats) => stats,
        Err(error) => return error_response(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()),
    };
    let queue_count = Queue::open()
        .and_then(|queue| queue.len())
        .unwrap_or_default();
    let discovery = read_discovery();
    Json(status_json(stats, queue_count, discovery, true)).into_response()
}

fn status_json(
    stats: BrokerStoreStats,
    queue_count: usize,
    discovery: Option<BrokerDiscovery>,
    running: bool,
) -> serde_json::Value {
    let started_at = discovery.as_ref().map(|value| value.started_at);
    let uptime_seconds = started_at
        .map(|started| (Utc::now().timestamp() - started).max(0))
        .unwrap_or(0);
    let last_delivery_at = stats.last_delivery_at;
    serde_json::json!({
        "runtime_mode": "on_demand",
        "running": running,
        "pid": discovery.as_ref().map(|value| value.pid),
        "endpoint": discovery.as_ref().map(|value| value.endpoint.clone()),
        "protocol": BROKER_SCHEMA_VERSION,
        "started_at": started_at,
        "uptime_seconds": uptime_seconds,
        "last_received_at": stats.last_received_at,
        "last_processed_at": stats.last_processed_at,
        "last_delivery_at": last_delivery_at,
        "inbox": stats,
        "outbound_queue_count": queue_count,
    })
}

#[cfg(test)]
async fn event_handler(
    headers: HeaderMap,
    State(state): State<BrokerHttpState>,
    body: Bytes,
) -> Response {
    if !authorize(&headers, &state) {
        return error_response(StatusCode::UNAUTHORIZED, "broker token is invalid");
    }
    if body.len() > MAX_EVENT_BYTES {
        return error_response(StatusCode::PAYLOAD_TOO_LARGE, "broker event is too large");
    }
    let event = match serde_json::from_slice::<BrokerEventV1>(&body) {
        Ok(event) => event,
        Err(_) => {
            // planai2.md Phase 1 (D2): never echo the raw serde error (it can quote a
            // rejected field's value). Report field names only.
            let diagnostic = QuarantineDiagnostic::inspect(&body);
            eprintln!("broker quarantined an event: {}", diagnostic.message);
            return error_response(StatusCode::UNPROCESSABLE_ENTITY, &diagnostic.message);
        }
    };
    let event = match event.normalize() {
        Ok(event) => event,
        Err(error) => return error_response(StatusCode::UNPROCESSABLE_ENTITY, &error.to_string()),
    };
    match event.serialized_len() {
        Ok(size) if size <= MAX_EVENT_BYTES => {}
        Ok(_) => return error_response(StatusCode::PAYLOAD_TOO_LARGE, "broker event is too large"),
        Err(_) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "broker event cannot be serialized",
            )
        }
    }
    let outcome = match open_store(Some(&state)).and_then(|store| store.ingest_normalized(&event)) {
        Ok(outcome) => outcome,
        Err(error) => return store_error_response(error),
    };
    let ack = batch_ack(std::slice::from_ref(&event), &[outcome]);
    let status = if outcome == BrokerIngestOutcome::Accepted {
        StatusCode::ACCEPTED
    } else if outcome == BrokerIngestOutcome::Duplicate {
        StatusCode::OK
    } else {
        StatusCode::CONFLICT
    };
    (
        status,
        Json(ack.results.into_iter().next().expect("single ack")),
    )
        .into_response()
}

#[cfg(test)]
async fn batch_handler(
    headers: HeaderMap,
    State(state): State<BrokerHttpState>,
    body: Bytes,
) -> Response {
    if !authorize(&headers, &state) {
        return error_response(StatusCode::UNAUTHORIZED, "broker token is invalid");
    }
    if body.len() > MAX_BATCH_BYTES {
        return error_response(StatusCode::PAYLOAD_TOO_LARGE, "broker batch is too large");
    }
    let events = match serde_json::from_slice::<Vec<BrokerEventV1>>(&body) {
        Ok(events) => events,
        Err(_) => {
            // planai2.md Phase 1 (D2): inspect each element for forbidden/unknown
            // field names without echoing any value from the raw error.
            let mut fields: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
            let mut forbidden = false;
            if let Ok(serde_json::Value::Array(items)) =
                serde_json::from_slice::<serde_json::Value>(&body)
            {
                for item in &items {
                    let diagnostic = QuarantineDiagnostic::inspect(
                        &serde_json::to_vec(item).unwrap_or_default(),
                    );
                    forbidden |= diagnostic.carries_forbidden_content();
                    fields.extend(diagnostic.unknown_fields);
                }
            }
            let message = if forbidden {
                format!(
                    "broker batch carries content-bearing field(s) that must never be sent: {}",
                    fields.into_iter().collect::<Vec<_>>().join(", ")
                )
            } else if !fields.is_empty() {
                format!(
                    "broker batch has field(s) outside the metadata contract: {}",
                    fields.into_iter().collect::<Vec<_>>().join(", ")
                )
            } else {
                "broker batch failed strict metadata validation".to_string()
            };
            eprintln!("broker quarantined a batch: {message}");
            return error_response(StatusCode::UNPROCESSABLE_ENTITY, &message);
        }
    };
    if events.is_empty() || events.len() > MAX_BATCH_EVENTS {
        return error_response(
            StatusCode::UNPROCESSABLE_ENTITY,
            "broker batch must contain between 1 and 500 events",
        );
    }
    let normalized = match events
        .into_iter()
        .map(BrokerEventV1::normalize)
        .collect::<Result<Vec<_>, _>>()
    {
        Ok(events) => events,
        Err(error) => return error_response(StatusCode::UNPROCESSABLE_ENTITY, &error.to_string()),
    };
    if normalized.iter().any(|event| {
        event
            .serialized_len()
            .map(|size| size > MAX_EVENT_BYTES)
            .unwrap_or(true)
    }) {
        return error_response(StatusCode::PAYLOAD_TOO_LARGE, "broker event is too large");
    }
    if serde_json::to_vec(&normalized)
        .map(|body| body.len() > MAX_BATCH_BYTES)
        .unwrap_or(true)
    {
        return error_response(StatusCode::PAYLOAD_TOO_LARGE, "broker batch is too large");
    }
    let outcomes = match open_store(Some(&state))
        .and_then(|mut store| store.ingest_normalized_batch(&normalized))
    {
        Ok(outcomes) => outcomes,
        Err(error) => return store_error_response(error),
    };
    let ack = batch_ack(&normalized, &outcomes);
    let status = if ack.accepted == 0 && ack.duplicate == normalized.len() {
        StatusCode::OK
    } else {
        StatusCode::ACCEPTED
    };
    (status, Json(ack)).into_response()
}

#[cfg(test)]
async fn editor_observation_handler(
    headers: HeaderMap,
    State(state): State<BrokerHttpState>,
    body: Bytes,
) -> Response {
    if !authorize(&headers, &state) {
        return error_response(StatusCode::UNAUTHORIZED, "broker token is invalid");
    }
    if body.len() > MAX_EDITOR_OBSERVATION_BYTES {
        return error_response(
            StatusCode::PAYLOAD_TOO_LARGE,
            "editor observation is too large",
        );
    }
    let observation = match serde_json::from_slice::<EditorObservationV1>(&body) {
        Ok(observation) => observation,
        Err(_) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "editor observation failed metadata validation",
            )
        }
    };
    let observation = match observation.normalize() {
        Ok(observation) => observation,
        Err(_) => {
            return error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "editor observation failed metadata validation",
            )
        }
    };
    let result = match open_store(Some(&state))
        .and_then(|store| store.ingest_editor_observation(&observation))
    {
        Ok(result) => result,
        Err(error) => return store_error_response(error),
    };
    let status = match result.0 {
        EditorObservationIngestOutcome::Accepted => StatusCode::ACCEPTED,
        EditorObservationIngestOutcome::Duplicate | EditorObservationIngestOutcome::Matched => {
            StatusCode::OK
        }
    };
    (status, Json(result.1)).into_response()
}

#[cfg(test)]
async fn editor_observation_status_handler(
    headers: HeaderMap,
    State(state): State<BrokerHttpState>,
    AxumPath(observation_id): AxumPath<String>,
) -> Response {
    if !authorize(&headers, &state) {
        return error_response(StatusCode::UNAUTHORIZED, "broker token is invalid");
    }
    if !wakaclock_core::ai::event::is_safe_event_id(&observation_id) {
        return error_response(StatusCode::NOT_FOUND, "editor observation was not found");
    }
    match open_store(Some(&state))
        .and_then(|store| store.editor_observation_status(&observation_id))
    {
        Ok(Some(status)) => Json(status).into_response(),
        Ok(None) => error_response(StatusCode::NOT_FOUND, "editor observation was not found"),
        Err(error) => store_error_response(error),
    }
}

#[cfg(test)]
fn authorize(headers: &HeaderMap, state: &BrokerHttpState) -> bool {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .is_some_and(|token| token == state.token.as_ref())
}

#[cfg(test)]
fn store_error_response(error: AppError) -> Response {
    match error {
        AppError::Conflict(message) => error_response(StatusCode::CONFLICT, &message),
        AppError::Validation(message) => error_response(StatusCode::UNPROCESSABLE_ENTITY, &message),
        // Storage errors can contain local database paths. Keep those out of the
        // loopback API response; the status endpoint exposes only a sanitized code.
        _ => error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "broker storage is temporarily unavailable",
        ),
    }
}

#[cfg(test)]
fn error_response(status: StatusCode, message: &str) -> Response {
    (status, Json(serde_json::json!({ "error": message }))).into_response()
}

fn set_private_permissions(path: &Path) -> Result<(), Box<dyn Error>> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    #[cfg(windows)]
    {
        // Do not rely on the profile directory's inherited ACL: the portable CLI
        // path also writes the bearer token and discovery metadata. `whoami` gives
        // us the exact current account (including a domain prefix when present).
        let account = Command::new("whoami")
            .output()
            .map_err(|_| "could not resolve current Windows account")?;
        let account = String::from_utf8_lossy(&account.stdout).trim().to_string();
        if account.is_empty() {
            return Err("could not resolve current Windows account".into());
        }
        let path_string = path.to_string_lossy().to_string();
        let grant = format!("{account}:F");
        let status = Command::new("icacls")
            .args([
                path_string.as_str(),
                "/inheritance:r",
                "/grant:r",
                grant.as_str(),
            ])
            .status()
            .map_err(|_| "could not apply private Windows ACL")?;
        if !status.success() {
            return Err("could not apply private Windows ACL".into());
        }
    }
    Ok(())
}

/// Remove stale discovery metadata without touching the durable inbox or token.
pub(crate) fn cleanup_discovery() {
    let _ = fs::remove_file(broker_discovery_path());
}

#[cfg(test)]
fn read_discovery() -> Option<BrokerDiscovery> {
    fs::read_to_string(broker_discovery_path())
        .ok()
        .and_then(|json| serde_json::from_str::<BrokerDiscovery>(&json).ok())
        .filter(|discovery| discovery.schema_version == BROKER_SCHEMA_VERSION)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use chrono::Utc;
    use std::path::PathBuf;
    use tower::ServiceExt;
    use wakaclock_core::ai::{AiConfidence, AiEventSource};
    use wakaclock_core::broker::BrokerChangeKind;

    fn event(id: &str) -> BrokerEventV1 {
        BrokerEventV1 {
            schema_version: BROKER_SCHEMA_VERSION,
            producer_version: None,
            event_type: wakaclock_core::broker::BrokerEventType::FileChange,
            event_id: id.to_string(),
            occurred_at: Utc::now(),
            entity: "/workspace/src/lib.rs".to_string(),
            project_root: Some("/workspace".to_string()),
            change_kind: BrokerChangeKind::Modify,
            previous_entity: None,
            agent: "claude-code".to_string(),
            provider: Some("anthropic".to_string()),
            model: None,
            session_id: Some("session".to_string()),
            turn_id: None,
            identity_message_id: None,
            identity_status: None,
            identity_reason: None,
            identity_source: None,
            source: AiEventSource::AgentHook,
            confidence: AiConfidence::Verified,
            actor_type: None,
            actor_confidence: None,
            lines_added: Some(1),
            lines_deleted: Some(0),
            content_fingerprint: None,
            active_seconds: Some(1.0),
            transport: Some("shell_hook".to_string()),
            tool: Some("apply_patch".to_string()),
            tool_event_id: Some("tool".to_string()),
            editor: None,
            producer_surface: None,
        }
    }

    #[test]
    fn strict_ai_tool_duration_requires_an_explicit_elapsed_measurement() {
        let mut hook = event("hook-without-duration");
        hook.active_seconds = None;
        assert!(!has_explicit_tool_duration_evidence(&hook));

        let completed = event("completed-tool");
        assert!(has_explicit_tool_duration_evidence(&completed));

        let mut legacy = completed.clone();
        legacy.transport = Some("cli_compat".to_string());
        assert!(!has_explicit_tool_duration_evidence(&legacy));
    }

    #[test]
    fn event_from_parser_is_versioned_and_metadata_only() {
        let ai = AiEditEvent {
            event_id: "evt".to_string(),
            agent: "codex".to_string(),
            provider: Some("openai".to_string()),
            model: None,
            session_id: None,
            turn_id: None,
            identity_message_id: None,
            identity_status: None,
            identity_reason: None,
            identity_source: None,
            tool_event_id: None,
            producer_surface: None,
            occurred_at: Utc::now(),
            entity: PathBuf::from("/workspace/src/lib.rs"),
            project_root: Some(PathBuf::from("/workspace")),
            change_kind: BrokerChangeKind::Modify,
            previous_entity: None,
            lines_added: Some(2),
            lines_deleted: Some(1),
            input_tokens: None,
            output_tokens: None,
            source: AiEventSource::Transcript,
            confidence: AiConfidence::Inferred,
        };
        let event = event_from_ai_edit(&ai, 2.0).normalize().unwrap();
        assert_eq!(event.schema_version, BROKER_SCHEMA_VERSION);
        // Accuracy-over-coverage (plans/decision-accuracy-over-coverage.md): a
        // transcript-sourced event with non-`verified` confidence is unattributed, not
        // a weaker AI guess — see `resolve_attribution`'s non-verified fallback.
        assert_eq!(event.actor_type, Some(ActorType::Unknown));
        let value = serde_json::to_value(event).unwrap();
        assert!(!value.as_object().unwrap().contains_key("prompt"));
    }

    #[test]
    fn event_from_parser_preserves_codex_rename_identity() {
        let ai = AiEditEvent {
            event_id: "rename-event".to_string(),
            agent: "codex".to_string(),
            provider: Some("openai".to_string()),
            model: None,
            session_id: Some("session".to_string()),
            turn_id: None,
            identity_message_id: None,
            identity_status: None,
            identity_reason: None,
            identity_source: None,
            tool_event_id: Some("call-rename".to_string()),
            producer_surface: None,
            occurred_at: Utc::now(),
            entity: PathBuf::from("/workspace/src/new.rs"),
            project_root: Some(PathBuf::from("/workspace")),
            change_kind: BrokerChangeKind::Rename,
            previous_entity: Some(PathBuf::from("/workspace/src/old.rs")),
            lines_added: Some(1),
            lines_deleted: Some(1),
            input_tokens: None,
            output_tokens: None,
            source: AiEventSource::Transcript,
            confidence: AiConfidence::Verified,
        };

        let event = event_from_ai_edit(&ai, 0.0).normalize().unwrap();
        assert_eq!(event.change_kind, BrokerChangeKind::Rename);
        assert_eq!(
            event.previous_entity.as_deref(),
            Some("/workspace/src/old.rs")
        );
    }

    #[test]
    fn batch_ack_counts_accepted_and_duplicates() {
        let events = vec![
            event("one").normalize().unwrap(),
            event("two").normalize().unwrap(),
        ];
        let outcomes = vec![
            BrokerIngestOutcome::Accepted,
            BrokerIngestOutcome::Duplicate,
        ];
        let ack = batch_ack(&events, &outcomes);
        assert_eq!(ack.accepted, 1);
        assert_eq!(ack.duplicate, 1);
        assert_eq!(ack.results[0].actor_type, ActorType::AiVerified);
    }

    #[test]
    fn status_does_not_include_token_or_event_payload() {
        let stats = BrokerStoreStats {
            pending: 1,
            ..Default::default()
        };
        let value = status_json(
            stats,
            2,
            Some(BrokerDiscovery {
                endpoint: "http://127.0.0.1:1234".to_string(),
                pid: 42,
                schema_version: BROKER_SCHEMA_VERSION,
                started_at: 1,
            }),
            true,
        );
        let text = value.to_string();
        assert!(!text.contains("broker.token"));
        assert!(!text.contains("prompt"));
        assert!(text.contains("outbound_queue_count"));
    }

    fn temp_db(name: &str) -> PathBuf {
        let nonce = Utc::now().timestamp_nanos_opt().unwrap_or_default();
        std::env::temp_dir().join(format!("wakaclock-cli-broker-{name}-{nonce}.db"))
    }

    #[tokio::test]
    async fn health_is_public_but_events_require_bearer_token() {
        let path = temp_db("auth");
        let app = router(BrokerHttpState {
            token: Arc::from("test-token"),
            store_path: Some(path.clone()),
        });

        let health = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/v1/health")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(health.status(), StatusCode::OK);

        let unauthorized = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/events")
                    .body(Body::from(
                        serde_json::to_vec(&event("auth-event")).unwrap(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(unauthorized.status(), StatusCode::UNAUTHORIZED);

        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }

    #[tokio::test]
    async fn http_editor_observation_correlates_and_reports_status() {
        let path = temp_db("editor-observation-http");
        let app = router(BrokerHttpState {
            token: Arc::from("test-token"),
            store_path: Some(path.clone()),
        });
        let request = |method: &'static str, uri: &'static str, body: Vec<u8>| {
            Request::builder()
                .method(method)
                .uri(uri)
                .header(header::AUTHORIZATION, "Bearer test-token")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(body))
                .unwrap()
        };

        let ai_event = event("editor-http-event").normalize().unwrap();
        let event_response = app
            .clone()
            .oneshot(request(
                "POST",
                "/v1/events",
                serde_json::to_vec(&ai_event).unwrap(),
            ))
            .await
            .unwrap();
        assert_eq!(event_response.status(), StatusCode::ACCEPTED);

        let observation = EditorObservationV1 {
            schema_version: wakaclock_core::broker::EDITOR_OBSERVATION_SCHEMA_VERSION,
            observation_id: "editor-http-observation".to_string(),
            editor: "vscode".to_string(),
            entity: ai_event.entity.clone(),
            workspace_root: "/workspace".to_string(),
            occurred_at: ai_event.occurred_at,
            change_kind: ai_event.change_kind,
            previous_entity: None,
            lines_added: ai_event.lines_added,
            lines_deleted: ai_event.lines_deleted,
            content_fingerprint: None,
        };
        let observation_response = app
            .clone()
            .oneshot(request(
                "POST",
                "/v1/editor-observations",
                serde_json::to_vec(&observation).unwrap(),
            ))
            .await
            .unwrap();
        assert_eq!(observation_response.status(), StatusCode::OK);
        let observation_body = axum::body::to_bytes(
            observation_response.into_body(),
            MAX_EDITOR_OBSERVATION_BYTES,
        )
        .await
        .unwrap();
        let observation_ack: EditorObservationAck =
            serde_json::from_slice(&observation_body).unwrap();
        assert_eq!(observation_ack.status, "matched");
        assert_eq!(
            observation_ack.matched_event_id.as_deref(),
            Some("editor-http-event")
        );

        let status_response = app
            .clone()
            .oneshot(request(
                "GET",
                "/v1/editor-observations/editor-http-observation",
                Vec::new(),
            ))
            .await
            .unwrap();
        let status_code = status_response.status();
        let status_body =
            axum::body::to_bytes(status_response.into_body(), MAX_EDITOR_OBSERVATION_BYTES)
                .await
                .unwrap();
        assert_eq!(
            status_code,
            StatusCode::OK,
            "status response: {}",
            String::from_utf8_lossy(&status_body)
        );
        let status: EditorObservationAck = serde_json::from_slice(&status_body).unwrap();
        assert_eq!(status.status, "matched");

        let unauthorized = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/editor-observations")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(serde_json::to_vec(&observation).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(unauthorized.status(), StatusCode::UNAUTHORIZED);

        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }

    #[tokio::test]
    async fn http_event_statuses_are_accepted_duplicate_and_conflict() {
        let path = temp_db("dedup");
        let app = router(BrokerHttpState {
            token: Arc::from("test-token"),
            store_path: Some(path.clone()),
        });
        let payload = |event: BrokerEventV1| serde_json::to_vec(&event).unwrap();
        let request = |bytes: Vec<u8>| {
            Request::builder()
                .method("POST")
                .uri("/v1/events")
                .header(header::AUTHORIZATION, "Bearer test-token")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(bytes))
                .unwrap()
        };

        let same_event = event("same-event");
        let accepted = app
            .clone()
            .oneshot(request(payload(same_event.clone())))
            .await
            .unwrap();
        assert_eq!(accepted.status(), StatusCode::ACCEPTED);
        let accepted_body = axum::body::to_bytes(accepted.into_body(), MAX_EVENT_BYTES)
            .await
            .unwrap();
        let accepted_ack: BrokerEventAck = serde_json::from_slice(&accepted_body).unwrap();
        assert_eq!(accepted_ack.actor_type, ActorType::AiVerified);
        assert_eq!(accepted_ack.actor_confidence, 1.0);

        let duplicate = app
            .clone()
            .oneshot(request(payload(same_event)))
            .await
            .unwrap();
        assert_eq!(duplicate.status(), StatusCode::OK);

        let mut conflict_event = event("same-event");
        conflict_event.lines_added = Some(99);
        let conflict = app.oneshot(request(payload(conflict_event))).await.unwrap();
        assert_eq!(conflict.status(), StatusCode::CONFLICT);

        assert_eq!(
            BrokerStore::open_at(&path)
                .unwrap()
                .stats()
                .unwrap()
                .pending,
            1
        );
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }

    #[tokio::test]
    async fn invalid_batch_is_atomic_and_duplicate_batch_is_ok() {
        let path = temp_db("batch");
        let app = router(BrokerHttpState {
            token: Arc::from("test-token"),
            store_path: Some(path.clone()),
        });
        let request = |events: Vec<BrokerEventV1>| {
            Request::builder()
                .method("POST")
                .uri("/v1/events/batch")
                .header(header::AUTHORIZATION, "Bearer test-token")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(serde_json::to_vec(&events).unwrap()))
                .unwrap()
        };

        let valid = event("batch-valid");
        let mut invalid = event("batch-invalid");
        invalid.entity = "relative.rs".to_string();
        let rejected = app
            .clone()
            .oneshot(request(vec![valid.clone(), invalid]))
            .await
            .unwrap();
        assert_eq!(rejected.status(), StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(
            BrokerStore::open_at(&path)
                .unwrap()
                .stats()
                .unwrap()
                .pending,
            0
        );

        let accepted = app
            .clone()
            .oneshot(request(vec![valid.clone()]))
            .await
            .unwrap();
        assert_eq!(accepted.status(), StatusCode::ACCEPTED);
        let duplicate = app.oneshot(request(vec![valid])).await.unwrap();
        assert_eq!(duplicate.status(), StatusCode::OK);

        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }

    #[tokio::test]
    async fn concurrent_duplicate_is_one_event_and_limits_are_enforced() {
        let path = temp_db("concurrency-limits");
        let app = router(BrokerHttpState {
            token: Arc::from("test-token"),
            store_path: Some(path.clone()),
        });
        let request = |uri: &'static str, bytes: Vec<u8>| {
            Request::builder()
                .method("POST")
                .uri(uri)
                .header(header::AUTHORIZATION, "Bearer test-token")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(bytes))
                .unwrap()
        };

        let mut oversized = event("oversized");
        oversized.tool = Some("x".repeat(MAX_EVENT_BYTES));
        let too_large = app
            .clone()
            .oneshot(request(
                "/v1/events",
                serde_json::to_vec(&oversized).unwrap(),
            ))
            .await
            .unwrap();
        assert_eq!(too_large.status(), StatusCode::PAYLOAD_TOO_LARGE);

        let too_many = (0..=MAX_BATCH_EVENTS)
            .map(|index| event(&format!("too-many-{index}")))
            .collect::<Vec<_>>();
        let too_many_response = app
            .clone()
            .oneshot(request(
                "/v1/events/batch",
                serde_json::to_vec(&too_many).unwrap(),
            ))
            .await
            .unwrap();
        assert_eq!(too_many_response.status(), StatusCode::UNPROCESSABLE_ENTITY);

        let same = serde_json::to_vec(&event("concurrent")).unwrap();
        let first_request = request("/v1/events", same.clone());
        let second_request = request("/v1/events", same);
        let (first, second) = tokio::join!(
            app.clone().oneshot(first_request),
            app.clone().oneshot(second_request)
        );
        let first = first.unwrap();
        let second = second.unwrap();
        let statuses = [first.status(), second.status()];
        assert!(statuses.contains(&StatusCode::ACCEPTED));
        assert!(statuses.contains(&StatusCode::OK));
        assert_eq!(
            BrokerStore::open_at(&path)
                .unwrap()
                .stats()
                .unwrap()
                .pending,
            1
        );

        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }

    #[tokio::test]
    async fn maximum_batch_of_500_events_is_atomic_and_durable() {
        let path = temp_db("maximum-batch");
        let app = router(BrokerHttpState {
            token: Arc::from("test-token"),
            store_path: Some(path.clone()),
        });
        let events = (0..MAX_BATCH_EVENTS)
            .map(|index| event(&format!("maximum-{index}")))
            .collect::<Vec<_>>();
        let request = Request::builder()
            .method("POST")
            .uri("/v1/events/batch")
            .header(header::AUTHORIZATION, "Bearer test-token")
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(serde_json::to_vec(&events).unwrap()))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::ACCEPTED);
        let stats = BrokerStore::open_at(&path).unwrap().stats().unwrap();
        assert_eq!(stats.pending, MAX_BATCH_EVENTS as u64);
        assert_eq!(stats.retry + stats.processed + stats.dead_letter, 0);

        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
    }
}
