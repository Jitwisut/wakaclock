use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::project_merge::ProjectMergeRow;

#[derive(Debug, Deserialize)]
pub struct UpsertProjectMergePayload {
    pub source_project: String,
    pub target_project: String,
}

#[derive(Debug, Serialize)]
pub struct ProjectMergesResponse {
    pub data: Vec<ProjectMergeItem>,
}

#[derive(Debug, Serialize)]
pub struct ProjectMergeItem {
    pub merge_id: Uuid,
    pub user_id: Uuid,
    pub source_project: String,
    pub target_project: String,
    pub created_at: u32,
    pub updated_at: u32,
}

#[derive(Debug, Serialize)]
pub struct ProjectMergeMutationResponse {
    pub status: String,
    pub data: ProjectMergeItem,
}

#[derive(Debug, Serialize)]
pub struct DeleteResponse {
    pub status: String,
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<ProjectMergesResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    let rows = state
        .project_merge_service
        .list_by_user(user_id)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    Ok(Json(ProjectMergesResponse {
        data: rows.into_iter().map(ProjectMergeItem::from).collect(),
    }))
}

pub async fn upsert(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(merge_id): Path<Uuid>,
    Json(payload): Json<UpsertProjectMergePayload>,
) -> Result<Json<ProjectMergeMutationResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    let row = state
        .project_merge_service
        .upsert(
            user_id,
            merge_id,
            payload.source_project,
            payload.target_project,
        )
        .await
        .map_err(|e| app_error(StatusCode::BAD_REQUEST, &e.to_string()))?;

    Ok(Json(ProjectMergeMutationResponse {
        status: "ok".to_string(),
        data: row.into(),
    }))
}

pub async fn delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(merge_id): Path<Uuid>,
) -> Result<Json<DeleteResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    state
        .project_merge_service
        .delete(user_id, merge_id)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    Ok(Json(DeleteResponse {
        status: "ok".to_string(),
    }))
}

impl From<ProjectMergeRow> for ProjectMergeItem {
    fn from(row: ProjectMergeRow) -> Self {
        Self {
            merge_id: row.merge_id,
            user_id: row.user_id,
            source_project: row.source_project,
            target_project: row.target_project,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
