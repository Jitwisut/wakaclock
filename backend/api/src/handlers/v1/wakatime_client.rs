//! Endpoints that only exist because wakatime-cli and WakaTime plugins call them.
//! Neither stores anything: they answer in the shape the client expects so it
//! does not log errors or retry.

use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;

/// wakatime-cli attaches up to its whole log file to a diagnostic; anything
/// larger is rejected rather than buffered.
pub fn diagnostics_body_limit() -> DefaultBodyLimit {
    DefaultBodyLimit::max(256 * 1024)
}

/// POST /api/v1/plugins/errors
///
/// wakatime-cli reports its own crashes here and expects 201. The body carries
/// logs and stack traces that contain local file paths, so it is discarded
/// unread and never logged.
pub async fn plugin_errors(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    _body: Bytes,
) -> Result<StatusCode, (StatusCode, Json<Value>)> {
    auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    Ok(StatusCode::CREATED)
}

/// POST /api/v1/users/current/file_experts
///
/// WakaTime's "who knows this file" lookup. AtoAxis does not compute it, so it
/// answers with no experts instead of a 404 the plugin would surface as an error.
pub async fn file_experts(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    _body: Bytes,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    Ok(Json(json!({ "data": [] })))
}
