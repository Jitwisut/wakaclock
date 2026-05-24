/// ไฟล์ product.rs - Product Service Implementation
/// จัดการ business logic สำหรับสินค้า รวมถึงการ sync จาก platform
/// และการ sync ไปยัง vector database สำหรับ AI search
use async_trait::async_trait;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    model::v1::platfrom::entries::{
        AppError, AppResult, JobStatus, Product, VectorSyncJob, VectorSyncMode,
    },
    repository::{JobRepository, ProductRepository},
    AppState,
};

/// ProductService trait - Interface สำหรับ product operations
/// กำหนด methods ที่จำเป็นสำหรับจัดการสินค้า
#[async_trait]
pub trait ProductService: Send + Sync {
    /// ดึงรายการสินค้าจากฐานข้อมูล พร้อม pagination
    /// ถ้าไม่มีข้อมูลจะทำการ sync จาก platform อัตโนมัติ
    async fn list_products(
        &self,
        _tenant_id: &str,
        _platform: &str,
        _shop_id: &str,
        page: u32,
        limit: u32,
    ) -> AppResult<Vec<Product>>;

    /// ดึงข้อมูลสินค้าตาม product_id
    /// ค้นหาจากฐานข้อมูลท้องถิ่นเท่านั้น
    async fn get_product(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        product_id: &str,
    ) -> AppResult<Product>;

    /// Sync สินค้าจาก e-commerce platform
    /// ดึงข้อมูลล่าสุดและบันทึกลง database
    async fn sync_products_from_platform(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
    ) -> AppResult<Vec<Product>>;

    /// Sync สินค้าไปยัง vector database สำหรับ AI search
    /// สร้าง embeddings และบันทึกใน Qdrant
    /// Return job_id สำหรับติดตามสถานะ
    async fn sync_to_vector(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        embedding_model: Option<String>,
        embedding_prompt: Option<String>,
        product_ids: Option<Vec<String>>,
    ) -> AppResult<String>;
}

/// ProductServiceImpl - Implementation ของ ProductService
/// จัดการ business logic ระหว่าง repository และ platform gateways
/// ใช้ dependency injection pattern สำหรับ flexibility
pub struct ProductServiceImpl {
    // state - Application state รวม config และ shared resources
    state: Arc<AppState>,
    // product_repo - Repository สำหรับจัดเก็บข้อมูลสินค้า
    product_repo: Arc<dyn ProductRepository>,
    // job_repo - Repository สำหรับจัดการ background jobs
    job_repo: Arc<dyn JobRepository>,
}

impl ProductServiceImpl {
    /// สร้าง ProductService instance ใหม่
    /// ใช้ dependency injection สำหรับ repositories
    pub fn new(
        state: Arc<AppState>,
        product_repo: Arc<dyn ProductRepository>,
        job_repo: Arc<dyn JobRepository>,
    ) -> Self {
        Self {
            state,
            product_repo,
            job_repo,
        }
    }
}

#[async_trait]
impl ProductService for ProductServiceImpl {
    /// ดึงรายการสินค้าจาก database พร้อม auto-sync ถ้าไม่มีข้อมูล
    /// 1. ค้นหาจาก local database ก่อน
    /// 2. ถ้าไม่พบ ทำการ sync จาก platform อัตโนมัติ
    /// 3. Return สินค้าตามจำนวนที่ต้องการ (limit)
    async fn list_products(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        page: u32,
        limit: u32,
    ) -> AppResult<Vec<Product>> {
        let products = self
            .product_repo
            .list_products(tenant_id, platform, shop_id, page, limit)
            .await?;

        // ถ้าไม่มีข้อมูลใน database ให้ sync จาก platform
        if products.is_empty() {
            let synced = self
                .sync_products_from_platform(tenant_id, platform, shop_id)
                .await?;
            return Ok(synced.into_iter().take(limit as usize).collect());
        }

        Ok(products)
    }

    /// ดึงข้อมูลสินค้าเดี่ยวจาก database
    /// ไม่มี auto-sync - return error ถ้าไม่พบข้อมูล
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

