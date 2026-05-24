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

pub struct TaobaoMapper;

impl PlatformProductMapper for TaobaoMapper {
    fn name(&self) -> &str {
        "taobao"
    }

    fn map_product(&self, raw: &Value, shop_id: &str) -> Result<Product> {
        let product_id = raw
            .get("num_iid")
            .or_else(|| raw.get("item_id"))
            .and_then(|v| {
                if let Some(num) = v.as_i64() {
                    Some(num.to_string())
                } else {
                    v.as_str().map(|s| s.to_string())
                }
            })
            .unwrap_or_default();

        let title = raw
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let description = raw
            .get("desc")
            .or_else(|| raw.get("description"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let price = raw
            .get("price")
            .and_then(|v| {
                if let Some(s) = v.as_str() {
                    s.parse::<f64>().ok()
                } else {
                    v.as_f64()
                }
            })
            .unwrap_or(0.0);

        let quantity = raw
            .get("num")
            .or_else(|| raw.get("quantity"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0) as i16;

        let sku = raw
            .get("outer_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let images = if let Some(pic_url) = raw.get("pic_url").and_then(|v| v.as_str()) {
            let mut imgs = vec![pic_url.to_string()];
            if let Some(item_imgs) = raw
                .get("item_imgs")
                .and_then(|v| v.get("item_img"))
                .and_then(|v| v.as_array())
            {
                imgs.extend(item_imgs.iter().filter_map(|img| {
                    img.get("url")
                        .and_then(|u| u.as_str())
                        .map(|s| s.to_string())
                }));
            }
            imgs
        } else {
            vec![]
        };

        let brand = raw
            .get("props_name")
            .and_then(|v| v.as_str())
            .and_then(|props| {
                props
                    .split(';')
                    .find(|p| p.contains("品牌"))
                    .map(|s| s.split(':').next_back().unwrap_or("").to_string())
            });

        let categories = if let Some(cid) = raw.get("cid") {
            vec![format!("category_{}", cid)]
        } else {
            vec![]
        };

        let status = raw
            .get("approve_status")
            .and_then(|v| v.as_str())
            .map(|s| match s {
                "onsale" => ProductStatus::Active,
                "instock" => ProductStatus::Inactive,
                "delete" => ProductStatus::Deleted,
                _ => ProductStatus::Inactive,
            })
            .unwrap_or(ProductStatus::Active);

        let mut attributes = HashMap::new();
        if let Some(props) = raw.get("props") {
            attributes.insert("props".to_string(), props.to_string());
        }
        if let Some(seller_cids) = raw.get("seller_cids") {
            attributes.insert("seller_cids".to_string(), seller_cids.to_string());
        }
        if let Some(has_discount) = raw.get("has_discount") {
            attributes.insert("has_discount".to_string(), has_discount.to_string());
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
            platform: PlatformType::Taobao,
            title,
            brand: brand.unwrap_or_default(),
            description,
            price: Price {
                amount: Decimal::from_f64_retain(price).unwrap_or_default(),
                original_price: None,
                discount_percentage: None,
                currency: "CNY".to_string(),
            },
            currency: "CNY".to_string(),
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
}

impl TaobaoMapper {
    fn map_products(&self, raw: &Value, shop_id: &str) -> Result<Vec<Product>> {
        if let Some(items) = raw
            .get("items")
            .and_then(|i| i.get("item"))
            .and_then(|v| v.as_array())
        {
            return items.iter().map(|p| self.map_product(p, shop_id)).collect();
        }

        if let Some(product_array) = raw.as_array() {
            return product_array
                .iter()
                .map(|p| self.map_product(p, shop_id))
                .collect();
        }

        Ok(vec![self.map_product(raw, shop_id)?])
    }
}
