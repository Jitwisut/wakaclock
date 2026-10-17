use super::*;
use crate::services::{
    team_insights::TeamError,
    team_weekly_summary::{Request, Summary},
};
fn error(e: anyhow::Error) -> ApiError {
    if e.downcast_ref::<crate::services::authorization::AuthorizationDenied>()
        .is_some()
    {
        return ApiError::forbidden("weekly summary scope denied");
    }
    match e.downcast_ref::<TeamError>() {
        Some(TeamError::Invalid(m)) => ApiError::bad_request(*m),
        Some(TeamError::ProjectionChanged) => ApiError::conflict("weekly summary changed; reload"),
        _ => ApiError::service_unavailable("weekly summary unavailable"),
    }
}
pub async fn read(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Query(q): Query<Request>,
) -> Result<(HeaderMap, Json<V2Envelope<Summary>>), ApiError> {
    let actor = require_scope(&s, &headers, "read_org_dashboards").await?;
    let data = s
        .team_insights_service
        .weekly_summary(actor, org, q)
        .await
        .map_err(error)?;
    serde_json::to_vec(&data)
        .map_err(|_| ApiError::service_unavailable("weekly summary unavailable"))?;
    s.team_insights_service
        .validate_weekly_summary(actor, &data)
        .await
        .map_err(error)?;
    let timezone = data.timezone.clone();
    let mut h = HeaderMap::new();
    h.insert("cache-control", "private, no-store".parse().unwrap());
    Ok((h, Json(envelope(data, &timezone, None))))
}
pub async fn export(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Query(q): Query<Request>,
) -> Result<impl IntoResponse, ApiError> {
    let actor = require_scope(&s, &headers, "read_org_dashboards").await?;
    let data = s
        .team_insights_service
        .weekly_summary_export(actor, org, q)
        .await
        .map_err(error)?;
    let csv = crate::services::team_weekly_summary::csv(&data);
    s.team_insights_service
        .validate_weekly_summary(actor, &data)
        .await
        .map_err(error)?;
    Ok((
        [
            ("content-type", "text/csv; charset=utf-8"),
            ("cache-control", "private, no-store"),
            (
                "content-disposition",
                "attachment; filename=atoaxis-team-weekly-summary.csv",
            ),
        ],
        csv,
    ))
}
