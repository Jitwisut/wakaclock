//! # Product Sync Messages Module
//!
//! โมดูลนี้กำหนดโครงสร้างข้อความสำหรับระบบ Product Synchronization
//! ใช้สำหรับการสื่อสารระหว่าง components ต่างๆ ในระบบซิงค์สินค้า
//!
//! ## ฟีเจอร์หลัก
//! - List/Detail request messages สำหรับการซิงค์ข้อมูล
//! - Progress tracking messages สำหรับติดตามความคืบหน้า
//! - DLQ (Dead Letter Queue) support สำหรับ error handling
//! - Platform credentials management จาก Strapi
//! - Pagination และ retry logic support

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Pagination modes supported by platforms
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "mode")]
pub enum PaginationMode {
    #[serde(rename = "offset")]
    Offset { limit: Option<usize> },
    #[serde(rename = "cursor")]
    Cursor { cursor: Option<String> },
    #[serde(rename = "token")]
    Token { token: Option<String> },
}

/// Time checkpint for incremental sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Synccheckpint {
    pub lower_inclusive: DateTime<Utc>,
    pub upper_exclusive: DateTime<Utc>,
}

/// Platform credentials received from Strapi
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformCredentials {
    pub api_key: Option<String>,
    pub api_secret: Option<String>,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub token_type: Option<String>,
    pub scope: Option<String>,
    pub shop_url: Option<String>,
    pub extra: Option<HashMap<String, String>>,
}

/// List request message to Consumer #1
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListRequestMessage {
    pub tenant_id: String,
    pub platform: String,
    pub shop_id: String,
    pub sync_type: String, // "incremental" | "full"
    pub checkpint: Synccheckpint,
    pub pagination_mode: PaginationMode,
    pub backfill: bool,
    pub trace_id: String,

    // Platform credentials from Strapi
    pub credentials: PlatformCredentials,

    // Optional continuation from previous page
    pub page_token: Option<String>,
    pub cursor: Option<String>,
    pub offset: Option<usize>,

    // Batch tracking
    pub batch_id: Option<String>,
    pub page_seq: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connect_state: Option<String>,
}

impl ListRequestMessage {
    pub fn new(
        tenant_id: String,
        platform: String,
        shop_id: String,
        checkpint: Synccheckpint,
        pagination_mode: PaginationMode,
        credentials: PlatformCredentials,
    ) -> Self {
        Self {
            tenant_id,
            platform,
            shop_id,
            sync_type: "incremental".to_string(),
            checkpint,
            pagination_mode,
            backfill: false,
            trace_id: Uuid::new_v4().to_string(),
            credentials,
            page_token: None,
            cursor: None,
            offset: None,
            batch_id: None,
            page_seq: None,
            connect_state: None,
        }
    }

    pub fn with_full_sync(mut self) -> Self {
        self.sync_type = "full".to_string();
        self
    }

    pub fn with_backfill(mut self) -> Self {
        self.backfill = true;
        self
    }

    pub fn with_batch_id(mut self, batch_id: String) -> Self {
        self.batch_id = Some(batch_id);
        self
    }

    pub fn with_connect_state(mut self, connect_state: Option<String>) -> Self {
        self.connect_state = connect_state;
        self
    }

    pub fn with_continuation(
        mut self,
        cursor: Option<String>,
        token: Option<String>,
        offset: Option<usize>,
    ) -> Self {
        self.cursor = cursor;
        self.page_token = token;
        self.offset = offset;
        self
    }
}

/// Sync context for tracing detail requests back to list batch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncContext {
    pub checkpint_batch_id: String,
    pub requested_at: DateTime<Utc>,
    pub list_page_seq: Option<u32>,
    pub retry_count: Option<u32>,
}

/// Detail request message to Consumer #2
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetailRequestMessage {
    pub tenant_id: String,
    pub platform: String,
    pub shop_id: String,
    pub product_id: String,
    pub sync_context: SyncContext,
    pub trace_id: String,

    // Platform credentials from Strapi
    pub credentials: PlatformCredentials,

    // Priority and retry handling
    pub priority: Option<u8>, // 0=highest, 255=lowest
    pub max_retries: Option<u32>,
    pub retry_backoff_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub connect_state: Option<String>,
}

impl DetailRequestMessage {
    pub fn new(
        tenant_id: String,
        platform: String,
        shop_id: String,
        product_id: String,
        sync_context: SyncContext,
        credentials: PlatformCredentials,
    ) -> Self {
        Self {
            tenant_id,
            platform,
            shop_id,
            product_id,
            sync_context,
            trace_id: Uuid::new_v4().to_string(),
            credentials,
            priority: None,
            max_retries: Some(3),
            retry_backoff_ms: Some(1000),
            connect_state: None,
        }
    }

