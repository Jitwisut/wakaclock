use crate::{
    infrastructure::app::AppState,
    middleware::auth,
    model::matched_authorship::{MatchRequest, MatchResponse},
};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use std::sync::Arc;

pub async fn create(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<MatchRequest>,
) -> Result<Json<MatchResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user = auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "write_logged_time").await {
        return Err(auth::forbidden_scope("write_logged_time"));
    }
    request.validate().map_err(|error| {
        (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error":error})),
        )
    })?;
    state
        .matched_authorship_service
        .submit(user, request)
        .await
        .map(Json)
        .map_err(|error| {
            tracing::warn!(%error, "matched authorship storage unavailable");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({"error":"matched authorship unavailable"})),
            )
        })
}
