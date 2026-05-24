use crate::model::v1::platfrom::entries::Product;
/// ไฟล์ sync.rs - Product Sync Response Models
/// โครงสร้างข้อมูลสำหรับการตอบกลับผลการซิงค์สินค้า
/// รวมข้อมูลสถานะการซิงค์, จำนวนสินค้า และ error reporting
/// ใช้สำหรับการติดตามและรายงานผลการซิงค์ข้อมูล
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub level: u32,
}

#[derive(Debug, Serialize)]
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

#[derive(Debug, Serialize)]
pub struct SyncProductListResponse {
    pub products: Vec<Product>,
    pub total: usize,
    pub has_more: bool,
}

#[derive(Debug, Serialize)]
pub struct SyncToVectorResponse {
    pub job_id: String,
    pub status: String,
    pub total_products: usize,
}

#[derive(Debug, Serialize)]
pub struct SyncProductsResponse {
    pub job_id: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
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
