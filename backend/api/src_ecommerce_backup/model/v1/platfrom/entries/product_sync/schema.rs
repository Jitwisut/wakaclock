//! # Product Sync Schema Module
//!
//! โมดูลนี้กำหนด Schema และโครงสร้างข้อมูลสำหรับระบบ Product Synchronization
//! ใช้สำหรับจัดเก็บและจัดการข้อมูลการซิงค์สินค้าจากแพลตฟอร์ม E-commerce ต่างๆ
//!
//! ## ฟีเจอร์หลัก
//! - Raw product data audit trail การเก็บข้อมูลดิบจาก API
//! - Product snapshot สำหรับ current view ของสินค้า
//! - Sync statistics และ progress tracking
//! - Idempotency keys สำหรับ exactly-once processing
//! - ClickHouse schema definitions สำหรับการจัดเก็บข้อมูล

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Raw product list data from platform APIs
/// Stored in ClickHouse for audit trail and analytics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductListRaw {
    // Primary identifiers
    pub tenant_id: String,
    pub platform: String,
    pub shop_id: String,
    pub sync_batch_id: String,
    pub list_request_id: String,

    // Pagination context
    pub page_seq: u32,
    pub page_token: Option<String>,
    pub cursor: Option<String>,
    pub offset: Option<u64>,
    pub limit: Option<u32>,

    // Raw platform response
    pub platform_response: serde_json::Value, // Complete raw API response
    pub response_metadata: serde_json::Value, // Headers, timing, etc.

    // Extracted products count
    pub products_count: u32,
    pub has_more_pages: bool,

    // Timing and status
    pub requested_at: DateTime<Utc>,
    pub received_at: DateTime<Utc>,
    pub processing_time_ms: u64,
    pub api_call_duration_ms: u64,

    // Quality metrics
    pub http_status_code: u16,
    pub rate_limit_remaining: Option<u32>,
    pub rate_limit_reset_at: Option<DateTime<Utc>>,

    // Trace information
    pub trace_id: String,
    pub parent_trace_id: Option<String>,
}

/// Raw product detail data from platform APIs
/// Stored in ClickHouse for audit trail
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductDetailRaw {
    // Primary identifiers
    pub tenant_id: String,
    pub platform: String,
    pub shop_id: String,
    pub platform_product_id: String,
    pub detail_request_id: String,

    // Sync context
    pub sync_batch_id: String,
    pub checkpint_batch_id: String,
    pub list_page_seq: Option<u32>,

    // Raw platform response
    pub platform_response: serde_json::Value,
    pub response_metadata: serde_json::Value,

    // Timing and status
    pub requested_at: DateTime<Utc>,
    pub received_at: DateTime<Utc>,
    pub processing_time_ms: u64,
    pub api_call_duration_ms: u64,

    // Quality metrics
    pub http_status_code: u16,
    pub retry_count: u32,
    pub rate_limit_remaining: Option<u32>,

    // Trace information
    pub trace_id: String,
    pub parent_trace_id: Option<String>,
}

/// Curated product snapshot for analytics and operations
/// Current view of products with normalized fields
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductSnapshot {
    // Primary identifiers
    pub tenant_id: String,
    pub platform: String,
    pub shop_id: String,
    pub platform_product_id: String,
    pub unified_product_id: String,

    // Core product fields (normalized across platforms)
    pub title: String,
    pub description: Option<String>,
    pub brand: Option<String>,
    pub category: Option<String>,
    pub category_path: Vec<String>,

    // Pricing information
    pub price: Option<f64>,
    pub currency: Option<String>,
    pub original_price: Option<f64>,
    pub discount_percentage: Option<f64>,

    // Inventory and fulfillment
    pub total_quantity: Option<i64>,
    pub available_quantity: Option<i64>,
    pub reserved_quantity: Option<i64>,

    // SKU information
    pub skus: Vec<ProductSkuSnapshot>,

    // Media
    pub main_image_url: Option<String>,
    pub image_urls: Vec<String>,
    pub video_urls: Vec<String>,

    // Platform-specific attributes
    pub platform_attributes: HashMap<String, serde_json::Value>,
    pub platform_categories: Vec<String>,
    pub platform_tags: Vec<String>,

    // Status and availability
    pub status: String,             // "active", "inactive", "draft", "archived"
    pub visibility: Option<String>, // "public", "private", "hidden"
    pub sales_regions: Vec<String>,

    // SEO and marketing
    pub seo_title: Option<String>,
    pub seo_description: Option<String>,
    pub marketing_tags: Vec<String>,

    // Sync metadata
    pub data_source: String, // "list_only", "detail_enriched"
    pub needs_detail_sync: bool,
    pub detail_sync_priority: Option<u8>,
    pub sync_quality_score: Option<f32>, // 0.0-1.0, based on field completeness

    // Timestamps
    pub platform_created_at: Option<DateTime<Utc>>,
    pub platform_updated_at: Option<DateTime<Utc>>,
    pub first_synced_at: DateTime<Utc>,
    pub last_synced_at: DateTime<Utc>,
    pub last_list_sync_at: Option<DateTime<Utc>>,
    pub last_detail_sync_at: Option<DateTime<Utc>>,

    // Versioning
    pub version: u64,
    pub checksum: String, // Hash of core fields for change detection

    // Trace information
    pub last_sync_trace_id: String,
    pub last_sync_batch_id: String,
}

