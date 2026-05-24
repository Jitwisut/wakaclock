//! ไฟล์ mod.rs - Webhook request models สำหรับการจัดการ webhooks
//! รวมโครงสร้างข้อมูลสำหรับการสร้าง, แก้ไข, ทดสอบ และจัดการ webhook endpoints
//! ใช้สำหรับรับแจ้งเตือนเมื่อมี events สำคัญเกิดขึ้นในระบบ

use crate::interfaces::webhook::WebhookSignatureMode;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;
use validator::Validate;

/// CreateWebhookRequest - คำขอสำหรับสร้าง webhook ใหม่
/// กำหนดการตั้งค่า webhook endpoint พร้อมกับ events ที่ต้องการรับแจ้งเตือน
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Validate)]
pub struct CreateWebhookRequest {
    #[validate(length(min = 1, max = 255))]
    #[schema(example = "Product Updates")]
    pub name: String,

    #[validate(url)]
    #[schema(example = "https://example.com/webhooks/products")]
    pub url: String,

    #[schema(example = "Webhook for product update notifications")]
    pub description: Option<String>,

    #[validate(length(min = 1))]
    #[schema(example = json!(["product.created", "product.updated"]))]
    pub events: Vec<String>,

    #[schema(example = json!({"X-Custom-Header": "value"}))]
    pub headers: Option<HashMap<String, String>>,

    #[schema(example = "your-webhook-secret")]
    pub secret: Option<String>,

    #[schema(example = "HmacSha256")]
    pub signature_mode: Option<WebhookSignatureMode>,

    #[validate(length(max = 255))]
    #[schema(example = "X-Webhook-Signature")]
    pub signature_header: Option<String>,

    #[schema(example = true)]
    pub retry_enabled: Option<bool>,

    #[validate(range(min = 0, max = 10))]
    #[schema(example = 3)]
    pub retry_count: Option<i32>,

    #[validate(range(min = 1, max = 3600))]
    #[schema(example = 60)]
    pub retry_delay_seconds: Option<i32>,

    #[validate(range(min = 1, max = 120))]
    #[schema(example = 30)]
    pub timeout_seconds: Option<i32>,
}

/// UpdateWebhookRequest - คำขอสำหรับอัพเดท webhook ที่มีอยู่
/// อัพเดทการตั้งค่า webhook endpoint หรือ events ที่ต้องการรับแจ้งเตือน
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Validate)]
pub struct UpdateWebhookRequest {
    #[validate(length(min = 1, max = 255))]
    #[schema(example = "Updated Product Webhook")]
    pub name: Option<String>,

    #[validate(url)]
    #[schema(example = "https://example.com/webhooks/products/v2")]
    pub url: Option<String>,

    #[schema(example = "Updated webhook description")]
    pub description: Option<String>,

    #[validate(length(min = 1))]
    #[schema(example = json!(["product.created", "product.updated", "product.deleted"]))]
    pub events: Option<Vec<String>>,

    #[schema(example = json!({"X-Custom-Header": "new-value"}))]
    pub headers: Option<HashMap<String, String>>,

    #[schema(example = "new-webhook-secret")]
    pub secret: Option<String>,

    #[schema(example = "HmacSha512")]
    pub signature_mode: Option<WebhookSignatureMode>,

    #[validate(length(max = 255))]
    #[schema(example = "X-Webhook-Signature-V2")]
    pub signature_header: Option<String>,

    #[schema(example = false)]
    pub is_active: Option<bool>,

    #[schema(example = true)]
    pub retry_enabled: Option<bool>,

    #[validate(range(min = 0, max = 10))]
    #[schema(example = 5)]
    pub retry_count: Option<i32>,

    #[validate(range(min = 1, max = 3600))]
    #[schema(example = 120)]
    pub retry_delay_seconds: Option<i32>,

    #[validate(range(min = 1, max = 120))]
    #[schema(example = 60)]
    pub timeout_seconds: Option<i32>,
}

/// TestWebhookRequest - คำขอสำหรับทดสอบ webhook
/// ส่ง test payload ไปยัง webhook endpoint เพื่อทดสอบการทำงาน
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TestWebhookRequest {
    /// Test payload ที่จะส่งไปยัง webhook endpoint
    #[schema(example = json!({
        "test": true,
        "message": "This is a test webhook",
        "timestamp": "2024-01-01T00:00:00Z"
    }))]
    pub payload: serde_json::Value,
}

/// ToggleWebhookRequest - คำขอสำหรับเปิด/ปิด webhook
/// เปลี่ยนสถานะการทำงานของ webhook โดยไม่ต้องลบ configuration
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ToggleWebhookRequest {
    /// สถานะที่ต้องการ (true = เปิด, false = ปิด)
    #[schema(example = true)]
    pub is_active: bool,
}

// Conversion implementations สำหรับแปลงระหว่าง request models และ interface types
impl From<CreateWebhookRequest> for crate::interfaces::webhook::CreateWebhookRequest {
    fn from(req: CreateWebhookRequest) -> Self {
        crate::interfaces::webhook::CreateWebhookRequest {
            name: req.name,
            url: req.url,
            description: req.description,
            events: req.events,
            headers: req.headers,
            secret: req.secret,
            signature_mode: Some(req.signature_mode.unwrap_or(WebhookSignatureMode::None)),
            signature_header: req.signature_header,
            retry_enabled: Some(req.retry_enabled.unwrap_or(true)),
            retry_count: Some(req.retry_count.unwrap_or(3)),
            retry_delay_seconds: Some(req.retry_delay_seconds.unwrap_or(60)),
            timeout_seconds: Some(req.timeout_seconds.unwrap_or(30)),
        }
    }
}

impl From<UpdateWebhookRequest> for crate::interfaces::webhook::UpdateWebhookRequest {
    fn from(req: UpdateWebhookRequest) -> Self {
        crate::interfaces::webhook::UpdateWebhookRequest {
            name: req.name,
            url: req.url,
            description: req.description,
            events: req.events,
            headers: req.headers,
            secret: req.secret,
            signature_mode: req.signature_mode,
            signature_header: req.signature_header,
            is_active: req.is_active,
            retry_enabled: req.retry_enabled,
            retry_count: req.retry_count,
            retry_delay_seconds: req.retry_delay_seconds,
            timeout_seconds: req.timeout_seconds,
        }
    }
}
