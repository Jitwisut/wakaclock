//! OIDC/SAML administration and SCIM 2.0 provisioning endpoints.

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::enterprise::{ScimPatchRequest, ScimUserInput, UpsertSsoRequest};

#[derive(Debug, Deserialize)]
pub struct ScimListQuery {
    #[serde(rename = "startIndex", default = "default_start_index")]
    pub start_index: i64,
    #[serde(default = "default_count")]
    pub count: i64,
}

#[derive(Debug, Deserialize)]
pub struct ScimGroupInput {
    #[serde(rename = "displayName")]
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
pub struct ScimTokenInput {
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct SsoEnforcementInput {
    pub enforced: bool,
}

fn default_start_index() -> i64 {
    1
}

fn default_count() -> i64 {
    100
}

/// v2 SSO endpoints use the same data/meta contract as other product routes.
pub async fn sso_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let actor = require_admin_scope(&state, &headers)?;
    let data = state
        .enterprise_service
        .get_sso(actor, organization_id)
        .await
        .map_err(service_error)?;
    Ok(Json(v2_envelope(data)))
}

pub async fn sso_upsert(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
    Json(input): Json<UpsertSsoRequest>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {
    let actor = require_admin_scope(&state, &headers)?;
    let data = state
        .enterprise_service
        .upsert_sso(actor, organization_id, input)
        .await
        .map_err(client_or_service_error)?;
    Ok((StatusCode::OK, Json(v2_envelope(data))))
}

pub async fn sso_enforce(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((organization_id, connection_id)): Path<(Uuid, Uuid)>,
    Json(input): Json<SsoEnforcementInput>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let actor = require_admin_scope(&state, &headers)?;
    let changed = state
        .enterprise_service
        .set_sso_enforced(actor, organization_id, connection_id, input.enforced)
        .await
        .map_err(client_or_service_error)?;
    if !changed {
        return Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "SSO connection not found or not verified" })),
        ));
    }
    Ok(Json(v2_envelope(json!({ "enforced": input.enforced }))))
}

pub async fn scim_tokens_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let actor = require_admin_scope(&state, &headers)?;
    let data = state
        .enterprise_service
        .list_scim_tokens(actor, organization_id)
        .await
        .map_err(service_error)?;
    Ok(Json(v2_envelope(data)))
}

pub async fn scim_tokens_create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(organization_id): Path<Uuid>,
    Json(input): Json<ScimTokenInput>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {
    let actor = require_admin_scope(&state, &headers)?;
    let data = state
        .enterprise_service
        .create_scim_token(actor, organization_id, input.expires_at)
        .await
        .map_err(service_error)?;
    Ok((StatusCode::CREATED, Json(v2_envelope(data))))
}

pub async fn scim_tokens_revoke(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((organization_id, token_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, Json<Value>)> {
    let actor = require_admin_scope(&state, &headers)?;
    let changed = state
        .enterprise_service
        .revoke_scim_token(actor, organization_id, token_id)
        .await
        .map_err(service_error)?;
    if changed {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "SCIM token not found" })),
        ))
    }
}

/// GET /scim/v2/Users
pub async fn scim_users_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ScimListQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let organization_id = scim_org(&state, &headers).await?;
    let (total, rows) = state
        .enterprise_service
        .scim_users(organization_id, query.start_index, query.count)
        .await
        .map_err(service_error)?;
    let resources: Vec<Value> = rows.into_iter().map(scim_user_json).collect();
    Ok(Json(json!({
        "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        "totalResults": total,
        "startIndex": query.start_index.max(1),
        "itemsPerPage": resources.len(),
        "Resources": resources
    })))
}

/// POST /scim/v2/Users
pub async fn scim_users_create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<ScimUserInput>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {
    let organization_id = scim_org(&state, &headers).await?;
    let row = state
        .enterprise_service
        .scim_upsert_user(organization_id, None, input)
        .await
        .map_err(client_or_service_error)?;
    Ok((StatusCode::CREATED, Json(scim_user_json(row))))
}

/// GET /scim/v2/Users/:id
pub async fn scim_user_get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let organization_id = scim_org(&state, &headers).await?;
    let row = state
        .enterprise_service
        .scim_user(organization_id, user_id)
        .await
        .map_err(service_error)?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(json!({ "detail": "user not found" })),
            )
        })?;
    Ok(Json(scim_user_json(row)))
}

/// PATCH /scim/v2/Users/:id.  Both direct fields and the common single-value
/// SCIM Operations form are accepted; source identity data is never stored in logs.
pub async fn scim_user_patch(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(user_id): Path<Uuid>,
    Json(mut input): Json<Value>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let organization_id = scim_org(&state, &headers).await?;
    let patch = normalize_scim_patch(&mut input)
        .map_err(|error| (StatusCode::BAD_REQUEST, Json(json!({ "error": error }))))?;
    let row = state
        .enterprise_service
        .scim_patch_user(organization_id, user_id, patch)
        .await
        .map_err(client_or_service_error)?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(json!({ "detail": "user not found" })),
            )
        })?;
    Ok(Json(scim_user_json(row)))
}

