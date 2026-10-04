//! Real CLI acceptance tests for on-demand capture. Each invocation has a
//! disposable home, cleared environment, fake API and a hard process deadline.
use chrono::Utc;
use rusqlite::Connection;
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::Stdio,
    sync::Arc,
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    sync::Mutex,
    task::JoinHandle,
    time::timeout,
};
use wakaclock_core::{
    ai::{AiConfidence, AiEventSource},
    broker::{
        BrokerChangeKind, BrokerEventType, BrokerEventV1, BrokerStore, BROKER_SCHEMA_VERSION,
    },
};

fn temp_home(name: &str) -> PathBuf {
    let path = std::env::temp_dir().join(format!(
        "wakaclock-demand-{name}-{}",
        Utc::now().timestamp_nanos_opt().unwrap()
    ));
    fs::create_dir_all(path.join(".wakaclock")).unwrap();
    path
}

async fn cli(
    home: &Path,
    server: &str,
    args: &[&str],
    input: Option<&BrokerEventV1>,
) -> serde_json::Value {
    let mut command = tokio::process::Command::new(env!("CARGO_BIN_EXE_wakaclock"));
    command
        .args(args)
        .env_clear()
        .current_dir(home)
        .env("HOME", home)
        .env("USERPROFILE", home)
        .env("XDG_CONFIG_HOME", home.join(".config"))
        .env("WAKACLOCK_SERVER_URL", server)
        .env("WAKACLOCK_API_KEY", "process-test-key")
        .env("CODEX_HOME", home.join(".codex"))
        .env("PATH", home.join("no-system-services"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    let mut child = command.spawn().unwrap();
    if let Some(input) = input {
        child
            .stdin
            .take()
            .unwrap()
            .write_all(&serde_json::to_vec(input).unwrap())
            .await
            .unwrap();
    } else {
        drop(child.stdin.take());
    }
    let output = timeout(Duration::from_secs(30), child.wait_with_output())
        .await
        .expect("on-demand CLI did not exit")
        .unwrap();
    assert!(
        output.status.success(),
        "CLI failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(
        !home.join(".wakaclock/broker.json").exists(),
        "on-demand command wrote discovery"
    );
    assert!(
        !home.join(".wakaclock/broker.token").exists(),
        "on-demand command wrote a broker token"
    );
    serde_json::from_slice(&output.stdout).unwrap_or(serde_json::Value::Null)
}

struct FakeApi {
    url: String,
    status: Arc<Mutex<u16>>,
    heartbeats: Arc<Mutex<Vec<serde_json::Value>>>,
    task: JoinHandle<()>,
}
impl Drop for FakeApi {
    fn drop(&mut self) {
        self.task.abort();
    }
}
async fn fake_api(status: u16) -> FakeApi {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let status = Arc::new(Mutex::new(status));
    let heartbeats = Arc::new(Mutex::new(Vec::new()));
    let state = status.clone();
    let rows = heartbeats.clone();
    let task = tokio::spawn(async move {
        loop {
            let (mut stream, _) = listener.accept().await.unwrap();
            let state = state.clone();
            let rows = rows.clone();
            tokio::spawn(async move {
                let mut bytes = Vec::new();
                let mut buffer = [0; 8192];
                let header_end = loop {
                    let n = stream.read(&mut buffer).await.unwrap_or(0);
                    if n == 0 {
                        return;
                    }
                    bytes.extend_from_slice(&buffer[..n]);
                    if let Some(i) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                        break i + 4;
                    }
                };
                let headers = String::from_utf8_lossy(&bytes[..header_end]).into_owned();
                let length = headers
                    .lines()
                    .find_map(|l| {
                        l.split_once(':')
                            .filter(|(k, _)| k.eq_ignore_ascii_case("content-length"))
                            .and_then(|(_, v)| v.trim().parse::<usize>().ok())
                    })
                    .unwrap_or(0);
                while bytes.len() < header_end + length {
                    let n = stream.read(&mut buffer).await.unwrap_or(0);
                    if n == 0 {
                        return;
                    }
                    bytes.extend_from_slice(&buffer[..n]);
                }
                let code = *state.lock().await;
                if code == 200 && headers.lines().next().unwrap_or("").contains("heartbeats") {
                    rows.lock().await.push(
                        serde_json::from_slice(&bytes[header_end..header_end + length]).unwrap(),
                    );
                }
                let body = r#"{"status":"ok","heartbeats_inserted":1}"#;
                let response=format!("HTTP/1.1 {code} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",body.len());
                let _ = stream.write_all(response.as_bytes()).await;
            });
        }
    });
    FakeApi {
        url,
        status,
        heartbeats,
        task,
    }
}
fn event(id: &str) -> BrokerEventV1 {
    BrokerEventV1 {
        schema_version: BROKER_SCHEMA_VERSION,
        producer_version: None,
        event_type: BrokerEventType::FileChange,
        event_id: id.to_string(),
        occurred_at: Utc::now(),
        entity: "/workspace/src/main.rs".to_string(),
        project_root: Some("/workspace".to_string()),
        change_kind: BrokerChangeKind::Modify,
        previous_entity: None,
        agent: "codex".to_string(),
        provider: Some("openai".to_string()),
        model: None,
        session_id: Some("process-test".to_string()),
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
        transport: Some("test".to_string()),
        tool: Some("test".to_string()),
        tool_event_id: Some("tool-process".to_string()),
        editor: Some("VS Code".into()),
        producer_surface: None,
    }
}

fn read_delivery_state(db: &Path) -> Option<(String, Option<i64>)> {
    if !db.exists() {
        return None;
    }
    let connection = Connection::open(db).ok()?;
    connection
        .query_row(
            "SELECT kind, http_status FROM delivery_state LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok()
}

fn total_rows(db: &Path) -> u64 {
    let stats = BrokerStore::open_at(db).unwrap().stats().unwrap();
    stats.pending + stats.processing + stats.processed + stats.retry + stats.dead_letter
}

fn write_native_codex_transcript(home: &Path) -> (PathBuf, PathBuf) {
    let root = home.join(".codex/sessions/2026/09/02");
    fs::create_dir_all(&root).unwrap();
    let path = root.join("rollout-auto-scan.jsonl");
    let workspace_root = home.join("Desktop/AI-tiktok");
    fs::create_dir_all(workspace_root.join("src")).unwrap();
    fs::write(
        workspace_root.join("package.json"),
        r#"{"name":"ai-tiktok","private":true}"#,
    )
    .unwrap();

    let first_entity = workspace_root.join("src/prompt-engine.ts");
    let second_entity = workspace_root.join("src/video-service.ts");
    let now = Utc::now();
    let mut changes = serde_json::Map::new();
    changes.insert(
        first_entity.to_string_lossy().into_owned(),
        serde_json::json!({
            "type": "add",
            "content": "export const prompt = 'verified';\n",
        }),
    );
    changes.insert(
        second_entity.to_string_lossy().into_owned(),
        serde_json::json!({
            "type": "update",
            "unified_diff": "@@ -1 +1,2 @@\n-export const version = 1;\n+export const version = 2;\n+export const ready = true;\n",
        }),
    );
    let records = [
        serde_json::json!({
            "type": "session_meta",
            "timestamp": now.to_rfc3339(),
            "payload": {
                "id": "native-auto-scan-session",
                "session_id": "native-auto-scan-session",
                "cwd": workspace_root,
                "originator": "Codex Desktop",
                "source": "vscode",
                "model_provider": "openai",
            },
        }),
        serde_json::json!({
            "type": "turn_context",
            "timestamp": now.to_rfc3339(),
            "payload": {
                "turn_id": "native-auto-scan-turn",
                "cwd": workspace_root,
                "workspace_roots": [workspace_root],
                "model": "gpt-5.6-sol",
            },
        }),
        serde_json::json!({
            "type": "event_msg",
            "timestamp": now.to_rfc3339(),
            "payload": {
                "type": "item_completed",
                "completed_at_ms": now.timestamp_millis(),
                "turn_id": "native-auto-scan-turn",
                "item": {
                    "type": "FileChange",
                    "id": "native-auto-scan-file-change",
                    "status": "completed",
                    "changes": serde_json::Value::Object(changes),
                },
            },
        }),
    ];
    let mut file = fs::File::create(&path).unwrap();
    for value in records {
        writeln!(file, "{}", serde_json::to_string(&value).unwrap()).unwrap();
    }
    (path, workspace_root)
}

fn write_legacy_alias_manifest(home: &std::path::Path) {
    #[cfg(target_os = "macos")]
    {
        let launch_agents = home.join("Library/LaunchAgents");
        fs::create_dir_all(&launch_agents).unwrap();
        fs::write(
            launch_agents.join("com.atoaxis.wakaclock.agent.plist"),
            "<plist version=\"1.0\"><dict>\n  <key>ProgramArguments</key><array><string>/usr/local/bin/wakaclock</string><string>agent</string><string>run</string></array>\n</dict></plist>\n",
        )
        .unwrap();
    }
    #[cfg(target_os = "linux")]
    {
        let systemd_dir = home.join(".config/systemd/user");
        fs::create_dir_all(&systemd_dir).unwrap();
        fs::write(
            systemd_dir.join("atoaxis-wakaclock-agent.service"),
            "[Service]\nType=simple\nExecStart=/usr/local/bin/wakaclock agent run\nRestart=always\n",
        )
        .unwrap();
    }
    #[cfg(target_os = "windows")]
    {
        fs::create_dir_all(home.join(".wakaclock")).unwrap();
        fs::write(
            home.join(".wakaclock/agent-task.txt"),
            "\"C:\\bin\\wakaclock.exe\" agent run\r\n",
        )
        .unwrap();
    }
}

/// p0.A4 — `wakaclock doctor ai --json` alone surfaces each pipeline gap: a
/// service manifest on the legacy alias, and a recorded 402 classified as
/// `payment_402` rather than an auth or network failure.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn p0_a4_doctor_ai_identifies_pipeline_gaps() {
    let home = temp_home("p0a4");
    write_legacy_alias_manifest(&home);
    fs::create_dir_all(home.join(".wakaclock")).unwrap();
    fs::write(
        home.join(".wakaclock/last-delivery-failure.json"),
        "{\"at\":1788000000.0,\"message\":\"HTTP status 402: {\\\"error\\\":\\\"trial expired\\\"}\"}",
    )
    .unwrap();

    let binary = env!("CARGO_BIN_EXE_wakaclock");
    let output = std::process::Command::new(binary)
        .args(["doctor", "ai", "--json"])
        .env_clear()
        .env("PATH", home.join("no-system-services"))
        .env("HOME", &home)
        .env("USERPROFILE", &home)
        .output()
        .expect("run doctor ai");
    let report: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("doctor ai emitted valid json");

    assert_eq!(report["legacy_service_alias"], serde_json::json!(true));
    assert_eq!(
        report["last_delivery_failure"]["category"],
        serde_json::json!("payment_402")
    );
    // The doctor still reports every required key with this partial environment.
    for key in [
        "cli_identity",
        "broker",
        "agents",
        "outbound_queue_depth",
        "broker_installed",
    ] {
        assert!(report.get(key).is_some(), "doctor ai missing key {key}");
    }

    let _ = fs::remove_dir_all(&home);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn repeated_emit_across_processes_is_durable_and_idempotent() {
    let home = temp_home("dedup");
    let api = fake_api(200).await;
    let input = event("dedup");
    let first = cli(&home, &api.url, &["ai", "emit", "--json"], Some(&input)).await;
    let second = cli(&home, &api.url, &["ai", "emit", "--json"], Some(&input)).await;
    assert_eq!(first["accepted"], true);
    assert_eq!(second["duplicate"], true);
    assert_eq!(total_rows(&home.join(".wakaclock/broker.db")), 1);
    assert_eq!(api.heartbeats.lock().await.len(), 1);
    fs::remove_dir_all(home).unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn payment_refusal_preserves_capture_and_recovery_drains_once() {
    let home = temp_home("payment");
    let api = fake_api(402).await;
    let input = event("payment");
    cli(&home, &api.url, &["ai", "emit", "--json"], Some(&input)).await;
    let db = home.join(".wakaclock/queue.db");
    assert_eq!(
        read_delivery_state(&db),
        Some(("payment_402".into(), Some(402)))
    );
    assert!(home.join(".wakaclock/ai-events.jsonl").exists());
    let inbox = home.join(".wakaclock/broker.db");
    assert_eq!(total_rows(&inbox), 1);
    assert_eq!(
        BrokerStore::open_at(&inbox)
            .unwrap()
            .stats()
            .unwrap()
            .dead_letter,
        0
    );
    *api.status.lock().await = 200;
    cli(&home, &api.url, &["sync", "--json"], None).await;
    cli(&home, &api.url, &["sync", "--json"], None).await;
    assert_eq!(api.heartbeats.lock().await.len(), 1);
    assert_eq!(total_rows(&inbox), 1);
    fs::remove_dir_all(home).unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn new_process_recovers_an_expired_claim_without_duplicate_capture() {
    let home = temp_home("lease");
    let api = fake_api(200).await;
    let input = event("lease");
    let db = home.join(".wakaclock/broker.db");
    {
        let mut store = BrokerStore::open_at(&db).unwrap();
        store.ingest_batch(&[input]).unwrap();
        assert_eq!(store.claim_ready(1).unwrap().len(), 1);
    }
    Connection::open(&db)
        .unwrap()
        .execute("UPDATE broker_events SET lease_until=0", [])
        .unwrap();
    cli(&home, &api.url, &["sync", "--json"], None).await;
    cli(&home, &api.url, &["sync", "--json"], None).await;
    let stats = BrokerStore::open_at(&db).unwrap().stats().unwrap();
    assert_eq!(stats.processed, 1);
    assert_eq!(total_rows(&db), 1);
    assert_eq!(api.heartbeats.lock().await.len(), 1);
    fs::remove_dir_all(home).unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn transcript_sync_across_processes_captures_each_file_once() {
    let home = temp_home("transcript");
    let api = fake_api(200).await;
    write_native_codex_transcript(&home);
    for _ in 0..3 {
        cli(
            &home,
            &api.url,
            &["sync", "--agent", "codex", "--from-start", "--json"],
            None,
        )
        .await;
        // Advance only the fixture's editor-correlation deadline. A new process
        // must drain deferred metadata even when no editor observation arrives.
        Connection::open(home.join(".wakaclock/broker.db")).unwrap()
            .execute("UPDATE broker_events SET next_attempt_at=0, editor_wait_until=0 WHERE status IN ('pending','retry')", []).unwrap();
    }
    assert_eq!(total_rows(&home.join(".wakaclock/broker.db")), 2);
    assert_eq!(api.heartbeats.lock().await.len(), 2);
    fs::remove_dir_all(home).unwrap();
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn legacy_run_is_bounded_and_doctors_agree_on_on_demand_mode() {
    let home = temp_home("migration");
    let api = fake_api(200).await;
    write_legacy_alias_manifest(&home);
    cli(
        &home,
        &api.url,
        &["broker", "run", "--interval-seconds", "1"],
        None,
    )
    .await;
    let a = cli(&home, &api.url, &["doctor", "ai", "--json"], None).await;
    let b = cli(&home, &api.url, &["ai", "doctor", "--json"], None).await;
    assert_eq!(a["broker_running"], false);
    assert_eq!(a["legacy_service_alias"], false);
    assert_eq!(a["diagnostics_v2"]["runtime_health"], b["runtime_health"]);
    assert_eq!(a["diagnostics_v2"]["broker"]["running"]["value"], false);
    assert_eq!(b["broker"]["running"]["value"], false);
    assert_eq!(a["runtime_mode"], "on_demand");
    assert!(a["diagnostics_v2"].is_object());
    fs::remove_dir_all(home).unwrap();
}
