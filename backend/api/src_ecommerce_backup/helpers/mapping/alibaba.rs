use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde_json::Value;
use uuid::Uuid;

use super::PlatformProductMapper;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};

pub struct AlibabaMapper;

impl PlatformProductMapper for AlibabaMapper {
    fn name(&self) -> &str {
        "alibaba"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        // Extract product ID
        let product_id = raw
            .get("productId")
            .or_else(|| raw.get("offerId"))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        // Extract title
        let title = raw
            .get("subject")
            .or_else(|| raw.get("productTitle"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Extract description
        let description = raw
            .get("details")
            .or_else(|| raw.get("description"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract price from price range
        let price_value = raw
            .get("priceInfo")
            .and_then(|p| p.get("price"))
            .or_else(|| raw.get("price"))
            .and_then(|v| {
                if let Some(num) = v.as_f64() {
                    Some(num)
                } else if let Some(s) = v.as_str() {
                    s.parse::<f64>().ok()
                } else if let Some(range) = v.as_object() {
                    range.get("min").and_then(|m| m.as_f64())
                } else {
                    None
                }
            })
            .unwrap_or(0.0);

        let currency = raw
            .get("currency")
            .and_then(|v| v.as_str())
            .unwrap_or("USD")
            .to_string();

        let price = Price {
            amount: Decimal::from_f64_retain(price_value).unwrap_or(Decimal::ZERO),
            currency: currency.clone(),
            original_price: None,
            discount_percentage: None,
        };

        // Extract quantity/MOQ
        let quantity = raw
            .get("saleInfo")
            .and_then(|s| s.get("minOrderQuantity"))
            .or_else(|| raw.get("moq"))
            .and_then(|v| v.as_i64())
            .unwrap_or(1) as i16;

        // Extract SKU
        let sku = raw
            .get("productCode")
            .or_else(|| raw.get("sku"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract images
        let images = if let Some(image_obj) = raw.get("image") {
            if let Some(images_arr) = image_obj.get("images").and_then(|v| v.as_array()) {
                images_arr
                    .iter()
                    .filter_map(|v| {
                        v.get("fullPathImageURI")
                            .or_else(|| v.get("url"))
                            .and_then(|u| u.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect()
            } else if let Some(url) = image_obj.as_str() {
                vec![url.to_string()]
            } else {
                vec![]
            }
        } else if let Some(images_arr) = raw.get("images").and_then(|v| v.as_array()) {
            images_arr
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        } else {
            vec![]
        };

        // Extract brand
        let brand = raw
            .get("brandName")
            .or_else(|| raw.get("brand"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract categories
        let categories = if let Some(cats) = raw.get("categoryInfo") {
            if let Some(cat_arr) = cats.get("categories").and_then(|v| v.as_array()) {
                cat_arr
                    .iter()
                    .filter_map(|c| c.get("name").and_then(|n| n.as_str()))
                    .map(|s| s.to_string())
                    .collect()
            } else if let Some(cat_name) = cats.get("categoryName").and_then(|v| v.as_str()) {
                vec![cat_name.to_string()]
            } else {
                vec![]
            }
        } else {
            vec![]
        };

        // Map status
        let status = raw
            .get("status")
            .and_then(|v| v.as_str())
            .map(|s| match s.to_lowercase().as_str() {
                "online" | "onselling" | "published" => ProductStatus::Active,
                "offline" | "deleted" => ProductStatus::Deleted,
                "outofstock" => ProductStatus::OutOfStock,
                _ => ProductStatus::Inactive,
            })
            .unwrap_or(ProductStatus::Active);

        // Build attributes
        let mut attributes = serde_json::Map::new();

        // Add trade terms
        if let Some(trade_terms) = raw.get("tradeTerms") {
            attributes.insert("trade_terms".to_string(), trade_terms.clone());
        }

        // Add shipping info
        if let Some(shipping) = raw.get("shippingInfo") {
            attributes.insert("shipping_info".to_string(), shipping.clone());
        }

        // Add supplier info
        if let Some(supplier) = raw.get("supplierInfo") {
            attributes.insert("supplier_info".to_string(), supplier.clone());
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
            platform: PlatformType::Alibaba,
            title,
            brand: brand.unwrap_or_default(),
            description,
            price,
            currency: currency.clone(),
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
            attributes: attributes
                .into_iter()
                .map(|(k, v)| (k, v.to_string()))
                .collect(),
            status,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            synced_at: Some(chrono::Utc::now()),
        })
    }

    // Using default implementation from trait which handles result.products
}