    /// Sync สินค้าทั้งหมดจาก e-commerce platform
    /// TODO: ต้องปรับให้ดึง credentials จาก database (Strapi)
    /// ปัจจุบันใช้ credentials จาก config file
    async fn sync_products_from_platform(
        &self,
        _tenant_id: &str,
        _platform: &str,
        _shop_id: &str,
    ) -> AppResult<Vec<Product>> {
        // TODO: This method needs to be refactored to get credentials from database
        // and use the proper PlatformGateway trait methods
        // ต้องเปลี่ยนให้ดึง credentials จาก Strapi ตาม architecture
        return Err(AppError::NotImplemented(
            "sync_products_from_platform needs refactoring".to_string(),
        ));

        /*
        let session = self.auth_provider.get_session(shop_id, platform).await?;

        let gateway = self.get_platform_gateway(platform).await?;

        let mut products = gateway.list_products(&session.access_token, 1, 100).await?;

        for product in &mut products {
            product.shop_id = shop_id.to_string();
            product.platform = platform.to_string();

            if !self
                .product_repo
                .check_duplicate(tenant_id, platform, shop_id, &product.product_id)
                .await?
            {
                self.product_repo
                    .save_product(tenant_id, product)
                    .await?;
            }
        }

        Ok(products)
        */
    }

    /// Sync สินค้าไปยัง vector database (Qdrant) สำหรับ AI search
    /// 1. เลือก embedding model (default: openai-text-embedding-3-large)
    /// 2. เตรียมรายการสินค้าที่จะ sync (ทั้งหมดหรือเฉพาะที่ระบุ)
    /// 3. สร้าง background job และส่งไป message queue
    /// 4. Return job_id สำหรับติดตามสถานะ
    async fn sync_to_vector(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        embedding_model: Option<String>,
        embedding_prompt: Option<String>,
        product_ids: Option<Vec<String>>,
    ) -> AppResult<String> {
        // เลือก embedding model - ใช้ default ถ้าไม่ระบุ
        let model = embedding_model.unwrap_or_else(|| "openai-text-embedding-3-large".to_string());

        let prompt = embedding_prompt.unwrap_or_default();

        // เตรียมรายการสินค้าที่จะ sync
        let products_to_sync = if let Some(ids) = product_ids {
            // ใช้ product_ids ที่ระบุมา
            ids
        } else {
            // ดึงสินค้าทั้งหมด (max 1000 รายการ)
            let products = self
                .product_repo
                .list_products(tenant_id, platform, shop_id, 1, 1000)
                .await?;
            products.into_iter().map(|p| p.product_id).collect()
        };

        if products_to_sync.is_empty() {
            return Err(AppError::BadRequest("No products to sync".to_string()));
        }

        // สร้าง job record สำหรับติดตามสถานะ
        let job_id = Uuid::new_v4();
        let job = VectorSyncJob {
            id: uuid::Uuid::new_v4().to_string(), // Add missing id field

            product_ids: products_to_sync.clone(),

            status: JobStatus::Pending,
            created_at: chrono::Utc::now(), // Add missing created_at field
            updated_at: chrono::Utc::now(), // Add missing updated_at field
        };

        self.job_repo.create_job(tenant_id, &job).await?;

        // สร้าง message สำหรับ worker
        let message = crate::worker::vector_sync::VectorSyncMessage {
            job_id: job_id.to_string(),
            tenant_id: tenant_id.to_string(),
            shop_id: shop_id.to_string(),
            platform: platform.to_string(),
            product_ids: products_to_sync,
            embedding_model: model,
            embedding_prompt: prompt,
            mode: VectorSyncMode::Batch,
        };

        let message_bytes = serde_json::to_vec(&message)
            .map_err(|e| AppError::InternalError(format!("Failed to serialize message: {}", e)))?;

        // ส่ง message ไปยัง queue สำหรับ background processing
        self.state
            .queue
            .publish_bytes("ecommerce.vector.sync", message_bytes)
            .await
            .map_err(|e| AppError::QueueError(format!("Failed to publish job: {}", e)))?;

        Ok(job_id.to_string())
    }
}
