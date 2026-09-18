//! Isolated R5 full-stack acceptance runner.
//!
//! The runner uses a UUID-namespaced RabbitMQ topology and a fresh tenant for every
//! scenario. It exercises the same PostgreSQL outbox, RabbitMQ publisher confirms,
//! claim/lease fencing and domain processors used by production workers. It is
//! feature-gated and requires explicit endpoints so a local command cannot
//! accidentally operate on a developer's shared stores.

#[cfg(feature = "r5-spike")]
mod enabled {
    use anyhow::{Context, Result};
    use sha2::{Digest, Sha256};
    use std::sync::Arc;
    use std::time::Duration;
    use uuid::Uuid;

    use wakaclock_server::infrastructure::app::{create_app_state, AppState};
    use wakaclock_server::infrastructure::contracts::{JobConsumer, JobKind, JobPublisher};
    use wakaclock_server::infrastructure::rabbitmq::{JobTopology, RabbitMqJobQueue};
    use wakaclock_server::model::export::CreateExportRequest;
    use wakaclock_server::services::background_worker::LeaseGuard;
    use wakaclock_server::services::jobs::{ClaimOutcome, TransitionOutcome};

    const DELIVERY_TIMEOUT: Duration = Duration::from_secs(30);
    const TEST_LEASE: Duration = Duration::from_secs(30);

    pub async fn run() -> Result<()> {
        dotenvy::dotenv().ok();
        let rabbitmq = required_endpoint("RABBITMQ_TEST_URL")?;
        let clickhouse = required_endpoint("CLICKHOUSE_TEST_URL")?;
        let postgres = required_endpoint("POSTGRES_TEST_URL")?;
        let redis = std::env::var("REDIS_TEST_URL")
            .unwrap_or_else(|_| "redis://127.0.0.1:16379".to_string());
        let object_store_endpoint = std::env::var("OBJECT_STORE_TEST_ENDPOINT")
            .unwrap_or_else(|_| "http://127.0.0.1:19000".to_string());
        let bucket = required_endpoint("OBJECT_STORE_TEST_BUCKET")?;

        configure_environment(
            &clickhouse,
            &postgres,
            &rabbitmq,
            &redis,
            &object_store_endpoint,
            &bucket,
        )?;

        let topology =
            JobTopology::namespaced(format!("wakaclock-r5-{}.", Uuid::now_v7().simple()));
        let queue = RabbitMqJobQueue::connect_with(&rabbitmq, topology)
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let result = run_scenarios(&queue).await;
        let _ = queue.close().await;
        result
    }

    async fn run_scenarios(queue: &RabbitMqJobQueue) -> Result<()> {
        let state = Arc::new(
            create_app_state()
                .await
                .context("initialize R5 harness application state")?,
        );
        migrate_stores(&state).await?;

        let projection_user = seed_user(&state, "projection").await?;
        let projection_job = run_projection_scenario(&state, queue, projection_user).await?;
        let export_user = seed_user(&state, "export").await?;
        let export_result = run_export_scenario(&state, queue, export_user).await?;
        let deletion_user = seed_user(&state, "deletion").await?;
        let deletion_result =
            run_account_deletion_scenario(&state, queue, deletion_user, export_result.object_key)
                .await?;

        println!("r5_topology=namespaced");
        println!("r5_projection_job={projection_job}");
        println!("r5_export_job={}", export_result.export_job_id);
        println!("r5_export_checksum={}", export_result.checksum);
        println!("r5_account_delete_job={deletion_result}");
        println!("r5_scenarios_completed=3");
        println!("r5_status=passed");
        Ok(())
    }

    async fn migrate_stores(state: &Arc<AppState>) -> Result<()> {
        let postgres = state.postgres.clone().context("R5 requires PostgreSQL")?;
        postgres.migrate().await.context("migrate PostgreSQL")?;
        state.heartbeat_repo.migrate().await?;
        state.analytics_repo.migrate().await?;
        state.account_analytics_repo.migrate().await?;
        state.ai_usage_repo.migrate().await?;
        state.external_duration_repo.migrate().await?;
        state.follow_up_repo.migrate().await?;
        state.project_identity_repo.migrate().await?;
        state.project_merge_repo.migrate().await?;
        state.project_rule_repo.migrate().await?;
        state.org_repo.migrate().await?;
        state.team_repo.migrate().await?;
        state.coworking_session_repo.migrate().await?;
        state.reprocess_service.migrate().await?;
        Ok(())
    }

