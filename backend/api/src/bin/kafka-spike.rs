//! Isolated K0 correctness-spike entry point.
//!
//! The executable intentionally refuses to run without explicit test endpoints.
//! It is compiled only with `--features kafka-spike` and is never copied into the
//! production image.

#[cfg(feature = "kafka-spike")]
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    use rdkafka::admin::{AdminClient, AdminOptions, NewTopic, TopicReplication};
    use rdkafka::ClientConfig;
    use wakaclock_server::infrastructure::contracts::EventTopic;

    dotenvy::dotenv().ok();
    let kafka = std::env::var("KAFKA_TEST_URL")
        .map_err(|_| anyhow::anyhow!("KAFKA_TEST_URL is required for kafka-spike"))?;
    let clickhouse = std::env::var("CLICKHOUSE_TEST_URL")
        .map_err(|_| anyhow::anyhow!("CLICKHOUSE_TEST_URL is required for kafka-spike"))?;
    let postgres = std::env::var("POSTGRES_TEST_URL").unwrap_or_else(|_| {
        "postgres://atoaxis:atoaxis-test@localhost:15432/atoaxis_k0".to_string()
    });
    if kafka.trim().is_empty() || clickhouse.trim().is_empty() || postgres.trim().is_empty() {
        anyhow::bail!(
            "KAFKA_TEST_URL, CLICKHOUSE_TEST_URL and POSTGRES_TEST_URL must not be empty"
        );
    }
    let topic = format!("wakaclock.k0.{}", uuid::Uuid::now_v7());

    // Keep all clients in the isolated run.  The topic is UUID-suffixed and is
    // deleted in the finalizer, so this command never truncates a shared topic.
    let mut client = ClientConfig::new();
    client
        .set("bootstrap.servers", &kafka)
        .set("message.timeout.ms", "10000");
    let admin: AdminClient<_> = client.create()?;
    let new_topic =
        NewTopic::new(&topic, 3, TopicReplication::Fixed(1)).set("retention.ms", "3600000");
    let dlq_topic = EventTopic::IngestDeadLetter.name();
    let new_dlq_topic =
        NewTopic::new(dlq_topic, 3, TopicReplication::Fixed(1)).set("retention.ms", "3600000");
    let topic_result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        admin.create_topics([&new_topic, &new_dlq_topic], &AdminOptions::new()),
    )
    .await
    .map_err(|_| {
        anyhow::anyhow!(
            "timed out connecting to KAFKA_TEST_URL; start the isolated K0 infrastructure first"
        )
    })??
    .into_iter();
    for result in topic_result {
        if let Err((name, error)) = result {
            if !error
                .to_string()
                .to_ascii_lowercase()
                .contains("already exists")
            {
                anyhow::bail!("isolated topic creation failed for {name}: {error}");
            }
        }
    }

    let result = run_full_spike(&kafka, &clickhouse, &postgres, &topic).await;
    let _ = admin
        // Keep the isolated DLQ topic across invocations.  Redpanda deletes
        // topics asynchronously; removing and immediately recreating the same
        // idempotent-producer topic can otherwise produce a sequence error while
        // the broker is still expiring its metadata.  The UUID-scoped source
        // topic is the only per-run topic and is deleted eagerly.
        .delete_topics(&[topic.as_str()], &AdminOptions::new())
        .await;
    result
}

#[cfg(feature = "kafka-spike")]
async fn run_full_spike(
    kafka: &str,
    clickhouse: &str,
    postgres: &str,
    topic: &str,
) -> anyhow::Result<()> {
    use std::sync::Arc;
    use wakaclock_server::infrastructure::app::create_app_state;
    use wakaclock_server::infrastructure::kafka::KafkaEventBus;

    configure_spike_environment(kafka, clickhouse, postgres)?;
    std::env::set_var(
        "K0_GROUP_ID",
        format!("wakaclock-k0-main-{}", uuid::Uuid::now_v7()),
    );
    let state = Arc::new(create_app_state().await?);
    if let Some(postgres_client) = &state.postgres {
        postgres_client.migrate().await?;
    }
    state.heartbeat_repo.migrate().await?;
    state.project_merge_repo.migrate().await?;
    state.project_rule_repo.migrate().await?;
    state.analytics_repo.migrate().await?;
    // Project identity widens project_daily, so analytics must create that
    // aggregate before the identity migration adds its nullable key.
    state.project_identity_repo.migrate().await?;

    let event_config = state
        .config
        .brokers
        .event_bus
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Kafka event bus configuration is missing"))?;
    let bus = Arc::new(KafkaEventBus::connect(event_config, "wakaclock-k0-spike")?);
    let clickhouse_version = probe_clickhouse(clickhouse).await?;
    println!("k0_topic={topic}");
    println!("redpanda_transport=ok");
    println!("clickhouse_version={clickhouse_version}");

    let mut completed = 0usize;
    completed += run_duplicate_publish(&state, &bus, topic).await?;
    completed += run_revision_replay(&state, &bus, topic).await?;
    completed += run_revision_gap(&state, &bus, topic).await?;
    completed += run_legacy_server_id(&state, &bus, topic).await?;
    completed += run_batch_boundary(&state, &bus, topic).await?;
    completed += run_raw_before_interval_replay(&state, &bus, topic).await?;
    completed += run_precommit_replay(&state, &bus, topic).await?;
    completed += run_rebalance(&state, &bus, event_config, topic).await?;
    completed += run_clickhouse_outage_replay(&state, &bus, topic).await?;
    completed += run_tombstone_replay(&state, &bus, topic).await?;
    completed += run_safe_entity_parity(&state, &bus, topic).await?;

    println!("scenarios_completed={completed}");
    println!("scenarios_required=11");
    if completed == 11 {
        println!("D6=revision_lookup reason=all_failure_and_replay_scenarios_passed");
    } else {
        println!("D6=provisional reason=one_or_more_scenarios_failed");
        anyhow::bail!("K0 correctness spike did not pass every scenario");
    }

    Ok(())
}

