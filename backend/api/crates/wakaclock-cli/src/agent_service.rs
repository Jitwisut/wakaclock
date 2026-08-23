//! Per-user service lifecycle for the always-on transcript watcher.
//!
//! The watcher deliberately has a small dependency footprint: filesystem scans are
//! bounded by each parser and run every five seconds, while these manifests let the OS
//! restart the same binary after login/reboot without administrator privileges.

use serde::Serialize;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

const SERVICE_LABEL: &str = "com.atoaxis.wakaclock.agent";
#[cfg(target_os = "windows")]
const TASK_NAME: &str = "AtoAxis\\WakaclockAgent";
const MAX_LOG_BYTES: u64 = 5 * 1024 * 1024;

#[derive(Debug, Serialize)]
pub struct AgentServiceReport {
    pub platform: String,
    pub manifest: String,
    pub installed: bool,
    pub running: bool,
    pub message: Option<String>,
    pub last_scan_at: Option<u64>,
    pub last_heartbeat_at: Option<u64>,
    pub last_error: Option<String>,
}

pub struct AgentLock {
    path: PathBuf,
}

impl AgentLock {
    pub fn acquire() -> Result<Self, String> {
        let path = lock_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        match OpenOptions::new().write(true).create_new(true).open(&path) {
            Ok(mut file) => {
                writeln!(file, "{}", std::process::id()).map_err(|error| error.to_string())?;
                Ok(Self { path })
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                let pid = fs::read_to_string(&path)
                    .ok()
                    .and_then(|value| value.trim().parse::<u32>().ok());
                if pid.is_some_and(process_is_running) {
                    return Err(format!(
                        "wakaclock agent is already running{}",
                        pid.map(|pid| format!(" (pid {pid})")).unwrap_or_default()
                    ));
                }
                // A crashed process can leave its lock behind. Reclaim it only after
                // the PID check says it is no longer alive.
                fs::remove_file(&path).map_err(|remove_error| remove_error.to_string())?;
                let mut file = OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(&path)
                    .map_err(|retry_error| retry_error.to_string())?;
                writeln!(file, "{}", std::process::id())
                    .map_err(|write_error| write_error.to_string())?;
                Ok(Self { path })
            }
            Err(error) => Err(error.to_string()),
        }
    }
}

impl Drop for AgentLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

pub fn append_log(message: &str) {
    let path = log_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if fs::metadata(&path)
        .map(|metadata| metadata.len() > MAX_LOG_BYTES)
        .unwrap_or(false)
    {
        let rotated = path.with_extension("log.1");
        let _ = fs::remove_file(&rotated);
        let _ = fs::rename(&path, rotated);
    }
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or_default();
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{now} {message}");
    }
}

pub fn record_scan(success: bool, heartbeat_at: Option<u64>, error: Option<&str>) {
    let path = state_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let mut state = fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
        .filter(serde_json::Value::is_object)
        .unwrap_or_else(|| serde_json::json!({}));
    state["last_scan_at"] = serde_json::json!(now_seconds());
    // A scan is not necessarily a heartbeat. Preserve the last actual send unless
    // this call explicitly supplies a new timestamp (the service loop normally uses
    // `record_heartbeat` below when the CLI confirms a send or offline enqueue).
    if let Some(heartbeat_at) = heartbeat_at {
        state["last_heartbeat_at"] = serde_json::json!(heartbeat_at);
    }
    if !success {
        state["last_error"] = serde_json::Value::String(error.unwrap_or("scan failed").to_string());
    } else {
        state["last_error"] = serde_json::Value::Null;
    }
    let _ = fs::write(path, state.to_string());
}

/// Record the time at which an AI heartbeat was sent or durably queued. This is kept
/// separate from `record_scan`: a healthy scan that finds no new transcript event must
/// not make `agent status` look as though a heartbeat was emitted on every tick.
pub fn record_heartbeat() {
    let path = state_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let mut state = fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
        .filter(serde_json::Value::is_object)
        .unwrap_or_else(|| serde_json::json!({}));
    state["last_heartbeat_at"] = serde_json::json!(now_seconds());
    let _ = fs::write(path, state.to_string());
}

