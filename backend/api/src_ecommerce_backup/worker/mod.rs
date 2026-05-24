//! Worker Module
//! โมดูลสำหรับ background workers และ job processing
//!
//! ประกอบด้วย:
//! - `batch_processor`: การประมวลผลข้อมูลเป็น batch
//! - `product_consumer`: การประมวลผล product messages จาก queue
//! - `product_sync`: การซิงค์ product data ข้ามแพลตฟอร์ม
//! - `vector_sync`: การซิงค์ vector embeddings สำหรับ AI search
//! - `product_list_consumer`: การดึงรายการสินค้า
//! - `product_detail_consumer`: การดึงรายละเอียดสินค้า

/// Batch processing worker
pub mod batch_processor;

/// Product message consumer
pub mod product_consumer;

/// Product sync worker
pub mod product_sync;

/// Vector sync worker
pub mod vector_sync;

/// Vector sync worker (alternative implementation)
pub mod vector_sync_worker;

/// Product list consumer
pub mod product_list_consumer;

/// Product detail consumer
pub mod product_detail_consumer;

/// Webhook batch ingest worker
pub mod product_ingest_worker;

/// Crawler consumer worker
pub mod crawler_consumer;

/// Helpers for configurable queue bindings
pub mod queue_binding;

use crate::model::error::AppResult;
use async_trait::async_trait;

pub use batch_processor::{BatchProcessMessage, BatchProcessorWorker};
pub use crawler_consumer::CrawlerConsumer;
pub use product_consumer::{ProductConsumerWorker, ProductFetchMessage};
pub use product_detail_consumer::ProductDetailConsumer;
pub use product_ingest_worker::ProductIngestWorker;
pub use product_list_consumer::ProductListConsumer;
pub use product_sync::{
    ProductSyncBatch, ProductSyncMessage, ProductSyncRecord, ProductSyncWorker,
};
pub use queue_binding::{resolve_binding, QueueBinding};
pub use vector_sync::{VectorSyncMessage, VectorSyncWorker};
pub use vector_sync_worker::{
    VectorSyncMessage as VectorSyncMessageAlt, VectorSyncWorker as VectorSyncWorkerAlt,
};

/// Trait สำหรับ background worker implementations
/// กำหนด interface สำหรับการ start, stop และ process jobs
#[async_trait]
pub trait Worker: Send + Sync {
    /// เริ่มการทำงานของ worker
    /// เริ่ม listeners, connections และ background tasks
    async fn start(&self) -> AppResult<()>;

    /// หยุดการทำงานของ worker
    /// ทำการ graceful shutdown และ cleanup resources
    async fn stop(&self) -> AppResult<()>;

    /// ประมวลผล job เดียว
    /// รับ job data เป็น bytes และประมวลผลตาม business logic
    async fn process_job(&self, job_data: Vec<u8>) -> AppResult<()>;
}
