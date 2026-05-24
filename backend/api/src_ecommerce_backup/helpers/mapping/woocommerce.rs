/// โมดูลสำหรับแปลงข้อมูล WooCommerce
///
/// จัดการการแปลงข้อมูลสินค้าจาก WooCommerce API เป็นรูปแบบมาตรฐานของระบบ
/// รองรับการแปลง product attributes, images, categories และ variations
///
/// คุณสมบัติ:
/// - รองรับ variable products และ variations
/// - แปลง WooCommerce attributes และ custom fields
/// - จัดการ product categories และ tags
/// - รองรับ product images และ gallery
/// - แปลงสถานะสินค้าและ stock management
use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

use super::PlatformProductMapper;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};

pub struct WooCommerceMapper;

impl WooCommerceMapper {
    fn parse_datetime(date_str: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(date_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now())
    }
}

impl PlatformProductMapper for WooCommerceMapper {
    fn name(&self) -> &str {
        "woocommerce"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        // Extract product ID
        let product_id = raw
            .get("id")
            .and_then(|v| {
                if let Some(num) = v.as_i64() {
                    Some(num.to_string())
                } else {
                    v.as_str().map(|s| s.to_string())
                }
            })
            .unwrap_or_default();

        // Extract title/name
        let title = raw
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Extract description
        let description = raw
            .get("description")
            .or_else(|| raw.get("short_description"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract price
        let price = raw
            .get("price")
            .or_else(|| raw.get("regular_price"))
            .or_else(|| raw.get("sale_price"))
            .and_then(|v| {
                if let Some(price_str) = v.as_str() {
                    price_str.parse::<f64>().ok()
                } else {
                    v.as_f64()
                }
            })
            .unwrap_or(0.0);

        // Extract stock quantity
        let quantity = raw
            .get("stock_quantity")
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i16;

        // Extract SKU
        let sku = raw
            .get("sku")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract images
        let images = if let Some(images_arr) = raw.get("images").and_then(|v| v.as_array()) {
            images_arr
                .iter()
                .filter_map(|img| {
                    img.get("src")
                        .and_then(|s| s.as_str())
                        .map(|url| url.to_string())
                })
                .collect()
        } else {
            vec![]
        };

        // Extract brand from attributes
        let brand = raw
            .get("attributes")
            .and_then(|attrs| attrs.as_array())
            .and_then(|arr| {
                arr.iter()
                    .find(|attr| {
                        attr.get("name")
                            .and_then(|n| n.as_str())
                            .map(|s| s.eq_ignore_ascii_case("brand"))
                            .unwrap_or(false)
                    })
                    .and_then(|attr| {
                        attr.get("options")
                            .and_then(|opts| opts.get(0))
                            .and_then(|v| v.as_str())
                    })
            })
            .map(|s| s.to_string());

        // Extract categories
        let categories = if let Some(cats) = raw.get("categories").and_then(|v| v.as_array()) {
            cats.iter()
                .filter_map(|cat| {
                    cat.get("name")
                        .and_then(|n| n.as_str())
                        .map(|s| s.to_string())
                })
                .collect()
        } else {
            vec![]
        };

        // Map status
        let status = raw
            .get("status")
            .and_then(|v| v.as_str())
            .map(|s| match s {
                "publish" => {
                    // Check if in stock
                    if raw
                        .get("in_stock")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(true)
                    {
                        ProductStatus::Active
                    } else {
                        ProductStatus::OutOfStock
                    }
                }
                "draft" | "pending" => ProductStatus::Inactive,
                "trash" => ProductStatus::Deleted,
                _ => ProductStatus::Inactive,
            })
            .unwrap_or(ProductStatus::Active);

        // Build attributes
        let mut attributes = HashMap::new();

        // Add product type
        if let Some(product_type) = raw.get("type") {
            attributes.insert("product_type".to_string(), product_type.to_string());
        }

        // Add weight
        if let Some(weight) = raw.get("weight") {
            attributes.insert("weight".to_string(), weight.to_string());
        }

        // Add dimensions
        if let Some(dimensions) = raw.get("dimensions") {
            attributes.insert("dimensions".to_string(), dimensions.to_string());
        }

        // Add tags
        if let Some(tags) = raw.get("tags") {
            attributes.insert("tags".to_string(), tags.to_string());
        }

        // Add attributes
        if let Some(attrs) = raw.get("attributes") {
            attributes.insert("product_attributes".to_string(), attrs.to_string());
        }

        // Add variations
        if let Some(variations) = raw.get("variations") {
            attributes.insert("variations".to_string(), variations.to_string());
        }

        // Parse timestamps
        let created_at = raw
            .get("date_created")
            .and_then(|v| v.as_str())
            .map(Self::parse_datetime)
            .unwrap_or_else(Utc::now);

        let updated_at = raw
            .get("date_modified")
            .and_then(|v| v.as_str())
            .map(Self::parse_datetime)
            .unwrap_or_else(Utc::now);

        Ok(Product {
            product_id: if product_id.is_empty() {
                Uuid::new_v4().to_string()
            } else {
                product_id.clone()
            },
            platform_product_id: product_id,
            brand: brand.unwrap_or_default(),
            shop_id: shop_id.to_string(),
            platform_shop_id: "".to_string(),
            platform: PlatformType::WooCommerce,
            title,
            description,
            price: Price {
                amount: Decimal::from_f64_retain(price).unwrap_or_default(),
                original_price: None,
                discount_percentage: None,
                currency: "USD".to_string(),
            },
            currency: "USD".to_string(), // Should be from settings
            sku: sku.unwrap_or_default(),
            quantity,
            images: images
                .into_iter()
                .enumerate()
                .map(|(idx, url)| ProductImage {
                    url,
                    alt: None,
                    is_primary: idx == 0,
                    position: idx as i32,
                })
                .collect(),
            categories,
            attributes: attributes
                .into_iter()
                .map(|(k, v)| (k, v.to_string()))
                .collect(),
            status,
            created_at,
            updated_at,
            synced_at: Some(Utc::now()),
        })
    }

    // Using default implementation from trait which handles direct arrays
}
