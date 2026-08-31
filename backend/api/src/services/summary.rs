use anyhow::{Context, Result};
use chrono::{NaiveDate, TimeZone, Utc};
use std::collections::BTreeMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::summary::{SummariesResponse, SummaryDay, SummaryGrandTotal, SummaryItem};
use crate::services::activity_timeline::{
    heartbeat_count, measured_ai_seconds, totals_by, union_ranges, ActivityTimelineService,
    BridgeConfig, CanonicalInterval, Dimension, EvidenceSplit, Timeline,
};

pub struct SummaryService {
    clickhouse: Arc<ClickHouseClient>,
    bridge: BridgeConfig,
}

impl SummaryService {
    pub fn new(clickhouse: Arc<ClickHouseClient>, bridge: impl Into<BridgeConfig>) -> Self {
        Self {
            clickhouse,
            bridge: bridge.into(),
        }
    }

    /// Every figure in the response comes from one canonical timeline.
    ///
    /// The breakdowns used to be read from `language_daily` / `project_daily` /
    /// `editor_daily` / `os_daily`, which aggregate `sum(active_seconds)` — no union
    /// across overlapping sources, no idle bridging, and not even the 120-second clamp
    /// the timeline applies. The grand total has always come from the timeline, so the
    /// parts of a day could not add up to the day: over 14 days of real data the two
    /// paths reported 4h24m and 13h18m for the same evidence. See
    /// docs/duration-accuracy-audit.md.
    pub async fn get_range(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<SummariesResponse> {
        validate_date(start)?;
        validate_date(end)?;

        let (start_epoch, end_epoch) = utc_bounds(start, end)?;
        let timeline = ActivityTimelineService::new(self.clickhouse.clone(), self.bridge);
        let raw = timeline.intervals(user_id, start_epoch, end_epoch).await?;
        let ai_session_ranges = timeline
            .ai_session_intervals(user_id, start_epoch, end_epoch)
            .await?;

        let timeline = Timeline::build(&raw, self.bridge);
        let measured = timeline.measured.clone();

        // A day owns an interval if the interval starts in it, matching how the daily
        // totals have always been bucketed. An interval that runs past midnight is not
        // split, so it counts wholly towards the day the work began in.
        //
        // The per-day proven figure is apportioned from the range total by each day's
        // share of the reported seconds. Re-sweeping per day would be a second O(n^2)
        // pass, and bridging already makes the days interdependent, so an exact per-day
        // proven number is not recoverable from a per-day slice anyway.
        let mut bridged_by_day: BTreeMap<String, Vec<CanonicalInterval>> = BTreeMap::new();
        for interval in timeline.bridged {
            bridged_by_day
                .entry(utc_day(interval.start, start))
                .or_default()
                .push(interval);
        }
        let range_total: f64 = bridged_by_day
            .values()
            .flatten()
            .map(|interval| interval.end - interval.start)
            .sum();

        let days = bridged_by_day
            .into_iter()
            .map(|(date, intervals)| {
                // The response owns each measured interval's seconds by the day in
                // which the work started, but the additive AI metric is explicitly
                // range-clipped. Clip before taking its union so a segment crossing
                // midnight cannot leak seconds into a neighbouring day.
                let (day_start, day_end) =
                    utc_bounds(&date, &date).expect("summary dates are validated ISO dates");
                let total: f64 = intervals
                    .iter()
                    .map(|interval| interval.end - interval.start)
                    .sum();
                let proven = if range_total > 0.0 {
                    timeline.proven_seconds * (total / range_total)
                } else {
                    0.0
                };
                SummaryDay {
                    grand_total: SummaryGrandTotal {
                        total_seconds: total,
                        hours: total / 3600.0,
                        text: format_duration(total),
                        heartbeats: heartbeat_count(&intervals),
                        evidence: EvidenceSplit::new(proven, &intervals)
                            .with_ai_coding_seconds(measured_ai_seconds(
                                &measured
                                    .iter()
                                    .filter_map(|interval| {
                                        let clipped_start = interval.start.max(day_start);
                                        let clipped_end = interval.end.min(day_end);
                                        (clipped_end > clipped_start).then(|| {
                                            let mut clipped = interval.clone();
                                            clipped.start = clipped_start;
                                            clipped.end = clipped_end;
                                            clipped
                                        })
                                    })
                                    .collect::<Vec<_>>(),
                            ))
                            .with_ai_session_seconds(union_ranges(
                                &ai_session_ranges
                                    .iter()
                                    .filter_map(|(session_start, session_end)| {
                                        let clipped_start = (*session_start).max(day_start);
                                        let clipped_end = (*session_end).min(day_end);
                                        (clipped_end > clipped_start)
                                            .then_some((clipped_start, clipped_end))
                                    })
                                    .collect::<Vec<_>>(),
                            )),
                    },
                    languages: summary_items(&intervals, Dimension::Language),
                    projects: summary_items(&intervals, Dimension::Project),
                    editors: summary_items(&intervals, Dimension::Editor),
                    operating_systems: summary_items(&intervals, Dimension::OperatingSystem),
                    categories: summary_items(&intervals, Dimension::Category),
                    date,
                }
            })
            .collect();

        Ok(SummariesResponse {
            start: start.to_string(),
            end: end.to_string(),
            days,
        })
    }
}

fn summary_items(intervals: &[CanonicalInterval], dimension: Dimension) -> Vec<SummaryItem> {
    totals_by(intervals, dimension)
        .into_iter()
        .map(|(name, total_seconds, heartbeats)| SummaryItem {
            name,
            total_seconds,
            hours: total_seconds / 3600.0,
            text: format_duration(total_seconds),
            heartbeats,
        })
        .collect()
}

/// Inclusive local dates to the UTC epoch window the timeline reads.
fn utc_bounds(start: &str, end: &str) -> Result<(f64, f64)> {
    let start_date = NaiveDate::parse_from_str(start, "%Y-%m-%d")?;
    let end_date = NaiveDate::parse_from_str(end, "%Y-%m-%d")?;
    let start_epoch = Utc
        .from_utc_datetime(&start_date.and_hms_opt(0, 0, 0).expect("valid midnight"))
        .timestamp() as f64;
    let end_epoch = Utc
        .from_utc_datetime(
            &end_date
                .succ_opt()
                .context("end date has no successor")?
                .and_hms_opt(0, 0, 0)
                .expect("valid midnight"),
        )
        .timestamp() as f64;
    Ok((start_epoch, end_epoch))
}

fn utc_day(at: f64, fallback: &str) -> String {
    Utc.timestamp_opt(at.floor() as i64, 0)
        .single()
        .map(|value| value.date_naive().to_string())
        .unwrap_or_else(|| fallback.to_string())
}

fn validate_date(date: &str) -> Result<()> {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .context("Invalid date format, expected YYYY-MM-DD")?;
    Ok(())
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
