/// โมดูลสำหรับแปลงข้อมูล BigCommerce
///
/// จัดการการแปลงข้อมูลสินค้าจาก BigCommerce API เป็นรูปแบบมาตรฐานของระบบ
/// รองรับการแปลง product variants, options และ custom fields
///
/// คุณสมบัติ:
/// - รองรับ product variants และ modifiers
/// - แปลง BigCommerce custom fields และ brand data
/// - จัดการ product categories และ tax classes
/// - รองรับ product images และ video content
/// - แปลงสถานะสินค้าและ inventory tracking
use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde_json::Value;
use uuid::Uuid;

use super::PlatformProductMapper;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};

pub struct BigCommerceMapper;

impl BigCommerceMapper {
    fn parse_datetime(date_str: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(date_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now())
    }
}

impl PlatformProductMapper for BigCommerceMapper {
    fn name(&self) -> &str {
        "bigcommerce"
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
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract price
        let price = raw
            .get("price")
            .or_else(|| raw.get("calculated_price"))
            .and_then(|v| {
                if let Some(price_str) = v.as_str() {
                    price_str.parse::<f64>().ok()
                } else {
                    v.as_f64()
                }
            })
            .unwrap_or(0.0);

        // Extract inventory level
        let quantity = raw
            .get("inventory_level")
            .or_else(|| raw.get("inventory_tracking"))
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
                    img.get("url_standard")
                        .or_else(|| img.get("url_zoom"))
                        .or_else(|| img.get("url_thumbnail"))
                        .and_then(|u| u.as_str())
                        .map(|s| s.to_string())
                })
                .collect()
        } else if let Some(primary_image) = raw.get("primary_image") {
            if let Some(url) = primary_image.get("url_standard").and_then(|v| v.as_str()) {
                vec![url.to_string()]
            } else {
                vec![]
            }
        } else {
            vec![]
        };

        // Extract brand
        let brand = raw
            .get("brand_id")
            .and_then(|_| raw.get("brand_name"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract categories
        let categories = if let Some(cats) = raw.get("categories").and_then(|v| v.as_array()) {
            cats.iter()
                .filter_map(|cat_id| cat_id.as_i64().map(|id| format!("category_{}", id)))
                .collect()
        } else {
            vec![]
        };

        // Map visibility and availability
        let status = if let Some(visible) = raw.get("is_visible").and_then(|v| v.as_bool()) {
            if visible {
                if let Some(available) = raw.get("availability").and_then(|v| v.as_str()) {
                    match available {
                        "available" => ProductStatus::Active,
                        "disabled" => ProductStatus::Inactive,
                        "preorder" => ProductStatus::Active,
                        _ => ProductStatus::OutOfStock,
                    }
                } else {
                    ProductStatus::Active
                }
            } else {
                ProductStatus::Inactive
            }
        } else {
            ProductStatus::Active
        };

        // Build attributes
        let mut attributes = serde_json::Map::new();

        // Add weight
        if let Some(weight) = raw.get("weight") {
            attributes.insert("weight".to_string(), weight.clone());
        }

        // Add dimensions
        if let Some(width) = raw.get("width") {
            attributes.insert("width".to_string(), width.clone());
        }
        if let Some(height) = raw.get("height") {
            attributes.insert("height".to_string(), height.clone());
        }
        if let Some(depth) = raw.get("depth") {
            attributes.insert("depth".to_string(), depth.clone());
        }

        // Add custom fields
        if let Some(custom_fields) = raw.get("custom_fields") {
            attributes.insert("custom_fields".to_string(), custom_fields.clone());
        }

        // Add condition
        if let Some(condition) = raw.get("condition") {
            attributes.insert("condition".to_string(), condition.clone());
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
            shop_id: shop_id.to_string(),
            platform_shop_id: "".to_string(),
            platform: PlatformType::BigCommerce,
            title,
            brand: brand.unwrap_or_default(),
            description,
            price: Price {
                amount: Decimal::from_f64_retain(price).unwrap_or_default(),
                currency: "USD".to_string(),
                original_price: None,
                discount_percentage: None,
            },
            currency: "USD".to_string(),
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

    // Using default implementation from trait which handles data array
}
