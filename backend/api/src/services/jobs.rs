//! Owner-triggered background jobs (plans/plan-kafka-rabbitmq-adoption.md, R2, D5).
//!
//! PostgreSQL is authoritative for job state. Creating a job writes its `async_jobs`
//! row and one `outbox_events` row in the same transaction; the relay owned by the
//! dedicated `job-worker` process ([`crate::infrastructure::job_relay`]) turns each
//! outbox row into a RabbitMQ message. A broker outage therefore delays jobs, it does
//! not lose them.
//!
//! Worker-side transitions are fenced by an owner token and an expiring lease. Retry
//! and dead-letter state changes write a targeted outbox row in the same transaction,
//! so acknowledging the current delivery cannot lose the next one.

use anyhow::{anyhow, Context, Result};
use serde_json::Value;
use std::{sync::Arc, time::Duration};
use uuid::Uuid;

use crate::infrastructure::contracts::{
    InfrastructureError, JobEnvelope, JobKind, JobPublishTarget, JobPublisher, JOB_RETRY_DELAYS,
    SYSTEM_TENANT_ID,
};
use crate::infrastructure::postgres::PostgresClient;
use crate::model::async_job::{AsyncJobView, CreatedJob, JobStatus};

/// `outbox_events.aggregate_type` for a job. The relay filters on exactly this, so a
/// row another writer puts in `outbox_events` (integrations use their own type) is
/// never published to `wakaclock.jobs`.
const OUTBOX_AGGREGATE: &str = "async_job";

/// A job re-enqueued this many times by the sweeper is dead-lettered instead. Matches
/// the RabbitMQ retry budget so a job cannot exceed it by alternating the two paths.
const MAX_ATTEMPTS: i16 = JOB_RETRY_DELAYS.len() as i16;

pub struct JobService {
    postgres: Option<Arc<PostgresClient>>,
}

