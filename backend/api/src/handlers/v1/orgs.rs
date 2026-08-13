// src/handlers/v1/orgs.rs
//
// Minimal org endpoints — plan.md 6.1's full scope (org-scoped analytics on every
// existing query, billing-per-seat decisions, a personal-org migration for existing
// users, an org switcher UI) is explicitly NOT part of this. This exists only so a
// presence room can be labeled with a real, permission-checked team name (plan.md 7.2)
// instead of free text — see the Status Note in plan.md for that scoping decision.

use std::sync::Arc;

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::org::OrgRow;

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}

#[derive(Debug, Serialize)]
pub struct OrgItem {
    pub org_id: Uuid,
    pub name: String,
    pub owner_user_id: Uuid,
}

impl From<OrgRow> for OrgItem {
    fn from(row: OrgRow) -> Self {
        Self {
            org_id: row.org_id,
            name: row.name,
            owner_user_id: row.owner_user_id,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateOrgPayload {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct OrgResponse {
    pub data: OrgItem,
}

#[derive(Debug, Serialize)]
pub struct OrgsResponse {
    pub data: Vec<OrgItem>,
}

/// POST /orgs — the creator becomes the org's `owner`.
pub async fn create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<CreateOrgPayload>,
) -> Result<Json<OrgResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;

    let org = state
        .org_service
        .create(user_id, payload.name)
        .await
        .map_err(|e| app_error(StatusCode::BAD_REQUEST, &e.to_string()))?;

    Ok(Json(OrgResponse { data: org.into() }))
}

/// GET /orgs — every org the caller belongs to, any role.
pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<OrgsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;

    let orgs = state
        .org_service
        .list_for_user(user_id)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    Ok(Json(OrgsResponse {
        data: orgs.into_iter().map(OrgItem::from).collect(),
    }))
}