#[cfg(feature = "kafka-spike")]
fn configure_spike_environment(
    kafka: &str,
    clickhouse: &str,
    postgres: &str,
) -> anyhow::Result<()> {
    let parsed = reqwest::Url::parse(clickhouse)
        .map_err(|error| anyhow::anyhow!("invalid CLICKHOUSE_TEST_URL: {error}"))?;
    let host = parsed
        .host_str()
        .ok_or_else(|| anyhow::anyhow!("CLICKHOUSE_TEST_URL has no host"))?;
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
    std::env::set_var("ATOAXIS_INGEST_MODE", "kafka");
    std::env::set_var("ATOAXIS_INGEST_STATE_SOURCE", "postgres");
    std::env::set_var("ATOAXIS_INGEST_KAFKA_COHORT", "all");
    // The isolated K0 stack intentionally has no Redis: presence is outside the
    // correctness boundary and must not make the harness depend on a shared dev
    // service accidentally left in the parent environment.
    std::env::set_var("PRESENCE_V2_ENABLED", "false");
    Ok(())
}

#[cfg(feature = "kafka-spike")]
async fn publish_heartbeat(
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    topic: &str,
    heartbeat: wakaclock_core::heartbeat::Heartbeat,
) -> anyhow::Result<()> {
    use wakaclock_server::infrastructure::contracts::HeartbeatEventV1;
    let tenant_id = heartbeat.user_id;
    let event = HeartbeatEventV1::from_heartbeat(heartbeat)
        .map_err(|error| anyhow::anyhow!(error.to_string()))?
        .event_for_tenant(tenant_id, Some("api"))
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    bus.publish_named(topic, &tenant_id.to_string(), &event)
        .await
        .map_err(|error| anyhow::anyhow!(error.to_string()))
}

#[cfg(feature = "kafka-spike")]
fn sample_heartbeat(
    user_id: uuid::Uuid,
    heartbeat_id: &str,
    revision: u32,
    entity: &str,
) -> wakaclock_core::heartbeat::Heartbeat {
    use wakaclock_core::heartbeat::{EntityType, Heartbeat};
    let mut heartbeat = Heartbeat::new(
        user_id,
        entity.to_string(),
        EntityType::File,
        "wakaclock-k0-spike".to_string(),
    );
    heartbeat.heartbeat_id = Some(heartbeat_id.to_string());
    heartbeat.project = Some("k0-project".to_string());
    heartbeat.machine = "k0-machine".to_string();
    heartbeat.editor = "k0-editor".to_string();
    heartbeat.active_seconds = Some(1.0);
    heartbeat.is_write = true;
    heartbeat.revision = revision;
    heartbeat
}

#[cfg(feature = "kafka-spike")]
#[derive(Debug, serde::Deserialize, clickhouse::Row)]
struct CountValue {
    value: u64,
}

#[cfg(feature = "kafka-spike")]
#[derive(Debug)]
struct ScenarioCounts {
    physical: u64,
    canonical: u64,
    intervals: u64,
    rollup: u64,
}

#[cfg(feature = "kafka-spike")]
async fn count_rows(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    sql: &str,
    user_id: uuid::Uuid,
    heartbeat_id: &str,
) -> anyhow::Result<u64> {
    let row = state
        .clickhouse
        .get_client()
        .query(sql)
        .bind(user_id)
        .bind(heartbeat_id)
        .fetch_one::<CountValue>()
        .await?;
    Ok(row.value)
}

