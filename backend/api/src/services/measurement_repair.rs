//! Owner-scoped, metadata-only revision repair for measured AI line outcomes.

use std::{collections::HashMap, sync::Arc};

use anyhow::{bail, Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use uuid::Uuid;
use wakaclock_core::heartbeat::MAX_HEARTBEAT_REVISION;

use crate::{
    infrastructure::postgres::PostgresClient,
    model::{heartbeat::HeartbeatRow, measurement_repair::*},
    repository::heartbeat::HeartbeatRepository,
};

const MAX_REPAIR_CANDIDATES: usize = 1_000;
const MAX_REPAIR_DAYS: i64 = 90;
// Trust Center inputs are owner-supplied corrections, not a replay of the editor
// measurement algorithm. Keep them out of the editor-before-after denominator.
const LINE_METRIC_VERSION: &str = "manual-repair-v1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct StoredMeasurementValues {
    ai_lines_added: Option<u32>,
    ai_lines_deleted: Option<u32>,
    line_metric_version: Option<String>,
    line_measurement_status: Option<String>,
    line_measurement_reason: Option<String>,
    measurement_window_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredRepairItem {
    repair_reference: String,
    status: String,
    reason: Option<String>,
    outcome: MeasurementRepairOutcome,
    base_revision: Option<u32>,
    base_fingerprint: Option<String>,
    apply_revision: Option<u32>,
    rollback_revision: Option<u32>,
    before: Option<StoredMeasurementValues>,
    after: Option<StoredMeasurementValues>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredRepairJob {
    repair_id: Uuid,
    status: String,
    start: String,
    end: String,
    timezone: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    request_candidates: Vec<MeasurementRepairCandidate>,
    items: Vec<StoredRepairItem>,
}

pub struct MeasurementRepairService {
    postgres: Option<Arc<PostgresClient>>,
    heartbeat_repo: Arc<HeartbeatRepository>,
}

impl MeasurementRepairService {
    pub fn new(
        postgres: Option<Arc<PostgresClient>>,
        heartbeat_repo: Arc<HeartbeatRepository>,
    ) -> Self {
        Self {
            postgres,
            heartbeat_repo,
        }
    }

    pub fn available(&self) -> bool {
        self.postgres.is_some()
    }

    pub async fn create_preview(
        &self,
        user_id: Uuid,
        request: StartMeasurementRepair,
    ) -> Result<MeasurementRepairJobView> {
        let postgres = self.postgres()?;
        if request.candidates.is_empty() || request.candidates.len() > MAX_REPAIR_CANDIDATES {
            bail!("measurement repair requires 1 to {MAX_REPAIR_CANDIDATES} candidates");
        }
        let range = crate::model::date_range::ResolvedRange::parse(
            &request.start,
            &request.end,
            Some(&request.timezone),
        )
        .map_err(|error| anyhow::anyhow!("invalid measurement repair date range: {error}"))?;
        if range.days_included() > MAX_REPAIR_DAYS {
            bail!("measurement repair range cannot exceed {MAX_REPAIR_DAYS} days");
        }

        let mut occurrence_counts = HashMap::<String, usize>::new();
        for candidate in &request.candidates {
            validate_reference(&candidate.repair_reference)?;
            *occurrence_counts
                .entry(candidate.repair_reference.clone())
                .or_default() += 1;
        }
        let references = request
            .candidates
            .iter()
            .map(|candidate| candidate.repair_reference.clone())
            .collect::<Vec<_>>();
        let (start_epoch, end_epoch) = range.unix_bounds();
        let rows = self
            .heartbeat_repo
            .get_by_measurement_repair_references(user_id, start_epoch, end_epoch, &references)
            .await?;
        let mut rows_by_reference = HashMap::<String, Vec<&HeartbeatRow>>::new();
        for row in &rows {
            rows_by_reference
                .entry(measurement_repair_reference(row))
                .or_default()
                .push(row);
        }

        let mut items = Vec::with_capacity(request.candidates.len());
        for candidate in &request.candidates {
            let unresolved = |reason: &str| StoredRepairItem {
                repair_reference: candidate.repair_reference.clone(),
                status: "unresolved".to_string(),
                reason: Some(reason.to_string()),
                outcome: candidate.outcome,
                base_revision: None,
                base_fingerprint: None,
                apply_revision: None,
                rollback_revision: None,
                before: None,
                after: None,
            };
            if occurrence_counts.get(&candidate.repair_reference).copied() != Some(1) {
                items.push(unresolved("ambiguous_candidate_reference"));
                continue;
            }
            if candidate.outcome == MeasurementRepairOutcome::Unknown {
                items.push(unresolved("outcome_unresolved"));
                continue;
            }
            let Some(matches) = rows_by_reference.get(&candidate.repair_reference) else {
                items.push(unresolved("source_unresolved"));
                continue;
            };
            if matches.len() != 1 {
                items.push(unresolved("ambiguous_operation_reference"));
                continue;
            }
            let row = matches[0];
            if !matches!(row.actor_type.as_str(), "ai_verified" | "ai_inferred")
                && !row.is_ai_generated
            {
                items.push(unresolved("non_ai_operation"));
                continue;
            }
            if row.heartbeat_id.is_none() {
                items.push(unresolved("missing_stable_operation_id"));
                continue;
            }
            // Reserve room for both apply and a possible rollback revision.
            if row.revision >= MAX_HEARTBEAT_REVISION.saturating_sub(1) {
                items.push(unresolved("revision_limit_reached"));
                continue;
            }
            let after_lines = match candidate.outcome {
                MeasurementRepairOutcome::Success | MeasurementRepairOutcome::Partial => {
                    match (candidate.lines_added, candidate.lines_deleted) {
                        (Some(added), Some(deleted)) => (added, deleted),
                        _ => {
                            items.push(unresolved("line_counts_unavailable"));
                            continue;
                        }
                    }
                }
                MeasurementRepairOutcome::Failed => {
                    if candidate.lines_added.is_some() || candidate.lines_deleted.is_some() {
                        items.push(unresolved("failed_operation_cannot_have_applied_lines"));
                        continue;
                    }
                    (0, 0)
                }
                MeasurementRepairOutcome::Unknown => unreachable!(),
            };
            let before = values_from_row(row);
            let after = StoredMeasurementValues {
                ai_lines_added: Some(after_lines.0),
                ai_lines_deleted: Some(after_lines.1),
                line_metric_version: Some(LINE_METRIC_VERSION.to_string()),
                line_measurement_status: Some("user_repaired".to_string()),
                line_measurement_reason: Some("user_supplied_correction".to_string()),
                measurement_window_id: before.measurement_window_id.clone(),
            };
            let unchanged = before == after;
            items.push(StoredRepairItem {
                repair_reference: candidate.repair_reference.clone(),
                status: if unchanged { "unchanged" } else { "ready" }.to_string(),
                reason: None,
                outcome: candidate.outcome,
                base_revision: Some(row.revision),
                base_fingerprint: Some(row_fingerprint(row)?),
                apply_revision: Some(row.revision.saturating_add(1)),
                rollback_revision: None,
                before: Some(before),
                after: Some(after),
            });
        }

        let now = Utc::now();
        let job = StoredRepairJob {
            repair_id: request.repair_id,
            status: "preview".to_string(),
            start: request.start,
            end: request.end,
            timezone: range.timezone.to_string(),
            created_at: now,
            updated_at: now,
            request_candidates: request.candidates,
            items,
        };
        let value = serde_json::to_value(&job)?;
        let inserted = postgres
            .client()
            .execute(
                "INSERT INTO measurement_repair_jobs
                    (repair_id, user_id, status, created_at, updated_at, job)
                 VALUES ($1, $2, $3, $4, $4, $5)
                 ON CONFLICT (user_id, repair_id) DO NOTHING",
                &[
                    &job.repair_id,
                    &user_id,
                    &job.status,
                    &job.created_at,
                    &value,
                ],
            )
            .await
            .context("persist measurement repair preview")?;
        if inserted == 0 {
            let existing = self.load_job(user_id, job.repair_id).await?;
            if existing.request_candidates != job.request_candidates
                || existing.start != job.start
                || existing.end != job.end
                || existing.timezone != job.timezone
            {
                bail!("measurement repair conflict: repair_id was already used");
            }
            return Ok(job_view(existing));
        }
        Ok(job_view(job))
    }

    pub async fn get(&self, user_id: Uuid, repair_id: Uuid) -> Result<MeasurementRepairJobView> {
        Ok(job_view(self.load_job(user_id, repair_id).await?))
    }

    pub async fn list(&self, user_id: Uuid) -> Result<Vec<MeasurementRepairJobView>> {
        let postgres = self.postgres()?;
        let rows = postgres
            .client()
            .query(
                "SELECT job FROM measurement_repair_jobs
                 WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100",
                &[&user_id],
            )
            .await
            .context("read measurement repair history")?;
        rows.into_iter()
            .map(|row| {
                let value: Value = row.get("job");
                serde_json::from_value::<StoredRepairJob>(value)
                    .map(job_view)
                    .context("decode measurement repair history")
            })
            .collect()
    }

    pub async fn apply(&self, user_id: Uuid, repair_id: Uuid) -> Result<MeasurementRepairJobView> {
        let postgres = self.postgres()?;
        let account_lock = postgres.account_activity_lock(user_id).await?;
        if postgres
            .is_account_deleted_on(&account_lock, user_id)
            .await?
        {
            bail!("measurement repair conflict: account is unavailable");
        }
        let mut job = self.load_job(user_id, repair_id).await?;
        if job.status == "applied" {
            return Ok(job_view(job));
        }
        if !matches!(job.status.as_str(), "preview" | "applying") {
            bail!("measurement repair conflict: job is not in an applicable state");
        }
        if job.items.iter().any(|item| item.status == "conflict") {
            bail!("measurement repair conflict: preview must be rebuilt");
        }
        job.status = "applying".to_string();
        job.updated_at = Utc::now();
        for item in &mut job.items {
            if item.status == "ready" {
                item.status = "applying".to_string();
            }
        }
        self.persist_job(user_id, &job).await?;

        let range = parse_job_range(&job)?;
        let refs = job
            .items
            .iter()
            .filter(|item| item.status == "applying" || item.status == "applied")
            .map(|item| item.repair_reference.clone())
            .collect::<Vec<_>>();
        let rows = self
            .heartbeat_repo
            .get_by_measurement_repair_references(user_id, range.0, range.1, &refs)
            .await?;
        let by_reference = rows_by_reference(&rows);
        for index in 0..job.items.len() {
            if job.items[index].status != "applying" {
                continue;
            }
            let item = &job.items[index];
            let row = unique_row(&by_reference, &item.repair_reference)?;
            let expected_revision = item
                .apply_revision
                .context("repair apply revision was not reserved")?;
            if row.revision == expected_revision
                && values_from_row(row) == item.after.clone().unwrap()
            {
                job.items[index].status = "applied".to_string();
                job.items[index].reason = None;
                job.updated_at = Utc::now();
                self.persist_job(user_id, &job).await?;
                continue;
            }
            if row.revision != item.base_revision.unwrap_or(u32::MAX)
                || row_fingerprint(row)? != item.base_fingerprint.as_deref().unwrap_or_default()
            {
                job.items[index].status = "conflict".to_string();
                job.items[index].reason =
                    Some("canonical_operation_changed_after_preview".to_string());
                job.status = "conflict".to_string();
                job.updated_at = Utc::now();
                self.persist_job(user_id, &job).await?;
                bail!("measurement repair conflict: canonical operation changed after preview");
            }

            let mut correction = row.clone();
            correction.revision = expected_revision;
            set_values(
                &mut correction,
                item.after.as_ref().context("repair target missing")?,
            );
            self.heartbeat_repo.insert_batch(vec![correction]).await?;
            job.items[index].status = "applied".to_string();
            job.items[index].reason = None;
            job.updated_at = Utc::now();
            self.persist_job(user_id, &job).await?;
        }
        job.status = "applied".to_string();
        job.updated_at = Utc::now();
        self.persist_job(user_id, &job).await?;
        Ok(job_view(job))
    }

    pub async fn rollback(
        &self,
        user_id: Uuid,
        repair_id: Uuid,
    ) -> Result<MeasurementRepairJobView> {
        let postgres = self.postgres()?;
        let account_lock = postgres.account_activity_lock(user_id).await?;
        if postgres
            .is_account_deleted_on(&account_lock, user_id)
            .await?
        {
            bail!("measurement repair conflict: account is unavailable");
        }
        let mut job = self.load_job(user_id, repair_id).await?;
        if job.status == "rolled_back" {
            return Ok(job_view(job));
        }
        if !matches!(job.status.as_str(), "applied" | "rolling_back" | "conflict")
            || !job
                .items
                .iter()
                .any(|item| item.status == "applied" || item.status == "rolling_back")
        {
            bail!("measurement repair conflict: job has no applied revisions to roll back");
        }
        for item in &mut job.items {
            if item.status == "applied" {
                let applied_revision = item.apply_revision.context("applied revision missing")?;
                if applied_revision >= MAX_HEARTBEAT_REVISION {
                    bail!("measurement repair conflict: revision limit reached during rollback");
                }
                item.rollback_revision = Some(applied_revision.saturating_add(1));
                item.status = "rolling_back".to_string();
            }
        }
        job.status = "rolling_back".to_string();
        job.updated_at = Utc::now();
        self.persist_job(user_id, &job).await?;

        let range = parse_job_range(&job)?;
        let refs = job
            .items
            .iter()
            .filter(|item| item.status == "rolling_back")
            .map(|item| item.repair_reference.clone())
            .collect::<Vec<_>>();
        let rows = self
            .heartbeat_repo
            .get_by_measurement_repair_references(user_id, range.0, range.1, &refs)
            .await?;
        let by_reference = rows_by_reference(&rows);
        for index in 0..job.items.len() {
            if job.items[index].status != "rolling_back" {
                continue;
            }
            let item = &job.items[index];
            let row = unique_row(&by_reference, &item.repair_reference)?;
            let rollback_revision = item
                .rollback_revision
                .context("rollback revision was not reserved")?;
            let before = item
                .before
                .as_ref()
                .context("original measurement missing")?;
            if row.revision == rollback_revision && values_from_row(row) == *before {
                job.items[index].status = "rolled_back".to_string();
                job.items[index].reason = None;
                job.updated_at = Utc::now();
                self.persist_job(user_id, &job).await?;
                continue;
            }
            if row.revision != item.apply_revision.unwrap_or(u32::MAX)
                || values_from_row(row) != item.after.clone().unwrap()
            {
                job.items[index].status = "conflict".to_string();
                job.items[index].reason =
                    Some("canonical_operation_changed_before_rollback".to_string());
                job.status = "conflict".to_string();
                job.updated_at = Utc::now();
                self.persist_job(user_id, &job).await?;
                bail!("measurement repair conflict: canonical operation changed before rollback");
            }
            let mut correction = row.clone();
            correction.revision = rollback_revision;
            set_values(&mut correction, before);
            self.heartbeat_repo.insert_batch(vec![correction]).await?;
            job.items[index].status = "rolled_back".to_string();
            job.items[index].reason = None;
            job.updated_at = Utc::now();
            self.persist_job(user_id, &job).await?;
        }
        job.status = if job
            .items
            .iter()
            .any(|item| item.status == "conflict" || item.status == "rolling_back")
        {
            "conflict"
        } else {
            "rolled_back"
        }
        .to_string();
        job.updated_at = Utc::now();
        self.persist_job(user_id, &job).await?;
        Ok(job_view(job))
    }

    fn postgres(&self) -> Result<&Arc<PostgresClient>> {
        self.postgres
            .as_ref()
            .context("measurement repair requires PostgreSQL storage")
    }

    async fn load_job(&self, user_id: Uuid, repair_id: Uuid) -> Result<StoredRepairJob> {
        let row = self
            .postgres()?
            .client()
            .query_opt(
                "SELECT job FROM measurement_repair_jobs WHERE user_id = $1 AND repair_id = $2",
                &[&user_id, &repair_id],
            )
            .await
            .context("read measurement repair job")?
            .context("measurement repair job not found")?;
        let value: Value = row.get("job");
        serde_json::from_value(value).context("decode measurement repair job")
    }

    async fn persist_job(&self, user_id: Uuid, job: &StoredRepairJob) -> Result<()> {
        let value = serde_json::to_value(job)?;
        let updated = self
            .postgres()?
            .client()
            .execute(
                "UPDATE measurement_repair_jobs
                 SET status = $3, updated_at = $4, job = $5
                 WHERE user_id = $1 AND repair_id = $2",
                &[
                    &user_id,
                    &job.repair_id,
                    &job.status,
                    &job.updated_at,
                    &value,
                ],
            )
            .await
            .context("persist measurement repair progress")?;
        if updated != 1 {
            bail!("measurement repair job disappeared during update");
        }
        Ok(())
    }
}

fn validate_reference(reference: &str) -> Result<()> {
    if reference.len() != 64
        || !reference
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        bail!("repair_reference must be a 64-character opaque operation ID");
    }
    Ok(())
}

fn measurement_repair_reference(row: &HeartbeatRow) -> String {
    let session = row.session_id.as_deref().unwrap_or_default();
    let operation = row
        .ai_event_id
        .as_deref()
        .or(row.ai_change_id.as_deref())
        .or(row.heartbeat_id.as_deref())
        .unwrap_or_default();
    measurement_repair_reference_parts(session, operation, &row.entity)
}

fn measurement_repair_reference_parts(session: &str, operation: &str, entity: &str) -> String {
    let reference = format!(
        "{}:{session}{}:{operation}{}:{entity}",
        session.len(),
        operation.len(),
        entity.len(),
    );
    format!("{:x}", Sha256::digest(reference.as_bytes()))
}

fn values_from_row(row: &HeartbeatRow) -> StoredMeasurementValues {
    StoredMeasurementValues {
        ai_lines_added: row.ai_lines_added,
        ai_lines_deleted: row.ai_lines_deleted,
        line_metric_version: row.line_metric_version.clone(),
        line_measurement_status: row.line_measurement_status.clone(),
        line_measurement_reason: row.line_measurement_reason.clone(),
        measurement_window_id: row.measurement_window_id.clone(),
    }
}

fn set_values(row: &mut HeartbeatRow, values: &StoredMeasurementValues) {
    row.ai_lines_added = values.ai_lines_added;
    row.ai_lines_deleted = values.ai_lines_deleted;
    row.line_metric_version = values.line_metric_version.clone();
    row.line_measurement_status = values.line_measurement_status.clone();
    row.line_measurement_reason = values.line_measurement_reason.clone();
    row.measurement_window_id = values.measurement_window_id.clone();
}

fn row_fingerprint(row: &HeartbeatRow) -> Result<String> {
    let value = serde_json::to_vec(row).context("serialize canonical heartbeat fingerprint")?;
    Ok(format!("{:x}", Sha256::digest(value)))
}

fn parse_job_range(job: &StoredRepairJob) -> Result<(f64, f64)> {
    let range = crate::model::date_range::ResolvedRange::parse(
        &job.start,
        &job.end,
        Some(&job.timezone),
    )
    .map_err(|error| anyhow::anyhow!("stored measurement repair range is invalid: {error}"))?;
    Ok(range.unix_bounds())
}

fn rows_by_reference<'a>(rows: &'a [HeartbeatRow]) -> HashMap<String, Vec<&'a HeartbeatRow>> {
    let mut map = HashMap::<String, Vec<&HeartbeatRow>>::new();
    for row in rows {
        map.entry(measurement_repair_reference(row))
            .or_default()
            .push(row);
    }
    map
}

