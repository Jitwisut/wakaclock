/// ไฟล์ product_consumer.rs - Product Consumer Worker Implementation
/// Worker สำหรับประมวลผล product sync messages จาก queue
/// รองรับการ fetch สินค้าจาก platform และบันทึกลง ClickHouse
/// มีระบบ auto-approve และ graceful shutdown
use async_trait::async_trait;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::str::FromStr;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::{
    client::strapi::shop_tokens::{
        fetch_shop_token, resolve_access_token as resolve_cached_access_token,
        resolve_api_key as resolve_cached_api_key, resolve_api_secret as resolve_cached_api_secret,
        resolve_store_url as resolve_cached_store_url,
    },
    config::{Config, PlatformCredentials},
    infrastructure::queue::{MessageQueue, QueueMessage},
    interfaces::{
        platform_gateway::{GatewayFactory, ListProductParams},
        GatewayFactoryImpl,
    },
    model::v1::platfrom::entries::{
        AppError, AppResult, PlatformType, Price, Product, ProductImage, ProductStatus,
    },
    repository::{clickhouse::ClickHouseRepository, ProductRepository, VectorRepository},
};
use chrono::Utc;

/// Message structure สำหรับ fetch สินค้าจาก platform
/// ประกอบด้วยข้อมูลที่จำเป็นในการดึงสินค้าจาก API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductFetchMessage {
    pub shop_id: String,    // Shop ID ในระบบเรา
    pub platform: String,   // ชื่อ platform (tiktok, shopee, etc.)
    pub product_id: String, // Product ID ที่จะ fetch
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_token: Option<String>, // OAuth access token สำหรับเข้าถึง API
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform_shop_id: Option<String>, // Shop ID ใน platform (ถ้าต่างจาก shop_id)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_secret: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub store_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedding_model: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub embedding_prompt: Option<String>,
}

/// Product consumer worker - ประมวลผล messages จาก queue
/// ทำงานแบบ async และรองรับ graceful shutdown
pub struct ProductConsumerWorker {
    queue: Arc<dyn MessageQueue>,           // Message queue interface
    clickhouse: Arc<ClickHouseRepository>,  // ClickHouse repository สำหรับบันทึกข้อมูล
    vector_repo: Arc<dyn VectorRepository>, // Vector repository สำหรับ embeddings
    config: Arc<Config>,                    // Application configuration
}

struct EmbeddingSelection {
    name: String,
    dimensions: usize,
}

#[derive(Debug, Default)]
struct ResolvedCredentials {
    access_token: Option<String>,
    api_key: Option<String>,
    api_secret: Option<String>,
    store_url: Option<String>,
}

impl ProductConsumerWorker {
    /// สร้าง worker instance ใหม่
    /// รับ dependencies ผ่าน dependency injection
    pub fn new(
        queue: Arc<dyn MessageQueue>,
        clickhouse: Arc<ClickHouseRepository>,
        vector_repo: Arc<dyn VectorRepository>,
        config: Arc<Config>,
    ) -> Self {
        Self {
            queue: queue.clone(),
            clickhouse,
            vector_repo,
            config,
        }
    }

    fn build_routing_expression(&self) -> String {
        self.config.product_sync_queue.subjects().join(",")
    }

    /// Auto-approve สินค้าทั้ง batch (สำหรับ initial sync)
    /// อัพเดท status เป็น approved และย้ายไป main product table
    /// ใช้สำหรับการ sync ครั้งแรกที่ไม่ต้องการ manual review
    async fn auto_approve_batch_products(
        clickhouse: &Arc<ClickHouseRepository>,
        batch_id: &str,
        tenant_id: &str,
        shop_id: &str,
    ) -> AppResult<()> {
        info!(
            "Auto-approving products in batch {} for shop {}",
            batch_id, shop_id
        );

        // Update all pending products in this batch to approved
        let update_query = format!(
            r#"
            ALTER TABLE product_sync
            UPDATE
                user_action = 'approved',
                processed_at = now()
            WHERE sync_batch_id = '{}'
              AND user_action = 'pending'
            "#,
            batch_id
        );

        clickhouse.execute_query(&update_query).await?;

        // Move approved products to the main product table
        Self::move_approved_products_to_main_table(clickhouse, batch_id, tenant_id, shop_id)
            .await?;

        Ok(())
    }

    /// ย้ายสินค้าที่ approved แล้วจาก staging table ไป main product table
    /// Extract ข้อมูลจาก JSON และ insert ลง table หลัก
    /// สร้าง UUID ใหม่สำหรับ product_id ในระบบ
    async fn move_approved_products_to_main_table(
        clickhouse: &Arc<ClickHouseRepository>,
        batch_id: &str,
        _tenant_id: &str,
        _shop_id: &str,
    ) -> AppResult<()> {
        info!(
            "Moving approved products from batch {} to main product table",
            batch_id
        );

        // Insert or update products in the main product table
        let insert_query = format!(
            r#"
            INSERT INTO product (
                product_id,
                tenant_id,
                shop_id,
                platform,
                platform_product_id,
                title,
                description,
                price,
                inventory,
                images,
                created_time,
                last_updated
            )
            SELECT
                generateUUIDv4() as product_id,
                tenant_id,
                shop_id,
                platform,
                platform_product_id,
                JSONExtractString(product_data, 'title') as title,
                JSONExtractString(product_data, 'description') as description,
                JSONExtractFloat(product_data, 'price') as price,
                JSONExtractUInt(product_data, 'quantity') as inventory,
                JSONExtractArrayRaw(product_data, 'images') as images,
                now() as created_time,
                now() as last_updated
            FROM product_sync
            WHERE sync_batch_id = '{}'
              AND user_action = 'approved'
            "#,
            batch_id
        );

        clickhouse.execute_query(&insert_query).await?;

        info!(
            "Successfully moved approved products from batch {} to main product table",
            batch_id
        );

        Ok(())
    }

