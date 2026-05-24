//! Webhook response models - โมเดลสำหรับการตอบกลับ webhook API
//!
//! โมดูลนี้ประกอบด้วยโครงสร้างข้อมูลทั้งหมดที่ใช้ในการตอบกลับ
//! webhook API endpoints รวมถึง CRUD operations, การทดสอบ และสถิติ

use crate::interfaces::webhook::WebhookSignatureMode;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;
use uuid::Uuid;

/// Webhook response - โครงสร้างข้อมูลหลักของ webhook
///
/// ใช้แสดงข้อมูล webhook ในการตอบกลับ API
/// ไม่รวม secret เพื่อความปลอดภัย แต่มี flag บอกว่ามี secret หรือไม่
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WebhookResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub id: Uuid,

    #[schema(example = "user123")]
    pub user_id: String,

    #[schema(example = "org456")]
    pub org_id: String,

    #[schema(example = "Product Updates")]
    pub name: String,

    #[schema(example = "https://example.com/webhooks/products")]
    pub url: String,

    #[schema(example = "Webhook for product update notifications")]
    pub description: Option<String>,

    #[schema(example = json!(["product.created", "product.updated"]))]
    pub events: Vec<String>,

    #[schema(example = json!({"X-Custom-Header": "value"}))]
    pub headers: HashMap<String, String>,

    #[schema(example = true)]
    pub has_secret: bool,

    #[schema(example = "HmacSha256")]
    pub signature_mode: WebhookSignatureMode,

    #[schema(example = "X-Webhook-Signature")]
    pub signature_header: Option<String>,

    #[schema(example = true)]
    pub is_active: bool,

    #[schema(example = true)]
    pub retry_enabled: bool,

    #[schema(example = 3)]
    pub retry_count: i32,

    #[schema(example = 60)]
    pub retry_delay_seconds: i32,

    #[schema(example = 30)]
    pub timeout_seconds: i32,

    #[schema(example = "2024-01-01T00:00:00Z")]
    pub created_at: DateTime<Utc>,

    #[schema(example = "2024-01-01T00:00:00Z")]
    pub updated_at: DateTime<Utc>,
}

/// Webhook delivery response - ข้อมูลการส่ง webhook
///
/// แสดงรายละเอียดของแต่ละครั้งที่ส่ง webhook
/// รวมถึงสถานะ, response จาก endpoint, และ retry information
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WebhookDeliveryResponse {
    #[schema(example = "550e8400-e29b-41d4-a716-446655440001")]
    pub id: Uuid,

    #[schema(example = "550e8400-e29b-41d4-a716-446655440000")]
    pub webhook_id: Uuid,

    #[schema(example = "product.created")]
    pub event: String,

    #[schema(example = json!({"product_id": "123", "name": "Sample Product"}))]
    pub payload: serde_json::Value,

    #[schema(example = "Delivered")]
    pub status: String,

    #[schema(example = 200)]
    pub response_code: Option<i32>,

    #[schema(example = "OK")]
    pub response_body: Option<String>,

    #[schema(example = "Connection timeout")]
    pub error_message: Option<String>,

    #[schema(example = 1)]
    pub attempt_count: i32,

    #[schema(example = "2024-01-01T00:00:00Z")]
    pub delivered_at: Option<DateTime<Utc>>,

    #[schema(example = "2024-01-01T00:05:00Z")]
    pub next_retry_at: Option<DateTime<Utc>>,

    #[schema(example = "2024-01-01T00:00:00Z")]
    pub created_at: DateTime<Utc>,
}

