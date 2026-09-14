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

        let mut retry_delay = state.config.brokers.ingest.retry_min;
        let shutdown = tokio::signal::ctrl_c();
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
                        Err(error) => {
                            tracing::warn!(%error, backoff_ms = retry_delay.as_millis(), "heartbeat consumer transient error");
                            tokio::time::sleep(retry_delay).await;
                            retry_delay = (retry_delay * 2).min(state.config.brokers.ingest.retry_max);
                            continue;
                        }
                    };
                    if batch.is_empty() { continue; }
                    let outcome = match process_batch(&state, &bus, batch).await {
                        Ok(outcome) => outcome,
                        Err(error) => {
                            tracing::warn!(%error, "heartbeat batch processing failed");
                            tokio::time::sleep(retry_delay).await;
                            retry_delay = (retry_delay * 2).min(state.config.brokers.ingest.retry_max);
                            continue;
                        }
                    };
                    if !outcome.committed.is_empty() {
                        if let Err(error) = consumer.commit(&outcome.committed).await {
                            tracing::warn!(%error, backoff_ms = retry_delay.as_millis(), "heartbeat offset commit failed; leaving offsets uncommitted");
                            tokio::time::sleep(retry_delay).await;
                            retry_delay = (retry_delay * 2).min(state.config.brokers.ingest.retry_max);
                            continue;
                        }
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
                        if let Err(error) = consumer.seek_to_offsets(&retry_offsets) {
                            tracing::warn!(%error, "could not rewind retry partitions");
                        }
                        if let Err(error) = consumer.pause_partitions(&outcome.retry_partitions) {
                            tracing::warn!(%error, "could not pause retry partitions");
                        }
                        tokio::time::sleep(retry_delay).await;
                        if let Err(error) = consumer.resume_partitions(&outcome.retry_partitions) {
                            tracing::warn!(%error, "could not resume retry partitions");
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
