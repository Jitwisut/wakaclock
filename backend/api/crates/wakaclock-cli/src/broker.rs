//! Local AI Activity Broker runtime.
//!
//! The shared event contract and inbox live in `wakaclock-core::broker`.  This
//! module owns the CLI-facing HTTP server, service loop, producer fallback and the
//! adapter that turns a broker event into the existing normalized heartbeat path.

use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    error::Error,
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};
use tokio::{net::TcpListener, sync::watch};
use uuid::Uuid;
use wakaclock_core::{
    ai::{AiAttributionState, AiEditEvent},
    api_client::ApiClient,
    broker::{
        broker_discovery_path, broker_runtime_dir, broker_token_path, BrokerBatchAck, BrokerClient,
        BrokerDiscovery, BrokerEventAck, BrokerEventStatus, BrokerEventV1, BrokerIngestOutcome,
        BrokerStore, BrokerStoreStats, QuarantineDiagnostic, AI_SIDECAR_SCHEMA_VERSION,
        BROKER_SCHEMA_VERSION, MAX_BATCH_BYTES, MAX_BATCH_EVENTS, MAX_EVENT_BYTES,
    },
    config::Config,
    error::AppError,
    heartbeat::{ActivitySegment, ActorType, MAX_ACTIVITY_GAP_SECONDS},
    queue::Queue,
};

use crate::agent_service;

const BROKER_POLL_SECONDS: u64 = 1;
const BROKER_AI_ACTIVITY_STREAM: &str = "broker-ai";
const MAX_SIDECAR_FINGERPRINT_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
pub(crate) struct BrokerProcessReport {
    pub claimed: usize,
    pub processed: usize,
    pub retried: usize,
    pub dead_lettered: usize,
}

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
        active_seconds: Some(active_seconds.clamp(0.0, MAX_ACTIVITY_GAP_SECONDS)),
        transport: None,
        tool: None,
        tool_event_id: event.tool_event_id.clone(),
        // Transcript discovery is async/replayed, minutes or longer after the edit, so
        // there is no live env to declare an editor from — let `build_ai_heartbeat`'s
        // fallback (env, else agent name) decide when this is eventually processed.
        editor: None,
    }
}

/// Try the running service first.  If the service is absent or a transport-level
/// failure occurs, write the normalized event directly to the same SQLite inbox and
/// make one best-effort processing pass.  Validation/conflict responses are returned
/// to the producer and are never silently converted into a successful fallback.
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

    let mode = std::env::var("WAKACLOCK_BROKER_MODE")
        .unwrap_or_else(|_| "auto".to_string())
        .to_ascii_lowercase();
    if mode != "direct" {
        if let Ok(Some(client)) = BrokerClient::discover() {
            match client.ingest_batch(&normalized).await {
                Ok(ack) => return Ok(ack),
                Err(error) if can_fallback(&error) && mode == "auto" => {}
                Err(error) => return Err(error),
            }
        } else if mode == "service" {
            return Err(AppError::NotFound(
                "broker service is not running or discovery metadata is unavailable".to_string(),
            ));
        }
    }

    let mut store = BrokerStore::open()?;
    let outcomes = store.ingest_normalized_batch(&normalized)?;
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

