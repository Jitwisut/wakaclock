// Queue Interface - อินเตอร์เฟสสำหรับ message queue implementations
// กำหนด standard interface สำหรับ RabbitMQ, Redis Queue, Memory Queue
// รองรับ pub/sub, pull-based consumption, ack/nack patterns

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::time::Duration;

use super::InterfaceResult;

/// QueueInterface - อินเตอร์เฟสสำหรับ message queue implementations
/// ใช้ในการ implement RabbitMQ, Redis, Memory queue และ queue อื่นๆ
#[async_trait]
pub trait QueueInterface: Send + Sync {
    /// publish - เผยแพร่ข้อความไปยัง topic ที่กำหนด
    /// คืนค่า message ID สำหรับ tracking
    async fn publish(&self, topic: &str, message: QueueMessage) -> InterfaceResult<String>;

    /// subscribe - ติดตาม topic ด้วย handler function
    /// ใช้ boxed handler เพื่อ dynamic dispatch compatibility
    async fn subscribe(
        &self,
        topic: &str,
        handler: Box<dyn Fn(QueueMessage) -> InterfaceResult<()> + Send + Sync>,
    ) -> InterfaceResult<()>;

    /// pull - ดึงข้อความจาก topic แบบ polling
    /// สำหรับ polling consumers ที่ไม่ใช้ push-based subscription
    async fn pull(&self, topic: &str, max_messages: usize) -> InterfaceResult<Vec<QueueMessage>>;

    /// ack - ยืนยันการประมวลผลข้อความสำเร็จ
    /// ลบข้อความออกจาก queue เมื่อประมวลผลสำเร็จ
    async fn ack(&self, message_id: &str) -> InterfaceResult<()>;

    /// nack - ปฏิเสธการประมวลผลข้อความ
    /// เลือกส่งข้อความกลับคิว (requeue) หรือทิ้ง
    async fn nack(&self, message_id: &str, requeue: bool) -> InterfaceResult<()>;

    /// publish_delayed - เผยแพร่ข้อความแบบหน่วงเวลา
    /// ส่งข้อความหลังจาก delay duration ที่กำหนด
    async fn publish_delayed(
        &self,
        topic: &str,
        message: QueueMessage,
        delay: Duration,
    ) -> InterfaceResult<String>;

    /// stats - ดึงสถิติของ queue/topic
    /// แสดงจำนวนข้อความ, consumers, rates
    async fn stats(&self, topic: &str) -> InterfaceResult<QueueStats>;

    /// create_topic - สร้าง topic/queue ใหม่หากยังไม่มี
    /// ใช้ TopicConfig เพื่อกำหนดค่า durable, retention policies
    async fn create_topic(&self, topic: &str, config: TopicConfig) -> InterfaceResult<()>;

    /// delete_topic - ลบ topic/queue
    /// ลบ topic และข้อมูลทั้งหมดที่เกี่ยวข้อง
    async fn delete_topic(&self, topic: &str) -> InterfaceResult<()>;
}

/// QueueMessage - โครงสร้างข้อความใน message queue
/// บรรจุ id, payload, headers, timestamp และ metadata ต่างๆ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueMessage {
    pub id: String,
    pub topic: String,
    pub payload: Vec<u8>,
    pub headers: std::collections::HashMap<String, String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub retry_count: u32,
    pub correlation_id: Option<String>,
}

impl QueueMessage {
    /// new - สร้างข้อความใหม่ด้วย topic และ payload
    /// สร้าง UUID, timestamp และเตรียม metadata อัตโนมัติ
    pub fn new(topic: String, payload: Vec<u8>) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            topic,
            payload,
            headers: std::collections::HashMap::new(),
            timestamp: chrono::Utc::now(),
            retry_count: 0,
            correlation_id: None,
        }
    }

    /// with_header - เพิ่ม header ให้กับข้อความ
    /// ใช้ builder pattern สำหรับเพิ่ม metadata
    pub fn with_header(mut self, key: String, value: String) -> Self {
        self.headers.insert(key, value);
        self
    }

    /// with_correlation_id - กำหนด correlation ID สำหรับ request tracing
    /// ใช้ในการ trace request flows ครอสส์ multiple services
    pub fn with_correlation_id(mut self, id: String) -> Self {
        self.correlation_id = Some(id);
        self
    }
}

/// QueueStats - สถิติการใช้งานของ queue/topic
/// แสดงจำนวนข้อความ, consumers, rates ต่างๆ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueStats {
    pub messages_count: u64,
    pub messages_ready: u64,
    pub messages_unacked: u64,
    pub consumers_count: u32,
    pub publish_rate: f64,
    pub consume_rate: f64,
}

/// TopicConfig - การตั้งค่าสำหรับ topic/queue
/// กำหนดค่า durability, retention, dead letter queues
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopicConfig {
    pub durable: bool,
    pub auto_delete: bool,
    pub max_messages: Option<u64>,
    pub max_age: Option<Duration>,
    pub dead_letter_topic: Option<String>,
    pub max_retries: Option<u32>,
}

impl Default for TopicConfig {
    fn default() -> Self {
        Self {
            durable: true,
            auto_delete: false,
            max_messages: None,
            max_age: None,
            dead_letter_topic: None,
            max_retries: Some(3),
        }
    }
}

/// QueueInterfaceExt - Extension trait สำหรับ QueueInterface
/// เพิ่ม convenience methods เช่น subscribe_with สำหรับ closures
#[async_trait]
pub trait QueueInterfaceExt: QueueInterface {
    /// subscribe_with - ติดตาม topic ด้วย closure
    /// สะดวกกว่าการใช้ boxed trait object
    async fn subscribe_with<F>(&self, topic: &str, handler: F) -> InterfaceResult<()>
    where
        F: Fn(QueueMessage) -> InterfaceResult<()> + Send + Sync + 'static,
    {
        self.subscribe(topic, Box::new(handler)).await
    }
}

impl<T: QueueInterface + ?Sized> QueueInterfaceExt for T {}
