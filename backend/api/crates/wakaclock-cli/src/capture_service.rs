//! Independent metadata-only Codex collector. Delivery remains in its own worker.
use chrono::Utc;
use fs2::FileExt;
use serde_json::{json, Value};
use std::{
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
    time::Duration,
};
use wakaclock_core::{
    ai::{
        activity::{
            opaque, parse_shared_activity_bounded, ActivityCursor, ActivityStore,
            BrokerActivityEventV2,
        },
        AdapterRegistry, AiActivityParser, ClaudeCodeParser, CodexParser, DiscoveryContext,
        DiscoveryState,
    },
    api_client::ApiClient,
    config::Config,
    heartbeat::{
        ActivitySegment, ActorType, Category, EntityType, Heartbeat, MAX_AI_TOOL_DURATION_SECONDS,
    },
    project::resolve_project,
    queue::Queue,
};

fn directory() -> Result<PathBuf, Box<dyn std::error::Error>> {
    Ok(dirs::home_dir()
        .ok_or("home unavailable")?
        .join(".wakaclock"))
}
fn scope_key(api: &ApiClient) -> String {
    let s = api.queue_scope();
    opaque(&format!("{}\0{}", s.destination, s.owner))
}
fn heartbeat(config: &Config, event: &BrokerActivityEventV2, device: &str) -> Heartbeat {
    let mut h = Heartbeat::new(
        config.user_id,
        "codex".into(),
        EntityType::App,
        "wakaclock-cli/codex-activity-v2".into(),
    );
    h.heartbeat_id = Some(format!("ai-activity:{}", event.event_id));
    h.revision = event.revision;
    h.time = event.occurred_at.timestamp_millis() as f64 / 1000.0;
    h.date = Heartbeat::date_from_time(h.time);
    h.project = resolve_project(&event.project_root, Some(&event.project_root))
        .map(|p| p.name)
        .or_else(|| {
            event
                .project_root
                .file_name()
                .map(|v| v.to_string_lossy().into_owned())
        });
    h.editor = event.producer_surface.clone();
    h.category = Category::Coding;
    h.is_write = false;
    h.actor_type = ActorType::AiVerified;
    h.actor_confidence = 1.0;
    h.is_ai_generated = true;
    h.ai_agent = Some("codex".into());
    h.ai_source = Some("transcript".into());
    h.ai_confidence = Some("explicit".into());
    h.ai_event_id = Some(event.event_id.clone());
    h.session_id = Some(wakaclock_core::ai::usage::scoped_session_id(
        device,
        "codex",
        &event.session_id,
    ));
    // Operation ID identifies capture provenance, not a claimed file mutation.
    if event.monitoring_only {
        h.user_agent = "wakaclock-cli/codex-monitoring-v2".into();
    }
    h.operating_system = std::env::consts::OS.into();
    h.machine = hostname::get()
        .ok()
        .and_then(|s| s.into_string().ok())
        .unwrap_or_else(|| "unknown".into());
    let seconds = event
        .started_at
        .map(|s| (event.occurred_at - s).num_milliseconds() as f64 / 1000.0)
        .unwrap_or(0.0)
        .clamp(0.0, MAX_AI_TOOL_DURATION_SECONDS);
    h.active_seconds = Some(seconds);
    if seconds > 0.0 {
        h.activity_segments.push(ActivitySegment {
            segment_id: format!("{}:segment", event.event_id),
            start: h.time - seconds,
            end: h.time,
            source: Some("ai_tool_v1".into()),
        });
    }
    h
}

