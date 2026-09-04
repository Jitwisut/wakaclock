//! planai2.md Phase 7 (p7.2c) — the client→server AI-diagnostics payload.
//!
//! `wakaclock doctor ai` computes broker health, transcript-parser lag and
//! per-adapter freshness **locally**. The hosted dashboard cannot see any of it
//! unless the client pushes it. This module is the sanitized report it pushes:
//! counts, timestamps and enum states only — never a prompt, response, diff,
//! patch, transcript line, command argument, file path or clipboard value. The
//! round-trip test in this file asserts that contract on the serialized form.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::ai::adapter::{AdapterRegistry, VerificationStatus};
use crate::ai::event::normalize_agent_id;
use crate::ai::parser::TranscriptLag;
use crate::ai::pipeline::AgentPipelineState;

/// Wire schema version for [`AiDiagnosticsReport`]. Bump on any breaking field
/// change; the server rejects an unknown version.
pub const AI_DIAGNOSTICS_SCHEMA_VERSION: u8 = 1;

/// Local broker inbox health — the numbers `wakaclock doctor ai` prints, with
/// no error *message* (only a short, non-sensitive code).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BrokerHealth {
    pub running: bool,
    pub inbox_pending: u32,
    pub inbox_retry: u32,
    pub inbox_dead_letter: u32,
    #[serde(default)]
    pub last_delivery_unix: Option<i64>,
    /// A short error *code* (`"http_402"`, `"dns"`), never a message body.
    #[serde(default)]
    pub last_error_code: Option<String>,
}

/// Transcript-parser lag, aggregated across every watched transcript.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParserLagSummary {
    pub transcripts_watched: u32,
    /// How many have unparsed bytes past the saved cursor.
    pub transcripts_behind: u32,
    /// Largest wall-clock gap, in seconds, between `captured_at` and the last
    /// event a watched transcript produced. `0` when nothing is behind.
    pub max_lag_seconds: i64,
}

/// One adapter's freshness — is it detected, is it on, when did it last produce
/// evidence, and how far has it been live-verified.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct AdapterFreshness {
    /// Normalised agent id (`normalize_agent_id` output).
    pub agent: String,
    pub detected: bool,
    pub enabled: bool,
    pub verification: VerificationStatus,
    #[serde(default)]
    pub last_evidence_unix: Option<i64>,
    /// Optional identity and transport metadata. These fields are additive so
    /// older clients can continue posting schema-v1 reports unchanged.
    #[serde(default)]
    pub client_version: Option<String>,
    #[serde(default)]
    pub plugin_version: Option<String>,
    #[serde(default)]
    pub contract_version: Option<String>,
    #[serde(default)]
    pub transport: Option<String>,
    #[serde(default)]
    pub last_native_event_unix: Option<i64>,
    #[serde(default)]
    pub last_transcript_event_unix: Option<i64>,
    #[serde(default)]
    pub transcript_lag_seconds: Option<i64>,
    #[serde(default)]
    pub pending_events: u32,
    #[serde(default)]
    pub retry_events: u32,
    #[serde(default)]
    pub dead_letter_events: u32,
    #[serde(default)]
    pub last_delivery_result: Option<String>,
    #[serde(default)]
    pub provider_id: Option<String>,
    #[serde(default)]
    pub model_id: Option<String>,
    /// A short diagnostic code, never a raw error message or path.
    #[serde(default)]
    pub diagnostic_code: Option<String>,
}

impl AdapterFreshness {
    /// Product-facing status. Capture, verification and delivery are separate
    /// signals so a locally captured event cannot be mistaken for a delivered
    /// or live-verified one.
    pub fn health_status(&self) -> &'static str {
        if self.diagnostic_code.as_deref() == Some("unsupported") {
            return "unsupported";
        }
        if self.diagnostic_code.as_deref() == Some("disabled_by_policy") {
            return "disabled";
        }
        if !self.detected {
            return "needs_setup";
        }
        if !self.enabled {
            return "needs_trust";
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
        if self.last_evidence_unix.is_some() && self.verification == VerificationStatus::Verified {
            "healthy"
        } else if self.last_evidence_unix.is_some() {
            "captured_locally"
        } else {
            "unverified"
        }
    }
}

/// The whole sanitized diagnostics snapshot for one client at one moment.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiDiagnosticsReport {
    pub schema_version: u8,
    pub captured_at: DateTime<Utc>,
    pub broker: BrokerHealth,
    pub parser: ParserLagSummary,
    pub adapters: Vec<AdapterFreshness>,
    /// Current metadata-only pipeline stage per detected agent. Additive in
    /// schema v1 so older clients and reports without a broker snapshot remain
    /// valid.
    #[serde(default)]
    pub pipeline: Vec<AgentPipelineState>,
}

