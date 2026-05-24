//! # ClickHouse Repository - ระบบจัดการข้อมูลใน ClickHouse
//!
//! โมดูลนี้จัดการการเข้าถึงข้อมูลใน ClickHouse database สำหรับ analytics และข้อมูลสินค้า
//! รองรับ batch operations และ high-throughput queries
//!
//! ## คุณสมบัติหลัก:
//! - Columnar storage สำหรับ analytical workloads
//! - High-performance batch insertions
//! - Time-series data management
//! - Product catalog และ sync job tracking
//! - Real-time analytics และ reporting
//!
//! ## Database Tables:
//! - **products**: ข้อมูลสินค้าจากทุก platform
//! - **sync_jobs**: ติดตาม product sync operations
//! - **platform_connections**: การเชื่อมต่อกับ platforms
//! - **audit_logs**: ข้อมูล audit และ monitoring
//!
//! ## Performance Features:
//! - Connection pooling สำหรับ concurrent queries
//! - Batch insertions สำหรับ bulk data operations
//! - Parallel query execution
//! - Optimized for analytical queries

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use clickhouse::Client;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use tracing::{info, warn};

use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::{Platform, PlatformType, Product, ProductStatus};
use crate::{client::database::ClickHouseClient, repository::ProductRepository};

/// Lightweight record for persisting chat transcript rows.
#[derive(Debug, Clone)]
pub struct ChatMessageRecord {
    pub conversation_id: String,
    pub message_id: String,
    pub tenant_id: String,
    pub shop_id: String,
    pub platform: String,
    pub role: String,
    pub content: String,
    pub model: Option<String>,
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// ClickHouse Repository - Data access layer สำหรับ ClickHouse
/// ใช้สำหรับเก็บข้อมูล analytics, product data, และ time-series data
pub struct ClickHouseRepository {
    client: Arc<ClickHouseClient>, // ClickHouse client connection pool
}

impl ClickHouseRepository {
    /// สร้าง repository instance ใหม่
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    fn http_endpoint(&self) -> String {
        let base = self.client.endpoint().trim_end_matches('/');
        format!("{}/", base)
    }

    /// Execute a raw query on the database
    /// รัน query โดยตรงบน ClickHouse (สำหรับ DDL และ operations ที่ไม่ต้องการ result)
    pub async fn execute_query(&self, query: &str) -> AppResult<()> {
        self.client
            .query(query)
            .execute()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Query execution failed: {}", e)))
    }

    /// Execute a query and return rows as HashMaps
    /// รัน query และ return ผลลัพธ์เป็น HashMap สำหรับ dynamic queries
    ///
    /// Note: This is a legacy method kept for compatibility. Consider using strongly-typed queries.
    /// หมายเหตุ: เป็น legacy method ที่เก็บไว้สำหรับ compatibility แนะนำให้ใช้ typed queries แทน
    pub async fn query(
        &self,
        query: &str,
        params: Vec<String>,
    ) -> AppResult<Vec<std::collections::HashMap<String, String>>> {
        // Build query with parameters
        // สร้าง query โดยแทน parameters ใน placeholders (?)
        let mut final_query = query.to_string();

        // Simple parameter replacement (in production, use proper parameterized queries)
        // แทนที่ parameters แบบง่ายๆ (ใน production ควรใช้ parameterized queries ที่ปลอดภัยกว่า)
        for param in params.iter() {
            if let Some(pos) = final_query.find('?') {
                // Check if this parameter is likely a numeric value (for LIMIT, OFFSET)
                // by checking if the query contains LIMIT or OFFSET near this position
                // ตรวจสอบว่า parameter นี้เป็นตัวเลขสำหรับ LIMIT/OFFSET หรือไม่
                let before_pos = pos.saturating_sub(20);
                let after_pos = if pos + 20 < final_query.len() {
                    pos + 20
                } else {
                    final_query.len()
                };
                let context = &final_query[before_pos..after_pos];

                // If this is for LIMIT or OFFSET, don't quote the value
                // ถ้าเป็น LIMIT หรือ OFFSET ไม่ต้องใส่ quotes
                if context.contains("LIMIT") || context.contains("OFFSET") {
                    // Check if the param is numeric
                    if param.parse::<i64>().is_ok() {
                        final_query.replace_range(pos..pos + 1, param);
                    } else {
                        final_query.replace_range(pos..pos + 1, &format!("'{}'", param));
                    }
                } else {
                    final_query.replace_range(pos..pos + 1, &format!("'{}'", param));
                }
            }
        }

        tracing::info!("Executing ClickHouse query: {}", final_query);

        // Use the HTTP interface to execute raw queries and get results
        let endpoint = self.http_endpoint();
        let client = reqwest::Client::new();
        let response = client
            .post(&endpoint)
            .basic_auth("default", Some("default"))
            .header("Content-Type", "text/plain; charset=utf-8")
            .body(format!("{} FORMAT JSONEachRow", final_query))
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to execute query: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::DatabaseError(format!(
                "Query failed: {}",
                error_text
            )));
        }

        let response_text = response
            .text()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to read response: {}", e)))?;

