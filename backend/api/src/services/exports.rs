use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{sync::Arc, time::Duration};
use tokio_postgres::Row;
use uuid::Uuid;

use crate::config::ExportMode;
use crate::infrastructure::contracts::{safe_event_entity, JobKind, ObjectStore};
use crate::infrastructure::postgres::PostgresClient;
use crate::model::export::{CreateExportRequest, ExportJob};
use crate::services::background_worker::LeaseGuard;
use crate::services::jobs::{ClaimedJob, JobService};

const EXPORT_ARTIFACT_TTL: Duration = Duration::from_secs(60 * 60);
const MAX_EXPORT_ROWS: usize = 1_000_000;
const MAX_EXPORT_BYTES: usize = 256 * 1024 * 1024;
const EXPORT_DOCUMENT_HEADROOM: usize = 64 * 1024;

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

/// A single export has one aggregate row budget across every requested section.
/// Applying the limit independently to each section would let `scope=all` load
/// several million rows into one JSON document before the byte limit is checked.
/// Queries deliberately fetch one sentinel row over the remaining budget so the
/// worker can reject the export before retaining an oversized result set.
#[derive(Debug)]
struct ExportBudget {
    remaining_rows: usize,
    remaining_bytes: usize,
}

impl ExportBudget {
    fn new(max_rows: usize) -> Self {
        Self {
            remaining_rows: max_rows,
            // Leave room for the document envelope, section names and format
            // framing. The final serialized artifact is still checked by
            // `bounded_content`; this budget protects the in-memory row vectors
            // while they are being assembled.
            remaining_bytes: MAX_EXPORT_BYTES.saturating_sub(EXPORT_DOCUMENT_HEADROOM),
        }
    }

    fn query_limit(&self) -> usize {
        self.remaining_rows.saturating_add(1)
    }

    fn consume(&mut self, actual: usize) -> Result<()> {
        if actual > self.remaining_rows {
            anyhow::bail!("export exceeds the maximum row limit");
        }
        self.remaining_rows -= actual;
        Ok(())
    }

    fn account_value(&mut self, value: &Value) -> Result<()> {
        let serialized = serde_json::to_vec(value)?;
        let required = serialized
            .len()
            .checked_add(1)
            .context("export row size overflow")?;
        if required > self.remaining_bytes {
            anyhow::bail!("export exceeds the maximum byte limit");
        }
        self.remaining_bytes -= required;
        Ok(())
    }
}

pub struct ExportService {
    postgres: Option<Arc<PostgresClient>>,
    clickhouse: Arc<crate::infrastructure::database::ClickHouseClient>,
    object_store: Option<Arc<dyn ObjectStore>>,
    mode: ExportMode,
}

impl ExportService {
    pub fn new(
        postgres: Option<Arc<PostgresClient>>,
        clickhouse: Arc<crate::infrastructure::database::ClickHouseClient>,
        object_store: Option<Arc<dyn ObjectStore>>,
        mode: ExportMode,
    ) -> Self {
        Self {
            postgres,
            clickhouse,
            object_store,
            mode,
        }
    }

    pub fn processor_ready(&self) -> bool {
        self.postgres.is_some() && self.object_store.is_some()
    }

    pub fn capability_available(&self) -> bool {
        self.mode == ExportMode::Job && self.processor_ready()
    }

    pub async fn create(
        &self,
        user_id: Uuid,
        request: CreateExportRequest,
        idempotency_key: Option<&str>,
    ) -> Result<ExportJob> {
        // The default remains fail-closed. Enabling exports is a separate, explicit
        // deployment switch so turning on RabbitMQ for another job kind cannot make
        // this endpoint accept work before its object-store processor is ready.
        if self.mode != ExportMode::Job {
            super::require_background_processor()?;
        }
        if !self.processor_ready() {
            anyhow::bail!("export background processor requires PostgreSQL and an object store");
        }
        validate(&request)?;
        validate_idempotency_key(idempotency_key)?;
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let requested_id = Uuid::now_v7();
        let (id, row, existing_async_job_id) = if let Some(idempotency_key) = idempotency_key {
            let inserted = tx
                .query_opt(
                    "INSERT INTO export_jobs
                        (id, user_id, format, scope, status, progress, idempotency_key)
                     VALUES ($1, $2, $3, $4, 'queued', 0, $5)
                     ON CONFLICT (user_id, idempotency_key)
                         WHERE idempotency_key IS NOT NULL
                     DO NOTHING
                     RETURNING id, format, scope, status, progress, requested_at,
                               completed_at, expires_at",
                    &[
                        &requested_id,
                        &user_id,
                        &request.format,
                        &request.scope,
                        &idempotency_key,
                    ],
                )
                .await
                .context("failed to create idempotent export job")?;
            if let Some(row) = inserted {
                let id: Uuid = row.get("id");
                (id, row, None)
            } else {
                let existing = tx
                    .query_one(
                        "SELECT id, format, scope, status, progress, requested_at,
                                completed_at, expires_at, async_job_id
                         FROM export_jobs
                         WHERE user_id = $1 AND idempotency_key = $2",
                        &[&user_id, &idempotency_key],
                    )
                    .await
                    .context("load existing idempotent export job")?;
                let existing_format: String = existing.get("format");
                let existing_scope: String = existing.get("scope");
                if existing_format != request.format || existing_scope != request.scope {
                    anyhow::bail!("Idempotency-Key conflicts with existing export parameters");
                }
                let id: Uuid = existing.get("id");
                let async_job_id: Option<Uuid> = existing.get("async_job_id");
                (id, existing, async_job_id)
            }
        } else {
            let row = tx
                .query_one(
                    "INSERT INTO export_jobs (id, user_id, format, scope, status, progress)
                 VALUES ($1, $2, $3, $4, 'queued', 0)
                 RETURNING id, format, scope, status, progress, requested_at,
                           completed_at, expires_at",
                    &[&requested_id, &user_id, &request.format, &request.scope],
                )
                .await
                .context("failed to create export job")?;
            let id: Uuid = row.get("id");
            (id, row, None)
        };
        if existing_async_job_id.is_some() {
            tx.commit()
                .await
                .context("commit existing export request")?;
            return job_from_row(&row);
        }
        let created_job = JobService::create_in_transaction(
            &tx,
            Some(user_id),
            JobKind::ExportGenerate,
            serde_json::json!({
                "schema_version": 1,
                "export_job_id": id,
            }),
            idempotency_key,
        )
        .await
        .context("failed to enqueue export worker job")?;
        tx.execute(
            "UPDATE export_jobs SET async_job_id = $2 WHERE id = $1",
            &[&id, &created_job.id],
        )
        .await
        .context("link export request to async job")?;
        tx.commit().await.context("commit export request")?;
        job_from_row(&row)
    }

