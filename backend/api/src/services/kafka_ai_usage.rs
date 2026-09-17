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

use anyhow::{Context, Result};
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
    pub tombstoned: usize,
}

struct ValidUsage {
    delivery: EventDelivery,
    event: AiUsageEventV1,
}

struct InvalidUsage {
    delivery: EventDelivery,
    category: &'static str,
}

enum UsageWork {
    Invalid(InvalidUsage),
    Group {
        partition: i32,
        user_id: uuid::Uuid,
        session_id: String,
        records: Vec<ValidUsage>,
    },
}

impl UsageWork {
    fn ordering_key(&self) -> (i32, i64) {
        match self {
            Self::Invalid(item) => (item.delivery.partition, item.delivery.offset),
            Self::Group {
                partition, records, ..
            } => (
                *partition,
                records
                    .first()
                    .expect("usage work group cannot be empty")
                    .delivery
                    .offset,
            ),
        }
    }
}

/// Validate the complete batch first, then process work items in source offset order.
/// A transient failure blocks only that partition and records its first offset so
/// the caller can rewind exactly the uncommitted suffix. A session group may contain
/// non-contiguous offsets, but its minimum offset determines where it is processed;
/// any later delivery from that group is retained below a retry watermark when needed.
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
            Ok(event) => match event.validate_envelope(&delivery.event) {
                Ok(()) => {
                    valid
                        .entry((
                            delivery.partition,
                            delivery.event.tenant_id,
                            event.record.ai_session_id.clone(),
                        ))
                        .or_default()
                        .push(ValidUsage { delivery, event });
                }
                Err(error) => invalid.push(InvalidUsage {
                    delivery,
                    category: usage_envelope_error_category(&error),
                }),
            },
            Err(_) => invalid.push(InvalidUsage {
                delivery,
                category: "invalid_ai_usage_payload",
            }),
        }
    }

    let mut work = Vec::with_capacity(valid.len() + invalid.len());
    work.extend(invalid.into_iter().map(UsageWork::Invalid));
    for ((partition, user_id, session_id), mut records) in valid {
        records.sort_by_key(|item| item.delivery.offset);
        work.push(UsageWork::Group {
            partition,
            user_id,
            session_id,
            records,
        });
    }
    work.sort_by_key(UsageWork::ordering_key);

    for work in work {
        let partition = work.ordering_key().0;
        if blocked.contains(&partition) {
            continue;
        }
        let UsageWork::Group {
            partition: _,
            user_id,
            session_id,
            mut records,
        } = work
        else {
            let UsageWork::Invalid(InvalidUsage { delivery, category }) = work else {
                unreachable!("usage work item was matched twice");
            };
            // Invalid records are permanent only after their metadata-only DLQ
            // event is durable. If DLQ publishing is down, leave the source offset
            // uncommitted and block the rest of this partition.
            if publish_dlq(bus, &delivery, category).await {
                outcome.committed.push(delivery);
                outcome.permanent_failures += 1;
            } else {
                block_partition(&mut outcome, &mut blocked, &delivery);
            }
            continue;
        };
        // `UsageWork::ordering_key` guarantees a non-empty group, and the sort above
        // guarantees that a failed record's minimum offset is the retry watermark.
        records.sort_by_key(|item| item.delivery.offset);
        let Some(postgres) = state.postgres.as_ref() else {
            let first = records.first().expect("non-empty usage group");
            block_partition(&mut outcome, &mut blocked, &first.delivery);
            tracing::warn!("AI usage fact-sink has no PostgreSQL account guard");
            continue;
        };
        // Keep the account activity lock until facts and the reconcile job are
        // both durable. This closes the race where deletion could purge
        // ClickHouse and then a consumer writes an old Kafka record afterward.
        let mut account_lock = match postgres.account_activity_lock(user_id).await {
            Ok(lock) => lock,
            Err(_) => {
                let first = records.first().expect("non-empty usage group");
                block_partition(&mut outcome, &mut blocked, &first.delivery);
                global_kafka_metrics()
                    .retries_total
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                tracing::warn!("AI usage fact-sink account guard failed");
                continue;
            }
        };
        let account_deleted = match postgres.is_account_deleted_on(&account_lock, user_id).await {
            Ok(deleted) => deleted,
            Err(_) => {
                let first = records.first().expect("non-empty usage group");
                block_partition(&mut outcome, &mut blocked, &first.delivery);
                global_kafka_metrics()
                    .retries_total
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                tracing::warn!("AI usage fact-sink account availability check failed");
                continue;
            }
        };
        if account_deleted {
            let mut dlq_failed = false;
            for item in records {
                if publish_dlq(bus, &item.delivery, "account_deleted").await {
                    outcome.committed.push(item.delivery);
                    outcome.tombstoned += 1;
                    global_kafka_metrics()
                        .tombstoned_total
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    global_kafka_metrics().increment_category("tombstone", "account_deleted");
                } else {
                    block_partition(&mut outcome, &mut blocked, &item.delivery);
                    dlq_failed = true;
                    break;
                }
            }
            if dlq_failed {
                continue;
            }
            continue;
        }
        let facts_input: Vec<_> = records
            .iter()
            .map(|item| item.event.record.clone())
            .collect();
        let started = std::time::Instant::now();
        let facts = match state
            .ai_usage_service
            .ingest_facts_on_account_lock(user_id, facts_input, &account_lock)
            .await
        {
            Ok(facts) => facts,
            Err(error) if permanent_fact_error(&error) => {
                // A conflicting identity must not discard the other valid facts in
                // the same session batch. Split only this exceptional group into
                // single-event attempts, DLQ'ing the conflicting identity while
                // retaining the normal batch path for the common case.
                for item in records {
                    let event_id = item.delivery.event.event_id.as_str().to_string();
                    let item_session_id = item.event.record.ai_session_id.clone();
                    let started = std::time::Instant::now();
                    let single = state
                        .ai_usage_service
                        .ingest_facts_on_account_lock(
                            user_id,
                            vec![item.event.record.clone()],
                            &account_lock,
                        )
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
                            break;
                        }
                        Err(_) => {
                            block_partition(&mut outcome, &mut blocked, &item.delivery);
                            global_kafka_metrics()
                                .retries_total
                                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
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
                    match create_reconcile_job(
                        user_id,
                        &item_session_id,
                        &event_ids,
                        &mut account_lock,
                    )
                    .await
                    {
                        Ok(created) => {
                            if created {
                                outcome.jobs_created += 1;
                            }
                            outcome.committed.push(item.delivery);
                        }
                        Err(_) => {
                            block_partition(&mut outcome, &mut blocked, &item.delivery);
                            global_kafka_metrics()
                                .retries_total
                                .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                            break;
                        }
                    }
                }
                continue;
            }
            Err(_) => {
                let first = records.first().expect("non-empty usage group");
                block_partition(&mut outcome, &mut blocked, &first.delivery);
                global_kafka_metrics()
                    .retries_total
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                continue;
            }
        };
        global_kafka_metrics()
            .observe_insert(started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64);
        for item in &records {
            global_kafka_metrics().observe_end_to_end_delay(item.delivery.event.received_at);
        }
        outcome.inserted += facts.report.stored;
        outcome.deduplicated += records.len().saturating_sub(facts.report.stored);
        global_kafka_metrics().deduplicated_total.fetch_add(
            records.len().saturating_sub(facts.report.stored) as u64,
            std::sync::atomic::Ordering::Relaxed,
        );

        // The parameters deliberately contain only the schema version and session
        // id. The worker reads authoritative facts from ClickHouse.
        let event_ids = sorted_event_ids(&records);
        match create_reconcile_job(user_id, &session_id, &event_ids, &mut account_lock).await {
            Ok(created) => {
                if created {
                    outcome.jobs_created += 1;
                }
                for item in records {
                    outcome.committed.push(item.delivery);
                }
            }
            Err(_) => {
                let first = records.first().expect("non-empty usage group");
                block_partition(&mut outcome, &mut blocked, &first.delivery);
                global_kafka_metrics()
                    .retries_total
                    .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
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
    let mut input = Vec::new();
    input.extend_from_slice(b"ai-session-reconcile:v1\0");
    input.extend_from_slice(user_id.as_bytes());
    append_hash_frame(&mut input, session_id.as_bytes());
    input.extend_from_slice(&(event_ids.len() as u64).to_be_bytes());
    for event_id in event_ids {
        append_hash_frame(&mut input, event_id.as_bytes());
    }
    let digest = Sha256::digest(input);
    format!("ai-session-reconcile:v1:{digest:x}")
}

fn append_hash_frame(buffer: &mut Vec<u8>, value: &[u8]) {
    buffer.extend_from_slice(&(value.len() as u64).to_be_bytes());
    buffer.extend_from_slice(value);
}

async fn create_reconcile_job(
    user_id: uuid::Uuid,
    session_id: &str,
    event_ids: &[String],
    account_lock: &mut deadpool_postgres::ClientWrapper,
) -> Result<bool> {
    let idempotency_key = session_job_key(user_id, session_id, event_ids);
    let params = serde_json::json!({
        "schema_version": 1,
        "ai_session_id": session_id,
    });
    let tx = account_lock
        .transaction()
        .await
        .context("start AI session job transaction")?;
    let created = crate::services::jobs::JobService::create_in_transaction_with_account_lock(
        &tx,
        Some(user_id),
        JobKind::AiSessionReconcile,
        params,
        Some(&idempotency_key),
    )
    .await
    .context("create AI session reconcile job in account transaction")?;
    tx.commit()
        .await
        .context("commit AI session reconcile job")?;
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
    error
        .chain()
        .any(|cause| cause.to_string().contains("usage_identity_conflict"))
}

fn usage_envelope_error_category(
    error: &crate::infrastructure::contracts::InfrastructureError,
) -> &'static str {
    if error.to_string().contains("identity") {
        "usage_identity_conflict"
    } else {
        "invalid_ai_usage_envelope"
    }
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
        .and_modify(|first| *first = (*first).min(delivery.offset))
        .or_insert(delivery.offset);
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
    fn session_job_key_length_frames_variable_fields() {
        let user_id = uuid::Uuid::parse_str("0190f3a1-0000-7000-8000-000000000001")
            .expect("valid test tenant");
        let first = session_job_key(user_id, "ab", &["c".to_string()]);
        let second = session_job_key(user_id, "a", &["bc".to_string()]);
        assert_ne!(first, second);
    }

    #[test]
    fn retry_watermark_keeps_the_earliest_uncommitted_offset() {
        let mut outcome = BatchOutcome::default();
        let mut blocked = BTreeSet::new();
        let tenant = uuid::Uuid::now_v7();
        let first = EventDelivery {
            topic: EventTopic::AiUsage,
            partition: 2,
            offset: 17,
            event: EventEnvelope::new(
                StableEventId::ai_usage("usage-17").expect("stable usage id"),
                "ai.usage.recorded",
                tenant,
                chrono::Utc::now(),
                serde_json::json!({}),
            ),
        };
        let earlier = EventDelivery {
            offset: 11,
            ..first.clone()
        };
        block_partition(&mut outcome, &mut blocked, &first);
        block_partition(&mut outcome, &mut blocked, &earlier);
        assert_eq!(outcome.retry_offsets.get(&2), Some(&11));
    }

    #[test]
    fn identity_conflicts_are_the_only_permanent_fact_error_category() {
        assert!(permanent_fact_error(&anyhow::anyhow!(
            "usage_identity_conflict"
        )));
        assert!(!permanent_fact_error(&anyhow::anyhow!(
            "ClickHouse unavailable"
        )));
    }
}
