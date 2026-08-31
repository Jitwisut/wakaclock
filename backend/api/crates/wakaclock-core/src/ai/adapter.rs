//! planai2.md Phase 1 (decision p1.0 / D6): the **declarative adapter manifest**.
//!
//! One manifest describes how to detect, install, health-check and rate the trust
//! of a single AI coding agent's integration. It is deliberately data, not code:
//! adding an agent is adding a manifest, and the correlation / heartbeat layers
//! never learn a new agent's name (planai2.md §"Adapter manifest" + acceptance
//! p1.A1). The manifest is **not** part of the `BrokerEventV1` wire envelope — it
//! never travels with an event.

use std::io;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::broker::BrokerChangeKind;

/// How far an adapter has been proven to work. `Unverified` is the only value a
/// manifest may claim without evidence — `Verified` requires a recorded live check
/// (planai2.md line 604: a fixture is not live verification).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum VerificationStatus {
    /// No live run against the real tool yet — treat its output as best-effort.
    #[default]
    Unverified,
    /// Code exists and parses fixtures, but the real payload shape is unconfirmed.
    Scaffold,
    /// Exercised against the real tool; `Verification::live_checked_at` is set.
    Verified,
}

/// The trust record for an adapter. Construct through the smart constructors so a
/// `Verified` value cannot exist without its evidence; `validate` re-checks that
/// invariant after deserialization.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Verification {
    #[serde(default)]
    pub status: VerificationStatus,
    /// When the adapter was last run against the real tool. Required for `Verified`.
    #[serde(default)]
    pub live_checked_at: Option<DateTime<Utc>>,
    /// The tool/app version the live check ran against.
    #[serde(default)]
    pub tool_version: Option<String>,
    /// Free-text, metadata only (never a payload sample).
    #[serde(default)]
    pub notes: Option<String>,
}

impl Default for Verification {
    fn default() -> Self {
        Self::unverified()
    }
}

impl Verification {
    pub fn unverified() -> Self {
        Self {
            status: VerificationStatus::Unverified,
            live_checked_at: None,
            tool_version: None,
            notes: None,
        }
    }

    pub fn scaffold(notes: impl Into<String>) -> Self {
        Self {
            status: VerificationStatus::Scaffold,
            live_checked_at: None,
            tool_version: None,
            notes: Some(notes.into()),
        }
    }

    /// The only way to mint a `Verified` record — it demands the evidence.
    pub fn verified(live_checked_at: DateTime<Utc>, tool_version: impl Into<String>) -> Self {
        Self {
            status: VerificationStatus::Verified,
            live_checked_at: Some(live_checked_at),
            tool_version: Some(tool_version.into()),
            notes: None,
        }
    }

    /// `Verified` requires a live-check timestamp; anything else is a lie and is
    /// reported as `Scaffold` instead.
    pub fn effective_status(&self) -> VerificationStatus {
        match self.status {
            VerificationStatus::Verified if self.live_checked_at.is_none() => {
                VerificationStatus::Scaffold
            }
            other => other,
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.status == VerificationStatus::Verified && self.live_checked_at.is_none() {
            return Err("verification_status=verified requires live_checked_at".to_string());
        }
        Ok(())
    }
}

/// How to find the agent's executable on `PATH`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ExecutableDetection {
    /// Candidate command names (`["codex"]`, `["claude"]`, `["gemini"]`).
    pub command_names: Vec<String>,
    /// Argument that prints a version string, if the tool has one.
    #[serde(default)]
    pub version_arg: Option<String>,
}

/// How the AtoAxis integration is wired into the agent.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum InstallStrategy {
    /// A first-class plugin/extension the agent installs (`claude plugin ...`,
    /// `gemini extensions install ...`).
    NativePlugin { install_args: Vec<String> },
    /// A managed block written into the agent's own config file, under a marker.
    ConfigHookBlock {
        /// Path relative to `$HOME`, e.g. `.codex/config.toml`.
        config_path_from_home: String,
        /// The comment marker that bounds the AtoAxis-managed region.
        marker: String,
    },
    /// No install possible — only the passive transcript scanner applies.
    TranscriptOnly,
    /// Requires a manual step the platform forces on the user.
    Manual { instruction: String },
}

