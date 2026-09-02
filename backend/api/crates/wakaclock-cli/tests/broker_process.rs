use chrono::Utc;
use reqwest::StatusCode;
use rusqlite::Connection;
use std::{
    fs,
    io::{ErrorKind, Write},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    task::JoinHandle,
    time::{sleep, timeout},
};
use wakaclock_core::{
    ai::{AiConfidence, AiEventSource},
    broker::{
        BrokerChangeKind, BrokerDiscovery, BrokerEventType, BrokerEventV1, BrokerStore,
        BROKER_SCHEMA_VERSION,
    },
};

struct ChildGuard(Child);

impl ChildGuard {
    fn kill(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }

    fn terminate(&mut self) {
        #[cfg(unix)]
        {
            let _ = Command::new("kill")
                .args(["-TERM", &self.0.id().to_string()])
                .status();
            let _ = self.0.wait();
        }
        #[cfg(not(unix))]
        self.kill();
    }
}

impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn temp_home(name: &str) -> PathBuf {
    let nonce = Utc::now().timestamp_nanos_opt().unwrap_or_default();
    let path = std::env::temp_dir().join(format!("wakaclock-broker-process-{name}-{nonce}"));
    fs::create_dir_all(&path).unwrap();
    path
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
        source: AiEventSource::AgentHook,
        confidence: AiConfidence::Verified,
        actor_type: None,
        actor_confidence: None,
        lines_added: Some(1),
        lines_deleted: Some(0),
        active_seconds: Some(1.0),
        transport: Some("test".to_string()),
        tool: Some("test".to_string()),
        tool_event_id: Some("tool-process".to_string()),
    }
}

fn spawn_broker(home: &Path, server_url: &str) -> ChildGuard {
    let binary = env!("CARGO_BIN_EXE_wakaclock");
    let child = Command::new(binary)
        .args(["broker", "run", "--interval-seconds", "1"])
        .env("HOME", home)
        .env("USERPROFILE", home)
        .env("WAKACLOCK_SERVER_URL", server_url)
        .env("WAKACLOCK_API_KEY", "process-test-key")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn broker process");
    ChildGuard(child)
}

