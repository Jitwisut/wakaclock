use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::analytics_explorer::AnalyticsExplorerResponse;
use crate::model::date_range::ResolvedRange;
use crate::services::analytics_explorer::{build_explorer_response, ExplorerFilters};

#[derive(Debug, Deserialize)]
pub struct ExplorerQuery {
    pub category: Option<String>,
    pub editor: Option<String>,
    pub end: String,
    pub language: Option<String>,
    pub operating_system: Option<String>,
    pub project_id: Option<Uuid>,
    pub source: Option<String>,
    pub start: String,
    pub timezone: Option<String>,
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ExplorerQuery>,
) -> Result<Json<AnalyticsExplorerResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    auth::check_analytics_rate_limit(&state, user_id)?;
    let range = ResolvedRange::parse(&query.start, &query.end, query.timezone.as_deref())
        .map_err(|error| bad_request(error.to_string()))?;
    let filters = ExplorerFilters {
        category: clean_filter(query.category, "category")?,
        editor: clean_filter(query.editor, "editor")?,
        language: clean_filter(query.language, "language")?,
        operating_system: clean_filter(query.operating_system, "operating_system")?,
        project_id: query.project_id,
        source: parse_source(query.source)?,
    };
    let (start, end) = range.unix_bounds();
    let intervals = state
        .activity_timeline_service
        .canonical(user_id, start, end)
        .await
        .map_err(|error| {
            tracing::error!(error = %error, "analytics explorer timeline request failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "Analytics explorer request failed" })),
            )
        })?;

    Ok(Json(build_explorer_response(&intervals, &range, &filters)))
}

fn clean_filter(
    value: Option<String>,
    name: &str,
) -> Result<Option<String>, (StatusCode, Json<serde_json::Value>)> {
    let value = value.map(|value| value.trim().to_string());
    match value {
        None => Ok(None),
        Some(value) if value.is_empty() || value.eq_ignore_ascii_case("all") => Ok(None),
        Some(value) if value.len() <= 256 && !value.contains('\0') => Ok(Some(value)),
        Some(_) => Err(bad_request(format!(
            "{name} must be at most 256 characters"
        ))),
    }
}

fn parse_source(
    value: Option<String>,
) -> Result<Option<String>, (StatusCode, Json<serde_json::Value>)> {
    let value = value
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty() && value != "all");
    match value.as_deref() {
        None => Ok(None),
        Some("human" | "editor" | "ai" | "other") => Ok(value),
        Some(_) => Err(bad_request("source must be human, ai, other, or all")),
    }
}

fn bad_request(message: impl ToString) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::BAD_REQUEST,
        Json(serde_json::json!({ "error": message.to_string() })),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn source_filter_rejects_unknown_values() {
        assert!(parse_source(Some("robot".to_string())).is_err());
        assert_eq!(
            parse_source(Some(" HUMAN ".to_string())).unwrap(),
            Some("human".to_string())
        );
        assert_eq!(parse_source(Some("all".to_string())).unwrap(), None);
    }

    #[test]
    fn text_filters_treat_all_as_unfiltered() {
        assert_eq!(
            clean_filter(Some(" all ".to_string()), "language").unwrap(),
            None
        );
        assert_eq!(
            clean_filter(Some(" TypeScript ".to_string()), "language").unwrap(),
            Some("TypeScript".to_string())
        );
    }
}
