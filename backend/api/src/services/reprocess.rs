use anyhow::{anyhow, Context, Result};
use regex::Regex;
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
    time::Instant,
};
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::date_range::MAX_RANGE_DAYS;
use crate::model::heartbeat::{ActivityIntervalRow, HeartbeatRow};
use crate::model::project_rule::ProjectRuleRow;
use crate::model::reprocess::ReprocessData;
use crate::services::account_analytics::AccountAnalyticsService;
use crate::services::heartbeat::clamp_to_evidence_window;
use crate::services::project_identity::ProjectIdentityService;
use crate::services::project_rule::ProjectRuleService;
use wakaclock_core::heartbeat::ActivitySegment;

const AGGREGATE_TABLES: &[&str] = &[
    "daily_totals",
    "language_daily",
    "project_daily",
    "editor_daily",
    "os_daily",
    "insights_agg",
    "ai_daily",
    "actor_daily_v2",
    "keystroke_daily",
];

pub struct ReprocessService {
    postgres: Option<Arc<crate::infrastructure::postgres::PostgresClient>>,
    account_analytics_service: Arc<AccountAnalyticsService>,
    clickhouse: Arc<ClickHouseClient>,
    project_identity_service: Arc<ProjectIdentityService>,
    project_rule_service: Arc<ProjectRuleService>,
}

impl ReprocessService {
    pub fn new(
        postgres: Option<Arc<crate::infrastructure::postgres::PostgresClient>>,
        clickhouse: Arc<ClickHouseClient>,
        project_rule_service: Arc<ProjectRuleService>,
        project_identity_service: Arc<ProjectIdentityService>,
        account_analytics_service: Arc<AccountAnalyticsService>,
    ) -> Self {
        Self {
            postgres,
            account_analytics_service,
            clickhouse,
            project_identity_service,
            project_rule_service,
        }
    }

