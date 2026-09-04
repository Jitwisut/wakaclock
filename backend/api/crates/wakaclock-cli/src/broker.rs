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
use std::{
    error::Error,
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};
use tokio::{net::TcpListener, sync::watch};
use uuid::Uuid;
use wakaclock_core::{
    ai::{
        append_shadow_record, dedup, evidence_from_scan, fingerprint_changed_file,
        intake_file_change, intake_session_evidence, scan_ai_processes, AiAttributionState,
        AiEditEvent, AiVerdict, CanonicalFingerprint, CanonicalIdentity, ClipBounds,
        CorrelationEngine, CorrelationInput, CorrelationWindows, DedupObservation, EvidenceKind,
        ObserverConfig, ObserverPool, PipelineStage, PipelineTracker, SessionEvidenceLedger,
        SessionProcessEvidence,
    },
    api_client::ApiClient,
    broker::{
        broker_discovery_path, broker_runtime_dir, broker_token_path, evidence_rank_key,
        BrokerBatchAck, BrokerChangeKind, BrokerClient, BrokerDiscovery, BrokerEventAck,
        BrokerEventStatus, BrokerEventV1, BrokerIngestOutcome, BrokerStore, BrokerStoreStats,
        QuarantineDiagnostic, BROKER_SCHEMA_VERSION, MAX_BATCH_BYTES, MAX_BATCH_EVENTS,
        MAX_EVENT_BYTES,
    },
    config::Config,
    error::AppError,
    git,
    heartbeat::{ActivitySegment, ActorType, MAX_ACTIVITY_GAP_SECONDS},
    queue::Queue,
};

use crate::agent_service;

const BROKER_POLL_SECONDS: u64 = 1;
const BROKER_AI_ACTIVITY_STREAM: &str = "broker-ai";
const OBSERVER_CONFIG_FILENAME: &str = "observer.toml";
const OBSERVER_WORKSPACE_TTL_SECONDS: i64 = 180;
const OBSERVER_MAX_FILES_PER_POLL: usize = 256;
const OBSERVER_MAX_WORKSPACES: usize = 32;
const PIPELINE_SNAPSHOT_FILENAME: &str = "ai-pipeline.json";

/// A filesystem observation plus the session evidence that may explain it.  The
/// candidate is deliberately kept separate from `BrokerEventV1`: filesystem input
/// is not an AI event until the correlation engine returns `ai_inferred`.
#[derive(Debug, Clone)]
struct FilesystemCandidate {
    file_input: CorrelationInput,
    session_inputs: Vec<CorrelationInput>,
    agent: String,
    workspace: PathBuf,
    fingerprint: Option<String>,
}

/// Client-side universal-observer state.  It is held for the broker lifetime so
/// workspace leases, notify watchers and process/session liveness survive each
/// one-second poll.  The engine itself remains stateless per pass; durable event
/// identity lives in the SQLite inbox/state databases.
struct BrokerInferenceRuntime {
    config: ObserverConfig,
    registry: wakaclock_core::ai::WorkspaceRegistry,
    pool: ObserverPool,
    sessions: SessionEvidenceLedger,
    candidates: Vec<FilesystemCandidate>,
    tracker: PipelineTracker,
    last_auto_setup_at: Option<chrono::DateTime<Utc>>,
}

impl BrokerInferenceRuntime {
    fn new() -> Self {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/"));
        Self {
            config: load_observer_config(),
            registry: wakaclock_core::ai::WorkspaceRegistry::new(
                chrono::Duration::seconds(OBSERVER_WORKSPACE_TTL_SECONDS),
                home,
            ),
            pool: ObserverPool::new(),
            sessions: SessionEvidenceLedger::new(),
            candidates: Vec::new(),
            tracker: PipelineTracker::new(),
            last_auto_setup_at: None,
        }
    }