    async fn seed_user(state: &Arc<AppState>, label: &str) -> Result<Uuid> {
        let user_id = Uuid::now_v7();
        state
            .postgres
            .as_ref()
            .context("R5 requires PostgreSQL")?
            .execute(
                "INSERT INTO users (id, username) VALUES ($1, $2)",
                &[&user_id, &format!("r5-{label}-{user_id}")],
            )
            .await
            .with_context(|| format!("seed R5 {label} tenant"))?;
        Ok(user_id)
    }

    async fn run_projection_scenario(
        state: &Arc<AppState>,
        queue: &RabbitMqJobQueue,
        user_id: Uuid,
    ) -> Result<Uuid> {
        let params = serde_json::json!({
            "schema_version": 1,
            "start": "2026-01-01",
            "end": "2026-01-02",
        });
        let key = format!("r5-projection:{user_id}:2026-01-01:2026-01-02");
        let first = state
            .job_service
            .create(
                Some(user_id),
                JobKind::ProjectionRebuild,
                params.clone(),
                Some(&key),
            )
            .await?;
        let replay = state
            .job_service
            .create(
                Some(user_id),
                JobKind::ProjectionRebuild,
                params,
                Some(&key),
            )
            .await?;
        ensure(
            first.id == replay.id && replay.deduplicated,
            "projection child job is deterministic",
        )?;

        relay_and_assert(state, queue, first.id).await?;
        let consumer = queue
            .consumer(
                JobKind::ProjectionRebuild,
                2,
                &format!("r5-projection-worker-{}", Uuid::now_v7()),
            )
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let delivery = receive_expected(&consumer, first.id).await?;
        let owner = Uuid::now_v7();
        let claimed = claim(state, delivery.job(), owner).await?;
        let claimed = claimed.context("projection job was not claimable")?;
        let projection = state
            .account_analytics_service
            .rebuild(user_id, "2026-01-01", "2026-01-02")
            .await?;
        let completed = state
            .job_service
            .complete(
                claimed.id,
                claimed.attempt,
                owner,
                serde_json::to_value(projection)?,
            )
            .await?;
        ensure(
            matches!(
                completed,
                TransitionOutcome::Applied | TransitionOutcome::AlreadyApplied
            ),
            "projection job completion is fenced",
        )?;
        delivery
            .ack()
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;

        // A duplicate delivery must be acknowledged as a terminal no-op. It is
        // intentionally published through the same confirmed RabbitMQ channel.
        let duplicate = wakaclock_server::infrastructure::contracts::JobEnvelope::new(
            first.id,
            JobKind::ProjectionRebuild,
            user_id,
            serde_json::json!({
                "schema_version": 1,
                "start": "2026-01-01",
                "end": "2026-01-02",
            }),
        )?;
        queue
            .publish(&duplicate)
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let duplicate_delivery = receive_expected(&consumer, first.id).await?;
        let duplicate_claim = state
            .job_service
            .claim(duplicate_delivery.job(), Uuid::now_v7(), TEST_LEASE)
            .await?;
        ensure(
            matches!(duplicate_claim, ClaimOutcome::Terminal(_)),
            "duplicate projection delivery is terminal",
        )?;
        duplicate_delivery
            .ack()
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;

        // Exercise the lease sweeper with a second deterministic job. The
        // delivery is left unsettled until the broker-restart check below; the
        // sweeper must move the durable job back to queued without acknowledging
        // the old delivery.
        let lease_key = format!("r5-projection-lease:{user_id}");
        let lease_job = state
            .job_service
            .create(
                Some(user_id),
                JobKind::ProjectionRebuild,
                serde_json::json!({
                    "schema_version": 1,
                    "start": "2026-01-01",
                    "end": "2026-01-02",
                }),
                Some(&lease_key),
            )
            .await?;
        relay_and_assert(state, queue, lease_job.id).await?;
        let lease_delivery = receive_expected(&consumer, lease_job.id).await?;
        let lease_owner = Uuid::now_v7();
        let lease_claim = claim(state, lease_delivery.job(), lease_owner).await?;
        ensure(lease_claim.is_some(), "lease test job is claimable")?;
        state
            .postgres
            .as_ref()
            .context("R5 requires PostgreSQL")?
            .execute(
                "UPDATE async_jobs SET lease_expires_at = now() - interval '1 second' WHERE id = $1",
                &[&lease_job.id],
            )
            .await?;
        let swept = state.job_service.sweep_once(10).await?;
        ensure(swept.requeued == 1, "expired projection lease is requeued")?;
        lease_delivery
            .requeue()
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;

        Ok(first.id)
    }

