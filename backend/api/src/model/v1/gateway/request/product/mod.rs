//! โมดูลการจัดการ Product Request (Product Request Module)
//!
//! ไฟล์นี้ประกอบด้วยโครงสร้างและฟังก์ชันต่างๆ ที่เกี่ยวข้องกับ
//! การจัดการสินค้าในระบบ Gateway รวมถึง CRUD operations,
//! การซิงค์, การค้นหา, และการนำเข้าข้อมูล
//!
//! ## โมดูลย่อย
//! - `sync`: การซิงค์สินค้าระหว่างแพลตฟอร์ม
//!
//! ## ฟีเจอร์หลัก
//! - สร้าง, อัพเดต, และลบสินค้า
//! - การอัพเดตสินค้าแบบกลุ่ม (Bulk Update)
//! - การนำเข้าข้อมูลสินค้า (Import)
//! - การค้นหาและกรองข้อมูลสินค้า
//!
//! ## ไดเรกทอรี
//! `src/model/v1/gateway/request/product/`

pub mod sync;

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

pub use sync::{
    ListSyncJobsQuery, ProductListQuery, RealtimeSyncRequest, SyncProductsRequest, SyncQuery,
    SyncRequestBody, SyncToVectorRequest,
};

/// โครงสร้างคำขอสร้างสินค้าใหม่ (Create Product Request)
///
/// ใช้สำหรับส่งข้อมูลสินค้าใหม่ที่ต้องการสร้างในระบบ
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateProductRequest {
    /// ID ของร้านค้า
    pub shop_id: String,
    /// ชื่อแพลตฟอร์ม
    pub platform: String,
    /// ชื่อสินค้า
    pub title: String,
    /// คำอธิบายสินค้า (ถ้ามี)
    pub description: Option<String>,
    /// ราคาสินค้า
    pub price: Decimal,
    /// สกุลเงิน
    pub currency: String,
    /// รหัส SKU (Stock Keeping Unit)
    pub sku: String,
    /// จำนวนสต็อค
    pub quantity: i32,
    /// URL ของรูปภาพสินค้า
    pub images: Vec<String>,
    /// หมวดหมู่สินค้า
    pub categories: Vec<String>,
    /// คุณสมบัติเพิ่มเติมของสินค้า (ถ้ามี)
    pub attributes: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UpdateProductRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub price: Option<Decimal>,
    pub quantity: Option<i32>,
    pub images: Option<Vec<String>>,
    pub categories: Option<Vec<String>>,
    pub attributes: Option<serde_json::Value>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BulkUpdateProductsRequest {
    pub product_ids: Vec<String>,
    pub updates: UpdateProductRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ImportProductsRequest {
    pub shop_id: String,
    pub platform: String,
    pub source_url: Option<String>,
    pub file_data: Option<Vec<u8>>,
    pub format: String, // csv, json, xml
    pub mapping: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SearchProductsRequest {
    pub query: String,
    pub shop_id: Option<String>,
    pub platform: Option<String>,
    pub filters: Option<serde_json::Value>,
    pub page: u32,
    pub limit: u32,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ListProductsQuery {
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(default = "default_limit")]
    pub limit: u32,
    pub platform: Option<String>,
    pub shop_id: Option<String>,
    pub search: Option<String>,
}

pub fn default_page() -> u32 {
    1
}

pub fn default_limit() -> u32 {
    20
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct GetProductQuery {
    pub platform: String,
    pub shop_id: String,
}
