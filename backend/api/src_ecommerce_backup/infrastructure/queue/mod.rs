/// โมดูล Message Queue Infrastructure - ระบบ Message Queue แบบรวมศูนย์
///
/// โมดูลนี้จัดการระบบ message queue ที่รองรับหลาย backend implementations
/// รวมทั้ง RabbitMQ และ in-memory queue สำหรับการทดสอบ
///
/// # คุณสมบัติ
/// - MessageQueue trait สำหรับ unified interface
/// - MessageQueueExt trait สำหรับ convenience methods
/// - AckHandle สำหรับ message acknowledgment
/// - รองรับทั้ง async publish/subscribe และ pull-based consumers
/// - Durable consumers สำหรับ reliable message delivery
/// - Retry policies สำหรับ error handling
///
/// # Architecture
/// - traits.rs: กำหนด core interfaces
/// - rabbitmq.rs: RabbitMQ implementation
/// - memory.rs: In-memory implementation สำหรับการทดสอบ
/// - retry.rs: Retry policies และ backoff strategies
///
/// # ตัวอย่างการใช้งาน
/// ```rust
/// use infrastructure::queue::{RabbitMqQueue, MessageQueue};
///
/// let queue = RabbitMqQueue::new(&config).await?;
/// queue.publish("product.sync", &product_data).await?;
/// ```
use async_trait::async_trait;
use std::any::Any;
use std::sync::Arc;

/// Handle สำหรับการ acknowledge message processing
///
/// Struct นี้ encapsulate การ acknowledge message เพื่อให้ message queue
/// ทราบว่า message ได้รับการประมวลผลเรียบร้อยแล้ว
pub struct AckHandle {
    /// Inner function สำหรับการ acknowledge
    inner: Arc<dyn Fn() -> anyhow::Result<()> + Send + Sync>,
}

impl AckHandle {
    /// สร้าง AckHandle ใหม่จาก closure
    ///
    /// # Parameters
    /// - `f`: closure ที่จะถูกเรียกเมื่อต้องการ acknowledge message
    pub fn new<F>(f: F) -> Self
    where
        F: Fn() -> anyhow::Result<()> + Send + Sync + 'static,
    {
        Self { inner: Arc::new(f) }
    }

    /// Acknowledge message เพื่อบอกให้ message queue ทราบว่าประมวลผลเสร็จแล้ว
    ///
    /// # Returns
    /// `Ok(())` หาก acknowledge สำเร็จ, `Err` หากมีปัญหา
    pub fn ack(&self) -> anyhow::Result<()> {
        (self.inner)()
    }
}

/// Unified message queue trait สำหรับ backend implementations ต่างๆ
///
/// Trait นี้กำหนด interface มาตรฐานสำหรับการใช้งาน message queue
/// ที่สามารถใช้กับ RabbitMQ, in-memory queue, หรือ queue อื่นๆ
#[async_trait]
pub trait MessageQueue: Send + Sync {
    /// แปลง self เป็น Any type สำหรับ downcasting
    fn as_any(&self) -> &dyn Any;

    /// Publish ข้อมูล bytes ไปยัง subject/queue
    ///
    /// # Parameters
    /// - `subject`: ชื่อ subject หรือ queue
    /// - `payload`: ข้อมูลที่ต้องการส่งในรูปแบบ bytes
    async fn publish_bytes(&self, subject: &str, payload: Vec<u8>) -> anyhow::Result<()>;

    /// Subscribe เพื่อรับข้อมูล bytes จาก subject/queue
    ///
    /// # Parameters
    /// - `subject`: ชื่อ subject หรือ queue ที่ต้องการ subscribe
    /// - `handler`: function สำหรับประมวลผล message ที่เข้ามา
    async fn subscribe_bytes(
        &self,
        subject: &str,
        handler: Box<dyn Fn(Vec<u8>) -> anyhow::Result<()> + Send + Sync>,
    ) -> anyhow::Result<()>;

    /// Create a durable consumer for persistent message delivery
    async fn create_durable_consumer(
        &self,
        stream: &str,
        consumer_name: &str,
        subject: &str,
    ) -> anyhow::Result<()>;

    /// Pull messages from the queue (for polling)
    async fn pull(
        &self,
        count: usize,
    ) -> anyhow::Result<Vec<crate::infrastructure::queue::traits::QueueMessage>>;

    /// Acknowledge a message
    async fn ack(&self, message_id: &str) -> anyhow::Result<()>;

    /// Subscribe with a boxed handler function
    async fn subscribe(
        &self,
        handler: Box<
            dyn Fn(crate::infrastructure::queue::traits::QueueMessage) -> anyhow::Result<()>
                + Send
                + Sync,
        >,
    ) -> anyhow::Result<()>;

    /// Close the queue connection
    async fn close(&self) -> anyhow::Result<()>;
}

/// Extension trait for MessageQueue with generic methods
#[async_trait]
pub trait MessageQueueExt: MessageQueue {
    /// Helper to publish a serializable message
    async fn publish<T: serde::Serialize + Send + Sync>(
        &self,
        subject: &str,
        message: &T,
    ) -> anyhow::Result<()> {
        let payload = serde_json::to_vec(message)?;
        self.publish_bytes(subject, payload).await
    }

    /// Helper to subscribe with a closure instead of a boxed trait object
    async fn subscribe<F>(&self, subject: &str, handler: F) -> anyhow::Result<()>
    where
        F: Fn(Vec<u8>) -> anyhow::Result<()> + Send + Sync + 'static,
    {
        self.subscribe_bytes(subject, Box::new(handler)).await
    }
}

impl<T: MessageQueue + ?Sized> MessageQueueExt for T {}

pub mod jetstream_config;
pub mod memory;
pub mod rabbitmq;
pub mod retry;
pub mod traits;

pub use jetstream_config::*;
pub use memory::MemoryQueue;
pub use rabbitmq::RabbitMqQueue;
pub use retry::RetryPolicy;
pub use traits::{JobPriority, JobType, Queue, QueueConfig, QueueMessage, QueueStats};
