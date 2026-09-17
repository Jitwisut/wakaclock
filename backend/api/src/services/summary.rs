use anyhow::Result;
use chrono::Duration;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::date_range::ResolvedRange;
use crate::model::summary::{SummariesResponse, SummaryDay, SummaryGrandTotal, SummaryItem};
use crate::services::activity_timeline::{
    heartbeat_count, measured_ai_seconds, totals_by, union_ranges, ActivityTimelineService,
    BridgeConfig, CanonicalInterval, Dimension, EvidenceSplit,
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
    /// Same legacy response shape, with an explicit IANA timezone for date boundaries.
    /// The optional argument keeps WakaTime-compatible callers on UTC while dashboard
    /// clients can compare a local calendar day without shifting midnight.
    #[allow(dead_code)]
    pub async fn get_range(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<SummariesResponse> {
        self.get_range_in_timezone(user_id, start, end, None).await
    }

    pub async fn get_range_in_timezone(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
        timezone: Option<&str>,
    ) -> Result<SummariesResponse> {
        let range = ResolvedRange::parse(start, end, timezone)
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let timezone_name = range.timezone.to_string();

        let (start_epoch, end_epoch) = range.unix_bounds();
        let timeline_service = ActivityTimelineService::new(self.clickhouse.clone(), self.bridge);
        let ai_session_ranges = timeline_service
            .ai_session_intervals(user_id, start_epoch, end_epoch)
            .await?;
        let timeline = timeline_service
            .build_timeline(user_id, start_epoch, end_epoch)
            .await?;
        let measured = timeline.measured.clone();

        // Clip the canonical union at each local midnight. Grouping an interval wholly
        // by its start timestamp made a session crossing midnight leak into the first
        // day and made a Bangkok comparison disagree with a UTC report by one segment.
        // Clipping the already-built union keeps the daily totals additive without a
        // second bridge sweep.
        let days = (0..range.days_included())
            .map(|offset| range.start + Duration::days(offset))
            .map(|day| {
                let date = day.to_string();
                // The response owns each measured interval's seconds by the day in
                // which the work started, but the additive AI metric is explicitly
                // range-clipped. Clip before taking its union so a segment crossing
                // midnight cannot leak seconds into a neighbouring day.
                let day_range = ResolvedRange::parse(&date, &date, Some(&timezone_name))
                    .expect("summary dates are validated ISO dates");
                let (day_start, day_end) = day_range.unix_bounds();
                let intervals = timeline
                    .bridged
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
                    .collect::<Vec<_>>();
                let total: f64 = intervals
                    .iter()
                    .map(|interval| interval.end - interval.start)
                    .sum();
                let (
                    active_seconds,
                    active_human_seconds,
                    active_ai_seconds,
                    active_overlap_seconds,
                    active_coverage,
                ) = timeline.active_metrics_in_range(day_start, day_end);
                let proven = timeline
                    .measured
                    .iter()
                    .filter_map(|interval| {
                        let clipped_start = interval.start.max(day_start);
                        let clipped_end = interval.end.min(day_end);
                        (clipped_end > clipped_start).then_some((clipped_start, clipped_end))
                    })
                    .collect::<Vec<_>>();
                let proven = union_ranges(&proven);
                let evidence = timeline.add_duration_evidence(
                    EvidenceSplit::new(proven, &intervals)
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
                    day_start,
                    day_end,
                );
                SummaryDay {
                    grand_total: SummaryGrandTotal {
                        total_seconds: total,
                        hours: total / 3600.0,
                        text: format_duration(total),
                        heartbeats: heartbeat_count(&intervals),
                        comparable_seconds: evidence.comparable_seconds,
                        ai_measured_seconds: evidence.ai_measured_seconds,
                        ai_additional_seconds: evidence.ai_additional_seconds,
                        calculation_version: Some(timeline.calculation_version),
                        active_seconds: Some(active_seconds),
                        active_human_seconds: Some(active_human_seconds),
                        active_human_only_seconds: Some(
                            (active_human_seconds - active_overlap_seconds).max(0.0),
                        ),
                        active_ai_only_seconds: Some(
                            (active_ai_seconds - active_overlap_seconds).max(0.0),
                        ),
                        active_ai_seconds: Some(active_ai_seconds),
                        active_overlap_seconds: Some(active_overlap_seconds),
                        active_coverage: Some(active_coverage),
                        evidence,
                    },
                    languages: summary_items(&intervals, Dimension::Language),
                    projects: summary_items(&intervals, Dimension::Project),
                    editors: summary_items(&intervals, Dimension::Editor),
                    operating_systems: summary_items(&intervals, Dimension::OperatingSystem),
                    categories: summary_items(&intervals, Dimension::Category),
                    date,
                }
            })
            .collect::<Vec<_>>();

        Ok(SummariesResponse {
            calculation: crate::model::summary::SummaryCalculation {
                timezone: timezone_name,
                timeout_seconds: self.bridge.idle_timeout_seconds,
                writes_only: false,
                scope: "all_projects_all_categories",
                comparable_metric: "editor_ranges",
                calculation_version: if self.bridge.combined_v2 {
                    "combined_v2"
                } else {
                    "legacy"
                },
            },
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
