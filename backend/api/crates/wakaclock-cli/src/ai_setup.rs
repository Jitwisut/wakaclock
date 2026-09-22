//! Standalone setup for the metadata-only AI agent adapters.
//!
//! The VS Code extension has a richer consent UI, but the CLI must also be able
//! to bootstrap an installation from a terminal.  This module intentionally
//! shares the Rust adapter registry with `wakaclock adapter list`: provider,
//! verification and install metadata come from the manifest, while the small
//! implementation dispatch only names adapters with a tested installer path. It
//! copies the tested adapter bundle into a managed, versioned directory and then
//! performs only the adapter-owned configuration change. User config outside the
//! AtoAxis marker is left byte-for-byte unchanged.

use crate::agent_service;
use fs2::FileExt;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    error::Error,
    fs,
    io::{self, Read},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use wakaclock_core::ai::adapter::VerificationStatus;
use wakaclock_core::ai::{normalize_client_id, AdapterManifest, AdapterRegistry, AdapterRuntime};

const BUNDLE_VERSION: &str = env!("CARGO_PKG_VERSION");
const BUNDLE_ENV: &str = "WAKACLOCK_AGENT_BUNDLE";
/// Comma-separated adapter ids disabled by policy.  This is deliberately a
/// local kill switch: it turns off an adapter's capture path without stopping
/// the broker or the ordinary heartbeat stream.
pub(crate) const DISABLED_ADAPTERS_ENV: &str = "WAKACLOCK_DISABLED_AI_ADAPTERS";
const HOOK_CONSENT_FILENAME: &str = "agent-hook-consent.json";
const HOOK_AUDIT_FILENAME: &str = "agent-hook-audit.jsonl";
const LEGACY_SETUP_STATE_FILENAME: &str = "ai-setup.json";
const OBSERVER_CONFIG_FILENAME: &str = "ai-observer.toml";
const OBSERVER_CONFIG_BODY: &str = "# Managed by AtoAxis after explicit ai setup consent.\nenabled = true\nattribution_mode = \"observe_only\"\n";
const SETUP_REPORT_SCHEMA_VERSION: u8 = 1;
const BUNDLE_MANIFEST_SCHEMA_VERSION: u8 = 1;
const BUNDLE_MANIFEST_FILENAME: &str = "bundle-manifest.json";
const ACTIVE_BUNDLE_FILENAME: &str = "active-bundle.json";

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum HookConsent {
    Enabled,
    Denied,
}

type HookConsentFile = BTreeMap<String, HookConsent>;

#[derive(Debug, Clone, Serialize, serde::Deserialize, PartialEq, Eq)]
struct BundleManifest {
    schema_version: u8,
    bundle_version: String,
    files: BTreeMap<String, String>,
    digest: String,
}

#[derive(Debug, Clone, Serialize, serde::Deserialize, PartialEq, Eq)]
struct ActiveBundleState {
    schema_version: u8,
    active: String,
    checksum: String,
    previous: Option<String>,
}

#[derive(Debug, Serialize)]
struct SetupAgentReport {
    id: String,
    status: String,
    outcome_code: String,
    executable: Option<String>,
    verification_status: String,
    suggested_action: Option<String>,
    detail: Option<String>,
}

#[derive(Debug, Serialize)]
struct SetupBrokerReport {
    installed: bool,
    running: bool,
    cleanup_ok: bool,
    runtime_mode: &'static str,
    detail: Option<String>,
}

#[derive(Debug, Serialize)]
struct SetupReport {
    schema_version: u8,
    overall: String,
    suggested_action: Option<String>,
    bundle: Option<String>,
    bundle_detail: Option<String>,
    broker: SetupBrokerReport,
    observer_detail: Option<String>,
    agents: Vec<SetupAgentReport>,
}

#[derive(Debug, Serialize)]
struct UninstallReport {
    id: String,
    status: String,
    outcome_code: String,
    suggested_action: Option<String>,
    detail: Option<String>,
}

#[derive(Debug, Serialize)]
struct UninstallResponse {
    schema_version: u8,
    overall: String,
    agents: Vec<UninstallReport>,
}

/// Run `wakaclock ai setup [AGENT|--all]`.
pub(crate) fn run(
    requested_agent: Option<&str>,
    all: bool,
    json: bool,
    yes: bool,
) -> Result<(), Box<dyn Error>> {
    if !all && requested_agent.is_none() {
        return Err("choose an adapter id or pass --all".into());
    }
    if all && requested_agent.is_some() {
        return Err("choose exactly one of an adapter id or --all".into());
    }

    // Setup is also the migration boundary for upgrades from the retired
    // LaunchAgent/systemd/task path. Always remove that registration before
    // writing hooks, even when the caller has not yet granted adapter consent.
    let legacy_service_cleanup = agent_service::uninstall();

    let registry = AdapterRegistry::builtin();
    let selected = selected_ids(&registry, requested_agent, all)?;
    let home = dirs::home_dir().ok_or("could not resolve home directory")?;
    let _setup_lock = acquire_setup_lock(&home)?;

    let catalog = registry.catalog_v1();
    // Do not copy a bundle, create a token, or install a service until at least
    // one adapter has an existing opt-in or the caller supplies `--yes`.  A
    // discovery-only setup command must be side-effect free.
    let setup_consented = selected.iter().any(|id| {
        let detected_supported = catalog
            .adapters
            .iter()
            .find(|entry| entry.manifest.id == *id)
            .is_some_and(|entry| {
                !matches!(entry.runtime, AdapterRuntime::None)
                    && entry.supports_platform(std::env::consts::OS)
                    && resolve_and_probe_executable(
                        &entry.manifest.executable.command_names,
                        entry.manifest.executable.version_arg.as_deref(),
                    )
                    .is_some()
            });
        detected_supported
            && !is_adapter_disabled(id)
            && (effective_consent(&home, id) == Some(HookConsent::Enabled) || yes)
    });
    let (bundle, bundle_detail) = if setup_consented {
        match ensure_managed_bundle(&home) {
            Ok(path) => (path, None),
            Err(error) => (None, Some(error)),
        }
    } else {
        (
            None,
            Some("explicit consent is required before installing adapter resources".into()),
        )
    };

    let mut agents = Vec::with_capacity(selected.len());
    for id in selected {
        let manifest = registry
            .get(&id)
            .ok_or_else(|| format!("no adapter registered for '{id}'"))?;
        let catalog_entry = catalog
            .adapters
            .iter()
            .find(|entry| entry.manifest.id == id);
        if let Some(entry) = catalog_entry {
            if !entry.supports_platform(std::env::consts::OS) {
                agents.push(SetupAgentReport {
                    id,
                    status: "unsupported".into(),
                    outcome_code: "unsupported_platform".into(),
                    executable: None,
                    verification_status: format!("{:?}", manifest.effective_status())
                        .to_lowercase(),
                    suggested_action: Some(
                        "use transcript-only mode or run setup on a supported platform".into(),
                    ),
                    detail: Some(format!(
                        "native setup is not supported on {}",
                        std::env::consts::OS
                    )),
                });
                continue;
            }
        }
        if all
            && resolve_and_probe_executable(
                &manifest.executable.command_names,
                manifest.executable.version_arg.as_deref(),
            )
            .is_none()
        {
            agents.push(SetupAgentReport {
                id,
                status: "not_detected".into(),
                outcome_code: "skipped_not_detected".into(),
                executable: None,
                verification_status: format!("{:?}", manifest.effective_status()).to_lowercase(),
                suggested_action: Some("install the adapter executable, then retry setup".into()),
                detail: Some(
                    "adapter executable was not detected; no configuration was changed".into(),
                ),
            });
            continue;
        }
        if effective_consent(&home, &id) == Some(HookConsent::Denied) {
            agents.push(SetupAgentReport {
                id,
                status: "opted_out".into(),
                outcome_code: "skipped_opted_out".into(),
                executable: None,
                verification_status: format!("{:?}", manifest.effective_status()).to_lowercase(),
                suggested_action: Some("remove the local opt-out record before retrying".into()),
                detail: Some(
                    "auto-install is disabled for this agent; remove the local consent record before re-enabling"
                        .into(),
                ),
            });
            continue;
        }
        // A first write must be an explicit, non-interactive consent action. The
        // extension records consent after its confirmation dialog; terminal
        // installers use `--yes`. An ordinary `ai setup` invocation must not
        // silently rewrite another tool's configuration just because the agent
        // executable happens to be present. A persisted opt-out always wins.
        if effective_consent(&home, &id).is_none() && !yes {
            agents.push(SetupAgentReport {
                id,
                status: "consent_required".into(),
                outcome_code: "consent_required".into(),
                executable: None,
                verification_status: format!("{:?}", manifest.effective_status()).to_lowercase(),
                suggested_action: Some("rerun with --yes or approve setup in the editor".into()),
                detail: Some(
                    "first hook write requires explicit consent; rerun with `wakaclock ai setup --yes` or approve in the editor".into(),
                ),
            });
            continue;
        }
        set_hook_consent(&home, &id, HookConsent::Enabled)?;
        let runtime = catalog
            .adapters
            .iter()
            .find(|entry| entry.manifest.id == id)
            .map(|entry| entry.runtime)
            .unwrap_or(AdapterRuntime::None);
        let report = setup_adapter(manifest, runtime, bundle.as_deref(), &home);
        append_hook_audit(&home, &id, "setup", &report.status);
        agents.push(report);
    }

    // Adapter setup is intentionally on-demand.  Hooks and the transcript sync
    // command invoke the CLI for one bounded pass; setup must never create a
    // LaunchAgent/systemd task or a long-lived local broker.
    let broker = SetupBrokerReport {
        installed: false,
        running: false,
        cleanup_ok: legacy_service_cleanup.is_ok(),
        runtime_mode: "on_demand",
        detail: match legacy_service_cleanup {
            Ok(_) if setup_consented => {
                Some("on-demand CLI sync; no background service installed".into())
            }
            Ok(_) => Some("consent_required; no background service installed".into()),
            Err(error) => Some(format!(
                "legacy service cleanup failed ({error}); no replacement service was created"
            )),
        },
    };

    let observer_detail = if has_enabled_consent_at(&home) {
        match ensure_observer_config(&home) {
            Ok(None) => None,
            Ok(Some(path)) => Some(format!("observer enabled at {}", path.display())),
            Err(error) => Some(format!("observer setup unavailable: {error}")),
        }
    } else {
        None
    };

    let (overall, suggested_action) = setup_overall(&agents, &broker);
    let report = SetupReport {
        schema_version: SETUP_REPORT_SCHEMA_VERSION,
        overall: overall.into(),
        suggested_action,
        bundle: bundle.map(|path| path.display().to_string()),
        bundle_detail,
        broker,
        observer_detail,
        agents,
    };
    if json {
        println!("{}", serde_json::to_string_pretty(&report)?);
    } else {
        print_text_report(&report);
    }
    if matches!(report.overall.as_str(), "failed" | "partial") {
        return Err(format!("AI adapter setup completed with {} outcome", report.overall).into());
    }
    Ok(())
}

