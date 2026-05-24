/// โมดูลสำหรับโครงสร้างข้อมูล Product Sync Requests
///
/// โมดูลนี้รวมโครงสร้างข้อมูลที่ใช้ในการจัดการคำขอซิงค์สินค้า
/// รวมถึงการซิงค์แบบเต็ม การซิงค์แบบเรียลไทม์ และการซิงค์ไปยัง Vector Store
use serde::Deserialize;
use utoipa::ToSchema;

use crate::model::v1::platfrom::entries::VectorSyncMode;

/// Query parameters สำหรับการซิงค์สินค้า
///
/// ใช้ในการกำหนดเงื่อนไขการซิงค์ เช่น full sync, page size, และขีดจำกัดต่างๆ
#[derive(Debug, Deserialize, ToSchema)]
pub struct SyncQuery {
    pub full_sync: Option<bool>,
    pub page_size: Option<u32>,
    pub source: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub batch_id: Option<String>,
}

/// Query parameters สำหรับการแสดงรายการสินค้า
///
/// ใช้ในการกำหนด pagination และการจำกัดจำนวนข้อมูลที่ส่งกลับ
#[derive(Debug, Deserialize, ToSchema)]
pub struct ProductListQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    #[serde(default)]
    pub platform: Option<String>,
}

/// Query parameters for listing product snapshots from ClickHouse
#[derive(Debug, Deserialize, ToSchema)]
pub struct ProductSnapshotQuery {
    pub platform: String,
    pub shop_id: String,
    pub limit: Option<usize>,
    pub cursor: Option<String>,
}

/// Query parameters for retrieving sync log entries
#[derive(Debug, Deserialize, ToSchema)]
pub struct ProductSyncLogQuery {
    pub platform: String,
    pub shop_id: String,
    pub limit: Option<usize>,
    pub cursor: Option<String>,
}

/// Query parameters สำหรับการ export สินค้า
///
/// ใช้กำหนด platform และจำนวนข้อมูลที่จะ export
#[derive(Debug, Deserialize, ToSchema)]
pub struct ProductExportQuery {
    /// แพลตฟอร์มที่ต้องการ export (จำเป็น)
    pub platform: Option<String>,
    /// จำนวนสูงสุดของสินค้าที่ต้องการ export (default: 500, max: 5000)
    pub limit: Option<usize>,
    /// รูปแบบไฟล์ที่รองรับ (excel/xlsx)
    pub format: Option<String>,
}

/// Request body สำหรับการซิงค์สินค้า
///
/// รวมข้อมูลที่จำเป็นในการซิงค์สินค้า เช่น shop_id, platform, และ access_token
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SyncRequestBody {
    pub shop_id: String,
    pub platform: String,
    pub mode: Option<String>,
    pub products: Option<Vec<serde_json::Value>>,
    pub access_token: Option<String>,
    pub shop_cipher: Option<String>,
    #[serde(default)]
    pub org_id: Option<String>,
}

/// Request payload for uploading product media
#[derive(Debug, Deserialize, ToSchema)]
pub struct ProductMediaUploadRequest {
    pub file_name: String,
    pub content_type: String,
    pub data_base64: String,
    pub folder: Option<String>,
}

/// Query parameters for downloading product media
#[derive(Debug, Deserialize, ToSchema)]
pub struct ProductMediaDownloadQuery {
    pub key: String,
}

/// Request สำหรับการซิงค์สินค้าแบบเรียลไทม์
///
/// ใช้ในการซิงค์ข้อมูลสินค้าแบบทันทีผ่าน message queue
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct RealtimeSyncRequest {
    pub shop_id: String,
    pub platform: String,
    pub products: Vec<serde_json::Value>,
    pub mode: Option<String>,
    pub source: Option<String>,
    pub correlation_id: Option<String>,
    pub access_token: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

/// Request สำหรับการซิงค์สินค้าไปยัง Vector Store
///
/// ใช้ในการสร้าง embeddings และเก็บข้อมูลสินค้าใน vector database
#[derive(Debug, Deserialize, ToSchema)]
pub struct SyncToVectorRequest {
    pub platform: String,
    pub shop_id: String,
    pub embedding_model: Option<String>,
    pub embedding_prompt: Option<String>,
    pub product_ids: Option<Vec<String>>,
    pub mode: Option<VectorSyncMode>,
    pub limit: Option<u32>,
}

/// Request สำหรับการซิงค์สินค้าจากแพลตฟอร์ม
///
/// รวมข้อมูลที่จำเป็นทั้งหมดสำหรับการดึงและซิงค์ข้อมูลสินค้า
#[derive(Debug, Deserialize, ToSchema)]
pub struct SyncProductsRequest {
    pub shop_id: String,
    pub shop_slug: String, // Also support shop_slug
    pub org_id: String,
    pub user_id: String,
    pub platform: String,
    pub full_sync: bool,
    pub sync_type: Option<String>, // "products", "inventory", "all"
    pub webhook_url: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

/// Request body for triggering a platform product pull using stored credentials.
#[derive(Debug, Deserialize, ToSchema)]
pub struct PlatformProductPullRequest {
    pub org_id: String,
    pub full_sync: Option<bool>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

/// Query parameters สำหรับการแสดงรายการ sync jobs
///
/// ใช้ในการค้นหาและกรอง sync jobs ตามสถานะและเงื่อนไขต่างๆ
#[derive(Debug, Deserialize, ToSchema)]
pub struct ListSyncJobsQuery {
    pub status: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Request payload for fetching sample products and syncing to vector store
#[derive(Debug, Deserialize, ToSchema)]
pub struct SampleVectorSyncRequest {
    pub platform: String,
    pub shop_id: String,
    pub tenant_id: Option<String>,
    pub mode: Option<VectorSyncMode>,
    pub limit: Option<u32>,
    pub product_ids: Option<Vec<String>>,
    pub embedding_model: Option<String>,
    pub embedding_prompt: Option<String>,
    pub credentials: Option<SampleCredentialInput>,
}

/// Inline credential payload for sample sync
#[derive(Debug, Clone, Deserialize, Default, ToSchema)]
pub struct SampleCredentialInput {
    pub api_key: Option<String>,
    pub api_secret: Option<String>,
    pub access_token: Option<String>,
    pub store_url: Option<String>,
}

/// Query parameters for listing staged product sync records
#[derive(Debug, Deserialize, ToSchema)]
pub struct ProductSyncReviewQuery {
    pub shop_id: Option<String>,
    pub platform: Option<String>,
    pub batch_id: Option<String>,
    pub user_action: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

/// Request payload for promoting staged products into the primary catalog
#[derive(Debug, Deserialize, ToSchema)]
pub struct PromoteProductSyncRequest {
    #[serde(default)]
    pub sync_ids: Vec<String>,
}
