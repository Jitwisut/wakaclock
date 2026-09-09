use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::project_identity::BackfillPreview;

/// GET /api/v1/projects/backfill_preview
///
/// Reports what assigning `project_id` to existing history would do, without writing
/// anything (plan.md 9.19, PR 9.2). The backfill itself is PR 9.9; this exists so the
/// mapping can be inspected against real data before that runs — in particular which
/// project names the merge rules would fold onto a single identity.
///
/// Scoped to the authenticated caller, so it can only ever describe that caller's own
/// projects.
pub async fn backfill_preview(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<BackfillPreview>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_scoped_user(&state, &headers, "read_projects").await?;
    auth::check_analytics_rate_limit(&state, user_id)?;

    let preview = state
        .project_identity_service
        .backfill_dry_run(user_id)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(preview))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
