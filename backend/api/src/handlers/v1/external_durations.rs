use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::external_duration::{ExternalDuration, ExternalDurationRequest};
use crate::repository::external_durations::{DeleteExternalDurationResult, ExternalDurationFilter};

#[derive(Debug, Deserialize)]
pub struct ExternalDurationQuery {
    pub start: Option<f64>,
    pub end: Option<f64>,
    pub source: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExternalDurationResponse {
    pub data: ExternalDuration,
}

#[derive(Debug, Serialize)]
pub struct ExternalDurationListResponse {
    pub data: Vec<ExternalDuration>,
    pub total: usize,
}

#[derive(Debug, Serialize)]
pub struct ExternalDurationBulkResponse {
    pub data: Vec<ExternalDuration>,
    pub total: usize,
}

pub async fn create(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(request): Json<ExternalDurationRequest>,
) -> Result<(StatusCode, Json<ExternalDurationResponse>), (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "write_external_durations").await {
        return Err(auth::forbidden_scope("write_external_durations"));
    }
    let duration = state
        .external_duration_service
        .create(user_id, request)
        .await
        .map_err(|error| map_error(error.to_string()))?;
    Ok((
        StatusCode::CREATED,
        Json(ExternalDurationResponse { data: duration }),
    ))
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Query(query): Query<ExternalDurationQuery>,
) -> Result<Json<ExternalDurationListResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "read_external_durations").await {
        return Err(auth::forbidden_scope("read_external_durations"));
    }
    if query.start.is_some_and(|value| !value.is_finite())
        || query.end.is_some_and(|value| !value.is_finite())
    {
        return Err(map_error(
            "start/end must be finite Unix timestamps".to_string(),
        ));
    }
    let rows = state
        .external_duration_service
        .list(
            user_id,
            ExternalDurationFilter {
                start_time: query.start,
                end_time: query.end,
                source: query.source,
            },
        )
        .await
        .map_err(|error| map_error(error.to_string()))?;
    let total = rows.len();
    Ok(Json(ExternalDurationListResponse { data: rows, total }))
}

/// WakaTime's bulk endpoint accepts the same canonical duration records as the
/// single-record endpoint. Each record is idempotent by `(user, source, external_id)`;
/// replaying a batch therefore converges to the same ClickHouse state.
pub async fn create_bulk(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(requests): Json<Vec<ExternalDurationRequest>>,
) -> Result<(StatusCode, Json<ExternalDurationBulkResponse>), (StatusCode, Json<serde_json::Value>)>
{
    let user_id = auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "write_external_durations").await {
        return Err(auth::forbidden_scope("write_external_durations"));
    }
    if requests.len() > 2_000 {
        return Err(map_error(
            "at most 2000 external durations per request".to_string(),
        ));
    }
    let mut data = Vec::with_capacity(requests.len());
    for request in requests {
        data.push(
            state
                .external_duration_service
                .create(user_id, request)
                .await
                .map_err(|error| map_error(error.to_string()))?,
        );
    }
    let total = data.len();
    Ok((
        StatusCode::CREATED,
        Json(ExternalDurationBulkResponse { data, total }),
    ))
}

pub async fn delete_bulk(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Query(query): Query<ExternalDurationQuery>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    delete_source(State(state), headers, Query(query)).await
}

pub async fn delete_source(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Query(query): Query<ExternalDurationQuery>,
) -> Result<StatusCode, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "write_external_durations").await {
        return Err(auth::forbidden_scope("write_external_durations"));
    }
    let source = query
        .source
        .as_deref()
        .ok_or_else(|| map_error("source is required".to_string()))?;
    match state
        .external_duration_service
        .delete_source(user_id, source)
        .await
        .map_err(|error| map_error(error.to_string()))?
    {
        DeleteExternalDurationResult::Scheduled => Ok(StatusCode::NO_CONTENT),
        DeleteExternalDurationResult::NotFound => Ok(StatusCode::NOT_FOUND),
    }
}

fn map_error(message: String) -> (StatusCode, Json<serde_json::Value>) {
    let status = if message.contains("required")
        || message.contains("must")
        || message.contains("too long")
        || message.contains("between")
    {
        StatusCode::BAD_REQUEST
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    };
    (status, Json(serde_json::json!({ "error": message })))
}
