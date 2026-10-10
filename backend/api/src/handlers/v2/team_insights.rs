//! HTTP adapters share one consent projection for dashboard and export.
use super::*;
use crate::model::team_insights::{
    LinkDecision, LinkRequest, TeamConsent, TeamInsights, TeamWorkItem, WorkLink,
};
use crate::services::team_insights::TeamError;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TeamQuery {
    after: Option<Uuid>,
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
        .receipt_page(
            actor,
            org,
            query.team_id,
            repository,
            item,
            query.after,
            false,
        )
        .await
        .map_err(error)?;
    state
        .team_insights_service
        .validate_response(actor, org, query.team_id, data.generation)
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

async fn final_projection_gate(
    state: &AppState,
    headers: &HeaderMap,
    report: &TeamInsights,
) -> Result<(), ApiError> {
    let actor = require_scope(state, headers, "read_org_dashboards").await?;
    state
        .team_insights_service
        .validate_response(
            actor,
            report.organization_id,
            report.team_id,
            report.generation,
        )
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
    final_projection_gate(&state, &headers, &report).await?;
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
    let mut csv=String::from("start,end,timezone,currency,metric,value,status,coverage,reason,provenance,updated_at,calculation_version,pricing_versions\n");
    let prices = report.merged_pr_cost.pricing_versions.join(";");
    for (name, metric) in [
        (
            "estimated_ai_cost_microusd",
            &report.estimated_ai_cost_microusd,
        ),
        ("merged_pr_cost_microusd", &report.merged_pr_cost_microusd),
        (
            "merged_pr_average_microusd",
            &report.merged_pr_cost.average_microusd,
        ),
        ("merged_pr_with_cost", &report.merged_pr_cost.with_cost),
        (
            "merged_pr_without_cost",
            &report.merged_pr_cost.without_cost,
        ),
        (
            "merged_pr_complete_received_cost",
            &report.merged_pr_cost.complete_prs,
        ),
    ] {
        let fields = [
            report.start.clone(),
            report.end.clone(),
            report.timezone.clone(),
            "USD".into(),
            name.into(),
            metric.value.map(|v| v.to_string()).unwrap_or_default(),
            metric.status.into(),
            metric.coverage.map(|v| v.to_string()).unwrap_or_default(),
            metric.reason.unwrap_or("").into(),
            metric.provenance.into(),
            metric
                .updated_at
                .map(|t| t.to_rfc3339())
                .unwrap_or_default(),
            metric.calculation_version.into(),
            prices.clone(),
        ];
        csv.push_str(
            &fields
                .iter()
                .map(|v| format!("\"{}\"", v.replace('"', "\"\"")))
                .collect::<Vec<_>>()
                .join(","),
        );
        csv.push('\n');
    }
    final_projection_gate(&state, &headers, &report).await?;
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
            .decide_revision(actor, org, link, &request.status, request.expected_revision)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}

pub async fn measurement_health(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
) -> Result<(HeaderMap, Json<V2Envelope<Value>>), ApiError> {
    let actor = require_scope(&state, &headers, "read_org_dashboards").await?;
    let data = state
        .team_insights_service
        .measurement_health(actor, org, &state.delivery_status_service)
        .await
        .map_err(error)?;
    let mut cache = HeaderMap::new();
    cache.insert("cache-control", "private, no-store".parse().unwrap());
    Ok((cache, Json(envelope(data, "UTC", None))))
}

#[derive(Deserialize)]
pub struct HistoryQuery {
    after: Option<Uuid>,
}
pub async fn history(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((org, link)): Path<(Uuid, Uuid)>,
    Query(q): Query<HistoryQuery>,
) -> Result<(HeaderMap, Json<V2Envelope<Value>>), ApiError> {
    let actor = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let mut cache = HeaderMap::new();
    cache.insert("cache-control", "private, no-store".parse().unwrap());
    Ok((
        cache,
        Json(envelope(
            state
                .team_insights_service
                .history(actor, org, link, q.after)
                .await
                .map_err(error)?,
            "UTC",
            None,
        )),
    ))
}
pub async fn replace(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((org, link)): Path<(Uuid, Uuid)>,
    Json(input): Json<crate::model::team_insights::LinkReplacement>,
) -> Result<Json<V2Envelope<WorkLink>>, ApiError> {
    let actor = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    Ok(Json(envelope(
        state
            .team_insights_service
            .replace(actor, org, link, input)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}

pub async fn links_page(
    State(s): State<Arc<AppState>>,
    h: HeaderMap,
    Path(org): Path<Uuid>,
    Query(q): Query<HistoryQuery>,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    let user = auth::require_session_user(&s, &h)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    Ok(Json(envelope(
        s.team_insights_service
            .links_page(user, org, q.after)
            .await
            .map_err(error)?,
        "UTC",
        None,
    )))
}

pub async fn own_receipt(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((org, repository, item)): Path<(Uuid, Uuid, i64)>,
    Query(q): Query<TeamQuery>,
) -> Result<
    (
        HeaderMap,
        Json<V2Envelope<crate::model::team_insights::WorkReceipt>>,
    ),
    ApiError,
> {
    let actor = auth::require_session_user(&state, &headers)
        .await
        .ok_or_else(ApiError::unauthorized)?;
    let data = state
        .team_insights_service
        .receipt_page(actor, org, None, repository, item, q.after, true)
        .await
        .map_err(error)?;
    state
        .team_insights_service
        .validate_own_response(actor, org, data.generation)
        .await
        .map_err(error)?;
    let mut cache = HeaderMap::new();
    cache.insert("cache-control", "private, no-store".parse().unwrap());
    Ok((
        cache,
        Json(envelope(
            data,
            "UTC",
            Some(json!({"sharing":"individual_opt_in_only","scope":"own_usage_only"})),
        )),
    ))
}
