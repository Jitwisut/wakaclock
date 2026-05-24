use crate::interfaces::platform_gateway::{
    Credentials, ListProductParams, OAuthTokens, OAuthUrl, PlatformLimits, PlatformProduct,
    ProductList, ProductVariant, RateLimit, ShopInfo,
};
use crate::interfaces::{InterfaceError, InterfaceResult, PlatformGateway};
use crate::model::error::{AppError, AppResult};
/// ไฟล์ medusa.rs - Medusa Headless Commerce Platform Gateway
/// เชื่อมต่อกับ Medusa API สำหรับการจัดการสินค้าในระบบ headless e-commerce
/// ใช้ JWT authentication และรองรับ API key based access
/// รองรับการจัดการสินค้า, variants, regions และ multi-storefront architecture
use anyhow::Result;

use async_trait::async_trait;
use reqwest::{header, Client};
use rust_decimal::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, error, info};

pub struct MedusaGateway {
    client: Client,
    base_url: String,
    publishable_key: String,
    api_token: Option<String>,
}

impl MedusaGateway {
    pub fn new(credentials: &Credentials) -> InterfaceResult<Self> {
        let base_url = credentials
            .extra
            .get("base_url")
            .ok_or_else(|| {
                InterfaceError::InvalidInput("Missing base_url in credentials".to_string())
            })?
            .clone();

        // Support both publishable key and JWT authentication
        let publishable_key = credentials.api_key.clone().unwrap_or_default();

        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| InterfaceError::ConnectionError(e.to_string()))?;

        Ok(Self {
            client,
            base_url,
            publishable_key,
            api_token: credentials.access_token.clone(),
        })
    }

    /// Login with email and password to get JWT token
    pub async fn login(&self, email: &str, password: &str) -> InterfaceResult<String> {
        let url = format!("{}/admin/auth", self.base_url);

        #[derive(Serialize)]
        struct LoginRequest {
            email: String,
            password: String,
        }

        #[derive(Deserialize)]
        struct LoginResponse {
            user: serde_json::Value,
            token: String,
        }

        let login_req = LoginRequest {
            email: email.to_string(),
            password: password.to_string(),
        };

        debug!("Attempting Medusa login for email: {}", email);

        let response = self
            .client
            .post(&url)
            .header(header::CONTENT_TYPE, "application/json")
            .json(&login_req)
            .send()
            .await
            .map_err(|e| {
                InterfaceError::ConnectionError(format!("Failed to login to Medusa: {}", e))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!("Medusa login failed: {} - {}", status, error_text);
            return Err(InterfaceError::OperationFailed(format!(
                "Medusa login failed: {} - {}",
                status, error_text
            )));
        }

        let login_response: LoginResponse = response.json().await.map_err(|e| {
            InterfaceError::SerializationError(format!("Failed to parse login response: {}", e))
        })?;

        info!("Successfully logged in to Medusa");
        Ok(login_response.token)
    }

    fn build_headers(&self) -> header::HeaderMap {
        let mut headers = header::HeaderMap::new();
        headers.insert(
            "x-publishable-api-key",
            header::HeaderValue::from_str(&self.publishable_key).unwrap(),
        );
        headers.insert(
            header::CONTENT_TYPE,
            header::HeaderValue::from_static("application/json"),
        );

        if let Some(token) = &self.api_token {
            headers.insert(
                header::AUTHORIZATION,
                header::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
            );
        }

        headers
    }
}

// Medusa API response types
#[derive(Debug, Clone, Deserialize)]
struct ProductsResponse {
    products: Vec<MedusaProduct>,
    count: Option<usize>,
    offset: Option<usize>,
    limit: Option<usize>,
}

#[derive(Debug, Clone, Deserialize)]
struct MedusaProduct {
    id: String,
    title: String,
    handle: Option<String>,
    description: Option<String>,
    status: Option<String>,
    variants: Option<Vec<MedusaVariant>>,
    images: Option<Vec<MedusaImage>>,
    thumbnail: Option<String>,
    categories: Option<Vec<ProductCategory>>,
    metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Deserialize)]
