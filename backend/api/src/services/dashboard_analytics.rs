//! Dashboard overview analytics (plan.md 9.9).
//!
//! The read path deliberately uses one authoritative raw-fact source per response. The
//! versioned projection tables are built and published by the rebuild path, but the
//! timezone-aware dashboard fallback remains the safe source until a snapshot covering
//! every dashboard dimension is available for the requested IANA timezone. Every number
//! here is measured from real ingested data, and unavailable usage/pricing remains null.

use anyhow::Result;
use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::dashboard_analytics::{
    DailyAttribution, DailyAttributionRow, DailyTotalRow, DashboardAnalyticsResponse,
    DashboardBreakdowns, DashboardCoverage, DashboardEstimatedSpend, DashboardSummary,
    DashboardTokenTotals, DashboardUsageSummary, MostActiveDay, NamedTotalRow, UsageSummaryRow,
    DASHBOARD_SCHEMA_VERSION,
};
use crate::model::date_range::ResolvedRange;
use crate::model::metrics::{format_duration, Breakdown, DailyAverages, Metric, PeriodComparison};
use crate::services::activity_timeline::{canonicalize_bridged, ActivityTimelineService};

/// Weekday order the chart always renders, including days with no activity, so the axis
/// does not reshuffle between requests (plan.md 9.9).
const WEEKDAYS: [&str; 7] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

pub struct DashboardAnalyticsService {
    clickhouse: Arc<ClickHouseClient>,
    idle_timeout_seconds: f64,
}

impl DashboardAnalyticsService {
    pub fn new(clickhouse: Arc<ClickHouseClient>, idle_timeout_seconds: f64) -> Self {
        Self {
            clickhouse,
            idle_timeout_seconds,
        }
    }

    pub async fn overview(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
    ) -> Result<DashboardAnalyticsResponse> {
        let daily = self.daily_totals(user_id, range).await?;
        let daily_attribution = self.daily_attribution(user_id, range).await?;
        let usage = self.usage_summary(user_id, range).await?;

        let previous = range.previous_period();
        let previous_total: i64 = self
            .daily_totals(user_id, &previous)
            .await?
            .iter()
            .map(|row| row.total)
            .sum();
        let current_total: i64 = daily.iter().map(|row| row.total).sum();

        // "Today" only counts when it actually falls inside the requested range —
        // otherwise the card would report a number the rest of the page excludes.
        let today = range.today_in_timezone().to_string();
        let today_seconds = daily
            .iter()
            .find(|row| row.day == today)
            .map(|row| row.total)
            .unwrap_or(0);

        let most_active_day = daily
            .iter()
            .filter(|row| row.total > 0)
            .max_by_key(|row| row.total)
            .map(|row| MostActiveDay {
                date: row.day.clone(),
                total_seconds: row.total,
                text: format_duration(row.total),
            });

        let daily_values: Vec<i64> = daily.iter().map(|row| row.total).collect();

        let (models, editors, languages, operating_systems, machines) = (
            self.model_breakdown(user_id, range).await?,
            self.duration_breakdown(user_id, range, "editor").await?,
            self.duration_breakdown(user_id, range, "language").await?,
            self.duration_breakdown(user_id, range, "operating_system")
                .await?,
            self.duration_breakdown(user_id, range, "machine").await?,
        );

        Ok(DashboardAnalyticsResponse {
            // Reads directly from authoritative raw facts while rebuilds are asynchronous;
            // no snapshot version has been selected for this response.
            data_version: 0,
            daily_attribution: daily_attribution
                .iter()
                .map(|row| DailyAttribution {
                    ai_added: row.ai_added,
                    ai_deleted: row.ai_deleted,
                    date: row.day.clone(),
                    human_added: row.human_added,
                    human_deleted: row.human_deleted,
                    unattributed_added: (row.unknown_attribution_rows == 0)
                        .then_some(row.unattributed_added),
                    unattributed_deleted: (row.unknown_attribution_rows == 0)
                        .then_some(row.unattributed_deleted),
                    unit: "lines",
                })
                .collect(),
            schema_version: DASHBOARD_SCHEMA_VERSION,
            generated_at: Utc::now().to_rfc3339(),
            range: range.info(),
            summary: DashboardSummary {
                today_seconds,
                today_text: format_duration(today_seconds),
                averages: DailyAverages::new(&daily_values, range.days_included()),
                most_active_day,
                previous_period: PeriodComparison::new(current_total, previous_total),
            },
            breakdowns: DashboardBreakdowns {
                models,
                editors,
                languages,
                operating_systems,
                machines,
                weekdays: weekday_breakdown(&daily),
            },
            coverage: DashboardCoverage {
                attribution_percent: attribution_coverage(&daily_attribution),
                cost_percent: usage.as_ref().and_then(|row| {
                    (row.usage_events > 0)
                        .then(|| row.priced_events as f64 * 100.0 / row.usage_events as f64)
                }),
                token_percent: usage.as_ref().and_then(|row| {
                    (row.reported_tokens > 0)
                        .then(|| row.priced_tokens as f64 * 100.0 / row.reported_tokens as f64)
                }),
            },
            usage: usage
                .as_ref()
                .map(usage_response)
                .unwrap_or_else(empty_usage),
        })
    }