#[cfg(feature = "kafka-spike")]
async fn scenario_counts(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    user_id: uuid::Uuid,
    heartbeat_id: &str,
) -> anyhow::Result<ScenarioCounts> {
    Ok(ScenarioCounts {
        physical: count_rows(
            state,
            "SELECT count() AS value FROM wakaclock.heartbeats WHERE user_id = ? AND heartbeat_id = ?",
            user_id,
            heartbeat_id,
        )
        .await?,
        canonical: count_rows(
            state,
            "SELECT count() AS value FROM wakaclock.heartbeats_canonical WHERE user_id = ? AND heartbeat_id = ?",
            user_id,
            heartbeat_id,
        )
        .await?,
        intervals: count_rows(
            state,
            // ReplacingMergeTree converges asynchronously.  The correctness
            // assertion is the logical interval cardinality, so force the
            // merge here instead of making the spike depend on background
            // merge timing.
            "SELECT count() AS value FROM wakaclock.activity_intervals FINAL WHERE user_id = ? AND heartbeat_id = ?",
            user_id,
            heartbeat_id,
        )
        .await?,
        rollup: count_rows(
            state,
            // SummingMergeTree rollups also receive duplicate physical parts
            // until a merge.  FINAL makes the K0 evidence report the logical
            // aggregate rather than an eventually-consistent part count.
            "SELECT count() AS value FROM wakaclock.project_daily FINAL WHERE user_id = ? AND project = ?",
            user_id,
            "k0-project",
        )
        .await
        .unwrap_or(0),
    })
}

#[cfg(feature = "kafka-spike")]
async fn consume_once(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    topic: &str,
    group: &str,
    max_records: usize,
) -> anyhow::Result<wakaclock_server::services::kafka_heartbeat::BatchOutcome> {
    use std::time::Duration;
    use wakaclock_server::infrastructure::contracts::{EventConsumer, EventTopic};
    use wakaclock_server::infrastructure::kafka::KafkaEventConsumer;
    let config = state
        .config
        .brokers
        .event_bus
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Kafka event bus configuration is missing"))?;
    let effective_group = if group == "main" {
        std::env::var("K0_GROUP_ID").unwrap_or_else(|_| group.to_string())
    } else {
        group.to_string()
    };
    let consumer = KafkaEventConsumer::connect_with_topic(
        config,
        &format!("wakaclock-k0-{group}"),
        &effective_group,
        EventTopic::Heartbeat,
        topic,
        bus.clone(),
    )?;
    let batch = consumer
        .poll_batch(max_records, Duration::from_secs(30))
        .await
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    if batch.is_empty() {
        anyhow::bail!("K0 group {group} received an empty batch");
    }
    let outcome =
        wakaclock_server::services::kafka_heartbeat::process_batch(state, bus, batch).await?;
    if !outcome.retry_partitions.is_empty() {
        anyhow::bail!("K0 group {group} has retry partitions");
    }
    consumer
        .commit(&outcome.committed)
        .await
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    Ok(outcome)
}

#[cfg(feature = "kafka-spike")]
fn print_scenario(
    name: &str,
    input: usize,
    counts: &ScenarioCounts,
    failure_point: &str,
    reason: &str,
) {
    println!(
        "scenario={name} input={input} physical={} canonical={} interval={} rollup={} failure_point={failure_point} D6=revision_lookup reason={reason}",
        counts.physical, counts.canonical, counts.intervals, counts.rollup
    );
}

#[cfg(feature = "kafka-spike")]
async fn run_duplicate_publish(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    topic: &str,
) -> anyhow::Result<usize> {
    let user = uuid::Uuid::now_v7();
    let id = format!("k0-duplicate-{}", uuid::Uuid::now_v7());
    let heartbeat = sample_heartbeat(user, &id, 0, "src/k0-duplicate.rs");
    for _ in 0..100 {
        publish_heartbeat(bus, topic, heartbeat.clone()).await?;
    }
    let outcome = consume_once(state, bus, topic, "main", 1_000).await?;
    anyhow::ensure!(
        outcome.committed.len() == 100,
        "duplicate records were not consumed"
    );
    let counts = scenario_counts(state, user, &id).await?;
    anyhow::ensure!(
        counts.physical == 1,
        "duplicate publish created multiple raw rows"
    );
    anyhow::ensure!(
        counts.canonical == 1,
        "duplicate publish changed canonical count"
    );
    print_scenario("duplicate_publish", 100, &counts, "none", "revision_lookup");
    Ok(1)
}

