//! planai2.md Phase 7 (p7.2c) — ingest and read the client's local AI
//! diagnostics snapshot.
//!
//! The body of `POST /api/v1/ai/diagnostics` is the sanitized, metadata-only
//! `AiDiagnosticsReport`: broker inbox counts, parser-lag aggregates and
//! per-adapter freshness. It intentionally has no prompt, response, diff,
//! patch, transcript, path or clipboard field — the wire type simply does not
//! carry them, and `wakaclock-core`'s round-trip test enforces that.

use std::sync::Arc;

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::json;
use wakaclock_core::ai::AiDiagnosticsReport;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::ai_diagnostics::AiDiagnosticsResponse;

const MAX_ADAPTERS: usize = 64;
const MAX_AGENT_ID_BYTES: usize = 128;
const MAX_ERROR_CODE_BYTES: usize = 64;

/// POST /api/v1/ai/diagnostics
pub async fn ingest(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(report): Json<AiDiagnosticsReport>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "write_logged_time") {
        return Err(auth::forbidden_scope("write_logged_time"));
    }
    validate(&report)?;

    state.ai_diagnostics_service.record(user_id, report).await;
    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/users/current/ai_diagnostics
pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<AiDiagnosticsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    let report = state.ai_diagnostics_service.latest(user_id).await;
    Ok(Json(AiDiagnosticsResponse { report }))
}

fn validate(report: &AiDiagnosticsReport) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    if !report.schema_is_supported() {
        return Err(app_error(
            StatusCode::BAD_REQUEST,
            &format!(
                "unsupported diagnostics schema_version: {}",
                report.schema_version
            ),
        ));
    }
    if report.adapters.len() > MAX_ADAPTERS {
        return Err(app_error(
            StatusCode::PAYLOAD_TOO_LARGE,
            &format!("at most {MAX_ADAPTERS} adapters per report"),
        ));
    }
    for adapter in &report.adapters {
        if adapter.agent.trim().is_empty() || adapter.agent.len() > MAX_AGENT_ID_BYTES {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                "adapter agent id must be a non-empty identifier of at most 128 bytes",
            ));
        }
        // The agent id is a normalised slug, never a path — a path-like value
        // would leak machine layout.
        if adapter.agent.contains('/') || adapter.agent.contains('\\') {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                "adapter agent id must be a slug, not a filesystem path",
            ));
        }
    }
    if let Some(code) = report.broker.last_error_code.as_deref() {
        if code.len() > MAX_ERROR_CODE_BYTES || code.contains(char::is_whitespace) {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                "last_error_code must be a short whitespace-free code, not a message",
            ));
        }
    }
    Ok(())
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(json!({ "error": msg })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use wakaclock_core::ai::adapter::VerificationStatus;
    use wakaclock_core::ai::{
        AdapterFreshness, BrokerHealth, ParserLagSummary, AI_DIAGNOSTICS_SCHEMA_VERSION,
    };

    fn ok_report() -> AiDiagnosticsReport {
        AiDiagnosticsReport {
            schema_version: AI_DIAGNOSTICS_SCHEMA_VERSION,
            captured_at: Utc.timestamp_opt(1_700_000_000, 0).unwrap(),
            broker: BrokerHealth {
                running: true,
                inbox_pending: 0,
                inbox_retry: 0,
                inbox_dead_letter: 0,
                last_delivery_unix: None,
                last_error_code: Some("http_402".to_string()),
            },
            parser: ParserLagSummary {
                transcripts_watched: 1,
                transcripts_behind: 0,
                max_lag_seconds: 0,
            },
            adapters: vec![AdapterFreshness {
                agent: "claude-code".to_string(),
                detected: true,
                enabled: true,
                verification: VerificationStatus::Verified,
                last_evidence_unix: None,
            }],
        }
    }

    #[test]
    fn a_well_formed_report_validates() {
        assert!(validate(&ok_report()).is_ok());
    }

    #[test]
    fn an_unknown_schema_version_is_rejected() {
        let mut report = ok_report();
        report.schema_version = AI_DIAGNOSTICS_SCHEMA_VERSION + 1;
        assert!(validate(&report).is_err());
    }

    #[test]
    fn a_path_like_agent_id_is_rejected() {
        let mut report = ok_report();
        report.adapters[0].agent = "/home/dev/.claude".to_string();
        assert!(validate(&report).is_err());
    }

    #[test]
    fn an_error_message_masquerading_as_a_code_is_rejected() {
        let mut report = ok_report();
        report.broker.last_error_code = Some("connection refused by upstream".to_string());
        assert!(validate(&report).is_err());
    }

    #[test]
    fn too_many_adapters_is_rejected() {
        let mut report = ok_report();
        report.adapters = std::iter::repeat_with(|| AdapterFreshness {
            agent: "x".to_string(),
            detected: false,
            enabled: false,
            verification: VerificationStatus::Unverified,
            last_evidence_unix: None,
        })
        .take(MAX_ADAPTERS + 1)
        .collect();
        assert!(validate(&report).is_err());
    }
}