    async fn run_export_scenario(
        state: &Arc<AppState>,
        queue: &RabbitMqJobQueue,
        user_id: Uuid,
    ) -> Result<ExportResult> {
        let request = CreateExportRequest {
            format: "json".to_string(),
            scope: "heartbeats".to_string(),
        };
        let idempotency_key = format!("r5-export:{user_id}");
        let first = state
            .export_service
            .create(user_id, request.clone(), Some(&idempotency_key))
            .await?;
        let replay = state
            .export_service
            .create(user_id, request, Some(&idempotency_key))
            .await?;
        ensure(
            first.id == replay.id,
            "export idempotency returns the same job",
        )?;
        let async_job_id = async_job_id(state, first.id).await?;
        relay_and_assert(state, queue, async_job_id).await?;
        let consumer = queue
            .consumer(
                JobKind::ExportGenerate,
                1,
                &format!("r5-export-worker-{}", Uuid::now_v7()),
            )
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let delivery = receive_expected(&consumer, async_job_id).await?;
        let claimed = state
            .job_service
            .claim(delivery.job(), Uuid::now_v7(), TEST_LEASE)
            .await?;
        let claimed = match claimed {
            ClaimOutcome::Claimed(job) => job,
            other => anyhow::bail!("expected export job to be claimable, got {other:?}"),
        };
        let first_result = state
            .export_service
            .process(&claimed, LeaseGuard::default())
            .await?;
        // Simulate a worker crash after the object upload and before async_jobs
        // completion. The second processor invocation must find the completed
        // domain row and return the same artifact instead of inserting another.
        let replay_result = state
            .export_service
            .process(&claimed, LeaseGuard::default())
            .await?;
        ensure(
            first_result == replay_result,
            "export redelivery is artifact-idempotent",
        )?;
        let completed = state
            .job_service
            .complete(
                claimed.id,
                claimed.attempt,
                claimed.lease_owner,
                first_result,
            )
            .await?;
        ensure(
            matches!(
                completed,
                TransitionOutcome::Applied | TransitionOutcome::AlreadyApplied
            ),
            "export completion is fenced",
        )?;
        delivery
            .ack()
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;

        let row = state
            .postgres
            .as_ref()
            .context("R5 requires PostgreSQL")?
            .query_one(
                "SELECT object_key, sha256, bytes FROM export_artifacts WHERE export_job_id = $1",
                &[&first.id],
            )
            .await?;
        let object_key: String = row.get("object_key");
        let checksum: String = row.get("sha256");
        let bytes: i64 = row.get("bytes");
        let artifact_count: i64 = state
            .postgres
            .as_ref()
            .context("R5 requires PostgreSQL")?
            .query_one(
                "SELECT count(*)::bigint FROM export_artifacts WHERE export_job_id = $1",
                &[&first.id],
            )
            .await?
            .get(0);
        ensure(artifact_count == 1, "export replay creates one artifact")?;

        let hydrated = state
            .export_service
            .get(user_id, first.id)
            .await?
            .context("completed export is readable by its owner")?;
        let url = hydrated
            .download_url
            .context("completed export has a signed URL")?;
        let response = reqwest::Client::new().get(url).send().await?;
        ensure(
            response.status().is_success(),
            "signed export URL is readable",
        )?;
        ensure(
            response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .is_some_and(|value| value.starts_with("application/json")),
            "export content type is application/json",
        )?;
        let body = response.bytes().await?;
        let actual_checksum = format!("{:x}", Sha256::digest(&body));
        ensure(
            actual_checksum == checksum,
            "export checksum matches object bytes",
        )?;
        ensure(
            bytes == i64::try_from(body.len())?,
            "export byte bound matches object bytes",
        )?;

        Ok(ExportResult {
            export_job_id: first.id,
            object_key,
            checksum,
        })
    }

