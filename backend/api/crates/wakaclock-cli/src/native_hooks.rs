//! Consent-gated native CLI hooks. User hooks and private provider config are
//! never sent to diagnostics. An ownership ledger precedes the config write.
use serde_json::{json, Value};
use std::{error::Error, fs, path::Path};

fn specification(adapter: &str) -> Result<(&str, &str, &[&str]), Box<dyn Error>> {
    match adapter {
        "claude-code" => Ok((
            ".claude/settings.json",
            "cli",
            &["PreToolUse", "PostToolUse", "PostToolUseFailure", "Stop"],
        )),
        "gemini-cli" => Ok((
            ".gemini/settings.json",
            "cli",
            &["BeforeTool", "AfterTool", "BeforeAgent", "AfterAgent"],
        )),
        "copilot" => Ok((
            ".wakaclock/vscode-agent-hooks.json",
            "ide",
            &[
                "SessionStart",
                "UserPromptSubmit",
                "PreToolUse",
                "PostToolUse",
                "Stop",
            ],
        )),
        "cursor" => Ok((
            ".cursor/hooks.json",
            "ide",
            &["preToolUse", "postToolUse", "postToolUseFailure", "stop"],
        )),
        _ => Err("activity_native_hook_contract_evidence_pending".into()),
    }
}
fn command(executable: &Path, adapter: &str, surface: &str) -> Result<String, Box<dyn Error>> {
    let path = executable.to_str().ok_or("activity_hook_path_invalid")?;
    if path
        .chars()
        .any(|c| matches!(c, '"' | '\n' | '\r' | '$' | '`' | '%' | '!'))
    {
        return Err("activity_hook_path_requires_manual_configuration".into());
    }
    Ok(format!(
        "\"{path}\" ai activity-hook --adapter {adapter} --surface {surface} --hook-output"
    ))
}
fn entries(adapter: &str, executable: &Path) -> Result<Value, Box<dyn Error>> {
    let (_, surface, events) = specification(adapter)?;
    let command = command(executable, adapter, surface)?;
    let mut entries = serde_json::Map::new();
    for event in events {
        let hook = match adapter {
            "cursor" => json!({"command":command}),
            "copilot" => json!({"type":"command","command":command,"timeout":10}),
            "gemini-cli" => {
                json!({"hooks":[{"name":"atoaxis-native-activity","type":"command","command":command,"timeout":10000}]})
            }
            _ => json!({"hooks":[{"type":"command","command":command,"timeout":10}]}),
        };
        entries.insert((*event).into(), hook);
    }
    Ok(Value::Object(entries))
}
fn project(
    mut config: Value,
    previous: &Value,
    next: &Value,
    cursor: bool,
) -> Result<Value, Box<dyn Error>> {
    let object = config
        .as_object_mut()
        .ok_or("activity_hook_config_invalid")?;
    if cursor {
        object.entry("version").or_insert(json!(1));
    }
    let hooks = object
        .entry("hooks")
        .or_insert(json!({}))
        .as_object_mut()
        .ok_or("activity_hook_config_invalid")?;
    for (event, old) in previous
        .as_object()
        .ok_or("activity_hook_ownership_invalid")?
    {
        if let Some(value) = hooks.get_mut(event) {
            let list = value.as_array_mut().ok_or("activity_hook_config_invalid")?;
            list.retain(|entry| entry != old);
        }
    }
    for (event, new) in next.as_object().ok_or("activity_hook_ownership_invalid")? {
        let list = hooks
            .entry(event)
            .or_insert(json!([]))
            .as_array_mut()
            .ok_or("activity_hook_config_invalid")?;
        if !list.contains(new) {
            list.push(new.clone());
        }
    }
    Ok(config)
}
fn load(path: &Path) -> Result<Value, Box<dyn Error>> {
    match fs::read(path) {
        Ok(bytes) => {
            serde_json::from_slice(&bytes).map_err(|_| "activity_hook_config_invalid".into())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(json!({})),
        Err(_) => Err("activity_hook_config_unreadable".into()),
    }
}
fn persist(path: &Path, value: &Value) -> Result<(), Box<dyn Error>> {
    use std::io::Write;
    fs::create_dir_all(path.parent().ok_or("activity_hook_path_invalid")?)?;
    let staged = path.with_extension(format!("atoaxis-{}", uuid::Uuid::new_v4()));
    let mut options = fs::OpenOptions::new();
    options.create_new(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&staged)?;
    file.write_all(&serde_json::to_vec_pretty(value)?)?;
    file.sync_all()?;
    fs::rename(staged, path)?;
    #[cfg(unix)]
    fs::File::open(path.parent().ok_or("activity_hook_path_invalid")?)?.sync_all()?;
    Ok(())
}
pub fn configure(
    home: &Path,
    adapter: &str,
    executable: &Path,
    uninstall: bool,
) -> Result<Value, Box<dyn Error>> {
    if adapter == "cline" {
        return configure_cline(home, executable, uninstall);
    }
    use fs2::FileExt;
    let (relative, surface, _) = specification(adapter)?;
    let directory = home.join(".wakaclock/native-activity-hooks");
    fs::create_dir_all(&directory)?;
    let lock = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(directory.join("setup.lock"))?;
    lock.lock_exclusive()?;
    let ledger = directory.join(format!("{adapter}.json"));
    let previous = load(&ledger)?;
    let next = if uninstall {
        json!({})
    } else {
        entries(adapter, executable)?
    };
    let recovery_path = directory.join(format!("{adapter}-recovery.json"));
    let recovery = load(&recovery_path)?;
    let mut generations = match recovery.get("generations") {
        Some(value) => value
            .as_array()
            .ok_or("activity_hook_ownership_invalid")?
            .clone(),
        None if recovery == json!({}) => Vec::new(),
        None => return Err("activity_hook_ownership_invalid".into()),
    };
    for generation in [&previous, &next] {
        if !generations.contains(generation) {
            generations.push(generation.clone());
        }
    }
    if generations.len() > 8 {
        return Err("activity_hook_recovery_requires_review".into());
    }
    let path = home.join(relative);
    let mut projected = load(&path)?;
    for generation in &generations {
        projected = project(projected, generation, &json!({}), adapter == "cursor")?;
    }
    projected = project(projected, &json!({}), &next, adapter == "cursor")?;
    // All exact generations that may be present survive interrupted replacement.
    persist(&recovery_path, &json!({"generations":generations}))?;
    persist(&path, &projected)?;
    persist(&ledger, &next)?;
    fs::remove_file(recovery_path)?;
    Ok(
        json!({"adapter":adapter,"surface":surface,"status":if uninstall{"uninstalled"}else{"configured"},"capture_contract":"native_activity_hook_v1","live_certification":"pending","user_hooks_preserved":true,"hook_location":if adapter=="copilot"{Some(path)}else{None},"next_step":if adapter=="copilot"{Some("enable this hook file in VS Code chat.hookFilesLocations after workspace trust and chat.useHooks verification")}else{None}}),
    )
}

/// Cline's documented macOS contract discovers one executable per event. Never
/// wrap or replace somebody else's hook: there is no additive JSON hook list.
/// Windows discovery differs across provider versions and remains pending.
fn configure_cline(
    home: &Path,
    executable: &Path,
    uninstall: bool,
) -> Result<Value, Box<dyn Error>> {
    use fs2::FileExt;
    if cfg!(windows) {
        return Err("cline_windows_hook_contract_evidence_pending".into());
    }
    let directory = home.join(".wakaclock/native-activity-hooks");
    fs::create_dir_all(&directory)?;
    let lock = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(directory.join("setup.lock"))?;
    lock.lock_exclusive()?;
    let ledger = directory.join("cline-files.json");
    let previous = load(&ledger)?;
    let events = [
        "TaskStart",
        "TaskResume",
        "TaskCancel",
        "UserPromptSubmit",
        "PreToolUse",
        "PostToolUse",
    ];
    let mut next = serde_json::Map::new();
    if !uninstall {
        let command = command(executable, "cline", "ide")?;
        for event in events {
            next.insert(
                event.into(),
                json!(format!(
                    "#!/bin/sh\n# AtoAxis owned native activity hook; cancel is provider control, never a durable ACK.\n{command} >/dev/null 2>/dev/null\nif [ \"$?\" -ne 0 ]; then printf '%s\\n' 'atoaxis_activity_capture_not_confirmed' >&2; fi\nprintf '%s\\n' '{{\"cancel\":false}}'\n"
                )),
            );
        }
    }
    let next = Value::Object(next);
    let recovery_path = directory.join("cline-files-recovery.json");
    let recovery = load(&recovery_path)?;
    let mut generations = match recovery.get("generations") {
        Some(Value::Array(generations)) => generations.clone(),
        None if recovery == json!({}) => Vec::new(),
        _ => return Err("activity_hook_ownership_invalid".into()),
    };
    for generation in [&previous, &next] {
        if !generations.contains(generation) {
            generations.push(generation.clone());
        }
    }
    if generations.len() > 8 {
        return Err("activity_hook_recovery_requires_review".into());
    }
    for generation in &generations {
        let files = generation
            .as_object()
            .ok_or("activity_hook_ownership_invalid")?;
        if files
            .iter()
            .any(|(event, contents)| !events.contains(&event.as_str()) || !contents.is_string())
        {
            return Err("activity_hook_ownership_invalid".into());
        }
    }
    let hooks = home.join("Documents/Cline/Hooks");
    check_cline_directories(home)?;
    // Preflight every file before changing any. Symlinks and unknown contents
    // are foreign even if the filename resembles one of our hooks.
    for event in events {
        let path = hooks.join(event);
        check_cline_file(&path, event, &generations)?;
    }
    persist(&recovery_path, &json!({"generations":generations}))?;
    if !uninstall {
        fs::create_dir_all(&hooks)?;
    }
    for event in events {
        let path = hooks.join(event);
        // Recheck after durable registration, before each mutation. An external
        // editor may have replaced a file since the all-file preflight.
        check_cline_directories(home)?;
        check_cline_file(&path, event, &generations)?;
        if let Some(contents) = next[event].as_str() {
            persist_hook(&path, contents)?;
        } else if path.exists() {
            fs::remove_file(&path)?;
            #[cfg(unix)]
            fs::File::open(&hooks)?.sync_all()?;
        }
    }
    persist(&ledger, &next)?;
    fs::remove_file(recovery_path)?;
    Ok(
        json!({"adapter":"cline","surface":"ide","status":if uninstall{"uninstalled"}else{"configured"},
        "capture_contract":"native_activity_hook_v1","installation_platforms":["macos"],
        "live_certification":"pending","user_hooks_preserved":true,
        "next_step":"Enable Hooks in Cline settings. Existing foreign event hooks require manual additive setup; Windows provider-version evidence is pending."}),
    )
}

fn check_cline_file(path: &Path, event: &str, generations: &[Value]) -> Result<(), Box<dyn Error>> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if !metadata.is_file() || metadata.file_type().is_symlink() {
                return Err("activity_hook_foreign_file".into());
            }
            let contents =
                fs::read_to_string(path).map_err(|_| "activity_hook_config_unreadable")?;
            if !generations
                .iter()
                .any(|generation| generation[event].as_str() == Some(&contents))
            {
                return Err("activity_hook_foreign_file".into());
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(_) => return Err("activity_hook_config_unreadable".into()),
    }
    Ok(())
}