/// Which native hook points the agent exposes. All default `false` so an
/// unfilled manifest under-claims rather than over-claims.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct NativeHookCapabilities {
    #[serde(default)]
    pub pre_tool_use: bool,
    #[serde(default)]
    pub post_tool_use: bool,
    #[serde(default)]
    pub session_lifecycle: bool,
    #[serde(default)]
    pub apply_patch: bool,
    #[serde(default)]
    pub shell_mutation: bool,
}

/// How to tell whether a live adapter is actually feeding the pipeline.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "kind")]
pub enum HealthProbe {
    /// The transcript's mtime should be within `max_lag_seconds` of its cursor.
    TranscriptFreshness { max_lag_seconds: u64 },
    /// A native-hook event should have arrived within `max_age_seconds`.
    HookEventRecency { max_age_seconds: u64 },
    /// Nothing to probe (e.g. a pure scaffold).
    None,
}

/// The full declarative description of one agent integration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AdapterManifest {
    /// Stable id — must match `crate::ai::normalize_agent_id` output.
    pub id: String,
    pub provider: String,
    pub executable: ExecutableDetection,
    pub install: InstallStrategy,
    #[serde(default)]
    pub native_hooks: NativeHookCapabilities,
    /// Glob-ish paths, relative to `$HOME`, where this agent writes transcripts.
    #[serde(default)]
    pub transcript_roots: Vec<String>,
    /// Known payload/transcript schema shapes this adapter can parse.
    #[serde(default)]
    pub payload_schema_versions: Vec<String>,
    #[serde(default)]
    pub supported_change_kinds: Vec<BrokerChangeKind>,
    #[serde(default)]
    pub verification: Verification,
    #[serde(default = "default_health_probe")]
    pub health_probe: HealthProbe,
}

fn default_health_probe() -> HealthProbe {
    HealthProbe::None
}

impl AdapterManifest {
    /// Structural checks a registry runs on load (planai2.md p1.3): non-empty id
    /// and provider, and the "no verified without evidence" rule.
    pub fn validate(&self) -> Result<(), String> {
        if self.id.trim().is_empty() {
            return Err("adapter manifest id is empty".to_string());
        }
        if self.provider.trim().is_empty() {
            return Err(format!("adapter '{}' has no provider", self.id));
        }
        self.verification
            .validate()
            .map_err(|error| format!("adapter '{}': {error}", self.id))?;
        Ok(())
    }

    /// The status to *show*, never above what the evidence supports.
    pub fn effective_status(&self) -> VerificationStatus {
        self.verification.effective_status()
    }

    pub fn is_live_verified(&self) -> bool {
        self.effective_status() == VerificationStatus::Verified
    }
}

// ---------------------------------------------------------------------------
// planai2.md Phase 1 — p1.4 adapter registry
// ---------------------------------------------------------------------------

/// What `AdapterRegistry::install` did or wants the caller to do. The registry
/// itself only ever touches a config *file* (the `ConfigHookBlock` strategy);
/// anything that needs a subprocess (`claude plugin install`, …) or a human is
/// returned as a plan so the registry stays pure, testable and correlation-free
/// (planai2.md acceptance p1.A1).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InstallOutcome {
    /// A managed block was written into the agent's config file just now.
    ConfigBlockWritten { config_path: PathBuf },
    /// The managed block (identified by its marker) was already present — no write.
    AlreadyInstalled,
    /// The caller must run this external command to finish install.
    RequiresExternalCommand { program: String, args: Vec<String> },
    /// The platform forces a manual step; surface this text to the user.
    ManualStep { instruction: String },
    /// Passive transcript-only adapter — nothing to install.
    NothingToInstall,
}

/// Inputs an install needs that the manifest itself does not carry.
pub struct InstallContext {
    pub home_dir: PathBuf,
    /// The exact managed-block text to write for a `ConfigHookBlock` strategy.
    /// Ignored by the other strategies.
    pub config_block_body: Option<String>,
}

/// An ordered set of `AdapterManifest`s, validated on load, with no two sharing an
/// `id`. Adding an agent is `register()` + a manifest — correlation and heartbeat
/// code never change (planai2.md acceptance p1.A1).
#[derive(Debug, Clone, Default)]
pub struct AdapterRegistry {
    manifests: Vec<AdapterManifest>,
}

impl AdapterRegistry {
    pub fn from_manifests(manifests: Vec<AdapterManifest>) -> Result<Self, String> {
        let mut registry = Self::default();
        for manifest in manifests {
            registry.register(manifest)?;
        }
        Ok(registry)
    }

