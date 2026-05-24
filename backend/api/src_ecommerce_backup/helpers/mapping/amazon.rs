/// โมดูลสำหรับแปลงข้อมูล Amazon
///
/// จัดการการแปลงข้อมูลสินค้าจาก Amazon SP-API เป็นรูปแบบมาตรฐานของระบบ
/// รองรับการแปลง ASIN, FBA inventory และ marketplace data
///
/// คุณสมบัติ:
/// - รองรับ Amazon marketplace หลายภูมิภาค
/// - แปลง ASIN, SKU และ UPC/EAN codes
/// - จัดการ FBA/FBM inventory data
/// - รองรับ product images และ variation data
/// - แปลงสถานะสินค้าและ pricing information
use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde_json::Value;
use uuid::Uuid;

use super::PlatformProductMapper;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};

pub struct AmazonMapper;

impl PlatformProductMapper for AmazonMapper {
    fn name(&self) -> &str {
        "amazon"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        // Extract ASIN (Amazon Standard Identification Number)
        let product_id = raw
            .get("asin")
            .or_else(|| raw.get("ASIN"))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        // Extract title
        let title = raw
            .get("title")
            .or_else(|| raw.get("itemName"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Extract description from features or productDescription
        let description = if let Some(features) = raw.get("features").and_then(|v| v.as_array()) {
            Some(
                features
                    .iter()
                    .filter_map(|f| f.as_str())
                    .collect::<Vec<_>>()
                    .join("\n"),
            )
        } else {
            raw.get("productDescription")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        };

        // Extract price from various fields
        let price = raw
            .get("price")
            .and_then(|p| {
                if let Some(price_obj) = p.as_object() {
                    price_obj
                        .get("value")
                        .or_else(|| price_obj.get("amount"))
                        .and_then(|v| v.as_f64())
                } else if let Some(price_str) = p.as_str() {
                    // Remove currency symbols and parse
                    price_str
                        .replace(['$', '£', '€', ','], "")
                        .trim()
                        .parse::<f64>()
                        .ok()
                } else {
                    p.as_f64()
                }
            })
            .or_else(|| {
                raw.get("listPrice")
                    .and_then(|lp| lp.get("amount"))
                    .and_then(|v| v.as_f64())
            })
            .unwrap_or(0.0);

        // Extract quantity from fulfillment
        let quantity = raw
            .get("fulfillmentChannel")
            .and_then(|_| raw.get("quantity"))
            .and_then(|v| v.as_i64())
            .or_else(|| {
                raw.get("availability")
                    .and_then(|a| a.get("quantity"))
                    .and_then(|v| v.as_i64())
            })
            .unwrap_or(0) as i16;

        // Extract SKU
        let sku = raw
            .get("sellerSKU")
            .or_else(|| raw.get("sku"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract images
        let images = if let Some(images_obj) = raw.get("images") {
            if let Some(images_arr) = images_obj.as_array() {
                images_arr
                    .iter()
                    .filter_map(|img| {
                        if let Some(url) = img.as_str() {
                            Some(url.to_string())
                        } else {
                            img.get("link")
                                .or_else(|| img.get("url"))
                                .and_then(|u| u.as_str())
                                .map(|s| s.to_string())
                        }
                    })
                    .collect()
            } else if let Some(main_image) = images_obj.get("main").and_then(|v| v.as_str()) {
                vec![main_image.to_string()]
            } else {
                vec![]
            }
        } else if let Some(main_image) = raw.get("mainImage").and_then(|v| v.as_str()) {
            vec![main_image.to_string()]
        } else {
            vec![]
        };

        // Extract brand
        let brand = raw
            .get("brand")
            .or_else(|| raw.get("manufacturer"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract categories from browseNode
        let categories =
            if let Some(browse_nodes) = raw.get("browseNodes").and_then(|v| v.as_array()) {
                browse_nodes
                    .iter()
                    .filter_map(|node| {
                        node.get("name")
                            .or_else(|| node.get("displayName"))
                            .and_then(|n| n.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect()
            } else if let Some(category) = raw.get("productCategory").and_then(|v| v.as_str()) {
                vec![category.to_string()]
            } else {
                vec![]
            };

        // Map status based on availability
        let status = if let Some(availability) = raw.get("availability") {
            if let Some(status_str) = availability.get("type").and_then(|v| v.as_str()) {
                match status_str.to_lowercase().as_str() {
                    "now" | "in_stock" => ProductStatus::Active,
                    "out_of_stock" => ProductStatus::OutOfStock,
                    "discontinued" => ProductStatus::Deleted,
                    _ => ProductStatus::Inactive,
                }
            } else if let Some(available) =
                availability.get("isAvailable").and_then(|v| v.as_bool())
            {
                if available {
                    ProductStatus::Active
                } else {
                    ProductStatus::OutOfStock
                }
            } else {
                ProductStatus::Active
            }
        } else {
            ProductStatus::Active
        };

        // Build attributes
        let mut attributes = serde_json::Map::new();

        // Add dimensions
        if let Some(dimensions) = raw.get("dimensions") {
            attributes.insert("dimensions".to_string(), dimensions.clone());
        }

        // Add weight
        if let Some(weight) = raw.get("weight") {
            attributes.insert("weight".to_string(), weight.clone());
        }

        // Add sales rank
        if let Some(sales_rank) = raw.get("salesRank") {
            attributes.insert("sales_rank".to_string(), sales_rank.clone());
        }

        // Add fulfillment info
        if let Some(fulfillment) = raw.get("fulfillmentChannel") {
            attributes.insert("fulfillment_channel".to_string(), fulfillment.clone());
        }

        // Add condition
        if let Some(condition) = raw.get("condition") {
            attributes.insert("condition".to_string(), condition.clone());
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
            platform: PlatformType::Amazon,
            title,
            brand: brand.unwrap_or_default(),
            description,
            price: Price {
                amount: Decimal::from_f64_retain(price).unwrap_or_default(),
                currency: "USD".to_string(),
                original_price: None,
                discount_percentage: None,
            },
            currency: raw
                .get("price")
                .and_then(|p| p.get("currency"))
                .or_else(|| raw.get("currency"))
                .and_then(|v| v.as_str())
                .unwrap_or("USD")
                .to_string(),
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
}

impl AmazonMapper {
    fn map_products(&self, raw: &Value, shop_id: &str) -> Result<Vec<Product>> {
        // Handle Amazon MWS/SP-API response
        if let Some(payload) = raw.get("payload") {
            if let Some(items) = payload.get("Items").and_then(|v| v.as_array()) {
                return items.iter().map(|p| self.map_product(p, shop_id)).collect();
            }
        }

        // Try products array
        if let Some(products) = raw.get("products").and_then(|v| v.as_array()) {
            return products
                .iter()
                .map(|p| self.map_product(p, shop_id))
                .collect();
        }

        // Try listings array
        if let Some(listings) = raw.get("listings").and_then(|v| v.as_array()) {
            return listings
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