    /// Execute one durable export job. The job worker claims and fences the outer
    /// RabbitMQ delivery; this method fences the export row again before publishing
    /// the artifact so cancellation and redelivery cannot expose a half-written file.
    pub async fn process(&self, job: &ClaimedJob, lease: LeaseGuard) -> Result<Value> {
        let user_id = job.user_id.context("invalid export job scope")?;
        let params: ExportJobParams = serde_json::from_value(job.params.clone())
            .map_err(|_| anyhow!("invalid export job parameters"))?;
        if params.schema_version != 1 {
            return Err(anyhow!("invalid export job parameters"));
        }
        let object_store = self
            .object_store
            .clone()
            .context("export object store is not configured")?;
        let spec = self
            .load_spec(user_id, params.export_job_id)
            .await?
            .context("export job record not found")?;

        if spec.status == "cancelled" {
            self.remove_cancelled_artifact(&object_store, &spec).await?;
            return Ok(json!({ "cancelled": true }));
        }
        if spec.status == "completed" {
            return self.completed_result(&spec).await;
        }
        if !matches!(spec.status.as_str(), "queued" | "running") {
            return Err(anyhow!("export job is not executable"));
        }

        self.mark_running(user_id, spec.id).await?;
        lease.ensure_active()?;
        let (content, content_type) = self
            .build_content(user_id, &spec.scope, &spec.format, spec.requested_at)
            .await?;
        lease.ensure_active()?;
        let checksum = sha256_hex(&content);
        // The checksum is part of the object key so a stale lease holder can never
        // overwrite an artifact produced by a newer attempt. Finalization still
        // fences the export row in PostgreSQL before exposing any artifact.
        let object_key = format!("exports/{user_id}/{}/{checksum}.{}", spec.id, spec.format);
        object_store
            .put(&object_key, content.clone(), content_type)
            .await
            .map_err(|error| anyhow!("write export artifact: {error}"))?;
        lease.ensure_active()?;

        match self
            .finalize_artifact(
                user_id,
                ExportWorkerFence {
                    async_job_id: job.id,
                    attempt: job.attempt,
                    lease_owner: job.lease_owner,
                },
                &spec,
                &object_key,
                &checksum,
                content.len() as i64,
            )
            .await?
        {
            FinalizeArtifact::Cancelled => {
                object_store
                    .delete(&object_key)
                    .await
                    .map_err(|error| anyhow!("remove cancelled export artifact: {error}"))?;
                Ok(json!({ "cancelled": true }))
            }
            FinalizeArtifact::Completed { checksum, bytes } => {
                Ok(json!({ "bytes": bytes, "checksum": checksum }))
            }
        }
    }

    async fn load_spec(&self, user_id: Uuid, id: Uuid) -> Result<Option<ExportSpec>> {
        let row = self
            .required()?
            .client()
            .query_opt(
                "SELECT id, format, scope, status, requested_at
                 FROM export_jobs
                 WHERE id = $1 AND user_id = $2",
                &[&id, &user_id],
            )
            .await
            .context("load export worker record")?;
        row.map(|row| {
            Ok(ExportSpec {
                id: row.try_get("id")?,
                format: row.try_get("format")?,
                scope: row.try_get("scope")?,
                status: row.try_get("status")?,
                requested_at: row.try_get("requested_at")?,
            })
        })
        .transpose()
    }

    async fn mark_running(&self, user_id: Uuid, id: Uuid) -> Result<()> {
        self.required()?
            .client()
            .execute(
                "UPDATE export_jobs
                    SET status = 'running', progress = GREATEST(progress, 10)
                  WHERE id = $1 AND user_id = $2 AND status IN ('queued', 'running')",
                &[&id, &user_id],
            )
            .await
            .context("mark export job as running")?;
        Ok(())
    }