    pub async fn migrate(&self) -> Result<()> {
        self.clickhouse
            .get_client()
            .query(
                "CREATE TABLE IF NOT EXISTS wakaclock.analytics_reprocess_audits (
                    audit_id UUID,
                    user_id UUID,
                    start Date,
                    end Date,
                    dry_run Bool,
                    status String,
                    source_heartbeats UInt64,
                    resolved_heartbeats UInt64,
                    unresolved_heartbeats UInt64,
                    project_ids_written UInt64,
                    data_version Nullable(UInt64),
                    elapsed_ms UInt64,
                    error_message String,
                    created_at DateTime64(3)
                ) ENGINE = MergeTree()
                ORDER BY (user_id, start, end, created_at, audit_id)",
            )
            .execute()
            .await
            .context("Failed to create analytics_reprocess_audits table")
    }

    pub async fn run(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
        dry_run: bool,
    ) -> Result<ReprocessData> {
        validate_date_range(start, end)?;
        let mut lock_client = if !dry_run {
            Some(
                self.postgres
                    .as_ref()
                    .context("PostgreSQL is required for serialized reprocessing")?
                    .transaction_client()
                    .await?,
            )
        } else {
            None
        };
        let _lock = if let Some(client) = lock_client.as_mut() {
            let transaction = client.transaction().await?;
            transaction
                .query_one(
                    "SELECT pg_advisory_xact_lock(hashtextextended($1, 73109))",
                    &[&user_id.to_string()],
                )
                .await?;
            // ClickHouse replay can exceed a normal request timeout. Keep this dedicated
            // transaction alive until replay completes; dropping it releases the lock.
            transaction
                .batch_execute("SET LOCAL idle_in_transaction_session_timeout = 0")
                .await?;
            Some(transaction)
        } else {
            None
        };
        let audit_id = Uuid::new_v4();
        let started = Instant::now();
        let mut rows = self.fetch_raw_heartbeats(user_id, start, end).await?;
        let source_projects: Vec<_> = rows.iter().map(|row| row.project.clone()).collect();
        let rules = self.compile_rules(user_id).await?;

        for row in &mut rows {
            row.project = resolve_project_with_rules(&rules, &row.entity, row.project.clone());
        }
        // A rule can legitimately recover a heartbeat whose original project was NULL.
        // That row cannot participate in the source-project backfill map (there is no
        // source label to key by), but it is still resolved and apply-mode persists the
        // correction by entity regex below. Keep dry-run accounting aligned with what
        // apply will actually do instead of reporting every recovered NULL as unresolved.
        let rule_resolved_without_source = rows
            .iter()
            .zip(&source_projects)
            .filter(|(row, source_project)| source_project.is_none() && row.project.is_some())
            .count() as u64;
        let (project_counts, unresolved_mappings) = project_mappings(&rows, &source_projects);
        let reprocessed_heartbeats = rows.len();
        let mut backfill = self
            .project_identity_service
            .backfill_historical_projects(user_id, start, end, &project_counts, dry_run)
            .await?;
        backfill.resolved_heartbeats += rule_resolved_without_source;
        backfill.unresolved_heartbeats += unresolved_mappings;

        if !dry_run {
            let rule_project_ids = self
                .persist_rule_project_corrections(user_id, start, end, &rules)
                .await?;
            backfill.resolved_ids.extend(rule_project_ids);
        }

        if dry_run {
            let data = ReprocessData {
                audit_id,
                data_version: None,
                dry_run,
                project_ids_written: 0,
                reprocessed_heartbeats,
                resolved_heartbeats: backfill.resolved_heartbeats,
                unresolved_heartbeats: backfill.unresolved_heartbeats,
                user_id,
                start: start.to_string(),
                end: end.to_string(),
            };
            self.write_audit(&data, "dry_run", "", started.elapsed().as_millis() as u64)
                .await?;
            return Ok(data);
        }

        // Keep the rows replayed through legacy materialized views consistent with the
        // IDs just written to raw history.  The versioned Phase 9 projections are built
        // separately below and published only after their complete snapshot exists.
        for row in &mut rows {
            if let Some(project) = row.project.as_ref() {
                row.project_id = backfill.resolved_ids.get(project).copied();
            }
        }
        let interval_rows = rebuild_activity_intervals(&rows);
        let result = async {
            self.delete_aggregate_range(user_id, start, end).await?;
            self.insert_activity_intervals(interval_rows).await?;
            self.insert_incoming(rows).await?;
            let projection = self
                .account_analytics_service
                .rebuild(user_id, start, end)
                .await?;
            Ok::<_, anyhow::Error>(projection.data_version)
        }
        .await;

        match result {
            Ok(data_version) => {
                let data = ReprocessData {
                    audit_id,
                    data_version: Some(data_version),
                    dry_run,
                    project_ids_written: backfill.project_ids_written,
                    reprocessed_heartbeats,
                    resolved_heartbeats: backfill.resolved_heartbeats,
                    unresolved_heartbeats: backfill.unresolved_heartbeats,
                    user_id,
                    start: start.to_string(),
                    end: end.to_string(),
                };
                self.write_audit(&data, "published", "", started.elapsed().as_millis() as u64)
                    .await?;
                Ok(data)
            }
            Err(error) => {
                let data = ReprocessData {
                    audit_id,
                    data_version: None,
                    dry_run,
                    project_ids_written: backfill.project_ids_written,
                    reprocessed_heartbeats,
                    resolved_heartbeats: backfill.resolved_heartbeats,
                    unresolved_heartbeats: backfill.unresolved_heartbeats,
                    user_id,
                    start: start.to_string(),
                    end: end.to_string(),
                };
                // A completed audit is more important than preserving an opaque error;
                // it records the range and the failed stage without storing source data.
                self.write_audit(
                    &data,
                    "failed",
                    &error.to_string(),
                    started.elapsed().as_millis() as u64,
                )
                .await?;
                Err(error)
            }
        }
    }

    /// Validate a queued request before it is written to PostgreSQL. The synchronous
    /// path calls the same rule at the start of `run`; exposing this small pure check
    /// keeps the job endpoint from accepting an invalid range that would only fail in
    /// the worker later.
    pub fn validate_request(start: &str, end: &str) -> Result<()> {
        validate_date_range(start, end)
    }

    async fn write_audit(
        &self,
        data: &ReprocessData,
        status: &str,
        error_message: &str,
        elapsed_ms: u64,
    ) -> Result<()> {
        self.clickhouse
            .get_client()
            .query(
                "INSERT INTO wakaclock.analytics_reprocess_audits
                 (audit_id, user_id, start, end, dry_run, status, source_heartbeats,
                  resolved_heartbeats, unresolved_heartbeats, project_ids_written,
                  data_version, elapsed_ms, error_message, created_at)
                 VALUES (?, ?, toDate(?), toDate(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, now64(3))",
            )
            .bind(data.audit_id)
            .bind(data.user_id)
            .bind(&data.start)
            .bind(&data.end)
            .bind(data.dry_run)
            .bind(status)
            .bind(data.reprocessed_heartbeats as u64)
            .bind(data.resolved_heartbeats)
            .bind(data.unresolved_heartbeats)
            .bind(data.project_ids_written)
            .bind(data.data_version)
            .bind(elapsed_ms)
            .bind(error_message)
            .execute()
            .await
            .context("Failed to write analytics reprocess audit")
    }

    async fn delete_aggregate_range(&self, user_id: Uuid, start: &str, end: &str) -> Result<()> {
        for table in AGGREGATE_TABLES {
            let sql = format!(
                "ALTER TABLE wakaclock.{table} DELETE WHERE user_id = ? AND toDate(date) BETWEEN toDate(?) AND toDate(?) SETTINGS mutations_sync = 1"
            );

            self.clickhouse
                .get_client()
                .query(&sql)
                .bind(user_id)
                .bind(start)
                .bind(end)
                .execute()
                .await
                .map_err(|error| {
                    anyhow::anyhow!("ClickHouse reprocess delete for {table} failed: {error}")
                })?;
        }

        Ok(())
    }

    async fn fetch_raw_heartbeats(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<Vec<HeartbeatRow>> {
        self.clickhouse
            .get_client()
            .query(
                // Keep this column order exactly aligned with `HeartbeatRow` and
                // `HeartbeatRepository::get_by_date`; clickhouse decodes rows positionally.
                "
                SELECT
                    user_id, entity, entity_type, time, date,
                    project, project_id, branch, head_revision, repository_id,
                    language, dependencies,
                    lines, line_number, cursor_position,
                    is_write, category, editor, operating_system,
                    machine, user_agent, machine_name_hash, hostname_hash, timezone,
                    feature_id, feature_name,
                    heartbeat_id, ast_language, ast_confidence,
                    keystrokes, chars_added, chars_deleted,
                    active_seconds, active_seconds_claimed, activity_segments,
                    is_ai_generated, ai_agent, ai_provider, ai_model,
                    identity_status, identity_reason, identity_source,
                    identity_schema_version, identity_turn_id, identity_message_id,
                    ai_source,
                    ai_confidence, ai_event_id, ai_change_id,
                    prompt_character_count, input_tokens, output_tokens,
                    cache_read_tokens, cache_write_tokens, ai_subscription_plan,
                    token_source, attribution_source, attribution_confidence,
                    ai_event_fingerprint,
                    ai_lines_added, ai_lines_deleted,
                    human_lines_added, human_lines_deleted,
                    unattributed_lines_added, unattributed_lines_deleted,
                    created_at, actor_type, actor_confidence,
                    clipboard_tracking_version, copy_actions, paste_actions,
                    copied_chars, copied_lines, pasted_chars, pasted_lines,
                    paste_same_file_actions, paste_same_workspace_actions,
                    paste_external_or_unknown_actions, revision, session_id
                FROM wakaclock.heartbeats_canonical AS h
                WHERE h.user_id = ? AND toDate(h.date) BETWEEN toDate(?) AND toDate(?)
                ORDER BY h.time ASC
                ",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<HeartbeatRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse reprocess fetch heartbeats failed: {error}")
            })
    }

    async fn compile_rules(&self, user_id: Uuid) -> Result<Vec<CompiledRule>> {
        let rules = self.project_rule_service.list_by_user(user_id).await?;
        let mut compiled = Vec::new();

        for rule in rules.into_iter().filter(|rule| rule.is_active) {
            let regex = Regex::new(&rule.pattern)
                .map_err(|error| anyhow!("invalid regex pattern during reprocess: {error}"))?;
            compiled.push(CompiledRule::new(rule, regex));
        }

        Ok(compiled)
    }

    async fn persist_rule_project_corrections(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
        rules: &[CompiledRule],
    ) -> Result<HashMap<String, Uuid>> {
        let mut ids = HashMap::new();

        // Rules are compiled in descending priority. Apply them low-to-high so a
        // higher-priority rule is the final mutation when patterns overlap, matching
        // `resolve_project_with_rules` exactly.
        for rule in rules.iter().rev() {
            let Some(project_id) = self
                .project_identity_service
                .resolve_project_id(user_id, Some(&rule.project_name), None)
                .await?
            else {
                continue;
            };
            self.clickhouse
                .get_client()
                .query(
                    "ALTER TABLE wakaclock.heartbeats
                     UPDATE project = ?, project_id = ?
                     WHERE user_id = ?
                       AND toDate(date) BETWEEN toDate(?) AND toDate(?)
                       AND match(entity, ?)
                     SETTINGS mutations_sync = 1",
                )
                .bind(&rule.project_name)
                .bind(project_id)
                .bind(user_id)
                .bind(start)
                .bind(end)
                .bind(rule.regex.as_str())
                .execute()
                .await
                .map_err(|error| {
                    anyhow!("ClickHouse project-rule history mutation failed: {error}")
                })?;
            ids.insert(rule.project_name.clone(), project_id);
        }

        Ok(ids)
    }

    async fn insert_activity_intervals(&self, rows: Vec<ActivityIntervalRow>) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }

        let mut insert = self
            .clickhouse
            .get_client()
            .insert("wakaclock.activity_intervals")
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse activity interval rebuild init failed: {error}")
            })?;

        for row in rows {
            insert.write(&row).await.map_err(|error| {
                anyhow::anyhow!("ClickHouse activity interval rebuild write failed: {error}")
            })?;
        }
        insert.end().await.map_err(|error| {
            anyhow::anyhow!("ClickHouse activity interval rebuild finalize failed: {error}")
        })?;

        Ok(())
    }

    async fn insert_incoming(&self, rows: Vec<HeartbeatRow>) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }

        let mut insert = self
            .clickhouse
            .get_client()
            .insert("wakaclock.heartbeats_incoming")
            .map_err(|error| anyhow::anyhow!("ClickHouse reprocess insert init failed: {error}"))?;

        for row in rows {
            insert.write(&row).await.map_err(|error| {
                anyhow::anyhow!("ClickHouse reprocess write row failed: {error}")
            })?;
        }

        insert.end().await.map_err(|error| {
            anyhow::anyhow!("ClickHouse reprocess finalize insert failed: {error}")
        })?;

        Ok(())
    }
}