struct MedusaVariant {
    id: String,
    sku: Option<String>,
    title: Option<String>,
    inventory_quantity: Option<i32>,
    prices: Option<Vec<MedusaPrice>>,
    metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Deserialize)]
struct MedusaPrice {
    currency_code: String,
    amount: f64,
}

#[derive(Debug, Clone, Deserialize)]
struct MedusaImage {
    url: Option<String>,
    thumbnail: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct ProductCategory {
    id: String,
    name: String,
    handle: String,
}

// Request types for creating/updating products
#[derive(Debug, Clone, Serialize)]
struct CreateProductRequest {
    title: String,
    handle: String,
    description: Option<String>,
    status: String,
    images: Vec<String>,
    variants: Vec<CreateVariantRequest>,
    metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize)]
struct CreateVariantRequest {
    title: String,
    sku: String,
    prices: Vec<CreatePriceRequest>,
    inventory_quantity: i32,
}

#[derive(Debug, Clone, Serialize)]
struct CreatePriceRequest {
    currency_code: String,
    amount: f64,
}

#[derive(Debug, Clone, Serialize)]
struct UpdateProductRequest {
    title: Option<String>,
    description: Option<String>,
    status: Option<String>,
    images: Option<Vec<String>>,
    metadata: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Deserialize)]
struct StoreInfoResponse {
    store: StoreInfo,
}

#[derive(Debug, Clone, Deserialize)]
struct StoreInfo {
    id: String,
    name: String,
    created_at: String,
}

#[async_trait]
impl PlatformGateway for MedusaGateway {
    fn platform_id(&self) -> &str {
        "medusa"
    }

    async fn init_oauth(&self, _redirect_uri: &str, _state: &str) -> InterfaceResult<OAuthUrl> {
        Err(InterfaceError::OperationFailed(
            "Medusa uses publishable API key authentication, not OAuth".to_string(),
        ))
    }

    async fn handle_oauth_callback(
        &self,
        _code: &str,
        _state: &str,
    ) -> InterfaceResult<OAuthTokens> {
        Err(InterfaceError::OperationFailed(
            "Medusa uses publishable API key authentication, not OAuth".to_string(),
        ))
    }

    async fn refresh_tokens(&self, _refresh_token: &str) -> InterfaceResult<OAuthTokens> {
        Err(InterfaceError::OperationFailed(
            "Medusa uses publishable API key authentication, not OAuth".to_string(),
        ))
    }

    async fn list_products(&self, params: &ListProductParams) -> InterfaceResult<ProductList> {
        let limit = params.limit.unwrap_or(50);
        let offset = params.offset.unwrap_or(0);

        let mut url = format!("{}/store/products", self.base_url);
        url.push_str(&format!("?limit={}&offset={}", limit, offset));

        if let Some(search) = &params.search {
            url.push_str(&format!("&q={}", urlencoding::encode(search)));
        }

        if let Some(status) = &params.status {
            url.push_str(&format!("&status={}", status));
        }

        url.push_str("&fields=*variants,*images");

        debug!("Fetching products from Medusa: {}", url);

        let response = self
            .client
            .get(&url)
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|e| {
                InterfaceError::ConnectionError(format!("Failed to fetch products: {}", e))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            error!("Medusa API error: {} - {}", status, error_text);
            return Err(InterfaceError::OperationFailed(format!(
                "Medusa API error: {} - {}",
                status, error_text
            )));
        }

        let response_data: ProductsResponse = response.json().await.map_err(|e| {
            InterfaceError::SerializationError(format!("Failed to parse products response: {}", e))
        })?;

        let products: Vec<PlatformProduct> = response_data
            .products
            .into_iter()
            .map(|p| self.convert_to_platform_product(p))
            .collect();

        let total = response_data.count.unwrap_or(products.len());
        let has_more = ((offset + limit) as usize) < total;

        Ok(ProductList {
            products,
            total: total as u64,
            has_more,
            next_cursor: if has_more {
                Some((offset + limit).to_string())
            } else {
                None
            },
        })
    }

