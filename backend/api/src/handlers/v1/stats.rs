use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::stats::StatsResponse;

#[derive(Debug, Deserialize)]
pub struct StatsQuery {
    pub timezone: Option<String>,
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(range): Path<String>,
    Query(params): Query<StatsQuery>,
) -> Result<Json<StatsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_scoped_user(&state, &headers, "read_stats").await?;

    let mut response = state
        .stats_service
        .get_by_range_in_timezone(user_id, &range, params.timezone.as_deref())
        .await
        .map_err(|error| {
            let message = error.to_string();
            let status = if message.starts_with(crate::services::stats::INVALID_RANGE) {
                StatusCode::BAD_REQUEST
            } else {
                StatusCode::INTERNAL_SERVER_ERROR
            };
            app_error(status, &message)
        })?;
    // WakaTime's stats carry the account's username. A failed lookup leaves it null
    // rather than failing the time totals.
    response.data.wakatime.username = state
        .user_service
        .get_current(user_id)
        .await
        .ok()
        .map(|user| user.data.username);

    Ok(Json(response))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
