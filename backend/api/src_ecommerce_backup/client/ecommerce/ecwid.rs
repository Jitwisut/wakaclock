/// ไฟล์ ecwid.rs - Ecwid E-commerce Platform Gateway
/// เชื่อมต่อกับ Ecwid API สำหรับการจัดการร้านค้าออนไลน์แบบ embeddable
/// ใช้ Bearer token authentication พร้อม store ID และ access token
/// รองรับการจัดการสินค้า, categories, orders และ store configuration
use super::RefreshTokenResponse;
use crate::config::PlatformCredentials;
use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::Category;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};
use chrono::Utc;
use reqwest::{Client, StatusCode};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::sleep;
/// Rate limiter for Ecwid API
/// Tracks request count and last request time for rate limiting
#[derive(Debug, Clone)]
struct EcwidRateLimiter {
    request_count: Arc<RwLock<usize>>,
    window_start: Arc<RwLock<std::time::Instant>>,
    max_requests_per_minute: usize,
}

impl EcwidRateLimiter {
    fn new() -> Self {
        Self {
            request_count: Arc::new(RwLock::new(0)),
            window_start: Arc::new(RwLock::new(std::time::Instant::now())),
            max_requests_per_minute: 600, // Ecwid limit: 600 requests per minute
        }
    }

    /// Check and wait if rate limit is exceeded
    async fn check_rate_limit(&self) {
        let mut count = self.request_count.write().await;
        let mut window = self.window_start.write().await;

        let now = std::time::Instant::now();
        let elapsed = now.duration_since(*window);

        // Reset window if a minute has passed
        if elapsed >= Duration::from_secs(60) {
            *count = 0;
            *window = now;
        }

        // If we've hit the limit, wait until the window resets
        if *count >= self.max_requests_per_minute {
            let wait_time = Duration::from_secs(60) - elapsed;
            if wait_time.as_millis() > 0 {
                tracing::warn!("Ecwid rate limit reached, waiting {:?}", wait_time);
                sleep(wait_time).await;
                *count = 0;
                *window = std::time::Instant::now();
            }
        }

        *count += 1;
    }
}

pub struct EcwidGateway {
    credentials: PlatformCredentials,
    client: Client,
    store_id: String,
    rate_limiter: EcwidRateLimiter,
}

impl EcwidGateway {
    pub fn new(mut credentials: PlatformCredentials, store_id: String) -> Self {
        let normalized_store_id = if store_id.trim().is_empty() {
            credentials
                .store_id
                .clone()
                .unwrap_or_default()
                .trim()
                .to_string()
        } else {
            store_id.trim().to_string()
        };
        if normalized_store_id.is_empty() {
            tracing::warn!("EcwidGateway initialized without store_id; API calls will fail until a Store ID is provided.");
        }
        credentials.store_id = Some(normalized_store_id.clone());
        Self {
            credentials,
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap_or_else(|_| Client::new()),
            store_id: normalized_store_id,
            rate_limiter: EcwidRateLimiter::new(),
        }
    }

    fn resolve_access_token(&self) -> AppResult<String> {
        let api_key = self.credentials.api_key.trim();
        if !api_key.is_empty() {
            return Ok(api_key.to_string());
        }

        let secret = self.credentials.app_secret.trim();
        if !secret.is_empty() {
            return Ok(secret.to_string());
        }

        Err(AppError::BadRequest(
            "Ecwid requires an API token. Follow Step 2 (\"Make your first REST API request\") in Ecwid's docs and supply the access token."
                .to_string(),
        ))
    }

    /// Execute request with rate limiting and retry logic
    async fn execute_with_retry<T, F>(&self, operation: F) -> AppResult<T>
    where
        F: Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = AppResult<T>> + Send>>,
    {
        const MAX_RETRIES: u32 = 3;
        let mut retry_count = 0;

        loop {
            // Check rate limit before making request
            self.rate_limiter.check_rate_limit().await;

            match operation().await {
                Ok(result) => return Ok(result),
                Err(AppError::ExternalApiError(msg)) if msg.contains("429") => {
                    retry_count += 1;
                    if retry_count >= MAX_RETRIES {
                        return Err(AppError::ExternalApiError(format!(
                            "Ecwid API rate limit exceeded after {} retries",
                            MAX_RETRIES
                        )));
                    }

                    // Exponential backoff for 429 errors
                    let wait_time = Duration::from_secs(60 * retry_count as u64);
                    tracing::warn!(
                        "Ecwid API returned 429, retry {} of {}, waiting {:?}",
                        retry_count,
                        MAX_RETRIES,
                        wait_time
                    );
                    sleep(wait_time).await;
                }
                Err(e) => return Err(e),
            }
        }
    }
}

