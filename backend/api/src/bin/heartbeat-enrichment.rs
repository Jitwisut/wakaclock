//! Kafka heartbeat fact-sink (plan K2.2).

#[cfg(feature = "kafka")]
mod enabled {
    use anyhow::{Context, Result};
    use axum::{routing::get, Router};
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };
    use tokio::net::TcpListener;

    use wakaclock_server::config::brokers::IngestMode;
    use wakaclock_server::infrastructure::app::create_app_state;
    use wakaclock_server::infrastructure::contracts::{EventConsumer, EventTopic};
    use wakaclock_server::infrastructure::kafka::{KafkaEventBus, KafkaEventConsumer};
    use wakaclock_server::infrastructure::metrics::global_kafka_metrics;
    use wakaclock_server::services::kafka_heartbeat::process_batch;
    use wakaclock_server::{
        config::parse_positive_port, services::background_worker::shutdown_signal,
    };

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
        let health_server_ready = ready.clone();
        let health_assigned = assigned.clone();
        let health_host =
            std::env::var("KAFKA_CONSUMER_HEALTH_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let health_port = parse_positive_port(
            std::env::var("KAFKA_CONSUMER_HEALTH_PORT").ok(),
            "KAFKA_CONSUMER_HEALTH_PORT",
            8082,
        )?;
        let health_listener = TcpListener::bind((health_host.as_str(), health_port))
            .await
            .context("heartbeat worker health listener failed")?;
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
                            global_kafka_metrics().render_prometheus("fact-sink"),
                        )
                    }),
                )
                .route(
                    "/ready",
                    get(move || {
                        let state = health_state.clone();
                        let ready = health_ready.clone();
                        let assigned = health_assigned.clone();
                        async move {
                            let postgres_ok = match &state.postgres {
                                Some(postgres) => postgres.health_check().await.is_ok(),
                                None => false,
                            };
                            if !ready.load(Ordering::Acquire)
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
                health_server_ready.store(false, Ordering::Release);
            }
        });

        let mut retry_delay = state.config.brokers.ingest.retry_min;
        let shutdown = shutdown_signal();
        tokio::pin!(shutdown);
        let result = loop {
            tokio::select! {
                _ = &mut shutdown => break Ok(()),
                batch = consumer.poll_batch(
                    state.config.brokers.ingest.batch_size,
                    state.config.brokers.ingest.batch_wait,
                ) => {
                    let batch = match batch {
                        Ok(batch) => batch,
                        Err(_) => {
                            tracing::warn!(backoff_ms = retry_delay.as_millis(), "heartbeat consumer poll failed");
                            // A failed poll can have consumed records before
                            // returning the error. Let the supervisor recreate
                            // the group instead of continuing with a moved local
                            // offset.
                            break Err(anyhow::anyhow!("heartbeat consumer poll failed"));
                        }
                    };
                    if batch.is_empty() { continue; }
                    let outcome = match process_batch(&state, &bus, batch).await {
                        Ok(outcome) => outcome,
                        Err(_) => {
                            tracing::warn!("heartbeat batch processing failed");
                            break Err(anyhow::anyhow!("heartbeat batch processing failed"));
                        }
                    };
                    if !outcome.committed.is_empty()
                        && consumer.commit(&outcome.committed).await.is_err()
                    {
                        tracing::warn!(backoff_ms = retry_delay.as_millis(), "heartbeat offset commit failed; leaving offsets uncommitted");
                        break Err(anyhow::anyhow!("heartbeat offset commit failed"));
                    }
                    if !outcome.retry_partitions.is_empty() {
                        consumer
                            .mark_retry_partitions(&outcome.retry_partitions)
                            .await;
                        let retry_offsets = outcome
                            .retry_offsets
                            .iter()
                            .map(|(partition, offset)| (*partition, *offset))
                            .collect::<Vec<_>>();
                        if consumer.seek_to_offsets(&retry_offsets).is_err() {
                            tracing::warn!("could not rewind retry partitions");
                            break Err(anyhow::anyhow!("heartbeat retry rewind failed"));
                        }
                        if consumer.pause_partitions(&outcome.retry_partitions).is_err() {
                            tracing::warn!("could not pause retry partitions");
                            break Err(anyhow::anyhow!("heartbeat retry pause failed"));
                        }
                        tokio::time::sleep(retry_delay).await;
                        if consumer.resume_partitions(&outcome.retry_partitions).is_err() {
                            tracing::warn!("could not resume retry partitions");
                            break Err(anyhow::anyhow!("heartbeat retry resume failed"));
                        }
                        retry_delay = (retry_delay * 2).min(state.config.brokers.ingest.retry_max);
                    } else {
                        let committed_partitions = outcome
                            .committed
                            .iter()
                            .map(|delivery| delivery.partition)
                            .collect::<std::collections::BTreeSet<_>>();
                        consumer
                            .clear_retry_partitions(&committed_partitions)
                            .await;
                        retry_delay = state.config.brokers.ingest.retry_min;
                    }
                }
            }
        };
        ready.store(false, Ordering::Release);
        health.abort();
        result
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
