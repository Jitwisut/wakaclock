//! AI usage Kafka fact-sink (K5.3).

#[cfg(feature = "kafka")]
mod enabled {
    use anyhow::{Context, Result};
    use axum::{routing::get, Router};
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };
    use tokio::net::TcpListener;

    use wakaclock_server::infrastructure::app::create_app_state;
    use wakaclock_server::infrastructure::contracts::{EventConsumer, EventTopic};
    use wakaclock_server::infrastructure::kafka::{KafkaEventBus, KafkaEventConsumer};
    use wakaclock_server::infrastructure::metrics::global_kafka_metrics;
    use wakaclock_server::services::kafka_ai_usage::process_batch;

    pub async fn run() -> Result<()> {
        let state = Arc::new(
            create_app_state()
                .await
                .context("initialize AI usage fact-sink state")?,
        );
        let postgres = state
            .postgres
            .clone()
            .context("AI usage fact-sink requires POSTGRES_URL")?;
        postgres
            .migrate()
            .await
            .context("migrate PostgreSQL before starting AI usage fact-sink")?;
        state.ai_usage_repo.migrate().await?;
        state.project_identity_repo.migrate().await?;

        let event_config = state
            .config
            .brokers
            .event_bus
            .as_ref()
            .context("ATOAXIS_EVENT_BUS_URL is required for AI usage fact-sink")?;
        let bus = Arc::new(
            KafkaEventBus::connect(event_config, "wakaclock-ai-usage-ingest")
                .map_err(|error| anyhow::anyhow!(error.to_string()))?,
        );
        let consumer = KafkaEventConsumer::connect(
            event_config,
            "wakaclock-ai-usage-ingest",
            "wakaclock.ai-usage.fact-sink",
            EventTopic::AiUsage,
            bus.clone(),
        )
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;

        let ready = Arc::new(AtomicBool::new(true));
        let assigned = consumer.assignment_flag();
        let health_ready = ready.clone();
        let health_assigned = assigned.clone();
        let health_host =
            std::env::var("KAFKA_CONSUMER_HEALTH_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let health_port = std::env::var("AI_USAGE_CONSUMER_HEALTH_PORT")
            .unwrap_or_else(|_| "8084".to_string())
            .parse::<u16>()
            .context("AI_USAGE_CONSUMER_HEALTH_PORT must be a port")?;
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
                            global_kafka_metrics().render_prometheus("ai-usage-fact-sink"),
                        )
                    }),
                )
                .route(
                    "/ready",
                    get(move || {
                        let ready = health_ready.clone();
                        let assigned = health_assigned.clone();
                        async move {
                            if ready.load(Ordering::Acquire) && assigned.load(Ordering::Acquire) {
                                axum::http::StatusCode::OK
                            } else {
                                axum::http::StatusCode::SERVICE_UNAVAILABLE
                            }
                        }
                    }),
                );
            let Ok(listener) = TcpListener::bind((health_host.as_str(), health_port)).await else {
                return;
            };
            let _ = axum::serve(listener, app).await;
        });

        let mut retry_delay = state.config.brokers.ai_usage.retry_min;
        let shutdown = tokio::signal::ctrl_c();
        tokio::pin!(shutdown);
        let result = loop {
            tokio::select! {
                _ = &mut shutdown => break Ok(()),
                batch = consumer.poll_batch(
                    state.config.brokers.ai_usage.batch_size,
                    state.config.brokers.ai_usage.batch_wait,
                ) => {
                    let batch = match batch {
                        Ok(batch) => batch,
                        Err(error) => {
                            tracing::warn!(%error, backoff_ms = retry_delay.as_millis(), "AI usage consumer poll failed");
                            tokio::time::sleep(retry_delay).await;
                            retry_delay = (retry_delay * 2).min(state.config.brokers.ai_usage.retry_max);
                            continue;
                        }
                    };
                    if batch.is_empty() { continue; }
                    let outcome = match process_batch(&state, &bus, batch).await {
                        Ok(outcome) => outcome,
                        Err(error) => {
                            tracing::warn!(%error, "AI usage fact-sink batch failed");
                            tokio::time::sleep(retry_delay).await;
                            retry_delay = (retry_delay * 2).min(state.config.brokers.ai_usage.retry_max);
                            continue;
                        }
                    };
                    if !outcome.committed.is_empty() {
                        if let Err(error) = consumer.commit(&outcome.committed).await {
                            tracing::warn!(%error, "AI usage offset commit failed; offsets remain replayable");
                            tokio::time::sleep(retry_delay).await;
                            retry_delay = (retry_delay * 2).min(state.config.brokers.ai_usage.retry_max);
                            continue;
                        }
                    }
                    if !outcome.retry_partitions.is_empty() {
                        consumer.mark_retry_partitions(&outcome.retry_partitions).await;
                        let offsets = outcome.retry_offsets.iter().map(|(p, o)| (*p, *o)).collect::<Vec<_>>();
                        if let Err(error) = consumer.seek_to_offsets(&offsets) {
                            tracing::warn!(%error, "could not rewind AI usage retry partitions");
                        }
                        let _ = consumer.pause_partitions(&outcome.retry_partitions);
                        tokio::time::sleep(retry_delay).await;
                        let _ = consumer.resume_partitions(&outcome.retry_partitions);
                        retry_delay = (retry_delay * 2).min(state.config.brokers.ai_usage.retry_max);
                    } else {
                        let committed_partitions = outcome.committed.iter().map(|delivery| delivery.partition).collect::<std::collections::BTreeSet<_>>();
                        consumer.clear_retry_partitions(&committed_partitions).await;
                        retry_delay = state.config.brokers.ai_usage.retry_min;
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
    anyhow::bail!("ai-usage-ingest requires the `kafka` feature")
}
