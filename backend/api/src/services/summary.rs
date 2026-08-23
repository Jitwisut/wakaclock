use anyhow::{Context, Result};
use chrono::{NaiveDate, TimeZone, Utc};
use std::collections::BTreeMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::summary::{
    DailyTotalRow, EditorDailyRow, LanguageDailyRow, OsDailyRow, ProjectDailyRow,
    SummariesResponse, SummaryDay, SummaryGrandTotal, SummaryItem,
};
use crate::services::activity_timeline::{canonicalize_bridged, ActivityTimelineService};

pub struct SummaryService {
    clickhouse: Arc<ClickHouseClient>,
    idle_timeout_seconds: f64,
}

impl SummaryService {
    pub fn new(clickhouse: Arc<ClickHouseClient>, idle_timeout_seconds: f64) -> Self {
        Self {
            clickhouse,
            idle_timeout_seconds,
        }
    }

    pub async fn get_range(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<SummariesResponse> {
        validate_date(start)?;
        validate_date(end)?;

        let daily_totals = self.fetch_daily_totals(user_id, start, end).await?;
        let language_rows = self.fetch_languages(user_id, start, end).await?;
        let project_rows = self.fetch_projects(user_id, start, end).await?;
        let editor_rows = self.fetch_editors(user_id, start, end).await?;
        let os_rows = self.fetch_operating_systems(user_id, start, end).await?;

        let mut days = BTreeMap::<String, SummaryDay>::new();

        for row in daily_totals {
            days.insert(
                row.date.clone(),
                SummaryDay {
                    date: row.date,
                    grand_total: SummaryGrandTotal {
                        total_seconds: row.total_seconds,
                        hours: row.total_seconds / 3600.0,
                        text: format_duration(row.total_seconds),
                        heartbeats: row.heartbeat_count,
                    },
                    languages: vec![],
                    projects: vec![],
                    editors: vec![],
                    operating_systems: vec![],
                },
            );
        }

        for row in language_rows {
            if let Some(day) = days.get_mut(&row.date) {
                day.languages.push(summary_item(
                    row.language,
                    row.total_seconds,
                    row.heartbeat_count,
                ));
            }
        }

        for row in project_rows {
            if let Some(day) = days.get_mut(&row.date) {
                day.projects.push(summary_item(
                    row.project,
                    row.total_seconds,
                    row.heartbeat_count,
                ));
            }
        }

        for row in editor_rows {
            if let Some(day) = days.get_mut(&row.date) {
                day.editors.push(summary_item(
                    row.editor,
                    row.total_seconds,
                    row.heartbeat_count,
                ));
            }
        }

        for row in os_rows {
            if let Some(day) = days.get_mut(&row.date) {
                day.operating_systems.push(summary_item(
                    row.os,
                    row.total_seconds,
                    row.heartbeat_count,
                ));
            }
        }

        Ok(SummariesResponse {
            start: start.to_string(),
            end: end.to_string(),
            days: days.into_values().collect(),
        })
    }

    async fn fetch_daily_totals(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<Vec<DailyTotalRow>> {
        let start_date = NaiveDate::parse_from_str(start, "%Y-%m-%d")?;
        let end_date = NaiveDate::parse_from_str(end, "%Y-%m-%d")?;
        let start_epoch = Utc
            .from_utc_datetime(&start_date.and_hms_opt(0, 0, 0).expect("valid midnight"))
            .timestamp() as f64;
        let end_epoch = Utc
            .from_utc_datetime(
                &end_date
                    .succ_opt()
                    .expect("valid end date")
                    .and_hms_opt(0, 0, 0)
                    .expect("valid midnight"),
            )
            .timestamp() as f64;
        let timeline =
            ActivityTimelineService::new(self.clickhouse.clone(), self.idle_timeout_seconds);
        let intervals = timeline.intervals(user_id, start_epoch, end_epoch).await?;
        let canonical = canonicalize_bridged(&intervals, self.idle_timeout_seconds);
        let mut grouped = BTreeMap::<String, DailyTotalRow>::new();
        for interval in canonical {
            let day = Utc
                .timestamp_opt(interval.start.floor() as i64, 0)
                .single()
                .map(|value| value.date_naive().to_string())
                .unwrap_or_else(|| start.to_string());
            let row = grouped.entry(day.clone()).or_insert(DailyTotalRow {
                date: day,
                total_seconds: 0.0,
                heartbeat_count: 0,
            });
            row.total_seconds += interval.end - interval.start;
            row.heartbeat_count += 1;
        }
        Ok(grouped.into_values().collect())
    }

    async fn fetch_languages(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<Vec<LanguageDailyRow>> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    toString(date) AS day,
                    language,
                    sum(total_seconds) AS total_seconds,
                    sum(heartbeat_count) AS heartbeat_count
                FROM wakaclock.language_daily
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                GROUP BY day, language
                ORDER BY day ASC, total_seconds DESC
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<LanguageDailyRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse summaries language_daily query error: {error}")
            })
    }

    async fn fetch_projects(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<Vec<ProjectDailyRow>> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    toString(date) AS day,
                    project,
                    sum(total_seconds) AS total_seconds,
                    sum(heartbeat_count) AS heartbeat_count
                FROM wakaclock.project_daily
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                GROUP BY day, project
                ORDER BY day ASC, total_seconds DESC
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<ProjectDailyRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse summaries project_daily query error: {error}")
            })
    }

    async fn fetch_editors(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<Vec<EditorDailyRow>> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    toString(date) AS day,
                    editor,
                    sum(total_seconds) AS total_seconds,
                    sum(heartbeat_count) AS heartbeat_count
                FROM wakaclock.editor_daily
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                GROUP BY day, editor
                ORDER BY day ASC, total_seconds DESC
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<EditorDailyRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse summaries editor_daily query error: {error}")
            })
    }

    async fn fetch_operating_systems(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<Vec<OsDailyRow>> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    toString(date) AS day,
                    os,
                    sum(total_seconds) AS total_seconds,
                    sum(heartbeat_count) AS heartbeat_count
                FROM wakaclock.os_daily
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                GROUP BY day, os
                ORDER BY day ASC, total_seconds DESC
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<OsDailyRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse summaries os_daily query error: {error}"))
    }
}

fn validate_date(date: &str) -> Result<()> {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .context("Invalid date format, expected YYYY-MM-DD")?;
    Ok(())
}

fn summary_item(name: String, total_seconds: f64, heartbeats: u64) -> SummaryItem {
    SummaryItem {
        name,
        total_seconds,
        hours: total_seconds / 3600.0,
        text: format_duration(total_seconds),
        heartbeats,
    }
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
