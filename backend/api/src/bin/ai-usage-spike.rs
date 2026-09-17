//! Isolated K5 end-to-end harness.
//!
//! This runner deliberately exercises the durable boundaries instead of starting the
//! long-running production processes: Kafka publish/consume, ClickHouse fact storage,
//! PostgreSQL job/outbox creation, RabbitMQ relay, and the session projection. It is
//! feature-gated and requires explicit endpoints so it cannot accidentally touch a
//! developer's shared infrastructure.

#[cfg(feature = "ai-usage-spike")]
mod enabled {
    use anyhow::{Context, Result};
    use chrono::{Duration as ChronoDuration, Utc};
    use rdkafka::admin::{AdminClient, AdminOptions, NewTopic, TopicReplication};
    use rdkafka::ClientConfig;
    use std::sync::Arc;
    use std::time::Duration;
    use wakaclock_core::ai::{AiUsageRecord, TokenSource};

    use wakaclock_server::infrastructure::app::{create_app_state, AppState};
    use wakaclock_server::infrastructure::contracts::{
        AiUsageEventV1, EventConsumer, EventDelivery, EventTopic, JobConsumer, JobKind,
    };
    use wakaclock_server::infrastructure::kafka::{KafkaEventBus, KafkaEventConsumer};
    use wakaclock_server::infrastructure::rabbitmq::{JobTopology, RabbitMqJobQueue};
    use wakaclock_server::model::ai_usage::AiSessionRow;
    use wakaclock_server::services::jobs::{ClaimOutcome, TransitionOutcome};

    const POLL_TIMEOUT: Duration = Duration::from_secs(20);
    const CONSUMER_WAIT: Duration = Duration::from_secs(10);

    pub async fn run() -> Result<()> {
        dotenvy::dotenv().ok();
        let kafka = required_endpoint("KAFKA_TEST_URL")?;
        let clickhouse = required_endpoint("CLICKHOUSE_TEST_URL")?;
        let postgres = required_endpoint("POSTGRES_TEST_URL")?;
        let rabbitmq = required_endpoint("RABBITMQ_TEST_URL")?;

        configure_environment(&kafka, &clickhouse, &postgres, &rabbitmq)?;

        let source_topic = format!("wakaclock.k5.ai-usage.{}", uuid::Uuid::now_v7());
        let admin = create_admin(&kafka)?;
        create_topics(&admin, &source_topic).await?;

        let result = run_scenarios(&rabbitmq, &source_topic).await;
        // The source topic is UUID-scoped and is the only topic this process owns.
        // Leave the shared DLQ intact for repair tooling and cross-run inspection.
        let _ = admin
            .delete_topics(&[source_topic.as_str()], &AdminOptions::new())
            .await;
        result
    }