        // Parse JSON lines into HashMaps
        let mut results = Vec::new();
        for line in response_text.lines() {
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(obj) = json.as_object() {
                    let mut row = std::collections::HashMap::new();
                    for (key, value) in obj {
                        let value_str = match value {
                            serde_json::Value::String(s) => s.clone(),
                            serde_json::Value::Number(n) => n.to_string(),
                            serde_json::Value::Bool(b) => b.to_string(),
                            serde_json::Value::Array(a) => {
                                serde_json::to_string(a).unwrap_or_default()
                            }
                            serde_json::Value::Object(o) => {
                                serde_json::to_string(o).unwrap_or_default()
                            }
                            serde_json::Value::Null => String::new(),
                        };
                        row.insert(key.clone(), value_str);
                    }
                    results.push(row);
                }
            }
        }

        tracing::info!("Query returned {} rows", results.len());
        Ok(results)
    }

    /// Execute a query without returning results
    pub async fn execute_query_with_params(
        &self,
        query: &str,
        params: Vec<String>,
    ) -> AppResult<()> {
        // Build query with parameters
        let mut final_query = query.to_string();

        // Simple parameter replacement
        for param in params.iter() {
            if let Some(pos) = final_query.find('?') {
                final_query.replace_range(pos..pos + 1, &format!("'{}'", param));
            }
        }

        tracing::debug!("Executing ClickHouse command: {}", final_query);

        // Execute the query
        self.client
            .query(&final_query)
            .execute()
            .await
            .map_err(|e| AppError::DatabaseError(format!("ClickHouse execute failed: {}", e)))?;

        Ok(())
    }

    /// Persist chat transcript entries into the analytics store so that
    /// downstream tooling (dashboards, analytics) can replay conversations.
    pub async fn insert_chat_messages(&self, records: &[ChatMessageRecord]) -> AppResult<()> {
        if records.is_empty() {
            return Ok(());
        }

        #[derive(Serialize, clickhouse::Row)]
        struct ChatMessageInsert {
            conversation_id: String,
            message_id: String,
            tenant_id: String,
            shop_id: String,
            platform: String,
            role: String,
            content: String,
            model: String,
            metadata: String,
            created_at: DateTime<Utc>,
        }

        let mut insert = self.client.insert::<ChatMessageInsert>("chat_messages");

        for record in records {
            let metadata = serde_json::to_string(&record.metadata).map_err(|e| {
                AppError::SerializationError(format!("Failed to encode metadata: {}", e))
            })?;
            let row = ChatMessageInsert {
                conversation_id: record.conversation_id.clone(),
                message_id: record.message_id.clone(),
                tenant_id: record.tenant_id.clone(),
                shop_id: record.shop_id.clone(),
                platform: record.platform.clone(),
                role: record.role.clone(),
                content: record.content.clone(),
                model: record.model.clone().unwrap_or_default(),
                metadata,
                created_at: record.created_at,
            };

            insert = insert.write(&row);
        }

        insert.end().await.map_err(|e| {
            AppError::DatabaseError(format!("Failed to finalize chat insert: {}", e))
        })?;

        Ok(())
    }

    async fn list_products_from_snapshot(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        page: u32,
        limit: u32,
    ) -> AppResult<Vec<Product>> {
        #[derive(Deserialize, clickhouse::Row)]
        struct ProductSnapshotRow {
            platform: String,
            shop_id: String,
            platform_product_id: String,
            unified_product_id: String,
            title: String,
            description: Option<String>,
            brand: Option<String>,
            price: Option<f64>,
            currency: Option<String>,
            original_price: Option<f64>,
            discount_percentage: Option<f64>,
            total_quantity: Option<i64>,
            available_quantity: Option<i64>,
            image_urls: Vec<String>,
            main_image_url: Option<String>,
            platform_attributes: String,
            platform_categories: Vec<String>,
            status: String,
            first_synced_at: DateTime<Utc>,
            last_synced_at: DateTime<Utc>,
            platform_created_at: Option<DateTime<Utc>>,
            platform_updated_at: Option<DateTime<Utc>>,
        }

        let page = page.max(1);
        let limit = limit.max(1);
        let offset = (page - 1) * limit;

        let query = r#"
            SELECT
                platform,
                shop_id,
                platform_product_id,
                unified_product_id,
                title,
                description,
                brand,
                price,
                currency,
                original_price,
                discount_percentage,
                total_quantity,
                available_quantity,
                image_urls,
                main_image_url,
                platform_attributes,
                platform_categories,
                status,
                first_synced_at,
                last_synced_at,
                platform_created_at,
                platform_updated_at
            FROM products_snapshot
            WHERE tenant_id = ?
              AND platform = ?
              AND shop_id = ?
            ORDER BY last_synced_at DESC
            LIMIT ? OFFSET ?
        "#;

        let mut cursor = self
            .client
            .query(query)
            .bind(tenant_id)
            .bind(platform)
            .bind(shop_id)
            .bind(limit)
            .bind(offset)
            .fetch::<ProductSnapshotRow>()
            .map_err(|e| {
                AppError::DatabaseError(format!(
                    "Failed to fetch products from snapshot table: {}",
                    e
                ))
            })?;

        let mut products = Vec::new();

        while let Some(row) = cursor
            .next()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to get snapshot row: {}", e)))?
        {
            let platform_type =
                PlatformType::from_str(&row.platform).unwrap_or(PlatformType::Custom);

            let mut image_urls = row.image_urls;
            if image_urls.is_empty() {
                if let Some(main_image) = row.main_image_url.clone() {
                    if !main_image.is_empty() {
                        image_urls.push(main_image);
                    }
                }
            }

            let images = image_urls
                .into_iter()
                .enumerate()
                .map(
                    |(idx, url)| crate::model::v1::platfrom::entries::ProductImage {
                        url,
                        alt: None,
                        is_primary: idx == 0,
                        position: idx as i32,
                    },
                )
                .collect();

            let attributes = parse_snapshot_attributes(&row.platform_attributes);
            let currency = row.currency.clone().unwrap_or_else(|| "USD".to_string());
            let amount = row
                .price
                .and_then(rust_decimal::Decimal::from_f64_retain)
                .unwrap_or_default();
            let original_price = row
                .original_price
                .and_then(rust_decimal::Decimal::from_f64_retain);
            let discount_percentage = row
                .discount_percentage
                .and_then(rust_decimal::Decimal::from_f64_retain);

            let quantity_source = row
                .available_quantity
                .or(row.total_quantity)
                .unwrap_or(0)
                .clamp(i16::MIN as i64, i16::MAX as i64) as i16;

            products.push(Product {
                product_id: row.platform_product_id.clone(),
                shop_id: row.shop_id.clone(),
                platform_shop_id: row.shop_id.clone(),
                platform: platform_type,
                platform_product_id: row.platform_product_id.clone(),
                sku: String::new(),
                title: row.title.clone(),
                brand: row.brand.unwrap_or_default(),
                description: row.description.clone(),
                price: crate::model::v1::platfrom::entries::Price {
                    amount,
                    currency: currency.clone(),
                    original_price,
                    discount_percentage,
                },
                quantity: quantity_source,
                images,
                currency,
                attributes,
                categories: row.platform_categories.clone(),
                status: map_snapshot_status(&row.status),
                created_at: row.platform_created_at.unwrap_or(row.first_synced_at),
                updated_at: row.platform_updated_at.unwrap_or(row.last_synced_at),
                synced_at: Some(row.last_synced_at),
            });
        }

        Ok(products)
    }

    async fn check_product_exists(
        &self,
        tenant_id: &str,
        platform_id: u8,
        shop_id: &str,
        product_id: &str,
    ) -> AppResult<bool> {
        info!(
            "Checking if product exists: org_id={}, platform_id={}, shop_id={}, product_id={}",
            tenant_id, platform_id, shop_id, product_id
        );

        #[derive(Deserialize, clickhouse::Row)]
        struct ExistsRow {
            count: u64,
        }

        // Note: The product table doesn't have tenant_id column
        // Products are identified by platform, shop, and product ID
        let query = r#"
            SELECT count(*) as count
            FROM product
            WHERE platform = ?
                AND platform_shop_id = ?
                AND platform_product_id = ?
            LIMIT 1
        "#;

        let mut cursor = self
            .client
            .query(query)
            .bind(platform_id)
            .bind(shop_id)
            .bind(product_id)
            .fetch::<ExistsRow>()
            .map_err(|e| {
                AppError::DatabaseError(format!("Failed to fetch existence check: {}", e))
            })?;

        if let Some(row) = cursor
            .next()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to get next row: {}", e)))?
        {
            let exists = row.count > 0;
            info!(
                "Product existence check result: product_id={}, exists={}",
                product_id, exists
            );
            Ok(exists)
        } else {
            info!("Product does not exist: product_id={}", product_id);
            Ok(false)
        }
    }
}

