// src/handlers/v1/status_bar.rs
use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::date_range::ResolvedRange;
use crate::services::activity_timeline::total_seconds;
use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use clickhouse::Row;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Serialize)]
pub struct StatusBarResponse {
    /// Server-confirmed time. `total_seconds` remains for backwards compatibility;
    /// the additive fields let newer clients display queue/buffer state separately.
    pub total_seconds: f64,
    pub confirmed_seconds: f64,
    pub queued_seconds: f64,
    pub buffered_seconds: f64,
    pub human_readable: String,
    pub heartbeat_count: u64,
    pub timezone: String,
    pub last_heartbeat_at: Option<f64>,
    pub agent_health: Option<serde_json::Value>,
    #[serde(default)]
    pub covered_intervals: Vec<CoveredInterval>,
    #[serde(default)]
    pub last_increment_seconds: Option<f64>,
    #[serde(default)]
    pub last_increment_source: Option<String>,
    #[serde(default)]
    pub discarded_seconds: f64,
}

#[derive(Debug, Serialize)]
pub struct CoveredInterval {
    pub segment_id: String,
    pub start: f64,
    pub end: f64,
    pub source: String,
}

#[derive(Row, Deserialize)]
struct TotalsRow {
    heartbeat_count: u64,
    last_heartbeat_at: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct StatusBarQuery {
    pub timezone: Option<String>,
}

/// GET /api/v1/status_bar/today
///
/// Used to aggregate across every account — the `user_id` bind was commented out, so
/// this leaked every tenant's activity into one number the moment there was more than
/// one account. Now scoped to the caller's own authenticated identity, same as every
/// other data endpoint.
pub async fn today(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<StatusBarQuery>,
) -> Result<Json<StatusBarResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    let date = ResolvedRange::today_date_string(params.timezone.as_deref())
        .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?;
    let range = ResolvedRange::parse(&date, &date, params.timezone.as_deref())
        .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?;
    let (start, end) = range.unix_bounds();
    let timezone = range.timezone.to_string();

    let raw_intervals = state
        .activity_timeline_service
        .intervals(user_id, start, end)
        .await;
    let result = state
        .clickhouse
        .get_client()
        .query(
            "SELECT uniqExact(ifNull(heartbeat_id, concat(entity, ':', toString(time)))) AS heartbeat_count,
                    maxOrNull(time) AS last_heartbeat_at
             FROM wakaclock.heartbeats WHERE user_id = ? AND time >= ? AND time < ?",
        )
        .bind(user_id)
        .bind(start)
        .bind(end)
        .fetch_one::<TotalsRow>()
        .await;

    Ok(match result {
        Ok(row) => {
            let raw_intervals = raw_intervals.unwrap_or_default();
            let raw_seconds: f64 = raw_intervals
                .iter()
                .map(|interval| interval.end - interval.start)
                .sum();
            // Bridged here too: the status bar and the dashboard must never disagree
            // about the same day.
            let canonical = crate::services::activity_timeline::canonicalize_bridged(
                &raw_intervals,
                state.activity_timeline_service.idle_timeout_seconds(),
            );
            let total = total_seconds(&canonical);
            let covered_intervals = canonical
                .iter()
                .map(|interval| CoveredInterval {
                    segment_id: interval.segment_id.clone(),
                    start: interval.start,
                    end: interval.end,
                    source: interval.source.clone(),
                })
                .collect::<Vec<_>>();
            let last = canonical.last();
            Json(StatusBarResponse {
                human_readable: format_duration(total),
                total_seconds: total,
                confirmed_seconds: total,
                queued_seconds: 0.0,
                buffered_seconds: 0.0,
                heartbeat_count: row.heartbeat_count,
                timezone: timezone.clone(),
                last_heartbeat_at: row.last_heartbeat_at,
                agent_health: None,
                covered_intervals,
                last_increment_seconds: last.map(|interval| interval.end - interval.start),
                last_increment_source: last.map(|interval| interval.source.clone()),
                discarded_seconds: (raw_seconds - total).max(0.0),
            })
        }
        Err(_) => Json(StatusBarResponse {
            total_seconds: 0.0,
            confirmed_seconds: 0.0,
            queued_seconds: 0.0,
            buffered_seconds: 0.0,
            human_readable: "0m".to_string(),
            heartbeat_count: 0,
            timezone,
            last_heartbeat_at: None,
            agent_health: None,
            covered_intervals: vec![],
            last_increment_seconds: None,
            last_increment_source: None,
            discarded_seconds: 0.0,
        }),
    })
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}

fn format_duration(secs: f64) -> String {
    let total = secs as u64;
    let hours = total / 3600;
    let minutes = (total % 3600) / 60;
    if hours > 0 {
        format!("{}h {}m", hours, minutes)
    } else {
        format!("{}m", minutes)
    }
}
