//! ไฟล์ product_list_consumer.rs - Worker สำหรับการประมวลผล product list requests
//! จัดการการดึงรายการสินค้าจาก e-commerce platforms แบบแบ่งหน้า (pagination)
//! วิเคราะห์ข้อมูลสินค้าและตัดสินใจว่าต้องการ detail fetch หรือไม่
//! รองรับ RabbitMQ messaging และ field analysis สำหรับ data quality

use async_trait::async_trait;
use base64::{engine::general_purpose, Engine as _};
use chrono::Utc;
use rust_decimal::prelude::ToPrimitive;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{error, info, instrument};
use uuid::Uuid;

use crate::{
    client::ecommerce::connector::{ConnectContext, StateEnvelope, StateFlavor},
    infrastructure::queue::{jetstream_config::SubjectBuilder, MessageQueueExt},
    interfaces::{platform_gateway::GatewayFactory, PlatformGateway},
    model::v1::{
        platfrom::entries::product_sync::{
            messages::{
                DetailRequestMessage, ListRequestMessage, PaginationMode, PlatformCredentials,
                ProgressEventMessage, ProgressPhase, SyncContext,
            },
            schema::{ProductListRaw, ProductSnapshot},
        },
        platfrom::entries::{AppError, AppResult},
    },
    services::product_sync::field_analyzer::{FieldAnalysis, FieldAnalyzer},
    worker::Worker,
    AppState,
};

/// ProductListConsumer - Worker หมายเลข 1 สำหรับการประมวลผล product list requests
/// จัดการการดึงรายการสินค้าแบบ pagination และตัดสินใจว่าสินค้าไหนต้องการ detail fetch
/// ใช้ FieldAnalyzer ในการวิเคราะห์คุณภาพข้อมูลและความจำเป็นในการดึง detail
pub struct ProductListConsumer {
    /// AppState ที่ใช้ร่วมกันทั้งแอพพลิเคชัน
    state: Arc<AppState>,

    /// ตัววิเคราะห์ fields เพื่อตัดสินใจ detail fetch
    field_analyzer: FieldAnalyzer,
}

impl ProductListConsumer {
    /// สร้าง ProductListConsumer instance ใหม่
    /// ใช้ AppState ที่ส่งเข้ามาและสร้าง FieldAnalyzer ใหม่
    pub fn new(state: Arc<AppState>) -> Self {
        Self {
            state,
            field_analyzer: FieldAnalyzer::new(),
        }
    }

