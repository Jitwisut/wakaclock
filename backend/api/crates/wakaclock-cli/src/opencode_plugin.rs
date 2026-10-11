//! Explicit, version-gated native plugin. Shared producer spool, no new transport.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{error::Error, fs, io::Write, path::Path};

fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn safe(path: &Path) -> Result<(), Box<dyn Error>> {
    for parent in path.ancestors() {
        if parent.is_symlink() {
            #[cfg(target_os = "macos")]
            if [Path::new("/var"), Path::new("/tmp"), Path::new("/etc")].contains(&parent)
                && fs::canonicalize(parent)?.as_path()
                    == Path::new(&format!("/private{}", parent.display()))
            {
                continue;
            }
            return Err("opencode_plugin_symlink_refused".into());
        }
    }
    Ok(())
}
fn persist(path: &Path, bytes: &[u8]) -> Result<(), Box<dyn Error>> {
    safe(path)?;
    let parent = path.parent().ok_or("opencode_path_invalid")?;
    fs::create_dir_all(parent)?;
    let stage = path.with_extension(format!("staged-{}", uuid::Uuid::new_v4()));
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&stage)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    drop(file);
    fs::rename(stage, path)?;
    #[cfg(unix)]
    fs::File::open(parent)?.sync_all()?;
    Ok(())
}
pub(crate) fn configure(
    home: &Path,
    contract: Option<&str>,
    uninstall: bool,
    executable: &Path,
    scope: &str,
) -> Result<Value, Box<dyn Error>> {
    // A configured provider root is authority; never silently install into a
    // different default location. Support for custom roots needs an explicit scope.
    if std::env::var_os("XDG_CONFIG_HOME").is_some() {
        return Err("opencode_custom_config_scope_review_required".into());
    }
    let root = home.join(".config/opencode");
    safe(&root)?;
    fs::create_dir_all(&root)?;
    let lockpath = root.join(".atoaxis-activity-setup.lock");
    safe(&lockpath)?;
    use fs2::FileExt;
    let lock = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(lockpath)?;
    lock.lock_exclusive()?;
    let paths = [
        "atoaxis-activity/plugin.ts",
        "atoaxis-activity/activity-spool.ts",
        "plugins/atoaxis-activity.ts",
    ];
    let ledger = root.join(".atoaxis-activity-owned.json");
    safe(&ledger)?;
    let old: Value = if ledger.exists() {
        serde_json::from_slice(&fs::read(&ledger)?)?
    } else {
        json!({})
    };
    let mut generations = if old == json!({}) {
        vec![]
    } else {
        if old["version"] != 1
            || !["prepared", "active", "removing"].contains(&old["phase"].as_str().unwrap_or(""))
        {
            return Err("opencode_ownership_unconfirmed".into());
        }
        old["generations"]
            .as_array()
            .ok_or("opencode_ownership_unconfirmed")?
            .clone()
    };
    // Refuse extra files in the owned module directory; never delete user additions.
    let modules = root.join("atoaxis-activity");
    safe(&modules)?;
    if modules.exists() {
        for entry in fs::read_dir(&modules)? {
            let entry = entry?;
            if !["plugin.ts", "activity-spool.ts"]
                .contains(&entry.file_name().to_str().unwrap_or(""))
            {
                return Err("opencode_user_files_preserved".into());
            }
        }
    }
    for relative in paths {
        let path = root.join(relative);
        safe(&path)?;
        if path.exists() {
            let actual = hash(&fs::read(&path)?);
            if !generations
                .iter()
                .any(|g| g[relative].as_str() == Some(actual.as_str()))
            {
                return Err("opencode_user_files_preserved".into());
            }
        }
    }
    if uninstall {
        if old == json!({}) {
            return Ok(json!({"status":"not_installed","live_certification":"pending"}));
        }
        persist(
            &ledger,
            &serde_json::to_vec(
                &json!({"version":1,"phase":"removing","generations":generations}),
            )?,
        )?;
        for relative in paths {
            let path = root.join(relative);
            if path.exists() {
                fs::remove_file(path)?;
            }
        }
        #[cfg(unix)]
        {
            if modules.exists() {
                fs::File::open(&modules)?.sync_all()?;
            }
            if root.join("plugins").exists() {
                fs::File::open(root.join("plugins"))?.sync_all()?;
            }
        }
        if modules.exists() {
            fs::remove_dir(&modules)?;
        }
        fs::remove_file(ledger)?;
        #[cfg(unix)]
        fs::File::open(&root)?.sync_all()?;
        return Ok(
            json!({"status":"uninstalled","spool_retained":true,"live_certification":"pending"}),
        );
    }
    let contract = contract.ok_or("opencode_contract_version_required")?;
    let entry = match contract {
        "opencode-v1-1.19.0" => "import { server } from \"../atoaxis-activity/plugin.ts\";\nexport const AtoAxisActivity = server;\n",
        "opencode-v2-2.0.26" => "export { default } from \"../atoaxis-activity/plugin.ts\";\n",
        _ => return Err("opencode_contract_evidence_pending".into()),
    };
    let binary = serde_json::to_string(executable.to_str().ok_or("opencode_binary_path_invalid")?)?;
    if scope.len() != 64 || !scope.bytes().all(|c| c.is_ascii_hexdigit()) {
        return Err("opencode_producer_scope_unconfirmed".into());
    }
    let module = include_str!("../../../../../extensions/ai-agents/opencode/src/plugin.ts")
        .replace("../../common/activity-spool.ts", "./activity-spool.ts")
        .replace(
            "process.env.WAKACLOCK_CLI_PATH || \"wakaclock\"",
            &format!("process.env.WAKACLOCK_CLI_PATH || {binary}"),
        );
    let spool = include_str!("../../../../../extensions/ai-agents/common/activity-spool.ts");
    let files = [module.as_bytes(), spool.as_bytes(), entry.as_bytes()];
    let mut generation = serde_json::Map::new();
    for (relative, content) in paths.iter().zip(files) {
        generation.insert(relative.to_string(), json!(hash(content)));
    }
    let generation = Value::Object(generation);
    if !generations.contains(&generation) {
        generations.push(generation.clone());
    }
    if generations.len() > 8 {
        return Err("opencode_setup_recovery_requires_review".into());
    }
    persist(
        &ledger,
        &serde_json::to_vec(&json!({"version":1,"phase":"prepared","generations":generations}))?,
    )?;
    let binding = home.join(".wakaclock/native-producer-bindings/opencode-cli.json");
    persist(&binding, &serde_json::to_vec(&json!({"scope_id":scope}))?)?;
    for (relative, bytes) in paths.iter().zip(files) {
        persist(&root.join(relative), bytes)?;
    }
    persist(
        &ledger,
        &serde_json::to_vec(
            &json!({"version":1,"phase":"active","generations":[generation],"contract":contract}),
        )?,
    )?;
    Ok(
        json!({"status":"configured","contract":contract,"surface":"cli","user_config_preserved":true,"live_certification":"pending"}),
    )
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn explicit_versions_upgrade_and_remove_only_owned_plugin_without_changing_user_config() {
        let home = std::env::temp_dir().join(format!("opencode-plugin-{}", uuid::Uuid::new_v4()));
        let root = home.join(".config/opencode");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("opencode.jsonc"), "// user config preserved").unwrap();
        assert!(configure(
            &home,
            Some("unknown"),
            false,
            Path::new("/fixture/cli"),
            &"a".repeat(64)
        )
        .is_err());
        configure(
            &home,
            Some("opencode-v1-1.19.0"),
            false,
            Path::new("/fixture/cli"),
            &"a".repeat(64),
        )
        .unwrap();
        configure(
            &home,
            Some("opencode-v2-2.0.26"),
            false,
            Path::new("/fixture/cli"),
            &"a".repeat(64),
        )
        .unwrap();
        let entry = root.join("plugins/atoaxis-activity.ts");
        assert!(fs::read_to_string(&entry).unwrap().contains("default"));
        fs::write(&entry, "user edit").unwrap();
        assert!(configure(
            &home,
            None,
            true,
            Path::new("/fixture/cli"),
            &"a".repeat(64)
        )
        .is_err());
        fs::write(
            &entry,
            "export { default } from \"../atoaxis-activity/plugin.ts\";\n",
        )
        .unwrap();
        configure(
            &home,
            None,
            true,
            Path::new("/fixture/cli"),
            &"a".repeat(64),
        )
        .unwrap();
        assert!(!entry.exists());
        assert_eq!(
            fs::read_to_string(root.join("opencode.jsonc")).unwrap(),
            "// user config preserved"
        );
        fs::remove_dir_all(home).unwrap();
    }
}