#[async_trait]
impl ProductRepository for ClickHouseRepository {
    async fn get_product(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        product_id: &str,
    ) -> AppResult<Product> {
        #[derive(Deserialize, clickhouse::Row)]
        struct ProductRow {
            platform_shop_id: String,
            platform_product_id: String,
            product_id: String,
            title: String,
            description: Option<String>,
            price: f64,
            currency: String,
            sku: Option<String>,
            quantity: i32,
            images: Vec<String>,
            categories: Vec<String>,
            attributes: String,
            status: String,
            created_at: DateTime<Utc>,
            updated_at: DateTime<Utc>,
        }

        let platform_id = Platform::from_str(platform)
            .map_err(|e| AppError::BadRequest(format!("Invalid platform: {}", e)))?
            .to_id();

        tracing::info!(
            "Fetching product: tenant_id={}, platform={}, shop_id={}, product_id={}",
            tenant_id,
            platform,
            shop_id,
            product_id
        );

        let query = r#"
                SELECT
                    platform, platform_shop_id, platform_product_id, product_id, tenant_id, platform_id,
                    title, description, price, currency, sku, inventory as quantity,
                    images, category as categories, custom_fields as attributes,
                    availability as status, created_time as created_at, last_updated as updated_at
                FROM product
                WHERE platform = ? AND platform_shop_id = ? AND platform_product_id = ? AND tenant_id = ?
                LIMIT 1
            "#;

        let mut cursor = self
            .client
            .query(query)
            .bind(platform_id)
            .bind(shop_id)
            .bind(product_id)
            .bind(tenant_id)
            .fetch::<ProductRow>()
            .map_err(|e| AppError::DatabaseError(format!("Failed to fetch product: {}", e)))?;

        let row = cursor
            .next()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to get product row: {}", e)))?
            .ok_or_else(|| AppError::NotFound(format!("Product not found: {}", product_id)))?;

        tracing::debug!("Found product: {}", row.product_id);

        let status = match row.status.as_str() {
            "in_stock" => ProductStatus::Active,
            "inactive" => ProductStatus::Inactive,
            "out_of_stock" => ProductStatus::OutOfStock,
            _ => ProductStatus::Inactive,
        };

        let platform_enum = PlatformType::from_str(platform)
            .map_err(|e| AppError::BadRequest(format!("Invalid platform: {}", e)))?;

        // Convert Vec<String> to Vec<ProductImage>
        let product_images = row
            .images
            .iter()
            .map(|url| crate::model::v1::platfrom::entries::ProductImage {
                url: url.clone(),
                alt: None,
                position: 0,
                is_primary: true,
            })
            .collect();

        // Create a Price object from the price value
        let price = crate::model::v1::platfrom::entries::Price {
            amount: rust_decimal::Decimal::from_f64_retain(row.price).unwrap_or_default(),
            currency: row.currency.clone(),
            original_price: Some(
                rust_decimal::Decimal::from_f64_retain(row.price).unwrap_or_default(),
            ),
            discount_percentage: None,
        };

        // Parse attributes from JSON string
        let attributes: std::collections::HashMap<String, String> =
            serde_json::from_str(&row.attributes).unwrap_or_default();

        Ok(Product {
            product_id: row.product_id,
            shop_id: shop_id.to_string(),
            platform_shop_id: row.platform_shop_id.clone(),
            platform: platform_enum,
            platform_product_id: row.platform_product_id,
            title: row.title,
            brand: "".to_string(),
            description: row.description,
            price,
            currency: row.currency,
            sku: row.sku.unwrap_or_default(),
            quantity: row.quantity as i16,
            images: product_images,
            categories: row.categories,
            attributes,
            status,
            created_at: row.created_at,
            updated_at: row.updated_at,
            synced_at: Some(row.updated_at), // Use updated_at as synced_at for now
        })
    }

