use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use std::sync::Arc;

use crate::config::brokers::ReprocessMode;
use crate::infrastructure::app::AppState;
use crate::infrastructure::contracts::JobKind;
use crate::middleware::auth;
use crate::model::reprocess::{
    ReprocessAcceptedData, ReprocessAcceptedResponse, ReprocessRequest, ReprocessResponse,
};

pub async fn run(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<ReprocessRequest>,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    auth::check_analytics_rate_limit(&state, user_id)?;

    if matches!(state.config.brokers.reprocess_mode, ReprocessMode::Job) {
        crate::services::reprocess::ReprocessService::validate_request(
            &payload.start,
            &payload.end,
        )
        .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?;
        let idempotency_key = headers
            .get("Idempotency-Key")
            .and_then(|value| value.to_str().ok())
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                app_error(
                    StatusCode::BAD_REQUEST,
                    "Idempotency-Key is required when reprocess job mode is enabled",
                )
            })?;
        if idempotency_key.len() > 128 || !idempotency_key.is_ascii() {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                "Idempotency-Key must be 1..=128 ASCII bytes",
            ));
        }

        let params = json!({
            "start": payload.start,
            "end": payload.end,
            "dry_run": payload.dry_run.unwrap_or(true),
        });
        let created = state
            .job_service
            .create(
                Some(user_id),
                JobKind::AnalyticsReprocess,
                params,
                Some(idempotency_key),
            )
            .await
            .map_err(|error| app_error(StatusCode::SERVICE_UNAVAILABLE, &error.to_string()))?;
        let status_url = format!("/api/v2/jobs/{}", created.id);
        let body = ReprocessAcceptedResponse {
            status: "accepted".to_string(),
            data: ReprocessAcceptedData {
                job_id: created.id,
                job_status: serde_json::to_value(created.status)
                    .ok()
                    .and_then(|value| value.as_str().map(ToOwned::to_owned))
                    .unwrap_or_else(|| "queued".to_string()),
                deduplicated: created.deduplicated,
                status_url: status_url.clone(),
            },
        };
        return Ok((
            StatusCode::ACCEPTED,
            [(header::LOCATION, status_url)],
            Json(body),
        )
            .into_response());
    }

    let data = state
        .reprocess_service
        .run(
            user_id,
            &payload.start,
            &payload.end,
            payload.dry_run.unwrap_or(true),
        )
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(ReprocessResponse {
        status: "ok".to_string(),
        data,
    })
    .into_response())
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
