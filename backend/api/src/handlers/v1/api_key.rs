use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::user::{GenerateApiKeyResponse, RevokeApiKeyResponse};

/// POST /api/v1/users/current/api_key
///
/// Requires a valid session JWT (from POST /auth/login or /auth/register) — the
/// `user_id` a key is generated for comes from that verified session, never from a
/// query param or request body, so a caller can only ever mint a key for the account
/// they actually logged into.
pub async fn generate(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<GenerateApiKeyResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_session_user(&state, &headers)
        .ok_or_else(|| app_error(StatusCode::UNAUTHORIZED, "log in first"))?;

    let response = state
        .user_service
        .generate_api_key(user_id)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    // Hash is recomputed here rather than threaded back from the service so the cache
    // insert stays in the handler layer, next to the other auth-cache mutation (revoke).
    let key_hash = auth::hash_key(&response.data.api_key);
    state.auth_cache.insert(key_hash, user_id);

    Ok(Json(response))
}

/// DELETE /api/v1/users/current/api_key — also requires a valid session, same reasoning.
pub async fn revoke(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<RevokeApiKeyResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_session_user(&state, &headers)
        .ok_or_else(|| app_error(StatusCode::UNAUTHORIZED, "log in first"))?;

    let response = state
        .user_service
        .revoke_api_key(user_id)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    state.auth_cache.remove_for_user(user_id);

    Ok(Json(response))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
