use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

use super::PlatformProductMapper;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};

pub struct EtsyMapper;

impl PlatformProductMapper for EtsyMapper {
    fn name(&self) -> &str {
        "etsy"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        let product_id = raw
            .get("listing_id")
            .and_then(|v| {
                if let Some(num) = v.as_i64() {
                    Some(num.to_string())
                } else {
                    v.as_str().map(|s| s.to_string())
                }
            })
            .unwrap_or_default();

        let title = raw
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let description = raw
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let price = if let Some(price_obj) = raw.get("price") {
            price_obj
                .get("amount")
                .and_then(|v| v.as_f64())
                .map(|v| v / 100.0) // Etsy uses cents
                .unwrap_or(0.0)
        } else {
            raw.get("price")
                .and_then(|v| {
                    if let Some(num) = v.as_f64() {
                        Some(num)
                    } else if let Some(s) = v.as_str() {
                        s.parse::<f64>().ok()
                    } else {
                        None
                    }
                })
                .unwrap_or(0.0)
        };

        let quantity = raw.get("quantity").and_then(|v| v.as_i64()).unwrap_or(0) as i16;

        let sku = raw
            .get("sku")
            .and_then(|v| v.as_str())
            .or_else(|| {
                raw.get("offerings")
                    .and_then(|o| o.get(0))
                    .and_then(|off| off.get("sku"))
                    .and_then(|v| v.as_str())
            })
            .map(|s| s.to_string());

        let images = if let Some(images_arr) = raw.get("images").and_then(|v| v.as_array()) {
            images_arr
                .iter()
                .filter_map(|img| {
                    img.get("url_fullxfull")
                        .or_else(|| img.get("url_570xN"))
                        .or_else(|| img.get("url_75x75"))
                        .and_then(|u| u.as_str())
                        .map(|s| s.to_string())
                })
                .collect()
        } else {
            vec![]
        };

        let brand = raw
            .get("who_made")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let categories = if let Some(taxonomy) = raw.get("taxonomy_path").and_then(|v| v.as_array())
        {
            taxonomy
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        } else if let Some(tags) = raw.get("tags").and_then(|v| v.as_array()) {
            tags.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        } else {
            vec![]
        };

        let status = raw
            .get("state")
            .and_then(|v| v.as_str())
            .map(|s| match s {
                "active" => ProductStatus::Active,
                "inactive" | "draft" => ProductStatus::Inactive,
                "sold_out" => ProductStatus::OutOfStock,
                "expired" | "removed" => ProductStatus::Deleted,
                _ => ProductStatus::Inactive,
            })
            .unwrap_or(ProductStatus::Active);

        let mut attributes = HashMap::new();
        if let Some(materials) = raw.get("materials") {
            attributes.insert("materials".to_string(), materials.to_string());
        }
        if let Some(processing_min) = raw.get("processing_min") {
            attributes.insert("processing_min".to_string(), processing_min.to_string());
        }
        if let Some(processing_max) = raw.get("processing_max") {
            attributes.insert("processing_max".to_string(), processing_max.to_string());
        }
        if let Some(is_customizable) = raw.get("is_customizable") {
            attributes.insert("is_customizable".to_string(), is_customizable.to_string());
        }

        Ok(Product {
            product_id: if product_id.is_empty() {
                Uuid::new_v4().to_string()
            } else {
                product_id.clone()
            },
            platform_product_id: product_id,
            shop_id: shop_id.to_string(),
            platform_shop_id: "".to_string(),
            platform: PlatformType::Etsy,
            title,
            brand: brand.unwrap_or_default(),
            description,
            price: Price {
                amount: Decimal::from_f64_retain(price).unwrap_or_default(),
                original_price: None,
                discount_percentage: None,
                currency: "USD".to_string(),
            },
            currency: raw
                .get("currency_code")
                .and_then(|v| v.as_str())
                .unwrap_or("USD")
                .to_string(),
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
            attributes,
            status,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            synced_at: Some(chrono::Utc::now()),
        })
    }

    // Using default implementation from trait which handles results array
}
