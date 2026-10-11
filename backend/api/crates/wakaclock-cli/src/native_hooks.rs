//! Consent-gated native CLI hooks. User hooks and private provider config are
//! never sent to diagnostics. An ownership ledger precedes the config write.
use serde_json::{json, Value};
use std::{error::Error, fs, path::Path};

fn specification(adapter: &str) -> Result<(&str, &str, &[&str]), Box<dyn Error>> {
    match adapter {
        "antigravity" => Ok((
            ".gemini/config/hooks.json",
            "ide",
            &["PostToolUse", "PostInvocation", "Stop"],
        )),
        "kimi-code-cli" => Ok((
            "",
            "cli",
            &[
                "SessionStart",
                "SessionEnd",
                "PreToolUse",
                "PostToolUse",
                "PostToolUseFailure",
                "Stop",
                "StopFailure",
            ],
        )),
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
pub(crate) fn install_producer(
    home: &Path,
    adapter: &str,
    executable: &Path,
    scope: &wakaclock_core::queue::QueueScope,
    surface_override: Option<&str>,
) -> Result<(), Box<dyn Error>> {
    use sha2::{Digest, Sha256};
    use std::io::Write;
    let directory = home.join(".wakaclock/native-activity-hooks");
    assert_safe_path(&directory)?;
    if directory.is_symlink() || home.join(".wakaclock").is_symlink() {
        return Err("producer_directory_symlink_refused".into());
    }
    fs::create_dir_all(&directory)?;
    let runtime = if cfg!(windows) { "python" } else { "python3" };
    let version = std::process::Command::new(runtime)
        .arg("--version")
        .output()
        .map_err(|_| "producer_python_runtime_missing")?;
    if !version.status.success()
        || !String::from_utf8_lossy(&version.stdout).starts_with("Python 3.")
    {
        return Err("producer_python_runtime_missing".into());
    }
    let python_version = String::from_utf8_lossy(&version.stdout);
    let mut numbers = python_version
        .trim()
        .strip_prefix("Python ")
        .unwrap_or("")
        .split('.');
    if numbers.next().and_then(|v| v.parse::<u16>().ok()) != Some(3)
        || numbers
            .next()
            .and_then(|v| v.parse::<u16>().ok())
            .is_none_or(|minor| minor < 10)
    {
        return Err("producer_python_runtime_requires_3_10".into());
    }
    let mut scripts = vec![(
        "activity-producer.py",
        include_str!("../../../../../extensions/ai-agents/common/activity-producer.py"),
    )];
    scripts.push((
        "context-producer.py",
        include_str!("../../../../../extensions/ai-agents/common/context-producer.py"),
    ));
    if adapter == "cursor" {
        scripts.extend([
            (
                "metadata-producer.py",
                include_str!("../../../../../extensions/ai-agents/common/metadata-producer.py"),
            ),
            (
                "cursor-edit-producer.py",
                include_str!("../../../../../extensions/ai-agents/cursor/scripts/edit-producer.py"),
            ),
        ]);
    }
    for (name, script) in scripts {
        let hash = format!("{:x}", Sha256::digest(script.as_bytes()));
        let path = directory.join(name);
        let ownership = directory.join("producer-ownership.json");
        if path.is_symlink() || ownership.is_symlink() {
            return Err("producer_file_symlink_refused".into());
        }
        let mut ledger = load(&ownership)?;
        let mut hashes = ledger["hashes"].as_array().cloned().unwrap_or_default();
        if path.exists() {
            let previous = format!("{:x}", Sha256::digest(fs::read(&path)?));
            if !hashes.contains(&json!(previous)) {
                return Err("producer_foreign_file_preserved".into());
            }
        }
        if !hashes.contains(&json!(hash)) {
            hashes.push(json!(hash));
        }
        ledger["hashes"] = json!(hashes);
        persist(&ownership, &ledger)?;
        let temporary = path.with_extension(format!("staged-{}", uuid::Uuid::new_v4()));
        let mut options = fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&temporary)?;
        file.write_all(script.as_bytes())?;
        file.sync_all()?;
        fs::rename(temporary, &path)?;
        #[cfg(unix)]
        fs::File::open(&directory)?.sync_all()?;
    }
    let surface =
        surface_override.unwrap_or(specification(adapter).map(|(_, s, _)| s).unwrap_or("ide"));
    let profile = directory.join(if adapter == "copilot" && surface == "cli" {
        "copilot-cli-producer.json".into()
    } else {
        format!("{adapter}-producer.json")
    });
    if profile.is_symlink() {
        return Err("producer_file_symlink_refused".into());
    }
    persist(
        &profile,
        &json!({"schema_version":1,"adapter_id":adapter,"execution_surface":surface,"scope_id":wakaclock_core::editor_health::scope_id(scope),"cli_path":executable,"python_runtime":runtime}),
    )?;
    Ok(())
}
fn command(
    home: &Path,
    executable: &Path,
    adapter: &str,
    surface: &str,
) -> Result<String, Box<dyn Error>> {
    let path = executable.to_str().ok_or("activity_hook_path_invalid")?;
    if path
        .chars()
        .any(|c| matches!(c, '"' | '\n' | '\r' | '$' | '`' | '%' | '!'))
    {
        return Err("activity_hook_path_requires_manual_configuration".into());
    }
    {
        let directory = home.join(".wakaclock/native-activity-hooks");
        assert_safe_path(&directory)?;
        let profile = directory.join(if adapter == "copilot" && surface == "cli" {
            "copilot-cli-producer.json".into()
        } else {
            format!("{adapter}-producer.json")
        });
        if profile.exists() {
            let config = load(&profile)?;
            if config["cli_path"].as_str() != Some(path) {
                return Err("producer_binary_mismatch".into());
            }
            let script = directory.join("activity-producer.py");
            let profile = profile.to_str().ok_or("producer_path_invalid")?;
            let script = script.to_str().ok_or("producer_path_invalid")?;
            if [profile, script].iter().any(|p| {
                p.chars()
                    .any(|c| matches!(c, '\"' | '\n' | '\r' | '$' | '`' | '%' | '!'))
            }) {
                return Err("producer_path_requires_manual_configuration".into());
            }
            let runtime = if cfg!(windows) { "python" } else { "python3" };
            return Ok(format!("{runtime} \"{script}\" --profile \"{profile}\""));
        }
    }
    Ok(format!(
        "\"{path}\" ai activity-hook --adapter {adapter} --surface {surface} --hook-output"
    ))
}
fn entries(home: &Path, adapter: &str, executable: &Path) -> Result<Value, Box<dyn Error>> {
    let (_, surface, events) = specification(adapter)?;
    let command = command(home, executable, adapter, surface)?;
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
    if adapter == "cursor" {
        let directory = home.join(".wakaclock/native-activity-hooks");
        let profile = directory.join("cursor-producer.json");
        let script = directory.join("cursor-edit-producer.py");
        if profile.exists() {
            assert_safe_path(&script)?;
            if !script.is_file() {
                return Err("cursor_edit_producer_missing".into());
            }
            let profile = profile.to_str().ok_or("producer_path_invalid")?;
            let script = script.to_str().ok_or("producer_path_invalid")?;
            if [profile, script].iter().any(|p| {
                p.chars()
                    .any(|c| matches!(c, '"' | '\n' | '\r' | '$' | '`' | '%' | '!'))
            }) {
                return Err("producer_path_requires_manual_configuration".into());
            }
            let runtime = if cfg!(windows) { "python" } else { "python3" };
            for hook in ["afterFileEdit", "afterTabFileEdit"] {
                entries.insert(hook.into(), json!({"command":format!("{runtime} \"{script}\" --profile \"{profile}\" --hook {hook}")}));
            }
        }
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
fn assert_safe_path(path: &Path) -> Result<(), Box<dyn Error>> {
    for parent in path.ancestors() {
        if parent.is_symlink() {
            #[cfg(target_os = "macos")]
            if [Path::new("/var"), Path::new("/tmp"), Path::new("/etc")].contains(&parent)
                && fs::canonicalize(parent)?.as_path()
                    == Path::new(&format!("/private{}", parent.display()))
            {
                continue;
            }
            return Err("activity_hook_symlink_refused".into());
        }
    }
    Ok(())
}
fn load(path: &Path) -> Result<Value, Box<dyn Error>> {
    assert_safe_path(path)?;
    match fs::read(path) {
        Ok(bytes) => {
            serde_json::from_slice(&bytes).map_err(|_| "activity_hook_config_invalid".into())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(json!({})),
        Err(_) => Err("activity_hook_config_unreadable".into()),
    }
}
fn persist(path: &Path, value: &Value) -> Result<(), Box<dyn Error>> {
    assert_safe_path(path)?;
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
    if adapter == "antigravity" {
        return configure_antigravity(home, executable, uninstall);
    }
    if adapter == "cline" {
        return configure_cline(home, executable, uninstall);
    }
    if adapter == "kimi-code-cli" {
        return configure_kimi(home, executable, uninstall);
    }
    use fs2::FileExt;
    let (relative, surface, _) = specification(adapter)?;
    let directory = home.join(".wakaclock/native-activity-hooks");
    assert_safe_path(&directory)?;
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
        entries(home, adapter, executable)?
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

/// User-level Copilot CLI hook file, VS Code compatible PascalCase contract.
/// Separate from VS Code hook-file configuration and daily metrics.
pub(crate) fn configure_copilot_cli(
    home: &Path,
    executable: &Path,
    uninstall: bool,
) -> Result<Value, Box<dyn Error>> {
    use fs2::FileExt;
    if std::env::var_os("COPILOT_HOME").is_some() {
        return Err("copilot_custom_home_scope_review_required".into());
    }
    let directory = home.join(".wakaclock/native-activity-hooks");
    assert_safe_path(&directory)?;
    fs::create_dir_all(&directory)?;
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(directory.join("setup.lock"))?;
    lock.lock_exclusive()?;
    let path = home.join(".copilot/hooks/atoaxis-activity.json");
    let ledger = directory.join("copilot-cli-file.json");
    let old = load(&ledger)?;
    let recovery = directory.join("copilot-cli-recovery.json");
    let mut generations = load(&recovery)?["generations"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    if old != json!({}) && !generations.contains(&old) {
        generations.push(old);
    }
    if path.exists() && !generations.contains(&load(&path)?) {
        return Err("copilot_cli_user_hook_preserved".into());
    }
    let mut next = json!({});
    if !uninstall {
        if !directory.join("copilot-cli-producer.json").exists() {
            return Err("copilot_cli_producer_required".into());
        }
        let cmd = command(home, executable, "copilot", "cli")?;
        next = json!({"version":1,"hooks":{}});
        for event in [
            "SessionStart",
            "SessionEnd",
            "UserPromptSubmit",
            "PreToolUse",
            "PostToolUse",
            "PostToolUseFailure",
            "Stop",
        ] {
            next["hooks"][event] = json!([{"type":"command","command":cmd,"timeoutSec":10}]);
        }
        if !generations.contains(&next) {
            generations.push(next.clone());
        }
    }
    if generations.len() > 8 {
        return Err("copilot_cli_recovery_requires_review".into());
    }
    persist(&recovery, &json!({"generations":generations}))?;
    if uninstall {
        if path.exists() {
            fs::remove_file(&path)?;
            #[cfg(unix)]
            fs::File::open(path.parent().ok_or("copilot_cli_path_invalid")?)?.sync_all()?;
        }
    } else {
        persist(&path, &next)?;
    }
    persist(&ledger, &next)?;
    fs::remove_file(recovery)?;
    Ok(
        json!({"adapter":"copilot","surface":"cli","status":if uninstall{"uninstalled"}else{"configured"},"contract":"copilot-cli-vscode-compatible-v1","live_certification":"pending","user_hooks_preserved":true}),
    )
}

/// IDE hook group has its own top-level name. Tracking does not install a
/// PreToolUse handler, whose required decision would change permission behavior.
fn configure_antigravity(
    home: &Path,
    executable: &Path,
    uninstall: bool,
) -> Result<Value, Box<dyn Error>> {
    use fs2::FileExt;
    let directory = home.join(".wakaclock/native-activity-hooks");
    assert_safe_path(&directory)?;
    fs::create_dir_all(&directory)?;
    let lock = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(directory.join("setup.lock"))?;
    lock.lock_exclusive()?;
    let path = home.join(".gemini/config/hooks.json");
    if path.is_symlink()
        || path.parent().is_some_and(|p| p.is_symlink())
        || home.join(".gemini").is_symlink()
    {
        return Err("antigravity_hook_symlink_refused".into());
    }
    let ledger = directory.join("antigravity-group.json");
    let old = load(&ledger)?;
    let recovery = directory.join("antigravity-group-recovery.json");
    let mut generations = load(&recovery)?["generations"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    if old != json!({}) && !generations.contains(&old) {
        generations.push(old.clone());
    }
    let mut config = load(&path)?;
    let object = config
        .as_object_mut()
        .ok_or("antigravity_hook_schema_unknown")?;
    if let Some(existing) = object.get("atoaxis-native-activity") {
        if !generations.contains(existing) {
            return Err("antigravity_user_hook_preserved".into());
        }
    }
    let mut next = json!({});
    if !uninstall {
        let cmd = command(home, executable, "antigravity", "ide")?;
        // This contract always goes through the producer: raw payload has no
        // hook event name, so our registered event name supplies provenance.
        if !home
            .join(".wakaclock/native-activity-hooks/antigravity-producer.json")
            .exists()
        {
            return Err("antigravity_producer_setup_required".into());
        }
        for event in specification("antigravity")?.2 {
            let handler =
                json!({"type":"command","command":format!("{cmd} --event {event}"),"timeout":10});
            next[event] = if *event == "PostToolUse" {
                json!([{"matcher":"","hooks":[handler]}])
            } else {
                json!([handler])
            };
        }
        if !generations.contains(&next) {
            generations.push(next.clone());
        }
    }
    if generations.len() > 8 {
        return Err("antigravity_setup_recovery_requires_review".into());
    }
    persist(&recovery, &json!({"generations":generations}))?;
    if uninstall {
        object.remove("atoaxis-native-activity");
    } else {
        object.insert("atoaxis-native-activity".into(), next.clone());
    }
    persist(&path, &config)?;
    persist(&ledger, &next)?;
    fs::remove_file(recovery)?;
    Ok(
        json!({"adapter":"antigravity","surface":"ide","status":if uninstall{"uninstalled"}else{"configured"},"contract":"antigravity_ide_hooks_documented_2026_10_11","user_hooks_preserved":true,"live_certification":"pending"}),
    )
}

/// The two documented Kimi products use different homes. Require exactly one
/// existing configuration; never create an inferred provider home or parse secrets
/// into diagnostics. Append/remove only our exact owned block, preserving bytes.
fn configure_kimi(
    home: &Path,
    executable: &Path,
    uninstall: bool,
) -> Result<Value, Box<dyn Error>> {
    use fs2::FileExt;
    use std::io::Write;
    let directory = home.join(".wakaclock/native-activity-hooks");
    assert_safe_path(&directory)?;
    fs::create_dir_all(&directory)?;
    let lock = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(directory.join("setup.lock"))?;
    lock.lock_exclusive()?;
    let ledger = directory.join("kimi-code-cli-toml.json");
    let previous = load(&ledger)?;
    let candidates = [
        home.join(".kimi/config.toml"),
        home.join(".kimi-code/config.toml"),
    ];
    let present = candidates
        .iter()
        .filter(|path| path.is_file())
        .collect::<Vec<_>>();
    let path = if uninstall && previous["path"].is_string() {
        let recorded = std::path::PathBuf::from(
            previous["path"]
                .as_str()
                .ok_or("kimi_config_identity_invalid")?,
        );
        if !candidates.contains(&recorded) {
            return Err("kimi_config_identity_invalid".into());
        }
        recorded
    } else {
        if present.len() != 1 {
            return Err("kimi_config_family_evidence_pending".into());
        }
        present[0].clone()
    };
    if path.is_symlink() || path.parent().is_some_and(|p| p.is_symlink()) || ledger.is_symlink() {
        return Err("kimi_config_symlink_refused".into());
    }
    let original = fs::read_to_string(&path)?;
    let _: toml::Value = toml::from_str(&original).map_err(|_| "kimi_config_invalid")?;
    let recovery_path = directory.join("kimi-code-cli-toml-recovery.json");
    let recovery = load(&recovery_path)?;
    let mut generations = recovery["blocks"].as_array().cloned().unwrap_or_default();
    if let Some(old) = previous["block"].as_str() {
        if !generations.contains(&json!(old)) {
            generations.push(json!(old));
        }
    }
    let next = if uninstall {
        String::new()
    } else {
        let cmd = command(home, executable, "kimi-code-cli", "cli")?;
        let mut block = String::from("\n# AtoAxis native activity begin\n");
        for event in specification("kimi-code-cli")?.2 {
            block.push_str(&format!(
                "[[hooks]]\nevent = {}\ncommand = {}\ntimeout = 10\n",
                json!(event),
                json!(cmd)
            ));
        }
        block.push_str("# AtoAxis native activity end\n");
        block
    };
    if !next.is_empty() && !generations.contains(&json!(next)) {
        generations.push(json!(next));
    }
    let mut projected = original.clone();
    for old in &generations {
        let old = old.as_str().ok_or("kimi_hook_ownership_invalid")?;
        if !old.is_empty() {
            projected = projected.replace(old, "");
        }
    }
    if projected.contains("# AtoAxis native activity begin")
        || projected.contains("# AtoAxis native activity end")
    {
        return Err("kimi_foreign_hook_block_preserved".into());
    }
    projected.push_str(&next);
    let _: toml::Value = toml::from_str(&projected).map_err(|_| "kimi_hook_projection_invalid")?;
    persist(&recovery_path, &json!({"blocks":generations}))?;
    let staged = path.with_extension(format!("atoaxis-{}", uuid::Uuid::new_v4()));
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&staged)?;
    file.write_all(projected.as_bytes())?;
    file.sync_all()?;
    fs::rename(staged, &path)?;
    #[cfg(unix)]
    fs::File::open(path.parent().ok_or("kimi_config_identity_invalid")?)?.sync_all()?;
    persist(&ledger, &json!({"path":path,"block":next}))?;
    fs::remove_file(recovery_path)?;
    Ok(
        json!({"adapter":"kimi-code-cli","surface":"cli","status":if uninstall{"uninstalled"}else{"configured"},"user_hooks_preserved":true,"live_certification":"pending"}),
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
    assert_safe_path(&directory)?;
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
        let command = command(home, executable, "cline", "ide")?;
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
    fn cursor_inline_setup_ships_helpers_and_preserves_user_hook_on_uninstall() {
        let home = std::env::temp_dir().join(format!("cursor-edit-hooks-{}", uuid::Uuid::new_v4()));
        let scope = wakaclock_core::queue::QueueScope {
            destination: "https://fixture.invalid".into(),
            owner: "fixture-owner".into(),
        };
        let executable = Path::new("/fixture CLI/wakaclock");
        install_producer(&home, "cursor", executable, &scope, None).unwrap();
        let path = home.join(".cursor/hooks.json");
        persist(
            &path,
            &json!({"version":1,"hooks":{"afterTabFileEdit":[{"command":"user-owned-hook"}]}}),
        )
        .unwrap();
        configure(&home, "cursor", executable, false).unwrap();
        let installed = load(&path).unwrap();
        assert!(installed["hooks"]["afterTabFileEdit"]
            .to_string()
            .contains("cursor-edit-producer.py"));
        assert!(installed["hooks"]["afterTabFileEdit"]
            .to_string()
            .contains("user-owned-hook"));
        for helper in [
            "cursor-edit-producer.py",
            "metadata-producer.py",
            "activity-producer.py",
        ] {
            assert!(home
                .join(".wakaclock/native-activity-hooks")
                .join(helper)
                .is_file());
        }
        configure(&home, "cursor", executable, true).unwrap();
        let removed = load(&path).unwrap();
        assert_eq!(
            removed["hooks"]["afterTabFileEdit"],
            json!([{"command":"user-owned-hook"}])
        );
        // Producer data/helpers are preserved; uninstall removes only owned hook entries.
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn copilot_cli_owns_only_its_file_and_preserves_other_surfaces() {
        let home = std::env::temp_dir().join(format!("copilot-cli-hooks-{}", uuid::Uuid::new_v4()));
        let path = home.join(".copilot/hooks/atoaxis-activity.json");
        let user_path = home.join(".copilot/hooks/user.json");
        persist(
            &user_path,
            &json!({"version":1,"hooks":{"SessionStart":[]}}),
        )
        .unwrap();
        persist(
            &home.join(".wakaclock/native-activity-hooks/copilot-cli-producer.json"),
            &json!({"cli_path":"/fixture/wakaclock"}),
        )
        .unwrap();
        configure_copilot_cli(&home, Path::new("/fixture/wakaclock"), false).unwrap();
        configure_copilot_cli(&home, Path::new("/fixture/wakaclock"), false).unwrap();
        let config = load(&path).unwrap();
        assert_eq!(config["version"], 1);
        assert!(config["hooks"]["SessionEnd"].is_array());
        assert!(config["hooks"]["PreToolUse"][0]["command"]
            .as_str()
            .unwrap()
            .contains("copilot-cli-producer.json"));
        configure_copilot_cli(&home, Path::new("/fixture/wakaclock"), true).unwrap();
        assert!(!path.exists());
        assert!(user_path.exists());
        persist(&path, &json!({"user":"owned"})).unwrap();
        assert!(configure_copilot_cli(&home, Path::new("/fixture/wakaclock"), false).is_err());
        assert_eq!(load(&path).unwrap(), json!({"user":"owned"}));
        fs::remove_dir_all(home).unwrap();
    }
    #[test]
    fn antigravity_owns_one_group_without_overriding_permissions_or_user_hooks() {
        let home = std::env::temp_dir().join(format!("antigravity-hooks-{}", uuid::Uuid::new_v4()));
        let path = home.join(".gemini/config/hooks.json");
        persist(&path, &json!({"user-group":{"PostToolUse":[]}})).unwrap();
        persist(
            &home.join(".wakaclock/native-activity-hooks/antigravity-producer.json"),
            &json!({"cli_path":"/fixture/wakaclock"}),
        )
        .unwrap();
        configure(&home, "antigravity", Path::new("/fixture/wakaclock"), false).unwrap();
        let config = load(&path).unwrap();
        assert_eq!(config["user-group"], json!({"PostToolUse":[]}));
        assert!(config["atoaxis-native-activity"]
            .get("PreToolUse")
            .is_none());
        assert!(
            config["atoaxis-native-activity"]["PostToolUse"][0]["hooks"][0]["command"]
                .as_str()
                .unwrap()
                .ends_with("--event PostToolUse")
        );
        configure(&home, "antigravity", Path::new("/fixture/wakaclock"), true).unwrap();
        assert_eq!(
            load(&path).unwrap(),
            json!({"user-group":{"PostToolUse":[]}})
        );
        fs::remove_dir_all(home).unwrap();
    }
    #[test]
    fn kimi_preserves_toml_and_user_hooks_and_requires_known_family() {
        let home = std::env::temp_dir().join(format!("kimi-hooks-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(home.join(".kimi")).unwrap();
        let path = home.join(".kimi/config.toml");
        let original = "# private user comment\ndefault_model = \"user-model\"\n[[hooks]]\nevent = \"Stop\"\ncommand = \"user-owned\"\n";
        fs::write(&path, original).unwrap();
        configure(
            &home,
            "kimi-code-cli",
            Path::new("/old CLI/wakaclock"),
            false,
        )
        .unwrap();
        configure(
            &home,
            "kimi-code-cli",
            Path::new("/new CLI/wakaclock"),
            false,
        )
        .unwrap();
        let configured = fs::read_to_string(&path).unwrap();
        assert!(configured.starts_with(original));
        assert!(!configured.contains("/old CLI/"));
        assert_eq!(
            configured.matches("AtoAxis native activity begin").count(),
            1
        );
        configure(
            &home,
            "kimi-code-cli",
            Path::new("/new CLI/wakaclock"),
            true,
        )
        .unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), original);
        fs::create_dir_all(home.join(".kimi-code")).unwrap();
        fs::write(home.join(".kimi-code/config.toml"), "").unwrap();
        assert!(configure(
            &home,
            "kimi-code-cli",
            Path::new("/new CLI/wakaclock"),
            false
        )
        .is_err());
        fs::remove_dir_all(home).unwrap();
    }
    #[test]
    fn preserves_user_hooks_and_replaces_only_owned_generation() {
        let a = entries(
            Path::new("/fixture-no-profile"),
            "claude-code",
            Path::new("/old/wakaclock"),
        )
        .unwrap();
        let b = entries(
            Path::new("/fixture-no-profile"),
            "claude-code",
            Path::new("/new/wakaclock"),
        )
        .unwrap();
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
        let entry = entries(
            Path::new("/fixture-no-profile"),
            "cursor",
            Path::new("C:\\Thai user\\wakaclock.exe"),
        )
        .unwrap();
        assert!(entry["preToolUse"]["command"]
            .as_str()
            .unwrap()
            .starts_with('"'));
        assert!(project(json!({"hooks":[]}), &json!({}), &entry, true).is_err());
        assert!(entries(
            Path::new("/fixture-no-profile"),
            "deep-code",
            Path::new("x")
        )
        .is_err());
        assert!(entries(
            Path::new("/fixture-no-profile"),
            "cursor",
            Path::new("/bad/$name")
        )
        .is_err());
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
