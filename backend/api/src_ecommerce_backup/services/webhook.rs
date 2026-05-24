//! # Webhook Service - บริการจัดการ Webhook
//!
//! โมดูลนี้จัดการ business logic สำหรับ webhook operations รวมถึง:
//! - CRUD operations สำหรับ webhook endpoints
//! - Event delivery และ retry logic
//! - Webhook signature validation สำหรับความปลอดภัย

use async_trait::async_trait;
use chrono::{Duration, Utc};
use reqwest::Client;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::interfaces::webhook::{
    CreateWebhookRequest, DeliveryStatus, UpdateWebhookRequest, Webhook, WebhookDelivery,
    WebhookInterface, WebhookSignatureMode, WebhookStats,
};
use crate::interfaces::{InterfaceError, InterfaceResult};
use crate::model::error::{AppError, AppResult};

/// Webhook service implementation - ตัวจัดการ webhook หลักของระบบ
///
/// รับผิดชอบในการ:
/// - ตรวจสอบความถูกต้องของ URL และ events
/// - ส่ง HTTP requests ไปยัง webhook endpoints
/// - จัดการ retry logic เมื่อการส่งล้มเหลว
/// - สร้างและตรวจสอบ signatures สำหรับความปลอดภัย
pub struct WebhookService {
    repository: Arc<dyn WebhookInterface>,
    http_client: Client,
}

impl WebhookService {
    /// สร้าง WebhookService instance ใหม่
    ///
    /// กำหนดค่า HTTP client พร้อม timeout 30 วินาที
    /// สำหรับการส่ง webhook requests
    pub fn new(repository: Arc<dyn WebhookInterface>) -> Self {
        let http_client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap_or_default();

        Self {
            repository,
            http_client,
        }
    }

    /// ตรวจสอบความถูกต้องของ webhook URL
    ///
    /// ตรวจสอบ:
    /// - รูปแบบ URL ต้องถูกต้อง
    /// - ใช้ protocol HTTP หรือ HTTPS เท่านั้น
    /// - ป้องกันการใช้ internal/localhost URLs เพื่อความปลอดภัย
    fn validate_url(&self, url: &str) -> AppResult<()> {
        // Validate URL format
        let parsed = url::Url::parse(url)
            .map_err(|_| AppError::ValidationError("Invalid URL format".to_string()))?;

        // Check protocol is HTTP or HTTPS
        if !["http", "https"].contains(&parsed.scheme()) {
            return Err(AppError::ValidationError(
                "URL must use HTTP or HTTPS protocol".to_string(),
            ));
        }

        // Block localhost and internal IPs for security
        if let Some(host) = parsed.host_str() {
            if host == "localhost"
                || host == "127.0.0.1"
                || host.starts_with("192.168.")
                || host.starts_with("10.")
            {
                return Err(AppError::ValidationError(
                    "Cannot use internal or localhost URLs".to_string(),
                ));
            }
        }

        Ok(())
    }

    /// ตรวจสอบความถูกต้องของรายการ events
    ///
    /// ตรวจสอบว่า:
    /// - มี event อย่างน้อย 1 รายการ
    /// - ทุก event อยู่ในรายการ valid events ที่ระบบรองรับ
    fn validate_events(&self, events: &[String]) -> AppResult<()> {
        if events.is_empty() {
            return Err(AppError::ValidationError(
                "At least one event must be specified".to_string(),
            ));
        }

        // รายการ events ที่ระบบรองรับ
        let valid_events = [
            "product.created",
            "product.updated",
            "product.deleted",
            "shop.connected",
            "shop.disconnected",
            "sync.started",
            "sync.completed",
            "sync.failed",
            "order.created",
            "order.updated",
            "order.cancelled",
            "inventory.updated",
        ];

        for event in events {
            if !valid_events.contains(&event.as_str()) {
                return Err(AppError::ValidationError(format!(
                    "Invalid event: {}",
                    event
                )));
            }
        }

        Ok(())
    }

    /// สร้าง signature สำหรับ webhook payload
    ///
    /// รองรับหลายรูปแบบ:
    /// - None: ไม่มี signature
    /// - HmacSha256: HMAC-SHA256 signature
    /// - HmacSha512: HMAC-SHA512 signature
    fn sign_payload(
        &self,
        secret: &str,
        payload: &str,
        mode: WebhookSignatureMode,
    ) -> Option<String> {
        use hmac::{Hmac, Mac};

        match mode {
            WebhookSignatureMode::None => None,
            WebhookSignatureMode::HmacSha256 => {
                use sha2::Sha256;
                let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
                    .expect("HMAC can take key of any size");
                mac.update(payload.as_bytes());
                let result = mac.finalize();
                Some(hex::encode(result.into_bytes()))
            }
            WebhookSignatureMode::HmacSha512 => {
                use sha2::Sha512;
                let mut mac = Hmac::<Sha512>::new_from_slice(secret.as_bytes())
                    .expect("HMAC can take key of any size");
                mac.update(payload.as_bytes());
                let result = mac.finalize();
                Some(hex::encode(result.into_bytes()))
            }
        }
    }