/// Return whether any adapter has an explicit local opt-in. This is used by the
/// CLI heartbeat path to gate passive transcript scanning after setup.
pub(crate) fn has_enabled_consent() -> bool {
    dirs::home_dir()
        .map(|home| has_enabled_consent_at(&home))
        .unwrap_or(false)
}

fn has_enabled_consent_at(home: &Path) -> bool {
    // A new per-adapter record overrides the legacy aggregate state. This is
    // important after uninstall: a denied adapter must not be resurrected by a
    // stale `ai-setup.json` entry left by an older CLI.
    AdapterRegistry::builtin()
        .catalog_v1()
        .adapters
        .iter()
        .filter(|entry| !matches!(entry.runtime, AdapterRuntime::None))
        .any(|entry| effective_consent(home, entry.id()) == Some(HookConsent::Enabled))
}

fn setup_overall(
    agents: &[SetupAgentReport],
    broker: &SetupBrokerReport,
) -> (&'static str, Option<String>) {
    let failed = agents.iter().any(|agent| agent.status == "failed")
        || !broker.cleanup_ok
        || (broker.installed && !broker.running);
    let configured = agents
        .iter()
        .any(|agent| matches!(agent.status.as_str(), "configured" | "already_configured"));
    if failed && configured {
        return (
            "partial",
            Some(
                "repair the failed adapters and rerun setup; configured adapters were preserved"
                    .into(),
            ),
        );
    }
    if failed {
        return (
            "failed",
            Some(
                "inspect each adapter outcome and rerun setup after fixing the suggested action"
                    .into(),
            ),
        );
    }
    if !configured {
        return (
            "skipped",
            Some(
                "install a detected supported adapter or grant setup consent before retrying"
                    .into(),
            ),
        );
    }
    ("success", None)
}

fn effective_consent(home: &Path, id: &str) -> Option<HookConsent> {
    hook_consent(home, id).or_else(|| {
        fs::read_to_string(home.join(".wakaclock").join(LEGACY_SETUP_STATE_FILENAME))
            .ok()
            .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
            .and_then(|value| value.get("adapters").cloned())
            .and_then(|adapters| adapters.get(id).cloned())
            .and_then(|adapter| {
                adapter
                    .get("consented")
                    .and_then(serde_json::Value::as_bool)
            })
            .filter(|consented| *consented)
            .map(|_| HookConsent::Enabled)
    })
}

fn observer_config_path(home: &Path) -> PathBuf {
    home.join(".wakaclock").join(OBSERVER_CONFIG_FILENAME)
}

fn ensure_observer_config(home: &Path) -> Result<Option<PathBuf>, String> {
    let path = observer_config_path(home);
    if path.exists() {
        // A user-managed observer file wins. The parser still enforces
        // observe-only mode for legacy `infer` values.
        return Ok(None);
    }
    write_text_atomically(&path, OBSERVER_CONFIG_BODY).map_err(|error| error.to_string())?;
    set_private_permissions(&path).map_err(|error| error.to_string())?;
    Ok(Some(path))
}

fn consent_path(home: &Path) -> PathBuf {
    home.join(".wakaclock").join(HOOK_CONSENT_FILENAME)
}

fn acquire_setup_lock(home: &Path) -> Result<fs::File, Box<dyn Error>> {
    let path = home.join(".wakaclock").join("ai-setup.lock");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let file = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(path)?;
    match file.try_lock_exclusive() {
        Ok(()) => Ok(file),
        Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
            Err("another AI adapter setup is already running".into())
        }
        Err(error) => Err(Box::new(error)),
    }
}

fn audit_path(home: &Path) -> PathBuf {
    home.join(".wakaclock").join(HOOK_AUDIT_FILENAME)
}

fn hook_consent(home: &Path, id: &str) -> Option<HookConsent> {
    fs::read_to_string(consent_path(home))
        .ok()
        .and_then(|text| serde_json::from_str::<HookConsentFile>(&text).ok())
        .and_then(|file| file.get(id).copied())
}

fn set_hook_consent(home: &Path, id: &str, consent: HookConsent) -> Result<(), Box<dyn Error>> {
    let path = consent_path(home);
    let mut file = fs::read_to_string(&path)
        .ok()
        .and_then(|text| serde_json::from_str::<HookConsentFile>(&text).ok())
        .unwrap_or_default();
    file.insert(id.to_string(), consent);
    write_text_atomically(
        &path,
        &format!("{}\n", serde_json::to_string_pretty(&file)?),
    )?;
    set_private_permissions(&path)?;
    Ok(())
}

fn append_hook_audit(home: &Path, agent: &str, action: &str, result: &str) {
    let path = audit_path(home);
    let Some(parent) = path.parent() else {
        return;
    };
    if fs::create_dir_all(parent).is_err() {
        return;
    }
    let at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    let payload = serde_json::json!({
        "at": at,
        "agent": agent,
        "action": action,
        "result": result,
    });
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(&path) {
        use std::io::Write;
        let _ = writeln!(file, "{payload}");
        let _ = set_private_permissions(&path);
    }
}

