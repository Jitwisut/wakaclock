//! Per-user service lifecycle for the always-on AI Activity Broker.
//!
//! The watcher deliberately has a small dependency footprint: filesystem scans are
//! bounded by the broker worker and transcript parsers, while these manifests let the OS
//! restart the same binary after login/reboot without administrator privileges.

use fs2::FileExt;
use serde::Serialize;
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::PathBuf,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

#[cfg(target_os = "macos")]
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
    // Keep the descriptor open for the whole broker lifetime.  The OS-level lock
    // is the ownership boundary; a PID text file alone races during launchd/systemd
    // restart when the old process drops its path after the new one has started.
    _file: fs::File,
}

impl AgentLock {
    pub fn acquire() -> Result<Self, String> {
        Self::acquire_at(lock_path())
    }

    /// planai2.md Phase 0.2: the singleton-lock body, parameterised on the lock
    /// path so the "a second broker cannot start while the first holds the lock,
    /// and a crashed broker's stale lock is reclaimed" invariant is unit-testable
    /// against a temp path instead of the real `~/.wakaclock/agent.lock`.
    pub fn acquire_at(path: PathBuf) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(&path)
            .map_err(|error| error.to_string())?;

        // The advisory OS lock is the ownership boundary. Do not trust the PID
        // text before acquiring it: after a crash, the OS may reuse that PID for
        // an unrelated process, which would otherwise create a false singleton.
        // PID-only lock files from older releases remain reclaimable when no
        // broker currently holds the OS lease.
        let current_pid = std::process::id();

        file.try_lock_exclusive().map_err(|error| {
            if error.kind() == std::io::ErrorKind::WouldBlock {
                "wakaclock agent is already running".to_string()
            } else {
                format!("could not acquire wakaclock agent lock: {error}")
            }
        })?;
        file.set_len(0).map_err(|error| error.to_string())?;
        writeln!(file, "{current_pid}").map_err(|error| error.to_string())?;
        Ok(Self { _file: file })
    }
}

// `AgentLock` deliberately has no custom Drop implementation: dropping the held
// `fs::File` closes the descriptor and releases the OS lock, while the path stays
// in place so a concurrent restart can acquire it without a delete/recreate race.

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

/// planai2.md Phase 0.2: the exact bytes of the per-user service manifest, as a
/// pure function of the target executable (and, on macOS, the log path). Kept
/// separate from `install()` so the idempotence invariant — "installing twice
/// writes one identical service definition" — is unit-testable without shelling
/// out to launchctl / systemctl / schtasks. There is exactly one `broker run`
/// invocation in every platform's output.
#[cfg(target_os = "macos")]
fn manifest_content(executable: &str, log_path: &str) -> String {
    // LaunchAgents do not inherit HOME reliably (launchd only supplies a small
    // default environment).  The broker resolves all per-user state through
    // dirs::home_dir(), so pin HOME to the same home directory that owns the
    // generated log path.  Without this, a login-started broker falls back to
    // its `/` working directory, cannot acquire ~/.wakaclock/agent.lock, and
    // silently exits before transcript auto-scan starts.
    let home = std::path::Path::new(log_path)
        .parent()
        .and_then(std::path::Path::parent)
        .unwrap_or_else(|| std::path::Path::new("/"));
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<plist version=\"1.0\"><dict>\n  <key>Label</key><string>{SERVICE_LABEL}</string>\n  <key>ProgramArguments</key><array><string>{}</string><string>broker</string><string>run</string></array>\n  <key>EnvironmentVariables</key><dict><key>HOME</key><string>{}</string></dict>\n  <key>RunAtLoad</key><true/>\n  <key>KeepAlive</key><true/>\n  <key>ThrottleInterval</key><integer>5</integer>\n  <key>StandardOutPath</key><string>{}</string>\n  <key>StandardErrorPath</key><string>{}</string>\n</dict></plist>\n",
        xml_escape(executable),
        xml_escape(&home.to_string_lossy()),
        xml_escape(log_path),
        xml_escape(log_path),
    )
}