impl AiDiagnosticsReport {
    /// True when the schema version is one this build understands.
    pub fn schema_is_supported(&self) -> bool {
        self.schema_version == AI_DIAGNOSTICS_SCHEMA_VERSION
    }
}

/// Build a report from the pieces `wakaclock doctor ai` already has — the
/// client-side **producer**. Aggregates the per-transcript [`TranscriptLag`]
/// values into a [`ParserLagSummary`]; keeps `adapters` as given (the caller
/// has already normalised the agent ids).
pub fn build_report(
    captured_at: DateTime<Utc>,
    broker: BrokerHealth,
    transcript_lags: &[TranscriptLag],
    adapters: Vec<AdapterFreshness>,
) -> AiDiagnosticsReport {
    let transcripts_watched = transcript_lags.len() as u32;
    let transcripts_behind = transcript_lags
        .iter()
        .filter(|lag| lag.lag_bytes > 0)
        .count() as u32;
    let max_lag_seconds = transcript_lags
        .iter()
        .filter(|lag| lag.lag_bytes > 0)
        .filter_map(|lag| lag.last_event_at)
        .map(|last| (captured_at - last).num_seconds().max(0))
        .max()
        .unwrap_or(0);

    AiDiagnosticsReport {
        schema_version: AI_DIAGNOSTICS_SCHEMA_VERSION,
        captured_at,
        broker,
        parser: ParserLagSummary {
            transcripts_watched,
            transcripts_behind,
            max_lag_seconds,
        },
        adapters,
        pipeline: Vec::new(),
    }
}

