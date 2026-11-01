use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::project_city::ProjectCityResponse;
use crate::services::project_city::{ProjectCityService, TooManyRows};

#[derive(Debug, Deserialize)]
pub struct ProjectCityQuery {
    pub project_id: Uuid,
    pub timezone: Option<String>,
}

fn failure(status: StatusCode, message: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": message })))
}

/// GET /api/v1/dashboard/city?project_id=&timezone=
pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ProjectCityQuery>,
) -> Result<
    (
        [(header::HeaderName, &'static str); 1],
        Json<ProjectCityResponse>,
    ),
    (StatusCode, Json<serde_json::Value>),
> {
    let user_id = auth::require_scoped_user(&state, &headers, "read_projects").await?;
    if !state.config.time_machine_enabled {
        return Err(failure(
            StatusCode::SERVICE_UNAVAILABLE,
            "time machine is disabled",
        ));
    }
    auth::check_analytics_rate_limit(&state, user_id)?;
    let timezone = query.timezone.as_deref().unwrap_or("UTC");
    let timezone = timezone
        .parse::<chrono_tz::Tz>()
        .map_err(|_| failure(StatusCode::BAD_REQUEST, "timezone is not recognised"))?;
    let city = ProjectCityService::new(state.clickhouse.clone())
        .city(user_id, query.project_id, timezone.name())
        .await
        .map_err(|error| {
            if error.downcast_ref::<TooManyRows>().is_some() {
                return failure(
                    StatusCode::BAD_REQUEST,
                    "project history is too large to draw",
                );
            }
            tracing::error!(error = %error, "project city request failed");
            failure(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Project city request failed",
            )
        })?;
    Ok(([(header::CACHE_CONTROL, "private, no-store")], Json(city)))
}