    async fn daily_totals(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
    ) -> Result<Vec<DailyTotalRow>> {
        let (start_epoch, end_epoch) = range.unix_bounds();
        let timeline =
            ActivityTimelineService::new(self.clickhouse.clone(), self.idle_timeout_seconds);
        let intervals = timeline.intervals(user_id, start_epoch, end_epoch).await?;
        let canonical = canonicalize_bridged(&intervals, self.idle_timeout_seconds);
        let mut totals = HashMap::<String, i64>::new();
        for interval in canonical {
            let timestamp = DateTime::<Utc>::from_timestamp(interval.start.floor() as i64, 0)
                .unwrap_or_else(Utc::now)
                .with_timezone(&range.timezone);
            let day = timestamp.date_naive().to_string();
            *totals.entry(day).or_default() += (interval.end - interval.start).round() as i64;
        }
        let rows = totals
            .into_iter()
            .map(|(day, total)| DailyTotalRow { day, total })
            .collect::<Vec<_>>();
        Ok(zero_fill_totals(rows, range))
    }

    async fn daily_attribution(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
    ) -> Result<Vec<DailyAttributionRow>> {
        let (start_epoch, end_epoch) = range.unix_bounds();
        self.clickhouse
            .get_client()
            .query(
                "SELECT toString(toDate(toDateTime(toUInt32(time), ?))) AS day,
                        sum(toUInt64(ifNull(ai_lines_added, 0))) AS ai_added,
                        sum(toUInt64(ifNull(ai_lines_deleted, 0))) AS ai_deleted,
                        sum(toUInt64(ifNull(human_lines_added, 0))) AS human_added,
                        sum(toUInt64(ifNull(human_lines_deleted, 0))) AS human_deleted,
                        sum(toUInt64(ifNull(unattributed_lines_added, 0))) AS unattributed_added,
                        sum(toUInt64(ifNull(unattributed_lines_deleted, 0))) AS unattributed_deleted,
                        countIf(isNull(unattributed_lines_added) OR isNull(unattributed_lines_deleted)) AS unknown_attribution_rows
                 FROM wakaclock.heartbeats
                 WHERE user_id = ? AND time >= ? AND time < ?
                 GROUP BY day ORDER BY day ASC",
            )
            .bind(range.timezone.to_string())
            .bind(user_id)
            .bind(start_epoch)
            .bind(end_epoch)
            .fetch_all::<DailyAttributionRow>()
            .await
            .map(|rows| zero_fill_attribution(rows, range))
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse dashboard attribution query error: {error}")
            })
    }

    async fn usage_summary(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
    ) -> Result<Option<UsageSummaryRow>> {
        let (start_epoch, end_epoch) = range.unix_bounds();
        let row = self
            .clickhouse
            .get_client()
            .query(
                "SELECT count() AS usage_events,
                        sum(toUInt64(ifNull(usage.prompt_count, 0))) AS prompts,
                        uniqExact(usage.ai_session_id) AS sessions,
                        sum(toUInt64(ifNull(usage.input_tokens, 0))) AS input_tokens,
                        sum(toUInt64(ifNull(usage.output_tokens, 0))) AS output_tokens,
                        sum(toUInt64(ifNull(usage.cache_read_tokens, 0))) AS cache_read_tokens,
                        sum(toUInt64(ifNull(usage.cache_write_tokens, 0))) AS cache_write_tokens,
                        sum(toUInt64(ifNull(usage.input_tokens, 0) + ifNull(usage.output_tokens, 0)
                            + ifNull(usage.cache_read_tokens, 0) + ifNull(usage.cache_write_tokens, 0))) AS reported_tokens,
                        sumIf(toUInt64(ifNull(usage.input_tokens, 0) + ifNull(usage.output_tokens, 0)
                            + ifNull(usage.cache_read_tokens, 0) + ifNull(usage.cache_write_tokens, 0)),
                              isNotNull(usage.estimated_cost_microusd)) AS priced_tokens,
                        sum(toUInt64(ifNull(usage.estimated_cost_microusd, 0))) AS estimated_cost_microusd,
                        countIf(isNotNull(usage.estimated_cost_microusd)) AS priced_events
                 FROM wakaclock.ai_usage_events AS usage FINAL
                 WHERE usage.user_id = ? AND usage.event_time >= ? AND usage.event_time < ?",
            )
            .bind(user_id)
            .bind(start_epoch.max(0.0) as u32)
            .bind(end_epoch.max(0.0) as u32)
            .fetch_one::<UsageSummaryRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse dashboard usage query error: {error}"))?;

        Ok((row.usage_events > 0).then_some(row))
    }

    /// Duration share for one heartbeat dimension. `column` is never interpolated from
    /// user input — the handler maps a closed set of names onto these calls, matching
    /// how `InsightsService` already guards its dimension selection (plan.md 9.14).
    async fn duration_breakdown(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
        column: &str,
    ) -> Result<Breakdown> {
        let (start_epoch, end_epoch) = range.unix_bounds();
        let name_expression = normalized_dimension(column);
        let sql = format!(
            "
            SELECT {name_expression} AS name,
                   toInt64(round(sum(ifNull(active_seconds, 0.0)))) AS total
            FROM wakaclock.heartbeats
            WHERE user_id = ? AND time >= ? AND time < ?
            GROUP BY name
            HAVING total > 0
            ORDER BY total DESC, name ASC
            LIMIT 20
            "
        );

        let rows = self
            .clickhouse
            .get_client()
            .query(&sql)
            .bind(user_id)
            .bind(start_epoch)
            .bind(end_epoch)
            .fetch_all::<NamedTotalRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse dashboard {column} query error: {error}")
            })?;

        Ok(Breakdown::new(
            Metric::ActiveDuration,
            rows.into_iter().map(|row| (row.name, row.total)).collect(),
        ))
    }

    /// Models are counted in AI lines changed, not seconds: a model does not spend time
    /// in an editor, and reporting it in seconds would invite summing it against the
    /// editor breakdown (plan.md 9.0).
    async fn model_breakdown(&self, user_id: Uuid, range: &ResolvedRange) -> Result<Breakdown> {
        let (start_epoch, end_epoch) = range.unix_bounds();
        let name_expression = normalized_dimension("ai_model");
        let sql = format!(
            "
                SELECT {name_expression} AS name,
                       toInt64(sum(ifNull(ai_lines_added, 0) + ifNull(ai_lines_deleted, 0))) AS total
                FROM wakaclock.heartbeats
                WHERE user_id = ? AND time >= ? AND time < ? AND is_ai_generated
                GROUP BY name
                HAVING total > 0
                ORDER BY total DESC, name ASC
                LIMIT 20
                "
        );
        let rows = self
            .clickhouse
            .get_client()
            .query(&sql)
            .bind(user_id)
            .bind(start_epoch)
            .bind(end_epoch)
            .fetch_all::<NamedTotalRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse dashboard models query error: {error}"))?;

        Ok(Breakdown::new(
            Metric::AiLinesChanged,
            rows.into_iter().map(|row| (row.name, row.total)).collect(),
        ))
    }
}

