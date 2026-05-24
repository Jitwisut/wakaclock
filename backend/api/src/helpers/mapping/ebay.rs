use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use serde_json::Value;
use uuid::Uuid;

use super::PlatformProductMapper;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};

pub struct EbayMapper;

impl PlatformProductMapper for EbayMapper {
    fn name(&self) -> &str {
        "ebay"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        // Extract item ID
        let product_id = raw
            .get("itemId")
            .or_else(|| raw.get("ItemID"))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        // Extract title
        let title = raw
            .get("title")
            .or_else(|| raw.get("Title"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Extract description
        let description = raw
            .get("description")
            .or_else(|| raw.get("Description"))
            .and_then(|v| v.as_str())
            .or_else(|| raw.get("shortDescription").and_then(|v| v.as_str()))
            .map(|s| s.to_string());

        // Extract price
        let price = if let Some(price_obj) = raw.get("price") {
            price_obj
                .get("value")
                .and_then(|v| {
                    if let Some(num) = v.as_f64() {
                        Some(num)
                    } else if let Some(s) = v.as_str() {
                        s.parse::<f64>().ok()
                    } else {
                        None
                    }
                })
                .unwrap_or(0.0)
        } else if let Some(current_price) = raw.get("currentPrice") {
            current_price
                .get("value")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0)
        } else {
            raw.get("sellingStatus")
                .and_then(|s| s.get("currentPrice"))
                .and_then(|p| p.get("value"))
                .and_then(|v| {
                    if let Some(num) = v.as_f64() {
                        Some(num)
                    } else if let Some(s) = v.as_str() {
                        s.parse::<f64>().ok()
                    } else {
                        None
                    }
                })
                .unwrap_or(0.0)
        };

        // Extract quantity
        let quantity = raw
            .get("quantityAvailable")
            .or_else(|| raw.get("Quantity"))
            .or_else(|| raw.get("availableQuantity").and_then(|a| a.get("value")))
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i16;

        // Extract SKU
        let sku = raw
            .get("sku")
            .or_else(|| raw.get("SKU"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract images
        let images = if let Some(image_obj) = raw.get("image") {
            if let Some(image_url) = image_obj.get("imageUrl").and_then(|v| v.as_str()) {
                vec![image_url.to_string()]
            } else if let Some(images_arr) = image_obj.as_array() {
                images_arr
                    .iter()
                    .filter_map(|img| {
                        img.get("imageUrl")
                            .and_then(|u| u.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect()
            } else {
                vec![]
            }
        } else if let Some(pic_details) = raw.get("PictureDetails") {
            if let Some(pic_urls) = pic_details.get("PictureURL") {
                if let Some(url_array) = pic_urls.as_array() {
                    url_array
                        .iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                } else if let Some(url) = pic_urls.as_str() {
                    vec![url.to_string()]
                } else {
                    vec![]
                }
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
            .get("brand")
            .and_then(|v| v.as_str())
            .or_else(|| {
                raw.get("itemSpecifics")
                    .and_then(|specs| specs.as_array())
                    .and_then(|arr| {
                        arr.iter()
                            .find(|spec| {
                                spec.get("name")
                                    .and_then(|n| n.as_str())
                                    .map(|s| s.eq_ignore_ascii_case("brand"))
                                    .unwrap_or(false)
                            })
                            .and_then(|spec| spec.get("value"))
                            .and_then(|v| v.as_str())
                    })
            })
            .map(|s| s.to_string());

        // Extract categories
        let categories = if let Some(cat_obj) = raw.get("categories") {
            if let Some(cat_arr) = cat_obj.as_array() {
                cat_arr
                    .iter()
                    .filter_map(|c| {
                        c.get("categoryName")
                            .and_then(|n| n.as_str())
                            .map(|s| s.to_string())
                    })
                    .collect()
            } else if let Some(primary) = cat_obj.get("primary") {
                vec![primary
                    .get("categoryName")
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_string()]
            } else {
                vec![]
            }
        } else if let Some(cat_name) = raw
            .get("primaryCategory")
            .and_then(|c| c.get("categoryName"))
            .and_then(|n| n.as_str())
        {
            vec![cat_name.to_string()]
        } else {
            vec![]
        };

        // Map listing status
        let status = if let Some(listing_status) = raw.get("listingStatus").and_then(|v| v.as_str())
        {
            match listing_status.to_uppercase().as_str() {
                "ACTIVE" => ProductStatus::Active,
                "ENDED" | "COMPLETED" => ProductStatus::Inactive,
                "OUT_OF_STOCK" => ProductStatus::OutOfStock,
                _ => ProductStatus::Inactive,
            }
        } else if let Some(status_str) = raw
            .get("sellingStatus")
            .and_then(|s| s.get("listingState"))
            .and_then(|v| v.as_str())
        {
            match status_str.to_uppercase().as_str() {
                "ACTIVE" => ProductStatus::Active,
                "ENDED" => ProductStatus::Inactive,
                _ => ProductStatus::Inactive,
            }
        } else {
            ProductStatus::Active
        };

        // Build attributes
        let mut attributes = serde_json::Map::new();

        // Add condition
        if let Some(condition) = raw.get("condition") {
            attributes.insert("condition".to_string(), condition.clone());
        }

        // Add listing type
        if let Some(listing_type) = raw.get("listingType") {
            attributes.insert("listing_type".to_string(), listing_type.clone());
        }

        // Add item specifics
        if let Some(specifics) = raw.get("itemSpecifics") {
            attributes.insert("item_specifics".to_string(), specifics.clone());
        }

        // Add shipping info
        if let Some(shipping) = raw.get("shippingInfo") {
            attributes.insert("shipping_info".to_string(), shipping.clone());
        }

        // Add location
        if let Some(location) = raw.get("itemLocation") {
            attributes.insert("item_location".to_string(), location.clone());
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
            platform: PlatformType::Ebay,
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
                .or_else(|| raw.get("priceCurrency"))
                .or_else(|| {
                    raw.get("sellingStatus")
                        .and_then(|s| s.get("currentPrice"))
                        .and_then(|p| p.get("currencyId"))
                })
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

impl EbayMapper {
    fn map_products(&self, raw: &Value, shop_id: &str) -> Result<Vec<Product>> {
        // Handle eBay API response
        if let Some(search_result) = raw.get("findItemsAdvancedResponse") {
            if let Some(search_res_arr) = search_result.get(0) {
                if let Some(item_arr) = search_res_arr.get("searchResult").and_then(|r| r.get(0)) {
                    if let Some(items) = item_arr.get("item").and_then(|v| v.as_array()) {
                        return items.iter().map(|p| self.map_product(p, shop_id)).collect();
                    }
                }
            }
        }

        // Try itemSummaries for Browse API
        if let Some(summaries) = raw.get("itemSummaries").and_then(|v| v.as_array()) {
            return summaries
                .iter()
                .map(|p| self.map_product(p, shop_id))
                .collect();
        }

        // Try Item array
        if let Some(items) = raw.get("Item").and_then(|v| v.as_array()) {
            return items.iter().map(|p| self.map_product(p, shop_id)).collect();
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
