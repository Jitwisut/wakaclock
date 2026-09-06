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
/// Additive diagnostics contract. Version 1 remains readable for older CLI and
/// dashboard builds; v2 distinguishes an unavailable measurement from a real zero.
pub const AI_DIAGNOSTICS_SCHEMA_VERSION_V2: u8 = 2;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MeasurementAvailability {
    #[default]
    Unavailable,
    Available,
    Disabled,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeHealth {
    #[default]
    Unavailable,
    Idle,
    Healthy,
    Degraded,
    Disabled,
}

/// A measurement carries both its value and the probe result that makes the value
/// meaningful. `None` is intentional when the probe failed; it must never be rendered
/// as a zero by a consumer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiagnosticMeasurement<T> {
    pub availability: MeasurementAvailability,
    pub measured_at: Option<DateTime<Utc>>,
    pub value: Option<T>,
}

impl<T> DiagnosticMeasurement<T> {
    pub fn available(value: T, measured_at: DateTime<Utc>) -> Self {
        Self {
            availability: MeasurementAvailability::Available,
            measured_at: Some(measured_at),
            value: Some(value),
        }
    }

    pub fn unavailable() -> Self {
        Self {
            availability: MeasurementAvailability::Unavailable,
            measured_at: None,
            value: None,
        }
    }

