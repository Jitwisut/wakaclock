//! Offline-reliability Phase 00 — CLI lifecycle regression harness.
//!
//! Every scenario runs the real `wakaclock` binary as a child process with a
//! disposable `HOME` and a cleared environment, against an in-process mock API on
//! `127.0.0.1`. Nothing here touches the user's `~/.wakaclock`, a real API key or
//! the public network. Assertions read queue *metadata* only (row count, scope,
//! heartbeat id, retry/lease state) — never payload content beyond identity/time.
//!
//! Tests marked `#[ignore = "OFF-.. baseline: ..."]` state the target contract from
//! `plans/offline-reliability/` and fail on the pre-fix code. Run them with
//! `WAKACLOCK_OFFLINE_BASELINE=1 cargo test -p wakaclock-cli --test offline_lifecycle
//! -- --include-ignored`.
//! The phase that fixes a bug removes its attribute; never weaken the assertion.

use fs2::FileExt;
use rusqlite::Connection;
use serde_json::Value;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::Stdio,
    sync::Arc,
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::Mutex,
    task::JoinHandle,
    time::timeout,
};

const CLI_TIMEOUT: Duration = Duration::from_secs(60);

// Fixture credentials. They are not real keys and are only ever sent to the
// in-process mock server.
const KEY_A: &str = "fixture-key-account-1-old";
const KEY_B: &str = "fixture-key-account-1-rotated";
const KEY_C: &str = "fixture-key-account-2";

// ---------------------------------------------------------------------------
// Disposable home
// ---------------------------------------------------------------------------

struct TempHome(PathBuf);

impl TempHome {
    fn new(name: &str) -> Self {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "wakaclock-offline-lifecycle-{name}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(path.join("workspace")).unwrap();
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }

    fn queue_db(&self) -> PathBuf {
        self.0.join(".wakaclock/queue.db")
    }

    fn entity(&self, name: &str) -> String {
        self.0
            .join("workspace")
            .join(format!("{name}.rs"))
            .display()
            .to_string()
    }
}

impl Drop for TempHome {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

// ---------------------------------------------------------------------------
// Mock API
// ---------------------------------------------------------------------------

#[derive(Clone, Copy, Debug)]
enum Reply {
    Ok,
    Status(u16),
    StatusRetryAfter(u16, u64),
}

#[derive(Clone, Debug)]
struct ReceivedHeartbeat {
    bearer: String,
    heartbeat_id: String,
    time: Option<f64>,
}

struct MockState {
    /// `false` accepts the TCP connection and closes it without a response: a
    /// genuine transport failure with no HTTP status.
    online: bool,
    reject_id: Option<String>,
    accept_drop_once: bool,
    response_delay_ms: u64,
    heartbeats: Reply,
    today: Reply,
    /// bearer → opaque account id. An unknown bearer receives 401.
    accounts: HashMap<String, String>,
    received: Vec<ReceivedHeartbeat>,
    heartbeat_requests: usize,
    bulk_heartbeat_requests: usize,
}

struct MockApi {
    url: String,
    state: Arc<Mutex<MockState>>,
    task: JoinHandle<()>,
}

impl MockApi {
    async fn start(accounts: &[(&str, &str)]) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let state = Arc::new(Mutex::new(MockState {
            online: true,
            reject_id: None,
            accept_drop_once: false,
            response_delay_ms: 0,
            heartbeats: Reply::Ok,
            today: Reply::Ok,
            accounts: accounts
                .iter()
                .map(|(key, account)| (key.to_string(), account.to_string()))
                .collect(),
            received: Vec::new(),
            heartbeat_requests: 0,
            bulk_heartbeat_requests: 0,
        }));
        let shared = state.clone();
        let task = tokio::spawn(async move {
            while let Ok((stream, _)) = listener.accept().await {
                let state = shared.clone();
                tokio::spawn(async move {
                    let _ = timeout(Duration::from_secs(10), serve(stream, state)).await;
                });
            }
        });
        Self { url, state, task }
    }

    async fn set_online(&self, online: bool) {
        self.state.lock().await.online = online;
    }

    async fn set_heartbeats(&self, reply: Reply) {
        self.state.lock().await.heartbeats = reply;
    }

    async fn set_today(&self, reply: Reply) {
        self.state.lock().await.today = reply;
    }

    async fn received(&self) -> Vec<ReceivedHeartbeat> {
        self.state.lock().await.received.clone()
    }

    async fn received_ids(&self) -> Vec<String> {
        let mut ids: Vec<String> = self
            .received()
            .await
            .into_iter()
            .map(|heartbeat| heartbeat.heartbeat_id)
            .collect();
        ids.sort();
        ids
    }

    async fn heartbeat_request_counts(&self) -> (usize, usize) {
        let state = self.state.lock().await;
        (state.heartbeat_requests, state.bulk_heartbeat_requests)
    }
}

impl Drop for MockApi {
    fn drop(&mut self) {
        self.task.abort();
    }
}

