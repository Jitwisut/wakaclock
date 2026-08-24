use anyhow::{Context, Result};
use chrono::{DateTime, Duration, Local, NaiveDate, TimeZone, Utc};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::stats::{
    AllTimeRangeRow, BestDay, BestDayRow, BreakdownRow, StatsBreakdownItem, StatsData,
    StatsResponse, TotalsRow,
};
use crate::services::activity_timeline::{canonicalize_bridged, ActivityTimelineService};

pub struct StatsService {
    clickhouse: Arc<ClickHouseClient>,
    idle_timeout_seconds: f64,
}

impl StatsService {
    pub fn new(clickhouse: Arc<ClickHouseClient>, idle_timeout_seconds: f64) -> Self {
        Self {
            clickhouse,
            idle_timeout_seconds,
        }
    }

    pub async fn get_by_range(&self, user_id: Uuid, range: &str) -> Result<StatsResponse> {
        let (start, end) = self.resolve_range(user_id, range).await?;

        let totals = self.fetch_totals(user_id, &start, &end).await?;
        let best_day = self.fetch_best_day(user_id, &start, &end).await?;
        let languages = self
            .fetch_breakdown(user_id, &start, &end, "language_daily", "language")
            .await?;
        let projects = self
            .fetch_breakdown(user_id, &start, &end, "project_daily", "project")
            .await?;
        let editors = self
            .fetch_breakdown(user_id, &start, &end, "editor_daily", "editor")
            .await?;
        let operating_systems = self
            .fetch_breakdown(user_id, &start, &end, "os_daily", "os")
            .await?;

        let start_date = parse_date(&start)?;
        let end_date = parse_date(&end)?;
        let days_included = (end_date - start_date).num_days() as u64 + 1;
        let daily_average_seconds = if totals.days_with_activity > 0 {
            totals.total_seconds / totals.days_with_activity as f64
        } else {
            0.0
        };

        Ok(StatsResponse {
            range: range.to_string(),
            start,
            end,
            data: StatsData {
                total_seconds: totals.total_seconds,
                hours: totals.total_seconds / 3600.0,
                text: format_duration(totals.total_seconds),
                days_included,
                days_with_activity: totals.days_with_activity,
                daily_average_seconds,
                daily_average_text: format_duration(daily_average_seconds),
                best_day: best_day.map(|row| BestDay {
                    date: row.date,
                    total_seconds: row.total_seconds,
                    text: format_duration(row.total_seconds),
                }),
                languages,
                projects,
                editors,
                operating_systems,
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
                FROM wakaclock.daily_totals
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

    async fn fetch_totals(&self, user_id: Uuid, start: &str, end: &str) -> Result<TotalsRow> {
        let start_date = parse_date(start)?;
        let end_date = parse_date(end)?;
        let start_epoch = Utc
            .from_utc_datetime(&start_date.and_hms_opt(0, 0, 0).expect("valid midnight"))
            .timestamp() as f64;
        let end_epoch = Utc
            .from_utc_datetime(
                &end_date
                    .succ_opt()
                    .expect("valid date")
                    .and_hms_opt(0, 0, 0)
                    .expect("valid midnight"),
            )
            .timestamp() as f64;
        let timeline =
            ActivityTimelineService::new(self.clickhouse.clone(), self.idle_timeout_seconds);
        let canonical = canonicalize_bridged(
            &timeline.intervals(user_id, start_epoch, end_epoch).await?,
            self.idle_timeout_seconds,
        );
        let days = canonical
            .iter()
            .filter_map(|interval| {
                DateTime::<Utc>::from_timestamp(interval.start.floor() as i64, 0)
                    .map(|value| value.date_naive())
            })
            .collect::<std::collections::HashSet<_>>();
        Ok(TotalsRow {
            total_seconds: canonical
                .iter()
                .map(|interval| interval.end - interval.start)
                .sum(),
            days_with_activity: days.len() as u64,
        })
    }

    async fn fetch_best_day(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<Option<BestDayRow>> {
        let start_date = parse_date(start)?;
        let end_date = parse_date(end)?;
        let start_epoch = Utc
            .from_utc_datetime(&start_date.and_hms_opt(0, 0, 0).expect("valid midnight"))
            .timestamp() as f64;
        let end_epoch = Utc
            .from_utc_datetime(
                &end_date
                    .succ_opt()
                    .expect("valid date")
                    .and_hms_opt(0, 0, 0)
                    .expect("valid midnight"),
            )
            .timestamp() as f64;
        let timeline =
            ActivityTimelineService::new(self.clickhouse.clone(), self.idle_timeout_seconds);
        let canonical = canonicalize_bridged(
            &timeline.intervals(user_id, start_epoch, end_epoch).await?,
            self.idle_timeout_seconds,
        );
        let mut totals = std::collections::HashMap::<String, f64>::new();
        for interval in canonical {
            if let Some(timestamp) =
                DateTime::<Utc>::from_timestamp(interval.start.floor() as i64, 0)
            {
                *totals
                    .entry(timestamp.date_naive().to_string())
                    .or_default() += interval.end - interval.start;
            }
        }
        Ok(totals
            .into_iter()
            .max_by(|left, right| {
                left.1
                    .total_cmp(&right.1)
                    .then_with(|| right.0.cmp(&left.0))
            })
            .map(|(date, total_seconds)| BestDayRow {
                date,
                total_seconds,
            }))
    }

    async fn fetch_breakdown(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
        table: &str,
        column: &str,
    ) -> Result<Vec<StatsBreakdownItem>> {
        let sql = format!(
            "
            SELECT
                {column} AS name,
                sum(total_seconds) AS total_seconds,
                sum(heartbeat_count) AS heartbeat_count
            FROM wakaclock.{table}
            WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
            GROUP BY name
            ORDER BY total_seconds DESC, name ASC
            "
        );

        let rows = self
            .clickhouse
            .get_client()
            .query(&sql)
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<BreakdownRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse stats {table} breakdown query error: {error}")
            })?;

        Ok(rows
            .into_iter()
            .map(|row| StatsBreakdownItem {
                name: row.name,
                total_seconds: row.total_seconds,
                hours: row.total_seconds / 3600.0,
                text: format_duration(row.total_seconds),
                heartbeats: row.heartbeat_count,
            })
            .collect())
    }
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
