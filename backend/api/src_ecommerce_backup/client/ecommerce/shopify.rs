/// Shopify E-commerce Platform Gateway
///
/// ไฟล์นี้เป็น gateway สำหรับการเชื่อมต่อกับ Shopify API
/// รองรับ OAuth 2.0 authentication และ product management
///
/// # คุณสมบัติ
/// - OAuth 2.0 flow (authorization code และ access token)
/// - Product list และ product detail fetching
/// - Inventory synchronization
/// - Support สำหรับ Shopify Admin API v2024-01
///
/// # หมายเหตุ
/// - Shopify access tokens ไม่มีวันหมดอายุ
/// - ต้องการ shop domain เพื่อสร้าง API URLs
/// - รองรับ scopes: read_products, write_products, read_inventory
use chrono::Utc;
use reqwest::{Client, StatusCode};
use url::Url;

use serde::{Deserialize, Serialize};

use super::RefreshTokenResponse;
use crate::config::PlatformCredentials;
use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::Category;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};

/// Shopify Gateway - จัดการการเชื่อมต่อกับ Shopify Admin API
pub struct ShopifyGateway {
    /// Platform credentials สำหรับ OAuth และ API calls
    credentials: PlatformCredentials,
    /// HTTP client สำหรับ API requests
    client: Client,
    /// Frontend URL for OAuth callbacks
    frontend_url: String,
    /// Shopify shop domain (e.g., example.myshopify.com)
    shop_domain: Option<String>,
}

impl ShopifyGateway {
    /// สร้าง instance ใหม่ของ ShopifyGateway
    ///
    /// # Parameters
    /// - `credentials`: การตั้งค่าสำหรับเชื่อมต่อ Shopify API
    pub fn new(credentials: PlatformCredentials) -> Self {
        Self::with_frontend_url(credentials, "https://app.lodashventure.local".to_string())
    }

    /// สร้าง instance ใหม่ของ ShopifyGateway with custom frontend URL
    pub fn with_frontend_url(credentials: PlatformCredentials, frontend_url: String) -> Self {
        let shop_domain = Self::derive_shop_domain(&credentials);
        Self {
            credentials,
            client: Client::new(),
            frontend_url,
            shop_domain,
        }
    }

    /// สร้าง instance ใหม่ของ ShopifyGateway พร้อมกำหนด shop domain ล่วงหน้า
    pub fn with_shop_domain(
        mut credentials: PlatformCredentials,
        frontend_url: String,
        shop_domain: String,
    ) -> Self {
        // ปิดช่องว่าง: เก็บ shop domain ลงใน credentials เพื่อให้ส่วนอื่น reuse ได้
        credentials.store_id = Some(shop_domain.clone());

        // เตรียม URLs เฉพาะร้าน
        let authorize_url =
            Self::resolve_authorize_url(credentials.oauth_authorize_url.as_ref(), &shop_domain);
        let token_url = Self::resolve_token_url(credentials.oauth_token_url.as_ref(), &shop_domain);
        let api_base_url = Self::resolve_api_base_url(&credentials.api_base_url, &shop_domain);

        credentials.oauth_authorize_url = Some(authorize_url);
        credentials.oauth_token_url = Some(token_url);
        credentials.api_base_url = api_base_url;

        let mut gateway = Self::with_frontend_url(credentials, frontend_url);
        gateway.shop_domain = Some(shop_domain);
        gateway
    }

    /// ปรับแต่ง input ให้เป็น shop domain ที่ถูกต้อง เช่น my-store.myshopify.com
    pub fn normalize_shop_domain(input: &str) -> AppResult<String> {
        let trimmed = input.trim();
        if trimmed.is_empty() {
            return Err(AppError::BadRequest(
                "Shopify shop_domain must not be empty".to_string(),
            ));
        }

        // ลอง parse เป็น URL เพื่อดึง host ออกมา ถ้าไม่มี scheme ให้เติม https://
        let candidate = if trimmed.contains("://") {
            trimmed.to_string()
        } else {
            format!("https://{}", trimmed.trim_start_matches("://"))
        };

        let host = Url::parse(&candidate)
            .ok()
            .and_then(|url| url.host_str().map(|s| s.to_string()))
            .unwrap_or_else(|| trimmed.to_string());

        // Remove any trailing path segments or query (if not parsed)
        let host = host
            .split('/')
            .next()
            .unwrap_or(&host)
            .trim()
            .to_lowercase();

        if host.is_empty() {
            return Err(AppError::BadRequest(
                "Unable to determine Shopify shop domain".to_string(),
            ));
        }

        let domain = if host.ends_with(".myshopify.com") {
            host
        } else if !host.contains('.') {
            format!("{}.myshopify.com", host)
        } else {
            return Err(AppError::BadRequest(format!(
                "Invalid Shopify domain '{}'. Use the myshopify.com domain for admin OAuth.",
                input
            )));
        };

        if !domain
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' || c == '-')
        {
            return Err(AppError::BadRequest(format!(
                "Shopify domain contains invalid characters: {}",
                input
            )));
        }

        Ok(domain)
    }