    async fn finalize_artifact(
        &self,
        user_id: Uuid,
        fence: ExportWorkerFence,
        spec: &ExportSpec,
        object_key: &str,
        checksum: &str,
        bytes: i64,
    ) -> Result<FinalizeArtifact> {
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let status_row = tx
            .query_one(
                "SELECT status, async_job_id FROM export_jobs
                 WHERE id = $1 AND user_id = $2
                 FOR UPDATE",
                &[&spec.id, &user_id],
            )
            .await
            .context("lock export job before finalization")?;
        let status: String = status_row.get("status");
        let linked_async_job_id: Option<Uuid> = status_row.get("async_job_id");
        if status == "cancelled" {
            tx.commit().await.context("commit cancelled export state")?;
            return Ok(FinalizeArtifact::Cancelled);
        }
        if status == "completed" {
            let existing = tx
                .query_opt(
                    "SELECT sha256, bytes FROM export_artifacts
                     WHERE export_job_id = $1
                     ORDER BY created_at DESC LIMIT 1",
                    &[&spec.id],
                )
                .await
                .context("load completed export artifact")?;
            tx.commit().await.context("commit existing export state")?;
            let existing = existing.context("completed export has no artifact")?;
            let existing_checksum: String = existing.get("sha256");
            let existing_bytes: i64 = existing.get("bytes");
            if existing_checksum != checksum || existing_bytes != bytes {
                anyhow::bail!("export artifact identity conflict");
            }
            return Ok(FinalizeArtifact::Completed {
                checksum: existing_checksum,
                bytes: existing_bytes,
            });
        }
        if !matches!(status.as_str(), "queued" | "running") {
            anyhow::bail!("export job is not executable");
        }
        if linked_async_job_id != Some(fence.async_job_id) {
            anyhow::bail!("export job ownership mismatch");
        }
        // The export row is not enough to fence a stale worker: a lease sweeper can
        // requeue the same RabbitMQ job while an old worker is still uploading. Check
        // the exact async-job attempt and owner in the same transaction immediately
        // before publishing artifact metadata.
        let owned = tx
            .query_opt(
                "SELECT id FROM async_jobs
                 WHERE id = $1 AND attempt = $2 AND status = 'running'
                   AND lease_owner = $3 AND lease_expires_at > now()
                 FOR UPDATE",
                &[&fence.async_job_id, &fence.attempt, &fence.lease_owner],
            )
            .await
            .context("verify export worker lease before finalization")?;
        if owned.is_none() {
            anyhow::bail!("export worker lease was lost before finalization");
        }

        let artifact_name = format!("artifact:v1:{checksum}");
        let artifact_id = Uuid::new_v5(&spec.id, artifact_name.as_bytes());
        let existing = tx
            .query_opt(
                "SELECT object_key, sha256, bytes FROM export_artifacts
                 WHERE id = $1
                 FOR UPDATE",
                &[&artifact_id],
            )
            .await
            .context("inspect existing export artifact")?;
        if let Some(existing) = existing {
            let existing_key: String = existing.get("object_key");
            let existing_checksum: String = existing.get("sha256");
            let existing_bytes: i64 = existing.get("bytes");
            if existing_key != object_key
                || existing_checksum != checksum
                || existing_bytes != bytes
            {
                anyhow::bail!("export artifact identity conflict");
            }
        } else {
            tx.execute(
                "INSERT INTO export_artifacts
                    (id, export_job_id, object_key, sha256, bytes,
                     signed_url_expires_at)
                 VALUES ($1, $2, $3, $4, $5,
                         now() + ($6::double precision * interval '1 second'))",
                &[
                    &artifact_id,
                    &spec.id,
                    &object_key,
                    &checksum,
                    &bytes,
                    &(EXPORT_ARTIFACT_TTL.as_secs() as f64),
                ],
            )
            .await
            .context("insert export artifact metadata")?;
        }
        tx.execute(
            "UPDATE export_jobs
                SET status = 'completed', progress = 100,
                    completed_at = now(),
                    expires_at = now() + ($3::double precision * interval '1 second'),
                    error_code = NULL
              WHERE id = $1 AND user_id = $2",
            &[&spec.id, &user_id, &(EXPORT_ARTIFACT_TTL.as_secs() as f64)],
        )
        .await
        .context("mark export job as completed")?;
        tx.commit().await.context("commit export artifact")?;
        Ok(FinalizeArtifact::Completed {
            checksum: checksum.to_string(),
            bytes,
        })
    }

    async fn remove_cancelled_artifact(
        &self,
        object_store: &Arc<dyn ObjectStore>,
        spec: &ExportSpec,
    ) -> Result<()> {
        let rows = self
            .required()?
            .client()
            .query(
                "SELECT object_key FROM export_artifacts
                 WHERE export_job_id = $1
                 ORDER BY created_at DESC",
                &[&spec.id],
            )
            .await
            .context("inspect cancelled export artifacts")?;
        if rows.is_empty() {
            return Ok(());
        }
        for row in rows {
            let object_key: String = row.get("object_key");
            object_store
                .delete(&object_key)
                .await
                .map_err(|error| anyhow!("remove cancelled export artifact: {error}"))?;
        }
        self.required()?
            .client()
            .execute(
                "DELETE FROM export_artifacts WHERE export_job_id = $1",
                &[&spec.id],
            )
            .await
            .context("remove cancelled export metadata")?;
        Ok(())
    }