async fn serve(mut stream: TcpStream, state: Arc<Mutex<MockState>>) {
    if !state.lock().await.online {
        drop(stream);
        return;
    }

    let mut buffer = Vec::new();
    let mut chunk = [0_u8; 8192];
    let header_end = loop {
        let Ok(read) = stream.read(&mut chunk).await else {
            return;
        };
        if read == 0 {
            return;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if let Some(position) = find(&buffer, b"\r\n\r\n") {
            break position + 4;
        }
    };
    let head = String::from_utf8_lossy(&buffer[..header_end]).to_string();
    let mut lines = head.split("\r\n");
    let request_line = lines.next().unwrap_or_default().to_string();
    let mut headers = HashMap::new();
    for line in lines {
        if let Some((name, value)) = line.split_once(':') {
            headers.insert(name.trim().to_ascii_lowercase(), value.trim().to_string());
        }
    }
    let length = headers
        .get("content-length")
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);
    while buffer.len() < header_end + length {
        let Ok(read) = stream.read(&mut chunk).await else {
            return;
        };
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
    }
    let body = &buffer[header_end..buffer.len().min(header_end + length)];

    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or_default().to_string();
    let path = parts
        .next()
        .unwrap_or_default()
        .split('?')
        .next()
        .unwrap_or_default()
        .to_string();
    let bearer = headers
        .get("authorization")
        .and_then(|value| value.strip_prefix("Bearer "))
        .unwrap_or_default()
        .to_string();

    let (status, retry_after, body) = {
        let mut state = state.lock().await;
        let account = state.accounts.get(&bearer).cloned();
        match (method.as_str(), path.as_str(), account) {
            ("GET", "/api/v2/capabilities", _) => (200,None,serde_json::json!({"data":{"capture_activity_versions":[2],"capture_status_supported":true,"delivery_snapshot_versions":[1,2]}}).to_string()),
            (_, _, None) => (401, None, r#"{"error":"invalid api key"}"#.to_string()),
            ("GET", "/api/v1/status_bar/today", Some(account)) => match state.today {
                Reply::Ok => (
                    200,
                    None,
                    serde_json::json!({
                        "total_seconds": 0.0,
                        "human_readable": "0s",
                        "heartbeat_count": 0,
                        // Same shape as the server: an opaque SHA-256 hex digest per
                        // account, the only valid same-account proof for a rebind.
                        "queue_owner_id": owner_digest(&account),
                    })
                    .to_string(),
                ),
                reply => error_reply(reply),
            },
            ("POST", "/api/v1/heartbeats" | "/api/v1/heartbeats.bulk", Some(_)) => {
                state.heartbeat_requests += 1;
                if path == "/api/v1/heartbeats.bulk" {
                    state.bulk_heartbeat_requests += 1;
                }
                match state.heartbeats {
                    Reply::Ok => {
                        let parsed: Value = serde_json::from_slice(body).unwrap_or(Value::Null);
                        let items = match parsed {
                            Value::Array(items) => items,
                            other => vec![other],
                        };
                        if state.reject_id.as_ref().is_some_and(|id| {
                            items.iter().any(|item| {
                                item.get("heartbeat_id").and_then(Value::as_str)
                                    == Some(id.as_str())
                            })
                        }) {
                            (422, None, "{\"error\":\"fixture invalid row\"}".to_string())
                        } else {
                            for item in items {
                                state.received.push(ReceivedHeartbeat {
                                    bearer: bearer.clone(),
                                    heartbeat_id: item
                                        .get("heartbeat_id")
                                        .and_then(Value::as_str)
                                        .unwrap_or_default()
                                        .to_string(),
                                    time: item.get("time").and_then(Value::as_f64),
                                });
                            }
                            if state.accept_drop_once {
                                state.accept_drop_once = false;
                                (0, None, String::new())
                            } else {
                                (201, None, "{}".to_string())
                            }
                        }
                    }
                    reply => error_reply(reply),
                }
            }
            _ => (404, None, r#"{"error":"not found"}"#.to_string()),
        }
    };

    if status == 0 {
        return;
    }
    let delay = state.lock().await.response_delay_ms;
    if path.starts_with("/api/v1/heartbeats") && delay > 0 {
        tokio::time::sleep(Duration::from_millis(delay)).await;
    }

    let reason = match status {
        200 => "OK",
        201 => "Created",
        401 => "Unauthorized",
        402 => "Payment Required",
        404 => "Not Found",
        429 => "Too Many Requests",
        503 => "Service Unavailable",
        _ => "Status",
    };
    let retry_after = retry_after
        .map(|seconds| format!("retry-after: {seconds}\r\n"))
        .unwrap_or_default();
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\ncontent-type: application/json\r\n{retry_after}content-length: {}\r\nconnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.flush().await;
}

fn error_reply(reply: Reply) -> (u16, Option<u64>, String) {
    match reply {
        Reply::Ok => unreachable!(),
        Reply::Status(402) => (
            402,
            None,
            r#"{"error":"trial expired or subscription inactive"}"#.to_string(),
        ),
        Reply::Status(status) => (status, None, r#"{"error":"fixture"}"#.to_string()),
        Reply::StatusRetryAfter(status, seconds) => {
            (status, Some(seconds), r#"{"error":"fixture"}"#.to_string())
        }
    }
}

fn owner_digest(account: &str) -> String {
    use sha2::{Digest, Sha256};
    Sha256::digest(format!("fixture-owner:{account}").as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

/// A port with nothing listening: connection refused, no HTTP response.
async fn dead_origin() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    drop(listener);
    format!("http://{address}")
}

// ---------------------------------------------------------------------------
// CLI invocation
// ---------------------------------------------------------------------------

struct CliRun {
    success: bool,
    stdout: String,
    stderr: String,
}

impl CliRun {
    fn json(&self) -> Value {
        serde_json::from_str(self.stdout.trim()).unwrap_or_else(|error| {
            panic!(
                "expected JSON on stdout ({error}); success={} stdout={:?} stderr={:?}",
                self.success, self.stdout, self.stderr
            )
        })
    }

    fn describe(&self) -> String {
        format!(
            "success={} stdout={} stderr={}",
            self.success,
            self.stdout.trim(),
            self.stderr.trim()
        )
    }
}

async fn cli(home: &TempHome, server_url: &str, api_key: &str, args: &[&str]) -> CliRun {
    cli_with_input(home, server_url, api_key, args, None).await
}
async fn cli_with_input(
    home: &TempHome,
    server_url: &str,
    api_key: &str,
    args: &[&str],
    input: Option<&str>,
) -> CliRun {
    let mut command = tokio::process::Command::new(env!("CARGO_BIN_EXE_wakaclock"));
    command
        .args(args)
        .env_clear()
        .env("PATH", std::env::var_os("PATH").unwrap_or_default())
        .env("HOME", home.path())
        .env("USERPROFILE", home.path())
        .env("TMPDIR", std::env::temp_dir())
        .env("WAKACLOCK_SERVER_URL", server_url)
        .env("WAKACLOCK_API_KEY", api_key)
        .env("WAKACLOCK_RECOVERY_PROBE", "1")
        .current_dir(home.path())
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    let mut child = command.spawn().expect("failed to spawn wakaclock");
    if let Some(input) = input {
        let mut stdin = child.stdin.take().unwrap();
        stdin.write_all(input.as_bytes()).await.unwrap();
        drop(stdin);
    }
    let output = timeout(CLI_TIMEOUT, child.wait_with_output())
        .await
        .unwrap_or_else(|_| panic!("wakaclock {args:?} did not finish within {CLI_TIMEOUT:?}"))
        .expect("failed to spawn wakaclock");
    CliRun {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    }
}

fn now() -> f64 {
    chrono::Utc::now().timestamp_millis() as f64 / 1000.0
}

/// Send one human heartbeat with a stable id and original timestamp.
async fn heartbeat(
    home: &TempHome,
    server_url: &str,
    api_key: &str,
    heartbeat_id: &str,
    time: f64,
) -> CliRun {
    let entity = home.entity(heartbeat_id);
    let time = format!("{time:.3}");
    cli(
        home,
        server_url,
        api_key,
        &[
            "heartbeat",
            "--entity",
            &entity,
            "--time",
            &time,
            "--heartbeat-id",
            heartbeat_id,
            "--active-seconds",
            "30",
            "--json",
        ],
    )
    .await
}

async fn today_json(home: &TempHome, server_url: &str, api_key: &str) -> CliRun {
    cli(
        home,
        server_url,
        api_key,
        &["today", "--timezone", "UTC", "--json"],
    )
    .await
}

fn assert_queued(run: &CliRun, expected: u64) {
    assert!(run.success, "heartbeat command failed: {}", run.describe());
    assert_eq!(
        run.json()["queued"].as_u64(),
        Some(expected),
        "{}",
        run.describe()
    );
}

// ---------------------------------------------------------------------------
// Queue inspection (metadata only)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
struct QueueRowMeta {
    heartbeat_id: Option<String>,
    destination: String,
    owner_scope: String,
    retry_count: i64,
    created_at: i64,
    next_retry_at: i64,
    leased: bool,
}

fn queue_rows(home: &TempHome) -> Vec<QueueRowMeta> {
    let path = home.queue_db();
    if !path.exists() {
        return Vec::new();
    }
    let connection = Connection::open(path).unwrap();
    let mut statement = connection
        .prepare(
            "SELECT heartbeat_id, destination, owner_scope, retry_count, created_at,
                    next_retry_at, lease_owner
             FROM heartbeat_queue ORDER BY id",
        )
        .unwrap();
    let rows = statement
        .query_map([], |row| {
            Ok(QueueRowMeta {
                heartbeat_id: row.get(0)?,
                destination: row.get(1)?,
                owner_scope: row.get(2)?,
                retry_count: row.get(3)?,
                created_at: row.get(4)?,
                next_retry_at: row.get(5)?,
                leased: row.get::<_, Option<String>>(6)?.is_some(),
            })
        })
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    rows
}

/// (kind, http_status) per scope in the queue's delivery-state table.
fn delivery_state(home: &TempHome) -> Vec<(String, Option<i64>)> {
    let path = home.queue_db();
    if !path.exists() {
        return Vec::new();
    }
    let connection = Connection::open(path).unwrap();
    let mut statement = connection
        .prepare("SELECT kind, http_status FROM delivery_state ORDER BY destination, owner_scope")
        .unwrap();
    let rows = statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    rows
}

fn sorted(ids: &[&str]) -> Vec<String> {
    let mut ids: Vec<String> = ids.iter().map(|id| id.to_string()).collect();
    ids.sort();
    ids
}

// ---------------------------------------------------------------------------
// OFF-01 / OFF-02 — structured offline status (Phase 01 contract)
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn network_failure_is_not_reported_as_subscription_required() {
    let home = TempHome::new("network-not-subscription");
    let origin = dead_origin().await;

    let sent = heartbeat(&home, &origin, KEY_A, "hb-offline-1", now() - 5.0).await;
    assert_queued(&sent, 1);
    let rows = queue_rows(&home);
    assert_eq!(rows.len(), 1, "a network failure must be durably queued");

    let today = today_json(&home, &origin, KEY_A).await;
    assert!(today.success, "{}", today.describe());
    let json = today.json();
    assert_eq!(
        json["connection"]["state"],
        "offline",
        "{}",
        today.describe()
    );
    assert_eq!(
        json["connection"]["last_error_kind"],
        "network",
        "{}",
        today.describe()
    );
    assert_ne!(json["connection"]["state"], "subscription_required");

    let text = cli(&home, &origin, KEY_A, &["today", "--timezone", "UTC"]).await;
    assert!(
        !text.stdout.contains("REFUSED"),
        "a transport failure is not a server refusal: {}",
        text.describe()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn offline_today_with_an_empty_queue_is_not_verified() {
    let home = TempHome::new("offline-empty");
    let origin = dead_origin().await;

    let today = today_json(&home, &origin, KEY_A).await;
    assert!(today.success, "{}", today.describe());
    let json = today.json();
    assert_eq!(json["queued_heartbeats"], 0, "{}", today.describe());
    assert_eq!(
        json["connection"]["state"],
        "offline",
        "an unreachable server with an empty queue must still read as offline: {}",
        today.describe()
    );
    assert_eq!(json["connection"]["reachable"], false);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn offline_today_reports_scoped_queue_depth_and_seconds() {
    let home = TempHome::new("offline-depth");
    let origin = dead_origin().await;
    let t = now();

    // One row for a different key first: it must not be counted for KEY_A.
    assert_queued(
        &heartbeat(&home, &origin, KEY_C, "hb-other-1", t - 4.0).await,
        1,
    );
    assert_queued(
        &heartbeat(&home, &origin, KEY_A, "hb-mine-1", t - 3.0).await,
        1,
    );
    assert_queued(
        &heartbeat(&home, &origin, KEY_A, "hb-mine-2", t - 2.0).await,
        1,
    );
    assert_eq!(queue_rows(&home).len(), 3);

    let today = today_json(&home, &origin, KEY_A).await;
    assert!(today.success, "{}", today.describe());
    let json = today.json();
    // Legacy top-level fields stay (Phase 01 is additive).
    assert_eq!(json["queued_heartbeats"], 2, "{}", today.describe());
    assert_eq!(
        json["connection"]["state"],
        "offline",
        "{}",
        today.describe()
    );
    assert_eq!(json["queue"]["depth"], 2, "{}", today.describe());
    let seconds_today = json["queue"]["seconds_today"].as_f64().unwrap_or(-1.0);
    assert!(seconds_today > 0.0, "{}", today.describe());
    assert_eq!(
        json["queue"]["seconds_today"],
        json["queued_seconds"],
        "structured and legacy queued seconds must agree: {}",
        today.describe()
    );
}

// ---------------------------------------------------------------------------
// HTTP status contracts
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn http_401_reports_auth_rejected_not_offline() {
    let home = TempHome::new("http-401");
    // KEY_A is unknown to this server, so every request gets 401.
    let api = MockApi::start(&[]).await;

    let today = today_json(&home, &api.url, KEY_A).await;
    assert!(today.success, "{}", today.describe());
    let json = today.json();
    assert_eq!(
        json["connection"]["state"],
        "auth_rejected",
        "{}",
        today.describe()
    );
    assert_eq!(json["connection"]["reachable"], true);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn http_402_keeps_rows_queued_and_reports_subscription_required() {
    let home = TempHome::new("http-402");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    api.set_heartbeats(Reply::Status(402)).await;

    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-402-1", now() - 3.0).await,
        1,
    );
    assert_eq!(
        queue_rows(&home).len(),
        1,
        "402 must keep the only durable copy"
    );

    let today = today_json(&home, &api.url, KEY_A).await;
    assert!(today.success, "{}", today.describe());
    let json = today.json();
    assert_eq!(
        json["connection"]["state"],
        "subscription_required",
        "{}",
        today.describe()
    );
    assert_eq!(json["queue"]["depth"], 1, "{}", today.describe());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn http_403_retains_heartbeat_and_permission_diagnostics_after_successful_read() {
    let home = TempHome::new("http-403");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    api.set_heartbeats(Reply::Status(403)).await;
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-403", now() - 3.0).await,
        1,
    );
    let status = today_json(&home, &api.url, KEY_A).await;
    assert!(status.success, "{}", status.describe());
    assert_eq!(queue_rows(&home).len(), 1);
    let db = Connection::open(home.queue_db()).unwrap();
    let (kind, http): (String, i64) = db
        .query_row(
            "SELECT failure_kind,failure_http_status FROM heartbeat_queue",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(kind, "auth_401");
    assert_eq!(http, 403);
    assert!(!delivery_state(&home).is_empty());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn http_503_keeps_rows_queued_and_reports_retryable_server_error() {
    let home = TempHome::new("http-503");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    api.set_heartbeats(Reply::Status(503)).await;
    api.set_today(Reply::Status(503)).await;

    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-503-1", now() - 3.0).await,
        1,
    );
    assert_eq!(queue_rows(&home).len(), 1);

    let today = today_json(&home, &api.url, KEY_A).await;
    assert!(today.success, "{}", today.describe());
    let json = today.json();
    assert_eq!(
        json["connection"]["state"],
        "retryable_server_error",
        "{}",
        today.describe()
    );
    assert_eq!(json["connection"]["reachable"], true);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn http_429_retry_after_is_respected_by_a_queue_flush() {
    let home = TempHome::new("http-429");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    let origin_down = api.url.clone();

    api.set_online(false).await;
    assert_queued(
        &heartbeat(&home, &origin_down, KEY_A, "hb-429-1", now() - 3.0).await,
        1,
    );

    api.set_online(true).await;
    api.set_heartbeats(Reply::StatusRetryAfter(429, 120)).await;
    let status = cli(&home, &api.url, KEY_A, &["status", "--json"]).await;
    assert!(status.success, "{}", status.describe());

    let rows = queue_rows(&home);
    assert_eq!(rows.len(), 1, "429 must keep the row: {rows:?}");
    assert_eq!(rows[0].heartbeat_id.as_deref(), Some("hb-429-1"));
    assert_eq!(rows[0].retry_count, 1);
    assert!(!rows[0].leased);
    // Both sides of the comparison come from the queue's own clock, so the bound
    // does not depend on when this test runs.
    assert!(
        rows[0].next_retry_at - rows[0].created_at >= 120,
        "Retry-After must delay the row by at least 120s: {rows:?}"
    );
    assert!(api.received().await.is_empty());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn http_429_retry_after_is_respected_for_a_newly_queued_row() {
    let home = TempHome::new("http-429-send");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    api.set_heartbeats(Reply::StatusRetryAfter(429, 120)).await;

    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-429-send", now() - 3.0).await,
        1,
    );
    let rows = queue_rows(&home);
    assert_eq!(rows.len(), 1);
    assert!(
        rows[0].next_retry_at - rows[0].created_at >= 120,
        "Retry-After must delay the row by at least 120s: {rows:?}"
    );
}

// ---------------------------------------------------------------------------
// Reconnect, key rotation and origin change (Phase 02 contract)
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn reconnect_with_the_same_key_drains_each_row_exactly_once() {
    let home = TempHome::new("reconnect-same-key");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    let t = now();

    api.set_online(false).await;
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-rc-1", t - 4.0).await,
        1,
    );
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-rc-2", t - 3.0).await,
        1,
    );

    api.set_online(true).await;
    for _ in 0..2 {
        let status = cli(&home, &api.url, KEY_A, &["status", "--json"]).await;
        assert!(status.success, "{}", status.describe());
    }
    let sent = heartbeat(&home, &api.url, KEY_A, "hb-rc-3", t - 1.0).await;
    assert!(sent.success, "{}", sent.describe());

    assert_eq!(
        api.received_ids().await,
        sorted(&["hb-rc-1", "hb-rc-2", "hb-rc-3"])
    );
    let received = api.received().await;
    let original = |id: &str| received.iter().find(|h| h.heartbeat_id == id).unwrap().time;
    assert_eq!(
        original("hb-rc-1"),
        Some((((t - 4.0) * 1000.0).round()) / 1000.0)
    );
    assert_eq!(
        original("hb-rc-2"),
        Some((((t - 3.0) * 1000.0).round()) / 1000.0)
    );
    assert!(queue_rows(&home).is_empty());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn recovered_offline_rows_flush_in_one_bounded_bulk_request() {
    let home = TempHome::new("bulk-recovery");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    let t = now();

    api.set_online(false).await;
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-bulk-1", t - 2.0).await,
        1,
    );
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-bulk-2", t - 1.0).await,
        1,
    );

    let before = api.heartbeat_request_counts().await;
    api.set_online(true).await;
    let status = cli(&home, &api.url, KEY_A, &["status", "--json"]).await;
    assert!(status.success, "{}", status.describe());
    let after = api.heartbeat_request_counts().await;

    assert_eq!(after.0 - before.0, 1, "flush should make one HTTP request");
    assert_eq!(after.1 - before.1, 1, "flush should use the bulk endpoint");
    assert_eq!(
        api.received_ids().await,
        sorted(&["hb-bulk-1", "hb-bulk-2"])
    );
    assert!(queue_rows(&home).is_empty());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn sync_lock_contention_is_deferred_and_does_not_drain_the_queue() {
    let home = TempHome::new("sync-already-running");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;

    api.set_online(false).await;
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-sync-contended", now() - 1.0).await,
        1,
    );
    api.set_online(true).await;

    let lock_path = home.path().join(".wakaclock/ai-sync.lock");
    fs::create_dir_all(lock_path.parent().unwrap()).unwrap();
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(lock_path)
        .unwrap();
    lock.lock_exclusive().unwrap();

    let sync = cli(
        &home,
        &api.url,
        KEY_A,
        &["sync", "--agent", "codex", "--automatic", "--json"],
    )
    .await;
    assert!(sync.success, "{}", sync.describe());
    let json = sync.json();
    assert_eq!(json["status"], "deferred", "{}", sync.describe());
    assert_eq!(json["deferred"], true, "{}", sync.describe());
    assert_eq!(json["last_error"], "already_running", "{}", sync.describe());
    assert!(api.received_ids().await.is_empty());
    assert_eq!(queue_rows(&home).len(), 1);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn same_account_key_rotation_preserves_and_rebinds_every_row() {
    let home = TempHome::new("rotation-same-account");
    let api = MockApi::start(&[(KEY_A, "account-1"), (KEY_B, "account-1")]).await;
    let t = now();

    // Precondition (Phase 02): KEY_A was used online at least once, so the server's
    // ownership proof for it is recorded. Editors refresh `today` every 15s, so any
    // key that was ever connected has one. Without it see
    // `key_rotation_without_proof_keeps_rows_as_orphaned`.
    let online_a = today_json(&home, &api.url, KEY_A).await;
    assert_eq!(online_a.json()["connection"]["state"], "online");

    api.set_online(false).await;
    for (index, id) in ["hb-rot-1", "hb-rot-2", "hb-rot-3"].iter().enumerate() {
        assert_queued(
            &heartbeat(&home, &api.url, KEY_A, id, t - 10.0 + index as f64).await,
            1,
        );
    }
    assert_eq!(queue_rows(&home).len(), 3);

    // The user rotates to KEY_B while offline, then the server returns. The server
    // reports the same opaque account for both keys — the only acceptable proof.
    api.set_online(true).await;
    let verify = cli(&home, &api.url, KEY_B, &["verify", "--json"]).await;
    assert!(verify.success, "{}", verify.describe());
    let status = cli(&home, &api.url, KEY_B, &["status", "--json"]).await;
    assert!(status.success, "{}", status.describe());
    let sent = heartbeat(&home, &api.url, KEY_B, "hb-rot-new", t - 1.0).await;
    assert!(sent.success, "{}", sent.describe());

    assert_eq!(
        api.received_ids().await,
        sorted(&["hb-rot-1", "hb-rot-2", "hb-rot-3", "hb-rot-new"]),
        "every row queued under the old key must be delivered exactly once; queue={:?}",
        queue_rows(&home)
    );
    for received in api.received().await {
        assert_eq!(received.bearer, KEY_B, "delivery must use the current key");
    }
    let received = api.received().await;
    for (index, id) in ["hb-rot-1", "hb-rot-2", "hb-rot-3"].iter().enumerate() {
        let time = received
            .iter()
            .find(|h| &h.heartbeat_id == id)
            .unwrap()
            .time;
        let expected = (((t - 10.0 + index as f64) * 1000.0).round()) / 1000.0;
        assert_eq!(time, Some(expected), "original timestamp must be preserved");
    }
    assert!(queue_rows(&home).is_empty());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn different_account_key_cannot_claim_existing_rows() {
    let home = TempHome::new("rotation-different-account");
    let api = MockApi::start(&[(KEY_A, "account-1"), (KEY_C, "account-2")]).await;
    let t = now();

    api.set_online(false).await;
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-acct1-1", t - 5.0).await,
        1,
    );
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-acct1-2", t - 4.0).await,
        1,
    );
    let before = queue_rows(&home);

    api.set_online(true).await;
    let verify = cli(&home, &api.url, KEY_C, &["verify", "--json"]).await;
    assert!(verify.success, "{}", verify.describe());
    let status = cli(&home, &api.url, KEY_C, &["status", "--json"]).await;
    assert!(status.success, "{}", status.describe());
    let sent = heartbeat(&home, &api.url, KEY_C, "hb-acct2-1", t - 1.0).await;
    assert!(sent.success, "{}", sent.describe());

    assert_eq!(api.received_ids().await, sorted(&["hb-acct2-1"]));
    let after = queue_rows(&home);
    assert_eq!(after.len(), 2, "foreign rows must never be deleted");
    for (old, new) in before.iter().zip(after.iter()) {
        assert_eq!(old.heartbeat_id, new.heartbeat_id);
        assert_eq!(old.owner_scope, new.owner_scope);
        assert_eq!(old.destination, new.destination);
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn different_origin_cannot_claim_existing_rows() {
    let home = TempHome::new("origin-change");
    let old_origin = dead_origin().await;
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    let t = now();

    assert_queued(
        &heartbeat(&home, &old_origin, KEY_A, "hb-origin-1", t - 5.0).await,
        1,
    );
    assert_queued(
        &heartbeat(&home, &old_origin, KEY_A, "hb-origin-2", t - 4.0).await,
        1,
    );

    let status = cli(&home, &api.url, KEY_A, &["status", "--json"]).await;
    assert!(status.success, "{}", status.describe());
    let sent = heartbeat(&home, &api.url, KEY_A, "hb-origin-new", t - 1.0).await;
    assert!(sent.success, "{}", sent.describe());

    assert_eq!(api.received_ids().await, sorted(&["hb-origin-new"]));
    let rows = queue_rows(&home);
    assert_eq!(rows.len(), 2);
    assert!(rows.iter().all(|row| row.destination == old_origin));
}

// ---------------------------------------------------------------------------
// OFF-04 — delivery failure scoped to origin + owner (Phase 03 contract)
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_stale_failure_from_another_scope_is_ignored() {
    let home = TempHome::new("stale-failure");
    let old_origin = dead_origin().await;
    let api = MockApi::start(&[(KEY_C, "account-2")]).await;

    // Scope 1: old origin + KEY_A records a network failure.
    assert_queued(
        &heartbeat(&home, &old_origin, KEY_A, "hb-stale-1", now() - 3.0).await,
        1,
    );

    // Scope 2: a different origin and account, healthy, with an empty queue.
    let today = today_json(&home, &api.url, KEY_C).await;
    assert!(today.success, "{}", today.describe());
    let json = today.json();
    assert_eq!(json["queued_heartbeats"], 0, "{}", today.describe());
    assert!(
        json["delivery_failure"].is_null(),
        "a failure recorded for another origin/account must not drive this scope: {}",
        today.describe()
    );
    assert_eq!(
        json["connection"]["state"],
        "online",
        "{}",
        today.describe()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn successful_recovery_clears_only_the_matching_scope_failure() {
    let home = TempHome::new("scoped-recovery");
    let refusing = MockApi::start(&[(KEY_A, "account-1")]).await;
    refusing.set_heartbeats(Reply::Status(402)).await;
    let healthy = MockApi::start(&[(KEY_C, "account-2")]).await;

    assert_queued(
        &heartbeat(&home, &refusing.url, KEY_A, "hb-scope-402", now() - 4.0).await,
        1,
    );
    let sent = heartbeat(&home, &healthy.url, KEY_C, "hb-scope-ok", now() - 2.0).await;
    assert!(sent.success, "{}", sent.describe());
    assert_eq!(healthy.received_ids().await, sorted(&["hb-scope-ok"]));

    let today = today_json(&home, &refusing.url, KEY_A).await;
    assert!(today.success, "{}", today.describe());
    let json = today.json();
    assert_eq!(json["queued_heartbeats"], 1, "{}", today.describe());
    assert!(
        !json["delivery_failure"].is_null(),
        "the refusing scope's 402 is unresolved and must stay visible: {}",
        today.describe()
    );
    assert!(
        json["delivery_failure"].to_string().contains("402"),
        "{}",
        today.describe()
    );
}

// ---------------------------------------------------------------------------
// Phase 01 — structured status contract
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn today_json_reports_offline_even_when_queue_is_empty() {
    let home = TempHome::new("p01-offline-empty");
    let origin = dead_origin().await;

    let json = today_json(&home, &origin, KEY_A).await.json();
    assert_eq!(json["connection"]["state"], "offline");
    assert_eq!(json["connection"]["reachable"], false);
    assert!(json["connection"]["authenticated"].is_null());
    assert!(json["connection"]["http_status"].is_null());
    assert_eq!(json["connection"]["last_error_kind"], "network");
    assert_eq!(json["queue"]["depth"], 0);
    assert_eq!(json["queue"]["seconds_today"], 0.0);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn today_json_keeps_legacy_top_level_fields() {
    let home = TempHome::new("p01-legacy-fields");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;

    let today = today_json(&home, &api.url, KEY_A).await;
    let json = today.json();
    for key in [
        "confirmed_seconds",
        "queued_seconds",
        "total_seconds",
        "human_readable",
        "heartbeat_count",
        "last_heartbeat_at",
        "covered_intervals",
        "active_intervals",
        "discarded_seconds",
        "timezone",
        "agent_health",
        "error",
        "queued_heartbeats",
        "queued_active_seconds",
        "delivery_failure",
    ] {
        assert!(
            json.get(key).is_some(),
            "missing legacy key {key}: {}",
            today.describe()
        );
    }
    assert_eq!(json["connection"]["state"], "online");
    assert_eq!(json["connection"]["reachable"], true);
    assert_eq!(json["connection"]["authenticated"], true);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn today_text_reports_offline_and_keeps_the_legacy_auth_exit() {
    let home = TempHome::new("p01-text");
    let origin = dead_origin().await;
    assert_queued(
        &heartbeat(&home, &origin, KEY_A, "hb-text-1", now() - 3.0).await,
        1,
    );

    let text = cli(&home, &origin, KEY_A, &["today", "--timezone", "UTC"]).await;
    assert!(text.success, "{}", text.describe());
    assert!(
        text.stdout.contains("Connection: offline"),
        "{}",
        text.describe()
    );
    assert!(
        text.stdout.contains("Delivery: OFFLINE - "),
        "{}",
        text.describe()
    );
    assert!(!text.stdout.contains("REFUSED"), "{}", text.describe());

    // Older editor builds detect a rejected key from text mode's non-zero exit.
    let rejecting = MockApi::start(&[]).await;
    let auth = cli(
        &home,
        &rejecting.url,
        KEY_A,
        &["today", "--timezone", "UTC"],
    )
    .await;
    assert!(!auth.success, "{}", auth.describe());
    assert!(
        auth.stderr.contains("API key was rejected"),
        "{}",
        auth.describe()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn today_text_still_reports_a_real_402_as_refused() {
    let home = TempHome::new("p01-text-402");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    api.set_heartbeats(Reply::Status(402)).await;
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-text-402", now() - 3.0).await,
        1,
    );

    let text = cli(&home, &api.url, KEY_A, &["today", "--timezone", "UTC"]).await;
    assert!(text.success, "{}", text.describe());
    assert!(
        text.stdout.contains("Connection: subscription_required"),
        "{}",
        text.describe()
    );
    assert!(
        text.stdout.contains("Delivery: REFUSED - HTTP status 402"),
        "{}",
        text.describe()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn verify_json_statuses_are_unchanged() {
    let home = TempHome::new("p01-verify");
    let origin = dead_origin().await;
    let unreachable = cli(&home, &origin, KEY_A, &["verify", "--json"])
        .await
        .json();
    assert_eq!(unreachable["status"], "unreachable");
    assert_eq!(unreachable["reachable"], false);

    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    let verified = cli(&home, &api.url, KEY_A, &["verify", "--json"])
        .await
        .json();
    assert_eq!(verified["status"], "verified");
    let invalid = cli(&home, &api.url, KEY_C, &["verify", "--json"])
        .await
        .json();
    assert_eq!(invalid["status"], "invalid_key");
    assert_eq!(invalid["reachable"], true);

    api.set_today(Reply::Status(402)).await;
    let paying = cli(&home, &api.url, KEY_A, &["verify", "--json"])
        .await
        .json();
    assert_eq!(paying["status"], "subscription_required");
    api.set_today(Reply::Status(503)).await;
    let down = cli(&home, &api.url, KEY_A, &["verify", "--json"])
        .await
        .json();
    assert_eq!(down["status"], "server_error");
    assert_eq!(down["reachable"], true);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_recorded_401_does_not_override_a_successful_authenticated_probe() {
    let home = TempHome::new("p01-stale-401");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;

    // A POST rejected with 401 records an auth failure (the key was later fixed
    // server-side, or the refusal was transient).
    api.set_heartbeats(Reply::Status(401)).await;
    let _ = heartbeat(&home, &api.url, KEY_A, "hb-401-then-ok", now() - 3.0).await;
    let failure = delivery_state(&home);
    assert_eq!(
        failure
            .iter()
            .map(|(kind, _)| kind.as_str())
            .collect::<Vec<_>>(),
        vec!["auth_401"],
        "the 401 refusal is recorded for this scope: {failure:?}"
    );

    // GET today succeeds with the same key: the key demonstrably works.
    let today = today_json(&home, &api.url, KEY_A).await;
    let json = today.json();
    assert_eq!(
        json["connection"]["state"],
        "online",
        "{}",
        today.describe()
    );
    assert_eq!(json["connection"]["authenticated"], true);
    assert_eq!(json["connection"]["last_error_kind"], "auth_401");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn key_rotation_without_proof_keeps_rows_as_orphaned() {
    let home = TempHome::new("rotation-no-proof");
    let api = MockApi::start(&[(KEY_A, "account-1"), (KEY_B, "account-1")]).await;
    let t = now();

    // KEY_A never reached the server, so there is no proof of which account owns
    // these rows. They must not be moved, sent or deleted.
    api.set_online(false).await;
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-np-1", t - 5.0).await,
        1,
    );
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-np-2", t - 4.0).await,
        1,
    );
    let before = queue_rows(&home);

    api.set_online(true).await;
    let status = cli(&home, &api.url, KEY_B, &["status", "--json"]).await;
    assert!(status.success, "{}", status.describe());
    assert_eq!(status.json()["orphaned_queued_heartbeats"], 2);
    let today = today_json(&home, &api.url, KEY_B).await.json();
    assert_eq!(today["queue"]["orphaned"], 2);
    assert_eq!(today["queue"]["depth"], 0);

    assert!(api.received_ids().await.is_empty());
    let after = queue_rows(&home);
    assert_eq!(after.len(), 2);
    for (old, new) in before.iter().zip(after.iter()) {
        assert_eq!(old.owner_scope, new.owner_scope);
        assert_eq!(old.heartbeat_id, new.heartbeat_id);
    }

    // Once KEY_A itself is verified again, the proof exists and the same-account
    // rows are adopted by the current key and delivered exactly once.
    let _ = today_json(&home, &api.url, KEY_A).await;
    let _ = cli(&home, &api.url, KEY_B, &["verify", "--json"]).await;
    let status = cli(&home, &api.url, KEY_B, &["status", "--json"]).await;
    assert!(status.success, "{}", status.describe());
    assert_eq!(api.received_ids().await, sorted(&["hb-np-1", "hb-np-2"]));
    assert!(queue_rows(&home).is_empty());
}

// ---------------------------------------------------------------------------
// Phase 03 — scoped delivery state, recovery without new activity
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn legacy_unscoped_failure_never_drives_user_facing_state() {
    let home = TempHome::new("p03-legacy-record");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    // A refusal written by a pre-scope binary: it cannot say which server or
    // account it was about.
    fs::create_dir_all(home.path().join(".wakaclock")).unwrap();
    fs::write(
        home.path().join(".wakaclock/last-delivery-failure.json"),
        r#"{"at":1789000000.0,"message":"HTTP status 402: trial expired"}"#,
    )
    .unwrap();

    let today = today_json(&home, &api.url, KEY_A).await;
    let json = today.json();
    assert_eq!(
        json["connection"]["state"],
        "online",
        "{}",
        today.describe()
    );
    assert!(json["delivery_failure"].is_null(), "{}", today.describe());

    // It is migrated once, under a scope that matches no real origin/account, and
    // the old file is gone.
    assert!(!home
        .path()
        .join(".wakaclock/last-delivery-failure.json")
        .exists());
    let states = delivery_state(&home);
    // The kind is recovered by classifying the old message; `http_status` stays
    // unknown because pre-scope records never carried one.
    assert_eq!(states, vec![("payment_402".to_string(), None)]);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn offline_backlog_drains_after_recovery_without_new_activity() {
    let home = TempHome::new("p03-drain");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    let t = now();

    api.set_online(false).await;
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-drain-1", t - 5.0).await,
        1,
    );
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-drain-2", t - 4.0).await,
        1,
    );
    assert_eq!(
        delivery_state(&home),
        vec![("network".to_string(), None)],
        "the outage is recorded for this scope"
    );

    // The server returns. No new editor activity happens: `status` is the same
    // bounded flush the broker runs on its own tick.
    api.set_online(true).await;
    let status = cli(&home, &api.url, KEY_A, &["status", "--json"]).await;
    assert!(status.success, "{}", status.describe());
    assert_eq!(status.json()["flushed_now"], 2, "{}", status.describe());

    assert_eq!(
        api.received_ids().await,
        sorted(&["hb-drain-1", "hb-drain-2"])
    );
    assert!(queue_rows(&home).is_empty());
    assert!(
        delivery_state(&home).is_empty(),
        "a fully drained scope has no failure left"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn recovery_never_changes_heartbeat_payload_or_timestamp() {
    let home = TempHome::new("p03-payload");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    let t = now();

    api.set_online(false).await;
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-exact", t - 7.0).await,
        1,
    );
    api.set_online(true).await;
    let status = cli(&home, &api.url, KEY_A, &["status", "--json"]).await;
    assert!(status.success, "{}", status.describe());

    let delivered = api.received().await;
    assert_eq!(delivered.len(), 1);
    assert_eq!(delivered[0].heartbeat_id, "hb-exact");
    assert_eq!(
        delivered[0].time,
        Some((((t - 7.0) * 1000.0).round()) / 1000.0)
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn successful_probe_preserves_backlog_failure_until_delivery_ack() {
    let home = TempHome::new("p03-probe-clear");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;

    // Reading today proves reachability, but cannot confirm the queued POST.
    // The backlog failure stays visible until every queued row is acknowledged.
    api.set_online(false).await;
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-probe-1", now() - 3.0).await,
        1,
    );
    assert_eq!(delivery_state(&home), vec![("network".to_string(), None)]);

    api.set_online(true).await;
    api.set_heartbeats(Reply::Status(402)).await;
    let today = today_json(&home, &api.url, KEY_A).await;
    assert!(today.success, "{}", today.describe());
    assert_eq!(today.json()["connection"]["state"], "online");
    assert_eq!(delivery_state(&home), vec![("network".to_string(), None)]);

    // A 402 is different: `today` keeps working while delivery is refused, so a
    // successful probe must not clear it.
    let sent = heartbeat(&home, &api.url, KEY_A, "hb-probe-2", now() - 2.0).await;
    assert!(sent.success, "{}", sent.describe());
    assert_eq!(
        delivery_state(&home),
        vec![("payment_402".to_string(), Some(402))]
    );
    let after = today_json(&home, &api.url, KEY_A).await.json();
    assert_eq!(after["connection"]["state"], "subscription_required");
    assert_eq!(
        delivery_state(&home),
        vec![("payment_402".to_string(), Some(402))]
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn permanent_validation_error_moves_to_recoverable_dead_letter() {
    let home = TempHome::new("p03-dead-letter");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;

    // Queue a row while offline, then have the server reject it permanently.
    api.set_online(false).await;
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-bad", now() - 3.0).await,
        1,
    );
    api.set_online(true).await;
    api.set_heartbeats(Reply::Status(422)).await;
    let status = cli(&home, &api.url, KEY_A, &["status", "--json"]).await;
    assert!(status.success, "{}", status.describe());

    // It leaves the live queue but is kept for recovery, never silently dropped.
    assert!(queue_rows(&home).is_empty());
    let connection = Connection::open(home.queue_db()).unwrap();
    let (dead, kept_id): (i64, String) = connection
        .query_row(
            "SELECT COUNT(*), MIN(heartbeat_id) FROM heartbeat_dead_letter",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(dead, 1);
    assert_eq!(kept_id, "hb-bad");
    assert_eq!(
        delivery_state(&home),
        vec![("validation".to_string(), Some(422))]
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn today_json_reports_eligible_rows_separately_from_depth() {
    let home = TempHome::new("p03-eligible");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    api.set_heartbeats(Reply::StatusRetryAfter(429, 120)).await;

    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "hb-eligible", now() - 3.0).await,
        1,
    );

    let json = today_json(&home, &api.url, KEY_A).await.json();
    assert_eq!(json["queue"]["depth"], 1);
    assert_eq!(
        json["queue"]["eligible_now"], 0,
        "a row waiting on Retry-After is queued but not eligible"
    );
}

// ---------------------------------------------------------------------------
// Phase 05 — end-to-end certification campaigns (C1–C6)
//
// Each campaign drives the whole offline lifecycle through the real binary and
// records a metadata-only artifact under `target/offline-certification/`:
// counts, classified states and hashed entities — never a source path, a key or
// a payload. C7 (the 30–60 minute latency soak) and the Windows run are not
// automated here; see the phase document.
// ---------------------------------------------------------------------------

fn entity_hash(entity: &str) -> String {
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(entity.as_bytes());
    digest
        .iter()
        .take(8)
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// Ordered delivery identities, for before/after comparison.
fn queue_identities(home: &TempHome) -> Vec<String> {
    queue_rows(home)
        .into_iter()
        .map(|row| {
            format!(
                "{}|{}|{}",
                row.heartbeat_id.unwrap_or_default(),
                entity_hash(&row.destination),
                row.owner_scope
            )
        })
        .collect()
}

fn record_certification(name: &str, value: serde_json::Value) {
    let directory =
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/offline-certification");
    if fs::create_dir_all(&directory).is_err() {
        return;
    }
    let _ = fs::write(
        directory.join(format!("{name}.json")),
        serde_json::to_string_pretty(&value).unwrap_or_default(),
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn certification_c1_cold_start_while_the_server_is_down() {
    let home = TempHome::new("c1");
    let origin = dead_origin().await;

    let today = today_json(&home, &origin, KEY_A).await;
    assert!(today.success, "{}", today.describe());
    let json = today.json();

    assert_eq!(json["connection"]["state"], "offline");
    assert_eq!(json["queue"]["depth"], 0);
    // No subscription or key warning for what is only an outage.
    assert!(json["delivery_failure"].is_null());
    assert_ne!(json["connection"]["state"], "subscription_required");
    assert_ne!(json["connection"]["state"], "auth_rejected");

    record_certification(
        "c1-cold-start-offline",
        serde_json::json!({
            "campaign": "C1",
            "connection_state": json["connection"]["state"],
            "queue_depth": json["queue"]["depth"],
            "delivery_failure": json["delivery_failure"],
        }),
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn certification_c2_capture_and_restart_while_offline() {
    let home = TempHome::new("c2");
    let origin = dead_origin().await;
    let t = now();

    for (index, id) in ["c2-a", "c2-b", "c2-c"].iter().enumerate() {
        assert_queued(
            &heartbeat(&home, &origin, KEY_A, id, t - 30.0 + index as f64).await,
            1,
        );
    }
    let before = queue_identities(&home);

    // Every CLI invocation is a fresh process, so this *is* a restart: the rows
    // must be identical afterwards, and the count must still be readable.
    let after_restart = today_json(&home, &origin, KEY_A).await.json();
    let after = queue_identities(&home);

    assert_eq!(
        before, after,
        "queue identities survive a restart unchanged"
    );
    assert_eq!(after.len(), 3);
    assert_eq!(after_restart["queue"]["depth"], 3);
    assert_eq!(after_restart["queued_heartbeats"], 3);

    record_certification(
        "c2-restart-offline",
        serde_json::json!({
            "campaign": "C2",
            "rows_before": before.len(),
            "rows_after": after.len(),
            "identities_unchanged": before == after,
            "reported_depth": after_restart["queue"]["depth"],
        }),
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn certification_c3_recovery_while_idle() {
    let home = TempHome::new("c3");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    let t = now();

    api.set_online(false).await;
    for (index, id) in ["c3-a", "c3-b"].iter().enumerate() {
        assert_queued(
            &heartbeat(&home, &api.url, KEY_A, id, t - 20.0 + index as f64).await,
            1,
        );
    }

    // The user stops working. Recovery must not need a new heartbeat.
    api.set_online(true).await;
    let status = cli(&home, &api.url, KEY_A, &["status", "--json"]).await;
    assert!(status.success, "{}", status.describe());

    let accepted = api.received_ids().await;
    assert_eq!(accepted, sorted(&["c3-a", "c3-b"]));
    assert!(queue_rows(&home).is_empty());
    let after = today_json(&home, &api.url, KEY_A).await.json();
    assert_eq!(after["connection"]["state"], "online");
    assert_eq!(after["queue"]["depth"], 0);

    let mut unique = accepted.clone();
    unique.dedup();
    assert_eq!(unique.len(), accepted.len(), "no duplicate acceptance");
    record_certification(
        "c3-recovery-while-idle",
        serde_json::json!({
            "campaign": "C3",
            "accepted": accepted.len(),
            "unique_accepted": unique.len(),
            "queue_depth_after": 0,
            "connection_state_after": after["connection"]["state"],
        }),
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn certification_c4_error_classification_matrix() {
    let mut observed = Vec::new();

    // Transport failure: no HTTP response at all.
    let offline_home = TempHome::new("c4-offline");
    let dead = dead_origin().await;
    let offline = today_json(&offline_home, &dead, KEY_A).await.json();
    assert_eq!(offline["connection"]["state"], "offline");
    observed.push(("network", "offline", offline["queue"]["depth"].clone()));

    for (status, expected_state, expect_queued) in [
        (401, "auth_rejected", false),
        (402, "subscription_required", true),
        (429, "retryable_server_error", true),
        (503, "retryable_server_error", true),
    ] {
        let home = TempHome::new(&format!("c4-{status}"));
        // 401 is driven by an unknown key; the rest by a configured reply.
        let api = if status == 401 {
            MockApi::start(&[]).await
        } else {
            let api = MockApi::start(&[(KEY_A, "account-1")]).await;
            api.set_heartbeats(Reply::Status(status)).await;
            api.set_today(Reply::Status(status)).await;
            api
        };
        if expect_queued {
            assert_queued(
                &heartbeat(&home, &api.url, KEY_A, &format!("c4-{status}"), now() - 3.0).await,
                1,
            );
        }
        let json = today_json(&home, &api.url, KEY_A).await.json();
        assert_eq!(
            json["connection"]["state"], expected_state,
            "status {status} must classify as {expected_state}"
        );
        let depth = json["queue"]["depth"].as_u64().unwrap_or(0);
        assert_eq!(
            depth > 0,
            expect_queued,
            "status {status}: queued={depth}, expected queued={expect_queued}"
        );
        observed.push((
            "http",
            expected_state,
            serde_json::json!({ "status": status, "queue_depth": depth }),
        ));
    }

    // Success clears the state again.
    let ok_home = TempHome::new("c4-ok");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    let ok = today_json(&ok_home, &api.url, KEY_A).await.json();
    assert_eq!(ok["connection"]["state"], "online");

    record_certification(
        "c4-error-classification",
        serde_json::json!({
            "campaign": "C4",
            "cases": observed
                .iter()
                .map(|(kind, state, detail)| serde_json::json!({
                    "kind": kind, "state": state, "detail": detail
                }))
                .collect::<Vec<_>>(),
        }),
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn certification_c5_same_account_key_rotation() {
    let home = TempHome::new("c5");
    let api = MockApi::start(&[(KEY_A, "account-1"), (KEY_B, "account-1")]).await;
    let t = now();

    // KEY_A is connected once, so its ownership proof exists.
    assert_eq!(
        today_json(&home, &api.url, KEY_A).await.json()["connection"]["state"],
        "online"
    );

    api.set_online(false).await;
    for (index, id) in ["c5-a", "c5-b", "c5-c"].iter().enumerate() {
        assert_queued(
            &heartbeat(&home, &api.url, KEY_A, id, t - 30.0 + index as f64).await,
            1,
        );
    }
    let before = queue_identities(&home);

    api.set_online(true).await;
    assert!(
        cli(&home, &api.url, KEY_B, &["verify", "--json"])
            .await
            .success
    );
    assert!(
        cli(&home, &api.url, KEY_B, &["status", "--json"])
            .await
            .success
    );

    let accepted = api.received_ids().await;
    let mut unique = accepted.clone();
    unique.dedup();
    assert_eq!(accepted, sorted(&["c5-a", "c5-b", "c5-c"]));
    assert_eq!(unique.len(), accepted.len(), "no duplicate acceptance");
    assert!(queue_rows(&home).is_empty());
    for received in api.received().await {
        assert_eq!(received.bearer, KEY_B);
    }

    record_certification(
        "c5-key-rotation",
        serde_json::json!({
            "campaign": "C5",
            "rows_before": before.len(),
            "accepted": accepted.len(),
            "duplicates": accepted.len() - unique.len(),
            "queue_depth_after": 0,
        }),
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn certification_c6_cross_account_and_cross_origin_isolation() {
    let home = TempHome::new("c6");
    let old_origin = dead_origin().await;
    let api = MockApi::start(&[(KEY_A, "account-1"), (KEY_C, "account-2")]).await;
    let t = now();

    // Rows belonging to one account on one origin.
    assert_queued(
        &heartbeat(&home, &old_origin, KEY_A, "c6-a", t - 20.0).await,
        1,
    );
    assert_queued(
        &heartbeat(&home, &old_origin, KEY_A, "c6-b", t - 19.0).await,
        1,
    );
    let before = queue_identities(&home);

    // A different account on a different origin: diagnostics only.
    assert!(
        cli(&home, &api.url, KEY_C, &["verify", "--json"])
            .await
            .success
    );
    let status = cli(&home, &api.url, KEY_C, &["status", "--json"]).await;
    assert!(status.success, "{}", status.describe());
    let status_json = status.json();
    assert_eq!(status_json["orphaned_queued_heartbeats"], 2);
    let sent = heartbeat(&home, &api.url, KEY_C, "c6-own", t - 1.0).await;
    assert!(sent.success, "{}", sent.describe());

    assert_eq!(api.received_ids().await, sorted(&["c6-own"]));
    assert_eq!(queue_identities(&home), before);

    record_certification(
        "c6-isolation",
        serde_json::json!({
            "campaign": "C6",
            "foreign_rows_preserved": before.len(),
            "foreign_rows_delivered": 0,
            "orphaned_reported": status_json["orphaned_queued_heartbeats"],
        }),
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn backlog_1191_across_three_days_drains_on_idle_worker_ticks() {
    let home = TempHome::new("1191-idle");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    api.set_online(false).await;
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "seed", now() - 20.0).await,
        1,
    );
    let mut db = Connection::open(home.queue_db()).unwrap();
    let (template, destination, owner): (String, String, String) = db
        .query_row(
            "SELECT payload,destination,owner_scope FROM heartbeat_queue LIMIT 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap();
    let original: Value = serde_json::from_str(&template).unwrap();
    let tx = db.transaction().unwrap();
    tx.execute("DELETE FROM heartbeat_queue", []).unwrap();
    for index in 0..1191 {
        let mut payload = original.clone();
        payload["heartbeat_id"] = serde_json::json!(format!("backlog-{index}"));
        payload["time"] = serde_json::json!(now() - (index % 3) as f64 * 86400.0);
        let entity = payload["entity"].as_str().unwrap();
        tx.execute("INSERT INTO heartbeat_queue(payload,heartbeat_id,destination,owner_scope,session_id,entity,revision,created_at,next_retry_at,retry_count,failure_kind,failed_at)
            VALUES(?1,?2,?3,?4,'',?5,0,strftime('%s','now')-1800,strftime('%s','now')+3600,?6,'network',strftime('%s','now')-60)",rusqlite::params![payload.to_string(),format!("backlog-{index}"),destination,owner,entity,7+index%9]).unwrap();
    }
    tx.commit().unwrap();
    drop(db);
    api.set_online(true).await;
    // Only a GET succeeds: future-backoff rows stay retained and visible.
    let status = cli(&home, &api.url, KEY_A, &["status", "--json"]).await;
    assert!(status.success, "{}", status.describe());
    assert_eq!(queue_rows(&home).len(), 1191);
    assert!(
        !delivery_state(&home).is_empty(),
        "successful read cannot hide backlog failure"
    );
    api.state.lock().await.response_delay_ms = 500;
    let started = std::time::Instant::now();
    let new = heartbeat(&home, &api.url, KEY_A, "new-after-recovery", now()).await;
    assert!(new.success, "{}", new.describe());
    assert_eq!(new.json()["sent"], 1);
    assert_eq!(queue_rows(&home).len(), 1091);
    assert!(
        !delivery_state(&home).is_empty(),
        "one accepted new heartbeat does not hide remaining backlog"
    );
    // An autonomous worker ticks immediately, then every 15 seconds. No producer
    // or dashboard polling is needed to finish the remaining 1091 rows.
    let mut child = tokio::process::Command::new(env!("CARGO_BIN_EXE_wakaclock"))
        .args(["delivery", "run"])
        .env_clear()
        .env("PATH", std::env::var_os("PATH").unwrap_or_default())
        .env("HOME", home.path())
        .env("USERPROFILE", home.path())
        .env("TMPDIR", std::env::temp_dir())
        .env("WAKACLOCK_SERVER_URL", &api.url)
        .env("WAKACLOCK_API_KEY", KEY_A)
        .env("WAKACLOCK_RECOVERY_PROBE", "1")
        .current_dir(home.path())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .unwrap();
    timeout(Duration::from_secs(100), async {
        loop {
            if queue_rows(&home).is_empty() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    })
    .await
    .expect("idle worker did not finish backlog");
    child.kill().await.unwrap();
    let _ = child.wait().await;
    assert!(queue_rows(&home).is_empty());
    assert!(delivery_state(&home).is_empty());
    assert!(started.elapsed() < Duration::from_secs(120));
    let ids = api.received_ids().await;
    assert_eq!(ids.len(), 1192);
    assert_eq!(
        ids.iter().collect::<std::collections::HashSet<_>>().len(),
        1192
    );
    println!(
        "1191 backlog plus new heartbeat reconciled in {:?}",
        started.elapsed()
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn queue_write_failure_never_calls_transport() {
    let home = TempHome::new("durable-write-failure");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    fs::create_dir_all(home.queue_db()).unwrap();
    let run = heartbeat(&home, &api.url, KEY_A, "cannot-persist", now()).await;
    assert!(
        !run.success,
        "producer must retry a failed durable write: {}",
        run.describe()
    );
    assert_eq!(api.state.lock().await.heartbeat_requests, 0);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn mixed_validation_batch_delivers_good_siblings_and_retains_bad_row() {
    let home = TempHome::new("mixed-validation");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    api.set_online(false).await;
    for id in ["valid-first", "invalid", "valid-last"] {
        assert_queued(&heartbeat(&home, &api.url, KEY_A, id, now()).await, 1);
    }
    api.set_online(true).await;
    api.state.lock().await.reject_id = Some("invalid".into());
    let tick = cli(
        &home,
        &api.url,
        KEY_A,
        &["delivery", "run", "--once", "--json"],
    )
    .await;
    assert!(tick.success, "{}", tick.describe());
    assert_eq!(
        api.received_ids().await,
        sorted(&["valid-first", "valid-last"])
    );
    assert!(queue_rows(&home).is_empty());
    assert_eq!(tick.json()["dead_letter"], 1);
    assert_eq!(tick.json()["incomplete"], true);
    let db = Connection::open(home.queue_db()).unwrap();
    let id: String = db
        .query_row("SELECT heartbeat_id FROM heartbeat_dead_letter", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(id, "invalid");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn server_accepts_but_response_lost_replays_same_identity() {
    let home = TempHome::new("response-lost");
    let api = MockApi::start(&[(KEY_A, "account-1")]).await;
    api.state.lock().await.accept_drop_once = true;
    let stamp = now();
    assert_queued(
        &heartbeat(&home, &api.url, KEY_A, "lost-response", stamp).await,
        1,
    );
    assert_eq!(
        queue_rows(&home).len(),
        1,
        "no acknowledgment means retained"
    );
    let tick = cli(
        &home,
        &api.url,
        KEY_A,
        &["delivery", "run", "--once", "--json"],
    )
    .await;
    assert!(tick.success, "{}", tick.describe());
    assert!(queue_rows(&home).is_empty());
    let received = api.received().await;
    assert_eq!(received.len(), 2);
    assert_eq!(received[0].heartbeat_id, received[1].heartbeat_id);
    assert_eq!(received[0].time, received[1].time);
    assert_eq!(
        received
            .iter()
            .map(|r| &r.heartbeat_id)
            .collect::<std::collections::HashSet<_>>()
            .len(),
        1
    );
}

#[tokio::test]
async fn capture_cursor_restart_replay_and_delivery_are_lossless() {
    let home = TempHome::new("capture-restart");
    let api = MockApi::start(&[(KEY_A, "owner-one")]).await;
    let transcript = home.path().join("activity.jsonl");
    let t = chrono::Utc::now() - chrono::Duration::minutes(2);
    let records = [
        serde_json::json!({"timestamp":t,"type":"session_meta","payload":{"id":"session","cwd":home.path().join("workspace"),"base_instructions":"DO_NOT_PERSIST"}}),
        serde_json::json!({"timestamp":t,"type":"event_msg","payload":{"type":"task_started","turn_id":"turn"}}),
        serde_json::json!({"timestamp":t+chrono::Duration::seconds(5),"type":"event_msg","payload":{"type":"item_completed","started_at_ms":t.timestamp_millis(),"completed_at_ms":(t+chrono::Duration::seconds(5)).timestamp_millis(),"item":{"type":"CommandExecution","id":"operation","status":"failed","command":"DO_NOT_PERSIST"}}}),
    ];
    fs::write(
        &transcript,
        records.iter().map(|r| format!("{r}\n")).collect::<String>(),
    )
    .unwrap();
    let path = transcript.to_str().unwrap();
    let dry = cli(
        &home,
        &api.url,
        KEY_A,
        &["capture", "run", "--dry-run", "--transcript", path],
    )
    .await;
    assert!(dry.success, "{}", dry.describe());
    assert!(!home.path().join(".wakaclock/capture.db").exists());
    let first = cli(
        &home,
        &api.url,
        KEY_A,
        &["capture", "run", "--once", "--transcript", path],
    )
    .await;
    assert!(first.success, "{}", first.describe());
    assert_eq!(queue_rows(&home).len(), 3);
    let before = queue_rows(&home)
        .iter()
        .filter_map(|r| r.heartbeat_id.clone())
        .collect::<Vec<_>>();
    let restart = cli(
        &home,
        &api.url,
        KEY_A,
        &["capture", "run", "--once", "--transcript", path],
    )
    .await;
    assert!(restart.success, "{}", restart.describe());
    assert_eq!(queue_rows(&home).len(), 3);
    // Explicit replay gets a separate cursor but keeps the same event ledger.
    let day = t
        .with_timezone(&chrono_tz::Asia::Bangkok)
        .date_naive()
        .to_string();
    let replay = cli(
        &home,
        &api.url,
        KEY_A,
        &["capture", "run", "--date", &day, "--transcript", path],
    )
    .await;
    assert!(replay.success, "{}", replay.describe());
    assert_eq!(queue_rows(&home).len(), 3);
    let db = Connection::open(home.path().join(".wakaclock/capture.db")).unwrap();
    let strings: String = db
        .query_row(
            "SELECT group_concat(payload) FROM activity_inbox_v2",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert!(!strings.contains("DO_NOT_PERSIST"));
    let raw: String = db
        .query_row("SELECT payload FROM activity_inbox_v2 LIMIT 1", [], |r| {
            r.get(0)
        })
        .unwrap();
    let duplicate = cli_with_input(
        &home,
        &api.url,
        KEY_A,
        &["ai", "emit", "--json"],
        Some(&raw),
    )
    .await;
    assert!(duplicate.success, "{}", duplicate.describe());
    assert_eq!(duplicate.json()["status"], "duplicate");
    let mut older: Value = serde_json::from_str(&raw).unwrap();
    older["revision"] = serde_json::json!(0);
    let lower = cli_with_input(
        &home,
        &api.url,
        KEY_A,
        &["ai", "emit", "--json"],
        Some(&older.to_string()),
    )
    .await;
    assert!(lower.success, "{}", lower.describe());
    assert_eq!(
        lower.json()["status"],
        "duplicate",
        "lower-priority evidence cannot replace native evidence"
    );
    assert_eq!(queue_rows(&home).len(), 3, "broker/native/replay share IDs");
    let mut envelope: Value = serde_json::from_str(&raw).unwrap();
    envelope["event_id"] = serde_json::json!("broker-new-event");
    envelope["operation_id"] = serde_json::json!("broker-new-operation");
    let new = cli_with_input(
        &home,
        &api.url,
        KEY_A,
        &["ai", "emit", "--json"],
        Some(&envelope.to_string()),
    )
    .await;
    assert!(new.success, "{}", new.describe());
    assert_eq!(new.json()["status"], "accepted");
    envelope["occurred_at"] = serde_json::json!(t + chrono::Duration::seconds(7));
    let conflict = cli_with_input(
        &home,
        &api.url,
        KEY_A,
        &["ai", "emit", "--json"],
        Some(&envelope.to_string()),
    )
    .await;
    assert!(
        !conflict.success,
        "same-revision evidence must not be replaced"
    );
    assert_eq!(queue_rows(&home).len(), 4);
    let flush = cli(
        &home,
        &api.url,
        KEY_A,
        &["delivery", "run", "--once", "--json"],
    )
    .await;
    assert!(flush.success, "{}", flush.describe());
    assert!(queue_rows(&home).is_empty());
    let mut expected = before;
    expected.push("ai-activity:broker-new-event".into());
    expected.sort();
    assert_eq!(api.received_ids().await, expected);
}

#[tokio::test]
async fn unknown_capture_format_is_incomplete_until_parser_can_resume() {
    let home = TempHome::new("capture-unknown");
    let api = MockApi::start(&[(KEY_A, "owner-one")]).await;
    let transcript = home.path().join("activity.jsonl");
    let t = chrono::Utc::now() - chrono::Duration::minutes(2);
    let meta = serde_json::json!({"timestamp":t,"type":"session_meta","payload":{"id":"session","cwd":home.path().join("workspace")}});
    let mut activity = serde_json::json!({"timestamp":t,"type":"event_msg","payload":{"type":"item_completed","completed_at_ms":t.timestamp_millis(),"item":{"type":"FutureTool","id":"operation","content":"DO_NOT_PERSIST"}}});
    fs::write(&transcript, format!("{meta}\n{activity}\n")).unwrap();
    let args = [
        "capture",
        "run",
        "--once",
        "--transcript",
        transcript.to_str().unwrap(),
    ];
    let failed = cli(&home, &api.url, KEY_A, &args).await;
    assert!(failed.success, "{}", failed.describe());
    assert_eq!(failed.json()["status"], "parser_failure");
    assert_eq!(failed.json()["incomplete"], true);
    assert_eq!(
        failed.json()["parser_failure_codes"],
        serde_json::json!(["unsupported_native_item"])
    );
    assert!(!failed.describe().contains("DO_NOT_PERSIST"));
    assert!(queue_rows(&home).is_empty());
    let db = Connection::open(home.path().join(".wakaclock/capture.db")).unwrap();
    let count: u64 = db
        .query_row("SELECT count(*) FROM activity_cursor", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 0, "failed batch must not advance the durable cursor");
    // Simulate a recognized source after parser repair; the original operation is retained.
    activity["payload"]["item"]["type"] = serde_json::json!("CommandExecution");
    fs::write(&transcript, format!("{meta}\n{activity}\n")).unwrap();
    let recovered = cli(&home, &api.url, KEY_A, &args).await;
    assert_eq!(recovered.json()["status"], "fresh");
    assert_eq!(queue_rows(&home).len(), 1);
    let restart = cli(&home, &api.url, KEY_A, &args).await;
    assert_eq!(restart.json()["parser_errors"], 0);
    assert_eq!(
        queue_rows(&home).len(),
        1,
        "restart cannot duplicate a recovered marker"
    );
}

#[tokio::test]
async fn empty_delivery_queue_does_not_hide_a_stopped_capture_collector() {
    let home = TempHome::new("stale-capture");
    let api = MockApi::start(&[(KEY_A, "owner-one")]).await;
    let dir = home.path().join(".wakaclock");
    fs::create_dir_all(&dir).unwrap();
    let at = chrono::Utc::now() - chrono::Duration::minutes(10);
    let saved = serde_json::json!({"schema_version":2,"enabled":true,"status":"fresh",
        "checked_at":at,"last_scan_success_at":at,"pending":0,"parser_errors":0,"incomplete":false});
    let bytes = serde_json::to_vec(&saved).unwrap();
    fs::write(dir.join("capture-state.json"), &bytes).unwrap();
    let status = cli(&home, &api.url, KEY_A, &["capture", "status"]).await;
    assert!(status.success, "{}", status.describe());
    assert_eq!(status.json()["status"], "stale");
    assert_eq!(status.json()["incomplete"], true);
    let tick = cli(
        &home,
        &api.url,
        KEY_A,
        &["delivery", "run", "--once", "--json"],
    )
    .await;
    assert!(tick.success, "{}", tick.describe());
    assert_eq!(tick.json()["pending"], 0);
    assert_eq!(tick.json()["delivery_incomplete"], false);
    assert_eq!(tick.json()["capture_incomplete"], true);
    assert_eq!(tick.json()["incomplete"], true);
    assert!(
        api.received_ids().await.is_empty(),
        "health checks must not invent heartbeats"
    );
    assert_eq!(
        fs::read(dir.join("capture-state.json")).unwrap(),
        bytes,
        "read-time staleness must preserve the stored observation"
    );
}

#[tokio::test]
async fn second_capture_process_cannot_overwrite_the_active_collectors_health() {
    let home = TempHome::new("capture-lock-health");
    let api = MockApi::start(&[(KEY_A, "owner-one")]).await;
    let dir = home.path().join(".wakaclock");
    fs::create_dir_all(&dir).unwrap();
    let now = chrono::Utc::now();
    let saved = serde_json::json!({"schema_version":2,"enabled":true,"status":"fresh",
        "checked_at":now,"last_scan_success_at":now,"pending":0,"parser_errors":0,"incomplete":false});
    let bytes = serde_json::to_vec(&saved).unwrap();
    fs::write(dir.join("capture-state.json"), &bytes).unwrap();
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(dir.join("capture.lock"))
        .unwrap();
    lock.try_lock_exclusive().unwrap();
    let other = cli(&home, &api.url, KEY_A, &["capture", "run", "--once"]).await;
    assert!(!other.success);
    assert!(other
        .describe()
        .contains("capture collector already running"));
    assert_eq!(fs::read(dir.join("capture-state.json")).unwrap(), bytes);
    assert!(!dir.join("capture.db").exists());
    assert!(api.received_ids().await.is_empty());
}
