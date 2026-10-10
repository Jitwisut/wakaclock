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
    let staged = path.with_extension("atoaxis-new");
    let mut options = fs::OpenOptions::new();
    options.create(true).truncate(true).write(true);
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
}