pub fn install() -> Result<AgentServiceReport, String> {
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let manifest = manifest_path();
    if let Some(parent) = manifest.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    #[cfg(target_os = "macos")]
    {
        let content = format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<plist version=\"1.0\"><dict>\n  <key>Label</key><string>{SERVICE_LABEL}</string>\n  <key>ProgramArguments</key><array><string>{}</string><string>agent</string><string>run</string></array>\n  <key>RunAtLoad</key><true/>\n  <key>KeepAlive</key><true/>\n  <key>ThrottleInterval</key><integer>5</integer>\n  <key>StandardOutPath</key><string>{}</string>\n  <key>StandardErrorPath</key><string>{}</string>\n</dict></plist>\n",
            xml_escape(&executable.to_string_lossy()),
            xml_escape(&log_path().to_string_lossy()),
            xml_escape(&log_path().to_string_lossy()),
        );
        fs::write(&manifest, content).map_err(|error| error.to_string())?;
        let domain = format!("gui/{}", uid());
        // Idempotent reinstall: an absent prior service is normal. Capture bootout's
        // stderr so macOS does not print the misleading "Boot-out failed: 5" warning
        // even though the subsequent bootstrap succeeds.
        let _ = Command::new("launchctl")
            .args(["bootout", &domain, manifest.to_string_lossy().as_ref()])
            .output();
        let status = Command::new("launchctl")
            .args(["bootstrap", &domain, manifest.to_string_lossy().as_ref()])
            .status()
            .map_err(|error| error.to_string())?;
        if !status.success() {
            return Err(format!("launchctl bootstrap failed with {status}"));
        }
        let _ = Command::new("launchctl")
            .args(["kickstart", "-k", &format!("{domain}/{SERVICE_LABEL}")])
            .status();
        return Ok(report("macOS", manifest, true, true, None));
    }

    #[cfg(target_os = "linux")]
    {
        let content = format!(
            "[Unit]\nDescription=Wakaclock transcript heartbeat agent\nAfter=graphical-session.target\n\n[Service]\nType=simple\nExecStart={} agent run\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=default.target\n",
            shell_escape(&executable.to_string_lossy())
        );
        fs::write(&manifest, content).map_err(|error| error.to_string())?;
        run_command("systemctl", &["--user", "daemon-reload"])?;
        run_command(
            "systemctl",
            &[
                "--user",
                "enable",
                "--now",
                "atoaxis-wakaclock-agent.service",
            ],
        )?;
        return Ok(report("Linux", manifest, true, true, None));
    }

    #[cfg(target_os = "windows")]
    {
        let content = format!("{} agent run\r\n", executable.display());
        fs::write(&manifest, content).map_err(|error| error.to_string())?;
        let command = format!("\"{}\" agent run", executable.display());
        run_command(
            "schtasks",
            &[
                "/Create", "/SC", "ONLOGON", "/TN", TASK_NAME, "/TR", &command, "/F",
            ],
        )?;
        let _ = Command::new("schtasks")
            .args(["/Run", "/TN", TASK_NAME])
            .status();
        return Ok(report("Windows", manifest, true, true, None));
    }

    #[allow(unreachable_code)]
    Err("unsupported operating system".to_string())
}

pub fn uninstall() -> Result<AgentServiceReport, String> {
    let manifest = manifest_path();
    #[cfg(target_os = "macos")]
    {
        let domain = format!("gui/{}", uid());
        let _ = Command::new("launchctl")
            .args(["bootout", &domain, manifest.to_string_lossy().as_ref()])
            .status();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("systemctl")
            .args([
                "--user",
                "disable",
                "--now",
                "atoaxis-wakaclock-agent.service",
            ])
            .status();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("schtasks")
            .args(["/Delete", "/TN", TASK_NAME, "/F"])
            .status();
    }
    let _ = fs::remove_file(&manifest);
    Ok(report(platform_name(), manifest, false, false, None))
}

pub fn start() -> Result<AgentServiceReport, String> {
    #[cfg(target_os = "macos")]
    {
        let domain = format!("gui/{}", uid());
        run_command(
            "launchctl",
            &["kickstart", "-k", &format!("{domain}/{SERVICE_LABEL}")],
        )?;
    }
    #[cfg(target_os = "linux")]
    run_command(
        "systemctl",
        &["--user", "start", "atoaxis-wakaclock-agent.service"],
    )?;
    #[cfg(target_os = "windows")]
    run_command("schtasks", &["/Run", "/TN", TASK_NAME])?;
    Ok(report(platform_name(), manifest_path(), true, true, None))
}

