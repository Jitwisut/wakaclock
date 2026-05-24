// Shopee Product Mapper
use rust_decimal::Decimal; // Maps Shopee API responses to unified Product domain model for ClickHouse

use anyhow::Result;
use chrono::Utc;
use serde_json::Value;
use std::collections::HashMap;

use super::PlatformProductMapper;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};

pub struct ShopeeMapper;

impl PlatformProductMapper for ShopeeMapper {
    fn name(&self) -> &str {
        "shopee"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        // Extract product ID (item_id or product_id)
        let product_id = raw
            .get("item_id")
            .or_else(|| raw.get("product_id"))
            .and_then(|v| {
                if v.is_string() {
                    v.as_str().map(|s| s.to_string())
                } else if v.is_i64() {
                    v.as_i64().map(|n| n.to_string())
                } else if v.is_u64() {
                    v.as_u64().map(|n| n.to_string())
                } else {
                    None
                }
            })
            .ok_or_else(|| anyhow::anyhow!("Missing product ID"))?;

        // Extract title (item_name or name)
        let title = raw
            .get("item_name")
            .or_else(|| raw.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Extract description
        let description = raw
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract price information
        let price = if let Some(price_info) = raw.get("price_info") {
            price_info
                .get("original_price")
                .or_else(|| price_info.get("current_price"))
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0)
        } else if let Some(item_price) = raw.get("item_price") {
            item_price.as_f64().unwrap_or(0.0)
        } else {
            raw.get("price").and_then(|v| v.as_f64()).unwrap_or(0.0)
        };

        // Extract currency (default to SGD for Shopee)
        let currency = raw
            .get("currency")
            .and_then(|v| v.as_str())
            .unwrap_or("SGD")
            .to_string();

        // Extract SKU
        let sku = if let Some(models) = raw.get("model_list").and_then(|v| v.as_array()) {
            models
                .first()
                .and_then(|model| model.get("model_sku"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        } else {
            raw.get("item_sku")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        };

        // Extract quantity from stock info
        let quantity = if let Some(stock_info) = raw.get("stock_info") {
            stock_info
                .get("normal_stock")
                .or_else(|| stock_info.get("current_stock"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i16
        } else if let Some(models) = raw.get("model_list").and_then(|v| v.as_array()) {
            models
                .first()
                .and_then(|model| model.get("normal_stock"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i16
        } else {
            raw.get("stock")
                .or_else(|| raw.get("normal_stock"))
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i16
        };

        // Extract images
        let images = if let Some(image_info) = raw.get("image") {
            if let Some(image_ids) = image_info.get("image_id_list").and_then(|v| v.as_array()) {
                image_ids
                    .iter()
                    .filter_map(|id| {
                        id.as_str()
                            .map(|s| format!("https://cf.shopee.sg/file/{}", s))
                    })
                    .collect()
            } else if let Some(image_urls) =
                image_info.get("image_url_list").and_then(|v| v.as_array())
            {
                image_urls
                    .iter()
                    .filter_map(|url| url.as_str().map(|s| s.to_string()))
                    .collect()
            } else {
                vec![]
            }
        } else if let Some(images_arr) = raw.get("images").and_then(|v| v.as_array()) {
            images_arr
                .iter()
                .filter_map(|img| img.as_str().map(|s| s.to_string()))
                .collect()
        } else {
            vec![]
        };

        // Extract categories
        let categories =
            if let Some(category_list) = raw.get("category_list").and_then(|v| v.as_array()) {
                category_list
                    .iter()
                    .filter_map(|cat| {
                        cat.get("display_name")
                            .or_else(|| cat.get("original_category_name"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect()
            } else if let Some(category_id) = raw.get("category_id") {
                vec![category_id.to_string()]
            } else {
                vec![]
            };

        // Determine status based on item_status
        let status = match raw.get("item_status").and_then(|v| v.as_str()) {
            Some("NORMAL") => ProductStatus::Active,
            Some("BANNED") | Some("DELETED") => ProductStatus::Deleted,
            Some("UNLIST") => ProductStatus::Inactive,
            _ if quantity <= 0 => ProductStatus::OutOfStock,
            _ => ProductStatus::Active,
        };

        // Store platform-specific attributes
        let attributes: HashMap<String, String> = raw
            .as_object()
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        Ok(Product {
            product_id: product_id.clone(),
            platform_product_id: product_id,
            shop_id: shop_id.to_string(),
            platform_shop_id: raw
                .get("shop_id")
                .and_then(|v| {
                    if v.is_string() {
                        v.as_str().map(|s| s.to_string())
                    } else if v.is_i64() {
                        v.as_i64().map(|n| n.to_string())
                    } else {
                        None
                    }
                })
                .unwrap_or_default(),
            platform: PlatformType::Shopee,
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

    // Using default implementation from trait which handles response.item_list, data.items, data.item_list patterns
}
