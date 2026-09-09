use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::insights::InsightsResponse;

pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((insight_type, range)): Path<(String, String)>,
) -> Result<Json<InsightsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_scoped_user(&state, &headers, "read_stats").await?;

    let response = state
        .insights_service
        .get_by_type_and_range(user_id, &insight_type, &range)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(response))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
