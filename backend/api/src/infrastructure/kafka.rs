//! Kafka/Redpanda adapter for the provider-neutral event contracts.
//!
//! The adapter is behind the `kafka` feature so the default ClickHouse/direct
//! build does not require a native librdkafka toolchain.  Production images and
//! the `kafka-spike` harness enable the feature explicitly; configuration still
//! keeps `direct` as the safe default.

use crate::config::brokers::EventBusConfig;
use crate::infrastructure::contracts::{
    EventConsumer, EventDelivery, EventEnvelope, EventBus, EventTopic, InfrastructureError,
    InfrastructureResult, HEARTBEAT_EVENT_TYPE, MAX_EVENT_PAYLOAD_BYTES,
};
use async_trait::async_trait;
use rdkafka::config::ClientConfig;
use rdkafka::consumer::{CommitMode, Consumer, StreamConsumer};
use rdkafka::error::KafkaError;
use rdkafka::message::{BorrowedMessage, Message};
use rdkafka::producer::{FutureProducer, FutureRecord};
use rdkafka::topic_partition_list::{Offset, TopicPartitionList};
use std::sync::{atomic::{AtomicBool, Ordering}, Arc};
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
        let record = FutureRecord::to(topic.name())
            .key(&key)
            .payload(&payload);
        self.producer
            .send(record, DELIVERY_TIMEOUT)
            .await
            .map(|_| ())
            .map_err(|(error, _)| {
                InfrastructureError::Unavailable(sanitize_kafka_error(error))
            })
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
        })
    }

    pub fn assignment_flag(&self) -> Arc<AtomicBool> {
        self.assigned.clone()
    }

    async fn handle_invalid(
        &self,
        message: &BorrowedMessage<'_>,
        category: &'static str,
    ) -> InfrastructureResult<()> {
        let event_id = format!("dlq:{}:{}", message.partition(), message.offset());
        let Ok(stable_id) = crate::infrastructure::contracts::StableEventId::heartbeat(&event_id, 0)
        else {
            return Err(InfrastructureError::InvalidEnvelope(
                "DLQ event identity is invalid".to_string(),
            ));
        };
        let envelope = EventEnvelope::new(
            stable_id,
            "ingest.dead_letter",
            uuid::Uuid::nil(),
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
        let mut offsets = TopicPartitionList::new();
        offsets
            .add_partition_offset(
                message.topic(),
                message.partition(),
                Offset::Offset(message.offset() + 1),
            )
            .map_err(|_| InfrastructureError::Unavailable("kafka offset update failed".to_string()))?;
        self.consumer
            .commit(&offsets, CommitMode::Sync)
            .map_err(|_| InfrastructureError::Unavailable("kafka offset commit failed".to_string()))
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
        while deliveries.len() < max_records {
            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
            if remaining.is_zero() && !deliveries.is_empty() {
                break;
            }
            let message = match tokio::time::timeout(remaining.max(Duration::from_millis(1)), self.consumer.recv()).await {
                Ok(Ok(message)) => message,
                Ok(Err(error)) => return Err(InfrastructureError::Unavailable(sanitize_kafka_error(error))),
                Err(_) => break,
            };
            let Some(payload) = message.payload() else {
                self.handle_invalid(&message, "empty_payload").await?;
                continue;
            };
            let event = match serde_json::from_slice::<EventEnvelope>(payload) {
                Ok(event) if event.validate().is_ok() && self.validate_topic_event(&event) => event,
                Ok(_) => {
                    self.handle_invalid(&message, "invalid_envelope").await?;
                    continue;
                }
                Err(_) => {
                    self.handle_invalid(&message, "invalid_json").await?;
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
        Ok(deliveries)
    }

    async fn commit(&self, deliveries: &[EventDelivery]) -> InfrastructureResult<()> {
        if deliveries.is_empty() {
            return Ok(());
        }
        let mut offsets = TopicPartitionList::new();
        for delivery in deliveries {
            offsets
                .add_partition_offset(
                    delivery.topic.name(),
                    delivery.partition,
                    Offset::Offset(delivery.offset + 1),
                )
                .map_err(|error| InfrastructureError::Unavailable(sanitize_kafka_error(error)))?;
        }
        self.consumer
            .commit(&offsets, CommitMode::Sync)
            .map_err(|error| InfrastructureError::Unavailable(sanitize_kafka_error(error)))
    }
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
