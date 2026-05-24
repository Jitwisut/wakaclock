/// ไฟล์ common.rs - Common Types และ Shared Entities
/// โครงสร้างข้อมูลที่ใช้ร่วมกันทั่วทั้ง application
/// รวม platform types, status enums, และ credential management
/// Re-export error types สำหรับความสะดวก
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

// Re-export error types จาก infrastructure layer
pub use crate::infrastructure::error::{AppError, AppResult, DomainError};

/// Enum สำหรับประเภท e-commerce platform
/// ใช้ Copy trait สำหรัประสิทธิภาพ
/// รองรับ 22 platforms
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub enum PlatformType {
    TikTok,
    Shopee,
    Lazada,
    Shopify,
    WooCommerce,
    BigCommerce,
    Magento,
    Amazon,
    Ebay,
    Etsy,
    Alibaba,
    AliExpress,
    Wix,
    Ecwid,
    Medusa,
    Zoho,
    LineShop,
    Taobao,
    JD,
    Walmart,
    Rakuten,
    Custom,
}

/// สถานะของสินค้าในระบบ
/// ใช้ในการจัดการ lifecycle ของสินค้า
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub enum ProductStatus {
    Active,
    Inactive,
    Draft,
    Archived,
    OutOfStock,
    Deleted,
}

/// Type aliases สำหรับ ID types
/// ใช้ String เพื่อความยืดหยุ่นและรองรับ UUID
pub type ShopId = String;
pub type UserId = String;
pub type OrganizationId = String;
pub type ProductId = String;
pub type SKU = String;

// Vector search types ถูกย้ายไป request/vector และ response/vector modules

/// โครงสร้างองค์กร
/// ใช้สำหรับ multi-tenancy
/// Settings เก็บใน JSON format
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Organization {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub settings: HashMap<String, serde_json::Value>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// Re-export ProductRow จาก product module เพื่อ backward compatibility
pub use super::product::ProductRow;

/// สินค้าที่รวมจากหลาย platform
/// ใช้ในการแสดงผลแบบ unified view
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UnifiedProduct {
    pub id: String,
    pub products: Vec<ProductRow>,
}

/// สถานะของ background job
/// ใช้ในการติดตามการทำงาน
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

/// Job สำหรับซิงค์ข้อมูลไป vector database
/// ใช้ในการสร้าง embeddings สำหรับ search
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VectorSyncJob {
    pub id: String,
    pub status: JobStatus,
    pub product_ids: Vec<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

/// Vector sync processing mode (single item vs batch)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum VectorSyncMode {
    Items,
    Batch,
}

impl Default for VectorSyncMode {
    fn default() -> Self {
        VectorSyncMode::Batch
    }
}

/// ประเภทการกระทำสำหรับ audit log
/// ใช้ติดตามการเปลี่ยนแปลงข้อมูล
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditAction {
    Create,
    Read,
    Update,
    Delete,
}

/// ประเภทของผู้กระทำการใน audit log
/// แยกระหว่าง user, system, service
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PrincipalType {
    User,
    System,
    Service,
}
use chrono::{DateTime, Utc};
use uuid::Uuid;

// Re-export credential types จาก request module เพื่อ backward compatibility
pub use crate::model::v1::platfrom::request::credential::{ApiKeyCredential, OAuthCredential};

/// โครงสร้าง credential ที่เก็บในระบบ
/// รองรับการเข้ารหัส, rotation, และ audit trail
/// ใช้ DEK (Data Encryption Key) สำหรับความปลอดภัย
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredCredential {
    pub id: Uuid,
    pub platform: String,
    pub account_id: String,
    pub credential_type: CredentialType,
    pub oauth_data: Option<OAuthCredential>,
    pub api_key_data: Option<ApiKeyCredential>,
    pub dek_encrypted: String,
    pub encryption_version: i32,
    pub owner_id: String,
    pub tenant_id: Option<String>,
    pub permissions: Vec<String>,
    pub rotation_version: i32,
    pub last_rotated_at: Option<DateTime<Utc>>,
    pub next_rotation_at: Option<DateTime<Utc>>,
    pub last_accessed_at: Option<DateTime<Utc>>,
    pub access_count: i32,
    pub last_accessed_by: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub created_by: String,
    pub updated_by: String,
    pub deleted_at: Option<DateTime<Utc>>,
    pub deleted_by: Option<String>,
}

/// ประเภทของ credential
/// รองรับ OAuth, API Key, Username/Password
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CredentialType {
    OAuth,
    ApiKey,
    UsernamePassword,
}

/// Implement Display trait สำหรับ PlatformType
/// แปลงเป็น lowercase string สำหรับ URL และ API
impl std::fmt::Display for PlatformType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            PlatformType::TikTok => "tiktok",
            PlatformType::Shopee => "shopee",
            PlatformType::Lazada => "lazada",
            PlatformType::Shopify => "shopify",
            PlatformType::WooCommerce => "woocommerce",
            PlatformType::BigCommerce => "bigcommerce",
            PlatformType::Magento => "magento",
            PlatformType::Amazon => "amazon",
            PlatformType::Ebay => "ebay",
            PlatformType::Etsy => "etsy",
            PlatformType::Alibaba => "alibaba",
            PlatformType::AliExpress => "aliexpress",
            PlatformType::Wix => "wix",
            PlatformType::Ecwid => "ecwid",
            PlatformType::Medusa => "medusa",
            PlatformType::Zoho => "zoho",
            PlatformType::LineShop => "lineshop",
            PlatformType::Taobao => "taobao",
            PlatformType::JD => "jd",
            PlatformType::Walmart => "walmart",
            PlatformType::Rakuten => "rakuten",
            PlatformType::Custom => "custom",
        };
        write!(f, "{}", s)
    }
}

