//! Dashboard overview analytics (plan.md 9.9).
//!
//! Reads the existing `heartbeats` table directly rather than the Phase 9 projection
//! tables, which do not exist yet. That is a deliberate interim step: every number here
//! is measured from real ingested data, and nothing is reported that the data cannot
//! support — the token, cost, prompt and session figures 9.9 also describes are absent
//! rather than estimated, because they need the Phase 8 usage/session records.

use anyhow::Result;
use chrono::{Datelike, NaiveDate, Utc};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::dashboard_analytics::{
    DailyTotalRow, DashboardAnalyticsResponse, DashboardBreakdowns, DashboardSummary,
    MostActiveDay, NamedTotalRow, DASHBOARD_SCHEMA_VERSION,
};
use crate::model::date_range::ResolvedRange;
use crate::model::metrics::{format_duration, Breakdown, DailyAverages, Metric, PeriodComparison};

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
}

impl DashboardAnalyticsService {
    pub fn new(clickhouse: Arc<ClickHouseClient>) -> Self {
        Self { clickhouse }
    }

    pub async fn overview(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
    ) -> Result<DashboardAnalyticsResponse> {
        let daily = self.daily_totals(user_id, range).await?;

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
        })
    }

    async fn daily_totals(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
    ) -> Result<Vec<DailyTotalRow>> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT toString(date) AS day,
                       toInt64(round(sum(ifNull(active_seconds, 0.0)))) AS total
                FROM wakaclock.heartbeats
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                GROUP BY day
                ORDER BY day ASC
                ",
            )
            .bind(user_id)
            .bind(range.start.to_string())
            .bind(range.end.to_string())
            .fetch_all::<DailyTotalRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse dashboard daily query error: {error}"))
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
        let sql = format!(
            "
            SELECT if(empty({column}), 'Unknown', {column}) AS name,
                   toInt64(round(sum(ifNull(active_seconds, 0.0)))) AS total
            FROM wakaclock.heartbeats
            WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
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
            .bind(range.start.to_string())
            .bind(range.end.to_string())
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
        let rows = self
            .clickhouse
            .get_client()
            .query(
                "
                SELECT if(empty(ifNull(ai_model, '')), 'Unknown', ai_model) AS name,
                       toInt64(sum(ifNull(ai_lines_added, 0) + ifNull(ai_lines_deleted, 0))) AS total
                FROM wakaclock.heartbeats
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?) AND is_ai_generated
                GROUP BY name
                HAVING total > 0
                ORDER BY total DESC, name ASC
                LIMIT 20
                ",
            )
            .bind(user_id)
            .bind(range.start.to_string())
            .bind(range.end.to_string())
            .fetch_all::<NamedTotalRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse dashboard models query error: {error}"))?;

        Ok(Breakdown::new(
            Metric::AiLinesChanged,
            rows.into_iter().map(|row| (row.name, row.total)).collect(),
        ))
    }
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
