/// Product API handler responsible for CRUD, sync, and job orchestration.
/// Routes are grouped by concern (CRUD, sync, jobs) so the router scales as
/// new product capabilities are added.
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use super::{
    ingrest,
    product::{
        cancel_sync_job, create_product, delete_product, download_product_media,
        export_shop_products_excel, fetch_platform_products, get_product, get_product_detail,
        get_sync_job_status, get_sync_logs, get_sync_status, get_synced_products, list_categories,
        list_product_snapshots, list_product_sync_review, list_products, list_sync_jobs,
        list_unique_products, promote_product_sync_records, realtime_sync_products,
        sample_vector_sync, sync_platform_products, sync_products, sync_products_extended,
        sync_to_vector, update_product, upload_product_media,
    },
};
use crate::AppState;

/// Product API Handler
///
/// Manages all product-related routes including CRUD and sync operations.
/// This handler provides:
/// - Product CRUD operations
/// - Synchronization with platforms
/// - Vector search integration
/// - Job management
///
///   โครงสร้าง ProductHandler สำหรับจัดการ API endpoints ของสินค้า
pub struct ProductHandler {
    state: Arc<AppState>,
}

impl ProductHandler {
    /// สร้าง instance ใหม่ของ Product handler
    /// Create a new Product handler instance
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// สร้างและคืนค่า router พร้อม product routes ทั้งหมด
    /// Build and return the router with all product routes
    pub fn build(&self) -> Router<Arc<AppState>> {
        self.routes()
    }

    /// ลงทะเบียน product routes ทั้งหมด
    /// Register all product routes
    fn routes(&self) -> Router<Arc<AppState>> {
        Self::crud_routes()
            .merge(Self::sync_routes())
            .merge(Self::job_routes())
            .merge(ingrest::ingrest_routes())
            .with_state(self.state.clone())
    }

    fn crud_routes() -> Router<Arc<AppState>> {
        Router::new()
            .route("/products", get(list_products).post(create_product))
            .route(
                "/products/:product_id",
                get(get_product).put(update_product).delete(delete_product),
            )
            .route("/products/unique", get(list_unique_products))
            .route("/products/:product_id/detail", get(get_product_detail))
            .route("/products/categories", get(list_categories))
    }

    fn sync_routes() -> Router<Arc<AppState>> {
        Router::new()
            .route("/products/vector-sync", post(sync_to_vector))
            .route("/products/vector-sync/sample", post(sample_vector_sync))
            .route("/products/sync/realtime", post(realtime_sync_products))
            .route("/products/sync/extended", post(sync_products_extended))
            .route("/products/sync/current", get(list_product_snapshots))
            .route("/products/sync/logs", get(get_sync_logs))
            .route("/products/sync/review", get(list_product_sync_review))
            .route("/products/sync/promote", post(promote_product_sync_records))
            .route("/shops/:shop_id/products/sync", post(sync_products))
            .route("/shops/:shop_id/products/synced", get(get_synced_products))
            .route(
                "/shops/:shop_id/products/export",
                get(export_shop_products_excel),
            )
            .route(
                "/shops/:shop_id/platforms/:platform/products/sync",
                post(sync_platform_products),
            )
            .route(
                "/shops/:shop_id/platforms/:platform/products/pull",
                post(super::product::pull_platform_products),
            )
            .route(
                "/shops/:shop_id/platforms/:platform/products",
                get(fetch_platform_products),
            )
            .route("/products/media/upload", post(upload_product_media))
            .route("/products/media/download", get(download_product_media))
    }

    fn job_routes() -> Router<Arc<AppState>> {
        Router::new()
            .route("/products/sync/jobs", get(list_sync_jobs))
            .route(
                "/products/sync/jobs/:job_id",
                get(get_sync_job_status).delete(cancel_sync_job),
            )
            .route("/products/sync/jobs/:job_id/summary", get(get_sync_status))
    }
}