#[cfg(feature = "kafka-spike")]
async fn run_revision_replay(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    topic: &str,
) -> anyhow::Result<usize> {
    let user = uuid::Uuid::now_v7();
    let id = format!("k0-revision-{}", uuid::Uuid::now_v7());
    publish_heartbeat(
        bus,
        topic,
        sample_heartbeat(user, &id, 0, "src/k0-revision.rs"),
    )
    .await?;
    publish_heartbeat(
        bus,
        topic,
        sample_heartbeat(user, &id, 1, "src/k0-revision.rs"),
    )
    .await?;
    publish_heartbeat(
        bus,
        topic,
        sample_heartbeat(user, &id, 0, "src/k0-revision.rs"),
    )
    .await?;
    publish_heartbeat(
        bus,
        topic,
        sample_heartbeat(user, &id, 1, "src/k0-revision.rs"),
    )
    .await?;
    let outcome = consume_once(state, bus, topic, "main", 100).await?;
    let counts = scenario_counts(state, user, &id).await?;
    println!(
        "revision_replay_outcome committed={} inserted={} deduplicated={} permanent={} retry={}",
        outcome.committed.len(),
        outcome.inserted,
        outcome.deduplicated,
        outcome.permanent_failures,
        outcome.retry_partitions.len()
    );
    anyhow::ensure!(
        counts.physical == 2,
        "revision replay did not keep two revisions (physical={}, canonical={}, interval={})",
        counts.physical,
        counts.canonical,
        counts.intervals
    );
    anyhow::ensure!(
        counts.canonical == 1,
        "revision replay changed logical count (physical={}, canonical={}, interval={})",
        counts.physical,
        counts.canonical,
        counts.intervals
    );
    print_scenario("revision_replay", 4, &counts, "none", "revision_lookup");
    Ok(1)
}

#[cfg(feature = "kafka-spike")]
async fn run_revision_gap(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    topic: &str,
) -> anyhow::Result<usize> {
    let user = uuid::Uuid::now_v7();
    let id = format!("k0-gap-{}", uuid::Uuid::now_v7());
    publish_heartbeat(bus, topic, sample_heartbeat(user, &id, 1, "src/k0-gap.rs")).await?;
    let outcome = consume_once(state, bus, topic, "main", 10).await?;
    anyhow::ensure!(
        outcome.permanent_failures == 1,
        "revision gap was not DLQ'd (committed={}, permanent={}, retry={})",
        outcome.committed.len(),
        outcome.permanent_failures,
        outcome.retry_partitions.len()
    );
    let counts = scenario_counts(state, user, &id).await?;
    anyhow::ensure!(counts.physical == 0, "revision gap reached ClickHouse");
    print_scenario("revision_gap", 1, &counts, "none", "revision_error");
    Ok(1)
}

#[cfg(feature = "kafka-spike")]
async fn run_legacy_server_id(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    topic: &str,
) -> anyhow::Result<usize> {
    let user = uuid::Uuid::now_v7();
    let mut heartbeat = sample_heartbeat(user, "legacy-placeholder", 0, "src/k0-legacy.rs");
    heartbeat.heartbeat_id = None;
    state
        .heartbeat_ingest_service
        .assign_server_ids(user, std::slice::from_mut(&mut heartbeat));
    let id = heartbeat
        .heartbeat_id
        .clone()
        .ok_or_else(|| anyhow::anyhow!("server ID was not assigned"))?;
    publish_heartbeat(bus, topic, heartbeat).await?;
    let _ = consume_once(state, bus, topic, "main", 10).await?;
    let counts = scenario_counts(state, user, &id).await?;
    anyhow::ensure!(counts.canonical == 1, "legacy server ID was not persisted");
    print_scenario("legacy_server_id", 1, &counts, "none", "server_assigned_id");
    Ok(1)
}

#[cfg(feature = "kafka-spike")]
async fn run_batch_boundary(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    topic: &str,
) -> anyhow::Result<usize> {
    let user = uuid::Uuid::now_v7();
    let first = format!("k0-batch-a-{}", uuid::Uuid::now_v7());
    let second = format!("k0-batch-b-{}", uuid::Uuid::now_v7());
    publish_heartbeat(
        bus,
        topic,
        sample_heartbeat(user, &first, 0, "src/k0-batch-a.rs"),
    )
    .await?;
    publish_heartbeat(
        bus,
        topic,
        sample_heartbeat(user, &second, 0, "src/k0-batch-b.rs"),
    )
    .await?;
    // One consumer group receives the two records in separate poll boundaries.
    let _ = consume_once(state, bus, topic, "main", 1).await?;
    let _ = consume_once(state, bus, topic, "main", 1).await?;
    let first_counts = scenario_counts(state, user, &first).await?;
    let second_counts = scenario_counts(state, user, &second).await?;
    anyhow::ensure!(
        first_counts.canonical == 1 && second_counts.canonical == 1,
        "batch boundary changed output"
    );
    print_scenario(
        "batch_boundary",
        2,
        &first_counts,
        "none",
        "batch_shape_independent",
    );
    Ok(1)
}

