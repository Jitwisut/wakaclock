//! Kafka/Redpanda adapter for the provider-neutral event contracts.
//!
//! The adapter is behind the `kafka` feature so the default ClickHouse/direct
//! build does not require a native librdkafka toolchain.  Production images and
//! the `kafka-spike` harness enable the feature explicitly; configuration still
//! keeps `direct` as the safe default.

use crate::config::brokers::EventBusConfig;
use crate::infrastructure::contracts::{
    EventBus, EventConsumer, EventDelivery, EventEnvelope, EventTopic, InfrastructureError,
    InfrastructureResult, HEARTBEAT_EVENT_TYPE, MAX_EVENT_PAYLOAD_BYTES,
};
use async_trait::async_trait;
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{CommitMode, Consumer, StreamConsumer};
use rdkafka::error::KafkaError;
use rdkafka::message::{BorrowedMessage, Message};
use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::topic_partition_list::{Offset, TopicPartitionList};
use std::collections::BTreeMap;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::Duration;

const DELIVERY_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone)]
pub struct KafkaEventBus {
    producer: FutureProducer,
}

impl KafkaEventBus {
    pub fn connect(config: &EventBusConfig, client_id: &str) -> InfrastructureResult<Self> {
        let producer = base_client_config(config, client_id, "producer")
            .set("enable.idempotence", "true")
            .set("acks", "all")
            .set("max.in.flight.requests.per.connection", "5")
            .set("compression.type", "lz4")
            .set("linger.ms", "5")
            .set("message.timeout.ms", "10000")
            .create()
            .map_err(|error| InfrastructureError::Unavailable(sanitize_kafka_error(error)))?;
        Ok(Self { producer })
    }

    pub fn producer(&self) -> &FutureProducer {
        &self.producer
    }
}

#[async_trait]
impl EventBus for KafkaEventBus {
    async fn publish(&self, topic: EventTopic, event: &EventEnvelope) -> InfrastructureResult<()> {
        event.validate()?;
        let payload = serde_json::to_vec(event)?;
        if payload.len() > MAX_EVENT_PAYLOAD_BYTES {
            return Err(InfrastructureError::InvalidEnvelope(
                "event payload exceeds the broker limit".to_string(),
            ));
        }
        let key = event.partition_key();
        let record = FutureRecord::to(topic.name()).key(&key).payload(&payload);
        self.producer
            .send(record, DELIVERY_TIMEOUT)
            .await
            .map(|_| ())
            .map_err(|(error, _)| InfrastructureError::Unavailable(sanitize_kafka_error(error)))
    }
}

/// Manual-offset consumer used by the heartbeat enrichment and verification
/// workers.  A malformed record is sent to the metadata-only DLQ before its
/// source offset is committed; valid records are returned to the worker, which
/// commits only after ClickHouse side effects are durable.
pub struct KafkaEventConsumer {
    consumer: StreamConsumer,
    topic: EventTopic,
    dlq: Arc<KafkaEventBus>,
    assigned: Arc<AtomicBool>,
    /// Source offsets whose metadata-only DLQ record is durable but which cannot
    /// be committed until any valid records before them have finished their
    /// ClickHouse side effects.  Keeping these offsets in memory is intentional:
    /// a process crash replays the source record, and the stable DLQ identity makes
    /// the replay safe for repair tooling.
    pending_dlq_offsets: tokio::sync::Mutex<Vec<(i32, i64)>>,
}

impl KafkaEventConsumer {
    pub fn connect(
        config: &EventBusConfig,
        client_id: &str,
        group_id: &str,
        topic: EventTopic,
        dlq: Arc<KafkaEventBus>,
    ) -> InfrastructureResult<Self> {
        let consumer: StreamConsumer = base_client_config(config, client_id, "consumer")
            .set("group.id", group_id)
            .set("enable.auto.commit", "false")
            .set("enable.auto.offset.store", "false")
            .set("partition.assignment.strategy", "cooperative-sticky")
            .set("session.timeout.ms", "10000")
            .set("enable.partition.eof", "false")
            .create()
            .map_err(|error| InfrastructureError::Unavailable(sanitize_kafka_error(error)))?;
        consumer
            .subscribe(&[topic.name()])
            .map_err(|error| InfrastructureError::Unavailable(sanitize_kafka_error(error)))?;
        Ok(Self {
            consumer,
            topic,
            dlq,
            assigned: Arc::new(AtomicBool::new(false)),
            pending_dlq_offsets: tokio::sync::Mutex::new(Vec::new()),
        })
    }

