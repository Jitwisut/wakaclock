use anyhow::Result;
use chrono::Utc;
use serde_json::Value;
use uuid::Uuid;

use super::PlatformProductMapper;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};
use std::collections::HashMap;

pub struct AliExpressMapper;

impl PlatformProductMapper for AliExpressMapper {
    fn name(&self) -> &str {
        "aliexpress"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        // Extract product ID
        let product_id = raw
            .get("product_id")
            .or_else(|| raw.get("productId"))
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
            .get("subject")
            .or_else(|| raw.get("title"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Extract description
        let description = raw
            .get("detail")
            .or_else(|| raw.get("description"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract price from SKU or main price
        let price_amount = if let Some(sku_list) = raw.get("aeop_ae_product_skus") {
            sku_list
                .get("aeop_ae_product_sku")
                .and_then(|s| s.get(0))
                .and_then(|sku| sku.get("sku_price"))
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.0)
        } else {
            raw.get("product_price")
                .or_else(|| raw.get("price"))
                .and_then(|v| {
                    if let Some(price_str) = v.as_str() {
                        price_str.parse::<f64>().ok()
                    } else {
                        v.as_f64()
                    }
                })
                .unwrap_or(0.0)
        };

        let currency = raw
            .get("currency_code")
            .and_then(|v| v.as_str())
            .unwrap_or("USD")
            .to_string();

        let price = Price {
            amount: rust_decimal::Decimal::from_f64_retain(price_amount)
                .unwrap_or(rust_decimal::Decimal::ZERO),
            currency: currency.clone(),
            original_price: None,
            discount_percentage: None,
        };

        // Extract quantity
        let quantity = raw
            .get("total_available_stock")
            .or_else(|| raw.get("available_quantity"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i16;

        // Extract SKU code
        let sku = if let Some(sku_list) = raw.get("aeop_ae_product_skus") {
            sku_list
                .get("aeop_ae_product_sku")
                .and_then(|s| s.get(0))
                .and_then(|sku| sku.get("sku_code"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        } else {
            raw.get("product_sku")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        };

        // Extract images
        let image_urls = if let Some(image_urls) = raw.get("image_u_r_ls") {
            if let Some(url_str) = image_urls.as_str() {
                // Split semicolon-separated URLs
                url_str
                    .split(';')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            } else if let Some(arr) = image_urls.as_array() {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            } else {
                vec![]
            }
        } else if let Some(main_image) = raw.get("main_image_url").and_then(|v| v.as_str()) {
            vec![main_image.to_string()]
        } else {
            vec![]
        };

        let images: Vec<ProductImage> = image_urls
            .into_iter()
            .enumerate()
            .map(|(i, url)| ProductImage {
                url,
                alt: None,
                is_primary: i == 0,
                position: i as i32,
            })
            .collect();

        // Extract brand
        let _brand = raw
            .get("owner_member_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract categories
        let categories = if let Some(cat_id) = raw.get("category_id") {
            vec![cat_id.to_string()]
        } else {
            vec![]
        };

        // Map status
        let status = raw
            .get("product_status_type")
            .and_then(|v| v.as_str())
            .map(|s| match s.to_lowercase().as_str() {
                "onshelf" | "onselling" => ProductStatus::Active,
                "offline" | "offshelf" => ProductStatus::Inactive,
                "delete" | "deleted" => ProductStatus::Deleted,
                "outstock" => ProductStatus::OutOfStock,
                _ => ProductStatus::Inactive,
            })
            .unwrap_or(ProductStatus::Active);

        // Build attributes
        let mut attributes = HashMap::new();

        // Add package info
        if let Some(pkg_length) = raw.get("package_length") {
            attributes.insert("package_length".to_string(), pkg_length.to_string());
        }
        if let Some(pkg_width) = raw.get("package_width") {
            attributes.insert("package_width".to_string(), pkg_width.to_string());
        }
        if let Some(pkg_height) = raw.get("package_height") {
            attributes.insert("package_height".to_string(), pkg_height.to_string());
        }
        if let Some(gross_weight) = raw.get("gross_weight") {
            attributes.insert("gross_weight".to_string(), gross_weight.to_string());
        }

        // Add delivery time
        if let Some(delivery_time) = raw.get("delivery_time") {
            attributes.insert("delivery_time".to_string(), delivery_time.to_string());
        }

        // Add product unit
        if let Some(product_unit) = raw.get("product_unit") {
            attributes.insert("product_unit".to_string(), product_unit.to_string());
        }

        Ok(Product {
            product_id: if product_id.is_empty() {
                Uuid::new_v4().to_string()
            } else {
                format!("aliexpress_{}", product_id)
            },
            platform_product_id: product_id,
            shop_id: shop_id.to_string(),
            platform_shop_id: "".to_string(),
            platform: PlatformType::AliExpress,
            title,
            brand: "".to_string(),
            description,
            price,
            currency,
            sku: sku.unwrap_or_default(),
            quantity,
            images,
            categories,
            attributes,
            status,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            synced_at: Some(chrono::Utc::now()),
        })
    }
}

impl AliExpressMapper {
    fn map_products(&self, raw: &Value, shop_id: &str) -> Result<Vec<Product>> {
        // Handle AliExpress API response
        if let Some(result) = raw.get("aeop_ae_product_display_d_t_o_list") {
            if let Some(products) = result
                .get("aeop_ae_product_display_d_t_o")
                .and_then(|v| v.as_array())
            {
                return products
                    .iter()
                    .map(|p| self.map_product(p, shop_id))
                    .collect();
            }
        }

        // Try result->products structure
        if let Some(result) = raw.get("result") {
            if let Some(products) = result.get("products").and_then(|v| v.as_array()) {
                return products
                    .iter()
                    .map(|p| self.map_product(p, shop_id))
                    .collect();
            }
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
