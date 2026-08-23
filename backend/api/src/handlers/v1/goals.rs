//! WakaTime v1 goal read aliases backed by the PostgreSQL goal service.

use axum::{extract::{Path, State}, http::{HeaderMap, StatusCode}, Json};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;

pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = require(&state, &headers)?;
    let data = state
        .goal_service
        .list_for_user(user_id)
        .await
        .map_err(service_error)?;
    Ok(Json(json!({ "data": data })))
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(goal): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = require(&state, &headers)?;
    let data = state
        .goal_service
        .get(user_id, goal)
        .await
        .map_err(service_error)?
        .ok_or_else(|| (StatusCode::NOT_FOUND, Json(json!({ "error": "goal not found" }))))?;
    Ok(Json(json!({ "data": data })))
}

fn require(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<Uuid, (StatusCode, Json<Value>)> {
    let user_id = auth::resolve_user_id(state, headers).ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(state, headers, "read_goals") {
        return Err(auth::forbidden_scope("read_goals"));
    }
    Ok(user_id)
}

fn service_error(error: anyhow::Error) -> (StatusCode, Json<Value>) {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({ "error": error.to_string() })),
    )
}

