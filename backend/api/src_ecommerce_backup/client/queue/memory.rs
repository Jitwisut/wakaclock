// MemoryQueue - การจัดการคิวในหน่วยความจำสำหรับการทดสอบ
// ใช้สำหรับการพัฒนาและทดสอบระบบคิวข้อความโดยไม่ต้องพึ่งพา RabbitMQ

use async_trait::async_trait;
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

use crate::interfaces::{InterfaceResult, QueueInterface, QueueMessage, QueueStats, TopicConfig};

/// MemoryQueue - การจัดการคิวในหน่วยความจำ
/// ใช้สำหรับการทดสอบและการพัฒนาแบบสถานีย์
/// จัดเก็บข้อความใน VecDeque พร้อม unacked messages tracking
pub struct MemoryQueue {
    topics: Arc<RwLock<HashMap<String, Topic>>>,
}

/// Topic - โครงสร้างข้อมูลสำหรับแต่ละหัวข้อข้อความ
/// จัดเก็บข้อความที่รอการประมวลผลและข้อความที่ยังไม่ได้ acknowledge
struct Topic {
    messages: VecDeque<QueueMessage>,       // คิวข้อความหลัก
    unacked: HashMap<String, QueueMessage>, // ข้อความที่ส่งไปแล้วแต่ยังไม่ได้ ack
    config: TopicConfig,                    // การกำหนดค่าหัวข้อ
    stats: TopicStats,                      // สถิติการใช้งาน
}

/// TopicStats - สถิติการใช้งานของแต่ละหัวข้อ
struct TopicStats {
    total_published: u64, // จำนวนข้อความที่เผยแพร่ทั้งหมด
    total_consumed: u64,  // จำนวนข้อความที่บริโภคทั้งหมด
}