    async fn get_product(&self, product_id: &str) -> InterfaceResult<PlatformProduct> {
        let url = format!("{}/store/products/{}", self.base_url, product_id);

        debug!("Fetching product from Medusa: {}", url);

        let response = self
            .client
            .get(&url)
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|e| {
                InterfaceError::ConnectionError(format!("Failed to fetch product: {}", e))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(InterfaceError::OperationFailed(format!(
                "Medusa API error: {} - {}",
                status, error_text
            )));
        }

        let product: MedusaProduct = response.json().await.map_err(|e| {
            InterfaceError::SerializationError(format!("Failed to parse product response: {}", e))
        })?;

        Ok(self.convert_to_platform_product(product))
    }

    async fn create_product(&self, product: &PlatformProduct) -> InterfaceResult<String> {
        let url = format!("{}/admin/products", self.base_url);

        let request = CreateProductRequest {
            title: product.title.clone(),
            handle: product.title.to_lowercase().replace(' ', "-"),
            description: product.description.clone(),
            status: if product.status == "active" {
                "published".to_string()
            } else {
                "draft".to_string()
            },
            images: product.images.clone(),
            variants: product
                .variants
                .iter()
                .map(|v| CreateVariantRequest {
                    title: v
                        .attributes
                        .get("title")
                        .cloned()
                        .unwrap_or(v.sku.clone().unwrap_or_default()),
                    sku: v.sku.clone().unwrap_or_default(),
                    prices: vec![CreatePriceRequest {
                        currency_code: product.currency.clone(),
                        amount: v.price.to_string().parse::<f64>().unwrap_or(0.0),
                    }],
                    inventory_quantity: v.inventory.unwrap_or(0),
                })
                .collect(),
            metadata: Some(
                product
                    .attributes
                    .iter()
                    .map(|(k, v)| (k.clone(), serde_json::Value::String(v.clone())))
                    .collect(),
            ),
        };

        debug!("Creating product in Medusa");

        let response = self
            .client
            .post(&url)
            .headers(self.build_headers())
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                InterfaceError::ConnectionError(format!("Failed to create product: {}", e))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(InterfaceError::OperationFailed(format!(
                "Medusa API error: {} - {}",
                status, error_text
            )));
        }

        let result: serde_json::Value = response.json().await.map_err(|e| {
            InterfaceError::SerializationError(format!("Failed to parse create response: {}", e))
        })?;

        let product_id = result["product"]["id"].as_str().ok_or_else(|| {
            InterfaceError::SerializationError("Missing product ID in response".to_string())
        })?;