    async fn completed_result(&self, spec: &ExportSpec) -> Result<Value> {
        let row = self
            .required()?
            .client()
            .query_opt(
                "SELECT sha256, bytes FROM export_artifacts
                 WHERE export_job_id = $1
                 ORDER BY created_at DESC LIMIT 1",
                &[&spec.id],
            )
            .await
            .context("load completed export result")?
            .context("completed export has no artifact")?;
        Ok(json!({
            "bytes": row.get::<_, i64>("bytes"),
            "checksum": row.get::<_, String>("sha256")
        }))
    }

    async fn build_content(
        &self,
        user_id: Uuid,
        scope: &str,
        format: &str,
        generated_at: DateTime<Utc>,
    ) -> Result<(Vec<u8>, &'static str)> {
        let document = self.build_document(user_id, scope, generated_at).await?;
        match format {
            "json" => Ok((
                bounded_content(serde_json::to_vec(&document)?)?,
                "application/json",
            )),
            "csv" => Ok((
                bounded_content(csv_document(&document)?)?,
                "text/csv; charset=utf-8",
            )),
            "zip" => {
                let json_content = serde_json::to_vec(&document)?;
                let csv_content = csv_document(&document)?;
                Ok((
                    bounded_content(stored_zip(&[
                        ("export.json", &json_content),
                        ("export.csv", &csv_content),
                    ])?)?,
                    "application/zip",
                ))
            }
            _ => Err(anyhow!("unsupported export format")),
        }
    }

    async fn build_document(
        &self,
        user_id: Uuid,
        scope: &str,
        generated_at: DateTime<Utc>,
    ) -> Result<Value> {
        let mut data = serde_json::Map::new();
        let mut budget = ExportBudget::new(MAX_EXPORT_ROWS);
        let include_all = scope == "all";

        if include_all || scope == "heartbeats" {
            data.insert(
                "heartbeats".to_string(),
                Value::Array(self.fetch_heartbeats(user_id, &mut budget).await?),
            );
        }
        if include_all || scope == "ai" {
            data.insert(
                "ai".to_string(),
                Value::Array(self.fetch_ai_usage(user_id, &mut budget).await?),
            );
        }
        if include_all || scope == "summaries" {
            data.insert(
                "summaries".to_string(),
                Value::Array(self.fetch_summaries(user_id, &mut budget).await?),
            );
        }
        if include_all || scope == "projects" {
            data.insert(
                "projects".to_string(),
                Value::Array(self.fetch_projects(user_id, &mut budget).await?),
            );
        }
        if include_all || scope == "external_durations" {
            data.insert(
                "external_durations".to_string(),
                Value::Array(self.fetch_external_durations(user_id, &mut budget).await?),
            );
        }
        if include_all || scope == "goals" {
            data.insert(
                "goals".to_string(),
                Value::Array(self.fetch_goals(user_id, &mut budget).await?),
            );
        }
        if include_all || scope == "organization" {
            data.insert(
                "organization".to_string(),
                Value::Array(self.fetch_organizations(user_id, &mut budget).await?),
            );
        }

        Ok(json!({
            "schema_version": 1,
            "scope": scope,
            "generated_at": generated_at,
            "data": data
        }))
    }

    async fn fetch_heartbeats(
        &self,
        user_id: Uuid,
        budget: &mut ExportBudget,
    ) -> Result<Vec<Value>> {
        let rows = self
            .clickhouse
            .get_client()
            .query(&format!(
                "SELECT toString(date) AS date, time, entity, project, branch,
                        language, lines, is_write, category, editor, operating_system,
                        heartbeat_id, active_seconds, actor_type, ai_agent, ai_provider,
                        ai_model, ai_lines_added, ai_lines_deleted, human_lines_added,
                        human_lines_deleted, unattributed_lines_added,
                        unattributed_lines_deleted
                 FROM wakaclock.heartbeats_canonical
                 WHERE user_id = ?
                 ORDER BY time ASC
                LIMIT {}",
                budget.query_limit()
            ))
            .bind(user_id)
            .fetch_all::<HeartbeatExportRow>()
            .await
            .context("fetch heartbeat export rows")?;
        budget.consume(rows.len())?;
        map_export_rows(rows, budget, |row| {
            json!({
                    "date": row.date,
                    "time": row.time,
                    "entity": safe_event_entity(&row.entity),
                    "project": row.project,
                    "branch": row.branch,
                    "language": row.language,
                    "lines": row.lines,
                    "is_write": row.is_write,
                    "category": row.category,
                    "editor": row.editor,
                    "operating_system": row.operating_system,
                    "heartbeat_id": row.heartbeat_id,
                    "active_seconds": row.active_seconds,
                    "actor_type": row.actor_type,
                    "ai_agent": row.ai_agent,
                    "ai_provider": row.ai_provider,
                    "ai_model": row.ai_model,
                    "ai_lines_added": row.ai_lines_added,
                    "ai_lines_deleted": row.ai_lines_deleted,
                    "human_lines_added": row.human_lines_added,
                    "human_lines_deleted": row.human_lines_deleted,
                    "unattributed_lines_added": row.unattributed_lines_added,
                    "unattributed_lines_deleted": row.unattributed_lines_deleted
            })
        })
    }

