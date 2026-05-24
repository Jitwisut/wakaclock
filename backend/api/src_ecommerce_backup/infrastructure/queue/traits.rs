//! ไฟล์ traits.rs - Queue system traits และ shared types
//! จัดการ traits และ types ที่ใช้ร่วมกันในระบบ queue
//! รองรับ job types, priorities, และ queue operations สำหรับ message processing
//! ใช้เป็น interface สำหรับ queue implementations ต่างๆ

use crate::model::error::AppResult;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// JobType - ประเภทของ jobs ที่รองรับในระบบ queue
/// กำหนด job types ต่างๆ ที่สามารถส่งผ่าน queue system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobType {
    /// การ sync ข้อมูลสินค้า
    ProductSync,
    /// การ sync vector embeddings
    VectorSync,
    /// การส่ง webhook notifications
    WebhookDelivery,
    /// การส่ง email notifications
    EmailNotification,
    /// การ export ข้อมูล
    DataExport,
    /// การอัพเดท inventory
    InventoryUpdate,
    /// การอัพเดทราคาสินค้า
    PriceUpdate,
    /// การ sync orders
    OrderSync,
}

/// JobPriority - ระดับความสำคัญของ jobs
/// กำหนดลำดับความสำคัญสำหรับการประมวลผล jobs ใน queue
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum JobPriority {
    /// ความสำคัญต่ำ
    Low = 0,
    /// ความสำคัญปกติ
    Normal = 1,
    /// ความสำคัญสูง
    High = 2,
    /// ความสำคัญวิกฤติ (ประมวลผลก่อนหมด)
    Critical = 3,
}

impl Default for JobPriority {
    fn default() -> Self {
        Self::Normal
    }
}

/// Message structure for queue operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueMessage {
    /// Unique message ID
    pub id: String,

    /// Job type
    pub job_type: JobType,

    /// Priority level
    pub priority: JobPriority,

    /// Message payload (JSON)
    pub payload: serde_json::Value,

    /// Number of retry attempts
    pub retry_count: u32,

    /// Maximum retry attempts
    pub max_retries: u32,

    /// Timestamp when the message was created
    pub created_at: DateTime<Utc>,

    /// Timestamp when the message should be processed
    pub scheduled_at: Option<DateTime<Utc>>,

    /// Timestamp when the message expires
    pub expires_at: Option<DateTime<Utc>>,

    /// Optional correlation ID for tracking related messages
    pub correlation_id: Option<String>,

    /// Optional metadata
    pub metadata: Option<serde_json::Value>,
}

impl QueueMessage {
    /// Create a new queue message
    pub fn new(job_type: JobType, payload: serde_json::Value) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            job_type,
            priority: JobPriority::default(),
            payload,
            retry_count: 0,
            max_retries: 3,
            created_at: Utc::now(),
            scheduled_at: None,
            expires_at: None,
            correlation_id: None,
            metadata: None,
        }
    }

    /// Set the priority
    pub fn with_priority(mut self, priority: JobPriority) -> Self {
        self.priority = priority;
        self
    }

    /// Set the maximum retry attempts
    pub fn with_max_retries(mut self, max_retries: u32) -> Self {
        self.max_retries = max_retries;
        self
    }

    /// Schedule the message for later processing
    pub fn with_delay(mut self, delay: Duration) -> Self {
        self.scheduled_at = Some(Utc::now() + chrono::Duration::from_std(delay).unwrap());
        self
    }

    /// Set message expiration
    pub fn with_expiration(mut self, duration: Duration) -> Self {
        self.expires_at = Some(Utc::now() + chrono::Duration::from_std(duration).unwrap());
        self
    }

    /// Set correlation ID
    pub fn with_correlation_id(mut self, correlation_id: String) -> Self {
        self.correlation_id = Some(correlation_id);
        self
    }

    /// Check if the message has expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            Utc::now() > expires_at
        } else {
            false
        }
    }

    /// Check if the message is ready to be processed
    pub fn is_ready(&self) -> bool {
        if let Some(scheduled_at) = self.scheduled_at {
            Utc::now() >= scheduled_at
        } else {
            true
        }
    }

    /// Check if the message can be retried
    pub fn can_retry(&self) -> bool {
        self.retry_count < self.max_retries
    }

    /// Increment retry count
    pub fn increment_retry(&mut self) {
        self.retry_count += 1;
    }
}

/// Queue configuration
#[derive(Debug, Clone)]
pub struct QueueConfig {
    /// Queue name/subject
    pub name: String,

    /// Enable durable queue (for brokers that support persistence)
    pub durable: bool,

    /// Maximum number of consumers
    pub max_consumers: Option<u32>,

    /// Message retention policy
    pub retention_days: Option<u32>,

    /// Maximum queue size in bytes
    pub max_bytes: Option<i64>,

    /// Enable message deduplication
    pub deduplication: bool,

    /// Dead letter queue name
    pub dead_letter_queue: Option<String>,
}

impl Default for QueueConfig {
    fn default() -> Self {
        Self {
            name: "default".to_string(),
            durable: true,
            max_consumers: None,
            retention_days: Some(7),
            max_bytes: None,
            deduplication: false,
            dead_letter_queue: None,
        }
    }
}

/// Queue trait for message queue operations
#[async_trait]
pub trait Queue: Send + Sync {
    /// Initialize the queue
    async fn initialize(&self, config: QueueConfig) -> AppResult<()>;

    /// Publish a message to the queue
    async fn publish(&self, message: QueueMessage) -> AppResult<String>;

    /// Publish multiple messages
    async fn publish_batch(&self, messages: Vec<QueueMessage>) -> AppResult<Vec<String>>;

    /// Subscribe to the queue and process messages
    async fn subscribe(
        &self,
        handler: Box<dyn Fn(QueueMessage) -> AppResult<()> + Send + Sync>,
    ) -> AppResult<()>;

    /// Pull messages from the queue (for polling)
    async fn pull(&self, count: usize) -> AppResult<Vec<QueueMessage>>;

    /// Acknowledge a message
    async fn ack(&self, message_id: &str) -> AppResult<()>;

    /// Negative acknowledge a message (requeue)
    async fn nack(&self, message_id: &str) -> AppResult<()>;

    /// Get queue statistics
    async fn stats(&self) -> AppResult<QueueStats>;

    /// Purge all messages from the queue
    async fn purge(&self) -> AppResult<u64>;

    /// Close the queue connection
    async fn close(&self) -> AppResult<()>;
}

/// Queue statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueStats {
    /// Queue name
    pub name: String,

    /// Number of messages in the queue
    pub message_count: u64,

    /// Number of consumers
    pub consumer_count: u32,

    /// Number of messages published
    pub messages_published: u64,

    /// Number of messages consumed
    pub messages_consumed: u64,

    /// Queue size in bytes
    pub bytes: u64,

    /// First message timestamp
    pub first_timestamp: Option<DateTime<Utc>>,

    /// Last message timestamp
    pub last_timestamp: Option<DateTime<Utc>>,
}
