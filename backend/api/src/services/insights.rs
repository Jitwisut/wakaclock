use anyhow::{Context, Result};
use chrono::{Duration, Local, NaiveDate};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::insights::{InsightItem, InsightRow, InsightsAllTimeRangeRow, InsightsResponse};

pub struct InsightsService {
    clickhouse: Arc<ClickHouseClient>,
}

impl InsightsService {
    pub fn new(clickhouse: Arc<ClickHouseClient>) -> Self {
        Self { clickhouse }
    }

    pub async fn get_by_type_and_range(
        &self,
        user_id: Uuid,
        insight_type: &str,
        range: &str,
    ) -> Result<InsightsResponse> {
        let column = map_insight_type(insight_type)?;
        let (start, end) = self.resolve_range(user_id, range).await?;
        let rows = self.fetch_insights(user_id, &start, &end, column).await?;

        Ok(InsightsResponse {
            r#type: insight_type.to_string(),
            range: range.to_string(),
            start,
            end,
            data: rows
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
                "Invalid insights range, expected one of: today, last_7_days, last_30_days, all_time"
            ),
        }
    }

    async fn fetch_all_time_range(&self, user_id: Uuid) -> Result<InsightsAllTimeRangeRow> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    if(count() = 0, NULL, toString(min(date))) AS start_day,
                    if(count() = 0, NULL, toString(max(date))) AS end_day
                FROM wakaclock.insights_agg
                WHERE user_id = ?
                ",
            )
            .bind(user_id)
            .fetch_one::<InsightsAllTimeRangeRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse insights all_time range query error: {error}")
            })
    }

    async fn fetch_insights(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
        column: &'static str,
    ) -> Result<Vec<InsightRow>> {
        let sql = format!(
            "
            SELECT
                if(empty({column}), 'Unknown', {column}) AS name,
                sum(total_seconds) AS total_seconds,
                sum(heartbeat_count) AS heartbeat_count,
                uniqMerge(unique_days) AS days
            FROM wakaclock.insights_agg
            WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
            GROUP BY name
            ORDER BY total_seconds DESC, name ASC
            "
        );

        self.clickhouse
            .get_client()
            .query(&sql)
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<InsightRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse insights query error: {error}"))
    }
}

fn map_insight_type(insight_type: &str) -> Result<&'static str> {
    match insight_type {
        "languages" => Ok("language"),
        "projects" => Ok("project"),
        "editors" => Ok("editor"),
        "operating_systems" => Ok("os"),
        "branches" => Ok("branch"),
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