/// Collapse both NULL and the empty string to a concrete `String` value.
///
/// `if(empty(ifNull(column, '')), 'Unknown', column)` looks equivalent but ClickHouse
/// keeps the result typed as `Nullable(String)` because its final branch is nullable.
/// Decoding that into `NamedTotalRow { name: String }` then fails with "not enough
/// data" as soon as the query returns its first real row. `ifNull(nullIf(...))`
/// deliberately removes the nullable wrapper from the result type.
fn normalized_dimension(column: &str) -> String {
    format!("ifNull(nullIf({column}, ''), 'Unknown')")
}

/// Group daily totals into Monday–Sunday, always emitting all seven days.
///
/// A weekday missing from the response would make the chart's bars shift position
/// between requests, so zero-activity days are kept rather than filtered out.
fn weekday_breakdown(daily: &[DailyTotalRow]) -> Breakdown {
    let mut totals = [0_i64; 7];

    for row in daily {
        if let Ok(date) = NaiveDate::parse_from_str(&row.day, "%Y-%m-%d") {
            // `num_days_from_monday` is 0 for Monday, matching WEEKDAYS' order.
            totals[date.weekday().num_days_from_monday() as usize] += row.total;
        }
    }

    Breakdown::new(
        Metric::ActiveDuration,
        WEEKDAYS
            .iter()
            .zip(totals)
            .map(|(name, total)| ((*name).to_string(), total))
            .collect(),
    )
}

