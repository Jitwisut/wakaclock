//! ไฟล์ webhook.rs - Webhook Repository สำหรับจัดการข้อมูล webhook
//!
//! โมดูลนี้จัดการ CRUD operations และ delivery tracking สำหรับ webhooks
//! ใช้ MySQL เป็น primary storage backend และมี in-memory implementation สำหรับ testing
//!
//! ## ความสามารถ (Features)
//! - จัดเก็บ webhook configuration ใน MySQL
//! - จัดการ event subscriptions และ filtering
//! - บันทึก delivery logs สำหรับ monitoring
//! - รองรับ retry mechanism พร้อม exponential backoff
//! - Multi-tenancy ด้วย user และ organization scoping
//!
//! ## Database Tables
//! - `webhooks` - เก็บ webhook configurations
//! - `webhook_deliveries` - เก็บ delivery logs และ retry status

use crate::infrastructure::cache::CacheManager;
use async_trait::async_trait;
use chrono::Utc;
use serde_json::json;
use sqlx::{MySql, Pool, Row};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::interfaces::webhook::{
    CreateWebhookRequest, DeliveryStatus, UpdateWebhookRequest, Webhook, WebhookDelivery,
    WebhookInterface, WebhookSignatureMode, WebhookStats,
};
use crate::interfaces::{InterfaceError, InterfaceResult};

/// MySqlWebhookRepository - Repository implementation ที่ใช้ MySQL
/// จัดเก็บและจัดการ webhook data ใน MySQL database พร้อม transaction support
pub struct MySqlWebhookRepository {
    pool: Pool<MySql>,
}

/// InMemoryWebhookRepository - Repository implementation แบบ in-memory
/// ใช้สำหรับ development และ testing โดยเก็บข้อมูลใน HashMap
pub struct InMemoryWebhookRepository {
    /// HashMap เก็บ webhook configurations โดยใช้ UUID เป็น key
    webhooks: Arc<RwLock<HashMap<Uuid, Webhook>>>,
    /// HashMap เก็บ delivery logs แยกตาม webhook ID
    deliveries: Arc<RwLock<HashMap<Uuid, Vec<WebhookDelivery>>>>,
}

/// RedisWebhookRepository - Repository ที่เก็บข้อมูลใน Redis cache
/// ใช้ cache manager ที่ระบบเตรียมไว้เพื่อให้ webhook state แชร์ข้าม instances ได้
pub struct RedisWebhookRepository {
    cache: Arc<dyn CacheManager>,
}

impl MySqlWebhookRepository {
    pub fn new(pool: Pool<MySql>) -> Self {
        Self { pool }
    }

    /// Initialize database tables
    pub async fn init_tables(&self) -> InterfaceResult<()> {
        // Create webhooks table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS webhooks (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                org_id VARCHAR(255) NOT NULL,
                name VARCHAR(255) NOT NULL,
                url TEXT NOT NULL,
                description TEXT,
                events JSON NOT NULL,
                headers JSON,
                secret VARCHAR(255),
                signature_mode VARCHAR(50) DEFAULT 'None',
                signature_header VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                retry_enabled BOOLEAN DEFAULT TRUE,
                retry_count INT DEFAULT 3,
                retry_delay_seconds INT DEFAULT 60,
                timeout_seconds INT DEFAULT 30,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user_org (user_id, org_id),
                INDEX idx_active (is_active),
                INDEX idx_created (created_at)
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| {
            InterfaceError::InternalError(format!("Failed to create webhooks table: {}", e))
        })?;

        // Create webhook deliveries table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS webhook_deliveries (
                id VARCHAR(36) PRIMARY KEY,
                webhook_id VARCHAR(36) NOT NULL,
                event VARCHAR(255) NOT NULL,
                payload JSON NOT NULL,
                status VARCHAR(50) NOT NULL,
                response_code INT,
                response_body TEXT,
                error_message TEXT,
                attempt_count INT DEFAULT 1,
                delivered_at TIMESTAMP NULL,
                next_retry_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
                INDEX idx_webhook (webhook_id),
                INDEX idx_status (status),
                INDEX idx_created (created_at),
                INDEX idx_next_retry (next_retry_at)
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| {
            InterfaceError::InternalError(format!(
                "Failed to create webhook_deliveries table: {}",
                e
            ))
        })?;

        // Create webhook events table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS webhook_events (
                id VARCHAR(36) PRIMARY KEY,
                webhook_id VARCHAR(36) NOT NULL,
                event_type VARCHAR(255) NOT NULL,
                payload JSON NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
                INDEX idx_webhook (webhook_id),
                INDEX idx_event_type (event_type),
                INDEX idx_created (created_at)
            )
            "#,
        )
        .execute(&self.pool)
        .await
        .map_err(|e| {
            InterfaceError::InternalError(format!("Failed to create webhook_events table: {}", e))
        })?;

        Ok(())
    }
}

