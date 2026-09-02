use axum::{
    extract::{Json, State},
    http::{HeaderMap, StatusCode},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::date_range::ResolvedRange;
use crate::services::activity_timeline::{canonicalize_bridged, total_seconds};

#[derive(Debug, Deserialize)]
pub struct RepairDayRequest {
    pub date: String,
    pub timezone: Option<String>,
    #[serde(default)]
    pub apply: bool,
}

#[derive(Debug, Serialize)]
pub struct RepairDayResponse {
    pub date: String,
    pub timezone: String,
    pub before_seconds: f64,
    pub after_seconds: f64,
    pub duplicate_heartbeats: u64,
    pub overlap_seconds: f64,
    pub long_gap_seconds: f64,
    pub revision_id: Option<Uuid>,
    pub applied: bool,
    pub dry_run: bool,
}

#[derive(Debug, clickhouse::Row, serde::Deserialize)]
struct RawRepairStats {
    count: u64,
    unique_heartbeats: u64,
    before_seconds: f64,
    long_gap_seconds: f64,
}

pub async fn day(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<RepairDayRequest>,
) -> Result<Json<RepairDayResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    let date = if request.date.eq_ignore_ascii_case("today") {
        ResolvedRange::today_date_string(request.timezone.as_deref())
            .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?
    } else {
        request.date.clone()
    };
    let range = ResolvedRange::parse(&date, &date, request.timezone.as_deref())
        .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?;
    let (start, end) = range.unix_bounds();
    let raw = state
        .activity_timeline_service
        .intervals(user_id, start, end)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;
    let canonical = canonicalize_bridged(&raw, state.activity_timeline_service.bridge_config());
    let after_seconds = total_seconds(&canonical);
    let raw_seconds: f64 = raw
        .iter()
        .map(|interval| interval.end - interval.start)
        .sum();
    let stats = state
        .clickhouse
        .get_client()
        .query(
            "SELECT count() AS count,
                    uniqExact(ifNull(heartbeat_id, concat(entity, ':', toString(time)))) AS unique_heartbeats,
                    coalesce(sum(ifNull(active_seconds, 0.0)), 0.0) AS before_seconds,
                    coalesce(sumIf(ifNull(active_seconds, 0.0), active_seconds > 120.0), 0.0) AS long_gap_seconds
             FROM wakaclock.heartbeats WHERE user_id = ? AND time >= ? AND time < ?",
        )
        .bind(user_id)
        .bind(start)
        .bind(end)
        .fetch_one::<RawRepairStats>()
        .await
        .unwrap_or(RawRepairStats {
            count: 0,
            unique_heartbeats: 0,
            before_seconds: raw_seconds,
            long_gap_seconds: 0.0,
        });

    let revision_id = if request.apply {
        let revision_id = Uuid::new_v4();
        state
            .clickhouse
            .get_client()
            .query(
                "CREATE TABLE IF NOT EXISTS wakaclock.canonical_day_revisions (
                    revision_id UUID, user_id UUID, date Date, timezone String,
                    total_seconds Float64, intervals String, created_at DateTime
                 ) ENGINE = ReplacingMergeTree(created_at)
                 ORDER BY (user_id, date, revision_id)",
            )
            .execute()
            .await
            .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;
        let intervals = serde_json::to_string(&canonical)
            .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;
        state
            .clickhouse
            .get_client()
            .query(
                "INSERT INTO wakaclock.canonical_day_revisions
                 (revision_id, user_id, date, timezone, total_seconds, intervals, created_at)
                 VALUES (?, ?, toDate(?), ?, ?, ?, now())",
            )
            .bind(revision_id)
            .bind(user_id)
            .bind(&date)
            .bind(range.timezone.to_string())
            .bind(after_seconds)
            .bind(intervals)
            .execute()
            .await
            .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;
        Some(revision_id)
    } else {
        None
    };

    Ok(Json(RepairDayResponse {
        date,
        timezone: range.timezone.to_string(),
        before_seconds: stats.before_seconds,
        after_seconds,
        duplicate_heartbeats: stats.count.saturating_sub(stats.unique_heartbeats),
        overlap_seconds: (raw_seconds - after_seconds).max(0.0),
        long_gap_seconds: stats.long_gap_seconds,
        revision_id,
        applied: request.apply,
        dry_run: !request.apply,
    }))
}

fn app_error(status: StatusCode, message: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": message })))
}