/// Return whether policy has disabled this adapter.  Unknown aliases are
/// ignored so a typo in the environment cannot disable an unrelated client.
pub(crate) fn is_adapter_disabled(id: &str) -> bool {
    let Ok(canonical) = normalize_client_id(id) else {
        return false;
    };
    let registry = AdapterRegistry::builtin();
    std::env::var(DISABLED_ADAPTERS_ENV)
        .ok()
        .into_iter()
        .flat_map(|value| {
            value
                .split(',')
                .map(str::trim)
                .map(str::to_owned)
                .collect::<Vec<_>>()
        })
        .filter_map(|value| normalize_client_id(&value).ok())
        .filter(|value| registry.get(value).is_some())
        .any(|value| value == canonical)
}

/// Remove only paths/blocks owned by the AtoAxis adapters. This is deliberately
/// separate from setup so an uninstall can never create a new managed bundle.
pub(crate) fn uninstall(
    requested_agent: Option<&str>,
    all: bool,
    json: bool,
) -> Result<(), Box<dyn Error>> {
    if !all && requested_agent.is_none() {
        return Err("choose an adapter id or pass --all".into());
    }
    if all && requested_agent.is_some() {
        return Err("choose exactly one of an adapter id or --all".into());
    }
    let registry = AdapterRegistry::builtin();
    let selected = selected_ids(&registry, requested_agent, all)?;
    let home = dirs::home_dir().ok_or("could not resolve home directory")?;
    let _setup_lock = acquire_setup_lock(&home)?;
    let catalog = registry.catalog_v1();
    let bundle = find_existing_managed_bundle(&home);
    let mut reports = Vec::with_capacity(selected.len());
    for id in selected {
        let manifest = registry
            .get(&id)
            .ok_or_else(|| format!("no adapter registered for '{id}'"))?;
        // Preserve an explicit opt-out so the broker cannot reinstall the hook
        // on its next discovery pass. This record is metadata-only and does not
        // touch the agent's own configuration.
        set_hook_consent(&home, &id, HookConsent::Denied)?;
        let catalog_entry = catalog
            .adapters
            .iter()
            .find(|entry| entry.manifest.id == id)
            .cloned();
        if catalog_entry
            .as_ref()
            .is_some_and(|entry| !entry.supports_platform(std::env::consts::OS))
        {
            let report = UninstallReport {
                id: manifest.id.clone(),
                status: "unsupported".into(),
                outcome_code: "unsupported_platform".into(),
                suggested_action: Some(
                    "use transcript-only mode or run uninstall on a supported platform".into(),
                ),
                detail: Some(format!(
                    "native uninstall is not supported on {}",
                    std::env::consts::OS
                )),
            };
            append_hook_audit(&home, &id, "uninstall", &report.status);
            reports.push(report);
            continue;
        }
        let runtime = catalog_entry
            .map(|entry| entry.runtime)
            .unwrap_or(AdapterRuntime::None);
        let outcome = uninstall_adapter(manifest, runtime, bundle.as_deref(), &home);
        append_hook_audit(&home, &id, "uninstall", &outcome.0);
        let outcome_code = uninstall_outcome_code(&outcome.0).to_string();
        let suggested_action = uninstall_suggested_action(&outcome.0);
        reports.push(UninstallReport {
            id: manifest.id.clone(),
            status: outcome.0,
            outcome_code,
            suggested_action,
            detail: outcome.1,
        });
    }
    if all && !has_enabled_consent_at(&home) {
        cleanup_unused_bundles(&home);
    }
    let has_failures = reports.iter().any(|report| report.status == "failed");
    if json {
        let overall = if has_failures { "partial" } else { "success" };
        println!(
            "{}",
            serde_json::to_string_pretty(&UninstallResponse {
                schema_version: SETUP_REPORT_SCHEMA_VERSION,
                overall: overall.into(),
                agents: reports,
            })?
        );
    } else {
        for report in &reports {
            println!("{}: {}", report.id, report.status);
            if let Some(detail) = &report.detail {
                println!("  {detail}");
            }
        }
    }
    if has_failures {
        return Err("AI adapter uninstall completed with failures".into());
    }
    Ok(())
}

fn uninstall_outcome_code(status: &str) -> &'static str {
    match status {
        "uninstalled" => "uninstalled",
        "not_installed" => "skipped_not_installed",
        "not_detected" => "skipped_not_detected",
        "manual" => "manual_action_required",
        "unsupported" => "unsupported_strategy",
        _ => "failed",
    }
}

fn uninstall_suggested_action(status: &str) -> Option<String> {
    match status {
        "manual" => Some("remove the adapter integration using the agent's own CLI".into()),
        "not_detected" => Some("install the adapter CLI, then retry uninstall".into()),
        "failed" => Some("inspect the adapter error and retry uninstall".into()),
        _ => None,
    }
}

fn find_existing_managed_bundle(home: &Path) -> Option<PathBuf> {
    let root = bundle_root(home);
    if let Ok(text) = fs::read_to_string(active_bundle_path(home)) {
        if let Ok(state) = serde_json::from_str::<ActiveBundleState>(&text) {
            let active = PathBuf::from(state.active);
            if active.starts_with(&root) {
                if let Ok(manifest) = verify_bundle(&active, None) {
                    if manifest.digest == state.checksum {
                        return Some(active);
                    }
                }
            }
        }
    }
    let mut entries: Vec<PathBuf> = fs::read_dir(root)
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir() && verify_bundle(path, None).is_ok())
        .collect();
    entries.sort_by(|a, b| b.cmp(a));
    entries.into_iter().next()
}

fn cleanup_unused_bundles(home: &Path) {
    let root = bundle_root(home);
    let Ok(entries) = fs::read_dir(&root) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() && verify_bundle(&path, None).is_ok() {
            let _ = fs::remove_dir_all(path);
        }
    }
    let _ = fs::remove_file(active_bundle_path(home));
}

fn uninstall_adapter(
    manifest: &AdapterManifest,
    runtime: AdapterRuntime,
    bundle: Option<&Path>,
    home: &Path,
) -> (String, Option<String>) {
    match runtime {
        AdapterRuntime::Codex => {
            let path = home.join(".codex/config.toml");
            let existing = fs::read_to_string(&path).unwrap_or_default();
            let updated = remove_codex_managed_hooks(&existing);
            if updated == existing {
                ("not_installed".into(), Some("no AtoAxis Codex hook block found".into()))
            } else if let Err(error) = write_text_atomically(&path, &updated) {
                ("failed".into(), Some(error.to_string()))
            } else {
                ("uninstalled".into(), Some(format!("updated {}", path.display())))
            }
        }
        AdapterRuntime::ClaudeCode => run_plugin_uninstall(
            manifest
                .executable
                .command_names
                .first()
                .map(String::as_str)
                .unwrap_or("claude"),
            &["plugin", "uninstall", "atoaxis-heartbeat@atoaxis-plugins"],
            home,
        ),
        AdapterRuntime::GeminiCli => (
            "manual".into(),
            Some("remove the AtoAxis Gemini extension with the installed Gemini CLI; no managed config is edited".into()),
        ),
        AdapterRuntime::KiloCode => run_bundle_uninstaller(bundle, "kilo-code", home),
        AdapterRuntime::KimiCodeCli => run_bundle_uninstaller(bundle, "kimi-code", home),
        _ => (
            "unsupported".into(),
            Some("adapter has no standalone uninstall path".into()),
        ),
    }
}

fn run_plugin_uninstall(program: &str, args: &[&str], home: &Path) -> (String, Option<String>) {
    let path = resolve_and_probe_executable(&[program.to_string()], Some("--version"));
    let Some(path) = path else {
        return (
            "not_detected".into(),
            Some(format!("{program} executable not found")),
        );
    };
    match run_external(&path, args, home) {
        Ok(()) => ("uninstalled".into(), None),
        Err(error) => ("failed".into(), Some(error)),
    }
}

