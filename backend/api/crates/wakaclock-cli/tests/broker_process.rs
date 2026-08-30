use chrono::Utc;
use reqwest::StatusCode;
use rusqlite::Connection;
use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    time::Duration,
};
use tokio::{
    io::AsyncReadExt,
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