fn attribution_coverage(rows: &[DailyAttributionRow]) -> Option<f64> {
    if rows.iter().any(|row| row.unknown_attribution_rows > 0) {
        return None;
    }
    let observed: u64 = rows
        .iter()
        .map(|row| row.ai_added + row.ai_deleted + row.human_added + row.human_deleted)
        .sum();
    let unattributed: u64 = rows
        .iter()
        .map(|row| row.unattributed_added + row.unattributed_deleted)
        .sum();
    ((observed + unattributed) > 0)
        .then(|| observed as f64 * 100.0 / (observed + unattributed) as f64)
}

fn empty_usage() -> DashboardUsageSummary {
    DashboardUsageSummary {
        prompts: None,
        sessions: None,
        tokens: DashboardTokenTotals {
            input: None,
            output: None,
            cache_read: None,
            cache_write: None,
            total: None,
            coverage_percent: None,
        },
        estimated_spend: DashboardEstimatedSpend {
            amount_microusd: None,
            coverage_percent: None,
            currency: "USD",
        },
    }
}

fn usage_response(row: &UsageSummaryRow) -> DashboardUsageSummary {
    let total = row
        .input_tokens
        .saturating_add(row.output_tokens)
        .saturating_add(row.cache_read_tokens)
        .saturating_add(row.cache_write_tokens);
    DashboardUsageSummary {
        prompts: Some(row.prompts),
        sessions: Some(row.sessions),
        tokens: DashboardTokenTotals {
            input: Some(row.input_tokens),
            output: Some(row.output_tokens),
            cache_read: Some(row.cache_read_tokens),
            cache_write: Some(row.cache_write_tokens),
            total: Some(total),
            coverage_percent: (row.reported_tokens > 0)
                .then(|| row.priced_tokens as f64 * 100.0 / row.reported_tokens as f64),
        },
        estimated_spend: DashboardEstimatedSpend {
            amount_microusd: (row.priced_events > 0).then_some(row.estimated_cost_microusd),
            coverage_percent: (row.usage_events > 0)
                .then(|| row.priced_events as f64 * 100.0 / row.usage_events as f64),
            currency: "USD",
        },
    }
}

fn zero_fill_totals(mut rows: Vec<DailyTotalRow>, range: &ResolvedRange) -> Vec<DailyTotalRow> {
    let values: HashMap<NaiveDate, i64> = rows
        .drain(..)
        .filter_map(|row| {
            NaiveDate::parse_from_str(&row.day, "%Y-%m-%d")
                .ok()
                .map(|day| (day, row.total))
        })
        .collect();
    (0..range.days_included())
        .map(|offset| {
            let day = range.start + Duration::days(offset);
            DailyTotalRow {
                day: day.to_string(),
                total: values.get(&day).copied().unwrap_or(0),
            }
        })
        .collect()
}