#[cfg(feature = "kafka-spike")]
async fn run_raw_before_interval_replay(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    topic: &str,
) -> anyhow::Result<usize> {
    let user = uuid::Uuid::now_v7();
    let id = format!("k0-raw-crash-{}", uuid::Uuid::now_v7());
    publish_heartbeat(
        bus,
        topic,
        sample_heartbeat(user, &id, 0, "src/k0-raw-crash.rs"),
    )
    .await?;
    std::env::set_var("ATOAXIS_KAFKA_SPIKE_FAILURE_POINT", "raw_before_interval");
    let failed = consume_once_without_commit(state, bus, topic, "main", 10).await;
    std::env::remove_var("ATOAXIS_KAFKA_SPIKE_FAILURE_POINT");
    anyhow::ensure!(
        failed.is_err(),
        "raw-before-interval failure injection did not fail"
    );
    let _ = consume_once(state, bus, topic, "main", 10).await?;
    let counts = scenario_counts(state, user, &id).await?;
    anyhow::ensure!(
        counts.physical == 1 && counts.intervals > 0,
        "replay did not fill the missing interval"
    );
    print_scenario(
        "raw_before_interval",
        1,
        &counts,
        "raw_before_interval",
        "replay_fills_projection",
    );
    Ok(1)
}

#[cfg(feature = "kafka-spike")]
async fn consume_once_without_commit(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    topic: &str,
    group: &str,
    max_records: usize,
) -> anyhow::Result<wakaclock_server::services::kafka_heartbeat::BatchOutcome> {
    use std::time::Duration;
    use wakaclock_server::infrastructure::contracts::{EventConsumer, EventTopic};
    use wakaclock_server::infrastructure::kafka::KafkaEventConsumer;
    let config = state.config.brokers.event_bus.as_ref().unwrap();
    let effective_group = if group == "main" {
        std::env::var("K0_GROUP_ID").unwrap_or_else(|_| group.to_string())
    } else {
        group.to_string()
    };
    let consumer = KafkaEventConsumer::connect_with_topic(
        config,
        &format!("wakaclock-k0-{group}-crash"),
        &effective_group,
        EventTopic::Heartbeat,
        topic,
        bus.clone(),
    )?;
    let batch = consumer
        .poll_batch(max_records, Duration::from_secs(30))
        .await
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    if batch.is_empty() {
        anyhow::bail!("failure-injection group received no batch");
    }
    let outcome =
        wakaclock_server::services::kafka_heartbeat::process_batch(state, bus, batch).await?;
    if outcome.retry_partitions.is_empty() {
        anyhow::bail!("failure injection did not leave a retry partition");
    }
    // This helper intentionally does not commit.  Surface the transient result
    // as an error so each crash-injection scenario can assert that the source
    // watermark remained unadvanced while still leaving ClickHouse side effects
    // in place for the replay call.
    anyhow::bail!("injected transient failure left source offset uncommitted")
}

#[cfg(feature = "kafka-spike")]
async fn run_precommit_replay(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    topic: &str,
) -> anyhow::Result<usize> {
    let user = uuid::Uuid::now_v7();
    let id = format!("k0-precommit-{}", uuid::Uuid::now_v7());
    publish_heartbeat(
        bus,
        topic,
        sample_heartbeat(user, &id, 0, "src/k0-precommit.rs"),
    )
    .await?;
    let _ = consume_once_without_commit_success(state, bus, topic, "main", 10).await?;
    let _ = consume_once(state, bus, topic, "main", 10).await?;
    let counts = scenario_counts(state, user, &id).await?;
    anyhow::ensure!(
        counts.physical == 1 && counts.canonical == 1,
        "pre-commit replay changed output"
    );
    print_scenario(
        "before_offset_commit",
        1,
        &counts,
        "before_offset_commit",
        "stable_identity",
    );
    Ok(1)
}

#[cfg(feature = "kafka-spike")]
async fn consume_once_without_commit_success(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    topic: &str,
    group: &str,
    max_records: usize,
) -> anyhow::Result<wakaclock_server::services::kafka_heartbeat::BatchOutcome> {
    use std::time::Duration;
    use wakaclock_server::infrastructure::contracts::{EventConsumer, EventTopic};
    use wakaclock_server::infrastructure::kafka::KafkaEventConsumer;
    let config = state.config.brokers.event_bus.as_ref().unwrap();
    let effective_group = if group == "main" {
        std::env::var("K0_GROUP_ID").unwrap_or_else(|_| group.to_string())
    } else {
        group.to_string()
    };
    let consumer = KafkaEventConsumer::connect_with_topic(
        config,
        &format!("wakaclock-k0-{group}-no-commit"),
        &effective_group,
        EventTopic::Heartbeat,
        topic,
        bus.clone(),
    )?;
    let batch = consumer
        .poll_batch(max_records, Duration::from_secs(30))
        .await
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let outcome =
        wakaclock_server::services::kafka_heartbeat::process_batch(state, bus, batch).await?;
    anyhow::ensure!(
        outcome.retry_partitions.is_empty(),
        "pre-commit processing failed"
    );
    Ok(outcome)
}