pub fn stop() -> Result<AgentServiceReport, String> {
    #[cfg(target_os = "macos")]
    {
        let domain = format!("gui/{}", uid());
        let _ = Command::new("launchctl")
            .args(["kill", "SIGTERM", &format!("{domain}/{SERVICE_LABEL}")])
            .status();
    }
    #[cfg(target_os = "linux")]
    run_command(
        "systemctl",
        &["--user", "stop", "atoaxis-wakaclock-agent.service"],
    )?;
    #[cfg(target_os = "windows")]
    run_command("schtasks", &["/End", "/TN", TASK_NAME])?;
    Ok(report(platform_name(), manifest_path(), true, false, None))
}

pub fn status() -> AgentServiceReport {
    let lock = fs::read_to_string(lock_path()).ok();
    let running = lock
        .as_deref()
        .and_then(|pid| pid.trim().parse::<u32>().ok())
        .is_some_and(process_is_running);
    let message = fs::read_to_string(log_path())
        .ok()
        .and_then(|content| content.lines().last().map(str::to_string));
    let mut result = report(
        platform_name(),
        manifest_path(),
        manifest_path().exists(),
        running,
        message,
    );
    if let Ok(content) = fs::read_to_string(state_path()) {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) {
            result.last_scan_at = value
                .get("last_scan_at")
                .and_then(serde_json::Value::as_u64);
            result.last_heartbeat_at = value
                .get("last_heartbeat_at")
                .and_then(serde_json::Value::as_u64);
            result.last_error = value
                .get("last_error")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string);
        }
    }
    result
}

fn report(
    platform: &str,
    manifest: PathBuf,
    installed: bool,
    running: bool,
    message: Option<String>,
) -> AgentServiceReport {
    let state = fs::read_to_string(state_path())
        .ok()
        .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok());
    AgentServiceReport {
        platform: platform.to_string(),
        manifest: manifest.display().to_string(),
        installed,
        running,
        message,
        last_scan_at: state
            .as_ref()
            .and_then(|value| value.get("last_scan_at"))
            .and_then(serde_json::Value::as_u64),
        last_heartbeat_at: state
            .as_ref()
            .and_then(|value| value.get("last_heartbeat_at"))
            .and_then(serde_json::Value::as_u64),
        last_error: state
            .as_ref()
            .and_then(|value| value.get("last_error"))
            .and_then(serde_json::Value::as_str)
            .map(str::to_string),
    }
}

fn wakaclock_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".wakaclock")
}

fn lock_path() -> PathBuf {
    wakaclock_dir().join("agent.lock")
}

fn log_path() -> PathBuf {
    wakaclock_dir().join("agent.log")
}

fn state_path() -> PathBuf {
    wakaclock_dir().join("agent-state.json")
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_secs())
        .unwrap_or_default()
}

fn manifest_path() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        return dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Library/LaunchAgents")
            .join(format!("{SERVICE_LABEL}.plist"));
    }
    #[cfg(target_os = "linux")]
    {
        return dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".config/systemd/user/atoaxis-wakaclock-agent.service");
    }
    #[cfg(target_os = "windows")]
    {
        return wakaclock_dir().join("agent-task.txt");
    }
    #[allow(unreachable_code)]
    wakaclock_dir().join("agent.service")
}

fn platform_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "macOS"
    } else if cfg!(target_os = "linux") {
        "Linux"
    } else if cfg!(target_os = "windows") {
        "Windows"
    } else {
        std::env::consts::OS
    }
}

fn uid() -> String {
    std::env::var("UID").unwrap_or_else(|_| {
        Command::new("id")
            .arg("-u")
            .output()
            .ok()
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "0".to_string())
    })
}

fn process_is_running(pid: u32) -> bool {
    if pid == 0 {
        return false;
    }
    #[cfg(unix)]
    {
        return Command::new("kill")
            .args(["-0", &pid.to_string()])
            .status()
            .map(|status| status.success())
            .unwrap_or(false);
    }
    #[cfg(windows)]
    {
        return Command::new("tasklist")
            .args(["/FI", &format!("PID eq {pid}")])
            .output()
            .map(|output| String::from_utf8_lossy(&output.stdout).contains(&pid.to_string()))
            .unwrap_or(false);
    }
    #[allow(unreachable_code)]
    false
}

fn run_command(program: &str, args: &[&str]) -> Result<(), String> {
    let status = Command::new(program)
        .args(args)
        .status()
        .map_err(|error| format!("failed to run {program}: {error}"))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("{program} exited with {status}"))
    }
}

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(target_os = "linux")]
fn shell_escape(value: &str) -> String {
    if value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || "/._-".contains(character))
    {
        value.to_string()
    } else {
        format!("'{}'", value.replace('\'', "'\\''"))
    }
}
