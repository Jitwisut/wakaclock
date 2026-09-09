use axum::{
    extract::{ConnectInfo, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use std::net::SocketAddr;
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
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> Result<Json<GenerateApiKeyResponse>, (StatusCode, Json<serde_json::Value>)> {
    auth::check_rate_limit(
        &state,
        auth::client_ip(addr.ip(), &headers, &state.config.trusted_proxy_ips),
    )?;

    let user_id = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(|| app_error(StatusCode::UNAUTHORIZED, "log in first"))?;

    let response = state
        .user_service
        .generate_api_key(user_id)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(response))
}

/// GET /api/v1/users/current/api_key
///
/// Plaintext keys are shown only in the generation response. Reads retain the v1
/// envelope with a null value for compatibility.
pub async fn current(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    auth::check_rate_limit(
        &state,
        auth::client_ip(addr.ip(), &headers, &state.config.trusted_proxy_ips),
    )?;

    let user_id = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(|| app_error(StatusCode::UNAUTHORIZED, "log in first"))?;

    let api_key = state
        .user_service
        .current_api_key(user_id)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(serde_json::json!({
        "data": { "user_id": user_id, "api_key": api_key }
    })))
}

/// DELETE /api/v1/users/current/api_key — also requires a valid session, same reasoning.
pub async fn revoke(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> Result<Json<RevokeApiKeyResponse>, (StatusCode, Json<serde_json::Value>)> {
    auth::check_rate_limit(
        &state,
        auth::client_ip(addr.ip(), &headers, &state.config.trusted_proxy_ips),
    )?;

    let user_id = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(|| app_error(StatusCode::UNAUTHORIZED, "log in first"))?;

    let response = state
        .user_service
        .revoke_api_key(user_id)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(response))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