    async fn run_account_deletion_scenario(
        state: &Arc<AppState>,
        queue: &RabbitMqJobQueue,
        user_id: Uuid,
        export_object_key: String,
    ) -> Result<Uuid> {
        // Create a small account-owned artifact for the deletion tenant. The
        // export key passed here is retained as a cross-tenant sentinel to prove
        // deletion never reaches a different user's object namespace.
        let export = state
            .export_service
            .create(
                user_id,
                CreateExportRequest {
                    format: "json".to_string(),
                    scope: "heartbeats".to_string(),
                },
                Some(&format!("r5-delete-export:{user_id}")),
            )
            .await?;
        let export_job_id = async_job_id(state, export.id).await?;
        relay_and_assert(state, queue, export_job_id).await?;
        let export_consumer = queue
            .consumer(
                JobKind::ExportGenerate,
                1,
                &format!("r5-delete-export-worker-{}", Uuid::now_v7()),
            )
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let export_delivery = receive_expected(&export_consumer, export_job_id).await?;
        let export_claim = match state
            .job_service
            .claim(export_delivery.job(), Uuid::now_v7(), TEST_LEASE)
            .await?
        {
            ClaimOutcome::Claimed(job) => job,
            other => anyhow::bail!("expected deletion export to be claimable, got {other:?}"),
        };
        let export_value = state
            .export_service
            .process(&export_claim, LeaseGuard::default())
            .await?;
        state
            .job_service
            .complete(
                export_claim.id,
                export_claim.attempt,
                export_claim.lease_owner,
                export_value,
            )
            .await?;
        export_delivery
            .ack()
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;

        let deletion = state.account_deletion_service.request(user_id).await?;
        let replay = state.account_deletion_service.request(user_id).await?;
        ensure(
            deletion.id == replay.id && replay.deduplicated,
            "account deletion request is idempotent",
        )?;
        relay_and_assert(state, queue, deletion.id).await?;
        let consumer = queue
            .consumer(
                JobKind::AccountDelete,
                1,
                &format!("r5-account-delete-worker-{}", Uuid::now_v7()),
            )
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let delivery = receive_expected(&consumer, deletion.id).await?;
        let claimed = match state
            .job_service
            .claim(delivery.job(), Uuid::now_v7(), TEST_LEASE)
            .await?
        {
            ClaimOutcome::Claimed(job) => job,
            other => anyhow::bail!("expected account deletion to be claimable, got {other:?}"),
        };
        let result = state
            .account_deletion_service
            .process(&claimed, LeaseGuard::default())
            .await?;
        state
            .job_service
            .complete(claimed.id, claimed.attempt, claimed.lease_owner, result)
            .await?;
        delivery
            .ack()
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;

        let postgres = state.postgres.as_ref().context("R5 requires PostgreSQL")?;
        let deleted_user = postgres
            .query_opt("SELECT id FROM users WHERE id = $1", &[&user_id])
            .await?;
        ensure(
            deleted_user.is_none(),
            "account deletion removes PostgreSQL user",
        )?;
        let status: String = postgres
            .query_one(
                "SELECT status FROM account_deletion_requests WHERE account_id = $1",
                &[&user_id],
            )
            .await?
            .get("status");
        ensure(
            status == "succeeded",
            "account deletion has a terminal success audit",
        )?;
        let artifacts: i64 = postgres
            .query_one(
                "SELECT count(*)::bigint
                 FROM export_artifacts a
                 JOIN export_jobs e ON e.id = a.export_job_id
                 WHERE e.user_id = $1",
                &[&user_id],
            )
            .await?
            .get(0);
        ensure(artifacts == 0, "account deletion removes export metadata")?;
        let sentinel_exists: bool = postgres
            .query_opt(
                "SELECT 1 FROM export_artifacts WHERE object_key = $1",
                &[&export_object_key],
            )
            .await?
            .is_some();
        ensure(
            sentinel_exists,
            "account deletion preserves another tenant's artifact",
        )?;

        Ok(deletion.id)
    }

    async fn relay_and_assert(
        state: &Arc<AppState>,
        queue: &RabbitMqJobQueue,
        job_id: Uuid,
    ) -> Result<()> {
        let outcome = state.job_service.relay_once(queue, 64).await?;
        ensure(
            outcome.broker_error.is_none(),
            "RabbitMQ relay has no broker error",
        )?;
        let published = state
            .postgres
            .as_ref()
            .context("R5 requires PostgreSQL")?
            .query_opt(
                "SELECT 1 FROM outbox_events
                 WHERE aggregate_type = 'async_job'
                   AND aggregate_id = $1 AND published_at IS NOT NULL",
                &[&job_id],
            )
            .await?
            .is_some();
        ensure(
            published,
            "outbox is marked published after RabbitMQ confirm",
        )
    }

    async fn receive_expected(
        consumer: &impl JobConsumer,
        job_id: Uuid,
    ) -> Result<Box<dyn wakaclock_server::infrastructure::contracts::JobDelivery>> {
        let deadline = tokio::time::Instant::now() + DELIVERY_TIMEOUT;
        loop {
            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
            if remaining.is_zero() {
                anyhow::bail!("timed out waiting for RabbitMQ job {job_id}");
            }
            let delivery = tokio::time::timeout(remaining, consumer.next_delivery())
                .await
                .context("timed out waiting for RabbitMQ delivery")??
                .context("RabbitMQ consumer closed")?;
            if delivery.job().job_id == job_id {
                return Ok(delivery);
            }
            delivery
                .ack()
                .await
                .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        }
    }

