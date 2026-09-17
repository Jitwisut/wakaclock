use anyhow::{Context, Result};
use chrono::{Duration, NaiveDate, TimeZone, Utc};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::date_range::ResolvedRange;
use crate::model::insights::{InsightItem, InsightRow, InsightsAllTimeRangeRow, InsightsResponse};
use crate::services::activity_timeline::{ActivityTimelineService, BridgeConfig, Dimension};

pub struct InsightsService {
    clickhouse: Arc<ClickHouseClient>,
    /// Insights used to read `insights_agg`, a `sum(active_seconds)` rollup, so every
    /// figure on this page was a different number from the same day's dashboard total —
    /// no union across overlapping emitters and no idle bridging. It reads the canonical
    /// timeline now, like every other duration surface. See docs/duration-accuracy-audit.md,
    /// Finding 4.
    timeline: ActivityTimelineService,
}

impl InsightsService {
    pub fn new(clickhouse: Arc<ClickHouseClient>, bridge: impl Into<BridgeConfig>) -> Self {
        Self {
            timeline: ActivityTimelineService::new(clickhouse.clone(), bridge),
            clickhouse,
        }
    }

    #[allow(dead_code)]
    pub async fn get_by_type_and_range(
        &self,
        user_id: Uuid,
        insight_type: &str,
        range: &str,
    ) -> Result<InsightsResponse> {
        self.get_by_type_and_range_in_timezone(user_id, insight_type, range, None)
            .await
    }

    pub async fn get_by_type_and_range_in_timezone(
        &self,
        user_id: Uuid,
        insight_type: &str,
        range: &str,
        timezone: Option<&str>,
    ) -> Result<InsightsResponse> {
        let dimension = map_insight_type(insight_type)?;
        let resolved = self.resolve_range(user_id, range, timezone).await?;
        let (start, end) = (resolved.start.to_string(), resolved.end.to_string());
        let result = self.fetch_insights(user_id, &resolved, dimension).await?;

        Ok(InsightsResponse {
            r#type: insight_type.to_string(),
            range: range.to_string(),
            start,
            end,
            data: result
                .rows
                .into_iter()
                .map(|row| InsightItem {
                    name: row.name,
                    total_seconds: row.total_seconds,
                    hours: row.total_seconds / 3600.0,
                    text: format_duration(row.total_seconds),
                    heartbeats: row.heartbeat_count,
                    days: row.days,
                })
                .collect(),
            comparable_seconds: Some(result.comparable_seconds),
            ai_measured_seconds: Some(result.ai_measured_seconds),
            ai_additional_seconds: Some(result.ai_additional_seconds),
            calculation_version: Some(result.calculation_version),
        })
    }

    async fn resolve_range(
        &self,
        user_id: Uuid,
        range: &str,
        timezone: Option<&str>,
    ) -> Result<ResolvedRange> {
        let today = ResolvedRange::today_date_string(timezone)
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let today = NaiveDate::parse_from_str(&today, "%Y-%m-%d")?;

        match range {
            "today" => ResolvedRange::parse(&fmt_date(today), &fmt_date(today), timezone)
                .map_err(|error| anyhow::anyhow!(error.to_string())),
            "last_7_days" => ResolvedRange::parse(
                &fmt_date(today - Duration::days(6)),
                &fmt_date(today),
                timezone,
            )
            .map_err(|error| anyhow::anyhow!(error.to_string())),
            "last_30_days" => ResolvedRange::parse(
                &fmt_date(today - Duration::days(29)),
                &fmt_date(today),
                timezone,
            )
            .map_err(|error| anyhow::anyhow!(error.to_string())),
            "all_time" => {
                let row = self
                    .fetch_all_time_range(user_id, timezone.unwrap_or("UTC"))
                    .await?;
                let (start, end) = match (row.start, row.end) {
                    (Some(start), Some(end)) => (start, end),
                    _ => (fmt_date(today), fmt_date(today)),
                };
                ResolvedRange::parse_unbounded(&start, &end, timezone)
                    .map_err(|error| anyhow::anyhow!(error.to_string()))
            }
            _ => anyhow::bail!(
                "Invalid insights range, expected one of: today, last_7_days, last_30_days, all_time"
            ),
        }
    }

    async fn fetch_all_time_range(
        &self,
        user_id: Uuid,
        timezone: &str,
    ) -> Result<InsightsAllTimeRangeRow> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
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
            .fetch_one::<InsightsAllTimeRangeRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse insights all_time range query error: {error}")
            })
    }

    /// One insight breakdown, built from the canonical timeline.
    ///
    /// `days` is counted from the interval starts rather than from a stored `unique_days`
    /// aggregate, so a day appears exactly when the timeline says work happened on it.
    async fn fetch_insights(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
        dimension: Dimension,
    ) -> Result<InsightsResult> {
        let (start_epoch, end_epoch) = range.unix_bounds();
        let timeline = self
            .timeline
            .build_timeline(user_id, start_epoch, end_epoch)
            .await?;
        let canonical = timeline.bridged;

        let mut grouped: HashMap<String, (f64, HashSet<String>, HashSet<String>)> = HashMap::new();
        for interval in &canonical {
            let entry = grouped.entry(dimension.value_of(interval)).or_default();
            entry.0 += interval.end - interval.start;
            entry.1.insert(interval.heartbeat_id.clone());
            if let Some(day) = local_day(interval.start, range.timezone) {
                entry.2.insert(day);
            }
        }

        let mut rows: Vec<InsightRow> = grouped
            .into_iter()
            .map(|(name, (total_seconds, heartbeats, days))| InsightRow {
                name,
                total_seconds,
                heartbeat_count: heartbeats.len() as u64,
                days: days.len() as u64,
            })
            .collect();
        rows.sort_by(|left, right| {
            right
                .total_seconds
                .partial_cmp(&left.total_seconds)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| left.name.cmp(&right.name))
        });
        Ok(InsightsResult {
            rows,
            comparable_seconds: timeline.comparable_seconds,
            ai_measured_seconds: timeline.ai_measured_seconds,
            ai_additional_seconds: timeline.ai_additional_seconds,
            calculation_version: timeline.calculation_version,
        })
    }
}

struct InsightsResult {
    rows: Vec<InsightRow>,
    comparable_seconds: f64,
    ai_measured_seconds: f64,
    ai_additional_seconds: f64,
    calculation_version: &'static str,
}

fn local_day(epoch: f64, timezone: chrono_tz::Tz) -> Option<String> {
    Utc.timestamp_opt(epoch as i64, 0)
        .single()
        .map(|dt| fmt_date(dt.with_timezone(&timezone).date_naive()))
}

fn map_insight_type(insight_type: &str) -> Result<Dimension> {
    match insight_type {
        "languages" => Ok(Dimension::Language),
        "projects" => Ok(Dimension::Project),
        "editors" => Ok(Dimension::Editor),
        "operating_systems" => Ok(Dimension::OperatingSystem),
        "branches" => Ok(Dimension::Branch),
        _ => anyhow::bail!(
            "Invalid insight type, expected one of: languages, projects, editors, operating_systems, branches"
        ),
    }
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

fn _parse_date(date: &str) -> Result<NaiveDate> {
    NaiveDate::parse_from_str(date, "%Y-%m-%d").context("Invalid date format, expected YYYY-MM-DD")
}
