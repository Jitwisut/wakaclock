/// ไฟล์ connect.rs - Platform Connection Query Models
/// โครงสร้างข้อมูล query parameters สำหรับการเชื่อมต่อแพลตฟอร์ม
/// รองรับ OAuth flow และ platform integration parameters
/// ใช้สำหรับ shop connection และ redirect URI management
use serde::Deserialize;
use utoipa::{IntoParams, ToSchema};

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct ConnectQuery {
    pub shop_id: String,
    pub org_id: String,
    pub user_id: Option<String>, // Optional user ID (defaults to org_id if not provided)
    pub redirect_uri: Option<String>,
    #[serde(default)]
    pub shop_domain: Option<String>,
    #[serde(default)]
    pub shop_region: Option<String>,
}
