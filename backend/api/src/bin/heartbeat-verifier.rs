//! Shadow verifier for `ATOAXIS_INGEST_MODE=verify` (plan K3).

#[cfg(feature = "kafka")]
mod enabled {
    use anyhow::{Context, Result};
    use axum::{routing::get, Router};
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

    pub async fn run() -> Result<()> {
        let state = Arc::new(
            create_app_state()
                .await
                .context("initialize verifier state")?,
        );
        if state.config.brokers.ingest.mode != IngestMode::Verify {
            anyhow::bail!("heartbeat-verifier requires ATOAXIS_INGEST_MODE=verify");
        }
        if let Some(postgres) = &state.postgres {
            postgres.migrate().await?;
        }
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
        let health_assigned = assigned.clone();
        let health_state = state.clone();
        let host =
            std::env::var("KAFKA_CONSUMER_HEALTH_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = std::env::var("KAFKA_CONSUMER_HEALTH_PORT")
            .unwrap_or_else(|_| "8082".to_string())
            .parse::<u16>()
            .context("KAFKA_CONSUMER_HEALTH_PORT must be a port")?;
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
                            if !live.load(Ordering::Acquire)
                                || !assigned.load(Ordering::Acquire)
                                || state.clickhouse.health_check().await.is_err()
                            {
                                axum::http::StatusCode::SERVICE_UNAVAILABLE
                            } else {
                                axum::http::StatusCode::OK
                            }
                        }
                    }),
                );
            let Ok(listener) = TcpListener::bind((host.as_str(), port)).await else {
                return;
            };
            let _ = axum::serve(listener, app).await;
        });

        let shutdown = tokio::signal::ctrl_c();
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
                        Err(error) => {
                            tracing::warn!(%error, backoff_ms = retry_delay.as_millis(), "heartbeat verifier poll failed");
                            tokio::time::sleep(retry_delay).await;
                            retry_delay = (retry_delay * 2).min(state.config.brokers.ingest.retry_max);
                            continue;
                        }
                    };
                    if batch.is_empty() { continue; }
                    batch.sort_by_key(|delivery| (delivery.partition, delivery.offset));
                    let mut committed = Vec::new();
                    let mut retry_offsets = BTreeMap::new();
                    for (index, delivery) in batch.iter().cloned().enumerate() {
                        let event = match serde_json::from_value::<HeartbeatEventV1>(delivery.event.payload.clone()) {
                            Ok(event) => event,
                            Err(_) => {
                                if publish_dlq(&bus, &delivery, "invalid_heartbeat_payload").await {
                                    committed.push(delivery);
                                } else {
                                    add_retry_offsets(&mut retry_offsets, &batch, index);
                                    break;
                                }
                                continue;
                            }
                        };
                        if let Err(error) = event.validate_envelope(&delivery.event) {
                            if publish_dlq(&bus, &delivery, "event_identity_mismatch").await {
                                committed.push(delivery);
                            } else {
                                tracing::warn!(%error, "heartbeat verifier DLQ publish failed; leaving offset uncommitted");
                                add_retry_offsets(&mut retry_offsets, &batch, index);
                                break;
                            }
                            tracing::warn!(%error, "heartbeat verifier event identity rejected");
                            continue;
                        }
                        let heartbeat_id = event.heartbeat.heartbeat_id.clone().expect("validated event id");
                        let mut found = false;
                        let mut query_failed = false;
                        let mut mismatch_flags = Vec::new();
                        let mut mismatch_category = "missing_heartbeat";
                        // Deadlines are measured from the broker's received_at.  A
                        // verifier restart must not turn 3/5/15/60 into an ever
                        // growing 3+5+15+60 second delay.
                        for delay in [3_i64, 5, 15, 60] {
                            let deadline = delivery.event.received_at
                                + chrono::Duration::seconds(delay);
                            if let Ok(wait) = (deadline - chrono::Utc::now()).to_std() {
                                if !wait.is_zero() {
                                    tokio::time::sleep(wait).await;
                                }
                            }
                            match state.heartbeat_repo.heartbeat_verification_projection(
                                delivery.event.tenant_id,
                                &heartbeat_id,
                                event.heartbeat.revision,
                            ).await {
                                Ok(Some(projection)) => {
                                    mismatch_flags = parity_flags(&event, &projection);
                                    if mismatch_flags.is_empty() {
                                        found = true;
                                        break;
                                    }
                                    mismatch_category = "field_mismatch";
                                }
                                Ok(None) => {}
                                Err(error) => {
                                    tracing::warn!(%error, "heartbeat verification query failed; leaving offset uncommitted");
                                    query_failed = true;
                                    break;
                                }
                            }
                        }
                        if query_failed {
                            add_retry_offsets(&mut retry_offsets, &batch, index);
                            break;
                        }
                        if found {
                            global_kafka_metrics().increment_category("verification", "success");
                        } else {
                            let metrics = global_kafka_metrics();
                            metrics
                                .verification_mismatch_total
                                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                            metrics.increment_category("verification", mismatch_category);
                            if let Err(error) = record_mismatch_audit(
                                &state,
                                &delivery,
                                mismatch_category,
                                &mismatch_flags,
                            )
                            .await
                            {
                                tracing::warn!(%error, "heartbeat verification audit write failed");
                            }
                        }
                        // A mismatch is an audit/metric signal, not a partition blocker.
                        committed.push(delivery);
                    }
                    if !committed.is_empty() {
                        consumer.commit(&committed).await.map_err(|error| anyhow::anyhow!(error.to_string()))?;
                    }
                    if !retry_offsets.is_empty() {
                        let retry_partitions = retry_offsets.keys().copied().collect::<std::collections::BTreeSet<_>>();
                        consumer.mark_retry_partitions(&retry_partitions).await;
                        let offsets = retry_offsets.into_iter().collect::<Vec<_>>();
                        consumer
                            .seek_to_offsets(&offsets)
                            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
                        consumer
                            .pause_partitions(&retry_partitions)
                            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
                        tokio::time::sleep(retry_delay).await;
                        consumer
                            .resume_partitions(&retry_partitions)
                            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
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

    fn add_retry_offsets(
        retry_offsets: &mut BTreeMap<i32, i64>,
        batch: &[EventDelivery],
        start: usize,
    ) {
        for delivery in batch.iter().skip(start) {
            retry_offsets
                .entry(delivery.partition)
                .or_insert(delivery.offset);
        }
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
        let Ok(event_id) = StableEventId::heartbeat(
            &format!("verifier-dlq:{}:{}", delivery.partition, delivery.offset),
            0,
        ) else {
            return false;
        };
        let envelope = EventEnvelope::new(
            event_id,
            "ingest.dead_letter",
            delivery.event.tenant_id,
            chrono::Utc::now(),
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