    /// เริ่มการทำงานของ consumer แบบปกติ
    /// สร้าง durable consumer และ subscribe กับ queue
    /// ประมวลผล messages แบบ async ใน background
    pub async fn start(&self) -> AppResult<()> {
        info!("Starting product consumer worker");

        let routing_expression = self.build_routing_expression();
        // Create durable consumer for product sync
        let binding = crate::worker::resolve_binding(
            "CONSUMER_PRODUCT_EMBEDDING",
            crate::worker::QueueBinding::new(
                "PRODUCT_SYNC_STREAM",
                "product_sync_consumer",
                routing_expression.as_str(),
            ),
        );

        self.queue
            .create_durable_consumer(&binding.stream, &binding.consumer, &binding.routing_key)
            .await?;

        // Clone for move into closure
        let queue = self.queue.clone();
        let clickhouse = self.clickhouse.clone();
        let vector_repo = self.vector_repo.clone();
        let config = self.config.clone();

        // Subscribe to messages - handler must be synchronous but spawn async work
        let handler = Box::new(move |msg: QueueMessage| -> anyhow::Result<()> {
            let queue = queue.clone();
            let clickhouse = clickhouse.clone();
            let vector_repo = vector_repo.clone();
            let config_for_msg = config.clone();

            info!("Received message: {}", msg.id);
            info!("Message payload: {:?}", msg.payload);

            // Spawn async processing in a new task with timeout
            let msg_id = msg.id.clone();
            tokio::spawn(async move {
                match Self::process_message(msg, queue, clickhouse, vector_repo, config_for_msg)
                    .await
                {
                    Ok(_) => {
                        info!("Message {} processed successfully", msg_id);
                    }
                    Err(e) => {
                        error!("Failed to process message {}: {}", msg_id, e);
                    }
                }
            });

            // Return immediately to allow RabbitMQ to continue processing
            Ok(())
        });

        self.queue.subscribe(handler).await?;

        Ok(())
    }

    /// เริ่มการทำงานของ consumer พร้อม graceful shutdown
    /// รับ shutdown signal และรอให้งานที่กำลังทำอยู่เสร็จก่อน
    /// มี timeout protection สำหรับกรณีที่งานติดค้าง
    pub async fn start_with_shutdown(&self, shutdown: Arc<AtomicBool>) -> AppResult<()> {
        info!("Starting product consumer worker with graceful shutdown");

        let routing_expression = self.build_routing_expression();
        // Initialize queue configuration for consuming
        // Create durable consumer for product sync
        let binding = crate::worker::resolve_binding(
            "CONSUMER_PRODUCT_EMBEDDING",
            crate::worker::QueueBinding::new(
                "PRODUCT_SYNC_STREAM",
                "product_sync_consumer",
                routing_expression.as_str(),
            ),
        );

        self.queue
            .create_durable_consumer(&binding.stream, &binding.consumer, &binding.routing_key)
            .await?;

        // Clone for move into closure
        let queue = self.queue.clone();
        let clickhouse = self.clickhouse.clone();
        let vector_repo = self.vector_repo.clone();
        let config = self.config.clone();
        let active_tasks = Arc::new(AtomicBool::new(false));
        let active_tasks_clone = active_tasks.clone();
        let shutdown_clone = shutdown.clone();

        // Subscribe to messages - handler must be synchronous but spawn async work
        let handler = Box::new(move |msg: QueueMessage| -> anyhow::Result<()> {
            // Check for shutdown signal
            if shutdown_clone.load(Ordering::SeqCst) {
                info!("Shutdown signal received, rejecting new message");
                return Err(anyhow::anyhow!("Worker is shutting down"));
            }

            let queue = queue.clone();
            let clickhouse = clickhouse.clone();
            let vector_repo = vector_repo.clone();
            let config_for_msg = config.clone();
            let active = active_tasks_clone.clone();

            info!("Received message: {}", msg.id);
            info!("Message payload: {:?}", msg.payload);

            // Mark that we have active tasks
            active.store(true, Ordering::SeqCst);

            // Spawn async processing in a new task with timeout
            let msg_id = msg.id.clone();
            tokio::spawn(async move {
                match Self::process_message(msg, queue, clickhouse, vector_repo, config_for_msg)
                    .await
                {
                    Ok(_) => {
                        info!("Message {} processed successfully", msg_id);
                    }
                    Err(e) => {
                        error!("Failed to process message {}: {}", msg_id, e);
                    }
                }
                // Mark task as complete
                active.store(false, Ordering::SeqCst);
            });

            // Return immediately to allow RabbitMQ to continue processing
            Ok(())
        });

        // Spawn subscribe in a separate task so it doesn't block
        let queue_clone = self.queue.clone();
        let _subscribe_handle = tokio::spawn(async move {
            if let Err(e) = queue_clone.subscribe(handler).await {
                error!("Subscribe error: {}", e);
            }
        });

        // Wait for shutdown signal
        while !shutdown.load(Ordering::SeqCst) {
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }

        info!("Shutdown signal received, waiting for active tasks to complete...");

        // Wait for active tasks to complete (with timeout)
        let mut wait_count = 0;
        while active_tasks.load(Ordering::SeqCst) && wait_count < 100 {
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            wait_count += 1;
        }

        if wait_count >= 100 {
            warn!("Timeout waiting for active tasks to complete, proceeding with shutdown");
        } else {
            info!("All active tasks completed");
        }

        Ok(())
    }

