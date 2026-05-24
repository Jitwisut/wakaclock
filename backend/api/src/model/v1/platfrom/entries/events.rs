//! ไฟล์ events.rs - Domain Events และ Event-Driven Architecture
//! จัดการ domain events และ event-driven communication ในระบบ
//! รองรับ Event Bus pattern, async event handling และ event sourcing
//! ใช้สำหรับ CQRS architecture และ distributed system communication
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Enumeration ของ domain events ในระบบ
/// ใช้สำหรับ event-driven communication
/// รองรับ product และ shop lifecycle events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Event {
    /// Event เมื่อมีการสร้างสินค้าใหม่
    ProductCreated { product_id: String },
    /// Event เมื่อมีการอัปเดทสินค้า
    ProductUpdated { product_id: String },
    /// Event เมื่อมีการเชื่อมต่อร้านค้า
    ShopConnected { shop_id: String },
    /// Event เมื่อมีการตัดการเชื่อมต่อร้านค้า
    ShopDisconnected { shop_id: String },
}

/// โครงสร้าง generic domain event
/// เก็บ event type และข้อมูลใน JSON format
/// ใช้สำหรับ persistence และ replay
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainEvent {
    /// ประเภทของ event
    pub event_type: String,
    /// ข้อมูล event ใน JSON format
    pub data: serde_json::Value,
}

/// Event เมื่อสินค้าถูกสร้าง
/// ใช้สำหรับ trigger vector sync และ notifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductCreatedEvent {
    pub product_id: String,
}

/// Event เมื่อสินค้าถูกอัปเดท
/// ใช้สำหรับ trigger re-sync และ cache invalidation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductUpdatedEvent {
    pub product_id: String,
}

/// Trait สำหรับ Event Bus
/// รองรับ publish/subscribe pattern
/// ใช้ async/await สำหรับ non-blocking processing
#[async_trait]
pub trait EventBus: Send + Sync {
    /// Publish event ไปยัง subscribers
    async fn publish(&self, event: Event) -> anyhow::Result<()>;
    /// Subscribe handler สำหรับ event types
    async fn subscribe(&self, handler: Arc<dyn EventHandler>) -> anyhow::Result<()>;
}

/// Trait สำหรับ Event Handler
/// implement โดย services ที่ต้องการ handle events
/// รองรับ async processing
#[async_trait]
pub trait EventHandler: Send + Sync {
    /// Handle incoming event
    /// Returns: Result สำหรับ error handling
    async fn handle(&self, event: Event) -> anyhow::Result<()>;
}