fn rebuild_activity_intervals(rows: &[HeartbeatRow]) -> Vec<ActivityIntervalRow> {
    // `activity_intervals` is ReplacingMergeTree(created_at) keyed by segment_id. Use a
    // fresh version so a reprocess can correct project/project_id on an existing segment
    // without deleting the canonical timeline first.
    let projection_created_at = chrono::Utc::now().timestamp().max(0) as u32;
    let mut projected = Vec::new();

    for (row_index, row) in rows.iter().enumerate() {
        let heartbeat_id = row
            .heartbeat_id
            .clone()
            .unwrap_or_else(|| format!("legacy-row:{row_index}"));
        let segments = serde_json::from_str::<Vec<ActivitySegment>>(&row.activity_segments)
            .unwrap_or_default();
        let evidence = clamp_to_evidence_window(
            &segments,
            row.active_seconds_claimed.or(row.active_seconds),
            row.time,
            &heartbeat_id,
        );

        for segment in evidence.segments {
            projected.push(ActivityIntervalRow {
                user_id: row.user_id,
                segment_id: segment.segment_id,
                heartbeat_id: heartbeat_id.clone(),
                start: segment.start,
                end: segment.end,
                source: wakaclock_core::heartbeat::normalize_activity_source(
                    segment.source.as_deref(),
                    &row.actor_type,
                )
                .to_string(),
                entity: row.entity.clone(),
                project: row.project.clone(),
                project_id: row.project_id,
                branch: row.branch.clone(),
                language: row.language.clone(),
                category: row.category.clone(),
                editor: row.editor.clone(),
                operating_system: row.operating_system.clone(),
                actor_type: row.actor_type.clone(),
                actor_confidence: row.actor_confidence,
                created_at: projection_created_at,
            });
        }
    }

    projected
}

