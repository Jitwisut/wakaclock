//! ไฟล์นี้ประกอบด้วย Background Worker ที่รับผิดชอบในการจัดการ
//! การประมวลผลข้อมูลแบบ Batch สำหรับ Product Sync operations
//!
//! ## ความรับผิดชอบ (Responsibilities)
//! - รับและประมวลผล Batch Process Messages จาก RabbitMQ Queue
//! - จัดการสถานะของ Batch Jobs (pending_review, approved, rejected)
//! - ประมวลผลข้อมูลสินค้าแบบกลุ่ม (Batch Processing)
//! - ย้ายข้อมูลที่ผ่านการตรวจสอบไปยัง Production
//! - จัดการ Notifications และ Webhooks
//!
//! ## วิธีการทำงาน (Workflow)
//! 1. รับ Batch Process Message จาก Queue
//! 2. ตรวจสอบ Action ที่ต้องดำเนินการ
//! 3. ปรับปรุงสถานะ Batch ตาม Action
//! 4. ดำเนินการตามที่กำหนด
//! 5. ส่ง Notifications และ Update Status
//!
//! ## ประเภท Actions
//! - `process_batch`: ประมวลผล Batch และเปลี่ยนสถานะเป็น pending_review
//! - `finalize_batch`: ย้ายข้อมูลที่ผ่านการตรวจสอบไป Production
//! - `reject_batch`: ปฏิเสธ Batch และทำความสะอาด
//!
//! ## ไดเรกทอรี
//! `src/worker/`

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info, warn};

use crate::{
    infrastructure::queue::traits::QueueMessage,
    model::v1::platfrom::entries::{AppError, AppResult},
    worker::{resolve_binding, QueueBinding, Worker},
    AppState,
};

/// โครงสร้างข้อความสำหรับ Batch Processing (Batch Process Message)
///
/// เก็บข้อมูลและคำสั่งสำหรับการประมวลผล Batch Jobs
/// ที่ส่งผ่าน RabbitMQ Queue
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchProcessMessage {
    /// ID ของ Batch Job
    pub batch_id: String,
    /// ID ของ Tenant/Organization
    #[serde(
        alias = "organization_id",
        default = "BatchProcessMessage::default_tenant_id"
    )]
    pub tenant_id: String,
    /// ID ของร้านค้า
    pub shop_id: String,
    /// ชื่อแพลตฟอร์ม
    pub platform: String,
    /// Action ที่ต้องดำเนินการ (process_batch, finalize_batch, reject_batch, etc.)
    pub action: String,
    /// ข้อมูลเพิ่มเติมสำหรับ Sync Message (ถ้ามี)
    pub sync_message: Option<serde_json::Value>,
}

impl BatchProcessMessage {
    fn default_tenant_id() -> String {
        "default".to_string()
    }
}

/// Worker สำหรับประมวลผล Product Sync Batches (Batch Processor Worker)
///
/// Worker ที่รับผิดชอบในการจัดการและประมวลผล Product Sync Batches
/// ผ่าน RabbitMQ Message Queue รวมถึงการจัดการ Workflow และ Status Updates
pub struct BatchProcessorWorker {
    state: Arc<AppState>,
}

impl BatchProcessorWorker {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    async fn setup_subscription(&self) -> Result<()> {
        let routing_key = "ecommerce.product.sync.batch";

        // Use environment variables if set, otherwise use defaults
        let binding = resolve_binding(
            "CONSUMER_BATCH_PROCESSOR",
            QueueBinding::new("batch_processor", "batch_processor_consumer", routing_key),
        );

        self.state
            .queue
            .create_durable_consumer(&binding.stream, &binding.consumer, &binding.routing_key)
            .await?;

        let state = self.state.clone();
        let handler = Box::new(move |msg: QueueMessage| -> anyhow::Result<()> {
            let state = state.clone();
            tokio::spawn(async move {
                if let Err(err) = process_batch_message(state, msg).await {
                    error!("batch processor worker failed: {err:?}");
                }
            });
            Ok(())
        });

        self.state.queue.subscribe(handler).await?;

        info!(
            consumer = binding.consumer,
            subject = binding.routing_key,
            "batch processor worker subscribed"
        );
        Ok(())
    }

    async fn process_batch(&self, message: BatchProcessMessage) -> AppResult<()> {
        info!(
            "Processing batch {} for shop {} on platform {}",
            message.batch_id, message.shop_id, message.platform
        );

        match message.action.as_str() {
            "process_batch" => {
                // Update batch status
                self.update_batch_status(&message.batch_id, "pending_review")
                    .await?;

                // Notify completion
                self.publish_batch_ready(&message).await?;
            }
            "finalize_batch" => {
                // Move approved products to production
                self.finalize_batch(&message).await?;

                // Update batch status
                self.update_batch_status(&message.batch_id, "completed")
                    .await?;
            }
            _ => {
                warn!("Unknown batch action: {}", message.action);
            }
        }

        Ok(())
    }

