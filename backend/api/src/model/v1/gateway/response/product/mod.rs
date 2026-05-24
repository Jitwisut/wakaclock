//! # Gateway Product Response Models Module
//!
//! โมดูลนี้กำหนดโครงสร้างข้อมูลสำหรับ Gateway API response ของสินค้า
//! รวมโมเดลสำหรับแพลตฟอร์มต่างๆ และการจัดการข้อมูลสินค้า
//!
//! ## ฟีเจอร์หลัก
//! - Product response models สำหรับทุกแพลตฟอร์ม
//! - Sync และ import response structures
//! - Error handling และ status tracking
//! - Pagination และ list management
//! - Multi-platform product aggregation

pub mod lazada;
pub mod line;
pub mod medusa;
pub mod medusa_category;
pub mod shopee;
pub mod tiktok;

pub mod sync;

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

pub use sync::{
    Category, SyncProductListResponse, SyncProductsResponse, SyncResponse, SyncStatusResponse,
    SyncToVectorResponse,
};

// Re-export Medusa category types for easier access
pub use medusa_category::{
    MedusaCategoryListParams, MedusaCategoryListResponse, MedusaCategoryResponse,
    MedusaCategoryTreeNode, MedusaCreateCategoryRequest, MedusaDateFilter,
    MedusaUpdateCategoryRequest,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductImageResponse {
    pub url: String,
    pub alt: Option<String>,
    pub is_primary: bool,
    pub position: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductListResponse {
    pub products: Vec<ProductListItem>,
    pub total: u64,
    pub page: u32,
    pub limit: u32,
    pub total_pages: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncErrorResponse {
    pub product_id: Option<String>,
    pub sku: Option<String>,
    pub error: String,
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportProductsResponse {
    pub imported_count: usize,
    pub failed_count: usize,
    pub job_id: String,
    pub status: String,
    pub errors: Vec<ImportErrorResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportErrorResponse {
    pub row: usize,
    pub error: String,
    pub data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkUpdateResponse {
    pub updated_count: usize,
    pub failed_count: usize,
    pub errors: Vec<UpdateErrorResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateErrorResponse {
    pub product_id: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Serialize)]
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