/// Implement Display trait สำหรับ ProductStatus
/// แปลงเป็น snake_case string
impl std::fmt::Display for ProductStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            ProductStatus::Active => "active",
            ProductStatus::Inactive => "inactive",
            ProductStatus::Draft => "draft",
            ProductStatus::Archived => "archived",
            ProductStatus::OutOfStock => "out_of_stock",
            ProductStatus::Deleted => "deleted",
        };
        write!(f, "{}", s)
    }
}

/// Implement FromStr trait สำหรับ PlatformType
/// Parse จาก string (case-insensitive)
/// รองรับ variations เช่น lineshop, line_shop
impl std::str::FromStr for PlatformType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "tiktok" => Ok(PlatformType::TikTok),
            "shopee" => Ok(PlatformType::Shopee),
            "lazada" => Ok(PlatformType::Lazada),
            "shopify" => Ok(PlatformType::Shopify),
            "woocommerce" => Ok(PlatformType::WooCommerce),
            "bigcommerce" => Ok(PlatformType::BigCommerce),
            "magento" => Ok(PlatformType::Magento),
            "amazon" => Ok(PlatformType::Amazon),
            "ebay" => Ok(PlatformType::Ebay),
            "etsy" => Ok(PlatformType::Etsy),
            "alibaba" => Ok(PlatformType::Alibaba),
            "aliexpress" => Ok(PlatformType::AliExpress),
            "wix" => Ok(PlatformType::Wix),
            "ecwid" => Ok(PlatformType::Ecwid),
            "medusa" => Ok(PlatformType::Medusa),
            "zoho" => Ok(PlatformType::Zoho),
            "lineshop" | "line_shop" | "lineshopping" | "line_shopping" | "line" => {
                Ok(PlatformType::LineShop)
            }
            "taobao" => Ok(PlatformType::Taobao),
            "jd" => Ok(PlatformType::JD),
            "walmart" => Ok(PlatformType::Walmart),
            "rakuten" => Ok(PlatformType::Rakuten),
            "custom" => Ok(PlatformType::Custom),
            _ => Err(format!("Unknown platform: {}", s)),
        }
    }
}

/// Implement Display trait สำหรับ CredentialType
/// แปลงเป็น snake_case string
impl std::fmt::Display for CredentialType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CredentialType::OAuth => write!(f, "oauth"),
            CredentialType::ApiKey => write!(f, "api_key"),
            CredentialType::UsernamePassword => write!(f, "username_password"),
        }
    }
}

/// Audit log สำหรับการใช้ credential
/// เก็บทุกการเข้าถึงและการใช้งาน
/// รวม IP address, user agent, และ metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialAuditLog {
    pub id: Uuid,
    pub credential_id: Uuid,
    pub platform: String,
    pub account_id: String,
    pub principal_id: String,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub service_name: Option<String>,
    pub request_id: Option<String>,
    pub success: bool,
    pub error_message: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}
