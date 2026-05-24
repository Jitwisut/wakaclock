/// โมดูลสำหรับ Platform Product Service
///
/// Service หลักสำหรับการจัดการสินค้าข้ามแพลตฟอร์ม e-commerce ต่างๆ
/// รวมทั้งการซิงค์ข้อมูล การค้นหา และการจัดการ lifecycle ของสินค้า
///
/// ความสามารถหลัก:
/// - Product CRUD operations ข้ามแพลตฟอร์ม
/// - Real-time product synchronization
/// - Background product sync jobs
/// - Product search และ filtering
/// - Category management
/// - Vector sync สำหรับ AI search
/// - Sync status tracking และ progress monitoring
///
/// แพลตฟอร์มที่รองรับ:
/// - TikTok Shop
/// - Shopee
/// - Lazada
/// - Amazon
/// - WooCommerce
/// - BigCommerce
/// - และแพลตฟอร์มอื่นๆ
use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::{DateTime, SecondsFormat, Utc};
use clickhouse::Row;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use tracing::{error, info, warn};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    client::strapi::shop_tokens::{
        fetch_shop_token, resolve_access_token as resolve_cached_access_token,
        resolve_api_key as resolve_cached_api_key, resolve_api_secret as resolve_cached_api_secret,
        resolve_shop_cipher as resolve_cached_shop_cipher,
        resolve_store_url as resolve_cached_store_url, ShopTokenCacheEntry,
    },
    client::upload::UploadClient,
    config::PlatformCredentials,
    infrastructure::queue::traits::{JobType, QueueMessage},
    infrastructure::sync::{ProgressKey, RunState, RunStatus, RunStatusKey},
    interfaces::{
        platform_gateway::{Credentials, ListProductParams},
        GatewayFactory,
    },
    model::{
        error::{AppError, AppResult},
        v1::{
            gateway::request::product::{CreateProductRequest, UpdateProductRequest},
            platfrom::{
                entries::{
                    AppResult as ModelAppResult, PlatformType, Price, Product, ProductImage,
                    ProductStatus,
                },
                request::product::{
                    ProductListQuery, ProductMediaUploadRequest, ProductSnapshotQuery,
                    ProductSyncLogQuery, ProductSyncReviewQuery, SyncQuery, SyncRequestBody,
                },
                response::product::{
                    Category, ProductDetail, ProductListItem, ProductListResponse,
                    ProductMediaDownloadResponse, ProductMediaUploadResponse, ProductSnapshot,
                    ProductSnapshotListResponse, ProductSyncLogEntry, ProductSyncLogResponse,
                    ProductSyncReviewListResponse, ProductSyncReviewRecord, ProductSyncRunStatus,
                    PromoteProductSyncResponse, SyncProductListResponse, SyncProductsResponse,
                    SyncResponse, SyncToVectorResponse,
                },
            },
        },
    },
    repository::ProductRepository,
    worker::ProductSyncMessage,
    AppState,
};
use rust_decimal::prelude::ToPrimitive;

const DEFAULT_PLATFORM: &str = "tiktok";
pub(crate) const DEFAULT_EXPORT_LIMIT: usize = 500;
pub(crate) const MAX_EXPORT_LIMIT: usize = 5_000;
const EXPORT_PAGE_SIZE: u32 = 500;

#[derive(Debug, Serialize, ToSchema)]
pub struct ProductSyncStatusResponse {
    pub job_id: String,
    pub status: String,
    pub message: String,
    pub products_synced: u64,
    pub total_products: Option<u64>,
}

// ============================================================================
// Service Trait
// ============================================================================

#[async_trait]
#[allow(clippy::too_many_arguments)]
pub trait PlatformProductService: Send + Sync {
    // Product CRUD operations
    async fn list_unique_products(
        &self,
        platform: Option<&str>,
        shop_id: Option<&str>,
        search: Option<&str>,
        page: u32,
        limit: u32,
    ) -> AppResult<ProductListResponse>;

    async fn get_product_detail(&self, product_id: &str) -> AppResult<ProductDetail>;

    async fn create_product(
        &self,
        tenant_id: &str,
        payload: &CreateProductRequest,
    ) -> AppResult<serde_json::Value>;

    async fn update_product(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        product_id: &str,
        payload: &UpdateProductRequest,
    ) -> AppResult<serde_json::Value>;

    async fn delete_product(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        product_id: &str,
    ) -> AppResult<serde_json::Value>;

    async fn fetch_platform_products(
        &self,
        platform: &str,
        shop_id: &str,
        query: &ProductListQuery,
    ) -> AppResult<serde_json::Value>;

    async fn list_categories(
        &self,
        platform: Option<&str>,
        shop_id: Option<&str>,
    ) -> ModelAppResult<Vec<Category>>;

    async fn realtime_sync_products(
        &self,
        platform: &str,
        shop_id: &str,
        access_token: String,
        user_id: Option<String>,
        limit: Option<usize>,
        offset: Option<usize>,
        shop_cipher: Option<String>,
    ) -> AppResult<SyncResponse>;

    async fn sync_platform_products(
        &self,
        platform: &str,
        shop_id: &str,
        query: &SyncQuery,
        body: Option<&SyncRequestBody>,
    ) -> AppResult<SyncResponse>;

