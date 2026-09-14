//! Kafka/Redpanda adapter for the provider-neutral event contracts.
//!
//! The adapter is behind the `kafka` feature so the default ClickHouse/direct
//! build does not require a native librdkafka toolchain.  Production images and
//! the `kafka-spike` harness enable the feature explicitly; configuration still
//! keeps `direct` as the safe default.

use crate::config::brokers::EventBusConfig;
use crate::infrastructure::contracts::{
    EventBus, EventConsumer, EventDelivery, EventEnvelope, EventTopic, InfrastructureError,
    InfrastructureResult, AI_USAGE_EVENT_TYPE, HEARTBEAT_EVENT_TYPE, MAX_EVENT_PAYLOAD_BYTES,
};
use crate::infrastructure::metrics::{global_kafka_metrics, KafkaMetrics};
use async_trait::async_trait;
use futures::future::join_all;
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
    metrics: Arc<KafkaMetrics>,
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
        Ok(Self {
            producer,
            metrics: global_kafka_metrics(),
        })
    }

    pub fn producer(&self) -> &FutureProducer {
        &self.producer
    }

    pub fn metrics(&self) -> Arc<KafkaMetrics> {
        self.metrics.clone()
    }

    /// Publish to a UUID-scoped topic used by the K0 harness. The production
    /// adapter continues to use the typed `EventTopic` entry point below.
    pub async fn publish_named(
        &self,
        topic: &str,
        key: &str,
        event: &EventEnvelope,
    ) -> InfrastructureResult<()> {
        let started = std::time::Instant::now();
        event.validate()?;
        let payload = serde_json::to_vec(event)?;
        if payload.len() > MAX_EVENT_PAYLOAD_BYTES {
            return Err(InfrastructureError::InvalidEnvelope(
                "event payload exceeds the broker limit".to_string(),
            ));
        }
        let record = FutureRecord::to(topic).key(key).payload(&payload);
        let result = self
            .producer
            .send(record, DELIVERY_TIMEOUT)
            .await
            .map(|_| ())
            .map_err(|(error, _)| InfrastructureError::Unavailable(sanitize_kafka_error(error)));
        self.metrics.observe_publish_for_topic(
            topic,
            started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64,
            result.is_ok(),
        );
        result
    }
}

#[async_trait]
impl EventBus for KafkaEventBus {
    async fn publish(&self, topic: EventTopic, event: &EventEnvelope) -> InfrastructureResult<()> {
        let started = std::time::Instant::now();
        event.validate()?;
        let payload = serde_json::to_vec(event)?;
        if payload.len() > MAX_EVENT_PAYLOAD_BYTES {
            return Err(InfrastructureError::InvalidEnvelope(
                "event payload exceeds the broker limit".to_string(),
            ));
        }
        let key = event.partition_key();
        let record = FutureRecord::to(topic.name()).key(&key).payload(&payload);
        let result = self
            .producer
            .send(record, DELIVERY_TIMEOUT)
            .await
            .map(|_| ())
            .map_err(|(error, _)| InfrastructureError::Unavailable(sanitize_kafka_error(error)));
        self.metrics.observe_publish_for_topic(
            topic.name(),
            started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64,
            result.is_ok(),
        );
        result
    }

    async fn publish_batch(
        &self,
        topic: EventTopic,
        events: &[EventEnvelope],
    ) -> InfrastructureResult<()> {
        // `join_all` polls these futures in slice order, which queues the batch
        // in caller order, while allowing Kafka to await all acknowledgements in
        // parallel. A later failure therefore cannot prevent earlier/later stable
        // IDs from being attempted; the caller still retries the full batch.
        let results = join_all(events.iter().map(|event| self.publish(topic, event))).await;
        let mut first_error = None;
        for result in results {
            if let Err(error) = result {
                if first_error.is_none() {
                    first_error = Some(error);
                }
            }
        }
        first_error.map_or(Ok(()), Err)
    }
}

