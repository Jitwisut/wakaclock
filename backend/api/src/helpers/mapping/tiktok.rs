/// ไฟล์ tiktok.rs - TikTok Product Mapping Helper
/// แปลงข้อมูลสินค้าจาก TikTok Shop API เป็น unified Product model
/// จัดการ structure ที่ซับซ้อนของ TikTok API response
/// รองรับ SKUs, inventory, images, และ attributes
use super::PlatformProductMapper;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};
use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde_json::Value;

/// TikTok Product Mapper
/// Maps TikTok Shop API responses to unified Product domain model for ClickHouse
pub struct TikTokMapper;

impl PlatformProductMapper for TikTokMapper {
    fn name(&self) -> &str {
        "tiktok"
    }

    /// Map raw TikTok API response เป็น Product struct
    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        // Use the TikTokProduct structure internally if needed
        let product = self.map_to_product_internal(raw, shop_id, None)?;
        Ok(product)
    }

    // Using default implementation from trait which handles products and data.products patterns
}

impl TikTokMapper {
    /// Internal mapping method - แปลง TikTok API structure เป็น Product
    /// จัดการกับ:
    /// - Product ID และ title ที่อาจมี aliases
    /// - SKUs และ inventory จากหลาย warehouses
    /// - Images ที่ซ้อนใน url_list
    /// - Attributes เฉพาะของ TikTok (sales_regions, brand, etc.)
    fn map_to_product_internal(
        &self,
        raw: &Value,
        shop_id: &str,
        platform_shop_id: Option<String>,
    ) -> Result<Product> {
        // Extract product ID
        let product_id = raw
            .get("id")
            .or_else(|| raw.get("product_id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing product ID"))?
            .to_string();

        // Extract title
        let title = raw
            .get("title")
            .or_else(|| raw.get("product_name"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Extract description
        let description = raw
            .get("description")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Map images to ProductImage (if we have the structured type)
        let images: Vec<String> =
            if let Some(main_images) = raw.get("main_images").and_then(|v| v.as_array()) {
                main_images
                    .iter()
                    .flat_map(|img| {
                        if let Some(url_list) = img.get("url_list").and_then(|v| v.as_array()) {
                            url_list
                                .iter()
                                .filter_map(|u| u.as_str().map(|s| s.to_string()))
                                .collect::<Vec<_>>()
                        } else if let Some(url) = img.get("url").and_then(|v| v.as_str()) {
                            vec![url.to_string()]
                        } else {
                            vec![]
                        }
                    })
                    .collect()
            } else {
                vec![]
            };

        // Get SKUs for inventory and pricing
        let skus = raw
            .get("skus")
            .and_then(|v| v.as_array())
            .ok_or_else(|| anyhow::anyhow!("Missing SKUs"))?;

        if skus.is_empty() {
            return Err(anyhow::anyhow!("No SKUs found"));
        }

        // Calculate total inventory across all SKUs and warehouses
        let total_quantity: i32 = skus
            .iter()
            .flat_map(|sku| {
                sku.get("inventory")
                    .and_then(|inv| inv.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|i| i.get("available_quantity").and_then(|v| v.as_i64()))
                            .sum::<i64>() as i32
                    })
            })
            .sum();

        // Get primary SKU
        let first_sku = &skus[0];
        let primary_sku = first_sku
            .get("seller_sku")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Get base price from first SKU
        let base_price = first_sku
            .get("price")
            .and_then(|p| p.get("tax_exclusive_price"))
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0);

        let currency = first_sku
            .get("price")
            .and_then(|p| p.get("currency"))
            .and_then(|v| v.as_str())
            .unwrap_or("USD")
            .to_string();

        // Build product attributes
        let mut attributes = serde_json::Map::new();
        attributes.insert("product_id".to_string(), Value::String(product_id.clone()));

        if let Some(sales_regions) = raw.get("sales_regions").and_then(|v| v.as_array()) {
            attributes.insert(
                "sales_regions".to_string(),
                Value::from(sales_regions.clone()),
            );
        }

        if let Some(brand) = raw.get("brand") {
            if let Some(brand_id) = brand.get("id").and_then(|v| v.as_str()) {
                attributes.insert("brand_id".to_string(), Value::String(brand_id.to_string()));
            }
            if let Some(brand_name) = brand.get("name").and_then(|v| v.as_str()) {
                attributes.insert(
                    "brand_name".to_string(),
                    Value::String(brand_name.to_string()),
                );
            }
        }

