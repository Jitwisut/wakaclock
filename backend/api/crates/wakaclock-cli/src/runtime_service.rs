//! Per-user service ownership and versioned binaries. No Docker or credentials.
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    error::Error,
    fs,
    path::{Path, PathBuf},
    process::Command,
};

#[derive(Clone, Serialize, Deserialize)]
struct Installed {
    active: PathBuf,
    previous: Option<PathBuf>,
    sha256: String,
}
fn label(component: &str) -> Result<String, Box<dyn Error>> {
    if !["capture", "delivery"].contains(&component) {
        return Err("service_component_invalid".into());
    }
    Ok(format!("com.atoaxis.wakaclock.{component}"))
}
fn directory() -> Result<PathBuf, Box<dyn Error>> {
    Ok(wakaclock_core::runtime::directory()?.join("services"))
}
fn installation_lock() -> Result<fs::File, Box<dyn Error>> {
    let dir = directory()?;
    fs::create_dir_all(&dir)?;
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(dir.join("install.lock"))?;
    lock.lock_exclusive()?;
    Ok(lock)
}
fn pointer(component: &str) -> Result<PathBuf, Box<dyn Error>> {
    label(component)?;
    Ok(directory()?.join(format!("{component}.json")))
}
pub(crate) fn manifest(component: &str) -> Result<PathBuf, Box<dyn Error>> {
    let home = dirs::home_dir().ok_or("service_home_unavailable")?;
    if cfg!(target_os = "macos") {
        Ok(home
            .join("Library/LaunchAgents")
            .join(format!("{}.plist", label(component)?)))
    } else if cfg!(target_os = "windows") {
        Ok(directory()?.join(format!("{component}.xml")))
    } else {
        Err("service_platform_unsupported".into())
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
pub fn service_manifest(
    component: &str,
    executable: &Path,
    sid: &str,
) -> Result<String, Box<dyn Error>> {
    let executable = escape(&executable.to_string_lossy());
    let name = label(component)?;
    if !sid.is_empty() {
        if !sid.starts_with("S-1-")
            || sid
                .chars()
                .any(|c| !c.is_ascii_digit() && c != 'S' && c != '-')
        {
            return Err("service_identity_invalid".into());
        }
        Ok(format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Task version=\"1.2\" xmlns=\"http://schemas.microsoft.com/windows/2004/02/mit/task\"><RegistrationInfo><Description>AtoAxis owned per-user {component}</Description></RegistrationInfo><Triggers><LogonTrigger><Enabled>true</Enabled><UserId>{sid}</UserId></LogonTrigger></Triggers><Principals><Principal id=\"Owner\"><UserId>{sid}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><StartWhenAvailable>true</StartWhenAvailable><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><RestartOnFailure><Interval>PT1M</Interval><Count>999</Count></RestartOnFailure></Settings><Actions Context=\"Owner\"><Exec><Command>{executable}</Command><Arguments>{component} run</Arguments></Exec></Actions></Task>"))
    } else {
        Ok(format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?><plist version=\"1.0\"><dict><key>Label</key><string>{name}</string><key>ProgramArguments</key><array><string>{executable}</string><string>{component}</string><string>run</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>15</integer></dict></plist>"))
    }
}
fn sid() -> Result<String, Box<dyn Error>> {
    let out = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
        ])
        .output()?;
    if !out.status.success() {
        return Err("service_identity_unavailable".into());
    }
    Ok(String::from_utf8(out.stdout)?.trim().to_string())
}
fn task(component: &str) -> Result<String, Box<dyn Error>> {
    Ok(format!("{}-{}", label(component)?, sid()?))
}
fn registered_task_hash(component: &str) -> Result<Option<String>, Box<dyn Error>> {
    // Task names are built exclusively from the validated component and SID.
    // Enumerating the root distinguishes absence from access/API failure.
    let name = task(component)?;
    let script = format!("$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); try {{ $t=@(Get-ScheduledTask -TaskPath '\\' -ErrorAction Stop | Where-Object {{ $_.TaskName -eq '{name}' }}); if($t.Count -eq 0) {{ exit 3 }}; if($t.Count -ne 1) {{ exit 1 }}; [Console]::Write((Export-ScheduledTask -InputObject $t[0] -ErrorAction Stop)); }} catch {{ exit 1 }}");
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()?;
    match output.status.code() {
        Some(3) => Ok(None),
        Some(0) if !output.stdout.is_empty() => {
            Ok(Some(format!("{:x}", Sha256::digest(&output.stdout))))
        }
        _ => Err("service_registration_read_unconfirmed".into()),
    }
}
fn task_receipt(component: &str) -> Result<PathBuf, Box<dyn Error>> {
    label(component)?;
    Ok(directory()?.join(format!("{component}-registration.sha256")))
}
fn verify_registered_task(component: &str) -> Result<(), Box<dyn Error>> {
    if !cfg!(target_os = "windows") {
        return Ok(());
    }
    if let Some(actual) = registered_task_hash(component)? {
        let expected = fs::read_to_string(task_receipt(component)?)
            .map_err(|_| "service_existing_ownership_unconfirmed")?;
        if actual != expected.trim() {
            return Err("service_configuration_changed_by_owner".into());
        }
    }
    Ok(())
}
fn stop(component: &str) -> Result<(), Box<dyn Error>> {
    if cfg!(target_os = "macos") {
        let uid = String::from_utf8(Command::new("id").arg("-u").output()?.stdout)?
            .trim()
            .to_string();
        let _ = Command::new("launchctl")
            .args(["bootout", &format!("gui/{uid}/{}", label(component)?)])
            .output()?;
    } else if cfg!(target_os = "windows") {
        let _ = Command::new("schtasks.exe")
            .args(["/End", "/TN", &task(component)?])
            .output()?;
    } else {
        return Err("service_platform_unsupported".into());
    }
    // A manual process or a failed service stop may still own the worker lock.
    // Never start a replacement merely because the OS manager returned.
    let began = std::time::Instant::now();
    while worker_locked(component)? {
        if began.elapsed() > std::time::Duration::from_secs(10) {
            return Err("service_stop_not_confirmed".into());
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    Ok(())
}
fn worker_locked(component: &str) -> Result<bool, Box<dyn Error>> {
    let path = wakaclock_core::runtime::directory()?.join(format!("{component}.lock"));
    if !path.exists() {
        return Ok(false);
    }
    let lock = fs::OpenOptions::new().read(true).write(true).open(path)?;
    match lock.try_lock_exclusive() {
        Ok(()) => Ok(false),
        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => Ok(true),
        Err(error) => Err(error.into()),
    }
}
pub(crate) fn executable_hash() -> Result<String, Box<dyn Error>> {
    Ok(format!(
        "{:x}",
        Sha256::digest(fs::read(std::env::current_exe()?)?)
    ))
}
fn legacy_manifest(component: &str, home: &Path, executable: &Path, probe: bool) -> String {
    let name = format!("com.atoaxis.wakaclock.{component}");
    if component == "capture" {
        // This exact retired generator intentionally used RunAtLoad. Recognize
        // only its complete document, never a label/substring supplied by a user.
        let escape = |s: &str| {
            s.replace('&', "&amp;")
                .replace('<', "&lt;")
                .replace('>', "&gt;")
        };
        format!("<?xml version=\"1.0\"?><plist version=\"1.0\"><dict><key>Label</key><string>{name}</string><key>ProgramArguments</key><array><string>{}</string><string>capture</string><string>run</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>15</integer><key>EnvironmentVariables</key><dict><key>HOME</key><string>{}</string></dict></dict></plist>",escape(&executable.to_string_lossy()),escape(&home.to_string_lossy()))
    } else {
        let log = home.join(".wakaclock/delivery.log");
        format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?><plist version=\"1.0\"><dict><key>Label</key><string>{name}</string><key>ProgramArguments</key><array><string>{}</string><string>delivery</string><string>run</string></array><key>EnvironmentVariables</key><dict><key>HOME</key><string>{}</string><key>WAKACLOCK_RECOVERY_PROBE</key><string>{}</string></dict><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>15</integer><key>StandardOutPath</key><string>{}</string><key>StandardErrorPath</key><string>{}</string></dict></plist>",escape(&executable.to_string_lossy()),escape(&home.to_string_lossy()),if probe{"1"}else{"0"},escape(&log.to_string_lossy()),escape(&log.to_string_lossy()))
    }
}
fn verify_owned_manifest(component: &str) -> Result<(), Box<dyn Error>> {
    verify_registered_task(component)?;
    let path = manifest(component)?;
    if !path.exists() {
        return Ok(());
    }
    let actual = fs::read_to_string(&path)?;
    let installed = match fs::read(pointer(component)?) {
        Ok(bytes) => Some(serde_json::from_slice::<Installed>(&bytes)?),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(e.into()),
    };
    if let Some(installed) = &installed {
        let expected = service_manifest(
            component,
            &installed.active,
            &if cfg!(target_os = "windows") {
                sid()?
            } else {
                String::new()
            },
        )?;
        if actual == expected {
            return Ok(());
        }
    }
    if cfg!(target_os = "macos") {
        let home = dirs::home_dir().ok_or("service_home_unavailable")?;
        let legacy = home.join(format!(".wakaclock/bin/wakaclock-{component}"));
        if [false, true]
            .iter()
            .any(|probe| actual == legacy_manifest(component, &home, &legacy, *probe))
        {
            if fs::symlink_metadata(&legacy)?.file_type().is_symlink() {
                return Err("service_legacy_binary_unconfirmed".into());
            }
            let bytes = fs::read(&legacy)?;
            let hash = format!("{:x}", Sha256::digest(&bytes));
            if installed
                .as_ref()
                .is_some_and(|previous| previous.sha256 != hash)
            {
                return Err("service_configuration_changed_by_owner".into());
            }
            let version = directory()?.join(&hash);
            fs::create_dir_all(&version)?;
            let executable = version.join("wakaclock");
            if !executable.exists() {
                private_write(&executable, &bytes)?;
            }
            if format!("{:x}", Sha256::digest(fs::read(&executable)?)) != hash {
                return Err("service_legacy_backup_hash_mismatch".into());
            }
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&executable, fs::Permissions::from_mode(0o700))?;
            }
            private_write(
                &pointer(component)?,
                &serde_json::to_vec(&Installed {
                    active: executable,
                    previous: None,
                    sha256: hash,
                })?,
            )?;
            let probe_path =
                wakaclock_core::runtime::directory()?.join("delivery-recovery-enabled");
            if component == "delivery" && !probe_path.exists() {
                private_write(
                    &probe_path,
                    if actual == legacy_manifest(component, &home, &legacy, true) {
                        b"1"
                    } else {
                        b"0"
                    },
                )?;
            }
            return Ok(());
        }
    }
    Err("service_existing_ownership_unconfirmed".into())
}
fn start(component: &str, executable: &Path) -> Result<(), Box<dyn Error>> {
    let began = chrono::Utc::now();
    let path = manifest(component)?;
    fs::create_dir_all(path.parent().ok_or("service_path_invalid")?)?;
    let identity = if cfg!(target_os = "windows") {
        sid()?
    } else {
        String::new()
    };
    let content = service_manifest(component, executable, &identity)?;
    private_write(&path, content.as_bytes())?;
    if cfg!(target_os = "macos") {
        let uid = String::from_utf8(Command::new("id").arg("-u").output()?.stdout)?
            .trim()
            .to_string();
        crate::delivery_service::bootstrap_launch_agent(&uid, &label(component)?, &path)?;
    } else {
        let registered = Command::new("schtasks.exe")
            .args(["/Create", "/TN", &task(component)?, "/XML"])
            .arg(&path)
            .arg("/F")
            .output()?;
        if !registered.status.success() {
            return Err("service_registration_failed".into());
        }
        let registered_hash =
            registered_task_hash(component)?.ok_or("service_registration_read_unconfirmed")?;
        private_write(&task_receipt(component)?, registered_hash.as_bytes())?;
        if !Command::new("schtasks.exe")
            .args(["/Run", "/TN", &task(component)?])
            .output()?
            .status
            .success()
        {
            return Err("service_start_failed".into());
        }
    }
    let expected_hash = format!("{:x}", Sha256::digest(fs::read(executable)?));
    let deadline = std::time::Instant::now();
    loop {
        let state =
            fs::read(wakaclock_core::runtime::directory()?.join(format!("{component}-state.json")))
                .ok()
                .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok());
        if state.is_some_and(|state| {
            state["binary_sha256"] == expected_hash
                && state["checked_at"]
                    .as_str()
                    .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
                    .is_some_and(|at| at >= began)
        }) && worker_locked(component)?
        {
            break;
        }
        if deadline.elapsed() > std::time::Duration::from_secs(20) {
            return Err("service_start_not_confirmed".into());
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    Ok(())
}
fn private_write(path: &Path, bytes: &[u8]) -> Result<(), Box<dyn Error>> {
    use std::io::Write;
    let temporary_path = path.with_extension("new");
    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&temporary_path)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    fs::rename(temporary_path, path)?;
    #[cfg(unix)]
    fs::File::open(path.parent().ok_or("service_path_invalid")?)?.sync_all()?;
    Ok(())
}
/// Stage and probe a private immutable CLI without registering a service.
pub(crate) fn stage_binary() -> Result<PathBuf, Box<dyn Error>> {
    let dir = directory()?;
    fs::create_dir_all(&dir)?;
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(dir.join("binary.lock"))?;
    lock.lock_exclusive()?;
    let bytes = fs::read(std::env::current_exe()?)?;
    let hash = format!("{:x}", Sha256::digest(&bytes));
    let version = dir.join(&hash);
    fs::create_dir_all(&version)?;
    let executable = version.join(if cfg!(target_os = "windows") {
        "wakaclock.exe"
    } else {
        "wakaclock"
    });
    if !executable.exists() {
        private_write(&executable, &bytes)?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&executable, fs::Permissions::from_mode(0o700))?;
    }
    if format!("{:x}", Sha256::digest(fs::read(&executable)?)) != hash {
        return Err("service_binary_hash_mismatch".into());
    }
    let probe = Command::new(&executable).arg("journal-scope").output()?;
    let capabilities: Value = serde_json::from_slice(&probe.stdout)?;
    if !probe.status.success()
        || !capabilities["capabilities"]
            .as_array()
            .is_some_and(|c| c.iter().any(|v| v == "native_activity_hook_v1"))
    {
        return Err("service_binary_incompatible".into());
    }
    Ok(executable)
}
fn recover_install_failure(
    component: &str,
    previous: Option<&Installed>,
    new: &Path,
) -> Result<(), Box<dyn Error>> {
    stop(component)?;
    if let Some(previous) = previous {
        start(component, &previous.active)?;
    } else {
        let path = manifest(component)?;
        let expected = service_manifest(
            component,
            new,
            &if cfg!(target_os = "windows") {
                sid()?
            } else {
                String::new()
            },
        )?;
        if fs::read_to_string(&path).ok().as_deref() == Some(expected.as_str()) {
            if cfg!(target_os = "windows") {
                let output = Command::new("schtasks.exe")
                    .args(["/Delete", "/TN", &task(component)?, "/F"])
                    .output()?;
                if !output.status.success() {
                    return Err("service_cleanup_not_confirmed".into());
                }
            }
            fs::remove_file(path)?;
        }
    }
    Ok(())
}
pub fn install(component: &str) -> Result<Value, Box<dyn Error>> {
    let dir = directory()?;
    fs::create_dir_all(&dir)?;
    label(component)?;
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(dir.join("install.lock"))?;
    lock.lock_exclusive()?;
    verify_owned_manifest(component)?;
    let source = std::env::current_exe()?;
    let bytes = fs::read(&source)?;
    let hash = format!("{:x}", Sha256::digest(&bytes));
    let version = dir.join(&hash);
    fs::create_dir_all(&version)?;
    let executable = version.join(if cfg!(target_os = "windows") {
        "wakaclock.exe"
    } else {
        "wakaclock"
    });
    if !executable.exists() {
        private_write(&executable, &bytes)?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&executable, fs::Permissions::from_mode(0o700))?;
    }
    if format!("{:x}", Sha256::digest(fs::read(&executable)?)) != hash {
        return Err("service_binary_hash_mismatch".into());
    }
    let previous = fs::read(pointer(component)?)
        .ok()
        .map(|p| serde_json::from_slice::<Installed>(&p))
        .transpose()?;
    // Read-only protocol smoke; no activity or network is created.
    let probe = Command::new(&executable).arg("journal-scope").output()?;
    let capabilities: Value = serde_json::from_slice(&probe.stdout)?;
    if !probe.status.success()
        || !capabilities["capabilities"]
            .as_array()
            .is_some_and(|c| c.iter().any(|v| v == "editor_durable_ack_v1"))
    {
        return Err("service_binary_incompatible".into());
    }
    stop(component)?;
    if let Err(error) = start(component, &executable) {
        recover_install_failure(component, previous.as_ref(), &executable)?;
        return Err(error);
    }
    let installed = Installed {
        active: executable,
        previous: previous.as_ref().and_then(|p| {
            if p.active
                == version.join(if cfg!(target_os = "windows") {
                    "wakaclock.exe"
                } else {
                    "wakaclock"
                })
            {
                p.previous.clone()
            } else {
                Some(p.active.clone())
            }
        }),
        sha256: hash,
    };
    if let Err(error) = private_write(&pointer(component)?, &serde_json::to_vec(&installed)?) {
        recover_install_failure(component, previous.as_ref(), &installed.active)?;
        return Err(error);
    }
    if component == "capture" {
        private_write(
            &wakaclock_core::runtime::directory()?.join("capture-enabled"),
            b"1",
        )?;
    }
    Ok(
        json!({"installed":true,"component":component,"binary":installed.active,"sha256":installed.sha256,"paused_by_user":wakaclock_core::runtime::paused(component),"native_certification":"pending"}),
    )
}
pub fn rollback(component: &str) -> Result<Value, Box<dyn Error>> {
    let dir = directory()?;
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(dir.join("install.lock"))?;
    lock.lock_exclusive()?;
    verify_owned_manifest(component)?;
    let current: Installed = serde_json::from_slice(&fs::read(pointer(component)?)?)?;
    let previous = current
        .previous
        .clone()
        .ok_or("service_previous_unavailable")?;
    if !previous.starts_with(&dir) {
        return Err("service_previous_path_invalid".into());
    }
    let hash = format!("{:x}", Sha256::digest(fs::read(&previous)?));
    if previous
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|s| s.to_str())
        != Some(&hash)
    {
        return Err("service_previous_hash_mismatch".into());
    }
    stop(component)?;
    if let Err(error) = start(component, &previous) {
        let _ = stop(component);
        let _ = start(component, &current.active);
        return Err(error);
    }
    let restored = Installed {
        active: previous.clone(),
        previous: Some(current.active.clone()),
        sha256: hash,
    };
    if let Err(error) = private_write(&pointer(component)?, &serde_json::to_vec(&restored)?) {
        recover_install_failure(component, Some(&current), &previous)?;
        return Err(error);
    }
    Ok(json!({"rolled_back":true,"data_preserved":true}))
}
pub fn uninstall(component: &str) -> Result<Value, Box<dyn Error>> {
    let _lock = installation_lock()?;
    verify_owned_manifest(component)?;
    stop(component)?;
    let path = manifest(component)?;
    if cfg!(target_os = "windows") {
        if registered_task_hash(component)?.is_some() {
            let output = Command::new("schtasks.exe")
                .args(["/Delete", "/TN", &task(component)?, "/F"])
                .output()?;
            if !output.status.success() {
                return Err("service_uninstall_not_confirmed".into());
            }
        }
        if task_receipt(component)?.exists() {
            fs::remove_file(task_receipt(component)?)?;
        }
    }
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(json!({"installed":false,"component":component,"queue_and_journals_preserved":true}))
}