    async fn run_scenarios(rabbitmq: &str, source_topic: &str) -> Result<()> {
        let state = Arc::new(
            create_app_state()
                .await
                .context("initialize K5 harness application state")?,
        );
        let postgres = state
            .postgres
            .clone()
            .context("K5 harness requires POSTGRES_TEST_URL")?;
        postgres.migrate().await.context("migrate PostgreSQL")?;
        state
            .project_merge_repo
            .migrate()
            .await
            .context("migrate project merges")?;
        state
            .ai_usage_repo
            .migrate()
            .await
            .context("migrate AI usage ClickHouse tables")?;
        state
            .project_identity_repo
            .migrate()
            .await
            .context("migrate project identity tables")?;

        let event_config = state
            .config
            .brokers
            .event_bus
            .as_ref()
            .context("K5 harness requires ATOAXIS_EVENT_BUS_URL")?;
        let bus = Arc::new(
            KafkaEventBus::connect(event_config, "wakaclock-ai-usage-spike")
                .map_err(|error| anyhow::anyhow!(error.to_string()))?,
        );
        let group_id = format!("wakaclock-k5-ai-usage-{}", uuid::Uuid::now_v7());
        let consumer = KafkaEventConsumer::connect_with_topic(
            event_config,
            "wakaclock-ai-usage-spike-consumer",
            &group_id,
            EventTopic::AiUsage,
            source_topic,
            bus.clone(),
        )
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        consumer.wait_for_assignment(CONSUMER_WAIT).await?;

        let tenant_id = uuid::Uuid::now_v7();
        // `async_jobs.user_id` is intentionally foreign-keyed to the account table. The
        // harness uses a fresh tenant per run, so seed only the minimal identity row it
        // needs; this keeps the test honest about the same tenant boundary production
        // job creation enforces without depending on an external account fixture.
        postgres
            .execute(
                "INSERT INTO users (id, username) VALUES ($1, $2)",
                &[&tenant_id, &format!("k5-harness-{tenant_id}")],
            )
            .await
            .context("seed K5 harness tenant")?;
        let session_id = format!("k5-session-{}", uuid::Uuid::now_v7());
        let records = sample_records(&session_id);
        let events = records
            .iter()
            .cloned()
            .map(|record| {
                AiUsageEventV1::from_record(record)
                    .and_then(|event| event.event_for_tenant(tenant_id, Some("cli")))
                    .map_err(|error| anyhow::anyhow!(error.to_string()))
            })
            .collect::<Result<Vec<_>>>()?;

        for event in &events {
            bus.publish_named(source_topic, &tenant_id.to_string(), event)
                .await
                .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        }
        let first_delivery = receive_exact(&consumer, records.len()).await?;
        let first =
            wakaclock_server::services::kafka_ai_usage::process_batch(&state, &bus, first_delivery)
                .await?;
        ensure(
            first.retry_partitions.is_empty(),
            "initial fact batch must not retry",
        )?;
        ensure(
            first.inserted == records.len(),
            "initial fact batch stored all facts",
        )?;
        ensure(
            first.jobs_created == 1,
            "initial fact batch created one reconcile job",
        )?;
        consumer.commit(&first.committed).await?;
        let initial_fact_count = fact_count(&state, tenant_id, &session_id).await?;
        ensure(initial_fact_count == 2, "initial fact count is two")?;

        let job_id = find_reconcile_job(&state, tenant_id, &session_id).await?;
        let job_count_before_replay = reconcile_job_count(&state, tenant_id, &session_id).await?;
        ensure(
            job_count_before_replay == 1,
            "initial session reconcile job is unique",
        )?;

        // Replay the exact same Kafka records. Stable usage ids and the session idempotency key
        // must make both the facts and the downstream job converge without adding totals.
        for event in &events {
            bus.publish_named(source_topic, &tenant_id.to_string(), event)
                .await
                .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        }
        let replay_delivery = receive_exact(&consumer, records.len()).await?;
        let replay = wakaclock_server::services::kafka_ai_usage::process_batch(
            &state,
            &bus,
            replay_delivery,
        )
        .await?;
        ensure(
            replay.retry_partitions.is_empty(),
            "replay fact batch must not retry",
        )?;
        ensure(replay.inserted == 0, "replay inserts no duplicate facts")?;
        ensure(replay.jobs_created == 0, "replay creates no duplicate job")?;
        consumer.commit(&replay.committed).await?;
        ensure(
            fact_count(&state, tenant_id, &session_id).await? == initial_fact_count,
            "replay keeps the logical fact count stable",
        )?;
        ensure(
            reconcile_job_count(&state, tenant_id, &session_id).await? == job_count_before_replay,
            "replay keeps the logical job count stable",
        )?;

        // A changed payload under the same provider id is permanent identity corruption. The
        // fact-sink must not overwrite the first row and must durably publish metadata-only DLQ.
        let mut conflicting = records[0].clone();
        conflicting.prompt_count += 99;
        let conflict_event = AiUsageEventV1::from_record(conflicting)
            .and_then(|event| event.event_for_tenant(tenant_id, Some("cli")))
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let dlq_group = format!("wakaclock-k5-dlq-{}", uuid::Uuid::now_v7());
        let dlq_consumer = KafkaEventConsumer::connect_with_topic_reset(
            event_config,
            "wakaclock-ai-usage-spike-dlq",
            &dlq_group,
            EventTopic::IngestDeadLetter,
            EventTopic::IngestDeadLetter.name(),
            bus.clone(),
            "latest",
        )
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        dlq_consumer.wait_for_assignment(CONSUMER_WAIT).await?;
        bus.publish_named(source_topic, &tenant_id.to_string(), &conflict_event)
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let conflict_delivery = receive_exact(&consumer, 1).await?;
        let conflict = wakaclock_server::services::kafka_ai_usage::process_batch(
            &state,
            &bus,
            conflict_delivery,
        )
        .await?;
        ensure(
            conflict.permanent_failures == 1,
            "conflicting identity is sent to the permanent-failure path",
        )?;
        ensure(
            conflict.inserted == 0,
            "conflicting identity is not overwritten",
        )?;
        consumer.commit(&conflict.committed).await?;
        let dlq_delivery = receive_exact(&dlq_consumer, 1).await?;
        let category = dlq_delivery[0].event.payload["error_category"]
            .as_str()
            .unwrap_or_default();
        ensure(
            category == "usage_identity_conflict",
            "conflicting identity DLQ contains a bounded category",
        )?;
        dlq_consumer.commit(&dlq_delivery).await?;
        ensure(
            fact_count(&state, tenant_id, &session_id).await? == initial_fact_count,
            "conflict leaves the original facts unchanged",
        )?;

        // Relay the job through a UUID-namespaced RabbitMQ topology, then execute the same
        // claim/reconcile/complete lifecycle as the dedicated worker. The broker payload is
        // checked only for routing; authoritative parameters are read after the PostgreSQL claim.
        let topology =
            JobTopology::namespaced(format!("wakaclock-k5-{}.", uuid::Uuid::now_v7().simple()));
        let queue = RabbitMqJobQueue::connect_with(rabbitmq, topology)
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let relay = state.job_service.relay_once(&queue, 64).await?;
        ensure(
            relay.broker_error.is_none(),
            "RabbitMQ relay has no broker error",
        )?;
        ensure(
            outbox_published(&state, job_id).await?,
            "the reconcile outbox row is marked published after confirm",
        )?;
        let job_consumer = queue
            .consumer(
                JobKind::AiSessionReconcile,
                10,
                &format!("wakaclock-k5-worker-{}", uuid::Uuid::now_v7()),
            )
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let delivery = tokio::time::timeout(POLL_TIMEOUT, job_consumer.next_delivery())
            .await
            .context("timed out waiting for the relayed reconcile job")??
            .context("RabbitMQ closed before delivering the reconcile job")?;
        ensure(
            delivery.job().job_id == job_id,
            "RabbitMQ delivered the expected reconcile job",
        )?;
        let owner = uuid::Uuid::now_v7();
        let claimed = state
            .job_service
            .claim(delivery.job(), owner, Duration::from_secs(30))
            .await?;
        let claimed = match claimed {
            ClaimOutcome::Claimed(job) => job,
            other => anyhow::bail!("expected queued reconcile job, got {other:?}"),
        };
        let claimed_session = claimed.params["ai_session_id"]
            .as_str()
            .context("claimed job must contain only its session id")?;
        ensure(
            claimed.params["schema_version"] == 1,
            "claimed reconcile job uses schema version 1",
        )?;
        ensure(
            claimed_session == session_id,
            "claimed reconcile job session matches the fact batch",
        )?;
        let touched = state
            .ai_usage_service
            .reconcile_session(tenant_id, claimed_session)
            .await?;
        ensure(touched == 1, "session reconcile touched one session")?;
        let transition = state
            .job_service
            .complete(
                claimed.id,
                claimed.attempt,
                owner,
                serde_json::json!({
                    "sessions_touched": touched,
                }),
            )
            .await?;
        ensure(
            matches!(
                transition,
                TransitionOutcome::Applied | TransitionOutcome::AlreadyApplied
            ),
            "reconcile job completion is fenced and durable",
        )?;
        delivery
            .ack()
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;

        let projection = session_projection(&state, tenant_id, &session_id).await?;
        ensure(
            projection.prompt_count == 3,
            "session projection sums prompt counts from facts",
        )?;
        ensure(
            projection.ai_provider.as_deref() == Some("anthropic"),
            "single-provider session keeps its provider",
        )?;
        ensure(
            projection.primary_model.is_none(),
            "mixed-model session does not invent a primary model",
        )?;
        ensure(
            session_project_count(&state, tenant_id, &session_id).await? == 1,
            "sole explicit project attribution produces one projection",
        )?;
        ensure(
            job_status(&state, job_id).await? == "succeeded",
            "reconcile job finishes with an auditable terminal state",
        )?;

        println!("k5_source_topic={source_topic}");
        println!("k5_initial_facts={initial_fact_count}");
        println!("k5_replay_inserted={}", replay.inserted);
        println!("k5_dlq_records=1");
        println!("k5_reconcile_jobs=1");
        println!("k5_relay_published={}", relay.published);
        println!("k5_session_prompt_count={}", projection.prompt_count);
        println!("k5_scenarios_completed=6");
        println!("k5_status=passed");
        queue
            .close()
            .await
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        Ok(())
    }

