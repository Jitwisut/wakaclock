//! # Unified Product Repository - ระบบจัดการสินค้าแบบรวมศูนย์
//!
//! โมดูลนี้จัดการข้อมูลสินค้าแบบ unified จากทุก platform ใน ClickHouse
//! รองรับการ deduplication และ batch operations สำหรับ performance
//!
//! ## คุณสมบัติหลัก:
//! - Unified product data model สำหรับทุก platform
//! - Product deduplication และ data normalization
//! - Cross-platform product matching และ linking
//! - Batch operations สำหรับ high-throughput data processing
//! - Real-time product synchronization tracking
//!
//! ## Product Unification:
//! - **Data Normalization**: แปลงข้อมูลจากทุก platform เป็นรูปแบบเดียวกัน
//! - **Deduplication**: ตรวจหาและรวม products ที่ซ้ำกัน
//! - **Cross-Platform Linking**: เชื่อมโยงสินค้าเดียวกันจากหลาย platform
//! - **Metadata Harmonization**: รวม metadata จากทุกแหล่ง
//!
//! ## Performance Features:
//! - Columnar storage สำหรับ analytics
//! - Batch insertions สำหรับ bulk operations
//! - Indexed searches สำหรับ fast lookups
//! - Materialized views สำหรับ aggregated data

use anyhow::Result;
use chrono::Utc;
use clickhouse::Client;
use serde_json::json;
use std::sync::Arc;
use tracing::{debug, error, info};

use crate::model::v1::platfrom::entries::product::Product;

/// Repository for unified product operations with deduplication
/// จัดการสินค้าแบบรวมศูนย์จากทุก platform พร้อม deduplication
/// ใช้ ReplacingMergeTree engine ของ ClickHouse สำหรับ auto-dedup
pub struct UnifiedProductRepository {
    client: Arc<Client>, // ClickHouse client connection
    database: String,    // Database name สำหรับเก็บข้อมูล
}

impl UnifiedProductRepository {
    /// สร้าง repository instance ใหม่
    /// รับ ClickHouse client และชื่อ database
    pub fn new(client: Arc<Client>, database: String) -> Self {
        Self { client, database }
    }

    /// ตรวจสอบว่าสินค้ามีอยู่ในระบบหรือไม่
    /// ใช้ platform, shop_id, และ product_id เป็น unique key
    /// Return true ถ้าพบสินค้า, false ถ้าไม่พบ
    pub async fn product_exists(
        &self,
        platform: &str,
        platform_shop_id: &str,
        platform_product_id: &str,
    ) -> Result<bool> {
        let query = format!(
            "SELECT count(*) as cnt FROM {}.products
             WHERE platform = ? AND platform_shop_id = ? AND product_id = ?
             LIMIT 1",
            self.database
        );

        let result = self
            .client
            .query(&query)
            .bind(platform)
            .bind(platform_shop_id)
            .bind(platform_product_id)
            .fetch_one::<u64>()
            .await?;

        Ok(result > 0)
    }

    /// Upsert (insert หรือ update) สินค้าพร้อม deduplication
    /// ตรวจสอบว่ามีสินค้าอยู่แล้วหรือไม่ ถ้ามีจะ update ถ้าไม่มีจะ insert
    /// ใช้ ReplacingMergeTree สำหรับจัดการ duplicate rows อัตโนมัติ
    pub async fn upsert_unified_product(&self, product: &Product) -> Result<()> {
        // Check if product exists
        let exists = self
            .product_exists(
                &product.platform.to_string(),
                &product.platform_shop_id,
                &product.platform_product_id,
            )
            .await?;

        if exists {
            info!(
                "Product already exists, updating: {} from {} shop {}",
                product.platform_product_id, product.platform, product.platform_shop_id
            );
            self.update_unified_product(product).await?;
        } else {
            info!(
                "Inserting new product: {} from {} shop {}",
                product.platform_product_id, product.platform, product.platform_shop_id
            );
            self.insert_unified_product(product).await?;
        }

        Ok(())
    }

    /// Insert สินค้าใหม่ลงใน database
    /// แปลงข้อมูลจาก Product struct เป็น format ที่ ClickHouse ต้องการ
    /// จัดเก็บ images, categories, attributes เป็น JSON strings
    async fn insert_unified_product(&self, product: &Product) -> Result<()> {
        let query = format!(
            "INSERT INTO {}.products (
                product_id, shop_id, platform_shop_id, platform,
                title, description, price, currency, sku,
                quantity, images, categories, attributes,
                status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            self.database
        );

        // Prepare data for insertion
        let title = product.title.clone();
        let description = product.description.clone().unwrap_or_default();
        let price = product.price.amount.to_string();
        let currency = product.currency.clone();
        let sku = product.sku.clone();
        let quantity = product.quantity;
        let images = json!(product.images);
        let categories = json!(product.categories);

        // Build comprehensive attributes including all platform-specific data
        let attributes = json!(product.attributes);
        let status = product.status.to_string();

        self.client
            .query(&query)
            .bind(&product.platform_product_id)
            .bind(&product.shop_id)
            .bind(&product.platform_shop_id)
            .bind(product.platform.to_string())
            .bind(&title)
            .bind(&description)
            .bind(price)
            .bind(&currency)
            .bind(&sku)
            .bind(quantity)
            .bind(images.to_string())
            .bind(categories.to_string())
            .bind(json!(attributes).to_string())
            .bind(&status)
            .bind(product.created_at.timestamp())
            .bind(product.updated_at.timestamp())
            .execute()
            .await?;

        Ok(())
    }