fn unique_row<'a>(
    rows: &'a HashMap<String, Vec<&'a HeartbeatRow>>,
    reference: &str,
) -> Result<&'a HeartbeatRow> {
    match rows.get(reference).map(Vec::as_slice) {
        Some([row]) => Ok(*row),
        _ => bail!("measurement repair conflict: operation reference is missing or ambiguous"),
    }
}

fn job_view(job: StoredRepairJob) -> MeasurementRepairJobView {
    let count = |status: &str| {
        job.items
            .iter()
            .filter(|item| item.status == status)
            .count()
    };
    let total = |after: bool, added: bool| -> Option<u64> {
        let values = job.items.iter().filter_map(|item| {
            if item.before.is_some() {
                Some(if after {
                    item.after.as_ref()
                } else {
                    item.before.as_ref()
                })
            } else {
                None
            }
        });
        let mut found = false;
        let mut sum = 0u64;
        for values in values {
            let values = values?;
            let value = if added {
                values.ai_lines_added
            } else {
                values.ai_lines_deleted
            }?;
            found = true;
            sum = sum.saturating_add(u64::from(value));
        }
        found.then_some(sum)
    };
    let items = job
        .items
        .iter()
        .map(|item| MeasurementRepairItemView {
            repair_reference: item.repair_reference.clone(),
            status: item.status.clone(),
            reason: item.reason.clone(),
            outcome: match item.outcome {
                MeasurementRepairOutcome::Success => "success",
                MeasurementRepairOutcome::Partial => "partial",
                MeasurementRepairOutcome::Failed => "failed",
                MeasurementRepairOutcome::Unknown => "unknown",
            }
            .to_string(),
            base_revision: item.base_revision,
            applied_revision: item.apply_revision.filter(|_| {
                item.status == "applied"
                    || item.status == "rolling_back"
                    || item.status == "rolled_back"
            }),
            rolled_back_revision: item
                .rollback_revision
                .filter(|_| item.status == "rolled_back"),
            before: item.before.clone().map(public_values),
            after: item.after.clone().map(public_values),
        })
        .collect();
    let applied = count("applied")
        + count("rolling_back")
        + count("rolled_back")
        + job
            .items
            .iter()
            .filter(|item| item.status == "conflict" && item.rollback_revision.is_some())
            .count();
    MeasurementRepairJobView {
        repair_id: job.repair_id,
        status: job.status,
        start: job.start,
        end: job.end,
        timezone: job.timezone,
        created_at: job.created_at,
        updated_at: job.updated_at,
        requested: job.items.len(),
        ready: count("ready") + count("applying"),
        unchanged: count("unchanged"),
        unresolved: count("unresolved"),
        applied,
        rolled_back: count("rolled_back"),
        conflict_count: count("conflict"),
        before_added_total: total(false, true),
        before_deleted_total: total(false, false),
        after_added_total: total(true, true),
        after_deleted_total: total(true, false),
        items,
    }
}

fn public_values(values: StoredMeasurementValues) -> MeasurementRepairValues {
    MeasurementRepairValues {
        ai_lines_added: values.ai_lines_added,
        ai_lines_deleted: values.ai_lines_deleted,
        line_metric_version: values.line_metric_version,
        line_measurement_status: values.line_measurement_status,
        line_measurement_reason: values.line_measurement_reason,
        measurement_window_id: values.measurement_window_id,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reference_digest_uses_only_the_operation_key_material() {
        let reference =
            measurement_repair_reference_parts("session", "operation", "/private/one.rs");
        assert_eq!(reference.len(), 64);
        assert!(reference.bytes().all(|byte| byte.is_ascii_hexdigit()));
        assert_eq!(
            measurement_repair_reference_parts("session", "operation", "/private/one.rs"),
            reference
        );
        assert_ne!(
            measurement_repair_reference_parts("session", "operation", "/private/two.rs"),
            reference
        );
    }
}