    fn derive_shop_domain(credentials: &PlatformCredentials) -> Option<String> {
        if let Some(store_id) = &credentials.store_id {
            if let Ok(domain) = Self::normalize_shop_domain(store_id) {
                return Some(domain);
            }
        }

        if !credentials.api_base_url.is_empty() {
            if let Some(domain) = Self::extract_domain(&credentials.api_base_url) {
                if let Ok(domain) = Self::normalize_shop_domain(&domain) {
                    return Some(domain);
                }
            }
        }

        if let Some(authorize) = &credentials.oauth_authorize_url {
            if let Some(domain) = Self::extract_domain(authorize) {
                if let Ok(domain) = Self::normalize_shop_domain(&domain) {
                    return Some(domain);
                }
            }
        }

        None
    }

    fn extract_domain(url_str: &str) -> Option<String> {
        Url::parse(url_str)
            .ok()
            .and_then(|url| url.host_str().map(|host| host.to_string()))
            .or_else(|| {
                if url_str.contains("://") {
                    None
                } else {
                    // Treat as host if there's no scheme
                    Some(
                        url_str
                            .split('/')
                            .next()
                            .unwrap_or(url_str)
                            .trim()
                            .to_string(),
                    )
                }
            })
    }

    fn replace_shop_placeholder(template: &str, shop_domain: &str) -> String {
        template
            .replace("{{shop}}", shop_domain)
            .replace("{{ shop }}", shop_domain)
            .replace("{{shop_domain}}", shop_domain)
            .replace("{shop}", shop_domain)
            .replace("{shop_domain}", shop_domain)
    }

    fn resolve_authorize_url(template: Option<&String>, shop_domain: &str) -> String {
        template
            .map(|tpl| {
                let replaced = Self::replace_shop_placeholder(tpl, shop_domain);
                if replaced.contains('{') || replaced.contains("{{") {
                    format!("https://{}/admin/oauth/authorize", shop_domain)
                } else {
                    replaced
                }
            })
            .unwrap_or_else(|| format!("https://{}/admin/oauth/authorize", shop_domain))
    }

    fn resolve_token_url(template: Option<&String>, shop_domain: &str) -> String {
        template
            .map(|tpl| {
                let replaced = Self::replace_shop_placeholder(tpl, shop_domain);
                if replaced.contains('{') || replaced.contains("{{") {
                    format!("https://{}/admin/oauth/access_token", shop_domain)
                } else {
                    replaced
                }
            })
            .unwrap_or_else(|| format!("https://{}/admin/oauth/access_token", shop_domain))
    }

    fn resolve_api_base_url(template: &str, shop_domain: &str) -> String {
        if template.is_empty() {
            let version = Self::default_api_version();
            return format!("https://{}/admin/api/{}", shop_domain, version);
        }

        let replaced = Self::replace_shop_placeholder(template, shop_domain);

        if (replaced.contains('{') || replaced.contains("{{"))
            || Self::extract_domain(&replaced)
                .map(|domain| domain != shop_domain)
                .unwrap_or(true)
        {
            let version =
                Self::extract_api_version(template).unwrap_or_else(Self::default_api_version);
            return format!("https://{}/admin/api/{}", shop_domain, version);
        }

        replaced
    }

    fn extract_api_version(api_base_url: &str) -> Option<String> {
        api_base_url
            .split("/admin/api/")
            .nth(1)
            .and_then(|rest| rest.split('/').next())
            .filter(|segment| !segment.is_empty())
            .map(|s| s.to_string())
    }

    fn default_api_version() -> String {
        "2024-01".to_string()
    }

    fn require_shop_domain(&self) -> AppResult<String> {
        if let Some(domain) = &self.shop_domain {
            return Ok(domain.clone());
        }

        if let Some(domain) = Self::derive_shop_domain(&self.credentials) {
            return Ok(domain);
        }

        Err(AppError::BadRequest(
            "Shopify shop domain is not configured. Provide shop_domain via connect query or credentials."
                .to_string(),
        ))
    }
}

