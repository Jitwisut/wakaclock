//! AtoAxis v2 version-control integration contracts.

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::vcs::{ConnectVcsRequest, ProjectMappingRequest, RepositoryInput};

#[derive(Debug, Deserialize)]
pub struct ConnectPayload {
    pub organization_id: Uuid,
    pub external_account_id: String,
    pub encrypted_credentials: String,
    #[serde(default)]
    pub repositories: Vec<RepositoryInput>,
}

#[derive(Debug, Deserialize)]
pub struct OrganizationQuery {
    pub organization_id: Uuid,
    pub repository_id: Option<Uuid>,
    pub limit: Option<i64>,
}

pub async fn connect(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(provider): Path<String>,
    Json(payload): Json<ConnectPayload>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {
    let actor = require_scope(&state, &headers, "manage_integrations").await?;
    let data = state
        .vcs_service
        .connect(
            actor,
            ConnectVcsRequest {
                organization_id: payload.organization_id,
                provider,
                external_account_id: payload.external_account_id,
                encrypted_credentials: payload.encrypted_credentials,
                repositories: payload.repositories,
            },
        )
        .await
        .map_err(client_or_service_error)?;
    Ok((StatusCode::CREATED, Json(envelope(data))))
}

pub async fn repositories(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<OrganizationQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let actor = require_scope(&state, &headers, "read_org_dashboards").await?;
    let data = state
        .vcs_service
        .repositories(actor, query.organization_id)
        .await
        .map_err(service_error)?;
    Ok(Json(envelope(data)))
}

pub async fn project_mapping(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(repository_id): Path<Uuid>,
    Json(input): Json<ProjectMappingRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let actor = require_scope(&state, &headers, "manage_integrations").await?;
    let data = state
        .vcs_service
        .map_project(actor, repository_id, input)
        .await
        .map_err(client_or_service_error)?;
    Ok(Json(envelope(data)))
}

pub async fn commits(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<OrganizationQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let actor = require_scope(&state, &headers, "read_org_dashboards").await?;
    let data = state
        .vcs_service
        .commits(
            actor,
            query.organization_id,
            query.repository_id,
            query.limit.unwrap_or(100),
        )
        .await
        .map_err(service_error)?;
    Ok(Json(envelope(data)))
}

/// Commits with the coding time charged to each.
///
/// Separate from `commits` rather than a flag on it: attribution reads the canonical
/// timeline once per commit author, so a caller that only wants the metadata list should
/// not pay for ClickHouse reads it will not use.
pub async fn commit_analytics(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<OrganizationQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let actor = require_scope(&state, &headers, "read_org_dashboards").await?;
    let data = state
        .vcs_service
        .commit_analytics(
            actor,
            query.organization_id,
            query.repository_id,
            query.limit.unwrap_or(100),
        )
        .await
        .map_err(service_error)?;
    Ok(Json(envelope(data)))
}

pub async fn pull_requests(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<OrganizationQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let actor = require_scope(&state, &headers, "read_org_dashboards").await?;
    let data = state
        .vcs_service
        .pull_requests(
            actor,
            query.organization_id,
            query.repository_id,
            query.limit.unwrap_or(100),
        )
        .await
        .map_err(service_error)?;
    Ok(Json(envelope(data)))
}

pub async fn pull_request_analytics(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(pull_request_id): Path<Uuid>,
    Query(query): Query<OrganizationQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let actor = require_scope(&state, &headers, "read_org_dashboards").await?;
    let data = state
        .vcs_service
        .pull_request_analytics(actor, query.organization_id, pull_request_id)
        .await
        .map_err(service_error)?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "pull request not found" })),
            )
        })?;
    Ok(Json(envelope(data)))
}

async fn require_scope(
    state: &AppState,
    headers: &HeaderMap,
    scope: &str,
) -> Result<Uuid, (StatusCode, Json<Value>)> {
    let actor = auth::resolve_user_id(state, headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(state, headers, scope).await {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "insufficient_scope", "scope": scope })),
        ));
    }
    Ok(actor)
}

fn envelope(data: impl Serialize) -> Value {
    json!({
        "data": data,
        "meta": {
            "request_id": Uuid::now_v7(),
            "generated_at": chrono::Utc::now().to_rfc3339(),
            "timezone": "UTC",
            "data_freshness": "transactional",
            "coverage": { "attribution": "metadata_only_until_head_revision_is_synced" }
        }
    })
}

fn service_error(error: anyhow::Error) -> (StatusCode, Json<Value>) {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({ "error": error.to_string() })),
    )
}

fn client_or_service_error(error: anyhow::Error) -> (StatusCode, Json<Value>) {
    let message = error.to_string();
    let status = if message.contains("must")
        || message.contains("invalid")
        || message.contains("required")
        || message.contains("too long")
    {
        StatusCode::BAD_REQUEST
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (status, Json(json!({ "error": message })))
}
