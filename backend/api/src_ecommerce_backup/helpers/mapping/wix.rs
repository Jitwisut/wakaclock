use super::{
    extract_bool, extract_f64, extract_i32, extract_string, map_status, PlatformProductMapper,
};
use crate::model::v1::platfrom::entries::{PlatformType, Price, Product, ProductImage};
use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde_json::{json, Value};
use std::collections::HashMap;

pub struct WixMapper;

impl PlatformProductMapper for WixMapper {
    fn name(&self) -> &str {
        "wix"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        // Extract the product ID
        let product_id = extract_string(raw, "id").ok_or_else(|| anyhow!("Missing product ID"))?;

        // Extract basic information
        let title = extract_string(raw, "name").ok_or_else(|| anyhow!("Missing product name"))?;

        let description = extract_string(raw, "description");

        // Extract pricing information
        let (price, currency) = extract_pricing(raw)?;

        // Extract SKU
        let sku = extract_string(raw, "sku");

        // Extract quantity from stock
        let quantity = extract_i32(raw, "stock.quantity").unwrap_or(0);

        // Extract images
        let images = extract_images(raw);

        // Extract categories from collection IDs
        let categories = extract_categories(raw);

        // Build attributes
        let attributes = build_attributes(raw);

        // Determine status
        let visible = extract_bool(raw, "visible");
        let status = map_status(None, visible);

        // Extract timestamps
        let created_at = extract_datetime(raw, "createdDate").unwrap_or_else(Utc::now);
        let updated_at = extract_datetime(raw, "lastUpdated").unwrap_or_else(Utc::now);

        Ok(Product {
            product_id: product_id.clone(),
            platform_product_id: product_id,
            shop_id: shop_id.to_string(),
            platform_shop_id: "".to_string(),
            platform: PlatformType::Wix,
            brand: "".to_string(),
            title,
            description,
            price: Price {
                amount: Decimal::from_f64_retain(price).unwrap_or_default(),
                original_price: None,
                discount_percentage: None,
                currency: "USD".to_string(),
            },
            currency,
            sku: sku.unwrap_or_default(),
            quantity: quantity as i16,
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
            created_at,
            updated_at,
            synced_at: Some(Utc::now()),
        })
    }
}

impl WixMapper {
    fn map_products(&self, raw: &Value, shop_id: &str) -> Result<Vec<Product>> {
        // Check if this is a single product or a list response
        if let Some(products) = raw.get("products").and_then(|p| p.as_array()) {
            // This is a list response
            let mut mapped_products = Vec::new();
            for product_json in products {
                match self.map_product(product_json, shop_id) {
                    Ok(product) => mapped_products.push(product),
                    Err(e) => {
                        // Log error but continue processing other products
                        eprintln!("Failed to map Wix product: {}", e);
                    }
                }
            }
            Ok(mapped_products)
        } else if raw.get("id").is_some() {
            // This is a single product
            Ok(vec![self.map_product(raw, shop_id)?])
        } else {
            // Try to extract from data wrapper
            if let Some(data) = raw.get("data") {
                return self.map_products(data, shop_id);
            }
            Err(anyhow!("Invalid Wix product response format"))
        }
    }
}

/// Extract pricing information from Wix product
fn extract_pricing(raw: &Value) -> Result<(f64, String)> {
    // Try to get price from priceData
    if let Some(price_data) = raw.get("priceData") {
        let price = extract_f64(price_data, "price").unwrap_or(0.0);
        let currency = extract_string(price_data, "currency").unwrap_or_else(|| "USD".to_string());
        return Ok((price, currency));
    }

    // Try to get price from convertedPriceData
    if let Some(converted_price) = raw.get("convertedPriceData") {
        let price = extract_f64(converted_price, "price").unwrap_or(0.0);
        let currency =
            extract_string(converted_price, "currency").unwrap_or_else(|| "USD".to_string());
        return Ok((price, currency));
    }

    // Try to get price from priceRange
    if let Some(price_range) = raw.get("priceRange") {
        let min_price = extract_f64(price_range, "minValue").unwrap_or(0.0);
        return Ok((min_price, "USD".to_string()));
    }

    // Try to get price from first variant
    if let Some(variants) = raw.get("variants").and_then(|v| v.as_array()) {
        if let Some(first_variant) = variants.first() {
            if let Some(variant_data) = first_variant.get("variant") {
                if let Some(price_data) = variant_data.get("priceData") {
                    let price = extract_f64(price_data, "price").unwrap_or(0.0);
                    let currency =
                        extract_string(price_data, "currency").unwrap_or_else(|| "USD".to_string());
                    return Ok((price, currency));
                }
            }
        }
    }

    // Default to 0.0 USD if no price found
    Ok((0.0, "USD".to_string()))
}

