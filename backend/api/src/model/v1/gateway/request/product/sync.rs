/// ไฟล์ sync.rs - Product Sync Request Models
/// โครงสร้างข้อมูลสำหรับการซิงค์สินค้าจากแพลตฟอร์มต่างๆ
/// รองรับ full sync, partial sync และ batch processing
/// ใช้สำหรับการจัดการ pagination และ sync job configuration
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct SyncQuery {
    pub full_sync: Option<bool>,
    pub page_size: Option<u32>,
    pub source: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub batch_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ProductListQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    #[serde(default)]
    pub platform: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
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

#[derive(Debug, Clone, Deserialize)]
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

#[derive(Debug, Deserialize)]
pub struct SyncToVectorRequest {
    pub platform: String,
    pub shop_id: String,
    pub embedding_model: Option<String>,
    pub embedding_prompt: Option<String>,
    pub product_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
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

#[derive(Debug, Deserialize)]
pub struct ListSyncJobsQuery {
    pub status: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}
