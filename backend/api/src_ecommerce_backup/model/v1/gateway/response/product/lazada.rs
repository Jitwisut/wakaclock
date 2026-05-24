//! # Lazada Product Response Models
//!
//! โมดูลนี้กำหนดโครงสร้างข้อมูลสำหรับ Lazada API response
//! ใช้สำหรับการแปลงและจัดการข้อมูลสินค้าจากแพลตฟอร์ม Lazada
//!
//! ## ฟีเจอร์หลัก
//! - Lazada product data structures
//! - SKU และ inventory management
//! - Product attributes และ specifications
//! - Image และ media handling
//! - Pricing และ promotion support

use serde::{Deserialize, Serialize};

/// Lazada Product structure from API
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LazadaProduct {
    pub item_id: i64,
    pub primary_category: i64,
    pub attributes: LazadaAttributes,
    pub skus: Vec<LazadaSku>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LazadaAttributes {
    pub name: String,
    pub description: Option<String>,
    pub brand: Option<String>,
    pub model: Option<String>,
    pub warranty_type: Option<String>,
    pub warranty: Option<String>,
    pub short_description: Option<String>,
    pub product_weight: Option<String>,
    pub product_length: Option<String>,
    pub product_height: Option<String>,
    pub product_width: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LazadaSku {
    pub sku_id: i64,
    pub seller_sku: String,
    pub quantity: i32,
    pub price: f64,
    pub special_price: Option<f64>,
    pub special_from_date: Option<String>,
    pub special_to_date: Option<String>,
    pub status: String,
    pub images: Vec<String>,
    pub package_weight: Option<String>,
    pub package_length: Option<String>,
    pub package_height: Option<String>,
    pub package_width: Option<String>,
}