    pub fn assignment_flag(&self) -> Arc<AtomicBool> {
        self.assigned.clone()
    }

    async fn handle_invalid(
        &self,
        message: &BorrowedMessage<'_>,
        tenant_id: uuid::Uuid,
        category: &'static str,
    ) -> InfrastructureResult<(i32, i64)> {
        let event_id = format!("dlq:{}:{}", message.partition(), message.offset());
        let Ok(stable_id) =
            crate::infrastructure::contracts::StableEventId::heartbeat(&event_id, 0)
        else {
            return Err(InfrastructureError::InvalidEnvelope(
                "DLQ event identity is invalid".to_string(),
            ));
        };
        let envelope = EventEnvelope::new(
            stable_id,
            "ingest.dead_letter",
            tenant_id,
            chrono::Utc::now(),
            serde_json::json!({
                "source_topic": message.topic(),
                "source_partition": message.partition(),
                "source_offset": message.offset(),
                "error_category": category,
            }),
        );
        self.dlq
            .publish(EventTopic::IngestDeadLetter, &envelope)
            .await
            .map_err(|_| InfrastructureError::Unavailable("kafka DLQ unavailable".to_string()))?;
        let next_offset = message.offset().checked_add(1).ok_or_else(|| {
            InfrastructureError::InvalidEnvelope("kafka source offset overflow".to_string())
        })?;
        Ok((message.partition(), next_offset))
    }

    fn validate_topic_event(&self, event: &EventEnvelope) -> bool {
        match self.topic {
            EventTopic::Heartbeat => {
                event.event_type == HEARTBEAT_EVENT_TYPE && event.tenant_id != uuid::Uuid::nil()
            }
            _ => true,
        }
    }
}

#[async_trait]
impl EventConsumer for KafkaEventConsumer {
    async fn poll_batch(
        &self,
        max_records: usize,
        max_wait: Duration,
    ) -> InfrastructureResult<Vec<EventDelivery>> {
        if let Ok(assignment) = self.consumer.assignment() {
            self.assigned
                .store(!assignment.elements().is_empty(), Ordering::Release);
        }
        let deadline = tokio::time::Instant::now() + max_wait;
        let mut deliveries = Vec::with_capacity(max_records);
        let mut dlq_offsets = Vec::new();
        while deliveries.len() < max_records {
            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
            if remaining.is_zero() && !deliveries.is_empty() {
                break;
            }
            let message = match tokio::time::timeout(
                remaining.max(Duration::from_millis(1)),
                self.consumer.recv(),
            )
            .await
            {
                Ok(Ok(message)) => message,
                Ok(Err(error)) => {
                    return Err(InfrastructureError::Unavailable(sanitize_kafka_error(
                        error,
                    )))
                }
                Err(_) => break,
            };
            let Some(payload) = message.payload() else {
                dlq_offsets.push(
                    self.handle_invalid(&message, uuid::Uuid::nil(), "empty_payload")
                        .await?,
                );
                continue;
            };
            // A malformed envelope cannot be trusted as a source of identity, but a
            // syntactically valid tenant UUID is still safe to retain in the DLQ
            // metadata.  This keeps repair tooling tenant-scoped without copying any
            // untrusted payload fields into the dead-letter record.
            let tenant_id = tenant_id_from_payload(payload);
            let event = match serde_json::from_slice::<EventEnvelope>(payload) {
                Ok(event) if event.validate().is_ok() && self.validate_topic_event(&event) => event,
                Ok(_) => {
                    dlq_offsets.push(
                        self.handle_invalid(&message, tenant_id, "invalid_envelope")
                            .await?,
                    );
                    continue;
                }
                Err(_) => {
                    dlq_offsets.push(
                        self.handle_invalid(&message, tenant_id, "invalid_json")
                            .await?,
                    );
                    continue;
                }
            };
            deliveries.push(EventDelivery {
                topic: self.topic,
                partition: message.partition(),
                offset: message.offset(),
                event,
            });
        }
        if !dlq_offsets.is_empty() {
            self.pending_dlq_offsets.lock().await.extend(dlq_offsets);
        }
        // A batch containing only malformed records has no new valid side effect
        // that could be skipped, so it can advance all pending DLQ offsets
        // immediately.  This also prevents a broker commit failure in a previous
        // batch from leaving a partition parked on a poison record forever: the
        // preceding valid delivery had already completed its durable write before
        // the failed commit was recorded.
        if deliveries.is_empty() {
            let pending = {
                let mut pending = self.pending_dlq_offsets.lock().await;
                std::mem::take(&mut *pending)
            };
            if !pending.is_empty() {
                if let Err(error) = self.commit_partition_offsets(&pending) {
                    self.pending_dlq_offsets.lock().await.extend(pending);
                    return Err(error);
                }
            }
        }
        Ok(deliveries)
    }

