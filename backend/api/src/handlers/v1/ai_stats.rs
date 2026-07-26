use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::ai_stats::AiStatsResponse;

#[derive(Debug, Deserialize)]
pub struct AiStatsQuery {
    pub start: String,
    pub end: String,
    pub user_id: Option<Uuid>,
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<AiStatsQuery>,
) -> Result<Json<AiStatsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers, params.user_id);

    let response = state
        .ai_stats_service
        .get_range(user_id, &params.start, &params.end)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(response))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