    fn sample_records(session_id: &str) -> Vec<AiUsageRecord> {
        vec![
            AiUsageRecord {
                usage_event_id: format!("k5-usage-{}-1", uuid::Uuid::now_v7()),
                ai_session_id: session_id.to_string(),
                occurred_at: Utc::now() - ChronoDuration::seconds(2),
                agent: "claude-code".to_string(),
                provider: Some("anthropic".to_string()),
                model: Some("claude-sonnet-5".to_string()),
                prompt_count: 1,
                prompt_character_count: Some(24),
                input_tokens: Some(100),
                output_tokens: Some(40),
                cache_read_tokens: None,
                cache_write_tokens: None,
                token_source: TokenSource::Transcript,
                project_hint: Some("k5-project".to_string()),
            },
            AiUsageRecord {
                usage_event_id: format!("k5-usage-{}-2", uuid::Uuid::now_v7()),
                ai_session_id: session_id.to_string(),
                occurred_at: Utc::now() - ChronoDuration::seconds(1),
                agent: "claude-code".to_string(),
                provider: Some("anthropic".to_string()),
                model: Some("claude-opus-5".to_string()),
                prompt_count: 2,
                prompt_character_count: Some(31),
                input_tokens: Some(200),
                output_tokens: Some(80),
                cache_read_tokens: None,
                cache_write_tokens: None,
                token_source: TokenSource::Transcript,
                project_hint: None,
            },
        ]
    }

