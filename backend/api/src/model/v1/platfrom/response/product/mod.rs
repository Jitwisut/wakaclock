/// โมดูล response models สำหรับ product operations
///
/// โมดูลนี้รวมโครงสร้างข้อมูล response สำหรับ API endpoints
/// ที่เกี่ยวข้องกับการจัดการผลิตภัณฑ์
pub mod sync;

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

pub use sync::{
    Category, ProductMediaDownloadResponse, ProductMediaUploadResponse, ProductSnapshot,
    ProductSnapshotListResponse, ProductSyncLogEntry, ProductSyncLogResponse,
    ProductSyncReviewListResponse, ProductSyncReviewRecord, ProductSyncRunStatus,
    PromoteProductSyncResponse, SampleVectorSyncResponse, SyncProductListResponse,
    SyncProductsResponse, SyncResponse, SyncStatusResponse, SyncToVectorResponse,
};

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProductResponse {
    pub product_id: String,
    pub shop_id: String,
    pub platform: String,
    pub platform_product_id: String,
    pub title: String,
    pub description: Option<String>,
    pub price: Decimal,
    pub currency: String,
    pub sku: String,
    pub quantity: i32,
    pub images: Vec<ProductImageResponse>,
    pub categories: Vec<String>,
    pub attributes: serde_json::Value,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub synced_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProductImageResponse {
    pub url: String,
    pub alt: Option<String>,
    pub is_primary: bool,
    pub position: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProductListResponse {
    pub products: Vec<ProductListItem>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
    pub total_pages: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SyncErrorResponse {
    pub product_id: Option<String>,
    pub sku: Option<String>,
    pub error: String,
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ImportProductsResponse {
    pub imported_count: usize,
    pub failed_count: usize,
    pub job_id: String,
    pub status: String,
    pub errors: Vec<ImportErrorResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ImportErrorResponse {
    pub row: usize,
    pub error: String,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BulkUpdateResponse {
    pub updated_count: usize,
    pub failed_count: usize,
    pub errors: Vec<UpdateErrorResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UpdateErrorResponse {
    pub product_id: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProductListItem {
    pub product_id: String,
    pub platform: String,
    pub platform_shop_id: String,
    pub title: String,
    pub description: String,
    pub price: f64,
    pub currency: String,
    pub inventory: u32,
    pub availability: String,
    pub image_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ProductDetail {
    pub product_id: String,
    pub platform: String,
    pub platform_shop_id: String,
    pub platform_product_id: String,
    pub title: String,
    pub description: String,
    pub brand: String,
    pub categories: Vec<String>,
    pub tags: Vec<String>,
    pub price: f64,
    pub shipping_price: f64,
    pub shipping_free: bool,
    pub currency: String,
    pub inventory: u32,
    pub availability: String,
    pub images: Vec<String>,
    pub variants: serde_json::Value,
    pub custom_fields: serde_json::Value,
    pub rating: f32,
    pub reviews_count: u32,
    pub created_at: String,
    pub updated_at: String,
}
