use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::all_time::{AllTimeResponse, WakaTimeAllTimeFields, WakaTimeAllTimeRange};
use crate::model::date_range::ResolvedRange;
use crate::model::summary::{hours_minutes, rfc3339, wakatime_day_text, wakatime_decimal};

#[derive(Debug, Deserialize)]
pub struct AllTimeQuery {
    pub timezone: Option<String>,
}

pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<AllTimeQuery>,
) -> Result<Json<AllTimeResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::require_scoped_user(&state, &headers, "read_stats").await?;

    let mut response = state
        .all_time_service
        .get_in_timezone(user_id, params.timezone.as_deref())
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;
    let timeout_seconds = state
        .activity_timeline_service
        .bridge_config()
        .idle_timeout_seconds;
    response.data.wakatime = Some(
        wakatime_fields(&response, params.timezone.as_deref(), timeout_seconds)
            .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error))?,
    );

    Ok(Json(response))
}

/// WakaTime's range runs from the first local day with activity through today, so it
/// is unbounded (an account can be older than the 366-day cap of ordinary ranges).
fn wakatime_fields(
    response: &AllTimeResponse,
    timezone: Option<&str>,
    timeout_seconds: f64,
) -> Result<WakaTimeAllTimeFields, String> {
    let data = &response.data;
    let today = ResolvedRange::today_date_string(timezone).map_err(|error| error.to_string())?;
    let start_date = data.since.clone().unwrap_or_else(|| today.clone());
    let range = ResolvedRange::parse_unbounded(&start_date, &today, timezone)
        .map_err(|error| error.to_string())?;
    let (start, end) = range.unix_bounds();
    let (hours, minutes) = hours_minutes(data.total_seconds);
    Ok(WakaTimeAllTimeFields {
        decimal: wakatime_decimal(data.total_seconds),
        digital: format!("{hours}:{minutes:02}"),
        daily_average: if data.days_with_activity > 0 {
            data.total_seconds / data.days_with_activity as f64
        } else {
            0.0
        },
        is_up_to_date: true,
        percent_calculated: 100,
        range: WakaTimeAllTimeRange {
            start: rfc3339(start),
            start_date,
            start_text: wakatime_day_text(range.start),
            end: rfc3339(end - 1.0),
            end_date: today,
            end_text: "Today".to_string(),
            timezone: range.timezone.to_string(),
        },
        timeout: (timeout_seconds / 60.0).round() as u64,
    })
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