/// Webhook statistics response - สถิติการส่ง webhook
///
/// สรุปภาพรวมของการส่ง webhook ทั้งหมด
/// ใช้สำหรับ monitoring และ debugging
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WebhookStatsResponse {
    #[schema(example = 100)]
    pub total_deliveries: i64,

    #[schema(example = 85)]
    pub successful_deliveries: i64,

    #[schema(example = 10)]
    pub failed_deliveries: i64,

    #[schema(example = 5)]
    pub pending_deliveries: i64,

    #[schema(example = 250.5)]
    pub average_response_time_ms: f64,

    #[schema(example = "2024-01-01T00:00:00Z")]
    pub last_delivery_at: Option<DateTime<Utc>>,
}

/// List webhooks response - รายการ webhooks
///
/// ใช้สำหรับแสดงรายการ webhooks ทั้งหมดของผู้ใช้
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ListWebhooksResponse {
    pub webhooks: Vec<WebhookResponse>,
    pub total: usize,
}

/// Create webhook response - ผลการสร้าง webhook
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateWebhookResponse {
    pub webhook: WebhookResponse,
    #[schema(example = "Webhook created successfully")]
    pub message: String,
}

/// Update webhook response - ผลการอัพเดท webhook
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UpdateWebhookResponse {
    pub webhook: WebhookResponse,
    #[schema(example = "Webhook updated successfully")]
    pub message: String,
}

/// Delete webhook response - ผลการลบ webhook
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct DeleteWebhookResponse {
    #[schema(example = "Webhook deleted successfully")]
    pub message: String,
}

/// Test webhook response - ผลการทดสอบ webhook
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TestWebhookResponse {
    pub delivery: WebhookDeliveryResponse,
    #[schema(example = "Test webhook sent successfully")]
    pub message: String,
}

/// การแปลงจาก interface Webhook เป็น response model
///
/// แปลงข้อมูล internal webhook representation เป็นรูปแบบ
/// ที่เหมาะสำหรับส่งกลับใน API response
impl From<crate::interfaces::webhook::Webhook> for WebhookResponse {
    fn from(webhook: crate::interfaces::webhook::Webhook) -> Self {
        Self {
            id: webhook.id,
            user_id: webhook.user_id,
            org_id: webhook.org_id,
            name: webhook.name,
            url: webhook.url,
            description: webhook.description,
            events: webhook.events,
            headers: webhook.headers,
            has_secret: webhook.secret.is_some(),
            signature_mode: webhook.signature_mode,
            signature_header: webhook.signature_header,
            is_active: webhook.is_active,
            retry_enabled: webhook.retry_enabled,
            retry_count: webhook.retry_count,
            retry_delay_seconds: webhook.retry_delay_seconds,
            timeout_seconds: webhook.timeout_seconds,
            created_at: webhook.created_at,
            updated_at: webhook.updated_at,
        }
    }
}

/// การแปลงจาก interface WebhookDelivery เป็น response model
impl From<crate::interfaces::webhook::WebhookDelivery> for WebhookDeliveryResponse {
    fn from(delivery: crate::interfaces::webhook::WebhookDelivery) -> Self {
        Self {
            id: delivery.id,
            webhook_id: delivery.webhook_id,
            event: delivery.event,
            payload: delivery.payload,
            status: format!("{:?}", delivery.status),
            response_code: delivery.response_code,
            response_body: delivery.response_body,
            error_message: delivery.error_message,
            attempt_count: delivery.attempt_count,
            delivered_at: delivery.delivered_at,
            next_retry_at: delivery.next_retry_at,
            created_at: delivery.created_at,
        }
    }
}

/// การแปลงจาก interface WebhookStats เป็น response model
impl From<crate::interfaces::webhook::WebhookStats> for WebhookStatsResponse {
    fn from(stats: crate::interfaces::webhook::WebhookStats) -> Self {
        Self {
            total_deliveries: stats.total_deliveries,
            successful_deliveries: stats.successful_deliveries,
            failed_deliveries: stats.failed_deliveries,
            pending_deliveries: stats.pending_deliveries,
            average_response_time_ms: stats.average_response_time_ms,
            last_delivery_at: stats.last_delivery_at,
        }
    }
}