/// Resume an already owned service. This never installs a background service or
/// starts Docker; absence is an explicit disposition for the caller/UI.
pub fn resume_installed(component: &str) -> Result<Value, Box<dyn Error>> {
    resume_owned(component, true)
}
pub fn validate_resume_installed(component: &str) -> Result<(), Box<dyn Error>> {
    resume_owned(component, false).map(|_| ())
}
fn resume_owned(component: &str, start_service: bool) -> Result<Value, Box<dyn Error>> {
    let _lock = installation_lock()?;
    let path = pointer(component)?;
    if !path.exists() {
        return Ok(json!({"component":component,"status":"not_installed"}));
    }
    verify_owned_manifest(component)?;
    let installed: Installed = serde_json::from_slice(&fs::read(path)?)?;
    let hash = format!("{:x}", Sha256::digest(fs::read(&installed.active)?));
    if !installed.active.starts_with(directory()?)
        || hash != installed.sha256
        || installed
            .active
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|s| s.to_str())
            != Some(hash.as_str())
    {
        return Err("service_resume_binary_invalid".into());
    }
    if !worker_locked(component)? {
        if start_service {
            start(component, &installed.active)?;
        }
    } else {
        let state: Value = serde_json::from_slice(&fs::read(
            wakaclock_core::runtime::directory()?.join(format!("{component}-state.json")),
        )?)?;
        if state["binary_sha256"] != hash {
            return Err("service_running_build_mismatch".into());
        }
    }
    Ok(json!({"component":component,"status":"running","sha256":hash}))
}

