use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::wakatime_import::{
    WakaTimeImportData, WakaTimeImportRequest, WakaTimeImportResponse,
};

pub async fn run(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<WakaTimeImportRequest>,
) -> Result<Json<WakaTimeImportResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers, Some(payload.user_id));
    let result = state
        .wakatime_import_service
        .run(user_id, &payload.file_path)
        .await
        .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?;

    Ok(Json(WakaTimeImportResponse {
        status: "ok".to_string(),
        data: WakaTimeImportData {
            user_id,
            file_path: payload.file_path,
            imported_heartbeats: result.imported_heartbeats,
            skipped_heartbeats: result.skipped_heartbeats,
        },
    }))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
