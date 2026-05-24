//! RabbitMQ-backed implementation of the `MessageQueue` trait.
//! Provides durable publish/subscribe semantics on top of a topic exchange and
//! manages per-consumer queues for ordered message delivery.

use super::MessageQueue;
use crate::infrastructure::queue::traits::{JobPriority, JobType, QueueMessage};
use async_trait::async_trait;
use chrono::Utc;
use futures::StreamExt;
use lapin::{
    message::Delivery,
    options::{
        BasicAckOptions, BasicConsumeOptions, BasicNackOptions, BasicPublishOptions,
        BasicQosOptions, ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions,
    },
    types::FieldTable,
    BasicProperties, Channel, Connection, ConnectionProperties, ExchangeKind,
};
use std::{
    any::Any,
    collections::{HashMap, HashSet},
    sync::{Arc, Mutex},
};
use tokio::task::JoinHandle;
use tokio_executor_trait::Tokio as TokioExecutor;
#[cfg(unix)]
use tokio_reactor_trait::Tokio as TokioReactor;
use tracing::{error, info, warn};

#[derive(Clone)]
struct ConsumerBinding {
    queue: String,
    routing_keys: Vec<String>,
}

/// RabbitMQ message queue (infrastructure layer)
pub struct RabbitMqQueue {
    connection: Arc<Connection>,
    publish_channel: Channel,
    exchange: String,
    queue_prefix: String,
    prefetch_count: u16,
    consumer_bindings: Arc<Mutex<HashMap<String, ConsumerBinding>>>,
    consumer_tasks: Arc<Mutex<Vec<JoinHandle<()>>>>,
}

impl RabbitMqQueue {
    /// Create queue using default exchange/prefix.
    pub async fn new(url: &str) -> anyhow::Result<Self> {
        Self::new_with_settings(url, "ecommerce", "ecommerce", 50).await
    }

    /// Create queue with custom settings.
    pub async fn new_with_settings(
        url: &str,
        exchange: &str,
        queue_prefix: &str,
        prefetch_count: u16,
    ) -> anyhow::Result<Self> {
        let properties = ConnectionProperties::default().with_executor(TokioExecutor::current());
        #[cfg(unix)]
        let properties = properties.with_reactor(TokioReactor);

        let connection = Connection::connect(url, properties)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to connect to RabbitMQ: {}", e))?;

        let connection = Arc::new(connection);
        let publish_channel = connection
            .create_channel()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to create publish channel: {}", e))?;

        let queue = Self {
            connection: connection.clone(),
            publish_channel,
            exchange: exchange.to_string(),
            queue_prefix: queue_prefix.to_string(),
            prefetch_count,
            consumer_bindings: Arc::new(Mutex::new(HashMap::new())),
            consumer_tasks: Arc::new(Mutex::new(Vec::new())),
        };

        queue.declare_exchange().await?;
        Ok(queue)
    }

    fn make_queue_name(&self, consumer: &str) -> String {
        format!("{}.{}", self.queue_prefix, consumer)
    }

    fn expand_routing_keys(subjects: &str) -> Vec<String> {
        let mut seen = HashSet::new();
        let mut keys = Vec::new();

        for part in subjects
            .split(|c: char| matches!(c, ',' | ';' | '\n' | '\r'))
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            let entry = part.to_string();
            if seen.insert(entry.clone()) {
                keys.push(entry);
            }
        }

        if keys.is_empty() {
            let trimmed = subjects.trim();
            if !trimmed.is_empty() {
                keys.push(trimmed.to_string());
            }
        }

