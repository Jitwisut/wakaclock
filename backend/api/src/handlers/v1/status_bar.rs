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
use chrono::Datelike;
use clickhouse::Row;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

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
    /// Opaque account identity for client offline-queue ownership: stable across
    /// API-key rotation, different for every account, and not the raw user id. A
    /// client may move queued rows between its own credentials only when both
    /// report the same value from authenticated requests on the same origin.
    pub queue_owner_id: String,
    /// How much of `total_seconds` a client actually measured versus how much the idle
    /// bridge inferred, and how much was attended versus agent-produced. On real data
    /// the inferred half is the larger one; nothing used to say so.
    pub evidence: crate::services::activity_timeline::EvidenceSplit,
    /// WakaTime's status-bar envelope, read by wakatime-cli `--today` and every
    /// WakaTime plugin. Additive: the fields above stay for AtoAxis clients.
    pub data: WakaTimeStatusBarData,
    pub cached_at: String,
}

/// The subset of WakaTime's `statusbar/today` `data` that wakatime-cli parses.
/// `categories` is left empty, which makes the client print `grand_total.text`;
/// the per-dimension lists are empty rather than invented.
#[derive(Debug, Serialize)]
pub struct WakaTimeStatusBarData {
    pub grand_total: WakaTimeGrandTotal,
    pub categories: Vec<serde_json::Value>,
    pub dependencies: Vec<serde_json::Value>,
    pub editors: Vec<serde_json::Value>,
    pub languages: Vec<serde_json::Value>,
    pub machines: Vec<serde_json::Value>,
    pub operating_systems: Vec<serde_json::Value>,
    pub projects: Vec<serde_json::Value>,
    pub range: WakaTimeRange,
}

#[derive(Debug, Serialize)]
pub struct WakaTimeGrandTotal {
    pub decimal: String,
    pub digital: String,
    pub hours: u64,
    pub minutes: u64,
    pub text: String,
    pub total_seconds: f64,
}

#[derive(Debug, Serialize)]
pub struct WakaTimeRange {
    pub date: String,
    pub start: String,
    pub end: String,
    pub text: String,
    pub timezone: String,
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

/// GET /api/v1/status_bar/today (and WakaTime's `/users/current/statusbar/today`)
///
/// wakatime-cli sends the zone in a `Timezone` header rather than `?timezone=`; the
/// query parameter wins when both are present.
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
    let owner_id = queue_owner_id(user_id);
    let requested_timezone = requested_timezone(params.timezone.as_deref(), &headers);
    let date = ResolvedRange::today_date_string(requested_timezone.as_deref())
        .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?;
    let range = ResolvedRange::parse(&date, &date, requested_timezone.as_deref())
        .map_err(|error| app_error(StatusCode::BAD_REQUEST, &error.to_string()))?;
    let (start, end) = range.unix_bounds();
    let timezone = range.timezone.to_string();
    let wakatime_range = wakatime_range(&range, start, end);

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
                queue_owner_id: owner_id,
                evidence,
                data: wakatime_data(total, wakatime_range),
                cached_at: chrono::Utc::now().to_rfc3339(),
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
            queue_owner_id: owner_id,
            evidence: crate::services::activity_timeline::EvidenceSplit::default(),
            data: wakatime_data(0.0, wakatime_range),
            cached_at: chrono::Utc::now().to_rfc3339(),
        }),
    })
}

/// Derived only from the server-resolved `user_id`, never from request input.
/// Deliberately not keyed by `JWT_SECRET`: rotating that secret must not change
/// every account's identity and strand offline queues again.
pub fn queue_owner_id(user_id: Uuid) -> String {
    let digest = Sha256::digest(format!("atoaxis:queue-owner:v1:{user_id}").as_bytes());
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// An explicit `?timezone=` is validated (and may 400). The `Timezone` header is
/// best-effort: an unknown zone falls back to UTC instead of breaking the status bar.
fn requested_timezone(query: Option<&str>, headers: &HeaderMap) -> Option<String> {
    if let Some(query) = query {
        return Some(query.to_string());
    }
    headers
        .get("timezone")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty() && value.parse::<chrono_tz::Tz>().is_ok())
        .map(str::to_string)
}

fn wakatime_range(range: &ResolvedRange, start: f64, end: f64) -> WakaTimeRange {
    let rfc3339 = |unix: f64| {
        chrono::DateTime::from_timestamp(unix as i64, 0)
            .map(|time| time.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
            .unwrap_or_default()
    };
    WakaTimeRange {
        date: range.start.format("%Y-%m-%d").to_string(),
        start: rfc3339(start),
        // WakaTime reports an inclusive end second.
        end: rfc3339(end - 1.0),
        text: format!(
            "{} {}{} {}",
            range.start.format("%a %b"),
            range.start.day(),
            ordinal_suffix(range.start.day()),
            range.start.year()
        ),
        timezone: range.timezone.to_string(),
    }
}

fn ordinal_suffix(day: u32) -> &'static str {
    match (day % 10, day % 100) {
        (_, 11..=13) => "th",
        (1, _) => "st",
        (2, _) => "nd",
        (3, _) => "rd",
        _ => "th",
    }
}

