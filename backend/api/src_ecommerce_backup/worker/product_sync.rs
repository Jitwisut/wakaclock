/// ไฟล์ product_sync.rs - Product Sync Worker
/// จัดการการ sync สินค้าจาก e-commerce platforms แบบ asynchronous
/// ทำงานผ่าน message queue (RabbitMQ) สำหรับประมวลผลเป็น batch
use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::Arc;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::{
    client::strapi::shop_tokens::{
        fetch_shop_token, resolve_access_token as resolve_cached_access_token,
        resolve_api_key as resolve_cached_api_key, resolve_api_secret as resolve_cached_api_secret,
        resolve_store_url as resolve_cached_store_url,
    },
    interfaces::platform_gateway::{Credentials, GatewayFactory},
    model::v1::platfrom::entries::{AppError, AppResult},
    repository::{ProductRepository, UnifiedProductRepository},
    worker::Worker,
    AppState,
};

/// Product sync job message
/// ข้อมูล message สำหรับงาน sync สินค้า ส่งผ่าน queue
/// รวม credentials และ parameters ที่จำเป็นสำหรับการ sync
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductSyncMessage {
    pub job_id: String,                 // ID ของ job สำหรับ tracking
    pub tenant_id: String,              // ID ของ tenant/organization
    pub shop_id: String,                // ID ของร้านค้าใน platform
    pub platform: String,               // ชื่อ platform (tiktok, shopee, etc.)
    pub page: Option<u32>,              // หน้าที่ต้องการ sync (สำหรับ pagination)
    pub limit: Option<u32>,             // จำนวน items ต่อหน้า
    pub full_sync: bool,                // sync ทั้งหมดหรือเฉพาะที่ update
    pub correlation_id: Option<String>, // ID สำหรับ trace request แบบ distributed
    pub batch_id: Option<String>,       // Batch ID สำหรับจัดกลุ่ม sync operations
    // Credentials for API access
    // ข้อมูล credentials สำหรับเข้าถึง platform API (ส่งมาจาก Strapi)
    pub access_token: Option<String>,  // OAuth access token
    pub refresh_token: Option<String>, // OAuth refresh token
    pub api_key: Option<String>,       // API key สำหรับ platforms ที่ใช้
    pub api_secret: Option<String>,    // API secret
    pub api_url: Option<String>,       // Custom API URL (สำหรับ self-hosted platforms)
}

/// Product sync staging record
/// บันทึกข้อมูลสินค้าที่ sync มาใน staging table ก่อนอนุมัติ
/// ใช้สำหรับ review และ approve ก่อน merge เข้า production
#[derive(Debug, Clone, Serialize, Deserialize, clickhouse::Row)]
pub struct ProductSyncRecord {
    pub sync_id: String,                                    // ID ของ sync record
    pub sync_batch_id: String,                              // ID ของ batch ที่ sync มา
    pub tenant_id: String,                                  // ID ของ tenant/organization
    pub shop_id: String,                                    // ID ของร้านค้า
    pub platform_product_id: String,                        // Product ID ใน platform ต้นทาง
    pub platform: u8,                    // Platform code (1=TikTok, 2=Shopee, etc.)
    pub product_data: serde_json::Value, // ข้อมูลสินค้าแบบ JSON
    pub suggested_match_id: Option<String>, // ID สินค้าที่คาดว่าตรงกัน (สำหรับ dedup)
    pub match_confidence: Option<f32>,   // ความมั่นใจในการ match (0-1)
    pub sync_status: String,             // สถานะ (pending, approved, rejected)
    pub synced_at: chrono::DateTime<chrono::Utc>, // เวลาที่ sync
    pub approved_at: Option<chrono::DateTime<chrono::Utc>>, // เวลาที่อนุมัติ
    pub approved_by: Option<String>,     // ผู้อนุมัติ
}