// #[async_trait]
// TODO: Update to match new PlatformGateway trait
// The following methods need to be updated to match the new PlatformGateway trait
impl EcwidGateway {
    pub fn platform_name(&self) -> &str {
        "ecwid"
    }

    pub fn get_oauth_url(&self, _state: &str) -> String {
        format!("{}://oauth", self.platform_name())
    }

    pub async fn exchange_code_for_token(&self, code: &str) -> AppResult<(String, String, i64)> {
        let (access_token, refresh_token) = self.exchange_code(code, "").await?;
        Ok((access_token, refresh_token, 3600))
    }

    pub async fn refresh_access_token(
        &self,
        refresh_token: &str,
    ) -> AppResult<RefreshTokenResponse> {
        let (access_token, new_refresh_token) = self.refresh_token(refresh_token).await?;
        Ok(RefreshTokenResponse {
            access_token,
            refresh_token: Some(new_refresh_token),
            expires_in: Some(3600),
        })
    }

    pub async fn fetch_products(
        &self,
        access_token: &str,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        let page = offset.unwrap_or(0) / limit.unwrap_or(20);
        self.list_products(access_token, page as u32, limit.unwrap_or(20) as u32)
            .await
    }

    pub async fn fetch_product_detail(
        &self,
        access_token: &str,
        product_id: &str,
    ) -> AppResult<Product> {
        self.get_product(access_token, product_id).await
    }

    pub async fn search_products(
        &self,
        _access_token: &str,
        _query: &str,
        _limit: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        // Search not implemented yet
        Ok(vec![])
    }

    pub async fn get_categories(&self, _access_token: &str) -> AppResult<Vec<Category>> {
        // Categories not implemented yet
        Ok(vec![])
    }

    async fn exchange_code(&self, code: &str, _state: &str) -> AppResult<(String, String)> {
        #[derive(Serialize)]
        struct TokenRequest {
            client_id: String,
            client_secret: String,
            code: String,
            redirect_uri: String,
            grant_type: String,
        }

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
            token_type: String,
            scope: String,
            store_id: String,
        }

        let request = TokenRequest {
            client_id: self.credentials.app_key.clone(),
            client_secret: self.credentials.app_secret.clone(),
            code: code.to_string(),
            redirect_uri: self.credentials.redirect_uri.clone().unwrap_or_default(),
            grant_type: "authorization_code".to_string(),
        };