#[cfg(target_os = "linux")]
fn manifest_content(executable: &str, _log_path: &str) -> String {
    format!(
        "[Unit]\nDescription=Wakaclock AI Activity Broker\nAfter=graphical-session.target\n\n[Service]\nType=simple\nExecStart={} broker run\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=default.target\n",
        shell_escape(executable)
    )
}

#[cfg(target_os = "windows")]
fn manifest_content(executable: &str, _log_path: &str) -> String {
    format!("{executable} broker run\r\n")
}

// A stub so the pure test below still compiles on unsupported targets.
#[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
fn manifest_content(executable: &str, _log_path: &str) -> String {
    format!("{executable} broker run\n")
}

/// Keep the macOS LaunchAgent executable outside project folders such as
/// Desktop. macOS can re-scan a freshly rebuilt project binary under a
/// background launch context and leave the process in dyld before `main`; a
/// per-user runtime copy gives launchd a stable, user-owned executable path.
#[cfg(target_os = "macos")]
fn service_executable_path() -> PathBuf {
    wakaclock_dir().join("bin").join("wakaclock")
}

fn service_executable() -> Result<PathBuf, String> {
    let current = std::env::current_exe().map_err(|error| error.to_string())?;
    #[cfg(target_os = "macos")]
    {
        let target = service_executable_path();
        let current_identity = fs::canonicalize(&current).unwrap_or_else(|_| current.clone());
        let target_identity = fs::canonicalize(&target).unwrap_or_else(|_| target.clone());
        if current_identity != target_identity {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            let permissions = fs::metadata(&current)
                .map_err(|error| error.to_string())?
                .permissions();
            let temporary = target.with_file_name(format!("wakaclock.tmp-{}", std::process::id()));
            fs::copy(&current, &temporary).map_err(|error| {
                format!(
                    "could not copy wakaclock runtime to {}: {error}",
                    target.display()
                )
            })?;
            fs::set_permissions(&temporary, permissions).map_err(|error| error.to_string())?;
            fs::rename(&temporary, &target).map_err(|error| {
                format!(
                    "could not activate wakaclock runtime at {}: {error}",
                    target.display()
                )
            })?;
        }
        #[allow(clippy::needless_return)]
        return Ok(target);
    }
    #[cfg(not(target_os = "macos"))]
    Ok(current)
}

