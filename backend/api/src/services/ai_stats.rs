use anyhow::{Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::ai_stats::{
    AiAgentItem, AiAgentRow, AiCoverageStatus, AiDailyItem, AiDailyRow, AiIdentityReasonCount,
    AiIdentitySummary, AiStatsCoverage, AiStatsData, AiStatsResponse, AiTotalsRow,
    AiUsageMetricsRow, AI_STATS_SCHEMA_VERSION,
};
use crate::repository::canonical::canonical_winner_relation;
use wakaclock_core::ai::{KNOWN_AGENT_IDS, KNOWN_PROVIDER_IDS};
// Keep the dashboard conservative when reading rows written by older clients. The
// raw heartbeat remains the audit record, while this projection prevents arbitrary
// labels (for example integration-test names) from becoming named verified agents.
// Unknown labels can still contribute to the unattributed bucket, but a legacy
// evidence field must never promote the canonical `unknown` actor to AI.

fn ai_evidence_expr() -> &'static str {
    "lower(trim(ifNull(h.ai_agent, ''))) NOT IN ('', 'unknown', '<unknown>', 'null', 'undefined')
     OR lower(trim(ifNull(h.ai_event_id, ''))) NOT IN ('', 'unknown', '<unknown>', 'null', 'undefined')
     OR coalesce(h.ai_lines_added, 0) > 0
     OR coalesce(h.ai_lines_deleted, 0) > 0
     OR lower(trim(ifNull(h.ai_source, ''))) IN ('agent_hook', 'mcp', 'structured_mcp', 'transcript')"
}

fn known_agent_ids_sql() -> String {
    KNOWN_AGENT_IDS
        .iter()
        .map(|agent| format!("'{agent}'"))
        .collect::<Vec<_>>()
        .join(", ")
}

fn known_provider_ids_sql() -> String {
    KNOWN_PROVIDER_IDS
        .iter()
        .map(|provider| format!("'{provider}'"))
        .collect::<Vec<_>>()
        .join(", ")
}

