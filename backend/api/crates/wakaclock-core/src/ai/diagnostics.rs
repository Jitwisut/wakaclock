//! Privacy-safe AI integration diagnostics.
//!
//! Diagnostics are deliberately separate from attribution.  They may report that
//! an integration is installed, stale, or needs repair, but they never carry a
//! filesystem path, process argument, prompt, patch, or source body and they never
//! authorize an inferred heartbeat identity.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// Wire schema for the metadata-only diagnostics report.
pub const AI_DIAGNOSTICS_SCHEMA_VERSION: u8 = 1;

/// The only production observer mode.  The custom deserializer accepts the old
/// `infer` spelling and deliberately downgrades it to `observe_only` so an old
/// config cannot re-enable production inference after an upgrade.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum AttributionMode {
    #[default]
    ObserveOnly,
}

impl Serialize for AttributionMode {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str("observe_only")
    }
}

impl<'de> Deserialize<'de> for AttributionMode {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        match value.trim().to_ascii_lowercase().as_str() {
            "observe_only" | "observe-only" | "infer" | "inferred" | "off" => Ok(Self::ObserveOnly),
            other => Err(serde::de::Error::custom(format!(
                "unsupported attribution mode: {other}"
            ))),
        }
    }
}

/// Runtime observer configuration.  It is intentionally unable to represent a
/// production inference mode; `feeds_production` is a permanent false boundary.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ObserverConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub attribution_mode: AttributionMode,
}

impl ObserverConfig {
    pub fn observe_only() -> Self {
        Self {
            enabled: true,
            attribution_mode: AttributionMode::ObserveOnly,
        }
    }

    pub fn feeds_production(&self) -> bool {
        false
    }

    pub fn from_toml(value: &str) -> Result<Self, String> {
        toml::from_str(value).map_err(|error| format!("invalid observer config: {error}"))
    }
}

/// Local broker queue health, reduced to bounded counters and an error code.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct BrokerHealth {
    pub running: bool,
    pub pending: u32,
    pub retry: u32,
    pub dead_letter: u32,
    #[serde(default)]
    pub last_delivery_unix: Option<i64>,
    #[serde(default)]
    pub last_error_code: Option<String>,
}

/// Aggregate transcript lag without exposing transcript paths or records.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParserLagSummary {
    pub transcripts_watched: u32,
    pub transcripts_behind: u32,
    pub max_lag_seconds: i64,
}

/// Lifecycle status of an adapter.  Installed/live-tested/verified are separate so
/// a fixture or executable probe cannot accidentally be presented as Verified.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VerificationStatus {
    #[default]
    Scaffold,
    Installed,
    LiveTested,
    Verified,
    Unsupported,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct AdapterFreshness {
    pub agent: String,
    pub detected: bool,
    pub enabled: bool,
    pub verification: VerificationStatus,
    #[serde(default)]
    pub last_evidence_unix: Option<i64>,
    #[serde(default)]
    pub transcript_lag_seconds: Option<i64>,
    #[serde(default)]
    pub pending_events: u32,
    #[serde(default)]
    pub retry_events: u32,
    #[serde(default)]
    pub dead_letter_events: u32,
    #[serde(default)]
    pub diagnostic_code: Option<String>,
}

impl AdapterFreshness {
    pub fn health_status(&self) -> &'static str {
        if self.verification == VerificationStatus::Unsupported {
            return "unsupported";
        }
        if !self.detected {
            return "needs_setup";
        }
        if !self.enabled {
            return "needs_consent";
        }
        if self.pending_events > 0
            || self.retry_events > 0
            || self.dead_letter_events > 0
            || self
                .transcript_lag_seconds
                .is_some_and(|seconds| seconds > 300)
            || self.diagnostic_code.is_some()
        {
            return "degraded";
        }
        match (self.last_evidence_unix.is_some(), self.verification) {
            (true, VerificationStatus::Verified) => "healthy",
            (true, _) => "captured_locally",
            (false, _) => "unverified",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiDiagnosticsReport {
    pub schema_version: u8,
    pub captured_at: DateTime<Utc>,
    pub broker: BrokerHealth,
    pub parser: ParserLagSummary,
    pub adapters: Vec<AdapterFreshness>,
}

impl AiDiagnosticsReport {
    pub fn schema_is_supported(&self) -> bool {
        self.schema_version == AI_DIAGNOSTICS_SCHEMA_VERSION
    }
}

/// Build a report from local metadata.  Callers should pass only normalized agent
/// ids and bounded counters; no raw discovery path is accepted by this API.
pub fn build_report(
    captured_at: DateTime<Utc>,
    broker: BrokerHealth,
    parser: ParserLagSummary,
    adapters: Vec<AdapterFreshness>,
) -> AiDiagnosticsReport {
    AiDiagnosticsReport {
        schema_version: AI_DIAGNOSTICS_SCHEMA_VERSION,
        captured_at,
        broker,
        parser,
        adapters,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn legacy_infer_config_is_downgraded_to_observe_only() {
        let config = ObserverConfig::from_toml("enabled = true\nattribution_mode = \"infer\"\n")
            .expect("legacy config parses");
        assert!(config.enabled);
        assert_eq!(config.attribution_mode, AttributionMode::ObserveOnly);
        assert!(!config.feeds_production());
        assert_eq!(
            toml::to_string(&config).unwrap().trim(),
            "enabled = true\nattribution_mode = \"observe_only\""
        );
    }

    #[test]
    fn diagnostics_round_trip_contains_metadata_only_fields() {
        let report = build_report(
            Utc.timestamp_opt(1_700_000_000, 0).unwrap(),
            BrokerHealth {
                running: true,
                pending: 1,
                ..Default::default()
            },
            ParserLagSummary {
                transcripts_watched: 2,
                transcripts_behind: 1,
                max_lag_seconds: 7,
            },
            vec![AdapterFreshness {
                agent: "gemini-cli".to_string(),
                detected: true,
                verification: VerificationStatus::Installed,
                ..Default::default()
            }],
        );
        let value = serde_json::to_value(&report).unwrap();
        let serialized = value.to_string();
        for forbidden in ["path", "prompt", "patch", "content", "arguments", "diff"] {
            assert!(
                !serialized.contains(forbidden),
                "found forbidden field {forbidden}"
            );
        }
        assert_eq!(report.schema_version, AI_DIAGNOSTICS_SCHEMA_VERSION);
    }

    #[test]
    fn adapter_health_does_not_promote_installed_to_verified() {
        let adapter = AdapterFreshness {
            detected: true,
            enabled: true,
            verification: VerificationStatus::Installed,
            last_evidence_unix: Some(1),
            ..Default::default()
        };
        assert_eq!(adapter.health_status(), "captured_locally");
    }
}
