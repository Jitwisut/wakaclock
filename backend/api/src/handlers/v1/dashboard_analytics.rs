use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::dashboard_analytics::DashboardAnalyticsResponse;
use crate::model::date_range::ResolvedRange;

#[derive(Debug, Deserialize)]
pub struct DashboardQuery {
    pub start: String,
    pub end: String,
    pub timezone: Option<String>,
}

/// GET /api/v1/dashboard/analytics
///
/// Range validation happens before any query runs, so a malformed date or unknown
/// timezone is a 400 describing the problem rather than an empty result set that looks
/// like "you did no work" (plan.md 9.8).
pub async fn overview(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<DashboardQuery>,
) -> Result<Json<DashboardAnalyticsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    auth::check_analytics_rate_limit(&state, user_id)?;

    let range = ResolvedRange::parse(&query.start, &query.end, query.timezone.as_deref()).map_err(
        |error| {
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": error.to_string() })),
            )
        },
    )?;

    let response = state
        .dashboard_analytics_service
        .overview(user_id, &range)
        .await
        .map_err(|error| {
            tracing::error!(error = %error, "dashboard analytics request failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Dashboard analytics request failed" })),
            )
        })?;

    Ok(Json(response))
}
