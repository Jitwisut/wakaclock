use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use std::sync::Arc;

use crate::config::brokers::ProjectionMode;
use crate::infrastructure::app::AppState;
use crate::infrastructure::contracts::JobKind;
use crate::middleware::auth;
use crate::model::account_analytics::{
    AccountProjectionRebuildAcceptedData, AccountProjectionRebuildAcceptedResponse,
    AccountProjectionRebuildRequest, AccountProjectionRebuildResponse,
};

/// POST /api/v1/analytics/rebuild
///
/// This is the controlled rebuild seam for account projections, not a dashboard read
/// endpoint. It derives the user from the caller credential and atomically publishes a
/// version pointer only after every requested aggregate has been materialized.
pub async fn rebuild(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<AccountProjectionRebuildRequest>,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_scoped_user(&state, &headers, "read_stats").await?;
    auth::check_analytics_rate_limit(&state, user_id)?;

    if state.config.brokers.projection_mode == ProjectionMode::Job {
        crate::services::account_analytics::AccountAnalyticsService::validate_request(
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
                    "Idempotency-Key is required when projection job mode is enabled",
                )
            })?;
        if idempotency_key.len() > 128 || !idempotency_key.is_ascii() {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                "Idempotency-Key must be 1..=128 ASCII bytes",
            ));
        }
        state
            .user_service
            .ensure_postgres_identity(user_id)
            .await
            .map_err(|error| app_error(StatusCode::SERVICE_UNAVAILABLE, &error.to_string()))?;
        let created = state
            .job_service
            .create(
                Some(user_id),
                JobKind::ProjectionRebuild,
                json!({
                    "schema_version": 1,
                    "start": payload.start,
                    "end": payload.end,
                }),
                Some(idempotency_key),
            )
            .await
            .map_err(|error| app_error(StatusCode::SERVICE_UNAVAILABLE, &error.to_string()))?;
        let status_url = format!("/api/v2/jobs/{}", created.id);
        return Ok((
            StatusCode::ACCEPTED,
            [(header::LOCATION, status_url.clone())],
            Json(AccountProjectionRebuildAcceptedResponse {
                status: "accepted".to_string(),
                data: AccountProjectionRebuildAcceptedData {
                    job_id: created.id,
                    job_status: serde_json::to_value(created.status)
                        .ok()
                        .and_then(|value| value.as_str().map(ToOwned::to_owned))
                        .unwrap_or_else(|| "queued".to_string()),
                    deduplicated: created.deduplicated,
                    status_url,
                },
            }),
        )
            .into_response());
    }

    let data = state
        .account_analytics_service
        .rebuild(user_id, &payload.start, &payload.end)
        .await
        .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?;

    Ok(Json(AccountProjectionRebuildResponse {
        status: "ok".to_string(),
        data,
    })
    .into_response())
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
