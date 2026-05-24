/// โครงสร้างข้อมูลสำหรับ vector sync requests
///
/// ไฟล์นี้กำหนดโครงสร้างข้อมูลสำหรับคำขอที่เกี่ยวข้องกับ
/// การซิงโครไนซ์ vector data และการตรวจสอบสถานะ
use serde::Deserialize;
use utoipa::ToSchema;

/// Query parameters สำหรับการดึง product vector
#[derive(Debug, Deserialize, ToSchema)]
pub struct GetProductVectorQuery {
    pub platform: String,
    pub shop_id: String,
}

/// Query parameters สำหรับการตรวจสอบสถานะการซิงค์
#[derive(Debug, Deserialize, ToSchema)]
pub struct SyncStatusQuery {
    pub platform: String,
    pub shop_id: String,
    pub job_id: Option<String>,
}