    async fn finalize_batch(&self, message: &BatchProcessMessage) -> AppResult<()> {
        info!("Finalizing batch: {}", message.batch_id);

        // Get approved products from staging
        let _query = format!(
            r#"
            SELECT
                sync_id,
                platform_product_id,
                product_data,
                user_action,
                merged_with_product_id
            FROM product_sync
            WHERE sync_batch_id = '{}'
              AND user_action IN ('approved', 'auto_approved', 'merged', 'auto_merged')
            "#,
            message.batch_id
        );

        // Move products to production table
        // This is simplified - in production would parse and insert properly
        let move_query = format!(
            r#"
            INSERT INTO product (
                product_id,
                platform,
                platform_shop_id,
                platform_product_id,
                title,
                price,
                inventory,
                created_time,
                last_updated
            )
            SELECT
                generateUUIDv4() as product_id,
                platform,
                toUInt64(shop_id) as platform_shop_id,
                platform_product_id,
                JSONExtractString(product_data, 'title') as title,
                JSONExtractFloat(product_data, 'price') as price,
                JSONExtractUInt(product_data, 'quantity') as inventory,
                now() as created_time,
                now() as last_updated
            FROM product_sync
            WHERE sync_batch_id = '{}'
              AND user_action IN ('approved', 'auto_approved')
            "#,
            message.batch_id
        );

        let client = &self.state.clickhouse;
        client
            .execute_with_retry(&move_query)
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to finalize batch: {}", e)))?;

        info!("Batch {} finalized", message.batch_id);
        Ok(())
    }

    async fn update_batch_status(&self, batch_id: &str, status: &str) -> AppResult<()> {
        let query = format!(
            r#"
            ALTER TABLE product_sync_batch
            UPDATE
                status = '{}',
                completed_at = CASE WHEN '{}' = 'completed' THEN now() ELSE completed_at END
            WHERE batch_id = '{}'
            "#,
            status, status, batch_id
        );

        self.state
            .clickhouse
            .execute_with_retry(&query)
            .await
            .map_err(|e| {
                AppError::DatabaseError(format!("Failed to update batch status: {}", e))
            })?;

        Ok(())
    }

    async fn publish_batch_ready(&self, message: &BatchProcessMessage) -> AppResult<()> {
        let ready_message = serde_json::json!({
            "batch_id": message.batch_id,
            "tenant_id": message.tenant_id,
            "shop_id": message.shop_id,
            "status": "ready_for_review",
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });

        let payload = serde_json::to_vec(&ready_message)?;

        {
            let queue = &self.state.queue;
            queue
                .publish_bytes("ecommerce.product.sync.batch.ready", payload)
                .await
                .map_err(|e| {
                    AppError::QueueError(format!("Failed to publish ready message: {}", e))
                })?;
        }

        info!(
            "Published batch ready notification for batch {}",
            message.batch_id
        );

        Ok(())
    }
}

async fn process_batch_message(state: Arc<AppState>, msg: QueueMessage) -> Result<()> {
    let payload = msg.payload.clone();
    let message: BatchProcessMessage = serde_json::from_value(payload)
        .map_err(|e| anyhow::anyhow!("Failed to deserialize batch message: {}", e))?;

    info!(
        message_id = %msg.id,
        "Processing batch job {} with action {}",
        message.batch_id,
        message.action
    );

    let worker = BatchProcessorWorker::new(state);

    match worker.process_batch(message.clone()).await {
        Ok(_) => {
            info!("Batch job {} completed successfully", message.batch_id);
            Ok(())
        }
        Err(e) => {
            error!("Batch job {} failed: {}", message.batch_id, e);
            Err(anyhow::anyhow!("Batch processing failed: {}", e))
        }
    }
}

#[async_trait]
impl Worker for BatchProcessorWorker {
    async fn start(&self) -> AppResult<()> {
        info!("Starting batch processor worker");

        self.setup_subscription()
            .await
            .map_err(|e| AppError::QueueError(e.to_string()))?;

        // Wait for shutdown signal
        tokio::signal::ctrl_c()
            .await
            .map_err(|e| AppError::InternalError(e.to_string()))?;

        Ok(())
    }

    async fn stop(&self) -> AppResult<()> {
        info!("Stopping batch processor worker");
        Ok(())
    }

    async fn process_job(&self, job_data: Vec<u8>) -> AppResult<()> {
        let message: BatchProcessMessage = serde_json::from_slice(&job_data).map_err(|e| {
            AppError::SerializationError(format!("Failed to deserialize batch message: {}", e))
        })?;

        info!(
            "Processing batch job {} with action {}",
            message.batch_id, message.action
        );

        match self.process_batch(message.clone()).await {
            Ok(_) => {
                info!("Batch job {} completed successfully", message.batch_id);
                Ok(())
            }
            Err(e) => {
                error!("Batch job {} failed: {}", message.batch_id, e);
                Err(e)
            }
        }
    }
}
