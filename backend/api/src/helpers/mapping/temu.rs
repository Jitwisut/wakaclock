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

pub struct TemuMapper;

impl PlatformProductMapper for TemuMapper {
    fn name(&self) -> &str {
        "temu"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        let product_id = raw
            .get("goods_id")
            .or_else(|| raw.get("product_id"))
            .and_then(|v| {
                if let Some(num) = v.as_i64() {
                    Some(num.to_string())
                } else {
                    v.as_str().map(|s| s.to_string())
                }
            })
            .unwrap_or_default();

        let title = raw
            .get("goods_name")
            .or_else(|| raw.get("title"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let description = raw
            .get("goods_desc")
            .or_else(|| raw.get("description"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let price = raw
            .get("min_price")
            .or_else(|| raw.get("price"))
            .and_then(|v| v.as_f64())
            .map(|v| v / 100.0)
            .unwrap_or(0.0);

        let quantity = raw
            .get("goods_quantity")
            .or_else(|| raw.get("stock"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i16;

        let sku = raw
            .get("goods_sn")
            .or_else(|| raw.get("sku"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let images = if let Some(img_url) = raw.get("goods_image_url").and_then(|v| v.as_str()) {
            vec![img_url.to_string()]
        } else if let Some(gallery) = raw.get("goods_gallery_urls").and_then(|v| v.as_array()) {
            gallery
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        } else {
            vec![]
        };

        let brand = raw
            .get("brand_name")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let categories = if let Some(cat_id) = raw.get("cat_id") {
            vec![format!("category_{}", cat_id)]
        } else {
            vec![]
        };

        let status = if raw
            .get("is_onsale")
            .and_then(|v| v.as_bool())
            .unwrap_or(true)
        {
            if quantity > 0 {
                ProductStatus::Active
            } else {
                ProductStatus::OutOfStock
            }
        } else {
            ProductStatus::Inactive
        };

        let mut attributes = HashMap::new();
        if let Some(sales_tip) = raw.get("sales_tip") {
            attributes.insert("sales_tip".to_string(), sales_tip.to_string());
        }
        if let Some(country) = raw.get("country") {
            attributes.insert("country".to_string(), country.to_string());
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
            // TODO: Add Temu to PlatformType enum
            // platform: PlatformType::Temu,
            platform: PlatformType::Amazon, // Using Amazon as placeholder
            title,
            description,
            brand,
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

    // Using default implementation from trait which handles goods_list array
}
