use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use std::sync::Arc;
use uuid::Uuid;

use super::analytics_explorer::{
    bad_request, clean_filter, parse_actor_type, parse_source, ExplorerQuery,
};
use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::date_range::ResolvedRange;
use crate::model::replay::{
    ReplayAiSession, ReplayAiSessionsStatus, ReplayResponse, REPLAY_MAX_RANGE_DAYS,
};
use crate::services::activity_timeline::clipped_session_interval;
use crate::services::analytics_explorer::ExplorerFilters;
use crate::services::replay::build_replay_response;

pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ExplorerQuery>,
) -> Result<Json<ReplayResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_scoped_user(&state, &headers, "read_stats").await?;
    if !state.config.time_machine_enabled {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "time machine is disabled" })),
        ));
    }
    auth::check_analytics_rate_limit(&state, user_id)?;
    let range = ResolvedRange::parse(&query.start, &query.end, query.timezone.as_deref())
        .map_err(|error| bad_request(error.to_string()))?;
    if range.days_included() > REPLAY_MAX_RANGE_DAYS {
        return Err(bad_request(format!(
            "replay range must be at most {REPLAY_MAX_RANGE_DAYS} days"
        )));
    }
    let filters = ExplorerFilters {
        category: clean_filter(query.category, "category")?,
        editor: clean_filter(query.editor, "editor")?,
        language: clean_filter(query.language, "language")?,
        operating_system: clean_filter(query.operating_system, "operating_system")?,
        project_id: query.project_id,
        source: parse_source(query.source)?,
        actor_type: parse_actor_type(query.actor_type)?,
    };
    let (start, end) = range.unix_bounds();
    let timeline = state
        .activity_timeline_service
        .build_timeline(user_id, start, end)
        .await
        .map_err(|error| internal_error("replay timeline request failed", error))?;

    let status = ai_sessions_status(
        filters_active(&filters),
        auth::require_scope(&state, &headers, "read_ai_analytics").await,
    );
    let ai_sessions = if status == ReplayAiSessionsStatus::Available {
        load_ai_sessions(&state, user_id, start, end).await?
    } else {
        Vec::new()
    };

    let response = build_replay_response(&timeline.bridged, &range, &filters, ai_sessions, status)
        .map_err(|_| {
            bad_request("replay range has too much activity; choose a shorter range or a filter")
        })?;
    Ok(Json(response))
}

fn filters_active(filters: &ExplorerFilters) -> bool {
    filters.category.is_some()
        || filters.editor.is_some()
        || filters.language.is_some()
        || filters.operating_system.is_some()
        || filters.project_id.is_some()
        || filters.source.is_some()
        || filters.actor_type.is_some()
}

fn ai_sessions_status(filtered: bool, permitted: bool) -> ReplayAiSessionsStatus {
    if !permitted {
        ReplayAiSessionsStatus::NotPermitted
    } else if filtered {
        ReplayAiSessionsStatus::Filtered
    } else {
        ReplayAiSessionsStatus::Available
    }
}

async fn load_ai_sessions(
    state: &AppState,
    user_id: Uuid,
    start: f64,
    end: f64,
) -> Result<Vec<ReplayAiSession>, (StatusCode, Json<serde_json::Value>)> {
    let rows = state
        .ai_usage_repo
        .session_windows(user_id, start, end)
        .await
        .map_err(|error| internal_error("replay AI session request failed", error))?;
    Ok(rows
        .into_iter()
        .filter_map(|row| {
            let (start, end) = clipped_session_interval(
                row.started_at,
                row.ended_at,
                row.last_event_at,
                start,
                end,
            )?;
            Some(ReplayAiSession {
                start,
                end,
                agent: row.ai_agent,
                model: row.primary_model,
            })
        })
        .collect())
}

fn internal_error(
    context: &'static str,
    error: anyhow::Error,
) -> (StatusCode, Json<serde_json::Value>) {
    tracing::error!(error = %error, "{context}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": "Replay request failed" })),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permission_is_reported_before_the_filter_state() {
        assert_eq!(
            ai_sessions_status(true, false),
            ReplayAiSessionsStatus::NotPermitted
        );
        assert_eq!(
            ai_sessions_status(false, false),
            ReplayAiSessionsStatus::NotPermitted
        );
        assert_eq!(
            ai_sessions_status(true, true),
            ReplayAiSessionsStatus::Filtered
        );
        assert_eq!(
            ai_sessions_status(false, true),
            ReplayAiSessionsStatus::Available
        );
    }

    #[test]
    fn every_filter_counts_as_active() {
        assert!(!filters_active(&ExplorerFilters::default()));
        assert!(filters_active(&ExplorerFilters {
            project_id: Some(Uuid::nil()),
            ..Default::default()
        }));
        assert!(filters_active(&ExplorerFilters {
            operating_system: Some("macOS".to_string()),
            ..Default::default()
        }));
    }
}