pub fn install() -> Result<AgentServiceReport, String> {
    let executable = service_executable()?;
    let manifest = manifest_path();
    if let Some(parent) = manifest.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let content = manifest_content(&executable.to_string_lossy(), &log_path().to_string_lossy());

    #[cfg(target_os = "macos")]
    {
        fs::write(&manifest, &content).map_err(|error| error.to_string())?;
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
        let running = running_probe().unwrap_or(false);
        return Ok(report("macOS", manifest, true, running, None));
    }

    #[cfg(target_os = "linux")]
    {
        fs::write(&manifest, &content).map_err(|error| error.to_string())?;
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
        let running = running_probe().unwrap_or(false);
        return Ok(report("Linux", manifest, true, running, None));
    }

    #[cfg(target_os = "windows")]
    {
        fs::write(&manifest, &content).map_err(|error| error.to_string())?;
        let command = format!("\"{}\" broker run", executable.display());
        run_command(
            "schtasks",
            &[
                "/Create", "/SC", "ONLOGON", "/TN", TASK_NAME, "/TR", &command, "/F",
            ],
        )?;
        let _ = Command::new("schtasks")
            .args(["/Run", "/TN", TASK_NAME])
            .status();
        let running = running_probe().unwrap_or(false);
        return Ok(report("Windows", manifest, true, running, None));
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    let _ = (&content, &manifest);
    #[allow(unreachable_code)]
    Err("unsupported operating system".to_string())
}

/// planai2.md Phase 0.1: an older CLI wrote this service manifest to invoke the
/// `agent` subcommand alias (`wakaclock agent run`). The current binary's broker
/// lives at `wakaclock broker run`; a manifest still pointing at the old alias
/// keeps launchd / systemd / Task Scheduler restarting a code path that no longer
/// exists. Detection is pure text — the generated manifests carry no user
/// configuration, on any platform.
fn content_uses_legacy_alias(content: &str) -> bool {
    let has_broker_run =
        content.contains("broker</string><string>run") || content.contains("broker run");
    let mentions_agent_run =
        content.contains("agent</string><string>run") || content.contains("agent run");
    mentions_agent_run && !has_broker_run
}

/// True when the installed service manifest still invokes the legacy `agent run`
/// alias instead of `broker run`. `false` when the manifest is current or absent.
pub fn manifest_uses_legacy_alias() -> bool {
    fs::read_to_string(manifest_path())
        .map(|content| content_uses_legacy_alias(&content))
        .unwrap_or(false)
}

/// Rewrite a legacy-alias service manifest to the current `broker run` form and
/// re-register it with the OS. Returns `Ok(false)` (a no-op) when the manifest is
/// already current or absent. Non-destructive: the generated manifest has no user
/// configuration to preserve, so this is a plain `install()`.
pub fn migrate_legacy_service_manifest() -> Result<bool, String> {
    if !manifest_uses_legacy_alias() && !manifest_points_at_stale_binary() {
        return Ok(false);
    }
    install()?;
    Ok(true)
}

/// planai2.md Phase 0.2: the executable path baked into a service manifest, so a
/// caller can tell whether launchd / systemd / Task Scheduler is still pointed at
/// a binary that a CLI upgrade has since moved or replaced. Pure text extraction —
/// the manifest layouts are fixed by `manifest_content`.
fn executable_in_manifest(content: &str) -> Option<String> {
    // macOS plist: first <string> inside <array>, before the <string>broker</string>.
    if let Some(rest) = content.split("<array><string>").nth(1) {
        if let Some(path) = rest.split("</string>").next() {
            return Some(
                path.replace("&amp;", "&")
                    .replace("&lt;", "<")
                    .replace("&gt;", ">")
                    .replace("&quot;", "\"")
                    .replace("&apos;", "'"),
            );
        }
    }
    // systemd: `ExecStart=<path> broker run`
    if let Some(rest) = content.split("ExecStart=").nth(1) {
        let line = rest.lines().next().unwrap_or_default();
        if let Some(path) = line.strip_suffix(" broker run") {
            return Some(path.trim().trim_matches('\'').to_string());
        }
    }
    // Windows: `"<path>" broker run` or `<path> broker run`
    if let Some(path) = content.trim().strip_suffix(" broker run") {
        return Some(path.trim().trim_matches('"').to_string());
    }
    None
}

/// True when the installed service manifest names an executable path other than
/// the active service runtime (compared canonically, so a symlink or a relative
/// spelling of the same file is not a mismatch). `false` when the manifest is
/// absent, unparseable, or already current — a missing answer is not a mismatch.
pub fn manifest_points_at_stale_binary() -> bool {
    let Ok(content) = fs::read_to_string(manifest_path()) else {
        return false;
    };
    let Some(manifest_exe) = executable_in_manifest(&content) else {
        return false;
    };
    let Ok(current) = std::env::current_exe() else {
        return false;
    };
    #[cfg(target_os = "macos")]
    let expected = {
        let installed = service_executable_path();
        if installed.exists() {
            installed
        } else {
            current.clone()
        }
    };
    #[cfg(not(target_os = "macos"))]
    let expected = current.clone();
    let canon = |p: &std::path::Path| fs::canonicalize(p).ok();
    match (canon(std::path::Path::new(&manifest_exe)), canon(&expected)) {
        (Some(a), Some(b)) => a != b,
        // The manifest path no longer resolves to a real file → definitely stale.
        (None, Some(_)) => true,
        _ => false,
    }
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
    let running = running_probe().unwrap_or(false);
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

/// Probe the service lock using the OS lease rather than the PID text stored in
/// it. Malformed or stale PID-only contents are harmless; an unreadable lock
/// remains an error so diagnostics can mark the measurement unavailable.
pub fn running_probe() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        // A LaunchAgent can be alive while the sandbox denies `kill -0` against
        // its PID. Ask launchd first, but a healthy manually-started broker has no
        // LaunchAgent entry and still owns the same lock. A negative launchd answer
        // therefore must fall back to the lock rather than overriding live runtime
        // evidence.
        match launchd_running_probe() {
            Ok(true) => Ok(true),
            Ok(false) | Err(_) => running_probe_at(lock_path()),
        }
    }
    #[cfg(not(target_os = "macos"))]
    running_probe_at(lock_path())
}