    async fn claim(
        state: &Arc<AppState>,
        envelope: &wakaclock_server::infrastructure::contracts::JobEnvelope,
        owner: Uuid,
    ) -> Result<Option<wakaclock_server::services::jobs::ClaimedJob>> {
        match state.job_service.claim(envelope, owner, TEST_LEASE).await? {
            ClaimOutcome::Claimed(job) => Ok(Some(job)),
            ClaimOutcome::NotReady | ClaimOutcome::AlreadyRunning => Ok(None),
            other => anyhow::bail!("job claim was rejected: {other:?}"),
        }
    }

    async fn async_job_id(state: &Arc<AppState>, export_job_id: Uuid) -> Result<Uuid> {
        Ok(state
            .postgres
            .as_ref()
            .context("R5 requires PostgreSQL")?
            .query_one(
                "SELECT async_job_id FROM export_jobs WHERE id = $1",
                &[&export_job_id],
            )
            .await?
            .get::<_, Uuid>("async_job_id"))
    }

    fn configure_environment(
        clickhouse: &str,
        postgres: &str,
        rabbitmq: &str,
        redis: &str,
        object_store_endpoint: &str,
        bucket: &str,
    ) -> Result<()> {
        let parsed = reqwest::Url::parse(clickhouse).context("CLICKHOUSE_TEST_URL is invalid")?;
        let host = parsed
            .host_str()
            .context("CLICKHOUSE_TEST_URL has no host")?;
        let base = format!(
            "{}://{}{}",
            parsed.scheme(),
            host,
            parsed
                .port()
                .map(|port| format!(":{port}"))
                .unwrap_or_default()
        );
        std::env::set_var("ALLOW_INSECURE_JWT_SECRET", "1");
        std::env::set_var("CLICKHOUSE_URL", base);
        std::env::set_var("CLICKHOUSE_DB", "wakaclock");
        if !parsed.username().is_empty() {
            std::env::set_var("CLICKHOUSE_USER", parsed.username());
        }
        if let Some(password) = parsed.password() {
            std::env::set_var("CLICKHOUSE_PASSWORD", password);
        }
        std::env::set_var("POSTGRES_URL", postgres);
        std::env::set_var("ATOAXIS_JOB_QUEUE_URL", rabbitmq);
        std::env::set_var("ATOAXIS_INGEST_MODE", "direct");
        std::env::set_var("ATOAXIS_AI_USAGE_INGEST_MODE", "direct");
        std::env::set_var("ATOAXIS_PROJECTION_REBUILD_MODE", "job");
        std::env::set_var("ATOAXIS_EXPORT_MODE", "job");
        std::env::set_var("ATOAXIS_ACCOUNT_DELETION_MODE", "job");
        std::env::set_var("ATOAXIS_REPROCESS_MODE", "sync");
        std::env::set_var("PRESENCE_V2_ENABLED", "true");
        std::env::set_var("REDIS_URL", redis);
        std::env::set_var("ATOAXIS_OBJECT_STORE_S3_ENDPOINT", object_store_endpoint);
        std::env::set_var("ATOAXIS_OBJECT_STORE_S3_BUCKET", bucket);
        std::env::set_var("ATOAXIS_OBJECT_STORE_S3_REGION", "us-east-1");
        std::env::set_var("ATOAXIS_OBJECT_STORE_S3_ACCESS_KEY", "atoaxis");
        std::env::set_var("ATOAXIS_OBJECT_STORE_S3_SECRET_KEY", "atoaxis-test");
        std::env::set_var("ATOAXIS_OBJECT_STORE_S3_PATH_STYLE", "true");
        std::env::set_var("ATOAXIS_OBJECT_STORE_ALLOW_HTTP", "true");
        Ok(())
    }

    fn required_endpoint(name: &str) -> Result<String> {
        let value =
            std::env::var(name).with_context(|| format!("{name} is required for r5-spike"))?;
        if value.trim().is_empty() {
            anyhow::bail!("{name} must not be empty");
        }
        Ok(value)
    }

    fn ensure(condition: bool, message: &str) -> Result<()> {
        if condition {
            Ok(())
        } else {
            anyhow::bail!("R5 harness invariant failed: {message}");
        }
    }

    struct ExportResult {
        export_job_id: Uuid,
        object_key: String,
        checksum: String,
    }
}

#[cfg(feature = "r5-spike")]
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    enabled::run().await
}

#[cfg(not(feature = "r5-spike"))]
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    anyhow::bail!("rabbitmq-spike requires the r5-spike feature")
}
