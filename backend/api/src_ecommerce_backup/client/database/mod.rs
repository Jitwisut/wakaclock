/// โมดูล Database Clients - จัดการการเชื่อมต่อฐานข้อมูลทั้งหมด
///
/// โมดูลนี้รวมรวม client implementations สำหรับฐานข้อมูลต่างๆ ที่ใช้ในระบบ
/// โดยมี DatabasePool เป็นศูนย์กลางการจัดการ connection pooling
///
/// # ฐานข้อมูลที่รองรับ
/// - **ClickHouse**: Columnar database สำหรับ analytics และ product data
/// - **Qdrant**: Vector database สำหรับ semantic search และ AI operations
///
/// # คุณสมบัติ
/// - Connection pooling สำหรับประสิทธิภาพ
/// - Health check สำหรับทุก database connections
/// - Unified interface สำหรับการจัดการ
/// - Thread-safe ด้วย Arc wrapper
///
/// # ตัวอย่างการใช้งาน
/// ```rust
/// use client::database::DatabasePool;
///
/// let pool = DatabasePool::new(&config).await?;
/// let clickhouse_client = &pool.clickhouse;
/// let qdrant_client = &pool.qdrant;
/// ```
use anyhow::Result;
use std::sync::Arc;

use crate::config::{Config, DatabaseConfig};

pub mod clickhouse;
pub mod qdrant;

pub use clickhouse::ClickHouseClient;
pub use qdrant::QdrantClient;

/// Database connection pool สำหรับจัดการการเชื่อมต่อฐานข้อมูลทั้งหมด
///
/// Struct นี้เป็นศูนย์กลางการจัดการ connection pooling สำหรับฐานข้อมูล
/// ต่างๆ ที่ใช้ในระบบ โดยแต่ละ client จะถูก wrap ด้วย Arc เพื่อ thread safety
pub struct DatabasePool {
    /// ClickHouse client สำหรับ analytics database
    pub clickhouse: Arc<ClickHouseClient>,
    /// Qdrant client สำหรับ vector database
    pub qdrant: Arc<QdrantClient>,
}

impl DatabasePool {
    /// สร้าง database connection pool ใหม่
    ///
    /// # Parameters
    /// - `config`: การตั้งค่าฐานข้อมูลสำหรับการเชื่อมต่อ
    ///
    /// # Returns
    /// `DatabasePool` instance ที่พร้อมใช้งาน
    ///
    /// # Errors
    /// ส่งคืน error หากไม่สามารถเชื่อมต่อกับฐานข้อมูลใดฐานข้อมูลหนึ่งได้
    pub async fn new(_config: &DatabaseConfig) -> Result<Self> {
        panic!("Use new_from_config instead");
    }

    /// สร้าง database connection pool จาก Config หลัก
    pub async fn new_from_config(config: &Config) -> Result<Self> {
        let clickhouse = Arc::new(ClickHouseClient::new(&config.database).await?);
        let qdrant = Arc::new(QdrantClient::new(&config.qdrant.url).await?);

        Ok(Self { clickhouse, qdrant })
    }

    /// ตรวจสอบสุขภาพการเชื่อมต่อฐานข้อมูลทั้งหมด
    ///
    /// # Returns
    /// `Ok(())` หากทุก connection ปกติ, `Err` หากมี connection ใดมีปัญหา
    ///
    /// # ตรวจสอบ
    /// - ClickHouse connection status
    /// - Qdrant connection status
    pub async fn health_check(&self) -> Result<()> {
        self.clickhouse.health_check().await?;
        self.qdrant.health_check().await?;
        Ok(())
    }
}
