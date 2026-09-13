//! Shadow verifier for `ATOAXIS_INGEST_MODE=verify` (plan K3).

#[cfg(feature = "kafka")]
mod enabled {
    use anyhow::{Context, Result};
    use axum::{routing::get, Router};
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };
    use std::time::Duration;
    use tokio::net::TcpListener;

    use wakaclock_server::config::brokers::IngestMode;
    use wakaclock_server::infrastructure::app::create_app_state;
    use wakaclock_server::infrastructure::contracts::{
        EventBus, EventConsumer, EventDelivery, EventEnvelope, EventTopic, HeartbeatEventV1,
        StableEventId,
    };
    use wakaclock_server::infrastructure::kafka::{KafkaEventBus, KafkaEventConsumer};

    pub async fn run() -> Result<()> {
        let state = Arc::new(
            create_app_state()
                .await
                .context("initialize verifier state")?,
        );
        if state.config.brokers.ingest.mode != IngestMode::Verify {
            anyhow::bail!("heartbeat-verifier requires ATOAXIS_INGEST_MODE=verify");
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
        let result = loop {
            tokio::select! {
                _ = &mut shutdown => break Ok(()),
                batch = consumer.poll_batch(1_000, Duration::from_millis(500)) => {
                    let batch = batch.map_err(|error| anyhow::anyhow!(error.to_string()))?;
                    if batch.is_empty() { continue; }
                    let mut committed = Vec::new();
                    for delivery in batch {
                        let event = match serde_json::from_value::<HeartbeatEventV1>(delivery.event.payload.clone()) {
                            Ok(event) => event,
                            Err(_) => {
                                if publish_dlq(&bus, &delivery, "invalid_heartbeat_payload").await {
                                    committed.push(delivery);
                                } else {
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
                                break;
                            }
                            tracing::warn!(%error, "heartbeat verifier event identity rejected");
                            continue;
                        }
                        let heartbeat_id = event.heartbeat.heartbeat_id.clone().expect("validated event id");
                        let mut found = false;
                        let mut query_failed = false;
                        for delay in [3_u64, 5, 15, 60] {
                            tokio::time::sleep(Duration::from_secs(delay)).await;
                            match state.heartbeat_repo.has_heartbeat_revision(
                                delivery.event.tenant_id,
                                &heartbeat_id,
                                event.heartbeat.revision,
                            ).await {
                                Ok(true) => { found = true; break; }
                                Ok(false) => {}
                                Err(error) => {
                                    tracing::warn!(%error, "heartbeat verification query failed; leaving offset uncommitted");
                                    query_failed = true;
                                    break;
                                }
                            }
                        }
                        if query_failed {
                            break;
                        }
                        if !found {
                            tracing::warn!(
                                event_id = %delivery.event.event_id.as_str(),
                                "heartbeat verification mismatch after retry window"
                            );
                        }
                        // A mismatch is an audit/metric signal, not a partition blocker.
                        committed.push(delivery);
                    }
                    if !committed.is_empty() {
                        consumer.commit(&committed).await.map_err(|error| anyhow::anyhow!(error.to_string()))?;
                    }
                }
            }
        };
        live.store(false, Ordering::Release);
        health.abort();
        result
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