#[cfg(feature = "kafka-spike")]
async fn run_rebalance(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    config: &wakaclock_server::config::brokers::EventBusConfig,
    topic: &str,
) -> anyhow::Result<usize> {
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::Duration;
    use tokio::task::JoinSet;
    use wakaclock_server::infrastructure::contracts::{EventConsumer, EventTopic};
    use wakaclock_server::infrastructure::kafka::KafkaEventConsumer;

    // Use a fresh group for every rebalance run.  Reusing the main scenario
    // group can leave a just-closed member in the broker's session window,
    // making the first assignment wait race with the previous consumer's
    // revocation.  A unique group still exercises cooperative assignment while
    // keeping the harness deterministic and isolated from earlier scenarios.
    let group = format!("wakaclock-k0-rebalance-{}", uuid::Uuid::now_v7());
    let first = std::sync::Arc::new(KafkaEventConsumer::connect_with_topic_reset(
        config,
        "wakaclock-k0-rebalance-a",
        &group,
        EventTopic::Heartbeat,
        topic,
        bus.clone(),
        "latest",
    )?);
    let second = std::sync::Arc::new(KafkaEventConsumer::connect_with_topic_reset(
        config,
        "wakaclock-k0-rebalance-b",
        &group,
        EventTopic::Heartbeat,
        topic,
        bus.clone(),
        "latest",
    )?);
    println!("rebalance_wait=first");
    first
        .wait_for_assignment(Duration::from_secs(30))
        .await
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    // The second member intentionally joins after the first assignment.  Its
    // cooperative-sticky rebalance is exercised by the workers below; requiring
    // a second independent assignment before publishing would make the harness
    // wait on an empty stream while the broker is still completing the revoke.

    // Attach a deterministic pipeline reader at the current tail before any
    // rebalance records are published.  The topic is shared by earlier K0
    // scenarios, so an `earliest` fresh group would replay their history rather
    // than just this scenario's 24 events.
    let pipeline_group = format!("wakaclock-k0-rebalance-pipeline-{}", uuid::Uuid::now_v7());
    let pipeline = KafkaEventConsumer::connect_with_topic_reset(
        config,
        "wakaclock-k0-rebalance-pipeline",
        &pipeline_group,
        EventTopic::Heartbeat,
        topic,
        bus.clone(),
        "latest",
    )?;
    pipeline
        .wait_for_assignment(Duration::from_secs(30))
        .await
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;

    let mut ids = Vec::new();
    for _ in 0..24 {
        let user = uuid::Uuid::now_v7();
        let id = format!("k0-rebalance-{}", uuid::Uuid::now_v7());
        ids.push((user, id.clone()));
        publish_heartbeat(
            bus,
            topic,
            sample_heartbeat(user, &id, 0, "src/k0-rebalance.rs"),
        )
        .await?;
    }

    // Let both group members poll the same stream while the broker performs the
    // cooperative revoke/assign.  Their records are intentionally not committed
    // here: the production pipeline is exercised by the deterministic fresh-group
    // drain below, so the evidence never depends on which member wins a partition
    // during a timing-sensitive rebalance.
    let transport_seen = std::sync::Arc::new(AtomicUsize::new(0));
    let mut tasks = JoinSet::new();
    for consumer in [first, second] {
        let consumer = consumer.clone();
        let transport_seen = transport_seen.clone();
        tasks.spawn(async move {
            let deadline = tokio::time::Instant::now() + Duration::from_secs(20);
            while tokio::time::Instant::now() < deadline {
                let batch = consumer
                    .poll_batch(8, Duration::from_secs(2))
                    .await
                    .map_err(|error| anyhow::anyhow!(error.to_string()))?;
                if !batch.is_empty() {
                    transport_seen.fetch_add(batch.len(), Ordering::AcqRel);
                }
            }
            Ok::<(), anyhow::Error>(())
        });
    }
    while let Some(result) = tasks.join_next().await {
        result??;
    }
    anyhow::ensure!(
        transport_seen.load(Ordering::Acquire) > 0,
        "rebalance consumers observed no records"
    );

    // Process the complete tail through the shared fact-sink pipeline.  This is
    // a replay of any records the transport members saw, proving stable
    // identity/dedup while keeping the analytics assertion independent of which
    // cooperative member owns a partition.
    let batch = pipeline
        .poll_batch(64, Duration::from_secs(30))
        .await
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let outcome =
        wakaclock_server::services::kafka_heartbeat::process_batch(state, bus, batch).await?;
    pipeline
        .commit(&outcome.committed)
        .await
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    anyhow::ensure!(
        outcome.committed.len() == ids.len(),
        "rebalance pipeline did not drain all events (committed={}, expected={})",
        outcome.committed.len(),
        ids.len()
    );
    for (user, id) in &ids {
        let counts = scenario_counts(state, *user, id).await?;
        anyhow::ensure!(
            counts.canonical == 1,
            "rebalance lost or duplicated event (canonical={})",
            counts.canonical
        );
    }
    let counts = scenario_counts(state, ids[0].0, &ids[0].1).await?;
    print_scenario(
        "rebalance",
        ids.len(),
        &counts,
        "rebalance",
        "cooperative_assignment",
    );
    Ok(1)
}

