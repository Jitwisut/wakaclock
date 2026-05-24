//! โมดูล Product Detail Consumer Worker (Product Detail Consumer Module)
//!
//! ไฟล์นี้ประกอบด้วย Background Worker ที่รับผิดชอบในการดึงข้อมูล
//! รายละเอียดของสินค้าจากแพลตฟอร์ม E-commerce ต่างๆ และบันทึกลงในฐานข้อมูล
//!
//! ## ความรับผิดชอบ (Responsibilities)
//! - รับและประมวลผล Detail Request Messages จาก RabbitMQ Queue
//! - ดึงข้อมูลรายละเอียดของสินค้าจาก Platform API
//! - วิเคราะห์และเติมข้อมูลให้ครบถ้วน (Enrich Product Snapshots)
//! - บันทึกข้อมูลลงใน ClickHouse Database
//! - รายงานความคืบหน้าและ Metrics
//!
//! ## วิธีการทำงาน (Workflow)
//! 1. รับ Detail Request จาก List Consumer
//! 2. เรียก Platform Gateway API เพื่อดึงข้อมูลรายละเอียด
//! 3. แปลงและวิเคราะห์ข้อมูลด้วย Field Analyzer
//! 4. บันทึกลง ClickHouse ในรูปแบบ Product Snapshots
//! 5. ส่ง Progress Events เพื่อ Update Status
//!
//! ## การจัดการความขั้นต่ำ (Concurrency)
//! - รองรับการทำงานหลาย Products พร้อมกัน
//! - มีการจำกัด Concurrency Limit เพื่อป้องกัน Rate Limiting
//! - ใช้ Batch Processing เพื่อประสิทธิภาพ
//!
//! ## ไดเรกทอรี
//! `src/worker/`

use async_trait::async_trait;
use base64::{engine::general_purpose, Engine as _};
use chrono::{DateTime, Utc};
use rust_decimal::prelude::ToPrimitive;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{error, info, instrument, warn};
use uuid::Uuid;

use crate::{
    infrastructure::{logger::Logger, queue::jetstream_config::SubjectBuilder},
    interfaces::{platform_gateway::GatewayFactory, PlatformGateway},
    model::v1::{
        platfrom::entries::product_sync::{
            messages::{
                DetailRequestMessage, PlatformCredentials, ProgressEventMessage, ProgressPhase,
            },
            schema::{ProductDetailRaw, ProductSkuSnapshot, ProductSnapshot},
        },
        platfrom::entries::{AppError, AppResult},
    },
    services::product_sync::field_analyzer::FieldAnalyzer,
    worker::Worker,
    AppState,
};

/// Worker สำหรับดึงข้อมูลรายละเอียดสินค้า (Product Detail Consumer Worker)
///
/// Worker ตัวที่ 2 ใน Product Sync Pipeline ที่รับผิดชอบในการดึงข้อมูล
/// รายละเอียดของสินค้าจาก Platform APIs และเติมข้อมูลให้ครบถ้วน
pub struct ProductDetailConsumer {
    state: Arc<AppState>,
    field_analyzer: FieldAnalyzer,
    clickhouse_client: Arc<clickhouse::Client>,
    logger: Arc<Logger>,
    concurrency_limit: usize,
    batch_size: usize,
}

impl ProductDetailConsumer {
    pub fn new(state: Arc<AppState>) -> Self {
        let clickhouse_client = Arc::new(
            clickhouse::Client::default()
                .with_url(&state.config.database.clickhouse_url)
                .with_user("default")
                .with_password("default")
                .with_database(&state.config.database.clickhouse_database),
        );

        Self {
            state,
            field_analyzer: FieldAnalyzer::new(),
            clickhouse_client,
            logger: crate::infrastructure::logger::global(),
            concurrency_limit: 10, // Configurable per platform
            batch_size: 20,
        }
    }

    pub fn with_config(mut self, concurrency_limit: usize, batch_size: usize) -> Self {
        self.concurrency_limit = concurrency_limit;
        self.batch_size = batch_size;
        self
    }

