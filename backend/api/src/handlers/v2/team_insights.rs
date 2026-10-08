//! HTTP adapters share one consent projection for dashboard and export.
use super::*;
use crate::model::team_insights::{
    LinkDecision, LinkRequest, TeamConsent, TeamInsights, TeamWorkItem, WorkLink,
};
use crate::services::team_insights::TeamError;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TeamQuery {
    start: Option<String>,
    end: Option<String>,
    timezone: Option<String>,
    team_id: Option<Uuid>,
}

pub async fn readiness(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    let actor = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    Ok(Json(envelope(
        state
            .team_insights_service
            .readiness(actor, org)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}

pub async fn receipt(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((org, repository, item)): Path<(Uuid, Uuid, i64)>,
    Query(query): Query<TeamQuery>,
) -> Result<
    (
        HeaderMap,
        Json<V2Envelope<crate::model::team_insights::WorkReceipt>>,
    ),
    ApiError,
> {
    let actor = require_scope(&state, &headers, "read_org_dashboards").await?;
    let data = state
        .team_insights_service
        .receipt(actor, org, query.team_id, repository, item)
        .await
        .map_err(error)?;
    let mut cache = HeaderMap::new();
    cache.insert("cache-control", "private, no-store".parse().unwrap());
    Ok((
        cache,
        Json(envelope(
            data,
            "UTC",
            Some(json!({"sharing":"individual_opt_in_only"})),
        )),
    ))
}

fn error(e: anyhow::Error) -> ApiError {
    if e.downcast_ref::<crate::services::authorization::AuthorizationDenied>()
        .is_some()
    {
        return ApiError::forbidden("organization or team access denied");
    }
    match e.downcast_ref::<TeamError>() {
        Some(TeamError::Disabled) => ApiError::service_unavailable("Team is not enabled"),
        Some(TeamError::ProjectionChanged) => ApiError::conflict("sharing changed; retry request"),
        Some(TeamError::Invalid(message)) => ApiError::bad_request(*message),
        Some(TeamError::NotFound) => ApiError::not_found("work link not found"),
        None => ApiError::service_unavailable("Team data unavailable"),
    }
}

pub async fn consent(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<Json<V2Envelope<TeamConsent>>, ApiError> {
    let actor = require_scope(&state, &headers, "read_org_dashboards").await?;
    Ok(Json(envelope(
        state
            .team_insights_service
            .consent(actor, org)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}

async fn projection(
    state: &AppState,
    headers: &HeaderMap,
    org: Uuid,
    query: TeamQuery,
) -> Result<TeamInsights, ApiError> {
    let actor = require_scope(state, headers, "read_org_dashboards").await?;
    let (start, end) = resolve_range(query.start, query.end, query.timezone.as_deref())?;
    let range =
        crate::model::date_range::ResolvedRange::parse(&start, &end, query.timezone.as_deref())
            .map_err(|e| ApiError::bad_request(e.to_string()))?;
    state
        .team_insights_service
        .insights(actor, org, query.team_id, range)
        .await
        .map_err(error)
}

pub async fn insights(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Query(query): Query<TeamQuery>,
) -> Result<(HeaderMap, Json<V2Envelope<TeamInsights>>), ApiError> {
    let report = projection(&state, &headers, org, query).await?;
    let timezone = report.timezone.clone();
    let mut cache = HeaderMap::new();
    cache.insert("cache-control", "private, no-store".parse().unwrap());
    Ok((
        cache,
        Json(envelope(
            report,
            &timezone,
            Some(json!({"projection": "consent_at_read_time"})),
        )),
    ))
}

pub async fn export(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Query(query): Query<TeamQuery>,
) -> Result<axum::response::Response, ApiError> {
    // No independent export SQL and no stored signed download to bypass withdrawal.
    let report = projection(&state, &headers, org, query).await?;
    let metric = report.estimated_ai_cost_microusd;
    let csv = format!("start,end,timezone,currency,estimated_ai_cost_microusd,status,coverage,calculation_version\n{},{},{},USD,{},{},{},{}\n",
        report.start, report.end, report.timezone,
        metric.value.map(|v| v.to_string()).unwrap_or_default(), metric.status,
        metric.coverage.map(|v| v.to_string()).unwrap_or_default(), metric.calculation_version);
    Ok((
        [
            ("content-type", "text/csv; charset=utf-8"),
            ("cache-control", "private, no-store"),
            (
                "content-disposition",
                "attachment; filename=atoaxis-team.csv",
            ),
        ],
        csv,
    )
        .into_response())
}

pub async fn work_items(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Query(query): Query<TeamQuery>,
) -> Result<Json<V2Envelope<Vec<TeamWorkItem>>>, ApiError> {
    let actor = require_scope(&state, &headers, "read_org_dashboards").await?;
    Ok(Json(envelope(
        state
            .team_insights_service
            .work_items(actor, org, query.team_id)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}

pub async fn links(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<Json<V2Envelope<Vec<WorkLink>>>, ApiError> {
    let actor = require_scope(&state, &headers, "read_org_dashboards").await?;
    Ok(Json(envelope(
        state
            .team_insights_service
            .links(actor, org)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}

pub async fn propose(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Json(request): Json<LinkRequest>,
) -> Result<Json<V2Envelope<WorkLink>>, ApiError> {
    let actor = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    Ok(Json(envelope(
        state
            .team_insights_service
            .propose(actor, org, request)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}

pub async fn decide(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((org, link)): Path<(Uuid, Uuid)>,
    Json(request): Json<LinkDecision>,
) -> Result<Json<V2Envelope<WorkLink>>, ApiError> {
    let actor = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    Ok(Json(envelope(
        state
            .team_insights_service
            .decide(actor, org, link, &request.status)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}
