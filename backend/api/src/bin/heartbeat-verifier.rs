//! Shadow verifier for `ATOAXIS_INGEST_MODE=verify` (plan K3).

#[cfg(feature = "kafka")]
mod enabled {
    use anyhow::{Context, Result};
    use axum::{routing::get, Router};
    use futures::{stream, StreamExt};
    use std::collections::BTreeMap;
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };
    use tokio::net::TcpListener;

    use wakaclock_server::config::brokers::IngestMode;
    use wakaclock_server::infrastructure::app::create_app_state;
    use wakaclock_server::infrastructure::contracts::{
        EventBus, EventConsumer, EventDelivery, EventEnvelope, EventTopic, HeartbeatEventV1,
        StableEventId,
    };
    use wakaclock_server::infrastructure::kafka::{KafkaEventBus, KafkaEventConsumer};
    use wakaclock_server::infrastructure::metrics::global_kafka_metrics;
    use wakaclock_server::repository::heartbeat::HeartbeatVerificationProjection;
    use wakaclock_server::{
        config::parse_positive_port, services::background_worker::shutdown_signal,
    };

    const VERIFY_DEADLINES: [std::time::Duration; 4] = [
        std::time::Duration::from_secs(3),
        std::time::Duration::from_secs(5),
        std::time::Duration::from_secs(15),
        std::time::Duration::from_secs(60),
    ];
    const VERIFY_CONCURRENCY: usize = 16;

    pub async fn run() -> Result<()> {
        let state = Arc::new(
            create_app_state()
                .await
                .context("initialize verifier state")?,
        );
        if state.config.brokers.ingest.mode != IngestMode::Verify {
            anyhow::bail!("heartbeat-verifier requires ATOAXIS_INGEST_MODE=verify");
        }
        let postgres = state
            .postgres
            .clone()
            .context("heartbeat verifier requires POSTGRES_URL")?;
        postgres.migrate().await?;
        state.heartbeat_repo.migrate().await?;
        let event_config = state
            .config
            .brokers
            .event_bus
            .as_ref()
            .context("ATOAXIS_EVENT_BUS_URL is required for heartbeat-verifier")?;
        let bus = Arc::new(
            KafkaEventBus::connect(event_config, "wakaclock-heartbeat-verifier")
                .map_err(|error| anyhow::anyhow!(error.to_string()))?,
        );
        let consumer = KafkaEventConsumer::connect(
            event_config,
            "wakaclock-heartbeat-verifier",
            "wakaclock.heartbeat.verifier",
            EventTopic::Heartbeat,
            bus.clone(),
        )
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;

        let live = Arc::new(AtomicBool::new(true));
        let assigned = consumer.assignment_flag();
        let health_live = live.clone();
        let health_server_live = live.clone();
        let health_assigned = assigned.clone();
        let health_state = state.clone();
        let host =
            std::env::var("KAFKA_CONSUMER_HEALTH_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = parse_positive_port(
            std::env::var("KAFKA_CONSUMER_HEALTH_PORT").ok(),
            "KAFKA_CONSUMER_HEALTH_PORT",
            8082,
        )?;
        let health_listener = TcpListener::bind((host.as_str(), port))
            .await
            .context("heartbeat verifier health listener failed")?;
        let health = tokio::spawn(async move {
            let app = Router::new()
                .route("/live", get(|| async { axum::http::StatusCode::OK }))
                .route(
                    "/metrics",
                    get(|| async {
                        (
                            [(
                                axum::http::header::CONTENT_TYPE,
                                axum::http::HeaderValue::from_static(
                                    "text/plain; version=0.0.4; charset=utf-8",
                                ),
                            )],
                            global_kafka_metrics().render_prometheus("verifier"),
                        )
                    }),
                )
                .route(
                    "/ready",
                    get(move || {
                        let state = health_state.clone();
                        let live = health_live.clone();
                        let assigned = health_assigned.clone();
                        async move {
                            let postgres_ok = match &state.postgres {
                                Some(postgres) => postgres.health_check().await.is_ok(),
                                None => false,
                            };
                            if !live.load(Ordering::Acquire)
                                || !assigned.load(Ordering::Acquire)
                                || !postgres_ok
                                || state.clickhouse.health_check().await.is_err()
                            {
                                axum::http::StatusCode::SERVICE_UNAVAILABLE
                            } else {
                                axum::http::StatusCode::OK
                            }
                        }
                    }),
                );
            if axum::serve(health_listener, app).await.is_err() {
                health_server_live.store(false, Ordering::Release);
            }
        });

        let shutdown = shutdown_signal();
        tokio::pin!(shutdown);
        let mut retry_delay = state.config.brokers.ingest.retry_min;
        let result = loop {
            tokio::select! {
                _ = &mut shutdown => break Ok(()),
                batch = consumer.poll_batch(
                    state.config.brokers.ingest.batch_size,
                    state.config.brokers.ingest.batch_wait,
                ) => {
                    let mut batch = match batch {
                        Ok(batch) => batch,
                        Err(_) => {
                            tracing::warn!(backoff_ms = retry_delay.as_millis(), "heartbeat verifier poll failed");
                            // Recreate the consumer after a partial poll so an
                            // uncommitted record cannot be skipped by the local
                            // librdkafka position.
                            break Err(anyhow::anyhow!("heartbeat verifier poll failed"));
                        }
                    };
                    if batch.is_empty() { continue; }
                    batch.sort_by_key(|delivery| (delivery.partition, delivery.offset));
                    let (committed, retry_offsets) = verify_batch(&state, &bus, &batch).await;
                    if !committed.is_empty() {
                        consumer
                            .commit(&committed)
                            .await
                            .map_err(|_| anyhow::anyhow!("heartbeat verifier offset commit failed"))?;
                    }
                    if !retry_offsets.is_empty() {
                        let retry_partitions = retry_offsets.keys().copied().collect::<std::collections::BTreeSet<_>>();
                        consumer.mark_retry_partitions(&retry_partitions).await;
                        let offsets = retry_offsets.into_iter().collect::<Vec<_>>();
                        consumer
                            .seek_to_offsets(&offsets)
                            .map_err(|_| anyhow::anyhow!("heartbeat verifier retry rewind failed"))?;
                        consumer
                            .pause_partitions(&retry_partitions)
                            .map_err(|_| anyhow::anyhow!("heartbeat verifier retry pause failed"))?;
                        tokio::time::sleep(retry_delay).await;
                        consumer
                            .resume_partitions(&retry_partitions)
                            .map_err(|_| anyhow::anyhow!("heartbeat verifier retry resume failed"))?;
                        retry_delay = (retry_delay * 2).min(state.config.brokers.ingest.retry_max);
                    } else {
                        let committed_partitions = committed
                            .iter()
                            .map(|delivery| delivery.partition)
                            .collect::<std::collections::BTreeSet<_>>();
                        consumer.clear_retry_partitions(&committed_partitions).await;
                        retry_delay = state.config.brokers.ingest.retry_min;
                    }
                }
            }
        };
        live.store(false, Ordering::Release);
        health.abort();
        result
    }

    enum VerificationOutcome {
        Committed(EventDelivery),
        Retry(EventDelivery),
    }

    async fn verify_batch(
        state: &wakaclock_server::infrastructure::app::AppState,
        bus: &KafkaEventBus,
        batch: &[EventDelivery],
    ) -> (Vec<EventDelivery>, BTreeMap<i32, i64>) {
        // Verification waits against absolute deadlines, so one slow event must
        // not serialize every other event in the poll. Bound concurrency to keep
        // ClickHouse and PostgreSQL protected while allowing a full batch to make
        // progress within the same 3/5/15/60-second schedule.
        let mut outcomes = stream::iter(
            batch
                .iter()
                .cloned()
                .map(|delivery| verify_delivery(state, bus, delivery)),
        )
        .buffer_unordered(VERIFY_CONCURRENCY);
        let mut committed = Vec::new();
        let mut retry_offsets: BTreeMap<i32, i64> = BTreeMap::new();
        while let Some(outcome) = outcomes.next().await {
            match outcome {
                VerificationOutcome::Committed(delivery) => committed.push(delivery),
                VerificationOutcome::Retry(delivery) => {
                    retry_offsets
                        .entry(delivery.partition)
                        .and_modify(|first| *first = (*first).min(delivery.offset))
                        .or_insert(delivery.offset);
                }
            }
        }
        // Kafka commits a partition watermark, not individual records. A later
        // verification that completed concurrently must remain uncommitted when
        // an earlier record in the same partition needs a retry.
        committed.retain(|delivery| {
            retry_offsets
                .get(&delivery.partition)
                .is_none_or(|first_retry| delivery.offset < *first_retry)
        });
        (committed, retry_offsets)
    }

    async fn verify_delivery(
        state: &wakaclock_server::infrastructure::app::AppState,
        bus: &KafkaEventBus,
        delivery: EventDelivery,
    ) -> VerificationOutcome {
        let event = match serde_json::from_value::<HeartbeatEventV1>(delivery.event.payload.clone())
        {
            Ok(event) => event,
            Err(_) => {
                return if publish_dlq(bus, &delivery, "invalid_heartbeat_payload").await {
                    VerificationOutcome::Committed(delivery)
                } else {
                    VerificationOutcome::Retry(delivery)
                };
            }
        };
        if event.validate_envelope(&delivery.event).is_err() {
            return if publish_dlq(bus, &delivery, "event_identity_mismatch").await {
                tracing::warn!("heartbeat verifier event identity rejected");
                VerificationOutcome::Committed(delivery)
            } else {
                tracing::warn!("heartbeat verifier DLQ publish failed; leaving offset uncommitted");
                VerificationOutcome::Retry(delivery)
            };
        }

        let Some(heartbeat_id) = event.heartbeat.heartbeat_id.clone() else {
            // `validate_envelope` currently guarantees this, but keep the
            // verifier fail-closed if the contract is extended later.
            return if publish_dlq(bus, &delivery, "invalid_heartbeat_payload").await {
                VerificationOutcome::Committed(delivery)
            } else {
                VerificationOutcome::Retry(delivery)
            };
        };
        let mut mismatch_flags = Vec::new();
        let mut mismatch_category = "missing_heartbeat";
        let mut found = false;
        // Deadlines are measured from broker `received_at`. A verifier restart
        // therefore resumes at the next absolute deadline instead of sleeping
        // for a fresh 3+5+15+60 seconds.
        for (deadline_index, delay) in VERIFY_DEADLINES.iter().enumerate() {
            let deadline = delivery.event.received_at
                + chrono::Duration::from_std(*delay)
                    .expect("verification deadline fits in chrono duration");
            if let Ok(wait) = (deadline - chrono::Utc::now()).to_std() {
                if !wait.is_zero() {
                    tokio::time::sleep(wait).await;
                }
            }
            match state
                .heartbeat_repo
                .heartbeat_verification_projection(
                    delivery.event.tenant_id,
                    &heartbeat_id,
                    event.heartbeat.revision,
                )
                .await
            {
                Ok(Some(projection)) => {
                    mismatch_flags = parity_flags(&event, &projection);
                    if mismatch_flags.is_empty() {
                        found = true;
                        break;
                    } else {
                        mismatch_category = "field_mismatch";
                    }
                }
                Ok(None) if deadline_index + 1 < VERIFY_DEADLINES.len() => {}
                Ok(None) => break,
                Err(_) => {
                    tracing::warn!(
                        "heartbeat verification query failed; leaving offset uncommitted"
                    );
                    return VerificationOutcome::Retry(delivery);
                }
            }
        }
        if found {
            global_kafka_metrics().increment_category("verification", "success");
            return VerificationOutcome::Committed(delivery);
        }

        if let Err(_error) =
            record_mismatch_audit(state, &delivery, mismatch_category, &mismatch_flags).await
        {
            // A mismatch without its durable audit is not a completed
            // verification. Replaying the event is safer than acknowledging an
            // untraceable parity failure.
            tracing::warn!("heartbeat verification audit write failed; leaving offset uncommitted");
            return VerificationOutcome::Retry(delivery);
        }
        let metrics = global_kafka_metrics();
        metrics
            .verification_mismatch_total
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        metrics.increment_category("verification", mismatch_category);
        VerificationOutcome::Committed(delivery)
    }

    fn parity_flags(
        event: &HeartbeatEventV1,
        projection: &HeartbeatVerificationProjection,
    ) -> Vec<&'static str> {
        let mut flags = Vec::new();
        if projection.entity != event.heartbeat.entity {
            flags.push("entity");
        }
        if projection.project != event.heartbeat.project {
            flags.push("project");
        }
        if projection.actor_type != event.heartbeat.actor_type.as_str() {
            flags.push("actor_type");
        }
        if projection.revision != event.heartbeat.revision {
            flags.push("revision");
        }
        flags
    }

    async fn record_mismatch_audit(
        state: &wakaclock_server::infrastructure::app::AppState,
        delivery: &EventDelivery,
        category: &str,
        flags: &[&str],
    ) -> Result<()> {
        let Some(postgres) = &state.postgres else {
            return Ok(());
        };
        let field_flags: Vec<String> = flags.iter().map(|flag| (*flag).to_string()).collect();
        postgres
            .execute(
                "INSERT INTO heartbeat_verification_audits
                    (tenant_id, event_id, mismatch_category, field_flags, attempts, received_at, last_attempt_at)
                 VALUES ($1, $2, $3, $4, 1, $5, now())
                 ON CONFLICT (tenant_id, event_id) DO UPDATE SET
                    mismatch_category = EXCLUDED.mismatch_category,
                    field_flags = EXCLUDED.field_flags,
                    attempts = heartbeat_verification_audits.attempts + 1,
                    last_attempt_at = now()",
                &[
                    &delivery.event.tenant_id,
                    &delivery.event.event_id.as_str(),
                    &category,
                    &field_flags,
                    &delivery.event.received_at,
                ],
            )
            .await
            .context("failed to persist heartbeat verification audit")?;
        Ok(())
    }

    async fn publish_dlq(
        bus: &KafkaEventBus,
        delivery: &EventDelivery,
        category: &'static str,
    ) -> bool {
        let event_id =
            StableEventId::dead_letter(delivery.topic.name(), delivery.partition, delivery.offset);
        let envelope = EventEnvelope::new(
            event_id,
            "ingest.dead_letter",
            delivery.event.tenant_id,
            delivery.event.received_at,
            serde_json::json!({
                "source_topic": delivery.topic.name(),
                "source_partition": delivery.partition,
                "source_offset": delivery.offset,
                "error_category": category,
            }),
        );
        bus.publish(EventTopic::IngestDeadLetter, &envelope)
            .await
            .is_ok()
    }
}

#[cfg(feature = "kafka")]
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    enabled::run().await
}

#[cfg(not(feature = "kafka"))]
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    anyhow::bail!("heartbeat-verifier requires the `kafka` feature")
}