/// Manual-offset consumer used by the heartbeat enrichment and verification
/// workers.  A malformed record is sent to the metadata-only DLQ before its
/// source offset is committed; valid records are returned to the worker, which
/// commits only after ClickHouse side effects are durable.
pub struct KafkaEventConsumer {
    consumer: StreamConsumer,
    topic: EventTopic,
    source_topic: String,
    dlq: Arc<KafkaEventBus>,
    assigned: Arc<AtomicBool>,
    /// Source offsets whose metadata-only DLQ record is durable but which cannot
    /// be committed until any valid records before them have finished their
    /// ClickHouse side effects.  Keeping these offsets in memory is intentional:
    /// a process crash replays the source record, and the stable DLQ identity makes
    /// the replay safe for repair tooling.
    pending_dlq_offsets: tokio::sync::Mutex<Vec<(i32, i64)>>,
    /// Partitions whose valid delivery is currently waiting on a transient
    /// side-effect retry.  A malformed record after that delivery may already
    /// have a durable DLQ row, but its source offset must not advance past the
    /// transient gap.
    retry_blocked_partitions: tokio::sync::Mutex<std::collections::BTreeSet<i32>>,
    metrics: Arc<KafkaMetrics>,
}

impl KafkaEventConsumer {
    pub fn connect(
        config: &EventBusConfig,
        client_id: &str,
        group_id: &str,
        topic: EventTopic,
        dlq: Arc<KafkaEventBus>,
    ) -> InfrastructureResult<Self> {
        Self::connect_with_topic(config, client_id, group_id, topic, topic.name(), dlq)
    }

    /// Connect to an explicitly named topic for isolated spike environments.
    /// Production consumers use [`Self::connect`] so topic names remain owned by
    /// the versioned `EventTopic` contract.
    pub fn connect_with_topic(
        config: &EventBusConfig,
        client_id: &str,
        group_id: &str,
        topic: EventTopic,
        source_topic: &str,
        dlq: Arc<KafkaEventBus>,
    ) -> InfrastructureResult<Self> {
        Self::connect_with_topic_reset(
            config,
            client_id,
            group_id,
            topic,
            source_topic,
            dlq,
            "earliest",
        )
    }

    /// Variant used by isolated rebalance tests.  A test consumer can be
    /// attached to the current tail before publishing its own records, so a
    /// fresh group does not replay earlier scenarios from the same topic.
    pub fn connect_with_topic_reset(
        config: &EventBusConfig,
        client_id: &str,
        group_id: &str,
        topic: EventTopic,
        source_topic: &str,
        dlq: Arc<KafkaEventBus>,
        offset_reset: &str,
    ) -> InfrastructureResult<Self> {
        let consumer: StreamConsumer = base_client_config(config, client_id, "consumer")
            .set("group.id", group_id)
            .set("enable.auto.commit", "false")
            .set("enable.auto.offset.store", "false")
            .set("partition.assignment.strategy", "cooperative-sticky")
            // A newly deployed worker must drain retained events before following
            // the live tail.  The explicit group offset still wins once a group
            // has committed, so this does not rewind healthy consumers.
            .set("auto.offset.reset", offset_reset)
            .set("session.timeout.ms", "10000")
            .set("enable.partition.eof", "false")
            .create()
            .map_err(|error| InfrastructureError::Unavailable(sanitize_kafka_error(error)))?;
        consumer
            .subscribe(&[source_topic])
            .map_err(|error| InfrastructureError::Unavailable(sanitize_kafka_error(error)))?;
        Ok(Self {
            consumer,
            topic,
            source_topic: source_topic.to_string(),
            dlq: dlq.clone(),
            assigned: Arc::new(AtomicBool::new(false)),
            pending_dlq_offsets: tokio::sync::Mutex::new(Vec::new()),
            retry_blocked_partitions: tokio::sync::Mutex::new(std::collections::BTreeSet::new()),
            metrics: dlq.metrics(),
        })
    }