    async fn commit(&self, deliveries: &[EventDelivery]) -> InfrastructureResult<()> {
        let mut pending = self.pending_dlq_offsets.lock().await;
        let mut partition_offsets = pending.clone();
        partition_offsets.extend(offsets_for_commit(self.topic, deliveries)?);
        let commit_offsets = collapse_partition_offsets(partition_offsets);
        if commit_offsets.is_empty() {
            return Ok(());
        }
        self.commit_partition_offsets(&commit_offsets)?;
        pending.clear();
        Ok(())
    }
}

impl KafkaEventConsumer {
    fn commit_partition_offsets(
        &self,
        partition_offsets: &[(i32, i64)],
    ) -> InfrastructureResult<()> {
        let mut offsets = TopicPartitionList::new();
        for (partition, offset) in partition_offsets {
            offsets
                .add_partition_offset(self.topic.name(), *partition, Offset::Offset(*offset))
                .map_err(|error| InfrastructureError::Unavailable(sanitize_kafka_error(error)))?;
        }
        self.consumer
            .commit(&offsets, CommitMode::Sync)
            .map_err(|error| InfrastructureError::Unavailable(sanitize_kafka_error(error)))
    }
}

/// Extract only a valid, non-nil tenant UUID from a JSON object.  This is used for
/// metadata on malformed records; the complete envelope is still validated before a
/// record can reach a worker.  Returning nil is intentional when the field is absent,
/// malformed, or not a string.
fn tenant_id_from_payload(payload: &[u8]) -> uuid::Uuid {
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(payload) else {
        return uuid::Uuid::nil();
    };
    value
        .get("tenant_id")
        .and_then(serde_json::Value::as_str)
        .and_then(|value| value.parse::<uuid::Uuid>().ok())
        .filter(|value| *value != uuid::Uuid::nil())
        .unwrap_or_else(uuid::Uuid::nil)
}

/// Collapse successful deliveries to one offset per partition.  `TopicPartitionList`
/// has one mutable entry per partition; adding the same partition repeatedly makes
/// the commit dependent on librdkafka's duplicate-entry handling and can either fail
/// or accidentally commit a lower offset.  The worker only passes a successful
/// prefix, so the highest offset per partition is the durable watermark.
fn offsets_for_commit(
    topic: EventTopic,
    deliveries: &[EventDelivery],
) -> InfrastructureResult<Vec<(i32, i64)>> {
    let mut partition_offsets = Vec::with_capacity(deliveries.len());
    for delivery in deliveries {
        if delivery.topic != topic {
            return Err(InfrastructureError::InvalidEnvelope(
                "event delivery topic does not match consumer topic".to_string(),
            ));
        }
        if delivery.partition < 0 || delivery.offset < 0 {
            return Err(InfrastructureError::InvalidEnvelope(
                "event delivery offset is invalid".to_string(),
            ));
        }
        let next = delivery.offset.checked_add(1).ok_or_else(|| {
            InfrastructureError::InvalidEnvelope("event delivery offset overflow".to_string())
        })?;
        partition_offsets.push((delivery.partition, next));
    }
    Ok(collapse_partition_offsets(partition_offsets))
}