/// Extract images from Wix product
fn extract_images(raw: &Value) -> Vec<String> {
    let mut images = Vec::new();

    // Extract from media.mainMedia
    if let Some(media) = raw.get("media") {
        if let Some(main_media) = media.get("mainMedia") {
            if let Some(image) = main_media.get("image") {
                if let Some(url) = extract_string(image, "url") {
                    images.push(url);
                }
            }
        }

        // Extract from media.items
        if let Some(items) = media.get("items").and_then(|i| i.as_array()) {
            for item in items {
                if let Some(image) = item.get("image") {
                    if let Some(url) = extract_string(image, "url") {
                        if !images.contains(&url) {
                            images.push(url);
                        }
                    }
                }
            }
        }
    }

    images
}

/// Extract categories from Wix product
fn extract_categories(raw: &Value) -> Vec<String> {
    let mut categories = Vec::new();

    // Extract collection IDs as categories
    if let Some(collection_ids) = raw.get("collectionIds").and_then(|c| c.as_array()) {
        for id in collection_ids {
            if let Some(id_str) = id.as_str() {
                categories.push(id_str.to_string());
            }
        }
    }

    // Add product type if available
    if let Some(product_type) = extract_string(raw, "productType") {
        if !categories.contains(&product_type) {
            categories.push(product_type);
        }
    }

    categories
}

