//! Read-only authoritative queries for Phase 9 project analytics.
//!
//! These read raw heartbeats keyed by the stable project ID. The versioned daily tables
//! remain the rebuild/performance path; raw reads keep a newly ingested project visible
//! before its first scheduled rebuild and never manufacture a zero from a missing snapshot.

use anyhow::Result;
use clickhouse::Row;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;

pub struct ProjectAnalyticsRepository {
    client: Arc<ClickHouseClient>,
}

impl ProjectAnalyticsRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    pub async fn project_aggregates(
        &self,
        user_id: Uuid,
        start_epoch: f64,
        end_epoch: f64,
        branch: Option<&str>,
    ) -> Result<Vec<ProjectAggregateRow>> {
        let mut sql = String::from(
            "SELECT
                    assumeNotNull(h.project_id) AS project_id,
                    if(empty(i.display_name), 'Unknown', i.display_name) AS name,
                    i.repository AS repository,
                    max(h.time) AS last_activity,
                    sum(ifNull(h.active_seconds, 0.0)) AS total_seconds,
                    sum(toUInt64(ifNull(h.ai_lines_added, 0))) AS ai_added,
                    sum(toUInt64(ifNull(h.ai_lines_deleted, 0))) AS ai_deleted,
                    sum(toUInt64(ifNull(h.human_lines_added, 0))) AS human_added,
                    sum(toUInt64(ifNull(h.human_lines_deleted, 0))) AS human_deleted,
                    sum(toUInt64(ifNull(h.unattributed_lines_added, 0))) AS unattributed_added,
                    sum(toUInt64(ifNull(h.unattributed_lines_deleted, 0))) AS unattributed_deleted,
                    countIf(isNull(h.unattributed_lines_added) OR isNull(h.unattributed_lines_deleted)) AS unattributed_unknown,
                    ifNull(u.prompts, 0) AS prompts,
                    ifNull(u.sessions, 0) AS sessions,
                    ifNull(u.input_tokens, 0) AS input_tokens,
                    ifNull(u.output_tokens, 0) AS output_tokens,
                    ifNull(u.cache_read_tokens, 0) AS cache_read_tokens,
                    ifNull(u.cache_write_tokens, 0) AS cache_write_tokens,
                    ifNull(u.reported_tokens, 0) AS reported_tokens,
                    ifNull(u.priced_tokens, 0) AS priced_tokens,
                    ifNull(u.estimated_cost_microusd, 0) AS estimated_cost_microusd,
                    ifNull(u.usage_events, 0) AS usage_events,
                    ifNull(u.priced_events, 0) AS priced_events
                 FROM wakaclock.heartbeats AS h
                 INNER JOIN (
                    SELECT user_id, project_id,
                           argMax(display_name, version) AS display_name,
                           argMax(repository, version) AS repository
                    FROM wakaclock.project_identities FINAL
                    GROUP BY user_id, project_id
                 ) AS i ON h.user_id = i.user_id AND h.project_id = i.project_id
                 LEFT JOIN (
                    SELECT user_id, project_id,
                           sum(prompt_count) AS prompts,
                           uniqExact(ai_session_id) AS sessions,
                           sum(toUInt64(ifNull(input_tokens, 0))) AS input_tokens,
                           sum(toUInt64(ifNull(output_tokens, 0))) AS output_tokens,
                           sum(toUInt64(ifNull(cache_read_tokens, 0))) AS cache_read_tokens,
                           sum(toUInt64(ifNull(cache_write_tokens, 0))) AS cache_write_tokens,
                           sum(toUInt64(ifNull(input_tokens, 0) + ifNull(output_tokens, 0) + ifNull(cache_read_tokens, 0) + ifNull(cache_write_tokens, 0))) AS reported_tokens,
                           sumIf(toUInt64(ifNull(input_tokens, 0) + ifNull(output_tokens, 0) + ifNull(cache_read_tokens, 0) + ifNull(cache_write_tokens, 0)), isNotNull(estimated_cost_microusd)) AS priced_tokens,
                           sum(toUInt64(ifNull(estimated_cost_microusd, 0))) AS estimated_cost_microusd,
                           count() AS usage_events,
                           countIf(isNotNull(estimated_cost_microusd)) AS priced_events
                    FROM wakaclock.ai_usage_events FINAL
                    WHERE user_id = ? AND event_time >= ? AND event_time < ?
                      AND project_id IS NOT NULL
                    GROUP BY user_id, project_id
                 ) AS u ON h.user_id = u.user_id AND h.project_id = u.project_id
                 WHERE h.user_id = ?
                   AND h.time >= ? AND h.time < ?
                   AND h.project_id IS NOT NULL",
        );
        if branch.is_some() {
            sql.push_str(
                " AND if(empty(ifNull(h.branch, '')), 'Unknown', ifNull(h.branch, '')) = ?",
            );
        }
        sql.push_str(" GROUP BY h.project_id, name, repository");

        let query = self
            .client
            .get_client()
            .query(&sql)
            .bind(user_id)
            .bind(start_epoch.max(0.0) as u32)
            .bind(end_epoch.max(0.0) as u32)
            .bind(user_id)
            .bind(start_epoch)
            .bind(end_epoch);
        let query = if let Some(branch) = branch {
            query.bind(branch)
        } else {
            query
        };
        query
            .fetch_all::<ProjectAggregateRow>()
            .await
            .map_err(|error| anyhow::anyhow!("Project analytics aggregate query failed: {error}"))
    }

    pub async fn project_daily(
        &self,
        user_id: Uuid,
        project_id: Uuid,
        timezone: &str,
        start_epoch: f64,
        end_epoch: f64,
        branch: Option<&str>,
    ) -> Result<Vec<ProjectDailyRow>> {
        let (sql, has_branch) = scoped_sql(
            "SELECT toString(toDate(toDateTime(toUInt32(h.time), ?))) AS date,
                    sum(ifNull(h.active_seconds, 0.0)) AS total_seconds,
                    sum(toUInt64(ifNull(h.ai_lines_added, 0))) AS ai_added,
                    sum(toUInt64(ifNull(h.ai_lines_deleted, 0))) AS ai_deleted,
                    sum(toUInt64(ifNull(h.human_lines_added, 0))) AS human_added,
                    sum(toUInt64(ifNull(h.human_lines_deleted, 0))) AS human_deleted,
                    sum(toUInt64(ifNull(h.unattributed_lines_added, 0))) AS unattributed_added,
                    sum(toUInt64(ifNull(h.unattributed_lines_deleted, 0))) AS unattributed_deleted,
                    countIf(isNull(h.unattributed_lines_added) OR isNull(h.unattributed_lines_deleted)) AS unattributed_unknown
             FROM wakaclock.heartbeats AS h
             WHERE h.user_id = ? AND h.project_id = ?
               AND h.time >= ? AND h.time < ?",
            " GROUP BY date ORDER BY date ASC",
            branch,
        );
        let query = self
            .client
            .get_client()
            .query(&sql)
            .bind(timezone)
            .bind(user_id)
            .bind(project_id)
            .bind(start_epoch)
            .bind(end_epoch);
        let query = if has_branch {
            query.bind(branch.expect("branch is bound when condition exists"))
        } else {
            query
        };
        query
            .fetch_all::<ProjectDailyRow>()
            .await
            .map_err(|error| anyhow::anyhow!("Project daily query failed: {error}"))
    }

    pub async fn project_breakdowns(
        &self,
        table: ProjectBreakdownTable,
        user_id: Uuid,
        project_id: Uuid,
        start_epoch: f64,
        end_epoch: f64,
        branch: Option<&str>,
    ) -> Result<Vec<ProjectBreakdownRow>> {
        let dimension = match table {
            ProjectBreakdownTable::Editor => "ifNull(nullIf(ifNull(editor, ''), ''), 'Unknown')",
            ProjectBreakdownTable::Language => {
                "ifNull(nullIf(ifNull(language, ''), ''), 'Unknown')"
            }
        };
        let base = format!(
            "SELECT {dimension} AS name, sum(ifNull(active_seconds, 0.0)) AS total_seconds
             FROM wakaclock.heartbeats
             WHERE user_id = ? AND project_id = ?
               AND time >= ? AND time < ?"
        );
        let (sql, has_branch) = scoped_sql(
            &base,
            " GROUP BY name ORDER BY total_seconds DESC, name ASC",
            branch,
        );
        let query = self
            .client
            .get_client()
            .query(&sql)
            .bind(user_id)
            .bind(project_id)
            .bind(start_epoch)
            .bind(end_epoch);
        let query = if has_branch {
            query.bind(branch.expect("branch is bound when condition exists"))
        } else {
            query
        };
        query
            .fetch_all::<ProjectBreakdownRow>()
            .await
            .map_err(|error| anyhow::anyhow!("Project breakdown query failed: {error}"))
    }

    pub async fn project_branches(
        &self,
        user_id: Uuid,
        project_id: Uuid,
        start_epoch: f64,
        end_epoch: f64,
    ) -> Result<Vec<ProjectBranchRow>> {
        self.client
            .get_client()
            .query(
                "SELECT if(empty(ifNull(branch, '')), 'Unknown', ifNull(branch, '')) AS branch,
                        sum(ifNull(active_seconds, 0.0)) AS total_seconds,
                        count() AS heartbeat_count,
                        sum(toUInt64(ifNull(ai_lines_added, 0) + ifNull(ai_lines_deleted, 0))) AS ai_changes,
                        sum(toUInt64(ifNull(human_lines_added, 0) + ifNull(human_lines_deleted, 0))) AS human_changes,
                        sum(toUInt64(ifNull(unattributed_lines_added, 0) + ifNull(unattributed_lines_deleted, 0))) AS unattributed_changes,
                        countIf(isNull(unattributed_lines_added) OR isNull(unattributed_lines_deleted)) AS unattributed_unknown
                 FROM wakaclock.heartbeats
                 WHERE user_id = ? AND project_id = ?
                   AND time >= ? AND time < ?
                 GROUP BY branch
                 ORDER BY total_seconds DESC, branch ASC",
            )
            .bind(user_id)
            .bind(project_id)
            .bind(start_epoch)
            .bind(end_epoch)
            .fetch_all::<ProjectBranchRow>()
            .await
            .map_err(|error| anyhow::anyhow!("Project branches query failed: {error}"))
    }

    pub async fn project_files(
        &self,
        user_id: Uuid,
        project_id: Uuid,
        start_epoch: f64,
        end_epoch: f64,
        branch: Option<&str>,
    ) -> Result<Vec<ProjectFileRow>> {
        let (sql, has_branch) = scoped_sql(
            "SELECT lower(hex(SHA256(entity))) AS entity_key,
                    if(startsWith(entity, '/') OR position(entity, '..') > 0,
                       replaceRegexpOne(entity, '^.*/', ''), entity) AS path,
                    if(empty(ifNull(language, '')), 'Unknown', ifNull(language, '')) AS language,
                    sum(ifNull(active_seconds, 0.0)) AS total_seconds,
                    sum(toUInt64(ifNull(ai_lines_added, 0) + ifNull(ai_lines_deleted, 0))) AS ai_changes,
                    sum(toUInt64(ifNull(human_lines_added, 0) + ifNull(human_lines_deleted, 0))) AS human_changes,
                    sum(toUInt64(ifNull(unattributed_lines_added, 0) + ifNull(unattributed_lines_deleted, 0))) AS unattributed_changes,
                    countIf(isNull(unattributed_lines_added) OR isNull(unattributed_lines_deleted)) AS unattributed_unknown
             FROM wakaclock.heartbeats
             WHERE user_id = ? AND project_id = ?
               AND time >= ? AND time < ?",
            " GROUP BY entity_key, path, language ORDER BY total_seconds DESC, path ASC",
            branch,
        );
        let query = self
            .client
            .get_client()
            .query(&sql)
            .bind(user_id)
            .bind(project_id)
            .bind(start_epoch)
            .bind(end_epoch);
        let query = if has_branch {
            query.bind(branch.expect("branch is bound when condition exists"))
        } else {
            query
        };
        query
            .fetch_all::<ProjectFileRow>()
            .await
            .map_err(|error| anyhow::anyhow!("Project files query failed: {error}"))
    }

    pub async fn all_projects_seconds(
        &self,
        user_id: Uuid,
        start_epoch: f64,
        end_epoch: f64,
    ) -> Result<f64> {
        self.client
            .get_client()
            .query(
                "SELECT sum(ifNull(active_seconds, 0.0)) FROM wakaclock.heartbeats
                 WHERE user_id = ? AND time >= ? AND time < ?",
            )
            .bind(user_id)
            .bind(start_epoch)
            .bind(end_epoch)
            .fetch_one::<f64>()
            .await
            .map_err(|error| anyhow::anyhow!("All-project duration query failed: {error}"))
    }
}

