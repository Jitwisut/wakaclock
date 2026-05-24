/// ไฟล์ shop.rs - Shop Entity และ Business Logic
/// โครงสร้างข้อมูลร้านค้าจาก e-commerce platforms
/// รองรับ multi-tenancy ด้วย tenant_id
/// เก็บ metadata สำหรับข้อมูลเพิ่มเติมแต่ละ platform
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::{OrganizationId, PlatformType, ShopId, UserId};

/// โครงสร้างร้านค้า
/// เชื่อมโยง user กับ platform shop
/// รองรับทั้ง user-scoped และ organization-scoped
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Shop {
    pub shop_id: ShopId,
    pub user_id: UserId,
    pub tenant_id: Option<OrganizationId>,
    pub platform: PlatformType,
    pub platform_shop_id: String,
    pub shop_name: String,
    pub shop_url: Option<String>,
    pub metadata: HashMap<String, String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Shop {
    /// สร้าง Shop instance ใหม่
    /// Set timestamps และ default values อัตโนมัติ
    /// Returns: Shop instance พร้อมใช้งาน
    pub fn new(
        shop_id: ShopId,
        user_id: UserId,
        tenant_id: Option<OrganizationId>,
        platform: PlatformType,
        platform_shop_id: String,
        shop_name: String,
    ) -> Self {
        Self {
            shop_id,
            user_id,
            tenant_id,
            platform,
            platform_shop_id,
            shop_name,
            shop_url: None,
            metadata: HashMap::new(),
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
}
