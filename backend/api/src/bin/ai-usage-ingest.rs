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
    use wakaclock_server::{
        config::parse_positive_port, services::background_worker::shutdown_signal,
    };

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
        let health_state = state.clone();
        let health_ready = ready.clone();
        let health_server_ready = ready.clone();
        let health_assigned = assigned.clone();
        let health_host =
            std::env::var("KAFKA_CONSUMER_HEALTH_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let health_port = parse_positive_port(
            std::env::var("AI_USAGE_CONSUMER_HEALTH_PORT").ok(),
            "AI_USAGE_CONSUMER_HEALTH_PORT",
            8084,
        )?;
        let health_listener = TcpListener::bind((health_host.as_str(), health_port))
            .await
            .context("AI usage fact-sink health listener failed")?;
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
                        let state = health_state.clone();
                        let ready = health_ready.clone();
                        let assigned = health_assigned.clone();
                        async move {
                            let postgres_ok = match &state.postgres {
                                Some(postgres) => postgres.health_check().await.is_ok(),
                                None => false,
                            };
                            let clickhouse_ok = state.clickhouse.health_check().await.is_ok();
                            if ready.load(Ordering::Acquire)
                                && assigned.load(Ordering::Acquire)
                                && postgres_ok
                                && clickhouse_ok
                            {
                                axum::http::StatusCode::OK
                            } else {
                                axum::http::StatusCode::SERVICE_UNAVAILABLE
                            }
                        }
                    }),
                );
            if axum::serve(health_listener, app).await.is_err() {
                health_server_ready.store(false, Ordering::Release);
            }
        });

        let mut retry_delay = state.config.brokers.ai_usage.retry_min;
        let shutdown = shutdown_signal();
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
                        Err(_) => {
                            tracing::warn!(backoff_ms = retry_delay.as_millis(), "AI usage consumer poll failed");
                            // `poll_batch` may already have advanced the local
                            // librdkafka position before an invalid/DLQ or recv
                            // error. Reusing this consumer could commit past a
                            // record that was never handed to the fact writer.
                            break Err(anyhow::anyhow!("AI usage consumer poll failed"));
                        }
                    };
                    if batch.is_empty() { continue; }
                    let outcome = match process_batch(&state, &bus, batch).await {
                        Ok(outcome) => outcome,
                        Err(_) => {
                            tracing::warn!("AI usage fact-sink batch failed");
                            // `poll_batch` has already advanced librdkafka's local
                            // position. Re-polling after an unexpected processor
                            // error could therefore commit past an unprocessed record;
                            // let the supervisor recreate the consumer group instead.
                            break Err(anyhow::anyhow!("AI usage fact-sink batch processing failed"));
                        }
                    };
                    if !outcome.committed.is_empty()
                        && consumer.commit(&outcome.committed).await.is_err()
                    {
                        tracing::warn!("AI usage offset commit failed; offsets remain replayable");
                        // A commit may have partially succeeded per partition.
                        // The retry watermark alone is not safe in that case,
                        // because the successful prefix may also remain
                        // uncommitted. Stop and reconnect so Kafka restores the
                        // last durable group offsets before any further poll.
                        break Err(anyhow::anyhow!("AI usage offset commit failed"));
                    }
                    if !outcome.retry_partitions.is_empty() {
                        consumer.mark_retry_partitions(&outcome.retry_partitions).await;
                        let offsets = outcome.retry_offsets.iter().map(|(p, o)| (*p, *o)).collect::<Vec<_>>();
                        if consumer.seek_to_offsets(&offsets).is_err() {
                            tracing::warn!("could not rewind AI usage retry partitions");
                            break Err(anyhow::anyhow!("AI usage retry rewind failed"));
                        }
                        if consumer.pause_partitions(&outcome.retry_partitions).is_err() {
                            tracing::warn!("could not pause AI usage retry partitions");
                            break Err(anyhow::anyhow!("AI usage retry pause failed"));
                        }
                        tokio::time::sleep(retry_delay).await;
                        if consumer.resume_partitions(&outcome.retry_partitions).is_err() {
                            tracing::warn!("could not resume AI usage retry partitions");
                            break Err(anyhow::anyhow!("AI usage retry resume failed"));
                        }
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
