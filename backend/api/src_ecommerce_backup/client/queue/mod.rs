pub mod memory;
pub mod rabbitmq;

use crate::infrastructure::app::App;
use crate::interfaces::QueueInterface;
use anyhow::Result;
use std::sync::Arc;

/// Queue manager for selecting queue implementation
pub struct QueueManager;

impl QueueManager {
    /// Create queue based on configuration
    pub async fn create(queue_type: &str, url: &str) -> anyhow::Result<Arc<dyn QueueInterface>> {
        match queue_type {
            "rabbitmq" => Ok(Arc::new(rabbitmq::RabbitMqQueue::new(url).await?)),
            _ => Ok(Arc::new(memory::MemoryQueue::new())),
        }
    }
}

/// Queue client for managing queue operations
pub struct QueueClient {
    app: Arc<App>,
}

impl QueueClient {
    pub fn new(app: Arc<App>) -> Self {
        Self { app }
    }

    /// Publish message to queue
    pub async fn publish<T: serde::Serialize>(&self, subject: &str, message: &T) -> Result<()> {
        let json = serde_json::to_vec(message)?;
        self.app.queue.publish_bytes(subject, json).await
    }

    /// Subscribe to queue messages
    pub async fn subscribe(&self, _subject: &str) -> Result<()> {
        // Implementation for subscribing to messages
        Ok(())
    }
}