    async fn list_products(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        page: u32,
        limit: u32,
    ) -> AppResult<Vec<Product>> {
        let offset = (page - 1) * limit;
        let normalized_platform = platform.trim().to_lowercase();

        #[derive(Deserialize, clickhouse::Row)]
        struct ProductRow {
            platform: u8,
            platform_shop_id: String,
            platform_product_id: String,
            product_id: String,
            title: String,
            description: String,
            price: f64,
            inventory: u32,
            images: Vec<String>,
            category: Vec<String>,
            custom_fields: String,
            availability: u8,
            created_time: DateTime<Utc>,
            last_updated: DateTime<Utc>,
        }

        let platform_id = Platform::from_str(&normalized_platform)
            .map_err(|e| AppError::BadRequest(format!("Invalid platform: {}", e)))?
            .to_id();

        let query = r#"
            SELECT
                platform, platform_shop_id, platform_product_id, product_id,
                tenant_id, title, description, price, inventory, images, category,
                custom_fields, availability, created_time, last_updated
            FROM product
            WHERE platform = ? AND platform_shop_id = ? AND tenant_id = ?
            ORDER BY last_updated DESC
            LIMIT ? OFFSET ?
        "#;

        let mut cursor = self
            .client
            .query(query)
            .bind(platform_id)
            .bind(shop_id)
            .bind(tenant_id)
            .bind(limit)
            .bind(offset)
            .fetch::<ProductRow>()
            .map_err(|e| AppError::DatabaseError(format!("Failed to fetch product: {}", e)))?;

        let mut products = Vec::new();
        while let Some(row) = cursor
            .next()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to get next product: {}", e)))?
        {
            // Map availability enum to ProductStatus
            let status = match row.availability {
                1 => ProductStatus::Active,     // in_stock
                2 => ProductStatus::OutOfStock, // out_of_stock
                3 => ProductStatus::Active,     // preorder (treat as active)
                _ => ProductStatus::Inactive,
            };

            let platform_enum = match Platform::from_id(row.platform) {
                Some(Platform::TikTok) => PlatformType::TikTok,
                Some(Platform::Shopee) => PlatformType::Shopee,
                Some(Platform::Lazada) => PlatformType::Lazada,
                Some(Platform::Shopify) => PlatformType::Shopify,
                Some(Platform::WooCommerce) => PlatformType::WooCommerce,
                Some(Platform::BigCommerce) => PlatformType::BigCommerce,
                Some(Platform::Wix) => PlatformType::Wix,
                Some(Platform::Ecwid) => PlatformType::Ecwid,
                Some(Platform::Magento) => PlatformType::Magento,
                Some(Platform::Medusa) => PlatformType::Medusa,
                Some(Platform::Zoho) => PlatformType::Zoho,
                Some(Platform::LineShop) => PlatformType::LineShop,
                Some(Platform::Taobao) => PlatformType::Taobao,
                Some(Platform::JD) => PlatformType::JD,
                Some(Platform::Walmart) => PlatformType::Walmart,
                Some(Platform::Rakuten) => PlatformType::Rakuten,
                Some(Platform::Alibaba) => PlatformType::Alibaba,
                Some(Platform::AliExpress) => PlatformType::AliExpress,
                Some(Platform::Amazon) => PlatformType::Amazon,
                Some(Platform::EBay) => PlatformType::Ebay,
                Some(Platform::Etsy) => PlatformType::Etsy,
                Some(Platform::Custom) => PlatformType::Custom,
                // Temu is not in Platform enum yet, using default
                None => {
                    return Err(AppError::NotFound(format!(
                        "Invalid platform ID: {}",
                        row.platform
                    )))
                }
            };

            // Parse JSON fields
            let title_json: serde_json::Value =
                serde_json::from_str(&row.title).unwrap_or_else(|_| {
                    // If it's not JSON, treat it as a plain string
                    serde_json::json!({"en": row.title.clone()})
                });
            let title = title_json
                .get("en")
                .and_then(|v| v.as_str())
                .unwrap_or(&row.title)
                .to_string();

            let description_json: serde_json::Value = serde_json::from_str(&row.description)
                .unwrap_or_else(|_| serde_json::json!({"en": row.description.clone()}));
            let description = description_json
                .get("en")
                .and_then(|v| v.as_str())
                .map(String::from);

            let attributes: HashMap<String, String> = serde_json::from_str(&row.custom_fields)
                .unwrap_or_else(|_| {
                    tracing::warn!(
                        "Failed to parse custom_fields for product {}, using empty map",
                        row.product_id
                    );
                    HashMap::new()
                });

            products.push(Product {
                product_id: row.platform_product_id.clone(),
                shop_id: row.platform_shop_id.to_string(),
                platform_shop_id: row.platform_shop_id.clone(),
                platform: platform_enum,
                platform_product_id: row.platform_product_id.clone(),
                title,
                brand: "".to_string(),
                description,
                price: crate::model::v1::platfrom::entries::Price {
                    amount: rust_decimal::Decimal::from_f64_retain(row.price).unwrap_or_default(),
                    currency: "USD".to_string(),
                    original_price: None,
                    discount_percentage: None,
                },
                currency: "USD".to_string(), // Default currency, should be stored in custom_fields
                sku: "".to_string(),         // SKU is not in the main table anymore
                quantity: row.inventory as i16,
                images: row
                    .images
                    .into_iter()
                    .enumerate()
                    .map(
                        |(idx, url)| crate::model::v1::platfrom::entries::ProductImage {
                            url,
                            alt: None,
                            is_primary: idx == 0,
                            position: idx as i32,
                        },
                    )
                    .collect(),
                categories: row.category,
                attributes,
                status,
                created_at: row.created_time,
                updated_at: row.last_updated,
                synced_at: Some(row.last_updated), // Use last_updated as synced_at
            });
        }

        Ok(products)
    }

