use anyhow::{anyhow, Result};
use regex::Regex;
use std::sync::Arc;
use uuid::Uuid;

use crate::config::brokers::IngestStateSource;
use crate::model::project_rule::ProjectRuleRow;
use crate::repository::ingest_state::IngestStateRepository;
use crate::repository::project_rule::ProjectRuleRepository;

pub struct ProjectRuleService {
    repo: Arc<ProjectRuleRepository>,
    ingest_state_source: IngestStateSource,
    ingest_state: Option<Arc<IngestStateRepository>>,
}

impl ProjectRuleService {
    pub fn new(repo: Arc<ProjectRuleRepository>) -> Self {
        Self {
            repo,
            ingest_state_source: IngestStateSource::ClickHouse,
            ingest_state: None,
        }
    }

    pub fn with_ingest_state(
        mut self,
        source: IngestStateSource,
        postgres: Option<Arc<crate::infrastructure::postgres::PostgresClient>>,
    ) -> Self {
        self.ingest_state_source = source;
        self.ingest_state = postgres.map(|value| Arc::new(IngestStateRepository::new(value)));
        self
    }

    pub async fn list_by_user(&self, user_id: Uuid) -> Result<Vec<ProjectRuleRow>> {
        let clickhouse = || self.repo.list_by_user(user_id);
        match self.ingest_state_source {
            IngestStateSource::ClickHouse => clickhouse().await,
            IngestStateSource::Postgres => self
                .ingest_state
                .as_ref()
                .ok_or_else(|| anyhow!("PostgreSQL ingest state is not configured"))?
                .list_rules(user_id)
                .await,
            IngestStateSource::Dual => {
                let primary = clickhouse().await?;
                if let Some(postgres) = &self.ingest_state {
                    let mirror = postgres.list_rules(user_id).await?;
                    if !same_rules(&primary, &mirror) {
                        tracing::warn!(user_id = %user_id, "project rule state mismatch between ClickHouse and PostgreSQL");
                    }
                }
                Ok(primary)
            }
        }
    }

    pub async fn upsert(
        &self,
        user_id: Uuid,
        rule_id: Uuid,
        pattern: String,
        project_name: String,
        priority: i32,
        is_active: bool,
    ) -> Result<ProjectRuleRow> {
        validate_rule(&pattern, &project_name)?;

        let now = chrono::Utc::now().timestamp().max(0) as u32;
        let row = ProjectRuleRow {
            user_id,
            rule_id,
            pattern,
            project_name,
            priority,
            is_active,
            created_at: now,
            updated_at: now,
        };

        if self.ingest_state_source != IngestStateSource::Postgres {
            self.repo.upsert(&row).await?;
        }
        if matches!(
            self.ingest_state_source,
            IngestStateSource::Dual | IngestStateSource::Postgres
        ) {
            self.ingest_state
                .as_ref()
                .ok_or_else(|| anyhow!("PostgreSQL ingest state is not configured"))?
                .upsert_rule(&row)
                .await
                .map_err(|_| anyhow!("project rule mirror reconciliation failed"))?;
        }
        Ok(row)
    }

    pub async fn delete(&self, user_id: Uuid, rule_id: Uuid) -> Result<()> {
        if self.ingest_state_source != IngestStateSource::Postgres {
            self.repo.delete(user_id, rule_id).await?;
        }
        if matches!(
            self.ingest_state_source,
            IngestStateSource::Dual | IngestStateSource::Postgres
        ) {
            self.ingest_state
                .as_ref()
                .ok_or_else(|| anyhow!("PostgreSQL ingest state is not configured"))?
                .delete_rule(user_id, rule_id)
                .await
                .map_err(|_| anyhow!("project rule mirror reconciliation failed"))?;
        }
        Ok(())
    }

    pub async fn resolve_project(
        &self,
        user_id: Uuid,
        entity: &str,
        fallback_project: Option<String>,
    ) -> Result<Option<String>> {
        // Resolve through the configured state source as well.  The request path
        // must not silently reach back to ClickHouse when PostgreSQL is the
        // authoritative source for Kafka mode (K0.5/K4).
        let rules = self.list_by_user(user_id).await?;

        for rule in rules.into_iter().filter(|rule| rule.is_active) {
            let regex =
                Regex::new(&rule.pattern).map_err(|e| anyhow!("invalid regex pattern: {e}"))?;
            if regex.is_match(entity) {
                return Ok(Some(rule.project_name));
            }
        }

        Ok(fallback_project)
    }
}

fn same_rules(left: &[ProjectRuleRow], right: &[ProjectRuleRow]) -> bool {
    left.iter().map(rule_key).eq(right.iter().map(rule_key))
}

fn rule_key(row: &ProjectRuleRow) -> (Uuid, &str, &str, i32, bool) {
    (
        row.rule_id,
        row.pattern.as_str(),
        row.project_name.as_str(),
        row.priority,
        row.is_active,
    )
}

fn validate_rule(pattern: &str, project_name: &str) -> Result<()> {
    if pattern.trim().is_empty() {
        return Err(anyhow!("pattern cannot be empty"));
    }
    if project_name.trim().is_empty() {
        return Err(anyhow!("project_name cannot be empty"));
    }

    Regex::new(pattern).map_err(|e| anyhow!("invalid regex pattern: {e}"))?;
    Ok(())
}