    /// Process a single message
    async fn process_message(
        msg: QueueMessage,
        queue: Arc<dyn MessageQueue>,
        clickhouse: Arc<ClickHouseRepository>,
        vector_repo: Arc<dyn VectorRepository>,
        config: Arc<Config>,
    ) -> AppResult<()> {
        info!("Processing message: {}", msg.id);
        info!("Message job type: {:?}", msg.job_type);

        if let Some(action) = msg
            .payload
            .get("action")
            .and_then(|value| value.as_str())
            .map(|value| value.to_lowercase())
        {
            if action == "process_batch" {
                info!(
                    "Skipping batch control message {} - handled by batch processor",
                    msg.id
                );
                return Ok(());
            }
        }

        // Check if this is a completion event
        if let Some(event) = msg.payload.get("event") {
            if event == "product_sync_completed" || event == "product_sync_job_created" {
                info!("Ignoring sync event message: {}", event);
                return Ok(());
            }
        }

        // Check message type
        if let Some(msg_type) = msg.payload.get("type") {
            if msg_type == "product_data" {
                // Handle full product data message
                // Extract tenant_id from payload first, then metadata, then default
                let tenant_id = msg
                    .payload
                    .get("tenant_id")
                    .and_then(|v| v.as_str())
                    .or_else(|| {
                        msg.metadata
                            .as_ref()
                            .and_then(|m| m.get("tenant_id"))
                            .and_then(|v| v.as_str())
                    })
                    .unwrap_or("default")
                    .to_string();

                if let Some(product_value) = msg.payload.get("product") {
                    let product: crate::model::v1::platfrom::entries::Product =
                        serde_json::from_value(product_value.clone()).map_err(|e| {
                            error!("Failed to parse product data: {}", e);
                            AppError::SerializationError(format!("Failed to parse product: {}", e))
                        })?;

                    info!(
                        "Processing product data: {} - {}",
                        product.product_id, product.title
                    );

                    info!("Attempting to save product to ClickHouse...");

                    // Save to both regular and unified product tables
                    match clickhouse.save_product(&tenant_id, &product).await {
                        Ok(_) => {
                            info!(
                                "Product saved to regular products table: {}",
                                product.product_id
                            );
                        }
                        Err(e) => {
                            error!("Failed to save product to regular products table: {}", e);
                            // Continue to try unified table
                        }
                    }

                    // Save to product table with cityHash sharding
                    match clickhouse.save_unified_product(&tenant_id, &product).await {
                        Ok(_) => {
                            info!(
                                "Product saved to product table with cityHash: {}",
                                product.product_id
                            );
                        }
                        Err(e) => {
                            error!("Failed to save product to product table: {}", e);
                            return Err(e);
                        }
                    }

                    if let Err(e) = Self::sync_product_to_vector(
                        vector_repo.clone(),
                        config.clone(),
                        &tenant_id,
                        &product.platform.to_string(),
                        &product,
                        None,
                        None,
                    )
                    .await
                    {
                        warn!(
                            "Vector sync failed for product {}: {}",
                            product.product_id, e
                        );
                    }

                    info!("Successfully processed product: {}", product.product_id);
                    return Ok(());
                }
            }
        }

        // Check if this is a ProductSyncMessage (from sync handler)
        // For now, we'll handle it here since product_sync worker is not running
        if msg.payload.get("job_id").is_some()
            && msg.payload.get("tenant_id").is_some()
            && msg.payload.get("shop_id").is_some()
            && msg.payload.get("platform").is_some()
            && msg.payload.get("full_sync").is_some()
        {
            info!("Processing ProductSyncMessage in consumer");

            // Extract sync details
            let job_id = msg
                .payload
                .get("job_id")
                .and_then(|v| v.as_str())
                .map(String::from)
                .unwrap_or_else(|| Uuid::new_v4().to_string());
            let shop_id = msg
                .payload
                .get("shop_id")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let platform = msg
                .payload
                .get("platform")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            // Extract tenant_id from payload first, then metadata, then default
            let tenant_id = msg
                .payload
                .get("tenant_id")
                .and_then(|v| v.as_str())
                .or_else(|| {
                    msg.metadata
                        .as_ref()
                        .and_then(|m| m.get("tenant_id"))
                        .and_then(|v| v.as_str())
                })
                .unwrap_or("default");
            let user_id = msg
                .payload
                .get("user_id")
                .and_then(|v| v.as_str())
                .unwrap_or("system");
            let options = msg
                .payload
                .get("options")
                .map(|v| v.to_string())
                .unwrap_or_else(|| "{}".to_string());

            info!(
                "Starting sync job {} for shop {} on platform {}",
                job_id, shop_id, platform
            );

            // Create sync job record
            if let Err(e) = clickhouse
                .create_sync_job(&job_id, platform, shop_id, tenant_id, user_id, &options)
                .await
            {
                error!("Failed to create sync job record: {}", e);
            }

            // Update status to processing
            if let Err(e) = clickhouse
                .update_sync_job_status(&job_id, "processing", 0, 0, 0, None)
                .await
            {
                error!("Failed to update sync job status: {}", e);
            }

            // Extract credentials from the message
            let access_token_raw = msg
                .payload
                .get("access_token")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let refresh_token_raw = msg
                .payload
                .get("refresh_token")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let api_key_raw = msg
                .payload
                .get("api_key")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let api_secret_raw = msg
                .payload
                .get("api_secret")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let api_url = msg.payload.get("api_url").and_then(|v| v.as_str());
            let platform_normalized = platform.trim().to_ascii_lowercase();

            // Build credentials from message or fallback to environment
            let platform_creds = Self::get_platform_credentials_with_override(
                platform_normalized.as_str(),
                access_token_raw,
                refresh_token_raw,
                api_key_raw,
                api_secret_raw,
                api_url,
            )?;

            // Convert PlatformCredentials to interface Credentials
            let mut credentials = crate::interfaces::platform_gateway::Credentials {
                api_key: if platform_creds.api_key.is_empty() {
                    None
                } else {
                    Some(platform_creds.api_key.clone())
                },
                api_secret: if platform_creds.app_secret.is_empty() {
                    None
                } else {
                    Some(platform_creds.app_secret.clone())
                },
                access_token: None,
                refresh_token: None,
                shop_id: Some(shop_id.to_string()),
                store_url: api_url.map(|url| url.to_string()),
                additional: std::collections::HashMap::new(),
                extra: std::collections::HashMap::new(),
            };

            // Check if we have a token reference that needs to be resolved
            // OR if we have missing credentials that need to be fetched from Strapi
            let needs_resolution = (!access_token_raw.is_empty() && access_token_raw.contains(':'))
                || (!api_key_raw.is_empty() && api_key_raw.contains(':'))
                || (matches!(
                    platform_normalized.as_str(),
                    "woocommerce" | "shopify" | "bigcommerce" | "ecwid" | "magento"
                ) && api_key_raw.is_empty()
                    && api_secret_raw.is_empty())
                || (matches!(platform_normalized.as_str(), "tiktok" | "shopee" | "lazada")
                    && access_token_raw.is_empty());

            let mut actual_access_token = access_token_raw.trim().to_string();
            let mut actual_api_key = api_key_raw.trim().to_string();
            let mut actual_api_secret = api_secret_raw.trim().to_string();
            let mut actual_api_url = api_url.map(|s| s.trim().to_string());

            if needs_resolution {
                let resolved = Self::resolve_credentials_from_strapi(
                    platform_normalized.as_str(),
                    tenant_id,
                    shop_id,
                )
                .await?;
                if let Some(token) = resolved.access_token {
                    actual_access_token = token;
                }
                if let Some(key) = resolved.api_key {
                    actual_api_key = key;
                }
                if let Some(secret) = resolved.api_secret {
                    actual_api_secret = secret;
                }
                if let Some(url) = resolved.store_url {
                    actual_api_url = Some(url);
                }
            }

            if !refresh_token_raw.trim().is_empty() {
                credentials.refresh_token = Some(refresh_token_raw.trim().to_string());
            }

            if !actual_access_token.is_empty() {
                credentials.access_token = Some(actual_access_token.clone());
            }
            if !actual_api_key.is_empty() {
                credentials.api_key = Some(actual_api_key.clone());
            }
            if !actual_api_secret.is_empty() {
                credentials.api_secret = Some(actual_api_secret.clone());
            }
            if let Some(url) = actual_api_url.clone() {
                credentials.store_url = Some(url);
            }
            credentials.shop_id = Some(shop_id.to_string());

            let factory = GatewayFactoryImpl::new();
            let _platform_enum =
                crate::model::v1::platfrom::entries::PlatformType::from_str(platform)
                    .map_err(|e| AppError::BadRequest(format!("Invalid platform: {}", e)))?;
            let gateway = factory
                .create_gateway(platform, credentials.clone())
                .await
                .map_err(|e| anyhow::anyhow!("Failed to create gateway: {:?}", e))?;

            // For OAuth platforms without token, return error immediately
            let skip_api = matches!(platform_normalized.as_str(), "tiktok" | "shopee" | "lazada")
                && actual_access_token.is_empty();

            if skip_api {
                let message = format!(
                    "{} access token must be provided via Strapi for shop {} (tenant {}).",
                    platform, shop_id, tenant_id
                );
                error!("{}", message);
                return Err(AppError::Unauthorized(message));
            }

            // Fetch products from the platform
            info!("Fetching products from {} API...", platform);

            // Log credentials for debugging (mask sensitive parts)
            info!(
                "Using credentials - platform: {}, has_access_token: {}, has_api_key: {}, api_url: {:?}",
                platform,
                !actual_access_token.is_empty(),
                !actual_api_key.is_empty(),
                actual_api_url.as_deref()
            );

            let _page = msg
                .payload
                .get("page")
                .and_then(|v| v.as_u64())
                .unwrap_or(1) as u32;
            let _limit = msg
                .payload
                .get("limit")
                .and_then(|v| v.as_u64())
                .unwrap_or(100) as u32;

            let gateway_for_fetch = gateway.clone();

            let products = {
                let _platform_credentials = PlatformCredentials {
                    api_key: String::new(),
                    app_key: actual_api_key.clone(),
                    app_secret: actual_api_secret.clone(),
                    api_base_url: actual_api_url
                        .clone()
                        .unwrap_or_else(|| "https://api.platform.com".to_string()),
                    redirect_uri: None,
                    rate_limit_rps: 10.0,
                    oauth_authorize_url: None,
                    oauth_token_url: None,
                    oauth_refresh_url: None,
                    oauth_revoke_url: None,
                    store_id: None,
                    base_url: None,
                    tenant_id: None,
                    market: None,
                    service_id: None,
                };

                let list_params = ListProductParams {
                    shop_id: Some(shop_id.to_string()),
                    limit: None,
                    offset: None,
                    status: None,
                    search: None,
                    page: None,
                    sort: None,
                };

                match gateway_for_fetch.list_products(&list_params).await {
                    Ok(product_list) => {
                        info!(
                            "Successfully fetched {} products from {}",
                            product_list.products.len(),
                            platform
                        );
                        // Convert PlatformProduct to Product
                        product_list
                            .products
                            .into_iter()
                            .map(|p| Product {
                                product_id: Uuid::new_v4().to_string(),
                                platform_product_id: p.id.clone(),
                                shop_id: shop_id.to_string(),
                                platform_shop_id: String::new(),
                                platform: PlatformType::from_str(platform)
                                    .unwrap_or(PlatformType::TikTok),
                                title: p.title,
                                brand: String::new(),
                                description: p.description,
                                price: Price {
                                    amount: rust_decimal::Decimal::from_f64_retain(p.price)
                                        .unwrap_or_default(),
                                    original_price: None,
                                    discount_percentage: None,
                                    currency: p.currency.clone(),
                                },
                                currency: p.currency,
                                sku: p.sku.unwrap_or_default(),
                                quantity: 0,
                                images: p
                                    .images
                                    .into_iter()
                                    .enumerate()
                                    .map(|(idx, url)| ProductImage {
                                        url,
                                        alt: None,
                                        is_primary: idx == 0,
                                        position: idx as i32,
                                    })
                                    .collect(),
                                categories: vec![],
                                attributes: p
                                    .attributes
                                    .into_iter()
                                    .map(|(k, v)| (k, v.to_string()))
                                    .collect(),
                                status: ProductStatus::Active,
                                created_at: Utc::now(),
                                updated_at: Utc::now(),
                                synced_at: Some(Utc::now()),
                            })
                            .collect()
                    }
                    Err(e) => {
                        error!(
                            "Failed to fetch products from {}: {}. Sync aborted.",
                            platform, e
                        );
                        vec![]
                    }
                }
            };

            // Save products to product_sync staging table
            let mut saved_count = 0;
            let mut failed_count = 0;
            let duplicate_count = 0;
            let total_products = products.len();
            let batch_size = 50;
            let total_batches = total_products.div_ceil(batch_size);
            let mut current_batch = 0;

            // Use job_id as batch_id
            let batch_id = job_id.clone();

            for (index, mut product) in products.into_iter().enumerate() {
                // Calculate current batch
                let new_batch = index / batch_size;
                if new_batch != current_batch {
                    current_batch = new_batch;
                    // Log progress every batch
                    let message = format!(
                        "Processing batch {} of {}",
                        current_batch + 1,
                        total_batches
                    );
                    if let Err(e) = clickhouse
                        .log_sync_job_progress(
                            &job_id,
                            index as u32,
                            saved_count as u32,
                            failed_count as u32,
                            duplicate_count as u32,
                            current_batch as u32,
                            total_batches as u32,
                            &message,
                        )
                        .await
                    {
                        error!("Failed to log sync progress: {}", e);
                    }
                }

                // Ensure shop_id is set correctly
                product.shop_id = shop_id.to_string();

                // TODO: Check for duplicates here when duplicate detection is implemented
                // For now, just save the product

                // Save to product_sync staging table instead of directly to product table
                match clickhouse
                    .save_product_to_sync(tenant_id, shop_id, &product, &batch_id)
                    .await
                {
                    Ok(_) => {
                        info!(
                            "Saved product to sync staging: {} - {}",
                            product.product_id, product.title
                        );
                        saved_count += 1;
                    }
                    Err(e) => {
                        error!(
                            "Failed to save product {} to sync staging: {}",
                            product.product_id, e
                        );
                        failed_count += 1;
                    }
                }

                // Update progress every 10 products
                if (saved_count + failed_count) % 10 == 0 {
                    if let Err(e) = clickhouse
                        .update_sync_job_status(
                            &job_id,
                            "processing",
                            saved_count as u32,
                            failed_count as u32,
                            duplicate_count as u32,
                            None,
                        )
                        .await
                    {
                        error!("Failed to update sync job status: {}", e);
                    }
                }
            }

            // Final progress log
            let final_message = format!(
                "Sync completed for shop {} - {} synced, {} failed, {} duplicates",
                shop_id, saved_count, failed_count, duplicate_count
            );
            if let Err(e) = clickhouse
                .log_sync_job_progress(
                    &job_id,
                    (saved_count + failed_count) as u32,
                    saved_count as u32,
                    failed_count as u32,
                    duplicate_count as u32,
                    total_batches as u32,
                    total_batches as u32,
                    &final_message,
                )
                .await
            {
                error!("Failed to log final sync progress: {}", e);
            }

            // Update job status to completed
            let final_status = "completed";
            if let Err(e) = clickhouse
                .update_sync_job_status(
                    &job_id,
                    final_status,
                    saved_count as u32,
                    failed_count as u32,
                    duplicate_count as u32,
                    None,
                )
                .await
            {
                error!("Failed to update final sync job status: {}", e);
            }

            info!(
                "Completed sync job {} for shop {} - saved {} products to staging, {} failed",
                job_id, shop_id, saved_count, failed_count
            );

            // Auto-approve products if enabled (for initial sync)
            if saved_count > 0 {
                info!(
                    "Auto-approving {} products for batch {}",
                    saved_count, batch_id
                );
                Self::auto_approve_batch_products(&clickhouse, &batch_id, tenant_id, shop_id)
                    .await?;
            }

            // Publish sync completion event
            let completion_event = serde_json::json!({
                "event": "product_sync_completed",
                "job_id": job_id.clone(),
                "shop_id": shop_id,
                "platform": platform,
                "products_synced": saved_count,
                "products_failed": failed_count,
                "products_duplicate": duplicate_count,
                "status": if failed_count == 0 { "success" } else { "partial_success" }
            });

            if let Ok(payload) = serde_json::to_vec(&completion_event) {
                if let Err(err) = queue
                    .publish_bytes("ecommerce.sync.completed", payload)
                    .await
                {
                    error!(
                        "Failed to publish sync completion event for job {}: {}",
                        job_id, err
                    );
                } else {
                    info!("Published sync completion event for job {}", job_id);
                }
            }

            return Ok(());
        }

        // Try to parse as ProductFetchMessage for backward compatibility
        let fetch_msg: ProductFetchMessage =
            serde_json::from_value(msg.payload.clone()).map_err(|e| {
                error!(
                    "Failed to parse message as ProductFetchMessage: {}. Payload: {:?}",
                    e, msg.payload
                );
                AppError::SerializationError(format!("Failed to parse message: {}", e))
            })?;

        info!(
            "Fetching product details - Platform: {}, Product ID: {}, Shop: {}",
            fetch_msg.platform, fetch_msg.product_id, fetch_msg.shop_id
        );

        let override_url = fetch_msg
            .store_url
            .as_deref()
            .or_else(|| fetch_msg.api_url.as_deref());
        let platform_creds = Self::get_platform_credentials_with_override(
            &fetch_msg.platform,
            fetch_msg.access_token.as_deref().unwrap_or_default(),
            "",
            fetch_msg.api_key.as_deref().unwrap_or(""),
            fetch_msg.api_secret.as_deref().unwrap_or(""),
            override_url,
        )?;

        let tenant_id = fetch_msg
            .tenant_id
            .as_deref()
            .or_else(|| {
                msg.metadata
                    .as_ref()
                    .and_then(|m| m.get("tenant_id"))
                    .and_then(|v| v.as_str())
            })
            .unwrap_or("default")
            .to_string();

        // Convert PlatformCredentials to interface Credentials
        let credentials = crate::interfaces::platform_gateway::Credentials {
            api_key: if platform_creds.app_key.is_empty() {
                None
            } else {
                Some(platform_creds.app_key.clone())
            },
            api_secret: if platform_creds.app_secret.is_empty() {
                None
            } else {
                Some(platform_creds.app_secret.clone())
            },
            access_token: fetch_msg.access_token.clone(),
            refresh_token: None,
            shop_id: if platform_creds.api_base_url.is_empty() {
                fetch_msg.store_url.clone()
            } else {
                Some(platform_creds.api_base_url.clone())
            },
            store_url: fetch_msg.store_url.clone(),
            additional: std::collections::HashMap::new(),
            extra: std::collections::HashMap::new(),
        };

        let factory = GatewayFactoryImpl::new();
        let _platform_enum =
            crate::model::v1::platfrom::entries::PlatformType::from_str(&fetch_msg.platform)
                .map_err(|e| AppError::BadRequest(format!("Invalid platform: {}", e)))?;
        let gateway = factory
            .create_gateway(&fetch_msg.platform, credentials)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to create gateway: {:?}", e))?;

        // Fetch product details from platform with timeout
        let fetch_future = gateway.get_product(&fetch_msg.product_id);
        let timeout_duration = tokio::time::Duration::from_secs(30);

        match tokio::time::timeout(timeout_duration, fetch_future).await {
            Ok(result) => match result {
                Ok(platform_product) => {
                    // Convert PlatformProduct to Product
                    let product = Product {
                        product_id: Uuid::new_v4().to_string(),
                        platform_product_id: platform_product.id.clone(),
                        shop_id: fetch_msg.shop_id.clone(),
                        platform_shop_id: fetch_msg.platform_shop_id.unwrap_or_default(),
                        platform: PlatformType::from_str(&fetch_msg.platform)
                            .unwrap_or(PlatformType::TikTok),
                        title: platform_product.title,
                        brand: String::new(),
                        description: platform_product.description,
                        price: Price {
                            amount: rust_decimal::Decimal::from_f64_retain(platform_product.price)
                                .unwrap_or_default(),
                            original_price: None,
                            discount_percentage: None,
                            currency: platform_product.currency.clone(),
                        },
                        currency: platform_product.currency,
                        sku: platform_product.sku.unwrap_or_default(),
                        quantity: 0,
                        images: platform_product
                            .images
                            .into_iter()
                            .enumerate()
                            .map(|(idx, url)| ProductImage {
                                url,
                                alt: None,
                                is_primary: idx == 0,
                                position: idx as i32,
                            })
                            .collect(),
                        categories: vec![],
                        attributes: platform_product
                            .attributes
                            .into_iter()
                            .map(|(k, v)| (k, v.to_string()))
                            .collect(),
                        status: ProductStatus::Active,
                        created_at: Utc::now(),
                        updated_at: Utc::now(),
                        synced_at: Some(Utc::now()),
                    };

                    info!(
                        "Successfully fetched product: {} - {}",
                        product.platform_product_id, product.title
                    );

                    // Save to both regular and unified product tables
                    if let Err(e) = clickhouse.save_product(&tenant_id, &product).await {
                        error!("Failed to save product to regular products table: {}", e);
                        // Continue to try unified table
                    }

                    // Save to product table with cityHash sharding
                    if let Err(e) = clickhouse.save_unified_product(&tenant_id, &product).await {
                        error!("Failed to save product to product table: {}", e);
                        return Err(e);
                    }

                    if let Err(e) = Self::sync_product_to_vector(
                        vector_repo.clone(),
                        config.clone(),
                        &tenant_id,
                        &fetch_msg.platform,
                        &product,
                        fetch_msg.embedding_model.as_deref(),
                        fetch_msg.embedding_prompt.as_deref(),
                    )
                    .await
                    {
                        warn!(
                            "Vector sync failed for product {}: {}",
                            product.product_id, e
                        );
                    }

                    info!("Product saved to ClickHouse tables: {}", product.product_id);
                }
                Err(e) => {
                    error!(
                        "Failed to fetch product {} from {}: {}",
                        fetch_msg.product_id, fetch_msg.platform, e
                    );
                    return Err(e.into());
                }
            },
            Err(_) => {
                error!(
                    "Timeout fetching product {} from {} after 30 seconds",
                    fetch_msg.product_id, fetch_msg.platform
                );
                return Err(AppError::TimeoutError(format!(
                    "Timeout fetching product {} from {}",
                    fetch_msg.product_id, fetch_msg.platform
                )));
            }
        }

        Ok(())
    }

