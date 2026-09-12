use anyhow::Result;
use chrono::{Duration, NaiveDate};
use std::collections::BTreeMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::date_range::ResolvedRange;
use crate::model::stats::{AllTimeRangeRow, BestDay, StatsBreakdownItem, StatsData, StatsResponse};
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
                languages: breakdown(&canonical, Dimension::Language),
                projects: breakdown(&canonical, Dimension::Project),
                editors: breakdown(&canonical, Dimension::Editor),
                operating_systems: breakdown(&canonical, Dimension::OperatingSystem),
                categories: breakdown(&canonical, Dimension::Category),
                comparable_seconds: Some(timeline.comparable_seconds),
                ai_measured_seconds: Some(timeline.ai_measured_seconds),
                ai_additional_seconds: Some(timeline.ai_additional_seconds),
                calculation_version: Some(timeline.calculation_version),
                evidence,
            },
        })
    }

    async fn resolve_range(
        &self,
        user_id: Uuid,
        range: &str,
        timezone: Option<&str>,
    ) -> Result<(String, String)> {
        let today = ResolvedRange::today_date_string(timezone)
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let today = NaiveDate::parse_from_str(&today, "%Y-%m-%d")?;

        match range {
            "today" => Ok((fmt_date(today), fmt_date(today))),
            "last_7_days" => Ok((fmt_date(today - Duration::days(6)), fmt_date(today))),
            "last_30_days" => Ok((fmt_date(today - Duration::days(29)), fmt_date(today))),
            "all_time" => {
                let row = self
                    .fetch_all_time_range(user_id, timezone.unwrap_or("UTC"))
                    .await?;
                Ok(match (row.start, row.end) {
                    (Some(start), Some(end)) => (start, end),
                    _ => (fmt_date(today), fmt_date(today)),
                })
            }
            _ => anyhow::bail!(
                "Invalid stats range, expected one of: today, last_7_days, last_30_days, all_time"
            ),
        }
    }

    async fn fetch_all_time_range(&self, user_id: Uuid, timezone: &str) -> Result<AllTimeRangeRow> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    toString(min(toDate(toDateTime(toUInt32(time), ?)))) AS start_day,
                    toString(max(toDate(toDateTime(toUInt32(time), ?)))) AS end_day
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

fn breakdown(intervals: &[CanonicalInterval], dimension: Dimension) -> Vec<StatsBreakdownItem> {
    totals_by(intervals, dimension)
        .into_iter()
        .map(|(name, total_seconds, heartbeats)| StatsBreakdownItem {
            name,
            total_seconds,
            hours: total_seconds / 3600.0,
            text: format_duration(total_seconds),
            heartbeats,
        })
        .collect()
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
