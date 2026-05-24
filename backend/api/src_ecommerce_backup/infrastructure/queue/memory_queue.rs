//! ไฟล์ memory_queue.rs - In-memory queue implementation
//! จัดการ message queue แบบ in-memory สำหรับ development และ testing
//! รองรับ pub/sub patterns และ message delivery guarantees ในหน่วยความจำ
//! ใช้สำหรับ environment ที่ไม่ต้องการ persistent messaging

use async_trait::async_trait;
use std::{
    collections::{BinaryHeap, HashMap},
    sync::{Arc, Mutex},
};
use tracing::{debug, info};

use super::traits::{Queue, QueueConfig, QueueMessage, QueueStats};
use crate::model::error::{AppError, AppResult};

/// PriorityMessage - Wrapper สำหรับ messages ใน heap
/// ใช้สำหรับจัดลำดับ priority และ sequence ใน binary heap
#[derive(Debug, Clone)]
struct PriorityMessage {
    message: QueueMessage,
    sequence: u64,
}

impl PartialEq for PriorityMessage {
    fn eq(&self, other: &Self) -> bool {
        self.message.priority == other.message.priority && self.sequence == other.sequence
    }
}

impl Eq for PriorityMessage {}

impl PartialOrd for PriorityMessage {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PriorityMessage {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        // Higher priority first, then earlier sequence
        match self.message.priority.cmp(&other.message.priority) {
            std::cmp::Ordering::Equal => other.sequence.cmp(&self.sequence), // Earlier sequence first
            other => other,
        }
    }
}

/// MemoryQueue - In-memory queue implementation สำหรับ testing และ development
/// จัดการ message queue ที่เก็บข้อมูลในหน่วยความจำ รองรับ priority queuing และ retry logic
pub struct MemoryQueue {
    /// Configuration ของ queue
    config: Arc<Mutex<Option<QueueConfig>>>,

    /// Binary heap สำหรับจัดเก็บ messages ตาม priority
    messages: Arc<Mutex<BinaryHeap<PriorityMessage>>>,

    /// HashMap เก็บ messages ที่กำลังถูกประมวลผล
    pending: Arc<Mutex<HashMap<String, QueueMessage>>>,

    /// สถิติการใช้งาน queue
    stats: Arc<Mutex<InternalStats>>,

    /// Sequence number สำหรับจัดลำดับ messages
    sequence: Arc<Mutex<u64>>,
}

#[derive(Debug, Default)]
struct InternalStats {
    messages_published: u64,
    messages_consumed: u64,
    total_bytes: u64,
}

impl MemoryQueue {
    /// Create a new memory queue
    pub fn new() -> Self {
        Self {
            config: Arc::new(Mutex::new(None)),
            messages: Arc::new(Mutex::new(BinaryHeap::new())),
            pending: Arc::new(Mutex::new(HashMap::new())),
            stats: Arc::new(Mutex::new(InternalStats::default())),
            sequence: Arc::new(Mutex::new(0)),
        }
    }

    fn get_next_sequence(&self) -> u64 {
        let mut seq = self.sequence.lock().unwrap();
        *seq += 1;
        *seq
    }
}

impl Default for MemoryQueue {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Queue for MemoryQueue {
    async fn initialize(&self, config: QueueConfig) -> AppResult<()> {
        let mut cfg = self.config.lock().unwrap();
        *cfg = Some(config.clone());

        info!("Memory queue '{}' initialized", config.name);
        Ok(())
    }

    async fn publish(&self, message: QueueMessage) -> AppResult<String> {
        if message.is_expired() {
            return Err(AppError::ValidationError("Message has expired".to_string()));
        }

        let id = message.id.clone();
        let sequence = self.get_next_sequence();

        let mut messages = self.messages.lock().unwrap();
        messages.push(PriorityMessage { message, sequence });

        let mut stats = self.stats.lock().unwrap();
        stats.messages_published += 1;

        debug!("Published message {} to memory queue", id);
        Ok(id)
    }

    async fn publish_batch(&self, messages: Vec<QueueMessage>) -> AppResult<Vec<String>> {
        let mut ids = Vec::new();

        for message in messages {
            ids.push(self.publish(message).await?);
        }

        Ok(ids)
    }