    async fn sync_product_to_vector(
        vector_repo: Arc<dyn VectorRepository>,
        config: Arc<Config>,
        tenant_id: &str,
        platform: &str,
        product: &Product,
        embedding_model: Option<&str>,
        embedding_prompt: Option<&str>,
    ) -> AppResult<()> {
        let selection = Self::select_embedding_model(&config, platform, embedding_model);
        let text = Self::build_embedding_text(product, embedding_prompt);
        let embedding = Self::generate_embedding(&text, selection.dimensions);
        let collection = Self::collection_name(platform, &selection.name);

        let metadata = json!({
            "tenant_id": tenant_id,
            "shop_id": product.shop_id,
            "platform": platform,
            "product_id": product.product_id,
            "platform_product_id": product.platform_product_id,
            "title": product.title,
            "description": product.description,
            "currency": product.currency,
            "price": product.price.amount.to_f64().unwrap_or(0.0),
            "status": product.status.to_string(),
            "categories": product.categories,
            "attributes": product.attributes,
            "embedding_model": selection.name,
            "synced_at": Utc::now().to_rfc3339(),
        });

        vector_repo
            .upsert_vector(&collection, &product.product_id, &embedding, &metadata)
            .await
    }

    fn select_embedding_model(
        config: &Config,
        platform: &str,
        requested: Option<&str>,
    ) -> EmbeddingSelection {
        if let Some(model_name) = requested {
            if let Some(model) = config.get_embedding_model(model_name) {
                return EmbeddingSelection {
                    name: model_name.to_string(),
                    dimensions: model.dimensions.max(4),
                };
            }
        }

        if let Some((name, model)) = config.get_default_embedding_model(platform) {
            return EmbeddingSelection {
                name: name.clone(),
                dimensions: model.dimensions.max(4),
            };
        }

        if let Some((name, model)) = config.ai.embedding_models.iter().next() {
            return EmbeddingSelection {
                name: name.clone(),
                dimensions: model.dimensions.max(4),
            };
        }

        EmbeddingSelection {
            name: "lite-embedding".to_string(),
            dimensions: 32,
        }
    }

