use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::ai_stats::{
    AiAgentItem, AiAgentRow, AiDailyItem, AiDailyRow, AiStatsData, AiStatsResponse, AiTotalsRow,
    AiUsageMetricsRow,
};

// A small compatibility projection for rows written before `actor_type` became the
// canonical field. Some WakaTime imports explicitly stored `actor_type = 'unknown'`
// while also carrying positive AI evidence. Project those rows for reporting only; the
// raw heartbeat remains unchanged and can be repaired separately once its provenance is
// audited. This keeps old data from disappearing from AI totals after the import fix.
const EFFECTIVE_ACTOR_TYPE_EXPR: &str = "multiIf(
    h.actor_type = 'unknown' AND (
        h.is_ai_generated = 1
        OR lower(ifNull(h.ai_agent, '')) NOT IN ('', 'unknown', '<unknown>', 'null', 'undefined')
        OR lower(ifNull(h.ai_event_id, '')) NOT IN ('', 'unknown', '<unknown>', 'null', 'undefined')
        OR coalesce(h.ai_lines_added, 0) > 0
        OR coalesce(h.ai_lines_deleted, 0) > 0
        OR lower(ifNull(h.ai_source, '')) IN ('agent_hook', 'mcp')
    ),
    multiIf(
        lower(ifNull(h.ai_confidence, '')) = 'verified'
            OR lower(ifNull(h.ai_source, '')) IN ('agent_hook', 'mcp'),
        'ai_verified',
        'ai_inferred'
    ),
    h.actor_type
)";

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

        let ai_heartbeat_percentage = percentage(totals.ai_heartbeats, totals.total_heartbeats);
        let ai_verified_heartbeat_percentage =
            percentage(totals.ai_verified_heartbeats, totals.total_heartbeats);
        let ai_inferred_heartbeat_percentage =
            percentage(totals.ai_inferred_heartbeats, totals.total_heartbeats);
        let human_heartbeat_percentage =
            percentage(totals.human_heartbeats, totals.total_heartbeats);
        let unknown_heartbeat_percentage =
            percentage(totals.unattributed_heartbeats, totals.total_heartbeats);
        let unattributed_heartbeat_percentage =
            percentage(totals.unattributed_heartbeats, totals.total_heartbeats);

        Ok(AiStatsResponse {
            start: start.to_string(),
            end: end.to_string(),
            data: AiStatsData {
                total_ai_lines_added: totals.total_ai_lines_added,
                total_ai_lines_deleted: totals.total_ai_lines_deleted,
                total_ai_verified_lines_added: totals.total_ai_verified_lines_added,
                total_ai_verified_lines_deleted: totals.total_ai_verified_lines_deleted,
                total_ai_inferred_lines_added: totals.total_ai_inferred_lines_added,
                total_ai_inferred_lines_deleted: totals.total_ai_inferred_lines_deleted,
                total_human_lines_added: totals.total_human_lines_added,
                total_human_lines_deleted: totals.total_human_lines_deleted,
                total_unknown_lines_added: totals.total_unattributed_lines_added,
                total_unknown_lines_deleted: totals.total_unattributed_lines_deleted,
                total_unattributed_lines_added: totals.total_unattributed_lines_added,
                total_unattributed_lines_deleted: totals.total_unattributed_lines_deleted,
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
                ai_verified_heartbeat_percentage,
                ai_inferred_heartbeat_percentage,
                human_heartbeat_percentage,
                unknown_heartbeat_percentage,
                unattributed_heartbeat_percentage,
                agents: agents
                    .into_iter()
                    .map(|row| AiAgentItem {
                        agent: row.agent,
                        actor_type: row.actor_type,
                        provider: row.provider,
                        model: row.model,
                        ai_lines_added: row.ai_lines_added,
                        ai_lines_deleted: row.ai_lines_deleted,
                        human_lines_added: row.human_lines_added,
                        human_lines_deleted: row.human_lines_deleted,
                        unknown_lines_added: row.unattributed_lines_added,
                        unknown_lines_deleted: row.unattributed_lines_deleted,
                        unattributed_lines_added: row.unattributed_lines_added,
                        unattributed_lines_deleted: row.unattributed_lines_deleted,
                        heartbeat_count: row.heartbeat_count,
                    })
                    .collect(),
                daily: daily
                    .into_iter()
                    .map(|row| AiDailyItem {
                        date: row.date,
                        ai_lines_added: row.ai_lines_added,
                        ai_lines_deleted: row.ai_lines_deleted,
                        ai_verified_lines_added: row.ai_verified_lines_added,
                        ai_verified_lines_deleted: row.ai_verified_lines_deleted,
                        ai_inferred_lines_added: row.ai_inferred_lines_added,
                        ai_inferred_lines_deleted: row.ai_inferred_lines_deleted,
                        human_lines_added: row.human_lines_added,
                        human_lines_deleted: row.human_lines_deleted,
                        unknown_lines_added: row.unattributed_lines_added,
                        unknown_lines_deleted: row.unattributed_lines_deleted,
                        unattributed_lines_added: row.unattributed_lines_added,
                        unattributed_lines_deleted: row.unattributed_lines_deleted,
                        human_keystrokes: row.human_keystrokes,
                        human_chars_added: row.human_chars_added,
                        heartbeat_count: row.heartbeat_count,
                    })
                    .collect(),
            },
        })
    }

    async fn fetch_totals(&self, user_id: Uuid, start: &str, end: &str) -> Result<AiTotalsRow> {
        let query = format!(
            "
                SELECT
                    coalesce(sumIf(h.ai_lines_added, h.effective_actor_type IN ('ai_verified', 'ai_inferred')), 0) AS total_ai_lines_added,
                    coalesce(sumIf(h.ai_lines_deleted, h.effective_actor_type IN ('ai_verified', 'ai_inferred')), 0) AS total_ai_lines_deleted,
                    coalesce(sumIf(h.ai_lines_added, h.effective_actor_type = 'ai_verified'), 0) AS total_ai_verified_lines_added,
                    coalesce(sumIf(h.ai_lines_deleted, h.effective_actor_type = 'ai_verified'), 0) AS total_ai_verified_lines_deleted,
                    coalesce(sumIf(h.ai_lines_added, h.effective_actor_type = 'ai_inferred'), 0) AS total_ai_inferred_lines_added,
                    coalesce(sumIf(h.ai_lines_deleted, h.effective_actor_type = 'ai_inferred'), 0) AS total_ai_inferred_lines_deleted,
                    coalesce(sumIf(coalesce(h.human_lines_added, 0), h.effective_actor_type = 'human'), 0) AS total_human_lines_added,
                    coalesce(sumIf(coalesce(h.human_lines_deleted, 0), h.effective_actor_type = 'human'), 0) AS total_human_lines_deleted,
                    coalesce(sum(coalesce(h.unattributed_lines_added, 0)), 0)
                        + coalesce(sumIf(toUInt64(coalesce(h.ai_lines_added, 0) + coalesce(h.human_lines_added, 0)), h.effective_actor_type = 'unknown'), 0)
                        + coalesce(sumIf(toUInt64(coalesce(h.human_lines_added, 0)), h.effective_actor_type IN ('ai_verified', 'ai_inferred')), 0) AS total_unattributed_lines_added,
                    coalesce(sum(coalesce(h.unattributed_lines_deleted, 0)), 0)
                        + coalesce(sumIf(toUInt64(coalesce(h.ai_lines_deleted, 0) + coalesce(h.human_lines_deleted, 0)), h.effective_actor_type = 'unknown'), 0)
                        + coalesce(sumIf(toUInt64(coalesce(h.human_lines_deleted, 0)), h.effective_actor_type IN ('ai_verified', 'ai_inferred')), 0) AS total_unattributed_lines_deleted,
                    coalesce(sumIf(coalesce(h.keystrokes, 0), h.effective_actor_type = 'human'), 0) AS total_human_keystrokes,
                    coalesce(sumIf(coalesce(h.chars_added, 0), h.effective_actor_type = 'human'), 0) AS total_human_chars_added,
                    count() AS total_heartbeats,
                    countIf(h.effective_actor_type IN ('ai_verified', 'ai_inferred')) AS ai_heartbeats,
                    countIf(h.effective_actor_type = 'ai_verified') AS ai_verified_heartbeats,
                    countIf(h.effective_actor_type = 'ai_inferred') AS ai_inferred_heartbeats,
                    countIf(h.effective_actor_type = 'human') AS human_heartbeats,
                    countIf(h.effective_actor_type = 'unknown') AS unattributed_heartbeats
                FROM (
                    SELECT h.*, {EFFECTIVE_ACTOR_TYPE_EXPR} AS effective_actor_type
                    FROM wakaclock.heartbeats AS h
                    WHERE h.user_id = ? AND h.date BETWEEN toDate(?) AND toDate(?)
                ) AS h
                ",
        );
        self.clickhouse
            .get_client()
            .query(&query)
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_one::<AiTotalsRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse ai_stats totals query error: {error}"))
    }

    async fn fetch_agents(&self, user_id: Uuid, start: &str, end: &str) -> Result<Vec<AiAgentRow>> {
        let query = format!(
            "
                SELECT
                    multiIf(
                        h.effective_actor_type IN ('ai_verified', 'ai_inferred'), coalesce(h.ai_agent, 'unknown'),
                        h.effective_actor_type = 'human', 'human',
                        'unknown'
                    ) AS agent,
                    h.effective_actor_type AS actor_type,
                    h.ai_provider AS provider,
                    h.ai_model AS model,
                    sumIf(coalesce(h.ai_lines_added, 0), h.effective_actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_added,
                    sumIf(coalesce(h.ai_lines_deleted, 0), h.effective_actor_type IN ('ai_verified', 'ai_inferred')) AS ai_lines_deleted,
                    sumIf(coalesce(h.human_lines_added, 0), h.effective_actor_type = 'human') AS human_lines_added,
                    sumIf(coalesce(h.human_lines_deleted, 0), h.effective_actor_type = 'human') AS human_lines_deleted,
                    sum(coalesce(h.unattributed_lines_added, 0))
                        + sumIf(toUInt64(coalesce(h.ai_lines_added, 0) + coalesce(h.human_lines_added, 0)), h.effective_actor_type = 'unknown')
                        + sumIf(toUInt64(coalesce(h.human_lines_added, 0)), h.effective_actor_type IN ('ai_verified', 'ai_inferred')) AS unattributed_lines_added,
                    sum(coalesce(h.unattributed_lines_deleted, 0))
                        + sumIf(toUInt64(coalesce(h.ai_lines_deleted, 0) + coalesce(h.human_lines_deleted, 0)), h.effective_actor_type = 'unknown')
                        + sumIf(toUInt64(coalesce(h.human_lines_deleted, 0)), h.effective_actor_type IN ('ai_verified', 'ai_inferred')) AS unattributed_lines_deleted,
                    count() AS heartbeat_count
                FROM (
                    SELECT h.*, {EFFECTIVE_ACTOR_TYPE_EXPR} AS effective_actor_type
                    FROM wakaclock.heartbeats AS h
                    WHERE h.user_id = ? AND h.date BETWEEN toDate(?) AND toDate(?)
                ) AS h
                GROUP BY agent, actor_type, h.ai_provider, h.ai_model
                ORDER BY ai_lines_added DESC, agent ASC, model ASC
                ",
        );
        self.clickhouse
            .get_client()
            .query(&query)
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
        let query = format!(
            "
                SELECT
                    toString(h.date) AS day,
                    coalesce(sumIf(h.ai_lines_added, h.effective_actor_type IN ('ai_verified', 'ai_inferred')), 0) AS ai_lines_added,
                    coalesce(sumIf(h.ai_lines_deleted, h.effective_actor_type IN ('ai_verified', 'ai_inferred')), 0) AS ai_lines_deleted,
                    coalesce(sumIf(h.ai_lines_added, h.effective_actor_type = 'ai_verified'), 0) AS ai_verified_lines_added,
                    coalesce(sumIf(h.ai_lines_deleted, h.effective_actor_type = 'ai_verified'), 0) AS ai_verified_lines_deleted,
                    coalesce(sumIf(h.ai_lines_added, h.effective_actor_type = 'ai_inferred'), 0) AS ai_inferred_lines_added,
                    coalesce(sumIf(h.ai_lines_deleted, h.effective_actor_type = 'ai_inferred'), 0) AS ai_inferred_lines_deleted,
                    sumIf(coalesce(h.human_lines_added, 0), h.effective_actor_type = 'human') AS human_lines_added,
                    sumIf(coalesce(h.human_lines_deleted, 0), h.effective_actor_type = 'human') AS human_lines_deleted,
                    coalesce(sum(coalesce(h.unattributed_lines_added, 0)), 0)
                        + coalesce(sumIf(toUInt64(coalesce(h.ai_lines_added, 0) + coalesce(h.human_lines_added, 0)), h.effective_actor_type = 'unknown'), 0)
                        + coalesce(sumIf(toUInt64(coalesce(h.human_lines_added, 0)), h.effective_actor_type IN ('ai_verified', 'ai_inferred')), 0) AS unattributed_lines_added,
                    coalesce(sum(coalesce(h.unattributed_lines_deleted, 0)), 0)
                        + coalesce(sumIf(toUInt64(coalesce(h.ai_lines_deleted, 0) + coalesce(h.human_lines_deleted, 0)), h.effective_actor_type = 'unknown'), 0)
                        + coalesce(sumIf(toUInt64(coalesce(h.human_lines_deleted, 0)), h.effective_actor_type IN ('ai_verified', 'ai_inferred')), 0) AS unattributed_lines_deleted,
                    sumIf(coalesce(h.keystrokes, 0), h.effective_actor_type = 'human') AS human_keystrokes,
                    sumIf(coalesce(h.chars_added, 0), h.effective_actor_type = 'human') AS human_chars_added,
                    count() AS heartbeat_count
                FROM (
                    SELECT h.*, {EFFECTIVE_ACTOR_TYPE_EXPR} AS effective_actor_type
                    FROM wakaclock.heartbeats AS h
                    WHERE h.user_id = ? AND h.date BETWEEN toDate(?) AND toDate(?)
                ) AS h
                GROUP BY day
                ORDER BY day ASC
                ",
        );
        self.clickhouse
            .get_client()
            .query(&query)
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<AiDailyRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse ai_stats daily query error: {error}"))
    }
}

fn percentage(part: u64, total: u64) -> f64 {
    if total == 0 {
        0.0
    } else {
        (part as f64 / total as f64) * 100.0
    }
}

fn validate_date(date: &str) -> Result<()> {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .context("Invalid date format, expected YYYY-MM-DD")?;
    Ok(())
}
