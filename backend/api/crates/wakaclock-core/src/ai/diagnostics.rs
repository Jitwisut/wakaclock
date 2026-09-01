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

use crate::ai::adapter::VerificationStatus;
use crate::ai::parser::TranscriptLag;

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
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AdapterFreshness {
    /// Normalised agent id (`normalize_agent_id` output).
    pub agent: String,
    pub detected: bool,
    pub enabled: bool,
    pub verification: VerificationStatus,
    #[serde(default)]
    pub last_evidence_unix: Option<i64>,
}

/// The whole sanitized diagnostics snapshot for one client at one moment.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiDiagnosticsReport {
    pub schema_version: u8,
    pub captured_at: DateTime<Utc>,
    pub broker: BrokerHealth,
    pub parser: ParserLagSummary,
    pub adapters: Vec<AdapterFreshness>,
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
            }],
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
}
