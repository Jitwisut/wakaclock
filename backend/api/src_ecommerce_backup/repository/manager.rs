//! Centralised repository registry that wires together trait object instances.

use std::sync::Arc;

use super::clickhouse;
use super::traits::{ProductRepository, VectorSyncRepository};

/// Aggregates concrete repository implementations behind trait objects.
///
/// The manager owns the repository Arcs and only exposes accessor methods.
/// This keeps construction logic isolated while callers work with borrowed
/// trait objects, reinforcing clear ownership and dependency boundaries.
pub struct RepositoryManager {
    product: Arc<dyn ProductRepository>,
    vector_sync: Arc<dyn VectorSyncRepository>,
    clickhouse: Arc<clickhouse::ClickHouseRepository>,
}

impl RepositoryManager {
    pub fn new(
        product: Arc<dyn ProductRepository>,
        vector_sync: Arc<dyn VectorSyncRepository>,
        clickhouse: Arc<clickhouse::ClickHouseRepository>,
    ) -> Self {
        Self {
            product,
            vector_sync,
            clickhouse,
        }
    }

    #[allow(dead_code)]
    pub fn product(&self) -> Arc<dyn ProductRepository> {
        self.product.clone()
    }

    #[allow(dead_code)]
    pub fn vector_sync(&self) -> Arc<dyn VectorSyncRepository> {
        self.vector_sync.clone()
    }

    #[allow(dead_code)]
    pub fn clickhouse(&self) -> Arc<clickhouse::ClickHouseRepository> {
        self.clickhouse.clone()
    }
}
