//! Vector ingestion service orchestrates product sampling, ClickHouse persistence,
//! and queueing embedding jobs for Qdrant ingestion.

use std::{collections::HashMap, str::FromStr, sync::Arc};

use chrono::Utc;
use rust_decimal::prelude::FromPrimitive;
use rust_decimal::Decimal;
use tracing::warn;
use uuid::Uuid;

use crate::{
    interfaces::{
        platform_gateway::{Credentials, ListProductParams, PlatformProduct},
        GatewayFactory, GatewayFactoryImpl,
    },
    model::error::{AppError, AppResult},
    model::v1::platfrom::{
        entries::{PlatformType, Price, Product, ProductImage, ProductStatus, VectorSyncMode},
        request::product::{SampleCredentialInput, SampleVectorSyncRequest, SyncToVectorRequest},
        response::product::{SampleVectorSyncResponse, SyncToVectorResponse},
    },
    repository::ProductRepository,
    worker::vector_sync::VectorSyncMessage,
    AppState,
};

/// Service responsible for vector ingestion orchestration.
pub struct VectorIngestService {
    state: Arc<AppState>,
}

impl VectorIngestService {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// Schedule a vector sync job for existing products in ClickHouse.
    pub async fn sync_to_vector(
        &self,
        tenant_id: &str,
        request: &SyncToVectorRequest,
    ) -> AppResult<SyncToVectorResponse> {
        let repo = self.state.product_repository();

        let mut product_ids = if let Some(ids) = request.product_ids.clone() {
            ids
        } else {
            let limit = request.limit.unwrap_or(100).clamp(1, 1000);
            repo.list_products(tenant_id, &request.platform, &request.shop_id, 1, limit)
                .await?
                .into_iter()
                .map(|p| p.product_id)
                .collect()
        };

        product_ids.retain(|id| !id.is_empty());

        if product_ids.is_empty() {
            return Err(AppError::BadRequest(
                "No products available for vector sync".to_string(),
            ));
        }

        let mode = request.mode.unwrap_or(if product_ids.len() == 1 {
            VectorSyncMode::Items
        } else {
            VectorSyncMode::Batch
        });

        let job_id = self
            .enqueue_vector_job(
                tenant_id,
                &request.platform,
                &request.shop_id,
                product_ids.clone(),
                request.embedding_model.clone(),
                request.embedding_prompt.clone(),
                mode,
            )
            .await?;

        Ok(SyncToVectorResponse {
            job_id,
            status: "queued".to_string(),
            total_products: product_ids.len(),
        })
    }

    /// Fetch sample products directly from platform, persist them, and queue vector jobs.
    pub async fn sample_vector_sync(
        &self,
        tenant_id: &str,
        request: &SampleVectorSyncRequest,
    ) -> AppResult<SampleVectorSyncResponse> {
        let mode = request.mode.unwrap_or(VectorSyncMode::Batch);
        let sample_limit = request.limit.unwrap_or(5).clamp(1, 50);

        let credentials = self.build_sample_gateway_credentials(
            &request.platform,
            &request.shop_id,
            request.credentials.as_ref(),
        )?;

        let gateway = GatewayFactoryImpl::new()
            .create_gateway(&request.platform, credentials)
            .await
            .map_err(|err| AppError::ExternalServiceError(err.to_string()))?;

        let platform_products = if let Some(ids) = &request.product_ids {
            let mut collected = Vec::new();
            for product_id in ids {
                match gateway.get_product(product_id).await {
                    Ok(product) => collected.push(product),
                    Err(err) => {
                        tracing::warn!(
                            "Failed to fetch sample platform product {}: {:?}",
                            product_id,
                            err
                        );
                    }
                }
            }
            collected
        } else {
            let params = ListProductParams {
                page: Some(1),
                limit: Some(sample_limit),
                offset: Some(0),
                status: None,
                search: None,
                sort: None,
                shop_id: Some(request.shop_id.clone()),
            };
            gateway
                .list_products(&params)
                .await
                .map(|resp| resp.products)
                .map_err(|err| {
                    AppError::ExternalServiceError(format!(
                        "Failed to fetch sample products: {:?}",
                        err
                    ))
                })?
        };

        if platform_products.is_empty() {
            return Err(AppError::BadRequest(
                "Platform did not return any sample products".to_string(),
            ));
        }

        let repo = self.state.product_repository();
        let mut stored_ids = Vec::new();

        for platform_product in platform_products {
            match Self::platform_product_to_product(
                &request.platform,
                &request.shop_id,
                platform_product,
            ) {
                Ok(product) => {
                    let product_id = product.product_id.clone();
                    if let Err(err) = repo.save_product(tenant_id, &product).await {
                        tracing::warn!(
                            "Failed to persist sample product {} to ClickHouse: {}",
                            product_id,
                            err
                        );
                    }
                    if let Err(err) = repo.save_unified_product(tenant_id, &product).await {
                        tracing::warn!(
                            "Failed to persist sample product {} to unified table: {}",
                            product_id,
                            err
                        );
                    }
                    stored_ids.push(product_id);
                }
                Err(err) => tracing::warn!("Failed to map platform product: {}", err),
            }
        }

        if stored_ids.is_empty() {
            return Err(AppError::BadRequest(
                "Unable to persist any sample products".to_string(),
            ));
        }

        let mut job_ids = Vec::new();
        match mode {
            VectorSyncMode::Items => {
                for product_id in stored_ids.iter() {
                    let job_id = self
                        .enqueue_vector_job(
                            tenant_id,
                            &request.platform,
                            &request.shop_id,
                            vec![product_id.clone()],
                            request.embedding_model.clone(),
                            request.embedding_prompt.clone(),
                            VectorSyncMode::Items,
                        )
                        .await?;
                    job_ids.push(job_id);
                }
            }
            VectorSyncMode::Batch => {
                let job_id = self
                    .enqueue_vector_job(
                        tenant_id,
                        &request.platform,
                        &request.shop_id,
                        stored_ids.clone(),
                        request.embedding_model.clone(),
                        request.embedding_prompt.clone(),
                        VectorSyncMode::Batch,
                    )
                    .await?;
                job_ids.push(job_id);
            }
        }

        Ok(SampleVectorSyncResponse {
            job_ids,
            mode,
            sample_count: stored_ids.len(),
        })
    }