pub(crate) async fn submit_activity_v3(
    config: &Config,
    api: &ApiClient,
    event: wakaclock_core::ai::activity::BrokerActivityEventV3,
) -> Result<Value, Box<dyn std::error::Error>> {
    event.validate().map_err(std::io::Error::other)?;
    if wakaclock_core::runtime::paused("capture")
        || !wakaclock_core::runtime::capture_allowed_at(event.activity.occurred_at.timestamp())
    {
        return Ok(json!({"schema_version":3,"status":"paused_by_user","durable":false}));
    }
    let mut normalized = event.normalized().map_err(std::io::Error::other)?;
    if let Some(start) = normalized.started_at {
        if wakaclock_core::runtime::read()?.intervals.iter().any(|i| {
            i.component == "capture"
                && i.started_at < normalized.occurred_at.timestamp()
                && i.ended_at.is_none_or(|end| end > start.timestamp())
        }) {
            normalized.started_at = None;
        }
    }
    let scope = scope_key(api);
    let store = ActivityStore::open(&directory()?.join("capture.db"))?;
    store.rebind_verified_scopes(&Queue::open()?, &api.queue_scope())?;
    let duplicate = store
        .evidence_revision(&scope, &normalized.event_id)?
        .is_some_and(|r| r >= normalized.revision);
    if duplicate {
        if let Some(previous) =
            store.evidence_at_revision(&scope, &normalized.event_id, normalized.revision)?
        {
            let mut candidate = normalized.clone();
            // Re-observing the same native operation after stdout loss does not
            // move its original timestamp. Provider timestamps remain immutable.
            if event.provider_schema_version.ends_with("-hook_observed") {
                candidate.occurred_at = previous.occurred_at;
            }
            if candidate != previous
                || store
                    .contract_for(&scope, &normalized.event_id, normalized.revision)?
                    .is_some_and(|contract| contract != event.contract())
            {
                return Err("activity_duplicate_evidence_conflict".into());
            }
        }
        return Ok(
            json!({"schema_version":3,"event_id":normalized.event_id,"status":"duplicate","durable":true}),
        );
    }
    let contracts = std::collections::BTreeMap::from([(
        (normalized.event_id.clone(), normalized.revision),
        event.contract(),
    )]);
    store.commit_for_adapter(
        &scope,
        "broker-activity-v3",
        &wakaclock_core::ai::activity::ActivityBatch {
            events: vec![normalized.clone()],
            cursor: ActivityCursor::default(),
            records: 1,
            contracts,
        },
        &event.adapter_id,
        &event.execution_surface,
    )?;
    // The ACK is entirely local. The collector negotiates receiver capability
    // and drains this inbox independently of future tool calls or connectivity.
    let _ = config;
    Ok(
        json!({"schema_version":3,"event_id":normalized.event_id,"status":if duplicate{"duplicate"}else{"accepted"},"durable":true}),
    )
}
/// Shared one-shot broker v2 adapter. The durable inbox commit is the producer
/// acknowledgement boundary, including while the backend is unavailable.
pub(crate) async fn submit_activity(
    config: &Config,
    api: &ApiClient,
    event: BrokerActivityEventV2,
) -> Result<Value, Box<dyn std::error::Error>> {
    event.validate().map_err(std::io::Error::other)?;
    if wakaclock_core::runtime::paused("capture")
        || !wakaclock_core::runtime::capture_allowed_at(event.occurred_at.timestamp())
    {
        return Ok(
            json!({"schema_version":2,"status":"paused_by_user","event_id":event.event_id,"durable":false}),
        );
    }
    // v2 contains no boundary-frozen Git evidence. It may be a delayed replay:
    // never read the current branch here to fill a historical context gap.
    let scope = scope_key(api);
    let store = ActivityStore::open(&directory()?.join("capture.db"))?;
    let duplicate = store
        .evidence_revision(&scope, &event.event_id)?
        .is_some_and(|revision| revision >= event.revision);
    let batch = wakaclock_core::ai::activity::ActivityBatch {
        events: vec![event.clone()],
        cursor: ActivityCursor::default(),
        records: 1,
        contracts: std::collections::BTreeMap::new(),
    };
    store.commit(&scope, "broker-activity-v2", &batch)?;
    // Processing is best effort after acceptance. The independent collector
    // resumes this inbox after any failed capability check or durable handoff.
    if api.capture_activity_supported().await {
        let _ = handoff_pending(
            config,
            api,
            &store,
            &scope,
            api.capture_activity_version_supported(3).await,
        );
    }
    Ok(
        json!({"schema_version":2,"status":if duplicate{"duplicate"}else{"accepted"},"event_id":event.event_id,"durable":true}),
    )
}
fn handoff_pending(
    config: &Config,
    api: &ApiClient,
    store: &ActivityStore,
    scope: &str,
    v3_supported: bool,
) -> Result<u32, Box<dyn std::error::Error>> {
    let queue = Queue::open()?;
    store.rebind_verified_scopes(&queue, &api.queue_scope())?;
    let device = queue.device_id()?;
    let mut queued = 0;
    for event in store.pending(scope)? {
        let adapter = store.adapter_for(scope, &event.event_id)?;
        if adapter != "codex" && !v3_supported {
            continue;
        }
        let mut h = heartbeat(config, &event, &device);
        if adapter != "codex" {
            h.entity = adapter.clone();
            h.ai_agent = Some(adapter.clone());
            h.user_agent = "wakaclock-cli/provider-activity-v3".into();
            h.session_id = Some(wakaclock_core::ai::usage::scoped_session_id(
                &device,
                &adapter,
                &event.session_id,
            ));
        }
        h.revision = store.wire_revision(scope, &event.event_id, event.revision)?;
        h.enforce_attribution_policy();
        h.validate().map_err(std::io::Error::other)?;
        queue.push_scoped(&serde_json::to_value(&h)?, &api.queue_scope())?;
        store.mark_handed_off(scope, &event.event_id, event.revision)?;
        queued += 1;
    }
    Ok(queued)
}

fn save(path: &Path, state: &Value) -> Result<(), Box<dyn std::error::Error>> {
    let temporary_path = path.with_extension("tmp");
    fs::write(&temporary_path, serde_json::to_vec(state)?)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temporary_path, fs::Permissions::from_mode(0o600))?;
    }
    fs::rename(temporary_path, path)?;
    Ok(())
}
#[derive(Debug)]
struct CollectorAlreadyRunning;
impl std::fmt::Display for CollectorAlreadyRunning {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("capture collector already running")
    }
}
impl std::error::Error for CollectorAlreadyRunning {}

