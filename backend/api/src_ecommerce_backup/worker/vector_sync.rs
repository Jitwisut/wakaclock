/// ไฟล์ vector_sync.rs - Vector sync worker สำหรับการซิงค์ข้อมูลสินค้าไปยัง vector database
/// จัดการการแปลงข้อมูลสินค้าเป็น embeddings และจัดเก็บลงใน Qdrant vector store
/// รองรับการประมวลผลแบบ batch และ retry mechanism สำหรับความน่าเชื่อถือ
use async_trait::async_trait;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::model::v1::platfrom::entries::{
    AppError, AppResult, JobStatus, Product, VectorSyncJob, VectorSyncMode,
};
use crate::{
    repository::{JobRepository, ProductRepository, VectorRepository},
    worker::Worker,
    AppState,
};

/// VectorSyncMessage - ข้อความสำหรับงานซิงค์ vector
/// ใช้ส่งข้อมูลการซิงค์ผ่าน message queue เพื่อประมวลผลแบบ async
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorSyncMessage {
    /// ID ของงานซิงค์ที่ไม่ซ้ำกัน
    pub job_id: String,

    /// ID ของ tenant/organization
    pub tenant_id: String,

    /// ID ของร้านค้า
    pub shop_id: String,

    /// แพลตฟอร์ม e-commerce (tiktok, shopee, lazada, etc.)
    pub platform: String,

    /// รายการ product IDs ที่ต้องซิงค์
    pub product_ids: Vec<String>,

    /// โมเดล embedding ที่ใช้ (text-embedding-ada-002, etc.)
    pub embedding_model: String,

    /// พรอมต์เพิ่มเติมสำหรับการสร้าง embedding
    pub embedding_prompt: String,

    /// Processing mode - item-based vs batch
    #[serde(default)]
    pub mode: VectorSyncMode,
}

/// VectorSyncWorker - Worker สำหรับซิงค์ข้อมูลสินค้าไปยัง vector database
/// ประมวลผลข้อมูลสินค้าจาก ClickHouse เป็น embeddings และจัดเก็บใน Qdrant
/// รองรับการซิงค์แบบ batch processing และ multi-tenant
pub struct VectorSyncWorker {
    /// Application state ที่เก็บ configuration และ dependencies
    state: Arc<AppState>,

    /// Product repository สำหรับดึงข้อมูลสินค้า
    product_repo: Arc<dyn ProductRepository>,

    /// Vector repository สำหรับจัดเก็บ embeddings
    vector_repo: Arc<dyn VectorRepository>,

    /// Job repository สำหรับติดตามสถานะงาน
    job_repo: Arc<dyn JobRepository>,
}

impl VectorSyncWorker {
    /// สร้าง VectorSyncWorker instance ใหม่
    ///
    /// # Arguments
    /// * `state` - Application state ที่เก็บ configuration
    /// * `product_repo` - Repository สำหรับเข้าถึงข้อมูลสินค้า
    /// * `vector_repo` - Repository สำหรับจัดเก็บ vector embeddings
    /// * `job_repo` - Repository สำหรับติดตาม job status
    pub fn new(
        state: Arc<AppState>,
        product_repo: Arc<dyn ProductRepository>,
        vector_repo: Arc<dyn VectorRepository>,
        job_repo: Arc<dyn JobRepository>,
    ) -> Self {
        Self {
            state,
            product_repo,
            vector_repo,
            job_repo,
        }
    }

    /// ประมวลผล batch ของสินค้าเพื่อสร้าง embeddings
    ///
    /// # Arguments
    /// * `products` - รายการสินค้าที่ต้องการประมวลผล
    /// * `embedding_model` - โมเดลที่ใช้สร้าง embedding
    /// * `embedding_prompt` - พรอมต์เพิ่มเติมสำหรับ context
    /// * `platform` - แพลตฟอร์มของสินค้า
    ///
    /// # Returns
    /// Result ของการประมวลผล - Ok() ถ้าสำเร็จ, Err() ถ้ามีข้อผิดพลาด
    async fn process_product_batch(
        &self,
        products: Vec<Product>,
        embedding_model: &str,
        embedding_prompt: &str,
        platform: &str,
    ) -> AppResult<()> {
        // สร้างข้อความจากข้อมูลสินค้า รวม title, description และ prompt
        let texts: Vec<String> = products
            .iter()
            .map(|p| {
                let mut text = format!("{}\n", p.title);
                if let Some(desc) = &p.description {
                    text.push_str(&format!("{}\n", desc));
                }
                if !embedding_prompt.is_empty() {
                    text = format!("{}\n\n{}", embedding_prompt, text);
                }
                text
            })
            .collect();

        // สร้าง embeddings สำหรับข้อความแต่ละรายการ
        let mut embeddings = Vec::new();
        for text in texts {
            // เรียกใช้ OpenAI API เพื่อสร้าง embedding จากข้อความ
            let embedding = self.generate_embedding(&text, embedding_model).await?;
            embeddings.push(embedding);
        }

        // สร้างชื่อ collection สำหรับเก็บ vectors ใน Qdrant
        let collection = self.get_collection_name(platform, embedding_model);

        // บันทึก embedding พร้อมข้อมูล metadata ลงใน vector database
        for (product, embedding) in products.iter().zip(embeddings.iter()) {
            let payload = serde_json::json!({
                "product_id": product.product_id,
                "shop_id": product.shop_id,
                "platform": platform,
                "title": product.title,
                "description": product.description,
                "price": product.price,
                "currency": product.currency,
                "sku": product.sku,
                "categories": product.categories,
                "embedding_model": embedding_model,
                "embedding_prompt": embedding_prompt,
                "created_at": product.created_at.to_rfc3339(),
                "updated_at": product.updated_at.to_rfc3339(),
                "synced_at": Utc::now().to_rfc3339(),
            });

            self.vector_repo
                .upsert_vector(&collection, &product.product_id, &embedding, &payload)
                .await?;
        }

        Ok(())
    }