fn run_bundle_uninstaller(
    bundle: Option<&Path>,
    adapter: &str,
    home: &Path,
) -> (String, Option<String>) {
    let Some(bundle) = bundle else {
        return (
            "not_installed".into(),
            Some("no managed adapter bundle found".into()),
        );
    };
    let installer = bundle.join(adapter).join("installer/install.sh");
    if !installer.is_file() {
        return (
            "unsupported".into(),
            Some("managed adapter installer is missing".into()),
        );
    }
    match run_external(
        Path::new("/bin/bash"),
        &[&installer.display().to_string(), "--uninstall"],
        home,
    ) {
        Ok(()) => ("uninstalled".into(), None),
        Err(error) => ("failed".into(), Some(error)),
    }
}

fn remove_codex_managed_hooks(config: &str) -> String {
    let markers = [
        "# AtoAxis managed AI attribution hook",
        "# AtoAxis managed AI shell sweep hooks",
        "# AtoAxis managed AI shell failure cleanup",
    ];
    let mut result = Vec::new();
    let mut in_managed = false;
    let mut blank_run = 0u8;
    for line in config.lines() {
        let trimmed = line.trim();
        if markers.iter().any(|marker| trimmed.starts_with(marker)) {
            in_managed = true;
            blank_run = 0;
            continue;
        }
        if in_managed {
            if trimmed.starts_with('[') && !trimmed.starts_with("[[hooks.") {
                in_managed = false;
                result.push(line);
                continue;
            }
            if trimmed.is_empty() {
                blank_run = blank_run.saturating_add(1);
                if blank_run >= 2 {
                    in_managed = false;
                }
                continue;
            }
            if blank_run >= 2 {
                in_managed = false;
            } else if trimmed.starts_with("[[hooks.")
                || trimmed.starts_with("type =")
                || trimmed.starts_with("matcher =")
                || trimmed.starts_with("command =")
                || trimmed.starts_with("timeout =")
            {
                continue;
            }
        }
        result.push(line);
    }
    let mut output = result.join("\n");
    if config.ends_with('\n') && !output.is_empty() {
        output.push('\n');
    }
    output
}

fn selected_ids(
    registry: &AdapterRegistry,
    requested_agent: Option<&str>,
    all: bool,
) -> Result<Vec<String>, Box<dyn Error>> {
    if all {
        let platform = std::env::consts::OS;
        return Ok(registry
            .catalog_v1()
            .adapters
            .into_iter()
            .filter(|entry| !matches!(entry.runtime, AdapterRuntime::None))
            .filter(|entry| entry.supports_platform(platform))
            .map(|entry| entry.manifest.id)
            .collect());
    }
    let raw = requested_agent.unwrap_or_default();
    let id = normalize_client_id(raw).map_err(|error| error.to_string())?;
    if registry.get(&id).is_none() {
        return Err(format!("adapter '{raw}' is not registered").into());
    }
    Ok(vec![id])
}

fn setup_adapter(
    manifest: &AdapterManifest,
    runtime: AdapterRuntime,
    bundle: Option<&Path>,
    home: &Path,
) -> SetupAgentReport {
    let executable = resolve_and_probe_executable(
        &manifest.executable.command_names,
        manifest.executable.version_arg.as_deref(),
    );
    let verification_status = match manifest.effective_status() {
        VerificationStatus::Verified => "verified",
        VerificationStatus::Scaffold => "scaffold",
        VerificationStatus::Unverified => "unverified",
    }
    .to_string();

    if matches!(runtime, AdapterRuntime::None) {
        return SetupAgentReport {
            id: manifest.id.clone(),
            status: "unsupported".into(),
            outcome_code: "unsupported_strategy".into(),
            executable: None,
            verification_status,
            suggested_action: Some(
                "use the adapter's documented manual or transcript integration".into(),
            ),
            detail: Some(
                "the registry has no tested standalone setup implementation for this adapter"
                    .into(),
            ),
        };
    }

    if is_adapter_disabled(&manifest.id) {
        return SetupAgentReport {
            id: manifest.id.clone(),
            status: "skipped".into(),
            outcome_code: "disabled_by_policy".into(),
            executable: None,
            verification_status,
            suggested_action: Some(format!(
                "remove {DISABLED_ADAPTERS_ENV} entry to enable this adapter"
            )),
            detail: Some(format!(
                "disabled by {DISABLED_ADAPTERS_ENV}; core heartbeat remains enabled"
            )),
        };
    }

    if let Err(error) = verify_runtime_dependencies(runtime) {
        return SetupAgentReport {
            id: manifest.id.clone(),
            status: "failed".into(),
            outcome_code: "dependency_missing".into(),
            executable: None,
            verification_status,
            suggested_action: Some("install the required local hook dependencies and retry".into()),
            detail: Some(error),
        };
    }

    let Some(bundle_root) = bundle else {
        return SetupAgentReport {
            id: manifest.id.clone(),
            status: "failed".into(),
            outcome_code: "resource_invalid".into(),
            executable: None,
            verification_status,
            suggested_action: Some("install a verified adapter bundle and retry setup".into()),
            detail: Some("verified adapter bundle is unavailable".into()),
        };
    };
    if let Err(error) = verify_runtime_resources(bundle_root, runtime) {
        return SetupAgentReport {
            id: manifest.id.clone(),
            status: "failed".into(),
            outcome_code: "resource_invalid".into(),
            executable: None,
            verification_status,
            suggested_action: Some("repair or reinstall the bundled adapter resources".into()),
            detail: Some(error),
        };
    }

    let Some(executable_path) = executable else {
        return SetupAgentReport {
            id: manifest.id.clone(),
            status: "not_detected".into(),
            outcome_code: "skipped_not_detected".into(),
            executable: None,
            verification_status,
            suggested_action: Some("install the adapter executable, then retry setup".into()),
            detail: Some(format!(
                "{} not found or did not answer its configured version probe",
                manifest.executable.command_names.join("/")
            )),
        };
    };

    let executable_text = executable_path.display().to_string();
    let result = match runtime {
        AdapterRuntime::Codex => configure_codex(bundle_root, home),
        AdapterRuntime::ClaudeCode => configure_claude(&executable_path, bundle_root, home),
        AdapterRuntime::GeminiCli => configure_gemini(&executable_path, bundle_root, home),
        AdapterRuntime::KiloCode => configure_script(bundle_root, "kilo-code", home),
        AdapterRuntime::KimiCodeCli => configure_script(bundle_root, "kimi-code", home),
        AdapterRuntime::None => Err("adapter has no standalone setup implementation".to_string()),
    };

    match result {
        Ok(detail) => SetupAgentReport {
            id: manifest.id.clone(),
            status: "configured".into(),
            outcome_code: "configured".into(),
            executable: Some(executable_text),
            verification_status,
            suggested_action: None,
            detail,
        },
        Err(error) => SetupAgentReport {
            id: manifest.id.clone(),
            status: "failed".into(),
            outcome_code: if error.contains("unsupported") || error.contains("no standalone") {
                "unsupported_strategy".into()
            } else if error.contains("bundle") {
                "resource_invalid".into()
            } else {
                "failed".into()
            },
            executable: Some(executable_text),
            verification_status,
            suggested_action: Some(
                "repair the adapter resource/configuration and retry setup".into(),
            ),
            detail: Some(error),
        },
    }
}

fn print_text_report(report: &SetupReport) {
    println!(
        "Bundle: {}",
        report.bundle.as_deref().unwrap_or("unavailable")
    );
    if let Some(detail) = &report.bundle_detail {
        println!("Bundle note: {detail}");
    }
    println!(
        "Runtime: {} (legacy service installed={} running={})",
        report.broker.runtime_mode, report.broker.installed, report.broker.running
    );
    if let Some(detail) = &report.broker.detail {
        println!("Broker note: {detail}");
    }
    if let Some(detail) = &report.observer_detail {
        println!("Observer note: {detail}");
    }
    for agent in &report.agents {
        println!(
            "{}: {} (verification={}, executable={})",
            agent.id,
            agent.status,
            agent.verification_status,
            agent.executable.as_deref().unwrap_or("none")
        );
        if let Some(detail) = &agent.detail {
            println!("  {detail}");
        }
    }
}

