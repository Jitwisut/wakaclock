use crate::model::v1::platfrom::entries::{Product, VectorSyncMode};
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use utoipa::ToSchema;

/// โครงสร้างข้อมูลสำหรับหมวดหมู่สินค้า
#[derive(Debug, Serialize, ToSchema)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub level: u32,
}

/// Response สำหรับการซิงโครไนซ์ผลิตภัณฑ์
#[derive(Debug, Serialize, ToSchema)]
pub struct SyncResponse {
    pub message: String,
    pub status: String,
    pub sync_id: Option<String>,
    pub job_id: Option<String>,
    pub synced_count: usize,
    pub failed_count: usize,
    pub success: bool,
    pub products_synced: usize,
    pub products_failed: usize,
    pub errors: Vec<String>,
}

/// Response สำหรับการแสดงรายการผลิตภัณฑ์ที่ซิงโครไนซ์
#[derive(Debug, Serialize, ToSchema)]
pub struct SyncProductListResponse {
    pub products: Vec<Product>,
    pub total: usize,
    pub has_more: bool,
}

/// Response สำหรับการซิงค์ข้อมูลไปยัง vector database
#[derive(Debug, Serialize, ToSchema)]
pub struct SyncToVectorResponse {
    pub job_id: String,
    pub status: String,
    pub total_products: usize,
}

/// Response for sample vector sync orchestration
#[derive(Debug, Serialize, ToSchema)]
pub struct SampleVectorSyncResponse {
    pub job_ids: Vec<String>,
    pub mode: VectorSyncMode,
    pub sample_count: usize,
}

/// Response สำหรับการเริ่มต้นการซิงโครไนซ์ผลิตภัณฑ์
#[derive(Debug, Serialize, ToSchema)]
pub struct SyncProductsResponse {
    pub job_id: String,
    pub status: String,
    pub message: String,
}

/// Response สำหรับสถานะการซิงโครไนซ์
#[derive(Debug, Serialize, ToSchema)]
pub struct SyncStatusResponse {
    pub job_id: String,
    pub platform: String,
    pub shop_id: String,
    pub status: String,
    pub progress: f32,
    pub total_products: i32,
    pub synced_products: i32,
    pub failed_products: i32,
    pub error_message: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

/// Snapshot representation of products stored in ClickHouse
#[derive(Debug, Serialize, ToSchema)]
pub struct ProductSnapshot {
    pub marketplace: String,
    pub sku: Option<String>,
    pub idea_key: Option<String>,
    pub url: Option<String>,
    pub title: Option<String>,
    pub brand: Option<String>,
    pub price_amount: Option<f64>,
    pub price_currency: Option<String>,
    pub inventory_quantity: Option<i32>,
    pub inventory_status: Option<String>,
    pub images: Vec<String>,
    pub attributes: Value,
    pub version_ts: DateTime<Utc>,
}

/// Response wrapper for product snapshots
#[derive(Debug, Serialize, ToSchema)]
pub struct ProductSnapshotListResponse {
    pub snapshots: Vec<ProductSnapshot>,
    pub next_cursor: Option<String>,
}

/// Run status information returned to the frontend
#[derive(Debug, Serialize, ToSchema)]
pub struct ProductSyncRunStatus {
    pub state: String,
    pub run_id: String,
    pub worker_id: String,
    pub lower_ts: Option<String>,
    pub upper_ts: Option<String>,
    pub page_seq: u32,
    pub current_cursor: Option<String>,
    pub current_offset: Option<i64>,
    pub items_total: u64,
    pub items_list_only: u64,
    pub items_detail_enqueued: u64,
    pub items_detail_skipped: u64,
    pub lag_detail_consumer: u64,
    pub backoff_seconds: u32,
    pub started_at: u64,
    pub updated_at: u64,
    pub heartbeat_ts: u64,
    pub last_error_code: Option<String>,
    pub last_error_msg: Option<String>,
}

/// Individual log entry for sync progress
#[derive(Debug, Serialize, ToSchema)]
pub struct ProductSyncLogEntry {
    pub id: String,
    pub page_seq: u32,
    pub items_emitted: u64,
    pub cursor: Option<String>,
    pub offset: Option<i64>,
    pub duration_ms: u64,
    pub detail_enqueued: u64,
    pub snapshot_upserts: u64,
    pub errors: u64,
}

/// Response containing run status and progress stream entries
#[derive(Debug, Serialize, ToSchema)]
pub struct ProductSyncLogResponse {
    pub run_status: Option<ProductSyncRunStatus>,
    pub entries: Vec<ProductSyncLogEntry>,
    pub next_cursor: Option<String>,
}

/// Response returned after uploading media via Cloudflare worker
#[derive(Debug, Serialize, ToSchema)]
pub struct ProductMediaUploadResponse {
    pub key: String,
    pub public_url: Option<String>,
    pub download_url: Option<String>,
}

/// Response for resolving download URL of uploaded media
#[derive(Debug, Serialize, ToSchema)]
pub struct ProductMediaDownloadResponse {
    pub download_url: String,
}

/// Individual staged product sync record returned to the UI
#[derive(Debug, Serialize, ToSchema)]
pub struct ProductSyncReviewRecord {
    pub sync_id: String,
    pub sync_batch_id: String,
    pub tenant_id: String,
    pub shop_id: String,
    pub platform: String,
    pub platform_product_id: String,
    pub user_action: String,
    pub sync_status: String,
    pub synced_at: Option<String>,
    pub approved_at: Option<String>,
    pub approved_by: Option<String>,
    pub product: Value,
}

/// Paginated response for staged product sync records
#[derive(Debug, Serialize, ToSchema)]
pub struct ProductSyncReviewListResponse {
    pub records: Vec<ProductSyncReviewRecord>,
    pub total: u64,
    pub limit: u32,
    pub offset: u32,
}

/// Response returned after promoting staged products
#[derive(Debug, Serialize, ToSchema)]
pub struct PromoteProductSyncResponse {
    pub promoted: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}
