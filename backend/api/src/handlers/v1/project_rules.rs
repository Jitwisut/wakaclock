use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::project_rule::ProjectRuleRow;

#[derive(Debug, Deserialize)]
pub struct ProjectRulesQuery {
    pub user_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct UpsertProjectRulePayload {
    pub user_id: Uuid,
    pub pattern: String,
    pub project_name: String,
    pub priority: i32,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ProjectRulesResponse {
    pub data: Vec<ProjectRuleItem>,
}

#[derive(Debug, Serialize)]
pub struct ProjectRuleItem {
    pub rule_id: Uuid,
    pub user_id: Uuid,
    pub pattern: String,
    pub project_name: String,
    pub priority: i32,
    pub is_active: bool,
    pub created_at: u32,
    pub updated_at: u32,
}

#[derive(Debug, Serialize)]
pub struct ProjectRuleMutationResponse {
    pub status: String,
    pub data: ProjectRuleItem,
}

#[derive(Debug, Serialize)]
pub struct DeleteResponse {
    pub status: String,
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ProjectRulesQuery>,
) -> Result<Json<ProjectRulesResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers, Some(query.user_id));
    let rows = state
        .project_rule_service
        .list_by_user(user_id)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    Ok(Json(ProjectRulesResponse {
        data: rows.into_iter().map(ProjectRuleItem::from).collect(),
    }))
}

pub async fn upsert(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(rule_id): Path<Uuid>,
    Json(payload): Json<UpsertProjectRulePayload>,
) -> Result<Json<ProjectRuleMutationResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers, Some(payload.user_id));
    let row = state
        .project_rule_service
        .upsert(
            user_id,
            rule_id,
            payload.pattern,
            payload.project_name,
            payload.priority,
            payload.is_active.unwrap_or(true),
        )
        .await
        .map_err(|e| app_error(StatusCode::BAD_REQUEST, &e.to_string()))?;

    Ok(Json(ProjectRuleMutationResponse {
        status: "ok".to_string(),
        data: row.into(),
    }))
}

pub async fn delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(rule_id): Path<Uuid>,
    Query(query): Query<ProjectRulesQuery>,
) -> Result<Json<DeleteResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers, Some(query.user_id));
    state
        .project_rule_service
        .delete(user_id, rule_id)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    Ok(Json(DeleteResponse {
        status: "ok".to_string(),
    }))
}

impl From<ProjectRuleRow> for ProjectRuleItem {
    fn from(row: ProjectRuleRow) -> Self {
        Self {
            rule_id: row.rule_id,
            user_id: row.user_id,
            pattern: row.pattern,
            project_name: row.project_name,
            priority: row.priority,
            is_active: row.is_active,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
