// src/handlers/v1/status_bar.rs
use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::date_range::ResolvedRange;
use crate::services::activity_timeline::{total_seconds, union_ranges};
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
    /// Server-confirmed time. `total_seconds` follows the configured primary mode;
    /// `wakatime_compatible_seconds` remains available for an explicit comparison.
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
    /// Raw strict Active v1 intervals. Unlike `covered_intervals`, these never include
    /// idle-bridge time, so a client can union them with its still-queued intervals
    /// without counting a crash/retry twice.
    #[serde(default)]
    pub active_intervals: Vec<CoveredInterval>,
    #[serde(default)]
    pub last_increment_seconds: Option<f64>,
    #[serde(default)]
    pub last_increment_source: Option<String>,
    #[serde(default)]
    pub discarded_seconds: f64,
    /// Optional duration-v2 metrics. Keep these at the response root for lightweight
    /// clients; the same values also live in `evidence` for richer views.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comparable_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_measured_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_additional_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub calculation_version: Option<&'static str>,
    /// Strict Active v1 metrics. These stay additive so clients can choose Active only
    /// when coverage is measured while older clients keep their legacy field contract.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_human_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_human_only_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_ai_only_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_ai_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_overlap_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub active_coverage: Option<&'static str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wakatime_compatible_seconds: Option<f64>,
    /// How much of `total_seconds` a client actually measured versus how much the idle
    /// bridge inferred, and how much was attended versus agent-produced. On real data
    /// the inferred half is the larger one; nothing used to say so.
    pub evidence: crate::services::activity_timeline::EvidenceSplit,
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
    let user_id = auth::require_scoped_user(&state, &headers, "read_stats").await?;
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
    let ai_session_ranges = state
        .activity_timeline_service
        .ai_session_intervals(user_id, start, end)
        .await
        .unwrap_or_else(|error| {
            tracing::warn!(%error, %user_id, "AI session duration unavailable for status bar");
            Vec::new()
        });
    let result = state
        .clickhouse
        .get_client()
        .query(
            "SELECT uniqExact(ifNull(heartbeat_id, concat(entity, ':', toString(time)))) AS heartbeat_count,
                    maxOrNull(time) AS last_heartbeat_at
             FROM wakaclock.heartbeats_canonical WHERE user_id = ? AND time >= ? AND time < ?",
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
            // about the same day. One sweep produces both the reported total and the
            // proven figure the evidence split needs.
            let timeline = crate::services::activity_timeline::Timeline::build(
                &raw_intervals,
                state.activity_timeline_service.bridge_config(),
            );
            let evidence = timeline
                .evidence()
                .with_ai_session_seconds(union_ranges(&ai_session_ranges));
            let total = timeline
                .primary_seconds(state.activity_timeline_service.bridge_config().primary_mode);
            let canonical = timeline.bridged;
            let wakatime_total = total_seconds(&canonical);
            let covered_intervals = canonical
                .iter()
                .map(|interval| CoveredInterval {
                    segment_id: interval.segment_id.clone(),
                    start: interval.start,
                    end: interval.end,
                    source: interval.source.clone(),
                })
                .collect::<Vec<_>>();
            let active_intervals = raw_intervals
                .iter()
                .filter(|interval| {
                    matches!(interval.source.as_str(), "editor_active_v1" | "ai_tool_v1")
                        && interval.end > interval.start
                })
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
                active_intervals,
                last_increment_seconds: last.map(|interval| interval.end - interval.start),
                last_increment_source: last.map(|interval| interval.source.clone()),
                discarded_seconds: (raw_seconds - total).max(0.0),
                comparable_seconds: evidence.comparable_seconds,
                ai_measured_seconds: evidence.ai_measured_seconds,
                ai_additional_seconds: evidence.ai_additional_seconds,
                calculation_version: evidence.calculation_version,
                active_seconds: Some(timeline.active_seconds),
                active_human_seconds: Some(timeline.active_human_seconds),
                active_human_only_seconds: Some(
                    (timeline.active_human_seconds - timeline.active_overlap_seconds).max(0.0),
                ),
                active_ai_only_seconds: Some(
                    (timeline.active_ai_seconds - timeline.active_overlap_seconds).max(0.0),
                ),
                active_ai_seconds: Some(timeline.active_ai_seconds),
                active_overlap_seconds: Some(timeline.active_overlap_seconds),
                active_coverage: Some(timeline.active_coverage),
                wakatime_compatible_seconds: Some(wakatime_total),
                evidence,
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
            active_intervals: vec![],
            last_increment_seconds: None,
            last_increment_source: None,
            discarded_seconds: 0.0,
            comparable_seconds: None,
            ai_measured_seconds: None,
            ai_additional_seconds: None,
            calculation_version: None,
            active_seconds: None,
            active_human_seconds: None,
            active_human_only_seconds: None,
            active_ai_only_seconds: None,
            active_ai_seconds: None,
            active_overlap_seconds: None,
            active_coverage: None,
            wakatime_compatible_seconds: None,
            evidence: crate::services::activity_timeline::EvidenceSplit::default(),
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
