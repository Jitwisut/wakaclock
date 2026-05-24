/// โมดูล E-commerce Platform Clients - Gateway สำหรับแต่ละแพลตฟอร์ม
///
/// โมดูลนี้รวมรวม gateway clients สำหรับแพลตฟอร์มต่างๆ ทั้ง marketplace และ e-commerce
/// โดยแต่ละ gateway จะติดตั้ง API interface เฉพาะของแต่ละแพลตฟอร์ม
///
/// # แพลตฟอร์มที่รองรับ
/// ## Marketplace Platforms
/// - Alibaba, AliExpress: B2B และ B2C marketplace จากจีน
/// - Amazon: Global e-commerce marketplace
/// - eBay: Auction และ fixed-price marketplace
/// - Etsy: Handmade และ vintage marketplace
/// - Flipkart: Indian e-commerce marketplace
/// - Lazada: Southeast Asian e-commerce
/// - Shopee: Multi-region marketplace
/// - TikTok Shop: Social commerce platform
///
/// ## E-commerce Platforms
/// - BigCommerce, Shopify, WooCommerce: Website builders
/// - Ecwid, Magento, Medusa, Wix, Zoho: Additional platforms
/// - JD, LINE Shopping: Asian market platforms
///
/// # ประเภทข้อมูลร่วม
/// - `PlatformProduct`: ข้อมูลสินค้าแบบมาตรฐาน
/// - `RefreshTokenResponse`: ผลลัพธ์จาก token refresh
///
/// # ตัวอย่างการใช้งาน
/// ```rust
/// use client::ecommerce::{shopify, PlatformProduct};
///
/// let gateway = shopify::ShopifyGateway::new(credentials);
/// let products = gateway.fetch_products(&access_token, None, None).await?;
/// ```
use rust_decimal::prelude::FromStr as DecimalFromStr;
use rust_decimal::Decimal;
use std::collections::HashMap;

// Marketplace platforms - แพลตฟอร์ม marketplace ต่างๆ
pub mod connector;

pub mod alibaba;
pub mod aliexpress;
pub mod amazon;
pub mod ebay;
pub mod etsy;
pub mod lazada;
pub mod shopee;
pub mod tiktok;

// E-commerce platforms - แพลตฟอร์ม e-commerce ต่างๆ
pub mod bigcommerce;
pub mod shopify;
pub mod woocommerce;

pub mod jd;
pub mod lineshopping;

// pub mod rakuten;  // ยังไม่ได้ implement
// pub mod taobao;   // ยังไม่ได้ implement
// pub mod temu;     // ยังไม่ได้ implement
// pub mod walmart;  // ยังไม่ได้ implement

// Additional e-commerce platforms - แพลตฟอร์มเพิ่มเติม
pub mod ecwid;
pub mod magento;
pub mod medusa;
pub mod wix;
pub mod zoho;

use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};
use anyhow::Result;
use async_trait::async_trait;
use chrono::Utc;
use serde::{Deserialize, Serialize};

/// ประเภทข้อมูลสินค้าแบบมาตรฐานสำหรับทุกแพลตฟอร์ม
///
/// Struct นี้เป็น common interface สำหรับข้อมูลสินค้าที่ได้จากแพลตฟอร์มต่างๆ
/// ก่อนจะแปลงเป็น domain Product สำหรับใช้งานภายใน
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformProduct {
    /// ID ของสินค้าในแพลตฟอร์ม
    pub id: String,
    /// ชื่อสินค้า
    pub title: String,
    /// รายละเอียดสินค้า
    pub description: String,
    /// ราคาในรูปแบบตัวเลข
    pub price: f64,
    /// สกุลเงิน
    pub currency: String,
    /// SKU ของสินค้า (ถ้ามี)
    pub sku: Option<String>,
    /// จำนวนสินค้าคงเหลือ
    pub inventory_quantity: Option<i32>,
    /// URL รูปสินค้าหลัก
    pub image_url: Option<String>,
    /// URL ของสินค้าในแพลตฟอร์ม
    pub product_url: Option<String>,
    /// หมวดหมู่สินค้า
    pub category: Option<String>,
    /// แท็กต่างๆ ของสินค้า
    pub tags: Vec<String>,
    /// สถานะสินค้า (active, inactive, draft, etc.)
    pub status: String,
    /// ผู้ขาย/แบรนด์
    pub vendor: Option<String>,
    /// วันที่สร้างสินค้า
    pub created_at: Option<String>,
    /// วันที่อัพเดทล่าสุด
    pub updated_at: Option<String>,
    /// ข้อมูลเพิ่มเติมเฉพาะแพลตฟอร์ม
    pub metadata: Option<serde_json::Value>,
}

