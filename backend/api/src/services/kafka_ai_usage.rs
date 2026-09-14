//! Kafka AI-usage fact-sink (K5.3/K5.4).
//!
//! This consumer owns the durable ordering boundary:
//!
//! ```text
//! ClickHouse fact -> PostgreSQL reconcile job/outbox -> Kafka offset commit
//! ```
//!
//! Session projection is never refreshed inline here. A replay after a crash is
//! therefore safe: the fact writer deduplicates stable usage identities and the
//! job service deduplicates the session batch key.

use anyhow::Result;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;

use crate::infrastructure::app::AppState;
use crate::infrastructure::contracts::{
    AiUsageEventV1, EventBus, EventDelivery, EventEnvelope, EventTopic, JobKind, StableEventId,
};
use crate::infrastructure::kafka::KafkaEventBus;
use crate::infrastructure::metrics::global_kafka_metrics;

#[derive(Debug, Default)]
pub struct BatchOutcome {
    pub committed: Vec<EventDelivery>,
    pub retry_partitions: BTreeSet<i32>,
    pub retry_offsets: BTreeMap<i32, i64>,
    pub inserted: usize,
    pub deduplicated: usize,
    pub jobs_created: usize,
    pub permanent_failures: usize,
}

struct ValidUsage {
    delivery: EventDelivery,
    event: AiUsageEventV1,
}

/// Validate the complete batch first, then process each partition/session group.
/// A transient failure blocks only that partition and records its first offset so
/// the caller can rewind exactly the uncommitted suffix.
pub async fn process_batch(
    state: &Arc<AppState>,
    bus: &Arc<KafkaEventBus>,
    deliveries: Vec<EventDelivery>,
) -> Result<BatchOutcome> {
    let mut outcome = BatchOutcome::default();
    let mut blocked = BTreeSet::new();
    let mut valid: BTreeMap<(i32, uuid::Uuid, String), Vec<ValidUsage>> = BTreeMap::new();
    let mut invalid = Vec::new();

    for delivery in deliveries {
        match serde_json::from_value::<AiUsageEventV1>(delivery.event.payload.clone()) {
            Ok(event) => {
                if let Err(error) = event.validate_envelope(&delivery.event) {
                    invalid.push((delivery, "usage_identity_conflict", error.to_string()));
                } else {
                    valid
                        .entry((
                            delivery.partition,
                            delivery.event.tenant_id,
                            event.record.ai_session_id.clone(),
                        ))
                        .or_default()
                        .push(ValidUsage { delivery, event });
                }
            }
            Err(error) => invalid.push((delivery, "invalid_ai_usage_payload", error.to_string())),
        }
    }

    // Invalid records are permanent only after their metadata-only DLQ event is
    // durable. If DLQ publishing is down, leave the source offset uncommitted.
    invalid.sort_by_key(|(delivery, _, _)| (delivery.partition, delivery.offset));
    for (delivery, category, error) in invalid {
        if blocked.contains(&delivery.partition) {
            continue;
        }
        if publish_dlq(bus, &delivery, category).await {
            outcome.committed.push(delivery);
            outcome.permanent_failures += 1;
            tracing::warn!(%error, "AI usage event sent to DLQ");
        } else {
            block_partition(&mut outcome, &mut blocked, &delivery);
        }
    }

    for ((partition, user_id, session_id), mut group) in valid {
        if blocked.contains(&partition) {
            continue;
        }
        group.sort_by_key(|item| item.delivery.offset);
        let records: Vec<_> = group.iter().map(|item| item.event.record.clone()).collect();
        let started = std::time::Instant::now();
        let facts = match state
            .ai_usage_service
            .ingest_facts(user_id, records.clone())
            .await
        {
            Ok(facts) => facts,
            Err(error) if permanent_fact_error(&error) => {
                // A conflicting identity must not discard the other valid facts in
                // the same session batch. Split only this exceptional group into
                // single-event attempts, DLQ'ing the conflicting identity while
                // retaining the normal batch path for the common case.
                tracing::warn!(%error, "AI usage batch contains a permanent identity conflict");
                for item in group {
                    let event_id = item.delivery.event.event_id.as_str().to_string();
                    let item_session_id = item.event.record.ai_session_id.clone();
                    let started = std::time::Instant::now();
                    let single = state
                        .ai_usage_service
                        .ingest_facts(user_id, vec![item.event.record.clone()])
                        .await;
                    let facts = match single {
                        Ok(facts) => facts,
                        Err(error) if permanent_fact_error(&error) => {
                            if publish_dlq(bus, &item.delivery, "usage_identity_conflict").await {
                                outcome.committed.push(item.delivery);
                                outcome.permanent_failures += 1;
                                continue;
                            }
                            block_partition(&mut outcome, &mut blocked, &item.delivery);
                            tracing::warn!(%error, "AI usage identity conflict could not reach DLQ");
                            break;
                        }
                        Err(error) => {
                            block_partition(&mut outcome, &mut blocked, &item.delivery);
                            global_kafka_metrics()
                                .retries_total
                                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                            tracing::warn!(%error, "AI usage single-event fact retry required");
                            break;
                        }
                    };
                    global_kafka_metrics().observe_insert(
                        started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64,
                    );
                    global_kafka_metrics()
                        .observe_end_to_end_delay(item.delivery.event.received_at);
                    outcome.inserted += facts.report.stored;
                    outcome.deduplicated += 1usize.saturating_sub(facts.report.stored);
                    if facts.report.stored == 0 {
                        global_kafka_metrics()
                            .deduplicated_total
                            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    }
                    let event_ids = vec![event_id];
                    match create_reconcile_job(state, user_id, &item_session_id, &event_ids).await {
                        Ok(created) => {
                            if created {
                                outcome.jobs_created += 1;
                            }
                            outcome.committed.push(item.delivery);
                        }
                        Err(error) => {
                            block_partition(&mut outcome, &mut blocked, &item.delivery);
                            global_kafka_metrics()
                                .retries_total
                                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                            tracing::warn!(%error, "AI usage single-event job/outbox failed");
                            break;
                        }
                    }
                }
                continue;
            }
            Err(error) => {
                let first = group.first().expect("non-empty usage group");
                block_partition(&mut outcome, &mut blocked, &first.delivery);
                global_kafka_metrics()
                    .retries_total
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                tracing::warn!(%error, "AI usage fact-sink transient failure");
                continue;
            }
        };
        global_kafka_metrics()
            .observe_insert(started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64);
        for item in &group {
            global_kafka_metrics().observe_end_to_end_delay(item.delivery.event.received_at);
        }
        outcome.inserted += facts.report.stored;
        outcome.deduplicated += group.len().saturating_sub(facts.report.stored);
        global_kafka_metrics().deduplicated_total.fetch_add(
            group.len().saturating_sub(facts.report.stored) as u64,
            std::sync::atomic::Ordering::Relaxed,
        );

        // The parameters deliberately contain only the schema version and session
        // id. The worker reads authoritative facts from ClickHouse.
        let event_ids = sorted_event_ids(&group);
        match create_reconcile_job(state, user_id, &session_id, &event_ids).await {
            Ok(created) => {
                if created {
                    outcome.jobs_created += 1;
                }
                for item in group {
                    outcome.committed.push(item.delivery);
                }
            }
            Err(error) => {
                let first = group.first().expect("non-empty usage group");
                block_partition(&mut outcome, &mut blocked, &first.delivery);
                global_kafka_metrics()
                    .retries_total
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                tracing::warn!(%error, "AI usage reconcile job/outbox failed; offset remains uncommitted");
            }
        }
    }

    // Kafka commits are partition watermarks, so never return a successful
    // delivery at or after the first retry offset. This matters because groups
    // are keyed by session rather than offset and may have been processed out of
    // source order within one poll batch.
    outcome.committed.retain(|delivery| {
        outcome
            .retry_offsets
            .get(&delivery.partition)
            .is_none_or(|first_retry| delivery.offset < *first_retry)
    });

    Ok(outcome)
}

