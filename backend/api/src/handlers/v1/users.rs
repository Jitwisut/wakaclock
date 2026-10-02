use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::user::UserResponse;

pub async fn current(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<UserResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;

    let response = state
        .user_service
        .get_current_wakatime(user_id)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(response))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