fn resolve_and_probe_executable(names: &[String], version_arg: Option<&str>) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    for directory in std::env::split_paths(&path) {
        for name in names {
            let candidate = directory.join(name);
            if !candidate.is_file() {
                continue;
            }
            let status = Command::new(&candidate)
                .arg(version_arg.unwrap_or("--version"))
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status();
            if status.is_ok_and(|value| value.success()) {
                return Some(candidate);
            }
        }
    }
    None
}

fn verify_runtime_dependencies(runtime: AdapterRuntime) -> Result<(), String> {
    if cfg!(windows) {
        return Err(
            "native shell hook setup is unsupported on Windows; use transcript mode".into(),
        );
    }
    let dependencies: &[&str] = match runtime {
        AdapterRuntime::ClaudeCode
        | AdapterRuntime::Codex
        | AdapterRuntime::GeminiCli
        | AdapterRuntime::KiloCode
        | AdapterRuntime::KimiCodeCli => &["bash", "jq"],
        AdapterRuntime::None => &[],
    };
    let path = std::env::var_os("PATH").unwrap_or_default();
    for dependency in dependencies {
        if !std::env::split_paths(&path).any(|directory| directory.join(dependency).is_file()) {
            return Err(format!(
                "required dependency '{dependency}' is not available on PATH"
            ));
        }
    }
    Ok(())
}

/// Locate a bundle from the environment, a checkout, or a bundle previously
/// copied by the VS Code extension.  The environment override is useful for a
/// packaged CLI whose resources live outside the executable directory.
fn find_bundle_source(home: &Path, target: &Path) -> Option<PathBuf> {
    if let Ok(value) = std::env::var(BUNDLE_ENV) {
        let candidate = PathBuf::from(value);
        if candidate.is_dir() && candidate != target {
            return Some(candidate);
        }
    }

    let mut candidates = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("extensions/ai-agents"));
        candidates.push(cwd.join("resources/ai-agents"));
    }
    if let Ok(executable) = std::env::current_exe() {
        for ancestor in executable.ancestors().take(8) {
            candidates.push(ancestor.join("extensions/ai-agents"));
            candidates.push(ancestor.join("resources/ai-agents"));
        }
    }

    // A stable bundle from the VS Code setup is already safe to reuse.  Sort the
    // directory names so an upgrade picks the newest lexical version first.
    let managed_root = home.join(".wakaclock/agent-plugins");
    if let Ok(entries) = fs::read_dir(&managed_root) {
        let mut managed: Vec<PathBuf> = entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| path.is_dir() && path != target)
            .collect();
        managed.sort_by(|a, b| b.cmp(a));
        candidates.extend(managed);
    }

    candidates
        .into_iter()
        .find(|candidate| candidate.is_dir() && verify_bundle(candidate, None).is_ok())
}

fn ensure_managed_bundle(home: &Path) -> Result<Option<PathBuf>, String> {
    let target = home
        .join(".wakaclock")
        .join("agent-plugins")
        .join(format!("cli-{BUNDLE_VERSION}"));
    let source = find_bundle_source(home, &target);
    if target.is_dir() {
        if let Ok(target_manifest) = verify_bundle(&target, None) {
            let source_is_new = source
                .as_deref()
                .and_then(|path| verify_bundle(path, None).ok())
                .is_some_and(|manifest| manifest.digest != target_manifest.digest);
            if !source_is_new {
                update_active_bundle(home, &target)?;
                return Ok(Some(target));
            }
        }
    }
    let Some(source) = source else {
        return Err(
            "no verified adapter bundle was found; reinstall the CLI or Extension resources".into(),
        );
    };
    let staging = target.with_extension(format!("staging-{}", std::process::id()));
    if staging.exists() {
        fs::remove_dir_all(&staging).map_err(|error| error.to_string())?;
    }
    copy_tree(&source, &staging).map_err(|error| format!("copying adapter bundle: {error}"))?;
    verify_bundle(&staging, None).map_err(|error| format!("verifying adapter bundle: {error}"))?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    if target.exists() {
        // Preserve the previous verified directory until the new tree has been
        // fully checked and renamed. A failed copy therefore cannot point hooks
        // at a half-written bundle.
        fs::remove_dir_all(&target).map_err(|error| error.to_string())?;
    }
    fs::rename(&staging, &target).map_err(|error| error.to_string())?;
    update_active_bundle(home, &target)?;
    Ok(Some(target))
}

fn bundle_root(home: &Path) -> PathBuf {
    home.join(".wakaclock/agent-plugins")
}

fn active_bundle_path(home: &Path) -> PathBuf {
    bundle_root(home).join(ACTIVE_BUNDLE_FILENAME)
}

fn hash_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

fn bundle_files(root: &Path) -> Result<BTreeMap<String, String>, String> {
    fn visit(
        root: &Path,
        current: &Path,
        files: &mut BTreeMap<String, String>,
    ) -> Result<(), String> {
        let entries = fs::read_dir(current).map_err(|error| error.to_string())?;
        for entry in entries {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            let file_type = entry.file_type().map_err(|error| error.to_string())?;
            if file_type.is_symlink() {
                return Err(format!(
                    "symlinks are not allowed in adapter bundles: {}",
                    path.display()
                ));
            }
            if file_type.is_dir() {
                visit(root, &path, files)?;
            } else if file_type.is_file() {
                let relative = path
                    .strip_prefix(root)
                    .map_err(|error| error.to_string())?
                    .to_string_lossy()
                    .replace('\\', "/");
                if relative == BUNDLE_MANIFEST_FILENAME {
                    continue;
                }
                let bytes = fs::read(&path).map_err(|error| error.to_string())?;
                files.insert(relative, hash_bytes(&bytes));
            }
        }
        Ok(())
    }
    let mut files = BTreeMap::new();
    visit(root, root, &mut files)?;
    Ok(files)
}

fn bundle_digest(files: &BTreeMap<String, String>) -> Result<String, String> {
    serde_json::to_vec(files)
        .map(|bytes| hash_bytes(&bytes))
        .map_err(|error| error.to_string())
}

#[cfg(test)]
fn write_bundle_manifest(root: &Path, bundle_version: &str) -> Result<BundleManifest, String> {
    let files = bundle_files(root)?;
    let manifest = BundleManifest {
        schema_version: BUNDLE_MANIFEST_SCHEMA_VERSION,
        bundle_version: bundle_version.to_string(),
        digest: bundle_digest(&files)?,
        files,
    };
    write_text_atomically(
        &root.join(BUNDLE_MANIFEST_FILENAME),
        &format!(
            "{}\n",
            serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?
        ),
    )
    .map_err(|error| error.to_string())?;
    Ok(manifest)
}

fn verify_bundle(root: &Path, expected_version: Option<&str>) -> Result<BundleManifest, String> {
    let manifest_path = root.join(BUNDLE_MANIFEST_FILENAME);
    let text = fs::read_to_string(&manifest_path).map_err(|error| {
        format!(
            "missing bundle manifest {}: {error}",
            manifest_path.display()
        )
    })?;
    let manifest: BundleManifest =
        serde_json::from_str(&text).map_err(|error| format!("invalid bundle manifest: {error}"))?;
    if manifest.schema_version != BUNDLE_MANIFEST_SCHEMA_VERSION {
        return Err(format!(
            "unsupported bundle manifest schema {}",
            manifest.schema_version
        ));
    }
    if manifest.bundle_version.trim().is_empty()
        || expected_version.is_some_and(|version| version != manifest.bundle_version)
    {
        return Err("bundle version does not match the requested artifact".into());
    }
    let actual_files = bundle_files(root)?;
    let actual_digest = bundle_digest(&actual_files)?;
    if actual_files != manifest.files || actual_digest != manifest.digest {
        return Err("bundle checksum does not match its files".into());
    }
    for required in ["common/emit-event.sh"] {
        if !manifest.files.contains_key(required) {
            return Err(format!("bundle is missing required resource {required}"));
        }
    }
    Ok(manifest)
}

