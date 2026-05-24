use anyhow::Result;
use chrono::Utc;
use rust_decimal::prelude::FromPrimitive;
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

use super::PlatformProductMapper;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};

pub struct WalmartMapper;

impl PlatformProductMapper for WalmartMapper {
    fn name(&self) -> &str {
        "walmart"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        // Extract item ID or UPC
        let product_id = raw
            .get("itemId")
            .or_else(|| raw.get("wpid"))
            .or_else(|| raw.get("upc"))
            .and_then(|v| {
                if let Some(num) = v.as_i64() {
                    Some(num.to_string())
                } else {
                    v.as_str().map(|s| s.to_string())
                }
            })
            .unwrap_or_default();

        // Extract title
        let title = raw
            .get("name")
            .or_else(|| raw.get("productName"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Extract description
        let description = raw
            .get("longDescription")
            .or_else(|| raw.get("shortDescription"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract price
        let price = if let Some(sale_price) = raw.get("salePrice") {
            if let Some(num) = sale_price.as_f64() {
                num
            } else if let Some(s) = sale_price.as_str() {
                s.parse::<f64>().unwrap_or(0.0)
            } else {
                0.0
            }
        } else if let Some(msrp) = raw.get("msrp") {
            if let Some(num) = msrp.as_f64() {
                num
            } else if let Some(s) = msrp.as_str() {
                s.parse::<f64>().unwrap_or(0.0)
            } else {
                0.0
            }
        } else {
            raw.get("price")
                .and_then(|p| {
                    if let Some(price_obj) = p.as_object() {
                        price_obj.get("amount").and_then(|a| a.as_f64())
                    } else {
                        p.as_f64()
                    }
                })
                .unwrap_or(0.0)
        };

        // Extract quantity/stock
        let quantity = raw
            .get("stock")
            .or_else(|| raw.get("availableQuantity"))
            .and_then(|v| {
                if v.as_str() == Some("Available") {
                    Some(1) // Default to 1 if just marked as available
                } else {
                    v.as_i64()
                }
            })
            .unwrap_or(0) as i16;

        // Extract SKU or model number
        let sku = raw
            .get("sku")
            .or_else(|| raw.get("modelNumber"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract images
        let images =
            if let Some(image_entities) = raw.get("imageEntities").and_then(|v| v.as_array()) {
                image_entities
                    .iter()
                    .filter_map(|img| {
                        img.get("largeImage")
                            .or_else(|| img.get("mediumImage"))
                            .or_else(|| img.get("thumbnailImage"))
                            .and_then(|u| u.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect()
            } else if let Some(large_image) = raw.get("largeImage").and_then(|v| v.as_str()) {
                vec![large_image.to_string()]
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
            .unwrap_or("")
            .to_string();

        // Extract categories
        let categories = if let Some(cat_path) = raw.get("categoryPath").and_then(|v| v.as_str()) {
            cat_path
                .split('/')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        } else if let Some(cat_node) = raw.get("categoryNode").and_then(|v| v.as_str()) {
            vec![cat_node.to_string()]
        } else {
            vec![]
        };

        // Map availability status
        let status = if let Some(available) = raw.get("availableOnline").and_then(|v| v.as_bool()) {
            if available {
                ProductStatus::Active
            } else {
                ProductStatus::OutOfStock
            }
        } else if let Some(stock_str) = raw.get("stock").and_then(|v| v.as_str()) {
            match stock_str.to_lowercase().as_str() {
                "available" => ProductStatus::Active,
                "out of stock" | "not available" => ProductStatus::OutOfStock,
                _ => ProductStatus::Inactive,
            }
        } else {
            ProductStatus::Active
        };

        // Build attributes
        let mut attributes = HashMap::new();

        // Add product type
        if let Some(product_type) = raw.get("productType") {
            attributes.insert("product_type".to_string(), product_type.to_string());
        }

        // Add shipping weight
        if let Some(weight) = raw.get("shippingWeight") {
            attributes.insert("shipping_weight".to_string(), weight.to_string());
        }

        // Add customer rating
        if let Some(rating) = raw.get("customerRating") {
            attributes.insert("customer_rating".to_string(), rating.to_string());
        }

        // Add number of reviews
        if let Some(num_reviews) = raw.get("numReviews") {
            attributes.insert("num_reviews".to_string(), num_reviews.to_string());
        }

        // Add bundle indicator
        if let Some(bundle) = raw.get("bundle") {
            attributes.insert("is_bundle".to_string(), bundle.to_string());
        }

        // Add clearance
        if let Some(clearance) = raw.get("clearance") {
            attributes.insert("is_clearance".to_string(), clearance.to_string());
        }

        // Add rollback
        if let Some(rollback) = raw.get("rollback") {
            attributes.insert("is_rollback".to_string(), rollback.to_string());
        }

        Ok(Product {
            product_id: if product_id.is_empty() {
                Uuid::new_v4().to_string()
            } else {
                product_id.clone()
            },
            shop_id: shop_id.to_string(),
            platform_shop_id: "".to_string(),
            platform_product_id: product_id,
            platform: PlatformType::Walmart,
            title,
            description,
            price: Price {
                amount: rust_decimal::Decimal::from_f64(price)
                    .unwrap_or(rust_decimal::Decimal::ZERO),
                currency: "USD".to_string(),
                original_price: Some(
                    rust_decimal::Decimal::from_f64(price).unwrap_or(rust_decimal::Decimal::ZERO),
                ),
                discount_percentage: None,
            },
            brand,
            currency: "USD".to_string(), // Walmart typically uses USD
            sku: sku.unwrap_or_default(),
            quantity,
            images: images
                .into_iter()
                .enumerate()
                .map(|(i, url)| ProductImage {
                    url,
                    alt: None,
                    is_primary: i == 0,
                    position: i as i32,
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
}

impl WalmartMapper {
    fn map_products(&self, raw: &Value, shop_id: &str) -> Result<Vec<Product>> {
        // Handle Walmart API response
        if let Some(items) = raw.get("items").and_then(|v| v.as_array()) {
            return items.iter().map(|p| self.map_product(p, shop_id)).collect();
        }

        // Try search results
        if let Some(search_results) = raw
            .get("searchResults")
            .and_then(|r| r.get("results"))
            .and_then(|v| v.as_array())
        {
            return search_results
                .iter()
                .map(|p| self.map_product(p, shop_id))
                .collect();
        }

        // Try products array
        if let Some(products) = raw.get("products").and_then(|v| v.as_array()) {
            return products
                .iter()
                .map(|p| self.map_product(p, shop_id))
                .collect();
        }

        // Try direct array
        if let Some(product_array) = raw.as_array() {
            return product_array
                .iter()
                .map(|p| self.map_product(p, shop_id))
                .collect();
        }

        // Single product
        Ok(vec![self.map_product(raw, shop_id)?])
    }
}
