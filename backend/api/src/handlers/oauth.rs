use axum::{
    extract::{Form, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Redirect, Response},
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use chrono::Utc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::services::oauth::{DEFAULT_SCOPES, SUPPORTED_SCOPES};

#[derive(Debug, Deserialize)]
pub struct AuthorizeQuery {
    pub response_type: String,
    pub client_id: String,
    pub redirect_uri: String,
    pub scope: Option<String>,
    pub state: Option<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TokenForm {
    pub grant_type: String,
    pub code: Option<String>,
    pub refresh_token: Option<String>,
    pub client_id: String,
    pub client_secret: Option<String>,
    pub redirect_uri: Option<String>,
    pub code_verifier: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterAppRequest {
    pub name: String,
    pub redirect_uris: Vec<String>,
    #[serde(default = "default_confidential")]
    pub confidential: bool,
}

fn default_confidential() -> bool {
    true
}

pub fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/authorize", get(authorize))
        .route("/token", post(token))
        .route("/revoke", post(revoke))
        .route("/device/code", post(device_code))
        .route("/device/token", post(device_token))
        .route("/device/approve", post(device_approve))
        .with_state(app_state)
}

pub async fn list_apps(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Vec<crate::services::oauth::DeveloperAppSummary>>, OAuthError> {
    let owner_user_id = auth::require_session_user(&state, &headers)
        .ok_or_else(|| OAuthError::unauthorized("a dashboard session is required"))?;
    let apps = state
        .oauth_service
        .list_apps(owner_user_id)
        .await
        .map_err(OAuthError::service_unavailable)?;
    Ok(Json(apps))
}

pub async fn revoke_app(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    axum::extract::Path(client_id): axum::extract::Path<String>,
) -> Result<StatusCode, OAuthError> {
    let owner_user_id = auth::require_session_user(&state, &headers)
        .ok_or_else(|| OAuthError::unauthorized("a dashboard session is required"))?;
    if state
        .oauth_service
        .revoke_app(owner_user_id, &client_id)
        .await
        .map_err(OAuthError::service_unavailable)?
    {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(OAuthError::bad_request("OAuth application not found"))
    }
}

pub async fn authorize(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<AuthorizeQuery>,
) -> Result<Redirect, OAuthError> {
    if query.response_type != "code" {
        return Err(OAuthError::bad_request("response_type must be code"));
    }
    let user_id = auth::require_session_user(&state, &headers)
        .ok_or_else(|| OAuthError::unauthorized("a dashboard session is required"))?;
    let scopes = parse_scopes(query.scope.as_deref())?;
    let code = state
        .oauth_service
        .authorize(
            user_id,
            &query.client_id,
            &query.redirect_uri,
            &scopes,
            query.code_challenge.as_deref(),
            query.code_challenge_method.as_deref(),
        )
        .await
        .map_err(OAuthError::service_unavailable)?;
    let separator = if query.redirect_uri.contains('?') { '&' } else { '?' };
    let mut location = format!(
        "{}{separator}code={}",
        query.redirect_uri,
        percent_encode(&code)
    );
    if let Some(state_value) = query.state {
        location.push_str("&state=");
        location.push_str(&percent_encode(&state_value));
    }
    Ok(Redirect::temporary(&location))
}

pub async fn token(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Form(form): Form<TokenForm>,
) -> Result<Json<crate::services::oauth::TokenResponse>, OAuthError> {
    let (client_id, client_secret) = client_credentials(
        &headers,
        &form.client_id,
        form.client_secret.as_deref(),
    )?;
    let (response, user_id) = match form.grant_type.as_str() {
        "authorization_code" => state
            .oauth_service
            .exchange_code(
                form.code.as_deref().ok_or_else(|| {
                    OAuthError::bad_request("code is required for authorization_code")
                })?,
                &client_id,
                form.redirect_uri.as_deref().ok_or_else(|| {
                    OAuthError::bad_request("redirect_uri is required for authorization_code")
                })?,
                form.code_verifier.as_deref(),
                client_secret.as_deref(),
            )
            .await
            .map_err(OAuthError::invalid_grant)?,
        "refresh_token" => state
            .oauth_service
            .refresh(
                form.refresh_token.as_deref().ok_or_else(|| {
                    OAuthError::bad_request("refresh_token is required for refresh_token")
                })?,
                &client_id,
                client_secret.as_deref(),
            )
            .await
            .map_err(OAuthError::invalid_grant)?,
        _ => return Err(OAuthError::bad_request("unsupported grant_type")),
    };
    state
        .auth_cache
        .insert_with_expiry_and_scopes(
            auth::hash_key(&response.access_token),
            user_id,
            Utc::now().timestamp() + response.expires_in,
            &response
                .scope
                .split_whitespace()
                .map(str::to_string)
                .collect::<Vec<_>>(),
        );
    Ok(Json(response))
}

pub async fn revoke(
    State(state): State<Arc<AppState>>,
    Form(form): Form<RevokeForm>,
) -> Result<StatusCode, OAuthError> {
    state
        .oauth_service
        .revoke(&form.token)
        .await
        .map_err(OAuthError::service_unavailable)?;
    state.auth_cache.remove_hash(&auth::hash_key(&form.token));
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Deserialize)]
pub struct RevokeForm {
    pub token: String,
}

pub async fn register_app(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<RegisterAppRequest>,
) -> Result<(StatusCode, Json<crate::services::oauth::RegisteredApp>), OAuthError> {
    let owner_user_id = auth::require_session_user(&state, &headers)
        .ok_or_else(|| OAuthError::unauthorized("a dashboard session is required"))?;
    let app = state
        .oauth_service
        .register_app(
            owner_user_id,
            &request.name,
            &request.redirect_uris,
            request.confidential,
        )
        .await
        .map_err(OAuthError::bad_request_or_service)?;
    Ok((StatusCode::CREATED, Json(app)))
}

#[derive(Debug, Deserialize)]
pub struct DeviceCodeForm {
    pub client_id: String,
    pub scope: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeviceTokenForm {
    pub device_code: String,
    pub client_id: String,
}

#[derive(Debug, Deserialize)]
pub struct DeviceApproveForm {
    pub user_code: String,
}

pub async fn device_code(
    State(state): State<Arc<AppState>>,
    Form(form): Form<DeviceCodeForm>,
) -> Result<Json<crate::services::oauth::DeviceCodeResponse>, OAuthError> {
    let scopes = parse_scopes(form.scope.as_deref())?;
    let response = state
        .oauth_service
        .issue_device_code(&form.client_id, &scopes)
        .await
        .map_err(OAuthError::invalid_grant)?;
    Ok(Json(response))
}

pub async fn device_token(
    State(state): State<Arc<AppState>>,
    Form(form): Form<DeviceTokenForm>,
) -> Result<Json<crate::services::oauth::TokenResponse>, OAuthError> {
    let (response, user_id) = state
        .oauth_service
        .exchange_device_code(&form.device_code, &form.client_id)
        .await
        .map_err(OAuthError::device_grant)?;
    state.auth_cache.insert_with_expiry_and_scopes(
        auth::hash_key(&response.access_token),
        user_id,
        Utc::now().timestamp() + response.expires_in,
        &response
            .scope
            .split_whitespace()
            .map(str::to_string)
            .collect::<Vec<_>>(),
    );
    Ok(Json(response))
}

pub async fn device_approve(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Form(form): Form<DeviceApproveForm>,
) -> Result<StatusCode, OAuthError> {
    let user_id = auth::require_session_user(&state, &headers)
        .ok_or_else(|| OAuthError::unauthorized("a dashboard session is required"))?;
    state
        .oauth_service
        .approve_device_code(user_id, &form.user_code)
        .await
        .map_err(OAuthError::invalid_grant)?;
    Ok(StatusCode::NO_CONTENT)
}

fn parse_scopes(raw: Option<&str>) -> Result<Vec<String>, OAuthError> {
    let scopes: Vec<String> = raw
        .map(|value| value.split_whitespace().map(str::to_string).collect())
        .unwrap_or_else(|| DEFAULT_SCOPES.iter().map(|scope| (*scope).to_string()).collect());
    if scopes.is_empty() || scopes.iter().any(|scope| !SUPPORTED_SCOPES.contains(&scope.as_str())) {
        return Err(OAuthError::bad_request("scope contains an unsupported value"));
    }
    Ok(scopes)
}

fn client_credentials(
    headers: &HeaderMap,
    form_client_id: &str,
    form_secret: Option<&str>,
) -> Result<(String, Option<String>), OAuthError> {
    if let Some(value) = headers.get("authorization").and_then(|value| value.to_str().ok()) {
        if let Some(encoded) = value.strip_prefix("Basic ") {
            let decoded = BASE64
                .decode(encoded.trim())
                .map_err(|_| OAuthError::bad_request("invalid HTTP Basic client credentials"))?;
            let decoded = String::from_utf8(decoded)
                .map_err(|_| OAuthError::bad_request("invalid HTTP Basic client credentials"))?;
            let (client_id, secret) = decoded
                .split_once(':')
                .ok_or_else(|| OAuthError::bad_request("invalid HTTP Basic client credentials"))?;
            if client_id.is_empty() {
                return Err(OAuthError::bad_request("client_id is required"));
            }
            return Ok((client_id.to_string(), Some(secret.to_string())));
        }
    }
    if form_client_id.trim().is_empty() {
        return Err(OAuthError::bad_request("client_id is required"));
    }
    Ok((form_client_id.to_string(), form_secret.map(str::to_string)))
}

fn percent_encode(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                vec![byte as char]
            }
            byte => format!("%{byte:02X}").chars().collect(),
        })
        .collect()
}