fn scoped_sql(base: &str, suffix: &str, branch: Option<&str>) -> (String, bool) {
    match branch {
        Some(_) => (
            format!(
                "{base} AND if(empty(ifNull(branch, '')), 'Unknown', ifNull(branch, '')) = ?{suffix}"
            ),
            true,
        ),
        None => (format!("{base}{suffix}"), false),
    }
}

#[derive(Clone, Copy)]
pub enum ProjectBreakdownTable {
    Editor,
    Language,
}

#[derive(Debug, Deserialize, Row)]
pub struct ProjectAggregateRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub project_id: Uuid,
    pub name: String,
    pub repository: String,
    pub last_activity: f64,
    pub total_seconds: f64,
    pub ai_added: u64,
    pub ai_deleted: u64,
    pub human_added: u64,
    pub human_deleted: u64,
    pub unattributed_added: u64,
    pub unattributed_deleted: u64,
    pub unattributed_unknown: u64,
    pub prompts: u64,
    pub sessions: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub reported_tokens: u64,
    pub priced_tokens: u64,
    pub estimated_cost_microusd: u64,
    pub usage_events: u64,
    pub priced_events: u64,
}

#[derive(Clone, Debug, Deserialize, Row)]
pub struct ProjectDailyRow {
    pub date: String,
    pub total_seconds: f64,
    pub ai_added: u64,
    pub ai_deleted: u64,
    pub human_added: u64,
    pub human_deleted: u64,
    pub unattributed_added: u64,
    pub unattributed_deleted: u64,
    pub unattributed_unknown: u64,
}

#[derive(Debug, Deserialize, Row)]
pub struct ProjectBreakdownRow {
    pub name: String,
    pub total_seconds: f64,
}

#[derive(Clone, Debug, Deserialize, Row)]
pub struct ProjectBranchRow {
    pub branch: String,
    pub total_seconds: f64,
    pub heartbeat_count: u64,
    pub ai_changes: u64,
    pub human_changes: u64,
    pub unattributed_changes: u64,
    pub unattributed_unknown: u64,
}

#[derive(Clone, Debug, Deserialize, Row)]
pub struct ProjectFileRow {
    pub entity_key: String,
    pub path: String,
    pub language: String,
    pub total_seconds: f64,
    pub ai_changes: u64,
    pub human_changes: u64,
    pub unattributed_changes: u64,
    pub unattributed_unknown: u64,
}