    async fn fetch_ai_usage(&self, user_id: Uuid, budget: &mut ExportBudget) -> Result<Vec<Value>> {
        let rows = self
            .clickhouse
            .get_client()
            .query(&format!(
                "SELECT toString(date) AS date, usage_event_id, ai_session_id,
                        event_time, ifNull(toString(project_id), '') AS project_id,
                        ai_agent, ai_provider, ai_model, prompt_count,
                        prompt_character_count, input_tokens, output_tokens,
                        cache_read_tokens, cache_write_tokens, estimated_cost_microusd,
                        pricing_version, token_source
                 FROM wakaclock.ai_usage_events FINAL
                 WHERE user_id = ?
                 ORDER BY event_time ASC
                LIMIT {}",
                budget.query_limit()
            ))
            .bind(user_id)
            .fetch_all::<AiUsageExportRow>()
            .await
            .context("fetch AI usage export rows")?;
        budget.consume(rows.len())?;
        map_export_rows(rows, budget, |row| {
            json!({
                    "date": row.date,
                    "usage_event_id": row.usage_event_id,
                    "ai_session_id": row.ai_session_id,
                    "event_time": row.event_time,
                    "project_id": non_empty(row.project_id),
                    "ai_agent": row.ai_agent,
                    "ai_provider": row.ai_provider,
                    "ai_model": row.ai_model,
                    "prompt_count": row.prompt_count,
                    "prompt_character_count": row.prompt_character_count,
                    "input_tokens": row.input_tokens,
                    "output_tokens": row.output_tokens,
                    "cache_read_tokens": row.cache_read_tokens,
                    "cache_write_tokens": row.cache_write_tokens,
                    "estimated_cost_microusd": row.estimated_cost_microusd,
                    "pricing_version": row.pricing_version,
                    "token_source": row.token_source
            })
        })
    }

    async fn fetch_summaries(
        &self,
        user_id: Uuid,
        budget: &mut ExportBudget,
    ) -> Result<Vec<Value>> {
        let rows = self
            .clickhouse
            .get_client()
            .query(&format!(
                "SELECT toString(date) AS date, total_seconds, heartbeat_count
                 FROM wakaclock.daily_totals
                 WHERE user_id = ?
                 ORDER BY date ASC
                LIMIT {}",
                budget.query_limit()
            ))
            .bind(user_id)
            .fetch_all::<SummaryExportRow>()
            .await
            .context("fetch summary export rows")?;
        budget.consume(rows.len())?;
        map_export_rows(rows, budget, |row| {
            json!({
                "date": row.date,
                "total_seconds": row.total_seconds,
                "heartbeat_count": row.heartbeat_count
            })
        })
    }

    async fn fetch_projects(&self, user_id: Uuid, budget: &mut ExportBudget) -> Result<Vec<Value>> {
        let rows = self
            .clickhouse
            .get_client()
            .query(&format!(
                "SELECT toString(date) AS date, project, total_seconds, heartbeat_count
                 FROM wakaclock.project_daily
                 WHERE user_id = ?
                 ORDER BY date ASC, project ASC
                LIMIT {}",
                budget.query_limit()
            ))
            .bind(user_id)
            .fetch_all::<ProjectExportRow>()
            .await
            .context("fetch project export rows")?;
        budget.consume(rows.len())?;
        map_export_rows(rows, budget, |row| {
            json!({
                "date": row.date,
                "project": row.project,
                "total_seconds": row.total_seconds,
                "heartbeat_count": row.heartbeat_count
            })
        })
    }

    async fn fetch_external_durations(
        &self,
        user_id: Uuid,
        budget: &mut ExportBudget,
    ) -> Result<Vec<Value>> {
        let rows = self
            .clickhouse
            .get_client()
            .query(&format!(
                "SELECT source, external_id, start_time, end_time,
                        duration_seconds, category, entity_type, entity, project,
                        provenance, sync_version
                 FROM wakaclock.external_durations_raw FINAL
                 WHERE user_id = ?
                 ORDER BY start_time ASC
                LIMIT {}",
                budget.query_limit()
            ))
            .bind(user_id)
            .fetch_all::<ExternalDurationExportRow>()
            .await
            .context("fetch external-duration export rows")?;
        budget.consume(rows.len())?;
        map_export_rows(rows, budget, |row| {
            json!({
                "source": row.source,
                "external_id": row.external_id,
                "start_time": row.start_time,
                "end_time": row.end_time,
                "duration_seconds": row.duration_seconds,
                "category": row.category,
                "entity_type": row.entity_type,
                "entity": safe_event_entity(&row.entity),
                "project": row.project,
                "provenance": row.provenance,
                "sync_version": row.sync_version
            })
        })
    }