    /// สร้างชื่อ collection สำหรับ Qdrant vector store
    /// รูปแบบ: collection_{platform}_{model} (เช่น collection_tiktok_text_embedding_ada_002)
    ///
    /// # Arguments
    /// * `platform` - ชื่อแพลตฟอร์ม e-commerce
    /// * `model` - ชื่อโมเดล embedding
    fn get_collection_name(&self, platform: &str, model: &str) -> String {
        let model_suffix = model.replace("-", "_").replace(".", "_");
        format!("collection_{}_{}", platform, model_suffix)
    }

    /// ตรวจสอบและสร้าง collection ใน Qdrant หากไม่มี
    ///
    /// # Arguments
    /// * `platform` - ชื่อแพลตฟอร์ม
    /// * `model` - ชื่อโมเดล embedding
    async fn ensure_collection(&self, platform: &str, model: &str) -> AppResult<()> {
        let _collection = self.get_collection_name(platform, model);

        // Collection จะถูกสร้างโดยอัตโนมัติโดย repository เมื่อจำเป็น
        // ไม่ต้องสร้างแยกที่นี่
        Ok(())
    }

    /// สร้าง embedding vector จากข้อความโดยใช้ OpenAI API
    ///
    /// # Arguments
    /// * `text` - ข้อความที่ต้องการแปลงเป็น embedding
    /// * `model` - โมเดล embedding ที่ใช้ (เช่น text-embedding-ada-002)
    ///
    /// # Returns
    /// Vector ของ embedding (Vec<f32>) หรือ error หากการเรียก API ล้มเหลว
    async fn generate_embedding(&self, text: &str, model: &str) -> AppResult<Vec<f32>> {
        // เรียกใช้ OpenAI API เพื่อสร้าง embeddings
        let api_key = &self.state.config.ai.llm_api_key;
        if api_key.is_empty() {
            return Err(AppError::ConfigError(
                "OpenAI API key not configured".to_string(),
            ));
        }

        let api_base_url = &self.state.config.ai.llm_api_base_url;
        let url = format!("{}/embeddings", api_base_url);

        // Create request body
        let request_body = serde_json::json!({
            "model": model,
            "input": text,
            "encoding_format": "float"
        });

        // เรียก API พร้อม retry mechanism สำหรับความน่าเชื่อถือ
        let mut attempts = 0;
        let max_attempts = self.state.config.ai.llm_retry_max;
        let timeout = std::time::Duration::from_millis(self.state.config.ai.llm_timeout_ms);

        loop {
            attempts += 1;

            let client = reqwest::Client::builder()
                .timeout(timeout)
                .build()
                .map_err(|e| {
                    AppError::ExternalServiceError(format!("Failed to build HTTP client: {}", e))
                })?;

            let response = client
                .post(&url)
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Content-Type", "application/json")
                .json(&request_body)
                .send()
                .await;

            match response {
                Ok(resp) => {
                    if resp.status().is_success() {
                        let response_body: serde_json::Value = resp.json().await.map_err(|e| {
                            AppError::ExternalServiceError(format!(
                                "Failed to parse OpenAI response: {}",
                                e
                            ))
                        })?;

                        // Extract embedding from response
                        let embedding = response_body["data"][0]["embedding"]
                            .as_array()
                            .ok_or_else(|| {
                                AppError::ExternalServiceError(
                                    "Invalid embedding response format".to_string(),
                                )
                            })?
                            .iter()
                            .map(|v| v.as_f64().unwrap_or(0.0) as f32)
                            .collect();

                        return Ok(embedding);
                    } else {
                        let status = resp.status();
                        let error_text = resp
                            .text()
                            .await
                            .unwrap_or_else(|_| "Unknown error".to_string());

                        if attempts >= max_attempts {
                            return Err(AppError::ExternalServiceError(format!(
                                "OpenAI API error (status {}): {}",
                                status, error_text
                            )));
                        }

                        // Exponential backoff for retries
                        let delay =
                            std::time::Duration::from_millis(1000 * (2_u64.pow(attempts - 1)));
                        warn!(
                            "OpenAI API error (status {}), retrying in {:?}...",
                            status, delay
                        );
                        tokio::time::sleep(delay).await;
                    }
                }
                Err(e) => {
                    if attempts >= max_attempts {
                        return Err(AppError::ExternalServiceError(format!(
                            "Failed to call OpenAI API: {}",
                            e
                        )));
                    }

                    // Exponential backoff for retries
                    let delay = std::time::Duration::from_millis(1000 * (2_u64.pow(attempts - 1)));
                    warn!(
                        "OpenAI API request failed: {}, retrying in {:?}...",
                        e, delay
                    );
                    tokio::time::sleep(delay).await;
                }
            }
        }
    }
}