    pub fn with_high_priority(mut self) -> Self {
        self.priority = Some(0);
        self
    }

    pub fn with_retry_config(mut self, max_retries: u32, backoff_ms: u64) -> Self {
        self.max_retries = Some(max_retries);
        self.retry_backoff_ms = Some(backoff_ms);
        self
    }

    pub fn with_priority(mut self, priority: u8) -> Self {
        self.priority = Some(priority);
        self
    }

    pub fn with_connect_state(mut self, connect_state: Option<String>) -> Self {
        self.connect_state = connect_state;
        self
    }
}

/// Progress event phases
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProgressPhase {
    ListPageStarted,
    ListPageDone,
    DetailBatchStarted,
    DetailBatchDone,
    SyncCompleted,
    SyncFailed,
}

/// Progress event message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEventMessage {
    pub tenant_id: String,
    pub platform: String,
    pub shop_id: String,
    pub phase: ProgressPhase,
    pub trace_id: String,

    // Progress metrics
    pub page_seq: Option<u32>,
    pub items_emitted: Option<u32>,
    pub items_processed: Option<u32>,
    pub items_failed: Option<u32>,

    // Pagination state
    pub next_page: Option<HashMap<String, serde_json::Value>>,
    pub has_more_pages: Option<bool>,

    // Performance metrics
    pub lag_detail_consumer: Option<u64>, // messages pending in detail queue
    pub processing_time_ms: Option<u64>,
    pub throughput_items_per_sec: Option<f64>,

    // Error context
    pub error_message: Option<String>,
    pub error_code: Option<String>,

    pub timestamp: DateTime<Utc>,
}

impl ProgressEventMessage {
    pub fn list_page_done(
        tenant_id: String,
        platform: String,
        shop_id: String,
        trace_id: String,
        page_seq: u32,
        items_emitted: u32,
    ) -> Self {
        Self {
            tenant_id,
            platform,
            shop_id,
            phase: ProgressPhase::ListPageDone,
            trace_id,
            page_seq: Some(page_seq),
            items_emitted: Some(items_emitted),
            items_processed: None,
            items_failed: None,
            next_page: None,
            has_more_pages: None,
            lag_detail_consumer: None,
            processing_time_ms: None,
            throughput_items_per_sec: None,
            error_message: None,
            error_code: None,
            timestamp: Utc::now(),
        }
    }

    pub fn with_next_page(
        mut self,
        next_page: HashMap<String, serde_json::Value>,
        has_more: bool,
    ) -> Self {
        self.next_page = Some(next_page);
        self.has_more_pages = Some(has_more);
        self
    }

    pub fn with_performance_metrics(mut self, processing_time_ms: u64, throughput: f64) -> Self {
        self.processing_time_ms = Some(processing_time_ms);
        self.throughput_items_per_sec = Some(throughput);
        self
    }

    pub fn with_lag_metrics(mut self, lag_detail_consumer: u64) -> Self {
        self.lag_detail_consumer = Some(lag_detail_consumer);
        self
    }

    pub fn sync_failed(
        tenant_id: String,
        platform: String,
        shop_id: String,
        trace_id: String,
        error_message: String,
        error_code: Option<String>,
    ) -> Self {
        Self {
            tenant_id,
            platform,
            shop_id,
            phase: ProgressPhase::SyncFailed,
            trace_id,
            page_seq: None,
            items_emitted: None,
            items_processed: None,
            items_failed: None,
            next_page: None,
            has_more_pages: None,
            lag_detail_consumer: None,
            processing_time_ms: None,
            throughput_items_per_sec: None,
            error_message: Some(error_message),
            error_code,
            timestamp: Utc::now(),
        }
    }
}

/// DLQ error types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DlqErrorKind {
    RateLimited,  // 429
    Unauthorized, // 401
    Forbidden,    // 403
    NotFound,     // 404
    ServerError,  // 5xx
    NetworkTimeout,
    ParseError,
    ValidationError,
    MaxRetriesExceeded,
}

/// DLQ error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DlqError {
    pub kind: DlqErrorKind,
    pub message: String,
    pub retries: u32,
    pub first_failure_at: DateTime<Utc>,
    pub last_failure_at: DateTime<Utc>,
    pub platform_error_code: Option<String>,
    pub http_status_code: Option<u16>,
}

/// DLQ envelope for failed messages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DlqEnvelope {
    pub original_subject: String,
    pub payload: serde_json::Value,
    pub error: DlqError,
    pub dlq_timestamp: DateTime<Utc>,
    pub trace_id: String,
}

impl DlqEnvelope {
    pub fn new(
        original_subject: String,
        payload: serde_json::Value,
        error: DlqError,
        trace_id: String,
    ) -> Self {
        Self {
            original_subject,
            payload,
            error,
            dlq_timestamp: Utc::now(),
            trace_id,
        }
    }
}
