//! JSON and CSV use one immutable admitted projection and the same final fence.
use super::*;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReportQuery {
    week_start: NaiveDate,
    timezone: String,
    team_id: Option<Uuid>,
}
fn error(e: anyhow::Error) -> ApiError {
    use crate::services::team_insights::TeamError;
    if e.downcast_ref::<crate::services::authorization::AuthorizationDenied>()
        .is_some()
    {
        return ApiError::forbidden("organization or team access denied");
    }
    match e.downcast_ref::<TeamError>() {
        Some(TeamError::Invalid(message)) => ApiError::bad_request(*message),
        Some(TeamError::ProjectionChanged) => ApiError::conflict("report changed; reload"),
        _ => ApiError::service_unavailable("Copilot report unavailable"),
    }
}
async fn projection(
    state: &AppState,
    headers: &HeaderMap,
    org: Uuid,
    query: ReportQuery,
) -> Result<(Uuid, crate::services::copilot_reports::Report), ApiError> {
    let actor = require_scope(state, headers, "read_org_dashboards").await?;
    let report = state
        .team_insights_service
        .copilot_report(actor, org, query.team_id, query.week_start, &query.timezone)
        .await
        .map_err(error)?;
    Ok((actor, report))
}
pub async fn report(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Query(query): Query<ReportQuery>,
) -> Result<
    (
        HeaderMap,
        Json<V2Envelope<crate::services::copilot_reports::Report>>,
    ),
    ApiError,
> {
    let (actor, report) = projection(&state, &headers, org, query).await?;
    let response = Json(envelope(report.clone(), "UTC", None));
    state
        .team_insights_service
        .validate_copilot_response(actor, &report)
        .await
        .map_err(error)?;
    let mut cache = HeaderMap::new();
    cache.insert("cache-control", "private, no-store".parse().unwrap());
    Ok((cache, response))
}
pub async fn export(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Query(query): Query<ReportQuery>,
) -> Result<(HeaderMap, String), ApiError> {
    let (actor, report) = projection(&state, &headers, org, query).await?;
    let csv = crate::services::copilot_reports::csv(&report);
    state
        .team_insights_service
        .validate_copilot_response(actor, &report)
        .await
        .map_err(error)?;
    let mut h = HeaderMap::new();
    h.insert("cache-control", "private, no-store".parse().unwrap());
    h.insert("content-type", "text/csv; charset=utf-8".parse().unwrap());
    h.insert(
        "content-disposition",
        "attachment; filename=atoaxis-copilot-weekly.csv"
            .parse()
            .unwrap(),
    );
    Ok((h, csv))
}