fn can_fallback(error: &AppError) -> bool {
    match error {
        AppError::Http(_) | AppError::Io(_) => true,
        AppError::HttpStatus { status, .. } => *status >= 500,
        _ => false,
    }
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
    let records = {
        let mut store = BrokerStore::open()?;
        store.claim_ready(limit)?
    };
    let mut report = BrokerProcessReport {
        claimed: records.len(),
        processed: 0,
        retried: 0,
        dead_lettered: 0,
    };

    for record in records {
        match process_record(config, api_client, &record.event).await {
            Ok(()) => {
                if BrokerStore::open()?
                    .mark_processed_for_attempt(&record.event_id, record.attempt_count)?
                {
                    report.processed += 1;
                }
            }
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

    BrokerStore::open()?.compact()?;
    Ok(report)
}

fn error_code(error: &AppError) -> &'static str {
    match error {
        AppError::Validation(_) => "validation",
        AppError::Auth(_) => "auth",
        AppError::Http(_) | AppError::HttpStatus { .. } | AppError::HttpStatusRetry { .. } => "delivery",
        AppError::Queue(_) => "queue",
        AppError::Io(_) => "io",
        AppError::Serde(_) => "serialization",
        AppError::Conflict(_) => "conflict",
        AppError::ClickHouse(_) => "clickhouse",
        AppError::NotFound(_) => "not_found",
    }
}

async fn process_record(
    config: &Config,
    api_client: &ApiClient,
    event: &BrokerEventV1,
) -> Result<(), AppError> {
    let event_time = event.occurred_at.timestamp_millis() as f64 / 1000.0;

    // Write correlation evidence as soon as the durable inbox has handed the event to
    // the processor, before any backend request. This keeps an external AI edit from
    // being classified as Human while the API is offline. The append is idempotent by
    // event_id so a lease recovery after a crash cannot grow duplicate correlation
    // records.
    if append_broker_sidecar(event).is_err() {
        eprintln!("Warning: could not append AI attribution sidecar code=io");
    }

    let active_seconds = if let Some(seconds) = event.active_seconds {
        seconds.min(MAX_ACTIVITY_GAP_SECONDS)
    } else {
        let mut state = AiAttributionState::open()?;
        state.record_activity(
            BROKER_AI_ACTIVITY_STREAM,
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
            source: Some("ai".to_string()),
        }]
    } else {
        Vec::new()
    };

    let report = api_client.send_heartbeats(vec![heartbeat]).await?;
    if report.sent == 0 && report.queued == 0 && report.deduped == 0 {
        return Err(AppError::Validation(
            "broker heartbeat was neither sent, queued nor deduplicated".to_string(),
        ));
    }

    let state = AiAttributionState::open()?;
    let delivery_id = wakaclock_core::broker::scoped_storage_event_id(
        &event.event_id,
        event.session_id.as_deref(),
    );
    state.mark_delivered(&delivery_id, "broker")?;
    agent_service::record_heartbeat();
    Ok(())
}

fn append_broker_sidecar(event: &BrokerEventV1) -> Result<(), Box<dyn Error>> {
    // The sequence is reserved in the broker's durable inbox database before this
    // append. A retry therefore reuses the same stream/sequence pair without an
    // O(n) scan of the JSONL file; the reader deduplicates a crash-boundary duplicate.
    let state_dir = broker_runtime_dir();
    fs::create_dir_all(&state_dir)?;
    let path = state_dir.join("ai-events.jsonl");
    let mut store = BrokerStore::open()?;
    let cursor = store.reserve_sidecar_cursor_scoped(
        &event.event_id,
        event.session_id.as_deref(),
    )?;
    if cursor.already_written {
        return Ok(());
    }
    let mut file = OpenOptions::new().create(true).append(true).open(&path)?;
    // A post-edit content hash is the only editor↔producer identity proof currently
    // available. Keep it local metadata, bounded by size, and only emit it for live
    // producer paths; a delayed transcript replay may point at a newer file version.
    let content_fingerprint = (event.source.as_str() != "transcript")
        .then(|| content_fingerprint_for_path(Path::new(&event.entity)))
        .flatten();
    let payload = serde_json::json!({
        "schema_version": AI_SIDECAR_SCHEMA_VERSION,
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
        "content_fingerprint": content_fingerprint,
        "change_kind": event.change_kind.as_str(),
        "previous_entity": event.previous_entity,
    });
    writeln!(file, "{}", serde_json::to_string(&payload)?)?;
    drop(file);
    store.mark_sidecar_written_scoped(&event.event_id, event.session_id.as_deref())?;
    set_private_permissions(&path)?;
    Ok(())
}

fn content_fingerprint_for_path(path: &Path) -> Option<String> {
    let metadata = fs::metadata(path).ok()?;
    if metadata.len() > MAX_SIDECAR_FINGERPRINT_BYTES {
        return None;
    }
    let mut input = fs::File::open(path).ok()?;
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    input.read_to_end(&mut bytes).ok()?;
    let digest = Sha256::digest(bytes);
    let mut hex = String::with_capacity(digest.len() * 2);
    for byte in digest {
        use std::fmt::Write as _;
        let _ = write!(hex, "{byte:02x}");
    }
    Some(format!("sha256:{hex}"))
}

