/// ไฟล์ mod.rs - Shop Management Response Models
/// โครงสร้าง responses สำหรับ shop management endpoints
/// รวม OAuth connection, shop CRUD, status responses
/// ใช้กับ e-commerce platform integration
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Response เมื่อเริ่ม OAuth connection
/// ส่ง auth URL และ state ไปยัง frontend
#[derive(Debug, Serialize)]
pub struct ConnectShopResponse {
    /// OAuth authorization URL
    pub auth_url: String,
    /// State parameter สำหรับ CSRF protection
    pub state: String,
}

/// Response สำหรับ platform connection
/// มี OpenAPI schema สำหรับ API documentation
#[derive(Debug, Serialize, ToSchema)]
pub struct ConnectResponse {
    /// OAuth authorization URL
    pub auth_url: String,
    /// State parameter
    pub state: String,
}

/// Response จาก OAuth callback
/// เก็บ tokens และ shop information
#[derive(Debug, Serialize, Deserialize)]
pub struct CallbackResponse {
    /// Shop ID ที่สร้างใหม่
    pub shop_id: String,
    /// Access token จาก platform
    pub access_token: String,
    /// Refresh token (optional)
    pub refresh_token: Option<String>,
    /// เวลาหมดอายุของ token
    pub expires_at: Option<DateTime<Utc>>,
}

/// Response สำหรับ shop information
/// เก็บข้อมูลร้านค้าที่เชื่อมต่อแล้ว
#[derive(Debug, Serialize, Deserialize)]
pub struct ShopResponse {
    /// Internal shop ID
    pub shop_id: String,
    /// ชื่อร้าน
    pub name: String,
    /// Platform name
    pub platform: String,
    /// Shop ID ใน platform
    pub platform_shop_id: String,
    /// สถานะการเชื่อมต่อ
    pub status: String,
    /// Owner user ID
    pub owner_id: String,
    /// Organization ID (optional)
    pub organization_id: Option<String>,
    /// เวลาที่สร้าง
    pub created_at: DateTime<Utc>,
    /// เวลาที่อัปเดทล่าสุด
    pub updated_at: DateTime<Utc>,
}

/// Response สำหรับรายการร้านค้า
/// รวม pagination และ total count
#[derive(Debug, Serialize)]
pub struct ShopListResponse {
    /// รายการร้านค้า
    pub shops: Vec<ShopResponse>,
    /// จำนวนทั้งหมด
    pub total: usize,
    /// หน้าปัจจุบัน
    pub page: u32,
    /// จำนวนต่อหน้า
    pub limit: u32,
}

/// Response สำหรับสถานะการเชื่อมต่อ
/// ตรวจสอบการ sync และ token expiry
#[derive(Debug, Serialize, Deserialize)]
pub struct ShopStatusResponse {
    /// Shop ID
    pub shop_id: String,
    /// Platform name
    pub platform: String,
    /// สถานะการเชื่อมต่อ
    pub connected: bool,
    /// เวลา sync ล่าสุด
    pub last_sync: Option<DateTime<Utc>>,
    /// ประเภทของ credentials
    pub credentials_type: String,
    /// เวลาหมดอายุของ credentials
    pub expires_at: Option<DateTime<Utc>>,
}
