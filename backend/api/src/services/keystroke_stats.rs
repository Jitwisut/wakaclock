use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::keystroke_stats::{
    KeystrokeDailyItem, KeystrokeDailyRow, KeystrokeProjectItem, KeystrokeProjectRow,
    KeystrokeStatsData, KeystrokeStatsResponse, KeystrokeTotalsRow,
};

pub struct KeystrokeStatsService {
    clickhouse: Arc<ClickHouseClient>,
}

impl KeystrokeStatsService {
    pub fn new(clickhouse: Arc<ClickHouseClient>) -> Self {
        Self { clickhouse }
    }

    pub async fn get_range(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<KeystrokeStatsResponse> {
        validate_date(start)?;
        validate_date(end)?;

        let totals = self.fetch_totals(user_id, start, end).await?;
        let projects = self.fetch_projects(user_id, start, end).await?;
        let daily = self.fetch_daily(user_id, start, end).await?;

        Ok(KeystrokeStatsResponse {
            start: start.to_string(),
            end: end.to_string(),
            data: KeystrokeStatsData {
                total_keystrokes: totals.total_keystrokes,
                total_chars_added: totals.total_chars_added,
                total_chars_deleted: totals.total_chars_deleted,
                days_with_activity: totals.days_with_activity,
                projects: projects
                    .into_iter()
                    .map(|row| KeystrokeProjectItem {
                        name: row.name,
                        keystrokes: row.keystrokes,
                        chars_added: row.chars_added,
                        chars_deleted: row.chars_deleted,
                    })
                    .collect(),
                daily: daily
                    .into_iter()
                    .map(|row| KeystrokeDailyItem {
                        date: row.date,
                        keystrokes: row.keystrokes,
                        chars_added: row.chars_added,
                        chars_deleted: row.chars_deleted,
                    })
                    .collect(),
            },
        })
    }

    async fn fetch_totals(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<KeystrokeTotalsRow> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    coalesce(sum(keystrokes), 0) AS total_keystrokes,
                    coalesce(sum(chars_added), 0) AS total_chars_added,
                    coalesce(sum(chars_deleted), 0) AS total_chars_deleted,
                    count(DISTINCT date) AS days_with_activity
                FROM wakaclock.keystroke_daily
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_one::<KeystrokeTotalsRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse keystroke_stats totals query error: {error}")
            })
    }

    async fn fetch_projects(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<Vec<KeystrokeProjectRow>> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    if(empty(project), 'Unknown', project) AS name,
                    sum(keystrokes) AS keystrokes,
                    sum(chars_added) AS chars_added,
                    sum(chars_deleted) AS chars_deleted
                FROM wakaclock.keystroke_daily
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                GROUP BY name
                ORDER BY keystrokes DESC, name ASC
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<KeystrokeProjectRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse keystroke_stats projects query error: {error}")
            })
    }

    async fn fetch_daily(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<Vec<KeystrokeDailyRow>> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    toString(date) AS day,
                    sum(keystrokes) AS keystrokes,
                    sum(chars_added) AS chars_added,
                    sum(chars_deleted) AS chars_deleted
                FROM wakaclock.keystroke_daily
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                GROUP BY day
                ORDER BY day ASC
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<KeystrokeDailyRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse keystroke_stats daily query error: {error}")
            })
    }
}

fn validate_date(date: &str) -> Result<()> {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .context("Invalid date format, expected YYYY-MM-DD")?;
    Ok(())
}
