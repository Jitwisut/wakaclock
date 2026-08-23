use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::date_range::ResolvedRange;
use crate::model::project_analytics::{
    ProjectAiResponse, ProjectAnalyticsDetailResponse, ProjectAnalyticsListResponse,
    ProjectBranchesResponse, ProjectDailyResponse, ProjectFilesResponse, ProjectSort, SortOrder,
};

#[derive(Debug, Deserialize)]
pub struct ProjectListQuery {
    pub cursor: Option<String>,
    pub end: String,
    pub limit: Option<u16>,
    pub order: Option<String>,
    pub sort: Option<String>,
    pub start: String,
    pub timezone: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ProjectDetailQuery {
    pub branch: Option<String>,
    pub cursor: Option<String>,
    pub end: String,
    pub limit: Option<u16>,
    pub min_seconds: Option<f64>,
    pub start: String,
    pub timezone: Option<String>,
}

/// GET /api/v1/projects/analytics
pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ProjectListQuery>,
) -> Result<Json<ProjectAnalyticsListResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    auth::check_analytics_rate_limit(&state, user_id)?;
    let range = parse_range(&query.start, &query.end, query.timezone.as_deref())?;
    let sort = ProjectSort::parse(query.sort.as_deref()).map_err(bad_request)?;
    let order = SortOrder::parse(query.order.as_deref()).map_err(bad_request)?;
    let response = state
        .project_analytics_service
        .list(
            user_id,
            &range,
            sort,
            order,
            query.limit,
            query.cursor.as_deref(),
        )
        .await
        .map_err(service_error)?;
    Ok(Json(response))
}

/// GET /api/v1/projects/:project_id/analytics
pub async fn detail(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(query): Query<ProjectDetailQuery>,
) -> Result<Json<ProjectAnalyticsDetailResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    auth::check_analytics_rate_limit(&state, user_id)?;
    let range = parse_range(&query.start, &query.end, query.timezone.as_deref())?;
    let branch = parse_branch(query.branch.as_deref())?;
    let response = state
        .project_analytics_service
        .detail(user_id, project_id, &range, branch)
        .await
        .map_err(service_error)?;
    Ok(Json(response))
}

/// GET /api/v1/projects/:project_id/files
///
/// The same sanitized item shape powers both the list and packed-bubble visualization.
pub async fn files(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(query): Query<ProjectDetailQuery>,
) -> Result<Json<ProjectFilesResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    auth::check_analytics_rate_limit(&state, user_id)?;
    let range = parse_range(&query.start, &query.end, query.timezone.as_deref())?;
    let branch = parse_branch(query.branch.as_deref())?;
    let response = state
        .project_analytics_service
        .files(
            user_id,
            project_id,
            &range,
            branch,
            query.limit,
            query.cursor.as_deref(),
            query.min_seconds,
        )
        .await
        .map_err(service_error)?;
    Ok(Json(response))
}

/// GET /api/v1/projects/:project_id/branches
pub async fn branches(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(query): Query<ProjectDetailQuery>,
) -> Result<Json<ProjectBranchesResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    auth::check_analytics_rate_limit(&state, user_id)?;
    let range = parse_range(&query.start, &query.end, query.timezone.as_deref())?;
    let response = state
        .project_analytics_service
        .branches(
            user_id,
            project_id,
            &range,
            query.limit,
            query.cursor.as_deref(),
        )
        .await
        .map_err(service_error)?;
    Ok(Json(response))
}

/// GET /api/v1/projects/:project_id/daily
pub async fn daily(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(query): Query<ProjectDetailQuery>,
) -> Result<Json<ProjectDailyResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    auth::check_analytics_rate_limit(&state, user_id)?;
    let range = parse_range(&query.start, &query.end, query.timezone.as_deref())?;
    let branch = parse_branch(query.branch.as_deref())?;
    let response = state
        .project_analytics_service
        .daily(user_id, project_id, &range, branch)
        .await
        .map_err(service_error)?;
    Ok(Json(response))
}

/// GET /api/v1/projects/:project_id/ai
pub async fn ai(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(project_id): Path<Uuid>,
    Query(query): Query<ProjectDetailQuery>,
) -> Result<Json<ProjectAiResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    auth::check_analytics_rate_limit(&state, user_id)?;
    let range = parse_range(&query.start, &query.end, query.timezone.as_deref())?;
    let branch = parse_branch(query.branch.as_deref())?;
    let detail = state
        .project_analytics_service
        .detail(user_id, project_id, &range, branch)
        .await
        .map_err(service_error)?;
    Ok(Json(ProjectAiResponse {
        data_version: detail.data_version,
        data: detail.ai,
        generated_at: detail.generated_at,
        range: detail.range,
        schema_version: detail.schema_version,
    }))
}

fn parse_range(
    start: &str,
    end: &str,
    timezone: Option<&str>,
) -> Result<ResolvedRange, (StatusCode, Json<serde_json::Value>)> {
    ResolvedRange::parse(start, end, timezone).map_err(|error| bad_request(error.to_string()))
}

fn parse_branch(
    value: Option<&str>,
) -> Result<Option<&str>, (StatusCode, Json<serde_json::Value>)> {
    match value.map(str::trim) {
        None | Some("") | Some("all") => Ok(None),
        Some(branch) if branch.len() <= 256 && !branch.contains('\0') => Ok(Some(branch)),
        Some(_) => Err(bad_request("branch must be at most 256 characters")),
    }
}

fn service_error(error: anyhow::Error) -> (StatusCode, Json<serde_json::Value>) {
    let error_text = error.to_string();
    let (status, message) = if error_text == "project not found" {
        (StatusCode::NOT_FOUND, error_text)
    } else if error_text.contains("cursor") {
        (StatusCode::BAD_REQUEST, error_text)
    } else {
        tracing::error!(error = %error, "project analytics request failed");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Project analytics request failed".to_string(),
        )
    };
    (status, Json(serde_json::json!({ "error": message })))
}

fn bad_request(message: impl ToString) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::BAD_REQUEST,
        Json(serde_json::json!({ "error": message.to_string() })),
    )
}