fn collapse_partition_offsets(partition_offsets: Vec<(i32, i64)>) -> Vec<(i32, i64)> {
    let mut by_partition = BTreeMap::<i32, i64>::new();
    for (partition, offset) in partition_offsets {
        by_partition
            .entry(partition)
            .and_modify(|current| *current = (*current).max(offset))
            .or_insert(offset);
    }
    by_partition.into_iter().collect()
}

fn base_client_config(config: &EventBusConfig, client_id: &str, role: &str) -> ClientConfig {
    let mut client = ClientConfig::new();
    client
        .set("bootstrap.servers", config.bootstrap_servers.join(","))
        .set("client.id", client_id)
        .set("client.rack", role)
        .set(
            "security.protocol",
            match (config.tls, config.sasl.is_some()) {
                (true, true) => "SASL_SSL",
                (true, false) => "SSL",
                (false, true) => "SASL_PLAINTEXT",
                (false, false) => "PLAINTEXT",
            },
        );
    if let Some(sasl) = &config.sasl {
        client
            .set("sasl.mechanisms", sasl.mechanism.as_str())
            .set("sasl.username", &sasl.username)
            .set("sasl.password", &sasl.password);
    }
    client
}

fn sanitize_kafka_error(error: KafkaError) -> String {
    // librdkafka errors contain broker text but never need the serialized event
    // or SASL password.  Keep a short category for metrics/logs and avoid echoing
    // credential-bearing configuration.
    let text = error.to_string().to_ascii_lowercase();
    if text.contains("timed out") || text.contains("timeout") {
        "kafka delivery timeout".to_string()
    } else if text.contains("authentication") || text.contains("sasl") {
        "kafka authentication failed".to_string()
    } else if text.contains("broker") || text.contains("connection") {
        "kafka broker unavailable".to_string()
    } else {
        "kafka delivery failed".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::contracts::{EventEnvelope, StableEventId};
    use chrono::Utc;

    fn delivery(topic: EventTopic, partition: i32, offset: i64) -> EventDelivery {
        EventDelivery {
            topic,
            partition,
            offset,
            event: EventEnvelope::new(
                StableEventId::heartbeat("kafka-test", 0).expect("stable id"),
                "heartbeat.recorded",
                uuid::Uuid::now_v7(),
                Utc::now(),
                serde_json::json!({}),
            ),
        }
    }

    #[test]
    fn commit_offsets_collapse_duplicate_partitions_to_highest_watermark() {
        let offsets = offsets_for_commit(
            EventTopic::Heartbeat,
            &[
                delivery(EventTopic::Heartbeat, 2, 4),
                delivery(EventTopic::Heartbeat, 1, 9),
                delivery(EventTopic::Heartbeat, 2, 7),
                delivery(EventTopic::Heartbeat, 1, 8),
            ],
        )
        .expect("offsets are valid");
        assert_eq!(offsets, vec![(1, 10), (2, 8)]);
    }

    #[test]
    fn commit_offsets_reject_a_delivery_from_another_topic() {
        let error = offsets_for_commit(
            EventTopic::Heartbeat,
            &[delivery(EventTopic::AiUsage, 0, 0)],
        )
        .expect_err("topic mismatch must not be committed");
        assert!(matches!(error, InfrastructureError::InvalidEnvelope(_)));
    }

    #[test]
    fn malformed_payload_keeps_only_a_valid_tenant_uuid() {
        let tenant = uuid::Uuid::now_v7();
        let payload = serde_json::json!({
            "tenant_id": tenant,
            "payload": {"secret": "must not be copied"}
        });
        assert_eq!(
            tenant_id_from_payload(&serde_json::to_vec(&payload).unwrap()),
            tenant
        );
        assert_eq!(
            tenant_id_from_payload(br#"{"tenant_id":"not-a-uuid"}"#),
            uuid::Uuid::nil()
        );
        assert_eq!(tenant_id_from_payload(br"not-json"), uuid::Uuid::nil());
    }
}