    /// Drive librdkafka until this consumer has an assignment.  Subscription
    /// callbacks are delivered while polling, so merely constructing a consumer
    /// is not enough to establish a tail position for the rebalance harness.
    pub async fn wait_for_assignment(&self, timeout: Duration) -> InfrastructureResult<()> {
        let deadline = tokio::time::Instant::now() + timeout;
        loop {
            if let Ok(assignment) = self.consumer.assignment() {
                if !assignment.elements().is_empty() {
                    self.assigned.store(true, Ordering::Release);
                    return Ok(());
                }
            }
            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
            if remaining.is_zero() {
                return Err(InfrastructureError::Unavailable(
                    "kafka consumer assignment timeout".to_string(),
                ));
            }
            let _ = tokio::time::timeout(
                remaining.min(Duration::from_millis(250)),
                self.consumer.recv(),
            )
            .await;
        }
    }

    /// Rewind only the offsets that a test or a controlled repair path has
    /// deliberately left uncommitted.  Production workers normally let a
    /// restart/rebalance perform this rewind; exposing the narrow operation
    /// keeps the K0 crash-injection scenario deterministic without committing a
    /// transient failure.
    pub fn seek_to_offsets(&self, offsets: &[(i32, i64)]) -> InfrastructureResult<()> {
        let mut positions = TopicPartitionList::new();
        for (partition, offset) in offsets {
            positions
                .add_partition_offset(&self.source_topic, *partition, Offset::Offset(*offset))
                .map_err(|error| InfrastructureError::Unavailable(sanitize_kafka_error(error)))?;
        }
        self.consumer
            .seek_partitions(positions, Duration::from_secs(5))
            .map_err(|error| InfrastructureError::Unavailable(sanitize_kafka_error(error)))
            .map(|_| ())
    }

    pub fn pause_partitions(
        &self,
        partitions: &std::collections::BTreeSet<i32>,
    ) -> InfrastructureResult<()> {
        if partitions.is_empty() {
            return Ok(());
        }
        let mut list = TopicPartitionList::new();
        for partition in partitions {
            list.add_partition(&self.source_topic, *partition);
        }
        self.consumer
            .pause(&list)
            .map_err(|error| InfrastructureError::Unavailable(sanitize_kafka_error(error)))
    }

    pub fn resume_partitions(
        &self,
        partitions: &std::collections::BTreeSet<i32>,
    ) -> InfrastructureResult<()> {
        if partitions.is_empty() {
            return Ok(());
        }
        let mut list = TopicPartitionList::new();
        for partition in partitions {
            list.add_partition(&self.source_topic, *partition);
        }
        self.consumer
            .resume(&list)
            .map_err(|error| InfrastructureError::Unavailable(sanitize_kafka_error(error)))
    }

    /// Mark a partition as blocked until its transient delivery has been
    /// replayed successfully.  This is separate from librdkafka's pause state:
    /// a poll may already have read a later poison record before the worker
    /// discovers the transient failure.
    pub async fn mark_retry_partitions(&self, partitions: &std::collections::BTreeSet<i32>) {
        self.retry_blocked_partitions
            .lock()
            .await
            .extend(partitions.iter().copied());
    }

