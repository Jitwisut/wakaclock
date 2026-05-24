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

pub struct MedusaMapper;

impl PlatformProductMapper for MedusaMapper {
    fn name(&self) -> &str {
        "medusa"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        let product_id = raw
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        let title = raw
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let description = raw
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let price = if let Some(variants) = raw.get("variants").and_then(|v| v.as_array()) {
            variants
                .first()
                .and_then(|v| v.get("prices"))
                .and_then(|p| p.get(0))
                .and_then(|price| price.get("amount"))
                .and_then(|v| v.as_f64())
                .map(|v| v / 100.0)
                .unwrap_or(0.0)
        } else {
            0.0
        };

        let quantity = if let Some(variants) = raw.get("variants").and_then(|v| v.as_array()) {
            variants
                .iter()
                .filter_map(|v| v.get("inventory_quantity").and_then(|q| q.as_i64()))
                .sum::<i64>() as i16
        } else {
            0
        };

        let sku = raw
            .get("variants")
            .and_then(|v| v.get(0))
            .and_then(|v| v.get("sku"))
            .and_then(|s| s.as_str())
            .map(|s| s.to_string());

        let images = if let Some(images_arr) = raw.get("images").and_then(|v| v.as_array()) {
            images_arr
                .iter()
                .filter_map(|img| {
                    img.get("url")
                        .and_then(|u| u.as_str())
                        .map(|s| s.to_string())
                })
                .collect()
        } else {
            vec![]
        };

        let categories = if let Some(collection) = raw.get("collection") {
            vec![collection
                .get("title")
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string()]
        } else {
            vec![]
        };

        let status = raw
            .get("status")
            .and_then(|v| v.as_str())
            .map(|s| match s {
                "published" => ProductStatus::Active,
                "draft" => ProductStatus::Inactive,
                "proposed" => ProductStatus::Inactive,
                "rejected" => ProductStatus::Deleted,
                _ => ProductStatus::Inactive,
            })
            .unwrap_or(ProductStatus::Active);

        let mut attributes = HashMap::new();
        if let Some(handle) = raw.get("handle") {
            attributes.insert("handle".to_string(), handle.to_string());
        }
        if let Some(metadata) = raw.get("metadata") {
            attributes.insert("metadata".to_string(), metadata.to_string());
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
            platform: PlatformType::Medusa,
            title,
            brand: "".to_string(),
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

    // Using default implementation from trait which handles products array
}
