//! Authenticated ingestion/readback for metadata-only AI integration diagnostics.

use std::sync::Arc;

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::json;
use wakaclock_core::ai::{AiDiagnosticsReport, AiDiagnosticsReportV2, VerificationStatus};

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::ai_diagnostics::{AiDiagnosticsResponse, AiDiagnosticsV2Response};

const MAX_ADAPTERS: usize = 64;
const MAX_LABEL_BYTES: usize = 256;
const MAX_COUNTER: u32 = 1_000_000;
const MAX_DEVICE_BYTES: usize = 128;
const MAX_SEQUENCE: u64 = 9_000_000_000_000_000_000;

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
    let report = sanitize_report(report);
    state.ai_diagnostics_service.record(user_id, report).await;
    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/ai/diagnostics/v2 — device-scoped, nullable health measurements.
pub async fn ingest_v2(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(report): Json<AiDiagnosticsReportV2>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "write_logged_time") {
        return Err(auth::forbidden_scope("write_logged_time"));
    }
    validate_v2(&report)?;
    if state
        .ai_diagnostics_rate_limiter
        .check(user_id, &report.device_id)
        .is_err()
    {
        return Err(app_error(
            StatusCode::TOO_MANY_REQUESTS,
            "diagnostics upload rate limit exceeded",
        ));
    }
    let report = sanitize_report_v2(report);
    state
        .ai_diagnostics_service
        .record_v2(user_id, report)
        .await
        .map_err(|error| app_error(StatusCode::SERVICE_UNAVAILABLE, &error.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/users/current/ai_diagnostics
pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<AiDiagnosticsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "read_logged_time") {
        return Err(auth::forbidden_scope("read_logged_time"));
    }
    let report = state.ai_diagnostics_service.latest(user_id).await;
    Ok(Json(AiDiagnosticsResponse { report }))
}

/// GET /api/v1/users/current/ai_diagnostics/v2
pub async fn get_v2(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<AiDiagnosticsV2Response>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "read_logged_time") {
        return Err(auth::forbidden_scope("read_logged_time"));
    }
    let reports = state
        .ai_diagnostics_service
        .latest_v2(user_id)
        .await
        .map_err(|error| app_error(StatusCode::SERVICE_UNAVAILABLE, &error.to_string()))?;
    Ok(Json(AiDiagnosticsV2Response {
        reports,
        storage: state.ai_diagnostics_service.storage_mode(),
    }))
}

fn validate(report: &AiDiagnosticsReport) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    if !report.schema_is_supported() {
        return Err(app_error(
            StatusCode::BAD_REQUEST,
            "unsupported diagnostics schema_version",
        ));
    }
    if report.adapters.len() > MAX_ADAPTERS {
        return Err(app_error(
            StatusCode::PAYLOAD_TOO_LARGE,
            "too many adapters in diagnostics report",
        ));
    }
    if report.broker.pending > MAX_COUNTER
        || report.broker.retry > MAX_COUNTER
        || report.broker.dead_letter > MAX_COUNTER
        || report.parser.transcripts_watched > MAX_COUNTER
        || report.parser.transcripts_behind > MAX_COUNTER
        || report.parser.max_lag_seconds < 0
        || report.parser.max_lag_seconds > i64::from(MAX_COUNTER)
    {
        return Err(app_error(
            StatusCode::BAD_REQUEST,
            "diagnostics counters exceed the supported bound",
        ));
    }
    for adapter in &report.adapters {
        if adapter.agent.trim().is_empty()
            || adapter.agent.len() > MAX_LABEL_BYTES
            || adapter.agent.contains('/')
            || adapter.agent.contains('\\')
            || adapter.agent.chars().any(char::is_control)
        {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                "adapter agent must be a bounded slug",
            ));
        }
        if adapter.pending_events > MAX_COUNTER
            || adapter.retry_events > MAX_COUNTER
            || adapter.dead_letter_events > MAX_COUNTER
        {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                "adapter queue counters exceed the supported bound",
            ));
        }
        if let Some(code) = adapter.diagnostic_code.as_deref() {
            if !is_safe_code(code) {
                return Err(app_error(
                    StatusCode::BAD_REQUEST,
                    "diagnostic_code must be a short metadata label",
                ));
            }
        }
    }
    if let Some(code) = report.broker.last_error_code.as_deref() {
        if !is_safe_code(code) {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                "last_error_code must be a short code",
            ));
        }
    }
    Ok(())
}