/// SKU-level snapshot data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductSkuSnapshot {
    pub platform_sku_id: String,
    pub seller_sku: Option<String>,
    pub sku_name: Option<String>,

    // Pricing
    pub price: Option<f64>,
    pub original_price: Option<f64>,
    pub currency: Option<String>,

    // Inventory
    pub quantity: Option<i64>,
    pub available_quantity: Option<i64>,
    pub reserved_quantity: Option<i64>,

    // Attributes
    pub attributes: HashMap<String, String>, // color, size, etc.
    pub weight: Option<f64>,
    pub dimensions: Option<String>,

    // Status
    pub status: String,
    pub is_active: bool,
}

/// Sync statistics tracking table
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStats {
    pub tenant_id: String,
    pub platform: String,
    pub shop_id: String,
    pub sync_batch_id: String,

    // checkpint and bounds
    pub checkpint_lower: DateTime<Utc>,
    pub checkpint_upper: DateTime<Utc>,
    pub sync_type: String, // "incremental", "full", "backfill"

    // Progress tracking
    pub status: String, // "running", "completed", "failed", "paused"
    pub current_page: u32,
    pub total_pages_estimate: Option<u32>,
    pub current_cursor: Option<String>,
    pub current_token: Option<String>,
    pub current_offset: Option<u64>,

    // Counts
    pub list_requests_sent: u32,
    pub list_responses_received: u32,
    pub detail_requests_sent: u32,
    pub detail_responses_received: u32,
    pub products_discovered: u32,
    pub products_list_only: u32,
    pub products_detail_needed: u32,
    pub products_detail_completed: u32,
    pub products_failed: u32,

    // Performance metrics
    pub avg_list_response_time_ms: Option<f64>,
    pub avg_detail_response_time_ms: Option<f64>,
    pub throughput_products_per_sec: Option<f64>,
    pub rate_limit_hits: u32,
    pub api_quota_consumed: Option<u64>,

    // Error tracking
    pub error_count: u32,
    pub last_error_message: Option<String>,
    pub last_error_at: Option<DateTime<Utc>>,

    // Timestamps
    pub started_at: DateTime<Utc>,
    pub last_activity_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub next_cursor_update_at: Option<DateTime<Utc>>,

    // Configuration
    pub batch_size: u32,
    pub concurrency_limit: u32,
    pub retry_config: serde_json::Value,

    pub trace_id: String,
}

/// Idempotency tracking for exactly-once processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdempotencyKey {
    pub key: String, // Hash of (tenant_id, platform, shop_id, operation, params)
    pub tenant_id: String,
    pub operation_type: String, // "list_request", "detail_request"

    // Request context
    pub request_hash: String,
    pub request_params: serde_json::Value,

    // Response tracking
    pub status: String, // "processing", "completed", "failed"
    pub response_hash: Option<String>,
    pub response_data: Option<serde_json::Value>,

    // Timing
    pub first_request_at: DateTime<Utc>,
    pub last_request_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,

    pub trace_id: String,
}

/// ClickHouse CREATE TABLE statements
pub const CREATE_TABLES_SQL: &str = r#"
-- Raw list responses audit table
CREATE TABLE IF NOT EXISTS product_list_raw (
    tenant_id String,
    platform String,
    shop_id String,
    sync_batch_id String,
    list_request_id String,
    page_seq UInt32,
    page_token Nullable(String),
    cursor Nullable(String),
    offset Nullable(UInt64),
    limit Nullable(UInt32),
    platform_response String, -- JSON
    response_metadata String, -- JSON
    products_count UInt32,
    has_more_pages Bool,
    requested_at DateTime64(3),
    received_at DateTime64(3),
    processing_time_ms UInt64,
    api_call_duration_ms UInt64,
    http_status_code UInt16,
    rate_limit_remaining Nullable(UInt32),
    rate_limit_reset_at Nullable(DateTime64(3)),
    trace_id String,
    parent_trace_id Nullable(String)
) ENGINE = MergeTree()
ORDER BY (tenant_id, platform, shop_id, sync_batch_id, page_seq)
PARTITION BY toYYYYMM(requested_at);

