use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::projects::{WakaTimeProject, WakaTimeProjectsResponse};

#[derive(Debug, Deserialize)]
pub struct ProjectsQuery {
    pub start: Option<String>,
    pub end: Option<String>,
    pub timezone: Option<String>,
    /// WakaTime's project-name filter for the list form.
    pub q: Option<String>,
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<ProjectsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_scoped_user(&state, &headers, "read_projects").await?;
    let internal =
        |error: anyhow::Error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string());

    let value = match (params.start.as_deref(), params.end.as_deref()) {
        // The dashboard's form: per-project time over a date range.
        (Some(start), Some(end)) => serde_json::to_value(
            state
                .projects_service
                .get_range_in_timezone(user_id, start, end, params.timezone.as_deref())
                .await
                .map_err(internal)?,
        ),
        // WakaTime's form: the account's project list.
        (None, None) => {
            let now = chrono::Utc::now().timestamp() as f64;
            let data = state
                .projects_service
                .list_spans(user_id, params.q.as_deref())
                .await
                .map_err(internal)?
                .into_iter()
                .map(|row| WakaTimeProject::new(user_id, row, &state.config.public_app_url, now))
                .collect();
            serde_json::to_value(WakaTimeProjectsResponse { data })
        }
        _ => {
            return Err(app_error(
                StatusCode::BAD_REQUEST,
                "pass both start and end for per-range totals, or neither for the project list",
            ))
        }
    }
    .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(value))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
