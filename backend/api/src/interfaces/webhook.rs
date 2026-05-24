/// ไฟล์ webhook.rs - Webhook Interface สำหรับการจัดการ webhook notifications
/// กำหนด contract สำหรับ webhook operations รวมถึง CRUD, event delivery,
/// retry logic, และการจัดการสถานะของ webhooks
/// ใช้สำหรับแจ้งเตือน external systems เมื่อมี events สำคัญเกิดขึ้น
///
/// ## ความสามารถ (Features)
/// - CRUD operations สำหรับ webhook endpoints
/// - Event-driven notification delivery
/// - Retry mechanism พร้อม exponential backoff
/// - Signature verification สำหรับ security
/// - Delivery logs และ statistics tracking
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use super::InterfaceResult;

/// WebhookSignatureMode - โหมดการสร้าง signature สำหรับ webhook security
/// ใช้สำหรับ verify ว่า webhook request มาจาก source ที่ถูกต้อง
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default)]
pub enum WebhookSignatureMode {
    /// ไม่ใช้ signature verification
    #[default]
    None,
    /// ใช้ HMAC-SHA256 สำหรับ signature
    HmacSha256,
    /// ใช้ HMAC-SHA512 สำหรับ signature ที่แข็งแรงกว่า
    HmacSha512,
}

/// Webhook - โครงสร้างข้อมูล webhook configuration และ metadata
/// เก็บข้อมูลการตั้งค่า webhook endpoint พร้อมกับ security และ retry settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Webhook {
    /// Unique ID ของ webhook
    pub id: Uuid,
    /// User ID ที่เป็นเจ้าของ webhook
    pub user_id: String,
    /// Organization ID สำหรับ multi-tenancy
    pub org_id: String,
    /// ชื่อ webhook สำหรับแสดงผลและอ้างอิง
    pub name: String,
    /// URL endpoint ที่จะส่ง webhook notifications
    pub url: String,
    /// คำอธิบาย webhook (optional)
    pub description: Option<String>,
    /// รายการ events ที่ webhook นี้สนใจรับ notifications
    pub events: Vec<String>,
    /// Custom headers ที่จะส่งไปพร้อมกับ webhook request
    pub headers: HashMap<String, String>,
    /// Secret key สำหรับสร้าง signature (ถ้าใช้ signature mode)
    pub secret: Option<String>,
    /// โหมดการสร้าง signature สำหรับ security
    pub signature_mode: WebhookSignatureMode,
    /// ชื่อ header ที่จะใส่ signature (เช่น X-Signature)
    pub signature_header: Option<String>,
    /// สถานะการใช้งาน webhook
    pub is_active: bool,
    /// เปิด/ปิดการ retry เมื่อส่งไม่สำเร็จ
    pub retry_enabled: bool,
    /// จำนวนครั้งที่จะ retry
    pub retry_count: i32,
    /// ระยะเวลารอระหว่าง retry (seconds)
    pub retry_delay_seconds: i32,
    /// Timeout สำหรับ HTTP request (seconds)
    pub timeout_seconds: i32,
    /// เวลาที่สร้าง webhook
    pub created_at: DateTime<Utc>,
    /// เวลาที่แก้ไขล่าสุด
    pub updated_at: DateTime<Utc>,
}

/// CreateWebhookRequest - Request body สำหรับสร้าง webhook ใหม่
/// รวมข้อมูลที่จำเป็นสำหรับการ configure webhook endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateWebhookRequest {
    pub name: String,
    pub url: String,
    pub description: Option<String>,
    pub events: Vec<String>,
    pub headers: Option<HashMap<String, String>>,
    pub secret: Option<String>,
    pub signature_mode: Option<WebhookSignatureMode>,
    pub signature_header: Option<String>,
    pub retry_enabled: Option<bool>,
    pub retry_count: Option<i32>,
    pub retry_delay_seconds: Option<i32>,
    pub timeout_seconds: Option<i32>,
}

/// Update webhook request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateWebhookRequest {
    pub name: Option<String>,
    pub url: Option<String>,
    pub description: Option<String>,
    pub events: Option<Vec<String>>,
    pub headers: Option<HashMap<String, String>>,
    pub secret: Option<String>,
    pub signature_mode: Option<WebhookSignatureMode>,
    pub signature_header: Option<String>,
    pub is_active: Option<bool>,
    pub retry_enabled: Option<bool>,
    pub retry_count: Option<i32>,
    pub retry_delay_seconds: Option<i32>,
    pub timeout_seconds: Option<i32>,
}

/// Webhook delivery log
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookDelivery {
    pub id: Uuid,
    pub webhook_id: Uuid,
    pub event: String,
    pub payload: serde_json::Value,
    pub status: DeliveryStatus,
    pub response_code: Option<i32>,
    pub response_body: Option<String>,
    pub error_message: Option<String>,
    pub attempt_count: i32,
    pub delivered_at: Option<DateTime<Utc>>,
    pub next_retry_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Webhook delivery status
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum DeliveryStatus {
    Pending,
    Delivered,
    Failed,
    Retrying,
}

/// Webhook event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookEvent {
    pub id: Uuid,
    pub webhook_id: Uuid,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// Webhook interface trait
#[async_trait]
pub trait WebhookInterface: Send + Sync {
    /// Create a new webhook
    async fn create(
        &self,
        user_id: &str,
        org_id: &str,
        request: CreateWebhookRequest,
    ) -> InterfaceResult<Webhook>;

    /// Get webhook by ID
    async fn get_by_id(&self, id: Uuid, user_id: &str) -> InterfaceResult<Option<Webhook>>;

    /// Get all webhooks for a user
    async fn get_by_user(&self, user_id: &str, org_id: &str) -> InterfaceResult<Vec<Webhook>>;

    /// Update webhook
    async fn update(
        &self,
        id: Uuid,
        user_id: &str,
        request: UpdateWebhookRequest,
    ) -> InterfaceResult<Webhook>;

    /// Delete webhook
    async fn delete(&self, id: Uuid, user_id: &str) -> InterfaceResult<()>;

    /// Toggle webhook active status
    async fn toggle_active(&self, id: Uuid, user_id: &str, is_active: bool) -> InterfaceResult<()>;

    /// Get webhook deliveries
    async fn get_deliveries(
        &self,
        webhook_id: Uuid,
        user_id: &str,
    ) -> InterfaceResult<Vec<WebhookDelivery>>;

    /// Test webhook with sample payload
    async fn test(
        &self,
        id: Uuid,
        user_id: &str,
        test_payload: serde_json::Value,
    ) -> InterfaceResult<WebhookDelivery>;

    /// Get webhook statistics
    async fn get_stats(&self, webhook_id: Uuid, user_id: &str) -> InterfaceResult<WebhookStats>;
}

/// Webhook statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookStats {
    pub total_deliveries: i64,
    pub successful_deliveries: i64,
    pub failed_deliveries: i64,
    pub pending_deliveries: i64,
    pub average_response_time_ms: f64,
    pub last_delivery_at: Option<DateTime<Utc>>,
}
