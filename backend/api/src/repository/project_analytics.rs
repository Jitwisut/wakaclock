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
                    sumIf(toUInt64(ifNull(h.ai_lines_added, 0)), h.actor_type = 'ai_verified') AS ai_verified_added,
                    sumIf(toUInt64(ifNull(h.ai_lines_deleted, 0)), h.actor_type = 'ai_verified') AS ai_verified_deleted,
                    sumIf(toUInt64(ifNull(h.ai_lines_added, 0)), h.actor_type = 'ai_inferred') AS ai_inferred_added,
                    sumIf(toUInt64(ifNull(h.ai_lines_deleted, 0)), h.actor_type = 'ai_inferred') AS ai_inferred_deleted,
                    sumIf(toUInt64(ifNull(h.ai_lines_added, 0)), h.actor_type IN ('ai_verified', 'ai_inferred')) AS ai_added,
                    sumIf(toUInt64(ifNull(h.ai_lines_deleted, 0)), h.actor_type IN ('ai_verified', 'ai_inferred')) AS ai_deleted,
                    sumIf(toUInt64(ifNull(h.human_lines_added, 0)), h.actor_type = 'human') AS human_added,
                    sumIf(toUInt64(ifNull(h.human_lines_deleted, 0)), h.actor_type = 'human') AS human_deleted,
                    sum(toUInt64(ifNull(h.unattributed_lines_added, 0)))
                        + sumIf(toUInt64(ifNull(h.ai_lines_added, 0) + ifNull(h.human_lines_added, 0)), h.actor_type = 'unknown') AS unattributed_added,
                    sum(toUInt64(ifNull(h.unattributed_lines_deleted, 0)))
                        + sumIf(toUInt64(ifNull(h.ai_lines_deleted, 0) + ifNull(h.human_lines_deleted, 0)), h.actor_type = 'unknown') AS unattributed_deleted,
                    countIf(h.actor_type = 'unknown') AS unattributed_unknown,
                    ifNull(any(u.prompts), 0) AS prompts,
                    ifNull(any(u.sessions), 0) AS sessions,
                    ifNull(any(u.input_tokens), 0) AS input_tokens,
                    ifNull(any(u.output_tokens), 0) AS output_tokens,
                    ifNull(any(u.cache_read_tokens), 0) AS cache_read_tokens,
                    ifNull(any(u.cache_write_tokens), 0) AS cache_write_tokens,
                    ifNull(any(u.reported_tokens), 0) AS reported_tokens,
                    ifNull(any(u.priced_tokens), 0) AS priced_tokens,
                    ifNull(any(u.estimated_cost_microusd), 0) AS estimated_cost_microusd,
                    ifNull(any(u.usage_events), 0) AS usage_events,
                    ifNull(any(u.priced_events), 0) AS priced_events
                 FROM wakaclock.heartbeats_canonical AS h
                 INNER JOIN (
                    SELECT user_id, project_id,
                           argMax(display_name, version) AS display_name,
                           argMax(repository, version) AS repository
                    FROM wakaclock.project_identities FINAL
                    GROUP BY user_id, project_id
                 ) AS i ON h.user_id = i.user_id AND h.project_id = i.project_id
                 LEFT JOIN (
                    SELECT user_id, project_id,
                           sum(toUInt64(ifNull(usage.prompt_count, 0))) AS prompts,
                           uniqExact(usage.ai_session_id) AS sessions,
                           sum(toUInt64(ifNull(usage.input_tokens, 0))) AS input_tokens,
                           sum(toUInt64(ifNull(usage.output_tokens, 0))) AS output_tokens,
                           sum(toUInt64(ifNull(usage.cache_read_tokens, 0))) AS cache_read_tokens,
                           sum(toUInt64(ifNull(usage.cache_write_tokens, 0))) AS cache_write_tokens,
                           sum(toUInt64(ifNull(usage.input_tokens, 0) + ifNull(usage.output_tokens, 0) + ifNull(usage.cache_read_tokens, 0) + ifNull(usage.cache_write_tokens, 0))) AS reported_tokens,
                           sumIf(toUInt64(ifNull(usage.input_tokens, 0) + ifNull(usage.output_tokens, 0) + ifNull(usage.cache_read_tokens, 0) + ifNull(usage.cache_write_tokens, 0)), isNotNull(usage.estimated_cost_microusd)) AS priced_tokens,
                           sum(toUInt64(ifNull(usage.estimated_cost_microusd, 0))) AS estimated_cost_microusd,
                           count() AS usage_events,
                           countIf(isNotNull(usage.estimated_cost_microusd)) AS priced_events
                    FROM wakaclock.ai_usage_events AS usage FINAL
                    WHERE usage.user_id = ? AND usage.event_time >= ? AND usage.event_time < ?
                      AND usage.project_id IS NOT NULL
                    GROUP BY usage.user_id, usage.project_id
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
                    sumIf(toUInt64(ifNull(h.ai_lines_added, 0)), h.actor_type = 'ai_verified') AS ai_verified_added,
                    sumIf(toUInt64(ifNull(h.ai_lines_deleted, 0)), h.actor_type = 'ai_verified') AS ai_verified_deleted,
                    sumIf(toUInt64(ifNull(h.ai_lines_added, 0)), h.actor_type = 'ai_inferred') AS ai_inferred_added,
                    sumIf(toUInt64(ifNull(h.ai_lines_deleted, 0)), h.actor_type = 'ai_inferred') AS ai_inferred_deleted,
                    sumIf(toUInt64(ifNull(h.ai_lines_added, 0)), h.actor_type IN ('ai_verified', 'ai_inferred')) AS ai_added,
                    sumIf(toUInt64(ifNull(h.ai_lines_deleted, 0)), h.actor_type IN ('ai_verified', 'ai_inferred')) AS ai_deleted,
                    sumIf(toUInt64(ifNull(h.human_lines_added, 0)), h.actor_type = 'human') AS human_added,
                    sumIf(toUInt64(ifNull(h.human_lines_deleted, 0)), h.actor_type = 'human') AS human_deleted,
                    sum(toUInt64(ifNull(h.unattributed_lines_added, 0)))
                        + sumIf(toUInt64(ifNull(h.ai_lines_added, 0) + ifNull(h.human_lines_added, 0)), h.actor_type = 'unknown') AS unattributed_added,
                    sum(toUInt64(ifNull(h.unattributed_lines_deleted, 0)))
                        + sumIf(toUInt64(ifNull(h.ai_lines_deleted, 0) + ifNull(h.human_lines_deleted, 0)), h.actor_type = 'unknown') AS unattributed_deleted,
                    countIf(h.actor_type = 'unknown') AS unattributed_unknown
             FROM wakaclock.heartbeats_canonical AS h
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
             FROM wakaclock.heartbeats_canonical
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
                        sumIf(toUInt64(ifNull(ai_lines_added, 0) + ifNull(ai_lines_deleted, 0)), actor_type = 'ai_verified') AS ai_verified_changes,
                        sumIf(toUInt64(ifNull(ai_lines_added, 0) + ifNull(ai_lines_deleted, 0)), actor_type = 'ai_inferred') AS ai_inferred_changes,
                        sumIf(toUInt64(ifNull(ai_lines_added, 0) + ifNull(ai_lines_deleted, 0)), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_changes,
                        sumIf(toUInt64(ifNull(human_lines_added, 0) + ifNull(human_lines_deleted, 0)), actor_type = 'human') AS human_changes,
                        sum(toUInt64(ifNull(unattributed_lines_added, 0) + ifNull(unattributed_lines_deleted, 0)))
                            + sumIf(toUInt64(ifNull(ai_lines_added, 0) + ifNull(ai_lines_deleted, 0) + ifNull(human_lines_added, 0) + ifNull(human_lines_deleted, 0)), actor_type = 'unknown') AS unattributed_changes,
                        countIf(actor_type = 'unknown') AS unattributed_unknown
                 FROM wakaclock.heartbeats_canonical
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
                    sumIf(toUInt64(ifNull(ai_lines_added, 0) + ifNull(ai_lines_deleted, 0)), actor_type = 'ai_verified') AS ai_verified_changes,
                    sumIf(toUInt64(ifNull(ai_lines_added, 0) + ifNull(ai_lines_deleted, 0)), actor_type = 'ai_inferred') AS ai_inferred_changes,
                    sumIf(toUInt64(ifNull(ai_lines_added, 0) + ifNull(ai_lines_deleted, 0)), actor_type IN ('ai_verified', 'ai_inferred')) AS ai_changes,
                    sumIf(toUInt64(ifNull(human_lines_added, 0) + ifNull(human_lines_deleted, 0)), actor_type = 'human') AS human_changes,
                    sum(toUInt64(ifNull(unattributed_lines_added, 0) + ifNull(unattributed_lines_deleted, 0)))
                        + sumIf(toUInt64(ifNull(ai_lines_added, 0) + ifNull(ai_lines_deleted, 0) + ifNull(human_lines_added, 0) + ifNull(human_lines_deleted, 0)), actor_type = 'unknown') AS unattributed_changes,
                    countIf(actor_type = 'unknown') AS unattributed_unknown
             FROM wakaclock.heartbeats_canonical
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
    pub ai_verified_added: u64,
    pub ai_verified_deleted: u64,
    pub ai_inferred_added: u64,
    pub ai_inferred_deleted: u64,
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
    pub ai_verified_added: u64,
    pub ai_verified_deleted: u64,
    pub ai_inferred_added: u64,
    pub ai_inferred_deleted: u64,
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
    pub ai_verified_changes: u64,
    pub ai_inferred_changes: u64,
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
    pub ai_verified_changes: u64,
    pub ai_inferred_changes: u64,
    pub ai_changes: u64,
    pub human_changes: u64,
    pub unattributed_changes: u64,
    pub unattributed_unknown: u64,
}

#[cfg(test)]
mod tests {
    use chrono::NaiveDate;
    use uuid::Uuid;

    use crate::model::ai_usage::AiUsageEventRow;
    use crate::model::date_range::ResolvedRange;
    use crate::model::heartbeat::HeartbeatRow;
    use crate::model::project_identity::ProjectIdentityRow;
    use crate::repository::ai_usage::AiUsageRepository;
    use crate::repository::analytics::AnalyticsRepository;
    use crate::repository::heartbeat::HeartbeatRepository;
    use crate::repository::project_identity::ProjectIdentityRepository;

    use super::ProjectAnalyticsRepository;

    #[tokio::test]
    #[ignore = "requires an isolated ClickHouse 24.10 instance via CLICKHOUSE_TEST_URL"]
    async fn project_aggregates_handle_multiple_usage_events_without_nested_aggregates() {
        let clickhouse = crate::test_support::clickhouse_client().await;
        let heartbeat_repo = HeartbeatRepository::new(clickhouse.clone());
        let identity_repo = ProjectIdentityRepository::new(clickhouse.clone());
        let usage_repo = AiUsageRepository::new(clickhouse.clone());
        heartbeat_repo.migrate().await.unwrap();
        let analytics_repo = AnalyticsRepository::new(clickhouse.clone());
        analytics_repo.migrate().await.unwrap();
        analytics_repo
            .migrate()
            .await
            .expect("analytics schema migration should be repeatable");
        identity_repo.migrate().await.unwrap();
        usage_repo.migrate().await.unwrap();

        let user_id = Uuid::new_v4();
        let project_id = Uuid::new_v4();
        let day = NaiveDate::from_ymd_opt(2026, 8, 1).unwrap();
        let unix_day = day
            .signed_duration_since(NaiveDate::from_ymd_opt(1970, 1, 1).unwrap())
            .num_days() as u32;
        let event_base = unix_day * 86_400;

        identity_repo
            .upsert_identity(&ProjectIdentityRow {
                user_id,
                project_id,
                canonical_name: "demo".to_string(),
                display_name: "Demo".to_string(),
                repository: "https://example.com/demo".to_string(),
                root_fingerprint: "test-root".to_string(),
                first_heartbeat_at: event_base,
                last_heartbeat_at: event_base + 180,
                created_at: event_base,
                updated_at: event_base,
                version: 1,
            })
            .await
            .unwrap();

        let human_row = HeartbeatRow {
            user_id,
            entity: "src/main.rs".to_string(),
            entity_type: "file".to_string(),
            time: (event_base + 180) as f64,
            date: unix_day as u16,
            project: Some("demo".to_string()),
            project_id: Some(project_id),
            branch: Some("main".to_string()),
            head_revision: Some("abc123".to_string()),
            repository_id: None,
            language: Some("Rust".to_string()),
            dependencies: Vec::new(),
            lines: Some(10),
            line_number: None,
            cursor_position: None,
            is_write: false,
            category: "coding".to_string(),
            editor: "vscode".to_string(),
            operating_system: "macos".to_string(),
            machine: "test".to_string(),
            user_agent: "test".to_string(),
            machine_name_hash: None,
            hostname_hash: None,
            timezone: Some("UTC".to_string()),
            feature_id: None,
            feature_name: None,
            heartbeat_id: Some("project-regression-heartbeat".to_string()),
            ast_language: None,
            ast_confidence: None,
            keystrokes: None,
            chars_added: None,
            chars_deleted: None,
            active_seconds: Some(60.0),
            active_seconds_claimed: Some(60.0),
            activity_segments: "[]".to_string(),
            is_ai_generated: false,
            ai_agent: None,
            ai_provider: None,
            ai_model: None,
            ai_source: None,
            ai_confidence: None,
            ai_event_id: None,
            ai_change_id: None,
            prompt_character_count: None,
            input_tokens: None,
            output_tokens: None,
            cache_read_tokens: None,
            cache_write_tokens: None,
            ai_subscription_plan: None,
            token_source: None,
            attribution_source: None,
            attribution_confidence: None,
            ai_event_fingerprint: None,
            ai_lines_added: Some(2),
            ai_lines_deleted: Some(1),
            human_lines_added: Some(3),
            human_lines_deleted: Some(1),
            unattributed_lines_added: Some(0),
            unattributed_lines_deleted: Some(0),
            created_at: event_base,
            actor_type: "human".to_string(),
            actor_confidence: 1.0,
            clipboard_tracking_version: None,
            copy_actions: None,
            paste_actions: None,
            copied_chars: None,
            copied_lines: None,
            pasted_chars: None,
            pasted_lines: None,
            paste_same_file_actions: None,
            paste_same_workspace_actions: None,
            paste_external_or_unknown_actions: None,
            revision: 0,
        };
        let mut unknown_row = human_row.clone();
        unknown_row.time = (event_base + 240) as f64;
        unknown_row.heartbeat_id = Some("project-regression-unknown".to_string());
        unknown_row.actor_type = "unknown".to_string();
        unknown_row.actor_confidence = 0.0;
        unknown_row.ai_lines_added = None;
        unknown_row.ai_lines_deleted = None;
        unknown_row.human_lines_added = Some(5);
        unknown_row.human_lines_deleted = Some(2);
        unknown_row.unattributed_lines_added = Some(4);
        unknown_row.unattributed_lines_deleted = Some(1);

        heartbeat_repo
            .insert_batch(vec![human_row, unknown_row])
            .await
            .unwrap();

        usage_repo
            .insert_usage_events(&[
                AiUsageEventRow {
                    user_id,
                    date: unix_day as u16,
                    usage_event_id: "project-regression-priced".to_string(),
                    ai_session_id: "project-session-priced".to_string(),
                    event_time: event_base + 60,
                    project_id: Some(project_id),
                    ai_agent: "test".to_string(),
                    ai_provider: Some("test".to_string()),
                    ai_model: Some("test".to_string()),
                    prompt_count: 2,
                    prompt_character_count: Some(16),
                    input_tokens: Some(100),
                    output_tokens: Some(20),
                    cache_read_tokens: Some(10),
                    cache_write_tokens: Some(5),
                    estimated_cost_microusd: Some(123),
                    pricing_version: Some("test".to_string()),
                    token_source: "reported".to_string(),
                    version: 1,
                    received_at: event_base + 60,
                },
                AiUsageEventRow {
                    user_id,
                    date: unix_day as u16,
                    usage_event_id: "project-regression-unpriced".to_string(),
                    ai_session_id: "project-session-unpriced".to_string(),
                    event_time: event_base + 120,
                    project_id: Some(project_id),
                    ai_agent: "test".to_string(),
                    ai_provider: None,
                    ai_model: None,
                    prompt_count: 3,
                    prompt_character_count: None,
                    input_tokens: Some(50),
                    output_tokens: Some(30),
                    cache_read_tokens: Some(0),
                    cache_write_tokens: Some(0),
                    estimated_cost_microusd: None,
                    pricing_version: None,
                    token_source: "reported".to_string(),
                    version: 1,
                    received_at: event_base + 120,
                },
            ])
            .await
            .unwrap();

        let range = ResolvedRange::parse("2026-08-01", "2026-08-01", Some("UTC")).unwrap();
        let (start_epoch, end_epoch) = range.unix_bounds();
        let rows = ProjectAnalyticsRepository::new(clickhouse)
            .project_aggregates(user_id, start_epoch, end_epoch, None)
            .await
            .unwrap();
        let row = rows.first().expect("the seeded project should be returned");

        // The raw row deliberately carries both legacy-looking counter families while
        // its canonical actor is Human. Project analytics must follow actor_type and
        // must not resurrect the old boolean/counter heuristic.
        assert_eq!(row.ai_verified_added, 0);
        assert_eq!(row.ai_verified_deleted, 0);
        assert_eq!(row.ai_inferred_added, 0);
        assert_eq!(row.ai_inferred_deleted, 0);
        assert_eq!(row.ai_added, 0);
        assert_eq!(row.ai_deleted, 0);
        assert_eq!(row.human_added, 3);
        assert_eq!(row.human_deleted, 1);
        assert_eq!(row.unattributed_added, 9);
        assert_eq!(row.unattributed_deleted, 3);
        assert_eq!(row.unattributed_unknown, 1);
        assert_eq!(row.prompts, 5);
        assert_eq!(row.sessions, 2);
        assert_eq!(row.input_tokens, 150);
        assert_eq!(row.output_tokens, 50);
        assert_eq!(row.cache_read_tokens, 10);
        assert_eq!(row.cache_write_tokens, 5);
        assert_eq!(row.reported_tokens, 215);
        assert_eq!(row.priced_tokens, 135);
        assert_eq!(row.estimated_cost_microusd, 123);
        assert_eq!(row.usage_events, 2);
        assert_eq!(row.priced_events, 1);
    }
}
