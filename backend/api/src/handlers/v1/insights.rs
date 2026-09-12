use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::insights::InsightsResponse;

#[derive(Debug, Deserialize)]
pub struct InsightsQuery {
    pub timezone: Option<String>,
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((insight_type, range)): Path<(String, String)>,
    Query(query): Query<InsightsQuery>,
) -> Result<Json<InsightsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_scoped_user(&state, &headers, "read_stats").await?;

    let response = state
        .insights_service
        .get_by_type_and_range_in_timezone(
            user_id,
            &insight_type,
            &range,
            query.timezone.as_deref(),
        )
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(response))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