    /// Clear retry fences after the worker has durably committed the successful
    /// prefix.  Partitions with no successful delivery remain fenced.
    pub async fn clear_retry_partitions(&self, partitions: &std::collections::BTreeSet<i32>) {
        let mut blocked = self.retry_blocked_partitions.lock().await;
        for partition in partitions {
            blocked.remove(partition);
        }
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
        self.metrics.dlq_total.fetch_add(1, Ordering::Relaxed);
        self.metrics.increment_category("dlq", category);
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
            EventTopic::AiUsage => {
                event.event_type == AI_USAGE_EVENT_TYPE && event.tenant_id != uuid::Uuid::nil()
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
            if let Ok((_, high_watermark)) = self.consumer.fetch_watermarks(
                &self.source_topic,
                message.partition(),
                Duration::from_millis(100),
            ) {
                let next_offset = message.offset().saturating_add(1);
                let lag = high_watermark.saturating_sub(next_offset).max(0) as u64;
                self.metrics
                    .observe_partition_lag(&self.source_topic, message.partition(), lag);
            }
            let age = chrono::Utc::now()
                .signed_duration_since(
                    deliveries
                        .last()
                        .expect("delivery was just pushed")
                        .event
                        .received_at,
                )
                .num_seconds()
                .max(0) as u64;
            self.metrics.observe_oldest_record_age(age);
        }
        let dlq_count = dlq_offsets.len();
        if !dlq_offsets.is_empty() {
            self.pending_dlq_offsets.lock().await.extend(dlq_offsets);
        }
        self.metrics.observe_batch(deliveries.len() + dlq_count);
        // A batch containing only malformed records has no new valid side effect
        // that could be skipped, so it can advance all pending DLQ offsets
        // immediately.  This also prevents a broker commit failure in a previous
        // batch from leaving a partition parked on a poison record forever: the
        // preceding valid delivery had already completed its durable write before
        // the failed commit was recorded.
        if deliveries.is_empty() {
            let blocked = self.retry_blocked_partitions.lock().await.clone();
            let mut pending = self.pending_dlq_offsets.lock().await;
            let (ready, retained): (Vec<_>, Vec<_>) = pending
                .drain(..)
                .partition(|(partition, _)| !blocked.contains(partition));
            if !ready.is_empty() {
                if let Err(error) = self.commit_partition_offsets(&ready) {
                    pending.extend(ready);
                    pending.extend(retained);
                    return Err(error);
                }
            }
            pending.extend(retained);
        }
        Ok(deliveries)
    }

    async fn commit(&self, deliveries: &[EventDelivery]) -> InfrastructureResult<()> {
        let mut pending = self.pending_dlq_offsets.lock().await;
        let successful = offsets_for_commit(self.topic, deliveries)?;
        let successful_watermarks = successful.iter().copied().collect::<BTreeMap<_, _>>();
        let (ready_dlq, retained_dlq) =
            split_pending_dlq_offsets(pending.drain(..), &successful_watermarks);
        let mut partition_offsets = ready_dlq.clone();
        partition_offsets.extend(successful);
        let commit_offsets = collapse_partition_offsets(partition_offsets);
        if commit_offsets.is_empty() {
            pending.extend(ready_dlq);
            pending.extend(retained_dlq);
            return Ok(());
        }
        if let Err(error) = self.commit_partition_offsets(&commit_offsets) {
            pending.extend(ready_dlq);
            pending.extend(retained_dlq);
            return Err(error);
        }
        pending.extend(retained_dlq);
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
                .add_partition_offset(&self.source_topic, *partition, Offset::Offset(*offset))
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

type PartitionOffsets = Vec<(i32, i64)>;

fn split_pending_dlq_offsets(
    pending: impl Iterator<Item = (i32, i64)>,
    successful_watermarks: &BTreeMap<i32, i64>,
) -> (PartitionOffsets, PartitionOffsets) {
    pending.partition(|(partition, offset)| {
        successful_watermarks
            .get(partition)
            .is_some_and(|watermark| watermark >= offset)
    })
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

    #[test]
    fn pending_dlq_never_crosses_a_transient_partition_gap() {
        let successful = BTreeMap::from([(1, 6), (2, 11)]);
        let (ready, retained) =
            split_pending_dlq_offsets(vec![(1, 8), (2, 10), (2, 12)].into_iter(), &successful);
        assert_eq!(ready, vec![(2, 10)]);
        assert_eq!(retained, vec![(1, 8), (2, 12)]);
    }
}
