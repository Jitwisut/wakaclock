//! Producers retain sanitized observations before CLI availability. The existing
//! collector reconciles them locally; no provider contents or network is needed.
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{fs, path::Path};
use wakaclock_core::{api_client::ApiClient, config::Config};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Observation {
    schema_version: u8,
    scope_id: String,
    adapter_id: String,
    execution_surface: String,
    observation_id: String,
    observed_at: DateTime<Utc>,
    metadata: Value,
}
fn validate_metadata(adapter: &str, metadata: &Value) -> bool {
    let names: &[&str] = match adapter {
        "claude-code" | "copilot" => &[
            "hook_event_name",
            "session_id",
            "cwd",
            "tool_use_id",
            "timestamp",
        ],
        "gemini-cli" => &["hook_event_name", "session_id", "cwd", "timestamp"],
        "cursor" => &[
            "hook_event_name",
            "conversation_id",
            "generation_id",
            "workspace_roots",
            "timestamp",
        ],
        "cline" => &[
            "hookName",
            "taskId",
            "workspaceRoots",
            "postToolUse",
            "timestamp",
        ],
        "kimi-code-cli" => &[
            "hook_event_name",
            "session_id",
            "cwd",
            "tool_call_id",
            "timestamp",
        ],
        "antigravity" => &[
            "hook_event_name",
            "conversationId",
            "workspacePaths",
            "stepIdx",
            "invocationNum",
            "executionNum",
            "fullyIdle",
            "failed",
            "timestamp",
        ],
        "kilo-code" | "opencode" => &[
            "hook_event_name",
            "sessionID",
            "callID",
            "directory",
            "timestamp",
        ],
        _ => return false,
    };
    metadata.as_object().is_some_and(|map| {
        map.iter().all(|(key, value)| {
            names.contains(&key.as_str())
                && match key.as_str() {
                    "workspace_roots" | "workspaceRoots" | "workspacePaths" => {
                        value.as_array().is_some_and(|values| {
                            values
                                .iter()
                                .all(|v| v.as_str().is_some_and(|s| s.len() <= 4096))
                        })
                    }
                    "stepIdx" | "invocationNum" | "executionNum" => {
                        value.as_u64().is_some_and(|n| n <= 9_007_199_254_740_991)
                    }
                    "fullyIdle" | "failed" => value.is_boolean(),
                    "postToolUse" => value.as_object().is_some_and(|m| {
                        m.len() == 1 && m.get("success").is_some_and(Value::is_boolean)
                    }),
                    _ => value.as_str().is_some_and(|s| s.len() <= 4096),
                }
        })
    })
}
pub(crate) async fn drain(directory: &Path, config: &Config, api: &ApiClient) -> Value {
    let mut scopes = vec![wakaclock_core::editor_health::scope_id(&api.queue_scope())];
    let aliases = wakaclock_core::queue::Queue::open()
        .and_then(|queue| queue.verified_editor_journal_scopes(&api.queue_scope()));
    match aliases {
        Ok(aliases) => scopes.extend(aliases.iter().map(wakaclock_core::editor_health::scope_id)),
        Err(_) => {
            return json!({"status":"unavailable","pending":null,"error_code":"producer_scope_proof_unavailable"})
        }
    }
    scopes.sort();
    scopes.dedup();
    let mut total = json!({"status":"unconfirmed","pending":0,"accepted":0,"failure_count":0,"paused_excluded":0,"last_scan_success_at":null});
    for scope in scopes {
        let state = drain_scope(directory, config, api, &scope).await;
        if state["status"] == "capture_failure" || state["status"] == "unavailable" {
            total["status"] = state["status"].clone();
            total["error_code"] = state["error_code"].clone();
        } else if !["capture_failure", "unavailable"]
            .contains(&total["status"].as_str().unwrap_or(""))
        {
            if state["status"] == "pending" || total["status"] == "pending" {
                total["status"] = json!("pending");
            } else if state["status"] == "observed" {
                total["status"] = json!("observed");
            }
        }
        for key in ["accepted", "failure_count", "paused_excluded"] {
            total[key] = json!(total[key].as_u64().unwrap_or(0) + state[key].as_u64().unwrap_or(0));
        }
        total["pending"] = match (total["pending"].as_u64(), state["pending"].as_u64()) {
            (Some(a), Some(b)) => json!(a + b),
            _ => Value::Null,
        };
        if !state["last_scan_success_at"].is_null() {
            total["last_scan_success_at"] = state["last_scan_success_at"].clone();
        }
    }
    total
}
async fn drain_scope(directory: &Path, config: &Config, api: &ApiClient, scope: &str) -> Value {
    let root = directory.join("native-producer-spool").join(scope);
    let mut accepted = 0;
    let mut failures = 0;
    let mut pending = 0;
    let mut excluded_paused = 0;
    let mut last_scan = None;
    // Do not follow a redirected spool root or process file symlinks.
    if directory.join("native-producer-spool").is_symlink() || root.is_symlink() {
        return json!({"status":"capture_failure","error_code":"producer_spool_symlink","pending":null});
    }
    match fs::read_dir(&root) {
        Ok(entries) => {
            let mut paths = Vec::new();
            for entry in entries {
                match entry {
                    Ok(entry) if entry.path().extension().is_some_and(|s| s == "json") => {
                        paths.push(entry.path())
                    }
                    Ok(_) => {}
                    Err(_) => failures += 1,
                }
            }
            paths.sort();
            pending = paths.len();
            let checkpoint = root.join("scan-cursor.json.metadata");
            if checkpoint.is_symlink() {
                return json!({"status":"capture_failure","pending":null,"error_code":"producer_cursor_symlink"});
            }
            let previous = fs::read_to_string(&checkpoint).ok();
            if let Some(previous) = previous {
                if let Some(start) = paths.iter().position(|p| {
                    p.file_name()
                        .and_then(|s| s.to_str())
                        .is_some_and(|name| name > previous.as_str())
                }) {
                    paths.rotate_left(start);
                }
            }
            let last = paths
                .iter()
                .take(100)
                .next_back()
                .and_then(|p| p.file_name())
                .and_then(|s| s.to_str())
                .map(str::to_owned);
            for file in paths.into_iter().take(100) {
                let result = async {
                    if file.is_symlink() || fs::metadata(&file)?.len() > 64 * 1024 {
                        return Err("producer_spool_invalid".into());
                    }
                    let bytes = fs::read(&file)?;
                    let observation: Observation = serde_json::from_slice(&bytes)?;
                    if observation.schema_version != 1
                        || observation.scope_id != scope
                        || uuid::Uuid::parse_str(&observation.observation_id).is_err()
                        || file.file_stem().and_then(|s| s.to_str())
                            != Some(observation.observation_id.as_str())
                        || !validate_metadata(&observation.adapter_id, &observation.metadata)
                    {
                        return Err("producer_spool_invalid".into());
                    }
                    // Events captured during a persisted Pause are never replayed.
                    if !wakaclock_core::runtime::capture_allowed_at(
                        observation.observed_at.timestamp(),
                    ) {
                        excluded_paused += 1;
                        return Ok(false);
                    }
                    let normalized = wakaclock_core::ai::native_activity::normalize_hook(
                        &observation.adapter_id,
                        &observation.execution_surface,
                        &observation.metadata,
                        observation.observed_at,
                        &observation.observation_id,
                    )
                    .map_err(std::io::Error::other)?;
                    let event = normalized.event.ok_or("producer_event_unresolved")?;
                    let expected = event.normalized().map_err(std::io::Error::other)?.event_id;
                    let ack =
                        crate::capture_service::submit_activity_v3(config, api, event).await?;
                    if ack["durable"] != true || ack["event_id"].as_str() != Some(expected.as_str())
                    {
                        return Ok(false);
                    }
                    if fs::read(&file)? != bytes {
                        return Err("producer_spool_changed".into());
                    }
                    fs::remove_file(file)?;
                    #[cfg(unix)]
                    fs::File::open(&root)?.sync_all()?;
                    Ok::<bool, Box<dyn std::error::Error>>(true)
                }
                .await;
                match result {
                    Ok(true) => {
                        accepted += 1;
                        pending -= 1;
                    }
                    Ok(false) => {}
                    Err(_) => failures += 1,
                }
            }
            if let Some(last) = last {
                let result = (|| -> std::io::Result<()> {
                    use std::io::Write;
                    let stage = root.join(format!("scan-{}.metadata", uuid::Uuid::new_v4()));
                    let mut options = fs::OpenOptions::new();
                    options.create_new(true).write(true);
                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::OpenOptionsExt;
                        options.mode(0o600);
                    }
                    let mut file = options.open(&stage)?;
                    file.write_all(last.as_bytes())?;
                    file.sync_all()?;
                    fs::rename(stage, &checkpoint)?;
                    #[cfg(unix)]
                    fs::File::open(&root)?.sync_all()?;
                    Ok(())
                })();
                if result.is_err() {
                    failures += 1;
                }
            }
            last_scan = Some(Utc::now());
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(_) => {
            return json!({"status":"unavailable","pending":null,"error_code":"producer_spool_unreadable"})
        }
    }
    json!({"status":if failures>0{"capture_failure"}else if pending>0{"pending"}else if last_scan.is_some(){"observed"}else{"unconfirmed"},
        "pending":pending,"accepted":accepted,"failure_count":failures,"paused_excluded":excluded_paused,"last_scan_success_at":last_scan})
}
