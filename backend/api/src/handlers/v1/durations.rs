use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::duration::{DurationBlock, DurationsResponse};
use crate::services::duration::DurationService;

#[derive(Debug, Deserialize)]
pub struct DurationsQuery {
    pub date: Option<String>,
    pub user_id: Option<Uuid>,
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<DurationsQuery>,
) -> Result<Json<DurationsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let date = params
        .date
        .unwrap_or_else(DurationService::today_date_string);
    let user_id = auth::resolve_user_id(&state, &headers, params.user_id);

    let rows = state
        .duration_service
        .get_by_date(user_id, &date)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    let data = rows
        .into_iter()
        .map(|row| DurationBlock {
            start: row.start,
            end: row.end,
            duration_seconds: row.duration_seconds,
            heartbeat_count: row.heartbeat_count,
            project: row.project,
            language: row.language,
            category: row.category,
            entity: row.entity,
        })
        .collect::<Vec<_>>();

    Ok(Json(DurationsResponse {
        total: data.len(),
        date,
        data,
    }))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
