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

pub struct ZohoMapper;

impl PlatformProductMapper for ZohoMapper {
    fn name(&self) -> &str {
        "zoho"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        let product_id = raw
            .get("item_id")
            .or_else(|| raw.get("product_id"))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        let title = raw
            .get("name")
            .or_else(|| raw.get("item_name"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let description = raw
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let price = raw
            .get("rate")
            .or_else(|| raw.get("selling_price"))
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
            .get("stock_on_hand")
            .or_else(|| raw.get("quantity_on_hand"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0) as i16;

        let sku = raw
            .get("sku")
            .or_else(|| raw.get("item_code"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let images = if let Some(image_url) = raw.get("image_url").and_then(|v| v.as_str()) {
            vec![image_url.to_string()]
        } else if let Some(documents) = raw.get("image_documents").and_then(|v| v.as_array()) {
            documents
                .iter()
                .filter_map(|doc| {
                    doc.get("url")
                        .and_then(|u| u.as_str())
                        .map(|s| s.to_string())
                })
                .collect()
        } else {
            vec![]
        };

        let brand = raw
            .get("brand")
            .or_else(|| raw.get("manufacturer"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let categories = if let Some(group) = raw.get("group_name").and_then(|v| v.as_str()) {
            vec![group.to_string()]
        } else if let Some(category) = raw.get("category_name").and_then(|v| v.as_str()) {
            vec![category.to_string()]
        } else {
            vec![]
        };

        let status = raw
            .get("status")
            .and_then(|v| v.as_str())
            .map(|s| match s.to_lowercase().as_str() {
                "active" => ProductStatus::Active,
                "inactive" => ProductStatus::Inactive,
                "deleted" => ProductStatus::Deleted,
                _ => ProductStatus::Inactive,
            })
            .unwrap_or(ProductStatus::Active);

        let mut attributes = HashMap::new();
        if let Some(unit) = raw.get("unit") {
            attributes.insert("unit".to_string(), unit.to_string());
        }
        if let Some(tax_id) = raw.get("tax_id") {
            attributes.insert("tax_id".to_string(), tax_id.to_string());
        }
        if let Some(custom_fields) = raw.get("custom_fields") {
            attributes.insert("custom_fields".to_string(), custom_fields.to_string());
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
            platform: PlatformType::Zoho,
            brand,
            title,
            description,
            price: Price {
                amount: Decimal::from_f64_retain(price).unwrap_or_default(),
                original_price: None,
                discount_percentage: None,
                currency: "USD".to_string(),
            },
            currency: "USD".to_string(),
            sku,
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

    // Using default implementation from trait which handles items and products arrays
}