    /// ประมวลผล list request message เดี่ยว
    /// ทำการดึงรายการสินค้าจาก platform API แล้ววิเคราะห์ข้อมูล
    #[instrument(skip(self, message), fields(trace_id = %message.trace_id))]
    pub async fn process_list_request(&self, mut message: ListRequestMessage) -> AppResult<()> {
        let start_time = Instant::now();

        info!(
            "Processing list request for {}/{} (batch: {:?})",
            message.platform, message.shop_id, message.batch_id
        );

        let batch_id = message
            .batch_id
            .clone()
            .unwrap_or_else(|| format!("batch_{}", Uuid::new_v4()));

        if message.connect_state.is_none() {
            let state_token = Self::build_connect_state_token(&message, &batch_id)?;
            message.connect_state = Some(state_token);
        }

        let list_request_id = message
            .connect_state
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let connect_state_payload = message
            .connect_state
            .as_ref()
            .and_then(|token| Self::decode_connect_state(token));

        if let Some(payload) = &connect_state_payload {
            if let Some(batch) = payload.get("batch_id").and_then(|v| v.as_str()) {
                info!(
                    "Decoded connect state for batch {} (page {:?})",
                    batch, message.page_seq
                );
            } else {
                info!(
                    "Decoded connect state payload for shop {}: {}",
                    message.shop_id, payload
                );
            }
        }

        self.update_sync_stats(&message, &batch_id, "running", None)
            .await?;

        // Get platform gateway
        let gateway = self
            .get_platform_gateway(&message.platform, &message.credentials)
            .await?;

        // Build pagination parameters based on mode
        let pagination_params = self.build_pagination_params(&message)?;

        // Make API call to platform
        let api_start = Instant::now();
        let platform_response = gateway
            .list_products(&pagination_params)
            .await
            .map_err(|e| {
                error!("Platform API call failed: {:?}", e);
                AppError::ExternalServiceError(format!("Platform API failed: {:?}", e))
            })?;
        let api_duration = api_start.elapsed();

        // Store raw list response
        self.store_raw_list_response(
            &message,
            &list_request_id,
            &batch_id,
            &platform_response,
            api_duration,
        )
        .await?;

        // Process products and decide detail needs
        let mut products_list_only = 0;
        let mut products_detail_needed = 0;
        let mut detail_requests = Vec::new();

        for platform_product in platform_response.products.iter() {
            let product_json = serde_json::to_value(platform_product).map_err(|e| {
                AppError::SerializationError(format!("Failed to serialize product: {}", e))
            })?;

            // Analyze if detail fetch is needed
            let analysis = self
                .field_analyzer
                .analyze_list_product(&message.platform, &product_json);

            if analysis.needs_detail_fetch {
                // Create detail request
                let detail_request = DetailRequestMessage::new(
                    message.tenant_id.clone(),
                    message.platform.clone(),
                    message.shop_id.clone(),
                    platform_product.id.clone(),
                    SyncContext {
                        checkpint_batch_id: batch_id.clone(),
                        requested_at: Utc::now(),
                        list_page_seq: message.page_seq,
                        retry_count: Some(0),
                    },
                    message.credentials.clone(),
                )
                .with_connect_state(message.connect_state.clone());

                let _priority = self.field_analyzer.calculate_detail_priority(&analysis);
                detail_requests.push(detail_request.with_retry_config(3, 1000));
                products_detail_needed += 1;
            } else {
                // Create snapshot directly from list data
                self.create_snapshot_from_list(&message, &batch_id, platform_product, &analysis)
                    .await?;
                products_list_only += 1;
            }
        }

        // Publish detail requests directly to RabbitMQ
        if !detail_requests.is_empty() {
            self.publish_detail_requests(detail_requests).await?;
        }

        // Check if more pages exist
        let has_more = platform_response.has_more;
        let next_page_token = platform_response.next_cursor.clone();

        // Publish progress event
        self.publish_progress_event(
            &message,
            ProgressPhase::ListPageDone,
            message.page_seq.unwrap_or(1),
            platform_response.products.len() as u32,
            has_more,
            next_page_token.as_ref(),
        )
        .await?;

        // Queue next page if needed
        if has_more && message.sync_type == "full" {
            self.queue_next_page(&message, &batch_id, next_page_token)
                .await?;
        }

        // Update sync stats
        let processing_time = start_time.elapsed();
        let throughput = platform_response.products.len() as f64 / processing_time.as_secs_f64();

        self.update_sync_stats_completion(
            &message,
            &batch_id,
            platform_response.products.len() as u32,
            products_list_only,
            products_detail_needed,
            throughput,
            !has_more,
        )
        .await?;

        info!(
            "Completed list request processing: {} products ({} list-only, {} need detail) in {:?}",
            platform_response.products.len(),
            products_list_only,
            products_detail_needed,
            processing_time
        );

        Ok(())
    }