    async fn count_products(
        &self,
        _tenant_id: &str,
        platform: &str,
        shop_id: &str,
    ) -> AppResult<usize> {
        let platform_id = Platform::from_str(platform)
            .map_err(|e| AppError::BadRequest(format!("Invalid platform: {}", e)))?
            .to_id();

        let query = r#"
            SELECT count(*) as total
            FROM product
            WHERE platform = ?
                AND platform_shop_id = ?
        "#;

        #[derive(Deserialize, clickhouse::Row)]
        struct CountRow {
            total: u64,
        }

        let mut cursor = self
            .client
            .query(query)
            .bind(platform_id)
            .bind(shop_id)
            .fetch::<CountRow>();

        let row = cursor
            .next()
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch count: {}", e);
                AppError::DatabaseError(format!("Failed to fetch count: {}", e))
            })?
            .ok_or_else(|| AppError::DatabaseError("No count result returned".to_string()))?;

        Ok(row.total as usize)
    }

    async fn save_products_batch(&self, tenant_id: &str, products: &[Product]) -> AppResult<()> {
        if products.is_empty() {
            return Ok(());
        }

        let mut insert = self.client.insert::<ProductInsert>("product");

        for product in products {
            let platform_id = Platform::from_str(&product.platform.to_string()).map_err(|_| {
                AppError::SerializationError(format!("Invalid platform: {}", product.platform))
            })? as u8;

            let _status = match product.status {
                ProductStatus::Active => 1,
                ProductStatus::Inactive => 2,
                ProductStatus::OutOfStock => 3,
                ProductStatus::Deleted => 4,
                ProductStatus::Draft => 5,
                ProductStatus::Archived => 6,
            };

            let product_insert = ProductInsert {
                tenant_id: tenant_id.to_string(),
                platform_id,
                shop_id: product.shop_id.clone(),
                product_id: product.product_id.clone(),
                title: product.title.clone(),
                brand: Some(product.brand.clone()),
                description: product.description.clone(),
                price: product.price.amount.to_f64().unwrap_or(0.0),
                currency: product.currency.clone(),
                sku: Some(product.sku.clone()),
                quantity: product.quantity as i32,
                images: product.images.iter().map(|img| img.url.clone()).collect(),
                categories: product.categories.clone(),
                attributes: serde_json::to_string(&product.attributes).unwrap_or_default(),
                status: match product.status {
                    ProductStatus::Active => "active".to_string(),
                    ProductStatus::Inactive => "inactive".to_string(),
                    ProductStatus::OutOfStock => "out_of_stock".to_string(),
                    ProductStatus::Deleted => "deleted".to_string(),
                    ProductStatus::Draft => "draft".to_string(),
                    ProductStatus::Archived => "archived".to_string(),
                },
                created_at: product.created_at,
                updated_at: product.updated_at,
            };

            insert = insert.write(&product_insert);
        }

        insert
            .end()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to end insert: {}", e)))?;

        info!(
            "Batch saved {} products for organization {}",
            products.len(),
            tenant_id
        );
        Ok(())
    }

    async fn save_product(&self, tenant_id: &str, product: &Product) -> AppResult<()> {
        info!(
            "Saving product to ClickHouse: {} - {}",
            product.product_id, product.title
        );

        let platform_id = Platform::from_str(&product.platform.to_string())
            .map_err(|_| {
                AppError::ValidationError(format!("Invalid platform: {}", product.platform))
            })?
            .to_id();

        let exists = self
            .check_product_exists(
                tenant_id,
                platform_id,
                &product.shop_id,
                &product.product_id,
            )
            .await?;

        if exists {
            info!("Product already exists, updating: {}", product.product_id);
            return self.update_product(tenant_id, product).await;
        }

        info!("Product does not exist, inserting new product...");

        let _status = match product.status {
            ProductStatus::Active => "active",
            ProductStatus::Inactive => "inactive",
            ProductStatus::OutOfStock => "out_of_stock",
            ProductStatus::Deleted => "deleted",
            ProductStatus::Draft => "draft",
            ProductStatus::Archived => "archived",
        };

        info!(
            "Inserting product with data: org_id={}, platform_id={}, shop_id={}, product_id={}",
            tenant_id, platform_id, product.shop_id, product.product_id
        );

        // Use the ClickHouse client library for insertion
        // Use the UnifiedProductInsert struct that's already defined
        let _insert_row = UnifiedProductInsert {
            product_id: product.product_id.clone(),
            platform: platform_id,
            platform_shop_id: product.shop_id.clone(),
            platform_product_id: product.product_id.clone(),
            title: serde_json::json!({"en": product.title.clone()}).to_string(),
            description: serde_json::json!({"en": product.description.clone().unwrap_or_default()})
                .to_string(),
            brand_name: serde_json::json!({"en": ""}).to_string(),
            variant_attributes: "{}".to_string(),
            operator_name: "".to_string(),
            platform_ids: serde_json::json!({
                "platform": product.platform.clone(),
                "product_id": product.product_id.clone(),
                "shop_id": product.shop_id.clone()
            })
            .to_string(),
            custom_fields: serde_json::to_string(&product.attributes).unwrap_or_default(),
            category: product.categories.clone(),
            tags: vec![],
            images: product.images.iter().map(|img| img.url.clone()).collect(),
            shipping_countries: vec![],
            availability: if product.quantity > 0 {
                "in_stock".to_string()
            } else {
                "out_of_stock".to_string()
            },
            shipping_free: false,
            price: format!("{:.2}", product.price.amount),
            shipping_price: "0.00".to_string(),
            inventory: product.quantity as u32,
            rating_avg: 0.0,
            reviews_count: 0,
            gtin: "".to_string(),
            mpn: "".to_string(),
            upc: "".to_string(),
            ean: "".to_string(),
            last_updated: product.updated_at.timestamp() as u32,
            created_time: product.created_at.timestamp() as u32,
        };

        // Use the client library's insert method
        let mut insert = self.client.insert::<UnifiedProductInsert>("product");

        insert = insert.write(&_insert_row);

        insert
            .end()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to end insert: {}", e)))?;

        info!(
            "Product successfully inserted into ClickHouse: {}",
            product.product_id
        );
        Ok(())
    }

    async fn update_product(&self, tenant_id: &str, product: &Product) -> AppResult<()> {
        info!(
            "Updating product in ClickHouse: {} - {}",
            product.product_id, product.title
        );

        let platform_id = Platform::from_str(&product.platform.to_string())
            .map_err(|_| {
                AppError::ValidationError(format!("Invalid platform: {}", product.platform))
            })?
            .to_id();

        let _status = match product.status {
            ProductStatus::Active => "active",
            ProductStatus::Inactive => "inactive",
            ProductStatus::OutOfStock => "out_of_stock",
            ProductStatus::Deleted => "deleted",
            ProductStatus::Draft => "draft",
            ProductStatus::Archived => "archived",
        };

        // Note: The product table doesn't have tenant_id column
        // Also table name is 'product' not 'products'
        // ClickHouse doesn't support UPDATE, so we'll use ALTER TABLE UPDATE
        let query = r#"
            ALTER TABLE product
            UPDATE
                title = ?,
                description = ?,
                price = ?,
                inventory = ?,
                images = ?,
                category = ?,
                custom_fields = ?,
                last_updated = ?
            WHERE platform = ?
                AND platform_shop_id = ?
                AND platform_product_id = ?
                AND tenant_id = ?
        "#;

        // Convert to JSON format for multilingual support
        let title_json = serde_json::json!({"en": product.title.clone()}).to_string();
        let description_json =
            serde_json::json!({"en": product.description.clone().unwrap_or_default()}).to_string();

        self.client
            .query(query)
            .bind(&title_json)
            .bind(&description_json)
            .bind(product.price.clone())
            .bind(product.quantity as u32)
            .bind(&product.images)
            .bind(&product.categories)
            .bind(&serde_json::to_string(&product.attributes).unwrap_or_default())
            .bind(Utc::now())
            .bind(platform_id)
            .bind(&product.shop_id)
            .bind(&product.product_id)
            .bind(tenant_id)
            .execute()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to execute query: {}", e)))?;

        info!(
            "Product successfully updated in ClickHouse: {}",
            product.product_id
        );
        Ok(())
    }

    async fn delete_product(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        product_id: &str,
    ) -> AppResult<()> {
        let platform_id = Platform::from_str(platform)
            .map_err(|e| AppError::BadRequest(format!("Invalid platform: {}", e)))?
            .to_id();

        let query = r#"
            ALTER TABLE product
            DELETE WHERE platform = ? AND platform_shop_id = ? AND platform_product_id = ? AND
            tenant_id = ?
        "#;

        self.client
            .query(query)
            .bind(platform_id)
            .bind(shop_id)
            .bind(product_id)
            .bind(tenant_id)
            .execute()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to execute query: {}", e)))?;

        Ok(())
    }

    async fn check_duplicate(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        product_id: &str,
    ) -> AppResult<bool> {
        let platform_id = Platform::from_str(platform)
            .map_err(|e| AppError::BadRequest(format!("Invalid platform: {}", e)))?
            .to_id();

        self.check_product_exists(tenant_id, platform_id, shop_id, product_id)
            .await
    }
}

