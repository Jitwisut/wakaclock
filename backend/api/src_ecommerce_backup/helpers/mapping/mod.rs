//! # Platform Mapping Module - โมดูลการแปลงข้อมูลแพลตฟอร์ม
//!
//! รวบรวม mappers สำหรับแปลงข้อมูลสินค้าจากแพลตฟอร์ม e-commerce ต่างๆ
//! ให้เป็นรูปแบบมาตรฐานที่ใช้ร่วมกันในระบบ (unified format)
//!
//! ## หน้าที่หลัก
//! - แปลงข้อมูลสินค้าจากแต่ละแพลตฟอร์มให้เป็น unified Product model
//! - จัดการความแตกต่างของ data structure ระหว่างแพลตฟอร์ม
//! - ให้บริการ factory pattern สำหรับสร้าง mappers
//! - รองรับ helper functions สำหรับ data extraction
//!
//! ## แพลตฟอร์มที่รองรับ
//! รองรับแพลตฟอร์ม e-commerce มากกว่า 20+ แพลตฟอร์ม รวมถึง:
//! - TikTok Shop, Shopee, Lazada (Southeast Asia)
//! - Amazon, eBay, Etsy (Global Marketplaces)
//! - Shopify, WooCommerce, BigCommerce (E-commerce Platforms)
//! - Alibaba, Taobao, JD (China Markets)
//! - และอื่นๆ อีกมากมาย

use crate::model::v1::platfrom::entries::{Product, ProductStatus};
use anyhow::Result;
use serde_json::Value;
use std::{borrow::Cow, sync::Arc};

// Platform-specific mappers - Platform-specific data mappers
pub mod alibaba;
pub mod aliexpress;
pub mod amazon;
pub mod bigcommerce;
pub mod ebay;
pub mod ecwid;
pub mod etsy;
pub mod jd;
pub mod lazada;
pub mod line_shopping;
pub mod magento;
pub mod medusa;
pub mod rakuten;
pub mod shopee;
pub mod shopify;
pub mod taobao;
pub mod temu;
pub mod tiktok;
pub mod walmart;
pub mod wix;
pub mod woocommerce;
pub mod zoho;

// Re-export mappers for convenience
pub use alibaba::AlibabaMapper;
pub use aliexpress::AliExpressMapper;
pub use amazon::AmazonMapper;
pub use bigcommerce::BigCommerceMapper;
pub use ebay::EbayMapper;
pub use ecwid::EcwidMapper;
pub use etsy::EtsyMapper;
pub use jd::JdMapper;
pub use lazada::LazadaMapper;
pub use line_shopping::LineShoppingMapper;
pub use magento::MagentoMapper;
pub use medusa::MedusaMapper;
pub use rakuten::RakutenMapper;
pub use shopee::ShopeeMapper;
pub use shopify::ShopifyMapper;
pub use taobao::TaobaoMapper;
pub use temu::TemuMapper;
pub use tiktok::TikTokMapper;
pub use walmart::WalmartMapper;
pub use wix::WixMapper;
pub use woocommerce::WooCommerceMapper;
pub use zoho::ZohoMapper;

/// Trait providing borrowed access to nested JSON values using dot-separated paths.
pub trait JsonValueExt {
    fn get_path(&self, path: &str) -> Option<&Value>;
    fn get_string(&self, path: &str) -> Option<Cow<'_, str>>;
    fn get_f64(&self, path: &str) -> Option<f64>;
    fn get_i32(&self, path: &str) -> Option<i32>;
    fn get_bool(&self, path: &str) -> Option<bool>;
    fn get_string_array(&self, path: &str) -> Vec<String>;
}

impl JsonValueExt for Value {
    fn get_path(&self, path: &str) -> Option<&Value> {
        let mut current = self;
        for segment in path.split('.') {
            current = current.get(segment)?;
        }
        Some(current)
    }

    fn get_string(&self, path: &str) -> Option<Cow<'_, str>> {
        self.get_path(path).and_then(value_to_cow_string)
    }

    fn get_f64(&self, path: &str) -> Option<f64> {
        self.get_path(path).and_then(|value| {
            value
                .as_f64()
                .or_else(|| value.as_str().and_then(|s| s.parse::<f64>().ok()))
        })
    }

    fn get_i32(&self, path: &str) -> Option<i32> {
        self.get_path(path).and_then(|value| {
            value
                .as_i64()
                .map(|v| v as i32)
                .or_else(|| value.as_str().and_then(|s| s.parse::<i32>().ok()))
        })
    }

    fn get_bool(&self, path: &str) -> Option<bool> {
        self.get_path(path).and_then(|value| {
            value.as_bool().or_else(|| {
                value.as_str().and_then(|s| match s {
                    "true" | "1" => Some(true),
                    "false" | "0" => Some(false),
                    _ => None,
                })
            })
        })
    }

    fn get_string_array(&self, path: &str) -> Vec<String> {
        match self.get_path(path) {
            Some(Value::Array(arr)) => arr
                .iter()
                .filter_map(|value| value_to_cow_string(value).map(|cow| cow.into_owned()))
                .collect(),
            Some(Value::String(s)) => serde_json::from_str::<Vec<String>>(s).unwrap_or_default(),
            _ => vec![],
        }
    }
}