    async fn receive_exact(
        consumer: &KafkaEventConsumer,
        expected: usize,
    ) -> Result<Vec<EventDelivery>> {
        let deadline = tokio::time::Instant::now() + POLL_TIMEOUT;
        let mut received = Vec::with_capacity(expected);
        while received.len() < expected {
            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
            if remaining.is_zero() {
                anyhow::bail!(
                    "timed out waiting for Kafka deliveries: received {}, expected {expected}",
                    received.len()
                );
            }
            let batch = consumer
                .poll_batch(
                    expected - received.len(),
                    remaining.min(Duration::from_millis(500)),
                )
                .await
                .map_err(|error| anyhow::anyhow!(error.to_string()))?;
            received.extend(batch);
        }
        Ok(received)
    }

    async fn fact_count(state: &AppState, tenant_id: uuid::Uuid, session_id: &str) -> Result<u64> {
        #[derive(Debug, serde::Deserialize, clickhouse::Row)]
        struct CountRow {
            value: u64,
        }
        let row = state
            .clickhouse
            .get_client()
            .query(
                "SELECT count() AS value
                 FROM wakaclock.ai_usage_events FINAL
                 WHERE user_id = ? AND ai_session_id = ?",
            )
            .bind(tenant_id)
            .bind(session_id)
            .fetch_one::<CountRow>()
            .await?;
        Ok(row.value)
    }