pub fn resume_backend_local(server_url: &str) -> Result<Value, Box<dyn Error>> {
    resume_backend_owned(server_url, true)
}
pub fn validate_resume_backend_local(server_url: &str) -> Result<(), Box<dyn Error>> {
    resume_backend_owned(server_url, false).map(|_| ())
}
fn resume_backend_owned(server_url: &str, start_service: bool) -> Result<Value, Box<dyn Error>> {
    let url = reqwest::Url::parse(server_url)?;
    if !matches!(
        url.host_str(),
        Some("localhost" | "127.0.0.1" | "[::1]" | "::1")
    ) {
        return Ok(json!({"component":"backend-local","status":"not_applicable_cloud"}));
    }
    if !cfg!(target_os = "macos") {
        return Ok(
            json!({"component":"backend-local","status":"service_manager_evidence_pending"}),
        );
    }
    if url.port_or_known_default() != Some(8080) {
        return Err("backend_resume_origin_unconfirmed".into());
    }
    let _lock = installation_lock()?;
    let runtime = wakaclock_core::runtime::directory()?.join("runtime");
    let supervisor = runtime.join("supervisor.py");
    let binding = wakaclock_core::runtime::directory()?.join("backend-runtime-binding.json");
    if !supervisor.exists() || !binding.exists() {
        return Ok(json!({"component":"backend-local","status":"not_installed"}));
    }
    let proof: Value = serde_json::from_slice(&fs::read(binding)?)?;
    if proof["account_verified"] != true
        || proof["canonical_data_verified"] != true
        || proof["supervisor_sha256"] != format!("{:x}", Sha256::digest(fs::read(&supervisor)?))
    {
        return Err("backend_resume_identity_or_build_unconfirmed".into());
    }
    let output = Command::new("/usr/bin/python3")
        .arg(supervisor)
        .arg(if start_service {
            "resume"
        } else {
            "resume-preflight"
        })
        .output()?;
    if !output.status.success() {
        return Err("backend_resume_not_confirmed".into());
    }
    let state: Value = serde_json::from_slice(&output.stdout)?;
    if state["component"] != "backend-local"
        || state["status"]
            != if start_service {
                "supervisor_registered"
            } else {
                "ownership_verified"
            }
    {
        return Err("backend_resume_not_confirmed".into());
    }
    Ok(state)
}

#[cfg(test)]
mod tests {
    #[test]
    fn manifests_are_per_user_and_escape_paths_without_credentials() {
        let win = super::service_manifest(
            "capture",
            std::path::Path::new("C:\\ผู้ใช้ & data\\wakaclock.exe"),
            "S-1-5-21-123",
        )
        .unwrap();
        assert!(win.contains("InteractiveToken"));
        assert!(win.contains("LeastPrivilege"));
        assert!(win.contains("&amp;"));
        assert!(!win.contains("Password"));
        let mac = super::service_manifest(
            "delivery",
            std::path::Path::new("/users/a & b/wakaclock"),
            "",
        )
        .unwrap();
        assert!(mac.contains("com.atoaxis.wakaclock.delivery"));
        assert!(super::service_manifest("other", std::path::Path::new("x"), "").is_err());
    }
}