    /// Refresh process/workspace evidence and drain bounded filesystem events.
    /// Every path entering the engine has already passed the workspace lease and
    /// observer filters; malformed evidence is dropped with a short diagnostic.
    fn poll(&mut self) {
        self.config = load_observer_config();
        let now = Utc::now();
        let detected = scan_ai_processes();
        if self
            .last_auto_setup_at
            .is_none_or(|last| now - last >= chrono::Duration::minutes(10))
        {
            crate::ai_setup::auto_setup_detected_agents(&detected);
            self.last_auto_setup_at = Some(now);
        }
        if !self.config.enabled {
            self.candidates.clear();
            let _ = self.pool.sync(&[]);
            return;
        }

        for process in &detected {
            observe_pipeline(
                &mut self.tracker,
                &process.agent,
                PipelineStage::AgentDetected,
                now,
            );
        }
        let mut registered = Vec::new();
        for process in &detected {
            let Some(cwd) = process.cwd.as_deref() else {
                continue;
            };
            let Some(root) = git::discover(&cwd.to_string_lossy()).map(|info| info.root) else {
                continue;
            };
            let known_roots = self.registry.watched_roots(now);
            if !known_roots.contains(&root) && known_roots.len() >= OBSERVER_MAX_WORKSPACES {
                tracing::warn!(
                    agent = %process.agent,
                    "universal observer workspace limit reached; root not registered"
                );
                continue;
            }
            let producer_id = format!("process-observer:{}", process.pid);
            if self
                .registry
                .register(
                    root.clone(),
                    producer_id,
                    Some(process.pid),
                    None,
                    Vec::new(),
                    now,
                )
                .is_ok()
            {
                registered.push(root);
            }
        }
        self.registry.prune_expired(now);
        let roots = self.registry.watched_roots(now);
        if let Err(error) = self.pool.sync(&roots) {
            eprintln!(
                "Warning: universal observer could not sync workspace watchers code=observer_io"
            );
            tracing::debug!(error = %error, "observer watcher sync failed");
        }

        let registered_roots = if registered.is_empty() {
            roots.clone()
        } else {
            registered
        };
        let evidence = evidence_from_scan(&detected, &registered_roots);
        let running: std::collections::HashSet<u32> = detected.iter().map(|p| p.pid).collect();
        for item in evidence {
            self.sessions.observe(item, now);
        }
        let _closed = self.sessions.reap(&running);

        self.candidates.clear();
        let events = self.pool.poll(Duration::from_millis(1));
        for event in events.into_iter().take(OBSERVER_MAX_FILES_PER_POLL) {
            let Some(workspace) = roots.iter().find(|root| event.path.starts_with(root)) else {
                continue;
            };
            let fingerprint = fingerprint_changed_file(&event.path);
            let sessions: Vec<&SessionProcessEvidence> = self
                .sessions
                .live()
                .iter()
                .filter(|session| {
                    session
                        .workspace
                        .as_deref()
                        .is_some_and(|root| event.path.starts_with(root))
                })
                .collect();
            for session in sessions {
                let file_input = match intake_file_change(
                    &event,
                    workspace,
                    Some(&session.agent),
                    session.session_id.as_deref(),
                    fingerprint.clone(),
                ) {
                    Ok(input) => input,
                    Err(diagnostic) => {
                        eprintln!(
                            "Warning: universal observer dropped {} evidence code=malformed",
                            diagnostic.producer
                        );
                        continue;
                    }
                };
                let session_input =
                    match intake_session_evidence(session, &event.path, event.observed_at) {
                        Ok(input) => input,
                        Err(_) => continue,
                    };
                self.candidates.push(FilesystemCandidate {
                    file_input,
                    session_inputs: vec![session_input],
                    agent: session.agent.clone(),
                    workspace: workspace.clone(),
                    fingerprint: fingerprint.clone(),
                });
                if self.candidates.len() >= OBSERVER_MAX_FILES_PER_POLL {
                    break;
                }
            }
            if self.candidates.len() >= OBSERVER_MAX_FILES_PER_POLL {
                break;
            }
        }
    }

    fn take_candidates(&mut self) -> Vec<FilesystemCandidate> {
        std::mem::take(&mut self.candidates)
    }
}

fn observer_config_path() -> PathBuf {
    broker_runtime_dir().join(OBSERVER_CONFIG_FILENAME)
}

fn pipeline_snapshot_path() -> PathBuf {
    broker_runtime_dir().join(PIPELINE_SNAPSHOT_FILENAME)
}

fn load_observer_config() -> ObserverConfig {
    let path = observer_config_path();
    let Ok(text) = fs::read_to_string(path) else {
        return ObserverConfig::default();
    };
    match toml::from_str::<ObserverConfig>(&text) {
        Ok(config) => config,
        Err(error) => {
            eprintln!("Warning: universal observer config ignored code=invalid_config");
            tracing::debug!(error = %error, "invalid observer config");
            ObserverConfig::default()
        }
    }
}

/// Advance an agent's diagnostic state without allowing a repeated poll to move
/// it backwards (or to produce noisy warnings for the expected equal-stage
/// observation).  A first observation is bootstrapped at `agent_detected` so a
/// native event cannot make the diagnostic timeline start in the middle.
fn observe_pipeline(
    tracker: &mut PipelineTracker,
    agent: &str,
    stage: PipelineStage,
    at: chrono::DateTime<Utc>,
) {
    if tracker.stage_of(agent).is_none() {
        let _ = tracker.observe(agent, PipelineStage::AgentDetected, at);
    }
    let Some(current) = tracker.stage_of(agent) else {
        return;
    };
    if current == stage || !current.can_advance_to(stage) {
        return;
    }
    let _ = tracker.observe(agent, stage, at);
}