impl PlatformProduct {
    /// แปลง PlatformProduct เป็น domain Product
    ///
    /// # Parameters
    /// - `platform`: ชื่อแพลตฟอร์ม (เช่น "shopify", "tiktok")
    /// - `shop_id`: ID ของร้านค้า
    ///
    /// # Returns
    /// `Product` ที่พร้อมใช้งานในระบบ
    pub fn to_product(&self, platform: &str, shop_id: &str) -> Product {
        Product {
            product_id: format!("{}_{}", platform, self.id),
            platform_product_id: self.id.clone(),
            platform_shop_id: "".to_string(),
            platform: PlatformType::from_str(platform).unwrap_or(PlatformType::Shopify),
            shop_id: shop_id.to_string(),
            title: self.title.clone(),
            brand: "".to_string(),
            description: Some(self.description.clone()),
            price: Price {
                amount: Decimal::from_f64_retain(self.price).unwrap_or(Decimal::ZERO),
                currency: self.currency.clone(),
                original_price: None,
                discount_percentage: None,
            },
            currency: self.currency.clone(),
            images: self
                .image_url
                .as_ref()
                .map(|url| {
                    vec![ProductImage {
                        url: url.clone(),
                        alt: None,
                        is_primary: true,
                        position: 0,
                    }]
                })
                .unwrap_or_default(),
            sku: self.sku.clone().unwrap_or_default(),
            quantity: self.inventory_quantity.unwrap_or(0) as i16,
            status: match self.status.to_lowercase().as_str() {
                "active" | "published" | "onselling" => ProductStatus::Active,
                "inactive" | "draft" => ProductStatus::Inactive,
                "deleted" => ProductStatus::Deleted,
                _ => ProductStatus::Inactive,
            },
            categories: self
                .category
                .as_ref()
                .map(|c| vec![c.clone()])
                .unwrap_or_default(),
            attributes: HashMap::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            synced_at: Some(Utc::now()),
        }
    }
}

/// Response สำหรับการ refresh access token
///
/// Struct นี้ใช้เป็น standard response สำหรับการ refresh token
/// จากแพลตฟอร์มต่างๆ ที่รองรับ OAuth 2.0
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshTokenResponse {
    /// Access token ใหม่
    pub access_token: String,
    /// Refresh token ใหม่ (บางแพลตฟอร์มอาจไม่ส่งมา)
    pub refresh_token: Option<String>,
    /// เวลาหมดอายุของ access token (วินาที)
    pub expires_in: Option<i64>,
}

/// Platform Gateway trait for e-commerce platform integrations
///
/// This trait defines the common interface that all platform clients must implement
#[async_trait]
pub trait PlatformGateway: Send + Sync {
    /// Build OAuth connection URL
    async fn connect(&self, params: HashMap<String, String>) -> Result<String>;

    /// Handle OAuth callback
    async fn callback(&self, params: HashMap<String, String>) -> Result<HashMap<String, String>>;

    /// List products from the platform
    async fn list_products(
        &self,
        shop_id: &str,
        access_token: &str,
    ) -> Result<Vec<serde_json::Value>>;

    /// Get a single product details
    async fn get_product(
        &self,
        shop_id: &str,
        product_id: &str,
        access_token: &str,
    ) -> Result<serde_json::Value>;

    /// Sync inventory for a product
    async fn sync_inventory(
        &self,
        shop_id: &str,
        product_id: &str,
        quantity: i32,
        access_token: &str,
    ) -> Result<()>;

    /// Get authorized shops
    async fn get_authorized_shops(&self, access_token: &str) -> Result<Vec<serde_json::Value>>;

    /// Refresh access token
    async fn refresh_token(&self, refresh_token: &str) -> Result<HashMap<String, String>>;
}
