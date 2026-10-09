use super::*;
use crate::model::team_github::*;

fn error(e: anyhow::Error) -> ApiError {
    if e.downcast_ref::<crate::services::authorization::AuthorizationDenied>()
        .is_some()
    {
        return ApiError::forbidden("organization access denied");
    }
    if let Some(e) = e.downcast_ref::<crate::infrastructure::github::GithubFailure>() {
        return ApiError::service_unavailable(format!(
            "{}; retry after {} seconds",
            e.code, e.retry_seconds
        ));
    }
    if let Some(e) = e.downcast_ref::<GithubInputError>() {
        return ApiError::bad_request(e.0);
    }
    // Never return provider payload, tokens, bound values or detailed SQL errors.
    ApiError::service_unavailable("GitHub operation unavailable; check connection and permissions")
}
async fn actor(state: &AppState, headers: &HeaderMap) -> Result<Uuid, ApiError> {
    auth::require_session_user(state, headers)
        .await
        .ok_or_else(ApiError::unauthorized)
}
pub async fn status(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    let user = actor(&s, &h).await?;
    Ok(Json(envelope(
        s.team_github_service
            .status(user, org)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}
pub async fn start(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    let user = actor(&s, &h).await?;
    Ok(Json(envelope(
        s.team_github_service
            .start(user, org, &session_hash(&h)?)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}
pub async fn callback(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Json(input): Json<GithubCallback>,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    let user = actor(&s, &h).await?;
    Ok(Json(envelope(
        s.team_github_service
            .callback(user, input, &session_hash(&h)?)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}
pub async fn installations(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    let user = actor(&s, &h).await?;
    Ok(Json(envelope(
        s.team_github_service
            .installations(user, org)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}
pub async fn repositories(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Path((org, id)): Path<(Uuid, i64)>,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    let user = actor(&s, &h).await?;
    Ok(Json(envelope(
        s.team_github_service
            .repositories(user, org, id)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}
pub async fn select(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Path(org): Path<Uuid>,
    Json(input): Json<GithubSelection>,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    let user = actor(&s, &h).await?;
    Ok(Json(envelope(
        s.team_github_service
            .select(user, org, input)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}
pub async fn sync(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user = actor(&s, &h).await?;
    s.team_github_service.sync(user, org).await.map_err(error)?;
    Ok(StatusCode::ACCEPTED)
}
pub async fn disconnect(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let user = actor(&s, &h).await?;
    s.team_github_service
        .disconnect(user, org)
        .await
        .map_err(error)?;
    Ok(StatusCode::NO_CONTENT)
}
pub async fn binding(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Path(org): Path<Uuid>,
    Json(input): Json<ProjectBinding>,
) -> Result<StatusCode, ApiError> {
    let user = actor(&s, &h).await?;
    s.team_github_service
        .binding(user, org, input)
        .await
        .map_err(error)?;
    Ok(StatusCode::NO_CONTENT)
}
pub async fn projects(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    let user = actor(&s, &h).await?;
    Ok(Json(envelope(
        s.team_github_service
            .projects(user, org)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}
pub async fn context(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Path(org): Path<Uuid>,
    Json(input): Json<SessionContext>,
) -> Result<StatusCode, ApiError> {
    let user = require_scope(&s, &h, "write_logged_time").await?;
    s.team_github_service
        .context(user, org, input)
        .await
        .map_err(error)?;
    Ok(StatusCode::ACCEPTED)
}
pub async fn suggestions(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    let user = actor(&s, &h).await?;
    Ok(Json(envelope(
        s.team_github_service
            .suggestions(user, org)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}

pub async fn capability(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    require_scope(&s, &h, "write_logged_time").await?;
    Ok(Json(envelope(
        serde_json::json!({"version":1,"enabled":s.config.team_enabled,"stream":"session-context","does_not_enable_consent":true}),
        "UTC",
        None,
    )))
}

pub async fn work_page(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Path(org): Path<Uuid>,
    Query(query): Query<GithubWorkQuery>,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    let user = actor(&s, &h).await?;
    Ok(Json(envelope(
        s.team_github_service
            .work_page(user, org, query)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}

fn session_hash(headers: &HeaderMap) -> Result<String, ApiError> {
    let bearer = headers
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(ApiError::unauthorized)?;
    Ok(crate::services::team_github::hash(bearer))
}
