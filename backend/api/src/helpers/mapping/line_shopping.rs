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

pub struct LineShoppingMapper;

impl LineShoppingMapper {
    fn extract_string(value: &Value, keys: &[&str]) -> Option<String> {
        keys.iter()
            .find_map(|key| value.get(*key))
            .and_then(|v| match v {
                Value::String(s) => Some(s.trim().to_string()),
                Value::Number(n) => Some(n.to_string()),
                Value::Bool(b) => Some(b.to_string()),
                _ => None,
            })
            .filter(|s| !s.is_empty())
    }

    fn extract_f64(value: &Value, keys: &[&str]) -> Option<f64> {
        keys.iter()
            .find_map(|key| value.get(*key))
            .and_then(|v| match v {
                Value::Number(n) => n.as_f64(),
                Value::String(s) => s.trim().parse::<f64>().ok(),
                _ => None,
            })
    }

    fn extract_i64(value: &Value, keys: &[&str]) -> Option<i64> {
        keys.iter()
            .find_map(|key| value.get(*key))
            .and_then(|v| match v {
                Value::Number(n) => n.as_i64(),
                Value::String(s) => s.trim().parse::<i64>().ok(),
                _ => None,
            })
    }
}

impl PlatformProductMapper for LineShoppingMapper {
    fn name(&self) -> &str {
        "line_shopping"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        let product_id = Self::extract_string(raw, &["productId", "id", "product_id", "productID"])
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let title = Self::extract_string(raw, &["name", "productName"]).unwrap_or_default();
        let description = Self::extract_string(raw, &["description", "detail"]);

        let price_amount = if let Some(variants) = raw.get("variants").and_then(|v| v.as_array()) {
            variants
                .iter()
                .find_map(|variant| Self::extract_f64(variant, &["price", "sellingPrice"]))
                .unwrap_or(0.0)
        } else {
            Self::extract_f64(raw, &["price"]).unwrap_or(0.0)
        };

        let total_quantity = if let Some(variants) = raw.get("variants").and_then(|v| v.as_array())
        {
            variants
                .iter()
                .filter_map(|variant| Self::extract_i64(variant, &["onHandNumber", "stock"]))
                .sum::<i64>() as i16
        } else {
            Self::extract_i64(raw, &["stock", "quantity"]).unwrap_or(0) as i16
        };

        let sku = Self::extract_string(raw, &["code", "productCode", "sku"]).unwrap_or_default();

        let images = if let Some(array) = raw.get("imageUrls").and_then(|v| v.as_array()) {
            array
                .iter()
                .filter_map(|item| item.as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
        } else {
            vec![]
        };

        let brand = Self::extract_string(raw, &["brand"]).unwrap_or_default();

        let categories = Self::extract_string(raw, &["categoryId", "category_id"])
            .map(|id| vec![id])
            .unwrap_or_default();

        let display_status =
            Self::extract_string(raw, &["displayStatus"]).unwrap_or_else(|| "onsale".to_string());
        let status = match display_status.to_ascii_lowercase().as_str() {
            "hide" | "hidden" => ProductStatus::Inactive,
            "onsale" | "active" => {
                if total_quantity > 0 {
                    ProductStatus::Active
                } else {
                    ProductStatus::OutOfStock
                }
            }
            _ => ProductStatus::Active,
        };

        let mut attributes = HashMap::new();
        if let Some(discount) = Self::extract_string(raw, &["instantDiscount"]) {
            attributes.insert("instant_discount".to_string(), discount);
        }
        attributes.insert("display_status".to_string(), display_status);

        Ok(Product {
            product_id: product_id.clone(),
            platform_product_id: product_id,
            shop_id: shop_id.to_string(),
            platform_shop_id: "".to_string(),
            platform: PlatformType::LineShop,
            title,
            brand,
            description,
            price: Price {
                amount: Decimal::from_f64_retain(price_amount).unwrap_or_default(),
                original_price: None,
                discount_percentage: None,
                currency: "THB".to_string(),
            },
            currency: "THB".to_string(),
            sku,
            quantity: total_quantity,
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
            synced_at: Some(Utc::now()),
        })
    }
}