fn validate_v2(
    report: &AiDiagnosticsReportV2,
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    if !report.schema_is_supported() {
        return Err(app_error(
            StatusCode::BAD_REQUEST,
            "unsupported diagnostics schema_version",
        ));
    }
    if !is_safe_opaque_id(&report.device_id) || !is_safe_opaque_id(&report.boot_id) {
        return Err(app_error(
            StatusCode::BAD_REQUEST,
            "device_id and boot_id must be bounded opaque identifiers",
        ));
    }
    if report.sequence > MAX_SEQUENCE || report.adapters.len() > MAX_ADAPTERS {
        return Err(app_error(
            StatusCode::PAYLOAD_TOO_LARGE,
            "diagnostics sequence or adapter count exceeds the supported bound",
        ));
    }
    for adapter in &report.adapters {
        if !is_safe_opaque_id(&adapter.agent) {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                "adapter agent must be a bounded slug",
            ));
        }
        if let Some(code) = adapter.diagnostic_code.as_deref() {
            if !is_safe_code(code) {
                return Err(app_error(
                    StatusCode::BAD_REQUEST,
                    "diagnostic_code must be a short metadata label",
                ));
            }
        }
    }
    if let Some(code) = report.broker.last_error_code.as_deref() {
        if !is_safe_code(code) {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                "last_error_code must be a short code",
            ));
        }
    }
    Ok(())
}

fn is_safe_opaque_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= MAX_DEVICE_BYTES
        && !value.contains(['/', '\\'])
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | ':')
        })
}

fn is_safe_code(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= MAX_LABEL_BYTES
        && !value.contains(['/', '\\'])
        && value
            .chars()
            .all(|character| !character.is_whitespace() && !character.is_control())
}

/// A client can observe a real run, but it cannot self-certify a new adapter by
/// uploading a fixture or unit-test result. Until a server-side certification artifact
/// is attached, fail closed by keeping a claimed Verified adapter at Scaffold. Existing
/// Installed/LiveTested/Unsupported states remain useful diagnostics.
fn sanitize_report(mut report: AiDiagnosticsReport) -> AiDiagnosticsReport {
    for adapter in &mut report.adapters {
        if adapter.verification == VerificationStatus::Verified {
            adapter.verification = VerificationStatus::Scaffold;
            if adapter.diagnostic_code.is_none() {
                adapter.diagnostic_code = Some("certification_required".to_string());
            }
        }
    }
    report
}

fn sanitize_report_v2(mut report: AiDiagnosticsReportV2) -> AiDiagnosticsReportV2 {
    for adapter in &mut report.adapters {
        if adapter.verification == VerificationStatus::Verified {
            adapter.verification = VerificationStatus::Scaffold;
            if adapter.diagnostic_code.is_none() {
                adapter.diagnostic_code = Some("certification_required".to_string());
            }
        }
    }
    report
}

