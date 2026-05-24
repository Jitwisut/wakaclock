//! Repository interfaces shared across the data-access layer.
//!
//! Keeping the traits in a dedicated module makes it easier to reason about
//! ownership boundaries and apply consistent SOLID-inspired abstractions across
//! the various repository implementations.

use async_trait::async_trait;
use serde_json::Value;

use crate::model::error::AppResult;
use crate::model::v1::platfrom::entries::{Product, VectorSyncJob};

/// Interface for managing vector sync jobs that orchestrate background work.
#[async_trait]
pub trait VectorSyncRepository: Send + Sync {
    async fn create_job(&self, job: &VectorSyncJob) -> AppResult<()>;
    async fn get_pending_jobs(&self, limit: usize) -> AppResult<Vec<VectorSyncJob>>;
    async fn update_job_status(&self, job_id: &str, status: &str) -> AppResult<()>;
    async fn delete_job(&self, job_id: &str) -> AppResult<()>;
}

/// Primary interface for querying and persisting product entities.
#[async_trait]
pub trait ProductRepository: Send + Sync {
    async fn get_product(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        product_id: &str,
    ) -> AppResult<Product>;

    async fn list_products(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        page: u32,
        limit: u32,
    ) -> AppResult<Vec<Product>>;

    async fn count_products(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
    ) -> AppResult<usize>;

    async fn save_product(&self, tenant_id: &str, product: &Product) -> AppResult<()>;

    async fn save_products_batch(&self, tenant_id: &str, products: &[Product]) -> AppResult<()>;

    async fn update_product(&self, tenant_id: &str, product: &Product) -> AppResult<()>;

    async fn delete_product(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        product_id: &str,
    ) -> AppResult<()>;

    async fn check_duplicate(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        product_id: &str,
    ) -> AppResult<bool>;
}

/// Interface describing vector database operations.
#[async_trait]
pub trait VectorRepository: Send + Sync {
    async fn upsert_vector(
        &self,
        collection: &str,
        id: &str,
        vector: &[f32],
        payload: &Value,
    ) -> AppResult<()>;

    async fn search_vectors(
        &self,
        collection: &str,
        vector: &[f32],
        limit: usize,
    ) -> AppResult<Vec<(String, f32, Value)>>;

    async fn get_vector(&self, collection: &str, id: &str) -> AppResult<Option<(Vec<f32>, Value)>>;

    async fn delete_vector(&self, collection: &str, id: &str) -> AppResult<()>;
}

/// Interface encapsulating background job tracking persistence.
#[async_trait]
pub trait JobRepository: Send + Sync {
    async fn create_job(&self, tenant_id: &str, job: &VectorSyncJob) -> AppResult<()>;
    async fn update_job_progress(&self, job_id: &str, processed: u32) -> AppResult<()>;
    async fn complete_job(&self, job_id: &str) -> AppResult<()>;
    async fn fail_job(&self, job_id: &str, error: &str) -> AppResult<()>;
    async fn get_job_status(&self, job_id: &str) -> AppResult<VectorSyncJob>;
}
