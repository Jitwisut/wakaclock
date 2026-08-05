use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::internal::{UpdateSubscriptionRequest, UpdateSubscriptionResponse};

/// POST /api/v1/internal/subscription
///
/// The integration point for whatever payment system is wired up outside this server —
/// call this when a checkout succeeds, a renewal lands, or a subscription lapses.
/// Requires `Authorization: Bearer <INTERNAL_API_SECRET>`; if that env var isn't set,
/// this route doesn't exist (404), the same way /admin/* is disabled elsewhere when
/// unconfigured — not reachable-but-unauthenticated.
pub async fn update_subscription(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<UpdateSubscriptionRequest>,
) -> Result<Json<UpdateSubscriptionResponse>, (StatusCode, Json<serde_json::Value>)> {
    if state.config.internal_api_secret.is_none() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Not found" })),
        ));
    }

    if !auth::verify_internal_secret(&state, &headers) {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized" })),
        ));
    }

    let user_id = state
        .user_service
        .update_subscription(&payload.username, &payload.status, payload.period_end)
        .await
        .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?;

    Ok(Json(UpdateSubscriptionResponse {
        status: "ok".to_string(),
        user_id,
    }))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