    /// The manifests for the agents this build actually has a parser for.
    pub fn builtin() -> Self {
        Self::from_manifests(vec![
            claude_code_manifest(),
            codex_manifest(),
            gemini_cli_manifest(),
        ])
        .expect("builtin manifests are valid")
    }

    pub fn register(&mut self, manifest: AdapterManifest) -> Result<(), String> {
        manifest.validate()?;
        if self
            .manifests
            .iter()
            .any(|existing| existing.id == manifest.id)
        {
            return Err(format!("adapter '{}' is already registered", manifest.id));
        }
        self.manifests.push(manifest);
        Ok(())
    }

    pub fn get(&self, id: &str) -> Option<&AdapterManifest> {
        self.manifests.iter().find(|manifest| manifest.id == id)
    }

    pub fn ids(&self) -> Vec<&str> {
        self.manifests.iter().map(|m| m.id.as_str()).collect()
    }

    pub fn manifests(&self) -> &[AdapterManifest] {
        &self.manifests
    }

    /// Idempotent, atomic where it writes. `ConfigHookBlock`: writes the managed
    /// block once (marker-guarded), preserving every existing byte of the file;
    /// a second call is a no-op `AlreadyInstalled`. Other strategies return a plan.
    pub fn install(&self, id: &str, ctx: &InstallContext) -> Result<InstallOutcome, String> {
        let manifest = self
            .get(id)
            .ok_or_else(|| format!("no adapter registered for '{id}'"))?;
        match &manifest.install {
            InstallStrategy::ConfigHookBlock {
                config_path_from_home,
                marker,
            } => {
                let body = ctx.config_block_body.as_deref().ok_or_else(|| {
                    format!("adapter '{id}' needs a config_block_body to install")
                })?;
                let path = ctx.home_dir.join(config_path_from_home);
                install_config_hook_block(&path, marker, body)
                    .map_err(|error| format!("adapter '{id}': {error}"))
            }
            InstallStrategy::NativePlugin { install_args } => {
                let (program, args) = install_args
                    .split_first()
                    .ok_or_else(|| format!("adapter '{id}' NativePlugin has no install command"))?;
                Ok(InstallOutcome::RequiresExternalCommand {
                    program: program.clone(),
                    args: args.to_vec(),
                })
            }
            InstallStrategy::Manual { instruction } => Ok(InstallOutcome::ManualStep {
                instruction: instruction.clone(),
            }),
            InstallStrategy::TranscriptOnly => Ok(InstallOutcome::NothingToInstall),
        }
    }
}

