use anyhow::{anyhow, Context, Result};
use regex::Regex;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::heartbeat::HeartbeatRow;
use crate::model::project_rule::ProjectRuleRow;
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
    clickhouse: Arc<ClickHouseClient>,
    project_rule_service: Arc<ProjectRuleService>,
}

impl ReprocessService {
    pub fn new(
        clickhouse: Arc<ClickHouseClient>,
        project_rule_service: Arc<ProjectRuleService>,
    ) -> Self {
        Self {
            clickhouse,
            project_rule_service,
        }
    }

    pub async fn run(&self, user_id: Uuid, start: &str, end: &str) -> Result<usize> {
        validate_date_range(start, end)?;

        self.delete_aggregate_range(user_id, start, end).await?;
        let mut rows = self.fetch_raw_heartbeats(user_id, start, end).await?;
        let rules = self.compile_rules(user_id).await?;

        for row in &mut rows {
            row.project = resolve_project_with_rules(&rules, &row.entity, row.project.clone());
        }

        let count = rows.len();
        self.insert_incoming(rows).await?;
        Ok(count)
    }

    async fn delete_aggregate_range(&self, user_id: Uuid, start: &str, end: &str) -> Result<()> {
        for table in AGGREGATE_TABLES {
            let sql = format!(
                "ALTER TABLE wakaclock.{table} DELETE WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)"
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
                    ai_lines_added,
                    ai_lines_deleted,
                    toUInt32(created_at) AS created_at
                FROM wakaclock.heartbeats
                WHERE user_id = ? AND date BETWEEN toDate(?) AND toDate(?)
                ORDER BY time ASC
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

fn validate_date_range(start: &str, end: &str) -> Result<()> {
    let start_date = chrono::NaiveDate::parse_from_str(start, "%Y-%m-%d")
        .context("Invalid start date format, expected YYYY-MM-DD")?;
    let end_date = chrono::NaiveDate::parse_from_str(end, "%Y-%m-%d")
        .context("Invalid end date format, expected YYYY-MM-DD")?;

    if start_date > end_date {
        anyhow::bail!("start must be less than or equal to end");
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
