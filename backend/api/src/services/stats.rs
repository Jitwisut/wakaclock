use anyhow::Result;
use chrono::{Datelike, Duration, Months, NaiveDate};
use std::collections::BTreeMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::date_range::ResolvedRange;
use crate::model::stats::{
    AllTimeRangeRow, BestDay, StatsBreakdownItem, StatsData, StatsResponse, WakaTimeStatsFields,
};
use crate::model::summary::wakatime_text;
use crate::services::activity_timeline::{
    totals_by, union_ranges, ActivityTimelineService, BridgeConfig, CanonicalInterval, Dimension,
};

pub struct StatsService {
    clickhouse: Arc<ClickHouseClient>,
    bridge: BridgeConfig,
}

impl StatsService {
    pub fn new(clickhouse: Arc<ClickHouseClient>, bridge: impl Into<BridgeConfig>) -> Self {
        Self {
            clickhouse,
            bridge: bridge.into(),
        }
    }

    /// One canonical timeline per request, and every figure below derived from it.
    ///
    /// The breakdowns used to come from `language_daily` / `project_daily` /
    /// `editor_daily` / `os_daily` — `sum(active_seconds)` with no union, no idle
    /// bridging and no 120-second clamp — while the total came from the timeline, so
    /// they could not agree. The totals and best-day queries also rebuilt the timeline
    /// once each; now it is built once. See docs/duration-accuracy-audit.md.
    pub async fn get_by_range(&self, user_id: Uuid, range: &str) -> Result<StatsResponse> {
        self.get_by_range_in_timezone(user_id, range, None).await
    }

    pub async fn get_by_range_in_timezone(
        &self,
        user_id: Uuid,
        range: &str,
        timezone: Option<&str>,
    ) -> Result<StatsResponse> {
        let (start, end) = self.resolve_range(user_id, range, timezone).await?;
        let resolved = if range == "all_time" {
            ResolvedRange::parse_unbounded(&start, &end, timezone)
        } else {
            ResolvedRange::parse(&start, &end, timezone)
        }
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let (start_epoch, end_epoch) = resolved.unix_bounds();
        let today = local_today(timezone)?;
        let calculated_at = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);

        let timeline_service = ActivityTimelineService::new(self.clickhouse.clone(), self.bridge);
        let ai_session_ranges = timeline_service
            .ai_session_intervals(user_id, start_epoch, end_epoch)
            .await?;
        let timeline = timeline_service
            .build_timeline(user_id, start_epoch, end_epoch)
            .await?;
        let evidence = timeline
            .evidence()
            .with_ai_session_seconds(union_ranges(&ai_session_ranges));
        let canonical = timeline.bridged.clone();

        let total_seconds: f64 = canonical
            .iter()
            .map(|interval| interval.end - interval.start)
            .sum();
        let mut per_day: BTreeMap<String, f64> = BTreeMap::new();
        for offset in 0..resolved.days_included() {
            let day = resolved.start + Duration::days(offset);
            let day_range = ResolvedRange {
                start: day,
                end: day,
                timezone: resolved.timezone,
            };
            let (day_start, day_end) = day_range.unix_bounds();
            let total = canonical
                .iter()
                .filter_map(|interval| {
                    let start = interval.start.max(day_start);
                    let end = interval.end.min(day_end);
                    (end > start).then_some(end - start)
                })
                .sum();
            per_day.insert(day.to_string(), total);
        }
        let days_with_activity = per_day.values().filter(|seconds| **seconds > 0.0).count() as u64;
        // Ties go to the earlier date, so a repeated request cannot swap the answer.
        let best_day = per_day
            .iter()
            .filter(|(_, seconds)| **seconds > 0.0)
            .max_by(|left, right| left.1.total_cmp(right.1).then_with(|| right.0.cmp(left.0)))
            .map(|(date, seconds)| BestDay {
                date: date.clone(),
                total_seconds: *seconds,
                text: format_duration(*seconds),
            });

        let days_included = resolved.days_included() as u64;
        let daily_average_seconds = if days_with_activity > 0 {
            total_seconds / days_with_activity as f64
        } else {
            0.0
        };

