//! # Product Queries Module
//!
//! โมดูลนี้กำหนด query parameters สำหรับการค้นหาและกรองสินค้า
//! ใช้สำหรับสร้าง API queries ที่ซับซ้อนและมีประสิทธิภาพ
//!
//! ## ฟีเจอร์หลัก
//! - Product filtering และ search parameters
//! - Pagination และ sorting options
//! - Price range และ category filtering
//! - Status และ availability queries

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Query to get a product by ID
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct GetProductQuery {
    pub product_id: String,
    pub platform: String,
    pub shop_id: String,
}

/// Query to list products with pagination
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ListProductsQuery {
    pub shop_id: Option<String>,
    pub platform: Option<String>,
    pub search: Option<String>,
    pub page: u32,
    pub limit: u32,
}

/// Query to search products
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchProductsQuery {
    pub query: String,
    pub shop_id: Option<String>,
    pub limit: u32,
}

/// Query handler trait
#[async_trait]
pub trait QueryHandler<Q>: Send + Sync {
    type Result;

    async fn handle(&self, query: Q) -> Result<Self::Result>;
}