impl MemoryQueue {
    /// new - สร้าง MemoryQueue ใหม่
    /// ใช้ HashMap เพื่อจัดเก็บหัวข้อต่างๆ พร้อม RwLock สำหรับ thread safety
    pub fn new() -> Self {
        Self {
            topics: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// get_or_create_topic - ดึงหัวข้อที่มีอยู่หรือสร้างใหม่
    /// สร้างหัวข้อใหม่ด้วยค่าเริ่มต้นหากไม่มี
    async fn get_or_create_topic(&self, topic_name: &str) -> Topic {
        let mut topics = self.topics.write().await;
        topics
            .entry(topic_name.to_string())
            .or_insert_with(|| Topic {
                messages: VecDeque::new(),
                unacked: HashMap::new(),
                config: TopicConfig::default(),
                stats: TopicStats {
                    total_published: 0,
                    total_consumed: 0,
                },
            })
            .clone()
    }
}

impl Clone for Topic {
    fn clone(&self) -> Self {
        Topic {
            messages: self.messages.clone(),
            unacked: self.unacked.clone(),
            config: self.config.clone(),
            stats: TopicStats {
                total_published: self.stats.total_published,
                total_consumed: self.stats.total_consumed,
            },
        }
    }
}

#[async_trait]
impl QueueInterface for MemoryQueue {
    /// publish - เผยแพร่ข้อความไปยังหัวข้อที่กำหนด
    /// เพิ่มข้อความใหม่ลงในคิวและอัพเดทสถิติ
    async fn publish(&self, topic: &str, message: QueueMessage) -> InterfaceResult<String> {
        let mut topics = self.topics.write().await;
        let topic_data = topics.entry(topic.to_string()).or_insert_with(|| Topic {
            messages: VecDeque::new(),
            unacked: HashMap::new(),
            config: TopicConfig::default(),
            stats: TopicStats {
                total_published: 0,
                total_consumed: 0,
            },
        });

        let message_id = message.id.clone();
        topic_data.messages.push_back(message);
        topic_data.stats.total_published += 1;

        Ok(message_id)
    }

    /// subscribe - ติดตามข้อความจากหัวข้อที่กำหนด
    /// สร้าง background task เพื่อประมวลผลข้อความอย่างต่อเนื่อง
    async fn subscribe(
        &self,
        topic: &str,
        handler: Box<dyn Fn(QueueMessage) -> InterfaceResult<()> + Send + Sync>,
    ) -> InterfaceResult<()> {
        let topics = self.topics.clone();
        let topic_name = topic.to_string();

        tokio::spawn(async move {
            loop {
                let message = {
                    let mut topics = topics.write().await;
                    topics
                        .get_mut(&topic_name)
                        .and_then(|t| t.messages.pop_front())
                };

                if let Some(msg) = message {
                    if let Err(e) = handler(msg) {
                        tracing::error!("Message handler error: {}", e);
                    }
                } else {
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }
            }
        });

        Ok(())
    }

    /// pull - ดึงข้อความจากคิวแบบ manual
    /// ดึงข้อความสูงสุดตามจำนวนที่กำหนดและย้ายไปยัง unacked
    async fn pull(&self, topic: &str, max_messages: usize) -> InterfaceResult<Vec<QueueMessage>> {
        let mut topics = self.topics.write().await;
        let topic_data = topics.entry(topic.to_string()).or_insert_with(|| Topic {
            messages: VecDeque::new(),
            unacked: HashMap::new(),
            config: TopicConfig::default(),
            stats: TopicStats {
                total_published: 0,
                total_consumed: 0,
            },
        });

        let mut result = Vec::new();
        for _ in 0..max_messages {
            if let Some(msg) = topic_data.messages.pop_front() {
                topic_data.unacked.insert(msg.id.clone(), msg.clone());
                topic_data.stats.total_consumed += 1;
                result.push(msg);
            } else {
                break;
            }
        }

        Ok(result)
    }

    /// ack - ยืนยันการประมวลผลข้อความสำเร็จ
    /// ลบข้อความออกจาก unacked map
    async fn ack(&self, message_id: &str) -> InterfaceResult<()> {
        let mut topics = self.topics.write().await;
        for topic in topics.values_mut() {
            topic.unacked.remove(message_id);
        }
        Ok(())
    }

    /// nack - ปฏิเสธการประมวลผลข้อความ
    /// ลบจาก unacked และเลือกส่งกลับคิวหรือทิ้ง
    async fn nack(&self, message_id: &str, requeue: bool) -> InterfaceResult<()> {
        let mut topics = self.topics.write().await;
        for topic in topics.values_mut() {
            if let Some(msg) = topic.unacked.remove(message_id) {
                if requeue {
                    topic.messages.push_front(msg);
                }
                break;
            }
        }
        Ok(())
    }

    /// publish_delayed - เผยแพร่ข้อความแบบหน่วงเวลา
    /// ใช้ tokio::spawn เพื่อรอเวลาและเผยแพร่ข้อความ
    async fn publish_delayed(
        &self,
        topic: &str,
        message: QueueMessage,
        delay: Duration,
    ) -> InterfaceResult<String> {
        let topics = self.topics.clone();
        let topic_name = topic.to_string();
        let message_id = message.id.clone();

        tokio::spawn(async move {
            tokio::time::sleep(delay).await;

            let mut topics = topics.write().await;
            let topic_data = topics.entry(topic_name).or_insert_with(|| Topic {
                messages: VecDeque::new(),
                unacked: HashMap::new(),
                config: TopicConfig::default(),
                stats: TopicStats {
                    total_published: 0,
                    total_consumed: 0,
                },
            });

            topic_data.messages.push_back(message);
            topic_data.stats.total_published += 1;
        });

        Ok(message_id)
    }

    /// stats - ดึงสถิติการใช้งานของหัวข้อ
    /// แสดงจำนวนข้อความ สถานะ และอัตราการใช้งาน
    async fn stats(&self, topic: &str) -> InterfaceResult<QueueStats> {
        let topics = self.topics.read().await;

        if let Some(topic_data) = topics.get(topic) {
            Ok(QueueStats {
                messages_count: topic_data.messages.len() as u64,
                messages_ready: topic_data.messages.len() as u64,
                messages_unacked: topic_data.unacked.len() as u64,
                consumers_count: 0, // Memory queue doesn't track consumers
                publish_rate: 0.0,  // Would need time-based tracking
                consume_rate: 0.0,  // Would need time-based tracking
            })
        } else {
            Ok(QueueStats {
                messages_count: 0,
                messages_ready: 0,
                messages_unacked: 0,
                consumers_count: 0,
                publish_rate: 0.0,
                consume_rate: 0.0,
            })
        }
    }

    /// create_topic - สร้างหัวข้อใหม่ด้วยการกำหนดค่าเฉพาะ
    /// สร้างหัวข้อใหม่พร้อมการกำหนดค่าและสถิติเริ่มต้น
    async fn create_topic(&self, topic: &str, config: TopicConfig) -> InterfaceResult<()> {
        let mut topics = self.topics.write().await;
        topics.insert(
            topic.to_string(),
            Topic {
                messages: VecDeque::new(),
                unacked: HashMap::new(),
                config,
                stats: TopicStats {
                    total_published: 0,
                    total_consumed: 0,
                },
            },
        );
        Ok(())
    }

    /// delete_topic - ลบหัวข้อที่กำหนด
    /// ลบหัวข้อและข้อมูลทั้งหมดที่เกี่ยวข้อง
    async fn delete_topic(&self, topic: &str) -> InterfaceResult<()> {
        let mut topics = self.topics.write().await;
        topics.remove(topic);
        Ok(())
    }
}

impl Default for MemoryQueue {
    fn default() -> Self {
        Self::new()
    }
}