fn project_mappings(
    rows: &[HeartbeatRow],
    source_projects: &[Option<String>],
) -> (HashMap<String, (String, u64)>, u64) {
    let mut mappings: HashMap<String, (String, u64)> = HashMap::new();
    let mut ambiguous_sources = HashSet::new();
    let mut unresolved = 0;
    for (row, source_project) in rows.iter().zip(source_projects) {
        let Some(resolved_project) = &row.project else {
            unresolved += 1;
            continue;
        };
        // Missing source + resolved target means a project rule recovered this row.
        // There is no source label to backfill by, so apply-mode persists it through
        // `persist_rule_project_corrections`; it must not be counted as unresolved here.
        let Some(source_project) = source_project else {
            continue;
        };
        if ambiguous_sources.contains(source_project) {
            unresolved += 1;
            continue;
        }
        match mappings.get_mut(source_project) {
            Some(entry) if entry.0 == *resolved_project => entry.1 += 1,
            Some(_) => {
                // A source project resolving to different rule targets within one range is
                // unsafe to collapse into one ClickHouse mutation. Remove the mapping
                // completely so a mutation can never update the wrong rows.
                let previous_count = mappings
                    .remove(source_project)
                    .map(|(_, count)| count)
                    .unwrap_or(0);
                ambiguous_sources.insert(source_project.clone());
                unresolved += previous_count + 1;
            }
            None => {
                mappings.insert(source_project.clone(), (resolved_project.clone(), 1));
            }
        }
    }
    (mappings, unresolved)
}

fn validate_date_range(start: &str, end: &str) -> Result<()> {
    let start_date = chrono::NaiveDate::parse_from_str(start, "%Y-%m-%d")
        .context("Invalid start date format, expected YYYY-MM-DD")?;
    let end_date = chrono::NaiveDate::parse_from_str(end, "%Y-%m-%d")
        .context("Invalid end date format, expected YYYY-MM-DD")?;

    if start_date > end_date {
        anyhow::bail!("start must be less than or equal to end");
    }
    let days = (end_date - start_date).num_days() + 1;
    if days > MAX_RANGE_DAYS {
        anyhow::bail!("range of {days} days exceeds the {MAX_RANGE_DAYS}-day maximum");
    }

    Ok(())
}

struct CompiledRule {
    project_name: String,
    regex: Regex,
}

impl CompiledRule {
    fn new(rule: ProjectRuleRow, regex: Regex) -> Self {
        Self {
            project_name: rule.project_name,
            regex,
        }
    }
}

fn resolve_project_with_rules(
    rules: &[CompiledRule],
    entity: &str,
    fallback_project: Option<String>,
) -> Option<String> {
    for rule in rules {
        if rule.regex.is_match(entity) {
            return Some(rule.project_name.clone());
        }
    }

    fallback_project
}