    /// Update สินค้าที่มีอยู่แล้วใน database
    /// ClickHouse ใช้วิธี insert row ใหม่พร้อม timestamp ที่อัพเดท
    /// ReplacingMergeTree engine จะจัดการ deduplication ให้อัตโนมัติ
    async fn update_unified_product(&self, product: &Product) -> Result<()> {
        // For ClickHouse, we insert a new row with updated timestamp
        // The ReplacingMergeTree engine will handle deduplication
        let query = format!(
            "INSERT INTO {}.products (
                product_id, shop_id, platform_shop_id, platform,
                title, description, price, currency, sku,
                quantity, images, categories, attributes,
                status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            self.database
        );

        // Prepare updated data
        let title = product.title.clone();
        let description = product.description.clone().unwrap_or_default();
        let price = product.price.amount.to_string();
        let currency = product.currency.clone();
        let sku = product.sku.clone();
        let quantity = product.quantity;
        let images = json!(product.images);
        let categories = json!(product.categories);

        let attributes = json!(product.attributes);
        let status = product.status.to_string();
        let now = Utc::now();

        self.client
            .query(&query)
            .bind(&product.platform_product_id)
            .bind(&product.shop_id)
            .bind(&product.platform_shop_id)
            .bind(product.platform.to_string())
            .bind(&title)
            .bind(&description)
            .bind(price)
            .bind(&currency)
            .bind(&sku)
            .bind(quantity)
            .bind(images.to_string())
            .bind(categories.to_string())
            .bind(json!(attributes).to_string())
            .bind(&status)
            .bind(product.created_at.timestamp())
            .bind(now.timestamp()) // Update timestamp
            .execute()
            .await?;

        Ok(())
    }

    /// Batch upsert สินค้าหลายรายการพร้อมกัน
    /// ประมวลผลทีละรายการพร้อม error handling แยกแต่ละรายการ
    /// Return จำนวนสินค้าที่ประมวลผลสำเร็จ
    pub async fn batch_upsert_products(&self, products: Vec<Product>) -> Result<usize> {
        let mut success_count = 0;
        let mut error_count = 0;

        for product in products {
            match self.upsert_unified_product(&product).await {
                Ok(_) => {
                    success_count += 1;
                    debug!(
                        "Successfully upserted product: {}",
                        product.platform_product_id
                    );
                }
                Err(e) => {
                    error_count += 1;
                    error!(
                        "Failed to upsert product {}: {}",
                        product.platform_product_id, e
                    );
                }
            }
        }

        if error_count > 0 {
            info!(
                "Batch upsert completed: {} succeeded, {} failed",
                success_count, error_count
            );
        } else {
            info!(
                "Batch upsert completed: {} products processed",
                success_count
            );
        }

        Ok(success_count)
    }

    /// ดึงข้อมูลสินค้าตาม platform identifiers
    /// ค้นหาด้วย platform, shop_id, และ product_id
    /// Return JSON string ของสินค้าล่าสุด (order by updated_at DESC)
    pub async fn get_product(
        &self,
        platform: &str,
        platform_shop_id: &str,
        platform_product_id: &str,
    ) -> Result<Option<String>> {
        let query = format!(
            "SELECT toJSONString(*) as json_data FROM {}.products
             WHERE platform = ? AND platform_shop_id = ? AND product_id = ?
             ORDER BY updated_at DESC
             LIMIT 1",
            self.database
        );

        #[derive(clickhouse::Row, serde::Deserialize)]
        struct JsonRow {
            json_data: String,
        }

        let result = self
            .client
            .query(&query)
            .bind(platform)
            .bind(platform_shop_id)
            .bind(platform_product_id)
            .fetch_optional::<JsonRow>()
            .await?;

        Ok(result.map(|row| row.json_data))
    }

    /// ลบสินค้าเก่าที่ไม่ได้อัพเดทเกินจำนวนวันที่กำหนด
    /// ใช้สำหรับ cleanup ข้อมูลเก่าเพื่อประหยัดพื้นที่
    /// Return จำนวนสินค้าที่ถูกลบ (ประมาณการ)
    pub async fn cleanup_old_products(&self, days: i64) -> Result<u64> {
        let cutoff_timestamp = Utc::now().timestamp() - (days * 86400);

        let query = format!(
            "ALTER TABLE {}.products DELETE WHERE updated_at < ?",
            self.database
        );

        self.client
            .query(&query)
            .bind(cutoff_timestamp)
            .execute()
            .await?;

        // Get count of deleted rows (approximate)
        let count_query = format!(
            "SELECT count(*) FROM {}.products WHERE updated_at < ?",
            self.database
        );

        let deleted_count = self
            .client
            .query(&count_query)
            .bind(cutoff_timestamp)
            .fetch_one::<u64>()
            .await
            .unwrap_or(0);

        info!("Cleaned up approximately {} old products", deleted_count);
        Ok(deleted_count)
    }
}
