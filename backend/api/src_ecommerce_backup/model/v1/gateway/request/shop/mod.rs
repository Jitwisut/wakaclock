//! ไฟล์ mod.rs - Request models สำหรับการจัดการ shop connections
//! จัดการโครงสร้างข้อมูลสำหรับการเชื่อมต่อ ตั้งค่า และจัดการร้านค้าจาก platform ต่างๆ
//! รองรับทั้งระบบ OAuth flow และ credential-based authentication

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// ConnectShopRequest - โครงสร้าง request สำหรับการเชื่อมต่อร้านค้า
/// ใช้สำหรับ initial connection กับ e-commerce platforms
#[derive(Debug, Deserialize)]
pub struct ConnectShopRequest {
    /// ชื่อร้านค้าที่ต้องการเชื่อมต่อ
    pub shop_name: Option<String>,

    /// URI สำหรับ redirect หลังจาก OAuth flow สำเร็จ
    pub redirect_uri: Option<String>,

    /// State parameter สำหรับการ tracking OAuth flow
    pub state: Option<String>,

    /// Access token สำหรับ platform ที่รองรับ direct token access
    pub access_token: Option<String>,
}

/// ConnectQuery - query parameters สำหรับการเชื่อมต่อร้านค้า
/// ใช้สำหรับรับ parameters จาก URL query string
#[derive(Debug, Deserialize, ToSchema)]
pub struct ConnectQuery {
    /// ชื่อร้านค้าจาก query parameter
    pub shop_name: Option<String>,

    /// Redirect URI จาก query parameter
    pub redirect_uri: Option<String>,

    /// State จาก Strapi สำหรับ platform ที่รองรับ state parameter
    pub state: Option<String>,

    /// Access token สำหรับ Lazada state encoding และ platform อื่นๆ
    pub access_token: Option<String>,
}

/// StateData - ข้อมูล state ที่เก็บไว้ระหว่าง OAuth flow
/// ใช้สำหรับ tracking context และ security ระหว่างการ authorize
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct StateData {
    /// ID ของ user ที่กำลังทำการเชื่อมต่อ
    pub user_id: String,

    /// ID ของ tenant/organization
    pub tenant_id: String,

    /// Slug ของร้านค้า (สำหรับการ identify)
    pub shop_slug: Option<String>,

    /// ID ของร้านค้าเป้าหมาย
    pub target_shop_id: Option<String>,

    /// Timestamp ของการสร้าง state (สำหรับ security)
    pub timestamp: i64,

    /// ชื่อ platform ที่กำลังเชื่อมต่อ
    pub platform: String,
}

/// CreateShopRequest - โครงสร้าง request สำหรับการสร้างร้านค้าใหม่
/// ใช้หลังจาก OAuth flow สำเร็จ เพื่อบันทึกข้อมูลร้านค้าลงระบบ
#[derive(Debug, Serialize, Deserialize)]
pub struct CreateShopRequest {
    /// ชื่อร้านค้า
    pub name: String,

    /// ชื่อ platform (เช่น "shopify", "lazada")
    pub platform: String,

    /// ID ของร้านค้าใน platform นั้นๆ
    pub platform_shop_id: String,

    /// ID ของเจ้าของร้านค้า
    pub owner_id: String,

    /// ID ขององค์กร (ถ้ามี)
    pub organization_id: Option<String>,
}

/// UpdateShopRequest - โครงสร้าง request สำหรับการอัพเดทข้อมูลร้านค้า
/// ใช้สำหรับแก้ไขการตั้งค่าและข้อมูลของร้านค้า
#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateShopRequest {
    /// ชื่อร้านค้าใหม่
    pub name: Option<String>,

    /// สถานะของร้านค้า (active, inactive, suspended)
    pub status: Option<String>,

    /// การตั้งค่าเพิ่มเติมในรูปแบบ JSON
    pub settings: Option<serde_json::Value>,
}

/// CallbackRequest - โครงสร้าง request สำหรับ OAuth callback
/// รับข้อมูลที่ส่งกลับมาจาก platform หลังจาก user authorize
#[derive(Debug, Deserialize)]
pub struct CallbackRequest {
    /// Authorization code จาก OAuth flow
    pub code: Option<String>,

    /// State parameter เพื่อ verify OAuth request
    pub state: Option<String>,

    /// Shop ID จาก platform (สำหรับบาง platform)
    pub shop_id: Option<String>,

    /// Signature สำหรับ verification (สำหรับบาง platform)
    pub sign: Option<String>,

    /// Timestamp ของ callback (สำหรับ security check)
    pub timestamp: Option<String>,
}

/// GrantShopRequest - โครงสร้าง request สำหรับการ grant สิทธิ์ร้านค้า
/// ใช้สำหรับ platform ที่ต้องการการ confirm เพิ่มเติมหลัง OAuth
#[derive(Debug, Deserialize)]
pub struct GrantShopRequest {
    /// Authorization code ที่ได้จาก OAuth flow
    pub auth_code: String,

    /// ID ของร้านค้าที่ต้องการ grant สิทธิ์
    pub shop_id: String,
}

/// DisconnectShopRequest - โครงสร้าง request สำหรับการตัดการเชื่อมต่อร้านค้า
/// ใช้เมื่อ user ต้องการยกเลิกการเชื่อมต่อกับ platform
#[derive(Debug, Serialize, Deserialize)]
pub struct DisconnectShopRequest {
    /// ID ของร้านค้าที่ต้องการตัดการเชื่อมต่อ
    pub shop_id: String,

    /// เหตุผลในการตัดการเชื่อมต่อ (สำหรับ audit log)
    pub reason: Option<String>,
}
