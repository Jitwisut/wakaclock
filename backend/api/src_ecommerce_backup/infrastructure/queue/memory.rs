//! In-memory Message Queue Implementation
//!
//! คิวแบบเก็บข้อมูลในหน่วยความจำ เหมาะสำหรับการทดสอบและการพัฒนา
//! ไม่มี persistence ข้อมูลจะหายเมื่อ restart

use super::MessageQueue;
use async_trait::async_trait;
use dashmap::DashMap;
use std::any::Any;
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

/// Handler function type สำหรับประมวลผลข้อความ
type MessageHandler = Arc<dyn Fn(Vec<u8>) -> anyhow::Result<()> + Send + Sync>;

/// In-memory message queue implementation
///
/// Type alias for message queue storage
type MessageQueueStorage = Arc<DashMap<String, Arc<RwLock<VecDeque<Vec<u8>>>>>>;

/// ใช้ DashMap สำหรับ concurrent access และ VecDeque สำหรับ FIFO ordering
/// เหมาะสำหรับการทดสอบและ development ไม่ต้องพึ่งพา external services
pub struct MemoryQueue {
    /// เก็บข้อความตาม subject/topic
    messages: MessageQueueStorage,
    /// เก็บ handlers สำหรับแต่ละ subject
    handlers: Arc<DashMap<String, Vec<MessageHandler>>>,
}

impl Default for MemoryQueue {
    fn default() -> Self {
        Self::new()
    }
}

impl MemoryQueue {
    pub fn new() -> Self {
        Self {
            messages: Arc::new(DashMap::new()),
            handlers: Arc::new(DashMap::new()),
        }
    }

    /// ประมวลผลข้อความด้วย handlers ที่ลงทะเบียนไว้
    ///
    /// เรียก handlers ทั้งหมดที่ subscribe กับ subject นี้
    async fn process_message(&self, subject: &str, message: Vec<u8>) {
        if let Some(handlers) = self.handlers.get(subject) {
            for handler in handlers.iter() {
                if let Err(e) = handler(message.clone()) {
                    tracing::error!("Handler error for subject {}: {:?}", subject, e);
                }
            }
        }
    }
}

#[async_trait]
impl MessageQueue for MemoryQueue {
    fn as_any(&self) -> &dyn Any {
        self
    }

    async fn publish_bytes(&self, subject: &str, payload: Vec<u8>) -> anyhow::Result<()> {
        // เก็บข้อความในคิวตาม subject
        let queue = self
            .messages
            .entry(subject.to_string())
            .or_insert_with(|| Arc::new(RwLock::new(VecDeque::new())));

        queue.write().await.push_back(payload.clone());

        // ประมวลผลทันทีหากมี handlers
        self.process_message(subject, payload).await;

        info!("Published message to memory queue subject: {}", subject);
        Ok(())
    }

    async fn subscribe_bytes(
        &self,
        subject: &str,
        handler: Box<dyn Fn(Vec<u8>) -> anyhow::Result<()> + Send + Sync>,
    ) -> anyhow::Result<()> {
        // เพิ่ม handler เข้าไปในรายการ
        self.handlers
            .entry(subject.to_string())
            .or_insert_with(Vec::new)
            .push(Arc::from(handler));

        // ประมวลผลข้อความที่ค้างอยู่ (ถ้ามี)
        if let Some(queue) = self.messages.get(subject) {
            let messages: Vec<Vec<u8>> = {
                let mut q = queue.write().await;
                q.drain(..).collect()
            };

            for message in messages {
                self.process_message(subject, message).await;
            }
        }

        info!("Subscribed to memory queue subject: {}", subject);
        Ok(())
    }

    async fn create_durable_consumer(
        &self,
        stream: &str,
        consumer_name: &str,
        subject: &str,
    ) -> anyhow::Result<()> {
        // สำหรับ memory queue ไม่มี persistence จึงเป็น no-op
        info!(
            "Created mock durable consumer '{}' on stream '{}' for subject '{}' (memory queue)",
            consumer_name, stream, subject
        );
        Ok(())
    }

    /// ดึงข้อความจากคิว (polling mode)
    async fn pull(
        &self,
        count: usize,
    ) -> anyhow::Result<Vec<crate::infrastructure::queue::traits::QueueMessage>> {
        // Memory queue ประมวลผลทันที จึงคืน empty list
        let _ = count;
        Ok(Vec::new())
    }

    /// Acknowledge ข้อความที่ประมวลผลเสร็จ
    async fn ack(&self, _message_id: &str) -> anyhow::Result<()> {
        // Memory queue ประมวลผลทันที ไม่ต้อง ack
        Ok(())
    }

    /// Subscribe ด้วย boxed handler function
    async fn subscribe(
        &self,
        _handler: Box<
            dyn Fn(crate::infrastructure::queue::traits::QueueMessage) -> anyhow::Result<()>
                + Send
                + Sync,
        >,
    ) -> anyhow::Result<()> {
        // ใช้ subscribe_bytes แทนสำหรับ memory queue
        Ok(())
    }

    /// ปิดการเชื่อมต่อ queue
    async fn close(&self) -> anyhow::Result<()> {
        // ล้างข้อมูลทั้งหมดใน memory queue
        self.messages.clear();
        self.handlers.clear();
        Ok(())
    }
}
