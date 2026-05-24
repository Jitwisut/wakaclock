use anyhow::{Context, Result};
use std::collections::BTreeMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::summary::{
    DailyTotalRow, EditorDailyRow, LanguageDailyRow, OsDailyRow, ProjectDailyRow,
    SummariesResponse, SummaryDay, SummaryGrandTotal, SummaryItem,
};

pub struct SummaryService {
    clickhouse: Arc<ClickHouseClient>,
}

impl SummaryService {
    pub fn new(clickhouse: Arc<ClickHouseClient>) -> Self {
        Self { clickhouse }
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
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    toString(date) AS day,
                    sum(total_seconds) AS total_seconds,
                    sum(heartbeat_count) AS heartbeat_count
                FROM wakaclock.daily_totals
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                GROUP BY day
                ORDER BY day ASC
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<DailyTotalRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse summaries daily_totals query error: {error}")
            })
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
