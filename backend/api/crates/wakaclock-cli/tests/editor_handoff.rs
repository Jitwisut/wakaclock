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