/// What one relay pass did. `broker_error` set means "stop and reconnect"; the rows it
/// already marked are committed.
#[derive(Debug, Default)]
pub struct RelayOutcome {
    pub published: usize,
    /// Rows with an invalid envelope or delivery target. They are retired with a
    /// sanitized failure code so they cannot starve valid rows behind them.
    pub poison: usize,
    pub broker_error: Option<InfrastructureError>,
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct SweepOutcome {
    pub requeued: usize,
    pub dead_lettered: usize,
}

/// Durable job payload returned only to the worker that successfully changed a
/// queued row to running. Identity and parameters come from PostgreSQL, never from
/// the broker payload.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClaimedJob {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub kind: JobKind,
    pub attempt: i16,
    pub params: Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClaimOutcome {
    Claimed(ClaimedJob),
    /// A matching delivery is already protected by a live worker lease.
    AlreadyRunning,
    /// The job has reached a terminal public state, so a duplicate delivery is safe
    /// to acknowledge without executing it again.
    Terminal(JobStatus),
    /// PostgreSQL has already advanced beyond this delivery's attempt.
    StaleAttempt,
    /// The ID is unknown or the broker kind/tenant does not match PostgreSQL.
    Rejected,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransitionOutcome {
    Applied,
    /// The same terminal/retry transition was durably applied by an earlier call.
    AlreadyApplied,
    /// The row is missing, another owner holds it, or this worker's lease expired.
    LostLease,
}

impl JobService {
    pub fn new(postgres: Option<Arc<PostgresClient>>) -> Self {
        Self { postgres }
    }

    fn required(&self) -> Result<&Arc<PostgresClient>> {
        self.postgres
            .as_ref()
            .ok_or_else(|| anyhow!("background jobs require POSTGRES_URL"))
    }

    /// Creates a job and, in the same transaction, the outbox row the relay will
    /// publish. A repeated `idempotency_key` for the same account and kind returns the
    /// job the first call created and writes nothing new.
    pub async fn create(
        &self,
        user_id: Option<Uuid>,
        kind: JobKind,
        params: Value,
        idempotency_key: Option<&str>,
    ) -> Result<CreatedJob> {
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;

        let job_id = Uuid::now_v7();
        let routing_key = kind.routing_key();
        let inserted = tx
            .query_opt(
                "INSERT INTO async_jobs (id, user_id, kind, params, idempotency_key)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (user_id, kind, idempotency_key)
                     WHERE idempotency_key IS NOT NULL
                 DO NOTHING
                 RETURNING id",
                &[&job_id, &user_id, &routing_key, &params, &idempotency_key],
            )
            .await
            .context("insert async_jobs row")?;

        let Some(_) = inserted else {
            // The unique index rejected the insert: an earlier call with this key won.
            let existing = tx
                .query_one(
                    "SELECT id, status FROM async_jobs
                     WHERE user_id IS NOT DISTINCT FROM $1 AND kind = $2 AND idempotency_key = $3",
                    &[&user_id, &routing_key, &idempotency_key],
                )
                .await
                .context("load the job an earlier idempotent call created")?;
            tx.commit().await?;
            let status = existing.get::<_, String>("status");
            return Ok(CreatedJob {
                id: existing.get("id"),
                status: parse_status(&status)?,
                deduplicated: true,
            });
        };

        let tenant_id = user_id.unwrap_or(SYSTEM_TENANT_ID);
        let envelope = JobEnvelope::new(job_id, kind, tenant_id, params)
            .map_err(|error| anyhow!("build job envelope: {error}"))?;
        insert_outbox_row(
            &tx,
            job_id,
            routing_key,
            &envelope,
            &OutboxDelivery::Primary,
        )
        .await
        .context("insert the job's outbox row")?;
        tx.commit().await?;

        Ok(CreatedJob {
            id: job_id,
            status: JobStatus::Queued,
            deduplicated: false,
        })
    }

    /// Reads one job for its owner. A system job (`user_id IS NULL`) is never returned
    /// to a user.
    pub async fn get(&self, user_id: Uuid, job_id: Uuid) -> Result<Option<AsyncJobView>> {
        let postgres = self.required()?;
        let row = postgres
            .client()
            .query_opt(
                "SELECT id, kind, status, attempt, requested_at, started_at, finished_at,
                        error_code, result
                 FROM async_jobs
                 WHERE id = $1 AND user_id = $2",
                &[&job_id, &user_id],
            )
            .await
            .context("load async_jobs row")?;
        row.as_ref().map(view_from_row).transpose()
    }

    /// Atomically fences one queued delivery with a worker-owned lease. A duplicate,
    /// stale or mismatched envelope never receives the authoritative job parameters.
    pub async fn claim(
        &self,
        envelope: &JobEnvelope,
        lease_owner: Uuid,
        lease_for: Duration,
    ) -> Result<ClaimOutcome> {
        envelope
            .validate()
            .map_err(|error| anyhow!("claim invalid job envelope: {error}"))?;
        let lease_seconds = lease_seconds(lease_for)?;
        let lease_seconds_f64 = lease_seconds as f64;
        let attempt = i16::try_from(envelope.attempt)
            .map_err(|_| anyhow!("job attempt exceeds PostgreSQL SMALLINT"))?;
        let user_id =
            (envelope.event.tenant_id != SYSTEM_TENANT_ID).then_some(envelope.event.tenant_id);
        let postgres = self.required()?;

        let claimed = postgres
            .client()
            .query_opt(
                "UPDATE async_jobs
                 SET status = 'running', started_at = COALESCE(started_at, now()),
                     finished_at = NULL, error_code = NULL,
                     lease_owner = $4,
                     lease_expires_at = now() + ($5::double precision * interval '1 second')
                 WHERE id = $1 AND kind = $2 AND attempt = $3 AND status = 'queued'
                   AND user_id IS NOT DISTINCT FROM $6
                 RETURNING id, user_id, kind, attempt, params",
                &[
                    &envelope.job_id,
                    &envelope.kind.routing_key(),
                    &attempt,
                    &lease_owner,
                    &lease_seconds_f64,
                    &user_id,
                ],
            )
            .await
            .context("claim async job")?;
        if let Some(row) = claimed {
            return Ok(ClaimOutcome::Claimed(claimed_job_from_row(&row)?));
        }

        let current = postgres
            .client()
            .query_opt(
                "SELECT user_id, kind, status, attempt FROM async_jobs WHERE id = $1",
                &[&envelope.job_id],
            )
            .await
            .context("classify an unclaimed async job")?;
        let Some(current) = current else {
            return Ok(ClaimOutcome::Rejected);
        };
        if current.get::<_, Option<Uuid>>("user_id") != user_id
            || current.get::<_, String>("kind") != envelope.kind.routing_key()
        {
            return Ok(ClaimOutcome::Rejected);
        }
        if current.get::<_, i16>("attempt") != attempt {
            return Ok(ClaimOutcome::StaleAttempt);
        }
        let status = parse_status(&current.get::<_, String>("status"))?;
        Ok(match status {
            JobStatus::Running | JobStatus::Queued => ClaimOutcome::AlreadyRunning,
            terminal => ClaimOutcome::Terminal(terminal),
        })
    }

    /// Extends only the still-live lease owned by this exact job attempt. Once a
    /// lease expires, its former owner can never revive it.
    pub async fn renew_lease(
        &self,
        job_id: Uuid,
        attempt: i16,
        lease_owner: Uuid,
        lease_for: Duration,
    ) -> Result<bool> {
        let lease_seconds = lease_seconds(lease_for)?;
        let lease_seconds_f64 = lease_seconds as f64;
        let changed = self
            .required()?
            .client()
            .execute(
                "UPDATE async_jobs
                 SET lease_expires_at = now() + ($4::double precision * interval '1 second')
                 WHERE id = $1 AND attempt = $2 AND status = 'running'
                   AND lease_owner = $3 AND lease_expires_at > now()",
                &[&job_id, &attempt, &lease_owner, &lease_seconds_f64],
            )
            .await
            .context("renew async job lease")?;
        Ok(changed == 1)
    }

    /// Completes a job only while this worker still owns its unexpired lease.
    pub async fn complete(
        &self,
        job_id: Uuid,
        attempt: i16,
        lease_owner: Uuid,
        result: Value,
    ) -> Result<TransitionOutcome> {
        let postgres = self.required()?;
        let changed = postgres
            .client()
            .execute(
                "UPDATE async_jobs
                 SET status = 'succeeded', result = $4, error_code = NULL,
                     finished_at = now(), lease_owner = NULL, lease_expires_at = NULL
                 WHERE id = $1 AND attempt = $2 AND status = 'running'
                   AND lease_owner = $3 AND lease_expires_at > now()",
                &[&job_id, &attempt, &lease_owner, &result],
            )
            .await
            .context("complete async job")?;
        if changed == 1 {
            return Ok(TransitionOutcome::Applied);
        }
        classify_transition(postgres, job_id, attempt, JobStatus::Succeeded).await
    }

    /// Schedules a retry through the transactional outbox. The worker acknowledges
    /// the current RabbitMQ delivery only after this commits; it must not publish a
    /// retry itself. Exhausting the fixed retry budget atomically dead-letters instead.
    pub async fn schedule_retry(
        &self,
        job_id: Uuid,
        attempt: i16,
        lease_owner: Uuid,
        error_code: &'static str,
    ) -> Result<TransitionOutcome> {
        validate_error_code(error_code)?;
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let row = tx
            .query_opt(
                "SELECT user_id, kind, params, status, attempt
                 FROM async_jobs
                 WHERE id = $1 AND attempt = $2 AND status = 'running'
                   AND lease_owner = $3 AND lease_expires_at > now()
                 FOR UPDATE",
                &[&job_id, &attempt, &lease_owner],
            )
            .await
            .context("lock async job for retry")?;
        let Some(row) = row else {
            tx.rollback().await?;
            return classify_retry_transition(postgres, job_id, attempt).await;
        };

        let kind_key = row.get::<_, String>("kind");
        let kind = JobKind::from_routing_key(&kind_key)
            .ok_or_else(|| anyhow!("unrecognized async_jobs.kind: {kind_key}"))?;
        let user_id = row.get::<_, Option<Uuid>>("user_id");
        let params = row.get::<_, Value>("params");
        let mut envelope =
            JobEnvelope::new(job_id, kind, user_id.unwrap_or(SYSTEM_TENANT_ID), params)
                .map_err(|error| anyhow!("rebuild retry job envelope: {error}"))?;

        if attempt >= MAX_ATTEMPTS {
            envelope.attempt = attempt.max(0) as u16;
            tx.execute(
                "UPDATE async_jobs
                 SET status = 'dead_lettered', error_code = 'retries_exhausted',
                     finished_at = now(), lease_owner = NULL, lease_expires_at = NULL
                 WHERE id = $1",
                &[&job_id],
            )
            .await
            .context("dead-letter an exhausted async job")?;
            insert_outbox_row(
                &tx,
                job_id,
                kind.routing_key(),
                &envelope,
                &OutboxDelivery::DeadLetter("retries_exhausted"),
            )
            .await?;
        } else {
            let next_attempt = attempt + 1;
            let delay = JOB_RETRY_DELAYS[usize::try_from(attempt).unwrap_or(usize::MAX)];
            envelope.attempt = next_attempt as u16;
            tx.execute(
                "UPDATE async_jobs
                 SET status = 'queued', attempt = $2, started_at = NULL,
                     finished_at = NULL, error_code = $3,
                     lease_owner = NULL, lease_expires_at = NULL
                 WHERE id = $1",
                &[&job_id, &next_attempt, &error_code],
            )
            .await
            .context("schedule async job retry")?;
            insert_outbox_row(
                &tx,
                job_id,
                kind.routing_key(),
                &envelope,
                &OutboxDelivery::Retry(delay),
            )
            .await?;
        }
        tx.commit().await?;
        Ok(TransitionOutcome::Applied)
    }

    /// Permanently fails a job and writes its DLQ publication to the same transaction.
    pub async fn dead_letter(
        &self,
        job_id: Uuid,
        attempt: i16,
        lease_owner: Uuid,
        error_code: &'static str,
    ) -> Result<TransitionOutcome> {
        validate_error_code(error_code)?;
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let row = tx
            .query_opt(
                "SELECT user_id, kind, params FROM async_jobs
                 WHERE id = $1 AND attempt = $2 AND status = 'running'
                   AND lease_owner = $3 AND lease_expires_at > now()
                 FOR UPDATE",
                &[&job_id, &attempt, &lease_owner],
            )
            .await
            .context("lock async job for dead-letter")?;
        let Some(row) = row else {
            tx.rollback().await?;
            return classify_transition(postgres, job_id, attempt, JobStatus::DeadLettered).await;
        };
        let kind_key = row.get::<_, String>("kind");
        let kind = JobKind::from_routing_key(&kind_key)
            .ok_or_else(|| anyhow!("unrecognized async_jobs.kind: {kind_key}"))?;
        let user_id = row.get::<_, Option<Uuid>>("user_id");
        let mut envelope = JobEnvelope::new(
            job_id,
            kind,
            user_id.unwrap_or(SYSTEM_TENANT_ID),
            row.get("params"),
        )
        .map_err(|error| anyhow!("rebuild dead-letter job envelope: {error}"))?;
        envelope.attempt = attempt.max(0) as u16;
        tx.execute(
            "UPDATE async_jobs
             SET status = 'dead_lettered', error_code = $2, finished_at = now(),
                 lease_owner = NULL, lease_expires_at = NULL
             WHERE id = $1",
            &[&job_id, &error_code],
        )
        .await
        .context("dead-letter async job")?;
        insert_outbox_row(
            &tx,
            job_id,
            kind.routing_key(),
            &envelope,
            &OutboxDelivery::DeadLetter(error_code),
        )
        .await?;
        tx.commit().await?;
        Ok(TransitionOutcome::Applied)
    }

    /// Publishes one batch of unpublished `async_job` outbox rows. Stops at the first
    /// publish failure and commits the rows it already marked, so the caller reconnects
    /// and the rest are retried on the next pass. `FOR UPDATE SKIP LOCKED` lets every
    /// replica run this without two of them publishing the same row.
    pub async fn relay_once(
        &self,
        publisher: &dyn JobPublisher,
        batch: i64,
    ) -> Result<RelayOutcome> {
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let rows = tx
            .query(
                "SELECT id, aggregate_id, payload, delivery_target,
                        retry_delay_seconds, failure_code
                 FROM outbox_events
                 WHERE published_at IS NULL AND failed_at IS NULL
                   AND available_at <= now() AND aggregate_type = $1
                 ORDER BY created_at
                 LIMIT $2
                 FOR UPDATE SKIP LOCKED",
                &[&OUTBOX_AGGREGATE, &batch],
            )
            .await
            .context("select the unpublished async_job outbox batch")?;

        let mut outcome = RelayOutcome::default();
        for row in &rows {
            let outbox_id: Uuid = row.get("id");
            let job_id: Uuid = row.get("aggregate_id");
            let payload: Value = row.get("payload");
            let envelope: JobEnvelope = match serde_json::from_value(payload) {
                Ok(envelope) => envelope,
                Err(_) => {
                    retire_poison_outbox(&tx, outbox_id, job_id, "invalid_job_envelope").await?;
                    tracing::error!(%outbox_id, "retired invalid async_job outbox envelope");
                    outcome.poison += 1;
                    continue;
                }
            };
            let target = match outbox_target_from_row(row) {
                Ok(target) => target,
                Err(code) => {
                    retire_poison_outbox(&tx, outbox_id, job_id, code).await?;
                    tracing::error!(%outbox_id, failure_code = code, "retired invalid async_job outbox target");
                    outcome.poison += 1;
                    continue;
                }
            };
            match publisher.publish_to(&envelope, &target).await {
                Ok(()) => {
                    tx.execute(
                        "UPDATE outbox_events
                         SET published_at = now(), publish_attempts = publish_attempts + 1
                         WHERE id = $1",
                        &[&outbox_id],
                    )
                    .await
                    .context("mark an async_job outbox row published")?;
                    outcome.published += 1;
                }
                Err(error) => {
                    tx.execute(
                        "UPDATE outbox_events
                         SET publish_attempts = publish_attempts + 1 WHERE id = $1",
                        &[&outbox_id],
                    )
                    .await
                    .context("record failed async_job outbox publish")?;
                    outcome.broker_error = Some(error);
                    break;
                }
            }
        }
        tx.commit().await?;
        Ok(outcome)
    }

    /// Re-enqueues jobs stuck in `running` past their lease — a worker took the job and
    /// then died. The lease is written by the worker runtime (R3); until that lands this
    /// only fires for tests. A job that has spent its whole retry budget is
    /// dead-lettered instead of re-enqueued.
    pub async fn sweep_once(&self, batch: i64) -> Result<SweepOutcome> {
        let postgres = self.required()?;
        let mut client = postgres.transaction_client().await?;
        let tx = client.transaction().await?;
        let rows = tx
            .query(
                "SELECT id, user_id, kind, attempt, params FROM async_jobs
                 WHERE status = 'running' AND lease_expires_at IS NOT NULL
                   AND lease_expires_at < now()
                 ORDER BY lease_expires_at
                 LIMIT $1
                 FOR UPDATE SKIP LOCKED",
                &[&batch],
            )
            .await
            .context("select jobs whose worker lease elapsed")?;

        let mut outcome = SweepOutcome::default();
        for row in &rows {
            let job_id: Uuid = row.get("id");
            let user_id: Option<Uuid> = row.get("user_id");
            let kind_key: String = row.get("kind");
            let attempt: i16 = row.get("attempt");

            let Some(kind) = JobKind::from_routing_key(&kind_key) else {
                tracing::error!(%job_id, kind = %kind_key, "a stuck job has an unknown kind");
                continue;
            };

            if attempt >= MAX_ATTEMPTS {
                let params: Value = row.get("params");
                let tenant_id = user_id.unwrap_or(SYSTEM_TENANT_ID);
                let mut envelope = JobEnvelope::new(job_id, kind, tenant_id, params)
                    .map_err(|error| anyhow!("rebuild exhausted job envelope: {error}"))?;
                envelope.attempt = attempt.max(0) as u16;
                tx.execute(
                    "UPDATE async_jobs
                     SET status = 'dead_lettered', finished_at = now(),
                         error_code = 'lease_expired', lease_owner = NULL,
                         lease_expires_at = NULL
                     WHERE id = $1",
                    &[&job_id],
                )
                .await
                .context("dead-letter a job that exhausted its lease retries")?;
                insert_outbox_row(
                    &tx,
                    job_id,
                    kind.routing_key(),
                    &envelope,
                    &OutboxDelivery::DeadLetter("lease_expired"),
                )
                .await
                .context("insert the expired job's dead-letter outbox row")?;
                outcome.dead_lettered += 1;
                continue;
            }

            let next_attempt = attempt + 1;
            tx.execute(
                "UPDATE async_jobs
                 SET status = 'queued', attempt = $2, started_at = NULL,
                     lease_owner = NULL, lease_expires_at = NULL,
                     error_code = 'lease_expired'
                 WHERE id = $1",
                &[&job_id, &next_attempt],
            )
            .await
            .context("re-enqueue a job whose lease elapsed")?;

            let params: Value = row.get("params");
            let tenant_id = user_id.unwrap_or(SYSTEM_TENANT_ID);
            let mut envelope = JobEnvelope::new(job_id, kind, tenant_id, params)
                .map_err(|error| anyhow!("rebuild job envelope: {error}"))?;
            envelope.attempt = next_attempt.max(0) as u16;
            let delay = JOB_RETRY_DELAYS[usize::try_from(attempt).unwrap_or(usize::MAX)];
            insert_outbox_row(
                &tx,
                job_id,
                kind.routing_key(),
                &envelope,
                &OutboxDelivery::Retry(delay),
            )
            .await
            .context("insert the re-enqueue outbox row")?;
            outcome.requeued += 1;
        }
        tx.commit().await?;
        Ok(outcome)
    }
}

#[derive(Debug, Clone, Copy)]
enum OutboxDelivery {
    Primary,
    Retry(Duration),
    DeadLetter(&'static str),
}

async fn insert_outbox_row(
    tx: &tokio_postgres::Transaction<'_>,
    job_id: Uuid,
    routing_key: &str,
    envelope: &JobEnvelope,
    delivery: &OutboxDelivery,
) -> Result<()> {
    let (target, retry_delay_seconds, failure_code): (&str, Option<i32>, Option<&'static str>) =
        match delivery {
            OutboxDelivery::Primary => ("primary", None, None),
            OutboxDelivery::Retry(delay) => {
                let seconds = i32::try_from(delay.as_secs())
                    .map_err(|_| anyhow!("job retry delay exceeds PostgreSQL INTEGER"))?;
                ("retry", Some(seconds), None)
            }
            OutboxDelivery::DeadLetter(code) => ("dead_letter", None, Some(*code)),
        };
    tx.execute(
        "INSERT INTO outbox_events
             (id, aggregate_type, aggregate_id, event_type, payload,
              delivery_target, retry_delay_seconds, failure_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        &[
            &Uuid::now_v7(),
            &OUTBOX_AGGREGATE,
            &job_id,
            &routing_key,
            &serde_json::to_value(envelope)?,
            &target,
            &retry_delay_seconds,
            &failure_code,
        ],
    )
    .await?;
    Ok(())
}

fn lease_seconds(duration: Duration) -> Result<i64> {
    let seconds = i64::try_from(duration.as_secs())
        .map_err(|_| anyhow!("job lease duration exceeds PostgreSQL BIGINT"))?;
    if seconds == 0 {
        return Err(anyhow!("job lease duration must be at least one second"));
    }
    Ok(seconds)
}

fn claimed_job_from_row(row: &tokio_postgres::Row) -> Result<ClaimedJob> {
    let kind_key = row.get::<_, String>("kind");
    let kind = JobKind::from_routing_key(&kind_key)
        .ok_or_else(|| anyhow!("unrecognized async_jobs.kind: {kind_key}"))?;
    Ok(ClaimedJob {
        id: row.get("id"),
        user_id: row.get("user_id"),
        kind,
        attempt: row.get("attempt"),
        params: row.get("params"),
    })
}

async fn classify_transition(
    postgres: &PostgresClient,
    job_id: Uuid,
    attempt: i16,
    expected: JobStatus,
) -> Result<TransitionOutcome> {
    let row = postgres
        .client()
        .query_opt(
            "SELECT status, attempt FROM async_jobs WHERE id = $1",
            &[&job_id],
        )
        .await
        .context("classify async job transition")?;
    let Some(row) = row else {
        return Ok(TransitionOutcome::LostLease);
    };
    let status = parse_status(&row.get::<_, String>("status"))?;
    Ok(
        if status == expected && row.get::<_, i16>("attempt") == attempt {
            TransitionOutcome::AlreadyApplied
        } else {
            TransitionOutcome::LostLease
        },
    )
}

async fn classify_retry_transition(
    postgres: &PostgresClient,
    job_id: Uuid,
    previous_attempt: i16,
) -> Result<TransitionOutcome> {
    let row = postgres
        .client()
        .query_opt(
            "SELECT status, attempt FROM async_jobs WHERE id = $1",
            &[&job_id],
        )
        .await
        .context("classify async job retry transition")?;
    let Some(row) = row else {
        return Ok(TransitionOutcome::LostLease);
    };
    let status = parse_status(&row.get::<_, String>("status"))?;
    let attempt = row.get::<_, i16>("attempt");
    Ok(
        if status == JobStatus::DeadLettered && attempt == previous_attempt
            || status == JobStatus::Queued && previous_attempt.checked_add(1) == Some(attempt)
        {
            TransitionOutcome::AlreadyApplied
        } else {
            TransitionOutcome::LostLease
        },
    )
}

fn outbox_target_from_row(
    row: &tokio_postgres::Row,
) -> std::result::Result<JobPublishTarget, &'static str> {
    match row.get::<_, String>("delivery_target").as_str() {
        "primary" => Ok(JobPublishTarget::Primary),
        "retry" => {
            let seconds = row
                .get::<_, Option<i32>>("retry_delay_seconds")
                .ok_or("missing_retry_delay")?;
            let delay = u64::try_from(seconds)
                .ok()
                .map(Duration::from_secs)
                .filter(|delay| JOB_RETRY_DELAYS.contains(delay))
                .ok_or("invalid_retry_delay")?;
            Ok(JobPublishTarget::Retry(delay))
        }
        "dead_letter" => {
            let code = row
                .get::<_, Option<String>>("failure_code")
                .filter(|code| is_sanitized_error_code(code))
                .ok_or("missing_failure_code")?;
            Ok(JobPublishTarget::DeadLetter(code))
        }
        _ => Err("invalid_delivery_target"),
    }
}

fn validate_error_code(code: &'static str) -> Result<()> {
    if is_sanitized_error_code(code) {
        Ok(())
    } else {
        Err(anyhow!(
            "job error code must be a sanitized fixed identifier"
        ))
    }
}

fn is_sanitized_error_code(code: &str) -> bool {
    !code.is_empty()
        && code.len() <= 64
        && code
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
}

async fn retire_poison_outbox(
    tx: &tokio_postgres::Transaction<'_>,
    outbox_id: Uuid,
    job_id: Uuid,
    failure_code: &'static str,
) -> Result<()> {
    tx.execute(
        "UPDATE outbox_events
         SET failed_at = now(), failure_code = $2,
             publish_attempts = publish_attempts + 1
         WHERE id = $1",
        &[&outbox_id, &failure_code],
    )
    .await
    .context("retire poison async_job outbox row")?;
    tx.execute(
        "UPDATE async_jobs
         SET status = 'dead_lettered', finished_at = now(), error_code = $2,
             lease_owner = NULL, lease_expires_at = NULL
         WHERE id = $1 AND status IN ('queued', 'running')",
        &[&job_id, &failure_code],
    )
    .await
    .context("dead-letter job owning a poison outbox row")?;
    Ok(())
}

fn parse_status(raw: &str) -> Result<JobStatus> {
    JobStatus::parse(raw).ok_or_else(|| anyhow!("unrecognized async_jobs.status: {raw}"))
}

fn view_from_row(row: &tokio_postgres::Row) -> Result<AsyncJobView> {
    let status = row.get::<_, String>("status");
    Ok(AsyncJobView {
        id: row.get("id"),
        kind: row.get("kind"),
        status: parse_status(&status)?,
        attempt: row.get("attempt"),
        requested_at: row.get("requested_at"),
        started_at: row.get("started_at"),
        finished_at: row.get("finished_at"),
        error_code: row.get("error_code"),
        result: row.get("result"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::PostgresConfig;
    use async_trait::async_trait;
    use tokio::sync::Mutex;

    /// A publisher that records what it accepted and fails once it has accepted
    /// `fail_after` jobs, so a test can prove a partial relay pass commits only the
    /// rows it confirmed.
    struct ScriptedPublisher {
        accepted: Mutex<Vec<Uuid>>,
        targets: Mutex<Vec<JobPublishTarget>>,
        fail_after: usize,
    }

    impl ScriptedPublisher {
        fn new(fail_after: usize) -> Self {
            Self {
                accepted: Mutex::new(Vec::new()),
                targets: Mutex::new(Vec::new()),
                fail_after,
            }
        }

        async fn accepted(&self) -> Vec<Uuid> {
            self.accepted.lock().await.clone()
        }

        async fn targets(&self) -> Vec<JobPublishTarget> {
            self.targets.lock().await.clone()
        }
    }

    #[async_trait]
    impl JobPublisher for ScriptedPublisher {
        async fn publish(&self, job: &JobEnvelope) -> Result<(), InfrastructureError> {
            let mut accepted = self.accepted.lock().await;
            if accepted.len() >= self.fail_after {
                return Err(InfrastructureError::Unavailable("scripted failure".into()));
            }
            accepted.push(job.job_id);
            Ok(())
        }

        async fn publish_to(
            &self,
            job: &JobEnvelope,
            target: &JobPublishTarget,
        ) -> Result<(), InfrastructureError> {
            self.targets.lock().await.push(target.clone());
            self.publish(job).await
        }
    }

    async fn test_postgres() -> Arc<PostgresClient> {
        let url = std::env::var("POSTGRES_TEST_URL")
            .expect("POSTGRES_TEST_URL must point at an isolated PostgreSQL database");
        let postgres = Arc::new(
            PostgresClient::connect(&PostgresConfig {
                url: Some(url),
                max_connections: 4,
            })
            .await
            .expect("connect test PostgreSQL"),
        );
        postgres.migrate().await.expect("migrate test PostgreSQL");
        // These tests share one database and run single-threaded. Clear the job tables
        // so relay assertions on global counts are deterministic whatever the order.
        postgres
            .client()
            .execute(
                "DELETE FROM outbox_events WHERE aggregate_type = 'async_job'",
                &[],
            )
            .await
            .expect("reset async_job outbox rows");
        postgres
            .client()
            .execute("DELETE FROM async_jobs", &[])
            .await
            .expect("reset async_jobs");
        postgres
    }

    async fn seed_user(postgres: &PostgresClient) -> Uuid {
        let user_id = Uuid::now_v7();
        postgres
            .client()
            .execute(
                "INSERT INTO users (id, username) VALUES ($1, $2)",
                &[&user_id, &format!("jobs-test-{user_id}")],
            )
            .await
            .expect("seed job-test user");
        user_id
    }

    async fn outbox_published(postgres: &PostgresClient, job_id: Uuid) -> bool {
        postgres
            .client()
            .query_one(
                "SELECT published_at IS NOT NULL AS done FROM outbox_events
                 WHERE aggregate_id = $1 AND aggregate_type = 'async_job'
                 ORDER BY created_at DESC LIMIT 1",
                &[&job_id],
            )
            .await
            .expect("read outbox row")
            .get("done")
    }

    #[test]
    fn worker_transition_inputs_are_bounded_and_sanitized() {
        assert_eq!(lease_seconds(Duration::from_secs(1)).unwrap(), 1);
        assert!(lease_seconds(Duration::ZERO).is_err());
        assert!(validate_error_code("clickhouse_unavailable").is_ok());
        assert!(validate_error_code("").is_err());
        assert!(validate_error_code("secret=value").is_err());
        assert!(validate_error_code(
            "this_error_code_is_deliberately_longer_than_the_storage_contract_allows"
        )
        .is_err());
    }

    #[tokio::test]
    #[ignore = "requires POSTGRES_TEST_URL"]
    async fn create_is_idempotent_per_key_and_writes_one_outbox_row() {
        let postgres = test_postgres().await;
        let user_id = seed_user(&postgres).await;
        let service = JobService::new(Some(postgres.clone()));

        let first = service
            .create(
                Some(user_id),
                JobKind::AnalyticsReprocess,
                serde_json::json!({ "start": "2026-01-01", "end": "2026-01-31" }),
                Some("key-abc"),
            )
            .await
            .expect("create job");
        assert!(!first.deduplicated);

        let again = service
            .create(
                Some(user_id),
                JobKind::AnalyticsReprocess,
                serde_json::json!({ "start": "different" }),
                Some("key-abc"),
            )
            .await
            .expect("repeat create");
        assert_eq!(again.id, first.id);
        assert!(again.deduplicated);

        let outbox_rows: i64 = postgres
            .client()
            .query_one(
                "SELECT count(*)::bigint AS n FROM outbox_events
                 WHERE aggregate_id = $1 AND aggregate_type = 'async_job'",
                &[&first.id],
            )
            .await
            .expect("count outbox rows")
            .get("n");
        assert_eq!(outbox_rows, 1, "the deduplicated call must write nothing");
    }

    #[tokio::test]
    #[ignore = "requires POSTGRES_TEST_URL"]
    async fn claim_lease_and_complete_are_fenced_and_idempotent() {
        let postgres = test_postgres().await;
        let user_id = seed_user(&postgres).await;
        let service = JobService::new(Some(postgres.clone()));
        let params = serde_json::json!({ "start": "2026-03-01", "end": "2026-03-02" });
        let created = service
            .create(
                Some(user_id),
                JobKind::AnalyticsReprocess,
                params.clone(),
                None,
            )
            .await
            .expect("create job");
        let envelope = JobEnvelope::new(
            created.id,
            JobKind::AnalyticsReprocess,
            user_id,
            params.clone(),
        )
        .expect("job envelope");
        let owner = Uuid::now_v7();
        let other = Uuid::now_v7();

        let claimed = service
            .claim(&envelope, owner, Duration::from_secs(300))
            .await
            .expect("claim");
        assert_eq!(
            claimed,
            ClaimOutcome::Claimed(ClaimedJob {
                id: created.id,
                user_id: Some(user_id),
                kind: JobKind::AnalyticsReprocess,
                attempt: 0,
                params,
            })
        );
        assert_eq!(
            service
                .claim(&envelope, other, Duration::from_secs(300))
                .await
                .expect("duplicate claim"),
            ClaimOutcome::AlreadyRunning
        );
        assert!(!service
            .renew_lease(created.id, 0, other, Duration::from_secs(300))
            .await
            .expect("wrong-owner renew"));
        assert!(service
            .renew_lease(created.id, 0, owner, Duration::from_secs(300))
            .await
            .expect("owner renew"));
        assert_eq!(
            service
                .complete(created.id, 0, other, serde_json::json!({ "ok": false }))
                .await
                .expect("wrong-owner completion"),
            TransitionOutcome::LostLease
        );
        let result = serde_json::json!({ "ok": true });
        assert_eq!(
            service
                .complete(created.id, 0, owner, result.clone())
                .await
                .expect("completion"),
            TransitionOutcome::Applied
        );
        assert_eq!(
            service
                .complete(created.id, 0, owner, serde_json::json!({ "changed": true }))
                .await
                .expect("duplicate completion"),
            TransitionOutcome::AlreadyApplied
        );
        assert_eq!(
            service
                .claim(&envelope, other, Duration::from_secs(300))
                .await
                .expect("terminal claim"),
            ClaimOutcome::Terminal(JobStatus::Succeeded)
        );
        let stored: Value = postgres
            .client()
            .query_one(
                "SELECT result FROM async_jobs WHERE id = $1",
                &[&created.id],
            )
            .await
            .expect("read result")
            .get("result");
        assert_eq!(
            stored, result,
            "a duplicate completion must not overwrite result"
        );
    }

    #[tokio::test]
    #[ignore = "requires POSTGRES_TEST_URL"]
    async fn retry_transition_and_target_are_atomic_and_idempotent() {
        let postgres = test_postgres().await;
        let user_id = seed_user(&postgres).await;
        let service = JobService::new(Some(postgres.clone()));
        let params = serde_json::json!({ "start": "2026-04-01", "end": "2026-04-02" });
        let created = service
            .create(
                Some(user_id),
                JobKind::AnalyticsReprocess,
                params.clone(),
                None,
            )
            .await
            .expect("create job");
        let envelope = JobEnvelope::new(created.id, JobKind::AnalyticsReprocess, user_id, params)
            .expect("job envelope");
        let owner = Uuid::now_v7();
        assert!(matches!(
            service
                .claim(&envelope, owner, Duration::from_secs(300))
                .await
                .expect("claim"),
            ClaimOutcome::Claimed(_)
        ));

        assert_eq!(
            service
                .schedule_retry(created.id, 0, owner, "clickhouse_unavailable")
                .await
                .expect("schedule retry"),
            TransitionOutcome::Applied
        );
        assert_eq!(
            service
                .schedule_retry(created.id, 0, owner, "clickhouse_unavailable")
                .await
                .expect("repeat schedule retry"),
            TransitionOutcome::AlreadyApplied
        );

        let state = postgres
            .client()
            .query_one(
                "SELECT status, attempt, lease_owner IS NULL AS owner_cleared
                 FROM async_jobs WHERE id = $1",
                &[&created.id],
            )
            .await
            .expect("read retry state");
        assert_eq!(state.get::<_, String>("status"), "queued");
        assert_eq!(state.get::<_, i16>("attempt"), 1);
        assert!(state.get::<_, bool>("owner_cleared"));

        let retry_rows = postgres
            .client()
            .query(
                "SELECT delivery_target, retry_delay_seconds, payload
                 FROM outbox_events
                 WHERE aggregate_id = $1 AND delivery_target = 'retry'",
                &[&created.id],
            )
            .await
            .expect("read retry outbox");
        assert_eq!(
            retry_rows.len(),
            1,
            "a repeated transition writes no duplicate"
        );
        assert_eq!(
            retry_rows[0].get::<_, Option<i32>>("retry_delay_seconds"),
            Some(5)
        );
        let retried: JobEnvelope =
            serde_json::from_value(retry_rows[0].get("payload")).expect("retry envelope");
        assert_eq!(retried.attempt, 1);

        let publisher = ScriptedPublisher::new(usize::MAX);
        let relayed = service
            .relay_once(&publisher, 64)
            .await
            .expect("relay targets");
        assert_eq!(relayed.published, 2);
        assert_eq!(
            publisher.targets().await,
            vec![
                JobPublishTarget::Primary,
                JobPublishTarget::Retry(Duration::from_secs(5)),
            ]
        );
    }

    #[tokio::test]
    #[ignore = "requires POSTGRES_TEST_URL"]
    async fn poison_outbox_is_retired_without_blocking_the_next_job() {
        let postgres = test_postgres().await;
        let user_id = seed_user(&postgres).await;
        let service = JobService::new(Some(postgres.clone()));
        let poison = service
            .create(
                Some(user_id),
                JobKind::AnalyticsReprocess,
                serde_json::json!({}),
                None,
            )
            .await
            .expect("create poison owner");
        let healthy = service
            .create(
                Some(user_id),
                JobKind::AnalyticsReprocess,
                serde_json::json!({}),
                None,
            )
            .await
            .expect("create healthy job");
        postgres
            .client()
            .execute(
                "UPDATE outbox_events SET payload = '{}'::jsonb
                 WHERE aggregate_id = $1 AND aggregate_type = 'async_job'",
                &[&poison.id],
            )
            .await
            .expect("corrupt outbox envelope");

        let publisher = ScriptedPublisher::new(usize::MAX);
        let outcome = service.relay_once(&publisher, 64).await.expect("relay");
        assert_eq!(outcome.poison, 1);
        assert_eq!(outcome.published, 1);
        assert_eq!(publisher.accepted().await, vec![healthy.id]);
        let retired = postgres
            .client()
            .query_one(
                "SELECT failed_at IS NOT NULL AS failed, failure_code
                 FROM outbox_events WHERE aggregate_id = $1",
                &[&poison.id],
            )
            .await
            .expect("read poison row");
        assert!(retired.get::<_, bool>("failed"));
        assert_eq!(
            retired.get::<_, Option<String>>("failure_code").as_deref(),
            Some("invalid_job_envelope")
        );
        let status: String = postgres
            .client()
            .query_one("SELECT status FROM async_jobs WHERE id = $1", &[&poison.id])
            .await
            .expect("read poison job")
            .get("status");
        assert_eq!(status, "dead_lettered");
    }

    #[tokio::test]
    #[ignore = "requires POSTGRES_TEST_URL"]
    async fn relay_leaves_rows_it_does_not_own_alone() {
        let postgres = test_postgres().await;
        let user_id = seed_user(&postgres).await;
        let service = JobService::new(Some(postgres.clone()));

        let job = service
            .create(
                Some(user_id),
                JobKind::AnalyticsReprocess,
                serde_json::json!({}),
                None,
            )
            .await
            .expect("create job");

        let foreign_id = Uuid::now_v7();
        postgres
            .client()
            .execute(
                "INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
                 VALUES ($1, 'integration_connection', $2, 'integration.sync.requested', '{}'::jsonb)",
                &[&foreign_id, &Uuid::now_v7()],
            )
            .await
            .expect("insert a foreign outbox row");

        let publisher = ScriptedPublisher::new(usize::MAX);
        let outcome = service.relay_once(&publisher, 64).await.expect("relay");
        assert_eq!(outcome.published, 1);
        assert_eq!(publisher.accepted().await, vec![job.id]);

        let foreign_published: bool = postgres
            .client()
            .query_one(
                "SELECT published_at IS NOT NULL AS done FROM outbox_events WHERE id = $1",
                &[&foreign_id],
            )
            .await
            .expect("read foreign row")
            .get("done");
        assert!(
            !foreign_published,
            "the relay must not touch another writer's rows"
        );
    }

    #[tokio::test]
    #[ignore = "requires POSTGRES_TEST_URL"]
    async fn a_partial_relay_pass_commits_only_confirmed_rows_and_a_rerun_finishes_the_rest() {
        let postgres = test_postgres().await;
        let user_id = seed_user(&postgres).await;
        let service = JobService::new(Some(postgres.clone()));

        let mut jobs = Vec::new();
        for _ in 0..3 {
            jobs.push(
                service
                    .create(
                        Some(user_id),
                        JobKind::AnalyticsReprocess,
                        serde_json::json!({}),
                        None,
                    )
                    .await
                    .expect("create job")
                    .id,
            );
        }

        let failing = ScriptedPublisher::new(1);
        let outcome = service.relay_once(&failing, 64).await.expect("first relay");
        assert_eq!(outcome.published, 1);
        assert!(outcome.broker_error.is_some());
        assert_eq!(failing.accepted().await.len(), 1);

        let healthy = ScriptedPublisher::new(usize::MAX);
        let outcome = service
            .relay_once(&healthy, 64)
            .await
            .expect("second relay");
        assert_eq!(outcome.published, 2);
        assert!(outcome.broker_error.is_none());

        // Every job published exactly once across the two passes.
        let mut all_accepted = failing.accepted().await;
        all_accepted.extend(healthy.accepted().await);
        all_accepted.sort();
        let mut expected = jobs.clone();
        expected.sort();
        assert_eq!(all_accepted, expected);

        let third = service.relay_once(&healthy, 64).await.expect("third relay");
        assert_eq!(third.published, 0, "nothing is left to publish");
    }

    #[tokio::test]
    #[ignore = "requires POSTGRES_TEST_URL"]
    async fn sweep_requeues_an_expired_lease_and_dead_letters_once_the_budget_is_spent() {
        let postgres = test_postgres().await;
        let user_id = seed_user(&postgres).await;
        let service = JobService::new(Some(postgres.clone()));

        let job = service
            .create(
                Some(user_id),
                JobKind::AnalyticsReprocess,
                serde_json::json!({ "start": "2026-02-01", "end": "2026-02-28" }),
                None,
            )
            .await
            .expect("create job")
            .id;
        // Simulate a worker that claimed the job and then died.
        postgres
            .client()
            .execute(
                "UPDATE async_jobs
                 SET status = 'running', started_at = now(),
                     lease_expires_at = now() - interval '1 minute'
                 WHERE id = $1",
                &[&job],
            )
            .await
            .expect("mark the job as a dead worker's lease");

        let swept = service.sweep_once(64).await.expect("sweep");
        assert_eq!(
            swept,
            SweepOutcome {
                requeued: 1,
                dead_lettered: 0
            }
        );
        let (status, attempt): (String, i16) = {
            let row = postgres
                .client()
                .query_one(
                    "SELECT status, attempt FROM async_jobs WHERE id = $1",
                    &[&job],
                )
                .await
                .expect("reload job");
            (row.get("status"), row.get("attempt"))
        };
        assert_eq!(status, "queued");
        assert_eq!(attempt, 1);
        assert!(
            !outbox_published(&postgres, job).await,
            "the re-enqueue row waits for the relay"
        );
        let requeue_rows: i64 = postgres
            .client()
            .query_one(
                "SELECT count(*)::bigint AS n FROM outbox_events
                 WHERE aggregate_id = $1 AND aggregate_type = 'async_job'",
                &[&job],
            )
            .await
            .expect("count outbox rows")
            .get("n");
        assert_eq!(requeue_rows, 2, "one row from create, one from the sweep");

        // Spend the rest of the budget, then one more expiry dead-letters it.
        postgres
            .client()
            .execute(
                "UPDATE async_jobs
                 SET status = 'running', attempt = $2,
                     lease_expires_at = now() - interval '1 minute'
                 WHERE id = $1",
                &[&job, &MAX_ATTEMPTS],
            )
            .await
            .expect("push the job to its attempt cap");
        let swept = service.sweep_once(64).await.expect("final sweep");
        assert_eq!(
            swept,
            SweepOutcome {
                requeued: 0,
                dead_lettered: 1
            }
        );
        let (status, error_code): (String, Option<String>) = {
            let row = postgres
                .client()
                .query_one(
                    "SELECT status, error_code FROM async_jobs WHERE id = $1",
                    &[&job],
                )
                .await
                .expect("reload job");
            (row.get("status"), row.get("error_code"))
        };
        assert_eq!(status, "dead_lettered");
        assert_eq!(error_code.as_deref(), Some("lease_expired"));
    }

    /// End-to-end against a real broker: an `async_jobs` row becomes a message a
    /// consumer decodes back into the same `JobEnvelope`.
    #[tokio::test]
    #[ignore = "requires POSTGRES_TEST_URL and RABBITMQ_TEST_URL"]
    async fn a_created_job_is_published_and_consumable_as_the_same_envelope() {
        use crate::infrastructure::contracts::JobConsumer;
        use crate::infrastructure::rabbitmq::{JobTopology, RabbitMqJobQueue};

        let postgres = test_postgres().await;
        let user_id = seed_user(&postgres).await;
        let service = JobService::new(Some(postgres.clone()));

        let rabbit_url = std::env::var("RABBITMQ_TEST_URL")
            .expect("RABBITMQ_TEST_URL must point at an isolated RabbitMQ instance");
        let topology = JobTopology::namespaced(format!("jobs-e2e-{}.", Uuid::now_v7().simple()));
        let queue = RabbitMqJobQueue::connect_with(&rabbit_url, topology)
            .await
            .expect("connect and declare topology");

        let job = service
            .create(
                Some(user_id),
                JobKind::AnalyticsReprocess,
                serde_json::json!({ "start": "2026-03-01", "end": "2026-03-31", "dry_run": true }),
                None,
            )
            .await
            .expect("create job");

        let outcome = service.relay_once(&queue, 64).await.expect("relay");
        assert_eq!(outcome.published, 1);
        assert!(outcome.broker_error.is_none());
        assert!(outbox_published(&postgres, job.id).await);

        let consumer = queue
            .consumer(JobKind::AnalyticsReprocess, 1, "jobs-e2e")
            .await
            .expect("consumer");
        let delivery =
            tokio::time::timeout(std::time::Duration::from_secs(20), consumer.next_delivery())
                .await
                .expect("a delivery before the timeout")
                .expect("receive")
                .expect("consumer still open");
        assert_eq!(delivery.job().job_id, job.id);
        assert_eq!(delivery.job().kind, JobKind::AnalyticsReprocess);
        assert_eq!(
            delivery.job().event.tenant_id,
            user_id,
            "a reprocess job carries its account as the tenant"
        );
        delivery.ack().await.expect("ack");
        let _ = queue.close().await;
    }
}