#[cfg(target_os = "macos")]
fn launchd_running_probe() -> Result<bool, String> {
    let domain = format!("gui/{}/{}", uid(), SERVICE_LABEL);
    let output = Command::new("launchctl")
        .args(["print", &domain])
        .output()
        .map_err(|error| format!("could not query launchd: {error}"))?;
    if !output.status.success() {
        let message = String::from_utf8_lossy(&output.stderr).to_ascii_lowercase();
        if message.contains("could not find service") || message.contains("service not found") {
            return Ok(false);
        }
        return Err("launchd service query failed".to_string());
    }
    parse_launchd_state(&String::from_utf8_lossy(&output.stdout))
}

#[cfg(target_os = "macos")]
fn parse_launchd_state(output: &str) -> Result<bool, String> {
    let state = output
        .lines()
        .find_map(|line| line.trim().strip_prefix("state = "))
        .ok_or_else(|| "launchd service state was unavailable".to_string())?;
    Ok(state == "running")
}

fn running_probe_at(path: PathBuf) -> Result<bool, String> {
    let file = match OpenOptions::new().read(true).write(true).open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(format!("could not open agent lock: {error}")),
    };
    match file.try_lock_exclusive() {
        Ok(()) => Ok(false),
        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => Ok(true),
        Err(error) => Err(format!("could not probe agent lock: {error}")),
    }
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

#[cfg(target_os = "macos")]
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

#[cfg(target_os = "macos")]
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

#[cfg(test)]
mod tests {
    use super::{
        content_uses_legacy_alias, executable_in_manifest, manifest_content, running_probe_at,
        AgentLock,
    };
    use std::fs;

    // Exact shape an old CLI wrote, per platform.
    const LEGACY_PLIST: &str = "<plist version=\"1.0\"><dict>\n  <key>ProgramArguments</key><array><string>/usr/local/bin/wakaclock</string><string>agent</string><string>run</string></array>\n</dict></plist>\n";
    const LEGACY_SYSTEMD: &str =
        "[Service]\nType=simple\nExecStart=/usr/local/bin/wakaclock agent run\nRestart=always\n";
    const LEGACY_WINDOWS: &str = "\"C:\\bin\\wakaclock.exe\" agent run\r\n";

    // Exact shape the current `install()` writes.
    const CURRENT_PLIST: &str = "<plist version=\"1.0\"><dict>\n  <key>ProgramArguments</key><array><string>/usr/local/bin/wakaclock</string><string>broker</string><string>run</string></array>\n</dict></plist>\n";
    const CURRENT_SYSTEMD: &str =
        "[Service]\nType=simple\nExecStart=/usr/local/bin/wakaclock broker run\nRestart=always\n";
    const CURRENT_WINDOWS: &str = "\"C:\\bin\\wakaclock.exe\" broker run\r\n";

    #[test]
    fn detects_the_legacy_agent_run_alias_on_every_platform() {
        assert!(content_uses_legacy_alias(LEGACY_PLIST));
        assert!(content_uses_legacy_alias(LEGACY_SYSTEMD));
        assert!(content_uses_legacy_alias(LEGACY_WINDOWS));
    }

    #[test]
    fn a_current_broker_run_manifest_is_not_flagged() {
        assert!(!content_uses_legacy_alias(CURRENT_PLIST));
        assert!(!content_uses_legacy_alias(CURRENT_SYSTEMD));
        assert!(!content_uses_legacy_alias(CURRENT_WINDOWS));
        assert!(!content_uses_legacy_alias(""));
    }