// A saved success describes that scan only. Re-evaluate freshness at read time
// so a stopped collector cannot keep reporting complete while the queue is empty.
fn assess_status(mut state: Value, now: chrono::DateTime<Utc>) -> Value {
    if !state.is_object() {
        return json!({"status":"unavailable","incomplete":true});
    }
    let age = |field: &str| {
        state[field]
            .as_str()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|at| {
                now.signed_duration_since(at.with_timezone(&Utc))
                    .num_seconds()
            })
    };
    let checked_age = age("checked_at");
    let scan_age = age("last_scan_success_at");
    let stale = checked_age.is_some_and(|age| age > 300) || scan_age.is_some_and(|age| age > 300);
    let known = state["schema_version"].as_u64() == Some(2)
        && state["enabled"].as_bool() == Some(true)
        && checked_age.is_some_and(|age| age >= -60)
        && scan_age.is_some_and(|age| age >= -60)
        && state["pending"].as_u64().is_some()
        && state["parser_errors"].as_u64().is_some();
    if state["status"] == "fresh" {
        if stale {
            state["status"] = json!("stale");
        } else if !known {
            state["status"] = json!("unavailable");
        }
    }
    state["stale"] = json!(stale);
    state["incomplete"] = json!(
        state["incomplete"].as_bool().unwrap_or(true)
            || !known
            || stale
            || state["status"] != "fresh"
            || state["pending"].as_u64() != Some(0)
            || state["parser_errors"].as_u64() != Some(0)
    );
    state
}
pub fn status() -> Value {
    let state = directory()
        .ok()
        .and_then(|d| fs::read(d.join("capture-state.json")).ok())
        .and_then(|s| serde_json::from_slice(&s).ok())
        .unwrap_or_else(|| json!({"status":"unavailable"}));
    assess_status(state, Utc::now())
}
#[derive(Clone)]
struct ActivitySource {
    adapter: String,
    surface: String,
    path: PathBuf,
    metadata_contract: bool,
}
fn scan_source_identity(source: &ActivitySource) -> String {
    opaque(&format!(
        "{}\0{}\0{}",
        source.adapter,
        source.surface,
        source.path.to_string_lossy()
    ))
}

fn sources(scope: &str) -> Vec<ActivitySource> {
    let discovery = DiscoveryContext {
        home_dir: dirs::home_dir().unwrap_or_default(),
        config_override: None,
    };
    let parsers: Vec<Box<dyn AiActivityParser>> = vec![
        Box::new(CodexParser::new()),
        Box::new(ClaudeCodeParser::new()),
    ];
    let mut sources = Vec::new();
    for parser in parsers {
        for result in parser.discover_sources(&discovery) {
            if let DiscoveryState::TranscriptFound { path } = result.state {
                sources.push(ActivitySource {
                    adapter: parser.id().into(),
                    surface: if parser.id() == "codex" {
                        "unknown"
                    } else {
                        "cli"
                    }
                    .into(),
                    path,
                    metadata_contract: false,
                });
            }
        }
    }
    // Explicit metadata producers may spool the validated v3 contract. Discovery
    // is shallow and scoped; it never recursively searches the user's home.
    let root = discovery
        .home_dir
        .join(".wakaclock/activity-sources")
        .join(scope);
    for manifest in AdapterRegistry::builtin().manifests() {
        for surface in ["cli", "ide", "desktop", "inline", "mcp"] {
            if let Ok(entries) = fs::read_dir(root.join(&manifest.id).join(surface)) {
                for entry in entries.take(256).flatten() {
                    if entry.path().extension().is_some_and(|s| s == "jsonl") {
                        sources.push(ActivitySource {
                            adapter: manifest.id.clone(),
                            surface: surface.into(),
                            path: entry.path(),
                            metadata_contract: true,
                        });
                    }
                }
            }
        }
    }
    sources
}

