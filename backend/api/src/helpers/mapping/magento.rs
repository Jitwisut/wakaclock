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

pub struct MagentoMapper;

impl PlatformProductMapper for MagentoMapper {
    fn name(&self) -> &str {
        "magento"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        let product_id = raw
            .get("id")
            .or_else(|| raw.get("entity_id"))
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
            .get("custom_attributes")
            .and_then(|attrs| attrs.as_array())
            .and_then(|arr| {
                arr.iter()
                    .find(|attr| {
                        attr.get("attribute_code")
                            .and_then(|c| c.as_str())
                            .map(|s| s == "description")
                            .unwrap_or(false)
                    })
                    .and_then(|attr| attr.get("value"))
                    .and_then(|v| v.as_str())
            })
            .map(|s| s.to_string());

        let price = raw
            .get("price")
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
            .get("extension_attributes")
            .and_then(|ext| ext.get("stock_item"))
            .and_then(|stock| stock.get("qty"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0) as i16;

        let sku = raw
            .get("sku")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let images =
            if let Some(media) = raw.get("media_gallery_entries").and_then(|v| v.as_array()) {
                media
                    .iter()
                    .filter_map(|entry| {
                        entry
                            .get("file")
                            .and_then(|f| f.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect()
            } else {
                vec![]
            };

        let brand = raw
            .get("custom_attributes")
            .and_then(|attrs| attrs.as_array())
            .and_then(|arr| {
                arr.iter()
                    .find(|attr| {
                        attr.get("attribute_code")
                            .and_then(|c| c.as_str())
                            .map(|s| s == "manufacturer" || s == "brand")
                            .unwrap_or(false)
                    })
                    .and_then(|attr| attr.get("value"))
                    .and_then(|v| v.as_str())
            })
            .map(|s| s.to_string());

        let categories =
            if let Some(cat_links) = raw.get("category_links").and_then(|v| v.as_array()) {
                cat_links
                    .iter()
                    .filter_map(|link| {
                        link.get("category_id")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect()
            } else {
                vec![]
            };

        let status = raw
            .get("status")
            .and_then(|v| v.as_i64())
            .map(|s| match s {
                1 => ProductStatus::Active,
                2 => ProductStatus::Inactive,
                _ => ProductStatus::Inactive,
            })
            .unwrap_or(ProductStatus::Active);

        let mut attributes = HashMap::new();
        if let Some(type_id) = raw.get("type_id") {
            attributes.insert("type_id".to_string(), type_id.to_string());
        }
        if let Some(visibility) = raw.get("visibility") {
            attributes.insert("visibility".to_string(), visibility.to_string());
        }
        if let Some(custom_attrs) = raw.get("custom_attributes") {
            attributes.insert("custom_attributes".to_string(), custom_attrs.to_string());
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
            platform: PlatformType::Magento,
            title,
            brand: brand.unwrap_or_default().to_string(),
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
