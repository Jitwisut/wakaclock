//! Read-only facts for Agent Universe. The history reads usage events; the live view reads the
//! latest canonical heartbeats. Neither computes a duration or writes anything.

use anyhow::Result;
use clickhouse::Row;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::agent_universe::{AGENT_LIVE_MAX_ROWS, AGENT_UNIVERSE_MAX_ROWS};
use crate::repository::canonical::canonical_winner_relation;

#[derive(Debug, Clone, Row, Deserialize, PartialEq, Eq)]
pub struct AgentHourRow {
    pub agent: String,
    pub session: String,
    #[serde(with = "clickhouse::serde::uuid::option")]
    pub project_id: Option<Uuid>,
    pub hour: u32,
    pub events: u64,
    pub tokens: u64,
    pub priced_events: u64,
    pub cost_microusd: u64,
    pub prompts: u64,
    pub inferred_project_events: u64,
    pub model: String,
    pub last_event_at: u32,
}

/// One agent on one project inside the live window. Times are client clock seconds.
#[derive(Debug, Clone, Row, Deserialize, PartialEq)]
pub struct AgentLiveRow {
    pub agent: String,
    #[serde(with = "clickhouse::serde::uuid::option")]
    pub project_id: Option<Uuid>,
    pub heartbeats: u64,
    pub last_time: f64,
    pub future_heartbeats: u64,
    pub model: String,
    /// The same verified-identity rule heartbeat readback uses before it shows an agent name.
    pub verified: bool,
}

#[derive(Debug, Clone, Row, Deserialize, PartialEq, Eq)]
pub struct ProjectNameRow {
    pub id: String,
    pub name: String,
}

pub struct AgentUniverseRepository {
    client: Arc<ClickHouseClient>,
}

impl AgentUniverseRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    pub async fn hours(&self, user_id: Uuid, start: f64, end: f64) -> Result<Vec<AgentHourRow>> {
        self.client
            .get_client()
            .query(
                "SELECT ai_agent AS agent,
                        ai_session_id AS session,
                        project_id,
                        toUInt32(intDiv(event_time, 3600) * 3600) AS hour,
                        count() AS events,
                        sum(toUInt64(ifNull(input_tokens, 0)) + toUInt64(ifNull(output_tokens, 0))) AS tokens,
                        countIf(estimated_cost_microusd IS NOT NULL) AS priced_events,
                        sum(toUInt64(ifNull(estimated_cost_microusd, 0))) AS cost_microusd,
                        sum(toUInt64(prompt_count)) AS prompts,
                        countIf(project_id IS NOT NULL AND project_attribution_method IS NULL) AS inferred_project_events,
                        argMax(ifNull(ai_model, ''), event_time) AS model,
                        max(event_time) AS last_event_at
                 FROM wakaclock.ai_usage_events FINAL
                 WHERE user_id = ? AND event_time >= ? AND event_time < ?
                 GROUP BY agent, session, project_id, hour
                 ORDER BY hour ASC, agent ASC, session ASC
                 LIMIT ?",
            )
            .bind(user_id)
            .bind(start.max(0.0) as u32)
            .bind(end.max(0.0) as u32)
            .bind(AGENT_UNIVERSE_MAX_ROWS as u64 + 1)
            .fetch_all::<AgentHourRow>()
            .await
            .map_err(|error| anyhow::anyhow!("Agent universe query failed: {error}"))
    }

    /// Agent heartbeats with `from <= time <= until`. `until` is a little past `now` so a
    /// slightly fast client clock still shows up; rows after `now` are counted for the service
    /// to clamp.
    pub async fn live(
        &self,
        user_id: Uuid,
        from: f64,
        now: f64,
        until: f64,
    ) -> Result<Vec<AgentLiveRow>> {
        let relation = canonical_winner_relation(
            "h.user_id = ? AND h.date >= toDate(toDateTime(toUInt32(?))) \
             AND h.date <= toDate(toDateTime(toUInt32(?))) AND h.time >= ? AND h.time <= ? \
             AND ifNull(h.ai_agent, '') != ''",
            "h",
        );
        let actor = crate::services::ai_stats::effective_actor_type_expr();
        let query = format!(
            "SELECT ifNull(h.ai_agent, '') AS agent,
                    h.project_id AS project_id,
                    count() AS heartbeats,
                    max(h.time) AS last_time,
                    countIf(h.time > ?) AS future_heartbeats,
                    argMax(ifNull(h.ai_model, ''), h.time) AS model,
                    toBool(({actor}) = 'ai_verified') AS verified
             FROM {relation}
             GROUP BY agent, project_id, verified
             ORDER BY last_time DESC, agent ASC
             LIMIT ?"
        );
        self.client
            .get_client()
            .query(&query)
            .bind(now)
            .bind(user_id)
            .bind(from)
            .bind(until)
            .bind(from)
            .bind(until)
            .bind(AGENT_LIVE_MAX_ROWS as u64 + 1)
            .fetch_all::<AgentLiveRow>()
            .await
            .map_err(|error| anyhow::anyhow!("Agent live query failed: {error}"))
    }

    pub async fn project_names(
        &self,
        user_id: Uuid,
        project_ids: &[Uuid],
    ) -> Result<Vec<ProjectNameRow>> {
        if project_ids.is_empty() {
            return Ok(Vec::new());
        }
        self.client
            .get_client()
            .query(
                "SELECT toString(project_id) AS id, argMax(display_name, version) AS name
                 FROM wakaclock.project_identities
                 WHERE user_id = ? AND project_id IN ?
                 GROUP BY project_id",
            )
            .bind(user_id)
            .bind(project_ids)
            .fetch_all::<ProjectNameRow>()
            .await
            .map_err(|error| anyhow::anyhow!("Agent universe project query failed: {error}"))
    }
}