/// DELETE /scim/v2/Users/:id performs a tenant-scoped deprovision, never a global
/// hard-delete. Account deletion remains an explicit product workflow.
pub async fn scim_user_delete(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(user_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, Json<Value>)> {
    let organization_id = scim_org(&state, &headers).await?;
    if state
        .enterprise_service
        .scim_deprovision_user(organization_id, user_id)
        .await
        .map_err(service_error)?
    {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(json!({ "detail": "user not found" })),
        ))
    }
}

pub async fn scim_groups_list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let organization_id = scim_org(&state, &headers).await?;
    let rows = state
        .enterprise_service
        .scim_groups(organization_id)
        .await
        .map_err(service_error)?;
    let resources: Vec<Value> = rows
        .into_iter()
        .map(|group| {
            json!({
                "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
                "id": group.id,
                "displayName": group.display_name,
                "members": [],
                "meta": { "resourceType": "Group", "created": group.created_at }
            })
        })
        .collect();
    Ok(Json(json!({
        "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        "totalResults": resources.len(), "startIndex": 1,
        "itemsPerPage": resources.len(), "Resources": resources
    })))
}

pub async fn scim_groups_create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<ScimGroupInput>,
) -> Result<(StatusCode, Json<Value>), (StatusCode, Json<Value>)> {
    let organization_id = scim_org(&state, &headers).await?;
    let group = state
        .enterprise_service
        .scim_create_group(organization_id, &input.display_name)
        .await
        .map_err(client_or_service_error)?;
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
            "id": group.id, "displayName": group.display_name, "members": []
        })),
    ))
}

async fn scim_org(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<Uuid, (StatusCode, Json<Value>)> {
    let value = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "detail": "SCIM bearer token required" })),
            )
        })?;
    state
        .enterprise_service
        .organization_for_scim_token(value)
        .await
        .map_err(|_| {
            (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "detail": "invalid or expired SCIM token" })),
            )
        })
}

fn require_admin_scope(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<Uuid, (StatusCode, Json<Value>)> {
    let actor = auth::resolve_user_id(state, headers).ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(state, headers, "manage_integrations") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "insufficient_scope", "scope": "manage_integrations" })),
        ));
    }
    Ok(actor)
}

fn scim_user_json(row: crate::model::enterprise::ScimUserRecord) -> Value {
    json!({
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
        "id": row.id,
        "userName": row.username,
        "displayName": row.display_name,
        "active": row.active,
        "emails": row.email.map(|value| vec![json!({"value": value, "primary": true})]).unwrap_or_default(),
        "meta": {
            "resourceType": "User",
            "created": row.created_at,
            "lastModified": row.updated_at
        }
    })
}

fn normalize_scim_patch(value: &mut Value) -> Result<ScimPatchRequest, String> {
    if value.get("Operations").is_none() {
        return serde_json::from_value(value.clone()).map_err(|error| error.to_string());
    }
    let operations = value
        .get("Operations")
        .and_then(Value::as_array)
        .ok_or_else(|| "Operations must be an array".to_string())?;
    let mut patch = ScimPatchRequest::default();
    for operation in operations {
        let op = operation
            .get("op")
            .and_then(Value::as_str)
            .unwrap_or("replace")
            .to_ascii_lowercase();
        if op != "replace" && op != "add" {
            return Err("only add and replace SCIM operations are supported".to_string());
        }
        let path = operation.get("path").and_then(Value::as_str).unwrap_or("");
        let Some(value) = operation.get("value") else {
            continue;
        };
        match path.to_ascii_lowercase().as_str() {
            "active" => patch.active = value.as_bool(),
            "displayname" => patch.display_name = value.as_str().map(str::to_string),
            "emails" | "emails[type eq \"work\"].value" => {
                patch.emails = value.as_str().map(|email| {
                    vec![crate::model::enterprise::ScimEmail {
                        value: email.to_string(),
                        primary: true,
                    }]
                });
            }
            _ => {}
        }
    }
    Ok(patch)
}

fn v2_envelope(data: impl Serialize) -> Value {
    json!({
        "data": data,
        "meta": {
            "request_id": Uuid::now_v7(),
            "generated_at": Utc::now().to_rfc3339(),
            "timezone": "UTC",
            "data_freshness": "transactional"
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
    let status = if message.contains("required")
        || message.contains("invalid")
        || message.contains("must")
        || message.contains("cannot")
        || message.contains("too long")
    {
        StatusCode::BAD_REQUEST
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (status, Json(json!({ "error": message })))
}