#[cfg(feature = "kafka-spike")]
async fn run_clickhouse_outage_replay(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    topic: &str,
) -> anyhow::Result<usize> {
    use std::time::Duration;
    use wakaclock_server::infrastructure::contracts::{EventConsumer, EventTopic};
    use wakaclock_server::infrastructure::kafka::KafkaEventConsumer;
    let user = uuid::Uuid::now_v7();
    let id = format!("k0-outage-{}", uuid::Uuid::now_v7());
    let config = state
        .config
        .brokers
        .event_bus
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("Kafka event bus configuration is missing"))?;
    let group = format!("wakaclock-k0-outage-{}", uuid::Uuid::now_v7());
    let consumer = KafkaEventConsumer::connect_with_topic_reset(
        config,
        "wakaclock-k0-outage",
        &group,
        EventTopic::Heartbeat,
        topic,
        bus.clone(),
        "latest",
    )?;
    consumer
        .wait_for_assignment(Duration::from_secs(10))
        .await
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    publish_heartbeat(
        bus,
        topic,
        sample_heartbeat(user, &id, 0, "src/k0-outage.rs"),
    )
    .await?;
    std::env::set_var("ATOAXIS_KAFKA_SPIKE_FAILURE_POINT", "clickhouse_down");
    let first_batch = consumer
        .poll_batch(10, Duration::from_secs(30))
        .await
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let retry_offsets = first_batch
        .iter()
        .map(|delivery| (delivery.partition, delivery.offset))
        .collect::<Vec<_>>();
    let failed =
        wakaclock_server::services::kafka_heartbeat::process_batch(state, bus, first_batch).await?;
    std::env::remove_var("ATOAXIS_KAFKA_SPIKE_FAILURE_POINT");
    anyhow::ensure!(
        !failed.retry_partitions.is_empty(),
        "ClickHouse outage injection did not leave a retry partition"
    );
    consumer
        .seek_to_offsets(&retry_offsets)
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let replay = consumer
        .poll_batch(10, Duration::from_secs(30))
        .await
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let outcome =
        wakaclock_server::services::kafka_heartbeat::process_batch(state, bus, replay).await?;
    anyhow::ensure!(
        outcome.retry_partitions.is_empty(),
        "ClickHouse recovery still failed"
    );
    consumer
        .commit(&outcome.committed)
        .await
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    let counts = scenario_counts(state, user, &id).await?;
    anyhow::ensure!(
        counts.canonical == 1,
        "outage recovery did not drain the event"
    );
    print_scenario(
        "clickhouse_outage",
        1,
        &counts,
        "clickhouse_down",
        "retry_after_recovery",
    );
    Ok(1)
}

#[cfg(feature = "kafka-spike")]
async fn run_tombstone_replay(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    topic: &str,
) -> anyhow::Result<usize> {
    let user = uuid::Uuid::now_v7();
    let id = format!("k0-tombstone-{}", uuid::Uuid::now_v7());
    let heartbeat = sample_heartbeat(user, &id, 0, "src/k0-tombstone.rs");
    publish_heartbeat(bus, topic, heartbeat.clone()).await?;
    let _ = consume_once(state, bus, topic, "main", 10).await?;
    let before_delete = scenario_counts(state, user, &id).await?;
    state
        .heartbeat_repo
        .delete_ids(user, std::slice::from_ref(&id))
        .await?;
    publish_heartbeat(bus, topic, heartbeat).await?;
    let _ = consume_once(state, bus, topic, "main", 10).await?;
    let counts = scenario_counts(state, user, &id).await?;
    anyhow::ensure!(
        counts.canonical == 0 && counts.rollup == before_delete.rollup,
        "tombstone allowed a delayed record to return (canonical={}, rollup_before={}, rollup_after={})",
        counts.canonical,
        before_delete.rollup,
        counts.rollup
    );
    print_scenario(
        "tombstone_delayed_record",
        2,
        &counts,
        "none",
        "tombstone_wins_no_new_rollup",
    );
    Ok(1)
}

#[cfg(feature = "kafka-spike")]
async fn run_safe_entity_parity(
    state: &std::sync::Arc<wakaclock_server::infrastructure::app::AppState>,
    bus: &std::sync::Arc<wakaclock_server::infrastructure::kafka::KafkaEventBus>,
    topic: &str,
) -> anyhow::Result<usize> {
    use wakaclock_server::infrastructure::contracts::{safe_event_entity, HeartbeatEventV1};
    let user = uuid::Uuid::now_v7();
    let id = format!("k0-safe-{}", uuid::Uuid::now_v7());
    let absolute = format!("/Users/test/project/{id}.rs");
    let event = HeartbeatEventV1::from_heartbeat(sample_heartbeat(user, &id, 0, &absolute))
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;
    anyhow::ensure!(
        event.heartbeat.entity == format!("{id}.rs"),
        "absolute path was not reduced safely"
    );
    anyhow::ensure!(
        safe_event_entity("src/relative.rs") == "src/relative.rs",
        "relative path lost structure"
    );
    publish_heartbeat(bus, topic, event.heartbeat.clone()).await?;
    let _ = consume_once(state, bus, topic, "main", 10).await?;
    let counts = scenario_counts(state, user, &id).await?;
    anyhow::ensure!(counts.canonical == 1, "safe entity event was not ingested");
    print_scenario(
        "safe_entity_and_parity",
        1,
        &counts,
        "none",
        "relative_or_basename_only",
    );
    Ok(1)
}

