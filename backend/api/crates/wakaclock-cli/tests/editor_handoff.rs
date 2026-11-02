//! Real CLI subprocesses, isolated homes and synthetic metadata only. No server,
//! producer runtime, Docker, private transcript or real account is involved.
use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    path::PathBuf,
    process::{Command, Stdio},
};
use uuid::Uuid;
struct Home(PathBuf);
impl Home {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("editor-handoff-{}", Uuid::new_v4()));
        fs::create_dir_all(&path).unwrap();
        Self(path)
    }
    fn command(&self, args: &[&str], input: Option<&Value>) -> std::process::Output {
        let mut command = Command::new(env!("CARGO_BIN_EXE_wakaclock"));
        command
            .args(args)
            .env_clear()
            .env("HOME", &self.0)
            .env("USERPROFILE", &self.0)
            .env("APPDATA", self.0.join("appdata"))
            .env("LOCALAPPDATA", self.0.join("localappdata"))
            .env("WAKACLOCK_API_KEY", "fixture-editor-account")
            .env("WAKACLOCK_SERVER_URL", "http://127.0.0.1:9")
            .env("PATH", std::env::var_os("PATH").unwrap_or_default())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Some(root) = std::env::var_os("SystemRoot") {
            command.env("SystemRoot", root);
        }
        let mut child = command.spawn().unwrap();
        if let Some(input) = input {
            child
                .stdin
                .take()
                .unwrap()
                .write_all(input.to_string().as_bytes())
                .unwrap();
        } else {
            drop(child.stdin.take());
        }
        child.wait_with_output().unwrap()
    }
    fn queue(&self) -> wakaclock_core::queue::Queue {
        wakaclock_core::queue::Queue::open_at(&self.0.join(".wakaclock/queue.db")).unwrap()
    }
}
impl Drop for Home {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn frozen_tool_spool_survives_missing_cli_idle_restart_and_lost_ack() {
    let home = Home::new();
    let scope: Value =
        serde_json::from_slice(&home.command(&["journal-scope"], None).stdout).unwrap();
    assert!(scope["capabilities"]
        .as_array()
        .unwrap()
        .iter()
        .any(|c| c == "tool_boundary_durable_v1"));
    let bindings = home.0.join(".wakaclock/native-producer-bindings");
    fs::create_dir_all(&bindings).unwrap();
    fs::write(
        bindings.join("codex-cli.json"),
        json!({"scope_id":scope["scope_id"],"owner_fixed":true}).to_string(),
    )
    .unwrap();
    let project = home.0.join("fixture");
    fs::create_dir(&project).unwrap();
    fs::write(
        project.join("Cargo.toml"),
        "[package]\nname=\"fixture\"\nversion=\"0.1.0\"\n",
    )
    .unwrap();
    let file = project.join("evidence.rs");
    fs::write(&file, "PRIVATE_BEFORE\n").unwrap();
    let helper = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../../extensions/ai-agents/common/tool-boundary-producer.py");
    let input = json!({"agent":"codex","tool_event_id":"original-call","session_id":"original-session","cwd":project,"transport":"shell_hook"});
    let run_hook = |phase: &str| {
        let mut command = Command::new("python3");
        command
            .arg(&helper)
            .args(["--phase", phase, "--cli", "/missing/cli"])
            .env("ATOAXIS_PRODUCER_HOME", &home.0)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = command.spawn().unwrap();
        child
            .stdin
            .take()
            .unwrap()
            .write_all(input.to_string().as_bytes())
            .unwrap();
        let result = child.wait_with_output().unwrap();
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
    };
    run_hook("before");
    fs::write(&file, "PRIVATE_AFTER\nsecond\n").unwrap();
    run_hook("after");
    let directory = home
        .0
        .join(".wakaclock/native-producer-spool")
        .join(scope["scope_id"].as_str().unwrap());
    let records: Vec<Value> = fs::read_dir(&directory)
        .unwrap()
        .map(|entry| serde_json::from_slice(&fs::read(entry.unwrap().path()).unwrap()).unwrap())
        .collect();
    assert_eq!(
        records
            .iter()
            .filter(|r| r["kind"] == "tool_boundary")
            .count(),
        2
    );
    assert_eq!(
        records
            .iter()
            .filter(|r| r["kind"] == "session_context")
            .count(),
        2
    );
    assert_eq!(records.len(), 4);
    // Neither source nor the future worktree may affect deferred materialization.
    fs::remove_file(&file).unwrap();
    let batch = json!({"schema_version":2,"records":records});
    let first = home.command(&["ai", "producer-batch", "--json"], Some(&batch));
    assert!(
        first.status.success(),
        "{}",
        String::from_utf8_lossy(&first.stderr)
    );
    let accepted: Value = serde_json::from_slice(&first.stdout).unwrap();
    assert!(accepted["results"]
        .as_array()
        .unwrap()
        .iter()
        .all(|r| r["durable"] == true && r["status"] == "accepted"));
    // Ignore the first ACK. The collector must dedup retained spool after restart.
    let replay: Value = serde_json::from_slice(
        &home
            .command(&["ai", "producer-batch", "--json"], Some(&batch))
            .stdout,
    )
    .unwrap();
    assert!(replay["results"]
        .as_array()
        .unwrap()
        .iter()
        .all(|r| r["status"] == "duplicate"));
    let worker = home.command(&["capture", "run", "--once"], None);
    assert!(
        worker.status.success(),
        "{}",
        String::from_utf8_lossy(&worker.stderr)
    );
    let db = rusqlite::Connection::open(home.0.join(".wakaclock/broker.db")).unwrap();
    let status: String = db
        .query_row("SELECT status FROM broker_tool_pairs", [], |r| r.get(0))
        .unwrap();
    assert_eq!(status, "materialized");
    let json: String = db
        .query_row("SELECT batch_json FROM broker_tool_pairs", [], |r| r.get(0))
        .unwrap();
    let events: Vec<Value> = serde_json::from_str(&json).unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0]["lines_added"], Value::Null); // Non-Git modified baseline stays unknown.
    let original_end = batch["records"]
        .as_array()
        .unwrap()
        .iter()
        .find(|r| r["metadata"]["phase"] == "after")
        .unwrap();
    assert_eq!(events[0]["occurred_at"], original_end["observed_at"]);
    assert!(!json.contains("PRIVATE_BEFORE"));
    assert!(!json.contains("PRIVATE_AFTER"));
    assert_eq!(
        fs::read_dir(&directory)
            .unwrap()
            .filter_map(Result::ok)
            .filter(|e| e.path().extension().is_some_and(|s| s == "json"))
            .count(),
        0
    );
    // Another idle worker restart must keep the exact frozen batch and receipt.
    assert!(home
        .command(&["capture", "run", "--once"], None)
        .status
        .success());
    let again: String = db
        .query_row("SELECT batch_json FROM broker_tool_pairs", [], |r| r.get(0))
        .unwrap();
    assert_eq!(again, json);
}
#[test]
fn durable_ack_replays_original_ids_after_lost_response_and_isolates_bad_siblings() {
    let home = Home::new();
    let scope: Value =
        serde_json::from_slice(&home.command(&["journal-scope"], None).stdout).unwrap();
    let batch = json!({"schema_version":1,"scope_id":scope["scope_id"],"items":[{"heartbeat_id":"original","time":1000.0,"entity":"historical.rs","active_seconds":2.0},{"heartbeat_id":"bad","time":1001.0,"entity":"bad.rs","unsupported_file_contents":"SENSITIVE"}]});
    let first = home.command(&["heartbeat-batch"], Some(&batch));
    assert!(first.status.success());
    let first: Value = serde_json::from_slice(&first.stdout).unwrap();
    assert_eq!(first["results"][0]["status"], "accepted");
    assert_eq!(first["results"][1]["status"], "permanent_rejection");
    // Pretend the extension never received the first stdout. A new CLI process
    // still knows the original handoff even after server delivery removed it.
    let queue = home.queue();
    let rows = queue.pop_all().unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].1["heartbeat_id"], "original");
    assert_eq!(rows[0].1["time"], 1000.0);
    queue.remove(rows[0].0).unwrap();
    drop(queue);
    let replay = home.command(&["heartbeat-batch"], Some(&batch));
    assert!(replay.status.success());
    let replay: Value = serde_json::from_slice(&replay.stdout).unwrap();
    assert_eq!(replay["results"][0]["status"], "duplicate");
    assert_eq!(home.queue().len().unwrap(), 0);
}
#[test]
fn journal_replay_labels_files_by_extension_without_changing_time_or_ids() {
    let home = Home::new();
    let scope: Value =
        serde_json::from_slice(&home.command(&["journal-scope"], None).stdout).unwrap();
    let batch = json!({"schema_version":1,"scope_id":scope["scope_id"],"items":[
        {"heartbeat_id":"rust","time":1000.0,"entity":"/nonexistent/historical.rs","active_seconds":2.0},
        {"heartbeat_id":"log","time":1001.0,"entity":"/nonexistent/output.log","active_seconds":3.0}]});
    let accepted = home.command(&["heartbeat-batch"], Some(&batch));
    assert!(accepted.status.success());
    let accepted: Value = serde_json::from_slice(&accepted.stdout).unwrap();
    assert_eq!(accepted["results"][0]["status"], "accepted");
    assert_eq!(accepted["results"][1]["status"], "accepted");
    let queue = home.queue();
    let rows = queue.pop_all().unwrap();
    let row = |id: &str| {
        rows.iter()
            .find(|r| r.1["heartbeat_id"] == id)
            .unwrap()
            .1
            .clone()
    };
    let (rust, log) = (row("rust"), row("log"));
    assert_eq!(rust["language"], "Rust");
    // Not a programming language: stays unlabelled rather than being guessed.
    assert!(log["language"].is_null());
    assert_eq!(
        (rust["time"].as_f64(), rust["active_seconds"].as_f64()),
        (Some(1000.0), Some(2.0))
    );
    assert_eq!(
        (log["time"].as_f64(), log["active_seconds"].as_f64()),
        (Some(1001.0), Some(3.0))
    );
}
#[test]
fn native_hook_ack_is_local_private_idempotent_and_pause_survives_a_new_process() {
    let home = Home::new();
    let input = json!({"hook_event_name":"PreToolUse","session_id":"fixture-session","cwd":home.0,"tool_use_id":"operation","tool_input":{"command":"SENSITIVE"},"tool_response":"SENSITIVE"});
    let args = [
        "ai",
        "activity-hook",
        "--adapter",
        "claude-code",
        "--surface",
        "cli",
    ];
    let first = home.command(&args, Some(&input));
    assert!(first.status.success());
    assert!(!String::from_utf8_lossy(&first.stdout).contains("SENSITIVE"));
    let first: Value = serde_json::from_slice(&first.stdout).unwrap();
    assert_eq!(first["acknowledgement"]["durable"], true);
    let second: Value = serde_json::from_slice(&home.command(&args, Some(&input)).stdout).unwrap();
    assert_eq!(second["acknowledgement"]["status"], "duplicate");
    let mut conflict = input.clone();
    conflict["cwd"] = json!(std::env::temp_dir());
    assert!(!home.command(&args, Some(&conflict)).status.success());
    let db = rusqlite::Connection::open(home.0.join(".wakaclock/capture.db")).unwrap();
    let stored: String = db
        .query_row("SELECT payload FROM activity_inbox_v2", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert!(!stored.contains("SENSITIVE"));
    let count: i64 = db
        .query_row("SELECT COUNT(*) FROM activity_inbox_v2", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(count, 1);
    assert!(home
        .command(
            &["runtime", "pause", "--component", "capture", "--json"],
            None
        )
        .status
        .success());
    assert!(!home.command(&args, Some(&input)).status.success());
    let status: Value =
        serde_json::from_slice(&home.command(&["runtime", "status", "--json"], None).stdout)
            .unwrap();
    assert_eq!(status["desired"]["desired"]["capture"], false);
}

#[test]
fn cline_native_response_is_neutral_and_only_metadata_is_durable() {
    let home = Home::new();
    let input = json!({"hookName":"PostToolUse","taskId":"cline-fixture-session", "workspaceRoots":[home.0],
        "timestamp":"2026-10-10T08:00:00Z", "postToolUse":{"success":false,"parameters":{"source":"SENSITIVE"},"result":"SENSITIVE"}});
    let output = home.command(
        &[
            "ai",
            "activity-hook",
            "--adapter",
            "cline",
            "--surface",
            "ide",
            "--hook-output",
        ],
        Some(&input),
    );
    assert!(output.status.success());
    assert_eq!(
        serde_json::from_slice::<Value>(&output.stdout).unwrap(),
        json!({"cancel":false})
    );
    let db = rusqlite::Connection::open(home.0.join(".wakaclock/capture.db")).unwrap();
    let stored: String = db
        .query_row("SELECT payload FROM activity_inbox_v2", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert!(!stored.contains("SENSITIVE"));
    let event: Value = serde_json::from_str(&stored).unwrap();
    assert_eq!(event["status"], "failed");
    assert_eq!(event["occurred_at"], "2026-10-10T08:00:00Z");
}

#[test]
fn failed_resume_preflight_keeps_persistent_pause() {
    let home = Home::new();
    assert!(home
        .command(
            &["runtime", "pause", "--component", "capture", "--json"],
            None
        )
        .status
        .success());
    let services = home.0.join(".wakaclock/services");
    fs::create_dir_all(&services).unwrap();
    let foreign = home.0.join("foreign-executable");
    fs::write(&foreign, b"fixture-only").unwrap();
    fs::write(
        services.join("capture.json"),
        json!({"active":foreign,"previous":null,"sha256":"unverified"}).to_string(),
    )
    .unwrap();
    assert!(!home
        .command(
            &["runtime", "resume", "--component", "capture", "--json"],
            None
        )
        .status
        .success());
    let status: Value =
        serde_json::from_slice(&home.command(&["runtime", "status", "--json"], None).stdout)
            .unwrap();
    assert_eq!(status["desired"]["desired"]["capture"], false);
}

#[test]
fn receipt_inspection_reads_existing_ack_without_enqueue_or_scope_leak() {
    let home = Home::new();
    let scope: Value =
        serde_json::from_slice(&home.command(&["journal-scope"], None).stdout).unwrap();
    let batch = json!({"schema_version":1,"scope_id":scope["scope_id"],"items":[{"heartbeat_id":"receipt-fixture","time":1000.0,"entity":"fixture.rs","active_seconds":2.0}]});
    assert!(home
        .command(&["heartbeat-batch"], Some(&batch))
        .status
        .success());
    let before = home.queue().len().unwrap();
    let query = json!({"schema_version":1,"scope_id":scope["scope_id"],"ids":["receipt-fixture","missing"]});
    let result = home.command(&["journal-receipts"], Some(&query));
    assert!(result.status.success());
    let result: Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(result["results"][0]["status"], "accepted");
    assert_eq!(result["results"][1]["status"], "missing");
    assert!(result["results"][0]["input_hash"].as_str().unwrap().len() == 64);
    assert_eq!(home.queue().len().unwrap(), before);
    let foreign = json!({"schema_version":1,"scope_id":"foreign","ids":["receipt-fixture"]});
    assert!(!home
        .command(&["journal-receipts"], Some(&foreign))
        .status
        .success());
    assert!(!String::from_utf8_lossy(&result.to_string().into_bytes()).contains("fixture.rs"));
}

#[test]
fn idle_collector_reconciles_retained_producer_spool_without_new_activity() {
    let home = Home::new();
    let scope: Value =
        serde_json::from_slice(&home.command(&["journal-scope"], None).stdout).unwrap();
    let id = Uuid::new_v4().to_string();
    let root = home
        .0
        .join(".wakaclock/native-producer-spool")
        .join(scope["scope_id"].as_str().unwrap());
    fs::create_dir_all(&root).unwrap();
    let record = json!({"schema_version":1,"scope_id":scope["scope_id"],"adapter_id":"kimi-code-cli","execution_surface":"cli","observation_id":id,"observed_at":chrono::Utc::now(),"metadata":{"hook_event_name":"PreToolUse","session_id":"fixture-session","cwd":home.0,"tool_call_id":"fixture-operation"}});
    let file = root.join(format!("{id}.json"));
    fs::write(&file, record.to_string()).unwrap();
    let first = home.command(&["capture", "run", "--once"], None);
    assert!(
        first.status.success(),
        "{}",
        String::from_utf8_lossy(&first.stderr)
    );
    let state: Value = serde_json::from_slice(&first.stdout).unwrap();
    assert_eq!(state["producer_spool"]["accepted"], 1);
    assert!(state["pipeline"]
        .as_array()
        .unwrap()
        .iter()
        .any(|stage| stage["adapter_id"] == "kimi-code-cli"
            && stage["execution_surface"] == "cli"
            && stage["stage"] == "spool"
            && stage["status"] == "observed"));
    assert!(!file.exists());
    // Lost ACK/producer crash: replay exact original observation after inbox commit.
    fs::write(&file, record.to_string()).unwrap();
    let second = home.command(&["capture", "run", "--once"], None);
    assert!(second.status.success());
    let state: Value = serde_json::from_slice(&second.stdout).unwrap();
    assert_eq!(state["producer_spool"]["accepted"], 1);
    assert!(!file.exists());
    // Invalid content and foreign scope remain recoverable, never silently removed.
    let bad = root.join(format!("{}.json", Uuid::new_v4()));
    fs::write(&bad, r#"{"prompt":"SENSITIVE"}"#).unwrap();
    let foreign = home
        .0
        .join(".wakaclock/native-producer-spool")
        .join("b".repeat(64));
    fs::create_dir_all(&foreign).unwrap();
    fs::write(foreign.join("retained.json"), record.to_string()).unwrap();
    let third = home.command(&["capture", "run", "--once"], None);
    assert!(third.status.success());
    assert!(bad.exists());
    assert!(foreign.join("retained.json").exists());
    assert!(!String::from_utf8_lossy(&third.stdout).contains("SENSITIVE"));
}

#[test]
fn frozen_context_handoff_is_scoped_durable_and_idle_without_git_replay() {
    use sha2::{Digest, Sha256};
    let home = Home::new();
    let scope: Value =
        serde_json::from_slice(&home.command(&["journal-scope"], None).stdout).unwrap();
    let metadata = json!({"context_version":1,"binding":null,"native_session":"native-session","repository":"owner/repo","branch":"original-offline","commit_sha":null,"reason":null});
    let id = Uuid::new_v4();
    let record = json!({"schema_version":2,"scope_id":scope["scope_id"],"adapter_id":"codex","execution_surface":"unknown","observation_id":id,"observed_at":chrono::Utc::now(),"kind":"session_context","payload_hash":format!("{:x}",Sha256::digest(serde_json::to_vec(&metadata).unwrap())),"metadata":metadata});
    let batch = json!({"schema_version":2,"records":[record]});
    let first = home.command(&["ai", "producer-batch", "--json"], Some(&batch));
    assert!(first.status.success());
    let ack: Value = serde_json::from_slice(&first.stdout).unwrap();
    assert_eq!(ack["results"][0]["durable"], true);
    let replay: Value = serde_json::from_slice(
        &home
            .command(&["ai", "producer-batch", "--json"], Some(&batch))
            .stdout,
    )
    .unwrap();
    assert_eq!(replay["results"][0]["status"], "duplicate");
    let worker = home.command(&["capture", "run", "--once"], None);
    assert!(worker.status.success());
    let state: Value = serde_json::from_slice(&worker.stdout).unwrap();
    assert_eq!(state["context"]["pending"], 1);
    assert_ne!(state["context"]["status"], "observed");
    let db = rusqlite::Connection::open(home.0.join(".wakaclock/broker.db")).unwrap();
    let retained: String = db
        .query_row(
            "SELECT evidence FROM broker_context_observations WHERE id=?1",
            [id.to_string()],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        serde_json::from_str::<Value>(&retained).unwrap()["branch"],
        "original-offline"
    );
    assert_eq!(
        home.queue().len().unwrap(),
        0,
        "context cannot create heartbeat/usage"
    );
    let mut foreign = batch.clone();
    foreign["records"][0]["scope_id"] = json!("b".repeat(64));
    let rejected: Value = serde_json::from_slice(
        &home
            .command(&["ai", "producer-batch", "--json"], Some(&foreign))
            .stdout,
    )
    .unwrap();
    assert_ne!(rejected["results"][0]["durable"], true);
}