fn value_to_cow_string(value: &Value) -> Option<Cow<'_, str>> {
    match value {
        Value::String(s) => Some(Cow::Borrowed(s)),
        Value::Number(num) => Some(Cow::Owned(num.to_string())),
        Value::Bool(b) => Some(Cow::Owned(b.to_string())),
        Value::Object(obj) => {
            for key in ["id", "name", "code"] {
                if let Some(text) = obj.get(key).and_then(value_to_cow_string) {
                    return Some(text);
                }
            }
            None
        }
        Value::Array(items) => items.iter().find_map(value_to_cow_string),
        _ => None,
    }
}

/// Trait for platform-specific product mapping - Trait สำหรับแปลงข้อมูลสินค้าตามแพลตฟอร์ม
///
/// กำหนด interface มาตรฐานสำหรับแปลงข้อมูลสินค้าจากแพลตฟอร์มต่างๆ
/// ให้เป็น unified Product model ที่ใช้ร่วมกันในระบบ
pub trait PlatformProductMapper: Send + Sync + 'static {
    /// ส่งคืนชื่อแพลตฟอร์ม
    fn name(&self) -> &str;

    /// แปลง JSON ของสินค้าจากแพลตฟอร์มให้เป็น unified Product model
    ///
    /// รับ raw JSON data จากแพลตฟอร์มและแปลงเป็น Product struct
    /// ที่มีรูปแบบมาตรฐานสำหรับใช้งานในระบบ
    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product>;

    /// แปลง JSON ของสินค้าหลายรายการจากแพลตฟอร์มให้เป็น unified Product models
    ///
    /// รับ raw JSON response ที่อาจมีโครงสร้างแตกต่างกันและแปลงเป็น Vec<Product>
    /// โดยใช้ default implementation ที่จัดการ common response patterns
    fn map_products(&self, raw: &Value, shop_id: &str) -> Result<Vec<Product>> {
        default_map_products(self, raw, shop_id)
    }
}

/// Base implementation for common product mapping patterns - Implementation พื้นฐานสำหรับ mapping patterns ทั่วไป
///
/// ฟังก์ชันที่จัดการ response patterns ทั่วไปจากแพลตฟอร์มต่างๆ
/// รองรับ wrapper structures, array formats และ single product responses
/// This can be called by platform mappers that need custom logic plus the default behavior
pub fn default_map_products<T: PlatformProductMapper + ?Sized>(
    mapper: &T,
    raw: &Value,
    shop_id: &str,
) -> Result<Vec<Product>> {
    // Common response wrapper fields to check
    let common_wrappers = ["data", "response", "result", "payload"];

    // Common array field names for products
    let common_product_fields = [
        "products",
        "items",
        "listings",
        "results",
        "item_list",
        "product_list",
        "goods_list",
        "searchResults",
        "itemSummaries",
        "wares",
    ];

    // Check for wrapper structures first
    for wrapper in &common_wrappers {
        if let Some(wrapped) = raw.get(wrapper) {
            // Check if the wrapper directly contains product fields
            for field in &common_product_fields {
                if let Some(products_array) = wrapped.get(field).and_then(|v| v.as_array()) {
                    return products_array
                        .iter()
                        .map(|p| mapper.map_product(p, shop_id))
                        .collect();
                }
            }

            // Check if wrapper itself is an array
            if let Some(products_array) = wrapped.as_array() {
                return products_array
                    .iter()
                    .map(|p| mapper.map_product(p, shop_id))
                    .collect();
            }

            // Check if wrapper is a single product object
            if wrapped.is_object()
                && (wrapped.get("id").is_some()
                    || wrapped.get("product_id").is_some()
                    || wrapped.get("item_id").is_some())
            {
                return Ok(vec![mapper.map_product(wrapped, shop_id)?]);
            }
        }
    }

    // Check root level for product arrays
    for field in &common_product_fields {
        if let Some(products_array) = raw.get(field).and_then(|v| v.as_array()) {
            return products_array
                .iter()
                .map(|p| mapper.map_product(p, shop_id))
                .collect();
        }
    }

    // Check for nested structures (e.g., result.products)
    if let Some(result) = raw.get("result") {
        for field in &common_product_fields {
            if let Some(products_array) = result.get(field).and_then(|v| v.as_array()) {
                return products_array
                    .iter()
                    .map(|p| mapper.map_product(p, shop_id))
                    .collect();
            }
        }
    }

    // Check if root is directly an array
    if let Some(product_array) = raw.as_array() {
        return product_array
            .iter()
            .map(|p| mapper.map_product(p, shop_id))
            .collect();
    }

    // Check if it's a single product (has common product identifier fields)
    if raw.get("id").is_some()
        || raw.get("product_id").is_some()
        || raw.get("item_id").is_some()
        || raw.get("sku").is_some()
    {
        return Ok(vec![mapper.map_product(raw, shop_id)?]);
    }

    // If none of the above worked, try to map as single product
    Ok(vec![mapper.map_product(raw, shop_id)?])
}

