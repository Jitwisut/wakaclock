use axum::{
    extract::{ConnectInfo, State},
    http::StatusCode,
    Json,
};
use std::net::SocketAddr;
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::auth::{AuthResponse, LoginRequest, RegisterRequest};

/// POST /api/v1/auth/register
pub async fn register(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<serde_json::Value>)> {
    auth::check_rate_limit(&state, addr.ip())?;

    if payload.username.trim().is_empty() || payload.password.len() < 8 {
        return Err(app_error(
            StatusCode::BAD_REQUEST,
            "username is required and password must be at least 8 characters",
        ));
    }

    let data = state
        .user_service
        .register(
            payload.username.trim(),
            &payload.password,
            &state.config.jwt_secret,
        )
        .await
        .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?;

    Ok(Json(AuthResponse { data }))
}

/// POST /api/v1/auth/login
pub async fn login(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<serde_json::Value>)> {
    auth::check_rate_limit(&state, addr.ip())?;

    let data = state
        .user_service
        .login(
            payload.username.trim(),
            &payload.password,
            &state.config.jwt_secret,
        )
        .await
        .map_err(|_| app_error(StatusCode::UNAUTHORIZED, "invalid username or password"))?;

    Ok(Json(AuthResponse { data }))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