fn app_error(status: StatusCode, message: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(json!({ "error": message })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use wakaclock_core::ai::{
        AdapterFreshness, AdapterFreshnessV2, AiDiagnosticsReportV2, BrokerHealthV2,
        DiagnosticMeasurement, DiagnosticsConsent, MeasurementAvailability, ParserLagSummaryV2,
        RuntimeHealth, VerificationStatus, AI_DIAGNOSTICS_SCHEMA_VERSION_V2,
    };

    fn report() -> AiDiagnosticsReport {
        AiDiagnosticsReport {
            schema_version: 1,
            captured_at: Utc::now(),
            broker: Default::default(),
            parser: Default::default(),
            adapters: vec![AdapterFreshness {
                agent: "gemini-cli".to_string(),
                verification: VerificationStatus::Scaffold,
                ..Default::default()
            }],
        }
    }

    #[test]
    fn accepts_metadata_only_report() {
        assert!(validate(&report()).is_ok());
    }

    #[test]
    fn rejects_path_like_agent_ids_and_error_messages() {
        let mut invalid = report();
        invalid.adapters[0].agent = "/Users/alice".to_string();
        assert!(validate(&invalid).is_err());

        let mut invalid = report();
        invalid.broker.last_error_code = Some("connection refused".to_string());
        assert!(validate(&invalid).is_err());

        let mut invalid = report();
        invalid.broker.last_error_code = Some("ENOENT:/Users/alice".to_string());
        assert!(validate(&invalid).is_err());

        let mut invalid = report();
        invalid.broker.pending = MAX_COUNTER + 1;
        assert!(validate(&invalid).is_err());

        let mut invalid = report();
        invalid.parser.max_lag_seconds = -1;
        assert!(validate(&invalid).is_err());
    }

    #[test]
    fn client_claimed_verified_status_is_not_a_certification() {
        let mut claimed = report();
        claimed.adapters[0].verification = VerificationStatus::Verified;

        let sanitized = sanitize_report(claimed);
        assert_eq!(
            sanitized.adapters[0].verification,
            VerificationStatus::Scaffold
        );
        assert_eq!(
            sanitized.adapters[0].diagnostic_code.as_deref(),
            Some("certification_required")
        );
    }

    fn report_v2() -> AiDiagnosticsReportV2 {
        let now = Utc::now();
        AiDiagnosticsReportV2 {
            schema_version: AI_DIAGNOSTICS_SCHEMA_VERSION_V2,
            captured_at: now,
            device_id: "device-test".to_string(),
            boot_id: "boot-test".to_string(),
            sequence: 1,
            measured_at: now,
            runtime_health: RuntimeHealth::Healthy,
            consent: DiagnosticsConsent {
                adapter_tracking: true,
                observer: true,
                diagnostics_upload: true,
            },
            broker: BrokerHealthV2 {
                availability: MeasurementAvailability::Available,
                running: DiagnosticMeasurement::available(true, now),
                pending: DiagnosticMeasurement::available(0, now),
                retry: DiagnosticMeasurement::available(0, now),
                dead_letter: DiagnosticMeasurement::available(0, now),
                last_delivery_at: None,
                last_error_code: None,
            },
            parser: ParserLagSummaryV2 {
                availability: MeasurementAvailability::Available,
                transcripts_watched: DiagnosticMeasurement::available(0, now),
                transcripts_behind: DiagnosticMeasurement::unavailable(),
                max_lag_seconds: DiagnosticMeasurement::unavailable(),
            },
            adapters: vec![AdapterFreshnessV2 {
                agent: "codex".to_string(),
                availability: MeasurementAvailability::Available,
                detected: DiagnosticMeasurement::available(true, now),
                enabled: DiagnosticMeasurement::available(true, now),
                runtime_health: RuntimeHealth::Healthy,
                verification: VerificationStatus::Verified,
                last_evidence_at: None,
                diagnostic_code: None,
            }],
        }
    }

    #[test]
    fn v2_preserves_unavailable_measurements_and_downgrades_claimed_verified() {
        let mut report = report_v2();
        assert!(validate_v2(&report).is_ok());
        report.adapters[0].verification = VerificationStatus::Verified;
        report.parser.max_lag_seconds = DiagnosticMeasurement::unavailable();
        let sanitized = sanitize_report_v2(report);
        assert_eq!(
            sanitized.parser.max_lag_seconds.availability,
            MeasurementAvailability::Unavailable
        );
        assert_eq!(
            sanitized.adapters[0].verification,
            VerificationStatus::Scaffold
        );
        assert_eq!(
            sanitized.adapters[0].diagnostic_code.as_deref(),
            Some("certification_required")
        );
    }
}