    async fn fetch_goals(&self, user_id: Uuid, budget: &mut ExportBudget) -> Result<Vec<Value>> {
        let rows = self
            .required()?
            .client()
            .query(
                &format!(
                    "SELECT id, name, metric, filter_kind, filter_value, period,
                        target_seconds, direction, timezone, starts_on, ends_on,
                        priority, public, created_at, updated_at
                 FROM goals
                 WHERE user_id = $1
                 ORDER BY starts_on ASC, id ASC
                 LIMIT {}",
                    budget.query_limit()
                ),
                &[&user_id],
            )
            .await
            .context("fetch goal export rows")?;
        budget.consume(rows.len())?;
        map_export_rows(rows, budget, |row| {
            json!({
                "id": row.get::<_, Uuid>("id"),
                "name": row.get::<_, String>("name"),
                "metric": row.get::<_, String>("metric"),
                "filter_kind": row.get::<_, String>("filter_kind"),
                "filter_value": row.get::<_, Option<String>>("filter_value"),
                "period": row.get::<_, String>("period"),
                "target_seconds": row.get::<_, i64>("target_seconds"),
                "direction": row.get::<_, String>("direction"),
                "timezone": row.get::<_, String>("timezone"),
                "starts_on": row.get::<_, chrono::NaiveDate>("starts_on").to_string(),
                "ends_on": row.get::<_, Option<chrono::NaiveDate>>("ends_on").map(|date| date.to_string()),
                "priority": row.get::<_, i32>("priority"),
                "public": row.get::<_, bool>("public"),
                "created_at": row.get::<_, DateTime<Utc>>("created_at"),
                "updated_at": row.get::<_, DateTime<Utc>>("updated_at")
            })
        })
    }

    async fn fetch_organizations(
        &self,
        user_id: Uuid,
        budget: &mut ExportBudget,
    ) -> Result<Vec<Value>> {
        let rows = self
            .required()?
            .client()
            .query(
                &format!(
                    "SELECT o.id, o.slug, o.name, m.role, m.seat_type,
                        m.joined_at, m.deactivated_at
                 FROM organizations o
                 JOIN organization_members m ON m.organization_id = o.id
                 WHERE m.user_id = $1
                 ORDER BY o.slug ASC
                 LIMIT {}",
                    budget.query_limit()
                ),
                &[&user_id],
            )
            .await
            .context("fetch organization export rows")?;
        budget.consume(rows.len())?;
        map_export_rows(rows, budget, |row| {
            json!({
                "id": row.get::<_, Uuid>("id"),
                "slug": row.get::<_, String>("slug"),
                "name": row.get::<_, String>("name"),
                "role": row.get::<_, String>("role"),
                "seat_type": row.get::<_, String>("seat_type"),
                "joined_at": row.get::<_, DateTime<Utc>>("joined_at"),
                "deactivated_at": row.get::<_, Option<DateTime<Utc>>>("deactivated_at")
            })
        })
    }

    async fn hydrate_job(&self, row: Row) -> Result<ExportJob> {
        let mut job = job_from_row(&row)?;
        let artifact_key = row
            .try_get::<_, Option<String>>("artifact_object_key")
            .ok()
            .flatten();
        let artifact_checksum = row
            .try_get::<_, Option<String>>("artifact_sha256")
            .ok()
            .flatten();
        let artifact_url_expires_at = row
            .try_get::<_, Option<DateTime<Utc>>>("artifact_url_expires_at")
            .ok()
            .flatten();
        if job.checksum.is_none() {
            job.checksum = artifact_checksum;
        }
        let url_expires_at = match (job.expires_at, artifact_url_expires_at) {
            (Some(job_expires_at), Some(artifact_expires_at)) => {
                Some(job_expires_at.min(artifact_expires_at))
            }
            (Some(expires_at), None) | (None, Some(expires_at)) => Some(expires_at),
            (None, None) => None,
        };
        if let (Some(key), Some(expires_at), Some(object_store)) =
            (artifact_key, url_expires_at, self.object_store.as_ref())
        {
            let now = Utc::now();
            if expires_at > now {
                let ttl = (expires_at - now)
                    .to_std()
                    .unwrap_or_else(|_| Duration::from_secs(1));
                job.download_url = Some(
                    object_store
                        .signed_get_url(&key, ttl)
                        .await
                        .map_err(|error| anyhow!("sign export download URL: {error}"))?,
                );
            }
        }
        Ok(job)
    }

    pub async fn list(&self, user_id: Uuid) -> Result<Vec<ExportJob>> {
        let postgres = self.required()?;
        let rows = postgres
            .client()
            .query(
                "SELECT e.id, e.format, e.scope, e.status, e.progress, e.requested_at,
                        e.completed_at, e.expires_at,
                        a.object_key AS artifact_object_key,
                        a.sha256 AS artifact_sha256,
                        a.signed_url_expires_at AS artifact_url_expires_at
                 FROM export_jobs e
                 LEFT JOIN LATERAL (
                    SELECT object_key, sha256, signed_url_expires_at
                    FROM export_artifacts
                    WHERE export_job_id = e.id
                    ORDER BY created_at DESC
                    LIMIT 1
                 ) a ON TRUE
                 WHERE e.user_id = $1
                 ORDER BY e.requested_at DESC LIMIT 100",
                &[&user_id],
            )
            .await
            .context("failed to list export jobs")?;
        let mut jobs = Vec::with_capacity(rows.len());
        for row in rows {
            jobs.push(self.hydrate_job(row).await?);
        }
        Ok(jobs)
    }