/// Write a marker-bounded managed block into a config file exactly once.
/// - Already contains `marker` ⇒ `AlreadyInstalled`, no write (idempotent).
/// - Otherwise: append `\n{body}\n` to the current contents and replace the file
///   via a temp-file rename (atomic), preserving everything already there.
fn install_config_hook_block(path: &Path, marker: &str, body: &str) -> io::Result<InstallOutcome> {
    let existing = std::fs::read_to_string(path).unwrap_or_default();
    if existing.contains(marker) {
        return Ok(InstallOutcome::AlreadyInstalled);
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut next = existing;
    if !next.is_empty() && !next.ends_with('\n') {
        next.push('\n');
    }
    next.push('\n');
    next.push_str(body.trim_end_matches('\n'));
    next.push('\n');

    let staging = path.with_extension(format!("atoaxis-staging-{}", std::process::id()));
    std::fs::write(&staging, next.as_bytes())?;
    std::fs::rename(&staging, path)?;
    Ok(InstallOutcome::ConfigBlockWritten {
        config_path: path.to_path_buf(),
    })
}

fn claude_code_manifest() -> AdapterManifest {
    AdapterManifest {
        id: "claude-code".to_string(),
        provider: "anthropic".to_string(),
        executable: ExecutableDetection {
            command_names: vec!["claude".to_string()],
            version_arg: Some("--version".to_string()),
        },
        install: InstallStrategy::NativePlugin {
            install_args: vec![
                "claude".to_string(),
                "plugin".to_string(),
                "install".to_string(),
                "atoaxis-heartbeat@atoaxis-plugins".to_string(),
            ],
        },
        native_hooks: NativeHookCapabilities {
            pre_tool_use: true,
            post_tool_use: true,
            session_lifecycle: true,
            apply_patch: true,
            shell_mutation: true,
        },
        transcript_roots: vec![".claude/projects".to_string()],
        payload_schema_versions: vec!["jsonl-v1".to_string()],
        supported_change_kinds: vec![BrokerChangeKind::Create, BrokerChangeKind::Modify],
        // VERIFICATION.md documents a real live end-to-end sync (2026-08-14).
        verification: Verification::verified(
            DateTime::parse_from_rfc3339("2026-08-14T00:00:00Z")
                .unwrap()
                .with_timezone(&Utc),
            "claude-code (2026-08-14 live sync)",
        ),
        health_probe: HealthProbe::TranscriptFreshness {
            max_lag_seconds: 300,
        },
    }
}

fn codex_manifest() -> AdapterManifest {
    AdapterManifest {
        id: "codex".to_string(),
        provider: "openai".to_string(),
        executable: ExecutableDetection {
            command_names: vec!["codex".to_string()],
            version_arg: Some("--version".to_string()),
        },
        install: InstallStrategy::ConfigHookBlock {
            config_path_from_home: ".codex/config.toml".to_string(),
            marker: "# AtoAxis managed AI attribution hook".to_string(),
        },
        native_hooks: NativeHookCapabilities {
            pre_tool_use: true,
            post_tool_use: true,
            apply_patch: true,
            shell_mutation: true,
            ..Default::default()
        },
        transcript_roots: vec![".codex/sessions".to_string()],
        payload_schema_versions: vec!["response_item".to_string(), "event_msg".to_string()],
        supported_change_kinds: vec![
            BrokerChangeKind::Create,
            BrokerChangeKind::Modify,
            BrokerChangeKind::Delete,
            BrokerChangeKind::Rename,
        ],
        // Real transcripts parsed (dry-run only); live delivery/dedup still open
        // per VERIFICATION.md — not full live verification.
        verification: Verification::scaffold(
            "codex.rs verified against 156 real local sessions by dry-run; live delivery open",
        ),
        health_probe: HealthProbe::TranscriptFreshness {
            max_lag_seconds: 300,
        },
    }
}

fn gemini_cli_manifest() -> AdapterManifest {
    AdapterManifest {
        id: "gemini-cli".to_string(),
        provider: "google".to_string(),
        executable: ExecutableDetection {
            command_names: vec!["gemini".to_string()],
            version_arg: Some("--version".to_string()),
        },
        install: InstallStrategy::NativePlugin {
            install_args: vec![
                "gemini".to_string(),
                "extensions".to_string(),
                "install".to_string(),
            ],
        },
        native_hooks: NativeHookCapabilities::default(),
        transcript_roots: vec![".gemini/tmp".to_string()],
        payload_schema_versions: vec!["jsonl-edit-result".to_string()],
        supported_change_kinds: vec![BrokerChangeKind::Create, BrokerChangeKind::Modify],
        // No Gemini CLI on any inspection machine — entirely unverified.
        verification: Verification::unverified(),
        health_probe: HealthProbe::TranscriptFreshness {
            max_lag_seconds: 600,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_manifest() -> AdapterManifest {
        AdapterManifest {
            id: "codex".to_string(),
            provider: "openai".to_string(),
            executable: ExecutableDetection {
                command_names: vec!["codex".to_string()],
                version_arg: Some("--version".to_string()),
            },
            install: InstallStrategy::ConfigHookBlock {
                config_path_from_home: ".codex/config.toml".to_string(),
                marker: "# AtoAxis managed AI attribution hook".to_string(),
            },
            native_hooks: NativeHookCapabilities {
                post_tool_use: true,
                apply_patch: true,
                ..Default::default()
            },
            transcript_roots: vec![".codex/sessions".to_string()],
            payload_schema_versions: vec!["response_item".to_string(), "event_msg".to_string()],
            supported_change_kinds: vec![
                BrokerChangeKind::Create,
                BrokerChangeKind::Modify,
                BrokerChangeKind::Delete,
                BrokerChangeKind::Rename,
            ],
            verification: Verification::unverified(),
            health_probe: HealthProbe::TranscriptFreshness {
                max_lag_seconds: 300,
            },
        }
    }

    #[test]
    fn manifest_round_trips_through_json() {
        let manifest = base_manifest();
        let json = serde_json::to_string(&manifest).unwrap();
        let back: AdapterManifest = serde_json::from_str(&json).unwrap();
        assert_eq!(manifest, back);
    }

    #[test]
    fn verification_status_defaults_to_unverified() {
        // A manifest that omits `verification` entirely.
        let json = r#"{
            "id": "cursor",
            "provider": "anysphere",
            "executable": { "command_names": ["cursor"] },
            "install": { "kind": "transcript_only" }
        }"#;
        let manifest: AdapterManifest = serde_json::from_str(json).unwrap();
        assert_eq!(manifest.verification.status, VerificationStatus::Unverified);
        assert_eq!(manifest.effective_status(), VerificationStatus::Unverified);
        assert!(!manifest.is_live_verified());
        assert!(matches!(manifest.health_probe, HealthProbe::None));
        manifest.validate().unwrap();
    }

    #[test]
    fn a_manifest_cannot_claim_verified_without_a_live_check() {
        // Hand-rolled JSON that lies: status verified, no evidence.
        let json = r#"{
            "id": "codex",
            "provider": "openai",
            "executable": { "command_names": ["codex"] },
            "install": { "kind": "transcript_only" },
            "verification": { "status": "verified" }
        }"#;
        let manifest: AdapterManifest = serde_json::from_str(json).unwrap();
        assert!(
            manifest.validate().is_err(),
            "validate must reject verified-without-evidence"
        );
        // ...and the shown status degrades rather than lying.
        assert_eq!(manifest.effective_status(), VerificationStatus::Scaffold);
        assert!(!manifest.is_live_verified());

        // The smart constructor is the only honest path to Verified.
        let mut ok = base_manifest();
        ok.verification = Verification::verified(Utc::now(), "codex 0.44.0");
        ok.validate().unwrap();
        assert!(ok.is_live_verified());
    }

    #[test]
    fn validate_rejects_an_empty_id_or_provider() {
        let mut m = base_manifest();
        m.id = "  ".to_string();
        assert!(m.validate().is_err());
        let mut m = base_manifest();
        m.provider = String::new();
        assert!(m.validate().is_err());
    }

    fn temp_home(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-registry-{tag}-{}-{}",
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn builtin_registry_loads_and_validates_every_manifest() {
        let registry = AdapterRegistry::builtin();
        assert_eq!(registry.ids(), vec!["claude-code", "codex", "gemini-cli"]);
        for manifest in registry.manifests() {
            manifest.validate().unwrap();
        }
        // Trust is graded honestly.
        assert!(registry.get("claude-code").unwrap().is_live_verified());
        assert_eq!(
            registry.get("codex").unwrap().effective_status(),
            VerificationStatus::Scaffold
        );
        assert_eq!(
            registry.get("gemini-cli").unwrap().effective_status(),
            VerificationStatus::Unverified
        );
    }

    #[test]
    fn a_new_adapter_registers_and_installs_end_to_end_without_touching_core() {
        // planai2.md acceptance p1.A1 — a brand-new agent is a manifest + register(),
        // nothing else. This test imports only the adapter module.
        let mut registry = AdapterRegistry::default();
        registry
            .register(AdapterManifest {
                id: "acme-agent".to_string(),
                provider: "acme".to_string(),
                executable: ExecutableDetection {
                    command_names: vec!["acme".to_string()],
                    version_arg: None,
                },
                install: InstallStrategy::ConfigHookBlock {
                    config_path_from_home: ".acme/config.toml".to_string(),
                    marker: "# AtoAxis managed acme hook".to_string(),
                },
                native_hooks: NativeHookCapabilities::default(),
                transcript_roots: vec![],
                payload_schema_versions: vec![],
                supported_change_kinds: vec![BrokerChangeKind::Modify],
                verification: Verification::unverified(),
                health_probe: HealthProbe::None,
            })
            .unwrap();

        let home = temp_home("acme");
        // A config file the user already had, with an unrelated key.
        std::fs::create_dir_all(home.join(".acme")).unwrap();
        std::fs::write(
            home.join(".acme/config.toml"),
            "[user]\nname = \"keep me\"\n",
        )
        .unwrap();

        let ctx = InstallContext {
            home_dir: home.clone(),
            config_block_body: Some(
                "# AtoAxis managed acme hook\n[hooks]\nenabled = true".to_string(),
            ),
        };

        // First install writes the block.
        let first = registry.install("acme-agent", &ctx).unwrap();
        assert!(matches!(first, InstallOutcome::ConfigBlockWritten { .. }));
        let after_first = std::fs::read_to_string(home.join(".acme/config.toml")).unwrap();
        assert!(after_first.contains("name = \"keep me\"")); // user config preserved
        assert!(after_first.contains("# AtoAxis managed acme hook"));

        // Second install is a no-op — idempotent, file byte-identical.
        let second = registry.install("acme-agent", &ctx).unwrap();
        assert_eq!(second, InstallOutcome::AlreadyInstalled);
        let after_second = std::fs::read_to_string(home.join(".acme/config.toml")).unwrap();
        assert_eq!(after_first, after_second);

        let _ = std::fs::remove_dir_all(&home);
    }

    #[test]
    fn install_returns_a_plan_for_native_plugin_and_manual_strategies() {
        let registry = AdapterRegistry::builtin();
        let ctx = InstallContext {
            home_dir: temp_home("plan"),
            config_block_body: None,
        };
        match registry.install("claude-code", &ctx).unwrap() {
            InstallOutcome::RequiresExternalCommand { program, args } => {
                assert_eq!(program, "claude");
                assert!(args.contains(&"install".to_string()));
            }
            other => panic!("expected an external-command plan, got {other:?}"),
        }
        let _ = std::fs::remove_dir_all(&ctx.home_dir);
    }

    #[test]
    fn duplicate_ids_are_rejected() {
        let mut registry = AdapterRegistry::default();
        registry.register(base_manifest()).unwrap();
        assert!(registry.register(base_manifest()).is_err());
    }

    // --- planai2.md Phase 1 acceptance ---------------------------------------

    #[test]
    fn p1_a2_a_scaffold_or_unverified_adapter_is_never_shown_as_verified() {
        // Every surface that reports trust must agree: only a live-checked adapter
        // is `Verified`. Checked across the whole builtin set and a lying manifest.
        for manifest in AdapterRegistry::builtin().manifests() {
            let live = manifest.verification.live_checked_at.is_some();
            assert_eq!(
                manifest.is_live_verified(),
                live && manifest.effective_status() == VerificationStatus::Verified
            );
            if !live {
                assert_ne!(manifest.effective_status(), VerificationStatus::Verified);
            }
        }
        let lying: AdapterManifest = serde_json::from_str(
            r#"{"id":"x","provider":"y","executable":{"command_names":["x"]},
                "install":{"kind":"transcript_only"},
                "verification":{"status":"verified"}}"#,
        )
        .unwrap();
        assert_eq!(lying.effective_status(), VerificationStatus::Scaffold);
        assert!(!lying.is_live_verified());
        assert!(lying.validate().is_err());
    }

    #[test]
    fn p1_a4_every_builtin_adapter_produces_the_same_broker_envelope_shape() {
        // "Every adapter emits the same metadata shape into the broker" — there is
        // exactly one envelope type (`BrokerEventV1`); an event built for any agent
        // normalizes and round-trips identically regardless of `agent`.
        use crate::ai::{AiConfidence, AiEventSource};
        use crate::broker::{BrokerEventType, BrokerEventV1, BROKER_SCHEMA_VERSION};
        use chrono::Utc;

        for manifest in AdapterRegistry::builtin().manifests() {
            for kind in &manifest.supported_change_kinds {
                let event = BrokerEventV1 {
                    schema_version: BROKER_SCHEMA_VERSION,
                    event_type: BrokerEventType::FileChange,
                    event_id: format!("{}-evt", manifest.id),
                    occurred_at: Utc::now(),
                    entity: "/workspace/src/main.rs".to_string(),
                    project_root: Some("/workspace".to_string()),
                    change_kind: *kind,
                    previous_entity: matches!(kind, crate::broker::BrokerChangeKind::Rename)
                        .then(|| "/workspace/src/old.rs".to_string()),
                    agent: manifest.id.clone(),
                    provider: Some(manifest.provider.clone()),
                    model: None,
                    session_id: Some("s1".to_string()),
                    source: AiEventSource::AgentHook,
                    confidence: AiConfidence::Verified,
                    actor_type: None,
                    actor_confidence: None,
                    lines_added: Some(1),
                    lines_deleted: Some(0),
                    active_seconds: Some(1.0),
                    transport: Some("native_plugin".to_string()),
                    tool: Some("apply_patch".to_string()),
                    tool_event_id: Some("t1".to_string()),
                };
                let normalized = event.normalize().expect("every adapter's event normalizes");
                let json = serde_json::to_string(&normalized).unwrap();
                let back: BrokerEventV1 = serde_json::from_str(&json).unwrap();
                assert_eq!(normalized, back);
            }
        }
    }
}