fn check_cline_directories(home: &Path) -> Result<(), Box<dyn Error>> {
    for directory in [
        home.join("Documents"),
        home.join("Documents/Cline"),
        home.join("Documents/Cline/Hooks"),
    ] {
        match fs::symlink_metadata(directory) {
            Ok(metadata) if !metadata.is_dir() || metadata.file_type().is_symlink() => {
                return Err("activity_hook_foreign_directory".into())
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err("activity_hook_config_unreadable".into()),
        }
    }
    Ok(())
}

fn persist_hook(path: &Path, contents: &str) -> Result<(), Box<dyn Error>> {
    use std::io::Write;
    let staged = path.with_extension(format!("atoaxis-{}", uuid::Uuid::new_v4()));
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o700);
    }
    let mut file = options.open(&staged)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(fs::Permissions::from_mode(0o700))?;
    }
    file.write_all(contents.as_bytes())?;
    file.sync_all()?;
    drop(file);
    fs::rename(staged, path)?;
    #[cfg(unix)]
    fs::File::open(path.parent().ok_or("activity_hook_path_invalid")?)?.sync_all()?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_user_hooks_and_replaces_only_owned_generation() {
        let a = entries("claude-code", Path::new("/old/wakaclock")).unwrap();
        let b = entries("claude-code", Path::new("/new/wakaclock")).unwrap();
        let config = json!({"env":{"USER_PRIVATE":"kept"},"hooks":{"Stop":[{"hooks":[{"command":"user hook"}]}]}});
        let first = project(config, &json!({}), &a, false).unwrap();
        let second = project(first, &a, &b, false).unwrap();
        assert_eq!(second["hooks"]["Stop"].as_array().unwrap().len(), 2);
        assert!(!second.to_string().contains("/old/"));
        assert_eq!(second["env"]["USER_PRIVATE"], "kept");
        let removed = project(second, &b, &json!({}), false).unwrap();
        assert_eq!(removed["hooks"]["Stop"].as_array().unwrap().len(), 1);
    }
    #[test]
    fn cursor_paths_spaces_and_unknown_schema_fail_closed() {
        let entry = entries("cursor", Path::new("C:\\Thai user\\wakaclock.exe")).unwrap();
        assert!(entry["preToolUse"]["command"]
            .as_str()
            .unwrap()
            .starts_with('"'));
        assert!(project(json!({"hooks":[]}), &json!({}), &entry, true).is_err());
        assert!(entries("deep-code", Path::new("x")).is_err());
        assert!(entries("cursor", Path::new("/bad/$name")).is_err());
    }
    #[test]
    #[cfg(unix)]
    fn cline_owned_files_upgrade_remove_and_preserve_foreign_hooks() {
        use std::os::unix::fs::PermissionsExt;
        let home = std::env::temp_dir().join(format!("cline-hooks-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&home).unwrap();
        configure(&home, "cline", Path::new("/old CLI/wakaclock"), false).unwrap();
        let hook = home.join("Documents/Cline/Hooks/PreToolUse");
        assert_eq!(
            fs::metadata(&hook).unwrap().permissions().mode() & 0o777,
            0o700
        );
        configure(&home, "cline", Path::new("/new CLI/wakaclock"), false).unwrap();
        assert!(fs::read_to_string(&hook).unwrap().contains("/new CLI/"));
        let other = home.join("Documents/Cline/Hooks/PostToolUse");
        fs::write(&other, "#!/bin/sh\nuser-hook\n").unwrap();
        assert!(configure(&home, "cline", Path::new("/another CLI/wakaclock"), false).is_err());
        assert!(fs::read_to_string(&hook).unwrap().contains("/new CLI/"));
        assert!(configure(&home, "cline", Path::new("/new CLI/wakaclock"), true).is_err());
        assert_eq!(
            fs::read_to_string(&other).unwrap(),
            "#!/bin/sh\nuser-hook\n"
        );
        fs::remove_file(other).unwrap();
        configure(&home, "cline", Path::new("/new CLI/wakaclock"), true).unwrap();
        assert!(!hook.exists());
        fs::remove_dir_all(home).unwrap();
    }
    #[test]
    #[cfg(unix)]
    fn cline_resumes_an_interrupted_generation_and_refuses_symlinks() {
        use std::os::unix::fs::symlink;
        let home = std::env::temp_dir().join(format!("cline-interrupted-{}", uuid::Uuid::new_v4()));
        configure(&home, "cline", Path::new("/original/wakaclock"), false).unwrap();
        let ledger = home.join(".wakaclock/native-activity-hooks/cline-files.json");
        let original = load(&ledger).unwrap();
        persist(
            &home.join(".wakaclock/native-activity-hooks/cline-files-recovery.json"),
            &json!({"generations":[original]}),
        )
        .unwrap();
        persist(&ledger, &json!({})).unwrap();
        configure(&home, "cline", Path::new("/next/wakaclock"), false).unwrap();
        let hook = home.join("Documents/Cline/Hooks/TaskStart");
        fs::remove_file(&hook).unwrap();
        let foreign = home.join("foreign");
        fs::write(&foreign, "kept").unwrap();
        symlink(&foreign, &hook).unwrap();
        assert!(configure(&home, "cline", Path::new("/next/wakaclock"), true).is_err());
        assert_eq!(fs::read_to_string(foreign).unwrap(), "kept");
        fs::remove_dir_all(home).unwrap();
    }
    #[test]
    #[cfg(unix)]
    fn cline_rejects_redirected_hook_directories_and_keeps_unowned_staging_files() {
        use std::os::unix::fs::symlink;
        let home = std::env::temp_dir().join(format!("cline-directory-{}", uuid::Uuid::new_v4()));
        let foreign = home.join("foreign");
        fs::create_dir_all(&foreign).unwrap();
        fs::create_dir_all(home.join("Documents/Cline")).unwrap();
        symlink(&foreign, home.join("Documents/Cline/Hooks")).unwrap();
        assert!(configure(&home, "cline", Path::new("/fixture/wakaclock"), false).is_err());
        assert_eq!(fs::read_dir(&foreign).unwrap().count(), 0);
        fs::remove_file(home.join("Documents/Cline/Hooks")).unwrap();
        fs::create_dir_all(home.join("Documents/Cline/Hooks")).unwrap();
        let staging = home.join("Documents/Cline/Hooks/PreToolUse.atoaxis-new");
        fs::write(&staging, "user staging data").unwrap();
        configure(&home, "cline", Path::new("/fixture/wakaclock"), false).unwrap();
        assert_eq!(fs::read_to_string(staging).unwrap(), "user staging data");
        fs::remove_dir_all(home).unwrap();
    }
    #[test]
    #[cfg(unix)]
    fn cline_capture_failure_never_blocks_the_host_or_reports_durable_acceptance() {
        let home = std::env::temp_dir().join(format!("cline-neutral-{}", uuid::Uuid::new_v4()));
        configure(&home, "cline", &home.join("missing-cli"), false).unwrap();
        let output = std::process::Command::new(home.join("Documents/Cline/Hooks/PreToolUse"))
            .env_clear()
            .output()
            .unwrap();
        assert!(output.status.success());
        assert_eq!(
            serde_json::from_slice::<Value>(&output.stdout).unwrap(),
            json!({"cancel":false})
        );
        assert_eq!(
            String::from_utf8_lossy(&output.stderr).trim(),
            "atoaxis_activity_capture_not_confirmed"
        );
        assert!(!home.join(".wakaclock/capture.db").exists());
        fs::remove_dir_all(home).unwrap();
    }
}
