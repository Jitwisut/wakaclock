use anyhow::{anyhow, Result};
use regex::Regex;
use std::sync::Arc;
use uuid::Uuid;

use crate::model::project_rule::ProjectRuleRow;
use crate::repository::project_rule::ProjectRuleRepository;

pub struct ProjectRuleService {
    repo: Arc<ProjectRuleRepository>,
}

impl ProjectRuleService {
    pub fn new(repo: Arc<ProjectRuleRepository>) -> Self {
        Self { repo }
    }

    pub async fn list_by_user(&self, user_id: Uuid) -> Result<Vec<ProjectRuleRow>> {
        self.repo.list_by_user(user_id).await
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

        self.repo.upsert(&row).await?;
        Ok(row)
    }

    pub async fn delete(&self, user_id: Uuid, rule_id: Uuid) -> Result<()> {
        self.repo.delete(user_id, rule_id).await
    }

    pub async fn resolve_project(
        &self,
        user_id: Uuid,
        entity: &str,
        fallback_project: Option<String>,
    ) -> Result<Option<String>> {
        let rules = self.repo.list_by_user(user_id).await?;

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
