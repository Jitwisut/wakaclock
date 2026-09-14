//! Shadow verifier for `ATOAXIS_AI_USAGE_INGEST_MODE=verify` (K5.5).

#[cfg(feature = "kafka")]
mod enabled {
    use anyhow::{Context, Result};
    use axum::{routing::get, Router};
    use sha2::{Digest, Sha256};
    use std::collections::{BTreeMap, BTreeSet};
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };
    use std::time::Duration;
    use tokio::net::TcpListener;

    use wakaclock_server::config::brokers::IngestMode;
    use wakaclock_server::infrastructure::app::create_app_state;
    use wakaclock_server::infrastructure::contracts::{
        AiUsageEventV1, EventBus, EventConsumer, EventDelivery, EventEnvelope, EventTopic,
        StableEventId,
    };
    use wakaclock_server::infrastructure::kafka::{KafkaEventBus, KafkaEventConsumer};
    use wakaclock_server::infrastructure::metrics::global_kafka_metrics;

    const VERIFY_DEADLINES: [Duration; 4] = [
        Duration::from_secs(3),
        Duration::from_secs(5),
        Duration::from_secs(15),
        Duration::from_secs(60),
    ];

    pub async fn run() -> Result<()> {
        let state = Arc::new(
            create_app_state()
                .await
                .context("initialize AI usage verifier state")?,
        );
        if state.config.brokers.ai_usage.mode != IngestMode::Verify {
            anyhow::bail!("ai-usage-verifier requires ATOAXIS_AI_USAGE_INGEST_MODE=verify");
        }
        let postgres = state
            .postgres
            .clone()
            .context("AI usage verifier requires POSTGRES_URL")?;
        postgres.migrate().await?;
        state.ai_usage_repo.migrate().await?;
        let event_config = state
            .config
            .brokers
            .event_bus
            .as_ref()
            .context("ATOAXIS_EVENT_BUS_URL is required for AI usage verifier")?;
        let bus = Arc::new(
            KafkaEventBus::connect(event_config, "wakaclock-ai-usage-verifier")
                .map_err(|error| anyhow::anyhow!(error.to_string()))?,
        );
        let consumer = KafkaEventConsumer::connect(
            event_config,
            "wakaclock-ai-usage-verifier",
            "wakaclock.ai-usage.verifier",
            EventTopic::AiUsage,
            bus.clone(),
        )
        .map_err(|error| anyhow::anyhow!(error.to_string()))?;

        let live = Arc::new(AtomicBool::new(true));
        let assigned = consumer.assignment_flag();
        let health_live = live.clone();
        let health_assigned = assigned.clone();
        let host =
            std::env::var("KAFKA_CONSUMER_HEALTH_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = std::env::var("AI_USAGE_VERIFIER_HEALTH_PORT")
            .unwrap_or_else(|_| "8086".to_string())
            .parse::<u16>()
            .context("AI_USAGE_VERIFIER_HEALTH_PORT must be a port")?;
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
                            global_kafka_metrics().render_prometheus("ai-usage-verifier"),
                        )
                    }),
                )
                .route(
                    "/ready",
                    get(move || {
                        let live = health_live.clone();
                        let assigned = health_assigned.clone();
                        async move {
                            if live.load(Ordering::Acquire) && assigned.load(Ordering::Acquire) {
                                axum::http::StatusCode::OK
                            } else {
                                axum::http::StatusCode::SERVICE_UNAVAILABLE
                            }
                        }
                    }),
                );
            let Ok(listener) = TcpListener::bind((host.as_str(), port)).await else {
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
                            tracing::warn!(%error, "AI usage verifier poll failed");
                            tokio::time::sleep(retry_delay).await;
                            retry_delay = (retry_delay * 2).min(state.config.brokers.ai_usage.retry_max);
                            continue;
                        }
                    };
                    if batch.is_empty() { continue; }
                    let (committed, retry_offsets) = match verify_batch(&state, &bus, &batch).await {
                        Ok(result) => result,
                        Err(error) => {
                            // An audit write is part of the verifier's durable side effect.
                            // Keep the process healthy during a PostgreSQL outage, but rewind
                            // every partition in this poll so no later record can move past the
                            // failed audit. The source offset remains uncommitted and the next
                            // attempt is therefore a replay, not a loss.
                            let retry_offsets = first_offsets(&batch);
                            let partitions = retry_offsets.keys().copied().collect::<BTreeSet<_>>();
                            consumer.mark_retry_partitions(&partitions).await;
                            let offsets = retry_offsets
                                .iter()
                                .map(|(partition, offset)| (*partition, *offset))
                                .collect::<Vec<_>>();
                            if let Err(seek_error) = consumer.seek_to_offsets(&offsets) {
                                tracing::warn!(%seek_error, "could not rewind verifier batch after audit failure");
                            }
                            let _ = consumer.pause_partitions(&partitions);
                            tracing::warn!(%error, backoff_ms = retry_delay.as_millis(), "AI usage verification batch failed; offsets remain uncommitted");
                            tokio::time::sleep(retry_delay).await;
                            let _ = consumer.resume_partitions(&partitions);
                            retry_delay = (retry_delay * 2).min(state.config.brokers.ai_usage.retry_max);
                            continue;
                        }
                    };
                    if !committed.is_empty() {
                        if let Err(error) = consumer.commit(&committed).await {
                            tracing::warn!(%error, "AI usage verifier commit failed");
                            continue;
                        }
                    }
                    if !retry_offsets.is_empty() {
                        let partitions = retry_offsets.keys().copied().collect::<BTreeSet<_>>();
                        consumer.mark_retry_partitions(&partitions).await;
                        let offsets = retry_offsets.iter().map(|(p, o)| (*p, *o)).collect::<Vec<_>>();
                        let _ = consumer.seek_to_offsets(&offsets);
                        let _ = consumer.pause_partitions(&partitions);
                        tokio::time::sleep(retry_delay).await;
                        let _ = consumer.resume_partitions(&partitions);
                        retry_delay = (retry_delay * 2).min(state.config.brokers.ai_usage.retry_max);
                    } else {
                        let partitions = committed.iter().map(|delivery| delivery.partition).collect::<BTreeSet<_>>();
                        consumer.clear_retry_partitions(&partitions).await;
                        retry_delay = state.config.brokers.ai_usage.retry_min;
                    }
                }
            }
        };
        live.store(false, Ordering::Release);
        health.abort();
        result
    }

    async fn verify_batch(
        state: &wakaclock_server::infrastructure::app::AppState,
        bus: &Arc<KafkaEventBus>,
        batch: &[EventDelivery],
    ) -> Result<(Vec<EventDelivery>, BTreeMap<i32, i64>)> {
        let mut committed = Vec::new();
        let mut retry_offsets = BTreeMap::new();
        let mut sorted = batch.to_vec();
        sorted.sort_by_key(|delivery| (delivery.partition, delivery.offset));
        for delivery in sorted {
            let event =
                match serde_json::from_value::<AiUsageEventV1>(delivery.event.payload.clone()) {
                    Ok(event) => event,
                    Err(_) => {
                        if publish_dlq(bus, &delivery, "invalid_ai_usage_payload").await {
                            committed.push(delivery);
                        } else {
                            retry_offsets
                                .entry(delivery.partition)
                                .or_insert(delivery.offset);
                        }
                        continue;
                    }
                };
            if event.validate_envelope(&delivery.event).is_err() {
                if publish_dlq(bus, &delivery, "usage_identity_conflict").await {
                    committed.push(delivery);
                } else {
                    retry_offsets
                        .entry(delivery.partition)
                        .or_insert(delivery.offset);
                }
                continue;
            }
            if retry_offsets.contains_key(&delivery.partition) {
                continue;
            }
            let user_id = delivery.event.tenant_id;
            let mut row = None;
            let mut final_missing = false;
            let mut query_failed = false;
            for (deadline_index, delay) in VERIFY_DEADLINES.iter().enumerate() {
                let deadline_at = delivery.event.received_at
                    + chrono::Duration::from_std(*delay)
                        .expect("verification deadline fits in chrono duration");
                if let Ok(wait) = (deadline_at - chrono::Utc::now()).to_std() {
                    if !wait.is_zero() {
                        tokio::time::sleep(wait).await;
                    }
                }

                match state
                    .ai_usage_repo
                    .find_event(user_id, &event.record.usage_event_id)
                    .await
                {
                    Ok(Some(found)) => {
                        row = Some(found);
                        break;
                    }
                    Ok(None) if deadline_index + 1 < VERIFY_DEADLINES.len() => {}
                    Ok(None) => {
                        final_missing = true;
                        break;
                    }
                    Err(error) => {
                        tracing::warn!(%error, "AI usage verifier query failed");
                        retry_offsets
                            .entry(delivery.partition)
                            .or_insert(delivery.offset);
                        query_failed = true;
                        break;
                    }
                }
            }
            if query_failed {
                break;
            }
            let Some(row) = row else {
                if final_missing {
                    let flags = ["missing_fact"];
                    write_audit(
                        state,
                        &event,
                        delivery.event.received_at,
                        "missing_fact",
                        &flags,
                    )
                    .await?;
                    global_kafka_metrics()
                        .verification_mismatch_total
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    committed.push(delivery);
                }
                continue;
            };
            let flags = compare(&event, &row)?;
            let category = if flags.is_empty() {
                "match"
            } else {
                "field_mismatch"
            };
            write_audit(state, &event, delivery.event.received_at, category, &flags).await?;
            if !flags.is_empty() {
                global_kafka_metrics()
                    .verification_mismatch_total
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            }
            committed.push(delivery);
        }
        let committed = committed
            .into_iter()
            .filter(|delivery| {
                retry_offsets
                    .get(&delivery.partition)
                    .is_none_or(|first_retry| delivery.offset < *first_retry)
            })
            .collect();
        Ok((committed, retry_offsets))
    }

    fn first_offsets(batch: &[EventDelivery]) -> BTreeMap<i32, i64> {
        let mut offsets: BTreeMap<i32, i64> = BTreeMap::new();
        for delivery in batch {
            offsets
                .entry(delivery.partition)
                .and_modify(|first| *first = (*first).min(delivery.offset))
                .or_insert(delivery.offset);
        }
        offsets
    }

    fn compare(
        event: &AiUsageEventV1,
        row: &wakaclock_server::model::ai_usage::AiUsageEventRow,
    ) -> Result<Vec<&'static str>> {
        let mut flags = Vec::new();
        if row.event_payload_hash.as_deref() != Some(event.payload_hash()?.as_str()) {
            // Legacy rows have no hash; they are visible as a compatibility flag
            // rather than overwritten by the verifier.
            if row.event_payload_hash.is_some() {
                flags.push("payload_hash");
            }
        }
        if row.ai_session_id != event.record.ai_session_id {
            flags.push("session");
        }
        if row.event_time != event.record.occurred_at.timestamp().max(0) as u32 {
            flags.push("event_time");
        }
        if row.ai_agent != event.record.agent {
            flags.push("agent");
        }
        if row.ai_provider != event.record.provider {
            flags.push("provider");
        }
        if row.ai_model != event.record.model {
            flags.push("model");
        }
        if row.prompt_count != event.record.prompt_count {
            flags.push("prompt_count");
        }
        if row.prompt_character_count != event.record.prompt_character_count {
            flags.push("prompt_character_count");
        }
        if row.input_tokens != event.record.input_tokens {
            flags.push("input_tokens");
        }
        if row.output_tokens != event.record.output_tokens {
            flags.push("output_tokens");
        }
        if row.cache_read_tokens != event.record.cache_read_tokens {
            flags.push("cache_read_tokens");
        }
        if row.cache_write_tokens != event.record.cache_write_tokens {
            flags.push("cache_write_tokens");
        }
        if row.token_source != event.record.token_source.as_str() {
            flags.push("token_source");
        }
        Ok(flags)
    }

    async fn write_audit(
        state: &wakaclock_server::infrastructure::app::AppState,
        event: &AiUsageEventV1,
        received_at: chrono::DateTime<chrono::Utc>,
        category: &str,
        flags: &[&str],
    ) -> Result<()> {
        state
            .ai_usage_repo
            .insert_verification_audit(
                state.postgres.as_ref().context("PostgreSQL is required")?,
                &usage_id_hash(event),
                category,
                flags,
                received_at,
            )
            .await
    }

    fn usage_id_hash(event: &AiUsageEventV1) -> String {
        let digest = Sha256::digest(event.record.usage_event_id.as_bytes());
        format!("{digest:x}")
    }

    async fn publish_dlq(
        bus: &KafkaEventBus,
        delivery: &EventDelivery,
        category: &'static str,
    ) -> bool {
        let Ok(event_id) = StableEventId::heartbeat(
            &format!(
                "usage-verifier-dlq:{}:{}",
                delivery.partition, delivery.offset
            ),
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
        let result = bus.publish(EventTopic::IngestDeadLetter, &envelope).await;
        if result.is_ok() {
            global_kafka_metrics()
                .dlq_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            global_kafka_metrics().increment_category("dlq", category);
        }
        result.is_ok()
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
    anyhow::bail!("ai-usage-verifier requires the `kafka` feature")
}