        Ok(product_id.to_string())
    }

    async fn update_product(
        &self,
        product_id: &str,
        product: &PlatformProduct,
    ) -> InterfaceResult<()> {
        let url = format!("{}/admin/products/{}", self.base_url, product_id);

        let request = UpdateProductRequest {
            title: Some(product.title.clone()),
            description: product.description.clone(),
            status: Some(if product.status == "active" {
                "published".to_string()
            } else {
                "draft".to_string()
            }),
            images: Some(product.images.clone()),
            metadata: Some(
                product
                    .attributes
                    .iter()
                    .map(|(k, v)| (k.clone(), serde_json::Value::String(v.clone())))
                    .collect(),
            ),
        };

        debug!("Updating product {} in Medusa", product_id);

        let response = self
            .client
            .post(&url)
            .headers(self.build_headers())
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                InterfaceError::ConnectionError(format!("Failed to update product: {}", e))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(InterfaceError::OperationFailed(format!(
                "Medusa API error: {} - {}",
                status, error_text
            )));
        }

        Ok(())
    }

    async fn delete_product(&self, product_id: &str) -> InterfaceResult<()> {
        let url = format!("{}/admin/products/{}", self.base_url, product_id);

        debug!("Deleting product {} from Medusa", product_id);

        let response = self
            .client
            .delete(&url)
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|e| {
                InterfaceError::ConnectionError(format!("Failed to delete product: {}", e))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(InterfaceError::OperationFailed(format!(
                "Medusa API error: {} - {}",
                status, error_text
            )));
        }

        Ok(())
    }

    async fn get_shop_info(&self) -> InterfaceResult<ShopInfo> {
        let url = format!("{}/admin/store", self.base_url);

        debug!("Fetching store info from Medusa");

        let response = self
            .client
            .get(&url)
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|e| {
                InterfaceError::ConnectionError(format!("Failed to fetch store info: {}", e))
            })?;

        if !response.status().is_success() {
            info!("Failed to fetch store info, using defaults");
            return Ok(ShopInfo {
                id: "medusa_store".to_string(),
                name: "Medusa Store".to_string(),
                platform: Some("medusa".to_string()),
                status: Some("active".to_string()),
                created_at: Some(chrono::Utc::now()),
                url: None,
                country: None,
                currency: None,
            });
        }

        let response_data: StoreInfoResponse = response.json().await.map_err(|e| {
            InterfaceError::SerializationError(format!("Failed to parse store info: {}", e))
        })?;

        Ok(ShopInfo {
            id: response_data.store.id,
            name: response_data.store.name,
            platform: Some("medusa".to_string()),
            status: Some("active".to_string()),
            created_at: Some(
                chrono::DateTime::parse_from_rfc3339(&response_data.store.created_at)
                    .map(|dt| dt.with_timezone(&chrono::Utc))
                    .unwrap_or_else(|_| chrono::Utc::now()),
            ),
            url: None,
            country: None,
            currency: None,
        })
    }

    async fn validate_credentials(&self) -> InterfaceResult<bool> {
        // Check if we have the required fields for authentication
        if self.publishable_key.is_empty() || self.base_url.is_empty() {
            return Ok(false);
        }

        let url = format!("{}/store/products?limit=1", self.base_url);

        let response = self
            .client
            .get(&url)
            .headers(self.build_headers())
            .send()
            .await;

        match response {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(_) => Ok(false),
        }
    }

    async fn get_limits(&self) -> InterfaceResult<PlatformLimits> {
        Ok(PlatformLimits {
            requests_per_second: Some(10),
            requests_per_minute: Some(300),
            requests_per_hour: Some(10000),
            max_page_size: Some(100),
        })
    }

    fn platform_name(&self) -> &str {
        "Medusa"
    }

    async fn get_oauth_url(&self, _state: &str) -> Result<String> {
        // Medusa uses JWT authentication, not OAuth
        Ok("Medusa uses JWT authentication".to_string())
    }

    async fn exchange_code_for_token(&self, _code: &str) -> Result<(String, String)> {
        Err(anyhow::anyhow!("Medusa uses JWT authentication, not OAuth"))
    }

    async fn refresh_token(&self, _refresh_token: &str) -> Result<(String, String)> {
        Err(anyhow::anyhow!("Medusa uses JWT authentication, not OAuth"))
    }

    async fn fetch_products(
        &self,
        _access_token: &str,
        page: Option<u32>,
        limit: Option<u32>,
    ) -> Result<Vec<serde_json::Value>> {
        let params = ListProductParams {
            page,
            limit,
            offset: None,
            status: None,
            search: None,
            sort: None,
            shop_id: None,
        };
        let result = self.list_products(&params).await?;
        Ok(result
            .products
            .into_iter()
            .map(|p| serde_json::to_value(p).unwrap_or_else(|_| serde_json::json!({})))
            .collect())
    }

    async fn fetch_product_details(
        &self,
        _access_token: &str,
        product_id: &str,
    ) -> Result<serde_json::Value> {
        let product = self.get_product(product_id).await?;
        Ok(serde_json::to_value(product).unwrap_or_else(|_| serde_json::json!({})))
    }

    async fn upsert_product(
        &self,
        _access_token: &str,
        product: serde_json::Value,
    ) -> Result<serde_json::Value> {
        let platform_product: PlatformProduct = serde_json::from_value(product)?;
        let id = self.create_product(&platform_product).await?;
        Ok(serde_json::json!({"id": id}))
    }

    async fn check_rate_limit(&self) -> InterfaceResult<RateLimit> {
        Ok(RateLimit {
            limit: 1000,
            remaining: 1000,
            reset_at: None,
        })
    }
}

