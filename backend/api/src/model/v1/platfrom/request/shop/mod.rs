/// ไฟล์ mod.rs - Shop Management Request Models
/// โครงสร้าง requests สำหรับ shop management operations
/// รวม OAuth connection, CRUD operations, callback handling
/// ใช้ในการเชื่อมต่อ e-commerce platforms

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Request สำหรับการเชื่อมต่อร้านค้า
/// เริ่ม OAuth flow สำหรับ platform integration
#[derive(Debug, Deserialize)]
pub struct ConnectShopRequest {
    /// ชื่อร้านค้า (optional)
    pub shop_name: Option<String>,
    /// Redirect URI หลัง OAuth success
    pub redirect_uri: Option<String>,
    /// State parameter สำหรับ CSRF protection
    pub state: Option<String>,
    /// Access token สำหรับ direct authentication
    pub access_token: Option<String>,
}

/// Query parameters สำหรับ connection endpoint
/// มี OpenAPI schema สำหรับ API documentation
#[derive(Debug, Deserialize, ToSchema)]
pub struct ConnectQuery {
    /// ชื่อร้านค้า (optional)
    pub shop_name: Option<String>,
    /// Redirect URI
    pub redirect_uri: Option<String>,
    /// State from Strapi for platforms that support it
    pub state: Option<String>,
    /// For Lazada state encoding
    pub access_token: Option<String>,
}

/// ข้อมูล state สำหรับ OAuth flow
/// เก็บ context และ session information ใน OAuth state parameter
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct StateData {
    /// User ID ของผู้ที่ทำ OAuth
    pub user_id: String,
    /// Organization/Tenant ID
    pub tenant_id: String,
    /// Shop slug (optional)
    pub shop_slug: Option<String>,
    /// Target shop ID (optional)
    pub target_shop_id: Option<String>,
    /// Unix timestamp สำหรับ validation
    pub timestamp: i64,
    /// Platform name
    pub platform: String,
}

/// Request สำหรับการสร้างร้านค้าใหม่
/// ใช้ใน manual shop creation หรือ admin operations
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateShopRequest {
    /// ชื่อร้านค้า
    pub name: String,
    /// Platform type
    pub platform: String,
    /// Shop ID ใน platform
    pub platform_shop_id: String,
    /// Owner user ID
    pub owner_id: String,
    /// Organization ID (optional for multi-tenancy)
    pub organization_id: Option<String>,
}

/// Request สำหรับการอัปเดทข้อมูลร้านค้า
/// อนุญาตให้อัปเดทบาง fields (partial update)
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateShopRequest {
    /// ชื่อร้านใหม่ (optional)
    pub name: Option<String>,
    /// สถานะใหม่ (optional)
    pub status: Option<String>,
    /// Settings เพิ่มเติม (optional)
    pub settings: Option<serde_json::Value>,
}

/// Request จาก OAuth callback endpoint
/// รับ parameters จาก platform หลัง OAuth authorization
#[derive(Debug, Deserialize)]
pub struct CallbackRequest {
    /// Authorization code จาก OAuth provider
    pub code: Option<String>,
    /// State parameter สำหรับ validation
    pub state: Option<String>,
    /// Shop ID จากบาง platform
    pub shop_id: Option<String>,
    /// Digital signature สำหรับ verification
    pub sign: Option<String>,
    /// Timestamp ของ request
    pub timestamp: Option<String>,
}

/// Request สำหรับการ grant shop access
/// ใช้ในการอนุญาตสิทธิ์เข้าถึง shop
#[derive(Debug, Deserialize)]
pub struct GrantShopRequest {
    /// Authorization code
    pub auth_code: String,
    /// Shop ID ที่ต้องการ grant access
    pub shop_id: String,
}

/// Request สำหรับการตัดการเชื่อมต่อร้านค้า
/// ยกเลิก OAuth connection และลบ credentials
#[derive(Debug, Serialize, Deserialize)]
pub struct DisconnectShopRequest {
    /// Shop ID ที่ต้องการ disconnect
    pub shop_id: String,
    /// เหตุผลในการ disconnect (optional)
    pub reason: Option<String>,
}