    fn build_embedding_text(product: &Product, prompt: Option<&str>) -> String {
        let mut sections = Vec::new();
        if let Some(p) = prompt {
            if !p.is_empty() {
                sections.push(p.trim().to_string());
            }
        }

        sections.push(product.title.clone());

        if let Some(description) = &product.description {
            if !description.is_empty() {
                sections.push(description.clone());
            }
        }

        if !product.attributes.is_empty() {
            let attributes = product
                .attributes
                .iter()
                .map(|(k, v)| format!("{}: {}", k, v))
                .collect::<Vec<_>>()
                .join(", ");
            sections.push(format!("Attributes: {}", attributes));
        }

        if !product.categories.is_empty() {
            sections.push(format!("Categories: {}", product.categories.join(", ")));
        }

        sections.join("\n\n")
    }

    fn generate_embedding(text: &str, dimensions: usize) -> Vec<f32> {
        let mut hasher = Sha256::new();
        hasher.update(text.as_bytes());
        let digest = hasher.finalize();
        let bytes = digest.as_slice();

        let dims = dimensions.max(4);
        let mut vector = Vec::with_capacity(dims);
        for i in 0..dims {
            let idx = (i * 4) % bytes.len();
            let chunk = [
                bytes[idx],
                bytes[(idx + 1) % bytes.len()],
                bytes[(idx + 2) % bytes.len()],
                bytes[(idx + 3) % bytes.len()],
            ];
            let raw = u32::from_le_bytes(chunk);
            let normalised = (raw as f64 / u32::MAX as f64) * 2.0 - 1.0;
            vector.push(normalised as f32);
        }

        vector
    }