#[derive(Debug)]
pub struct OAuthError {
    status: StatusCode,
    code: &'static str,
    message: String,
}

impl OAuthError {
    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            code: "invalid_request",
            message: message.into(),
        }
    }

    fn unauthorized(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            code: "unauthorized",
            message: message.into(),
        }
    }

    fn invalid_grant(error: anyhow::Error) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            code: "invalid_grant",
            message: error.to_string(),
        }
    }

    fn service_unavailable(error: anyhow::Error) -> Self {
        Self {
            status: StatusCode::SERVICE_UNAVAILABLE,
            code: "temporarily_unavailable",
            message: error.to_string(),
        }
    }

    fn device_grant(error: anyhow::Error) -> Self {
        let message = error.to_string();
        let code = match message.as_str() {
            "authorization_pending" => "authorization_pending",
            "slow_down" => "slow_down",
            "invalid_grant" => "invalid_grant",
            _ => "invalid_grant",
        };
        Self {
            status: StatusCode::BAD_REQUEST,
            code,
            message,
        }
    }

    fn bad_request_or_service(error: anyhow::Error) -> Self {
        let message = error.to_string();
        if message.contains("required") || message.contains("redirect URI") {
            Self::bad_request(message)
        } else {
            Self::service_unavailable(error)
        }
    }
}

impl IntoResponse for OAuthError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(json!({
                "error": self.code,
                "error_description": self.message,
            })),
        )
            .into_response()
    }
}