impl MedusaGateway {
    /// Test the Medusa connection by fetching a single product
    pub async fn test_connection(&self) -> AppResult<serde_json::Value> {
        use serde_json::json;

        // Try to fetch one product to test the connection
        let url = format!("{}/store/products?limit=1", self.base_url);

        let response = self
            .client
            .get(&url)
            .headers(self.build_headers())
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to test connection: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Failed to test connection: {} - {}",
                status, error_text
            )));
        }

        let response_data: serde_json::Value = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse test response: {}", e))
        })?;

        let products = response_data["products"].as_array();
        let has_products = products.is_some_and(|arr| !arr.is_empty());

        Ok(json!({
            "connected": true,
            "api_version": "store",
            "store_url": self.base_url,
            "test_result": {
                "products_accessible": has_products,
                "sample_product": products.and_then(|arr| arr.first())
            }
        }))
    }

    fn convert_to_platform_product(&self, product: MedusaProduct) -> PlatformProduct {
        let first_variant = product.variants.as_ref().and_then(|v| v.first());

        let price = first_variant
            .and_then(|v| v.prices.as_ref())
            .and_then(|p| p.first())
            .map(|p| Decimal::try_from(p.amount).unwrap_or_default())
            .unwrap_or_default();

        let currency = first_variant
            .and_then(|v| v.prices.as_ref())
            .and_then(|p| p.first())
            .map(|p| p.currency_code.clone())
            .unwrap_or_else(|| "USD".to_string());

        let sku = first_variant
            .and_then(|v| v.sku.clone())
            .unwrap_or_else(|| format!("SKU-{}", product.id));

        let mut images: Vec<String> = product
            .images
            .clone()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|image| image.url.or(image.thumbnail))
            .collect();

        if images.is_empty() {
            if let Some(thumbnail) = product.thumbnail.as_ref() {
                images.push(thumbnail.clone());
            }
        }

        let variants = product
            .variants
            .unwrap_or_default()
            .into_iter()
            .map(|v| {
                let variant_price = v
                    .prices
                    .as_ref()
                    .and_then(|p| p.first())
                    .map(|p| Decimal::try_from(p.amount).unwrap_or_default())
                    .unwrap_or(price);

                ProductVariant {
                    id: v.id.clone(),
                    sku: Some(v.sku.unwrap_or_else(|| format!("VAR-{}", v.id))),
                    title: v.title.clone(),
                    price: variant_price.to_f64().unwrap_or(0.0),
                    quantity: v.inventory_quantity,
                    inventory: v.inventory_quantity,
                    attributes: {
                        let mut attrs = HashMap::new();
                        if let Some(title) = v.title {
                            attrs.insert("title".to_string(), title);
                        }
                        if let Some(metadata) = v.metadata {
                            for (key, value) in metadata {
                                attrs.insert(key, value.to_string());
                            }
                        }
                        attrs
                    },
                }
            })
            .collect();

        let mut attributes = HashMap::new();
        if let Some(handle) = product.handle.clone() {
            attributes.insert("handle".to_string(), handle);
        }

        let status_value = product
            .status
            .clone()
            .unwrap_or_else(|| "draft".to_string());
        attributes.insert("status".to_string(), status_value.clone());

        if let Some(categories) = product.categories {
            let category_names: Vec<String> = categories.iter().map(|c| c.name.clone()).collect();
            attributes.insert("categories".to_string(), category_names.join(","));
        }

        if let Some(metadata) = product.metadata {
            for (key, value) in metadata {
                // Convert JSON value to string
                let value_str = match value {
                    serde_json::Value::String(s) => s,
                    other => other.to_string(),
                };
                attributes.insert(key, value_str);
            }
        }

        PlatformProduct {
            id: product.id,
            platform_id: Some("medusa".to_string()),
            title: product.title,
            description: product.description,
            sku: Some(sku),
            price: price.to_f64().unwrap_or(0.0),
            currency,
            quantity: None,
            images,
            status: if status_value == "published" {
                "active".to_string()
            } else {
                "inactive".to_string()
            },
            attributes,
            variants,
            created_at: None,
            updated_at: None,
        }
    }
}