    fn collection_name(platform: &str, model: &str) -> String {
        let sanitized = model.replace(['-', '.'], "_");
        format!("{}_{}", platform, sanitized)
    }

    /// Get platform credentials from configuration
    fn get_platform_credentials_with_override(
        platform: &str,
        _access_token: &str,
        _refresh_token: &str,
        api_key: &str,
        api_secret: &str,
        api_url: Option<&str>,
    ) -> AppResult<PlatformCredentials> {
        // Get base credentials from environment
        let mut creds = Self::get_platform_credentials(platform)?;

        // Override with message credentials if provided
        match platform {
            "tiktok" | "shopee" | "lazada" => {
                // OAuth platforms - keep app_key/app_secret from environment
                // The access_token should be passed separately to the gateway methods
                // Don't override app_key with access_token
            }
            "woocommerce" | "shopify" | "bigcommerce" | "ecwid" | "magento" => {
                // API key/secret platforms
                if !api_key.is_empty() {
                    creds.app_key = api_key.to_string();
                }
                if !api_secret.is_empty() {
                    creds.app_secret = api_secret.to_string();
                }
                if let Some(url) = api_url {
                    creds.api_base_url = url.to_string();
                }
            }
            _ => {
                // Other platforms - use provided credentials
                if !api_key.is_empty() {
                    creds.app_key = api_key.to_string();
                }
                if !api_secret.is_empty() {
                    creds.app_secret = api_secret.to_string();
                }
            }
        }

        Ok(creds)
    }

