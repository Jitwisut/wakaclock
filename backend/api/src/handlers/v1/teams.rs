// src/handlers/v1/teams.rs
//
// See handlers/v1/orgs.rs for the scoping note — this is the minimal team layer needed
// to give a presence room a real, permission-checked label (plan.md 7.2), not the full
// team-management surface plan.md 6.1 eventually describes.

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::team::TeamRow;

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}

#[derive(Debug, Serialize)]
pub struct TeamItem {
    pub team_id: Uuid,
    pub org_id: Uuid,
    pub name: String,
}

impl From<TeamRow> for TeamItem {
    fn from(row: TeamRow) -> Self {
        Self {
            team_id: row.team_id,
            org_id: row.org_id,
            name: row.name,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateTeamPayload {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct TeamResponse {
    pub data: TeamItem,
}

#[derive(Debug, Serialize)]
pub struct TeamsResponse {
    pub data: Vec<TeamItem>,
}

/// POST /orgs/:org_id/teams — org owner/admin only (`TeamService::create` enforces this).
pub async fn create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org_id): Path<Uuid>,
    Json(payload): Json<CreateTeamPayload>,
) -> Result<Json<TeamResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;

    let team = state
        .team_service
        .create(org_id, user_id, payload.name)
        .await
        .map_err(|e| app_error(StatusCode::FORBIDDEN, &e.to_string()))?;

    Ok(Json(TeamResponse { data: team.into() }))
}

/// GET /orgs/:org_id/teams
pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org_id): Path<Uuid>,
) -> Result<Json<TeamsResponse>, (StatusCode, Json<serde_json::Value>)> {
    auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;

    let teams = state
        .team_service
        .list_for_org(org_id)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    Ok(Json(TeamsResponse {
        data: teams.into_iter().map(TeamItem::from).collect(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct AddMemberPayload {
    pub user_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct AddMemberResponse {
    pub status: &'static str,
}

/// POST /orgs/:org_id/teams/:team_id/members — org owner/admin only.
pub async fn add_member(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((_org_id, team_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<AddMemberPayload>,
) -> Result<Json<AddMemberResponse>, (StatusCode, Json<serde_json::Value>)> {
    let actor_user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;

    state
        .team_service
        .add_member(team_id, actor_user_id, payload.user_id)
        .await
        .map_err(|e| app_error(StatusCode::FORBIDDEN, &e.to_string()))?;

    Ok(Json(AddMemberResponse { status: "added" }))
}
