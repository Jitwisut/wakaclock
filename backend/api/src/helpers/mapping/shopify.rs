use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde_json::Value;
use uuid::Uuid;

use super::PlatformProductMapper;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};

pub struct ShopifyMapper;

impl ShopifyMapper {
    fn parse_datetime(date_str: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(date_str)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now())
    }
}

impl PlatformProductMapper for ShopifyMapper {
    fn name(&self) -> &str {
        "shopify"
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

        // Extract title
        let title = raw
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Extract description (body_html)
        let description = raw
            .get("body_html")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract price from variants
        let price = if let Some(variants) = raw.get("variants").and_then(|v| v.as_array()) {
            variants
                .first()
                .and_then(|v| v.get("price"))
                .and_then(|p| {
                    if let Some(price_str) = p.as_str() {
                        price_str.parse::<f64>().ok()
                    } else {
                        p.as_f64()
                    }
                })
                .unwrap_or(0.0)
        } else {
            0.0
        };

        // Extract total quantity from variants
        let quantity = if let Some(variants) = raw.get("variants").and_then(|v| v.as_array()) {
            variants
                .iter()
                .filter_map(|v| v.get("inventory_quantity").and_then(|q| q.as_i64()))
                .sum::<i64>() as i32
        } else {
            0
        };

        // Extract SKU from first variant
        let sku = raw
            .get("variants")
            .and_then(|v| v.get(0))
            .and_then(|v| v.get("sku"))
            .and_then(|s| s.as_str())
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
        } else if let Some(image) = raw.get("image") {
            if let Some(src) = image.get("src").and_then(|s| s.as_str()) {
                vec![src.to_string()]
            } else if let Some(url) = image.as_str() {
                vec![url.to_string()]
            } else {
                vec![]
            }
        } else {
            vec![]
        };

        // Extract vendor (brand)
        let brand = raw
            .get("vendor")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract categories from product type and tags
        let mut categories = Vec::new();
        if let Some(product_type) = raw.get("product_type").and_then(|v| v.as_str()) {
            if !product_type.is_empty() {
                categories.push(product_type.to_string());
            }
        }
        if let Some(tags) = raw.get("tags").and_then(|v| v.as_str()) {
            categories.extend(tags.split(',').map(|s| s.trim().to_string()));
        }

        // Map status
        let status = raw
            .get("status")
            .and_then(|v| v.as_str())
            .map(|s| match s.to_lowercase().as_str() {
                "active" => ProductStatus::Active,
                "archived" => ProductStatus::Deleted,
                "draft" => ProductStatus::Inactive,
                _ => ProductStatus::Inactive,
            })
            .unwrap_or(ProductStatus::Active);

        // Build attributes
        let mut attributes = serde_json::Map::new();

        // Add handle
        if let Some(handle) = raw.get("handle") {
            attributes.insert("handle".to_string(), handle.clone());
        }

        // Add options
        if let Some(options) = raw.get("options") {
            attributes.insert("options".to_string(), options.clone());
        }

        // Add template suffix
        if let Some(template) = raw.get("template_suffix") {
            attributes.insert("template_suffix".to_string(), template.clone());
        }

        // Add published scope
        if let Some(scope) = raw.get("published_scope") {
            attributes.insert("published_scope".to_string(), scope.clone());
        }

        // Add metafields if present
        if let Some(metafields) = raw.get("metafields") {
            attributes.insert("metafields".to_string(), metafields.clone());
        }

        // Parse timestamps
        let created_at = raw
            .get("created_at")
            .and_then(|v| v.as_str())
            .map(Self::parse_datetime)
            .unwrap_or_else(Utc::now);

        let updated_at = raw
            .get("updated_at")
            .and_then(|v| v.as_str())
            .map(Self::parse_datetime)
            .unwrap_or_else(Utc::now);

        Ok(Product {
            product_id: if product_id.is_empty() {
                Uuid::new_v4().to_string()
            } else {
                product_id.clone()
            },
            shop_id: shop_id.to_string(),
            platform_shop_id: "".to_string(),
            brand: brand.unwrap_or_default(),
            platform_product_id: product_id,
            platform: PlatformType::Shopify,
            title,
            description,
            price: Price {
                amount: Decimal::from_f64_retain(price).unwrap_or_default(),
                original_price: None,
                discount_percentage: None,
                currency: "USD".to_string(),
            },
            currency: "USD".to_string(), // Can be overridden from shop settings
            sku: sku.unwrap_or_default(),
            quantity: quantity as i16,
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

    // Using default implementation from trait which handles products array
}
