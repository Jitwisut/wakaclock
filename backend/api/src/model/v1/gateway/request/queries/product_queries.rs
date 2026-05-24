//! ไฟล์ product_queries.rs - Query structures สำหรับการค้นหาและจัดการข้อมูลสินค้า
//! จัดการโครงสร้างข้อมูลสำหรับ CQRS Query pattern ในการเข้าถึงข้อมูลสินค้า
//! รองรับการค้นหา การแบ่งหน้า และการกรองข้อมูลสินค้าจาก platform ต่างๆ

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// GetProductQuery - Query สำหรับการค้นหาสินค้าด้วย ID
/// ใช้สำหรับดึงข้อมูลสินค้าเฉพาะรายการจาก database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetProductQuery {
    /// ID ของสินค้าที่ต้องการค้นหา
    pub product_id: String,
}

/// ListProductsQuery - Query สำหรับการแสดงรายการสินค้าแบบแบ่งหน้า
/// รองรับการกรองตาม shop และ platform พร้อมระบบ pagination
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListProductsQuery {
    /// ID ของร้านค้าที่ต้องการกรองสินค้า
    pub shop_id: Option<String>,

    /// ชื่อ platform ที่ต้องการกรองสินค้า (เช่น "shopify", "lazada")
    pub platform: Option<String>,

    /// หมายเลขหน้าสำหรับ pagination (เริ่มจาก 0)
    pub page: usize,

    /// จำนวนรายการต่อหน้า
    pub limit: usize,
}

/// SearchProductsQuery - Query สำหรับการค้นหาสินค้าด้วยข้อความ
/// รองรับ full-text search และ vector search สำหรับหาสินค้าที่เกี่ยวข้อง
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchProductsQuery {
    /// คำค้นหา (สามารถใช้ได้ทั้ง text search และ semantic search)
    pub query: String,

    /// ID ของร้านค้าที่ต้องการค้นหาในขอบเขต
    pub shop_id: Option<String>,

    /// จำนวนผลลัพธ์สูงสุดที่ต้องการ
    pub limit: usize,
}

/// QueryHandler trait - Interface สำหรับการจัดการ CQRS queries
/// ใช้ async_trait เพื่อรองรับการทำงานแบบ asynchronous ใน trait
#[async_trait]
pub trait QueryHandler<Q>: Send + Sync {
    /// ประเภทของผลลัพธ์ที่ query จะส่งกลับ
    type Result;

    /// ฟังก์ชันหลักสำหรับการประมวลผล query
    ///
    /// # Arguments
    /// * `query` - Query object ที่ต้องการประมวลผล
    ///
    /// # Returns
    /// Result ที่ระบุไว้ใน associated type หรือ error
    async fn handle(&self, query: Q) -> Result<Self::Result>;
}