    #[test]
    fn install_manifest_is_deterministic_and_has_exactly_one_broker_run() {
        // planai2.md p0.2: installing twice must write one identical service
        // definition, so the pure content function must be a deterministic
        // function of its inputs with a single `broker run` invocation.
        let a = manifest_content("/opt/atoaxis/wakaclock", "/home/u/.wakaclock/agent.log");
        let b = manifest_content("/opt/atoaxis/wakaclock", "/home/u/.wakaclock/agent.log");
        assert_eq!(a, b);
        assert_eq!(
            a.matches("broker run").count() + a.matches("broker</string>").count(),
            1
        );
        assert!(a.contains("/opt/atoaxis/wakaclock"));
        // launchd does not reliably inherit HOME, so only the macOS plist pins it
        // explicitly (see manifest_content's macOS branch); systemd and Windows
        // manifests have no equivalent key.
        #[cfg(target_os = "macos")]
        assert!(a.contains(
            "<key>EnvironmentVariables</key><dict><key>HOME</key><string>/home/u</string>"
        ));

        let other = manifest_content("/opt/atoaxis/wakaclock-new", "/home/u/.wakaclock/agent.log");
        assert_ne!(a, other);
    }

    #[test]
    fn executable_path_round_trips_out_of_every_manifest_shape() {
        assert_eq!(
            executable_in_manifest(CURRENT_PLIST).as_deref(),
            Some("/usr/local/bin/wakaclock")
        );
        assert_eq!(
            executable_in_manifest(CURRENT_SYSTEMD).as_deref(),
            Some("/usr/local/bin/wakaclock")
        );
        assert_eq!(
            executable_in_manifest(CURRENT_WINDOWS).as_deref(),
            Some("C:\\bin\\wakaclock.exe")
        );
        assert_eq!(executable_in_manifest(""), None);
    }

    #[test]
    fn singleton_lock_rejects_a_second_broker_and_reclaims_a_dead_one() {
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-agentlock-test-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).unwrap();
        let lock = dir.join("agent.lock");

        let held = AgentLock::acquire_at(lock.clone()).expect("first broker takes the lock");
        assert!(
            AgentLock::acquire_at(lock.clone()).is_err(),
            "a second broker must not start while the first holds the lock"
        );

        drop(held);
        // Clean release → the next broker can start.
        let after = AgentLock::acquire_at(lock.clone());
        assert!(after.is_ok(), "the lock is free once the holder drops it");
        drop(after);

        // A crashed broker leaves a stale PID-only lock file. The OS lease, not
        // the text in that file, decides whether a broker is actually running.
        fs::write(&lock, "0\n").unwrap();
        assert!(
            AgentLock::acquire_at(lock.clone()).is_ok(),
            "a stale lock from a dead PID is reclaimed, not a permanent block"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn diagnostics_probe_distinguishes_missing_and_malformed_lock_files() {
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-agentprobe-test-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).unwrap();
        let lock = dir.join("agent.lock");

        assert!(!running_probe_at(lock.clone()).unwrap());
        fs::write(&lock, "not-a-pid\n").unwrap();
        assert!(!running_probe_at(lock.clone()).unwrap());
        fs::write(&lock, "0\n").unwrap();
        assert!(!running_probe_at(lock).unwrap());

        let _ = fs::remove_dir_all(&dir);
    }

    #[cfg(unix)]
    #[test]
    fn live_unrelated_pid_in_a_stale_lock_does_not_block_acquisition() {
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-agentlock-pid-reuse-test-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).unwrap();
        let lock = dir.join("agent.lock");
        // The test runner itself is a live, non-broker process. Using its PID
        // avoids spawning a child that could inherit another parallel test's
        // lock descriptor on macOS.
        fs::write(&lock, format!("{}\n", std::process::id())).unwrap();

        let acquired = AgentLock::acquire_at(lock);
        assert!(
            acquired.is_ok(),
            "a live unrelated PID in a stale lock file must not block the broker"
        );
        drop(acquired);
        let _ = fs::remove_dir_all(&dir);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn launchd_state_parser_reports_running_without_pid_probe() {
        assert!(super::parse_launchd_state("state = running\npid = 123\n").unwrap());
        assert!(!super::parse_launchd_state("state = waiting\n").unwrap());
        assert!(super::parse_launchd_state("pid = 123\n").is_err());
    }
}