/// Build attributes JSON from Wix product data
fn build_attributes(raw: &Value) -> HashMap<String, String> {
    let mut attributes = HashMap::new();

    // Add brand
    if let Some(brand) = extract_string(raw, "brand") {
        attributes.insert("brand".to_string(), brand);
    }

    // Add product type
    if let Some(product_type) = extract_string(raw, "productType") {
        attributes.insert("product_type".to_string(), product_type);
    }

    // Add weight
    if let Some(weight) = extract_f64(raw, "weight") {
        attributes.insert("weight".to_string(), weight.to_string());
    }

    // Add product URL
    if let Some(page_url) = raw.get("productPageUrl") {
        if let Some(base) = extract_string(page_url, "base") {
            if let Some(path) = extract_string(page_url, "path") {
                attributes.insert("product_url".to_string(), format!("{}{}", base, path));
            }
        }
    }

    // Add slug
    if let Some(slug) = extract_string(raw, "slug") {
        attributes.insert("slug".to_string(), slug);
    }

    // Add numeric ID
    if let Some(numeric_id) = extract_string(raw, "numericId") {
        attributes.insert("numeric_id".to_string(), numeric_id);
    }

    // Add inventory item ID
    if let Some(inventory_id) = extract_string(raw, "inventoryItemId") {
        attributes.insert("inventory_item_id".to_string(), inventory_id);
    }

    // Add ribbon text if present
    if let Some(ribbon) = extract_string(raw, "ribbon") {
        attributes.insert("ribbon".to_string(), ribbon);
    }

    // Add ribbons array if present
    if let Some(ribbons) = raw.get("ribbons").and_then(|r| r.as_array()) {
        let ribbon_texts: Vec<String> = ribbons
            .iter()
            .filter_map(|r| extract_string(r, "text"))
            .collect();
        if !ribbon_texts.is_empty() {
            attributes.insert("ribbons".to_string(), ribbon_texts.join(", "));
        }
    }

    // Add discount information
    if let Some(discount) = raw.get("discount") {
        if let Some(discount_type) = extract_string(discount, "type") {
            attributes.insert("discount_type".to_string(), discount_type);
        }
        if let Some(value) = extract_f64(discount, "value") {
            attributes.insert("discount_value".to_string(), value.to_string());
        }
    }

    // Add stock tracking information
    if let Some(stock) = raw.get("stock") {
        if let Some(track_quantity) = extract_bool(stock, "trackQuantity") {
            attributes.insert("track_quantity".to_string(), track_quantity.to_string());
        }
        if let Some(in_stock) = extract_bool(stock, "inStock") {
            attributes.insert("in_stock".to_string(), in_stock.to_string());
        }
    }

    // Add manage variants flag
    if let Some(manage_variants) = extract_bool(raw, "manageVariants") {
        attributes.insert("manage_variants".to_string(), manage_variants.to_string());
    }

    // Add custom text fields
    if let Some(custom_fields) = raw.get("customTextFields").and_then(|c| c.as_array()) {
        let fields: Vec<Value> = custom_fields
            .iter()
            .map(|field| {
                let mut field_obj = json!({});
                if let Some(title) = extract_string(field, "title") {
                    field_obj["title"] = json!(title);
                }
                if let Some(max_length) = extract_i32(field, "maxLength") {
                    field_obj["max_length"] = json!(max_length);
                }
                if let Some(mandatory) = extract_bool(field, "mandatory") {
                    field_obj["mandatory"] = json!(mandatory);
                }
                field_obj
            })
            .collect();
        if !fields.is_empty() {
            attributes.insert(
                "custom_text_fields".to_string(),
                serde_json::to_string(&fields).unwrap_or_default(),
            );
        }
    }

    // Add additional info sections
    if let Some(info_sections) = raw.get("additionalInfoSections").and_then(|a| a.as_array()) {
        let sections: Vec<Value> = info_sections
            .iter()
            .map(|section| {
                let mut section_obj = json!({});
                if let Some(title) = extract_string(section, "title") {
                    section_obj["title"] = json!(title);
                }
                if let Some(description) = extract_string(section, "description") {
                    section_obj["description"] = json!(description);
                }
                section_obj
            })
            .collect();
        if !sections.is_empty() {
            attributes.insert(
                "additional_info".to_string(),
                serde_json::to_string(&sections).unwrap_or_default(),
            );
        }
    }

    // Add product options
    if let Some(options) = raw.get("productOptions").and_then(|o| o.as_array()) {
        let product_options: Vec<Value> = options
            .iter()
            .map(|option| {
                let mut option_obj = json!({});
                if let Some(name) = extract_string(option, "name") {
                    option_obj["name"] = json!(name);
                }
                if let Some(option_type) = extract_string(option, "optionType") {
                    option_obj["type"] = json!(option_type);
                }
                if let Some(choices) = option.get("choices").and_then(|c| c.as_array()) {
                    let choice_values: Vec<String> = choices
                        .iter()
                        .filter_map(|c| extract_string(c, "value"))
                        .collect();
                    if !choice_values.is_empty() {
                        option_obj["choices"] = json!(choice_values);
                    }
                }
                option_obj
            })
            .collect();
        if !product_options.is_empty() {
            attributes.insert(
                "product_options".to_string(),
                serde_json::to_string(&product_options).unwrap_or_default(),
            );
        }
    }

    // Add variant count if variants exist
    if let Some(variants) = raw.get("variants").and_then(|v| v.as_array()) {
        attributes.insert("variant_count".to_string(), variants.len().to_string());
    }

    // Add cost and profit data if available
    if let Some(cost_data) = raw.get("costAndProfitData") {
        if let Some(item_cost) = extract_f64(cost_data, "itemCost") {
            attributes.insert("item_cost".to_string(), item_cost.to_string());
        }
        if let Some(profit) = extract_f64(cost_data, "profit") {
            attributes.insert("profit".to_string(), profit.to_string());
        }
        if let Some(profit_margin) = extract_f64(cost_data, "profitMargin") {
            attributes.insert("profit_margin".to_string(), profit_margin.to_string());
        }
    }

    // Add price per unit data if available
    if let Some(price_per_unit) = raw.get("pricePerUnitData") {
        if let Some(total_quantity) = extract_f64(price_per_unit, "totalQuantity") {
            attributes.insert("total_quantity".to_string(), total_quantity.to_string());
        }
        if let Some(unit) = extract_string(price_per_unit, "totalMeasurementUnit") {
            attributes.insert("measurement_unit".to_string(), unit);
        }
    }

    attributes
}

/// Extract datetime from string field
fn extract_datetime(raw: &Value, field: &str) -> Option<DateTime<Utc>> {
    extract_string(raw, field)
        .and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
        .map(|dt| dt.with_timezone(&Utc))
}
