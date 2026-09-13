//! Kafka heartbeat fact-sink (plan K2.2).

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
        EventBus, EventConsumer, EventEnvelope, EventTopic, HeartbeatEventV1, StableEventId,
    };
    use wakaclock_server::infrastructure::kafka::{KafkaEventBus, KafkaEventConsumer};

    pub async fn run() -> Result<()> {
        let state = Arc::new(
            create_app_state()
                .await
                .context("initialize worker state")?,
        );
        if state.config.brokers.ingest.mode != IngestMode::Kafka {
            anyhow::bail!("heartbeat-enrichment requires ATOAXIS_INGEST_MODE=kafka");
        }
        // In Kafka mode the API deliberately skips ClickHouse migrations so it can
        // stay available during an outage.  The fact-sink is therefore the owner of
        // the ClickHouse schema bootstrap before it starts consuming data.
        state.heartbeat_repo.migrate().await?;
        state.project_merge_repo.migrate().await?;
        state.project_rule_repo.migrate().await?;
        state.analytics_repo.migrate().await?;
        state.external_duration_repo.migrate().await?;
        state.follow_up_repo.migrate().await?;
        state.account_analytics_repo.migrate().await?;
        state.ai_usage_repo.migrate().await?;
        state.project_identity_repo.migrate().await?;
        state.reprocess_service.migrate().await?;
        state.org_repo.migrate().await?;
        state.team_repo.migrate().await?;
        state.coworking_session_repo.migrate().await?;
        let event_config = state
            .config
            .brokers
            .event_bus
            .as_ref()
            .context("ATOAXIS_EVENT_BUS_URL is required for heartbeat-enrichment")?;
        let bus = Arc::new(
            KafkaEventBus::connect(event_config, "wakaclock-heartbeat-enrichment")
                .map_err(|error| anyhow::anyhow!(error.to_string()))?,
        );
        let consumer = KafkaEventConsumer::connect(
            event_config,
            "wakaclock-heartbeat-enrichment",
            "wakaclock.heartbeat.fact-sink",
            EventTopic::Heartbeat,
            bus.clone(),
        )
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;

        let ready = Arc::new(AtomicBool::new(true));
        let assigned = consumer.assignment_flag();
        let health_state = state.clone();
        let health_ready = ready.clone();
        let health_assigned = assigned.clone();
        let health_host =
            std::env::var("KAFKA_CONSUMER_HEALTH_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let health_port = std::env::var("KAFKA_CONSUMER_HEALTH_PORT")
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
                        let ready = health_ready.clone();
                        let assigned = health_assigned.clone();
                        async move {
                            if !ready.load(Ordering::Acquire)
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
            let listener = match TcpListener::bind((health_host.as_str(), health_port)).await {
                Ok(listener) => listener,
                Err(error) => {
                    tracing::error!(%error, "heartbeat worker health listener failed");
                    return;
                }
            };
            if let Err(error) = axum::serve(listener, app).await {
                tracing::error!(%error, "heartbeat worker health server stopped");
            }
        });

        let mut retry_delay = Duration::from_secs(1);
        let shutdown = tokio::signal::ctrl_c();
        tokio::pin!(shutdown);
        let result = loop {
            tokio::select! {
                _ = &mut shutdown => break Ok(()),
                batch = consumer.poll_batch(1_000, Duration::from_millis(500)) => {
                    let batch = match batch {
                        Ok(batch) => batch,
                        Err(error) => {
                            tracing::warn!(%error, backoff_seconds = retry_delay.as_secs(), "heartbeat consumer transient error");
                            tokio::time::sleep(retry_delay).await;
                            retry_delay = (retry_delay * 2).min(Duration::from_secs(60));
                            continue;
                        }
                    };
                    if batch.is_empty() { continue; }
                    let mut committed = Vec::new();
                    let mut backoff_after_batch = false;
                    for delivery in batch {
                        let event = match serde_json::from_value::<HeartbeatEventV1>(delivery.event.payload.clone()) {
                            Ok(event) => event,
                            Err(error) => {
                                if publish_dlq(&bus, &delivery, "invalid_heartbeat_payload").await {
                                    committed.push(delivery);
                                } else {
                                    tracing::warn!(%error, "heartbeat DLQ publish failed; leaving offset uncommitted");
                                    backoff_after_batch = true;
                                    break;
                                }
                                tracing::warn!(%error, "heartbeat event payload rejected");
                                continue;
                            }
                        };
                        if let Err(error) = event.validate_envelope(&delivery.event) {
                            if publish_dlq(&bus, &delivery, "event_identity_mismatch").await {
                                committed.push(delivery);
                            } else {
                                tracing::warn!(%error, "heartbeat DLQ publish failed; leaving offset uncommitted");
                                backoff_after_batch = true;
                                break;
                            }
                            tracing::warn!(%error, "heartbeat event identity rejected");
                            continue;
                        }
                        let heartbeat = event.into_heartbeat(delivery.event.tenant_id);
                        let token = format!(
                            "kafka:{}:{}:{}:{}",
                            delivery.topic.name(),
                            delivery.partition,
                            delivery.offset,
                            delivery.event.tenant_id
                        );
                        match state.heartbeat_service.process_heartbeats_strict_with_token(
                            delivery.event.tenant_id,
                            heartbeat.machine.clone(),
                            vec![heartbeat],
                            &token,
                        ).await {
                            Ok(_) => committed.push(delivery),
                            Err(error) => {
                                let error_text = error.to_string();
                                if let Some(category) = permanent_category(&error_text) {
                                    if publish_dlq(&bus, &delivery, category).await {
                                        committed.push(delivery);
                                    } else {
                                        tracing::warn!(%error, "heartbeat DLQ publish failed; leaving offset uncommitted");
                                        backoff_after_batch = true;
                                        break;
                                    }
                                } else {
                                    tracing::warn!(%error, "heartbeat sink transient failure; leaving offset uncommitted");
                                    backoff_after_batch = true;
                                    break;
                                }
                            }
                        }
                    }
                    if !committed.is_empty() {
                        if let Err(error) = consumer.commit(&committed).await {
                            tracing::warn!(%error, backoff_seconds = retry_delay.as_secs(), "heartbeat offset commit failed; leaving offsets uncommitted");
                            backoff_after_batch = true;
                        }
                    }
                    if backoff_after_batch {
                        tokio::time::sleep(retry_delay).await;
                        retry_delay = (retry_delay * 2).min(Duration::from_secs(60));
                    } else {
                        retry_delay = Duration::from_secs(1);
                    }
                }
            }
        };
        ready.store(false, Ordering::Release);
        health.abort();
        result
    }

    async fn publish_dlq(
        bus: &KafkaEventBus,
        delivery: &wakaclock_server::infrastructure::contracts::EventDelivery,
        category: &'static str,
    ) -> bool {
        let Ok(event_id) = StableEventId::heartbeat(
            &format!("worker-dlq:{}:{}", delivery.partition, delivery.offset),
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

    fn permanent_category(error: &str) -> Option<&'static str> {
        let lower = error.to_ascii_lowercase();
        if lower.contains("no stored base")
            || lower.contains("must follow stored revision")
            || lower.contains("correction revision")
        {
            Some("revision_error")
        } else if lower.contains("privacy") {
            Some("privacy_contract_violation")
        } else if lower.contains("heartbeat_id must")
            || lower.contains("activity segment is invalid")
            || lower.contains("revision exceeds")
            || lower.contains("clipboard metrics require")
            || lower.contains("unsupported clipboard_tracking_version")
        {
            Some("invalid_heartbeat")
        } else {
            None
        }
    }

    #[cfg(test)]
    mod tests {
        use super::permanent_category;

        #[test]
        fn only_known_permanent_categories_are_dead_lettered() {
            assert_eq!(
                permanent_category("correction revision 1 has no stored base"),
                Some("revision_error")
            );
            assert_eq!(
                permanent_category("heartbeat_id must be 1..=256 bytes"),
                Some("invalid_heartbeat")
            );
            assert_eq!(
                permanent_category("privacy contract violation"),
                Some("privacy_contract_violation")
            );
            assert_eq!(
                permanent_category("ClickHouse broker connection timed out"),
                None
            );
        }
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
    anyhow::bail!("heartbeat-enrichment requires the `kafka` feature")
}
