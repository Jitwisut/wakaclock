use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::date_range::ResolvedRange;
use crate::model::duration::{DurationBlock, DurationsResponse};

#[derive(Debug, Deserialize)]
pub struct DurationsQuery {
    pub date: Option<String>,
    pub timezone: Option<String>,
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<DurationsQuery>,
) -> Result<Json<DurationsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let date = match params.date {
        Some(date) => date,
        None => ResolvedRange::today_date_string(params.timezone.as_deref())
            .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?,
    };
    let range = ResolvedRange::parse(&date, &date, params.timezone.as_deref())
        .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?;
    let user_id = auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "read_logged_time").await {
        return Err(auth::forbidden_scope("read_logged_time"));
    }

    let result = state
        .duration_service
        .get_by_date_with_metrics(user_id, &range)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    let comparable_seconds = result.comparable_seconds;
    let ai_measured_seconds = result.ai_measured_seconds;
    let ai_additional_seconds = result.ai_additional_seconds;
    let calculation_version = result.calculation_version;
    let data = result
        .blocks
        .into_iter()
        .map(|row| DurationBlock {
            start: row.start,
            end: row.end,
            duration_seconds: row.duration_seconds,
            heartbeat_count: row.heartbeat_count,
            project: row.project,
            language: row.language,
            category: row.category,
            entity: row.entity,
        })
        .collect::<Vec<_>>();

    Ok(Json(DurationsResponse {
        total: data.len(),
        date,
        data,
        comparable_seconds: Some(comparable_seconds),
        ai_measured_seconds: Some(ai_measured_seconds),
        ai_additional_seconds: Some(ai_additional_seconds),
        calculation_version: Some(calculation_version),
    }))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