impl ClickHouseRepository {
    /// Save product to product_sync staging table
    pub async fn save_product_to_sync(
        &self,
        tenant_id: &str,
        shop_id: &str,
        product: &Product,
        sync_batch_id: &str,
    ) -> AppResult<()> {
        use uuid::Uuid;

        info!(
            "Saving product to product_sync staging table: {} - {}",
            product.product_id, product.title
        );

        let platform_id = Platform::from_str(&product.platform.to_string())
            .map_err(|_| {
                AppError::ValidationError(format!("Invalid platform: {}", product.platform))
            })?
            .to_id();

        // Generate sync_id
        let sync_id = Uuid::new_v4().to_string();

        // Convert product to JSON for product_data field
        let product_data = serde_json::json!({
            "product_id": product.product_id,
            "title": product.title,
            "description": product.description,
            "price": product.price,
            "quantity": product.quantity,
            "sku": product.sku,
            "images": product.images,
            "categories": product.categories,
            "attributes": product.attributes,
            "status": match product.status {
                ProductStatus::Active => "active",
                ProductStatus::Inactive => "inactive",
                ProductStatus::Draft => "draft",
                ProductStatus::Archived => "archived",
                ProductStatus::OutOfStock => "out_of_stock",
                ProductStatus::Deleted => "deleted",
            },
            "created_at": product.created_at,
            "updated_at": product.updated_at,
        })
        .to_string();

        // Sync metadata
        let sync_metadata = serde_json::json!({
            "source": "product_consumer",
            "api_version": "v1",
            "sync_type": "incremental"
        })
        .to_string();

        // Insert into product_sync table
        let query = r#"
            INSERT INTO product_sync (
                sync_id,
                sync_batch_id,
                tenant_id,
                shop_id,
                platform_product_id,
                platform,
                product_data,
                user_action,
                sync_metadata,
                synced_at,
                expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        self.client
            .query(query)
            .bind(&sync_id)
            .bind(sync_batch_id)
            .bind(tenant_id)
            .bind(shop_id)
            .bind(&product.product_id)
            .bind(platform_id)
            .bind(&product_data)
            .bind("pending") // Default to pending for user review
            .bind(&sync_metadata)
            .bind(Utc::now().timestamp()) // Use Unix timestamp for ClickHouse DateTime
            .bind((Utc::now() + chrono::Duration::days(7)).timestamp()) // Use Unix timestamp
            .execute()
            .await
            .map_err(|e| {
                AppError::DatabaseError(format!("Failed to insert into product_sync: {}", e))
            })?;

        info!(
            "Product successfully saved to product_sync staging table: sync_id={}, product_id={}",
            sync_id, product.product_id
        );

        // Also try to insert into product_sync_dist for distributed setup
        let dist_query = r#"
            INSERT INTO product_sync_dist (
                sync_id,
                sync_batch_id,
                tenant_id,
                shop_id,
                platform_product_id,
                platform,
                product_data,
                user_action,
                sync_metadata,
                synced_at,
                expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        // Try distributed table but don't fail if it doesn't exist
        let _ = self
            .client
            .query(dist_query)
            .bind(&sync_id)
            .bind(sync_batch_id)
            .bind(tenant_id)
            .bind(shop_id)
            .bind(&product.product_id)
            .bind(platform_id)
            .bind(&product_data)
            .bind("pending")
            .bind(&sync_metadata)
            .bind(Utc::now().timestamp()) // Use Unix timestamp for ClickHouse DateTime
            .bind((Utc::now() + chrono::Duration::days(7)).timestamp()) // Use Unix timestamp
            .execute()
            .await;

        Ok(())
    }

    /// Save product to product table with cityHash sharding
    pub async fn save_unified_product(&self, _tenant_id: &str, product: &Product) -> AppResult<()> {
        info!(
            "Saving product to product table: {} - {}",
            product.product_id, product.title
        );

        let platform_id = Platform::from_str(&product.platform.to_string())
            .map_err(|_| {
                AppError::ValidationError(format!("Invalid platform: {}", product.platform))
            })?
            .to_id();

        info!("Product does not exist in product table, inserting new product...");

        // Map status to unified format
        let status = match product.status {
            ProductStatus::Active => "active",
            ProductStatus::Inactive => "inactive",
            ProductStatus::OutOfStock => "out_of_stock",
            ProductStatus::Deleted => "deleted",
            ProductStatus::Draft => "draft",
            ProductStatus::Archived => "archived",
        };

        print!("{}", status);
        // Extract additional attributes from product
        let mut variant_attributes = serde_json::json!({});

        let mut brand_name: Option<String> = None;

        // Parse attributes JSON to extract specific fields
        // Attributes is HashMap<String, String>, not serde_json::Value
        {
            if let Some(regions_str) = product.attributes.get("sales_regions") {
                // Try to parse as JSON array if it's a JSON string
                if let Ok(regions) = serde_json::from_str::<Vec<String>>(regions_str) {
                    let _sales_regions = regions;
                }
            }

            if let Some(id) = product.attributes.get("brand_id") {
                let _brand_id = Some(id.clone());
            }

            if let Some(name) = product.attributes.get("brand_name") {
                brand_name = Some(name.clone());
            }

            if let Some(dims) = product.attributes.get("package_dimensions") {
                let _package_dimensions = Some(dims.clone());
            }

            if let Some(weight) = product.attributes.get("package_weight") {
                let _package_weight = Some(weight.clone());
            }

            if let Some(prod_attrs) = product.attributes.get("product_attributes") {
                let _product_attributes = prod_attrs.clone();
            }

            if let Some(skus) = product.attributes.get("skus") {
                variant_attributes = serde_json::Value::String(skus.clone());
            }
        }

        // Prepare insert data - use platform_shop_id if available, otherwise fallback to shop_id
        let platform_shop_id = if product.platform_shop_id.is_empty() {
            product.shop_id.clone()
        } else {
            product.platform_shop_id.clone()
        };

        let unified_insert = UnifiedProductInsert {
            product_id: product.product_id.clone(),
            platform: platform_id,
            platform_shop_id,
            platform_product_id: product.product_id.clone(),
            // Store title and description as JSON for multilingual support
            title: serde_json::json!({"en": product.title.clone()}).to_string(),
            description: serde_json::json!({"en": product.description.clone().unwrap_or_default()})
                .to_string(),
            brand_name: serde_json::json!({"en": brand_name.unwrap_or_default()}).to_string(),
            variant_attributes: if variant_attributes.is_object()
                && !variant_attributes.as_object().unwrap().is_empty()
            {
                serde_json::to_string(&variant_attributes).unwrap_or_default()
            } else {
                "{}".to_string()
            },
            operator_name: "".to_string(),
            platform_ids: serde_json::json!({
                "platform": product.platform.clone(),
                "product_id": product.product_id.clone(),
                "shop_id": product.shop_id.clone()
            })
            .to_string(),
            custom_fields: serde_json::to_string(&product.attributes).unwrap_or_default(),
            category: product.categories.clone(),
            tags: vec![],
            images: product.images.iter().map(|img| img.url.clone()).collect(),
            shipping_countries: vec![],
            availability: if product.quantity > 0 {
                "in_stock".to_string()
            } else {
                "out_of_stock".to_string()
            },
            shipping_free: false,
            price: format!("{:.2}", product.price.amount),
            shipping_price: "0.00".to_string(),
            inventory: product.quantity as u32,
            rating_avg: 0.0,
            reviews_count: 0,
            gtin: "".to_string(),
            mpn: "".to_string(),
            upc: "".to_string(),
            ean: "".to_string(),
            last_updated: Utc::now().timestamp() as u32,
            created_time: product.created_at.timestamp() as u32,
        };

        // Use the ClickHouse client library for insertion
        let mut insert = self.client.insert::<UnifiedProductInsert>("product");

        insert = insert.write(&unified_insert);

        insert
            .end()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to end insert: {}", e)))?;

        info!(
            "Product successfully inserted into product table: {}",
            product.product_id
        );
        Ok(())
    }

    /// Create a new sync job
    pub async fn create_sync_job(
        &self,
        job_id: &str,
        platform: &str,
        shop_id: &str,
        tenant_id: &str,
        user_id: &str,
        options: &str,
    ) -> AppResult<()> {
        let query = format!(
            r#"
            INSERT INTO sync_jobs (
                job_id, platform, shop_id, tenant_id, user_id,
                status, total_synced, total_failed, total_duplicates,
                error_message, options, created_at, updated_at
            ) VALUES (
                '{}', '{}', '{}', '{}', '{}',
                'pending', 0, 0, 0,
                '', '{}', now(), now()
            )
            "#,
            job_id, platform, shop_id, tenant_id, user_id, options
        );

        self.execute_query(&query).await?;
        Ok(())
    }

    /// Update sync job status
    pub async fn update_sync_job_status(
        &self,
        job_id: &str,
        status: &str,
        total_synced: u32,
        total_failed: u32,
        total_duplicates: u32,
        error_message: Option<&str>,
    ) -> AppResult<()> {
        let error_msg = error_message.unwrap_or("");
        let completed_at = if status == "completed" || status == "failed" {
            "now()"
        } else {
            "NULL"
        };

        let query = format!(
            r#"
            ALTER TABLE sync_jobs
            UPDATE
                status = '{}',
                total_synced = {},
                total_failed = {},
                total_duplicates = {},
                error_message = '{}',
                updated_at = now(),
                completed_at = {}
            WHERE job_id = '{}'
            "#,
            status, total_synced, total_failed, total_duplicates, error_msg, completed_at, job_id
        );

        self.execute_query(&query).await?;
        Ok(())
    }

    /// Log sync job progress
    #[allow(clippy::too_many_arguments)]
    pub async fn log_sync_job_progress(
        &self,
        job_id: &str,
        products_processed: u32,
        products_synced: u32,
        products_failed: u32,
        products_duplicate: u32,
        current_batch: u32,
        total_batches: u32,
        message: &str,
    ) -> AppResult<()> {
        let query = format!(
            r#"
            INSERT INTO sync_job_progress (
                job_id, timestamp, products_processed, products_synced,
                products_failed, products_duplicate, current_batch,
                total_batches, message, error_count, last_error
            ) VALUES (
                '{}', now(), {}, {}, {}, {}, {}, {}, '{}', 0, ''
            )
            "#,
            job_id,
            products_processed,
            products_synced,
            products_failed,
            products_duplicate,
            current_batch,
            total_batches,
            message
        );

        self.execute_query(&query).await?;
        Ok(())
    }

    /// Get sync job status
    pub async fn get_sync_job_status(&self, job_id: &str) -> AppResult<Option<serde_json::Value>> {
        let query = format!(
            r#"
            SELECT
                job_id,
                platform,
                shop_id,
                tenant_id,
                status,
                total_synced,
                total_failed,
                total_duplicates,
                error_message,
                created_at,
                updated_at,
                completed_at
            FROM sync_jobs
            WHERE job_id = '{}'
            LIMIT 1
            FORMAT JSONEachRow
            "#,
            job_id
        );

        // Use the HTTP interface to execute raw queries and get results
        let endpoint = self.http_endpoint();
        let client = reqwest::Client::new();
        let response = client
            .post(&endpoint)
            .basic_auth("default", Some("default"))
            .header("Content-Type", "text/plain; charset=utf-8")
            .body(query)
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to execute query: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::DatabaseError(format!(
                "Query failed: {}",
                error_text
            )));
        }

        let response_text = response
            .text()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to read response: {}", e)))?;

        // Parse JSON lines
        for line in response_text.lines() {
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                return Ok(Some(json));
            }
        }