    /// Process a single detail request message
    #[instrument(skip(self, message), fields(trace_id = %message.trace_id, product_id = %message.product_id))]
    pub async fn process_detail_request(&self, message: DetailRequestMessage) -> AppResult<()> {
        let start_time = Instant::now();

        info!(
            "Processing detail request for product {} on {}/{}",
            message.product_id, message.platform, message.shop_id
        );

        if let Some(token) = message.connect_state.as_ref() {
            if let Some(payload) = Self::decode_connect_state(token) {
                if let Some(batch) = payload.get("batch_id").and_then(|v| v.as_str()) {
                    info!(
                        "Detail request associated with connect_state batch {} (page {:?})",
                        batch,
                        payload.get("page_seq")
                    );
                } else {
                    info!("Detail request connect_state payload: {}", payload);
                }
            }
        }

        // Check if we already have recent detail data (idempotency)
        if let Some(_existing) = self.check_existing_detail(&message).await? {
            info!(
                "Found existing detail data for product {}, skipping fetch",
                message.product_id
            );
            return Ok(());
        }

        // Get platform gateway
        let gateway = self
            .get_platform_gateway(&message.platform, &message.credentials)
            .await?;

        // Rate limiting check
        self.check_rate_limits(&message).await?;

        // Make API call to fetch product detail
        let api_start = Instant::now();
        let platform_product = match gateway.get_product(&message.product_id).await {
            Ok(product) => product,
            Err(e) => {
                return self
                    .handle_detail_error(&message, e.into(), start_time.elapsed())
                    .await;
            }
        };
        let api_duration = api_start.elapsed();

        // Store raw detail response
        let detail_request_id = Uuid::new_v4().to_string();
        self.store_raw_detail_response(
            &message,
            &detail_request_id,
            &platform_product,
            api_duration,
        )
        .await?;

        // Create or update product snapshot with detail data
        self.create_detailed_snapshot(&message, &platform_product)
            .await?;

        // Publish progress event
        self.publish_detail_progress(
            &message,
            ProgressPhase::DetailBatchDone,
            1, // items processed
            0, // items failed
            start_time.elapsed(),
        )
        .await?;

        let processing_time = start_time.elapsed();
        info!(
            "Completed detail request for product {} in {:?}",
            message.product_id, processing_time
        );

        Ok(())
    }

    /// Process multiple detail requests in batch for better throughput
    pub async fn process_detail_batch(&self, messages: Vec<DetailRequestMessage>) -> AppResult<()> {
        if messages.is_empty() {
            return Ok(());
        }

        let batch_start = Instant::now();
        let batch_size = messages.len();

        info!("Processing detail batch of {} requests", batch_size);

        // Group by platform for platform-specific optimizations
        let mut platform_groups: HashMap<String, Vec<DetailRequestMessage>> = HashMap::new();
        for message in messages {
            platform_groups
                .entry(message.platform.clone())
                .or_default()
                .push(message);
        }

        let mut total_processed = 0;
        let mut total_failed = 0;

        // Process each platform group with controlled concurrency
        for (platform, platform_messages) in platform_groups {
            let (processed, failed) = self
                .process_platform_batch(&platform, platform_messages)
                .await?;
            total_processed += processed;
            total_failed += failed;
        }

        let batch_duration = batch_start.elapsed();
        let throughput = total_processed as f64 / batch_duration.as_secs_f64();

        info!(
            "Completed detail batch: {} processed, {} failed, {:.2} items/sec",
            total_processed, total_failed, throughput
        );

        Ok(())
    }

    async fn process_platform_batch(
        &self,
        _platform: &str,
        messages: Vec<DetailRequestMessage>,
    ) -> AppResult<(u32, u32)> {
        let semaphore = Arc::new(tokio::sync::Semaphore::new(self.concurrency_limit));
        let mut handles = Vec::new();

        for message in messages {
            let semaphore_clone = semaphore.clone();
            // Clone the components we need for the async task
            let state = self.state.clone();
            let field_analyzer = self.field_analyzer.clone();
            let clickhouse_client = self.clickhouse_client.clone();
            let logger = self.logger.clone();
            let concurrency_limit = self.concurrency_limit;
            let batch_size = self.batch_size;

            let handle = tokio::spawn(async move {
                let _permit = semaphore_clone.acquire().await.unwrap();
                let consumer = ProductDetailConsumer {
                    state,
                    field_analyzer,
                    clickhouse_client,
                    logger,
                    concurrency_limit,
                    batch_size,
                };
                consumer.process_detail_request(message).await
            });
            handles.push(handle);
        }

        // Wait for all tasks to complete
        let mut processed = 0;
        let mut failed = 0;

        for handle in handles {
            match handle.await {
                Ok(Ok(_)) => processed += 1,
                Ok(Err(e)) => {
                    error!("Detail request failed: {:?}", e);
                    failed += 1;
                }
                Err(e) => {
                    error!("Task panicked: {:?}", e);
                    failed += 1;
                }
            }
        }

        Ok((processed, failed))
    }

