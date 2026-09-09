use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use std::sync::Arc;
use tokio_postgres::Row;
use uuid::Uuid;

use crate::infrastructure::postgres::PostgresClient;
use crate::model::export::{CreateExportRequest, ExportJob};

const FORMATS: &[&str] = &["csv", "json", "zip"];
const SCOPES: &[&str] = &[
    "heartbeats",
    "summaries",
    "projects",
    "ai",
    "external_durations",
    "goals",
    "organization",
    "all",
];

pub struct ExportService {
    postgres: Option<Arc<PostgresClient>>,
}

impl ExportService {
    pub fn new(postgres: Option<Arc<PostgresClient>>) -> Self {
        Self { postgres }
    }

    pub async fn create(&self, user_id: Uuid, request: CreateExportRequest) -> Result<ExportJob> {
        super::require_background_processor()?;
        validate(&request)?;
        let postgres = self.required()?;
        let id = Uuid::now_v7();
        let row = postgres
            .client()
            .query_one(
                "INSERT INTO export_jobs (id, user_id, format, scope, status, progress)
                 VALUES ($1, $2, $3, $4, 'queued', 0)
                 RETURNING id, format, scope, status, progress, requested_at,
                           completed_at, expires_at",
                &[&id, &user_id, &request.format, &request.scope],
            )
            .await
            .context("failed to create export job")?;
        job_from_row(row)
    }

    pub async fn list(&self, user_id: Uuid) -> Result<Vec<ExportJob>> {
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT id, format, scope, status, progress, requested_at,
                        completed_at, expires_at
                 FROM export_jobs WHERE user_id = $1
                 ORDER BY requested_at DESC LIMIT 100",
                &[&user_id],
            )
            .await
            .context("failed to list export jobs")?;
        rows.into_iter().map(job_from_row).collect()
    }

    pub async fn get(&self, user_id: Uuid, id: Uuid) -> Result<Option<ExportJob>> {
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT id, format, scope, status, progress, requested_at,
                        completed_at, expires_at
                 FROM export_jobs WHERE id = $1 AND user_id = $2",
                &[&id, &user_id],
            )
            .await
            .context("failed to load export job")?;
        row.map(job_from_row).transpose()
    }

    pub async fn cancel(&self, user_id: Uuid, id: Uuid) -> Result<bool> {
        let postgres = self.required()?;
        let changed = postgres
            .client()
            .execute(
                "UPDATE export_jobs SET status = 'cancelled'
                 WHERE id = $1 AND user_id = $2 AND status IN ('queued', 'running')",
                &[&id, &user_id],
            )
            .await
            .context("failed to cancel export job")?;
        Ok(changed == 1)
    }

    fn required(&self) -> Result<&PostgresClient> {
        self.postgres
            .as_deref()
            .ok_or_else(|| anyhow!("PostgreSQL is not configured; set POSTGRES_URL"))
    }
}

fn validate(request: &CreateExportRequest) -> Result<()> {
    if !FORMATS.contains(&request.format.as_str()) {
        return Err(anyhow!("unsupported export format"));
    }
    if !SCOPES.contains(&request.scope.as_str()) {
        return Err(anyhow!("unsupported export scope"));
    }
    Ok(())
}

fn job_from_row(row: Row) -> Result<ExportJob> {
    Ok(ExportJob {
        id: row.try_get("id")?,
        format: row.try_get("format")?,
        scope: row.try_get("scope")?,
        status: row.try_get("status")?,
        progress: row.try_get("progress")?,
        requested_at: row.try_get::<_, DateTime<Utc>>("requested_at")?,
        completed_at: row.try_get::<_, Option<DateTime<Utc>>>("completed_at")?,
        expires_at: row.try_get::<_, Option<DateTime<Utc>>>("expires_at")?,
        // Signed object-storage URLs are only emitted by the export worker after it has
        // written and checksum-verified an artifact. Never manufacture a URL here.
        download_url: None,
        checksum: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_contract_rejects_unknown_values() {
        assert!(validate(&CreateExportRequest {
            format: "zip".into(),
            scope: "all".into(),
        })
        .is_ok());
        assert!(validate(&CreateExportRequest {
            format: "yaml".into(),
            scope: "all".into(),
        })
        .is_err());
    }
}
