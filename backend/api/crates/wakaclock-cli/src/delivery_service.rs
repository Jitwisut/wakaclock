//! Delivery-only service. It reads the durable queue, never captures activity.
use fs2::FileExt;
use serde_json::{json, Value};
use std::{fs, io::Write, path::PathBuf, process::Command, time::Duration};
use wakaclock_core::{api_client::ApiClient, config::Config, queue::Queue};
const LABEL: &str = "com.atoaxis.wakaclock.delivery";
fn directory() -> Result<PathBuf, Box<dyn std::error::Error>> {
    Ok(dirs::home_dir()
        .ok_or("home directory unavailable")?
        .join(".wakaclock"))
}
fn manifest_path() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let home = dirs::home_dir().ok_or("home directory unavailable")?;
    if cfg!(target_os = "macos") {
        Ok(home
            .join("Library/LaunchAgents")
            .join(format!("{LABEL}.plist")))
    } else {
        Ok(home.join(".config/systemd/user/wakaclock-delivery.service"))
    }
}
fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
pub fn status() -> Value {
    let Ok(dir) = directory() else {
        return json!({"running":false,"available":false});
    };
    let running = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(dir.join("delivery.lock"))
        .ok()
        .is_some_and(|file| file.try_lock_exclusive().is_err());
    let state = fs::read(dir.join("delivery-state.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok());
    json!({"running":running,"installed":manifest_path().is_ok_and(|path|path.exists()),"state":state})
}
pub async fn run(once: bool) -> Result<Value, Box<dyn std::error::Error>> {
    let dir = directory()?;
    fs::create_dir_all(&dir)?;
    let mut file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(dir.join("delivery.lock"))?;
    file.try_lock_exclusive()
        .map_err(|_| "delivery worker already running")?;
    file.set_len(0)?;
    writeln!(file, "{}", std::process::id())?;
    let mut interval = tokio::time::interval(Duration::from_secs(15));
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut config = Config::load();
    let mut history_at = std::time::Instant::now() - Duration::from_secs(60);
    loop {
        interval.tick().await;
        // Reload the credential/origin each round; queues remain scope-bound.
        if let Some(fresh) = Config::try_load() {
            config = fresh;
        }
        super::apply_env_overrides(&mut config)?;
        let api = ApiClient::new(config.clone())?;
        let started = std::time::Instant::now();
        let result = api.drain_delivery_tick().await;
        let queue = Queue::open();
        let summary = queue
            .as_ref()
            .ok()
            .and_then(|q| q.status_scoped(&api.queue_scope()).ok());
        let details = queue
            .as_ref()
            .ok()
            .and_then(|q| q.delivery_details_scoped(&api.queue_scope()).ok());
        let capture = crate::capture_service::status();
        let delivery_incomplete =
            result.is_err() || summary.is_none_or(|s| s.pending > 0 || s.dead_letter > 0);
        let capture_incomplete = capture["incomplete"].as_bool().unwrap_or(true);
        let state = json!({"schema_version":2,"checked_at":chrono::Utc::now(),
            "pid":std::process::id(),"version":env!("CARGO_PKG_VERSION"),"git_sha":env!("WAKACLOCK_GIT_SHA"),
            "pending":summary.map(|s|s.pending),"dead_letter":summary.map(|s|s.dead_letter),"details":details,
            "tick_elapsed_ms":started.elapsed().as_millis(),
            "oldest_pending_at":summary.and_then(|s|s.oldest_pending_at).and_then(|at|chrono::DateTime::from_timestamp(at,0)),
            "pending_age_seconds":summary.and_then(|s|s.oldest_pending_at).map(|at|(chrono::Utc::now().timestamp()-at).max(0)),
            "flushed":result.as_ref().ok().map(|r|r.flushed),"read_status":if summary.is_some(){"available"}else{"unavailable"},
            "error_code":if result.is_err(){Some("delivery_tick_failed")}else{None::<&str>},
            "capture":capture,
            "delivery_incomplete":delivery_incomplete,"capture_incomplete":capture_incomplete,
            "incomplete":delivery_incomplete || capture_incomplete});
        let temp = dir.join("delivery-state.tmp");
        fs::write(&temp, serde_json::to_vec(&state)?)?;
        fs::rename(temp, dir.join("delivery-state.json"))?;
        if history_at.elapsed() >= Duration::from_secs(60) {
            let history = dir.join("delivery-history");
            fs::create_dir_all(&history)?;
            let mut options = fs::OpenOptions::new();
            options.create(true).append(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            let mut log = options
                .open(history.join(format!("{}.jsonl", chrono::Local::now().date_naive())))?;
            use sha2::{Digest, Sha256};
            let scope = api.queue_scope();
            let entry = json!({"scope":format!("{:x}",Sha256::digest(format!("{}\n{}",scope.destination,scope.owner).as_bytes())),"observation":state});
            writeln!(log, "{}", entry)?;
            history_at = std::time::Instant::now();
        }
        // Await telemetry when idle too, so an empty queue never goes stale simply
        // because the user stopped typing. Capture rate remains once per minute.
        let _ = api.publish_delivery_status().await;
        if once {
            return Ok(state);
        }
    }
}
pub fn uninstall() -> Result<Value, Box<dyn std::error::Error>> {
    if cfg!(target_os = "macos") {
        let uid = String::from_utf8(Command::new("id").arg("-u").output()?.stdout)?
            .trim()
            .to_string();
        let _ = Command::new("launchctl")
            .args(["bootout", &format!("gui/{uid}/{LABEL}")])
            .output();
    } else if cfg!(target_os = "linux") {
        let _ = Command::new("systemctl")
            .args(["--user", "disable", "--now", "wakaclock-delivery.service"])
            .output();
    }
    let path = manifest_path()?;
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(status())
}
/// launchd unregisters a stopped job asynchronously. Do not race its old
/// registration when reinstalling, and never claim success if bootstrap fails.
pub(crate) fn bootstrap_launch_agent(
    uid: &str,
    label: &str,
    path: &std::path::Path,
) -> Result<(), Box<dyn std::error::Error>> {
    bootstrap_launch_agent_using(std::path::Path::new("launchctl"), uid, label, path)
}
fn bootstrap_launch_agent_using(
    launcher: &std::path::Path,
    uid: &str,
    label: &str,
    path: &std::path::Path,
) -> Result<(), Box<dyn std::error::Error>> {
    let domain = format!("gui/{uid}");
    // Only an explicit install reaches this helper. Clear the persistent launchd override.
    if !Command::new(launcher)
        .args(["enable", &format!("{domain}/{label}")])
        .output()?
        .status
        .success()
    {
        return Err("launchctl enable failed".into());
    }
    for _ in 0..30 {
        if !Command::new(launcher)
            .args(["print", &format!("{domain}/{label}")])
            .output()?
            .status
            .success()
        {
            break;
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    for _ in 0..3 {
        if Command::new(launcher)
            .args(["bootstrap", &domain])
            .arg(path)
            .output()?
            .status
            .success()
        {
            return Ok(());
        }
        std::thread::sleep(Duration::from_secs(1));
    }
    Err("launchctl bootstrap failed".into())
}

pub fn install(recovery_probe: bool) -> Result<Value, Box<dyn std::error::Error>> {
    if !cfg!(any(target_os = "macos", target_os = "linux")) {
        return Err("run `wakaclock delivery run` with your platform's service manager".into());
    }
    let _ = uninstall()?;
    let dir = directory()?;
    fs::create_dir_all(dir.join("bin"))?;
    // A separate runtime copy makes service upgrades atomic and reversible.
    let exe = dir.join("bin/wakaclock-delivery");
    let temp = dir.join("bin/wakaclock-delivery.new");
    fs::copy(std::env::current_exe()?, &temp)?;
    fs::rename(temp, &exe)?;
    let path = manifest_path()?;
    fs::create_dir_all(path.parent().ok_or("invalid manifest path")?)?;
    let content = if cfg!(target_os = "macos") {
        format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?><plist version=\"1.0\"><dict><key>Label</key><string>{LABEL}</string><key>ProgramArguments</key><array><string>{}</string><string>delivery</string><string>run</string></array><key>EnvironmentVariables</key><dict><key>HOME</key><string>{}</string><key>WAKACLOCK_RECOVERY_PROBE</key><string>{}</string></dict><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>15</integer><key>StandardOutPath</key><string>{}</string><key>StandardErrorPath</key><string>{}</string></dict></plist>",escape(&exe.to_string_lossy()),escape(&dirs::home_dir().unwrap().to_string_lossy()),if recovery_probe{"1"}else{"0"},escape(&dir.join("delivery.log").to_string_lossy()),escape(&dir.join("delivery.log").to_string_lossy()))
    } else {
        format!("[Unit]\nDescription=AtoAxis durable heartbeat delivery\n[Service]\nExecStart=\"{}\" delivery run\nEnvironment=WAKACLOCK_RECOVERY_PROBE={}\nRestart=always\nRestartSec=15\n[Install]\nWantedBy=default.target\n",exe.display(),if recovery_probe{"1"}else{"0"})
    };
    fs::write(&path, content)?;
    if cfg!(target_os = "macos") {
        let uid = String::from_utf8(Command::new("id").arg("-u").output()?.stdout)?
            .trim()
            .to_string();
        bootstrap_launch_agent(&uid, LABEL, &path)?;
    } else {
        if !Command::new("systemctl")
            .args(["--user", "daemon-reload"])
            .status()?
            .success()
        {
            return Err("systemd reload failed".into());
        }
        if !Command::new("systemctl")
            .args(["--user", "enable", "--now", "wakaclock-delivery.service"])
            .status()?
            .success()
        {
            return Err("systemd enable failed".into());
        }
    }
    Ok(status())
}

#[cfg(all(test, unix))]
mod launchd_recovery_tests {
    #[test]
    fn explicit_install_clears_persisted_disabled_state_before_bootstrap() {
        use std::os::unix::fs::PermissionsExt;
        let directory =
            std::env::temp_dir().join(format!("atoaxis-launchd-fixture-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir(&directory).unwrap();
        let launcher = directory.join("launchctl-fixture");
        std::fs::write(
            &launcher,
            br#"#!/bin/sh
case "$1" in
  enable) touch "$0.enabled"; exit 0 ;;
  print) exit 1 ;;
  bootstrap) test -f "$0.enabled"; exit $? ;;
  *) exit 1 ;;
esac
"#,
        )
        .unwrap();
        std::fs::set_permissions(&launcher, std::fs::Permissions::from_mode(0o700)).unwrap();
        // Simulated persisted-disabled job: bootstrap fails until the enable action runs.
        assert!(!std::process::Command::new(&launcher)
            .arg("bootstrap")
            .status()
            .unwrap()
            .success());
        super::bootstrap_launch_agent_using(
            &launcher,
            "fixture-user",
            "fixture-service",
            &directory.join("fixture.plist"),
        )
        .unwrap();
        std::fs::remove_dir_all(directory).unwrap();
    }
}