    async fn subscribe(
        &self,
        handler: Box<dyn Fn(QueueMessage) -> AppResult<()> + Send + Sync>,
    ) -> AppResult<()> {
        info!("Starting memory queue subscription");

        loop {
            let message = {
                let mut messages = self.messages.lock().unwrap();

                // Find next ready message
                let mut ready_msg = None;
                let mut temp = Vec::new();

                while let Some(priority_msg) = messages.pop() {
                    if priority_msg.message.is_expired() {
                        continue; // Skip expired messages
                    }

                    if priority_msg.message.is_ready() {
                        ready_msg = Some(priority_msg.message);
                        break;
                    } else {
                        temp.push(priority_msg);
                    }
                }

                // Put back non-ready messages
                for msg in temp {
                    messages.push(msg);
                }

                ready_msg
            };

            if let Some(mut message) = message {
                let msg_id = message.id.clone();

                // Add to pending
                {
                    let mut pending = self.pending.lock().unwrap();
                    pending.insert(msg_id.clone(), message.clone());
                }

                // Process message
                match handler(message.clone()) {
                    Ok(_) => {
                        // Remove from pending
                        {
                            let mut pending = self.pending.lock().unwrap();
                            pending.remove(&msg_id);
                        }

                        {
                            let mut stats = self.stats.lock().unwrap();
                            stats.messages_consumed += 1;
                        }
                    }
                    Err(e) => {
                        debug!("Failed to process message {}: {}", msg_id, e);

                        // Remove from pending and check if retry is needed
                        let should_retry = {
                            let mut pending = self.pending.lock().unwrap();
                            pending.remove(&msg_id);
                            message.can_retry()
                        };

                        // Retry if possible (outside of lock)
                        if should_retry {
                            message.increment_retry();
                            let _ = self.publish(message).await;
                        }
                    }
                }
            } else {
                // No messages available, wait a bit
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        }
    }

    async fn pull(&self, count: usize) -> AppResult<Vec<QueueMessage>> {
        let mut messages = self.messages.lock().unwrap();
        let mut result = Vec::new();
        let mut temp = Vec::new();

        while result.len() < count && !messages.is_empty() {
            if let Some(priority_msg) = messages.pop() {
                if priority_msg.message.is_expired() {
                    continue;
                }

                if priority_msg.message.is_ready() {
                    let msg = priority_msg.message.clone();
                    let msg_id = msg.id.clone();

                    // Add to pending
                    let mut pending = self.pending.lock().unwrap();
                    pending.insert(msg_id, msg.clone());

                    result.push(msg);
                } else {
                    temp.push(priority_msg);
                }
            }
        }

        // Put back non-ready messages
        for msg in temp {
            messages.push(msg);
        }

        Ok(result)
    }

    async fn ack(&self, message_id: &str) -> AppResult<()> {
        let mut pending = self.pending.lock().unwrap();

        if pending.remove(message_id).is_some() {
            let mut stats = self.stats.lock().unwrap();
            stats.messages_consumed += 1;
            Ok(())
        } else {
            Err(AppError::NotFound(format!(
                "Message {} not found",
                message_id
            )))
        }
    }

    async fn nack(&self, message_id: &str) -> AppResult<()> {
        let message_to_retry = {
            let mut pending = self.pending.lock().unwrap();

            if let Some(mut message) = pending.remove(message_id) {
                // Check if message can be retried
                if message.can_retry() {
                    message.increment_retry();
                    Some(message)
                } else {
                    None
                }
            } else {
                return Err(AppError::NotFound(format!(
                    "Message {} not found",
                    message_id
                )));
            }
        };

        // Requeue the message outside of the lock
        if let Some(message) = message_to_retry {
            self.publish(message).await?;
        }

        Ok(())
    }

    async fn stats(&self) -> AppResult<QueueStats> {
        let config = self.config.lock().unwrap();
        let messages = self.messages.lock().unwrap();
        let pending = self.pending.lock().unwrap();
        let stats = self.stats.lock().unwrap();

        Ok(QueueStats {
            name: config
                .as_ref()
                .map(|c| c.name.clone())
                .unwrap_or_else(|| "memory".to_string()),
            message_count: messages.len() as u64 + pending.len() as u64,
            consumer_count: 1, // Always 1 for memory queue
            messages_published: stats.messages_published,
            messages_consumed: stats.messages_consumed,
            bytes: stats.total_bytes,
            first_timestamp: None,
            last_timestamp: None,
        })
    }

    async fn purge(&self) -> AppResult<u64> {
        let mut messages = self.messages.lock().unwrap();
        let count = messages.len() as u64;
        messages.clear();

        let mut pending = self.pending.lock().unwrap();
        let pending_count = pending.len() as u64;
        pending.clear();

        Ok(count + pending_count)
    }

    async fn close(&self) -> AppResult<()> {
        let mut messages = self.messages.lock().unwrap();
        messages.clear();

        let mut pending = self.pending.lock().unwrap();
        pending.clear();

        info!("Memory queue closed");
        Ok(())
    }
}
