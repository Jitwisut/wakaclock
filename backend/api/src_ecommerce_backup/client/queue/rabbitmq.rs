//! RabbitMQ Queue Client Implementation
//! Implements the `QueueInterface` trait on top of RabbitMQ.

use crate::interfaces::{
    InterfaceError, InterfaceResult, QueueInterface, QueueMessage, QueueStats, TopicConfig,
};
use async_trait::async_trait;
use futures::StreamExt;
use lapin::{
    message::Delivery,
    options::{
        BasicAckOptions, BasicConsumeOptions, BasicNackOptions, BasicPublishOptions,
        BasicQosOptions, ExchangeDeclareOptions, QueueBindOptions, QueueDeclareOptions,
        QueueDeleteOptions,
    },
    types::FieldTable,
    BasicProperties, Channel, Connection, ConnectionProperties, ExchangeKind,
};
use std::sync::Arc;
use tokio::task::JoinHandle;
use tokio_executor_trait::Tokio as TokioExecutor;
#[cfg(unix)]
use tokio_reactor_trait::Tokio as TokioReactor;
use tracing::{error, info, warn};

pub struct RabbitMqQueue {
    connection: Arc<Connection>,
    publish_channel: Channel,
    exchange: String,
    queue_prefix: String,
    prefetch_count: u16,
    consumer_tasks: Arc<tokio::sync::Mutex<Vec<JoinHandle<()>>>>,
}

impl RabbitMqQueue {
    pub async fn new(url: &str) -> InterfaceResult<Self> {
        Self::new_with_settings(url, "ecommerce", "ecommerce", 50).await
    }

    pub async fn new_with_settings(
        url: &str,
        exchange: &str,
        queue_prefix: &str,
        prefetch_count: u16,
    ) -> InterfaceResult<Self> {
        let properties = ConnectionProperties::default().with_executor(TokioExecutor::current());
        #[cfg(unix)]
        let properties = properties.with_reactor(TokioReactor);

        let connection = Connection::connect(url, properties)
            .await
            .map_err(|e| InterfaceError::ConnectionError(e.to_string()))?;

        let connection = Arc::new(connection);
        let publish_channel = connection
            .create_channel()
            .await
            .map_err(|e| InterfaceError::ConnectionError(e.to_string()))?;

        let queue = Self {
            connection: connection.clone(),
            publish_channel,
            exchange: exchange.to_string(),
            queue_prefix: queue_prefix.to_string(),
            prefetch_count,
            consumer_tasks: Arc::new(tokio::sync::Mutex::new(Vec::new())),
        };

        queue.declare_exchange().await?;
        Ok(queue)
    }

    fn make_queue_name(&self, topic: &str) -> String {
        format!("{}.{}", self.queue_prefix, topic.replace('.', "_"))
    }

    async fn declare_exchange(&self) -> InterfaceResult<()> {
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
            .map_err(|e| InterfaceError::OperationFailed(e.to_string()))
    }

