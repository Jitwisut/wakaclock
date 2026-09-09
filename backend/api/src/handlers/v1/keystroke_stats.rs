use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::keystroke_stats::KeystrokeStatsResponse;

#[derive(Debug, Deserialize)]
pub struct KeystrokeStatsQuery {
    pub start: String,
    pub end: String,
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<KeystrokeStatsQuery>,
) -> Result<Json<KeystrokeStatsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_scoped_user(&state, &headers, "read_stats").await?;

    let response = state
        .keystroke_stats_service
        .get_range(user_id, &params.start, &params.end)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(response))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