/// Factory for creating platform-specific mappers
pub struct MapperFactory;

impl MapperFactory {
    /// Creates a mapper for the specified platform
    pub fn create_mapper(platform: &str) -> Result<Arc<dyn PlatformProductMapper>> {
        match platform.to_lowercase().as_str() {
            "alibaba" => Ok(Arc::new(AlibabaMapper)),
            "aliexpress" => Ok(Arc::new(AliExpressMapper)),
            "amazon" => Ok(Arc::new(AmazonMapper)),
            "bigcommerce" => Ok(Arc::new(BigCommerceMapper)),
            "ebay" => Ok(Arc::new(EbayMapper)),
            "ecwid" => Ok(Arc::new(EcwidMapper)),
            "etsy" => Ok(Arc::new(EtsyMapper)),
            "jd" => Ok(Arc::new(JdMapper)),
            "lazada" => Ok(Arc::new(LazadaMapper)),
            "line_shopping" | "lineshopping" => Ok(Arc::new(LineShoppingMapper)),
            "magento" => Ok(Arc::new(MagentoMapper)),
            "medusa" => Ok(Arc::new(MedusaMapper)),
            "rakuten" => Ok(Arc::new(RakutenMapper)),
            "shopee" => Ok(Arc::new(ShopeeMapper)),
            "shopify" => Ok(Arc::new(ShopifyMapper)),
            "taobao" => Ok(Arc::new(TaobaoMapper)),
            "temu" => Ok(Arc::new(TemuMapper)),
            "tiktok" => Ok(Arc::new(TikTokMapper)),
            "walmart" => Ok(Arc::new(WalmartMapper)),
            "wix" => Ok(Arc::new(WixMapper)),
            "woocommerce" => Ok(Arc::new(WooCommerceMapper)),
            "zoho" => Ok(Arc::new(ZohoMapper)),
            _ => anyhow::bail!("Unsupported platform for mapping: {}", platform),
        }
    }
}

/// Maps a raw platform response to unified product(s)
pub fn map_to_unified_product(platform: &str, raw: Value, shop_id: &str) -> Result<Vec<Product>> {
    let mapper = MapperFactory::create_mapper(platform)?;
    mapper.map_products(&raw, shop_id)
}

/// Helper function to safely extract string from JSON value
pub fn extract_string(value: &Value, path: &str) -> Option<String> {
    value.get_string(path).map(|cow| cow.into_owned())
}

/// Helper function to safely extract f64 from JSON value
pub fn extract_f64(value: &Value, path: &str) -> Option<f64> {
    value.get_f64(path)
}

/// Helper function to safely extract i32 from JSON value
pub fn extract_i32(value: &Value, path: &str) -> Option<i32> {
    value.get_i32(path)
}

/// Helper function to safely extract bool from JSON value
pub fn extract_bool(value: &Value, path: &str) -> Option<bool> {
    value.get_bool(path)
}

/// Helper function to extract array of strings
pub fn extract_string_array(value: &Value, path: &str) -> Vec<String> {
    value.get_string_array(path)
}

/// Maps platform status strings to ProductStatus enum
pub fn map_status(status: Option<&str>, is_visible: Option<bool>) -> ProductStatus {
    match status {
        Some("active") | Some("published") | Some("online") => {
            if is_visible.unwrap_or(true) {
                ProductStatus::Active
            } else {
                ProductStatus::Inactive
            }
        }
        Some("inactive") | Some("draft") | Some("unpublished") | Some("offline") => {
            ProductStatus::Inactive
        }
        Some("out_of_stock") | Some("out-of-stock") | Some("soldout") => ProductStatus::OutOfStock,
        Some("deleted") | Some("archived") | Some("removed") => ProductStatus::Deleted,
        _ => {
            if is_visible.unwrap_or(true) {
                ProductStatus::Active
            } else {
                ProductStatus::Inactive
            }
        }
    }
}