/// การ implement Worker trait สำหรับ VectorSyncWorker
/// จัดการการเริ่มต้น, หยุด, และประมวลผลงานซิงค์ vector
#[async_trait]
impl Worker for VectorSyncWorker {
    /// เริ่มต้น worker และรอรับงานจาก message queue
    async fn start(&self) -> AppResult<()> {
        info!("Starting vector sync worker");

        // Downcast to RabbitMQ queue to get direct access
        use crate::infrastructure::queue::rabbitmq::RabbitMqQueue;

        let _rabbit_queue = self
            .state
            .queue
            .as_any()
            .downcast_ref::<RabbitMqQueue>()
            .ok_or_else(|| AppError::QueueError("Queue is not RabbitMqQueue".to_string()))?;

        // For now, use a simple loop with pull pattern
        // In a real implementation, you'd use proper RabbitMQ subscription
        loop {
            // Sleep for a bit to avoid busy waiting
            tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

            // Check for messages (this is a placeholder - actual implementation would
            // use proper RabbitMQ subscription)
            // For now, just continue the loop

            // Check for shutdown signal (would need cancellation token to be added)
            // For now, just continue the loop
        }
    }

    /// หยุดการทำงานของ worker อย่างปลอดภัย
    async fn stop(&self) -> AppResult<()> {
        info!("Stopping vector sync worker");
        Ok(())
    }

    /// ประมวลผลงานซิงค์ vector จาก message queue
    /// อ่านข้อมูลสินค้า สร้าง embeddings และบันทึกลง vector database
    ///
    /// # Arguments
    /// * `job_data` - ข้อมูลงานในรูปแบบ bytes (จะถูก deserialize เป็น VectorSyncMessage)
    async fn process_job(&self, job_data: Vec<u8>) -> AppResult<()> {
        let message: VectorSyncMessage = serde_json::from_slice(&job_data)
            .map_err(|e| AppError::QueueError(format!("Invalid job message: {}", e)))?;

        info!(
            "Processing vector sync job {} for shop {} on platform {}",
            message.job_id, message.shop_id, message.platform
        );

        let _job_uuid = Uuid::parse_str(&message.job_id).unwrap_or_else(|_| Uuid::new_v4());

        // สร้าง job record เพื่อติดตามสถานะการประมวลผล
        let job = VectorSyncJob {
            id: uuid::Uuid::new_v4().to_string(),
            product_ids: message.product_ids.clone(),
            status: JobStatus::Running,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        self.job_repo.create_job(&message.tenant_id, &job).await?;

        self.ensure_collection(&message.platform, &message.embedding_model)
            .await?;

        // แบ่งการประมวลผลเป็น batches เพื่อประสิทธิภาพ
        let batch_size = match message.mode {
            VectorSyncMode::Items => 1,
            VectorSyncMode::Batch => self.state.config.worker.batch_size,
        };
        let chunks: Vec<_> = message.product_ids.chunks(batch_size.max(1)).collect();

        for (i, chunk) in chunks.iter().enumerate() {
            info!(
                "Processing batch {}/{} for job {}",
                i + 1,
                chunks.len(),
                message.job_id
            );

            // ดึงข้อมูลสินค้าจาก repository สำหรับ batch นี้
            let mut products = Vec::new();
            for product_id in chunk.iter() {
                match self
                    .product_repo
                    .get_product(
                        &message.tenant_id,
                        &message.platform,
                        &message.shop_id,
                        product_id,
                    )
                    .await
                {
                    Ok(product) => products.push(product),
                    Err(e) => {
                        warn!("Failed to fetch product {}: {}", product_id, e);
                    }
                }
            }

            if !products.is_empty() {
                if let Err(e) = self
                    .process_product_batch(
                        products,
                        &message.embedding_model,
                        &message.embedding_prompt,
                        &message.platform,
                    )
                    .await
                {
                    error!("Failed to process batch: {}", e);
                    self.job_repo
                        .fail_job(&message.job_id, &e.to_string())
                        .await?;
                    return Err(e);
                }

                let processed = (i + 1) * batch_size.min(chunk.len());
                self.job_repo
                    .update_job_progress(&message.job_id, processed as u32)
                    .await?;
            }
        }

        self.job_repo.complete_job(&message.job_id).await?;

        info!("Completed vector sync job {}", message.job_id);

        Ok(())
    }
}

// Removed AsAny trait as it's not directly compatible with trait objects
