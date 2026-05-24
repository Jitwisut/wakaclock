use std::sync::Arc;

use async_trait::async_trait;
use serde::Serialize;

use crate::{
    infrastructure::AppState, model::error::AppResult, model::v1::platfrom::entries::Product,
    repository::clickhouse::ClickHouseRepository, repository::ProductRepository,
};

#[derive(Debug, Serialize)]
pub struct ListProductsResponse {
    pub products: Vec<Product>,
    pub total: usize,
    pub page: u32,
    pub limit: u32,
}

#[async_trait]
pub trait ProductListingService: Send + Sync {
    async fn list_products(
        &self,
        tenant_id: &str,
        platform: Option<&str>,
        shop_id: Option<&str>,
        search: Option<&str>,
        page: u32,
        limit: u32,
    ) -> AppResult<ListProductsResponse>;

    async fn get_product(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        product_id: &str,
    ) -> AppResult<Product>;
}

pub struct ProductListingServiceImpl {
    product_repo: Arc<ClickHouseRepository>,
}

impl ProductListingServiceImpl {
    pub fn new(state: Arc<AppState>) -> Self {
        let product_repo = state.product_repository();
        Self { product_repo }
    }
}

#[async_trait]
impl ProductListingService for ProductListingServiceImpl {
    async fn list_products(
        &self,
        tenant_id: &str,
        platform: Option<&str>,
        shop_id: Option<&str>,
        _search: Option<&str>,
        page: u32,
        limit: u32,
    ) -> AppResult<ListProductsResponse> {
        let products = self
            .product_repo
            .list_products(
                tenant_id,
                platform.unwrap_or(""),
                shop_id.unwrap_or(""),
                page,
                limit,
            )
            .await?;

        let total = self
            .product_repo
            .count_products(tenant_id, platform.unwrap_or(""), shop_id.unwrap_or(""))
            .await?;

        Ok(ListProductsResponse {
            products,
            total,
            page,
            limit,
        })
    }

    async fn get_product(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        product_id: &str,
    ) -> AppResult<Product> {
        self.product_repo
            .get_product(tenant_id, platform, shop_id, product_id)
            .await
    }
}