    async fn handle_delivery(
        delivery: Delivery,
        handler: Arc<Box<dyn Fn(QueueMessage) -> InterfaceResult<()> + Send + Sync>>,
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
impl QueueInterface for RabbitMqQueue {
    async fn publish(&self, topic: &str, message: QueueMessage) -> InterfaceResult<String> {
        self.declare_exchange().await?;

        let payload = serde_json::to_vec(&message)
            .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;

        self.publish_channel
            .basic_publish(
                &self.exchange,
                topic,
                BasicPublishOptions {
                    mandatory: false,
                    immediate: false,
                },
                &payload,
                BasicProperties::default()
                    .with_message_id(message.id.clone().into())
                    .with_content_type("application/json".into()),
            )
            .await
            .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?
            .await
            .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?;

        info!("Published message {} to {}", message.id, topic);
        Ok(message.id)
    }

    async fn subscribe(
        &self,
        topic: &str,
        handler: Box<dyn Fn(QueueMessage) -> InterfaceResult<()> + Send + Sync>,
    ) -> InterfaceResult<()> {
        self.declare_exchange().await?;

        let channel = self
            .connection
            .create_channel()
            .await
            .map_err(|e| InterfaceError::ConnectionError(e.to_string()))?;

        channel
            .basic_qos(self.prefetch_count, BasicQosOptions { global: false })
            .await
            .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?;

        let queue_name = self.make_queue_name(topic);

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
            .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?;

        channel
            .queue_bind(
                &queue_name,
                &self.exchange,
                topic,
                QueueBindOptions { nowait: false },
                FieldTable::default(),
            )
            .await
            .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?;

        let mut consumer = channel
            .basic_consume(
                &queue_name,
                &format!("consumer_{}", topic.replace('.', "_")),
                BasicConsumeOptions::default(),
                FieldTable::default(),
            )
            .await
            .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?;

        let handler = Arc::new(handler);
        let topic_label = topic.to_string();

        let task = tokio::spawn(async move {
            while let Some(delivery) = consumer.next().await {
                match delivery {
                    Ok(delivery) => {
                        RabbitMqQueue::handle_delivery(delivery, handler.clone()).await;
                    }
                    Err(err) => {
                        error!("Consumer error on topic {}: {}", topic_label, err);
                    }
                }
            }
        });

        self.consumer_tasks.lock().await.push(task);

        Ok(())
    }

    async fn pull(&self, _topic: &str, _max_messages: usize) -> InterfaceResult<Vec<QueueMessage>> {
        warn!("RabbitMQ pull consumption is not implemented");
        Ok(Vec::new())
    }

    async fn ack(&self, _message_id: &str) -> InterfaceResult<()> {
        Ok(())
    }

    async fn nack(&self, _message_id: &str, _requeue: bool) -> InterfaceResult<()> {
        Ok(())
    }

    async fn publish_delayed(
        &self,
        topic: &str,
        message: QueueMessage,
        delay: std::time::Duration,
    ) -> InterfaceResult<String> {
        let queue = self.clone();
        let topic = topic.to_string();
        let message_id = message.id.clone();

        tokio::spawn(async move {
            tokio::time::sleep(delay).await;

            if let Err(err) = queue.publish(&topic, message).await {
                error!("Failed to publish delayed message: {}", err);
            }
        });

        Ok(message_id)
    }

    async fn stats(&self, _topic: &str) -> InterfaceResult<QueueStats> {
        Ok(QueueStats {
            messages_count: 0,
            messages_ready: 0,
            messages_unacked: 0,
            consumers_count: 0,
            publish_rate: 0.0,
            consume_rate: 0.0,
        })
    }

    async fn create_topic(&self, topic: &str, config: TopicConfig) -> InterfaceResult<()> {
        self.declare_exchange().await?;

        self.publish_channel
            .queue_declare(
                &self.make_queue_name(topic),
                QueueDeclareOptions {
                    passive: false,
                    durable: config.durable,
                    exclusive: false,
                    auto_delete: !config.durable || config.auto_delete,
                    nowait: false,
                },
                FieldTable::default(),
            )
            .await
            .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?;

        Ok(())
    }

    async fn delete_topic(&self, topic: &str) -> InterfaceResult<()> {
        self.publish_channel
            .queue_delete(
                &self.make_queue_name(topic),
                QueueDeleteOptions {
                    if_unused: false,
                    if_empty: false,
                    nowait: false,
                },
            )
            .await
            .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?;

        Ok(())
    }
}

impl Clone for RabbitMqQueue {
    fn clone(&self) -> Self {
        Self {
            connection: self.connection.clone(),
            publish_channel: self.publish_channel.clone(),
            exchange: self.exchange.clone(),
            queue_prefix: self.queue_prefix.clone(),
            prefetch_count: self.prefetch_count,
            consumer_tasks: Arc::clone(&self.consumer_tasks),
        }
    }
}