fn wakatime_data(total_seconds: f64, range: WakaTimeRange) -> WakaTimeStatusBarData {
    WakaTimeStatusBarData {
        grand_total: wakatime_grand_total(total_seconds),
        categories: Vec::new(),
        dependencies: Vec::new(),
        editors: Vec::new(),
        languages: Vec::new(),
        machines: Vec::new(),
        operating_systems: Vec::new(),
        projects: Vec::new(),
        range,
    }
}

/// WakaTime's duration formatting: `2 hrs 17 mins`, `1 hr 1 min`, `7 secs`.
fn wakatime_grand_total(total_seconds: f64) -> WakaTimeGrandTotal {
    let whole = total_seconds.max(0.0) as u64;
    let hours = whole / 3600;
    let minutes = (whole % 3600) / 60;
    let plural = |count: u64, unit: &str| {
        if count == 1 {
            format!("1 {unit}")
        } else {
            format!("{count} {unit}s")
        }
    };
    let text = match (hours, minutes) {
        (0, 0) => plural(whole, "sec"),
        (0, minutes) => plural(minutes, "min"),
        (hours, 0) => plural(hours, "hr"),
        (hours, minutes) => format!("{} {}", plural(hours, "hr"), plural(minutes, "min")),
    };
    WakaTimeGrandTotal {
        // WakaTime derives `decimal` from the truncated hours and minutes.
        decimal: format!("{:.2}", hours as f64 + minutes as f64 / 60.0),
        digital: format!("{hours}:{minutes:02}"),
        hours,
        minutes,
        text,
        total_seconds: total_seconds.max(0.0),
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    const WAKATIME_STATUSBAR_FIXTURE: &str =
        include_str!("../../../../../fixtures/wakatime-cli/api_statusbar_today_response.json");

    #[test]
    fn grand_total_uses_wakatime_text_and_integer_units() {
        let cases = [
            (0.0, "0 secs", "0:00", 0, 0),
            (7.1, "7 secs", "0:00", 0, 0),
            (61.0, "1 min", "0:01", 0, 1),
            (3600.0, "1 hr", "1:00", 1, 0),
            (3660.0, "1 hr 1 min", "1:01", 1, 1),
            (8256.598234, "2 hrs 17 mins", "2:17", 2, 17),
        ];
        for (seconds, text, digital, hours, minutes) in cases {
            let total = wakatime_grand_total(seconds);
            assert_eq!(total.text, text, "{seconds}");
            assert_eq!(total.digital, digital, "{seconds}");
            assert_eq!((total.hours, total.minutes), (hours, minutes), "{seconds}");
        }
        assert_eq!(wakatime_grand_total(8256.598234).decimal, "2.28");
        assert_eq!(
            [1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(ordinal_suffix),
            ["st", "nd", "rd", "th", "th", "th", "th", "st", "nd", "rd"]
        );
    }

    #[test]
    fn wakatime_data_has_every_key_the_cli_fixture_has() {
        let fixture: serde_json::Value = serde_json::from_str(WAKATIME_STATUSBAR_FIXTURE).unwrap();
        let range =
            ResolvedRange::parse("2023-01-29", "2023-01-29", Some("America/Sao_Paulo")).unwrap();
        let (start, end) = range.unix_bounds();
        let ours = serde_json::to_value(wakatime_data(
            8256.598234,
            wakatime_range(&range, start, end),
        ))
        .unwrap();

        for key in fixture["data"].as_object().unwrap().keys() {
            assert!(ours.get(key).is_some(), "missing data.{key}");
        }
        for key in fixture["data"]["grand_total"].as_object().unwrap().keys() {
            assert!(
                ours["grand_total"].get(key).is_some(),
                "missing grand_total.{key}"
            );
        }
        // wakatime-cli unmarshals hours/minutes into Go ints: a float would fail.
        assert!(ours["grand_total"]["hours"].is_u64());
        assert!(ours["grand_total"]["minutes"].is_u64());
        assert_eq!(ours["range"], fixture["data"]["range"]);
    }

    #[test]
    fn timezone_header_is_used_only_when_the_query_is_absent_and_valid() {
        let mut headers = HeaderMap::new();
        headers.insert("Timezone", "Asia/Bangkok".parse().unwrap());
        assert_eq!(
            requested_timezone(None, &headers).as_deref(),
            Some("Asia/Bangkok")
        );
        assert_eq!(
            requested_timezone(Some("Europe/Paris"), &headers).as_deref(),
            Some("Europe/Paris")
        );

        headers.insert("Timezone", "Not/AZone".parse().unwrap());
        assert_eq!(requested_timezone(None, &headers), None);
        assert_eq!(requested_timezone(None, &HeaderMap::new()), None);
    }

    #[test]
    fn queue_owner_id_is_stable_per_account_and_distinct_across_accounts() {
        let account = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
        let other = Uuid::parse_str("00000000-0000-0000-0000-000000000002").unwrap();

        // Same account (e.g. before and after an API-key rotation) → same id.
        assert_eq!(queue_owner_id(account), queue_owner_id(account));
        assert_ne!(queue_owner_id(account), queue_owner_id(other));

        let id = queue_owner_id(account);
        assert_eq!(id.len(), 64);
        assert!(id
            .bytes()
            .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f')));
        // Opaque: the raw user id is not exposed.
        assert!(!id.contains(&account.simple().to_string()));
        assert_ne!(id, account.to_string());
    }
}