    /// ตรวจสอบ webhook signature
    ///
    /// ใช้ constant-time comparison เพื่อป้องกัน timing attacks
    /// สำหรับความปลอดภัยระดับสูง
    pub fn verify_signature(
        &self,
        secret: &str,
        payload: &str,
        signature: &str,
        mode: WebhookSignatureMode,
    ) -> bool {
        if mode == WebhookSignatureMode::None {
            return true; // ไม่ต้องตรวจสอบ signature
        }

        if let Some(expected_signature) = self.sign_payload(secret, payload, mode) {
            // ใช้ constant-time comparison ป้องกัน timing attacks
            use subtle::ConstantTimeEq;
            expected_signature
                .as_bytes()
                .ct_eq(signature.as_bytes())
                .into()
        } else {
            false
        }
    }

    /// ส่ง webhook event ไปยัง endpoint
    ///
    /// ขั้นตอนการทำงาน:
    /// 1. สร้าง request body พร้อม metadata
    /// 2. เพิ่ม headers และ signature (ถ้ามี)
    /// 3. ส่ง HTTP request พร้อม timeout
    /// 4. จัดการ retry logic ถ้าการส่งล้มเหลว
    pub async fn send_webhook(
        &self,
        webhook: &Webhook,
        event: &str,
        payload: serde_json::Value,
    ) -> AppResult<WebhookDelivery> {
        let delivery_id = Uuid::new_v4();
        let now = Utc::now();

        // เตรียม request body พร้อม metadata
        let body = json!({
            "id": delivery_id.to_string(),
            "event": event,
            "timestamp": now.to_rfc3339(),
            "data": payload
        });

        let body_str = serde_json::to_string(&body)
            .map_err(|e| AppError::SerializationError(e.to_string()))?;

        // สร้าง HTTP request
        let mut request = self
            .http_client
            .post(&webhook.url)
            .header("Content-Type", "application/json")
            .header("X-Webhook-Id", webhook.id.to_string())
            .header("X-Webhook-Event", event)
            .body(body_str.clone());

        // เพิ่ม custom headers ที่ผู้ใช้กำหนด
        for (key, value) in &webhook.headers {
            request = request.header(key.as_str(), value.as_str());
        }

        // เพิ่ม signature ถ้ามี secret และ signature mode ไม่ใช่ None
        if webhook.signature_mode != WebhookSignatureMode::None {
            if let Some(secret) = &webhook.secret {
                if let Some(signature) =
                    self.sign_payload(secret, &body_str, webhook.signature_mode)
                {
                    let header_name = webhook
                        .signature_header
                        .as_deref()
                        .unwrap_or("X-Webhook-Signature");
                    let algorithm_prefix = match webhook.signature_mode {
                        WebhookSignatureMode::HmacSha256 => "sha256=",
                        WebhookSignatureMode::HmacSha512 => "sha512=",
                        WebhookSignatureMode::None => "",
                    };
                    request =
                        request.header(header_name, format!("{}{}", algorithm_prefix, signature));
                }
            }
        }

        // ส่ง request พร้อมกำหนด timeout
        let timeout = std::time::Duration::from_secs(webhook.timeout_seconds as u64);
        let response = tokio::time::timeout(timeout, request.send()).await;

        // ประมวลผล response และกำหนดสถานะ
        let (status, response_code, response_body, error_message) = match response {
            Ok(Ok(resp)) => {
                let code = resp.status().as_u16() as i32;
                let body = resp.text().await.unwrap_or_default();
                if (200..300).contains(&code) {
                    (DeliveryStatus::Delivered, Some(code), Some(body), None)
                } else {
                    (
                        DeliveryStatus::Failed,
                        Some(code),
                        Some(body),
                        Some(format!("HTTP {}", code)),
                    )
                }
            }
            Ok(Err(e)) => (DeliveryStatus::Failed, None, None, Some(e.to_string())),
            Err(_) => (
                DeliveryStatus::Failed,
                None,
                None,
                Some("Request timeout".to_string()),
            ),
        };

        // ตัดสินใจว่าต้อง retry หรือไม่
        let (next_retry_at, final_status) =
            if status == DeliveryStatus::Failed && webhook.retry_enabled {
                let retry_delay = Duration::seconds(webhook.retry_delay_seconds as i64);
                (Some(now + retry_delay), DeliveryStatus::Retrying)
            } else {
                (None, status)
            };

        Ok(WebhookDelivery {
            id: delivery_id,
            webhook_id: webhook.id,
            event: event.to_string(),
            payload,
            status: final_status,
            response_code,
            response_body,
            error_message,
            attempt_count: 1,
            delivered_at: if final_status == DeliveryStatus::Delivered {
                Some(now)
            } else {
                None
            },
            next_retry_at,
            created_at: now,
        })
    }