pub(crate) async fn run(config: Config, interval_seconds: u64) -> Result<(), Box<dyn Error>> {
    let _lock = agent_service::AgentLock::acquire().map_err(std::io::Error::other)?;
    // Run migrations before binding the port. A producer must never receive a
    // transport-level success while the durable inbox is unavailable.
    let _store = BrokerStore::open()?;
    let api_client = Arc::new(ApiClient::new(config.clone())?);
    let token = load_or_create_token()?;
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let endpoint = format!("http://{}", listener.local_addr()?);
    let started_at = Utc::now().timestamp();
    write_discovery(&BrokerDiscovery {
        endpoint: endpoint.clone(),
        pid: std::process::id(),
        schema_version: BROKER_SCHEMA_VERSION,
        started_at,
    })?;
    agent_service::append_log(&format!(
        "broker started pid={} endpoint={} interval={}s",
        std::process::id(),
        endpoint,
        interval_seconds.max(BROKER_POLL_SECONDS)
    ));

    let (stop_tx, stop_rx) = watch::channel(false);
    let worker_config = config.clone();
    let worker_api = api_client.clone();
    // `ApiClient::flush_queue` holds a `rusqlite::Connection`-backed `Queue` across an
    // `.await` (see `wakaclock-ls`'s `spawn_heartbeat_worker` for the same issue spelled
    // out) which makes `worker_loop`'s future `!Send` — `tokio::spawn` requires `Send`.
    // A dedicated OS thread with its own current-thread runtime sidesteps the bound the
    // same way, since `Runtime::block_on` drives the future on the calling thread only.
    let worker = std::thread::spawn(move || {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("wakaclock broker: failed to start worker runtime");
        runtime.block_on(worker_loop(
            worker_config,
            worker_api,
            interval_seconds,
            stop_rx,
        ));
    });

    let state = BrokerHttpState {
        token: Arc::from(token),
        store_path: None,
    };
    let app = router(state);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    let _ = stop_tx.send(true);
    let _ = worker.join();
    remove_owned_discovery(std::process::id());
    agent_service::append_log("broker stopped");
    Ok(())
}

fn router(state: BrokerHttpState) -> Router {
    Router::new()
        .route("/v1/health", get(health_handler))
        .route("/v1/status", get(status_handler))
        .route("/v1/events", post(event_handler))
        .route("/v1/events/batch", post(batch_handler))
        .layer(DefaultBodyLimit::max(MAX_BATCH_BYTES))
        .with_state(state)
}

fn open_store(state: Option<&BrokerHttpState>) -> Result<BrokerStore, AppError> {
    match state.and_then(|value| value.store_path.as_deref()) {
        Some(path) => BrokerStore::open_at(path),
        None => BrokerStore::open(),
    }
}

pub(crate) fn rotate_token() -> Result<(), Box<dyn Error>> {
    let token = format!(
        "{}{}{}{}",
        Uuid::new_v4().simple(),
        Uuid::new_v4().simple(),
        Uuid::new_v4().simple(),
        Uuid::new_v4().simple()
    );
    write_private_atomic(&broker_token_path(), &token)
}

pub(crate) fn ensure_token() -> Result<(), Box<dyn Error>> {
    let _ = load_or_create_token()?;
    Ok(())
}

pub(crate) fn status_for_cli() -> Result<serde_json::Value, AppError> {
    let stats = BrokerStore::open()?.stats()?;
    let queue_count = Queue::open()
        .and_then(|queue| queue.len())
        .unwrap_or_default();
    let service_running = agent_service::status().running;
    let discovery = if service_running {
        read_discovery()
    } else {
        cleanup_discovery();
        None
    };
    Ok(status_json(stats, queue_count, discovery, service_running))
}

async fn worker_loop(
    mut config: Config,
    api_client: Arc<ApiClient>,
    interval_seconds: u64,
    mut stop_rx: watch::Receiver<bool>,
) {
    let mut api_client = api_client;
    let mut interval = tokio::time::interval(Duration::from_secs(
        interval_seconds.max(BROKER_POLL_SECONDS),
    ));
    loop {
        tokio::select! {
            changed = stop_rx.changed() => {
                if changed.is_err() || *stop_rx.borrow() {
                    break;
                }
            }
            _ = interval.tick() => {
                if let Some(updated) = crate::reloaded_agent_config(&config) {
                    if let Ok(client) = ApiClient::new(updated.clone()) {
                        config = updated;
                        api_client = Arc::new(client);
                        agent_service::append_log("broker reloaded API identity");
                    }
                }
                // The broker is the always-on runtime.  Keep transcript recovery in
                // this same bounded worker so a user never has to remember a manual
                // `wakaclock ai sync` after an agent's native hook is missed or an
                // event arrives while the machine was offline.  The sync owns its
                // cross-process lock and timeout; a slow/failed parser cannot stop
                // inbox delivery or ordinary heartbeat processing.
                crate::run_bounded_ai_sync(&config, &api_client).await;
                match process_pending(&config, &api_client, MAX_BATCH_EVENTS).await {
                    Ok(report) if report.claimed > 0 => agent_service::append_log(&format!(
                        "broker processed={} retried={} dead_lettered={}",
                        report.processed, report.retried, report.dead_lettered
                    )),
                    Ok(_) => {},
                    Err(error) => agent_service::append_log(&format!(
                        "broker processing failed code={}",
                        error_code(&error)
                    )),
                }
                match api_client.flush_queue().await {
                    Ok(report) => {
                        if report.flushed > 0 {
                            agent_service::record_heartbeat();
                            agent_service::append_log(&format!("broker flushed {} queued heartbeat(s)", report.flushed));
                        }
                        if report.stopped_because.is_some() {
                            agent_service::append_log("broker queue flush stopped code=delivery");
                        }
                    }
                    Err(_) => agent_service::append_log("broker queue flush failed code=delivery"),
                }
                agent_service::record_scan(true, None, None);
            }
        }
    }
}

