//! Shadow verifier for `ATOAXIS_AI_USAGE_INGEST_MODE=verify` (K5.5).

#[cfg(feature = "kafka")]
mod enabled {
    use anyhow::{Context, Result};
    use axum::{routing::get, Router};
    use futures::{stream, StreamExt};
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
    use wakaclock_server::{
        config::parse_positive_port, services::background_worker::shutdown_signal,
    };

    const VERIFY_DEADLINES: [Duration; 4] = [
        Duration::from_secs(3),
        Duration::from_secs(5),
        Duration::from_secs(15),
        Duration::from_secs(60),
    ];
    const VERIFY_CONCURRENCY: usize = 16;

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
        let health_state = state.clone();
        let health_live = live.clone();
        let health_server_live = live.clone();
        let health_assigned = assigned.clone();
        let host =
            std::env::var("KAFKA_CONSUMER_HEALTH_HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = parse_positive_port(
            std::env::var("AI_USAGE_VERIFIER_HEALTH_PORT").ok(),
            "AI_USAGE_VERIFIER_HEALTH_PORT",
            8086,
        )?;
        let health_listener = TcpListener::bind((host.as_str(), port))
            .await
            .context("AI usage verifier health listener failed")?;
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
                        let state = health_state.clone();
                        let live = health_live.clone();
                        let assigned = health_assigned.clone();
                        async move {
                            let postgres_ok = match &state.postgres {
                                Some(postgres) => postgres.health_check().await.is_ok(),
                                None => false,
                            };
                            let clickhouse_ok = state.clickhouse.health_check().await.is_ok();
                            if live.load(Ordering::Acquire)
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
                health_server_live.store(false, Ordering::Release);
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
                            tracing::warn!("AI usage verifier poll failed");
                            // Recreate the consumer on poll failure: a partial
                            // poll may have moved the local position past an
                            // uncommitted event.
                            break Err(anyhow::anyhow!("AI usage verifier poll failed"));
                        }
                    };
                    if batch.is_empty() { continue; }
                    let (committed, retry_offsets) = match verify_batch(&state, &bus, &batch).await {
                        Ok(result) => result,
                        Err(_) => {
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
                            if consumer.seek_to_offsets(&offsets).is_err() {
                                tracing::warn!("could not rewind verifier batch after audit failure");
                                break Err(anyhow::anyhow!("AI usage verifier rewind failed"));
                            }
                            if consumer.pause_partitions(&partitions).is_err() {
                                tracing::warn!("could not pause verifier partitions after audit failure");
                                break Err(anyhow::anyhow!("AI usage verifier pause failed"));
                            }
                            tracing::warn!(backoff_ms = retry_delay.as_millis(), "AI usage verification batch failed; offsets remain uncommitted");
                            tokio::time::sleep(retry_delay).await;
                            if consumer.resume_partitions(&partitions).is_err() {
                                tracing::warn!("could not resume verifier partitions after audit failure");
                                break Err(anyhow::anyhow!("AI usage verifier resume failed"));
                            }
                            retry_delay = (retry_delay * 2).min(state.config.brokers.ai_usage.retry_max);
                            continue;
                        }
                    };
                    if !committed.is_empty()
                        && consumer.commit(&committed).await.is_err()
                    {
                        tracing::warn!("AI usage verifier commit failed");
                        break Err(anyhow::anyhow!("AI usage verifier offset commit failed"));
                    }
                    if !retry_offsets.is_empty() {
                        let partitions = retry_offsets.keys().copied().collect::<BTreeSet<_>>();
                        consumer.mark_retry_partitions(&partitions).await;
                        let offsets = retry_offsets.iter().map(|(p, o)| (*p, *o)).collect::<Vec<_>>();
                        if consumer.seek_to_offsets(&offsets).is_err() {
                            tracing::warn!("could not rewind verifier retry partitions");
                            break Err(anyhow::anyhow!("AI usage verifier retry rewind failed"));
                        }
                        if consumer.pause_partitions(&partitions).is_err() {
                            tracing::warn!("could not pause verifier retry partitions");
                            break Err(anyhow::anyhow!("AI usage verifier retry pause failed"));
                        }
                        tokio::time::sleep(retry_delay).await;
                        if consumer.resume_partitions(&partitions).is_err() {
                            tracing::warn!("could not resume verifier retry partitions");
                            break Err(anyhow::anyhow!("AI usage verifier retry resume failed"));
                        }
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

    enum VerificationOutcome {
        Committed(EventDelivery),
        Retry(EventDelivery),
    }

    async fn verify_batch(
        state: &wakaclock_server::infrastructure::app::AppState,
        bus: &Arc<KafkaEventBus>,
        batch: &[EventDelivery],
    ) -> Result<(Vec<EventDelivery>, BTreeMap<i32, i64>)> {
        // Waiting for one event's 60-second deadline must not block every other
        // record in the poll. Bound concurrency to protect ClickHouse while still
        // allowing a full batch to make progress within the same deadlines.
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

    async fn verify_delivery(
        state: &wakaclock_server::infrastructure::app::AppState,
        bus: &Arc<KafkaEventBus>,
        delivery: EventDelivery,
    ) -> VerificationOutcome {
        let event = match serde_json::from_value::<AiUsageEventV1>(delivery.event.payload.clone()) {
            Ok(event) => event,
            Err(_) => {
                return if publish_dlq(bus, &delivery, "invalid_ai_usage_payload").await {
                    VerificationOutcome::Committed(delivery)
                } else {
                    VerificationOutcome::Retry(delivery)
                };
            }
        };
        if let Err(error) = event.validate_envelope(&delivery.event) {
            let category = if error.to_string().contains("identity") {
                "usage_identity_conflict"
            } else {
                "invalid_ai_usage_envelope"
            };
            return if publish_dlq(bus, &delivery, category).await {
                VerificationOutcome::Committed(delivery)
            } else {
                VerificationOutcome::Retry(delivery)
            };
        }

        let user_id = delivery.event.tenant_id;
        let mut row = None;
        let mut final_missing = false;
        let mut mismatch_flags = Vec::new();
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
                    let flags = match compare(&event, &found) {
                        Ok(flags) => flags,
                        Err(_) => return VerificationOutcome::Retry(delivery),
                    };
                    row = Some(found);
                    if flags.is_empty() {
                        mismatch_flags.clear();
                        break;
                    }
                    // A read can observe an older ClickHouse replacement while
                    // the direct writer/fact-sink path is still converging. Keep
                    // the latest mismatch and give the remaining absolute
                    // deadlines a chance to observe the authoritative row.
                    mismatch_flags = flags;
                }
                Ok(None) if deadline_index + 1 < VERIFY_DEADLINES.len() => {}
                Ok(None) => {
                    // If an earlier read found a mismatching row, preserve that
                    // evidence rather than downgrading it to "missing" because a
                    // later eventually-consistent read returned no row.
                    final_missing = row.is_none();
                    break;
                }
                Err(_) => return VerificationOutcome::Retry(delivery),
            }
        }
        if row.is_none() {
            if final_missing {
                let flags = ["missing_fact"];
                if write_audit(
                    state,
                    &event,
                    delivery.event.tenant_id,
                    delivery.event.received_at,
                    "missing_fact",
                    &flags,
                )
                .await
                .is_err()
                {
                    return VerificationOutcome::Retry(delivery);
                }
                global_kafka_metrics()
                    .verification_mismatch_total
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            }
            return VerificationOutcome::Committed(delivery);
        }
        let category = if mismatch_flags.is_empty() {
            "match"
        } else {
            "field_mismatch"
        };
        if write_audit(
            state,
            &event,
            delivery.event.tenant_id,
            delivery.event.received_at,
            category,
            &mismatch_flags,
        )
        .await
        .is_err()
        {
            return VerificationOutcome::Retry(delivery);
        }
        if !mismatch_flags.is_empty() {
            global_kafka_metrics()
                .verification_mismatch_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        }
        VerificationOutcome::Committed(delivery)
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
        tenant_id: uuid::Uuid,
        received_at: chrono::DateTime<chrono::Utc>,
        category: &str,
        flags: &[&str],
    ) -> Result<()> {
        state
            .ai_usage_repo
            .insert_verification_audit(
                state.postgres.as_ref().context("PostgreSQL is required")?,
                &usage_id_hash(event),
                &usage_identity_hash(tenant_id, &event.record.usage_event_id),
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

    fn usage_identity_hash(tenant_id: uuid::Uuid, usage_event_id: &str) -> String {
        let mut input = Vec::with_capacity(16 + usage_event_id.len() + 32);
        input.extend_from_slice(b"ai-usage-verification:v1\0");
        input.extend_from_slice(&(tenant_id.as_bytes().len() as u64).to_be_bytes());
        input.extend_from_slice(tenant_id.as_bytes());
        input.extend_from_slice(&(usage_event_id.len() as u64).to_be_bytes());
        input.extend_from_slice(usage_event_id.as_bytes());
        let digest = Sha256::digest(input);
        format!("{digest:x}")
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
        let result = bus.publish(EventTopic::IngestDeadLetter, &envelope).await;
        if result.is_ok() {
            global_kafka_metrics()
                .dlq_total
                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            global_kafka_metrics().increment_category("dlq", category);
        }
        result.is_ok()
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn verification_identity_hash_is_tenant_scoped_and_stable() {
            let tenant_a = uuid::Uuid::from_u128(1);
            let tenant_b = uuid::Uuid::from_u128(2);
            assert_eq!(
                usage_identity_hash(tenant_a, "event"),
                usage_identity_hash(tenant_a, "event")
            );
            assert_ne!(
                usage_identity_hash(tenant_a, "event"),
                usage_identity_hash(tenant_b, "event")
            );
            assert_ne!(
                usage_identity_hash(tenant_a, "ab"),
                usage_identity_hash(tenant_a, "a")
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
    anyhow::bail!("ai-usage-verifier requires the `kafka` feature")
}