    async fn get_synced_products(
        &self,
        tenant_id: &str,
        platform: Option<&str>,
        shop_id: &str,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> AppResult<SyncProductListResponse>;

    async fn export_products(
        &self,
        platform: &str,
        shop_id: &str,
        limit: usize,
    ) -> AppResult<Vec<Product>>;

    async fn list_product_snapshots(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> AppResult<ProductSnapshotListResponse>;

    async fn get_sync_activity(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> AppResult<ProductSyncLogResponse>;

    async fn list_product_sync_review(
        &self,
        tenant_id: &str,
        query: &ProductSyncReviewQuery,
    ) -> AppResult<ProductSyncReviewListResponse>;

    async fn promote_product_sync_records(
        &self,
        tenant_id: &str,
        sync_ids: &[String],
        approved_by: &str,
    ) -> AppResult<PromoteProductSyncResponse>;

    async fn upload_product_media(
        &self,
        tenant_id: &str,
        request: &ProductMediaUploadRequest,
    ) -> AppResult<ProductMediaUploadResponse>;

    async fn resolve_product_media_download(
        &self,
        key: &str,
    ) -> AppResult<ProductMediaDownloadResponse>;

    async fn sync_products_extended(
        &self,
        shop_slug: &str,
        shop_id: u64,
        platform: &str,
        tenant_id: &str,
        token_id: Option<String>,
        full_sync: bool,
        api_key: Option<String>,
        api_secret: Option<String>,
        store_url: Option<String>,
    ) -> AppResult<SyncProductsResponse>;

    async fn get_sync_status(&self, job_id: &str) -> AppResult<ProductSyncStatusResponse>;

    async fn get_sync_job_status(&self, job_id: &str) -> AppResult<serde_json::Value>;

    async fn list_sync_jobs(
        &self,
        tenant_id: Option<String>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> AppResult<serde_json::Value>;

    async fn cancel_sync_job(&self, job_id: &str) -> AppResult<serde_json::Value>;

    async fn sync_to_vector(
        &self,
        platform: &str,
        shop_id: &str,
        embedding_model: Option<String>,
        embedding_prompt: Option<String>,
        product_ids: Option<Vec<String>>,
    ) -> ModelAppResult<SyncToVectorResponse>;
}

// ============================================================================
// Service Implementation
// ============================================================================

pub struct PlatformProductServiceImpl {
    state: Arc<AppState>,
}

impl PlatformProductServiceImpl {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    fn platform_credentials_or_default(&self, platform: &str) -> PlatformCredentials {
        self.state
            .config
            .get_platform_credentials_optional(platform)
            .or_else(|| {
                warn!(
                    "Platform '{}' credentials not found in config; proceeding with defaults",
                    platform
                );
                None
            })
            .unwrap_or_else(PlatformCredentials::default)
    }

    async fn enqueue_product_sync_job(
        &self,
        tenant_id: &str,
        shop_id: &str,
        platform: &str,
        page: Option<u32>,
        limit: Option<u32>,
        full_sync: bool,
        access_token: String,
        refresh_token: Option<String>,
        api_key: Option<String>,
        api_secret: Option<String>,
        api_url: Option<String>,
        source: &str,
    ) -> AppResult<SyncResponse> {
        let mut queue_message = QueueMessage::new(JobType::ProductSync, serde_json::Value::Null);
        let job_id = queue_message.id.clone();

        let sync_message = ProductSyncMessage {
            job_id: job_id.clone(),
            tenant_id: tenant_id.to_string(),
            shop_id: shop_id.to_string(),
            platform: platform.to_string(),
            page: Some(page.unwrap_or(1)),
            limit,
            full_sync,
            correlation_id: Some(job_id.clone()),
            batch_id: None,
            access_token: Some(access_token),
            refresh_token,
            api_key,
            api_secret,
            api_url,
        };

        queue_message.payload = serde_json::to_value(&sync_message).map_err(|e| {
            AppError::SerializationError(format!("Failed to serialize product sync message: {}", e))
        })?;
        queue_message.correlation_id = Some(job_id.clone());
        queue_message.metadata = Some(json!({
            "tenant_id": tenant_id,
            "shop_id": shop_id,
            "platform": platform,
            "source": source,
        }));

        let queue_payload = serde_json::to_vec(&queue_message).map_err(|e| {
            AppError::SerializationError(format!(
                "Failed to serialize queue message for {}: {}",
                platform, e
            ))
        })?;

        let queue_subject =
            self.state
                .config
                .product_sync_queue
                .subject_for(shop_id, platform, Some(source));

        info!(
            subject = %queue_subject,
            platform = %platform,
            shop_id = %shop_id,
            source = %source,
            "Publishing product sync job to queue"
        );

        self.state
            .queue
            .publish_bytes(&queue_subject, queue_payload)
            .await
            .map_err(|e| {
                AppError::QueueError(format!(
                    "Failed to publish {} product sync job: {}",
                    platform, e
                ))
            })?;

        Ok(SyncResponse {
            message: format!(
                "Queued {} product pull via consumer (job {}).",
                platform, job_id
            ),
            status: "queued".to_string(),
            sync_id: Some(job_id.clone()),
            job_id: Some(job_id),
            synced_count: 0,
            failed_count: 0,
            success: true,
            products_synced: 0,
            products_failed: 0,
            errors: vec![],
        })
    }

    // Helper method to parse product detail from database row
    fn parse_product_detail(&self, row: &HashMap<String, String>) -> ProductDetail {
        // Extract title from JSON
        let title_json = row.get("title").unwrap_or(&"{}".to_string()).clone();
        let title = if let Ok(json) = serde_json::from_str::<serde_json::Value>(&title_json) {
            json.get("en")
                .and_then(|v| v.as_str())
                .unwrap_or(&title_json)
                .to_string()
        } else {
            title_json
        };

        // Extract description from JSON
        let desc_json = row.get("description").unwrap_or(&"{}".to_string()).clone();
        let description = if let Ok(json) = serde_json::from_str::<serde_json::Value>(&desc_json) {
            json.get("en")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        } else {
            desc_json
        };

        // Extract brand from JSON
        let brand_json = row.get("brand_name").unwrap_or(&"{}".to_string()).clone();
        let brand = if let Ok(json) = serde_json::from_str::<serde_json::Value>(&brand_json) {
            json.get("en")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string()
        } else {
            brand_json
        };

        // Parse platform number to name
        let platform_num = row.get("platform").unwrap_or(&"0".to_string()).clone();
        let platform = platform_code_to_string(&platform_num);

        // Parse availability
        let availability_num = row.get("availability").unwrap_or(&"1".to_string()).clone();
        let availability = match availability_num.as_str() {
            "1" => "in_stock",
            "2" => "out_of_stock",
            "3" => "preorder",
            _ => "unknown",
        }
        .to_string();

        // Parse arrays
        let categories = row
            .get("category")
            .and_then(|v| serde_json::from_str::<Vec<String>>(v).ok())
            .unwrap_or_default();

        let tags = row
            .get("tags")
            .and_then(|v| serde_json::from_str::<Vec<String>>(v).ok())
            .unwrap_or_default();

        let images = row
            .get("images")
            .and_then(|v| serde_json::from_str::<Vec<String>>(v).ok())
            .unwrap_or_default();

        // Parse JSON fields
        let variants = row
            .get("variant_attributes")
            .and_then(|v| serde_json::from_str::<serde_json::Value>(v).ok())
            .unwrap_or(serde_json::json!({}));

        let custom_fields = row
            .get("custom_fields")
            .and_then(|v| serde_json::from_str::<serde_json::Value>(v).ok())
            .unwrap_or(serde_json::json!({}));

        ProductDetail {
            product_id: row.get("product_id").unwrap_or(&String::new()).clone(),
            platform,
            platform_shop_id: row
                .get("platform_shop_id")
                .unwrap_or(&"0".to_string())
                .clone(),
            platform_product_id: row
                .get("platform_product_id")
                .unwrap_or(&String::new())
                .clone(),
            title,
            description,
            brand,
            categories,
            tags,
            price: row
                .get("price")
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(0.0),
            shipping_price: row
                .get("shipping_price")
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(0.0),
            shipping_free: row
                .get("shipping_free")
                .and_then(|v| v.parse::<bool>().ok())
                .unwrap_or(false),
            currency: "USD".to_string(),
            inventory: row
                .get("inventory")
                .and_then(|v| v.parse::<u32>().ok())
                .unwrap_or(0),
            availability,
            images,
            variants,
            custom_fields,
            rating: row
                .get("rating_avg")
                .and_then(|v| v.parse::<f32>().ok())
                .unwrap_or(0.0),
            reviews_count: row
                .get("reviews_count")
                .and_then(|v| v.parse::<u32>().ok())
                .unwrap_or(0),
            created_at: row.get("created_time").unwrap_or(&String::new()).clone(),
            updated_at: row.get("last_updated").unwrap_or(&String::new()).clone(),
        }
    }

    // Helper to parse ProductListItem from row
    fn parse_product_list_item(&self, row: HashMap<String, String>) -> ProductListItem {
        // Parse title from JSON format or use as plain string
        let title_raw = row.get("title").unwrap_or(&String::new()).clone();
        let title = if title_raw.starts_with('{') {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&title_raw) {
                json.get("en")
                    .and_then(|v| v.as_str())
                    .unwrap_or(&title_raw)
                    .to_string()
            } else {
                title_raw
            }
        } else {
            title_raw
        };

        // Parse description from JSON format or use as plain string
        let description_raw = row.get("description").unwrap_or(&String::new()).clone();
        let description = if description_raw.starts_with('{') {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&description_raw) {
                json.get("en")
                    .and_then(|v| v.as_str())
                    .unwrap_or(&description_raw)
                    .to_string()
            } else {
                description_raw
            }
        } else {
            description_raw
        };

        // Parse platform number to name
        let platform_num = row.get("platform").unwrap_or(&"0".to_string()).clone();
        let platform = platform_code_to_string(&platform_num);

        // Parse availability
        let availability_num = row.get("availability").unwrap_or(&"1".to_string()).clone();
        let availability = match availability_num.as_str() {
            "1" => "in_stock",
            "2" => "out_of_stock",
            "3" => "preorder",
            _ => "unknown",
        }
        .to_string();

        // Extract first image from array
        let images_str = row.get("images").unwrap_or(&"[]".to_string()).clone();
        let image_url = if let Ok(images) = serde_json::from_str::<Vec<String>>(&images_str) {
            images.first().cloned()
        } else {
            None
        };

        ProductListItem {
            product_id: row.get("product_id").unwrap_or(&String::new()).clone(),
            platform,
            platform_shop_id: row
                .get("platform_shop_id")
                .unwrap_or(&row.get("shop_id").unwrap_or(&"0".to_string()).clone())
                .clone(),
            title,
            description,
            price: row
                .get("price")
                .and_then(|v| v.parse::<f64>().ok())
                .unwrap_or(0.0),
            currency: "USD".to_string(),
            inventory: row
                .get("inventory")
                .and_then(|v| v.parse::<u32>().ok())
                .unwrap_or(0),
            availability,
            image_url,
            created_at: row.get("created_at").unwrap_or(&String::new()).clone(),
            updated_at: row
                .get("last_update_time")
                .unwrap_or(&String::new())
                .clone(),
        }
    }

    fn map_run_status(&self, status: &RunStatus) -> ProductSyncRunStatus {
        ProductSyncRunStatus {
            state: match status.state {
                RunState::Idle => "idle".to_string(),
                RunState::Running => "running".to_string(),
                RunState::Throttled => "throttled".to_string(),
                RunState::Error => "error".to_string(),
                RunState::Paused => "paused".to_string(),
            },
            run_id: status.run_id.clone(),
            worker_id: status.worker_id.clone(),
            lower_ts: status.lower_ts.clone(),
            upper_ts: status.upper_ts.clone(),
            page_seq: status.page_seq,
            current_cursor: status.current_cursor.clone(),
            current_offset: status.current_offset,
            items_total: status.items_total,
            items_list_only: status.items_list_only,
            items_detail_enqueued: status.items_detail_enqueued,
            items_detail_skipped: status.items_detail_skipped,
            lag_detail_consumer: status.lag_detail_consumer,
            backoff_seconds: status.backoff_seconds,
            started_at: status.started_at,
            updated_at: status.updated_at,
            heartbeat_ts: status.heartbeat_ts,
            last_error_code: status.last_error_code.clone(),
            last_error_msg: status.last_error_msg.clone(),
        }
    }

    fn build_gateway_credentials(
        platform_creds: PlatformCredentials,
        entry: Option<&ShopTokenCacheEntry>,
        fallback_shop_id: &str,
        access_token: &str,
        shop_cipher: Option<&str>,
    ) -> Credentials {
        let mut additional = HashMap::new();
        if let Some(cipher) = shop_cipher.and_then(Self::normalize_str_ref) {
            additional.insert("shop_cipher".to_string(), cipher);
        }

        let mut credentials = Credentials {
            api_key: Self::normalize_owned_string(platform_creds.api_key),
            api_secret: Self::normalize_owned_string(platform_creds.app_secret),
            access_token: Some(access_token.to_string()),
            refresh_token: entry
                .and_then(|item| item.refresh_token.clone())
                .and_then(Self::normalize_owned_string),
            store_url: Self::normalize_optional_string(platform_creds.base_url)
                .or_else(|| Self::normalize_owned_string(platform_creds.api_base_url)),
            shop_id: Self::normalize_optional_string(platform_creds.store_id)
                .or_else(|| Some(fallback_shop_id.to_string())),
            additional,
            extra: HashMap::new(),
        };

        if let Some(url) = credentials.store_url.clone() {
            credentials.extra.insert("base_url".to_string(), url);
        }

        if let Some(entry) = entry {
            Self::merge_entry_credentials(&mut credentials, entry);
        }

        credentials
    }

    fn merge_entry_credentials(credentials: &mut Credentials, entry: &ShopTokenCacheEntry) {
        if let Some(value) = entry
            .platform_shop_id
            .as_deref()
            .and_then(Self::normalize_str_ref)
            .or_else(|| Self::extract_entry_field(entry, &["shop_id", "store_id", "merchant_id"]))
        {
            credentials.shop_id = Some(value);
        }

        if let Some(value) = Self::extract_entry_field(
            entry,
            &[
                "store_url",
                "endpoint",
                "shop_domain",
                "api_base_url",
                "base_url",
                "host",
            ],
        ) {
            credentials.store_url = Some(value.clone());
            credentials.extra.insert("base_url".to_string(), value);
        }

        if let Some(value) = Self::extract_entry_field(
            entry,
            &[
                "api_key",
                "consumer_key",
                "username",
                "client_id",
                "publishable_key",
            ],
        ) {
            credentials.api_key = Some(value);
        }

        if let Some(value) = Self::extract_entry_field(
            entry,
            &[
                "api_secret",
                "consumer_secret",
                "password",
                "client_secret",
                "signing_secret",
            ],
        ) {
            credentials.api_secret = Some(value);
        }

        if credentials.refresh_token.is_none() {
            credentials.refresh_token = entry
                .refresh_token
                .clone()
                .and_then(Self::normalize_owned_string);
        }
    }

    fn extract_entry_field(entry: &ShopTokenCacheEntry, keys: &[&str]) -> Option<String> {
        let map = entry.credentials.as_ref()?.as_object()?;
        for key in keys {
            if let Some(value) = map.get(*key) {
                if let Some(text) = value.as_str() {
                    if let Some(normalized) = Self::normalize_str_ref(text) {
                        return Some(normalized);
                    }
                }
            }
        }
        None
    }

    fn normalize_optional_string(value: Option<String>) -> Option<String> {
        value.and_then(Self::normalize_owned_string)
    }

    fn normalize_owned_string(value: String) -> Option<String> {
        Self::normalize_str_ref(&value)
    }

    fn normalize_str_ref(value: &str) -> Option<String> {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    }

    fn escape_clickhouse_string(value: &str) -> String {
        value.replace('\'', "''")
    }
}

#[async_trait]
impl PlatformProductService for PlatformProductServiceImpl {
    async fn list_unique_products(
        &self,
        platform: Option<&str>,
        shop_id: Option<&str>,
        search: Option<&str>,
        page: u32,
        limit: u32,
    ) -> AppResult<ProductListResponse> {
        info!(
            "Fetching unique products - page: {}, limit: {}, platform: {:?}, shop_id: {:?}",
            page, limit, platform, shop_id
        );

        let clickhouse = self.state.product_repository();

        // Calculate offset
        let offset = (page - 1) * limit;

        // Build the query
        let mut query = String::from(
            r#"
            SELECT
                product_id,
                platform,
                shop_id,
                platform_shop_id,
                title,
                description,
                price,
                inventory,
                availability,
                images,
                last_updated as last_update_time,
                created_time as created_at
            FROM product
            WHERE 1=1
            "#,
        );

        let mut count_query = String::from(
            r#"
            SELECT count(*) as total
            FROM product
            WHERE 1=1
            "#,
        );

        // Add filters
        if let Some(platform) = platform {
            let clean_platform = platform.trim_end_matches('^');
            if let Some(code) = platform_name_to_code(clean_platform) {
                let platform_filter = format!(" AND platform = {}", code);
                query.push_str(&platform_filter);
                count_query.push_str(&platform_filter);
            }
        }

        if let Some(shop_id) = shop_id {
            let clean_shop_id = shop_id.trim_end_matches('^');
            let shop_filter = format!(" AND shop_id = '{}'", clean_shop_id.replace('\'', "''"));
            query.push_str(&shop_filter);
            count_query.push_str(&shop_filter);
            info!("Filtering by shop_id: {}", clean_shop_id);
        }

        if let Some(search) = search {
            let search_filter = format!(
                " AND (title ILIKE '%{}%' OR product_id ILIKE '%{}%')",
                search.replace('\'', "''"),
                search.replace('\'', "''")
            );
            query.push_str(&search_filter);
            count_query.push_str(&search_filter);
        }

        // Add ORDER BY and LIMIT
        query.push_str(&format!(
            r#"
            ORDER BY last_updated DESC
            LIMIT {} OFFSET {}
            "#,
            limit, offset
        ));

        info!("Executing product query: {}", query);
        info!("Executing count query: {}", count_query);

        // Execute queries
        let products_result = clickhouse.query(&query, vec![]).await;
        let count_result = clickhouse.query(&count_query, vec![]).await;

        match (products_result, count_result) {
            (Err(e1), _) => {
                error!("Failed to execute product query: {:?}", e1);
                Err(AppError::DatabaseError(format!(
                    "Failed to execute product query: {}",
                    e1
                )))
            }
            (_, Err(e2)) => {
                error!("Failed to execute count query: {:?}", e2);
                Err(AppError::DatabaseError(format!(
                    "Failed to execute count query: {}",
                    e2
                )))
            }
            (Ok(products_rows), Ok(count_rows)) => {
                info!("Product query returned {} rows", products_rows.len());
                info!("Count query returned {} rows", count_rows.len());

                // Parse total count
                let total = count_rows
                    .first()
                    .and_then(|row| row.get("total"))
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(0);

                info!("Total products found: {}", total);

                // Parse products
                let products: Vec<ProductListItem> = products_rows
                    .into_iter()
                    .map(|row| self.parse_product_list_item(row))
                    .collect();

                let total_pages = (total as f64 / limit as f64).ceil() as u32;

                Ok(ProductListResponse {
                    products,
                    total,
                    page,
                    limit,
                    total_pages,
                })
            }
        }
    }

    async fn get_product_detail(&self, product_id: &str) -> AppResult<ProductDetail> {
        info!("Fetching product detail for: {}", product_id);

        let clickhouse = self.state.product_repository();

        let query = format!(
            r#"
            SELECT
                product_id,
                platform,
                platform_shop_id,
                platform_product_id,
                title,
                description,
                brand_name,
                category,
                tags,
                price,
                shipping_price,
                shipping_free,
                inventory,
                availability,
                images,
                variant_attributes,
                custom_fields,
                rating_avg,
                reviews_count,
                last_updated,
                created_time
            FROM product_dist
            WHERE product_id = '{}'
            ORDER BY last_updated DESC
            LIMIT 1
            "#,
            product_id.replace('\'', "''")
        );

        match clickhouse.query(&query, vec![]).await {
            Ok(rows) => {
                if let Some(row) = rows.first() {
                    let product_detail = self.parse_product_detail(row);
                    Ok(product_detail)
                } else {
                    Err(AppError::NotFound(format!(
                        "Product {} not found",
                        product_id
                    )))
                }
            }
            Err(e) => {
                error!("Failed to fetch product detail: {}", e);
                Err(AppError::DatabaseError(format!(
                    "Failed to fetch product detail: {}",
                    e
                )))
            }
        }
    }

    async fn create_product(
        &self,
        tenant_id: &str,
        payload: &CreateProductRequest,
    ) -> AppResult<serde_json::Value> {
        let platform = PlatformType::from_str(&payload.platform).map_err(|_| {
            AppError::InvalidInput(format!("Unsupported platform {}", payload.platform))
        })?;

        let price = Price {
            amount: payload.price,
            currency: payload.currency.clone(),
            original_price: Some(payload.price),
            discount_percentage: None,
        };

        let mut product = Product::new(
            payload.shop_id.clone(),
            platform,
            String::new(),
            payload.sku.clone(),
            payload.title.clone(),
            price.clone(),
        )
        .map_err(|err| AppError::InternalError(format!("Failed to build product: {}", err)))?;

        product.platform_shop_id = payload.shop_id.clone();
        product.platform_product_id = product.product_id.clone();
        product.description = payload.description.clone();
        product.price = price;
        product.quantity = payload.quantity as i16;
        product.currency = payload.currency.clone();
        product.updated_at = Utc::now();

        product.images = payload
            .images
            .iter()
            .enumerate()
            .map(|(index, url)| ProductImage {
                url: url.clone(),
                alt: None,
                is_primary: index == 0,
                position: index as i32,
            })
            .collect();

        product.categories = payload.categories.clone();

        if let Some(attrs) = &payload.attributes {
            if let Ok(map) = serde_json::from_value::<HashMap<String, String>>(attrs.clone()) {
                product.attributes = map;
            }
        }

        self.state
            .product_repository()
            .save_product(tenant_id, &product)
            .await?;

        Ok(json!({
            "success": true,
            "product_id": product.product_id,
            "platform": payload.platform,
            "shop_id": payload.shop_id,
        }))
    }

    async fn update_product(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        product_id: &str,
        payload: &UpdateProductRequest,
    ) -> AppResult<serde_json::Value> {
        PlatformType::from_str(platform)
            .map_err(|_| AppError::InvalidInput(format!("Unsupported platform {}", platform)))?;

        let product_repo = self.state.product_repository();
        let mut product = product_repo
            .get_product(tenant_id, platform, shop_id, product_id)
            .await?;

        if let Some(title) = &payload.title {
            product.title = title.clone();
        }

        if let Some(description) = &payload.description {
            product.description = Some(description.clone());
        }

        if let Some(price) = &payload.price {
            product.price = Price {
                amount: *price,
                currency: product.currency.clone(),
                original_price: Some(*price),
                discount_percentage: None,
            };
        }

        if let Some(quantity) = payload.quantity {
            product.quantity = quantity as i16;
        }

        if let Some(images) = &payload.images {
            product.images = images
                .iter()
                .enumerate()
                .map(|(index, url)| ProductImage {
                    url: url.clone(),
                    alt: None,
                    is_primary: index == 0,
                    position: index as i32,
                })
                .collect();
        }

        if let Some(categories) = &payload.categories {
            product.categories = categories.clone();
        }

        if let Some(attrs) = &payload.attributes {
            if let Ok(map) = serde_json::from_value::<HashMap<String, String>>(attrs.clone()) {
                product.attributes = map;
            }
        }

        if let Some(status) = &payload.status {
            product.status = match status.as_str() {
                "active" => ProductStatus::Active,
                "inactive" => ProductStatus::Inactive,
                "out_of_stock" => ProductStatus::OutOfStock,
                "deleted" => ProductStatus::Deleted,
                "draft" => ProductStatus::Draft,
                "archived" => ProductStatus::Archived,
                _ => product.status,
            };
        }

        product.updated_at = Utc::now();

        product_repo.update_product(tenant_id, &product).await?;

        Ok(json!({
            "success": true,
            "product_id": product_id,
            "platform": platform,
            "shop_id": shop_id,
        }))
    }

    async fn delete_product(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        product_id: &str,
    ) -> AppResult<serde_json::Value> {
        self.state
            .product_repository()
            .delete_product(tenant_id, platform, shop_id, product_id)
            .await?;

        Ok(json!({
            "success": true,
            "product_id": product_id,
            "platform": platform,
            "shop_id": shop_id,
        }))
    }

    async fn fetch_platform_products(
        &self,
        platform: &str,
        shop_id: &str,
        query: &ProductListQuery,
    ) -> AppResult<serde_json::Value> {
        let normalized_platform = normalize_platform_name(platform);
        info!(
            "Fetching {} products in realtime for shop: {}",
            normalized_platform, shop_id
        );
        let limit = query.limit.unwrap_or(50);
        let offset = query.offset.unwrap_or(0);

        Ok(json!({
            "products": [],
            "total": 0,
            "limit": limit,
            "offset": offset,
            "has_more": false,
            "message": format!(
                "{} access token must be provided from Strapi. Please ensure tokens are sent with the request.",
                normalized_platform
            )
        }))
    }

    async fn list_categories(
        &self,
        _platform: Option<&str>,
        _shop_id: Option<&str>,
    ) -> ModelAppResult<Vec<Category>> {
        // TODO: Implement category listing
        Ok(vec![])
    }

    async fn realtime_sync_products(
        &self,
        platform: &str,
        shop_id: &str,
        access_token: String,
        _user_id: Option<String>,
        limit: Option<usize>,
        offset: Option<usize>,
        _shop_cipher: Option<String>,
    ) -> AppResult<SyncResponse> {
        let normalized_platform = normalize_platform_name(platform);
        info!(
            "Starting realtime sync for platform: {} shop: {}",
            normalized_platform, shop_id
        );

        // Create platform gateway
        let platform_creds = self.platform_credentials_or_default(&normalized_platform);
        let mut credentials =
            Self::build_gateway_credentials(platform_creds, None, shop_id, &access_token, None);
        if credentials.api_key.is_none() && normalized_platform == "lineshopping" {
            credentials.api_key = Some(access_token.clone());
        }

        let factory = self.state.gateway_factory();
        let gateway = factory
            .create_gateway(&normalized_platform, credentials)
            .await?;

        // Fetch products from API
        let limit = limit.unwrap_or(100);
        let offset = offset.unwrap_or(0);

        info!(
            "Fetching realtime products from {} API (limit: {}, offset: {})",
            normalized_platform, limit, offset
        );

        let list_params = crate::interfaces::platform_gateway::ListProductParams {
            shop_id: Some(shop_id.to_string()),
            limit: Some(limit as u32),
            offset: Some(offset as u32),
            status: None,
            search: None,
            page: None,
            sort: None,
        };

        let product_list = gateway.list_products(&list_params).await.map_err(|e| {
            error!("Failed to fetch products: {}", e);
            AppError::ExternalApiError(format!("Failed to fetch products: {}", e))
        })?;

        let products = product_list.products;
        info!(
            "Fetched {} products from {} API",
            products.len(),
            normalized_platform
        );

        // Save products directly to ClickHouse
        let clickhouse_repo = self.state.product_repository();
        let mut products_synced = 0;
        let mut products_failed = 0;
        let mut errors = Vec::new();

        for platform_product in products {
            use crate::model::v1::platfrom::entries::{
                PlatformType, Price, Product, ProductImage, ProductStatus,
            };

            let platform_type = platform_type_from_name(&normalized_platform);

            let domain_product = Product {
                product_id: platform_product.id.clone(),
                shop_id: shop_id.to_string(),
                platform: platform_type,
                platform_shop_id: shop_id.to_string(),
                platform_product_id: platform_product.id.clone(),
                sku: platform_product.sku.clone().unwrap_or_default(),
                title: platform_product.title.clone(),
                brand: String::new(),
                description: platform_product.description,
                price: Price {
                    amount: rust_decimal::Decimal::from_f64_retain(platform_product.price)
                        .unwrap_or_default(),
                    currency: platform_product.currency.clone(),
                    original_price: None,
                    discount_percentage: None,
                },
                quantity: 0,
                images: platform_product
                    .images
                    .iter()
                    .enumerate()
                    .map(|(i, url)| ProductImage {
                        url: url.clone(),
                        alt: None,
                        is_primary: i == 0,
                        position: i as i32,
                    })
                    .collect(),
                currency: platform_product.currency.clone(),
                attributes: platform_product
                    .attributes
                    .iter()
                    .map(|(k, v)| (k.clone(), v.to_string()))
                    .collect(),
                categories: vec![],
                status: ProductStatus::Active,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                synced_at: Some(Utc::now()),
            };

            match clickhouse_repo
                .save_product("default_org", &domain_product)
                .await
            {
                Ok(_) => {
                    products_synced += 1;
                    tracing::debug!("Saved product {} to database", domain_product.product_id);
                }
                Err(e) => {
                    products_failed += 1;
                    let error_msg = format!(
                        "Failed to save product {}: {}",
                        domain_product.product_id, e
                    );
                    error!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        let message = format!(
            "Realtime sync completed: {} products synced, {} failed",
            products_synced, products_failed
        );
        info!("{}", message);

        Ok(SyncResponse {
            message,
            status: if products_failed == 0 {
                "success".to_string()
            } else {
                "partial".to_string()
            },
            sync_id: None,
            job_id: None,
            synced_count: products_synced,
            failed_count: products_failed,
            success: products_failed == 0,
            products_synced,
            products_failed,
            errors,
        })
    }

    async fn sync_platform_products(
        &self,
        platform: &str,
        shop_id: &str,
        query: &SyncQuery,
        body: Option<&SyncRequestBody>,
    ) -> AppResult<SyncResponse> {
        let normalized_platform = normalize_platform_name(platform);
        let source_hint = query
            .source
            .as_deref()
            .map(|value| value.trim().to_lowercase())
            .filter(|value| !value.is_empty());
        let is_platform_pull = source_hint
            .as_ref()
            .map(|value| value == "platform_pull")
            .unwrap_or(false);
        let should_enqueue_via_consumer = normalized_platform == "shopee" || is_platform_pull;
        info!(
            "Starting {} product sync (staging workflow) for shop: {}",
            normalized_platform, shop_id
        );

        let payload = body.ok_or_else(|| {
            AppError::Unauthorized("Access token must be provided in the request".to_string())
        })?;

        let mut resolved_access_token = payload.access_token.clone();
        let mut resolved_api_key: Option<String> = None;
        let mut resolved_api_secret: Option<String> = None;
        let mut resolved_store_url: Option<String> = None;
        let mut shop_cipher = payload.shop_cipher.clone();
        let fetch_limit = query.limit.unwrap_or(100);

        let org_id_normalized = payload
            .org_id
            .as_ref()
            .and_then(|id| Self::normalize_str_ref(id));

        let mut cached_entry: Option<ShopTokenCacheEntry> = None;
        if let Some(org_id) = org_id_normalized.as_deref() {
            match fetch_shop_token(&normalized_platform, shop_id, org_id).await {
                Ok(Some(entry)) => {
                    if resolved_access_token.is_none() {
                        resolved_access_token = resolve_cached_access_token(&entry);
                    }
                    if shop_cipher.is_none() {
                        shop_cipher = resolve_cached_shop_cipher(&entry);
                    }
                    if resolved_api_key.is_none() {
                        resolved_api_key = resolve_cached_api_key(&entry);
                    }
                    if resolved_api_secret.is_none() {
                        resolved_api_secret = resolve_cached_api_secret(&entry);
                    }
                    if resolved_store_url.is_none() {
                        resolved_store_url = resolve_cached_store_url(&entry);
                    }
                    cached_entry = Some(entry);
                }
                Ok(None) => {
                    if resolved_access_token.is_none() {
                        return Err(AppError::Unauthorized(format!(
                            "{} access token must be provided from Strapi. No cached token found for shop {} (org {}). Reconnect the platform or pass the access_token explicitly.",
                            normalized_platform, shop_id, org_id
                        )));
                    } else {
                        warn!(
                            "No cached {} token found for shop {} (org {}); continuing with provided access token",
                            normalized_platform, shop_id, org_id
                        );
                    }
                }
                Err(err) => {
                    if resolved_access_token.is_none() {
                        return Err(AppError::ExternalApiError(format!(
                            "Failed to retrieve {} tokens from Strapi for shop {} (org {}): {}",
                            normalized_platform, shop_id, org_id, err
                        )));
                    } else {
                        warn!(
                            "Failed to refresh {} credentials from Strapi for shop {} (org {}): {}",
                            normalized_platform, shop_id, org_id, err
                        );
                    }
                }
            }
        } else if resolved_access_token.is_none() {
            return Err(AppError::Unauthorized(format!(
                "{} access token must be provided from Strapi. Include org_id in the request so cached tokens can be resolved automatically.",
                normalized_platform
            )));
        }

        let tenant_id = org_id_normalized
            .clone()
            .unwrap_or_else(|| "default".to_string());

        let access_token = resolved_access_token.ok_or_else(|| {
            AppError::Unauthorized(format!(
                "{} access token must be provided from Strapi. Please ensure tokens are sent with the request.",
                normalized_platform
            ))
        })?;
        let refresh_token = cached_entry
            .as_ref()
            .and_then(|entry| entry.refresh_token.clone());

        if should_enqueue_via_consumer {
            let queue_source = source_hint.clone().unwrap_or_else(|| {
                if normalized_platform == "shopee" {
                    "platform_pull".to_string()
                } else {
                    "platform_sync".to_string()
                }
            });
            return self
                .enqueue_product_sync_job(
                    &tenant_id,
                    shop_id,
                    &normalized_platform,
                    Some(1),
                    Some(fetch_limit),
                    query.full_sync.unwrap_or(true),
                    access_token.clone(),
                    refresh_token.clone(),
                    resolved_api_key.clone(),
                    resolved_api_secret.clone(),
                    resolved_store_url.clone(),
                    &queue_source,
                )
                .await;
        }

        let platform_creds = self.platform_credentials_or_default(&normalized_platform);
        let mut credentials = Self::build_gateway_credentials(
            platform_creds,
            cached_entry.as_ref(),
            shop_id,
            &access_token,
            shop_cipher.as_deref(),
        );
        if credentials.api_key.is_none() {
            if let Some(api_key) = resolved_api_key
                .take()
                .or_else(|| cached_entry.as_ref().and_then(resolve_cached_api_key))
            {
                credentials.api_key = Some(api_key);
            }
        }
        if credentials.api_key.is_none() && normalized_platform == "lineshopping" {
            credentials.api_key = Some(access_token.clone());
        }

        let gateway = self
            .state
            .gateway_factory()
            .create_gateway(&normalized_platform, credentials)
            .await?;

        let limit = fetch_limit;
        let offset = query.offset.unwrap_or(0);

        info!(
            "Fetching products from {} API (limit: {}, offset: {})",
            normalized_platform, limit, offset
        );
        if let Some(cipher) = shop_cipher.as_ref() {
            info!("Using shop_cipher: {:?}", cipher);
        }

        let list_params = ListProductParams {
            shop_id: Some(shop_id.to_string()),
            limit: Some(limit),
            offset: Some(offset),
            page: None,
            status: None,
            search: None,
            sort: None,
        };

        let product_list = match gateway.list_products(&list_params).await {
            Ok(products) => products,
            Err(e) => {
                error!(
                    "Failed to fetch products from {}: {}",
                    normalized_platform, e
                );
                return Ok(SyncResponse {
                    message: format!(
                        "Failed to fetch products from {}: {}",
                        normalized_platform, e
                    ),
                    status: "failed".to_string(),
                    sync_id: None,
                    job_id: None,
                    synced_count: 0,
                    failed_count: 0,
                    success: false,
                    products_synced: 0,
                    products_failed: 0,
                    errors: vec![e.to_string()],
                });
            }
        };

        let batch_id = query
            .batch_id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        info!("Using batch ID {} for staging workflow", batch_id);

        let platform_type = platform_type_from_name(&normalized_platform);
        let platform_code = platform_type_to_code(platform_type);

        let create_batch_query = format!(
            r#"
            INSERT INTO product_sync_batch (
                batch_id,
                tenant_id,
                shop_id,
                platform,
                status,
                sync_params,
                started_at
            ) VALUES (
                '{}', '{}', '{}', {}, 'syncing', '{}', now()
            )
            "#,
            batch_id,
            tenant_id,
            shop_id,
            platform_code,
            serde_json::json!({
                "limit": query.limit,
                "offset": query.offset,
            })
            .to_string()
            .replace('\'', "''")
        );

        if let Err(e) = self
            .state
            .clickhouse
            .execute_with_retry(&create_batch_query)
            .await
        {
            warn!("Failed to create batch record: {}", e);
        }

        let sync_message = ProductSyncMessage {
            job_id: Uuid::new_v4().to_string(),
            tenant_id: tenant_id.clone(),
            shop_id: shop_id.to_string(),
            platform: normalized_platform.clone(),
            page: Some(1),
            limit: query.limit,
            full_sync: true,
            correlation_id: Some(batch_id.clone()),
            batch_id: Some(batch_id.clone()),
            access_token: None,
            refresh_token: None,
            api_key: None,
            api_secret: None,
            api_url: None,
        };

        let batch_message = serde_json::json!({
            "batch_id": &batch_id,
            "tenant_id": tenant_id,
            "shop_id": &shop_id,
            "platform": &normalized_platform,
            "action": "process_batch",
            "sync_message": &sync_message,
        });

        let mut queue_message = QueueMessage::new(JobType::ProductSync, batch_message);
        queue_message.metadata = Some(json!({
            "tenant_id": tenant_id,
            "shop_id": shop_id,
            "platform": normalized_platform,
            "batch_id": batch_id,
            "source": "batch_processor"
        }));

        let payload = serde_json::to_vec(&queue_message).map_err(|e| {
            AppError::SerializationError(format!("Failed to serialize queue batch message: {}", e))
        })?;

        self.state
            .queue
            .publish_bytes("ecommerce.product.sync.batch", payload)
            .await
            .map_err(|e| AppError::QueueError(format!("Failed to queue batch job: {}", e)))?;

        let mut products_staged = 0;
        let mut errors = Vec::new();

        for platform_product in product_list.products {
            let domain_product = Product {
                product_id: platform_product.id.clone(),
                shop_id: shop_id.to_string(),
                platform: platform_type,
                platform_shop_id: shop_id.to_string(),
                platform_product_id: platform_product.id.clone(),
                sku: platform_product.sku.clone().unwrap_or_default(),
                title: platform_product.title.clone(),
                brand: String::new(),
                description: platform_product.description.clone(),
                price: Price {
                    amount: rust_decimal::Decimal::from_f64_retain(platform_product.price)
                        .unwrap_or_default(),
                    currency: platform_product.currency.clone(),
                    original_price: None,
                    discount_percentage: None,
                },
                quantity: 0,
                images: platform_product
                    .images
                    .iter()
                    .enumerate()
                    .map(|(i, url)| ProductImage {
                        url: url.clone(),
                        alt: None,
                        is_primary: i == 0,
                        position: i as i32,
                    })
                    .collect(),
                currency: platform_product.currency.clone(),
                attributes: platform_product
                    .attributes
                    .iter()
                    .map(|(k, v)| (k.clone(), v.to_string()))
                    .collect(),
                categories: vec![],
                status: ProductStatus::Active,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                synced_at: Some(Utc::now()),
            };

            let sync_id = Uuid::new_v4().to_string();
            let product_json = serde_json::to_value(&domain_product).map_err(|e| {
                AppError::SerializationError(format!("Failed to serialize product: {}", e))
            })?;

            let insert_query = format!(
                r#"
                INSERT INTO product_sync (
                    sync_id,
                    sync_batch_id,
                    tenant_id,
                    shop_id,
                    platform_product_id,
                    platform,
                    product_data,
                    synced_at
                ) VALUES (
                    '{}', '{}', '{}', '{}', '{}', {}, '{}', now()
                )
                "#,
                sync_id,
                batch_id,
                tenant_id,
                shop_id,
                domain_product.product_id,
                platform_code,
                product_json.to_string().replace('\'', "''")
            );

            match self
                .state
                .clickhouse
                .execute_with_retry(&insert_query)
                .await
            {
                Ok(_) => {
                    products_staged += 1;
                    info!("Staged product {} for review", domain_product.product_id);
                }
                Err(e) => {
                    let error_msg = format!(
                        "Failed to stage product {}: {}",
                        domain_product.product_id, e
                    );
                    error!("{}", error_msg);
                    errors.push(error_msg);
                }
            }
        }

        let batch_update = format!(
            r#"
            ALTER TABLE product_sync_batch
            UPDATE
                status = 'pending_review',
                total_products = {},
                pending_products = {}
            WHERE batch_id = '{}'
            "#,
            products_staged, products_staged, batch_id
        );

        if let Err(e) = self
            .state
            .clickhouse
            .execute_with_retry(&batch_update)
            .await
        {
            warn!("Failed to update batch status: {}", e);
        }

        Ok(SyncResponse {
            message: format!(
                "Successfully staged {} products for review. Batch ID: {}.",
                products_staged, batch_id
            ),
            status: "pending_review".to_string(),
            sync_id: Some(batch_id.clone()),
            job_id: Some(batch_id),
            synced_count: products_staged,
            failed_count: errors.len(),
            success: products_staged > 0 && errors.is_empty(),
            products_synced: products_staged,
            products_failed: errors.len(),
            errors,
        })
    }

    async fn get_synced_products(
        &self,
        tenant_id: &str,
        platform: Option<&str>,
        shop_id: &str,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> AppResult<SyncProductListResponse> {
        let platform_name = platform
            .map(normalize_platform_name)
            .unwrap_or_else(|| DEFAULT_PLATFORM.to_string());

        info!(
            "Getting synced products for shop: {} platform: {}",
            shop_id, platform_name
        );

        let limit = limit.unwrap_or(20);
        let offset = offset.unwrap_or(0);

        tracing::debug!("Query params - limit: {}, offset: {}", limit, offset);

        let clickhouse_repo = self.state.product_repository();

        let offset_u32: u32 = offset.try_into().unwrap_or(0);
        let limit_u32: u32 = limit.try_into().unwrap_or(20).max(1);
        let page = (offset_u32 / limit_u32).saturating_add(1);

        let products = match clickhouse_repo
            .list_products(tenant_id, &platform_name, shop_id, page, limit_u32)
            .await
        {
            Ok(products) => {
                info!("Successfully fetched {} products", products.len());
                products
            }
            Err(e) => {
                error!("Failed to fetch products from ClickHouse: {:?}", e);
                Vec::new()
            }
        };

        let total = products.len();
        let has_more = total == limit;

        info!("Returning {} products for shop {}", total, shop_id);

        Ok(SyncProductListResponse {
            products,
            total,
            has_more,
        })
    }

    async fn export_products(
        &self,
        platform: &str,
        shop_id: &str,
        limit: usize,
    ) -> AppResult<Vec<Product>> {
        let normalized_platform = normalize_platform_name(platform);
        let fetch_limit = limit.clamp(1, MAX_EXPORT_LIMIT);
        let page_size = EXPORT_PAGE_SIZE;
        let mut page: u32 = 1;
        let mut exported: Vec<Product> = Vec::new();
        let repo = self.state.product_repository();

        while exported.len() < fetch_limit {
            let batch = repo
                .list_products(
                    "default_org",
                    &normalized_platform,
                    shop_id,
                    page,
                    page_size,
                )
                .await?;

            if batch.is_empty() {
                break;
            }

            let batch_len = batch.len();
            exported.extend(batch);

            if batch_len < page_size as usize {
                break;
            }

            page = page.saturating_add(1);
        }

        exported.truncate(fetch_limit);
        Ok(exported)
    }

    async fn list_product_snapshots(
        &self,
        _tenant_id: &str,
        platform: &str,
        _shop_id: &str,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> AppResult<ProductSnapshotListResponse> {
        #[derive(Debug, Deserialize, clickhouse::Row)]
        struct SnapshotRow {
            marketplace: String,
            sku: Option<String>,
            idea_key: Option<String>,
            url: Option<String>,
            title: Option<String>,
            brand: Option<String>,
            price_amount: Option<rust_decimal::Decimal>,
            price_currency: Option<String>,
            inventory_quantity: Option<i32>,
            inventory_status: Option<String>,
            images: Vec<String>,
            attributes: Value,
            version_ts: DateTime<Utc>,
        }

        let limit = limit.unwrap_or(50).clamp(1, 500);
        let cursor_dt = if let Some(cursor) = cursor {
            if cursor.is_empty() {
                None
            } else {
                Some(
                    DateTime::parse_from_rfc3339(cursor)
                        .map_err(|e| {
                            AppError::BadRequest(format!("Invalid cursor timestamp: {}", e))
                        })?
                        .with_timezone(&Utc),
                )
            }
        } else {
            None
        };

        let database = self.state.clickhouse.get_database();
        let mut sql = format!(
            "SELECT marketplace, sku, idea_key, url, title, brand, price_amount, price_currency, \
             inventory_quantity, toString(inventory_status) AS inventory_status, images, attributes, version_ts \
             FROM {}.product_current WHERE marketplace = ?",
            database
        );

        if cursor_dt.is_some() {
            sql.push_str(" AND version_ts < ?");
        }

        sql.push_str(" ORDER BY version_ts DESC LIMIT ?");

        let mut query = self.state.clickhouse.query(&sql).bind(platform);
        if let Some(ts) = cursor_dt {
            query = query.bind(ts);
        }
        query = query.bind(limit as u32);

        let mut result_cursor = query.fetch::<SnapshotRow>().map_err(|e| {
            AppError::DatabaseError(format!("Failed to fetch product snapshots: {}", e))
        })?;

        let mut snapshots = Vec::new();
        let mut last_ts: Option<DateTime<Utc>> = None;

        while let Some(row) = result_cursor.next().await.map_err(|e| {
            AppError::DatabaseError(format!("Failed to read product snapshot row: {}", e))
        })? {
            last_ts = Some(row.version_ts);
            snapshots.push(ProductSnapshot {
                marketplace: row.marketplace,
                sku: row.sku,
                idea_key: row.idea_key,
                url: row.url,
                title: row.title,
                brand: row.brand,
                price_amount: row.price_amount.and_then(|p| p.to_f64()),
                price_currency: row.price_currency,
                inventory_quantity: row.inventory_quantity,
                inventory_status: row.inventory_status,
                images: row.images,
                attributes: row.attributes,
                version_ts: row.version_ts,
            });
        }

        let next_cursor = if snapshots.len() == limit {
            last_ts.map(|ts| ts.to_rfc3339_opts(SecondsFormat::Millis, true))
        } else {
            None
        };

        info!(
            "Returning {} product snapshots for platform {}",
            snapshots.len(),
            platform
        );

        Ok(ProductSnapshotListResponse {
            snapshots,
            next_cursor,
        })
    }

    async fn get_sync_activity(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        limit: Option<usize>,
        cursor: Option<&str>,
    ) -> AppResult<ProductSyncLogResponse> {
        let limit = limit.unwrap_or(50).clamp(1, 200);
        let cursor = cursor.filter(|c| !c.is_empty()).map(|c| c.to_string());

        let run_key = RunStatusKey {
            tenant: tenant_id.to_string(),
            platform: platform.to_string(),
            shop: shop_id.to_string(),
        };

        let progress_key = ProgressKey {
            tenant: tenant_id.to_string(),
            platform: platform.to_string(),
            shop: shop_id.to_string(),
        };

        let run_status = self
            .state
            .sync_state_manager
            .get_run_status(&run_key)
            .await
            .map_err(|e| {
                AppError::ExternalServiceError(format!("Failed to retrieve sync run status: {}", e))
            })?;

        let entries = self
            .state
            .sync_state_manager
            .list_progress_entries(&progress_key, limit, cursor)
            .await
            .map_err(|e| {
                AppError::ExternalServiceError(format!(
                    "Failed to fetch sync progress entries: {}",
                    e
                ))
            })?;

        let next_cursor = entries.last().map(|entry| entry.id.clone());

        let mapped_entries = entries
            .into_iter()
            .map(|record| ProductSyncLogEntry {
                id: record.id,
                page_seq: record.entry.page_seq,
                items_emitted: record.entry.items_emitted,
                cursor: record.entry.cursor,
                offset: record.entry.offset,
                duration_ms: record.entry.duration_ms,
                detail_enqueued: record.entry.detail_enqueued,
                snapshot_upserts: record.entry.snapshot_upserts,
                errors: record.entry.errors,
            })
            .collect();

        Ok(ProductSyncLogResponse {
            run_status: run_status
                .as_ref()
                .map(|status| self.map_run_status(status)),
            entries: mapped_entries,
            next_cursor,
        })
    }

    async fn list_product_sync_review(
        &self,
        tenant_id: &str,
        query: &ProductSyncReviewQuery,
    ) -> AppResult<ProductSyncReviewListResponse> {
        let limit = query.limit.unwrap_or(100).clamp(1, 1_000);
        let offset = query.offset.unwrap_or(0);
        let mut filters = vec![format!(
            "tenant_id = '{}'",
            Self::escape_clickhouse_string(tenant_id)
        )];

        if let Some(shop_id) = Self::normalize_optional_string(query.shop_id.clone()) {
            filters.push(format!(
                "shop_id = '{}'",
                Self::escape_clickhouse_string(&shop_id)
            ));
        }

        if let Some(batch_id) = Self::normalize_optional_string(query.batch_id.clone()) {
            filters.push(format!(
                "sync_batch_id = '{}'",
                Self::escape_clickhouse_string(&batch_id)
            ));
        }

        if let Some(platform_name) = Self::normalize_optional_string(query.platform.clone()) {
            if let Some(code) = platform_name_to_code(&platform_name) {
                filters.push(format!("platform = {}", code));
            }
        }

        if let Some(action) = Self::normalize_optional_string(query.user_action.clone()) {
            filters.push(format!(
                "lower(user_action) = lower('{}')",
                Self::escape_clickhouse_string(&action)
            ));
        }

        let where_clause = format!("WHERE {}", filters.join(" AND "));
        let database = self.state.clickhouse.get_database();
        let product_repo = self.state.product_repository();

        let select_query = format!(
            r#"
            SELECT
                sync_id,
                sync_batch_id,
                tenant_id,
                shop_id,
                platform_product_id,
                platform,
                product_data,
                user_action,
                sync_status,
                synced_at,
                approved_at,
                approved_by
            FROM {db}.product_sync
            {where_clause}
            ORDER BY synced_at DESC
            LIMIT {limit} OFFSET {offset}
            "#,
            db = database,
            where_clause = where_clause,
            limit = limit,
            offset = offset
        );

        let count_query = format!(
            r#"
            SELECT count() as total
            FROM {db}.product_sync
            {where_clause}
            "#,
            db = database,
            where_clause = where_clause
        );

        let rows = match product_repo.query(&select_query, vec![]).await {
            Ok(rows) => rows,
            Err(AppError::DatabaseError(message))
                if is_missing_clickhouse_table(&message, "product_sync") =>
            {
                warn!(
                    "product_sync table not provisioned when listing review records: {}",
                    message
                );
                return Ok(ProductSyncReviewListResponse {
                    records: Vec::new(),
                    total: 0,
                    limit,
                    offset,
                });
            }
            Err(err) => return Err(err),
        };

        let total = match product_repo.query(&count_query, vec![]).await {
            Ok(count_rows) => count_rows
                .first()
                .and_then(|row| row.get("total"))
                .and_then(|value| value.parse::<u64>().ok())
                .unwrap_or(0),
            Err(AppError::DatabaseError(message))
                if is_missing_clickhouse_table(&message, "product_sync") =>
            {
                warn!(
                    "product_sync table not provisioned when counting review records: {}",
                    message
                );
                0
            }
            Err(err) => return Err(err),
        };

        let records = rows
            .into_iter()
            .map(|row| {
                let platform_code = row.get("platform").cloned().unwrap_or_default();
                let platform = platform_code_to_string(&platform_code);
                let product = row
                    .get("product_data")
                    .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
                    .unwrap_or_else(|| Value::Null);

                ProductSyncReviewRecord {
                    sync_id: row.get("sync_id").cloned().unwrap_or_default(),
                    sync_batch_id: row
                        .get("sync_batch_id")
                        .cloned()
                        .unwrap_or_else(|| "unknown".to_string()),
                    tenant_id: row
                        .get("tenant_id")
                        .cloned()
                        .unwrap_or_else(|| tenant_id.to_string()),
                    shop_id: row.get("shop_id").cloned().unwrap_or_default(),
                    platform,
                    platform_product_id: row
                        .get("platform_product_id")
                        .cloned()
                        .unwrap_or_default(),
                    user_action: row.get("user_action").cloned().unwrap_or_default(),
                    sync_status: row.get("sync_status").cloned().unwrap_or_default(),
                    synced_at: row
                        .get("synced_at")
                        .cloned()
                        .filter(|value| !value.is_empty()),
                    approved_at: row
                        .get("approved_at")
                        .cloned()
                        .filter(|value| !value.is_empty()),
                    approved_by: row
                        .get("approved_by")
                        .cloned()
                        .filter(|value| !value.is_empty()),
                    product,
                }
            })
            .collect();

        Ok(ProductSyncReviewListResponse {
            records,
            total,
            limit,
            offset,
        })
    }

    async fn promote_product_sync_records(
        &self,
        tenant_id: &str,
        sync_ids: &[String],
        approved_by: &str,
    ) -> AppResult<PromoteProductSyncResponse> {
        let mut normalized_ids: Vec<String> = sync_ids
            .iter()
            .map(|id| id.trim().to_string())
            .filter(|id| !id.is_empty())
            .collect();

        normalized_ids.sort();
        normalized_ids.dedup();

        if normalized_ids.is_empty() {
            return Err(AppError::BadRequest(
                "At least one sync_id must be provided".to_string(),
            ));
        }

        let sanitized_ids: Vec<String> = normalized_ids
            .iter()
            .map(|id| Self::escape_clickhouse_string(id))
            .collect();
        let id_list = sanitized_ids
            .iter()
            .map(|id| format!("'{}'", id))
            .collect::<Vec<_>>()
            .join(",");

        let database = self.state.clickhouse.get_database();
        let repo = self.state.product_repository();
        let select_query = format!(
            r#"
            SELECT sync_id, shop_id, platform_product_id, product_data
            FROM {db}.product_sync
            WHERE tenant_id = '{tenant}'
              AND sync_id IN ({ids})
            "#,
            db = database,
            tenant = Self::escape_clickhouse_string(tenant_id),
            ids = id_list
        );

        let rows = repo.query(&select_query, vec![]).await?;
        let mut rows_by_id: HashMap<String, HashMap<String, String>> = HashMap::new();
        for row in rows {
            if let Some(sync_id) = row.get("sync_id") {
                rows_by_id.insert(sync_id.clone(), row);
            }
        }

        let mut promoted_ids = Vec::new();
        let mut promoted = 0usize;
        let mut skipped = 0usize;
        let mut errors = Vec::new();

        for (idx, sync_id) in normalized_ids.iter().enumerate() {
            let sanitized_id = &sanitized_ids[idx];
            let Some(row) = rows_by_id.get(sync_id) else {
                skipped += 1;
                errors.push(format!("Sync record {} was not found", sync_id));
                continue;
            };

            let product_data_raw = row.get("product_data").cloned().unwrap_or_default();
            let mut product: Product = match serde_json::from_str(&product_data_raw) {
                Ok(value) => value,
                Err(err) => {
                    skipped += 1;
                    errors.push(format!(
                        "Failed to deserialize product payload for {}: {}",
                        sync_id, err
                    ));
                    continue;
                }
            };

            if product.shop_id.is_empty() {
                if let Some(shop_id) = row.get("shop_id") {
                    product.shop_id = shop_id.clone();
                }
            }

            if product.platform_product_id.is_empty() {
                if let Some(platform_product_id) = row.get("platform_product_id") {
                    product.platform_product_id = platform_product_id.clone();
                }
            }

            match repo.save_product(tenant_id, &product).await {
                Ok(_) => {
                    promoted += 1;
                    promoted_ids.push(sanitized_id.clone());
                }
                Err(err) => {
                    skipped += 1;
                    errors.push(format!(
                        "Failed to promote product {} from sync {}: {}",
                        product.product_id, sync_id, err
                    ));
                }
            }
        }

        if !promoted_ids.is_empty() {
            let approved_list = promoted_ids
                .iter()
                .map(|id| format!("'{}'", id))
                .collect::<Vec<_>>()
                .join(",");

            let update_query = format!(
                r#"
                ALTER TABLE {db}.product_sync
                UPDATE
                    user_action = 'approved',
                    sync_status = 'promoted',
                    approved_at = now(),
                    approved_by = '{approved_by}'
                WHERE tenant_id = '{tenant}'
                  AND sync_id IN ({ids})
                "#,
                db = database,
                approved_by = Self::escape_clickhouse_string(approved_by),
                tenant = Self::escape_clickhouse_string(tenant_id),
                ids = approved_list
            );

            if let Err(err) = self
                .state
                .clickhouse
                .execute_with_retry(&update_query)
                .await
            {
                warn!("Failed to update staging records after promotion: {}", err);
                errors.push("Failed to update staging records after promotion".to_string());
            }
        }

        Ok(PromoteProductSyncResponse {
            promoted,
            skipped,
            errors,
        })
    }

    async fn upload_product_media(
        &self,
        _tenant_id: &str,
        request: &ProductMediaUploadRequest,
    ) -> AppResult<ProductMediaUploadResponse> {
        let data = BASE64
            .decode(&request.data_base64)
            .map_err(|e| AppError::ValidationError(format!("Invalid base64 payload: {}", e)))?;

        if data.len() > self.state.upload_config.max_file_size {
            return Err(AppError::BadRequest(format!(
                "File exceeds maximum upload size of {} bytes",
                self.state.upload_config.max_file_size
            )));
        }

        let client = UploadClient::new(self.state.clone());
        let result = client
            .upload(
                &data,
                &request.file_name,
                &request.content_type,
                request.folder.as_deref(),
            )
            .await
            .map_err(|e| {
                AppError::ExternalServiceError(format!("Failed to upload media: {}", e))
            })?;

        Ok(ProductMediaUploadResponse {
            key: result.key,
            public_url: result.public_url,
            download_url: result.download_url,
        })
    }

    async fn resolve_product_media_download(
        &self,
        key: &str,
    ) -> AppResult<ProductMediaDownloadResponse> {
        let client = UploadClient::new(self.state.clone());
        let download_url = client.build_download_url(key).map_err(|e| {
            AppError::ExternalServiceError(format!("Failed to resolve download URL: {}", e))
        })?;

        Ok(ProductMediaDownloadResponse { download_url })
    }

    async fn sync_products_extended(
        &self,
        shop_slug: &str,
        _shop_id: u64,
        platform: &str,
        tenant_id: &str,
        token_id: Option<String>,
        full_sync: bool,
        api_key: Option<String>,
        api_secret: Option<String>,
        store_url: Option<String>,
    ) -> AppResult<SyncProductsResponse> {
        info!(
            "Product sync requested for shop {} on platform {}",
            shop_slug, platform
        );
        let normalized_platform = normalize_platform_name(platform);

        let mut token_override = token_id;
        let mut api_key_override = api_key;
        let mut api_secret_override = api_secret;
        let mut store_url_override = store_url;

        // Fetch cached credentials from Strapi/Redis
        let cached_entry = match fetch_shop_token(&normalized_platform, shop_slug, tenant_id).await
        {
            Ok(entry) => {
                if entry.is_none() {
                    info!(
                        "No cached {} tokens found for shop {} (tenant {})",
                        normalized_platform, shop_slug, tenant_id
                    );
                }
                entry
            }
            Err(err) => {
                if token_override.is_some() {
                    warn!(
                        "Failed to fetch {} tokens from Strapi for shop {} (tenant {}). Falling back to provided override. Error: {}",
                        normalized_platform, shop_slug, tenant_id, err
                    );
                    None
                } else {
                    return Err(err);
                }
            }
        };

        if token_override.is_none() && cached_entry.is_none() {
            return Err(AppError::Unauthorized(format!(
                "No cached {} token found for shop {} (tenant {}). Reconnect the platform or pass an access_token override.",
                normalized_platform, shop_slug, tenant_id
            )));
        }

        let access_token = token_override
            .take()
            .or_else(|| {
                cached_entry
                    .as_ref()
                    .and_then(|entry| resolve_cached_access_token(entry))
            })
            .ok_or_else(|| {
                AppError::Unauthorized(format!(
                    "Cached {} credential for shop {} is missing an access_token. Reconnect the platform.",
                    normalized_platform, shop_slug
                ))
            })?;

        let refresh_token = cached_entry
            .as_ref()
            .and_then(|entry| entry.refresh_token.clone());

        let resolved_api_key = api_key_override.take().or_else(|| {
            cached_entry
                .as_ref()
                .and_then(|entry| resolve_cached_api_key(entry))
        });

        let resolved_api_secret = api_secret_override.take().or_else(|| {
            cached_entry
                .as_ref()
                .and_then(|entry| resolve_cached_api_secret(entry))
        });

        let resolved_api_url = store_url_override.take().or_else(|| {
            cached_entry
                .as_ref()
                .and_then(|entry| resolve_cached_store_url(entry))
        });

        let queue_response = self
            .enqueue_product_sync_job(
                tenant_id,
                shop_slug,
                &normalized_platform,
                Some(1),
                Some(100),
                full_sync,
                access_token,
                refresh_token,
                resolved_api_key,
                resolved_api_secret,
                resolved_api_url,
                "extended_sync",
            )
            .await
            .map_err(|e| {
                error!("Failed to queue product sync: {}", e);
                e
            })?;

        let job_id = queue_response
            .job_id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        info!("Product sync job {} queued for shop {}", job_id, shop_slug);

        Ok(SyncProductsResponse {
            job_id,
            status: queue_response.status,
            message: queue_response.message,
        })
    }

    async fn get_sync_status(&self, job_id: &str) -> AppResult<ProductSyncStatusResponse> {
        info!("Checking sync status for job {}", job_id);

        #[derive(Row, Deserialize)]
        struct SyncStatusRow {
            #[allow(dead_code)]
            sync_batch_id: String,
            total_products: u64,
            approved_products: u64,
            pending_products: u64,
            #[allow(dead_code)]
            last_synced_at: Option<String>,
        }

        let query = format!(
            r#"
            SELECT
                sync_batch_id,
                COUNT(*) as total_products,
                SUM(CASE WHEN user_action = 'approved' THEN 1 ELSE 0 END) as approved_products,
                SUM(CASE WHEN user_action = 'pending' THEN 1 ELSE 0 END) as pending_products,
                MAX(synced_at) as last_synced_at
            FROM product_sync
            WHERE sync_batch_id = '{}'
            GROUP BY sync_batch_id
            LIMIT 1
            "#,
            job_id
        );

        match self
            .state
            .clickhouse
            .query(&query)
            .fetch_all::<SyncStatusRow>()
            .await
        {
            Ok(rows) => {
                if let Some(row) = rows.first() {
                    let total = row.total_products as u32;
                    let approved = row.approved_products as u32;
                    let pending = row.pending_products as u32;

                    let status = if pending == 0 && total > 0 {
                        "completed"
                    } else if total > 0 {
                        "in_progress"
                    } else {
                        "pending"
                    };

                    let message = if status == "completed" {
                        format!("Sync completed. {} products synced.", total)
                    } else if status == "in_progress" {
                        format!(
                            "Sync in progress. {} of {} products processed.",
                            approved, total
                        )
                    } else {
                        "Sync pending".to_string()
                    };

                    Ok(ProductSyncStatusResponse {
                        job_id: job_id.to_string(),
                        status: status.to_string(),
                        // sync_batch_id: sync_batch_id.to_string(),
                        message,
                        products_synced: approved as u64,
                        total_products: Some(total as u64),
                    })
                } else {
                    // Check if sync just completed
                    #[derive(Row, Deserialize)]
                    struct CountRow {
                        count: u64,
                    }

                    let completed_query = format!(
                        r#"
                        SELECT COUNT(*) as count
                        FROM product
                        WHERE sync_batch_id = '{}'
                        LIMIT 1
                        "#,
                        job_id
                    );

                    match self
                        .state
                        .clickhouse
                        .query(&completed_query)
                        .fetch_all::<CountRow>()
                        .await
                    {
                        Ok(product_rows) => {
                            if let Some(row) = product_rows.first() {
                                let count = row.count;
                                if count > 0 {
                                    Ok(ProductSyncStatusResponse {
                                        job_id: job_id.to_string(),
                                        status: "completed".to_string(),
                                        message: format!(
                                            "Sync completed. {} products synced.",
                                            count
                                        ),
                                        products_synced: count,
                                        total_products: Some(count),
                                    })
                                } else {
                                    Ok(ProductSyncStatusResponse {
                                        job_id: job_id.to_string(),
                                        status: "pending".to_string(),
                                        message: "Sync job is queued".to_string(),
                                        products_synced: 0,
                                        total_products: None,
                                    })
                                }
                            } else {
                                Ok(ProductSyncStatusResponse {
                                    job_id: job_id.to_string(),
                                    status: "pending".to_string(),
                                    message: "Sync job is queued".to_string(),
                                    products_synced: 0,
                                    total_products: None,
                                })
                            }
                        }
                        Err(e) => {
                            error!("Failed to check completed products: {}", e);
                            Ok(ProductSyncStatusResponse {
                                job_id: job_id.to_string(),
                                status: "unknown".to_string(),
                                message: "Unable to determine sync status".to_string(),
                                products_synced: 0,
                                total_products: None,
                            })
                        }
                    }
                }
            }
            Err(e) => {
                error!("Failed to query sync status: {}", e);
                Ok(ProductSyncStatusResponse {
                    job_id: job_id.to_string(),
                    status: "unknown".to_string(),
                    message: "Unable to determine sync status".to_string(),
                    products_synced: 0,
                    total_products: None,
                })
            }
        }
    }

    async fn get_sync_job_status(&self, job_id: &str) -> AppResult<serde_json::Value> {
        let clickhouse_repo = self.state.product_repository();

        let job_status = clickhouse_repo.get_sync_job_status(job_id).await?;

        let job_progress = clickhouse_repo.get_sync_job_latest_progress(job_id).await?;

        if let Some(mut status) = job_status {
            if let Some(progress) = job_progress {
                let mut progress_with_percentage = progress.clone();
                if let (Some(current), Some(total)) = (
                    progress.get("current_batch").and_then(|v| v.as_u64()),
                    progress.get("total_batches").and_then(|v| v.as_u64()),
                ) {
                    if total > 0 {
                        let percentage = (current as f64 / total as f64 * 100.0) as u32;
                        progress_with_percentage["percentage"] = serde_json::json!(percentage);
                    }
                }
                status["progress"] = progress_with_percentage;
            }

            if status.get("status").and_then(|v| v.as_str()) == Some("processing") {
                status["estimated_time_remaining"] = serde_json::json!(null);
            }

            Ok(status)
        } else {
            Ok(json!({
                "error": "Job not found",
                "job_id": job_id
            }))
        }
    }

    async fn list_sync_jobs(
        &self,
        tenant_id: Option<String>,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> AppResult<serde_json::Value> {
        let clickhouse_repo = self.state.product_repository();

        let tenant_id = tenant_id.unwrap_or_else(|| "default".to_string());
        let limit = limit.unwrap_or(20).min(100);
        let offset = offset.unwrap_or(0);

        match clickhouse_repo
            .list_sync_jobs(&tenant_id, limit, offset)
            .await
        {
            Ok(jobs) => Ok(json!({
                "jobs": jobs,
                "limit": limit,
                "offset": offset,
                "total": jobs.len()
            })),
            Err(AppError::DatabaseError(message))
                if is_missing_clickhouse_table(&message, "sync_jobs") =>
            {
                warn!(
                    "sync_jobs table missing in ClickHouse; returning empty job list: {}",
                    message
                );
                Ok(json!({
                    "jobs": [],
                    "limit": limit,
                    "offset": offset,
                    "total": 0,
                    "warning": "sync job tables not found in ClickHouse. Run migration 006_product_sync_jobs to provision them."
                }))
            }
            Err(err) => Err(err),
        }
    }

    async fn cancel_sync_job(&self, job_id: &str) -> AppResult<serde_json::Value> {
        let clickhouse_repo = self.state.product_repository();

        clickhouse_repo
            .update_sync_job_status(job_id, "cancelled", 0, 0, 0, Some("Job cancelled by user"))
            .await?;

        Ok(json!({
            "success": true,
            "message": "Sync job cancelled",
            "job_id": job_id
        }))
    }

    async fn sync_to_vector(
        &self,
        _platform: &str,
        _shop_id: &str,
        _embedding_model: Option<String>,
        _embedding_prompt: Option<String>,
        _product_ids: Option<Vec<String>>,
    ) -> ModelAppResult<SyncToVectorResponse> {
        let job_id = Uuid::new_v4().to_string();

        Ok(SyncToVectorResponse {
            job_id,
            status: "pending".to_string(),
            total_products: 0,
        })
    }
}

fn normalize_platform_name(platform: &str) -> String {
    platform.trim().to_lowercase()
}

fn platform_type_from_name(platform: &str) -> PlatformType {
    PlatformType::from_str(platform).unwrap_or(PlatformType::Custom)
}

fn platform_type_to_code(platform_type: PlatformType) -> u8 {
    match platform_type {
        PlatformType::TikTok => 1,
        PlatformType::Shopee => 2,
        PlatformType::Lazada => 3,
        PlatformType::Shopify => 4,
        PlatformType::WooCommerce => 5,
        PlatformType::BigCommerce => 6,
        PlatformType::Magento => 7,
        PlatformType::Amazon => 8,
        PlatformType::Ebay => 9,
        PlatformType::Etsy => 10,
        PlatformType::Alibaba => 11,
        PlatformType::AliExpress => 12,
        PlatformType::Wix => 13,
        PlatformType::Ecwid => 14,
        PlatformType::Medusa => 15,
        PlatformType::Zoho => 16,
        PlatformType::LineShop => 17,
        PlatformType::Taobao => 18,
        PlatformType::JD => 19,
        PlatformType::Walmart => 20,
        PlatformType::Rakuten => 21,
        PlatformType::Custom => 255,
    }
}

fn platform_code_to_type(code: u8) -> PlatformType {
    match code {
        1 => PlatformType::TikTok,
        2 => PlatformType::Shopee,
        3 => PlatformType::Lazada,
        4 => PlatformType::Shopify,
        5 => PlatformType::WooCommerce,
        6 => PlatformType::BigCommerce,
        7 => PlatformType::Magento,
        8 => PlatformType::Amazon,
        9 => PlatformType::Ebay,
        10 => PlatformType::Etsy,
        11 => PlatformType::Alibaba,
        12 => PlatformType::AliExpress,
        13 => PlatformType::Wix,
        14 => PlatformType::Ecwid,
        15 => PlatformType::Medusa,
        16 => PlatformType::Zoho,
        17 => PlatformType::LineShop,
        18 => PlatformType::Taobao,
        19 => PlatformType::JD,
        20 => PlatformType::Walmart,
        21 => PlatformType::Rakuten,
        _ => PlatformType::Custom,
    }
}

fn platform_code_to_string(code: &str) -> String {
    code.parse::<u8>()
        .ok()
        .map(platform_code_to_type)
        .unwrap_or(PlatformType::Custom)
        .to_string()
}

fn platform_name_to_code(platform: &str) -> Option<u8> {
    PlatformType::from_str(&normalize_platform_name(platform))
        .ok()
        .map(platform_type_to_code)
}

fn is_missing_clickhouse_table(message: &str, table: &str) -> bool {
    let lower = message.to_lowercase();
    let table_lower = table.to_lowercase();
    (lower.contains("table") && lower.contains("doesn't exist") && lower.contains(&table_lower))
        || (lower.contains("unknown_table") && lower.contains(&table_lower))
}