fn zero_fill_attribution(
    mut rows: Vec<DailyAttributionRow>,
    range: &ResolvedRange,
) -> Vec<DailyAttributionRow> {
    let values: HashMap<NaiveDate, DailyAttributionRow> = rows
        .drain(..)
        .filter_map(|row| {
            NaiveDate::parse_from_str(&row.day, "%Y-%m-%d")
                .ok()
                .map(|day| (day, row))
        })
        .collect();
    (0..range.days_included())
        .map(|offset| {
            let day = range.start + Duration::days(offset);
            values.get(&day).cloned().unwrap_or(DailyAttributionRow {
                day: day.to_string(),
                ai_added: 0,
                ai_deleted: 0,
                human_added: 0,
                human_deleted: 0,
                unattributed_added: 0,
                unattributed_deleted: 0,
                unknown_attribution_rows: 0,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;

    use crate::model::ai_usage::AiUsageEventRow;
    use crate::repository::ai_usage::AiUsageRepository;

    use super::*;
    use crate::config::DEFAULT_IDLE_TIMEOUT_MINUTES;

    #[test]
    fn nullable_dimensions_are_normalized_to_a_non_nullable_string_expression() {
        assert_eq!(
            normalized_dimension("ai_model"),
            "ifNull(nullIf(ai_model, ''), 'Unknown')"
        );
        assert_eq!(
            normalized_dimension("language"),
            "ifNull(nullIf(language, ''), 'Unknown')"
        );
    }

    fn day(date: &str, total: i64) -> DailyTotalRow {
        DailyTotalRow {
            day: date.to_string(),
            total,
        }
    }

    #[test]
    fn weekday_breakdown_always_returns_seven_days_in_order() {
        let breakdown = weekday_breakdown(&[day("2026-08-13", 3_600)]);

        assert_eq!(breakdown.items.len(), 7);
        assert_eq!(breakdown.items[0].name, "Monday");
        assert_eq!(breakdown.items[6].name, "Sunday");
        // 2026-08-13 is a Thursday.
        assert_eq!(breakdown.items[3].value, 3_600);
    }

    #[test]
    fn weekday_breakdown_sums_repeats_of_the_same_weekday() {
        let breakdown = weekday_breakdown(&[day("2026-08-13", 100), day("2026-08-06", 50)]);
        assert_eq!(breakdown.items[3].value, 150, "both are Thursdays");
    }

    #[test]
    fn weekday_breakdown_ignores_unparseable_dates_without_dropping_the_chart() {
        let breakdown = weekday_breakdown(&[day("not-a-date", 999), day("2026-08-13", 10)]);
        assert_eq!(breakdown.items.len(), 7);
        assert_eq!(breakdown.total, 10);
    }

    #[tokio::test]
    #[ignore = "requires an isolated ClickHouse 24.10 instance via CLICKHOUSE_TEST_URL"]
    async fn usage_summary_handles_reported_and_nullable_tokens_without_nested_aggregates() {
        let clickhouse = crate::test_support::clickhouse_client().await;
        let usage_repo = AiUsageRepository::new(clickhouse.clone());
        usage_repo.migrate().await.unwrap();

        let user_id = Uuid::new_v4();
        let range = ResolvedRange::parse("2026-08-01", "2026-08-01", Some("UTC")).unwrap();
        let service =
            DashboardAnalyticsService::new(clickhouse, DEFAULT_IDLE_TIMEOUT_MINUTES * 60.0);

        assert!(service
            .usage_summary(user_id, &range)
            .await
            .unwrap()
            .is_none());

        let day = NaiveDate::from_ymd_opt(2026, 8, 1).unwrap();
        let unix_day = day
            .signed_duration_since(NaiveDate::from_ymd_opt(1970, 1, 1).unwrap())
            .num_days() as u32;
        usage_repo
            .insert_usage_events(&[
                AiUsageEventRow {
                    user_id,
                    date: unix_day as u16,
                    usage_event_id: "dashboard-regression-priced".to_string(),
                    ai_session_id: "dashboard-session-priced".to_string(),
                    event_time: unix_day * 86_400 + 60,
                    project_id: None,
                    ai_agent: "test".to_string(),
                    ai_provider: Some("test".to_string()),
                    ai_model: Some("test".to_string()),
                    prompt_count: 2,
                    prompt_character_count: Some(16),
                    input_tokens: Some(100),
                    output_tokens: Some(20),
                    cache_read_tokens: Some(10),
                    cache_write_tokens: Some(5),
                    estimated_cost_microusd: Some(123),
                    pricing_version: Some("test".to_string()),
                    token_source: "reported".to_string(),
                    version: 1,
                    received_at: unix_day * 86_400 + 60,
                },
                AiUsageEventRow {
                    user_id,
                    date: unix_day as u16,
                    usage_event_id: "dashboard-regression-unpriced".to_string(),
                    ai_session_id: "dashboard-session-unpriced".to_string(),
                    event_time: unix_day * 86_400 + 120,
                    project_id: None,
                    ai_agent: "test".to_string(),
                    ai_provider: None,
                    ai_model: None,
                    prompt_count: 3,
                    prompt_character_count: None,
                    input_tokens: None,
                    output_tokens: Some(30),
                    cache_read_tokens: None,
                    cache_write_tokens: None,
                    estimated_cost_microusd: None,
                    pricing_version: None,
                    token_source: "reported".to_string(),
                    version: 1,
                    received_at: unix_day * 86_400 + 120,
                },
            ])
            .await
            .unwrap();

        let summary = service
            .usage_summary(user_id, &range)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(summary.usage_events, 2);
        assert_eq!(summary.prompts, 5);
        assert_eq!(summary.sessions, 2);
        assert_eq!(summary.input_tokens, 100);
        assert_eq!(summary.output_tokens, 50);
        assert_eq!(summary.cache_read_tokens, 10);
        assert_eq!(summary.cache_write_tokens, 5);
        assert_eq!(summary.reported_tokens, 165);
        assert_eq!(summary.priced_tokens, 135);
        assert_eq!(summary.estimated_cost_microusd, 123);
        assert_eq!(summary.priced_events, 1);
    }
}