    async fn resolve_credentials_from_strapi(
        platform: &str,
        tenant_id: &str,
        shop_id: &str,
    ) -> AppResult<ResolvedCredentials> {
        let tenant = tenant_id.trim();
        if tenant.is_empty() || tenant.eq_ignore_ascii_case("default") {
            return Err(AppError::Unauthorized(
                "tenant_id is required to resolve credentials from Strapi".to_string(),
            ));
        }

        info!(
            "Resolving {} credentials from Strapi for shop {} (tenant {})",
            platform, shop_id, tenant
        );

        let entry = fetch_shop_token(platform, shop_id, tenant)
            .await?
            .ok_or_else(|| {
                AppError::Unauthorized(format!(
                    "No cached {} credentials found in Strapi for shop {} (tenant {}). Reconnect the platform.",
                    platform, shop_id, tenant
                ))
            })?;

        info!(
            "Resolved {} credentials from Strapi cache for shop {} (tenant {})",
            platform, shop_id, tenant
        );

        Ok(ResolvedCredentials {
            access_token: resolve_cached_access_token(&entry),
            api_key: resolve_cached_api_key(&entry),
            api_secret: resolve_cached_api_secret(&entry),
            store_url: resolve_cached_store_url(&entry),
        })
    }

    fn get_platform_credentials(platform: &str) -> AppResult<PlatformCredentials> {
        info!("Loading credentials for platform: {}", platform);

        match platform {
            "tiktok" => Ok(PlatformCredentials {
                api_key: String::new(),
                app_key: std::env::var("TIKTOK_APP_KEY").unwrap_or_default(),
                app_secret: std::env::var("TIKTOK_APP_SECRET").unwrap_or_default(),
                api_base_url: std::env::var("TIKTOK_API_BASE_URL")
                    .unwrap_or_else(|_| "https://open-api.tiktokglobalshop.com".to_string()),
                oauth_authorize_url: Some(
                    std::env::var("TIKTOK_OAUTH_AUTHORIZE_URL").unwrap_or_else(|_| {
                        "https://auth.tiktok-shops.com/oauth/authorize".to_string()
                    }),
                ),
                oauth_token_url: Some(std::env::var("TIKTOK_TOKEN_URL").unwrap_or_else(|_| {
                    "https://auth.tiktok-shops.com/api/v2/token/get".to_string()
                })),
                redirect_uri: Some(
                    std::env::var("TIKTOK_REDIRECT_URI").unwrap_or_else(|_| {
                        "https://app.lodashventure.local/dashboard/connect/tiktok/callback".to_string()
                    }),
                ),
                oauth_refresh_url: None,
                oauth_revoke_url: None,
                store_id: None,
                tenant_id: None,
                base_url: None,
                rate_limit_rps: 10.0,
                market: std::env::var("TIKTOK_MARKET").ok(),
                service_id: std::env::var("TIKTOK_SERVICE_ID").ok(),
            }),
            "woocommerce" => Ok(PlatformCredentials {
                api_key: String::new(),
                app_key: std::env::var("WOOCOMMERCE_CONSUMER_KEY").unwrap_or_default(),
                app_secret: std::env::var("WOOCOMMERCE_CONSUMER_SECRET").unwrap_or_default(),
                api_base_url: std::env::var("WOOCOMMERCE_API_BASE_URL")
                    .unwrap_or_else(|_| "https://example.com/wp-json/wc/v3".to_string()),
                oauth_authorize_url: None,
                oauth_token_url: None,
                redirect_uri: None,
                oauth_refresh_url: None,
                oauth_revoke_url: None,
                store_id: None,
                tenant_id: None,
                base_url: None,
                rate_limit_rps: 10.0,
                market: None,
                service_id: None,
            }),
            "shopee" => Ok(PlatformCredentials {
                api_key: String::new(),
                app_key: std::env::var("SHOPEE_PARTNER_ID").unwrap_or_default(),
                app_secret: std::env::var("SHOPEE_PARTNER_KEY").unwrap_or_default(),
                api_base_url: std::env::var("SHOPEE_API_BASE_URL")
                    .unwrap_or_else(|_| "https://partner.shopeemobile.com".to_string()),
                oauth_authorize_url: Some(
                    std::env::var("SHOPEE_OAUTH_AUTHORIZE_URL").unwrap_or_else(|_| {
                        "https://partner.shopeemobile.com".to_string()
                    }),
                ),
                oauth_token_url: None,
                redirect_uri: Some(
                    std::env::var("SHOPEE_REDIRECT_URI").unwrap_or_else(|_| {
                        "https://api.lodashventure.local/api/v1/where_on_sales/gateway/ecommerce/shopee/callback".to_string()
                    }),
                ),
                oauth_refresh_url: None,
                oauth_revoke_url: None,
                store_id: None,
                tenant_id: None,
                base_url: None,
                rate_limit_rps: 10.0,
                market: None,
                service_id: None,
            }),
            "lazada" => Ok(PlatformCredentials {
                api_key: String::new(),
                app_key: std::env::var("LAZADA_APP_KEY")
                    .unwrap_or_else(|_| "125832".to_string()), // Hardcoded for development
                app_secret: std::env::var("LAZADA_APP_SECRET")
                    .unwrap_or_else(|_| "0aba2e83a4296419bf27e76e2fb063f46e90cf30".to_string()), // Hardcoded for development
                api_base_url: std::env::var("LAZADA_API_BASE_URL")
                    .unwrap_or_else(|_| "https://api.lazada.com/rest".to_string()),
                oauth_authorize_url: Some(
                    std::env::var("LAZADA_OAUTH_AUTHORIZE_URL")
                        .unwrap_or_else(|_| "https://auth.lazada.com/oauth/authorize".to_string()),
                ),
                oauth_token_url: None,
                redirect_uri: Some(
                    std::env::var("LAZADA_REDIRECT_URI").unwrap_or_else(|_| {
                        "https://app.lodashventure.local/dashboard/connect/lazada/callback".to_string()
                    }),
                ),
                oauth_refresh_url: None,
                oauth_revoke_url: None,
                store_id: None,
                tenant_id: None,
                base_url: None,
                rate_limit_rps: 10.0,
                market: None,
                service_id: None,
            }),
            _ => {
                tracing::warn!(
                    "Unsupported platform: {}, using default credentials",
                    platform
                );
                Ok(PlatformCredentials {
                    api_key: String::new(),
                    app_key: String::new(),
                    app_secret: String::new(),
                    api_base_url: "https://api.example.com".to_string(),
                    oauth_authorize_url: None,
                    oauth_token_url: None,
                    redirect_uri: None,
                    oauth_refresh_url: None,
                    oauth_revoke_url: None,
                    store_id: None,
                    tenant_id: None,
                    base_url: None,
                    rate_limit_rps: 10.0,
                    market: None,
                    service_id: None,
                })
            }
        }
    }
}