/// Turn the JSON that `wakaclock doctor ai --json` prints into an
/// [`AiDiagnosticsReport`] ready to POST to `/api/v1/ai/diagnostics`.
///
/// Every field is read **defensively** — a missing or wrong-typed value
/// degrades to a sane default rather than failing, because pushing diagnostics
/// must never be the thing that breaks a doctor run. Only known metadata keys
/// are read; any other content in the blob is ignored.
///
/// The doctor blob does not carry a separate "enabled" or per-agent
/// verification status, so `detected` / `enabled` both mirror the doctor's
/// `installed` flag and `verification` is looked up from the built-in
/// [`AdapterRegistry`]. The classified error *category* (`"payment_402"`,
/// `"unauthorized_401"`, `"network"`) is kept as `last_error_code`; the raw
/// failure message never is.
pub fn report_from_doctor_json(
    doctor: &serde_json::Value,
    captured_at: DateTime<Utc>,
) -> AiDiagnosticsReport {
    let broker_json = doctor.get("broker");
    let inbox = broker_json.and_then(|broker| broker.get("inbox"));
    let inbox_u32 = |key: &str| -> u32 {
        inbox
            .and_then(|inbox| inbox.get(key))
            .and_then(serde_json::Value::as_u64)
            .unwrap_or(0) as u32
    };
    let failure = doctor.get("last_delivery_failure");

    let broker = BrokerHealth {
        running: doctor
            .get("broker_running")
            .and_then(serde_json::Value::as_bool)
            .or_else(|| {
                broker_json
                    .and_then(|broker| broker.get("running"))
                    .and_then(serde_json::Value::as_bool)
            })
            .unwrap_or(false),
        inbox_pending: inbox_u32("pending"),
        inbox_retry: inbox_u32("retry"),
        inbox_dead_letter: inbox_u32("dead_letter"),
        last_delivery_unix: failure
            .and_then(|failure| failure.get("at"))
            .and_then(serde_json::Value::as_f64)
            .map(|secs| secs as i64),
        last_error_code: failure
            .and_then(|failure| failure.get("category"))
            .and_then(serde_json::Value::as_str)
            .map(str::to_string),
    };

    let registry = AdapterRegistry::builtin();
    let mut transcripts_watched = 0u32;
    let mut transcripts_behind = 0u32;
    let mut max_lag_seconds = 0i64;
    let mut adapters = Vec::new();

    if let Some(rows) = doctor.get("agents").and_then(serde_json::Value::as_array) {
        for row in rows {
            let raw_agent = row
                .get("agent")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("");
            if raw_agent.is_empty() {
                continue;
            }
            let agent = normalize_agent_id(raw_agent);
            let installed = row
                .get("installed")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(false);
            let transcript_found = row
                .get("transcript_found")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(false);
            let lag_bytes = row
                .get("lag_bytes")
                .and_then(serde_json::Value::as_u64)
                .unwrap_or(0);
            let lag_seconds = row
                .get("lag_seconds")
                .and_then(serde_json::Value::as_u64)
                .unwrap_or(0) as i64;

            if transcript_found {
                transcripts_watched += 1;
                if lag_bytes > 0 {
                    transcripts_behind += 1;
                    max_lag_seconds = max_lag_seconds.max(lag_seconds);
                }
            }

            let last_event_unix = row
                .get("last_event_at")
                .and_then(serde_json::Value::as_str)
                .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
                .map(|dt| dt.timestamp());
            let verification = row
                .get("verification_status")
                .and_then(serde_json::Value::as_str)
                .and_then(parse_verification_status)
                .or_else(|| {
                    registry
                        .get(&agent)
                        .map(|manifest| manifest.effective_status())
                })
                .unwrap_or(VerificationStatus::Unverified);
            adapters.push(AdapterFreshness {
                verification,
                last_evidence_unix: last_event_unix,
                client_version: string_field(row, "client_version"),
                plugin_version: string_field(row, "plugin_version"),
                contract_version: string_field(row, "contract_version"),
                transport: string_field(row, "transport"),
                last_native_event_unix: parse_unix_field(row, "last_native_event_at"),
                last_transcript_event_unix: parse_unix_field(row, "last_transcript_event_at"),
                transcript_lag_seconds: row
                    .get("lag_seconds")
                    .and_then(serde_json::Value::as_i64)
                    .or_else(|| Some(lag_seconds).filter(|seconds| *seconds > 0)),
                pending_events: row
                    .get("pending_events")
                    .and_then(serde_json::Value::as_u64)
                    .unwrap_or(0) as u32,
                retry_events: row
                    .get("retry_events")
                    .and_then(serde_json::Value::as_u64)
                    .unwrap_or(0) as u32,
                dead_letter_events: row
                    .get("dead_letter_events")
                    .and_then(serde_json::Value::as_u64)
                    .unwrap_or(0) as u32,
                last_delivery_result: string_field(row, "last_delivery_result"),
                provider_id: string_field(row, "provider_id"),
                model_id: string_field(row, "model_id"),
                diagnostic_code: string_field(row, "diagnostic_code").or_else(|| {
                    row.get("diagnostic")
                        .and_then(serde_json::Value::as_str)
                        .and_then(classify_diagnostic)
                        .map(str::to_string)
                }),
                agent,
                detected: installed,
                enabled: row
                    .get("enabled")
                    .and_then(serde_json::Value::as_bool)
                    .unwrap_or(installed),
            });
        }
    }

    let pipeline = broker_json
        .and_then(|broker| broker.get("pipeline"))
        .and_then(serde_json::Value::as_array)
        .map(|rows| {
            rows.iter()
                .filter_map(|row| serde_json::from_value::<AgentPipelineState>(row.clone()).ok())
                .take(64)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    AiDiagnosticsReport {
        schema_version: AI_DIAGNOSTICS_SCHEMA_VERSION,
        captured_at,
        broker,
        parser: ParserLagSummary {
            transcripts_watched,
            transcripts_behind,
            max_lag_seconds,
        },
        adapters,
        pipeline,
    }
}

fn string_field(row: &serde_json::Value, key: &str) -> Option<String> {
    row.get(key)
        .and_then(serde_json::Value::as_str)
        .map(str::to_string)
        .filter(|value| !value.is_empty())
}

fn parse_unix_field(row: &serde_json::Value, key: &str) -> Option<i64> {
    row.get(key)
        .and_then(serde_json::Value::as_str)
        .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
        .map(|dt| dt.timestamp())
}

fn parse_verification_status(value: &str) -> Option<VerificationStatus> {
    match value.trim().to_ascii_lowercase().as_str() {
        "verified" => Some(VerificationStatus::Verified),
        "scaffold" => Some(VerificationStatus::Scaffold),
        "unverified" => Some(VerificationStatus::Unverified),
        _ => None,
    }
}

fn classify_diagnostic(value: &str) -> Option<&'static str> {
    let value = value.to_ascii_lowercase();
    if value.contains("unsupported") {
        Some("unsupported")
    } else if value.contains("permission") {
        Some("permission_denied")
    } else if value.contains("not found") || value.contains("not installed") {
        Some("needs_setup")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn sample() -> AiDiagnosticsReport {
        AiDiagnosticsReport {
            schema_version: AI_DIAGNOSTICS_SCHEMA_VERSION,
            captured_at: Utc.timestamp_opt(1_700_000_000, 0).unwrap(),
            broker: BrokerHealth {
                running: true,
                inbox_pending: 2,
                inbox_retry: 1,
                inbox_dead_letter: 0,
                last_delivery_unix: Some(1_699_999_900),
                last_error_code: Some("http_402".to_string()),
            },
            parser: ParserLagSummary {
                transcripts_watched: 3,
                transcripts_behind: 1,
                max_lag_seconds: 45,
            },
            adapters: vec![AdapterFreshness {
                agent: "claude-code".to_string(),
                detected: true,
                enabled: true,
                verification: VerificationStatus::Verified,
                last_evidence_unix: Some(1_699_999_950),
                ..Default::default()
            }],
            pipeline: Vec::new(),
        }
    }

    #[test]
    fn a_diagnostics_report_round_trips_and_is_metadata_only() {
        let report = sample();
        let json = serde_json::to_string(&report).unwrap();

        for key in [
            "schema_version",
            "captured_at",
            "broker",
            "parser",
            "adapters",
        ] {
            assert!(json.contains(key), "missing field {key}: {json}");
        }
        // The whole point of p7.2c's privacy contract: none of this crosses.
        for forbidden in [
            "content",
            "diff",
            "patch",
            "prompt",
            "response",
            "\"source",
            "argv",
            "\"text\"",
            "\"body\"",
            "clipboard",
            "entity",
            "\"path\"",
            "message",
            "last_error_message",
        ] {
            assert!(
                !json.contains(forbidden),
                "diagnostics payload leaked {forbidden}: {json}"
            );
        }

        let back: AiDiagnosticsReport = serde_json::from_str(&json).unwrap();
        assert_eq!(back, report);
        assert!(back.schema_is_supported());
    }

    #[test]
    fn an_unknown_schema_version_is_not_supported() {
        let mut report = sample();
        report.schema_version = AI_DIAGNOSTICS_SCHEMA_VERSION + 1;
        assert!(!report.schema_is_supported());
    }

    #[test]
    fn adapter_health_status_distinguishes_capture_from_verification_and_setup() {
        let mut adapter = AdapterFreshness {
            agent: "deep-code".to_string(),
            detected: true,
            enabled: true,
            verification: VerificationStatus::Unverified,
            last_evidence_unix: Some(1),
            ..Default::default()
        };
        assert_eq!(adapter.health_status(), "captured_locally");
        adapter.verification = VerificationStatus::Verified;
        assert_eq!(adapter.health_status(), "healthy");
        adapter.pending_events = 1;
        assert_eq!(adapter.health_status(), "degraded");
        adapter.pending_events = 0;
        adapter.detected = false;
        assert_eq!(adapter.health_status(), "needs_setup");
        adapter.detected = true;
        adapter.enabled = false;
        adapter.diagnostic_code = Some("disabled_by_policy".to_string());
        assert_eq!(adapter.health_status(), "disabled");
        adapter.enabled = true;
        adapter.diagnostic_code = Some("unsupported".to_string());
        assert_eq!(adapter.health_status(), "unsupported");
    }

    #[test]
    fn build_report_aggregates_parser_lag_across_transcripts() {
        let now = Utc.timestamp_opt(1_700_000_000, 0).unwrap();
        let behind = TranscriptLag {
            file_size: 5_000,
            cursor_offset: 1_000,
            lag_bytes: 4_000,
            ever_scanned: true,
            last_event_at: Some(now - chrono::Duration::seconds(90)),
        };
        let current_a = TranscriptLag {
            file_size: 2_000,
            cursor_offset: 2_000,
            lag_bytes: 0,
            ever_scanned: true,
            last_event_at: Some(now - chrono::Duration::seconds(5)),
        };
        let current_b = TranscriptLag {
            file_size: 0,
            cursor_offset: 0,
            lag_bytes: 0,
            ever_scanned: false,
            last_event_at: None,
        };

        let report = build_report(
            now,
            BrokerHealth {
                running: true,
                inbox_pending: 0,
                inbox_retry: 0,
                inbox_dead_letter: 0,
                last_delivery_unix: None,
                last_error_code: None,
            },
            &[behind, current_a, current_b],
            Vec::new(),
        );

        assert_eq!(report.parser.transcripts_watched, 3);
        assert_eq!(report.parser.transcripts_behind, 1);
        assert_eq!(report.parser.max_lag_seconds, 90);
        assert_eq!(report.schema_version, AI_DIAGNOSTICS_SCHEMA_VERSION);
    }

    #[test]
    fn build_report_reports_zero_lag_when_nothing_is_behind() {
        let now = Utc.timestamp_opt(1_700_000_000, 0).unwrap();
        let current = TranscriptLag {
            file_size: 10,
            cursor_offset: 10,
            lag_bytes: 0,
            ever_scanned: true,
            last_event_at: Some(now - chrono::Duration::seconds(3)),
        };
        let report = build_report(
            now,
            BrokerHealth {
                running: false,
                inbox_pending: 0,
                inbox_retry: 0,
                inbox_dead_letter: 0,
                last_delivery_unix: None,
                last_error_code: None,
            },
            &[current],
            Vec::new(),
        );
        assert_eq!(report.parser.transcripts_behind, 0);
        assert_eq!(report.parser.max_lag_seconds, 0);
    }

    #[test]
    fn report_from_doctor_json_parses_a_realistic_doctor_blob() {
        let now = Utc.timestamp_opt(1_700_000_000, 0).unwrap();
        let doctor = serde_json::json!({
            "cli_identity": { "mismatch": false },
            "broker_installed": true,
            "broker_running": true,
            "broker": {
                "running": true,
                "inbox": { "pending": 4, "retry": 1, "dead_letter": 2, "last_error_message": "HTTP status 402: quota exceeded" },
                "outbound_queue_count": 0
            },
            "agents": [
                {
                    "agent": "Claude Code",
                    "installed": true,
                    "enabled": true,
                    "verification_status": "verified",
                    "client_version": "1.2.3",
                    "provider_id": "anthropic",
                    "model_id": "claude-sonnet",
                    "transport": "transcript",
                    "transcript_found": true,
                    "lag_bytes": 8192,
                    "lag_seconds": 75,
                    "last_event_at": "2026-09-02T00:00:00+00:00"
                },
                {
                    "agent": "codex",
                    "installed": true,
                    "transcript_found": true,
                    "lag_bytes": 0,
                    "lag_seconds": 0,
                    "last_event_at": "2026-09-02T00:10:00+00:00"
                },
                { "agent": "", "installed": false }
            ],
            "outbound_queue_depth": 0,
            "last_delivery_failure": { "at": 1_699_999_000.0, "message": "HTTP status 402", "category": "payment_402" },
            "configured_server_url": "https://api.atoaxis.com"
        });

        let report = report_from_doctor_json(&doctor, now);

        assert!(report.broker.running);
        assert_eq!(report.broker.inbox_pending, 4);
        assert_eq!(report.broker.inbox_retry, 1);
        assert_eq!(report.broker.inbox_dead_letter, 2);
        assert_eq!(
            report.broker.last_error_code.as_deref(),
            Some("payment_402")
        );
        assert_eq!(report.broker.last_delivery_unix, Some(1_699_999_000));

        // Two transcript agents watched, one behind at 75s; the empty-id row dropped.
        assert_eq!(report.parser.transcripts_watched, 2);
        assert_eq!(report.parser.transcripts_behind, 1);
        assert_eq!(report.parser.max_lag_seconds, 75);

        assert_eq!(report.adapters.len(), 2);
        assert_eq!(report.adapters[0].agent, "claude-code"); // normalised
        assert!(report.adapters[0].detected && report.adapters[0].enabled);
        assert_eq!(report.adapters[0].client_version.as_deref(), Some("1.2.3"));
        assert_eq!(report.adapters[0].provider_id.as_deref(), Some("anthropic"));
        assert_eq!(report.adapters[0].health_status(), "healthy");
        assert_eq!(
            report.adapters[0].last_evidence_unix,
            Some(
                DateTime::parse_from_rfc3339("2026-09-02T00:00:00+00:00")
                    .unwrap()
                    .timestamp()
            )
        );

        // Round-trips and stays metadata-only — the 402 *message* never crosses.
        let json = serde_json::to_string(&report).unwrap();
        assert!(!json.contains("quota exceeded"));
        assert!(!json.contains("HTTP status"));
        let back: AiDiagnosticsReport = serde_json::from_str(&json).unwrap();
        assert_eq!(back, report);
    }

    #[test]
    fn report_from_doctor_json_degrades_gracefully_on_an_empty_blob() {
        let now = Utc.timestamp_opt(1_700_000_000, 0).unwrap();
        let report = report_from_doctor_json(&serde_json::json!({}), now);

        assert!(!report.broker.running);
        assert_eq!(report.broker.inbox_pending, 0);
        assert!(report.broker.last_error_code.is_none());
        assert_eq!(report.parser.transcripts_watched, 0);
        assert!(report.adapters.is_empty());
        assert!(report.schema_is_supported());
    }
}