    async fn session_projection(
        state: &AppState,
        tenant_id: uuid::Uuid,
        session_id: &str,
    ) -> Result<AiSessionRow> {
        state
            .clickhouse
            .get_client()
            .query(
                "SELECT user_id, ai_session_id, started_at, ended_at, last_event_at,
                        ai_agent, ai_provider, primary_model, ai_client, editor, machine,
                        operating_system, prompt_count, input_tokens, output_tokens,
                        cache_read_tokens, cache_write_tokens, version, updated_at
                 FROM wakaclock.ai_sessions FINAL
                 WHERE user_id = ? AND ai_session_id = ?
                 LIMIT 1",
            )
            .bind(tenant_id)
            .bind(session_id)
            .fetch_one::<AiSessionRow>()
            .await
            .map_err(Into::into)
    }

    async fn session_project_count(
        state: &AppState,
        tenant_id: uuid::Uuid,
        session_id: &str,
    ) -> Result<u64> {
        #[derive(Debug, serde::Deserialize, clickhouse::Row)]
        struct CountRow {
            value: u64,
        }
        let row = state
            .clickhouse
            .get_client()
            .query(
                "SELECT count() AS value
                 FROM wakaclock.ai_session_projects FINAL
                 WHERE user_id = ? AND ai_session_id = ? AND is_deleted = 0",
            )
            .bind(tenant_id)
            .bind(session_id)
            .fetch_one::<CountRow>()
            .await?;
        Ok(row.value)
    }

    async fn find_reconcile_job(
        state: &AppState,
        tenant_id: uuid::Uuid,
        session_id: &str,
    ) -> Result<uuid::Uuid> {
        let postgres = state.postgres.as_ref().context("PostgreSQL is required")?;
        let row = postgres
            .query_one(
                "SELECT id
                 FROM async_jobs
                 WHERE user_id = $1 AND kind = 'ai.session.reconcile'
                   AND params->>'ai_session_id' = $2
                 ORDER BY requested_at DESC
                 LIMIT 1",
                &[&tenant_id, &session_id],
            )
            .await?;
        Ok(row.get("id"))
    }

    async fn reconcile_job_count(
        state: &AppState,
        tenant_id: uuid::Uuid,
        session_id: &str,
    ) -> Result<i64> {
        let postgres = state.postgres.as_ref().context("PostgreSQL is required")?;
        let row = postgres
            .query_one(
                "SELECT count(*)::bigint AS value
                 FROM async_jobs
                 WHERE user_id = $1 AND kind = 'ai.session.reconcile'
                   AND params->>'ai_session_id' = $2",
                &[&tenant_id, &session_id],
            )
            .await?;
        Ok(row.get("value"))
    }

    async fn outbox_published(state: &AppState, job_id: uuid::Uuid) -> Result<bool> {
        let postgres = state.postgres.as_ref().context("PostgreSQL is required")?;
        let row = postgres
            .query_one(
                "SELECT published_at IS NOT NULL AS published
                 FROM outbox_events
                 WHERE aggregate_type = 'async_job' AND aggregate_id = $1
                 ORDER BY created_at DESC
                 LIMIT 1",
                &[&job_id],
            )
            .await?;
        Ok(row.get("published"))
    }

    async fn job_status(state: &AppState, job_id: uuid::Uuid) -> Result<String> {
        let postgres = state.postgres.as_ref().context("PostgreSQL is required")?;
        let row = postgres
            .query_one("SELECT status FROM async_jobs WHERE id = $1", &[&job_id])
            .await?;
        Ok(row.get("status"))
    }

