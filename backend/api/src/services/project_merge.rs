use anyhow::{anyhow, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::model::project_merge::ProjectMergeRow;
use crate::repository::project_merge::ProjectMergeRepository;

pub struct ProjectMergeService {
    repo: Arc<ProjectMergeRepository>,
}

impl ProjectMergeService {
    pub fn new(repo: Arc<ProjectMergeRepository>) -> Self {
        Self { repo }
    }

    pub async fn list_by_user(&self, user_id: Uuid) -> Result<Vec<ProjectMergeRow>> {
        self.repo.list_by_user(user_id).await
    }

    pub async fn upsert(
        &self,
        user_id: Uuid,
        merge_id: Uuid,
        source_project: String,
        target_project: String,
    ) -> Result<ProjectMergeRow> {
        validate_merge(&source_project, &target_project)?;
        ensure_no_circular_merge(
            &self.repo,
            user_id,
            merge_id,
            &source_project,
            &target_project,
        )
        .await?;

        let now = chrono::Utc::now().timestamp().max(0) as u32;
        let row = ProjectMergeRow {
            user_id,
            merge_id,
            source_project,
            target_project,
            created_at: now,
            updated_at: now,
        };

        self.repo.upsert(&row).await?;
        Ok(row)
    }

    pub async fn delete(&self, user_id: Uuid, merge_id: Uuid) -> Result<()> {
        self.repo.delete(user_id, merge_id).await
    }
}

fn validate_merge(source_project: &str, target_project: &str) -> Result<()> {
    if source_project.trim().is_empty() {
        return Err(anyhow!("source_project cannot be empty"));
    }
    if target_project.trim().is_empty() {
        return Err(anyhow!("target_project cannot be empty"));
    }
    if source_project == target_project {
        return Err(anyhow!(
            "source_project and target_project cannot be the same"
        ));
    }

    Ok(())
}

async fn ensure_no_circular_merge(
    repo: &Arc<ProjectMergeRepository>,
    user_id: Uuid,
    merge_id: Uuid,
    source_project: &str,
    target_project: &str,
) -> Result<()> {
    let merges = repo.list_by_user(user_id).await?;

    if merges.iter().any(|merge| {
        merge.merge_id != merge_id
            && merge.source_project == target_project
            && merge.target_project == source_project
    }) {
        return Err(anyhow!("circular merge detected"));
    }

    Ok(())
}
