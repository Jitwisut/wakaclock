//! # TikTok Product Response Models
//!
//! โมดูลนี้กำหนดโครงสร้างข้อมูลสำหรับ TikTok Shop API response
//! ใช้สำหรับการแปลงและจัดการข้อมูลสินค้าจากแพลตฟอร์ม TikTok Shop
//!
//! ## ฟีเจอร์หลัก
//! - TikTok product data structures พร้อม SKU management
//! - Sales attributes และ product variations
//! - Category chains และ brand information
//! - Image management และ media handling
//! - Certifications และ compliance data
//! - Dimensions, weight และ shipping specifications

use serde::{Deserialize, Serialize};

/// TikTok Product structure from API
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokProduct {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub create_time: i64,
    pub update_time: i64,
    pub skus: Vec<TikTokSku>,
    pub sales_regions: Vec<String>,
    pub category_chains: Vec<TikTokCategoryChain>,
    pub main_images: Vec<TikTokImage>,
    pub brand: Option<TikTokBrand>,
    pub warranty_period: Option<i32>,
    pub warranty_policy: Option<String>,
    pub package_dimensions: Option<TikTokDimensions>,
    pub package_weight: Option<TikTokWeight>,
    pub size_chart: Option<TikTokSizeChart>,
    pub product_certifications: Vec<TikTokCertification>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokSku {
    pub id: String,
    pub seller_sku: String,
    pub price: TikTokPrice,
    pub inventory: Vec<TikTokInventory>,
    pub sales_attributes: Vec<TikTokSalesAttribute>,
    pub product_identifier_code: Option<TikTokIdentifierCode>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokPrice {
    pub amount: String,
    pub currency: String,
    pub tax_exclusive_price: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokInventory {
    pub warehouse_id: String,
    pub available_quantity: i32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokSalesAttribute {
    pub attribute_id: String,
    pub attribute_name: String,
    pub attribute_value_id: String,
    pub attribute_value_name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokIdentifierCode {
    pub identifier_code_type: i32,
    pub identifier_code: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokCategoryChain {
    pub id: String,
    pub parent_id: String,
    pub name: String,
    pub is_leaf: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokImage {
    pub height: i32,
    pub width: i32,
    pub thumb_url_list: Vec<String>,
    pub url_list: Vec<String>,
    pub uri: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokBrand {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokDimensions {
    pub length: String,
    pub width: String,
    pub height: String,
    pub unit: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokWeight {
    pub value: String,
    pub unit: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokSizeChart {
    pub image: TikTokImage,
    pub template: Option<TikTokSizeChartTemplate>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokSizeChartTemplate {
    pub id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokCertification {
    pub id: String,
    pub title: String,
    pub files: Vec<TikTokCertFile>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TikTokCertFile {
    pub id: String,
    pub name: String,
    pub url: String,
}
