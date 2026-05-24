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

pub struct EcwidMapper;

impl PlatformProductMapper for EcwidMapper {
    fn name(&self) -> &str {
        "ecwid"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
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

        let title = raw
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let description = raw
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let price = raw
            .get("price")
            .or_else(|| raw.get("defaultDisplayedPrice"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        let quantity = raw
            .get("quantity")
            .and_then(|v| v.as_i64())
            .or_else(|| {
                raw.get("unlimited")
                    .and_then(|u| u.as_bool())
                    .map(|unlimited| if unlimited { 9999 } else { 0 })
            })
            .unwrap_or(0) as i16;

        let sku = raw
            .get("sku")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let images = if let Some(gallery) = raw.get("galleryImages").and_then(|v| v.as_array()) {
            gallery
                .iter()
                .filter_map(|img| {
                    img.get("url")
                        .or_else(|| img.get("imageUrl"))
                        .and_then(|u| u.as_str())
                        .map(|s| s.to_string())
                })
                .collect()
        } else if let Some(url) = raw.get("imageUrl").and_then(|v| v.as_str()) {
            vec![url.to_string()]
        } else {
            vec![]
        };

        let brand = raw
            .get("brand")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let categories = if let Some(cats) = raw.get("categories").and_then(|v| v.as_array()) {
            cats.iter()
                .filter_map(|c| {
                    c.get("id")
                        .and_then(|id| id.as_i64())
                        .map(|id| format!("category_{}", id))
                })
                .collect()
        } else {
            vec![]
        };

        let status = if raw.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true) {
            if quantity > 0
                || raw
                    .get("unlimited")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false)
            {
                ProductStatus::Active
            } else {
                ProductStatus::OutOfStock
            }
        } else {
            ProductStatus::Inactive
        };

        let mut attributes = HashMap::new();
        if let Some(weight) = raw.get("weight") {
            attributes.insert("weight".to_string(), weight.to_string());
        }
        if let Some(options) = raw.get("options") {
            attributes.insert("options".to_string(), options.to_string());
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
            platform: PlatformType::Ecwid,
            title,
            brand: brand.unwrap_or_default(),
            description,
            price: Price {
                amount: Decimal::from_f64_retain(price).unwrap_or_default(),
                original_price: None,
                discount_percentage: None,
                currency: "USD".to_string(),
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
            attributes,
            status,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            synced_at: Some(chrono::Utc::now()),
        })
    }

    // Using default implementation from trait which handles items array
}
