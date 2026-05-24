use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::projects::{ProjectItem, ProjectRow, ProjectsResponse};

pub struct ProjectsService {
    clickhouse: Arc<ClickHouseClient>,
}

impl ProjectsService {
    pub fn new(clickhouse: Arc<ClickHouseClient>) -> Self {
        Self { clickhouse }
    }

    pub async fn get_range(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<ProjectsResponse> {
        validate_date(start)?;
        validate_date(end)?;

        let rows = self.fetch_projects(user_id, start, end).await?;

        Ok(ProjectsResponse {
            start: start.to_string(),
            end: end.to_string(),
            data: rows
                .into_iter()
                .map(|row| ProjectItem {
                    name: row.name,
                    total_seconds: row.total_seconds,
                    hours: row.total_seconds / 3600.0,
                    text: format_duration(row.total_seconds),
                    heartbeats: row.heartbeat_count,
                })
                .collect(),
        })
    }

    async fn fetch_projects(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<Vec<ProjectRow>> {
        self.clickhouse
            .get_client()
            .query(
                "
                WITH latest_merges AS (
                    SELECT
                        user_id,
                        source_project,
                        argMax(target_project, updated_at) AS target_project
                    FROM wakaclock.project_merges
                    WHERE user_id = ?
                    GROUP BY user_id, source_project
                )
                SELECT
                    if(
                        empty(ifNull(nullIf(lm.target_project, ''), pd.project)),
                        'Unknown',
                        ifNull(nullIf(lm.target_project, ''), pd.project)
                    ) AS name,
                    sum(pd.total_seconds) AS total_seconds,
                    sum(pd.heartbeat_count) AS heartbeat_count
                FROM wakaclock.project_daily AS pd
                LEFT JOIN latest_merges AS lm
                    ON pd.user_id = lm.user_id
                   AND pd.project = lm.source_project
                WHERE pd.user_id = ?
                  AND pd.date BETWEEN toDate(?) AND toDate(?)
                GROUP BY name
                ORDER BY total_seconds DESC, name ASC
                ",
            )
            .bind(user_id)
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<ProjectRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse projects query error: {error}"))
    }
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