        if let Some(warranty_period) = raw.get("warranty_period").and_then(|v| v.as_i64()) {
            attributes.insert("warranty_period".to_string(), Value::from(warranty_period));
        }

        if let Some(warranty_policy) = raw.get("warranty_policy").and_then(|v| v.as_str()) {
            attributes.insert(
                "warranty_policy".to_string(),
                Value::String(warranty_policy.to_string()),
            );
        }

        // Add package dimensions if available
        if let Some(dimensions) = raw.get("package_dimensions") {
            if let Some(length) = dimensions.get("length").and_then(|v| v.as_str()) {
                attributes.insert(
                    "package_length".to_string(),
                    Value::String(length.to_string()),
                );
            }
            if let Some(width) = dimensions.get("width").and_then(|v| v.as_str()) {
                attributes.insert(
                    "package_width".to_string(),
                    Value::String(width.to_string()),
                );
            }
            if let Some(height) = dimensions.get("height").and_then(|v| v.as_str()) {
                attributes.insert(
                    "package_height".to_string(),
                    Value::String(height.to_string()),
                );
            }
            if let Some(unit) = dimensions.get("unit").and_then(|v| v.as_str()) {
                attributes.insert(
                    "dimension_unit".to_string(),
                    Value::String(unit.to_string()),
                );
            }
        }

        // Add package weight if available
        if let Some(weight) = raw.get("package_weight") {
            if let Some(value) = weight.get("value").and_then(|v| v.as_str()) {
                attributes.insert(
                    "package_weight".to_string(),
                    Value::String(value.to_string()),
                );
            }
            if let Some(unit) = weight.get("unit").and_then(|v| v.as_str()) {
                attributes.insert("weight_unit".to_string(), Value::String(unit.to_string()));
            }
        }

        // Store SKU details
        for (idx, sku) in skus.iter().enumerate() {
            if let Some(sku_id) = sku.get("id").and_then(|v| v.as_str()) {
                attributes.insert(format!("sku_{}_id", idx), Value::String(sku_id.to_string()));
            }
        }

        // Extract category IDs
        let categories: Vec<String> =
            if let Some(category_chains) = raw.get("category_chains").and_then(|v| v.as_array()) {
                category_chains
                    .iter()
                    .filter(|cat| {
                        cat.get("is_leaf")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false)
                    })
                    .filter_map(|cat| {
                        cat.get("id")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect()
            } else {
                vec![]
            };

        // Determine product status
        let status = match raw.get("status").and_then(|v| v.as_str()) {
            Some(s) if s.to_uppercase() == "ACTIVATE" || s.to_uppercase() == "ACTIVE" => {
                ProductStatus::Active
            }
            Some(s) if s.to_uppercase() == "DEACTIVATE" || s.to_uppercase() == "INACTIVE" => {
                ProductStatus::Inactive
            }
            Some(s) if s.to_uppercase() == "DELETED" => ProductStatus::Deleted,
            Some(s) if s.to_uppercase() == "FROZEN" => ProductStatus::Inactive,
            _ if total_quantity <= 0 => ProductStatus::OutOfStock,
            _ => ProductStatus::Draft,
        };

        // Extract brand from structured data
        let brand = raw
            .get("brand")
            .and_then(|b| b.get("name"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Parse timestamps if available
        let created_at = raw
            .get("create_time")
            .and_then(|v| v.as_i64())
            .and_then(|ts| DateTime::from_timestamp(ts, 0))
            .unwrap_or_else(Utc::now);

        let updated_at = raw
            .get("update_time")
            .and_then(|v| v.as_i64())
            .and_then(|ts| DateTime::from_timestamp(ts, 0))
            .unwrap_or_else(Utc::now);

        Ok(Product {
            product_id: product_id.clone(),
            shop_id: shop_id.to_string(),
            platform_shop_id: platform_shop_id.unwrap_or_default(),
            platform_product_id: product_id,
            platform: PlatformType::TikTok,
            title,
            brand: brand.unwrap_or_default(),
            description,
            price: Price {
                amount: Decimal::from_f64_retain(base_price).unwrap_or_default(),
                original_price: None,
                discount_percentage: None,
                currency: "USD".to_string(),
            },
            currency,
            sku: primary_sku.unwrap_or_default(),
            quantity: total_quantity as i16,
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
            created_at,
            updated_at,
            synced_at: Some(Utc::now()),
        })
    }
}