// #[async_trait]
// TODO: อัพเดทให้ตรงกับ PlatformGateway trait ใหม่
// Methods ต่อไปนี้ต้องปรับให้ตรงกับ PlatformGateway trait ใหม่
impl ShopifyGateway {
    /// ส่งคืนชื่อแพลตฟอร์ม
    pub fn platform_name(&self) -> &str {
        "shopify"
    }

    pub fn get_oauth_url(&self, state: &str) -> String {
        let shop_domain = match self.require_shop_domain() {
            Ok(domain) => domain,
            Err(err) => {
                tracing::error!("Shopify OAuth URL generation failed: {}", err);
                "your-shop.myshopify.com".to_string()
            }
        };
        let scopes = "read_products,write_products,read_inventory";

        // Get the proper OAuth redirect URL using the centralized logic
        let redirect_uri = self.credentials.get_gateway_callback_url("shopify");

        let authorize_url = Self::resolve_authorize_url(
            self.credentials.oauth_authorize_url.as_ref(),
            &shop_domain,
        );

        let mut params = vec![
            ("client_id".to_string(), self.credentials.app_key.clone()),
            ("scope".to_string(), scopes.to_string()),
            ("redirect_uri".to_string(), redirect_uri),
            ("state".to_string(), state.to_string()),
        ];

        params.push(("grant_options[]".to_string(), "per-user".to_string()));

        let query = serde_urlencoded::to_string(&params).unwrap_or_default();

        format!("{}?{}", authorize_url.trim_end_matches('?'), query)
    }

    pub async fn exchange_code_for_token(&self, code: &str) -> AppResult<(String, String, i64)> {
        let (access_token, refresh_token) = self.exchange_code(code, "").await?;
        Ok((access_token, refresh_token, 0)) // Shopify tokens don't expire
    }

