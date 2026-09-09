use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::account_analytics::{
    AccountProjectionRebuildRequest, AccountProjectionRebuildResponse,
};

/// POST /api/v1/analytics/rebuild
///
/// This is the controlled rebuild seam for account projections, not a dashboard read
/// endpoint. It derives the user from the caller credential and atomically publishes a
/// version pointer only after every requested aggregate has been materialized.
pub async fn rebuild(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<AccountProjectionRebuildRequest>,
) -> Result<Json<AccountProjectionRebuildResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_scoped_user(&state, &headers, "read_stats").await?;
    auth::check_analytics_rate_limit(&state, user_id)?;
    let data = state
        .account_analytics_service
        .rebuild(user_id, &payload.start, &payload.end)
        .await
        .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?;

    Ok(Json(AccountProjectionRebuildResponse {
        status: "ok".to_string(),
        data,
    }))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