async fn shutdown_signal() {
    #[cfg(unix)]
    {
        let ctrl_c = tokio::signal::ctrl_c();
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("install SIGTERM handler");
        tokio::select! {
            _ = ctrl_c => {}
            _ = terminate.recv() => {}
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}

async fn health_handler() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "protocol": BROKER_SCHEMA_VERSION,
        "cli_version": env!("CARGO_PKG_VERSION"),
    }))
}

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

fn authorize(headers: &HeaderMap, state: &BrokerHttpState) -> bool {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .is_some_and(|token| token == state.token.as_ref())
}

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

fn error_response(status: StatusCode, message: &str) -> Response {
    (status, Json(serde_json::json!({ "error": message }))).into_response()
}

fn load_or_create_token() -> Result<String, Box<dyn Error>> {
    let path = broker_token_path();
    fs::create_dir_all(broker_runtime_dir())?;
    if let Ok(token) = fs::read_to_string(&path) {
        let token = token.trim().to_string();
        if token.len() >= 64 {
            set_private_permissions(&path)?;
            return Ok(token);
        }
    }
    let token = format!(
        "{}{}{}{}",
        Uuid::new_v4().simple(),
        Uuid::new_v4().simple(),
        Uuid::new_v4().simple(),
        Uuid::new_v4().simple()
    );
    write_private_atomic(&path, &token)?;
    Ok(token)
}

fn write_discovery(discovery: &BrokerDiscovery) -> Result<(), Box<dyn Error>> {
    let json = serde_json::to_string_pretty(discovery)?;
    write_private_atomic(&broker_discovery_path(), &json)
}

fn write_private_atomic(path: &Path, content: &str) -> Result<(), Box<dyn Error>> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temporary = path.with_extension(format!("tmp-{}", std::process::id()));
    fs::write(&temporary, content)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temporary, fs::Permissions::from_mode(0o600))?;
    }
    #[cfg(windows)]
    {
        let _ = fs::remove_file(path);
    }
    fs::rename(temporary, path)?;
    set_private_permissions(path)?;
    Ok(())
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

fn read_discovery() -> Option<BrokerDiscovery> {
    fs::read_to_string(broker_discovery_path())
        .ok()
        .and_then(|json| serde_json::from_str::<BrokerDiscovery>(&json).ok())
        .filter(|discovery| discovery.schema_version == BROKER_SCHEMA_VERSION)
}

/// Remove stale discovery metadata without touching the durable inbox or token.
pub(crate) fn cleanup_discovery() {
    let _ = fs::remove_file(broker_discovery_path());
}

fn remove_owned_discovery(pid: u32) {
    let path = broker_discovery_path();
    let owned = fs::read_to_string(&path)
        .ok()
        .and_then(|json| serde_json::from_str::<BrokerDiscovery>(&json).ok())
        .is_some_and(|discovery| discovery.pid == pid);
    if owned {
        let _ = fs::remove_file(path);
    }
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
            active_seconds: Some(1.0),
            transport: Some("shell_hook".to_string()),
            tool: Some("apply_patch".to_string()),
            tool_event_id: Some("tool".to_string()),
            editor: None,
        }
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
    fn fallback_errors_are_limited_to_transport_or_server_failures() {
        assert!(can_fallback(&AppError::HttpStatus {
            status: 503,
            message: "down".to_string(),
        }));
        assert!(!can_fallback(&AppError::HttpStatus {
            status: 422,
            message: "invalid".to_string(),
        }));
        assert!(!can_fallback(&AppError::Conflict("same id".to_string())));
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
