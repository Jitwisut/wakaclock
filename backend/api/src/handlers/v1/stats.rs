use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::model::stats::StatsResponse;

#[derive(Debug, Deserialize)]
pub struct StatsQuery {
    pub user_id: Option<Uuid>,
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    Path(range): Path<String>,
    Query(params): Query<StatsQuery>,
) -> Result<Json<StatsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = params.user_id.unwrap_or(Uuid::nil());

    let response = state
        .stats_service
        .get_by_range(user_id, &range)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(response))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
