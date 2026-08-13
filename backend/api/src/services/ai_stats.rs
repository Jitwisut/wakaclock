use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::ai_stats::{
    AiAgentItem, AiAgentRow, AiDailyItem, AiDailyRow, AiStatsData, AiStatsResponse, AiTotalsRow,
};

pub struct AiStatsService {
    clickhouse: Arc<ClickHouseClient>,
}

impl AiStatsService {
    pub fn new(clickhouse: Arc<ClickHouseClient>) -> Self {
        Self { clickhouse }
    }

    pub async fn get_range(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<AiStatsResponse> {
        validate_date(start)?;
        validate_date(end)?;

        let totals = self.fetch_totals(user_id, start, end).await?;
        let agents = self.fetch_agents(user_id, start, end).await?;
        let daily = self.fetch_daily(user_id, start, end).await?;

        let ai_heartbeat_percentage = if totals.total_heartbeats > 0 {
            (totals.ai_heartbeats as f64 / totals.total_heartbeats as f64) * 100.0
        } else {
            0.0
        };

        Ok(AiStatsResponse {
            start: start.to_string(),
            end: end.to_string(),
            data: AiStatsData {
                total_ai_lines_added: totals.total_ai_lines_added,
                total_ai_lines_deleted: totals.total_ai_lines_deleted,
                total_human_keystrokes: totals.total_human_keystrokes,
                total_human_chars_added: totals.total_human_chars_added,
                total_heartbeats: totals.total_heartbeats,
                ai_heartbeat_percentage,
                agents: agents
                    .into_iter()
                    .map(|row| AiAgentItem {
                        agent: row.agent,
                        ai_lines_added: row.ai_lines_added,
                        ai_lines_deleted: row.ai_lines_deleted,
                        heartbeat_count: row.heartbeat_count,
                    })
                    .collect(),
                daily: daily
                    .into_iter()
                    .map(|row| AiDailyItem {
                        date: row.date,
                        ai_lines_added: row.ai_lines_added,
                        ai_lines_deleted: row.ai_lines_deleted,
                        human_keystrokes: row.human_keystrokes,
                        human_chars_added: row.human_chars_added,
                        heartbeat_count: row.heartbeat_count,
                    })
                    .collect(),
            },
        })
    }

    async fn fetch_totals(&self, user_id: Uuid, start: &str, end: &str) -> Result<AiTotalsRow> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    coalesce(sum(ai_lines_added), 0) AS total_ai_lines_added,
                    coalesce(sum(ai_lines_deleted), 0) AS total_ai_lines_deleted,
                    coalesce(sum(human_keystrokes), 0) AS total_human_keystrokes,
                    coalesce(sum(human_chars_added), 0) AS total_human_chars_added,
                    coalesce(sum(heartbeat_count), 0) AS total_heartbeats,
                    coalesce(sumIf(heartbeat_count, ai_agent != 'human'), 0) AS ai_heartbeats
                FROM wakaclock.ai_daily
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_one::<AiTotalsRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse ai_stats totals query error: {error}"))
    }

    async fn fetch_agents(&self, user_id: Uuid, start: &str, end: &str) -> Result<Vec<AiAgentRow>> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    ai_agent AS agent,
                    sum(ai_lines_added) AS ai_lines_added,
                    sum(ai_lines_deleted) AS ai_lines_deleted,
                    sum(heartbeat_count) AS heartbeat_count
                FROM wakaclock.ai_daily
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?) AND ai_agent != 'human'
                GROUP BY agent
                ORDER BY ai_lines_added DESC, agent ASC
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<AiAgentRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse ai_stats agents query error: {error}"))
    }

    async fn fetch_daily(&self, user_id: Uuid, start: &str, end: &str) -> Result<Vec<AiDailyRow>> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    toString(date) AS day,
                    sum(ai_lines_added) AS ai_lines_added,
                    sum(ai_lines_deleted) AS ai_lines_deleted,
                    sum(human_keystrokes) AS human_keystrokes,
                    sum(human_chars_added) AS human_chars_added,
                    sum(heartbeat_count) AS heartbeat_count
                FROM wakaclock.ai_daily
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                GROUP BY day
                ORDER BY day ASC
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<AiDailyRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse ai_stats daily query error: {error}"))
    }
}

fn validate_date(date: &str) -> Result<()> {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .context("Invalid date format, expected YYYY-MM-DD")?;
    Ok(())
}