        keys
    }

    async fn declare_exchange(&self) -> anyhow::Result<()> {
        self.publish_channel
            .exchange_declare(
                &self.exchange,
                ExchangeKind::Topic,
                ExchangeDeclareOptions {
                    passive: false,
                    durable: true,
                    auto_delete: false,
                    internal: false,
                    nowait: false,
                },
                FieldTable::default(),
            )
            .await
            .map_err(|e| anyhow::anyhow!("Failed to declare exchange '{}': {}", self.exchange, e))
    }

    async fn process_delivery(
        delivery: Delivery,
        handler: Arc<Box<dyn Fn(QueueMessage) -> anyhow::Result<()> + Send + Sync>>,
    ) {
        let payload = delivery.data.clone();
        match serde_json::from_slice::<QueueMessage>(&payload) {
            Ok(message) => {
                if let Err(err) = handler(message) {
                    error!("Queue handler error: {}", err);
                    if let Err(nack_err) = delivery
                        .nack(BasicNackOptions {
                            requeue: true,
                            multiple: false,
                        })
                        .await
                    {
                        error!("Failed to NACK message: {}", nack_err);
                    }
                    return;
                }

                if let Err(ack_err) = delivery.ack(BasicAckOptions::default()).await {
                    error!("Failed to ACK message: {}", ack_err);
                }
            }
            Err(err) => {
                let routing_key = delivery.routing_key.clone();
                let mut recovered = false;

                if let Ok(value) = serde_json::from_slice::<serde_json::Value>(&payload) {
                    if value.get("batch_id").is_some()
                        && routing_key.as_str() == "ecommerce.product.sync.batch"
                    {
                        let fallback = QueueMessage {
                            id: uuid::Uuid::new_v4().to_string(),
                            job_type: JobType::ProductSync,
                            priority: JobPriority::default(),
                            payload: value.clone(),
                            retry_count: 0,
                            max_retries: 3,
                            created_at: Utc::now(),
                            scheduled_at: None,
                            expires_at: None,
                            correlation_id: value
                                .get("batch_id")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                            metadata: None,
                        };

                        if let Err(handler_err) = handler(fallback) {
                            error!("Queue handler error: {}", handler_err);
                            if let Err(nack_err) = delivery
                                .nack(BasicNackOptions {
                                    requeue: true,
                                    multiple: false,
                                })
                                .await
                            {
                                error!("Failed to NACK message: {}", nack_err);
                            }
                        } else if let Err(ack_err) = delivery.ack(BasicAckOptions::default()).await
                        {
                            error!("Failed to ACK message: {}", ack_err);
                        }
                        recovered = true;
                    }
                }

                if recovered {
                    return;
                }

                error!("Failed to deserialize queue message: {}", err);
                if let Err(reject_err) = delivery
                    .nack(BasicNackOptions {
                        requeue: false,
                        multiple: false,
                    })
                    .await
                {
                    error!("Failed to reject invalid message: {}", reject_err);
                }
            }
        }
    }
}

#[async_trait]
impl MessageQueue for RabbitMqQueue {
    fn as_any(&self) -> &dyn Any {
        self
    }

    async fn publish_bytes(&self, subject: &str, payload: Vec<u8>) -> anyhow::Result<()> {
        self.declare_exchange().await?;

        self.publish_channel
            .basic_publish(
                &self.exchange,
                subject,
                BasicPublishOptions {
                    mandatory: false,
                    immediate: false,
                },
                &payload,
                BasicProperties::default(),
            )
            .await
            .map_err(|e| anyhow::anyhow!("Failed to publish message: {}", e))?
            .await
            .map_err(|e| anyhow::anyhow!("Publish confirmation failed: {}", e))?;

        info!("Published message to subject '{}'", subject);
        Ok(())
    }

    async fn subscribe_bytes(
        &self,
        subject: &str,
        handler: Box<dyn Fn(Vec<u8>) -> anyhow::Result<()> + Send + Sync>,
    ) -> anyhow::Result<()> {
        self.declare_exchange().await?;

        let channel = self
            .connection
            .create_channel()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to create channel: {}", e))?;

        channel
            .basic_qos(self.prefetch_count, BasicQosOptions { global: false })
            .await
            .map_err(|e| anyhow::anyhow!("Failed to configure QoS: {}", e))?;

        let queue = channel
            .queue_declare(
                "",
                QueueDeclareOptions {
                    passive: false,
                    durable: false,
                    exclusive: true,
                    auto_delete: true,
                    nowait: false,
                },
                FieldTable::default(),
            )
            .await
            .map_err(|e| anyhow::anyhow!("Failed to declare temporary queue: {}", e))?;

        channel
            .queue_bind(
                queue.name().as_str(),
                &self.exchange,
                subject,
                QueueBindOptions { nowait: false },
                FieldTable::default(),
            )
            .await
            .map_err(|e| anyhow::anyhow!("Failed to bind queue: {}", e))?;

        let handler = Arc::new(handler);
        let mut consumer = channel
            .basic_consume(
                queue.name().as_str(),
                "",
                BasicConsumeOptions::default(),
                FieldTable::default(),
            )
            .await
            .map_err(|e| anyhow::anyhow!("Failed to start consumer: {}", e))?;

        tokio::spawn(async move {
            let handler = handler.clone();
            while let Some(delivery) = consumer.next().await {
                match delivery {
                    Ok(delivery) => {
                        let payload = delivery.data.clone();
                        if let Err(err) = handler(payload) {
                            error!("Raw handler error: {}", err);
                        }
                        if let Err(ack_err) = delivery.ack(BasicAckOptions::default()).await {
                            error!("Failed to ACK message: {}", ack_err);
                        }
                    }
                    Err(err) => error!("Error receiving message: {}", err),
                }
            }
        });

        Ok(())
    }