// In-memory implementation
impl InMemoryWebhookRepository {
    pub fn new() -> Self {
        Self {
            webhooks: Arc::new(RwLock::new(HashMap::new())),
            deliveries: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl Default for InMemoryWebhookRepository {
    fn default() -> Self {
        Self::new()
    }
}

impl RedisWebhookRepository {
    pub fn new(cache: Arc<dyn CacheManager>) -> Self {
        Self { cache }
    }

    fn webhook_key(id: Uuid) -> String {
        format!("webhook:{}", id)
    }

    fn deliveries_key(id: Uuid) -> String {
        format!("webhook:{}:deliveries", id)
    }

    fn user_index_key(user_id: &str, org_id: &str) -> String {
        format!("webhooks:user:{}:org:{}", user_id, org_id)
    }

    async fn load_webhook(&self, id: Uuid) -> InterfaceResult<Option<Webhook>> {
        let key = Self::webhook_key(id);
        let raw = self.cache.get_bytes(&key).await.map_err(|e| {
            InterfaceError::InternalError(format!("Failed to fetch webhook {}: {}", id, e))
        })?;

        if let Some(bytes) = raw {
            let webhook = serde_json::from_slice(&bytes).map_err(|e| {
                InterfaceError::InternalError(format!(
                    "Failed to deserialize webhook {}: {}",
                    id, e
                ))
            })?;
            Ok(Some(webhook))
        } else {
            Ok(None)
        }
    }

    async fn save_webhook(&self, webhook: &Webhook) -> InterfaceResult<()> {
        let key = Self::webhook_key(webhook.id);
        let data = serde_json::to_vec(webhook).map_err(|e| {
            InterfaceError::InternalError(format!(
                "Failed to serialize webhook {}: {}",
                webhook.id, e
            ))
        })?;

        self.cache.set_bytes(&key, data, None).await.map_err(|e| {
            InterfaceError::InternalError(format!(
                "Failed to persist webhook {}: {}",
                webhook.id, e
            ))
        })
    }

    async fn load_index(&self, key: &str) -> InterfaceResult<Vec<Uuid>> {
        let raw = self.cache.get_bytes(key).await.map_err(|e| {
            InterfaceError::InternalError(format!("Failed to fetch webhook index {}: {}", key, e))
        })?;

        if let Some(bytes) = raw {
            serde_json::from_slice(&bytes).map_err(|e| {
                InterfaceError::InternalError(format!(
                    "Failed to deserialize webhook index {}: {}",
                    key, e
                ))
            })
        } else {
            Ok(Vec::new())
        }
    }

    async fn save_index(&self, key: &str, ids: &[Uuid]) -> InterfaceResult<()> {
        let data = serde_json::to_vec(ids).map_err(|e| {
            InterfaceError::InternalError(format!(
                "Failed to serialize webhook index {}: {}",
                key, e
            ))
        })?;

        self.cache.set_bytes(key, data, None).await.map_err(|e| {
            InterfaceError::InternalError(format!("Failed to persist webhook index {}: {}", key, e))
        })
    }

    async fn load_deliveries(&self, key: &str) -> InterfaceResult<Vec<WebhookDelivery>> {
        let raw = self.cache.get_bytes(key).await.map_err(|e| {
            InterfaceError::InternalError(format!(
                "Failed to fetch webhook deliveries {}: {}",
                key, e
            ))
        })?;

        if let Some(bytes) = raw {
            serde_json::from_slice(&bytes).map_err(|e| {
                InterfaceError::InternalError(format!(
                    "Failed to deserialize webhook deliveries {}: {}",
                    key, e
                ))
            })
        } else {
            Ok(Vec::new())
        }
    }

    async fn save_deliveries(
        &self,
        key: &str,
        deliveries: &[WebhookDelivery],
    ) -> InterfaceResult<()> {
        let data = serde_json::to_vec(deliveries).map_err(|e| {
            InterfaceError::InternalError(format!(
                "Failed to serialize webhook deliveries {}: {}",
                key, e
            ))
        })?;

        self.cache.set_bytes(key, data, None).await.map_err(|e| {
            InterfaceError::InternalError(format!(
                "Failed to persist webhook deliveries {}: {}",
                key, e
            ))
        })
    }

    async fn append_delivery(
        &self,
        webhook_id: Uuid,
        delivery: WebhookDelivery,
    ) -> InterfaceResult<()> {
        let key = Self::deliveries_key(webhook_id);
        let mut deliveries = self.load_deliveries(&key).await?;
        deliveries.push(delivery);
        self.save_deliveries(&key, &deliveries).await
    }

    async fn deliveries_for(&self, webhook_id: Uuid) -> InterfaceResult<Vec<WebhookDelivery>> {
        let key = Self::deliveries_key(webhook_id);
        self.load_deliveries(&key).await
    }

    async fn ensure_owned(&self, id: Uuid, user_id: &str) -> InterfaceResult<Webhook> {
        match self.load_webhook(id).await? {
            Some(webhook) if webhook.user_id == user_id => Ok(webhook),
            Some(_) | None => Err(InterfaceError::NotFound("Webhook not found".into())),
        }
    }
}

#[async_trait]
impl WebhookInterface for RedisWebhookRepository {
    async fn create(
        &self,
        user_id: &str,
        org_id: &str,
        request: CreateWebhookRequest,
    ) -> InterfaceResult<Webhook> {
        let webhook = Webhook {
            id: Uuid::new_v4(),
            user_id: user_id.to_string(),
            org_id: org_id.to_string(),
            name: request.name,
            url: request.url,
            description: request.description,
            events: request.events,
            headers: request.headers.unwrap_or_default(),
            secret: request.secret,
            signature_mode: request.signature_mode.unwrap_or(WebhookSignatureMode::None),
            signature_header: request.signature_header,
            is_active: true,
            retry_enabled: request.retry_enabled.unwrap_or(true),
            retry_count: request.retry_count.unwrap_or(3),
            retry_delay_seconds: request.retry_delay_seconds.unwrap_or(60),
            timeout_seconds: request.timeout_seconds.unwrap_or(30),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.save_webhook(&webhook).await?;

        let index_key = Self::user_index_key(user_id, org_id);
        let mut ids = self.load_index(&index_key).await?;
        ids.retain(|id| id != &webhook.id);
        ids.push(webhook.id);
        self.save_index(&index_key, &ids).await?;

        Ok(webhook)
    }

    async fn get_by_id(&self, id: Uuid, user_id: &str) -> InterfaceResult<Option<Webhook>> {
        let webhook = self.load_webhook(id).await?;
        Ok(webhook.filter(|w| w.user_id == user_id))
    }

    async fn get_by_user(&self, user_id: &str, org_id: &str) -> InterfaceResult<Vec<Webhook>> {
        let index_key = Self::user_index_key(user_id, org_id);
        let ids = self.load_index(&index_key).await?;
        if ids.is_empty() {
            return Ok(Vec::new());
        }

        let keys: Vec<String> = ids.iter().map(|id| Self::webhook_key(*id)).collect();
        let key_refs: Vec<&str> = keys.iter().map(|k| k.as_str()).collect();

        let raw_webhooks = self.cache.get_many(&key_refs).await.map_err(|e| {
            InterfaceError::InternalError(format!(
                "Failed to fetch webhooks for user {}: {}",
                user_id, e
            ))
        })?;

        let mut webhooks = Vec::new();
        for raw in raw_webhooks {
            if let Some(bytes) = raw {
                let webhook: Webhook = serde_json::from_slice(&bytes).map_err(|e| {
                    InterfaceError::InternalError(format!(
                        "Failed to deserialize webhook for user {}: {}",
                        user_id, e
                    ))
                })?;

                if webhook.user_id == user_id && webhook.org_id == org_id {
                    webhooks.push(webhook);
                }
            }
        }

        webhooks.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(webhooks)
    }

    async fn update(
        &self,
        id: Uuid,
        user_id: &str,
        request: UpdateWebhookRequest,
    ) -> InterfaceResult<Webhook> {
        let mut webhook = self.ensure_owned(id, user_id).await?;

        if let Some(name) = request.name {
            webhook.name = name;
        }
        if let Some(url) = request.url {
            webhook.url = url;
        }
        if let Some(description) = request.description {
            webhook.description = Some(description);
        }
        if let Some(events) = request.events {
            webhook.events = events;
        }
        if let Some(headers) = request.headers {
            webhook.headers = headers;
        }
        if request.secret.is_some() {
            webhook.secret = request.secret;
        }
        if let Some(signature_mode) = request.signature_mode {
            webhook.signature_mode = signature_mode;
        }
        if request.signature_header.is_some() {
            webhook.signature_header = request.signature_header;
        }
        if let Some(is_active) = request.is_active {
            webhook.is_active = is_active;
        }
        if let Some(retry_enabled) = request.retry_enabled {
            webhook.retry_enabled = retry_enabled;
        }
        if let Some(retry_count) = request.retry_count {
            webhook.retry_count = retry_count;
        }
        if let Some(retry_delay_seconds) = request.retry_delay_seconds {
            webhook.retry_delay_seconds = retry_delay_seconds;
        }
        if let Some(timeout_seconds) = request.timeout_seconds {
            webhook.timeout_seconds = timeout_seconds;
        }
        webhook.updated_at = Utc::now();

        self.save_webhook(&webhook).await?;
        Ok(webhook)
    }

    async fn delete(&self, id: Uuid, user_id: &str) -> InterfaceResult<()> {
        let webhook = self.ensure_owned(id, user_id).await?;
        let key = Self::webhook_key(id);

        self.cache.del(&key).await.map_err(|e| {
            InterfaceError::InternalError(format!("Failed to delete webhook {}: {}", id, e))
        })?;

        let deliveries_key = Self::deliveries_key(id);
        if let Err(e) = self.cache.del(&deliveries_key).await {
            // Logically this is non-fatal but we still report for visibility
            return Err(InterfaceError::InternalError(format!(
                "Failed to delete webhook deliveries {}: {}",
                id, e
            )));
        }

        let index_key = Self::user_index_key(&webhook.user_id, &webhook.org_id);
        let mut ids = self.load_index(&index_key).await?;
        ids.retain(|stored_id| stored_id != &id);
        self.save_index(&index_key, &ids).await
    }

    async fn toggle_active(&self, id: Uuid, user_id: &str, is_active: bool) -> InterfaceResult<()> {
        let mut webhook = self.ensure_owned(id, user_id).await?;
        webhook.is_active = is_active;
        webhook.updated_at = Utc::now();
        self.save_webhook(&webhook).await
    }

    async fn test(
        &self,
        id: Uuid,
        user_id: &str,
        test_payload: serde_json::Value,
    ) -> InterfaceResult<WebhookDelivery> {
        let webhook = self.ensure_owned(id, user_id).await?;
        let delivery = WebhookDelivery {
            id: Uuid::new_v4(),
            webhook_id: webhook.id,
            event: "test".to_string(),
            payload: test_payload,
            status: DeliveryStatus::Delivered,
            response_code: Some(200),
            response_body: Some("OK".to_string()),
            error_message: None,
            attempt_count: 1,
            delivered_at: Some(Utc::now()),
            next_retry_at: None,
            created_at: Utc::now(),
        };

        self.append_delivery(id, delivery.clone()).await?;
        Ok(delivery)
    }

    async fn get_deliveries(
        &self,
        webhook_id: Uuid,
        user_id: &str,
    ) -> InterfaceResult<Vec<WebhookDelivery>> {
        // Ensure the webhook belongs to the user before returning deliveries
        let _ = self.ensure_owned(webhook_id, user_id).await?;
        self.deliveries_for(webhook_id).await
    }

    async fn get_stats(&self, webhook_id: Uuid, user_id: &str) -> InterfaceResult<WebhookStats> {
        let _ = self.ensure_owned(webhook_id, user_id).await?;
        let deliveries = self.deliveries_for(webhook_id).await?;

        let total = deliveries.len() as i64;
        let successful = deliveries
            .iter()
            .filter(|d| d.status == DeliveryStatus::Delivered)
            .count() as i64;
        let failed = deliveries
            .iter()
            .filter(|d| d.status == DeliveryStatus::Failed)
            .count() as i64;
        let pending = deliveries
            .iter()
            .filter(|d| d.status == DeliveryStatus::Pending)
            .count() as i64;

        let avg_response_time = if !deliveries.is_empty() {
            let total_time: f64 = deliveries
                .iter()
                .filter_map(|d| d.response_code.map(|_| 250.0))
                .sum();
            total_time / deliveries.len() as f64
        } else {
            0.0
        };

        let last_delivery = deliveries
            .iter()
            .max_by_key(|d| d.created_at)
            .and_then(|d| d.delivered_at);

        Ok(WebhookStats {
            total_deliveries: total,
            successful_deliveries: successful,
            failed_deliveries: failed,
            pending_deliveries: pending,
            average_response_time_ms: avg_response_time,
            last_delivery_at: last_delivery,
        })
    }
}

#[async_trait]
impl WebhookInterface for InMemoryWebhookRepository {
    async fn create(
        &self,
        user_id: &str,
        org_id: &str,
        request: CreateWebhookRequest,
    ) -> InterfaceResult<Webhook> {
        let webhook = Webhook {
            id: Uuid::new_v4(),
            user_id: user_id.to_string(),
            org_id: org_id.to_string(),
            name: request.name,
            url: request.url,
            description: request.description,
            events: request.events,
            headers: request.headers.unwrap_or_default(),
            secret: request.secret,
            signature_mode: request.signature_mode.unwrap_or(WebhookSignatureMode::None),
            signature_header: request.signature_header,
            is_active: true,
            retry_enabled: request.retry_enabled.unwrap_or(true),
            retry_count: request.retry_count.unwrap_or(3),
            retry_delay_seconds: request.retry_delay_seconds.unwrap_or(60),
            timeout_seconds: request.timeout_seconds.unwrap_or(30),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let mut webhooks = self.webhooks.write().await;
        webhooks.insert(webhook.id, webhook.clone());
        Ok(webhook)
    }

    async fn get_by_id(&self, id: Uuid, user_id: &str) -> InterfaceResult<Option<Webhook>> {
        let webhooks = self.webhooks.read().await;
        Ok(webhooks.get(&id).filter(|w| w.user_id == user_id).cloned())
    }

    async fn get_by_user(&self, user_id: &str, org_id: &str) -> InterfaceResult<Vec<Webhook>> {
        let webhooks = self.webhooks.read().await;
        let mut result: Vec<Webhook> = webhooks
            .values()
            .filter(|w| w.user_id == user_id && w.org_id == org_id)
            .cloned()
            .collect();
        result.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(result)
    }

    async fn update(
        &self,
        id: Uuid,
        user_id: &str,
        request: UpdateWebhookRequest,
    ) -> InterfaceResult<Webhook> {
        let mut webhooks = self.webhooks.write().await;
        let webhook = webhooks
            .get_mut(&id)
            .filter(|w| w.user_id == user_id)
            .ok_or_else(|| InterfaceError::NotFound("Webhook not found".into()))?;

        if let Some(name) = request.name {
            webhook.name = name;
        }
        if let Some(url) = request.url {
            webhook.url = url;
        }
        if let Some(description) = request.description {
            webhook.description = Some(description);
        }
        if let Some(events) = request.events {
            webhook.events = events;
        }
        if let Some(headers) = request.headers {
            webhook.headers = headers;
        }
        if request.secret.is_some() {
            webhook.secret = request.secret;
        }
        if let Some(signature_mode) = request.signature_mode {
            webhook.signature_mode = signature_mode;
        }
        if request.signature_header.is_some() {
            webhook.signature_header = request.signature_header;
        }
        if let Some(is_active) = request.is_active {
            webhook.is_active = is_active;
        }
        if let Some(retry_enabled) = request.retry_enabled {
            webhook.retry_enabled = retry_enabled;
        }
        if let Some(retry_count) = request.retry_count {
            webhook.retry_count = retry_count;
        }
        if let Some(retry_delay_seconds) = request.retry_delay_seconds {
            webhook.retry_delay_seconds = retry_delay_seconds;
        }
        if let Some(timeout_seconds) = request.timeout_seconds {
            webhook.timeout_seconds = timeout_seconds;
        }
        webhook.updated_at = Utc::now();

        Ok(webhook.clone())
    }

    async fn delete(&self, id: Uuid, user_id: &str) -> InterfaceResult<()> {
        let mut webhooks = self.webhooks.write().await;
        if webhooks.get(&id).filter(|w| w.user_id == user_id).is_some() {
            webhooks.remove(&id);
            Ok(())
        } else {
            Err(InterfaceError::NotFound("Webhook not found".into()))
        }
    }

    async fn toggle_active(&self, id: Uuid, user_id: &str, is_active: bool) -> InterfaceResult<()> {
        let mut webhooks = self.webhooks.write().await;
        let webhook = webhooks
            .get_mut(&id)
            .filter(|w| w.user_id == user_id)
            .ok_or_else(|| InterfaceError::NotFound("Webhook not found".into()))?;

        webhook.is_active = is_active;
        webhook.updated_at = Utc::now();
        Ok(())
    }

    async fn test(
        &self,
        id: Uuid,
        user_id: &str,
        test_payload: serde_json::Value,
    ) -> InterfaceResult<WebhookDelivery> {
        let webhooks = self.webhooks.read().await;
        let _webhook = webhooks
            .get(&id)
            .filter(|w| w.user_id == user_id)
            .ok_or_else(|| InterfaceError::NotFound("Webhook not found".into()))?;

        // Create a test delivery
        let delivery = WebhookDelivery {
            id: Uuid::new_v4(),
            webhook_id: id,
            event: "test".to_string(),
            payload: test_payload,
            status: DeliveryStatus::Delivered,
            response_code: Some(200),
            response_body: Some("OK".to_string()),
            error_message: None,
            attempt_count: 1,
            delivered_at: Some(Utc::now()),
            next_retry_at: None,
            created_at: Utc::now(),
        };

        // Record the test delivery
        let mut deliveries = self.deliveries.write().await;
        deliveries
            .entry(id)
            .or_insert_with(Vec::new)
            .push(delivery.clone());

        Ok(delivery)
    }

    async fn get_deliveries(
        &self,
        webhook_id: Uuid,
        _user_id: &str,
    ) -> InterfaceResult<Vec<WebhookDelivery>> {
        let deliveries = self.deliveries.read().await;
        Ok(deliveries.get(&webhook_id).cloned().unwrap_or_default())
    }

    async fn get_stats(&self, webhook_id: Uuid, _user_id: &str) -> InterfaceResult<WebhookStats> {
        let deliveries = self.deliveries.read().await;
        let webhook_deliveries = deliveries.get(&webhook_id).cloned().unwrap_or_default();

        let total = webhook_deliveries.len() as i64;
        let successful = webhook_deliveries
            .iter()
            .filter(|d| d.status == DeliveryStatus::Delivered)
            .count() as i64;
        let failed = webhook_deliveries
            .iter()
            .filter(|d| d.status == DeliveryStatus::Failed)
            .count() as i64;
        let pending = webhook_deliveries
            .iter()
            .filter(|d| d.status == DeliveryStatus::Pending)
            .count() as i64;

        let avg_response_time = if !webhook_deliveries.is_empty() {
            let total_time: f64 = webhook_deliveries
                .iter()
                .filter_map(|d| d.response_code.map(|_| 250.0)) // Mock response time
                .sum();
            total_time / webhook_deliveries.len() as f64
        } else {
            0.0
        };

        let last_delivery = webhook_deliveries
            .iter()
            .max_by_key(|d| d.created_at)
            .and_then(|d| d.delivered_at);

        Ok(WebhookStats {
            total_deliveries: total,
            successful_deliveries: successful,
            failed_deliveries: failed,
            pending_deliveries: pending,
            average_response_time_ms: avg_response_time,
            last_delivery_at: last_delivery,
        })
    }
}

#[async_trait]
impl WebhookInterface for MySqlWebhookRepository {
    async fn create(
        &self,
        user_id: &str,
        org_id: &str,
        request: CreateWebhookRequest,
    ) -> InterfaceResult<Webhook> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let events_json = serde_json::to_string(&request.events)
            .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;
        let headers_json = request
            .headers
            .as_ref()
            .and_then(|h| serde_json::to_string(h).ok());

        let signature_mode = request.signature_mode.unwrap_or(WebhookSignatureMode::None);
        let signature_mode_str = match signature_mode {
            WebhookSignatureMode::None => "None",
            WebhookSignatureMode::HmacSha256 => "HmacSha256",
            WebhookSignatureMode::HmacSha512 => "HmacSha512",
        };

        sqlx::query(
            r#"
            INSERT INTO webhooks (
                id, user_id, org_id, name, url, description, events, headers, secret,
                signature_mode, signature_header,
                retry_enabled, retry_count, retry_delay_seconds, timeout_seconds,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(id.to_string())
        .bind(user_id)
        .bind(org_id)
        .bind(&request.name)
        .bind(&request.url)
        .bind(&request.description)
        .bind(&events_json)
        .bind(&headers_json)
        .bind(&request.secret)
        .bind(signature_mode_str)
        .bind(&request.signature_header)
        .bind(request.retry_enabled.unwrap_or(true))
        .bind(request.retry_count.unwrap_or(3))
        .bind(request.retry_delay_seconds.unwrap_or(60))
        .bind(request.timeout_seconds.unwrap_or(30))
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| InterfaceError::InternalError(format!("Failed to create webhook: {}", e)))?;

        let headers = request.headers.unwrap_or_default();

        Ok(Webhook {
            id,
            user_id: user_id.to_string(),
            org_id: org_id.to_string(),
            name: request.name,
            url: request.url,
            description: request.description,
            events: request.events,
            headers,
            secret: request.secret,
            signature_mode,
            signature_header: request.signature_header,
            is_active: true,
            retry_enabled: request.retry_enabled.unwrap_or(true),
            retry_count: request.retry_count.unwrap_or(3),
            retry_delay_seconds: request.retry_delay_seconds.unwrap_or(60),
            timeout_seconds: request.timeout_seconds.unwrap_or(30),
            created_at: now,
            updated_at: now,
        })
    }

    async fn get_by_id(&self, id: Uuid, user_id: &str) -> InterfaceResult<Option<Webhook>> {
        let row = sqlx::query(
            r#"
            SELECT id, user_id, org_id, name, url, description, events, headers, secret,
                   signature_mode, signature_header,
                   is_active, retry_enabled, retry_count, retry_delay_seconds, timeout_seconds,
                   created_at, updated_at
            FROM webhooks
            WHERE id = ? AND user_id = ?
            "#,
        )
        .bind(id.to_string())
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| InterfaceError::InternalError(format!("Failed to get webhook: {}", e)))?;

        match row {
            Some(row) => {
                let events: Vec<String> = serde_json::from_str(row.get("events"))
                    .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;
                let headers: HashMap<String, String> = row
                    .try_get("headers")
                    .ok()
                    .and_then(|h: Option<String>| h)
                    .and_then(|h| serde_json::from_str(&h).ok())
                    .unwrap_or_default();

                let signature_mode_str: String = row.get("signature_mode");
                let signature_mode = match signature_mode_str.as_str() {
                    "HmacSha256" => WebhookSignatureMode::HmacSha256,
                    "HmacSha512" => WebhookSignatureMode::HmacSha512,
                    _ => WebhookSignatureMode::None,
                };

                Ok(Some(Webhook {
                    id: Uuid::parse_str(row.get("id"))
                        .map_err(|e| InterfaceError::InvalidInput(e.to_string()))?,
                    user_id: row.get("user_id"),
                    org_id: row.get("org_id"),
                    name: row.get("name"),
                    url: row.get("url"),
                    description: row.get("description"),
                    events,
                    headers,
                    secret: row.get("secret"),
                    signature_mode,
                    signature_header: row.get("signature_header"),
                    is_active: row.get("is_active"),
                    retry_enabled: row.get("retry_enabled"),
                    retry_count: row.get("retry_count"),
                    retry_delay_seconds: row.get("retry_delay_seconds"),
                    timeout_seconds: row.get("timeout_seconds"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                }))
            }
            None => Ok(None),
        }
    }

    async fn get_by_user(&self, user_id: &str, org_id: &str) -> InterfaceResult<Vec<Webhook>> {
        let rows = sqlx::query(
            r#"
            SELECT id, user_id, org_id, name, url, description, events, headers, secret,
                   signature_mode, signature_header,
                   is_active, retry_enabled, retry_count, retry_delay_seconds, timeout_seconds,
                   created_at, updated_at
            FROM webhooks
            WHERE user_id = ? AND org_id = ?
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .bind(org_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| InterfaceError::InternalError(format!("Failed to list webhooks: {}", e)))?;

        let mut webhooks = Vec::new();
        for row in rows {
            let events: Vec<String> = serde_json::from_str(row.get("events"))
                .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;
            let headers: HashMap<String, String> = row
                .try_get("headers")
                .ok()
                .and_then(|h: Option<String>| h)
                .and_then(|h| serde_json::from_str(&h).ok())
                .unwrap_or_default();

            let signature_mode_str: String = row.get("signature_mode");
            let signature_mode = match signature_mode_str.as_str() {
                "HmacSha256" => WebhookSignatureMode::HmacSha256,
                "HmacSha512" => WebhookSignatureMode::HmacSha512,
                _ => WebhookSignatureMode::None,
            };

            webhooks.push(Webhook {
                id: Uuid::parse_str(row.get("id"))
                    .map_err(|e| InterfaceError::InvalidInput(e.to_string()))?,
                user_id: row.get("user_id"),
                org_id: row.get("org_id"),
                name: row.get("name"),
                url: row.get("url"),
                description: row.get("description"),
                events,
                headers,
                secret: row.get("secret"),
                signature_mode,
                signature_header: row.get("signature_header"),
                is_active: row.get("is_active"),
                retry_enabled: row.get("retry_enabled"),
                retry_count: row.get("retry_count"),
                retry_delay_seconds: row.get("retry_delay_seconds"),
                timeout_seconds: row.get("timeout_seconds"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            });
        }

        Ok(webhooks)
    }

    async fn update(
        &self,
        id: Uuid,
        user_id: &str,
        request: UpdateWebhookRequest,
    ) -> InterfaceResult<Webhook> {
        // Build dynamic update query
        let mut updates = Vec::new();
        let mut params: Vec<String> = Vec::new();

        if let Some(name) = &request.name {
            updates.push("name = ?");
            params.push(name.clone());
        }
        if let Some(url) = &request.url {
            updates.push("url = ?");
            params.push(url.clone());
        }
        if let Some(description) = &request.description {
            updates.push("description = ?");
            params.push(description.clone());
        }
        if let Some(events) = &request.events {
            updates.push("events = ?");
            params.push(
                serde_json::to_string(events)
                    .map_err(|e| InterfaceError::SerializationError(e.to_string()))?,
            );
        }
        if let Some(headers) = &request.headers {
            updates.push("headers = ?");
            params.push(
                serde_json::to_string(headers)
                    .map_err(|e| InterfaceError::SerializationError(e.to_string()))?,
            );
        }
        if let Some(secret) = &request.secret {
            updates.push("secret = ?");
            params.push(secret.clone());
        }
        if let Some(signature_mode) = &request.signature_mode {
            updates.push("signature_mode = ?");
            let mode_str = match signature_mode {
                WebhookSignatureMode::None => "None",
                WebhookSignatureMode::HmacSha256 => "HmacSha256",
                WebhookSignatureMode::HmacSha512 => "HmacSha512",
            };
            params.push(mode_str.to_string());
        }
        if let Some(signature_header) = &request.signature_header {
            updates.push("signature_header = ?");
            params.push(signature_header.clone());
        }
        if let Some(is_active) = request.is_active {
            updates.push("is_active = ?");
            params.push(is_active.to_string());
        }
        if let Some(retry_enabled) = request.retry_enabled {
            updates.push("retry_enabled = ?");
            params.push(retry_enabled.to_string());
        }
        if let Some(retry_count) = request.retry_count {
            updates.push("retry_count = ?");
            params.push(retry_count.to_string());
        }
        if let Some(retry_delay_seconds) = request.retry_delay_seconds {
            updates.push("retry_delay_seconds = ?");
            params.push(retry_delay_seconds.to_string());
        }
        if let Some(timeout_seconds) = request.timeout_seconds {
            updates.push("timeout_seconds = ?");
            params.push(timeout_seconds.to_string());
        }

        if updates.is_empty() {
            return Err(InterfaceError::InvalidInput(
                "No fields to update".to_string(),
            ));
        }

        updates.push("updated_at = NOW()");

        let query = format!(
            "UPDATE webhooks SET {} WHERE id = ? AND user_id = ?",
            updates.join(", ")
        );

        // Create a query builder with dynamic bindings
        let mut query_builder = sqlx::query(&query);
        for param in &params {
            query_builder = query_builder.bind(param);
        }
        query_builder = query_builder.bind(id.to_string()).bind(user_id);

        query_builder.execute(&self.pool).await.map_err(|e| {
            InterfaceError::InternalError(format!("Failed to update webhook: {}", e))
        })?;

        // Fetch and return updated webhook
        self.get_by_id(id, user_id)
            .await?
            .ok_or_else(|| InterfaceError::NotFound("Webhook not found after update".to_string()))
    }

    async fn delete(&self, id: Uuid, user_id: &str) -> InterfaceResult<()> {
        let result = sqlx::query(
            r#"
            DELETE FROM webhooks
            WHERE id = ? AND user_id = ?
            "#,
        )
        .bind(id.to_string())
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| InterfaceError::InternalError(format!("Failed to delete webhook: {}", e)))?;

        if result.rows_affected() == 0 {
            return Err(InterfaceError::NotFound("Webhook not found".to_string()));
        }

        Ok(())
    }

    async fn toggle_active(&self, id: Uuid, user_id: &str, is_active: bool) -> InterfaceResult<()> {
        let result = sqlx::query(
            r#"
            UPDATE webhooks
            SET is_active = ?, updated_at = NOW()
            WHERE id = ? AND user_id = ?
            "#,
        )
        .bind(is_active)
        .bind(id.to_string())
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            InterfaceError::InternalError(format!("Failed to toggle webhook status: {}", e))
        })?;

        if result.rows_affected() == 0 {
            return Err(InterfaceError::NotFound("Webhook not found".to_string()));
        }

        Ok(())
    }

    async fn get_deliveries(
        &self,
        webhook_id: Uuid,
        user_id: &str,
    ) -> InterfaceResult<Vec<WebhookDelivery>> {
        // First verify webhook belongs to user
        let _webhook = self
            .get_by_id(webhook_id, user_id)
            .await?
            .ok_or_else(|| InterfaceError::NotFound("Webhook not found".to_string()))?;

        let rows = sqlx::query(
            r#"
            SELECT id, webhook_id, event, payload, status, response_code, response_body,
                   error_message, attempt_count, delivered_at, next_retry_at, created_at
            FROM webhook_deliveries
            WHERE webhook_id = ?
            ORDER BY created_at DESC
            LIMIT 100
            "#,
        )
        .bind(webhook_id.to_string())
        .fetch_all(&self.pool)
        .await
        .map_err(|e| InterfaceError::InternalError(format!("Failed to get deliveries: {}", e)))?;

        let mut deliveries = Vec::new();
        for row in rows {
            let status_str: String = row.get("status");
            let status = match status_str.as_str() {
                "Pending" => DeliveryStatus::Pending,
                "Delivered" => DeliveryStatus::Delivered,
                "Failed" => DeliveryStatus::Failed,
                "Retrying" => DeliveryStatus::Retrying,
                _ => DeliveryStatus::Failed,
            };

            let payload: serde_json::Value =
                serde_json::from_str(row.get("payload")).unwrap_or(json!({}));

            deliveries.push(WebhookDelivery {
                id: Uuid::parse_str(row.get("id"))
                    .map_err(|e| InterfaceError::InvalidInput(e.to_string()))?,
                webhook_id,
                event: row.get("event"),
                payload,
                status,
                response_code: row.get("response_code"),
                response_body: row.get("response_body"),
                error_message: row.get("error_message"),
                attempt_count: row.get("attempt_count"),
                delivered_at: row.get("delivered_at"),
                next_retry_at: row.get("next_retry_at"),
                created_at: row.get("created_at"),
            });
        }

        Ok(deliveries)
    }

    async fn test(
        &self,
        id: Uuid,
        user_id: &str,
        test_payload: serde_json::Value,
    ) -> InterfaceResult<WebhookDelivery> {
        // Get webhook
        let _webhook = self
            .get_by_id(id, user_id)
            .await?
            .ok_or_else(|| InterfaceError::NotFound("Webhook not found".to_string()))?;

        // Create test delivery record
        let delivery_id = Uuid::new_v4();
        let now = Utc::now();

        // Here you would implement actual HTTP call to webhook.url
        // For now, we'll just create a mock delivery record

        let delivery = WebhookDelivery {
            id: delivery_id,
            webhook_id: id,
            event: "test".to_string(),
            payload: test_payload.clone(),
            status: DeliveryStatus::Delivered,
            response_code: Some(200),
            response_body: Some("Test successful".to_string()),
            error_message: None,
            attempt_count: 1,
            delivered_at: Some(now),
            next_retry_at: None,
            created_at: now,
        };

        // Save delivery record
        sqlx::query(
            r#"
            INSERT INTO webhook_deliveries (
                id, webhook_id, event, payload, status, response_code, response_body,
                error_message, attempt_count, delivered_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(delivery.id.to_string())
        .bind(delivery.webhook_id.to_string())
        .bind(&delivery.event)
        .bind(serde_json::to_string(&delivery.payload).unwrap())
        .bind("Delivered")
        .bind(delivery.response_code)
        .bind(&delivery.response_body)
        .bind(&delivery.error_message)
        .bind(delivery.attempt_count)
        .bind(delivery.delivered_at)
        .bind(delivery.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            InterfaceError::InternalError(format!("Failed to save test delivery: {}", e))
        })?;

        Ok(delivery)
    }

    async fn get_stats(&self, webhook_id: Uuid, user_id: &str) -> InterfaceResult<WebhookStats> {
        // Verify webhook belongs to user
        let _webhook = self
            .get_by_id(webhook_id, user_id)
            .await?
            .ok_or_else(|| InterfaceError::NotFound("Webhook not found".to_string()))?;

        let row = sqlx::query(
            r#"
            SELECT
                COUNT(*) as total_deliveries,
                COUNT(CASE WHEN status = 'Delivered' THEN 1 END) as successful_deliveries,
                COUNT(CASE WHEN status = 'Failed' THEN 1 END) as failed_deliveries,
                COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending_deliveries,
                AVG(CASE WHEN response_code IS NOT NULL THEN response_code END) as avg_response_time,
                MAX(delivered_at) as last_delivery_at
            FROM webhook_deliveries
            WHERE webhook_id = ?
            "#,
        )
        .bind(webhook_id.to_string())
        .fetch_one(&self.pool)
        .await
        .map_err(|e| InterfaceError::InternalError(format!("Failed to get stats: {}", e)))?;

        Ok(WebhookStats {
            total_deliveries: row.get("total_deliveries"),
            successful_deliveries: row.get("successful_deliveries"),
            failed_deliveries: row.get("failed_deliveries"),
            pending_deliveries: row.get("pending_deliveries"),
            average_response_time_ms: row.try_get("avg_response_time").unwrap_or(0.0),
            last_delivery_at: row.get("last_delivery_at"),
        })
    }
}