        Ok(StatsResponse {
            range: range.to_string(),
            start,
            end,
            data: StatsData {
                total_seconds,
                hours: total_seconds / 3600.0,
                text: format_duration(total_seconds),
                days_included,
                days_with_activity,
                daily_average_seconds,
                daily_average_text: format_duration(daily_average_seconds),
                best_day,
                languages: breakdown(&canonical, Dimension::Language, total_seconds),
                projects: breakdown(&canonical, Dimension::Project, total_seconds),
                editors: breakdown(&canonical, Dimension::Editor, total_seconds),
                operating_systems: breakdown(&canonical, Dimension::OperatingSystem, total_seconds),
                categories: breakdown(&canonical, Dimension::Category, total_seconds),
                comparable_seconds: Some(timeline.comparable_seconds),
                ai_measured_seconds: Some(timeline.ai_measured_seconds),
                ai_additional_seconds: Some(timeline.ai_additional_seconds),
                calculation_version: Some(timeline.calculation_version),
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
                evidence,
                wakatime: WakaTimeStatsFields {
                    total_seconds_including_other_language: total_seconds,
                    human_readable_total: wakatime_text(total_seconds),
                    human_readable_total_including_other_language: wakatime_text(total_seconds),
                    daily_average: daily_average_seconds,
                    daily_average_including_other_language: daily_average_seconds,
                    human_readable_daily_average: wakatime_text(daily_average_seconds),
                    human_readable_daily_average_including_other_language: wakatime_text(
                        daily_average_seconds,
                    ),
                    machines: breakdown(&canonical, Dimension::Machine, total_seconds),
                    dependencies: Vec::new(),
                    range: range.to_string(),
                    human_readable_range: human_readable_range(range, &resolved),
                    holidays: days_included - days_with_activity,
                    days_including_holidays: days_included,
                    days_minus_holidays: days_with_activity,
                    status: "ok",
                    percent_calculated: 100,
                    is_already_updating: false,
                    is_cached: false,
                    is_coding_activity_visible: true,
                    is_language_usage_visible: true,
                    is_editor_usage_visible: true,
                    is_category_usage_visible: true,
                    is_os_usage_visible: true,
                    is_stuck: false,
                    is_including_today: resolved.end >= today,
                    is_up_to_date: true,
                    start: rfc3339(start_epoch),
                    end: rfc3339(end_epoch - 1.0),
                    timezone: resolved.timezone.to_string(),
                    timeout: (self.bridge.idle_timeout_seconds / 60.0).round() as u64,
                    writes_only: false,
                    user_id,
                    username: None,
                    created_at: calculated_at.clone(),
                    modified_at: calculated_at,
                },
            },
        })
    }

    async fn resolve_range(
        &self,
        user_id: Uuid,
        range: &str,
        timezone: Option<&str>,
    ) -> Result<(String, String)> {
        let today = local_today(timezone)?;

        match range {
            "today" => Ok((fmt_date(today), fmt_date(today))),
            "last_7_days" => Ok((fmt_date(today - Duration::days(6)), fmt_date(today))),
            "last_30_days" => Ok((fmt_date(today - Duration::days(29)), fmt_date(today))),
            "last_6_months" => Ok((
                fmt_date(
                    today
                        .checked_sub_months(Months::new(6))
                        .ok_or_else(|| anyhow::anyhow!("date out of range"))?
                        + Duration::days(1),
                ),
                fmt_date(today),
            )),
            "last_year" => Ok((fmt_date(today - Duration::days(364)), fmt_date(today))),
            "all_time" => {
                let row = self
                    .fetch_all_time_range(user_id, timezone.unwrap_or("UTC"))
                    .await?;
                Ok(match (row.start, row.end) {
                    (Some(start), Some(end)) => (start, end),
                    _ => (fmt_date(today), fmt_date(today)),
                })
            }
            other => calendar_range(other, today).ok_or_else(|| {
                anyhow::anyhow!(
                    "{INVALID_RANGE}, expected one of: today, last_7_days, last_30_days, \
                     last_6_months, last_year, all_time, YYYY or YYYY-MM"
                )
            }),
        }
    }

    async fn fetch_all_time_range(&self, user_id: Uuid, timezone: &str) -> Result<AllTimeRangeRow> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    -- Nullable on purpose: `AllTimeRangeRow` reads `Option<String>`, and a
                    -- plain `String` column made RowBinary decode its length byte as the
                    -- nullable tag (`tag for enum is not valid`) for every user, with or without data.
                    if(count() = 0, NULL,
                        toString(min(toDate(toDateTime(toUInt32(time), ?))))) AS start_day,
                    if(count() = 0, NULL,
                        toString(max(toDate(toDateTime(toUInt32(time), ?))))) AS end_day
                -- Read the span from the heartbeats themselves. A `SummingMergeTree`
                -- rollup survives deletion of its source rows, so an aggregate that has
                -- been repaired or partially cleaned can report an all-time range that
                -- extends past any surviving activity. See docs/duration-accuracy-audit.md,
                -- Finding 5.
                FROM wakaclock.heartbeats_canonical
                WHERE user_id = ?
                ",
            )
            .bind(timezone)
            .bind(timezone)
            .bind(user_id)
            .fetch_one::<AllTimeRangeRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse stats all_time range query error: {error}")
            })
    }
}