    /// ประมวลผลการ retry webhook
    ///
    /// ตรวจสอบจำนวน retry attempts และส่ง webhook อีกครั้ง
    /// หากยังไม่ถึงขีดจำกัด
    pub async fn retry_webhook(
        &self,
        delivery: &WebhookDelivery,
        webhook: &Webhook,
    ) -> AppResult<WebhookDelivery> {
        if delivery.attempt_count >= webhook.retry_count {
            // ถึงจำนวน retry สูงสุดแล้ว
            return Ok(WebhookDelivery {
                status: DeliveryStatus::Failed,
                error_message: Some("Max retry attempts reached".to_string()),
                next_retry_at: None,
                attempt_count: delivery.attempt_count,
                ..delivery.clone()
            });
        }

        // ส่ง webhook อีกครั้ง
        let mut result = self
            .send_webhook(webhook, &delivery.event, delivery.payload.clone())
            .await?;

        // อัพเดทจำนวนครั้งที่พยายามส่ง
        result.attempt_count = delivery.attempt_count + 1;
        result.id = delivery.id; // คงไว้ซึ่ง delivery ID เดิม

        Ok(result)
    }
}

/// Implementation ของ WebhookInterface สำหรับ WebhookService
///
/// ให้บริการ CRUD operations สำหรับ webhook management
/// พร้อมฟีเจอร์การทดสอบและสถิติการส่ง
#[async_trait]
impl WebhookInterface for WebhookService {
    /// สร้าง webhook ใหม่พร้อมตรวจสอบความถูกต้อง
    async fn create(
        &self,
        user_id: &str,
        org_id: &str,
        request: CreateWebhookRequest,
    ) -> InterfaceResult<Webhook> {
        // ตรวจสอบ URL
        self.validate_url(&request.url)
            .map_err(|e| InterfaceError::InvalidInput(e.to_string()))?;

        // ตรวจสอบ events
        self.validate_events(&request.events)
            .map_err(|e| InterfaceError::InvalidInput(e.to_string()))?;

        // สร้าง webhook ในฐานข้อมูล
        self.repository.create(user_id, org_id, request).await
    }

    /// ดึงข้อมูล webhook ตาม ID
    async fn get_by_id(&self, id: Uuid, user_id: &str) -> InterfaceResult<Option<Webhook>> {
        self.repository.get_by_id(id, user_id).await
    }

    /// ดึงรายการ webhooks ของผู้ใช้
    async fn get_by_user(&self, user_id: &str, org_id: &str) -> InterfaceResult<Vec<Webhook>> {
        self.repository.get_by_user(user_id, org_id).await
    }

    /// อัพเดท webhook พร้อมตรวจสอบความถูกต้อง
    async fn update(
        &self,
        id: Uuid,
        user_id: &str,
        request: UpdateWebhookRequest,
    ) -> InterfaceResult<Webhook> {
        // ตรวจสอบ URL ถ้ามีการเปลี่ยนแปลง
        if let Some(url) = &request.url {
            self.validate_url(url)
                .map_err(|e| InterfaceError::InvalidInput(e.to_string()))?;
        }

        // ตรวจสอบ events ถ้ามีการเปลี่ยนแปลง
        if let Some(events) = &request.events {
            self.validate_events(events)
                .map_err(|e| InterfaceError::InvalidInput(e.to_string()))?;
        }

        self.repository.update(id, user_id, request).await
    }

    /// ลบ webhook
    async fn delete(&self, id: Uuid, user_id: &str) -> InterfaceResult<()> {
        self.repository.delete(id, user_id).await
    }

    /// เปิด/ปิดการใช้งาน webhook
    async fn toggle_active(&self, id: Uuid, user_id: &str, is_active: bool) -> InterfaceResult<()> {
        self.repository.toggle_active(id, user_id, is_active).await
    }

    /// ดึงประวัติการส่ง webhook
    async fn get_deliveries(
        &self,
        webhook_id: Uuid,
        user_id: &str,
    ) -> InterfaceResult<Vec<WebhookDelivery>> {
        self.repository.get_deliveries(webhook_id, user_id).await
    }

    /// ทดสอบส่ง webhook
    ///
    /// ส่ง test event พร้อม payload ที่กำหนด
    /// เพื่อตรวจสอบการทำงานของ endpoint
    async fn test(
        &self,
        id: Uuid,
        user_id: &str,
        test_payload: serde_json::Value,
    ) -> InterfaceResult<WebhookDelivery> {
        // ดึงข้อมูล webhook
        let webhook = self
            .get_by_id(id, user_id)
            .await?
            .ok_or_else(|| InterfaceError::NotFound("Webhook not found".to_string()))?;

        // ส่ง test webhook
        let delivery = self
            .send_webhook(&webhook, "test", test_payload)
            .await
            .map_err(|e| InterfaceError::External(e.to_string()))?;

        Ok(delivery)
    }

    /// ดึงสถิติการส่ง webhook
    async fn get_stats(&self, webhook_id: Uuid, user_id: &str) -> InterfaceResult<WebhookStats> {
        self.repository.get_stats(webhook_id, user_id).await
    }
}
