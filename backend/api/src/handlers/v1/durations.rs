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
    let (range_start, range_end) = range.unix_bounds();
    let user_id = auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "read_logged_time").await {
        return Err(auth::forbidden_scope("read_logged_time"));
    }

    let rows = state
        .duration_service
        .get_by_date(user_id, &range)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    let data = rows
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
    let total_seconds = data.iter().map(|block| block.duration_seconds).sum();

    Ok(Json(DurationsResponse {
        total: data.len(),
        date,
        timezone: range.timezone.to_string(),
        range_start,
        range_end,
        total_seconds,
        data,
    }))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
