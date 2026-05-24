// Lazada Product Mapper
use rust_decimal::Decimal; // Maps Lazada API responses to unified Product domain model for ClickHouse

use anyhow::Result;
use chrono::Utc;
use serde_json::Value;
use std::collections::HashMap;

use super::PlatformProductMapper;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};

pub struct LazadaMapper;

impl PlatformProductMapper for LazadaMapper {
    fn name(&self) -> &str {
        "lazada"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        // Extract product ID (item_id or product_id)
        let product_id = raw
            .get("item_id")
            .or_else(|| raw.get("product_id"))
            .and_then(|v| {
                if let Some(s) = v.as_str() {
                    Some(s.to_string())
                } else {
                    v.as_i64().map(|n| n.to_string())
                }
            })
            .ok_or_else(|| anyhow::anyhow!("Missing product ID"))?;

        // Extract title
        let title = raw
            .get("attributes")
            .and_then(|attrs| attrs.get("name"))
            .and_then(|v| v.as_str())
            .or_else(|| raw.get("name").and_then(|v| v.as_str()))
            .unwrap_or("")
            .to_string();

        // Extract description
        let description = raw
            .get("attributes")
            .and_then(|attrs| attrs.get("description"))
            .and_then(|v| v.as_str())
            .or_else(|| raw.get("description").and_then(|v| v.as_str()))
            .map(|s| s.to_string());

        // Extract price from skus
        let price = if let Some(skus) = raw.get("skus").and_then(|v| v.as_array()) {
            skus.first()
                .and_then(|sku| sku.get("price"))
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0)
        } else {
            raw.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0)
        };

        // Extract currency (default to MYR for Lazada)
        let currency = raw
            .get("currency")
            .and_then(|v| v.as_str())
            .unwrap_or("MYR")
            .to_string();

        // Extract SKU
        let sku = if let Some(skus) = raw.get("skus").and_then(|v| v.as_array()) {
            skus.first()
                .and_then(|sku| sku.get("sellerSku"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        } else {
            raw.get("seller_sku")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        };

        // Extract quantity from skus
        let quantity = if let Some(skus) = raw.get("skus").and_then(|v| v.as_array()) {
            skus.first()
                .and_then(|sku| sku.get("quantity"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i16
        } else {
            raw.get("quantity").and_then(|v| v.as_i64()).unwrap_or(0) as i16
        };

        // Extract images
        let images = if let Some(images_arr) = raw.get("images").and_then(|v| v.as_array()) {
            images_arr
                .iter()
                .filter_map(|img| img.as_str().map(|s| s.to_string()))
                .collect()
        } else if let Some(skus) = raw.get("skus").and_then(|v| v.as_array()) {
            skus.iter()
                .flat_map(|sku| {
                    sku.get("Images")
                        .and_then(|v| v.as_array())
                        .map(|arr| {
                            arr.iter()
                                .filter_map(|img| img.as_str().map(|s| s.to_string()))
                                .collect::<Vec<_>>()
                        })
                        .unwrap_or_default()
                })
                .collect()
        } else {
            vec![]
        };

        // Extract categories
        let categories = if let Some(primary_category) = raw.get("primary_category") {
            vec![primary_category.as_str().unwrap_or("").to_string()]
        } else if let Some(category_path) = raw.get("category_path") {
            category_path
                .as_str()
                .map(|s| s.split('/').map(|c| c.to_string()).collect())
                .unwrap_or_default()
        } else {
            vec![]
        };

        // Determine status
        let status = match raw.get("status").and_then(|v| v.as_str()) {
            Some("active") | Some("Active") => ProductStatus::Active,
            Some("inactive") | Some("Inactive") => ProductStatus::Inactive,
            Some("deleted") | Some("Deleted") => ProductStatus::Deleted,
            _ if quantity <= 0 => ProductStatus::OutOfStock,
            _ => ProductStatus::Active,
        };

        // Store platform-specific attributes
        let attributes = HashMap::new();

        Ok(Product {
            product_id: product_id.clone(),
            shop_id: shop_id.to_string(),
            platform_shop_id: raw
                .get("shop_id")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string(),
            platform_product_id: product_id,
            platform: PlatformType::Lazada,
            title,
            brand: "".to_string(),
            description,
            price: Price {
                amount: Decimal::from_f64_retain(price).unwrap_or_default(),
                original_price: None,
                discount_percentage: None,
                currency: "USD".to_string(),
            },
            currency,
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

    // Using default implementation from trait which handles data.products and data.items
}