fn input_is_live(config: &ObserverConfig, input: &CorrelationInput) -> bool {
    config.source_live(input.kind)
        && input
            .agent
            .as_deref()
            .map(|agent| config.agent_in_rollout(agent))
            .unwrap_or(true)
        && input
            .workspace
            .as_deref()
            .map(|root| config.workspace_live(root))
            .unwrap_or(true)
}

fn reject_pipeline(
    tracker: &mut PipelineTracker,
    agent: &str,
    reason: &str,
    at: chrono::DateTime<Utc>,
) {
    if tracker.stage_of(agent).is_none() {
        let _ = tracker.observe(agent, PipelineStage::AgentDetected, at);
    }
    if tracker
        .stage_of(agent)
        .is_some_and(PipelineStage::is_terminal)
    {
        return;
    }
    let _ = tracker.reject(agent, reason, at);
}

fn persist_pipeline_snapshot(tracker: &PipelineTracker) {
    let Ok(json) = serde_json::to_string_pretty(&tracker.snapshot()) else {
        return;
    };
    if let Err(error) = write_private_atomic(&pipeline_snapshot_path(), &json) {
        tracing::debug!(error = %error, "could not persist AI pipeline snapshot");
    }
}

/// Read-only, sanitized pipeline state for `broker status` and `doctor ai`.
/// Corrupt or partially-written local diagnostics fail closed to an empty list;
/// they must never stop heartbeat delivery.
pub(crate) fn pipeline_snapshot_json() -> serde_json::Value {
    let Ok(text) = fs::read_to_string(pipeline_snapshot_path()) else {
        return serde_json::json!([]);
    };
    serde_json::from_str(&text).unwrap_or_else(|_| serde_json::json!([]))
}

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
        change_kind: BrokerChangeKind::Modify,
        previous_entity: None,
        agent: event.agent.clone(),
        provider: event.provider.clone(),
        model: event.model.clone(),
        session_id: event.session_id.clone(),
        source: event.source.clone(),
        confidence: event.confidence.clone(),
        actor_type: None,
        actor_confidence: None,
        lines_added: event.lines_added,
        lines_deleted: event.lines_deleted,
        active_seconds: Some(active_seconds.clamp(0.0, MAX_ACTIVITY_GAP_SECONDS)),
        transport: None,
        tool: None,
        tool_event_id: None,
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
    let mut runtime = BrokerInferenceRuntime::new();
    runtime.poll();
    process_pending_with_runtime(config, api_client, limit, &mut runtime).await
}