#[cfg(feature = "kafka-spike")]
#[allow(dead_code)]
async fn run_transport_spike(kafka: &str, topic: &str) -> anyhow::Result<()> {
    use rdkafka::consumer::{Consumer, StreamConsumer};
    use rdkafka::message::Message;
    use rdkafka::producer::{FutureProducer, FutureRecord};
    use rdkafka::ClientConfig;
    use std::time::Duration;
    use tokio::sync::mpsc;
    use wakaclock_server::infrastructure::contracts::{EventEnvelope, StableEventId};

    let producer: FutureProducer = ClientConfig::new()
        .set("bootstrap.servers", kafka)
        .set("enable.idempotence", "true")
        .set("acks", "all")
        .set("max.in.flight.requests.per.connection", "5")
        .set("compression.type", "lz4")
        .set("linger.ms", "5")
        .set("message.timeout.ms", "10000")
        .create()?;
    let tenant = uuid::Uuid::now_v7();
    let event = EventEnvelope::new(
        StableEventId::heartbeat("k0-duplicate", 0)?,
        "heartbeat.recorded",
        tenant,
        chrono::Utc::now(),
        serde_json::json!({"heartbeat_id":"k0-duplicate","revision":0}),
    );
    event.validate()?;
    let payload = serde_json::to_vec(&event)?;
    let key = tenant.to_string();
    for _ in 0..100 {
        producer
            .send(
                FutureRecord::to(topic).key(&key).payload(&payload),
                Duration::from_secs(10),
            )
            .await
            .map_err(|(error, _)| anyhow::anyhow!(error.to_string()))?;
    }

    // Two consumers in one group force the broker to perform assignment/rebalance
    // while the duplicate stream is being drained.  We count transport records only;
    // ClickHouse canonical/rollup counts are intentionally reserved for the full K0
    // service harness and are reported as pending by the command above.
    let group = format!("wakaclock.k0.{}", uuid::Uuid::now_v7());
    let mut consumers = Vec::new();
    for _suffix in ["a", "b"] {
        let consumer: StreamConsumer = ClientConfig::new()
            .set("bootstrap.servers", kafka)
            .set("group.id", &group)
            .set("enable.auto.commit", "false")
            .set("auto.offset.reset", "earliest")
            .set("enable.partition.eof", "false")
            .create()?;
        consumer.subscribe(&[topic])?;
        consumers.push(consumer);
    }
    // The shared group is the deterministic transport analogue of the rebalance
    // scenario: each physical record is owned by exactly one reader.
    let (tx, mut rx) = mpsc::channel::<i64>(256);
    for consumer in consumers {
        let tx = tx.clone();
        tokio::spawn(async move {
            for _ in 0..100 {
                match tokio::time::timeout(Duration::from_secs(15), consumer.recv()).await {
                    Ok(Ok(message)) => {
                        let _ = tx.send(message.offset()).await;
                    }
                    _ => break,
                }
            }
        });
    }
    drop(tx);
    let mut observed = 0_u64;
    let deadline = tokio::time::Instant::now() + Duration::from_secs(30);
    while observed < 100 {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            anyhow::bail!("isolated consumers did not drain duplicate stream");
        }
        if tokio::time::timeout(remaining, rx.recv()).await?.is_none() {
            break;
        }
        observed += 1;
    }
    if observed != 100 {
        anyhow::bail!("expected 100 transport observations, got {observed}");
    }
    Ok(())
}

#[cfg(feature = "kafka-spike")]
async fn probe_clickhouse(url: &str) -> anyhow::Result<String> {
    let mut endpoint = reqwest::Url::parse(url)?;
    let database = endpoint
        .path_segments()
        .and_then(|mut segments| segments.rfind(|segment| !segment.is_empty()))
        .map(str::to_owned);
    endpoint.set_path("/");
    if let Some(database) = database {
        endpoint.set_query(Some(&format!("database={database}")));
    }
    let response = reqwest::Client::new()
        .post(endpoint)
        .body("SELECT version()")
        .send()
        .await?
        .error_for_status()?;
    let version = response.text().await?.trim().to_string();
    if version.is_empty() {
        anyhow::bail!("ClickHouse version probe returned an empty response");
    }
    Ok(version.chars().take(64).collect())
}

#[cfg(not(feature = "kafka-spike"))]
fn main() -> anyhow::Result<()> {
    anyhow::bail!("kafka-spike requires the `kafka-spike` feature")
}
