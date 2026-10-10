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
        activity::{opaque, parse_activity, ActivityCursor, ActivityStore, BrokerActivityEventV2},
        AiActivityParser, CodexParser, DiscoveryContext, DiscoveryState,
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
/// Shared one-shot broker v2 adapter. The durable inbox commit is the producer
/// acknowledgement boundary, including while the backend is unavailable.
pub(crate) async fn submit_activity(
    config: &Config,
    api: &ApiClient,
    event: BrokerActivityEventV2,
) -> Result<Value, Box<dyn std::error::Error>> {
    event.validate().map_err(std::io::Error::other)?;
    if !event.monitoring_only {
        crate::team_context_capture::observe(
            config,
            "codex",
            Some(&event.session_id),
            Some(&event.project_root),
            event.occurred_at,
        )?;
    }
    let scope = scope_key(api);
    let store = ActivityStore::open(&directory()?.join("capture.db"))?;
    let duplicate = store
        .evidence_revision(&scope, &event.event_id)?
        .is_some_and(|revision| revision >= event.revision);
    let batch = wakaclock_core::ai::activity::ActivityBatch {
        events: vec![event.clone()],
        cursor: ActivityCursor::default(),
        records: 1,
    };
    store.commit(&scope, "broker-activity-v2", &batch)?;
    // Processing is best effort after acceptance. The independent collector
    // resumes this inbox after any failed capability check or durable handoff.
    if api.capture_activity_supported().await {
        let _ = handoff_pending(config, api, &store, &scope);
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
) -> Result<u32, Box<dyn std::error::Error>> {
    let queue = Queue::open()?;
    let device = queue.device_id()?;
    let mut queued = 0;
    for event in store.pending(scope)? {
        let mut h = heartbeat(config, &event, &device);
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
    let temp = path.with_extension("tmp");
    fs::write(&temp, serde_json::to_vec(state)?)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temp, fs::Permissions::from_mode(0o600))?;
    }
    fs::rename(temp, path)?;
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
fn sources() -> Vec<PathBuf> {
    CodexParser::new()
        .discover_sources(&DiscoveryContext {
            home_dir: dirs::home_dir().unwrap_or_default(),
            config_override: None,
        })
        .into_iter()
        .filter_map(|v| match v.state {
            DiscoveryState::TranscriptFound { path } => Some(path),
            _ => None,
        })
        .collect()
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
    let mut interval = tokio::time::interval(Duration::from_secs(15));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
        interval.tick().await;
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
        let began = std::time::Instant::now();
        let now = Utc::now();
        let mut scanned = 0;
        let mut parsed = 0;
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
        let mut paths = transcript.clone().map(|p| vec![p]).unwrap_or_else(sources);
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
                    fs::metadata(p)
                        .and_then(|m| m.modified())
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .is_some_and(|t| t.as_secs() >= start as u64)
                });
            }
        }
        paths.sort_by_key(|p| std::cmp::Reverse(fs::metadata(p).and_then(|m| m.modified()).ok()));
        for path in paths {
            if began.elapsed() > Duration::from_secs(10) && !dry_run && date.is_none() {
                break;
            }
            let source = opaque(&format!(
                "{}\0{}",
                path.to_string_lossy(),
                date.as_deref().unwrap_or("live")
            ));
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
                && fs::metadata(&path)?
                    .modified()?
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
                match parse_activity(&path, &previous, now) {
                    Ok(mut batch) => {
                        scanned += 1;
                        parsed += batch.records;
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
                        if batch.records == 2000 && !dry_run && date.is_none() {
                            unread_sources += 1;
                        }
                        previous = batch.cursor.clone();
                        if let Some(store) = &store {
                            store.commit(&scope, &source, &batch)?;
                        }
                        if (dry_run || date.is_some()) && batch.records == 2000 {
                            continue;
                        }
                    }
                    Err(code) => {
                        errors += 1;
                        parser_failure_codes.insert(code);
                    }
                }
                break;
            }
        }
        let capability = if dry_run {
            false
        } else {
            api.capture_activity_supported().await
        };
        if let Some(store) = &store {
            if capability {
                queued += handoff_pending(&config, &api, store, &scope)?;
            }
        }
        let pending = store
            .as_ref()
            .map(|s| s.pending_count(&scope))
            .transpose()?
            .unwrap_or(0)
            .saturating_add(unread_sources);
        let state = json!({"schema_version":2,"checked_at":now,"pid":std::process::id(),"version":env!("CARGO_PKG_VERSION"),"git_sha":env!("WAKACLOCK_GIT_SHA"),"scope":scope,"enabled":true,"status":if errors>0{"parser_failure"}else if scanned==0{"unavailable"}else{"fresh"},"last_scan_success_at":if errors==0&&scanned>0{json!(now)}else{status()["last_scan_success_at"].clone()},"parser_errors":errors,"parser_failure_codes":parser_failure_codes,"pending":pending,"unread_sources":unread_sources,"scanned_sources":scanned,"parsed_records":parsed,"queued":queued,"receiver_capable":capability,"last_event_at":last_event,"tick_elapsed_ms":began.elapsed().as_millis(),"incomplete":errors>0||pending>0||scanned==0,"dry_run":dry_run,"candidates":if dry_run{Some(candidates)}else{None}});
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
    if !cfg!(target_os = "macos") {
        return Err("install currently supports macOS".into());
    }
    let dir = directory()?;
    fs::create_dir_all(dir.join("bin"))?;
    fs::write(dir.join("capture-enabled"), "1")?;
    let exe = dir.join("bin/wakaclock-capture");
    let temp = exe.with_extension("new");
    fs::copy(std::env::current_exe()?, &temp)?;
    fs::rename(temp, &exe)?;
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