    fn required_endpoint(name: &str) -> Result<String> {
        let value = std::env::var(name)
            .with_context(|| format!("{name} is required for ai-usage-spike"))?;
        if value.trim().is_empty() {
            anyhow::bail!("{name} must not be empty");
        }
        Ok(value)
    }

    fn configure_environment(
        kafka: &str,
        clickhouse: &str,
        postgres: &str,
        rabbitmq: &str,
    ) -> Result<()> {
        let parsed =
            reqwest::Url::parse(clickhouse).context("CLICKHOUSE_TEST_URL must be a valid URL")?;
        let host = parsed
            .host_str()
            .context("CLICKHOUSE_TEST_URL must include a host")?;
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
        std::env::set_var("ATOAXIS_EVENT_BUS_URL", kafka);
        std::env::set_var("ATOAXIS_JOB_QUEUE_URL", rabbitmq);
        std::env::set_var("ATOAXIS_INGEST_MODE", "direct");
        std::env::set_var("ATOAXIS_INGEST_STATE_SOURCE", "postgres");
        std::env::set_var("ATOAXIS_AI_USAGE_INGEST_MODE", "kafka");
        std::env::set_var("ATOAXIS_AI_USAGE_KAFKA_COHORT", "all");
        std::env::set_var("ATOAXIS_AI_USAGE_REQUIRE_CONTRACT_V2", "false");
        std::env::set_var("ATOAXIS_AI_USAGE_KAFKA_BATCH_SIZE", "100");
        std::env::set_var("ATOAXIS_AI_USAGE_KAFKA_BATCH_WAIT_MS", "100");
        std::env::set_var("ATOAXIS_AI_USAGE_KAFKA_RETRY_MIN_MS", "100");
        std::env::set_var("ATOAXIS_AI_USAGE_KAFKA_RETRY_MAX_MS", "2000");
        std::env::set_var("ATOAXIS_REPROCESS_MODE", "sync");
        std::env::set_var("PRESENCE_V2_ENABLED", "false");
        Ok(())
    }

    fn create_admin(kafka: &str) -> Result<AdminClient<rdkafka::client::DefaultClientContext>> {
        let mut config = ClientConfig::new();
        config
            .set("bootstrap.servers", kafka)
            .set("message.timeout.ms", "10000");
        Ok(config.create()?)
    }

    async fn create_topics(
        admin: &AdminClient<rdkafka::client::DefaultClientContext>,
        source_topic: &str,
    ) -> Result<()> {
        let source = NewTopic::new(source_topic, 3, TopicReplication::Fixed(1))
            .set("retention.ms", "3600000");
        let dlq = NewTopic::new(
            EventTopic::IngestDeadLetter.name(),
            3,
            TopicReplication::Fixed(1),
        )
        .set("retention.ms", "3600000");
        let results = tokio::time::timeout(
            Duration::from_secs(5),
            admin.create_topics([&source, &dlq], &AdminOptions::new()),
        )
        .await
        .context(
            "timed out connecting to KAFKA_TEST_URL; start the isolated K5 infrastructure first",
        )??;
        for result in results {
            if let Err((name, error)) = result {
                if !error
                    .to_string()
                    .to_ascii_lowercase()
                    .contains("already exists")
                {
                    anyhow::bail!("K5 topic creation failed for {name}: {error}");
                }
            }
        }
        Ok(())
    }

    fn ensure(condition: bool, message: &str) -> Result<()> {
        if condition {
            Ok(())
        } else {
            anyhow::bail!("K5 harness invariant failed: {message}");
        }
    }
}

#[cfg(feature = "ai-usage-spike")]
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    enabled::run().await
}

#[cfg(not(feature = "ai-usage-spike"))]
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    anyhow::bail!("ai-usage-spike requires the `ai-usage-spike` feature")
}