    async fn create_durable_consumer(
        &self,
        _stream: &str,
        consumer_name: &str,
        subject: &str,
    ) -> anyhow::Result<()> {
        self.declare_exchange().await?;

        let queue_name = self.make_queue_name(consumer_name);
        let channel = self
            .connection
            .create_channel()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to create channel: {}", e))?;

        channel
            .queue_declare(
                &queue_name,
                QueueDeclareOptions {
                    passive: false,
                    durable: true,
                    exclusive: false,
                    auto_delete: false,
                    nowait: false,
                },
                FieldTable::default(),
            )
            .await
            .map_err(|e| anyhow::anyhow!("Failed to declare queue '{}': {}", queue_name, e))?;

        let routing_keys = Self::expand_routing_keys(subject);
        if routing_keys.is_empty() {
            return Err(anyhow::anyhow!(
                "Routing key cannot be empty for consumer '{}'",
                consumer_name
            ));
        }

        for routing_key in &routing_keys {
            channel
                .queue_bind(
                    &queue_name,
                    &self.exchange,
                    routing_key,
                    QueueBindOptions { nowait: false },
                    FieldTable::default(),
                )
                .await
                .map_err(|e| {
                    anyhow::anyhow!(
                        "Failed to bind queue '{}' with routing key '{}': {}",
                        queue_name,
                        routing_key,
                        e
                    )
                })?;
        }

        let mut bindings = self.consumer_bindings.lock().unwrap();
        bindings.insert(
            consumer_name.to_string(),
            ConsumerBinding {
                queue: queue_name.clone(),
                routing_keys: routing_keys.clone(),
            },
        );

        info!(
            "Registered RabbitMQ consumer '{}' on queue '{}' (subjects '{}')",
            consumer_name,
            queue_name,
            routing_keys.join(", ")
        );

        Ok(())
    }

    async fn pull(
        &self,
        _count: usize,
    ) -> anyhow::Result<Vec<crate::infrastructure::queue::traits::QueueMessage>> {
        warn!("RabbitMqQueue::pull is not implemented; returning empty set");
        Ok(Vec::new())
    }

    async fn ack(&self, _message_id: &str) -> anyhow::Result<()> {
        Ok(())
    }

    async fn subscribe(
        &self,
        handler: Box<
            dyn Fn(crate::infrastructure::queue::traits::QueueMessage) -> anyhow::Result<()>
                + Send
                + Sync,
        >,
    ) -> anyhow::Result<()> {
        let bindings = {
            let bindings = self.consumer_bindings.lock().unwrap();
            if bindings.is_empty() {
                warn!("No consumer bindings configured before subscribe()");
            }
            bindings.clone()
        };

        let handler = Arc::new(handler);

        for (name, binding) in bindings {
            let channel =
                self.connection.create_channel().await.map_err(|e| {
                    anyhow::anyhow!("Failed to create channel for '{}': {}", name, e)
                })?;

            channel
                .basic_qos(self.prefetch_count, BasicQosOptions { global: false })
                .await
                .map_err(|e| anyhow::anyhow!("Failed to set QoS for '{}': {}", name, e))?;

            for routing_key in &binding.routing_keys {
                channel
                    .queue_bind(
                        &binding.queue,
                        &self.exchange,
                        routing_key,
                        QueueBindOptions { nowait: false },
                        FieldTable::default(),
                    )
                    .await
                    .map_err(|e| {
                        anyhow::anyhow!(
                            "Failed to bind queue '{}' with routing key '{}': {}",
                            binding.queue,
                            routing_key,
                            e
                        )
                    })?;
            }

            let mut consumer = channel
                .basic_consume(
                    &binding.queue,
                    &format!("{}_consumer", name),
                    BasicConsumeOptions::default(),
                    FieldTable::default(),
                )
                .await
                .map_err(|e| anyhow::anyhow!("Failed to start consumer '{}': {}", name, e))?;

            let handler_clone = handler.clone();
            let task = tokio::spawn(async move {
                while let Some(result) = consumer.next().await {
                    match result {
                        Ok(delivery) => {
                            RabbitMqQueue::process_delivery(delivery, handler_clone.clone()).await;
                        }
                        Err(err) => error!("Consumer '{}' error: {}", name, err),
                    }
                }
            });

            self.consumer_tasks.lock().unwrap().push(task);
        }

        Ok(())
    }

    async fn close(&self) -> anyhow::Result<()> {
        let tasks = self
            .consumer_tasks
            .lock()
            .unwrap()
            .drain(..)
            .collect::<Vec<_>>();
        for task in tasks {
            if let Err(err) = task.await {
                error!("Consumer task error during shutdown: {}", err);
            }
        }

        self.connection
            .close(0, "shutdown")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to close RabbitMQ connection: {}", e))
    }
}