-- Raw detail responses audit table
CREATE TABLE IF NOT EXISTS product_detail_raw (
    tenant_id String,
    platform String,
    shop_id String,
    platform_product_id String,
    detail_request_id String,
    sync_batch_id String,
    checkpint_batch_id String,
    list_page_seq Nullable(UInt32),
    platform_response String, -- JSON
    response_metadata String, -- JSON
    requested_at DateTime64(3),
    received_at DateTime64(3),
    processing_time_ms UInt64,
    api_call_duration_ms UInt64,
    http_status_code UInt16,
    retry_count UInt32,
    rate_limit_remaining Nullable(UInt32),
    trace_id String,
    parent_trace_id Nullable(String)
) ENGINE = MergeTree()
ORDER BY (tenant_id, platform, shop_id, platform_product_id)
PARTITION BY toYYYYMM(requested_at);

-- Curated product snapshot table (current view)
CREATE TABLE IF NOT EXISTS products_snapshot (
    tenant_id String,
    platform String,
    shop_id String,
    platform_product_id String,
    unified_product_id String,
    title String,
    description Nullable(String),
    brand Nullable(String),
    category Nullable(String),
    category_path Array(String),
    price Nullable(Float64),
    currency Nullable(String),
    original_price Nullable(Float64),
    discount_percentage Nullable(Float64),
    total_quantity Nullable(Int64),
    available_quantity Nullable(Int64),
    reserved_quantity Nullable(Int64),
    skus String, -- JSON array
    main_image_url Nullable(String),
    image_urls Array(String),
    video_urls Array(String),
    platform_attributes String, -- JSON
    platform_categories Array(String),
    platform_tags Array(String),
    status String,
    visibility Nullable(String),
    sales_regions Array(String),
    seo_title Nullable(String),
    seo_description Nullable(String),
    marketing_tags Array(String),
    data_source String,
    needs_detail_sync Bool,
    detail_sync_priority Nullable(UInt8),
    sync_quality_score Nullable(Float32),
    platform_created_at Nullable(DateTime64(3)),
    platform_updated_at Nullable(DateTime64(3)),
    first_synced_at DateTime64(3),
    last_synced_at DateTime64(3),
    last_list_sync_at Nullable(DateTime64(3)),
    last_detail_sync_at Nullable(DateTime64(3)),
    version UInt64,
    checksum String,
    last_sync_trace_id String,
    last_sync_batch_id String
) ENGINE = ReplacingMergeTree(version)
ORDER BY (tenant_id, platform, shop_id, platform_product_id)
PARTITION BY toYYYYMM(last_synced_at);

-- Sync statistics and progress tracking
CREATE TABLE IF NOT EXISTS sync_stats (
    tenant_id String,
    platform String,
    shop_id String,
    sync_batch_id String,
    checkpint_lower DateTime64(3),
    checkpint_upper DateTime64(3),
    sync_type String,
    status String,
    current_page UInt32,
    total_pages_estimate Nullable(UInt32),
    current_cursor Nullable(String),
    current_token Nullable(String),
    current_offset Nullable(UInt64),
    list_requests_sent UInt32,
    list_responses_received UInt32,
    detail_requests_sent UInt32,
    detail_responses_received UInt32,
    products_discovered UInt32,
    products_list_only UInt32,
    products_detail_needed UInt32,
    products_detail_completed UInt32,
    products_failed UInt32,
    avg_list_response_time_ms Nullable(Float64),
    avg_detail_response_time_ms Nullable(Float64),
    throughput_products_per_sec Nullable(Float64),
    rate_limit_hits UInt32,
    api_quota_consumed Nullable(UInt64),
    error_count UInt32,
    last_error_message Nullable(String),
    last_error_at Nullable(DateTime64(3)),
    started_at DateTime64(3),
    last_activity_at DateTime64(3),
    completed_at Nullable(DateTime64(3)),
    next_cursor_update_at Nullable(DateTime64(3)),
    batch_size UInt32,
    concurrency_limit UInt32,
    retry_config String, -- JSON
    trace_id String
) ENGINE = ReplacingMergeTree(last_activity_at)
ORDER BY (tenant_id, platform, shop_id, sync_batch_id)
PARTITION BY toYYYYMM(started_at);

-- Idempotency keys for exactly-once processing  
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key String,
    tenant_id String,
    operation_type String,
    request_hash String,
    request_params String, -- JSON
    status String,
    response_hash Nullable(String),
    response_data Nullable(String), -- JSON
    first_request_at DateTime64(3),
    last_request_at DateTime64(3),
    completed_at Nullable(DateTime64(3)),
    expires_at DateTime64(3),
    trace_id String
) ENGINE = MergeTree()
ORDER BY (key, tenant_id)
PARTITION BY toYYYYMM(first_request_at);
"#;