pub async fn run(
    once: bool,
    dry_run: bool,
    date: Option<String>,
    transcript: Option<PathBuf>,
) -> Result<Value, Box<dyn std::error::Error>> {
    let result = run_inner(once, dry_run, date, transcript).await;
    let busy = result
        .as_ref()
        .err()
        .is_some_and(|error| error.is::<CollectorAlreadyRunning>());
    if result.is_err() && !dry_run && !busy {
        let mut state = status();
        state["checked_at"] = json!(Utc::now());
        state["status"] = json!("unavailable");
        state["error_code"] = json!("capture_storage_or_handoff_failed");
        state["incomplete"] = json!(true);
        if let Ok(dir) = directory() {
            let _ = save(&dir.join("capture-state.json"), &state);
        }
    }
    result
}
async fn run_inner(
    once: bool,
    dry_run: bool,
    date: Option<String>,
    transcript: Option<PathBuf>,
) -> Result<Value, Box<dyn std::error::Error>> {
    let dir = directory()?;
    fs::create_dir_all(&dir)?;
    let _lock = if dry_run {
        None
    } else {
        let f = fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(dir.join("capture.lock"))?;
        if let Err(error) = f.try_lock_exclusive() {
            if error.kind() == std::io::ErrorKind::WouldBlock {
                return Err(Box::new(CollectorAlreadyRunning));
            }
            return Err(Box::new(error));
        }
        Some(f)
    };
    // A dry run uses only in-memory cursors, never opens or creates a store/queue.
    let store = if dry_run {
        None
    } else {
        Some(ActivityStore::open(&dir.join("capture.db"))?)
    };
    let binary_hash = crate::runtime_service::executable_hash()?;
    if !dry_run {
        save(
            &dir.join("capture-state.json"),
            &json!({"schema_version":2,"checked_at":Utc::now(),"status":"starting","pid":std::process::id(),"binary_sha256":binary_hash,"incomplete":true}),
        )?;
    }
    let mut interval = tokio::time::interval(Duration::from_secs(15));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    // Reserve at least one spool and parser batch on every tick, including a
    // fresh --once process. Context/boundary slots must never consume all spool
    // capacity. Alternating 3/4 leaves 2/1 parser batches under the same total 5.
    let mut producer_slots = 3usize;
    loop {
        interval.tick().await;
        if !dry_run && wakaclock_core::runtime::paused("capture") {
            let mut scope = None;
            let mut pending = None;
            if let Some(store) = &store {
                let mut config = Config::load();
                super::apply_env_overrides(&mut config)?;
                let api = ApiClient::new(config.clone())?;
                scope = Some(scope_key(&api));
                store.rebind_verified_scopes(&Queue::open()?, &api.queue_scope())?;
                if api.capture_activity_supported().await {
                    handoff_pending(
                        &config,
                        &api,
                        store,
                        &scope_key(&api),
                        api.capture_activity_version_supported(3).await,
                    )?;
                }
                pending = Some(store.pending_count(&scope_key(&api))?);
            }
            let state = json!({"schema_version":2,"checked_at":Utc::now(),"status":"paused_by_user","binary_sha256":binary_hash,"enabled":true,"scope":scope,"pending":pending,"incomplete":true,"pid":std::process::id()});
            save(&dir.join("capture-state.json"), &state)?;
            if once {
                return Ok(state);
            }
            continue;
        }
        if !once
            && !dry_run
            && date.is_none()
            && fs::read_to_string(dir.join("capture-enabled"))
                .ok()
                .is_some_and(|s| s.trim() == "0")
        {
            let mut state = status();
            state["enabled"] = json!(false);
            state["status"] = json!("disabled");
            state["incomplete"] = json!(true);
            state["checked_at"] = json!(Utc::now());
            save(&dir.join("capture-state.json"), &state)?;
            continue;
        }
        let mut config = Config::load();
        super::apply_env_overrides(&mut config)?;
        let api = ApiClient::new(config.clone())?;
        let scope = scope_key(&api);
        if let Some(store) = &store {
            store.rebind_verified_scopes(&Queue::open()?, &api.queue_scope())?;
        }
        let began = std::time::Instant::now();
        let now = Utc::now();
        let mut scanned = 0;
        let mut parsed = 0;
        let producer_batch_slots = producer_slots;
        producer_slots = 7 - producer_slots;
        let mut parser_batch_slots = 5 - producer_batch_slots;
        let record_limit = if dry_run || date.is_some() { 2000 } else { 100 };
        let mut tool_boundaries = if dry_run {
            json!({"status":"not_checked_dry_run"})
        } else {
            crate::producer_tool_boundary::health(&api)
                .unwrap_or_else(|_| json!({"status":"unavailable"}))
        };
        let context_slot = !dry_run && date.is_none() && began.elapsed() < Duration::from_secs(10);
        let context = if context_slot {
            crate::team_context_capture::tick(&config, &api, began).await
        } else {
            json!({"status":"unconfirmed"})
        };
        let boundary_slot = !dry_run && tool_boundaries["ready"].as_u64().is_some_and(|n| n > 0);
        if boundary_slot {
            if crate::producer_tool_boundary::drain_pending(&config, &api, 100, began).is_err() {
                tool_boundaries["status"] = json!("unavailable");
            } else {
                tool_boundaries = crate::producer_tool_boundary::health(&api)
                    .unwrap_or_else(|_| json!({"status":"unavailable"}));
            }
        }
        let producer_spool = if dry_run {
            json!({"status":"not_checked_dry_run"})
        } else {
            crate::native_spool::drain_bounded(
                &dir,
                &config,
                &api,
                producer_batch_slots - usize::from(boundary_slot) - usize::from(context_slot),
                began,
            )
            .await
        };
        let broker_handoff = if dry_run {
            json!({"status":"not_checked_dry_run"})
        } else {
            match crate::broker::queue_pending(&config, &api, 100).await {
                Ok(report) => {
                    json!({"status":if report.owner_unconfirmed>0{"owner_unconfirmed"}else if report.retained_dead_letters>0{"dead_letter"}else if report.pending>0{"pending"}else{"observed"},"claimed":report.claimed,"processed":report.processed,"retried":report.retried,"dead_lettered":report.dead_lettered,"pending":report.pending,"retained_dead_letters":report.retained_dead_letters,"owner_unconfirmed":report.owner_unconfirmed})
                }
                Err(_) => json!({"status":"unavailable","error_code":"broker_handoff_failed"}),
            }
        };
        let mut errors = 0;
        let mut parser_failure_codes = BTreeSet::new();
        let mut queued = 0;
        let mut candidates = Vec::new();
        let mut last_event = None;
        let mut unread_sources = 0u32;
        let selected_day = date
            .as_deref()
            .map(|s| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d"))
            .transpose()?;
        let mut paths = transcript
            .clone()
            .map(|path| {
                vec![ActivitySource {
                    adapter: "codex".into(),
                    surface: "unknown".into(),
                    path,
                    metadata_contract: false,
                }]
            })
            .unwrap_or_else(|| sources(&scope));
        if transcript.is_none() {
            for alias in Queue::open()?.verified_editor_journal_scopes(&api.queue_scope())? {
                paths.extend(sources(&wakaclock_core::editor_health::scope_id(&alias)));
            }
            paths.sort_by(|a, b| a.path.cmp(&b.path));
            paths.dedup_by(|a, b| a.path == b.path);
        }
        if transcript.is_none() {
            if let Some(day) = selected_day {
                let start = day
                    .and_hms_opt(0, 0, 0)
                    .unwrap()
                    .and_local_timezone(chrono_tz::Asia::Bangkok)
                    .single()
                    .ok_or("invalid replay date")?
                    .timestamp();
                paths.retain(|p| {
                    fs::metadata(&p.path)
                        .and_then(|m| m.modified())
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .is_some_and(|t| t.as_secs() >= start as u64)
                });
            }
        }
        paths.sort_by(|a, b| a.adapter.cmp(&b.adapter).then(a.path.cmp(&b.path)));
        let scan_checkpoint = dir.join(format!("capture-scan-cursor-{scope}.metadata"));
        if !dry_run && date.is_none() {
            if scan_checkpoint.is_symlink() {
                return Err("capture_cursor_symlink_refused".into());
            }
            if let Ok(last) = fs::read_to_string(&scan_checkpoint) {
                if let Some(index) = paths
                    .iter()
                    .position(|source| scan_source_identity(source) == last)
                {
                    let count = paths.len();
                    if count > 0 {
                        paths.rotate_left((index + 1) % count);
                    }
                }
            }
        }
        for input in paths {
            let scan_identity = scan_source_identity(&input);
            let path = input.path;
            if !dry_run
                && date.is_none()
                && (parser_batch_slots == 0 || began.elapsed() >= Duration::from_secs(10))
            {
                break;
            }
            let identity = format!(
                "{}\0{}",
                path.to_string_lossy(),
                date.as_deref().unwrap_or("live")
            );
            let source = opaque(&if input.adapter == "codex" && !input.metadata_contract {
                identity
            } else {
                format!("{}\0{}\0{}", input.adapter, input.surface, identity)
            });
            let previous = if let Some(store) = &store {
                store.cursor(&scope, &source)?
            } else {
                ActivityCursor::default()
            };
            // First discovery seeds history older than 24h. Explicit replay and
            // dry-run inspect the complete file; live capture never imports history.
            if previous.file_identity.is_empty()
                && date.is_none()
                && !dry_run
                && match fs::metadata(&path).and_then(|metadata| metadata.modified()) {
                    Ok(modified) => modified,
                    Err(_) => {
                        errors += 1;
                        parser_failure_codes.insert("activity_source_unreadable".into());
                        continue;
                    }
                }
                .elapsed()
                .is_ok_and(|a| a > Duration::from_secs(86400))
            {
                scanned += 1;
                continue;
            }
            let mut previous = if date.is_some() {
                ActivityCursor::default()
            } else {
                previous
            };
            if date.is_none() && !dry_run && previous.capture_since.is_none() {
                previous.capture_since = Some(now - chrono::Duration::hours(24));
            }
            if let Some(day) = selected_day {
                let start = day
                    .and_hms_opt(0, 0, 0)
                    .unwrap()
                    .and_local_timezone(chrono_tz::Asia::Bangkok)
                    .single()
                    .ok_or("invalid replay date")?
                    .with_timezone(&Utc);
                previous.capture_since = Some(start);
                previous.capture_until = Some(start + chrono::Duration::days(1));
            }
            loop {
                if !dry_run && date.is_none() {
                    parser_batch_slots -= 1;
                }
                match parse_shared_activity_bounded(
                    &input.adapter,
                    &input.surface,
                    input.metadata_contract,
                    &path,
                    &previous,
                    now,
                    record_limit,
                ) {
                    Ok((mut batch, blocked)) => {
                        if let Some(code) = blocked.as_ref() {
                            errors += 1;
                            parser_failure_codes.insert(code.clone());
                        }
                        scanned += 1;
                        parsed += batch.records;
                        if !dry_run {
                            batch.events.retain(|e| {
                                wakaclock_core::runtime::capture_allowed_at(
                                    e.occurred_at.timestamp(),
                                )
                            });
                            for event in &mut batch.events {
                                if let Some(start) = event.started_at {
                                    let state = wakaclock_core::runtime::read()?;
                                    if state.intervals.iter().any(|i| {
                                        i.component == "capture"
                                            && i.started_at < event.occurred_at.timestamp()
                                            && i.ended_at.is_none_or(|end| end > start.timestamp())
                                    }) {
                                        // End marker remains real; a tool crossing a user pause has no fully measured interval.
                                        event.started_at = None;
                                    }
                                }
                            }
                        }
                        if let Some(day) = &date {
                            batch.events.retain(|e| {
                                e.occurred_at
                                    .with_timezone(&chrono_tz::Asia::Bangkok)
                                    .date_naive()
                                    .to_string()
                                    == *day
                            });
                        } else if !dry_run {
                            let cutoff = previous
                                .capture_since
                                .unwrap_or(now - chrono::Duration::hours(24));
                            batch.events.retain(|e| e.occurred_at >= cutoff);
                        }
                        for e in &batch.events {
                            last_event = Some(
                                last_event.map_or(e.occurred_at, |old: chrono::DateTime<Utc>| {
                                    old.max(e.occurred_at)
                                }),
                            );
                            if dry_run {
                                candidates.push(json!({"event_id":e.event_id,"revision":e.revision,"kind":e.kind,"occurred_at":e.occurred_at,"started_at":e.started_at,"provenance":e.provenance,"source_id":source}));
                            }
                        }
                        if batch.records == record_limit && !dry_run && date.is_none() {
                            unread_sources += 1;
                        }
                        previous = batch.cursor.clone();
                        if let Some(store) = &store {
                            store.commit_for_adapter(
                                &scope,
                                &source,
                                &batch,
                                &input.adapter,
                                if input.adapter == "codex" && !input.metadata_contract {
                                    match batch.cursor.observed_surface() {
                                        "codex-desktop" => "desktop",
                                        _ => "unknown",
                                    }
                                } else {
                                    &input.surface
                                },
                            )?;
                        }
                        if blocked.is_some() {
                            if let Some(store) = &store {
                                store.parser_failed(
                                    &scope,
                                    &source,
                                    &input.adapter,
                                    &input.surface,
                                )?;
                            }
                        }
                        if blocked.is_none() && (dry_run || date.is_some()) && batch.records == 2000
                        {
                            continue;
                        }
                    }
                    Err(code) => {
                        errors += 1;
                        parser_failure_codes.insert(code);
                        if let Some(store) = &store {
                            store.parser_failed(&scope, &source, &input.adapter, &input.surface)?;
                        }
                    }
                }
                break;
            }
            if !dry_run && date.is_none() {
                crate::native_spool::persist_checkpoint(&scan_checkpoint, &scan_identity)?;
            }
        }
        let capability = if dry_run {
            false
        } else {
            api.capture_activity_supported().await
        };
        if let Some(store) = &store {
            if capability {
                queued += handoff_pending(
                    &config,
                    &api,
                    store,
                    &scope,
                    api.capture_activity_version_supported(3).await,
                )?;
            }
        }
        let pending = store
            .as_ref()
            .map(|s| s.pending_count(&scope))
            .transpose()?
            .unwrap_or(0)
            .saturating_add(unread_sources);
        let build_version = format!(
            "{}-{}",
            env!("CARGO_PKG_VERSION"),
            env!("WAKACLOCK_GIT_SHA")
        );
        let stage = |name: &str, value: &Value, status: &str| json!({"adapter_id":"all","execution_surface":"unknown","stage":name,"status":status,"pending":value["pending"],"failure_count":value["failure_count"].as_u64().unwrap_or(0),"last_observed_at":value["last_observed_at"],"oldest_pending_at":value["oldest_pending_at"],"error_code":value["error_code"],"version":build_version});
        let mut pipeline = vec![
            stage(
                "context",
                &context,
                context["status"].as_str().unwrap_or("unconfirmed"),
            ),
            stage(
                "context_delivery",
                &json!({"last_observed_at":context["last_observed_at"],"pending":context["delivery"]["pending"],"oldest_pending_at":context["delivery"]["oldest_pending_at"],"error_code":context["delivery"]["error_code"]}),
                context["delivery"]["status"]
                    .as_str()
                    .unwrap_or("unconfirmed"),
            ),
            stage(
                "tool_boundaries",
                &tool_boundaries,
                if tool_boundaries["unavailable"].as_u64().unwrap_or(0) > 0 {
                    "capture_failure"
                } else if tool_boundaries["pending"].as_u64().unwrap_or(0) > 0 {
                    "pending"
                } else {
                    "unconfirmed"
                },
            ),
        ];
        pipeline.push(stage("spool", &json!({"pending":producer_spool["pending"],"failure_count":producer_spool["failure_count"],"last_observed_at":producer_spool["last_scan_success_at"],"error_code":producer_spool["error_code"]}), producer_spool["status"].as_str().unwrap_or("unconfirmed")));
        pipeline.push(stage("parser", &json!({"pending":pending,"failure_count":errors,"last_observed_at":if errors==0&&scanned>0{json!(now)}else{Value::Null}}), if errors>0{"capture_failure"}else if scanned>0{"observed"}else{"unconfirmed"}));
        pipeline.push(stage(
            "inbox",
            &json!({"pending":broker_handoff["pending"],"last_observed_at":now}),
            if broker_handoff["status"] == "unavailable" {
                "unavailable"
            } else if broker_handoff["retained_dead_letters"]
                .as_u64()
                .is_some_and(|n| n > 0)
                || broker_handoff["dead_lettered"]
                    .as_u64()
                    .is_some_and(|n| n > 0)
            {
                "dead_letter"
            } else if broker_handoff["owner_unconfirmed"]
                .as_u64()
                .is_some_and(|n| n > 0)
            {
                "unresolved"
            } else if broker_handoff["pending"].as_u64().is_some_and(|n| n > 0) {
                "pending"
            } else {
                "observed"
            },
        ));
        if let Some(store) = &store {
            pipeline.extend(
                store
                    .pipeline_health(&scope, &build_version)?
                    .iter()
                    .map(|stage| serde_json::to_value(stage).expect("stage metadata serializes")),
            );
        }
        if let Some(stages) = producer_spool["stages"].as_array() {
            pipeline.extend(stages.iter().cloned());
        }
        if let Some(stages) = context["stages"].as_array() {
            pipeline.extend(stages.iter().cloned());
        }
        let state = json!({"schema_version":2,"checked_at":now,"pid":std::process::id(),"version":env!("CARGO_PKG_VERSION"),"git_sha":env!("WAKACLOCK_GIT_SHA"),"binary_sha256":binary_hash,"scope":scope,"enabled":true,"status":if errors>0{"parser_failure"}else if scanned==0{"unavailable"}else{"fresh"},"last_scan_success_at":if errors==0&&scanned>0{json!(now)}else{status()["last_scan_success_at"].clone()},"parser_errors":errors,"parser_failure_codes":parser_failure_codes,"pending":pending,"unread_sources":unread_sources,"scanned_sources":scanned,"parsed_records":parsed,"queued":queued,"receiver_capable":capability,"producer_spool":producer_spool,"tool_boundaries":tool_boundaries,"context":context,"pipeline":pipeline,"broker_handoff":broker_handoff,"last_event_at":last_event,"tick_elapsed_ms":began.elapsed().as_millis(),"incomplete":context["status"]!="observed"||context["delivery"]["status"]!="observed"||context["delivery"]["pending"].as_u64().is_some_and(|n|n>0)||errors>0||pending>0||scanned==0||tool_boundaries["status"]=="unavailable"||["pending","unavailable","clock_unconfirmed"].iter().any(|field|tool_boundaries[*field].as_u64().is_some_and(|n|n>0))||producer_spool["pending"].as_u64().is_some_and(|n|n>0)||producer_spool["status"]=="unavailable"||producer_spool["status"]=="capture_failure"||producer_spool["pending"].is_null()||broker_handoff["status"]=="unavailable"||broker_handoff["pending"].as_u64().is_some_and(|n|n>0)||broker_handoff["retained_dead_letters"].as_u64().is_some_and(|n|n>0)||broker_handoff["owner_unconfirmed"].as_u64().is_some_and(|n|n>0)||broker_handoff["dead_lettered"].as_u64().is_some_and(|n|n>0),"dry_run":dry_run,"candidates":if dry_run{Some(candidates)}else{None}});
        if !dry_run {
            save(&dir.join("capture-state.json"), &state)?;
        }
        if once || dry_run || date.is_some() {
            return Ok(state);
        }
    }
}

/// Disable only capture. Accepted inbox/queue records, IDs and schema survive.
pub fn uninstall() -> Result<Value, Box<dyn std::error::Error>> {
    if cfg!(any(target_os = "macos", target_os = "windows")) {
        return crate::runtime_service::uninstall("capture");
    }
    let dir = directory()?;
    fs::write(dir.join("capture-enabled"), "0")?;
    let uid = String::from_utf8(std::process::Command::new("id").arg("-u").output()?.stdout)?
        .trim()
        .to_owned();
    let _ = std::process::Command::new("launchctl")
        .args([
            "bootout",
            &format!("gui/{uid}/com.atoaxis.wakaclock.capture"),
        ])
        .output();
    let path = dirs::home_dir()
        .ok_or("home unavailable")?
        .join("Library/LaunchAgents/com.atoaxis.wakaclock.capture.plist");
    if path.exists() {
        fs::remove_file(path)?;
    }
    let mut state = status();
    state["enabled"] = json!(false);
    state["status"] = json!("disabled");
    state["incomplete"] = json!(true);
    state["checked_at"] = json!(Utc::now());
    save(&dir.join("capture-state.json"), &state)?;
    Ok(state)
}

pub fn install() -> Result<Value, Box<dyn std::error::Error>> {
    if cfg!(any(target_os = "macos", target_os = "windows")) {
        return crate::runtime_service::install("capture");
    }
    if !cfg!(target_os = "macos") {
        return Err("install currently supports macOS".into());
    }
    let dir = directory()?;
    fs::create_dir_all(dir.join("bin"))?;
    fs::write(dir.join("capture-enabled"), "1")?;
    let exe = dir.join("bin/wakaclock-capture");
    let temporary_path = exe.with_extension("new");
    fs::copy(std::env::current_exe()?, &temporary_path)?;
    fs::rename(temporary_path, &exe)?;
    let uid = String::from_utf8(std::process::Command::new("id").arg("-u").output()?.stdout)?
        .trim()
        .to_owned();
    let label = "com.atoaxis.wakaclock.capture";
    let _ = std::process::Command::new("launchctl")
        .args(["bootout", &format!("gui/{uid}/{label}")])
        .output();
    let escape = |s: &str| {
        s.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
    };
    let plist=format!("<?xml version=\"1.0\"?><plist version=\"1.0\"><dict><key>Label</key><string>{label}</string><key>ProgramArguments</key><array><string>{}</string><string>capture</string><string>run</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>15</integer><key>EnvironmentVariables</key><dict><key>HOME</key><string>{}</string></dict></dict></plist>",escape(&exe.to_string_lossy()),escape(&dirs::home_dir().unwrap().to_string_lossy()));
    let path = dirs::home_dir()
        .unwrap()
        .join("Library/LaunchAgents")
        .join(format!("{label}.plist"));
    fs::write(&path, plist)?;
    crate::delivery_service::bootstrap_launch_agent(&uid, label, &path)?;
    Ok(json!({"installed":true}))
}

#[cfg(test)]
mod tests {
    use super::*;
    use wakaclock_core::ai::activity::ActivityKind;
    fn event(kind: ActivityKind, started: Option<chrono::DateTime<Utc>>) -> BrokerActivityEventV2 {
        BrokerActivityEventV2 {
            schema_version: 2,
            event_id: "opaque".into(),
            revision: 2,
            session_id: "session".into(),
            project_root: PathBuf::from("/workspace/project"),
            kind,
            operation_id: "operation".into(),
            occurred_at: chrono::DateTime::parse_from_rfc3339("2026-10-07T01:00:05Z")
                .unwrap()
                .with_timezone(&Utc),
            started_at: started,
            provenance: "native".into(),
            tool: Some("exec_command".into()),
            status: Some("failed".into()),
            producer_surface: "codex-desktop".into(),
            monitoring_only: false,
        }
    }
    #[test]
    fn markers_are_app_activity_not_fabricated_file_edits() {
        let config = Config::default();
        for kind in [
            ActivityKind::TaskStart,
            ActivityKind::TaskEnd,
            ActivityKind::ToolStart,
            ActivityKind::MessageComplete,
        ] {
            let h = heartbeat(&config, &event(kind, None), "device");
            assert_eq!(h.entity_type, EntityType::App);
            assert!(!h.is_write);
            assert_eq!(h.active_seconds, Some(0.0));
            assert!(h.activity_segments.is_empty());
            assert!(h.ai_lines_added.is_none());
            assert!(h.ai_change_id.is_none());
            assert!(h.validate().is_ok());
        }
    }
    #[test]
    fn completed_failed_tool_uses_only_its_measured_interval() {
        let start = chrono::DateTime::parse_from_rfc3339("2026-10-07T01:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let mut h = heartbeat(
            &Config::default(),
            &event(ActivityKind::ToolEnd, Some(start)),
            "device",
        );
        h.enforce_attribution_policy();
        assert_eq!(h.active_seconds, Some(5.0));
        assert_eq!(h.activity_segments.len(), 1);
        assert_eq!(h.activity_segments[0].source.as_deref(), Some("ai_tool_v1"));
        assert!(h.ai_lines_added.is_none());
        assert!(!h.is_write);
        assert!(h.validate().is_ok());
    }
    #[test]
    fn stopped_or_invalid_capture_cannot_keep_a_saved_complete_status() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-10-08T01:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let fresh = json!({"schema_version":2,"enabled":true,"status":"fresh",
            "checked_at":now,"last_scan_success_at":now,"pending":0,"parser_errors":0,"incomplete":false});
        assert_eq!(assess_status(fresh.clone(), now)["incomplete"], false);
        assert_eq!(
            assess_status(fresh.clone(), now + chrono::Duration::seconds(300))["incomplete"],
            false
        );
        let stale = assess_status(fresh.clone(), now + chrono::Duration::seconds(301));
        assert_eq!(stale["status"], "stale");
        assert_eq!(stale["incomplete"], true);
        for field in [
            "checked_at",
            "last_scan_success_at",
            "pending",
            "parser_errors",
            "schema_version",
            "enabled",
        ] {
            let mut missing = fresh.clone();
            missing.as_object_mut().unwrap().remove(field);
            assert_eq!(assess_status(missing, now)["incomplete"], true, "{field}");
        }
        let mut invalid = fresh.clone();
        invalid["checked_at"] = json!("not-a-date");
        assert_eq!(assess_status(invalid, now)["status"], "unavailable");
        let mut failure = fresh.clone();
        failure["status"] = json!("parser_failure");
        failure["parser_errors"] = json!(1);
        let failure = assess_status(failure, now + chrono::Duration::minutes(10));
        assert_eq!(
            failure["status"], "parser_failure",
            "staleness must not erase a known parser failure"
        );
        assert_eq!(failure["incomplete"], true);
        assert_eq!(assess_status(json!(null), now)["incomplete"], true);
    }
}