        Ok(None)
    }

    /// Get latest sync job progress
    pub async fn get_sync_job_latest_progress(
        &self,
        job_id: &str,
    ) -> AppResult<Option<serde_json::Value>> {
        let query = format!(
            r#"
            SELECT
                job_id,
                timestamp,
                products_processed,
                products_synced,
                products_failed,
                products_duplicate,
                current_batch,
                total_batches,
                message
            FROM sync_job_progress
            WHERE job_id = '{}'
            ORDER BY timestamp DESC
            LIMIT 1
            FORMAT JSONEachRow
            "#,
            job_id
        );

        // Use the HTTP interface to execute raw queries and get results
        let endpoint = self.http_endpoint();
        let client = reqwest::Client::new();
        let response = client
            .post(&endpoint)
            .basic_auth("default", Some("default"))
            .header("Content-Type", "text/plain; charset=utf-8")
            .body(query)
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to execute query: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::DatabaseError(format!(
                "Query failed: {}",
                error_text
            )));
        }

        let response_text = response
            .text()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to read response: {}", e)))?;

        // Parse JSON lines
        for line in response_text.lines() {
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                return Ok(Some(json));
            }
        }

        Ok(None)
    }

    /// List all sync jobs for an organization
    pub async fn list_sync_jobs(
        &self,
        tenant_id: &str,
        limit: u32,
        offset: u32,
    ) -> AppResult<Vec<serde_json::Value>> {
        let query = format!(
            r#"
            SELECT
                job_id,
                platform,
                shop_id,
                status,
                total_synced,
                total_failed,
                total_duplicates,
                created_at,
                updated_at,
                completed_at
            FROM sync_jobs
            WHERE tenant_id = '{}'
            ORDER BY created_at DESC
            LIMIT {} OFFSET {}
            FORMAT JSONEachRow
            "#,
            tenant_id, limit, offset
        );

        // Use the HTTP interface to execute raw queries and get results
        let endpoint = self.http_endpoint();
        let client = reqwest::Client::new();
        let response = client
            .post(&endpoint)
            .basic_auth("default", Some("default"))
            .header("Content-Type", "text/plain; charset=utf-8")
            .body(query)
            .send()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to execute query: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::DatabaseError(format!(
                "Query failed: {}",
                error_text
            )));
        }

        let response_text = response
            .text()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to read response: {}", e)))?;

        // Parse JSON lines into a Vec
        let mut results = Vec::new();
        for line in response_text.lines() {
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                results.push(json);
            }
        }

        Ok(results)
    }
}

