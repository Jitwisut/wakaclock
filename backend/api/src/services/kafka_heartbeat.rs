//! Shared Kafka heartbeat batch processing for the fact-sink and K0 harness.
//!
//! Keeping the side-effect boundary here means the isolated spike exercises the
//! same validation, revision lookup, tombstone handling and strict projection path
//! as the production consumer.  The caller remains responsible for polling and
//! committing offsets.

use anyhow::{Context, Result};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::Arc;
use std::time::Instant;

use crate::infrastructure::app::AppState;
use crate::infrastructure::contracts::{
    EventBus, EventDelivery, EventEnvelope, EventTopic, HeartbeatEventV1, StableEventId,
};
use crate::infrastructure::kafka::KafkaEventBus;
use crate::infrastructure::metrics::global_kafka_metrics;

#[derive(Debug, Default)]
pub struct BatchOutcome {
    pub committed: Vec<EventDelivery>,
    pub retry_partitions: BTreeSet<i32>,
    /// First uncommitted source offset per partition.  A poll advances
    /// librdkafka's in-memory position even when a side effect fails; callers
    /// must seek these watermarks before retrying or the uncommitted tail would
    /// be skipped until a process restart.
    pub retry_offsets: BTreeMap<i32, i64>,
    pub inserted: usize,
    pub permanent_failures: usize,
    pub deduplicated: usize,
    pub tombstoned: usize,
}

pub async fn process_batch(
    state: &Arc<AppState>,
    bus: &Arc<KafkaEventBus>,
    mut deliveries: Vec<EventDelivery>,
) -> Result<BatchOutcome> {
    deliveries.sort_by_key(|delivery| (delivery.partition, delivery.offset));
    let mut outcome = BatchOutcome::default();
    let mut blocked = BTreeSet::new();
    let metrics = global_kafka_metrics();

    for delivery in deliveries {
        if blocked.contains(&delivery.partition) {
            continue;
        }
        let event = match serde_json::from_value::<HeartbeatEventV1>(delivery.event.payload.clone())
        {
            Ok(event) => event,
            Err(error) => {
                if publish_dlq(bus, &delivery, "invalid_heartbeat_payload").await {
                    outcome.committed.push(delivery);
                    outcome.permanent_failures += 1;
                } else {
                    blocked.insert(delivery.partition);
                    outcome.retry_partitions.insert(delivery.partition);
                    outcome
                        .retry_offsets
                        .entry(delivery.partition)
                        .or_insert(delivery.offset);
                }
                tracing::warn!(%error, "heartbeat payload rejected by fact-sink");
                continue;
            }
        };
        if let Err(error) = event.validate_envelope(&delivery.event) {
            if publish_dlq(bus, &delivery, "event_identity_mismatch").await {
                outcome.committed.push(delivery);
                outcome.permanent_failures += 1;
            } else {
                blocked.insert(delivery.partition);
                outcome.retry_partitions.insert(delivery.partition);
                outcome
                    .retry_offsets
                    .entry(delivery.partition)
                    .or_insert(delivery.offset);
            }
            tracing::warn!(%error, "heartbeat event identity rejected by fact-sink");
            continue;
        }

        let tenant_id = delivery.event.tenant_id;
        let heartbeat = event.into_heartbeat(tenant_id);
        let heartbeat_id = heartbeat
            .heartbeat_id
            .as_deref()
            .context("validated heartbeat event has no heartbeat_id")?;
        let token = format!(
            "kafka:{}:{}:{}:{}",
            delivery.topic.name(),
            tenant_id,
            heartbeat_id,
            heartbeat.revision
        );
        let started = Instant::now();
        match state
            .heartbeat_service
            .process_heartbeats_strict_with_token(
                tenant_id,
                heartbeat.machine.clone(),
                vec![heartbeat],
                &token,
            )
            .await
        {
            Ok(inserted) => {
                metrics
                    .observe_insert(started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64);
                if inserted == 0 {
                    metrics
                        .deduplicated_total
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    outcome.deduplicated += 1;
                } else {
                    outcome.inserted += inserted;
                }
                outcome.committed.push(delivery);
            }
            Err(error) => {
                let message = error.to_string();
                if let Some(category) = permanent_category(&message) {
                    if publish_dlq(bus, &delivery, category).await {
                        outcome.committed.push(delivery);
                        outcome.permanent_failures += 1;
                    } else {
                        blocked.insert(delivery.partition);
                        outcome.retry_partitions.insert(delivery.partition);
                        outcome
                            .retry_offsets
                            .entry(delivery.partition)
                            .or_insert(delivery.offset);
                    }
                } else {
                    metrics
                        .retries_total
                        .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                    metrics.increment_category("retry", "clickhouse_or_broker");
                    blocked.insert(delivery.partition);
                    outcome.retry_partitions.insert(delivery.partition);
                    outcome
                        .retry_offsets
                        .entry(delivery.partition)
                        .or_insert(delivery.offset);
                    tracing::warn!(%error, "heartbeat sink transient failure");
                }
            }
        }
    }
    Ok(outcome)
}

async fn publish_dlq(
    bus: &KafkaEventBus,
    delivery: &EventDelivery,
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
    let published = bus
        .publish(EventTopic::IngestDeadLetter, &envelope)
        .await
        .is_ok();
    if published {
        let metrics = global_kafka_metrics();
        metrics
            .dlq_total
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        metrics.increment_category("dlq", category);
    }
    published
}

pub fn permanent_category(error: &str) -> Option<&'static str> {
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