/// Process pending inbox rows with one bounded correlation/dedup pass.  The
/// legacy `process_pending` wrapper above keeps callers/tests source compatible;
/// the long-running broker passes its persistent observer runtime here so
/// filesystem/session evidence can be joined with native/transcript events.
async fn process_pending_with_runtime(
    config: &Config,
    api_client: &ApiClient,
    limit: usize,
    runtime: &mut BrokerInferenceRuntime,
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

    let candidates = runtime.take_candidates();
    let mut engine = CorrelationEngine::new(CorrelationWindows::DEFAULT);
    let mut intake_diagnostics = Vec::new();
    for record in &records {
        match wakaclock_core::ai::intake_broker_event(&record.event) {
            Ok(input) => {
                if input_is_live(&runtime.config, &input) {
                    engine.ingest(input);
                }
            }
            Err(diagnostic) => intake_diagnostics.push(diagnostic),
        }
    }
    for candidate in &candidates {
        if input_is_live(&runtime.config, &candidate.file_input) {
            engine.ingest(candidate.file_input.clone());
        }
        for input in &candidate.session_inputs {
            if input_is_live(&runtime.config, input) {
                engine.ingest(input.clone());
            }
        }
    }
    for diagnostic in intake_diagnostics {
        eprintln!(
            "Warning: universal evidence dropped producer={} code=malformed",
            diagnostic.producer
        );
    }

    // p8.4: run the canonical dedup pass before emitting any claimed event.  The
    // broker's event-id uniqueness remains the durable safety net; this pass also
    // collapses hook/transcript/filesystem observations that have different IDs but
    // share a bounded canonical fingerprint.
    if runtime.config.enabled {
        let dedup_observations = records
            .iter()
            .filter_map(|record| dedup_observation(&record.event).ok())
            .collect::<Vec<_>>();
        let dedup_outcome = dedup(dedup_observations);
        if !dedup_outcome.conflicts.is_empty() {
            eprintln!(
                "Warning: universal evidence conflict count={} code=dedup_conflict",
                dedup_outcome.conflicts.len()
            );
        }
    }
    // Canonical suppression is a production-emission change. Keep it disabled
    // while the observer is off or in observe-only so the legacy heartbeat stream
    // stays byte-identical during the shadow gate.
    let canonical_winners = runtime
        .config
        .feeds_production()
        .then(|| canonical_winners(&records));

    for record in records {
        // A weaker transport for the same canonical activity is acknowledged as
        // processed but never emits a second heartbeat.  This is the engine-owned
        // equivalent of the existing line/time fingerprint fallback.
        let winner = canonical_winners
            .as_ref()
            .map(|winners| {
                winners
                    .get(&canonical_key(&record.event))
                    .is_some_and(|winner| winner == &record.event_id)
            })
            .unwrap_or(true);
        if !winner {
            let state = AiAttributionState::open()?;
            state.mark_delivered(&record.event_id, "broker_canonical_duplicate")?;
            observe_pipeline(
                &mut runtime.tracker,
                &record.event.agent,
                PipelineStage::AcceptedLocally,
                record.event.occurred_at,
            );
            observe_pipeline(
                &mut runtime.tracker,
                &record.event.agent,
                PipelineStage::Delivered,
                record.event.occurred_at,
            );
            if BrokerStore::open()?
                .mark_processed_for_attempt(&record.event_id, record.attempt_count)?
            {
                report.processed += 1;
            }
            continue;
        }

        let mut event = record.event.clone();
        if let Ok(input) = wakaclock_core::ai::intake_broker_event(&event) {
            observe_pipeline(
                &mut runtime.tracker,
                &event.agent,
                PipelineStage::EvidenceReceived,
                event.occurred_at,
            );
            if input.kind.is_verified_ai_edit() {
                observe_pipeline(
                    &mut runtime.tracker,
                    &event.agent,
                    PipelineStage::AdapterInstalled,
                    event.occurred_at,
                );
            }
            if input_is_live(&runtime.config, &input) {
                let verdict = engine.verdict_for_within(
                    Path::new(&event.entity),
                    event.occurred_at,
                    ClipBounds::utc_day(event.occurred_at),
                );
                let oracle =
                    (input.kind == EvidenceKind::NativeHook).then_some(AiVerdict::AiVerified);
                let mut outcome = wakaclock_core::ai::shadow::observe(
                    &runtime.config,
                    Path::new(&event.entity),
                    event.project_root.as_deref().map(Path::new),
                    &verdict,
                    oracle,
                    event.occurred_at,
                );
                if let Some(record) = outcome.record.take() {
                    let mut record = record;
                    if let Ok(fingerprint) = canonical_fingerprint(&event) {
                        record = record.with_canonical_fingerprint(fingerprint.to_string());
                    }
                    if let Err(error) = append_shadow_record(&record) {
                        tracing::warn!(error = %error, "could not persist universal shadow record");
                    }
                }
                if let Some(production) = outcome.production {
                    // Universal inference may only add an AI grade.  A weak/unknown
                    // proposal must never overwrite a producer's existing actor
                    // decision and accidentally turn a valid native event into an
                    // unknown heartbeat.
                    if matches!(
                        production.verdict,
                        AiVerdict::AiVerified | AiVerdict::AiInferred
                    ) {
                        apply_verdict(&mut event, production.verdict);
                    }
                }
                observe_pipeline(
                    &mut runtime.tracker,
                    &event.agent,
                    PipelineStage::Correlated,
                    event.occurred_at,
                );
            }
        }

        match process_record(config, api_client, &event).await {
            Ok(send_report) => {
                observe_pipeline(
                    &mut runtime.tracker,
                    &event.agent,
                    PipelineStage::AcceptedLocally,
                    event.occurred_at,
                );
                if send_report.queued > 0 {
                    observe_pipeline(
                        &mut runtime.tracker,
                        &event.agent,
                        PipelineStage::QueuedForDelivery,
                        event.occurred_at,
                    );
                }
                if send_report.sent > 0 || send_report.deduped > 0 || send_report.flushed > 0 {
                    observe_pipeline(
                        &mut runtime.tracker,
                        &event.agent,
                        PipelineStage::Delivered,
                        event.occurred_at,
                    );
                }
                if BrokerStore::open()?
                    .mark_processed_for_attempt(&record.event_id, record.attempt_count)?
                {
                    report.processed += 1;
                }
            }
            Err(error) => {
                reject_pipeline(
                    &mut runtime.tracker,
                    &event.agent,
                    error_code(&error),
                    event.occurred_at,
                );
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

    // Filesystem changes are not broker events until the correlation engine has
    // enough corroborating session evidence.  In infer mode enqueue one canonical
    // event per candidate; observe-only mode records a shadow row but leaves the
    // old heartbeat stream byte-for-byte untouched.
    let mut inferred_events = std::collections::BTreeMap::<String, BrokerEventV1>::new();
    for candidate in candidates {
        if !input_is_live(&runtime.config, &candidate.file_input) {
            continue;
        }
        // Use the same pass that already contains pending native/transcript/MCP
        // records and every filesystem/session input from this tick.  Building a
        // fresh engine here would make a filesystem notification that belongs to a
        // native hook look like an independent `ai_inferred` edit and emit a second
        // heartbeat on the next retry.  The shared pass lets direct evidence win and
        // leaves only genuinely unproven filesystem changes eligible for inference.
        let verdict = engine.verdict_for_within(
            &candidate.file_input.entity,
            candidate.file_input.occurred_at,
            ClipBounds::utc_day(candidate.file_input.occurred_at),
        );
        observe_pipeline(
            &mut runtime.tracker,
            &candidate.agent,
            PipelineStage::Correlated,
            candidate.file_input.occurred_at,
        );
        let mut outcome = wakaclock_core::ai::shadow::observe(
            &runtime.config,
            &candidate.file_input.entity,
            Some(&candidate.workspace),
            &verdict,
            None,
            candidate.file_input.occurred_at,
        );
        if let Some(record) = outcome.record.take() {
            let mut record = record;
            if let Some(fingerprint) = candidate.fingerprint.as_deref() {
                record = record.with_canonical_fingerprint(fingerprint.to_string());
            }
            if let Err(error) = append_shadow_record(&record) {
                tracing::warn!(error = %error, "could not persist universal shadow record");
            }
        }
        if outcome
            .production
            .is_some_and(|value| value.verdict == AiVerdict::AiInferred)
        {
            if let Ok(event) = event_from_filesystem_candidate(&candidate) {
                // Multiple live processes (or duplicate notify records from an
                // atomic-save burst) may explain the same file change.  Keep one
                // deterministic canonical event before it reaches the durable
                // inbox; the inbox's event-id uniqueness is a retry guard, not a
                // substitute for logical-activity deduplication.
                inferred_events
                    .entry(canonical_key(&event))
                    .or_insert(event);
            }
        }
    }
    if !inferred_events.is_empty() {
        let mut store = BrokerStore::open()?;
        let normalized = inferred_events
            .into_values()
            .map(BrokerEventV1::normalize)
            .collect::<Result<Vec<_>, _>>()?;
        let outcomes = store.ingest_normalized_batch(&normalized)?;
        for (event, outcome) in normalized.iter().zip(outcomes.iter()) {
            if *outcome == BrokerIngestOutcome::Accepted {
                observe_pipeline(
                    &mut runtime.tracker,
                    &event.agent,
                    PipelineStage::AcceptedLocally,
                    event.occurred_at,
                );
                report.processed += 1;
            }
        }
    }

    persist_pipeline_snapshot(&runtime.tracker);
    BrokerStore::open()?.compact()?;
    Ok(report)
}

fn apply_verdict(event: &mut BrokerEventV1, verdict: AiVerdict) {
    let (actor_type, confidence) = match verdict {
        AiVerdict::AiVerified => (ActorType::AiVerified, 1.0),
        AiVerdict::AiInferred => (ActorType::AiInferred, 0.6),
        AiVerdict::Human => (ActorType::Human, 1.0),
        AiVerdict::Unknown => (ActorType::Unknown, 0.0),
    };
    event.actor_type = Some(actor_type);
    event.actor_confidence = Some(confidence);
}

fn canonical_fingerprint(event: &BrokerEventV1) -> Result<CanonicalFingerprint, AppError> {
    let workspace = event
        .project_root
        .as_deref()
        .map(Path::new)
        .unwrap_or_else(|| Path::new("/unknown-workspace"));
    let content_fingerprint = fingerprint_changed_file(Path::new(&event.entity));
    Ok(CanonicalFingerprint::v1(&CanonicalIdentity {
        workspace,
        entity: Path::new(&event.entity),
        change_kind: event.change_kind,
        occurred_at_unix: event.occurred_at.timestamp(),
        content_fingerprint: content_fingerprint.as_deref(),
        line_delta: match (event.lines_added, event.lines_deleted) {
            (None, None) => None,
            (added, deleted) => Some((added.unwrap_or(0), deleted.unwrap_or(0))),
        },
        // The tool/session identity is intentionally omitted here.  It is useful
        // for producer-local replay, but a hook and a transcript for the same edit
        // often carry different IDs and must still collapse into one activity.
        session_or_tool_id: None,
    }))
}

fn canonical_key(event: &BrokerEventV1) -> String {
    canonical_fingerprint(event)
        .map(|fingerprint| fingerprint.to_string())
        .unwrap_or_else(|_| format!("event:{}", event.event_id))
}

fn dedup_observation(event: &BrokerEventV1) -> Result<DedupObservation, AppError> {
    let input = wakaclock_core::ai::intake_broker_event(event)
        .map_err(|diagnostic| AppError::Validation(diagnostic.reason))?;
    Ok(DedupObservation {
        event_id: event.event_id.clone(),
        payload_hash: event.payload_hash()?,
        fingerprint: canonical_fingerprint(event)?,
        kind: input.kind,
        lineage_id: input.lineage_id,
        active_seconds: event
            .active_seconds
            .unwrap_or_default()
            .min(MAX_ACTIVITY_GAP_SECONDS),
        transport: event.transport.clone(),
        source: event.source.clone(),
        confidence: event.confidence.clone(),
        occurred_at: event.occurred_at,
    })
}

fn canonical_winners(
    records: &[wakaclock_core::broker::BrokerRecord],
) -> std::collections::HashMap<String, String> {
    let mut winners = std::collections::HashMap::new();
    for record in records {
        let key = canonical_key(&record.event);
        match winners.get(&key) {
            None => {
                winners.insert(key, record.event_id.clone());
            }
            Some(existing_id) => {
                let Some(existing) = records
                    .iter()
                    .find(|candidate| candidate.event_id == *existing_id)
                else {
                    winners.insert(key, record.event_id.clone());
                    continue;
                };
                if evidence_rank_key(
                    record.event.transport.as_deref(),
                    &record.event.source,
                    &record.event.confidence,
                    record.event.occurred_at,
                ) < evidence_rank_key(
                    existing.event.transport.as_deref(),
                    &existing.event.source,
                    &existing.event.confidence,
                    existing.event.occurred_at,
                ) {
                    winners.insert(key, record.event_id.clone());
                }
            }
        }
    }
    winners
}

fn event_from_filesystem_candidate(
    candidate: &FilesystemCandidate,
) -> Result<BrokerEventV1, AppError> {
    let change_kind = candidate
        .file_input
        .change_kind
        .unwrap_or(BrokerChangeKind::Modify);
    Ok(BrokerEventV1 {
        schema_version: BROKER_SCHEMA_VERSION,
        producer_version: Some(wakaclock_core::ai::PRODUCER_CONTRACT_VERSION),
        event_type: wakaclock_core::broker::BrokerEventType::FileChange,
        event_id: candidate.file_input.lineage_id.clone(),
        occurred_at: candidate.file_input.occurred_at,
        entity: candidate.file_input.entity.to_string_lossy().into_owned(),
        project_root: Some(candidate.workspace.to_string_lossy().into_owned()),
        change_kind,
        previous_entity: None,
        agent: candidate.agent.clone(),
        provider: None,
        model: None,
        session_id: candidate.file_input.session_id.clone(),
        source: wakaclock_core::ai::AiEventSource::IdeTelemetry,
        confidence: wakaclock_core::ai::AiConfidence::Inferred,
        actor_type: Some(ActorType::AiInferred),
        actor_confidence: Some(0.6),
        lines_added: None,
        lines_deleted: None,
        // A filesystem observer proves that a file changed, but it does not
        // measure coding time.  Do not turn the lifetime of an open agent process
        // into 120 seconds of editor activity for every inferred file; preserving
        // `0.0` keeps the duration stream identical until a producer supplies a
        // measured interval.
        active_seconds: Some(0.0),
        transport: Some("filesystem_observer".to_string()),
        tool: None,
        tool_event_id: None,
    })
}

fn error_code(error: &AppError) -> &'static str {
    match error {
        AppError::Validation(_) => "validation",
        AppError::Auth(_) => "auth",
        AppError::Http(_) | AppError::HttpStatus { .. } => "delivery",
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
) -> Result<wakaclock_core::api_client::SendReport, AppError> {
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

    // A hook and transcript can legitimately have different event IDs for one edit.
    // The existing metadata-only fingerprint remains the cross-source safety net.
    if let (Some(added), Some(deleted)) = (event.lines_added, event.lines_deleted) {
        let state = AiAttributionState::open()?;
        if state.has_fingerprint(&event.entity, event_time, added, deleted)? {
            state.mark_delivered(&event.event_id, "broker_fingerprint")?;
            return Ok(wakaclock_core::api_client::SendReport {
                sent: 0,
                deduped: 1,
                queued: 0,
                flushed: 0,
                error: None,
            });
        }
    }

    let ai_event = AiEditEvent {
        event_id: event.event_id.clone(),
        agent: event.agent.clone(),
        provider: event.provider.clone(),
        model: event.model.clone(),
        session_id: event.session_id.clone(),
        occurred_at: event.occurred_at,
        entity: PathBuf::from(&event.entity),
        project_root: event.project_root.as_deref().map(PathBuf::from),
        lines_added: event.lines_added,
        lines_deleted: event.lines_deleted,
        input_tokens: None,
        output_tokens: None,
        source: event.source.clone(),
        confidence: event.confidence.clone(),
    };
    let mut heartbeat = crate::build_ai_heartbeat(config, &ai_event, active_seconds);
    heartbeat.heartbeat_id = Some(event.heartbeat_id());
    heartbeat.ai_change_id = event.tool_event_id.clone();
    heartbeat.actor_type = event.actor_type.unwrap_or(ActorType::Unknown);
    heartbeat.actor_confidence = event.actor_confidence.unwrap_or_else(|| {
        heartbeat
            .actor_type
            .default_confidence(Some(event.source.as_str()), Some(event.confidence.as_str()))
    });
    heartbeat.is_ai_generated = heartbeat.actor_type.is_ai();
    // Must come after the actor override above, not inside `build_ai_heartbeat`: that
    // runs before this line, so it would test the actor `resolve_attribution` derived
    // rather than the one the correlation verdict actually landed on. The broker event
    // keeps its own `agent` — the envelope is the private correlation record and drives
    // per-agent pipeline diagnostics; the heartbeat is the published fact.
    heartbeat.redact_inferred_agent_identity();
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
    state.mark_delivered(&event.event_id, "broker")?;
    if let (Some(added), Some(deleted)) = (event.lines_added, event.lines_deleted) {
        state.mark_fingerprint(
            &event.entity,
            event_time,
            added,
            deleted,
            Some(&event.event_id),
        )?;
    }
    agent_service::record_heartbeat();
    Ok(report)
}

fn append_broker_sidecar(event: &BrokerEventV1) -> Result<(), Box<dyn Error>> {
    let state_dir = broker_runtime_dir();
    fs::create_dir_all(&state_dir)?;
    let path = state_dir.join("ai-events.jsonl");
    if fs::read_to_string(&path).ok().is_some_and(|content| {
        content.lines().any(|line| {
            serde_json::from_str::<serde_json::Value>(line)
                .ok()
                .and_then(|value| {
                    value
                        .get("event_id")
                        .and_then(|id| id.as_str())
                        .map(str::to_string)
                })
                .is_some_and(|event_id| event_id == event.event_id)
        })
    }) {
        return Ok(());
    }
    let mut file = OpenOptions::new().create(true).append(true).open(&path)?;
    let payload = serde_json::json!({
        "event_id": event.event_id,
        "entity": event.entity,
        "time": event.occurred_at.timestamp_millis() as f64 / 1000.0,
        "lines_added": event.lines_added,
        "lines_deleted": event.lines_deleted,
        "agent": event.agent,
        "provider": event.provider,
        "model": event.model,
        "session_id": event.session_id,
        "source": event.source.as_str(),
        "confidence": event.confidence.as_str(),
        "actor_type": event.actor_type,
        "actor_confidence": event.actor_confidence,
        "transport": event.transport,
        "tool": event.tool,
        "tool_event_id": event.tool_event_id,
        "change_kind": event.change_kind.as_str(),
        "previous_entity": event.previous_entity,
    });
    writeln!(file, "{}", serde_json::to_string(&payload)?)?;
    drop(file);
    set_private_permissions(&path)?;
    Ok(())
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
    let worker = tokio::spawn(async move {
        worker_loop(worker_config, worker_api, interval_seconds, stop_rx).await;
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
    let _ = worker.await;
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
    let mut inference_runtime = BrokerInferenceRuntime::new();
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
                // The observer is deliberately polled before claiming inbox rows:
                // filesystem/session evidence from this tick can then correlate
                // with a native/transcript event that arrived just before it.
                inference_runtime.poll();
                match process_pending_with_runtime(
                    &config,
                    &api_client,
                    MAX_BATCH_EVENTS,
                    &mut inference_runtime,
                )
                .await
                {
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
        "pipeline": pipeline_snapshot_json(),
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
            occurred_at: Utc::now(),
            entity: PathBuf::from("/workspace/src/lib.rs"),
            project_root: Some(PathBuf::from("/workspace")),
            lines_added: Some(2),
            lines_deleted: Some(1),
            input_tokens: None,
            output_tokens: None,
            source: AiEventSource::Transcript,
            confidence: AiConfidence::Inferred,
        };
        let event = event_from_ai_edit(&ai, 2.0).normalize().unwrap();
        assert_eq!(event.schema_version, BROKER_SCHEMA_VERSION);
        assert_eq!(event.actor_type, Some(ActorType::AiInferred));
        let value = serde_json::to_value(event).unwrap();
        assert!(!value.as_object().unwrap().contains_key("prompt"));
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

    #[test]
    fn canonical_winners_prefer_native_evidence_for_the_same_logical_edit() {
        let mut hook = event("hook");
        hook.transport = Some("native_plugin".to_string());
        hook.source = AiEventSource::AgentHook;
        hook.confidence = AiConfidence::Verified;
        let mut filesystem = hook.clone();
        filesystem.event_id = "filesystem".to_string();
        filesystem.transport = Some("filesystem_observer".to_string());
        filesystem.source = AiEventSource::IdeTelemetry;
        filesystem.confidence = AiConfidence::Inferred;

        let records = vec![
            wakaclock_core::broker::BrokerRecord {
                event_id: filesystem.event_id.clone(),
                event: filesystem,
                status: BrokerEventStatus::Pending,
                attempt_count: 1,
            },
            wakaclock_core::broker::BrokerRecord {
                event_id: hook.event_id.clone(),
                event: hook,
                status: BrokerEventStatus::Pending,
                attempt_count: 1,
            },
        ];
        let winners = canonical_winners(&records);
        assert_eq!(winners.len(), 1);
        assert_eq!(winners.values().next().map(String::as_str), Some("hook"));
    }

    #[test]
    fn inferred_filesystem_events_do_not_invent_coding_duration() {
        let occurred_at = Utc::now();
        let candidate = FilesystemCandidate {
            file_input: CorrelationInput::new(
                "fs-lineage",
                EvidenceKind::FilesystemObserver,
                "/workspace/src/lib.rs",
                occurred_at,
            )
            .with_workspace("/workspace")
            .with_agent("codex")
            .with_change_kind(BrokerChangeKind::Modify),
            session_inputs: Vec::new(),
            agent: "codex".to_string(),
            workspace: PathBuf::from("/workspace"),
            fingerprint: None,
        };
        let event = event_from_filesystem_candidate(&candidate).unwrap();
        assert_eq!(event.actor_type, Some(ActorType::AiInferred));
        assert_eq!(event.active_seconds, Some(0.0));
    }

    #[test]
    fn filesystem_inferred_heartbeat_is_delivered_without_an_agent_name() {
        // The envelope keeps `agent` — it is the broker's private correlation record and
        // drives per-agent `PipelineTracker` diagnostics. The published heartbeat must
        // not, because filesystem+session evidence never proves *which* agent acted.
        let occurred_at = Utc::now();
        let candidate = FilesystemCandidate {
            file_input: CorrelationInput::new(
                "fs-lineage",
                EvidenceKind::FilesystemObserver,
                "/workspace/src/lib.rs",
                occurred_at,
            )
            .with_workspace("/workspace")
            .with_agent("codex")
            .with_change_kind(BrokerChangeKind::Modify),
            session_inputs: Vec::new(),
            agent: "codex".to_string(),
            workspace: PathBuf::from("/workspace"),
            fingerprint: None,
        };
        let event = event_from_filesystem_candidate(&candidate).unwrap();
        assert_eq!(event.agent, "codex", "envelope keeps the agent");

        let mut heartbeat = wakaclock_core::heartbeat::Heartbeat::new(
            uuid::Uuid::nil(),
            event.entity.clone(),
            wakaclock_core::heartbeat::EntityType::File,
            "wakaclock-cli/1.0".to_string(),
        );
        heartbeat.ai_agent = Some(event.agent.clone());
        heartbeat.ai_provider = Some("openai".to_string());
        heartbeat.ai_model = Some("gpt-5.6-sol".to_string());
        heartbeat.actor_type = event.actor_type.unwrap_or(ActorType::Unknown);
        heartbeat.actor_confidence = 0.6;
        heartbeat.is_ai_generated = heartbeat.actor_type.is_ai();
        heartbeat.redact_inferred_agent_identity();

        assert!(heartbeat.ai_agent.is_none());
        assert!(heartbeat.ai_provider.is_none());
        assert!(heartbeat.ai_model.is_none());
        assert!(heartbeat.validate().is_ok());
    }

    #[test]
    fn pipeline_observation_is_monotonic_and_bootstraps_detection() {
        let mut tracker = PipelineTracker::new();
        let now = Utc::now();
        observe_pipeline(&mut tracker, "codex", PipelineStage::Correlated, now);
        observe_pipeline(
            &mut tracker,
            "codex",
            PipelineStage::AgentDetected,
            now + chrono::Duration::seconds(1),
        );
        let state = tracker.snapshot().pop().unwrap();
        assert_eq!(state.stage, PipelineStage::Correlated);
        assert_eq!(state.history[0].stage, PipelineStage::AgentDetected);
        assert_eq!(state.history[1].stage, PipelineStage::Correlated);
    }

    #[test]
    fn observer_source_and_workspace_kill_switches_stop_intake() {
        let mut config = ObserverConfig::observe_only_rollout_start();
        let input = CorrelationInput::new(
            "lineage",
            EvidenceKind::FilesystemObserver,
            "/workspace/src/lib.rs",
            Utc::now(),
        )
        .with_workspace("/workspace")
        .with_agent("codex");
        assert!(input_is_live(&config, &input));
        config.disable_source(EvidenceKind::FilesystemObserver);
        assert!(!input_is_live(&config, &input));
        config.enable_source(EvidenceKind::FilesystemObserver);
        config.disable_workspace(Path::new("/workspace"));
        assert!(!input_is_live(&config, &input));
    }
}