fn effective_actor_type_expr() -> String {
    let known_agents = known_agent_ids_sql();
    let known_providers = known_provider_ids_sql();
    format!(
        "multiIf(
            h.actor_type = 'ai_verified' AND (
                (
                    lower(trim(ifNull(h.identity_status, ''))) = 'confirmed'
                    AND lower(trim(ifNull(h.identity_reason, ''))) = ''
                    AND lower(trim(ifNull(h.ai_provider, ''))) IN ({known_providers})
                    AND lower(trim(ifNull(h.ai_model, ''))) NOT IN ('', 'null', 'undefined', 'unknown', '<unknown>', 'none', 'n/a', 'na', 'not reported', 'not available', 'model_not_reported', 'provider_not_reported', 'no model', 'no provider', 'model not reported', '<synthetic>', 'synthetic', 'internal model marker', 'internal_model_marker')
                    AND lower(trim(ifNull(h.ai_agent, ''))) IN ({known_agents})
                    AND lower(trim(ifNull(h.ai_confidence, ''))) IN ('verified', 'correlated')
                    AND lower(trim(ifNull(h.identity_source, ifNull(h.ai_source, '')))) IN ('agent_hook', 'mcp', 'structured_mcp', 'transcript')
                )
                OR (
                    lower(trim(ifNull(h.identity_status, ''))) IN ('partial', 'conflict')
                    AND lower(trim(ifNull(h.ai_agent, ''))) IN ({known_agents})
                    AND lower(trim(ifNull(h.identity_source, ifNull(h.ai_source, '')))) IN ('agent_hook', 'mcp', 'structured_mcp', 'transcript')
                )
                OR (
                    lower(trim(ifNull(h.identity_status, ''))) = ''
                    AND lower(trim(ifNull(h.ai_provider, ''))) IN ({known_providers})
                    AND lower(trim(ifNull(h.ai_model, ''))) NOT IN ('', 'null', 'undefined', 'unknown', '<unknown>', 'none', 'n/a', 'na', 'not reported', 'not available', 'model_not_reported', 'provider_not_reported', 'no model', 'no provider', 'model not reported', '<synthetic>', 'synthetic', 'internal model marker', 'internal_model_marker')
                    AND lower(trim(ifNull(h.ai_agent, ''))) IN ({known_agents})
                    AND lower(trim(ifNull(h.ai_confidence, ''))) IN ('verified', 'correlated')
                    AND lower(trim(ifNull(h.ai_source, ''))) IN ('agent_hook', 'mcp', 'structured_mcp', 'transcript')
                )
            ), 'ai_verified',
            h.actor_type = 'ai_verified' AND ({ai_evidence}), 'ai_inferred',
            h.actor_type = 'ai_inferred', 'ai_inferred',
            h.actor_type = 'unknown' AND h.is_ai_generated = 1 AND ({ai_evidence}), 'ai_inferred',
            h.actor_type
        )",
        ai_evidence = ai_evidence_expr(),
    )
}

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
        let identity = identity_summary(&agents);
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
            schema_version: AI_STATS_SCHEMA_VERSION,
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
                coverage: coverage_from_totals(&totals),
                identity,
                agents: agents
                    .into_iter()
                    .map(|row| AiAgentItem {
                        agent: row.agent,
                        actor_type: row.actor_type,
                        provider: row.provider,
                        model: row.model,
                        identity_status: row.identity_status,
                        identity_reason: row.identity_reason,
                        identity_source: row.identity_source,
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
        let effective_actor_type = effective_actor_type_expr();
        let relation = canonical_winner_relation(
            "h.user_id = ? AND h.date BETWEEN toDate(?) AND toDate(?)",
            "h",
        );
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
                    SELECT h.*, {effective_actor_type} AS effective_actor_type
                    FROM {relation}
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
        let effective_actor_type = effective_actor_type_expr();
        let relation = canonical_winner_relation(
            "h.user_id = ? AND h.date BETWEEN toDate(?) AND toDate(?)",
            "h",
        );
        let query = format!(
            "
                SELECT
                    multiIf(
                        h.effective_actor_type = 'ai_verified', coalesce(nullIf(trim(h.ai_agent), ''), 'unknown'),
                        h.effective_actor_type = 'ai_inferred', 'unknown',
                        h.effective_actor_type = 'human', 'human',
                        'unknown'
                    ) AS agent,
                    h.effective_actor_type AS actor_type,
                    if(h.effective_actor_type = 'ai_verified', nullIf(trim(ifNull(h.ai_provider, '')), ''), NULL) AS provider,
                    if(h.effective_actor_type = 'ai_verified', nullIf(trim(ifNull(h.ai_model, '')), ''), NULL) AS model,
                    if(h.effective_actor_type IN ('ai_verified', 'ai_inferred'),
                        coalesce(nullIf(lower(trim(ifNull(h.identity_status, ''))), ''), 'unavailable'),
                        'unavailable') AS identity_status,
                    if(h.effective_actor_type IN ('ai_verified', 'ai_inferred'),
                        multiIf(
                            lower(trim(ifNull(h.identity_reason, ''))) IN ('missing_agent', 'missing_provider', 'missing_model', 'internal_marker', 'context_unavailable', 'conflicting_evidence'),
                            lower(trim(ifNull(h.identity_reason, ''))),
                            'context_unavailable'
                        ), NULL) AS identity_reason,
                    if(h.effective_actor_type IN ('ai_verified', 'ai_inferred'),
                        if(lower(trim(ifNull(h.identity_source, ifNull(h.ai_source, '')))) IN ('agent_hook', 'mcp', 'structured_mcp', 'transcript'),
                            lower(trim(ifNull(h.identity_source, ifNull(h.ai_source, '')))),
                            NULL
                        ), NULL) AS identity_source,
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
                    SELECT h.*, {effective_actor_type} AS effective_actor_type
                    FROM {relation}
                ) AS h
                GROUP BY agent, actor_type, provider, model, identity_status, identity_reason, identity_source
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
        let effective_actor_type = effective_actor_type_expr();
        let relation = canonical_winner_relation(
            "h.user_id = ? AND h.date BETWEEN toDate(?) AND toDate(?)",
            "h",
        );
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
                    SELECT h.*, {effective_actor_type} AS effective_actor_type
                    FROM {relation}
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

/// Build the explicit F6 partition contract from the same totals row used by every
/// legacy percentage. Keeping this as a pure function makes the denominator rules easy
/// to test without a ClickHouse fixture and prevents the UI from reconstructing them from
/// independently rounded percentages.
fn coverage_from_totals(totals: &AiTotalsRow) -> AiStatsCoverage {
    let attributed_line_changes = totals
        .total_ai_lines_added
        .saturating_add(totals.total_ai_lines_deleted)
        .saturating_add(totals.total_human_lines_added)
        .saturating_add(totals.total_human_lines_deleted);
    let unknown_line_changes = totals
        .total_unattributed_lines_added
        .saturating_add(totals.total_unattributed_lines_deleted);
    let line_change_denominator = attributed_line_changes.saturating_add(unknown_line_changes);
    let status = if totals.total_heartbeats == 0 {
        AiCoverageStatus::NoActivity
    } else if totals.unattributed_heartbeats > 0 || unknown_line_changes > 0 {
        AiCoverageStatus::Partial
    } else {
        AiCoverageStatus::Complete
    };

    AiStatsCoverage {
        attributed_line_changes,
        ai_inferred_heartbeats: totals.ai_inferred_heartbeats,
        ai_verified_heartbeats: totals.ai_verified_heartbeats,
        heartbeat_denominator: totals.total_heartbeats,
        human_heartbeats: totals.human_heartbeats,
        line_change_denominator,
        line_coverage_percent: (line_change_denominator > 0)
            .then(|| attributed_line_changes as f64 * 100.0 / line_change_denominator as f64),
        status,
        unknown_heartbeats: totals.unattributed_heartbeats,
        unknown_line_changes,
    }
}

/// Summarize identity completeness from the same canonical agent rows returned to
/// the client. Grouping after the canonical-winner query keeps corrections from
/// changing heartbeat/line totals or producing duplicate reason counts.
fn identity_summary(rows: &[AiAgentRow]) -> AiIdentitySummary {
    let mut summary = AiIdentitySummary::default();
    let mut reasons = std::collections::BTreeMap::<String, u64>::new();
    for row in rows
        .iter()
        .filter(|row| matches!(row.actor_type.as_str(), "ai_verified" | "ai_inferred"))
    {
        let status = row
            .identity_status
            .as_deref()
            .map(|value| value.trim().to_ascii_lowercase())
            .unwrap_or_else(|| "unavailable".to_string());
        let reason = row
            .identity_reason
            .as_deref()
            .map(|value| value.trim().to_ascii_lowercase())
            .filter(|value| !value.is_empty());
        if row.actor_type == "ai_verified" {
            summary.ai_verified_heartbeat_denominator = summary
                .ai_verified_heartbeat_denominator
                .saturating_add(row.heartbeat_count);
        }
        // A status string alone is not enough to certify a row.  The actor
        // projection must also keep it in the verified bucket; malformed or
        // legacy rows with `identity_status = confirmed` but an inferred actor
        // remain visible as incomplete evidence.
        if row.actor_type == "ai_verified" && status == "confirmed" && reason.is_none() {
            summary.confirmed_ai_heartbeats = summary
                .confirmed_ai_heartbeats
                .saturating_add(row.heartbeat_count);
            continue;
        }
        summary.incomplete_ai_heartbeats = summary
            .incomplete_ai_heartbeats
            .saturating_add(row.heartbeat_count);
        summary.incomplete_ai_lines_added = summary
            .incomplete_ai_lines_added
            .saturating_add(row.ai_lines_added);
        summary.incomplete_ai_lines_deleted = summary
            .incomplete_ai_lines_deleted
            .saturating_add(row.ai_lines_deleted);
        if status == "conflict" {
            summary.conflict_heartbeats = summary
                .conflict_heartbeats
                .saturating_add(row.heartbeat_count);
        }
        let reason = reason.unwrap_or_else(|| "context_unavailable".to_string());
        *reasons.entry(reason).or_default() += row.heartbeat_count;
    }
    summary.reason_counts = reasons
        .into_iter()
        .map(|(reason, heartbeats)| AiIdentityReasonCount { reason, heartbeats })
        .collect();
    summary.confirmed_ai_heartbeat_percentage = percentage(
        summary.confirmed_ai_heartbeats,
        summary.ai_verified_heartbeat_denominator,
    );
    summary
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

#[cfg(test)]
mod tests {
    use super::{coverage_from_totals, effective_actor_type_expr, identity_summary};
    use crate::model::ai_stats::{AiAgentRow, AiCoverageStatus, AiTotalsRow};

    fn totals() -> AiTotalsRow {
        AiTotalsRow {
            total_ai_lines_added: 10,
            total_ai_lines_deleted: 2,
            total_ai_verified_lines_added: 10,
            total_ai_verified_lines_deleted: 2,
            total_ai_inferred_lines_added: 0,
            total_ai_inferred_lines_deleted: 0,
            total_human_lines_added: 4,
            total_human_lines_deleted: 1,
            total_unattributed_lines_added: 3,
            total_unattributed_lines_deleted: 1,
            total_human_keystrokes: 20,
            total_human_chars_added: 30,
            total_heartbeats: 8,
            ai_heartbeats: 3,
            ai_verified_heartbeats: 3,
            ai_inferred_heartbeats: 0,
            human_heartbeats: 4,
            unattributed_heartbeats: 1,
        }
    }

    #[test]
    fn effective_actor_projection_preserves_partial_verified_rows() {
        let expression = effective_actor_type_expr();
        assert!(expression.contains("h.identity_status, ''))) = 'confirmed'"));
        assert!(expression.contains("h.identity_status, ''))) IN ('partial', 'conflict')"));
        assert!(expression.contains("h.actor_type = 'unknown' AND h.is_ai_generated = 1"));
    }

    #[test]
    fn coverage_keeps_actor_buckets_and_line_denominator_disjoint() {
        let coverage = coverage_from_totals(&totals());

        assert_eq!(
            coverage.ai_verified_heartbeats
                + coverage.ai_inferred_heartbeats
                + coverage.human_heartbeats
                + coverage.unknown_heartbeats,
            coverage.heartbeat_denominator
        );
        assert_eq!(coverage.attributed_line_changes, 17);
        assert_eq!(coverage.unknown_line_changes, 4);
        assert_eq!(coverage.line_change_denominator, 21);
        assert_eq!(coverage.status, AiCoverageStatus::Partial);
        assert_eq!(coverage.line_coverage_percent, Some(17.0 / 21.0 * 100.0));
    }

    #[test]
    fn coverage_reports_no_activity_without_fabricating_zero_percent() {
        let mut empty = totals();
        empty.total_heartbeats = 0;
        empty.ai_heartbeats = 0;
        empty.ai_verified_heartbeats = 0;
        empty.ai_inferred_heartbeats = 0;
        empty.human_heartbeats = 0;
        empty.unattributed_heartbeats = 0;
        empty.total_ai_lines_added = 0;
        empty.total_ai_lines_deleted = 0;
        empty.total_human_lines_added = 0;
        empty.total_human_lines_deleted = 0;
        empty.total_unattributed_lines_added = 0;
        empty.total_unattributed_lines_deleted = 0;

        let coverage = coverage_from_totals(&empty);
        assert_eq!(coverage.status, AiCoverageStatus::NoActivity);
        assert_eq!(coverage.line_change_denominator, 0);
        assert_eq!(coverage.line_coverage_percent, None);
    }

    #[test]
    fn identity_summary_keeps_partial_verified_rows_and_reasons() {
        let rows = vec![
            AiAgentRow {
                agent: "codex".into(),
                actor_type: "ai_verified".into(),
                provider: Some("openai".into()),
                model: None,
                identity_status: Some("partial".into()),
                identity_reason: Some("missing_model".into()),
                identity_source: Some("transcript".into()),
                ai_lines_added: 12,
                ai_lines_deleted: 3,
                human_lines_added: 0,
                human_lines_deleted: 0,
                unattributed_lines_added: 0,
                unattributed_lines_deleted: 0,
                heartbeat_count: 4,
            },
            AiAgentRow {
                agent: "codex".into(),
                actor_type: "ai_verified".into(),
                provider: Some("openai".into()),
                model: Some("gpt-5.6-sol".into()),
                identity_status: Some("confirmed".into()),
                identity_reason: None,
                identity_source: Some("transcript".into()),
                ai_lines_added: 5,
                ai_lines_deleted: 1,
                human_lines_added: 0,
                human_lines_deleted: 0,
                unattributed_lines_added: 0,
                unattributed_lines_deleted: 0,
                heartbeat_count: 2,
            },
        ];

        let summary = identity_summary(&rows);
        assert_eq!(summary.confirmed_ai_heartbeats, 2);
        assert_eq!(summary.incomplete_ai_heartbeats, 4);
        assert_eq!(summary.incomplete_ai_lines_added, 12);
        assert_eq!(summary.incomplete_ai_lines_deleted, 3);
        assert_eq!(summary.conflict_heartbeats, 0);
        assert_eq!(summary.reason_counts[0].reason, "missing_model");
        assert_eq!(summary.reason_counts[0].heartbeats, 4);
    }
}
