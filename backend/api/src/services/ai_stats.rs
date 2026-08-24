use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::ai_stats::{
    AiAgentItem, AiAgentRow, AiDailyItem, AiDailyRow, AiStatsData, AiStatsResponse, AiTotalsRow,
    AiUsageMetricsRow,
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
        let usage = self.fetch_usage_metrics(user_id, start, end).await?;
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
                total_human_lines_added: totals.total_human_lines_added,
                total_human_lines_deleted: totals.total_human_lines_deleted,
                total_human_keystrokes: totals.total_human_keystrokes,
                total_human_chars_added: totals.total_human_chars_added,
                total_heartbeats: totals.total_heartbeats,
                total_prompt_characters: usage.prompt_characters,
                total_input_tokens: usage.input_tokens,
                total_output_tokens: usage.output_tokens,
                total_cache_read_tokens: usage.cache_read_tokens,
                total_cache_write_tokens: usage.cache_write_tokens,
                total_estimated_cost_microusd: usage.estimated_cost_microusd,
                ai_heartbeat_percentage,
                agents: agents
                    .into_iter()
                    .map(|row| AiAgentItem {
                        agent: row.agent,
                        provider: row.provider,
                        model: row.model,
                        ai_lines_added: row.ai_lines_added,
                        ai_lines_deleted: row.ai_lines_deleted,
                        human_lines_added: row.human_lines_added,
                        human_lines_deleted: row.human_lines_deleted,
                        heartbeat_count: row.heartbeat_count,
                    })
                    .collect(),
                daily: daily
                    .into_iter()
                    .map(|row| AiDailyItem {
                        date: row.date,
                        ai_lines_added: row.ai_lines_added,
                        ai_lines_deleted: row.ai_lines_deleted,
                        human_lines_added: row.human_lines_added,
                        human_lines_deleted: row.human_lines_deleted,
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
                    coalesce(sumIf(coalesce(human_lines_added, 0), NOT is_ai_generated), 0) AS total_human_lines_added,
                    coalesce(sumIf(coalesce(human_lines_deleted, 0), NOT is_ai_generated), 0) AS total_human_lines_deleted,
                    coalesce(sumIf(coalesce(keystrokes, 0), NOT is_ai_generated), 0) AS total_human_keystrokes,
                    coalesce(sumIf(coalesce(chars_added, 0), NOT is_ai_generated), 0) AS total_human_chars_added,
                    count() AS total_heartbeats,
                    countIf(is_ai_generated) AS ai_heartbeats
                FROM wakaclock.heartbeats
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
                    if(is_ai_generated, coalesce(ai_agent, 'unknown'), 'human') AS agent,
                    ai_provider AS provider,
                    ai_model AS model,
                    sumIf(coalesce(ai_lines_added, 0), is_ai_generated) AS ai_lines_added,
                    sumIf(coalesce(ai_lines_deleted, 0), is_ai_generated) AS ai_lines_deleted,
                    sumIf(coalesce(human_lines_added, 0), NOT is_ai_generated) AS human_lines_added,
                    sumIf(coalesce(human_lines_deleted, 0), NOT is_ai_generated) AS human_lines_deleted,
                    count() AS heartbeat_count
                FROM wakaclock.heartbeats
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                GROUP BY is_ai_generated, ai_agent, ai_provider, ai_model
                ORDER BY ai_lines_added DESC, agent ASC, model ASC
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<AiAgentRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse ai_stats agents query error: {error}"))
    }

    async fn fetch_usage_metrics(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<AiUsageMetricsRow> {
        self.clickhouse
            .get_client()
            .query(
                "SELECT
                    sumOrNull(prompt_character_count) AS prompt_characters,
                    sumOrNull(input_tokens) AS input_tokens,
                    sumOrNull(output_tokens) AS output_tokens,
                    sumOrNull(cache_read_tokens) AS cache_read_tokens,
                    sumOrNull(cache_write_tokens) AS cache_write_tokens,
                    sumOrNull(estimated_cost_microusd) AS estimated_cost_microusd
                 FROM wakaclock.ai_usage_events FINAL
                 WHERE user_id = ? AND toDate(toDateTime(event_time)) BETWEEN toDate(?) AND toDate(?)",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_one::<AiUsageMetricsRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse ai usage metrics query error: {error}"))
    }

    async fn fetch_daily(&self, user_id: Uuid, start: &str, end: &str) -> Result<Vec<AiDailyRow>> {
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    toString(date) AS day,
                    coalesce(sum(ai_lines_added), 0) AS ai_lines_added,
                    coalesce(sum(ai_lines_deleted), 0) AS ai_lines_deleted,
                    sumIf(coalesce(human_lines_added, 0), NOT is_ai_generated) AS human_lines_added,
                    sumIf(coalesce(human_lines_deleted, 0), NOT is_ai_generated) AS human_lines_deleted,
                    sumIf(coalesce(keystrokes, 0), NOT is_ai_generated) AS human_keystrokes,
                    sumIf(coalesce(chars_added, 0), NOT is_ai_generated) AS human_chars_added,
                    count() AS heartbeat_count
                FROM wakaclock.heartbeats
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
