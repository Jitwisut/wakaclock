//! Authenticated ingestion for the sanitized AI token/session stream.
//!
//! The payload contains event ids, timestamps, model names and numeric usage only. It
//! intentionally has no prompt, response, patch, file path or source-code fields.

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::ai_usage::AiUsageIngestReport;
use tracing::error;
use wakaclock_core::ai::AiUsageRecord;

const MAX_USAGE_EVENTS_PER_REQUEST: usize = 2_000;
const MAX_IDENTIFIER_BYTES: usize = 512;

/// POST /api/v1/ai/usage
///
/// Usage events are keyed by the provider's stable message id and the authenticated
/// caller is always assigned server-side. Replaying a transcript is therefore safe.
pub async fn ingest(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(records): Json<Vec<AiUsageRecord>>,
) -> Result<Json<AiUsageIngestReport>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "write_logged_time") {
        return Err(auth::forbidden_scope("write_logged_time"));
    }
    let record_count = records.len();

    if records.len() > MAX_USAGE_EVENTS_PER_REQUEST {
        return Err(app_error(
            StatusCode::PAYLOAD_TOO_LARGE,
            &format!("at most {MAX_USAGE_EVENTS_PER_REQUEST} usage events per request"),
        ));
    }
    for record in &records {
        validate(record)?;
    }

    let report = state
        .ai_usage_service
        .ingest(user_id, records)
        .await
        .map_err(|error| {
            // The trace middleware can only report the resulting 500. Keep the
            // actual bounded service/ClickHouse error in the server log so an
            // operator can fix the failing phase instead of guessing from a
            // repeated status code.
            error!(
                %user_id,
                record_count,
                error = %error,
                "AI usage ingest failed"
            );
            app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string())
        })?;

    Ok(Json(report))
}

fn validate(record: &AiUsageRecord) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    for (label, value) in [
        ("usage_event_id", record.usage_event_id.as_str()),
        ("ai_session_id", record.ai_session_id.as_str()),
        ("agent", record.agent.as_str()),
    ] {
        if value.trim().is_empty() {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                &format!("{label} cannot be empty"),
            ));
        }
        if value.len() > MAX_IDENTIFIER_BYTES {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                &format!("{label} must be at most {MAX_IDENTIFIER_BYTES} bytes"),
            ));
        }
    }

    if let Some(project_hint) = record.project_hint.as_deref() {
        if project_hint.trim().is_empty() || project_hint.len() > MAX_IDENTIFIER_BYTES {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                "project_hint must be a non-empty display name of at most 512 bytes",
            ));
        }
        // The usage stream is intentionally content-free. A path-like hint would leak
        // machine layout and would also make project allocation ambiguous across roots.
        if project_hint.contains('/') || project_hint.contains('\\') {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                "project_hint must be a display name, not a filesystem path",
            ));
        }
    }

    if record.occurred_at.timestamp() < 0 {
        return Err(app_error(
            StatusCode::BAD_REQUEST,
            "occurred_at must be on or after 1970-01-01T00:00:00Z",
        ));
    }
    Ok(())
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
