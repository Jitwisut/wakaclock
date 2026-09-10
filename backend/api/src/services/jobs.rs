//! Owner-triggered background jobs (plans/plan-kafka-rabbitmq-adoption.md, R2, D5).
//!
//! PostgreSQL is authoritative for job state. Creating a job writes its `async_jobs`
//! row and one `outbox_events` row in the same transaction; the in-process relay
//! ([`crate::infrastructure::job_relay`]) turns each outbox row into a RabbitMQ
//! message. A broker outage therefore delays jobs, it does not lose them.
//!
//! The worker-side transitions (claim, complete, fail) land with the worker runtime
//! in R3. This module only creates jobs, reads them, relays the outbox and re-enqueues
//! a job whose worker lease elapsed.

use anyhow::{anyhow, Context, Result};
use serde_json::Value;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::contracts::{
    InfrastructureError, JobEnvelope, JobKind, JobPublisher, JOB_RETRY_DELAYS, SYSTEM_TENANT_ID,
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
    /// Rows that did not deserialize into a `JobEnvelope`. Left in place and logged,
    /// never silently dropped; a pass skips past them to the rows behind. They stay
    /// `published_at IS NULL` and are re-fetched every pass, so once `poison` reaches
    /// `RELAY_BATCH` no real job is published again — a `failed_at`/DLQ column to retire
    /// them is R3. Only `create` writes these, so in practice `poison` stays 0.
    pub poison: usize,
    pub broker_error: Option<InfrastructureError>,
}

#[derive(Debug, Default, PartialEq, Eq)]
pub struct SweepOutcome {
    pub requeued: usize,
    pub dead_lettered: usize,
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
    #[cfg_attr(
        not(test),
        expect(
            dead_code,
            reason = "wired to POST /api/v1/reprocess in R4; R2 delivers the mechanism"
        )
    )]
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
        insert_outbox_row(&tx, job_id, routing_key, &envelope)
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
                "SELECT id, payload FROM outbox_events
                 WHERE published_at IS NULL AND aggregate_type = $1
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
            let payload: Value = row.get("payload");
            let envelope: JobEnvelope = match serde_json::from_value(payload) {
                Ok(envelope) => envelope,
                Err(error) => {
                    // JobService::create is the only writer, so this is a bug or
                    // tampering. Leave the row and log it every pass rather than drop a
                    // job silently; `continue` skips past it to the rows behind. See
                    // RelayOutcome::poison for the batch-size stall this can still cause
                    // (retiring poison rows is R3).
                    tracing::error!(%outbox_id, %error, "async_job outbox row does not deserialize");
                    outcome.poison += 1;
                    continue;
                }
            };
            match publisher.publish(&envelope).await {
                Ok(()) => {
                    tx.execute(
                        "UPDATE outbox_events SET published_at = now() WHERE id = $1",
                        &[&outbox_id],
                    )
                    .await
                    .context("mark an async_job outbox row published")?;
                    outcome.published += 1;
                }
                Err(error) => {
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
                tx.execute(
                    "UPDATE async_jobs
                     SET status = 'dead_lettered', finished_at = now(),
                         error_code = 'lease_expired', lease_expires_at = NULL
                     WHERE id = $1",
                    &[&job_id],
                )
                .await
                .context("dead-letter a job that exhausted its lease retries")?;
                outcome.dead_lettered += 1;
                continue;
            }

            let next_attempt = attempt + 1;
            tx.execute(
                "UPDATE async_jobs
                 SET status = 'queued', attempt = $2, started_at = NULL,
                     lease_expires_at = NULL
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
            insert_outbox_row(&tx, job_id, kind.routing_key(), &envelope)
                .await
                .context("insert the re-enqueue outbox row")?;
            outcome.requeued += 1;
        }
        tx.commit().await?;
        Ok(outcome)
    }
}

async fn insert_outbox_row(
    tx: &tokio_postgres::Transaction<'_>,
    job_id: Uuid,
    routing_key: &str,
    envelope: &JobEnvelope,
) -> Result<()> {
    tx.execute(
        "INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
         VALUES ($1, $2, $3, $4, $5)",
        &[
            &Uuid::now_v7(),
            &OUTBOX_AGGREGATE,
            &job_id,
            &routing_key,
            &serde_json::to_value(envelope)?,
        ],
    )
    .await?;
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
        fail_after: usize,
    }

    impl ScriptedPublisher {
        fn new(fail_after: usize) -> Self {
            Self {
                accepted: Mutex::new(Vec::new()),
                fail_after,
            }
        }

        async fn accepted(&self) -> Vec<Uuid> {
            self.accepted.lock().await.clone()
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
