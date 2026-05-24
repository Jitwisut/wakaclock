use axum::{extract::State, http::StatusCode, Json};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::model::wakatime_import::{
    WakaTimeImportData, WakaTimeImportRequest, WakaTimeImportResponse,
};

pub async fn run(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<WakaTimeImportRequest>,
) -> Result<Json<WakaTimeImportResponse>, (StatusCode, Json<serde_json::Value>)> {
    let result = state
        .wakatime_import_service
        .run(payload.user_id, &payload.file_path)
        .await
        .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?;

    Ok(Json(WakaTimeImportResponse {
        status: "ok".to_string(),
        data: WakaTimeImportData {
            user_id: payload.user_id,
            file_path: payload.file_path,
            imported_heartbeats: result.imported_heartbeats,
            skipped_heartbeats: result.skipped_heartbeats,
        },
    }))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