fn sorted_event_ids(group: &[ValidUsage]) -> Vec<String> {
    let ids: BTreeSet<String> = group
        .iter()
        .map(|item| item.delivery.event.event_id.as_str().to_string())
        .collect();
    ids.into_iter().collect()
}

fn session_job_key(user_id: uuid::Uuid, session_id: &str, event_ids: &[String]) -> String {
    let mut input = format!("{user_id}{session_id}");
    for event_id in event_ids {
        input.push_str(event_id);
    }
    let digest = Sha256::digest(input.as_bytes());
    format!("ai-session-reconcile:v1:{digest:x}")
}

async fn create_reconcile_job(
    state: &Arc<AppState>,
    user_id: uuid::Uuid,
    session_id: &str,
    event_ids: &[String],
) -> Result<bool> {
    let idempotency_key = session_job_key(user_id, session_id, event_ids);
    let params = serde_json::json!({
        "schema_version": 1,
        "ai_session_id": session_id,
    });
    let created = state
        .job_service
        .create(
            Some(user_id),
            JobKind::AiSessionReconcile,
            params,
            Some(&idempotency_key),
        )
        .await?;
    global_kafka_metrics().increment_category(
        "ai_session_job",
        if created.deduplicated {
            "deduplicated"
        } else {
            "created"
        },
    );
    Ok(!created.deduplicated)
}

fn permanent_fact_error(error: &anyhow::Error) -> bool {
    error.to_string().contains("usage_identity_conflict")
}

fn block_partition(
    outcome: &mut BatchOutcome,
    blocked: &mut BTreeSet<i32>,
    delivery: &EventDelivery,
) {
    blocked.insert(delivery.partition);
    outcome.retry_partitions.insert(delivery.partition);
    outcome
        .retry_offsets
        .entry(delivery.partition)
        .or_insert(delivery.offset);
}

async fn publish_dlq(
    bus: &KafkaEventBus,
    delivery: &EventDelivery,
    category: &'static str,
) -> bool {
    let Ok(event_id) = StableEventId::heartbeat(
        &format!("usage-dlq:{}:{}", delivery.partition, delivery.offset),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_job_key_is_stable_and_ordered_by_sorted_event_ids() {
        let user_id = uuid::Uuid::parse_str("0190f3a1-0000-7000-8000-000000000001")
            .expect("valid test tenant");
        let first = session_job_key(
            user_id,
            "session-1",
            &["event-a".to_string(), "event-b".to_string()],
        );
        let replay = session_job_key(
            user_id,
            "session-1",
            &["event-a".to_string(), "event-b".to_string()],
        );
        let changed = session_job_key(
            user_id,
            "session-1",
            &["event-a".to_string(), "event-c".to_string()],
        );
        assert_eq!(first, replay);
        assert_ne!(first, changed);
        assert!(first.starts_with("ai-session-reconcile:v1:"));
    }

    #[test]
    fn identity_conflicts_are_the_only_permanent_fact_error_category() {
        assert!(permanent_fact_error(&anyhow::anyhow!(
            "usage_identity_conflict for usage_event_id x"
        )));
        assert!(!permanent_fact_error(&anyhow::anyhow!(
            "ClickHouse unavailable"
        )));
    }
}
