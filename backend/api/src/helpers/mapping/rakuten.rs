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

pub struct RakutenMapper;

impl PlatformProductMapper for RakutenMapper {
    fn name(&self) -> &str {
        "rakuten"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        let product_id = raw
            .get("itemCode")
            .or_else(|| raw.get("itemNumber"))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        let title = raw
            .get("itemName")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let description = raw
            .get("itemCaption")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let price = raw
            .get("itemPrice")
            .and_then(|v| {
                if let Some(num) = v.as_f64() {
                    Some(num)
                } else if let Some(s) = v.as_str() {
                    s.parse::<f64>().ok()
                } else {
                    None
                }
            })
            .unwrap_or(0.0);

        let quantity = raw
            .get("inventoryCount")
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i16;

        let sku = raw
            .get("itemNumber")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let images = if let Some(images_arr) = raw.get("images").and_then(|v| v.as_array()) {
            images_arr
                .iter()
                .filter_map(|img| {
                    img.get("imageUrl")
                        .and_then(|u| u.as_str())
                        .map(|s| s.to_string())
                })
                .collect()
        } else if let Some(img_url) = raw.get("itemUrl").and_then(|v| v.as_str()) {
            vec![img_url.to_string()]
        } else {
            vec![]
        };

        let brand = raw
            .get("makerName")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let categories = if let Some(genre_id) = raw.get("genreId") {
            vec![format!("genre_{}", genre_id)]
        } else {
            vec![]
        };

        let status = if raw
            .get("isDepot")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            ProductStatus::Inactive
        } else if raw
            .get("availability")
            .and_then(|v| v.as_i64())
            .unwrap_or(1)
            == 1
        {
            ProductStatus::Active
        } else {
            ProductStatus::OutOfStock
        };

        let mut attributes = HashMap::new();
        if let Some(tax_flag) = raw.get("taxFlag") {
            attributes.insert("tax_flag".to_string(), tax_flag.to_string());
        }
        if let Some(postage_flag) = raw.get("postageFlag") {
            attributes.insert("postage_flag".to_string(), postage_flag.to_string());
        }
        if let Some(shop_url) = raw.get("shopUrl") {
            attributes.insert("shop_url".to_string(), shop_url.to_string());
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
            platform: PlatformType::Rakuten,
            title,
            brand,
            description,
            price: Price {
                amount: Decimal::from_f64_retain(price).unwrap_or_default(),
                original_price: None,
                discount_percentage: None,
                currency: "JPY".to_string(),
            },
            currency: "JPY".to_string(),
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