/// Prefix of the error the handler maps to 400 rather than 500.
pub const INVALID_RANGE: &str = "Invalid stats range";

fn breakdown(
    intervals: &[CanonicalInterval],
    dimension: Dimension,
    range_total: f64,
) -> Vec<StatsBreakdownItem> {
    totals_by(intervals, dimension)
        .into_iter()
        .map(|(name, total_seconds, heartbeats)| {
            StatsBreakdownItem::new(
                name,
                total_seconds,
                heartbeats,
                range_total,
                format_duration(total_seconds),
            )
        })
        .collect()
}

fn local_today(timezone: Option<&str>) -> Result<NaiveDate> {
    let today = ResolvedRange::today_date_string(timezone)
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    Ok(NaiveDate::parse_from_str(&today, "%Y-%m-%d")?)
}

/// WakaTime's `YYYY` and `YYYY-MM` ranges. The end is clipped to today so days that
/// have not happened yet are not counted as holidays; a range wholly in the future
/// is invalid.
fn calendar_range(range: &str, today: NaiveDate) -> Option<(String, String)> {
    let (start, end) = match range.split_once('-') {
        None if range.len() == 4 => {
            let year = range.parse::<i32>().ok()?;
            (
                NaiveDate::from_ymd_opt(year, 1, 1)?,
                NaiveDate::from_ymd_opt(year, 12, 31)?,
            )
        }
        Some((year, month)) if range.len() == 7 && month.len() == 2 => {
            let start = NaiveDate::from_ymd_opt(year.parse().ok()?, month.parse().ok()?, 1)?;
            (
                start,
                start.checked_add_months(Months::new(1))? - Duration::days(1),
            )
        }
        _ => return None,
    };
    (start <= today).then(|| (fmt_date(start), fmt_date(end.min(today))))
}

fn human_readable_range(range: &str, resolved: &ResolvedRange) -> String {
    match range {
        "today" => "Today".to_string(),
        "last_7_days" => "last 7 days".to_string(),
        "last_30_days" => "last 30 days".to_string(),
        "last_6_months" => "last 6 months".to_string(),
        "last_year" => "last year".to_string(),
        "all_time" => format!("since {}", resolved.start.format("%b %-d %Y")),
        year if year.len() == 4 => year.to_string(),
        _ => format!("{} {}", resolved.start.format("%B"), resolved.start.year()),
    }
}