fn verify_runtime_resources(root: &Path, runtime: AdapterRuntime) -> Result<(), String> {
    let required: &[&str] = match runtime {
        AdapterRuntime::ClaudeCode => &[
            "plugins/atoaxis-heartbeat/.claude-plugin/plugin.json",
            "plugins/atoaxis-heartbeat/hooks/hooks.json",
        ],
        AdapterRuntime::Codex => &[
            "codex/heartbeat-hook.sh",
            "codex/git-sweep-before.sh",
            "codex/git-sweep-after.sh",
            "codex/tool-abort.sh",
        ],
        AdapterRuntime::GeminiCli => &[
            "gemini-cli/gemini-extension.json",
            "gemini-cli/hooks/hooks.json",
        ],
        AdapterRuntime::KiloCode => &[
            "kilo-code/src/plugin.ts",
            "kilo-code/installer/entrypoint.ts",
            "kilo-code/installer/install.sh",
        ],
        AdapterRuntime::KimiCodeCli => &["kimi-code/installer/install.sh"],
        AdapterRuntime::None => &[],
    };
    for relative in required {
        if !root.join(relative).is_file() {
            return Err(format!(
                "verified bundle is missing required resource {relative}"
            ));
        }
    }
    Ok(())
}

fn update_active_bundle(home: &Path, target: &Path) -> Result<(), String> {
    let manifest = verify_bundle(target, None)?;
    let previous = fs::read_to_string(active_bundle_path(home))
        .ok()
        .and_then(|text| serde_json::from_str::<ActiveBundleState>(&text).ok())
        .map(|state| state.active)
        .filter(|path| path != &target.display().to_string());
    let state = ActiveBundleState {
        schema_version: BUNDLE_MANIFEST_SCHEMA_VERSION,
        active: target.display().to_string(),
        checksum: manifest.digest,
        previous,
    };
    write_text_atomically(
        &active_bundle_path(home),
        &format!(
            "{}\n",
            serde_json::to_string_pretty(&state).map_err(|error| error.to_string())?
        ),
    )
    .map_err(|error| error.to_string())
}

fn copy_tree(source: &Path, target: &Path) -> io::Result<()> {
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            copy_tree(&source_path, &target_path)?;
        } else if file_type.is_file() {
            fs::copy(&source_path, &target_path)?;
            #[cfg(unix)]
            if source_path.extension().is_some_and(|ext| ext == "sh") {
                use std::os::unix::fs::PermissionsExt;
                let mut permissions = fs::metadata(&target_path)?.permissions();
                permissions.set_mode(0o755);
                fs::set_permissions(&target_path, permissions)?;
            }
        }
    }
    Ok(())
}

fn configure_claude(
    executable: &Path,
    bundle: &Path,
    home: &Path,
) -> Result<Option<String>, String> {
    run_external(
        executable,
        &[
            "plugin",
            "marketplace",
            "add",
            &bundle.display().to_string(),
        ],
        home,
    )?;
    run_external(
        executable,
        &["plugin", "install", "atoaxis-heartbeat@atoaxis-plugins"],
        home,
    )?;
    Ok(None)
}

fn configure_gemini(
    executable: &Path,
    bundle: &Path,
    home: &Path,
) -> Result<Option<String>, String> {
    let extension = bundle.join("gemini-cli");
    // `--consent` skips Gemini's interactive "do you trust this folder? [y/N]" prompt.
    // Safe to pass here and nowhere earlier: `run` only reaches an adapter's configure
    // step after AtoAxis's own per-agent consent gate has recorded `HookConsent::Enabled`
    // (an explicit `--yes`, or a prior stored opt-in). Without it the child blocks on a
    // prompt that a null stdin can never answer — see `EXTERNAL_INSTALL_TIMEOUT`.
    run_external(
        executable,
        &[
            "extensions",
            "install",
            &extension.display().to_string(),
            "--consent",
        ],
        home,
    )?;
    Ok(None)
}

fn configure_script(bundle: &Path, adapter: &str, home: &Path) -> Result<Option<String>, String> {
    let installer = bundle.join(adapter).join("installer/install.sh");
    if !installer.is_file() {
        return Err(format!("installer is missing at {}", installer.display()));
    }
    run_external(
        Path::new("/bin/bash"),
        &[&installer.display().to_string()],
        home,
    )?;
    Ok(None)
}

/// How long an agent's own installer may run before setup gives up on it.
///
/// Not a nicety: Gemini CLI 0.58.0 answers `extensions install` with an interactive
/// "do you trust this folder? [y/N]" prompt, and a null stdin does not make it exit —
/// it simply waits. Without a deadline `wakaclock ai setup` hangs forever, and
/// `--all` hangs on the first such agent and never reaches the rest.
const EXTERNAL_INSTALL_TIMEOUT: Duration = Duration::from_secs(120);

fn run_external(program: &Path, args: &[&str], home: &Path) -> Result<(), String> {
    let mut child = Command::new(program)
        .args(args)
        .env("HOME", home)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("could not run {}: {error}", program.display()))?;

    // Drain both pipes on their own threads. Polling `try_wait` while the child fills a
    // 64 KiB pipe buffer would deadlock the child instead of timing it out.
    let mut stdout = child.stdout.take();
    let mut stderr = child.stderr.take();
    let out_reader = thread::spawn(move || {
        let mut buffer = Vec::new();
        if let Some(pipe) = stdout.as_mut() {
            let _ = pipe.read_to_end(&mut buffer);
        }
        buffer
    });
    let err_reader = thread::spawn(move || {
        let mut buffer = Vec::new();
        if let Some(pipe) = stderr.as_mut() {
            let _ = pipe.read_to_end(&mut buffer);
        }
        buffer
    });

    let deadline = Instant::now() + EXTERNAL_INSTALL_TIMEOUT;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!(
                        "{} did not finish within {}s",
                        program.display(),
                        EXTERNAL_INSTALL_TIMEOUT.as_secs()
                    ));
                }
                thread::sleep(Duration::from_millis(100));
            }
            Err(error) => return Err(format!("could not wait for {}: {error}", program.display())),
        }
    };
    let output = std::process::Output {
        status,
        stdout: out_reader.join().unwrap_or_default(),
        stderr: err_reader.join().unwrap_or_default(),
    };
    if output.status.success() {
        return Ok(());
    }
    // Some installers use a non-zero exit code for an idempotent "already
    // installed" operation.  Inspect the bounded diagnostic but never return it
    // to the caller (agent CLIs occasionally put prompt text in stderr).
    let diagnostic = format!(
        "{} {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    )
    .to_ascii_lowercase();
    if diagnostic.contains("already")
        || diagnostic.contains("already exists")
        || diagnostic.contains("already installed")
        || diagnostic.contains("is present")
    {
        return Ok(());
    }
    Err(format!(
        "{} exited with {}",
        program.display(),
        output.status
    ))
}

fn configure_codex(bundle: &Path, home: &Path) -> Result<Option<String>, String> {
    let hook_dir = bundle.join("codex");
    for name in [
        "heartbeat-hook.sh",
        "git-sweep-before.sh",
        "git-sweep-after.sh",
        "tool-abort.sh",
    ] {
        if !hook_dir.join(name).is_file() {
            return Err(format!("Codex hook bundle is missing {name}"));
        }
    }
    let managed_root = home.join(".wakaclock/agent-plugins");
    if !hook_dir.starts_with(&managed_root) {
        return Err(format!(
            "refusing to register a Codex hook outside {}",
            managed_root.display()
        ));
    }

    let config_path = home.join(".codex/config.toml");
    let existing = fs::read_to_string(&config_path).unwrap_or_default();
    let updated = ensure_codex_features(existing);
    let updated = ensure_codex_managed_hooks(&updated, &hook_dir);
    if updated != fs::read_to_string(&config_path).unwrap_or_default() {
        write_text_atomically(&config_path, &updated).map_err(|error| error.to_string())?;
        Ok(Some(format!("updated {}", config_path.display())))
    } else {
        Ok(Some("Codex managed hooks already configured".into()))
    }
}

