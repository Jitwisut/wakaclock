/// ไฟล์ sync.rs - Vector Sync Request Models
/// โครงสร้างข้อมูลสำหรับการซิงค์ product vectors กับ vector database
/// รองรับการดึงข้อมูล vector products จาก platform และ shop
/// ใช้สำหรับการประมวลผล batch vector synchronization
use serde::Deserialize;
use utoipa::ToSchema;

#[derive(Debug, Deserialize, ToSchema)]
pub struct GetProductVectorQuery {
    pub platform: String,
    pub shop_id: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SyncStatusQuery {
    pub platform: String,
    pub shop_id: String,
    pub job_id: Option<String>,
}