fn rfc3339(unix: f64) -> String {
    chrono::DateTime::from_timestamp(unix as i64, 0)
        .map(|time| time.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
        .unwrap_or_default()
}

fn fmt_date(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
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

    fn date(value: &str) -> NaiveDate {
        NaiveDate::parse_from_str(value, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn calendar_ranges_cover_wakatime_year_and_month_and_clip_to_today() {
        let today = date("2026-10-02");
        let pair = |range: &str| calendar_range(range, today);
        assert_eq!(
            pair("2025"),
            Some(("2025-01-01".into(), "2025-12-31".into()))
        );
        assert_eq!(
            pair("2026"),
            Some(("2026-01-01".into(), "2026-10-02".into()))
        );
        assert_eq!(
            pair("2026-02"),
            Some(("2026-02-01".into(), "2026-02-28".into()))
        );
        assert_eq!(
            pair("2024-02"),
            Some(("2024-02-01".into(), "2024-02-29".into()))
        );
        assert_eq!(
            pair("2026-10"),
            Some(("2026-10-01".into(), "2026-10-02".into()))
        );
        for invalid in [
            "2027",
            "2026-11",
            "2026-13",
            "2026-1",
            "26",
            "last_week",
            "2026-10-01",
        ] {
            assert_eq!(pair(invalid), None, "{invalid}");
        }
    }

    #[test]
    fn human_readable_ranges_name_the_period() {
        let resolved = |start: &str, end: &str| ResolvedRange::parse(start, end, None).unwrap();
        assert_eq!(
            human_readable_range("all_time", &resolved("2025-09-01", "2026-08-31")),
            "since Sep 1 2025"
        );
        assert_eq!(
            human_readable_range("2025", &resolved("2025-01-01", "2025-12-31")),
            "2025"
        );
        assert_eq!(
            human_readable_range("2025-09", &resolved("2025-09-01", "2025-09-30")),
            "September 2025"
        );
        assert_eq!(
            human_readable_range("last_6_months", &resolved("2026-04-03", "2026-10-02")),
            "last 6 months"
        );
    }

    #[test]
    fn breakdown_items_carry_wakatime_fields_next_to_the_atoaxis_ones() {
        let item = StatsBreakdownItem::new("atlas".into(), 3725.0, 9, 14_900.0, "1h 2m".into());
        assert_eq!(item.percent, 25.0);
        assert_eq!(item.digital, "1:02:05");
        assert_eq!(item.decimal, "1.03");
        assert_eq!((item.minutes, item.seconds), (2, 5));
        // AtoAxis fields are unchanged.
        assert!((item.hours - 3725.0 / 3600.0).abs() < 1e-12);
        assert_eq!(item.text, "1h 2m");
        assert_eq!(item.heartbeats, 9);
        assert_eq!(
            StatsBreakdownItem::new("x".into(), 5.0, 1, 0.0, "0m".into()).percent,
            0.0
        );
    }
    use crate::repository::heartbeat::HeartbeatRepository;

    #[tokio::test]
    #[ignore = "requires an isolated ClickHouse 24.10 instance via CLICKHOUSE_TEST_URL"]
    async fn all_time_range_decodes_for_users_with_and_without_activity() {
        let clickhouse = crate::test_support::clickhouse_client().await;
        HeartbeatRepository::new(clickhouse.clone())
            .migrate()
            .await
            .unwrap();
        let service = StatsService::new(clickhouse.clone(), 900.0);

        let empty_user = Uuid::new_v4();
        let empty = service
            .fetch_all_time_range(empty_user, "UTC")
            .await
            .expect("a user with no heartbeats decodes");
        assert_eq!((empty.start, empty.end), (None, None));

        let user_id = Uuid::new_v4();
        // 2026-08-01 23:30 UTC and 2026-08-03 00:30 UTC; Bangkok puts both a day later.
        for time in [1_785_627_000.0_f64, 1_785_717_000.0] {
            clickhouse
                .get_client()
                .query(
                    "INSERT INTO wakaclock.heartbeats (user_id, entity, entity_type, time, date, category)
                     VALUES (?, 'src/main.rs', 'file', ?, toDate(toDateTime(toUInt32(?))), 'coding')",
                )
                .bind(user_id)
                .bind(time)
                .bind(time)
                .execute()
                .await
                .unwrap();
        }
        let utc = service.fetch_all_time_range(user_id, "UTC").await.unwrap();
        assert_eq!(utc.start.as_deref(), Some("2026-08-01"));
        assert_eq!(utc.end.as_deref(), Some("2026-08-03"));
        let bangkok = service
            .fetch_all_time_range(user_id, "Asia/Bangkok")
            .await
            .unwrap();
        assert_eq!(bangkok.start.as_deref(), Some("2026-08-02"));
        assert_eq!(bangkok.end.as_deref(), Some("2026-08-03"));
    }
}