    async fn enqueue_vector_job(
        &self,
        tenant_id: &str,
        platform: &str,
        shop_id: &str,
        product_ids: Vec<String>,
        embedding_model: Option<String>,
        embedding_prompt: Option<String>,
        mode: VectorSyncMode,
    ) -> AppResult<String> {
        if product_ids.is_empty() {
            return Err(AppError::BadRequest(
                "Vector sync job requires at least one product ID".to_string(),
            ));
        }

        let job_id = Uuid::new_v4().to_string();
        let model = embedding_model
            .or_else(|| {
                self.state
                    .config
                    .get_default_embedding_model(platform)
                    .map(|(name, _)| name.clone())
            })
            .unwrap_or_else(|| "openai-text-embedding-3-large".to_string());

        let message = VectorSyncMessage {
            job_id: job_id.clone(),
            tenant_id: tenant_id.to_string(),
            shop_id: shop_id.to_string(),
            platform: platform.to_string(),
            product_ids,
            embedding_model: model,
            embedding_prompt: embedding_prompt.unwrap_or_default(),
            mode,
        };

        let payload = serde_json::to_vec(&message).map_err(|e| {
            AppError::InternalError(format!("Failed to serialize vector job: {}", e))
        })?;

        self.state
            .queue
            .publish_bytes("ecommerce.vector.sync", payload)
            .await
            .map_err(|e| AppError::QueueError(format!("Failed to publish vector job: {}", e)))?;

        Ok(job_id)
    }

    fn platform_product_to_product(
        platform: &str,
        shop_id: &str,
        platform_product: PlatformProduct,
    ) -> AppResult<Product> {
        let platform_type = PlatformType::from_str(platform).map_err(|_| {
            AppError::BadRequest(format!(
                "Unsupported platform '{}' for sample sync",
                platform
            ))
        })?;

        let PlatformProduct {
            id,
            platform_id,
            title,
            description,
            price,
            currency,
            sku,
            quantity,
            images,
            attributes,
            status,
            ..
        } = platform_product;

        let price_amount = Decimal::from_f64_retain(price).unwrap_or_else(|| Decimal::ZERO);
        let price = Price {
            amount: price_amount,
            currency: currency.clone(),
            original_price: None,
            discount_percentage: None,
        };

        let image_rows = images
            .into_iter()
            .enumerate()
            .map(|(index, url)| ProductImage {
                url,
                alt: None,
                is_primary: index == 0,
                position: index as i32,
            })
            .collect();

        Ok(Product {
            product_id: Uuid::new_v4().to_string(),
            platform_product_id: id,
            shop_id: shop_id.to_string(),
            platform_shop_id: platform_id.unwrap_or_else(|| shop_id.to_string()),
            platform: platform_type,
            title,
            brand: String::new(),
            description,
            price,
            quantity: quantity
                .unwrap_or(0)
                .clamp(i16::MIN as i32, i16::MAX as i32) as i16,
            images: image_rows,
            currency,
            attributes,
            categories: vec![],
            status: Self::status_from_platform(&status),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            synced_at: Some(Utc::now()),
            sku: sku.unwrap_or_default(),
        })
    }

    fn status_from_platform(status: &str) -> ProductStatus {
        match status.to_lowercase().as_str() {
            "inactive" | "draft" => ProductStatus::Inactive,
            "out_of_stock" => ProductStatus::OutOfStock,
            "deleted" => ProductStatus::Deleted,
            "archived" => ProductStatus::Archived,
            _ => ProductStatus::Active,
        }
    }

    fn build_sample_gateway_credentials(
        &self,
        platform: &str,
        shop_id: &str,
        creds: Option<&SampleCredentialInput>,
    ) -> AppResult<Credentials> {
        let mut base = self.state.config.get_platform_credentials(platform)?;

        if let Some(input) = creds {
            if let Some(api_key) = &input.api_key {
                base.api_key = api_key.clone();
                base.app_key = api_key.clone();
            }
            if let Some(api_secret) = &input.api_secret {
                base.app_secret = api_secret.clone();
            }
            if let Some(store_url) = &input.store_url {
                base.api_base_url = store_url.clone();
                base.base_url = Some(store_url.clone());
            }
        }

        let store_url = creds
            .and_then(|c| c.store_url.clone())
            .or(base.base_url.clone())
            .or(Some(base.api_base_url.clone()));

        Ok(Credentials {
            api_key: if base.app_key.is_empty() {
                None
            } else {
                Some(base.app_key.clone())
            },
            api_secret: if base.app_secret.is_empty() {
                None
            } else {
                Some(base.app_secret.clone())
            },
            access_token: creds.and_then(|c| c.access_token.clone()),
            refresh_token: None,
            store_url,
            shop_id: Some(shop_id.to_string()),
            additional: HashMap::new(),
            extra: HashMap::new(),
        })
    }
}
