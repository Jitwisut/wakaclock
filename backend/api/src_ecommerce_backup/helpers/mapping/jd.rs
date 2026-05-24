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

pub struct JdMapper;

impl PlatformProductMapper for JdMapper {
    fn name(&self) -> &str {
        "jd"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        let product_id = raw
            .get("wareId")
            .or_else(|| raw.get("skuId"))
            .and_then(|v| {
                if let Some(num) = v.as_i64() {
                    Some(num.to_string())
                } else {
                    v.as_str().map(|s| s.to_string())
                }
            })
            .unwrap_or_default();

        let title = raw
            .get("wareName")
            .or_else(|| raw.get("title"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let description = raw
            .get("introduction")
            .or_else(|| raw.get("description"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let price = raw
            .get("jdPrice")
            .or_else(|| raw.get("price"))
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
            .get("stockNum")
            .or_else(|| raw.get("quantity"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i16;

        let sku = raw
            .get("outerId")
            .or_else(|| raw.get("skuCode"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let images = if let Some(images_str) = raw.get("logoUrl").and_then(|v| v.as_str()) {
            images_str
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        } else if let Some(images_arr) = raw.get("images").and_then(|v| v.as_array()) {
            images_arr
                .iter()
                .filter_map(|img| {
                    if let Some(url) = img.as_str() {
                        Some(url.to_string())
                    } else {
                        img.get("path")
                            .and_then(|p| p.as_str())
                            .map(|s| s.to_string())
                    }
                })
                .collect()
        } else {
            vec![]
        };

        let brand = raw
            .get("brandName")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let categories = if let Some(cat_id) = raw.get("categoryId") {
            vec![format!("category_{}", cat_id)]
        } else {
            vec![]
        };

        let status = raw
            .get("wareStatus")
            .and_then(|v| v.as_str())
            .map(|s| match s {
                "VALID" | "1" => ProductStatus::Active,
                "INVALID" | "0" => ProductStatus::Inactive,
                "DELETE" | "2" => ProductStatus::Deleted,
                _ => ProductStatus::Inactive,
            })
            .unwrap_or(ProductStatus::Active);

        let mut attributes = HashMap::new();
        if let Some(props) = raw.get("props") {
            attributes.insert("props".to_string(), props.to_string());
        }
        if let Some(after_sales) = raw.get("afterSales") {
            attributes.insert("after_sales".to_string(), after_sales.to_string());
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
            platform: PlatformType::JD,
            title,
            brand: brand.unwrap_or_default(),
            description,
            price: Price {
                amount: Decimal::from_f64_retain(price).unwrap_or_default(),
                original_price: None,
                discount_percentage: None,
                currency: "CNY".to_string(),
            },
            currency: "CNY".to_string(),
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

    // Using default implementation from trait which handles result.wares structure
}
