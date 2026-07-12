use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::model::user::UserResponse;

#[derive(Debug, Deserialize)]
pub struct CurrentUserQuery {
    pub user_id: Option<Uuid>,
}

pub async fn current(
    State(state): State<Arc<AppState>>,
    Query(params): Query<CurrentUserQuery>,
) -> Result<Json<UserResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = params.user_id.unwrap_or(Uuid::nil());

    let response = state
        .user_service
        .get_current(user_id)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(response))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
