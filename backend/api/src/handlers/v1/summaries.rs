use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::summary::SummariesResponse;

#[derive(Debug, Deserialize)]
pub struct SummariesQuery {
    pub start: String,
    pub end: String,
    pub timezone: Option<String>,
    pub timeout: Option<f64>,
    pub writes_only: Option<bool>,
    pub project: Option<String>,
    pub branches: Option<String>,
    pub category: Option<String>,
}

impl SummariesQuery {
    fn validate_overrides(&self) -> Result<(), &'static str> {
        if self.timeout.is_some()
            || self.writes_only == Some(true)
            || self.project.is_some()
            || self.branches.is_some()
            || self.category.is_some()
        {
            Err("Summary overrides are unsupported; inspect calculation metadata for effective settings")
        } else {
            Ok(())
        }
    }
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<SummariesQuery>,
) -> Result<Json<SummariesResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_scoped_user(&state, &headers, "read_summaries").await?;

    params
        .validate_overrides()
        .map_err(|message| app_error(StatusCode::BAD_REQUEST, message))?;

    let response = state
        .summary_service
        .get_range_in_timezone(
            user_id,
            &params.start,
            &params.end,
            params.timezone.as_deref(),
        )
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;

    Ok(Json(response))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}

#[cfg(test)]
mod tests {
    use super::SummariesQuery;
    #[test]
    fn unsupported_filters_cannot_silently_compare_different_activity() {
        let base = serde_json::json!({"start":"2026-09-12", "end":"2026-09-12"});
        let query: SummariesQuery = serde_json::from_value(base.clone()).unwrap();
        assert!(query.validate_overrides().is_ok());
        for (key, value) in [
            ("timeout", serde_json::json!(15)),
            ("writes_only", serde_json::json!(true)),
            ("project", serde_json::json!("project")),
            ("branches", serde_json::json!("main")),
            ("category", serde_json::json!("Coding")),
        ] {
            let mut input = base.clone();
            input[key] = value;
            let query: SummariesQuery = serde_json::from_value(input).unwrap();
            assert!(query.validate_overrides().is_err(), "{key}");
        }
    }
}