    pub async fn get(&self, user_id: Uuid, id: Uuid) -> Result<Option<ExportJob>> {
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT e.id, e.format, e.scope, e.status, e.progress, e.requested_at,
                        e.completed_at, e.expires_at,
                        a.object_key AS artifact_object_key,
                        a.sha256 AS artifact_sha256,
                        a.signed_url_expires_at AS artifact_url_expires_at
                 FROM export_jobs e
                 LEFT JOIN LATERAL (
                    SELECT object_key, sha256, signed_url_expires_at
                    FROM export_artifacts
                    WHERE export_job_id = e.id
                    ORDER BY created_at DESC
                    LIMIT 1
                 ) a ON TRUE
                 WHERE e.id = $1 AND e.user_id = $2",
                &[&id, &user_id],
            )
            .await
            .context("failed to load export job")?;
        if let Some(row) = row {
            Ok(Some(self.hydrate_job(row).await?))
        } else {
            Ok(None)
        }
    }

    pub async fn cancel(&self, user_id: Uuid, id: Uuid) -> Result<bool> {
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let row = tx
            .query_opt(
                "UPDATE export_jobs SET status = 'cancelled'
                 WHERE id = $1 AND user_id = $2 AND status IN ('queued', 'running')
                 RETURNING async_job_id",
                &[&id, &user_id],
            )
            .await
            .context("failed to cancel export job")?;
        let Some(row) = row else {
            tx.rollback().await?;
            return Ok(false);
        };
        let async_job_id: Option<Uuid> = row.get("async_job_id");
        if let Some(async_job_id) = async_job_id {
            tx.execute(
                "UPDATE async_jobs
                    SET status = 'cancelled', finished_at = now(),
                        lease_owner = NULL, lease_expires_at = NULL
                  WHERE id = $1 AND status IN ('queued', 'running')",
                &[&async_job_id],
            )
            .await
            .context("cancel export async job")?;
        }
        tx.commit().await.context("commit export cancellation")?;
        Ok(true)
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

fn validate_idempotency_key(key: Option<&str>) -> Result<()> {
    if let Some(key) = key {
        if key.is_empty() || key.len() > 128 || !key.is_ascii() {
            anyhow::bail!("Idempotency-Key must be 1..=128 ASCII bytes");
        }
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ExportJobParams {
    schema_version: u16,
    export_job_id: Uuid,
}

#[derive(Debug)]
struct ExportSpec {
    id: Uuid,
    format: String,
    scope: String,
    status: String,
    requested_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy)]
struct ExportWorkerFence {
    async_job_id: Uuid,
    attempt: i16,
    lease_owner: Uuid,
}

#[derive(Debug)]
enum FinalizeArtifact {
    Cancelled,
    Completed { checksum: String, bytes: i64 },
}

#[derive(Debug, Deserialize, clickhouse::Row)]
struct HeartbeatExportRow {
    date: String,
    time: f64,
    entity: String,
    project: Option<String>,
    branch: Option<String>,
    language: Option<String>,
    lines: Option<u32>,
    is_write: bool,
    category: String,
    editor: String,
    operating_system: String,
    heartbeat_id: Option<String>,
    active_seconds: Option<f64>,
    actor_type: String,
    ai_agent: Option<String>,
    ai_provider: Option<String>,
    ai_model: Option<String>,
    ai_lines_added: Option<u32>,
    ai_lines_deleted: Option<u32>,
    human_lines_added: Option<u32>,
    human_lines_deleted: Option<u32>,
    unattributed_lines_added: Option<u32>,
    unattributed_lines_deleted: Option<u32>,
}

#[derive(Debug, Deserialize, clickhouse::Row)]
struct AiUsageExportRow {
    date: String,
    usage_event_id: String,
    ai_session_id: String,
    event_time: u32,
    project_id: String,
    ai_agent: String,
    ai_provider: Option<String>,
    ai_model: Option<String>,
    prompt_count: u32,
    prompt_character_count: Option<u64>,
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
    cache_read_tokens: Option<u64>,
    cache_write_tokens: Option<u64>,
    estimated_cost_microusd: Option<u64>,
    pricing_version: Option<String>,
    token_source: String,
}

#[derive(Debug, Deserialize, clickhouse::Row)]
struct SummaryExportRow {
    date: String,
    total_seconds: f64,
    heartbeat_count: u64,
}

#[derive(Debug, Deserialize, clickhouse::Row)]
struct ProjectExportRow {
    date: String,
    project: String,
    total_seconds: f64,
    heartbeat_count: u64,
}

#[derive(Debug, Deserialize, clickhouse::Row)]
struct ExternalDurationExportRow {
    source: String,
    external_id: String,
    start_time: f64,
    end_time: f64,
    duration_seconds: f64,
    category: String,
    entity_type: String,
    entity: String,
    project: Option<String>,
    provenance: String,
    sync_version: String,
}

fn bounded_content(content: Vec<u8>) -> Result<Vec<u8>> {
    if content.len() > MAX_EXPORT_BYTES {
        anyhow::bail!("export exceeds the maximum byte limit");
    }
    Ok(content)
}

fn map_export_rows<T, F>(rows: Vec<T>, budget: &mut ExportBudget, map: F) -> Result<Vec<Value>>
where
    F: Fn(T) -> Value,
{
    let mut values = Vec::with_capacity(rows.len());
    for row in rows {
        let value = map(row);
        budget.account_value(&value)?;
        values.push(value);
    }
    Ok(values)
}

fn non_empty(value: String) -> Option<String> {
    (!value.is_empty()).then_some(value)
}

fn sha256_hex(value: &[u8]) -> String {
    let digest = Sha256::digest(value);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn csv_document(document: &Value) -> Result<Vec<u8>> {
    let mut output = String::from("section,record_json\n");
    let sections = document
        .get("data")
        .and_then(Value::as_object)
        .context("export document has no data object")?;
    for (section, records) in sections {
        let records = records
            .as_array()
            .context("export document section is not an array")?;
        for record in records {
            let encoded = serde_json::to_string(record)?;
            output.push_str(&csv_escape(section));
            output.push(',');
            output.push_str(&csv_escape(&encoded));
            output.push('\n');
        }
    }
    Ok(output.into_bytes())
}

fn csv_escape(value: &str) -> String {
    if value
        .bytes()
        .any(|byte| matches!(byte, b',' | b'"' | b'\n' | b'\r'))
    {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

/// Build a standards-compliant ZIP archive using the uncompressed "store" method.
/// Exports are already JSON/CSV, so compression would add CPU and another failure
/// surface without reducing sensitive data exposure. The archive contains only the
/// two generated files and no caller-controlled path names.
fn stored_zip(files: &[(&str, &[u8])]) -> Result<Vec<u8>> {
    if files.is_empty() || files.len() > usize::from(u16::MAX) {
        anyhow::bail!("invalid export archive entry count");
    }
    let mut archive = Vec::new();
    let mut offsets = Vec::with_capacity(files.len());
    for (name, content) in files {
        validate_archive_name(name)?;
        let name_bytes = name.as_bytes();
        let size = u32::try_from(content.len()).context("export archive entry is too large")?;
        let offset = u32::try_from(archive.len()).context("export archive is too large")?;
        offsets.push((name_bytes, crc32(content), size, offset));
        push_u32(&mut archive, 0x0403_4b50);
        push_u16(&mut archive, 20);
        push_u16(&mut archive, 0);
        push_u16(&mut archive, 0);
        push_u16(&mut archive, 0);
        push_u16(&mut archive, 0);
        push_u32(&mut archive, crc32(content));
        push_u32(&mut archive, size);
        push_u32(&mut archive, size);
        push_u16(
            &mut archive,
            u16::try_from(name_bytes.len()).context("export archive entry name is too long")?,
        );
        push_u16(&mut archive, 0);
        archive.extend_from_slice(name_bytes);
        archive.extend_from_slice(content);
    }
    let central_offset = u32::try_from(archive.len()).context("export archive is too large")?;
    for (name, checksum, size, offset) in &offsets {
        push_u32(&mut archive, 0x0201_4b50);
        push_u16(&mut archive, 20);
        push_u16(&mut archive, 20);
        push_u16(&mut archive, 0);
        push_u16(&mut archive, 0);
        push_u16(&mut archive, 0);
        push_u16(&mut archive, 0);
        push_u32(&mut archive, *checksum);
        push_u32(&mut archive, *size);
        push_u32(&mut archive, *size);
        push_u16(
            &mut archive,
            u16::try_from(name.len()).context("export archive entry name is too long")?,
        );
        push_u16(&mut archive, 0);
        push_u16(&mut archive, 0);
        push_u16(&mut archive, 0);
        push_u16(&mut archive, 0);
        push_u32(&mut archive, 0);
        push_u32(&mut archive, *offset);
        archive.extend_from_slice(name);
    }
    let central_size = u32::try_from(archive.len())
        .context("export archive is too large")?
        .checked_sub(central_offset)
        .context("invalid export archive offsets")?;
    push_u32(&mut archive, 0x0605_4b50);
    push_u16(&mut archive, 0);
    push_u16(&mut archive, 0);
    push_u16(&mut archive, u16::try_from(files.len())?);
    push_u16(&mut archive, u16::try_from(files.len())?);
    push_u32(&mut archive, central_size);
    push_u32(&mut archive, central_offset);
    push_u16(&mut archive, 0);
    Ok(archive)
}

fn validate_archive_name(name: &str) -> Result<()> {
    if name.is_empty()
        || name.starts_with('/')
        || name.contains("..")
        || !name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    {
        anyhow::bail!("invalid export archive entry name");
    }
    Ok(())
}

fn crc32(value: &[u8]) -> u32 {
    let mut checksum = u32::MAX;
    for byte in value {
        checksum ^= u32::from(*byte);
        for _ in 0..8 {
            let mask = 0u32.wrapping_sub(checksum & 1);
            checksum = (checksum >> 1) ^ (0xedb8_8320 & mask);
        }
    }
    !checksum
}

fn push_u16(output: &mut Vec<u8>, value: u16) {
    output.extend_from_slice(&value.to_le_bytes());
}

fn push_u32(output: &mut Vec<u8>, value: u32) {
    output.extend_from_slice(&value.to_le_bytes());
}

fn job_from_row(row: &Row) -> Result<ExportJob> {
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
    fn export_budget_is_aggregate_and_fetches_one_sentinel_row() {
        let mut budget = ExportBudget::new(3);
        assert_eq!(budget.query_limit(), 4);
        budget.consume(2).unwrap();
        assert_eq!(budget.query_limit(), 2);
        assert!(budget.consume(2).is_err());
        assert_eq!(budget.query_limit(), 2);
        budget.consume(1).unwrap();
        assert_eq!(budget.query_limit(), 1);
        assert!(budget.consume(1).is_err());
    }

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
