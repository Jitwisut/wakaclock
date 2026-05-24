use axum::{extract::State, http::StatusCode, Json};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::model::reprocess::{ReprocessData, ReprocessRequest, ReprocessResponse};

pub async fn run(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ReprocessRequest>,
) -> Result<Json<ReprocessResponse>, (StatusCode, Json<serde_json::Value>)> {
    let count = state
        .reprocess_service
        .run(payload.user_id, &payload.start, &payload.end)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(ReprocessResponse {
        status: "ok".to_string(),
        data: ReprocessData {
            user_id: payload.user_id,
            start: payload.start,
            end: payload.end,
            reprocessed_heartbeats: count,
        },
    }))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