async fn wait_for_discovery(home: &Path) -> BrokerDiscovery {
    let path = home.join(".wakaclock/broker.json");
    timeout(Duration::from_secs(5), async {
        loop {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(discovery) = serde_json::from_str::<BrokerDiscovery>(&content) {
                    return discovery;
                }
            }
            sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .expect("broker discovery timeout")
}

async fn wait_for_new_discovery(home: &Path, old_pid: u32) -> BrokerDiscovery {
    let path = home.join(".wakaclock/broker.json");
    timeout(Duration::from_secs(5), async {
        loop {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(discovery) = serde_json::from_str::<BrokerDiscovery>(&content) {
                    if discovery.pid != old_pid {
                        return discovery;
                    }
                }
            }
            sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .expect("new broker discovery timeout")
}

async fn wait_until_processing(db: &Path) {
    timeout(Duration::from_secs(5), async {
        loop {
            if let Ok(stats) = BrokerStore::open_at(db).and_then(|store| store.stats()) {
                if stats.processing == 1 {
                    return;
                }
            }
            sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .expect("broker did not claim event")
}

async fn post_event(discovery: &BrokerDiscovery, event: &BrokerEventV1, home: &Path) {
    let token = fs::read_to_string(home.join(".wakaclock/broker.token")).unwrap();
    let response = reqwest::Client::new()
        .post(format!("{}/v1/events", discovery.endpoint))
        .bearer_auth(token.trim())
        .json(event)
        .send()
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::ACCEPTED);
}

async fn holding_server() -> (String, JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        loop {
            let accepted = listener.accept().await;
            let Ok((stream, _)) = accepted else { break };
            tokio::spawn(hold_connection(stream));
        }
    });
    (format!("http://{address}"), task)
}

async fn hold_connection(mut stream: TcpStream) {
    let mut buffer = [0_u8; 4096];
    loop {
        match stream.read(&mut buffer).await {
            Ok(0) | Err(_) => return,
            Ok(_) => {}
        }
    }
}

fn expire_lease(db: &Path) {
    let connection = Connection::open(db).unwrap();
    connection
        .execute(
            "UPDATE broker_events SET lease_until = 0 WHERE event_id = 'process-restart'",
            [],
        )
        .unwrap();
}

fn attempt_count(db: &Path) -> i64 {
    let connection = Connection::open(db).unwrap();
    connection
        .query_row(
            "SELECT attempt_count FROM broker_events WHERE event_id = 'process-restart'",
            [],
            |row| row.get(0),
        )
        .unwrap()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn broker_restart_reclaims_processing_lease_without_duplicate_inbox_row() {
    let home = temp_home("restart");
    let db = home.join(".wakaclock/broker.db");
    let (server_url, server_task) = holding_server().await;
    let mut first = spawn_broker(&home, &server_url);
    let discovery = wait_for_discovery(&home).await;
    let input = event("process-restart");
    post_event(&discovery, &input, &home).await;
    wait_until_processing(&db).await;

    first.kill();
    expire_lease(&db);

    let mut second = spawn_broker(&home, &server_url);
    let second_discovery = wait_for_new_discovery(&home, discovery.pid).await;
    assert_ne!(discovery.pid, second_discovery.pid);
    timeout(Duration::from_secs(5), async {
        loop {
            if attempt_count(&db) >= 2 {
                return;
            }
            sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .expect("restarted broker did not reclaim the lease");

    let store = BrokerStore::open_at(&db).unwrap();
    let stats = store.stats().unwrap();
    assert_eq!(stats.processing, 1);
    assert_eq!(
        stats.pending + stats.processing + stats.retry + stats.processed + stats.dead_letter,
        1
    );
    assert_eq!(input.heartbeat_id(), "broker:process-restart");

    second.kill();
    server_task.abort();
    let _ = server_task.await;
    let _ = fs::remove_dir_all(&home);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn broker_process_exits_cleanly_when_stopped_and_removes_owned_discovery() {
    let home = temp_home("shutdown");
    let (server_url, server_task) = holding_server().await;
    let mut broker = spawn_broker(&home, &server_url);
    let _ = wait_for_discovery(&home).await;
    broker.terminate();

    timeout(Duration::from_secs(2), async {
        loop {
            match fs::metadata(home.join(".wakaclock/broker.json")) {
                Ok(_) => sleep(Duration::from_millis(20)).await,
                Err(error) if error.kind() == ErrorKind::NotFound => return,
                Err(error) => panic!("unexpected discovery error: {error}"),
            }
        }
    })
    .await
    .expect("broker discovery was not cleaned up");

    server_task.abort();
    let _ = server_task.await;
    let _ = fs::remove_dir_all(&home);
}

// ---------------------------------------------------------------------------
// planai2.md Phase 0 acceptance (p0.A1, p0.A3, p0.A4)
// ---------------------------------------------------------------------------

/// A server that reads the request and always replies with a fixed status line.
/// Used to drive the broker's delivery path through a real non-2xx (e.g. 402).
async fn status_server(status_line: &'static str) -> (String, JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let task = tokio::spawn(async move {
        loop {
            let Ok((mut stream, _)) = listener.accept().await else {
                break;
            };
            tokio::spawn(async move {
                let mut buffer = [0_u8; 4096];
                let _ = stream.read(&mut buffer).await;
                let body = "{\"error\":\"trial expired or subscription inactive\"}";
                let response = format!(
                    "HTTP/1.1 {status_line}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = stream.write_all(response.as_bytes()).await;
                let _ = stream.flush().await;
            });
        }
    });
    (format!("http://{address}"), task)
}

fn total_rows(db: &Path) -> u64 {
    let stats = BrokerStore::open_at(db).unwrap().stats().unwrap();
    stats.pending + stats.processing + stats.processed + stats.retry + stats.dead_letter
}

fn write_codex_transcript(home: &Path) -> PathBuf {
    let root = home.join(".codex/sessions/2026/09/02");
    fs::create_dir_all(&root).unwrap();
    let path = root.join("rollout-auto-scan.jsonl");
    let fixture_root =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../wakaclock-core/src/ai/fixtures/codex");
    let mut file = fs::File::create(&path).unwrap();
    for name in [
        "session_meta.json",
        "turn_context.json",
        "custom_tool_call.json",
        "custom_tool_call_output.json",
    ] {
        let value: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(fixture_root.join(name)).unwrap()).unwrap();
        writeln!(file, "{}", serde_json::to_string(&value).unwrap()).unwrap();
    }
    path
}

async fn wait_for_codex_sidecar(home: &Path, minimum: usize) {
    let sidecar = home.join(".wakaclock/ai-events.jsonl");
    timeout(Duration::from_secs(10), async {
        loop {
            let count = fs::read_to_string(&sidecar)
                .ok()
                .map(|content| {
                    content
                        .lines()
                        .filter_map(|line| serde_json::from_str::<serde_json::Value>(line).ok())
                        .filter(|value| {
                            value.get("agent").and_then(|v| v.as_str()) == Some("codex")
                        })
                        .count()
                })
                .unwrap_or_default();
            if count >= minimum {
                return;
            }
            sleep(Duration::from_millis(50)).await;
        }
    })
    .await
    .expect("broker did not auto-scan the Codex transcript");
}

/// Phase 0.4/0.5 — the always-on broker starts transcript recovery itself.  A
/// fresh Codex JSONL file is placed in the isolated HOME before the broker starts;
/// no `wakaclock ai sync` child process is invoked by this test.  The 402 backend
/// keeps the check local and proves capture survives delivery refusal.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn broker_autostarts_codex_transcript_scan_without_manual_sync() {
    let home = temp_home("auto-scan");
    let db = home.join(".wakaclock/broker.db");
    let _transcript = write_codex_transcript(&home);
    let (server_url, server_task) = status_server("402 Payment Required").await;
    let mut broker = spawn_broker(&home, &server_url);
    let _discovery = wait_for_discovery(&home).await;

    wait_for_codex_sidecar(&home, 2).await;
    let stats = timeout(Duration::from_secs(5), async {
        loop {
            let stats = BrokerStore::open_at(&db).unwrap().stats().unwrap();
            if stats.processed >= 2 {
                return stats;
            }
            sleep(Duration::from_millis(50)).await;
        }
    })
    .await
    .expect("auto-scan events were not processed");
    assert!(
        stats.processed >= 2,
        "auto-scan events were not processed: {stats:?}"
    );
    assert_eq!(stats.dead_letter, 0);
    assert_eq!(stats.retry, 0);

    broker.kill();
    server_task.abort();
    let _ = server_task.await;
    let _ = fs::remove_dir_all(&home);
}

/// Post to the broker's own HTTP endpoint, tolerating the dedup responses (200 for
/// a duplicate, 409 for a same-id/different-payload conflict) as well as 202.
async fn post_event_lenient(discovery: &BrokerDiscovery, event: &BrokerEventV1, home: &Path) {
    let token = fs::read_to_string(home.join(".wakaclock/broker.token")).unwrap();
    let response = reqwest::Client::new()
        .post(format!("{}/v1/events", discovery.endpoint))
        .bearer_auth(token.trim())
        .json(event)
        .send()
        .await
        .unwrap();
    assert!(
        matches!(
            response.status(),
            StatusCode::ACCEPTED | StatusCode::OK | StatusCode::CONFLICT
        ),
        "unexpected broker ingest status: {}",
        response.status()
    );
}

/// p0.A1 — one Codex-style `apply_patch` event reaches the local broker exactly
/// once, and re-posting the same `event_id` does not create a second inbox row.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn p0_a1_one_apply_patch_event_is_captured_exactly_once() {
    let home = temp_home("p0a1");
    let db = home.join(".wakaclock/broker.db");
    let (server_url, server_task) = holding_server().await;
    let mut broker = spawn_broker(&home, &server_url);
    let discovery = wait_for_discovery(&home).await;

    let input = event("codex-apply-patch-1");
    post_event_lenient(&discovery, &input, &home).await;
    post_event_lenient(&discovery, &input, &home).await; // duplicate delivery from the hook

    timeout(Duration::from_secs(5), async {
        loop {
            if total_rows(&db) >= 1 {
                return;
            }
            sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .expect("event never landed in the broker inbox");

    // A moment for a (wrongly) duplicated row to show up, if it were going to.
    sleep(Duration::from_millis(300)).await;
    assert_eq!(
        total_rows(&db),
        1,
        "duplicate event_id created a second inbox row"
    );

    broker.kill();
    server_task.abort();
    let _ = server_task.await;
    let _ = fs::remove_dir_all(&home);
}

/// p0.A3 — with the backend returning HTTP 402, local capture is unaffected: the
/// correlation sidecar is written, the heartbeat is durably queued for later
/// delivery, the refusal is recorded (so it reads as an entitlement problem, not
/// a detection failure), and nothing is dead-lettered or lost.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn p0_a3_offline_402_keeps_the_event_captured_locally() {
    let home = temp_home("p0a3");
    let db = home.join(".wakaclock/broker.db");
    let (server_url, server_task) = status_server("402 Payment Required").await;
    let mut broker = spawn_broker(&home, &server_url);
    let discovery = wait_for_discovery(&home).await;

    let input = event("codex-402");
    post_event_lenient(&discovery, &input, &home).await;

    let failure_file = home.join(".wakaclock/last-delivery-failure.json");
    timeout(Duration::from_secs(8), async {
        loop {
            // The broker claimed and processed the event, and the client recorded
            // the 402 rather than dropping the work.
            if failure_file.exists() {
                return;
            }
            sleep(Duration::from_millis(50)).await;
        }
    })
    .await
    .expect("402 was not recorded as a delivery failure");

    let recorded = fs::read_to_string(&failure_file).unwrap();
    assert!(
        recorded.contains("402"),
        "recorded failure should name the 402"
    );
    assert!(
        home.join(".wakaclock/ai-events.jsonl").exists(),
        "correlation sidecar is written even when delivery fails"
    );
    assert!(
        home.join(".wakaclock/queue.db").exists(),
        "the heartbeat is durably queued for later delivery"
    );

    let stats = BrokerStore::open_at(&db).unwrap().stats().unwrap();
    assert_eq!(stats.dead_letter, 0, "a 402 must not dead-letter the event");
    assert_eq!(total_rows(&db), 1, "the event is still tracked, not lost");

    broker.kill();
    server_task.abort();
    let _ = server_task.await;
    let _ = fs::remove_dir_all(&home);
}

/// p0.A4 — `wakaclock doctor ai --json` alone surfaces each pipeline gap: a
/// service manifest on the legacy alias, and a recorded 402 classified as
/// `payment_402` rather than an auth or network failure.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn p0_a4_doctor_ai_identifies_pipeline_gaps() {
    let home = temp_home("p0a4");
    let launch_agents = home.join("Library/LaunchAgents");
    fs::create_dir_all(&launch_agents).unwrap();
    // A legacy-alias manifest (the shape an old CLI wrote).
    fs::write(
        launch_agents.join("com.atoaxis.wakaclock.agent.plist"),
        "<plist version=\"1.0\"><dict>\n  <key>ProgramArguments</key><array><string>/usr/local/bin/wakaclock</string><string>agent</string><string>run</string></array>\n</dict></plist>\n",
    )
    .unwrap();
    fs::create_dir_all(home.join(".wakaclock")).unwrap();
    fs::write(
        home.join(".wakaclock/last-delivery-failure.json"),
        "{\"at\":1788000000.0,\"message\":\"HTTP status 402: {\\\"error\\\":\\\"trial expired\\\"}\"}",
    )
    .unwrap();

    let binary = env!("CARGO_BIN_EXE_wakaclock");
    let output = Command::new(binary)
        .args(["doctor", "ai", "--json"])
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
