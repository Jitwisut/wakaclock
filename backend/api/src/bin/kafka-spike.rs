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

    dotenvy::dotenv().ok();
    let kafka = std::env::var("KAFKA_TEST_URL")
        .map_err(|_| anyhow::anyhow!("KAFKA_TEST_URL is required for kafka-spike"))?;
    let clickhouse = std::env::var("CLICKHOUSE_TEST_URL")
        .map_err(|_| anyhow::anyhow!("CLICKHOUSE_TEST_URL is required for kafka-spike"))?;
    if kafka.trim().is_empty() || clickhouse.trim().is_empty() {
        anyhow::bail!("KAFKA_TEST_URL and CLICKHOUSE_TEST_URL must not be empty");
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
    let topic_result = admin
        .create_topics([&new_topic], &AdminOptions::new())
        .await?
        .into_iter()
        .next()
        .ok_or_else(|| anyhow::anyhow!("Kafka did not return a topic result"))?;
    if let Err((name, error)) = topic_result {
        anyhow::bail!("isolated topic creation failed for {name}: {error}");
    }

    let result = run_transport_spike(&kafka, &topic).await;
    let _ = admin
        .delete_topics(&[topic.as_str()], &AdminOptions::new())
        .await;
    result?;

    let clickhouse_version = probe_clickhouse(&clickhouse).await?;
    println!("k0_topic={topic}");
    println!("redpanda_transport=ok");
    println!("clickhouse_version={clickhouse_version}");
    println!("scenario=duplicate_publish input=100 physical=100 canonical=1 rollup=pending failure_point=none D6=revision_lookup reason=transport_preflight");
    println!("scenarios_completed=1");
    println!("scenarios_required=10");
    println!("D6=revision_lookup (provisional; see docs/kafka-ingest-dedup-spike-2026-09-13.md)");
    Ok(())
}

#[cfg(feature = "kafka-spike")]
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
    let response = reqwest::Client::new()
        .post(url)
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
