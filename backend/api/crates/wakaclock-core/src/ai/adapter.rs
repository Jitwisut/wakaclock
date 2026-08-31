//! planai2.md Phase 1 (decision p1.0 / D6): the **declarative adapter manifest**.
//!
//! One manifest describes how to detect, install, health-check and rate the trust
//! of a single AI coding agent's integration. It is deliberately data, not code:
//! adding an agent is adding a manifest, and the correlation / heartbeat layers
//! never learn a new agent's name (planai2.md §"Adapter manifest" + acceptance
//! p1.A1). The manifest is **not** part of the `BrokerEventV1` wire envelope — it
//! never travels with an event.

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
}
