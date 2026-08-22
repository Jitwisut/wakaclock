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
use crate::model::heartbeat::HeartbeatRow;
use crate::model::project_rule::ProjectRuleRow;
use crate::model::reprocess::ReprocessData;
use crate::services::account_analytics::AccountAnalyticsService;
use crate::services::project_identity::ProjectIdentityService;
use crate::services::project_rule::ProjectRuleService;

const AGGREGATE_TABLES: &[&str] = &[
    "daily_totals",
    "language_daily",
    "project_daily",
    "editor_daily",
    "os_daily",
    "insights_agg",
    "ai_daily",
    "keystroke_daily",
];

pub struct ReprocessService {
    account_analytics_service: Arc<AccountAnalyticsService>,
    clickhouse: Arc<ClickHouseClient>,
    project_identity_service: Arc<ProjectIdentityService>,
    project_rule_service: Arc<ProjectRuleService>,
}

impl ReprocessService {
    pub fn new(
        clickhouse: Arc<ClickHouseClient>,
        project_rule_service: Arc<ProjectRuleService>,
        project_identity_service: Arc<ProjectIdentityService>,
        account_analytics_service: Arc<AccountAnalyticsService>,
    ) -> Self {
        Self {
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
        let audit_id = Uuid::new_v4();
        let started = Instant::now();
        let mut rows = self.fetch_raw_heartbeats(user_id, start, end).await?;
        let source_projects: Vec<_> = rows.iter().map(|row| row.project.clone()).collect();
        let rules = self.compile_rules(user_id).await?;

        for row in &mut rows {
            row.project = resolve_project_with_rules(&rules, &row.entity, row.project.clone());
        }
        let (project_counts, unresolved_mappings) = project_mappings(&rows, &source_projects);
        let reprocessed_heartbeats = rows.len();
        let mut backfill = self
            .project_identity_service
            .backfill_historical_projects(user_id, start, end, &project_counts, dry_run)
            .await?;
        backfill.unresolved_heartbeats += unresolved_mappings;

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
        let result = async {
            self.delete_aggregate_range(user_id, start, end).await?;
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
                "ALTER TABLE wakaclock.{table} DELETE WHERE user_id = ? AND toDate(date) BETWEEN toDate(?) AND toDate(?)"
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
                "
                SELECT
                    user_id,
                    entity,
                    toString(entity_type) AS entity_type,
                    time,
                    toUInt16(date) AS date,
                    project,
                    project_id,
                    branch,
                    language,
                    dependencies,
                    lines,
                    line_number,
                    cursor_position,
                    is_write,
                    toString(category) AS category,
                    toString(editor) AS editor,
                    toString(operating_system) AS operating_system,
                    machine,
                    user_agent,
                    ast_language,
                    ast_confidence,
                    keystrokes,
                    chars_added,
                    chars_deleted,
                    active_seconds,
                    is_ai_generated,
                    ai_agent,
                    ai_provider,
                    ai_model,
                    ai_source,
                    ai_confidence,
                    ai_event_id,
                    ai_event_fingerprint,
                    ai_lines_added,
                    ai_lines_deleted,
                    human_lines_added,
                    human_lines_deleted,
                    unattributed_lines_added,
                    unattributed_lines_deleted,
                    toUInt32(created_at) AS created_at
                FROM wakaclock.heartbeats AS h
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

fn project_mappings(
    rows: &[HeartbeatRow],
    source_projects: &[Option<String>],
) -> (HashMap<String, (String, u64)>, u64) {
    let mut mappings: HashMap<String, (String, u64)> = HashMap::new();
    let mut ambiguous_sources = HashSet::new();
    let mut unresolved = 0;
    for (row, source_project) in rows.iter().zip(source_projects) {
        let (Some(source_project), Some(resolved_project)) = (source_project, &row.project) else {
            unresolved += 1;
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
