//! Compose admitted projections; no raw data aggregation or cached numeric releases.
use super::*;
use crate::services::{
    team_comparison::{Report, Request},
    team_insights::TeamError,
};
fn error(e: anyhow::Error) -> ApiError {
    if e.downcast_ref::<crate::services::authorization::AuthorizationDenied>()
        .is_some()
    {
        return ApiError::forbidden("organization or team access denied");
    }
    match e.downcast_ref::<TeamError>() {
        Some(TeamError::Invalid(message)) => ApiError::bad_request(*message),
        Some(TeamError::ProjectionChanged) => ApiError::conflict("comparison changed; reload"),
        _ => ApiError::service_unavailable("weekly comparison unavailable"),
    }
}
pub async fn read(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Query(request): Query<Request>,
) -> Result<(HeaderMap, Json<V2Envelope<Report>>), ApiError> {
    let actor = require_scope(&state, &headers, "read_org_dashboards").await?;
    let report = state
        .team_insights_service
        .weekly_comparison(actor, org, request)
        .await
        .map_err(error)?;
    let timezone = report.baseline.timezone.clone();
    // Serialization is completed before the last current authorization/source check.
    serde_json::to_vec(&report)
        .map_err(|_| ApiError::service_unavailable("comparison unavailable"))?;
    state
        .team_insights_service
        .validate_weekly_comparison(actor, &report)
        .await
        .map_err(error)?;
    let mut cache = HeaderMap::new();
    cache.insert("cache-control", "private, no-store".parse().unwrap());
    Ok((cache, Json(envelope(report, &timezone, None))))
}