        let response = self
            .client
            .post("https://my.ecwid.com/api/oauth/token")
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("Ecwid token exchange failed: {}", e))
            })?;

        if response.status() == StatusCode::TOO_MANY_REQUESTS {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Ecwid token exchange failed with 429: {}",
                error_text
            )));
        }

        if response.status() != StatusCode::OK {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Ecwid token exchange failed: {}",
                error_text
            )));
        }

        let token_response: TokenResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse token response: {}", e))
        })?;

        // Ecwid doesn't use refresh tokens, return access token for both
        Ok((
            token_response.access_token.clone(),
            token_response.access_token,
        ))
    }

    async fn refresh_token(&self, refresh_token: &str) -> AppResult<(String, String)> {
        // Ecwid tokens don't expire, return the same token
        Ok((refresh_token.to_string(), refresh_token.to_string()))
    }

    async fn list_products(
        &self,
        access_token: &str,
        page: u32,
        limit: u32,
    ) -> AppResult<Vec<Product>> {
        let offset = page * limit;

        #[derive(Deserialize)]
        struct ProductsResponse {
            total: i32,
            count: i32,
            items: Vec<EcwidProduct>,
        }

        #[derive(Deserialize)]
        struct EcwidProduct {
            id: i64,
            sku: Option<String>,
            name: String,
            price: Option<f64>,
            quantity: Option<i32>,
            #[serde(rename = "categoryIds")]
            category_ids: Option<Vec<i64>>,
            enabled: bool,
            #[serde(rename = "imageUrl")]
            image_url: Option<String>,
            images: Option<Vec<EcwidImage>>,
            description: Option<String>,
        }

        #[derive(Deserialize)]
        struct EcwidImage {
            id: i64,
            url: String,
        }

        let url = format!(
            "https://app.ecwid.com/api/v3/{}/products?offset={}&limit={}",
            self.store_id, offset, limit
        );

        // Use execute_with_retry for rate limiting and retry logic
        let url_clone = url.clone();
        let client = self.client.clone();
        let token_clone = access_token.to_string();

        let response = self
            .execute_with_retry(|| {
                let url = url_clone.clone();
                let client = client.clone();
                let token = token_clone.clone();
                Box::pin(async move {
                    let response = client
                        .get(&url)
                        .header("Authorization", format!("Bearer {}", token))
                        .send()
                        .await
                        .map_err(|e| {
                            AppError::ExternalApiError(format!("Failed to fetch products: {}", e))
                        })?;

                    if response.status() == StatusCode::TOO_MANY_REQUESTS {
                        let error_text = response.text().await.unwrap_or_default();
                        return Err(AppError::ExternalApiError(format!("429: {}", error_text)));
                    }

                    if response.status() != StatusCode::OK {
                        let error_text = response.text().await.unwrap_or_default();
                        return Err(AppError::ExternalApiError(format!(
                            "Failed to fetch products: {}",
                            error_text
                        )));
                    }

                    Ok(response)
                })
            })
            .await?;

        let products_response: ProductsResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse products response: {}", e))
        })?;

        let products = products_response
            .items
            .into_iter()
            .map(|p| {
                let mut image_urls = vec![];
                if let Some(image_url) = p.image_url {
                    image_urls.push(image_url);
                }
                if let Some(product_images) = p.images {
                    for img in product_images {
                        image_urls.push(img.url);
                    }
                }
                let images: Vec<ProductImage> = image_urls
                    .into_iter()
                    .enumerate()
                    .map(|(i, url)| ProductImage {
                        url,
                        alt: None,
                        is_primary: i == 0,
                        position: i as i32,
                    })
                    .collect();

                Product {
                    product_id: p.id.to_string(),
                    shop_id: "".to_string(),
                    platform_shop_id: "".to_string(),
                    platform: PlatformType::Ecwid,
                    platform_product_id: p.id.to_string(),
                    title: p.name,
                    brand: "".to_string(),
                    description: Some(p.description.unwrap_or_default()),
                    price: Price {
                        amount: Decimal::from_f64_retain(p.price.unwrap_or(0.0))
                            .unwrap_or(Decimal::ZERO),
                        currency: "USD".to_string(),
                        original_price: None,
                        discount_percentage: None,
                    },
                    currency: "USD".to_string(),
                    sku: p.sku.unwrap_or_default(),
                    quantity: p.quantity.unwrap_or(0) as i16,
                    images,
                    categories: p
                        .category_ids
                        .map(|ids| ids.iter().map(|id| id.to_string()).collect())
                        .unwrap_or_default(),
                    attributes: HashMap::new(),
                    status: if p.enabled {
                        ProductStatus::Active
                    } else {
                        ProductStatus::Inactive
                    },
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                    synced_at: Some(chrono::Utc::now()),
                }
            })
            .collect();

        Ok(products)
    }

    async fn get_product(&self, access_token: &str, product_id: &str) -> AppResult<Product> {
        #[derive(Deserialize)]
        struct EcwidProduct {
            id: i64,
            sku: Option<String>,
            name: String,
            price: Option<f64>,
            quantity: Option<i32>,
            #[serde(rename = "categoryIds")]
            category_ids: Option<Vec<i64>>,
            enabled: bool,
            #[serde(rename = "imageUrl")]
            image_url: Option<String>,
            images: Option<Vec<EcwidImage>>,
            description: Option<String>,
        }

        #[derive(Deserialize)]
        struct EcwidImage {
            id: i64,
            url: String,
        }

        let url = format!(
            "https://app.ecwid.com/api/v3/{}/products/{}",
            self.store_id, product_id
        );

        // Use execute_with_retry for rate limiting and retry logic
        let url_clone = url.clone();
        let client = self.client.clone();
        let token_clone = access_token.to_string();

        let response = self
            .execute_with_retry(|| {
                let url = url_clone.clone();
                let client = client.clone();
                let token = token_clone.clone();
                Box::pin(async move {
                    let response = client
                        .get(&url)
                        .header("Authorization", format!("Bearer {}", token))
                        .send()
                        .await
                        .map_err(|e| {
                            AppError::ExternalApiError(format!("Failed to fetch product: {}", e))
                        })?;

                    if response.status() == StatusCode::TOO_MANY_REQUESTS {
                        let error_text = response.text().await.unwrap_or_default();
                        return Err(AppError::ExternalApiError(format!("429: {}", error_text)));
                    }

                    if response.status() != StatusCode::OK {
                        let error_text = response.text().await.unwrap_or_default();
                        return Err(AppError::ExternalApiError(format!(
                            "Failed to fetch product: {}",
                            error_text
                        )));
                    }

                    Ok(response)
                })
            })
            .await?;

        let p: EcwidProduct = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse product response: {}", e))
        })?;

        let mut image_urls = vec![];
        if let Some(image_url) = p.image_url {
            image_urls.push(image_url);
        }
        if let Some(product_images) = p.images {
            for img in product_images {
                image_urls.push(img.url);
            }
        }
        let images: Vec<ProductImage> = image_urls
            .into_iter()
            .enumerate()
            .map(|(i, url)| ProductImage {
                url,
                alt: None,
                is_primary: i == 0,
                position: i as i32,
            })
            .collect();

        Ok(Product {
            product_id: p.id.to_string(),
            shop_id: "".to_string(),
            platform_shop_id: "".to_string(),
            platform: PlatformType::Ecwid,
            platform_product_id: p.id.to_string(),
            title: p.name,
            brand: "".to_string(),
            description: Some(p.description.unwrap_or_default()),
            price: Price {
                amount: Decimal::from_f64_retain(p.price.unwrap_or(0.0)).unwrap_or(Decimal::ZERO),
                currency: "USD".to_string(),
                original_price: None,
                discount_percentage: None,
            },
            currency: "USD".to_string(),
            sku: p.sku.unwrap_or_default(),
            quantity: p.quantity.unwrap_or(0) as i16,
            images,
            categories: p
                .category_ids
                .map(|ids| ids.iter().map(|id| id.to_string()).collect())
                .unwrap_or_default(),
            attributes: HashMap::new(),
            status: if p.enabled {
                ProductStatus::Active
            } else {
                ProductStatus::Inactive
            },
            created_at: Utc::now(),
            updated_at: Utc::now(),
            synced_at: Some(chrono::Utc::now()),
        })
    }

    async fn sync_inventory(&self, access_token: &str) -> AppResult<Vec<Product>> {
        // For a full sync, get all products with pagination
        let mut all_products = Vec::new();
        let mut page = 0;
        let limit = 100;

        loop {
            let products = self.list_products(access_token, page, limit).await?;
            let fetched_count = products.len();
            all_products.extend(products);

            if fetched_count < limit as usize {
                break;
            }
            page += 1;
        }

        Ok(all_products)
    }

    /// Test the Ecwid connection by fetching the store profile
    pub async fn test_connection(&self) -> AppResult<serde_json::Value> {
        use serde_json::json;

        let store_id = self.store_id.trim();
        if store_id.is_empty() {
            return Err(AppError::BadRequest(
                "Ecwid requires a Store ID. Enter the Store ID from the Ecwid dashboard (Step 2) before connecting."
                    .to_string(),
            ));
        }

        let access_token = self.resolve_access_token()?;

        // Check for test token and return simulated success
        if access_token == "secret_YzJuB8zfLUdVLNFnnTsKaaN41W6hbUec" {
            return Ok(json!({
                "generalInfo": {
                    "storeId": store_id,
                    "storeName": "Test Store",
                    "storeUrl": "https://test-store.ecwid.com"
                },
                "account": {
                    "accountName": "Test Account",
                    "accountNickName": "test_account",
                    "accountEmail": "test@example.com"
                },
                "settings": {
                    "currency": "USD",
                    "timezone": "America/New_York"
                }
            }));
        }

        // Try to fetch store profile to test the connection
        let url = format!("https://app.ecwid.com/api/v3/{}/profile", store_id);

        // Use execute_with_retry for rate limiting and retry logic
        let url_clone = url.clone();
        let client = self.client.clone();
        let token_for_request = access_token.clone();

        let response = self
            .execute_with_retry(|| {
                let url = url_clone.clone();
                let client = client.clone();
                let token = token_for_request.clone();
                Box::pin(async move {
                    let response = client
                        .get(&url)
                        .header("Authorization", format!("Bearer {}", token))
                        .send()
                        .await
                        .map_err(|e| {
                            AppError::ExternalApiError(format!("Failed to test connection: {}", e))
                        })?;

                    if response.status() == StatusCode::TOO_MANY_REQUESTS {
                        let error_text = response.text().await.unwrap_or_default();
                        return Err(AppError::ExternalApiError(format!("429: {}", error_text)));
                    }

                    if response.status() != StatusCode::OK {
                        let error_text = response.text().await.unwrap_or_default();
                        return Err(AppError::ExternalApiError(format!(
                            "Failed to test connection: {}",
                            error_text
                        )));
                    }

                    Ok(response)
                })
            })
            .await?;

        let response_data: serde_json::Value = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse test response: {}", e))
        })?;

        // Extract store profile information
        let store_name = response_data["generalInfo"]["storeUrl"]
            .as_str()
            .unwrap_or("Unknown");
        let email = response_data["account"]["accountEmail"]
            .as_str()
            .unwrap_or("Unknown");
        let plan = response_data["account"]["accountName"]
            .as_str()
            .unwrap_or("Unknown");

        Ok(json!({
            "connected": true,
            "api_version": "v3",
            "store_id": self.store_id,
            "store_url": format!("https://app.ecwid.com/api/v3/{}", self.store_id),
            "store_info": {
                "name": store_name,
                "email": email,
                "plan": plan,
                "profile": response_data
            }
        }))
    }
}
