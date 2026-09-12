use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::all_time::AllTimeResponse;

#[derive(Debug, Deserialize)]
pub struct AllTimeQuery {
    pub timezone: Option<String>,
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<AllTimeQuery>,
) -> Result<Json<AllTimeResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_scoped_user(&state, &headers, "read_stats").await?;

    let response = state
        .all_time_service
        .get_in_timezone(user_id, params.timezone.as_deref())
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(response))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