    pub fn disabled() -> Self {
        Self {
            availability: MeasurementAvailability::Disabled,
            measured_at: None,
            value: None,
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiagnosticsConsent {
    #[serde(default)]
    pub adapter_tracking: bool,
    #[serde(default)]
    pub observer: bool,
    #[serde(default)]
    pub diagnostics_upload: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BrokerHealthV2 {
    pub availability: MeasurementAvailability,
    pub running: DiagnosticMeasurement<bool>,
    pub pending: DiagnosticMeasurement<u32>,
    pub retry: DiagnosticMeasurement<u32>,
    pub dead_letter: DiagnosticMeasurement<u32>,
    #[serde(default)]
    pub last_delivery_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub last_error_code: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParserLagSummaryV2 {
    pub availability: MeasurementAvailability,
    pub transcripts_watched: DiagnosticMeasurement<u32>,
    pub transcripts_behind: DiagnosticMeasurement<u32>,
    pub max_lag_seconds: DiagnosticMeasurement<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AdapterFreshnessV2 {
    pub agent: String,
    pub availability: MeasurementAvailability,
    pub detected: DiagnosticMeasurement<bool>,
    pub enabled: DiagnosticMeasurement<bool>,
    pub runtime_health: RuntimeHealth,
    pub verification: VerificationStatus,
    #[serde(default)]
    pub last_evidence_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub diagnostic_code: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiDiagnosticsReportV2 {
    pub schema_version: u8,
    pub captured_at: DateTime<Utc>,
    /// Opaque, bounded device identity. It is not a hostname or filesystem path.
    pub device_id: String,
    /// Changes on a local broker restart; used with sequence for receipt ordering.
    pub boot_id: String,
    pub sequence: u64,
    pub measured_at: DateTime<Utc>,
    pub runtime_health: RuntimeHealth,
    pub consent: DiagnosticsConsent,
    pub broker: BrokerHealthV2,
    pub parser: ParserLagSummaryV2,
    pub adapters: Vec<AdapterFreshnessV2>,
}

impl AiDiagnosticsReportV2 {
    pub fn schema_is_supported(&self) -> bool {
        self.schema_version == AI_DIAGNOSTICS_SCHEMA_VERSION_V2
    }

    /// Additive compatibility mapping for v1 consumers and migration tests. A v1
    /// boolean/counter is marked available because it was actually supplied by the
    /// legacy producer; new collectors should use the nullable probes directly.
    pub fn from_v1(
        report: &AiDiagnosticsReport,
        device_id: String,
        boot_id: String,
        sequence: u64,
    ) -> Self {
        let measured_at = report.captured_at;
        let availability = MeasurementAvailability::Available;
        Self {
            schema_version: AI_DIAGNOSTICS_SCHEMA_VERSION_V2,
            captured_at: report.captured_at,
            device_id,
            boot_id,
            sequence,
            measured_at,
            runtime_health: if report.broker.running {
                RuntimeHealth::Healthy
            } else {
                RuntimeHealth::Degraded
            },
            consent: DiagnosticsConsent {
                adapter_tracking: report.adapters.iter().any(|adapter| adapter.enabled),
                observer: true,
                diagnostics_upload: false,
            },
            broker: BrokerHealthV2 {
                availability,
                running: DiagnosticMeasurement::available(report.broker.running, measured_at),
                pending: DiagnosticMeasurement::available(report.broker.pending, measured_at),
                retry: DiagnosticMeasurement::available(report.broker.retry, measured_at),
                dead_letter: DiagnosticMeasurement::available(
                    report.broker.dead_letter,
                    measured_at,
                ),
                last_delivery_at: report
                    .broker
                    .last_delivery_unix
                    .and_then(|seconds| DateTime::from_timestamp(seconds, 0)),
                last_error_code: report.broker.last_error_code.clone(),
            },
            parser: ParserLagSummaryV2 {
                availability,
                transcripts_watched: DiagnosticMeasurement::available(
                    report.parser.transcripts_watched,
                    measured_at,
                ),
                transcripts_behind: DiagnosticMeasurement::available(
                    report.parser.transcripts_behind,
                    measured_at,
                ),
                max_lag_seconds: DiagnosticMeasurement::available(
                    report.parser.max_lag_seconds.max(0) as u32,
                    measured_at,
                ),
            },
            adapters: report
                .adapters
                .iter()
                .map(|adapter| AdapterFreshnessV2 {
                    agent: adapter.agent.clone(),
                    availability,
                    detected: DiagnosticMeasurement::available(adapter.detected, measured_at),
                    enabled: DiagnosticMeasurement::available(adapter.enabled, measured_at),
                    runtime_health: match adapter.health_status() {
                        "healthy" => RuntimeHealth::Healthy,
                        "captured_locally" => RuntimeHealth::Idle,
                        "degraded" => RuntimeHealth::Degraded,
                        "needs_consent" => RuntimeHealth::Disabled,
                        _ => RuntimeHealth::Unavailable,
                    },
                    verification: adapter.verification,
                    last_evidence_at: adapter
                        .last_evidence_unix
                        .and_then(|seconds| DateTime::from_timestamp(seconds, 0)),
                    diagnostic_code: adapter.diagnostic_code.clone(),
                })
                .collect(),
        }
    }
}

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

    #[test]
    fn v2_preserves_unavailable_as_null_and_maps_legacy_reports_additively() {
        let measurement: DiagnosticMeasurement<u32> = DiagnosticMeasurement::unavailable();
        let json = serde_json::to_value(&measurement).unwrap();
        assert_eq!(json["availability"], "unavailable");
        assert!(json["value"].is_null());
        assert!(json["measured_at"].is_null());

        let legacy = build_report(
            Utc.timestamp_opt(1_700_000_000, 0).unwrap(),
            BrokerHealth::default(),
            ParserLagSummary::default(),
            Vec::new(),
        );
        let v2 = AiDiagnosticsReportV2::from_v1(
            &legacy,
            "device-1".to_string(),
            "boot-1".to_string(),
            7,
        );
        assert!(v2.schema_is_supported());
        assert_eq!(v2.sequence, 7);
        assert_eq!(v2.device_id, "device-1");
    }

    #[test]
    fn v2_consent_is_separate_from_runtime_health() {
        let report = AiDiagnosticsReportV2 {
            schema_version: AI_DIAGNOSTICS_SCHEMA_VERSION_V2,
            captured_at: Utc.timestamp_opt(1_700_000_000, 0).unwrap(),
            device_id: "device".to_string(),
            boot_id: "boot".to_string(),
            sequence: 1,
            measured_at: Utc.timestamp_opt(1_700_000_000, 0).unwrap(),
            runtime_health: RuntimeHealth::Idle,
            consent: DiagnosticsConsent {
                adapter_tracking: true,
                observer: false,
                diagnostics_upload: false,
            },
            broker: BrokerHealthV2 {
                availability: MeasurementAvailability::Disabled,
                running: DiagnosticMeasurement::disabled(),
                pending: DiagnosticMeasurement::unavailable(),
                retry: DiagnosticMeasurement::unavailable(),
                dead_letter: DiagnosticMeasurement::unavailable(),
                last_delivery_at: None,
                last_error_code: None,
            },
            parser: ParserLagSummaryV2 {
                availability: MeasurementAvailability::Disabled,
                transcripts_watched: DiagnosticMeasurement::disabled(),
                transcripts_behind: DiagnosticMeasurement::disabled(),
                max_lag_seconds: DiagnosticMeasurement::disabled(),
            },
            adapters: Vec::new(),
        };
        assert!(!report.consent.observer);
        assert_eq!(report.runtime_health, RuntimeHealth::Idle);
        assert_eq!(
            report.broker.running.availability,
            MeasurementAvailability::Disabled
        );
    }
}