    pub async fn refresh_access_token(
        &self,
        refresh_token: &str,
    ) -> AppResult<RefreshTokenResponse> {
        // Shopify access tokens don't expire
        Ok(RefreshTokenResponse {
            access_token: refresh_token.to_string(),
            refresh_token: Some(refresh_token.to_string()),
            expires_in: Some(0),
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

    /// Test the Shopify connection by fetching a single product
    pub async fn test_connection(&self) -> AppResult<serde_json::Value> {
        use serde_json::json;

        // For Shopify, we'll use the access token from credentials
        let access_token = if !self.credentials.api_key.is_empty() {
            &self.credentials.api_key
        } else {
            return Err(AppError::ExternalApiError(
                "No access token available for Shopify connection test".to_string(),
            ));
        };

        // Try to fetch one product to test the connection
        match self.list_products(access_token, 1, 1).await {
            Ok(products) => Ok(json!({
                "connected": true,
                "api_version": "2024-01",
                "store_url": self.credentials.api_base_url,
                "test_result": {
                    "products_accessible": true,
                    "sample_product": products.first()
                }
            })),
            Err(e) => Err(e),
        }
    }

    async fn exchange_code(&self, code: &str, _state: &str) -> AppResult<(String, String)> {
        self.exchange_code_for_tokens(code, "").await
    }

    pub async fn exchange_code_for_tokens(
        &self,
        code: &str,
        _redirect_uri: &str,
    ) -> AppResult<(String, String)> {
        let shop_domain = self.require_shop_domain()?;

        #[derive(Serialize)]
        struct TokenRequest {
            client_id: String,
            client_secret: String,
            code: String,
            redirect_uri: String,
        }

        #[derive(Deserialize)]
        #[allow(dead_code)]
        struct TokenResponse {
            access_token: String,
            scope: String,
        }

        let request = TokenRequest {
            client_id: self.credentials.app_key.clone(),
            client_secret: self.credentials.app_secret.clone(),
            code: code.to_string(),
            redirect_uri: self.credentials.get_gateway_callback_url("shopify"),
        };

        // Use configured OAuth token URL or fall back to default
        let token_url =
            Self::resolve_token_url(self.credentials.oauth_token_url.as_ref(), &shop_domain);

        let response = self
            .client
            .post(&token_url)
            .form(&request)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("Shopify token exchange failed: {}", e))
            })?;

        if response.status() != StatusCode::OK {
            return Err(AppError::ExternalApiError(format!(
                "Shopify token exchange failed with status: {}",
                response.status()
            )));
        }

        let token_response: TokenResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse token response: {}", e))
        })?;

        // Shopify doesn't use refresh tokens
        Ok((
            token_response.access_token.clone(),
            token_response.access_token,
        ))
    }

    async fn refresh_token(&self, refresh_token: &str) -> AppResult<(String, String)> {
        self.refresh_oauth_token(refresh_token).await
    }

    async fn refresh_oauth_token(&self, refresh_token: &str) -> AppResult<(String, String)> {
        // Shopify access tokens don't expire, so refresh is a no-op
        Ok((refresh_token.to_string(), refresh_token.to_string()))
    }

    async fn revoke_oauth_token(&self, _token: &str) -> AppResult<()> {
        // Shopify doesn't provide a token revocation endpoint
        // The token is revoked when the app is uninstalled
        Ok(())
    }

    async fn list_products(
        &self,
        access_token: &str,
        page: u32,
        limit: u32,
    ) -> AppResult<Vec<Product>> {
        let shop_domain = self.require_shop_domain()?;
        let api_base = Self::resolve_api_base_url(&self.credentials.api_base_url, &shop_domain);
        let products_endpoint = format!("{}/products.json", api_base.trim_end_matches('/'));

        #[derive(Deserialize)]
        struct ProductResponse {
            products: Vec<ShopifyProduct>,
        }

        #[derive(Deserialize)]
        struct ShopifyProduct {
            id: i64,
            title: String,
            body_html: Option<String>,
            vendor: Option<String>,
            product_type: Option<String>,
            tags: String,
            variants: Vec<ShopifyVariant>,
            images: Vec<ShopifyImage>,
            status: String,
        }

        #[derive(Deserialize)]
        #[allow(dead_code)]
        struct ShopifyVariant {
            id: i64,
            sku: Option<String>,
            price: String,
            inventory_quantity: Option<i32>,
        }

        #[derive(Deserialize)]
        struct ShopifyImage {
            src: String,
        }

        let response = self
            .client
            .get(&products_endpoint)
            .header("X-Shopify-Access-Token", access_token)
            .query(&[("page", page.to_string()), ("limit", limit.to_string())])
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("Shopify list products failed: {}", e))
            })?;

        if response.status() != StatusCode::OK {
            return Err(AppError::ExternalApiError(format!(
                "Shopify list products failed with status: {}",
                response.status()
            )));
        }

        let product_response: ProductResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse products response: {}", e))
        })?;

        let domain_for_products = shop_domain.clone();

        let products = product_response
            .products
            .into_iter()
            .map(|p| {
                let variant = p.variants.first();
                let price_amount = variant
                    .and_then(|v| v.price.parse::<f64>().ok())
                    .unwrap_or(0.0);
                let quantity = variant.and_then(|v| v.inventory_quantity).unwrap_or(0) as i16;
                let sku = variant.and_then(|v| v.sku.clone()).unwrap_or_default();

                let images = p
                    .images
                    .into_iter()
                    .enumerate()
                    .map(|(i, img)| ProductImage {
                        url: img.src,
                        alt: None,
                        is_primary: i == 0,
                        position: i as i32,
                    })
                    .collect();

                Product {
                    product_id: p.id.to_string(),
                    shop_id: domain_for_products.clone(),
                    platform_shop_id: domain_for_products.clone(),
                    platform: PlatformType::Shopify,
                    platform_product_id: p.id.to_string(),
                    sku,
                    title: p.title,
                    brand: p.vendor.unwrap_or_default(),
                    description: p.body_html,
                    price: Price {
                        amount: rust_decimal::Decimal::from_f64_retain(price_amount)
                            .unwrap_or_default(),
                        currency: "USD".to_string(),
                        original_price: None,
                        discount_percentage: None,
                    },
                    currency: "USD".to_string(),
                    quantity,
                    images,
                    categories: p.tags.split(',').map(|s| s.trim().to_string()).collect(),
                    attributes: {
                        let mut attrs = std::collections::HashMap::new();
                        if let Some(product_type) = p.product_type {
                            attrs.insert("product_type".to_string(), product_type);
                        }
                        attrs
                    },
                    status: if p.status == "active" {
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

    async fn get_product(&self, _access_token: &str, _product_id: &str) -> AppResult<Product> {
        Err(AppError::ExternalApiError("Product not found".to_string()))
    }

    async fn sync_inventory(&self, access_token: &str) -> AppResult<Vec<Product>> {
        self.list_products(access_token, 1, 250).await
    }
}
