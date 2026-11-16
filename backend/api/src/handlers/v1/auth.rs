use axum::{
    extract::{ConnectInfo, State},
    http::{HeaderMap, StatusCode},
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
    headers: HeaderMap,
    Json(payload): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<serde_json::Value>)> {
    auth::check_rate_limit(
        &state,
        auth::client_ip(addr.ip(), &headers, &state.config.trusted_proxy_ips),
    )?;

    if payload.username.trim().is_empty()
        || payload.username.len() > 160
        || !(8..=1024).contains(&payload.password.len())
    {
        return Err(app_error(
            StatusCode::BAD_REQUEST,
            "username must contain 1-160 bytes and password 8-1024 bytes",
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
    headers: HeaderMap,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<serde_json::Value>)> {
    auth::check_rate_limit(
        &state,
        auth::client_ip(addr.ip(), &headers, &state.config.trusted_proxy_ips),
    )?;

    if payload.username.len() > 160 || payload.password.len() > 1024 {
        return Err(app_error(
            StatusCode::BAD_REQUEST,
            "credentials exceed size limits",
        ));
    }
    let data = state
        .user_service
        .login(
            payload.username.trim(),
            &payload.password,
            &state.config.jwt_secret,
        )
        .await
        .map_err(login_error)?;

    Ok(Json(AuthResponse { data }))
}

/// POST /api/v1/auth/logout. Revoking the same signed session twice is safe.
pub async fn logout(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
) -> Result<StatusCode, auth::AuthFailure> {
    auth::check_rate_limit(
        &state,
        auth::client_ip(addr.ip(), &headers, &state.config.trusted_proxy_ips),
    )?;
    let session = auth::session_to_revoke(&headers, &state.config.jwt_secret)
        .ok_or_else(auth::unauthorized)?;
    crate::services::session_revocation::revoke(
        state.postgres.as_deref(),
        &state.clickhouse.get_client(),
        session,
    )
    .await
    .map_err(|_| {
        app_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "session revocation temporarily unavailable",
        )
    })?;
    Ok(StatusCode::NO_CONTENT)
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}

fn login_error(error: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    if error.is::<crate::services::user::LoginRejected>() {
        app_error(StatusCode::UNAUTHORIZED, "invalid username or password")
    } else {
        tracing::warn!("login service unavailable");
        app_error(
            StatusCode::SERVICE_UNAVAILABLE,
            "authentication service temporarily unavailable",
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn login_outage_is_not_bad_credentials() {
        assert_eq!(
            login_error(anyhow::anyhow!("database down")).0,
            StatusCode::SERVICE_UNAVAILABLE
        );
        assert_eq!(
            login_error(crate::services::user::LoginRejected.into()).0,
            StatusCode::UNAUTHORIZED
        );
    }
}