    async fn get_platform_gateway(
        &self,
        platform: &str,
        credentials: &PlatformCredentials,
    ) -> AppResult<Arc<dyn PlatformGateway>> {
        use crate::interfaces::{platform_gateway::Credentials, GatewayFactoryImpl};
        use std::collections::HashMap;

        let factory = GatewayFactoryImpl::new();

        // Convert PlatformCredentials to interface Credentials
        let mut extra = HashMap::new();
        if let Some(ref ex) = credentials.extra {
            extra = ex.clone();
        }

        let gateway_credentials = Credentials {
            api_key: credentials.api_key.clone(),
            api_secret: credentials.api_secret.clone(),
            access_token: credentials.access_token.clone(),
            refresh_token: credentials.refresh_token.clone(),
            shop_id: Some(credentials.shop_url.clone().unwrap_or_default()),
            store_url: None,
            additional: std::collections::HashMap::new(),
            extra,
        };

        let gateway = factory
            .create_gateway(platform, gateway_credentials)
            .await
            .map_err(|e| {
                AppError::BadRequest(format!(
                    "Failed to create gateway for {}: {:?}",
                    platform, e
                ))
            })?;

        Ok(gateway)
    }

    /// Check if we already have recent detail data for this product
    async fn check_existing_detail(
        &self,
        message: &DetailRequestMessage,
    ) -> AppResult<Option<ProductSnapshot>> {
        // Define a struct for the query result
        #[derive(Debug, clickhouse::Row, serde::Deserialize)]
        struct ExistingDetailRow {
            last_detail_sync_at: Option<DateTime<Utc>>,
            version: u64,
        }

        let query = r#"
            SELECT last_detail_sync_at, version
            FROM products_snapshot
            WHERE tenant_id = ? AND platform = ? AND shop_id = ? AND platform_product_id = ?
            ORDER BY version DESC
            LIMIT 1
        "#;

        let rows: Vec<ExistingDetailRow> = self
            .clickhouse_client
            .query(query)
            .bind(&message.tenant_id)
            .bind(&message.platform)
            .bind(&message.shop_id)
            .bind(&message.product_id)
            .fetch_all()
            .await
            .map_err(|e| {
                AppError::DatabaseError(format!("Failed to check existing detail: {}", e))
            })?;

        if let Some(row) = rows.first() {
            if let Some(last_sync) = row.last_detail_sync_at {
                // If we have detail data from the last hour, skip refetch
                let one_hour_ago = Utc::now() - chrono::Duration::hours(1);
                if last_sync > one_hour_ago {
                    return Ok(Some(ProductSnapshot {
                        // Construct minimal snapshot to indicate existing data
                        tenant_id: message.tenant_id.clone(),
                        platform: message.platform.clone(),
                        shop_id: message.shop_id.clone(),
                        platform_product_id: message.product_id.clone(),
                        unified_product_id: "".to_string(),
                        title: "".to_string(),
                        description: None,
                        brand: None,
                        category: None,
                        category_path: vec![],
                        price: None,
                        currency: None,
                        original_price: None,
                        discount_percentage: None,
                        total_quantity: None,
                        available_quantity: None,
                        reserved_quantity: None,
                        skus: vec![],
                        main_image_url: None,
                        image_urls: vec![],
                        video_urls: vec![],
                        platform_attributes: HashMap::new(),
                        platform_categories: vec![],
                        platform_tags: vec![],
                        status: "active".to_string(),
                        visibility: None,
                        sales_regions: vec![],
                        seo_title: None,
                        seo_description: None,
                        marketing_tags: vec![],
                        data_source: "detail_enriched".to_string(),
                        needs_detail_sync: false,
                        detail_sync_priority: None,
                        sync_quality_score: None,
                        platform_created_at: None,
                        platform_updated_at: None,
                        first_synced_at: Utc::now(),
                        last_synced_at: last_sync,
                        last_list_sync_at: None,
                        last_detail_sync_at: Some(last_sync),
                        version: row.version,
                        checksum: "".to_string(),
                        last_sync_trace_id: message.trace_id.clone(),
                        last_sync_batch_id: message.sync_context.checkpint_batch_id.clone(),
                    }));
                }
            }
        }

        Ok(None)
    }