#[async_trait]
impl super::Worker for ProductConsumerWorker {
    async fn start(&self) -> AppResult<()> {
        self.start().await
    }

    async fn stop(&self) -> AppResult<()> {
        info!("Stopping product consumer worker");
        self.queue
            .close()
            .await
            .map_err(|e| AppError::QueueError(format!("Failed to close queue: {}", e)))
    }

    async fn process_job(&self, job_data: Vec<u8>) -> AppResult<()> {
        let msg: ProductFetchMessage = serde_json::from_slice(&job_data).map_err(|e| {
            AppError::SerializationError(format!("Failed to parse job data: {}", e))
        })?;

        let override_url = msg.store_url.as_deref().or_else(|| msg.api_url.as_deref());
        let platform_creds = Self::get_platform_credentials_with_override(
            &msg.platform,
            msg.access_token.as_deref().unwrap_or_default(),
            "",
            msg.api_key.as_deref().unwrap_or(""),
            msg.api_secret.as_deref().unwrap_or(""),
            override_url,
        )?;

        let tenant_id = msg
            .tenant_id
            .clone()
            .unwrap_or_else(|| "default".to_string());

        // Convert PlatformCredentials to interface Credentials
        let credentials = crate::interfaces::platform_gateway::Credentials {
            api_key: if platform_creds.app_key.is_empty() {
                None
            } else {
                Some(platform_creds.app_key.clone())
            },
            api_secret: if platform_creds.app_secret.is_empty() {
                None
            } else {
                Some(platform_creds.app_secret.clone())
            },
            access_token: msg.access_token.clone(),
            refresh_token: None,
            shop_id: if platform_creds.api_base_url.is_empty() {
                msg.store_url.clone()
            } else {
                Some(platform_creds.api_base_url.clone())
            },
            store_url: msg.store_url.clone(),
            additional: std::collections::HashMap::new(),
            extra: std::collections::HashMap::new(),
        };

        let factory = GatewayFactoryImpl::new();
        let _platform_enum =
            crate::model::v1::platfrom::entries::PlatformType::from_str(&msg.platform)
                .map_err(|e| AppError::BadRequest(format!("Invalid platform: {}", e)))?;
        let gateway = factory
            .create_gateway(&msg.platform, credentials)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to create gateway: {:?}", e))?;

        let fetch_future = gateway.get_product(&msg.product_id);
        let timeout_duration = tokio::time::Duration::from_secs(30);

        let platform_product = match tokio::time::timeout(timeout_duration, fetch_future).await {
            Ok(result) => result?,
            Err(_) => {
                return Err(AppError::TimeoutError(format!(
                    "Timeout fetching product {} from {} after 30 seconds",
                    msg.product_id, msg.platform
                )));
            }
        };

        // Convert PlatformProduct to Product
        use crate::model::v1::platfrom::entries::{Price, Product, ProductImage, ProductStatus};

        let product = Product {
            product_id: Uuid::new_v4().to_string(),
            platform_product_id: platform_product.id.clone(),
            shop_id: msg.shop_id.clone(),
            platform_shop_id: msg.platform_shop_id.unwrap_or_default(),
            platform: PlatformType::from_str(&msg.platform).unwrap_or(PlatformType::Shopify),
            title: platform_product.title,
            brand: String::new(),
            description: Some(platform_product.description.unwrap_or_default()),
            price: Price {
                amount: rust_decimal::Decimal::from_f64_retain(platform_product.price)
                    .unwrap_or_default(),
                original_price: None,
                discount_percentage: None,
                currency: platform_product.currency.clone(),
            },
            currency: platform_product.currency,
            sku: platform_product.sku.unwrap_or_default(),
            quantity: 0, // TODO: Get from variants
            images: platform_product
                .images
                .into_iter()
                .enumerate()
                .map(|(idx, url)| ProductImage {
                    url,
                    alt: None,
                    is_primary: idx == 0,
                    position: idx as i32,
                })
                .collect(),
            categories: vec![],
            attributes: platform_product
                .attributes
                .into_iter()
                .map(|(k, v)| (k, v.to_string()))
                .collect(),
            status: ProductStatus::Active,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            synced_at: Some(chrono::Utc::now()),
        };

        if let Err(e) = self.clickhouse.save_product(&tenant_id, &product).await {
            warn!("Failed to save to regular products table: {}", e);
        }

        // Save to product table with cityHash sharding
        self.clickhouse
            .save_unified_product(&tenant_id, &product)
            .await?;

        if let Err(e) = Self::sync_product_to_vector(
            self.vector_repo.clone(),
            self.config.clone(),
            &tenant_id,
            &msg.platform,
            &product,
            msg.embedding_model.as_deref(),
            msg.embedding_prompt.as_deref(),
        )
        .await
        {
            warn!(
                "Vector sync failed for product {}: {}",
                product.product_id, e
            );
        }

        Ok(())
    }
}
