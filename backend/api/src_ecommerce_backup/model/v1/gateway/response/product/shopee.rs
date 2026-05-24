//! # Shopee Product Response Models
//!
//! โมดูลนี้กำหนดโครงสร้างข้อมูลสำหรับ Shopee API response
//! ใช้สำหรับการแปลงและจัดการข้อมูลสินค้าจากแพลตฟอร์ม Shopee
//!
//! ## ฟีเจอร์หลัก
//! - Shopee product data structures พร้อม model variations
//! - Stock management และ pricing information
//! - Attribute handling และ product specifications
//! - Image และ media management
//! - Logistics และ shipping configuration
//! - Pre-order และ brand support

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ShopeeAttribute {
    pub attribute_id: i64,
    pub attribute_value_list: Vec<ShopeeAttributeValue>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ShopeeAttributeValue {
    pub value_id: i64,
    pub original_value_name: String,
    pub value_unit: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ShopeePriceInfo {
    pub currency: String,
    pub original_price: f64,
    pub current_price: f64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ShopeeImageInfo {
    pub image_url_list: Vec<String>,
    pub image_id_list: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ShopeeDimension {
    pub package_length: i32,
    pub package_width: i32,
    pub package_height: i32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ShopeeLogistic {
    pub logistic_id: i64,
    pub logistic_name: String,
    pub enabled: bool,
    pub is_free: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ShopeePreOrder {
    pub is_pre_order: bool,
    pub days_to_ship: i32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ShopeeBrand {
    pub brand_id: i64,
    pub original_brand_name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ShopeeStockInfo {
    pub stock_type: i32,
    pub normal_stock: Option<i32>,
    pub current_stock: i32,
    pub summary_info: ShopeeStockSummary,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ShopeeStockSummary {
    pub total_reserved_stock: i32,
    pub total_available_stock: i32,
}

/// Model variation for products with variants
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ShopeeModel {
    pub model_id: i64,
    pub model_sku: String,
    pub tier_index: Vec<i32>,
    pub price_info: Vec<ShopeePriceInfo>,
    pub stock_info_v2: ShopeeStockInfo,
}

/// Shopee Product structure from API
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ShopeeProduct {
    pub item_id: i64,
    pub category_id: i64,
    pub item_name: String,
    pub description: String,
    pub item_sku: Option<String>,
    pub create_time: i64,
    pub update_time: i64,
    pub attribute_list: Vec<ShopeeAttribute>,
    pub price_info: Vec<ShopeePriceInfo>,
    pub image: ShopeeImageInfo,
    pub weight: Option<f64>,
    pub dimension: Option<ShopeeDimension>,
    pub logistic_info: Vec<ShopeeLogistic>,
    pub pre_order: ShopeePreOrder,
    pub condition: String,
    pub size_chart: Option<String>,
    pub item_status: String,
    pub has_model: bool,
    pub brand: Option<ShopeeBrand>,
    pub item_dangerous: i32,
    pub stock_info_v2: ShopeeStockInfo,
}