/// Product sync batch record
/// บันทึกข้อมูล batch ของการ sync สำหรับ tracking และ monitoring
#[derive(Debug, Clone, Serialize, Deserialize, clickhouse::Row)]
pub struct ProductSyncBatch {
    pub batch_id: String, // ID ของ batch
    pub tenant_id: String,
    pub shop_id: String,
    pub platform: u8,
    pub status: String,
    pub total_products: u32,
    pub approved_products: u32,
    pub rejected_products: u32,
    pub pending_products: u32,
    pub sync_params: String,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaUploadRequestItem {
    input: MediaUploadRequestInput,
    path: String,
    key: String,
    private: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    filename: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    hot: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaUploadRequestInput {
    url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaWorkerLocation {
    key: String,
    relative_path: String,
    full_path: String,
    #[serde(default)]
    cdn_path: Option<String>,
    #[serde(default)]
    private: bool,
    #[serde(default)]
    checksum: Option<String>,
    #[serde(default)]
    task_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MediaWorkerResponse {
    status: String,
    #[serde(default)]
    location: Vec<MediaWorkerLocation>,
    #[serde(default)]
    enqueued: Vec<MediaWorkerLocation>,
}

/// Product sync worker
pub struct ProductSyncWorker {
    state: Arc<AppState>,
    product_repo: Arc<dyn ProductRepository>,
    http_client: Client,
}

impl ProductSyncWorker {
    pub fn new(state: Arc<AppState>, product_repo: Arc<dyn ProductRepository>) -> Self {
        // Create a new ClickHouse client for the unified repository
        let clickhouse_client = Arc::new(
            clickhouse::Client::default()
                .with_url(&state.config.database.clickhouse_url)
                .with_user("default")
                .with_password("default")
                .with_database(&state.config.database.clickhouse_database),
        );

        let _unified_repo = Arc::new(UnifiedProductRepository::new(
            clickhouse_client,
            state.config.database.clickhouse_database.clone(),
        ));

        Self {
            state,
            product_repo,
            http_client: Client::new(),
        }
    }

    pub async fn process_message(&self, message: ProductSyncMessage) -> AppResult<()> {
        self.sync_products(message).await
    }

    async fn sync_products(&self, message: ProductSyncMessage) -> AppResult<()> {
        info!(
            "Starting product sync for shop {} on platform {}",
            message.shop_id, message.platform
        );

        let mut api_key = message.api_key.clone();
        let mut api_secret = message.api_secret.clone();
        let mut access_token = message.access_token.clone();
        let mut refresh_token = message.refresh_token.clone();
        let mut store_url = message.api_url.clone();

        let needs_lookup = access_token.is_none()
            || api_key.is_none()
            || store_url.is_none()
            || message.platform.eq_ignore_ascii_case("medusa");

        if needs_lookup {
            match fetch_shop_token(&message.platform, &message.shop_id, &message.tenant_id).await {
                Ok(Some(entry)) => {
                    if access_token.is_none() {
                        access_token = resolve_cached_access_token(&entry);
                    }
                    if api_key.is_none() {
                        api_key = resolve_cached_api_key(&entry);
                    }
                    if api_secret.is_none() {
                        api_secret = resolve_cached_api_secret(&entry);
                    }
                    if refresh_token.is_none() {
                        refresh_token = entry.refresh_token.clone().and_then(|token| {
                            let trimmed = token.trim();
                            if trimmed.is_empty() {
                                None
                            } else {
                                Some(trimmed.to_string())
                            }
                        });
                    }
                    if store_url.is_none() {
                        store_url = resolve_cached_store_url(&entry);
                    }
                }
                Ok(None) => {
                    warn!(
                        "No cached credentials found for shop {} (tenant {}) on platform {}",
                        message.shop_id, message.tenant_id, message.platform
                    );
                }
                Err(err) => {
                    warn!(
                        "Failed to fetch cached credentials for shop {} (tenant {}) on platform {}: {}",
                        message.shop_id, message.tenant_id, message.platform, err
                    );
                }
            }
        }

        let mut extra = std::collections::HashMap::new();
        if let Some(url) = store_url.clone() {
            extra.insert("base_url".to_string(), url);
        }

        let credentials = Credentials {
            api_key,
            api_secret,
            access_token,
            refresh_token,
            shop_id: Some(message.shop_id.clone()),
            store_url,
            additional: std::collections::HashMap::new(),
            extra,
        };

        // Get the platform gateway with credentials
        let gateway_factory = crate::interfaces::GatewayFactoryImpl::new();
        // Create gateway with credentials
        let gateway = gateway_factory
            .create_gateway(&message.platform, credentials)
            .await?;

        // Determine pagination
        let page = message.page.unwrap_or(1).max(1);
        let limit = message.limit.unwrap_or(100).clamp(1, 100);
        let offset = page.saturating_sub(1).saturating_mul(limit);

        // Fetch products from platform
        let list_params = crate::interfaces::platform_gateway::ListProductParams {
            page: Some(page),
            limit: Some(limit),
            offset: Some(offset),
            status: None,
            search: None,
            sort: None,
            shop_id: Some(message.shop_id.clone()),
        };

        let product_list = gateway.list_products(&list_params).await?;

        info!(
            "Fetched {} products from {} for shop {}",
            product_list.products.len(),
            message.platform,
            message.shop_id
        );

        let platform_type =
            crate::model::v1::platfrom::entries::PlatformType::from_str(&message.platform)
                .map_err(|_| {
                    AppError::ValidationError(format!(
                        "Unsupported platform '{}'",
                        message.platform
                    ))
                })?;

        // Convert PlatformProduct to Product and save
        if !product_list.products.is_empty() {
            for platform_product in product_list.products {
                let transformed_images = self
                    .prepare_product_images(
                        &message,
                        &platform_product.id,
                        &platform_product.images,
                    )
                    .await;

                let brand = platform_product
                    .attributes
                    .get("brand")
                    .cloned()
                    .unwrap_or_default();
                let attributes = platform_product.attributes.clone();

                let aggregated_quantity = platform_product
                    .quantity
                    .or_else(|| {
                        if platform_product.variants.is_empty() {
                            None
                        } else {
                            Some(
                                platform_product
                                    .variants
                                    .iter()
                                    .map(|variant| {
                                        variant.inventory.or(variant.quantity).unwrap_or(0)
                                    })
                                    .sum::<i32>(),
                            )
                        }
                    })
                    .unwrap_or(0);

                let quantity = aggregated_quantity.clamp(0, i16::MAX as i32) as i16;

                let status = match platform_product.status.to_ascii_lowercase().as_str() {
                    "inactive" | "disabled" | "hidden" => {
                        crate::model::v1::platfrom::entries::ProductStatus::Inactive
                    }
                    "out_of_stock" => {
                        crate::model::v1::platfrom::entries::ProductStatus::OutOfStock
                    }
                    _ => crate::model::v1::platfrom::entries::ProductStatus::Active,
                };

                let product = crate::model::v1::platfrom::entries::Product {
                    product_id: uuid::Uuid::new_v4().to_string(),
                    platform_product_id: platform_product.id.clone(),
                    shop_id: message.shop_id.clone(),
                    platform_shop_id: message.shop_id.clone(),
                    platform: platform_type,
                    title: platform_product.title,
                    brand,
                    description: platform_product.description,
                    price: crate::model::v1::platfrom::entries::Price {
                        amount: rust_decimal::Decimal::from_f64_retain(platform_product.price)
                            .unwrap_or_default(),
                        original_price: None,
                        discount_percentage: None,
                        currency: platform_product.currency.clone(),
                    },
                    currency: platform_product.currency,
                    sku: platform_product.sku.unwrap_or_default(),
                    quantity,
                    images: transformed_images,
                    categories: vec![],
                    attributes,
                    status,
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                    synced_at: Some(chrono::Utc::now()),
                };

                self.product_repo
                    .save_product(&message.tenant_id, &product)
                    .await?;
            }
        }

        // If full sync and there might be more pages, queue next page
        if message.full_sync && product_list.has_more {
            let next_message = ProductSyncMessage {
                job_id: Uuid::new_v4().to_string(),
                tenant_id: message.tenant_id.clone(),
                shop_id: message.shop_id.clone(),
                platform: message.platform.clone(),
                page: Some(page + 1),
                limit: Some(limit),
                full_sync: true,
                correlation_id: message.correlation_id.clone(),
                batch_id: message.batch_id.clone(),
                // Pass along credentials for next page
                access_token: message.access_token.clone(),
                refresh_token: message.refresh_token.clone(),
                api_key: message.api_key.clone(),
                api_secret: message.api_secret.clone(),
                api_url: message.api_url.clone(),
            };

            // Queue next page
            self.queue_next_page(next_message).await?;
        }

        // Update shop last sync time in ClickHouse
        let update_query = r#"
            ALTER TABLE shops
            UPDATE last_sync_at = now()
            WHERE shop_id = ? AND platform = ?
        "#;

        self.state
            .clickhouse
            .query(update_query)
            .bind(&message.shop_id)
            .bind(&message.platform)
            .execute()
            .await
            .map_err(|e| {
                AppError::DatabaseError(format!("Failed to update shop last sync time: {}", e))
            })?;

        info!(
            "Updated last sync time for shop {} on platform {}",
            message.shop_id, message.platform
        );

        Ok(())
    }

    async fn prepare_product_images(
        &self,
        message: &ProductSyncMessage,
        platform_product_id: &str,
        image_urls: &[String],
    ) -> Vec<crate::model::v1::platfrom::entries::ProductImage> {
        if image_urls.is_empty() {
            return Vec::new();
        }

        let worker_url = self.state.config.media.worker_url.trim();
        if worker_url.is_empty() {
            return map_urls_to_product_images(image_urls);
        }

        let endpoint = format!("{}/media/upload", worker_url.trim_end_matches('/'));
        let storage_path = build_media_path(
            &message.tenant_id,
            &message.shop_id,
            &message.platform,
            platform_product_id,
        );

        let payload: Vec<MediaUploadRequestItem> = image_urls
            .iter()
            .enumerate()
            .map(|(idx, url)| MediaUploadRequestItem {
                input: MediaUploadRequestInput { url: url.clone() },
                path: storage_path.clone(),
                key: if idx == 0 {
                    "primary".to_string()
                } else {
                    format!("gallery-{}", idx)
                },
                private: false,
                filename: None,
                hot: Some(true),
            })
            .collect();

        let mut request = self
            .http_client
            .post(&endpoint)
            .query(&[("hot", "true")])
            .json(&payload);

        if let Some(token) = self.state.config.media.auth_token.as_ref() {
            if !token.is_empty() {
                request = request.bearer_auth(token);
            }
        }

        match request.send().await {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    match resp.json::<MediaWorkerResponse>().await {
                        Ok(body) => {
                            if !body.location.is_empty() && body.location.len() == image_urls.len()
                            {
                                debug!(
                                    "Media worker uploaded {} images for product {} (job {})",
                                    body.location.len(),
                                    platform_product_id,
                                    message.job_id
                                );
                                return map_worker_locations_to_product_images(
                                    image_urls,
                                    &body.location,
                                );
                            }

                            if !body.enqueued.is_empty() {
                                warn!(
                                    "Media worker enqueued {} uploads despite hot mode for product {} (job {})",
                                    body.enqueued.len(),
                                    platform_product_id,
                                    message.job_id
                                );
                            } else {
                                warn!(
                                    "Media worker returned unexpected response for product {} (job {}): status={}, locations={}",
                                    platform_product_id,
                                    message.job_id,
                                    body.status,
                                    body.location.len()
                                );
                            }
                        }
                        Err(err) => {
                            warn!(
                                "Failed to parse media worker response for product {} (job {}): {}",
                                platform_product_id, message.job_id, err
                            );
                        }
                    }
                } else {
                    let body_text = resp.text().await.unwrap_or_default();
                    warn!(
                        "Media worker upload failed for product {} (job {}): status={} body={}",
                        platform_product_id,
                        message.job_id,
                        status.as_u16(),
                        body_text
                    );
                }
            }
            Err(err) => {
                warn!(
                    "Media worker request error for product {} (job {}): {}",
                    platform_product_id, message.job_id, err
                );
            }
        }

        map_urls_to_product_images(image_urls)
    }

    async fn queue_next_page(&self, message: ProductSyncMessage) -> AppResult<()> {
        // Queue the next page for processing
        // This would use the queue service
        info!(
            "Queueing next page (page {}) for shop {}",
            message.page.unwrap_or(1),
            message.shop_id
        );
        Ok(())
    }
}

fn map_urls_to_product_images(
    image_urls: &[String],
) -> Vec<crate::model::v1::platfrom::entries::ProductImage> {
    image_urls
        .iter()
        .enumerate()
        .map(
            |(idx, url)| crate::model::v1::platfrom::entries::ProductImage {
                url: url.clone(),
                alt: None,
                is_primary: idx == 0,
                position: idx as i32,
            },
        )
        .collect()
}

fn map_worker_locations_to_product_images(
    image_urls: &[String],
    locations: &[MediaWorkerLocation],
) -> Vec<crate::model::v1::platfrom::entries::ProductImage> {
    locations
        .iter()
        .zip(image_urls.iter())
        .enumerate()
        .map(|(idx, (location, original))| {
            let final_url = location
                .cdn_path
                .as_ref()
                .filter(|value| !value.is_empty())
                .cloned()
                .unwrap_or_else(|| {
                    if !location.full_path.is_empty() {
                        location.full_path.clone()
                    } else {
                        original.clone()
                    }
                });

            crate::model::v1::platfrom::entries::ProductImage {
                url: final_url,
                alt: None,
                is_primary: idx == 0,
                position: idx as i32,
            }
        })
        .collect()
}

fn build_media_path(tenant_id: &str, shop_id: &str, platform: &str, product_id: &str) -> String {
    format!(
        "tenants/{}/shops/{}/platforms/{}/products/{}",
        sanitize_segment(tenant_id),
        sanitize_segment(shop_id),
        sanitize_segment(platform),
        sanitize_segment(product_id)
    )
}

fn sanitize_segment(segment: &str) -> String {
    let sanitized: String = segment
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else if matches!(c, '-' | '_') {
                c
            } else {
                '-'
            }
        })
        .collect();

    let trimmed = sanitized.trim_matches('-');
    if trimmed.is_empty() {
        "item".to_string()
    } else {
        trimmed.to_string()
    }
}

#[async_trait]
impl Worker for ProductSyncWorker {
    async fn start(&self) -> AppResult<()> {
        info!("Starting product sync worker");

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

    async fn stop(&self) -> AppResult<()> {
        info!("Stopping product sync worker");
        Ok(())
    }

    async fn process_job(&self, job_data: Vec<u8>) -> AppResult<()> {
        // Deserialize the message
        let message: ProductSyncMessage = serde_json::from_slice(&job_data).map_err(|e| {
            AppError::SerializationError(format!(
                "Failed to deserialize product sync message: {}",
                e
            ))
        })?;

        info!(
            "Processing product sync job {} for shop {}",
            message.job_id, message.shop_id
        );

        // Perform the sync
        match self.sync_products(message.clone()).await {
            Ok(_) => {
                info!("Product sync job {} completed successfully", message.job_id);
                Ok(())
            }
            Err(e) => {
                error!("Product sync job {} failed: {}", message.job_id, e);
                Err(e)
            }
        }
    }
}
