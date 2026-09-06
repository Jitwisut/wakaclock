use anyhow::{Context, Result};
use chrono::{DateTime, Duration, Local, NaiveDate, TimeZone, Utc};
use std::collections::BTreeMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::stats::{AllTimeRangeRow, BestDay, StatsBreakdownItem, StatsData, StatsResponse};
use crate::services::activity_timeline::{
    totals_by, union_ranges, ActivityTimelineService, BridgeConfig, CanonicalInterval, Dimension,
    Timeline,
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
        let (start, end) = self.resolve_range(user_id, range).await?;
        let start_date = parse_date(&start)?;
        let end_date = parse_date(&end)?;

        let timeline = ActivityTimelineService::new(self.clickhouse.clone(), self.bridge);
        let raw = timeline
            .intervals(
                user_id,
                utc_midnight(start_date),
                utc_midnight(end_date.succ_opt().context("end date has no successor")?),
            )
            .await?;
        let ai_session_ranges = timeline
            .ai_session_intervals(
                user_id,
                utc_midnight(start_date),
                utc_midnight(end_date.succ_opt().context("end date has no successor")?),
            )
            .await?;
        let timeline = Timeline::build(&raw, self.bridge);
        let evidence = timeline
            .evidence()
            .with_ai_session_seconds(union_ranges(&ai_session_ranges));
        let canonical = timeline.bridged;

        let total_seconds: f64 = canonical
            .iter()
            .map(|interval| interval.end - interval.start)
            .sum();
        let mut per_day: BTreeMap<String, f64> = BTreeMap::new();
        for interval in &canonical {
            if let Some(timestamp) =
                DateTime::<Utc>::from_timestamp(interval.start.floor() as i64, 0)
            {
                *per_day
                    .entry(timestamp.date_naive().to_string())
                    .or_default() += interval.end - interval.start;
            }
        }
        let days_with_activity = per_day.len() as u64;
        // Ties go to the earlier date, so a repeated request cannot swap the answer.
        let best_day = per_day
            .iter()
            .max_by(|left, right| left.1.total_cmp(right.1).then_with(|| right.0.cmp(left.0)))
            .map(|(date, seconds)| BestDay {
                date: date.clone(),
                total_seconds: *seconds,
                text: format_duration(*seconds),
            });

        let days_included = (end_date - start_date).num_days() as u64 + 1;
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
                evidence,
            },
        })
    }

    async fn resolve_range(&self, user_id: Uuid, range: &str) -> Result<(String, String)> {
        let today = Local::now().date_naive();

        match range {
            "today" => Ok((fmt_date(today), fmt_date(today))),
            "last_7_days" => Ok((fmt_date(today - Duration::days(6)), fmt_date(today))),
            "last_30_days" => Ok((fmt_date(today - Duration::days(29)), fmt_date(today))),
            "all_time" => {
                let row = self.fetch_all_time_range(user_id).await?;
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

    async fn fetch_all_time_range(&self, user_id: Uuid) -> Result<AllTimeRangeRow> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    toString(min(date)) AS start_day,
                    toString(max(date)) AS end_day
                -- Read the span from the heartbeats themselves. A `SummingMergeTree`
                -- rollup survives deletion of its source rows, so an aggregate that has
                -- been repaired or partially cleaned can report an all-time range that
                -- extends past any surviving activity. See docs/duration-accuracy-audit.md,
                -- Finding 5.
                FROM wakaclock.heartbeats_canonical
                WHERE user_id = ?
                ",
            )
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

fn utc_midnight(date: NaiveDate) -> f64 {
    Utc.from_utc_datetime(&date.and_hms_opt(0, 0, 0).expect("valid midnight"))
        .timestamp() as f64
}

fn parse_date(date: &str) -> Result<NaiveDate> {
    NaiveDate::parse_from_str(date, "%Y-%m-%d").context("Invalid date format, expected YYYY-MM-DD")
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
