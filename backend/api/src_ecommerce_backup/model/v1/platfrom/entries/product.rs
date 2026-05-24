/// ไฟล์ product.rs - Product Domain Models
/// โครงสร้างข้อมูลสินค้าสำหรับ e-commerce platforms
/// รองรับ multi-platform, variants, และ pricing
/// ใช้ Decimal สำหรับความแม่นยำของราคา
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

use super::{Platform, PlatformId, PlatformType, ProductId, ProductStatus, ShopId, SKU};

/// โครงสร้างหมวดหมู่สินค้า
/// รองรับ hierarchical categories ด้วย parent_id
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
}

/// Attribute ของสินค้า
/// เก็บข้อมูลเพิ่มเติมแบบ key-value
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductAttribute {
    pub key: String,
    pub value: String,
}
/// โครงสร้างสินค้าสำหรับ ClickHouse database
/// ใช้ Row trait สำหรับ bulk insert
/// เก็บข้อมูลพื้นฐานของสินค้า
#[derive(Debug, Clone, Serialize, Deserialize, clickhouse::Row, ToSchema)]
pub struct ProductRow {
    pub id: String,
    pub platform_id: PlatformId,
    pub title: String,
    pub description: Option<String>,
    pub price: rust_decimal::Decimal,
    pub currency: String,
    pub sku: String,
    pub platform: Platform,
}

/// โครงสร้างสินค้าหลัก
/// รวมข้อมูลทั้งหมดของสินค้าจาก platform
/// รองรับ multi-platform synchronization
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Product {
    pub product_id: ProductId,
    pub shop_id: ShopId,
    pub platform: PlatformType,
    pub platform_shop_id: String,
    pub platform_product_id: String,
    pub sku: SKU,
    pub title: String,
    pub brand: String,
    pub description: Option<String>,
    pub price: Price,
    pub quantity: i16,
    pub images: Vec<ProductImage>,
    pub currency: String,
    pub attributes: HashMap<String, String>,
    pub categories: Vec<String>,
    pub status: ProductStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub synced_at: Option<DateTime<Utc>>,
}

impl Product {
    /// สร้าง Product instance ใหม่
    /// Generate UUID อัตโนมัติสำหรับ product_id
    /// Set timestamps และ default values
    pub fn new(
        shop_id: ShopId,
        platform: PlatformType,
        platform_product_id: String,
        sku: SKU,
        title: String,
        price: Price,
    ) -> Result<Self, String> {
        let currency = price.currency.clone();
        Ok(Self {
            product_id: uuid::Uuid::new_v4().to_string(),
            shop_id,
            platform,
            platform_shop_id: String::new(),
            platform_product_id,
            sku,
            title,
            brand: String::new(),
            description: None,
            price,
            quantity: 0,
            images: Vec::new(),
            currency,
            attributes: HashMap::new(),
            categories: Vec::new(),
            status: ProductStatus::Active,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            synced_at: None,
        })
    }

    /// กำหนดคำอธิบายสินค้า
    pub fn set_description(&mut self, description: String) {
        self.description = Some(description);
    }

    /// เพิ่มรูปภาพสินค้า
    /// รูปแรกจะถูก mark เป็น primary อัตโนมัติ
    pub fn add_image(&mut self, url: String) {
        let position = self.images.len() as i32;
        self.images.push(ProductImage {
            url,
            is_primary: position == 0,
            position,
            alt: None,
        });
    }

    /// อัพเดทราคาสินค้า
    /// Update timestamp อัตโนมัติ
    pub fn update_price(&mut self, price: Price) -> Result<(), String> {
        self.price = price;
        self.updated_at = Utc::now();
        Ok(())
    }

    /// อัพเดทสถานะสินค้า
    /// Update timestamp อัตโนมัติ
    pub fn update_status(&mut self, status: ProductStatus) -> Result<(), String> {
        self.status = status;
        self.updated_at = Utc::now();
        Ok(())
    }
}

/// โครงสร้างราคาสินค้า
/// รองรับส่วนลดและราคาเดิม
/// ใช้ Decimal สำหรับความแม่นยำ
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Price {
    pub amount: Decimal,
    pub currency: String,
    pub original_price: Option<Decimal>,
    pub discount_percentage: Option<Decimal>,
}

/// Format การแสดงผลราคา
/// แสดงราคาเดิมถ้ามีส่วนลด
impl std::fmt::Display for Price {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if let Some(original) = &self.original_price {
            write!(
                f,
                "{} {} (original: {} {})",
                self.amount, self.currency, original, self.currency
            )
        } else {
            write!(f, "{} {}", self.amount, self.currency)
        }
    }
}

/// โครงสร้างรูปภาพสินค้า
/// รองรับลำดับการแสดงผลและ alt text
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProductImage {
    pub url: String,
    pub alt: Option<String>,
    pub is_primary: bool,
    pub position: i32,
}

/// ข้อมูลราคาสำหรับ display
/// ใช้ในการแสดงผลราคาพร้อมส่วนลด
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PriceInfo {
    pub amount: Decimal,
    pub currency: String,
    pub original_price: Option<Decimal>,
    pub discount_percentage: Option<Decimal>,
}

/// โครงสร้าง variant ของสินค้า
/// รองรับสินค้าที่มีหลายตัวเลือก (สี, ขนาด)
/// แต่ละ variant มี SKU และ stock แยกกัน
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProductVariant {
    pub id: String,
    pub sku: String,
    pub price: Decimal,
    pub stock: i32,
    pub attributes: HashMap<String, String>,
}