fn parse_snapshot_attributes(raw: &str) -> HashMap<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed == "{}" {
        return HashMap::new();
    }

    match serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(trimmed) {
        Ok(map) => map
            .into_iter()
            .map(|(key, value)| (key, snapshot_attribute_value_to_string(value)))
            .collect(),
        Err(err) => {
            warn!(
                "Failed to parse platform_attributes JSON ({} bytes): {}",
                raw.len(),
                err
            );
            HashMap::new()
        }
    }
}

fn snapshot_attribute_value_to_string(value: serde_json::Value) -> String {
    match value {
        serde_json::Value::String(s) => s,
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Array(_) | serde_json::Value::Object(_) => value.to_string(),
        serde_json::Value::Null => String::new(),
    }
}

fn map_snapshot_status(status: &str) -> ProductStatus {
    match status.to_lowercase().as_str() {
        "active" | "published" | "approved" | "available" | "enabled" => ProductStatus::Active,
        "inactive" | "disabled" | "blocked" | "unpublished" => ProductStatus::Inactive,
        "draft" => ProductStatus::Draft,
        "archived" | "deleted" => ProductStatus::Archived,
        "out_of_stock" | "sold_out" | "stockout" => ProductStatus::OutOfStock,
        _ => ProductStatus::Active,
    }
}

#[derive(Serialize, clickhouse::Row)]
struct ProductInsert {
    tenant_id: String,
    platform_id: u8,
    shop_id: String,
    product_id: String,
    title: String,
    brand: Option<String>,
    description: Option<String>,
    price: f64,
    currency: String,
    sku: Option<String>,
    quantity: i32,
    images: Vec<String>,
    categories: Vec<String>,
    attributes: String,
    status: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Serialize, clickhouse::Row)]
struct UnifiedProductInsert {
    // Core identifiers - must match table column order exactly
    product_id: String,
    platform: u8,
    platform_shop_id: String,
    platform_product_id: String,
    // JSON fields for multilingual support
    title: String,
    description: String,
    brand_name: String,
    variant_attributes: String,
    operator_name: String,
    platform_ids: String,
    custom_fields: String,
    // Arrays and collections
    category: Vec<String>,
    tags: Vec<String>,
    images: Vec<String>,
    shipping_countries: Vec<String>,
    // Enums and flags - availability must be a valid enum value
    availability: String, // 'in_stock', 'out_of_stock', or 'preorder'
    shipping_free: bool,
    // Numeric fields - ClickHouse Decimal(18,2) needs string representation
    price: String,
    shipping_price: String,
    inventory: u32,
    rating_avg: f32,
    reviews_count: u32,
    // Product identifiers
    gtin: String,
    mpn: String,
    upc: String,
    ean: String,
    // Timestamps - ClickHouse expects u32 (Unix timestamp)
    last_updated: u32,
    created_time: u32,
}

pub struct AuditLogger {
    client: Arc<Client>,
}

impl AuditLogger {
    pub fn new(client: Arc<Client>) -> Self {
        Self { client }
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn log_action(
        &self,
        action: &str,
        actor: &str,
        platform: &str,
        shop_id: &str,
        resource_type: &str,
        resource_id: &str,
        metadata: serde_json::Value,
    ) -> AppResult<()> {
        use uuid::Uuid;

        #[derive(Serialize, clickhouse::Row)]
        struct AuditEntry {
            id: String,
            action: String,
            actor: String,
            platform: String,
            shop_id: String,
            resource_type: String,
            resource_id: String,
            metadata: String,
            ip_address: Option<String>,
            user_agent: Option<String>,
            timestamp: DateTime<Utc>,
        }

        let entry = AuditEntry {
            id: Uuid::new_v4().to_string(),
            action: action.to_string(),
            actor: actor.to_string(),
            platform: platform.to_string(),
            shop_id: shop_id.to_string(),
            resource_type: resource_type.to_string(),
            resource_id: resource_id.to_string(),
            metadata: metadata.to_string(),
            ip_address: None,
            user_agent: None,
            timestamp: Utc::now(),
        };

        let mut insert = self.client.insert::<AuditEntry>("audit_log").map_err(|e| {
            AppError::DatabaseError(format!("Failed to create audit insert: {}", e))
        })?;

        insert
            .write(&entry)
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to write audit entry: {}", e)))?;

        insert
            .end()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to end audit insert: {}", e)))?;
        Ok(())
    }
}
