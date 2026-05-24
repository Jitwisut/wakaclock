//! # Product Repository - ระบบจัดการข้อมูลสินค้า
//!
//! โมดูลนี้จัดการการเข้าถึงข้อมูลสินค้าใน ClickHouse database
//! รองรับ batch insert, search, และ analytics queries สำหรับข้อมูลสินค้าจากทุก platform
//!
//! ## คุณสมบัติหลัก:
//! - High-performance product data storage
//! - Batch insert operations สำหรับ bulk data
//! - Complex analytics queries สำหรับ business insights
//! - Distributed table architecture สำหรับ scalability
//! - Real-time product search และ filtering
//!
//! ## Product Data Management:
//! - **Multi-Platform Support**: TikTok, Shopee, Lazada, Amazon, etc.
//! - **Product Catalogs**: รวมข้อมูลสินค้าจากทุก platform
//! - **Inventory Tracking**: ติดตามสต็อกและ availability
//! - **Price Analytics**: วิเคราะห์ราคาและ pricing trends
//! - **Performance Metrics**: ติดตาม product performance
//!
//! ## Database Features:
//! - Columnar storage สำหรับ analytical workloads
//! - Distributed tables สำหรับ horizontal scaling
//! - Materialized views สำหรับ pre-computed aggregations
//! - Compression และ partitioning สำหรับ efficiency

use anyhow::Result;
use clickhouse::Client;
use std::sync::Arc;
use tracing::info;

use crate::model::v1::platfrom::entries::{PlatformId, ProductRow};

/// โครงสร้างสำหรับสถิติของแต่ละ platform
/// ใช้สำหรับ analytics และ reporting
#[derive(Debug, serde::Serialize, serde::Deserialize, clickhouse::Row)]
pub struct PlatformStats {
    pub platform: u8,         // Platform ID
    pub product_count: u64,   // จำนวนสินค้าทั้งหมด
    pub avg_price: f64,       // ราคาเฉลี่ย
    pub total_inventory: u64, // จำนวน stock รวม
    pub in_stock_count: u64,  // จำนวนสินค้าที่มี stock
}

/// Repository สำหรับจัดการข้อมูลสินค้า
/// ใช้ distributed table (_dist) สำหรับ performance
pub struct ProductRepository {
    client: Arc<Client>, // ClickHouse client
    database: String,    // Database name
}

impl ProductRepository {
    /// สร้าง repository instance ใหม่
    pub fn new(client: Arc<Client>, database: String) -> Self {
        Self { client, database }
    }

    /// Insert สินค้าแบบ batch ด้วย streaming
    /// ใช้ streaming insert สำหรับ performance ที่ดีกว่า
    /// IMPORTANT: ต้องเรียก end() เพื่อ commit การ insert
    pub async fn insert_products<I>(&self, products: I) -> Result<usize>
    where
        I: IntoIterator<Item = ProductRow>,
    {
        let table = format!("{}.product_dist", self.database);
        let mut insert = self.client.insert::<ProductRow>(&table)?;
        let mut count = 0usize;

        for product in products {
            insert.write(&product).await?;
            count += 1;
        }

        // IMPORTANT: Must call end() to commit the insert
        insert.end().await?;

        info!("Inserted {} products to ClickHouse", count);
        Ok(count)
    }

    /// Insert สินค้าเดี่ยว
    /// Wrapper สำหรับ insert_products
    pub async fn insert_product(&self, product: ProductRow) -> Result<()> {
        self.insert_products(vec![product]).await?;
        Ok(())
    }

    /// Query สินค้าตาม platform
    /// รองรับ pagination ด้วย limit และ offset
    /// เรียงตามเวลาสร้างล่าสุดก่อน
    pub async fn get_products_by_platform(
        &self,
        platform: PlatformId,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<ProductRow>> {
        let query = format!(
            "SELECT * FROM {}.product_dist
             WHERE platform = ?
             ORDER BY created_time DESC
             LIMIT ? OFFSET ?",
            self.database
        );

        let rows = self
            .client
            .query(&query)
            .bind(platform)
            .bind(limit)
            .bind(offset)
            .fetch_all::<ProductRow>()
            .await?;

        Ok(rows)
    }

    /// Query products by shop
    pub async fn get_products_by_shop(
        &self,
        platform_shop_id: &str,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<ProductRow>> {
        let query = format!(
            "SELECT * FROM {}.product_dist
             WHERE platform_shop_id = ?
             ORDER BY created_time DESC
             LIMIT ? OFFSET ?",
            self.database
        );

        let rows = self
            .client
            .query(&query)
            .bind(platform_shop_id)
            .bind(limit)
            .bind(offset)
            .fetch_all::<ProductRow>()
            .await?;

        Ok(rows)
    }

    /// Get product by ID
    pub async fn get_product_by_id(&self, product_id: &str) -> Result<Option<ProductRow>> {
        let query = format!(
            "SELECT * FROM {}.product_dist WHERE product_id = ? LIMIT 1",
            self.database
        );

        let row = self
            .client
            .query(&query)
            .bind(product_id)
            .fetch_one::<ProductRow>()
            .await;

        match row {
            Ok(product) => Ok(Some(product)),
            Err(e) if e.to_string().contains("not found") => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Search products by title (supports multilingual JSON search)
    pub async fn search_products_by_title(
        &self,
        search_term: &str,
        limit: usize,
    ) -> Result<Vec<ProductRow>> {
        // Use JSONExtractString for searching within JSON fields
        let query = format!(
            "SELECT * FROM {}.product_dist
             WHERE JSONExtractString(title, 'en') ILIKE ?
                OR JSONExtractString(title, 'th') ILIKE ?
                OR JSONExtractString(title, 'zh') ILIKE ?
             ORDER BY created_time DESC
             LIMIT ?",
            self.database
        );

        let search_pattern = format!("%{}%", search_term);

        let rows = self
            .client
            .query(&query)
            .bind(&search_pattern)
            .bind(&search_pattern)
            .bind(&search_pattern)
            .bind(limit)
            .fetch_all::<ProductRow>()
            .await?;

        Ok(rows)
    }

    /// Get product statistics by platform
    pub async fn get_platform_statistics(&self) -> Result<Vec<PlatformStats>> {
        let query = format!(
            "SELECT
                platform,
                count() as product_count,
                avg(price) as avg_price,
                sum(inventory) as total_inventory,
                countIf(availability = 1) as in_stock_count
             FROM {}.product_dist
             GROUP BY platform
             ORDER BY product_count DESC",
            self.database
        );

        let rows = self
            .client
            .query(&query)
            .fetch_all::<PlatformStats>()
            .await?;

        Ok(rows)
    }
}
