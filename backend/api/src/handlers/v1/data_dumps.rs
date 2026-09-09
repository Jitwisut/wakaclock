//! WakaTime-compatible data dump aliases backed by the Phase 10 export jobs.
//!
//! WakaTime clients expect a `data` array/object rather than the v2 envelope. The
//! actual artifact is intentionally asynchronous; until the export worker publishes
//! an object-storage artifact, the job remains `queued` and has no download URL.

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::export::{CreateExportRequest, ExportJob};

#[derive(Debug, Default, Deserialize)]
pub struct DataDumpRequest {
    #[serde(default = "default_format")]
    pub format: String,
    #[serde(default = "default_scope")]
    pub scope: String,
}

fn default_format() -> String {
    "zip".to_string()
}

fn default_scope() -> String {
    "all".to_string()
}

#[derive(Debug, Serialize)]
pub struct DataDumpResponse {
    pub data: ExportJob,
}

#[derive(Debug, Serialize)]
pub struct DataDumpListResponse {
    pub data: Vec<ExportJob>,
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<DataDumpListResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = require_export_scope(&state, &headers).await?;
    let jobs = state
        .export_service
        .list(user_id)
        .await
        .map_err(internal_error)?;
    Ok(Json(DataDumpListResponse { data: jobs }))
}

pub async fn create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<DataDumpRequest>,
) -> Result<(StatusCode, Json<DataDumpResponse>), (StatusCode, Json<serde_json::Value>)> {
    let user_id = require_export_scope(&state, &headers).await?;
    let job = state
        .export_service
        .create(
            user_id,
            CreateExportRequest {
                format: input.format,
                scope: input.scope,
            },
        )
        .await
        .map_err(|error| {
            let message = error.to_string();
            let status = if message.contains("unsupported") {
                StatusCode::BAD_REQUEST
            } else {
                StatusCode::SERVICE_UNAVAILABLE
            };
            (status, Json(serde_json::json!({ "error": message })))
        })?;
    Ok((StatusCode::ACCEPTED, Json(DataDumpResponse { data: job })))
}

async fn require_export_scope(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<uuid::Uuid, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(state, headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(state, headers, "export_data").await {
        return Err(auth::forbidden_scope("export_data"));
    }
    Ok(user_id)
}

fn internal_error(error: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(serde_json::json!({ "error": error.to_string() })),
    )
}