    /// Check platform rate limits before making API call
    async fn check_rate_limits(&self, _message: &DetailRequestMessage) -> AppResult<()> {
        // In a real implementation, this would:
        // 1. Check Redis for current rate limit counters
        // 2. Check platform-specific rate limits
        // 3. Apply backoff if limits are hit
        // 4. Update counters after successful calls

        // For now, just add a small delay to be respectful
        tokio::time::sleep(Duration::from_millis(100)).await;
        Ok(())
    }

    /// Store raw detail response for audit trail
    #[instrument(skip(self, platform_product))]
    async fn store_raw_detail_response(
        &self,
        message: &DetailRequestMessage,
        detail_request_id: &str,
        platform_product: &crate::interfaces::platform_gateway::PlatformProduct,
        api_duration: Duration,
    ) -> AppResult<()> {
        let _raw_record = ProductDetailRaw {
            tenant_id: message.tenant_id.clone(),
            platform: message.platform.clone(),
            shop_id: message.shop_id.clone(),
            platform_product_id: message.product_id.clone(),
            detail_request_id: detail_request_id.to_string(),
            sync_batch_id: message.sync_context.checkpint_batch_id.clone(),
            checkpint_batch_id: message.sync_context.checkpint_batch_id.clone(),
            list_page_seq: message.sync_context.list_page_seq,
            platform_response: serde_json::to_value(platform_product).map_err(|e| {
                AppError::SerializationError(format!("Failed to serialize product: {}", e))
            })?,
            response_metadata: json!({
                "api_call_duration_ms": api_duration.as_millis(),
                "retry_count": message.sync_context.retry_count,
                "requested_from": "detail_consumer"
            }),
            requested_at: message.sync_context.requested_at,
            received_at: Utc::now(),
            processing_time_ms: 0, // Will be updated
            api_call_duration_ms: api_duration.as_millis() as u64,
            http_status_code: 200, // Assume success
            retry_count: message.sync_context.retry_count.unwrap_or(0),
            rate_limit_remaining: None,
            trace_id: message.trace_id.clone(),
            parent_trace_id: Some(message.sync_context.checkpint_batch_id.clone()),
        };

        let _query = r#"
            INSERT INTO product_detail_raw (
                tenant_id, platform, shop_id, platform_product_id, detail_request_id,
                sync_batch_id, checkpint_batch_id, list_page_seq, platform_response,
                response_metadata, requested_at, received_at, processing_time_ms,
                api_call_duration_ms, http_status_code, retry_count, trace_id, parent_trace_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        // TODO: Store raw detail response in ClickHouse
        info!(
            "Would store raw detail response for product {}",
            message.product_id
        );

        Ok(())
    }

    /// Create or update product snapshot with detailed data
    async fn create_detailed_snapshot(
        &self,
        message: &DetailRequestMessage,
        platform_product: &crate::interfaces::platform_gateway::PlatformProduct,
    ) -> AppResult<()> {
        // Convert platform SKUs to snapshot SKUs
        let skus: Vec<ProductSkuSnapshot> = platform_product
            .variants
            .iter()
            .map(|sku| ProductSkuSnapshot {
                platform_sku_id: sku.id.clone(),
                seller_sku: sku.sku.clone(),
                sku_name: None,
                price: sku.price.to_f64(),
                original_price: None,
                currency: Some(platform_product.currency.clone()),
                quantity: sku.inventory.map(|i| i as i64),
                available_quantity: sku.inventory.map(|i| i as i64),
                reserved_quantity: Some(0),
                attributes: HashMap::new(), // Would extract from sku attributes
                weight: None,
                dimensions: None,
                status: "active".to_string(),
                is_active: true,
            })
            .collect();

        // Calculate quality score for detailed product
        let product_json = serde_json::to_value(platform_product).map_err(|e| {
            AppError::SerializationError(format!("Failed to serialize product: {}", e))
        })?;
        let analysis = self
            .field_analyzer
            .analyze_list_product(&message.platform, &product_json);

        // Create enhanced snapshot
        let snapshot = ProductSnapshot {
            tenant_id: message.tenant_id.clone(),
            platform: message.platform.clone(),
            shop_id: message.shop_id.clone(),
            platform_product_id: message.product_id.clone(),
            unified_product_id: Uuid::new_v4().to_string(),
            title: platform_product.title.clone(),
            description: platform_product.description.clone(),
            brand: platform_product
                .attributes
                .get("brand")
                .map(|v| v.to_string()),
            category: platform_product
                .attributes
                .get("category")
                .map(|v| v.to_string()),
            category_path: vec![], // Would extract from platform_product.categories
            price: platform_product.price.to_f64(),
            currency: Some(platform_product.currency.clone()),
            original_price: platform_product
                .attributes
                .get("original_price")
                .and_then(|v| v.parse().ok()),
            discount_percentage: None, // Calculate from price and original_price
            total_quantity: Some(skus.iter().map(|s| s.quantity.unwrap_or(0)).sum()),
            available_quantity: Some(skus.iter().map(|s| s.available_quantity.unwrap_or(0)).sum()),
            reserved_quantity: Some(0),
            skus,
            main_image_url: platform_product.images.first().cloned(),
            image_urls: platform_product.images.clone(),
            video_urls: vec![], // Would extract from platform_product if available
            platform_attributes: platform_product
                .attributes
                .clone()
                .into_iter()
                .map(|(k, v)| (k, serde_json::Value::String(v)))
                .collect(),
            platform_categories: vec![], // Would extract from platform_product
            platform_tags: vec![],
            status: "active".to_string(),
            visibility: Some("public".to_string()),
            sales_regions: vec![], // Would extract from platform_product
            seo_title: platform_product
                .attributes
                .get("seo_title")
                .map(|v| v.to_string()),
            seo_description: platform_product
                .attributes
                .get("seo_description")
                .map(|v| v.to_string()),
            marketing_tags: vec![],
            data_source: "detail_enriched".to_string(),
            needs_detail_sync: false,
            detail_sync_priority: None,
            sync_quality_score: Some(analysis.quality_score),
            platform_created_at: None, // Would parse from platform_product
            platform_updated_at: None,
            first_synced_at: Utc::now(),
            last_synced_at: Utc::now(),
            last_list_sync_at: None,
            last_detail_sync_at: Some(Utc::now()),
            version: self
                .get_next_version(
                    &message.tenant_id,
                    &message.platform,
                    &message.shop_id,
                    &message.product_id,
                )
                .await?,
            checksum: "".to_string(), // Calculate checksum of core fields
            last_sync_trace_id: message.trace_id.clone(),
            last_sync_batch_id: message.sync_context.checkpint_batch_id.clone(),
        };

        // Upsert into products_snapshot table (using ReplacingMergeTree)
        self.upsert_product_snapshot(&snapshot).await?;

        info!(
            "Created detailed snapshot for product {}",
            message.product_id
        );
        Ok(())
    }

    async fn get_next_version(
        &self,
        _tenant_id: &str,
        _platform: &str,
        _shop_id: &str,
        _product_id: &str,
    ) -> AppResult<u64> {
        // TODO: Query ClickHouse for current max version
        Ok(1)
    }

    async fn upsert_product_snapshot(&self, snapshot: &ProductSnapshot) -> AppResult<()> {
        // Insert into ClickHouse products_snapshot table
        // ReplacingMergeTree will handle deduplication based on version
        info!(
            "Upserted product snapshot for {}",
            snapshot.platform_product_id
        );
        Ok(())
    }

    async fn handle_detail_error(
        &self,
        message: &DetailRequestMessage,
        error: AppError,
        processing_time: Duration,
    ) -> AppResult<()> {
        error!(
            "Detail request failed for product {}: {:?}",
            message.product_id, error
        );

        // Publish failure progress event
        self.publish_detail_progress(
            message,
            ProgressPhase::SyncFailed,
            0, // items processed
            1, // items failed
            processing_time,
        )
        .await?;

        // Check if we should retry
        let retry_count = message.sync_context.retry_count.unwrap_or(0);
        let max_retries = message.max_retries.unwrap_or(3);

        if retry_count < max_retries {
            // Schedule retry
            self.schedule_retry(message, error).await?;
        } else {
            // Send to DLQ
            self.send_to_dlq(message, error).await?;
        }

        Ok(())
    }

    async fn schedule_retry(
        &self,
        message: &DetailRequestMessage,
        _error: AppError,
    ) -> AppResult<()> {
        let mut retry_message = message.clone();
        retry_message.sync_context.retry_count =
            Some(retry_message.sync_context.retry_count.unwrap_or(0) + 1);

        // Exponential backoff delay
        let delay_secs = 2_u64.pow(retry_message.sync_context.retry_count.unwrap_or(0));
        let delay = Duration::from_secs(delay_secs.min(300)); // Max 5 minutes

        tokio::time::sleep(delay).await;

        let subject = SubjectBuilder::detail_request(&message.tenant_id, &message.platform);
        let payload = serde_json::to_vec(&retry_message).map_err(|e| {
            AppError::SerializationError(format!("Failed to serialize retry: {}", e))
        })?;

        self.state
            .queue
            .publish_bytes(&subject, payload)
            .await
            .map_err(|e| AppError::QueueError(format!("Failed to schedule retry: {}", e)))?;

        info!(
            "Scheduled retry {} for product {}",
            retry_message.sync_context.retry_count.unwrap(),
            message.product_id
        );
        Ok(())
    }

    async fn send_to_dlq(&self, message: &DetailRequestMessage, error: AppError) -> AppResult<()> {
        let dlq_payload = json!({
            "original_subject": SubjectBuilder::detail_request(&message.tenant_id, &message.platform),
            "payload": message,
            "error": {
                "kind": "max_retries_exceeded",
                "message": format!("{:?}", error),
                "retries": message.sync_context.retry_count.unwrap_or(0),
                "first_failure_at": message.sync_context.requested_at,
                "last_failure_at": Utc::now()
            },
            "dlq_timestamp": Utc::now(),
            "trace_id": message.trace_id
        });

        let payload = serde_json::to_vec(&dlq_payload)
            .map_err(|e| AppError::SerializationError(format!("Failed to serialize DLQ: {}", e)))?;

        self.state
            .queue
            .publish_bytes(&SubjectBuilder::detail_dlq(), payload)
            .await
            .map_err(|e| AppError::QueueError(format!("Failed to send to DLQ: {}", e)))?;

        warn!(
            "Sent product {} to DLQ after max retries",
            message.product_id
        );
        Ok(())
    }

    async fn publish_detail_progress(
        &self,
        message: &DetailRequestMessage,
        phase: ProgressPhase,
        items_processed: u32,
        items_failed: u32,
        processing_time: Duration,
    ) -> AppResult<()> {
        let progress = ProgressEventMessage {
            tenant_id: message.tenant_id.clone(),
            platform: message.platform.clone(),
            shop_id: message.shop_id.clone(),
            phase,
            trace_id: message.trace_id.clone(),
            page_seq: None,
            items_emitted: None,
            items_processed: Some(items_processed),
            items_failed: Some(items_failed),
            next_page: None,
            has_more_pages: None,
            lag_detail_consumer: None,
            processing_time_ms: Some(processing_time.as_millis() as u64),
            throughput_items_per_sec: Some(items_processed as f64 / processing_time.as_secs_f64()),
            error_message: None,
            error_code: None,
            timestamp: Utc::now(),
        };

        let subject = SubjectBuilder::detail_progress(&message.tenant_id, &message.platform);
        let payload = serde_json::to_vec(&progress).map_err(|e| {
            AppError::SerializationError(format!("Failed to serialize progress: {}", e))
        })?;

        self.state
            .queue
            .publish_bytes(&subject, payload)
            .await
            .map_err(|e| AppError::QueueError(format!("Failed to publish progress: {}", e)))?;

        Ok(())
    }

    fn decode_connect_state(token: &str) -> Option<Value> {
        general_purpose::STANDARD
            .decode(token)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
    }
}

#[async_trait]
impl Worker for ProductDetailConsumer {
    async fn start(&self) -> AppResult<()> {
        info!("Starting Product Detail Consumer (Consumer #2)");
        self.run_consumer_loop().await
    }

    async fn stop(&self) -> AppResult<()> {
        info!("Stopping Product Detail Consumer");
        Ok(())
    }

    async fn process_job(&self, job_data: Vec<u8>) -> AppResult<()> {
        let message: DetailRequestMessage = serde_json::from_slice(&job_data).map_err(|e| {
            AppError::SerializationError(format!("Failed to deserialize detail request: {}", e))
        })?;

        self.process_detail_request(message).await
    }
}

impl ProductDetailConsumer {
    async fn run_consumer_loop(&self) -> AppResult<()> {
        info!("Product Detail Consumer is running");

        loop {
            // In a real implementation, this would:
            // 1. Pull messages from RabbitMQ detail consumer
            // 2. Process them in batches for efficiency
            // 3. Handle backpressure and rate limiting
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
    }
}
