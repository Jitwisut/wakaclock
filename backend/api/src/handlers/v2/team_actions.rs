use super::*;
use crate::services::{
    team_actions::{Create, Delete, Edit, List},
    team_insights::TeamError,
};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Scope {
    pub team_id: Option<Uuid>,
    pub before_revision: Option<i64>,
}
fn error(e: anyhow::Error) -> ApiError {
    if e.downcast_ref::<crate::services::authorization::AuthorizationDenied>()
        .is_some()
    {
        return ApiError::forbidden("action scope access denied");
    }
    match e.downcast_ref::<TeamError>() {
        Some(TeamError::Invalid(m)) => ApiError::bad_request(*m),
        Some(TeamError::NotFound) => ApiError::not_found("action unavailable"),
        Some(TeamError::ProjectionChanged) => ApiError::conflict("action changed; reload"),
        _ => ApiError::service_unavailable("actions unavailable"),
    }
}
fn response<T: Serialize>(data: T) -> (HeaderMap, Json<V2Envelope<T>>) {
    let mut h = HeaderMap::new();
    h.insert("cache-control", "private, no-store".parse().unwrap());
    (h, Json(envelope(data, "UTC", None)))
}
pub async fn list(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Query(q): Query<List>,
) -> Result<impl IntoResponse, ApiError> {
    let actor = require_scope(&s, &headers, "read_org_dashboards").await?;
    let p = s
        .team_insights_service
        .actions(actor, org, &q)
        .await
        .map_err(error)?;
    serde_json::to_vec(&p).map_err(|_| ApiError::service_unavailable("actions unavailable"))?;
    s.team_insights_service
        .validate_actions(actor, org, q.team_id, &p.proof)
        .await
        .map_err(error)?;
    Ok(response(p))
}
pub async fn create(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(org): Path<Uuid>,
    Json(q): Json<Create>,
) -> Result<impl IntoResponse, ApiError> {
    let actor = require_scope(&s, &headers, "write_logged_time").await?;
    if q.edit.expected_revision != 0 {
        return Err(ApiError::bad_request("new action requires revision 0"));
    }
    Ok(response(
        s.team_insights_service
            .mutate_action(actor, org, q.id, q.team_id, Some(&q.edit), None)
            .await
            .map_err(error)?,
    ))
}
pub async fn update(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((org, id)): Path<(Uuid, Uuid)>,
    Query(scope): Query<Scope>,
    Json(q): Json<Edit>,
) -> Result<impl IntoResponse, ApiError> {
    let actor = require_scope(&s, &headers, "write_logged_time").await?;
    Ok(response(
        s.team_insights_service
            .mutate_action(actor, org, id, scope.team_id, Some(&q), None)
            .await
            .map_err(error)?,
    ))
}
pub async fn delete(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((org, id)): Path<(Uuid, Uuid)>,
    Query(scope): Query<Scope>,
    Json(q): Json<Delete>,
) -> Result<impl IntoResponse, ApiError> {
    let actor = require_scope(&s, &headers, "write_logged_time").await?;
    Ok(response(
        s.team_insights_service
            .mutate_action(actor, org, id, scope.team_id, None, Some(&q))
            .await
            .map_err(error)?,
    ))
}
pub async fn history(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((org, id)): Path<(Uuid, Uuid)>,
    Query(scope): Query<Scope>,
) -> Result<impl IntoResponse, ApiError> {
    let actor = require_scope(&s, &headers, "read_org_dashboards").await?;
    // List supplies one immutable organization/team proof for the final send gate.
    let page = s
        .team_insights_service
        .actions(
            actor,
            org,
            &List {
                team_id: scope.team_id,
                after: None,
                limit: Some(1),
            },
        )
        .await
        .map_err(error)?;
    let history = s
        .team_insights_service
        .action_history(actor, org, id, scope.before_revision)
        .await
        .map_err(error)?;
    if history.changes.iter().any(|a| a.team_id != scope.team_id) {
        return Err(ApiError::forbidden("action scope access denied"));
    }
    serde_json::to_vec(&history)
        .map_err(|_| ApiError::service_unavailable("action history unavailable"))?;
    s.team_insights_service
        .validate_actions(actor, org, scope.team_id, &page.proof)
        .await
        .map_err(error)?;
    Ok(response(history))
}
pub async fn comparison(
    State(s): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((org, id)): Path<(Uuid, Uuid)>,
    Query(scope): Query<Scope>,
) -> Result<impl IntoResponse, ApiError> {
    let actor = require_scope(&s, &headers, "read_org_dashboards").await?;
    let result = s
        .team_insights_service
        .action_comparison(actor, org, id, scope.team_id)
        .await
        .map_err(error)?;
    serde_json::to_vec(&result)
        .map_err(|_| ApiError::service_unavailable("action comparison unavailable"))?;
    s.team_insights_service
        .validate_action_comparison(actor, org, &result)
        .await
        .map_err(error)?;
    Ok(response(result))
}