fn ensure_codex_features(mut config: String) -> String {
    let mut has_hooks = false;
    let mut feature_header = None;
    for (index, line) in config.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed == "[features]" {
            feature_header = Some(index);
        }
        if trimmed == "hooks = true" {
            has_hooks = true;
        }
    }
    if has_hooks {
        return config;
    }
    if let Some(header) = feature_header {
        let mut lines: Vec<String> = config.lines().map(str::to_string).collect();
        lines.insert(header + 1, "hooks = true".into());
        return format!("{}\n", lines.join("\n"));
    }
    let mut replaced = false;
    let mut lines = Vec::new();
    for line in config.lines() {
        if line.trim() == "codex_hooks = true" {
            lines.push("hooks = true".to_string());
            replaced = true;
        } else {
            lines.push(line.to_string());
        }
    }
    if replaced {
        return format!("{}\n", lines.join("\n"));
    }
    config.push_str("\n\n[features]\nhooks = true\n");
    config
}

fn ensure_codex_managed_hooks(config: &str, hook_dir: &Path) -> String {
    let attribution = "# AtoAxis managed AI attribution hook";
    let sweep = "# AtoAxis managed AI shell sweep hooks";
    let failure = "# AtoAxis managed AI shell failure cleanup";
    let paths = [
        ("heartbeat-hook.sh", hook_dir.join("heartbeat-hook.sh")),
        ("git-sweep-before.sh", hook_dir.join("git-sweep-before.sh")),
        ("git-sweep-after.sh", hook_dir.join("git-sweep-after.sh")),
        ("tool-abort.sh", hook_dir.join("tool-abort.sh")),
    ];
    let mut updated = refresh_codex_managed_commands(config, hook_dir);
    if !updated.contains(attribution) {
        updated.push_str(&format!(
            "\n{attribution}\n[[hooks.PostToolUse]]\nmatcher = \"^apply_patch$\"\n[[hooks.PostToolUse.hooks]]\ntype = \"command\"\ncommand = {}\ntimeout = 60\n",
            toml_quote(&paths[0].1)
        ));
    }
    if !updated.contains(sweep) {
        updated.push_str(&format!(
            "\n{sweep}\n[[hooks.PreToolUse]]\nmatcher = \"Bash|shell_command|exec_command|unified_exec|code_mode_exec|exec|functions[.]exec|mcp__.*\"\n[[hooks.PreToolUse.hooks]]\ntype = \"command\"\ncommand = {}\ntimeout = 60\n\n[[hooks.PostToolUse]]\nmatcher = \"Bash|shell_command|exec_command|unified_exec|code_mode_exec|exec|functions[.]exec|mcp__.*\"\n[[hooks.PostToolUse.hooks]]\ntype = \"command\"\ncommand = {}\ntimeout = 60\n",
            toml_quote(&paths[1].1),
            toml_quote(&paths[2].1)
        ));
    }
    if !updated.contains(failure) {
        updated.push_str(&format!(
            "\n{failure}\n[[hooks.PostToolUseFailure]]\nmatcher = \"Bash|shell_command|exec_command|unified_exec|code_mode_exec|exec|functions[.]exec|mcp__.*\"\n[[hooks.PostToolUseFailure.hooks]]\ntype = \"command\"\ncommand = {}\ntimeout = 60\n",
            toml_quote(&paths[3].1)
        ));
    }
    updated
}

/// Repoint only commands inside marker-bounded AtoAxis blocks.  A CLI upgrade may
/// copy a new version of the bundle while the user's `config.toml` still contains
/// commands for the previous version; leaving those paths untouched silently
/// disables attribution after the upgrade.  The parser is deliberately line based
/// and conservative: once a user-owned table/comment begins, the remainder is
/// left byte-for-byte unchanged.
fn refresh_codex_managed_commands(config: &str, hook_dir: &Path) -> String {
    let markers = [
        "# AtoAxis managed AI attribution hook",
        "# AtoAxis managed AI shell sweep hooks",
        "# AtoAxis managed AI shell failure cleanup",
    ];
    let wanted = [
        ("heartbeat-hook.sh", hook_dir.join("heartbeat-hook.sh")),
        ("git-sweep-before.sh", hook_dir.join("git-sweep-before.sh")),
        ("git-sweep-after.sh", hook_dir.join("git-sweep-after.sh")),
        ("tool-abort.sh", hook_dir.join("tool-abort.sh")),
    ];
    let mut lines: Vec<String> = config.lines().map(str::to_string).collect();
    let mut in_managed = false;
    let mut blank_run = 0u8;
    for line in &mut lines {
        let trimmed = line.trim();
        if markers.iter().any(|marker| trimmed.starts_with(marker)) {
            in_managed = true;
            blank_run = 0;
            continue;
        }
        if !in_managed {
            continue;
        }
        if trimmed.is_empty() {
            blank_run = blank_run.saturating_add(1);
            if blank_run >= 2 {
                in_managed = false;
            }
            continue;
        }
        blank_run = 0;
        if trimmed.starts_with('#')
            || (trimmed.starts_with('[') && !trimmed.starts_with("[[hooks."))
        {
            in_managed = false;
            continue;
        }
        if trimmed == "matcher = \"apply_patch\"" {
            *line = line.replace("\"apply_patch\"", "\"^apply_patch$\"");
            continue;
        }
        // Desktop wraps shell and nested tool calls in `exec`. Refresh existing
        // managed installs too; appending new blocks only fixes fresh installs.
        if trimmed
            == "matcher = \"Bash|shell_command|exec_command|unified_exec|code_mode_exec|mcp__.*\""
        {
            *line = line.replace("code_mode_exec|", "code_mode_exec|exec|functions[.]exec|");
            continue;
        }
        let Some(command_start) = line.find("command") else {
            continue;
        };
        let prefix = &line[..command_start];
        if !line[command_start..].trim_start().starts_with("command") {
            continue;
        }
        let Some(value_start) = line[command_start..].find('"') else {
            continue;
        };
        let value_start = command_start + value_start + 1;
        let Some(value_end) = line[value_start..].find('"') else {
            continue;
        };
        let current = &line[value_start..value_start + value_end];
        let basename = current.rsplit('/').next().unwrap_or_default();
        let Some((_, replacement)) = wanted.iter().find(|(name, _)| *name == basename) else {
            continue;
        };
        let suffix = &line[value_start + value_end + 1..];
        *line = format!("{prefix}command = {}{suffix}", toml_quote(replacement));
    }
    let mut result = lines.join("\n");
    if config.ends_with('\n') {
        result.push('\n');
    }
    result
}

fn toml_quote(path: &Path) -> String {
    let value = path.to_string_lossy();
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

fn write_text_atomically(path: &Path, content: &str) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let staging = path.with_extension(format!("atoaxis-staging-{}", std::process::id()));
    fs::write(&staging, content)?;
    fs::rename(staging, path)
}