    async fn get_platform_gateway(
        &self,
        platform: &str,
        credentials: &PlatformCredentials,
    ) -> AppResult<Arc<dyn PlatformGateway>> {
        use crate::interfaces::{platform_gateway::Credentials, GatewayFactoryImpl};

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

    fn build_pagination_params(
        &self,
        message: &ListRequestMessage,
    ) -> AppResult<crate::interfaces::platform_gateway::ListProductParams> {
        let mut params = crate::interfaces::platform_gateway::ListProductParams {
            shop_id: Some(message.shop_id.clone()),
            limit: None,
            offset: None,
            status: None,
            search: None,
            page: None,
            sort: None,
        };

        // Set pagination parameters based on mode
        match &message.pagination_mode {
            PaginationMode::Offset { limit } => {
                params.limit = limit.map(|l| l as u32).or(Some(100));
                params.offset = message.offset.map(|o| o as u32).or(Some(0));
            }
            PaginationMode::Cursor { cursor: _ } => {
                params.limit = Some(100);
                // Cursor will be handled in platform-specific way
            }
            PaginationMode::Token { token: _ } => {
                params.limit = Some(100);
                // Token will be handled in platform-specific way
            }
        }

        Ok(params)
    }

    #[instrument(skip(self, platform_response))]
    async fn store_raw_list_response(
        &self,
        message: &ListRequestMessage,
        list_request_id: &str,
        batch_id: &str,
        platform_response: &crate::interfaces::platform_gateway::ProductList,
        api_duration: Duration,
    ) -> AppResult<()> {
        let _raw_record = ProductListRaw {
            tenant_id: message.tenant_id.clone(),
            platform: message.platform.clone(),
            shop_id: message.shop_id.clone(),
            sync_batch_id: batch_id.to_string(),
            list_request_id: list_request_id.to_string(),
            page_seq: message.page_seq.unwrap_or(1),
            page_token: message.page_token.clone(),
            cursor: message.cursor.clone(),
            offset: message.offset.map(|o| o as u64),
            limit: match &message.pagination_mode {
                PaginationMode::Offset { limit } => limit.map(|l| l as u32),
                _ => Some(100),
            },
            platform_response: serde_json::to_value(platform_response).map_err(|e| {
                AppError::SerializationError(format!(
                    "Failed to serialize platform response: {}",
                    e
                ))
            })?,
            response_metadata: json!({
                "api_call_duration_ms": api_duration.as_millis(),
                "response_size": platform_response.products.len(),
                "has_more": platform_response.has_more,
                "next_page_token": platform_response.next_cursor
            }),
            products_count: platform_response.products.len() as u32,
            has_more_pages: platform_response.has_more,
            requested_at: Utc::now(),
            received_at: Utc::now(),
            processing_time_ms: 0, // Will be updated later
            api_call_duration_ms: api_duration.as_millis() as u64,
            http_status_code: 200, // Assume success for now
            rate_limit_remaining: None,
            rate_limit_reset_at: None,
            trace_id: message.trace_id.clone(),
            parent_trace_id: None,
        };

        // TODO: Store raw record in ClickHouse
        info!("Would store raw list response for batch {}", batch_id);

        Ok(())
    }

    async fn create_snapshot_from_list(
        &self,
        message: &ListRequestMessage,
        batch_id: &str,
        platform_product: &crate::interfaces::platform_gateway::PlatformProduct,
        analysis: &FieldAnalysis,
    ) -> AppResult<()> {
        let _snapshot = ProductSnapshot {
            tenant_id: message.tenant_id.clone(),
            platform: message.platform.clone(),
            shop_id: message.shop_id.clone(),
            platform_product_id: platform_product.id.clone(),
            unified_product_id: Uuid::new_v4().to_string(),
            title: platform_product.title.clone(),
            description: platform_product.description.clone(),
            brand: None, // Will be extracted from attributes if available
            category: None,
            category_path: vec![],
            price: platform_product.price.to_f64(),
            currency: Some(platform_product.currency.clone()),
            original_price: None,
            discount_percentage: None,
            total_quantity: None,
            available_quantity: None,
            reserved_quantity: None,
            skus: vec![], // Convert from platform SKUs
            main_image_url: platform_product.images.first().cloned(),
            image_urls: platform_product.images.clone(),
            video_urls: vec![],
            platform_attributes: platform_product
                .attributes
                .clone()
                .into_iter()
                .map(|(k, v)| (k, serde_json::Value::String(v)))
                .collect(),
            platform_categories: vec![],
            platform_tags: vec![],
            status: "active".to_string(),
            visibility: Some("public".to_string()),
            sales_regions: vec![],
            seo_title: None,
            seo_description: None,
            marketing_tags: vec![],
            data_source: "list_only".to_string(),
            needs_detail_sync: false,
            detail_sync_priority: None,
            sync_quality_score: Some(analysis.quality_score),
            platform_created_at: None,
            platform_updated_at: None,
            first_synced_at: Utc::now(),
            last_synced_at: Utc::now(),
            last_list_sync_at: Some(Utc::now()),
            last_detail_sync_at: None,
            version: 1,
            checksum: "".to_string(), // Calculate checksum
            last_sync_trace_id: message.trace_id.clone(),
            last_sync_batch_id: batch_id.to_string(),
        };

        // Insert into ClickHouse products_snapshot table
        // Implementation similar to store_raw_list_response but for snapshot table
        info!(
            "Created product snapshot for {} (list-only)",
            platform_product.id
        );

        Ok(())
    }

    async fn publish_detail_requests(&self, requests: Vec<DetailRequestMessage>) -> AppResult<()> {
        for request in requests {
            let subject = SubjectBuilder::detail_request(&request.tenant_id, &request.platform);

            // Publish directly to RabbitMQ for reliable delivery
            self.state
                .queue
                .publish(&subject, &request)
                .await
                .map_err(|e| {
                    AppError::QueueError(format!("Failed to publish detail request: {}", e))
                })?;

            info!(
                "Published detail request for product {} to {}",
                request.product_id, subject
            );
        }

        Ok(())
    }

    async fn publish_progress_event(
        &self,
        message: &ListRequestMessage,
        _phase: ProgressPhase,
        page_seq: u32,
        items_emitted: u32,
        has_more: bool,
        next_page_token: Option<&String>,
    ) -> AppResult<()> {
        let mut progress = ProgressEventMessage::list_page_done(
            message.tenant_id.clone(),
            message.platform.clone(),
            message.shop_id.clone(),
            message.trace_id.clone(),
            page_seq,
            items_emitted,
        );

        if let Some(token) = next_page_token {
            let mut next_page = HashMap::new();
            next_page.insert("token".to_string(), json!(token));
            progress = progress.with_next_page(next_page, has_more);
        }

        let subject = SubjectBuilder::list_progress(&message.tenant_id, &message.platform);
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

    async fn queue_next_page(
        &self,
        message: &ListRequestMessage,
        batch_id: &str,
        next_page_token: Option<String>,
    ) -> AppResult<()> {
        let mut next_message = message.clone();
        next_message.batch_id = Some(batch_id.to_string());
        next_message.page_seq = Some(message.page_seq.unwrap_or(1) + 1);
        next_message.trace_id = Uuid::new_v4().to_string(); // New trace for next page
        next_message.connect_state =
            Some(Self::build_connect_state_token(&next_message, batch_id)?);

        // Update pagination parameters
        match &mut next_message.pagination_mode {
            PaginationMode::Offset { .. } => {
                next_message.offset = Some(next_message.offset.unwrap_or(0) + 100);
            }
            PaginationMode::Cursor { cursor: _ } => {
                // Cursor pagination will create a new mode with the token
                next_message.pagination_mode = PaginationMode::Cursor {
                    cursor: next_page_token,
                };
            }
            PaginationMode::Token { token: _ } => {
                // Token pagination will create a new mode with the token
                next_message.pagination_mode = PaginationMode::Token {
                    token: next_page_token,
                };
            }
        }

        let subject = SubjectBuilder::list_request(&message.tenant_id, &message.platform);
        let payload = serde_json::to_vec(&next_message).map_err(|e| {
            AppError::SerializationError(format!("Failed to serialize next page request: {}", e))
        })?;

        self.state
            .queue
            .publish_bytes(&subject, payload)
            .await
            .map_err(|e| AppError::QueueError(format!("Failed to queue next page: {}", e)))?;

        info!(
            "Queued next page request (page {})",
            next_message.page_seq.unwrap()
        );
        Ok(())
    }

    async fn update_sync_stats(
        &self,
        _message: &ListRequestMessage,
        batch_id: &str,
        status: &str,
        _error: Option<&str>,
    ) -> AppResult<()> {
        // Update or insert sync_stats record
        info!(
            "Updated sync stats for batch {} - status: {}",
            batch_id, status
        );
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    async fn update_sync_stats_completion(
        &self,
        _message: &ListRequestMessage,
        batch_id: &str,
        products_discovered: u32,
        products_list_only: u32,
        products_detail_needed: u32,
        _throughput: f64,
        _is_final_page: bool,
    ) -> AppResult<()> {
        // Update sync_stats with completion metrics
        info!(
            "Updated sync stats completion for batch {}: {} discovered, {} list-only, {} need detail",
            batch_id, products_discovered, products_list_only, products_detail_needed
        );
        Ok(())
    }

    fn decode_connect_state(token: &str) -> Option<Value> {
        general_purpose::STANDARD
            .decode(token)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
    }

    fn build_connect_state_token(
        message: &ListRequestMessage,
        batch_id: &str,
    ) -> AppResult<String> {
        let mut ctx = ConnectContext::new(
            message.platform.clone(),
            message.tenant_id.clone(),
            message.shop_id.clone(),
            message.trace_id.clone(),
        );
        ctx.insert_metadata("batch_id", json!(batch_id));
        if let Some(page_seq) = message.page_seq {
            ctx.insert_metadata("page_seq", json!(page_seq));
        }
        StateEnvelope::from_context(&ctx, StateFlavor::Base64Json).map(|env| env.token)
    }
}

#[async_trait]
impl Worker for ProductListConsumer {
    async fn start(&self) -> AppResult<()> {
        info!("Starting Product List Consumer (Consumer #1)");

        // Initialize queue backend if needed
        if let Some(_rabbit_queue) =
            self.state
                .queue
                .as_ref()
                .as_any()
                .downcast_ref::<crate::infrastructure::queue::rabbitmq::RabbitMqQueue>()
        {
            // Setup consumer subscription metadata if required
            info!("Setting up RabbitMQ consumer for list requests");
        }

        // Start consumer loop
        self.run_consumer_loop().await
    }

    async fn stop(&self) -> AppResult<()> {
        info!("Stopping Product List Consumer");
        Ok(())
    }

    async fn process_job(&self, job_data: Vec<u8>) -> AppResult<()> {
        let message: ListRequestMessage = serde_json::from_slice(&job_data).map_err(|e| {
            AppError::SerializationError(format!("Failed to deserialize list request: {}", e))
        })?;

        self.process_list_request(message).await
    }
}

impl ProductListConsumer {
    async fn run_consumer_loop(&self) -> AppResult<()> {
        info!("Product List Consumer is running");

        loop {
            // In a real implementation, this would pull messages from RabbitMQ
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
    }
}