fn set_private_permissions(path: &Path) -> Result<(), Box<dyn Error>> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn setup_requires_one_selection_mode() {
        let registry = AdapterRegistry::builtin();
        assert_eq!(
            selected_ids(&registry, None, true).unwrap(),
            registry
                .catalog_v1()
                .adapters
                .into_iter()
                .filter(|entry| !matches!(entry.runtime, AdapterRuntime::None))
                .filter(|entry| entry.supports_platform(std::env::consts::OS))
                .map(|entry| entry.manifest.id)
                .collect::<Vec<_>>()
        );
        assert_eq!(
            selected_ids(&registry, Some("Kilo Code"), false).unwrap(),
            vec!["kilo-code"]
        );
        assert!(selected_ids(&registry, Some("not-an-agent"), false).is_err());
    }

    #[test]
    fn bundle_manifest_rejects_tampering_and_tracks_active_pointer() {
        let home = std::env::temp_dir().join(format!("wakaclock-bundle-{}", uuid::Uuid::new_v4()));
        let bundle = home.join(".wakaclock/agent-plugins/cli-0.1.0");
        fs::create_dir_all(bundle.join("common")).unwrap();
        fs::write(bundle.join("common/emit-event.sh"), "#!/bin/sh\n").unwrap();
        let manifest = write_bundle_manifest(&bundle, "0.1.0").unwrap();
        assert_eq!(verify_bundle(&bundle, Some("0.1.0")).unwrap(), manifest);
        update_active_bundle(&home, &bundle).unwrap();
        assert!(active_bundle_path(&home).is_file());
        fs::write(bundle.join("common/emit-event.sh"), "tampered\n").unwrap();
        assert!(verify_bundle(&bundle, None).is_err());
        let _ = fs::remove_dir_all(home);
    }

    #[test]
    fn codex_config_is_idempotent_and_preserves_user_content() {
        let home = std::env::temp_dir().join(format!("wakaclock-setup-{}", uuid::Uuid::new_v4()));
        let bundle = home.join(".wakaclock/agent-plugins/0.1.0/codex");
        fs::create_dir_all(&bundle).unwrap();
        for name in [
            "heartbeat-hook.sh",
            "git-sweep-before.sh",
            "git-sweep-after.sh",
            "tool-abort.sh",
        ] {
            fs::write(bundle.join(name), "#!/bin/sh\n").unwrap();
        }
        let config = "# user-owned hook\n[features]\n# preserve\n";
        let first = ensure_codex_features(config.to_string());
        let first = ensure_codex_managed_hooks(&first, &bundle);
        let second = ensure_codex_managed_hooks(&first, &bundle);
        assert_eq!(first, second);
        assert!(first.starts_with("# user-owned hook\n[features]\nhooks = true\n# preserve\n"));
        assert_eq!(
            first
                .matches("# AtoAxis managed AI attribution hook")
                .count(),
            1
        );
        assert!(first.contains("heartbeat-hook.sh"));
        let _ = fs::remove_dir_all(home);
    }

    #[test]
    fn codex_setup_upgrades_bridge_matchers_only_in_managed_blocks() {
        let old =
            "matcher = \"Bash|shell_command|exec_command|unified_exec|code_mode_exec|mcp__.*\"";
        let config = format!("# AtoAxis managed AI shell sweep hooks\n[[hooks.PreToolUse]]\n{old}\n\n# user-owned hook\n[[hooks.PreToolUse]]\n{old}\n");
        let updated = ensure_codex_managed_hooks(&config, Path::new("/bundle/codex"));
        assert!(updated.contains("code_mode_exec|exec|functions[.]exec|mcp__.*"));
        assert!(updated.contains(&format!("# user-owned hook\n[[hooks.PreToolUse]]\n{old}")));
        assert_eq!(
            updated,
            ensure_codex_managed_hooks(&updated, Path::new("/bundle/codex"))
        );
    }

    #[test]
    fn codex_setup_refreshes_stale_managed_command_paths_only() {
        let config = r#"# user command = \"/keep/me.sh\"

# AtoAxis managed AI attribution hook
[[hooks.PostToolUse]]
matcher = "apply_patch"
[[hooks.PostToolUse.hooks]]
type = "command"
command = "/old/version/heartbeat-hook.sh"
timeout = 60

# AtoAxis managed AI shell failure cleanup
[[hooks.PostToolUseFailure]]
command = "/old/version/tool-abort.sh"

# user-owned table
[other]
command = "/keep/me.sh"
"#;
        let hook_dir = PathBuf::from("/home/test/.wakaclock/agent-plugins/0.2.0/codex");
        let updated = ensure_codex_managed_hooks(config, &hook_dir);
        assert!(updated.contains("matcher = \"^apply_patch$\""));
        assert!(updated.contains(
            "command = \"/home/test/.wakaclock/agent-plugins/0.2.0/codex/heartbeat-hook.sh\""
        ));
        assert!(updated.contains(
            "command = \"/home/test/.wakaclock/agent-plugins/0.2.0/codex/tool-abort.sh\""
        ));
        assert!(updated.contains("[other]\ncommand = \"/keep/me.sh\""));
        assert!(updated.contains("# user command = \\\"/keep/me.sh\\\""));
    }

    #[test]
    fn toml_quote_escapes_windows_and_quote_characters() {
        let path = PathBuf::from(r#"C:\Users\A"B\wakaclock"#);
        assert_eq!(toml_quote(&path), r#""C:\\Users\\A\"B\\wakaclock""#);
    }

    #[test]
    fn codex_uninstall_removes_only_managed_hook_blocks() {
        let config = "# user-owned\n[features]\nhooks = true\n\n# AtoAxis managed AI attribution hook\n[[hooks.PostToolUse]]\nmatcher = \"^apply_patch$\"\ncommand = \"/managed/heartbeat-hook.sh\"\ntimeout = 60\n\n# AtoAxis managed AI shell failure cleanup\n[[hooks.PostToolUseFailure]]\ncommand = \"/managed/tool-abort.sh\"\n\n[other]\ncommand = \"/user/hook.sh\"\n";
        let updated = remove_codex_managed_hooks(config);
        assert!(updated.contains("# user-owned"));
        assert!(updated.contains("[features]\nhooks = true"));
        assert!(updated.contains("[other]\ncommand = \"/user/hook.sh\""));
        assert!(!updated.contains("AtoAxis managed"));
        assert!(!updated.contains("/managed/"));
    }

    #[test]
    fn codex_uninstall_is_idempotent_for_user_only_config() {
        let config = "# user-owned\n[features]\nhooks = true\n";
        assert_eq!(remove_codex_managed_hooks(config), config);
    }

    #[test]
    fn hook_consent_is_persisted_per_agent_and_audit_has_metadata_only_fields() {
        let home = std::env::temp_dir().join(format!(
            "wakaclock-consent-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        set_hook_consent(&home, "codex", HookConsent::Denied).unwrap();
        assert_eq!(hook_consent(&home, "codex"), Some(HookConsent::Denied));
        assert_eq!(hook_consent(&home, "claude-code"), None);
        append_hook_audit(&home, "codex", "setup", "opted_out");
        let audit = fs::read_to_string(audit_path(&home)).unwrap();
        assert!(audit.contains("\"agent\":\"codex\""));
        assert!(audit.contains("\"action\":\"setup\""));
        assert!(!audit.contains("prompt"));
        assert!(!audit.contains("content"));
        let _ = fs::remove_dir_all(home);
    }

    #[test]
    fn observer_config_is_created_once_and_user_file_is_preserved() {
        let home = std::env::temp_dir().join(format!(
            "wakaclock-observer-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        set_hook_consent(&home, "codex", HookConsent::Enabled).unwrap();
        let created = ensure_observer_config(&home).unwrap().unwrap();
        assert_eq!(created, observer_config_path(&home));
        assert_eq!(fs::read_to_string(&created).unwrap(), OBSERVER_CONFIG_BODY);
        assert!(ensure_observer_config(&home).unwrap().is_none());

        fs::write(
            &created,
            "enabled = false\nattribution_mode = \"observe_only\"\n",
        )
        .unwrap();
        assert!(ensure_observer_config(&home).unwrap().is_none());
        assert!(fs::read_to_string(&created)
            .unwrap()
            .contains("enabled = false"));
        assert!(has_enabled_consent_at(&home));
        let _ = fs::remove_dir_all(home);
    }

    #[test]
    fn legacy_consent_is_reused_without_prompting_again() {
        let home = std::env::temp_dir().join(format!(
            "wakaclock-legacy-consent-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        let legacy = home.join(".wakaclock").join(LEGACY_SETUP_STATE_FILENAME);
        fs::create_dir_all(legacy.parent().unwrap()).unwrap();
        fs::write(
            &legacy,
            r#"{"version":1,"adapters":{"codex":{"consented":true}}}"#,
        )
        .unwrap();
        assert_eq!(
            effective_consent(&home, "codex"),
            Some(HookConsent::Enabled)
        );
        assert!(has_enabled_consent_at(&home));
        set_hook_consent(&home, "codex", HookConsent::Denied).unwrap();
        assert!(!has_enabled_consent_at(&home));
        let _ = fs::remove_dir_all(home);
    }

    #[test]
    fn setup_lock_serializes_cli_and_extension_writes() {
        let home = std::env::temp_dir().join(format!(
            "wakaclock-setup-lock-{}-{}",
            std::process::id(),
            uuid::Uuid::new_v4()
        ));
        let first = acquire_setup_lock(&home).unwrap();
        let second = acquire_setup_lock(&home);
        assert!(second.is_err());
        drop(first);
        assert!(acquire_setup_lock(&home).is_ok());
        let _ = fs::remove_dir_all(home);
    }
}
