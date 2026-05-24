/// ไฟล์ zoho.rs - Zoho Commerce Platform Gateway
/// เชื่อมต่อกับ Zoho Commerce API สำหรับการจัดการสินค้าและ e-commerce business
/// ใช้ OAuth 2.0 authentication พร้อม tenant-based access control
/// รองรับการจัดการสินค้า, inventory, orders และ customer management
use super::RefreshTokenResponse;
use crate::config::PlatformCredentials;
use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::{
    Category, PlatformType, Price, Product, ProductImage, ProductStatus, ProductVariant,
};
use chrono::Utc;
use reqwest::{Client, StatusCode};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_urlencoded;
use std::collections::HashMap;
pub struct ZohoGateway {
    credentials: PlatformCredentials,
    client: Client,
    tenant_id: String,
}

impl ZohoGateway {
    pub fn new(credentials: PlatformCredentials, tenant_id: String) -> Self {
        Self {
            credentials,
            client: Client::new(),
            tenant_id,
        }
    }
}

// #[async_trait]
// TODO: Update to match new PlatformGateway trait
// The following methods need to be updated to match the new PlatformGateway trait
impl ZohoGateway {
    pub fn platform_name(&self) -> &str {
        "zoho"
    }

    pub fn get_oauth_url(&self, state: &str) -> String {
        let base_url = self
            .credentials
            .oauth_authorize_url
            .clone()
            .unwrap_or_else(|| "https://accounts.zoho.com/oauth/v2/auth".to_string());

        let redirect_uri = self
            .credentials
            .get_gateway_callback_url(self.platform_name());

        let scope = std::env::var("ZOHO_OAUTH_SCOPES")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "ZohoCommerce.items.READ".to_string());

        let mut params = vec![
            ("response_type".to_string(), "code".to_string()),
            ("client_id".to_string(), self.credentials.app_key.clone()),
            ("redirect_uri".to_string(), redirect_uri),
            ("scope".to_string(), scope),
            ("access_type".to_string(), "offline".to_string()),
            ("prompt".to_string(), "consent".to_string()),
            ("state".to_string(), state.to_string()),
        ];

        if !self.tenant_id.is_empty() {
            params.push(("org_id".to_string(), self.tenant_id.clone()));
        }

        let query_string = serde_urlencoded::to_string(&params).unwrap_or_else(|_| String::new());

        format!("{}?{}", base_url.trim_end_matches('?'), query_string)
    }

    pub async fn exchange_code_for_token(&self, code: &str) -> AppResult<(String, String, i64)> {
        self.exchange_code(code, None).await
    }

    pub async fn exchange_code_for_token_with_server(
        &self,
        code: &str,
        accounts_server: Option<&str>,
    ) -> AppResult<(String, String, i64)> {
        self.exchange_code(code, accounts_server).await
    }

    pub async fn refresh_access_token(
        &self,
        refresh_token: &str,
    ) -> AppResult<RefreshTokenResponse> {
        let (access_token, new_refresh_token, expires_in) =
            self.refresh_token(refresh_token).await?;
        Ok(RefreshTokenResponse {
            access_token,
            refresh_token: Some(new_refresh_token),
            expires_in,
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

    async fn exchange_code(
        &self,
        code: &str,
        accounts_server: Option<&str>,
    ) -> AppResult<(String, String, i64)> {
        #[derive(Serialize)]
        struct TokenRequest {
            grant_type: String,
            client_id: String,
            client_secret: String,
            redirect_uri: String,
            code: String,
        }

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
            #[serde(default)]
            refresh_token: Option<String>,
            expires_in: i64,
            api_domain: Option<String>,
            token_type: Option<String>,
        }

        let request = TokenRequest {
            grant_type: "authorization_code".to_string(),
            client_id: self.credentials.app_key.clone(),
            client_secret: self.credentials.app_secret.clone(),
            redirect_uri: self
                .credentials
                .get_gateway_callback_url(self.platform_name()),
            code: code.to_string(),
        };

        let token_url = self.resolve_token_endpoint(accounts_server);

        let response = self
            .client
            .post(&token_url)
            .form(&request)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("Zoho token exchange failed: {}", e))
            })?;

        if response.status() != StatusCode::OK {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Zoho token exchange failed: {}",
                error_text
            )));
        }

        let token_response: TokenResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse token response: {}", e))
        })?;

        let refresh_token = token_response.refresh_token.ok_or_else(|| {
            AppError::ExternalApiError(
                "Zoho token exchange response missing refresh_token".to_string(),
            )
        })?;

        Ok((
            token_response.access_token,
            refresh_token,
            token_response.expires_in,
        ))
    }

    fn resolve_token_endpoint(&self, accounts_server: Option<&str>) -> String {
        if let Some(server) = accounts_server {
            if server.contains("/oauth/") {
                return server.to_string();
            }
            let base = server.trim_end_matches('/');
            return format!("{}/oauth/v2/token", base);
        }
        self.credentials
            .oauth_token_url
            .clone()
            .unwrap_or_else(|| "https://accounts.zoho.com/oauth/v2/token".to_string())
    }

    async fn refresh_token(&self, refresh_token: &str) -> AppResult<(String, String, Option<i64>)> {
        #[derive(Serialize)]
        struct RefreshRequest {
            refresh_token: String,
            client_id: String,
            client_secret: String,
            grant_type: String,
        }

        #[derive(Deserialize)]
        struct RefreshResponse {
            access_token: String,
            expires_in: Option<i64>,
            api_domain: Option<String>,
            token_type: Option<String>,
        }

        let request = RefreshRequest {
            refresh_token: refresh_token.to_string(),
            client_id: self.credentials.app_key.clone(),
            client_secret: self.credentials.app_secret.clone(),
            grant_type: "refresh_token".to_string(),
        };

        let token_url = self.resolve_token_endpoint(None);

        let response = self
            .client
            .post(&token_url)
            .form(&request)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Zoho token refresh failed: {}", e)))?;

        if response.status() != StatusCode::OK {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Zoho token refresh failed: {}",
                error_text
            )));
        }

        let refresh_response: RefreshResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse refresh response: {}", e))
        })?;

        // Return the new access token and the same refresh token
        Ok((
            refresh_response.access_token,
            refresh_token.to_string(),
            refresh_response.expires_in,
        ))
    }

    async fn list_products(
        &self,
        access_token: &str,
        page: u32,
        limit: u32,
    ) -> AppResult<Vec<Product>> {
        #[derive(Deserialize)]
        struct ProductsResponse {
            code: i32,
            message: String,
            products: Option<Vec<ZohoProduct>>,
            page_context: Option<PageContext>,
        }

        #[derive(Deserialize)]
        struct ZohoProduct {
            #[serde(rename = "product_id")]
            product_id: String,
            name: String,
            status: String,
            min_rate: Option<f64>,

            description: Option<String>,

            categories: Option<Vec<String>>,
        }

        #[derive(Deserialize)]
        struct ZohoVariant {
            variant_product_id: String,
            name: String,
            rate: f64,
            stock_on_hand: Option<i32>,
            sku: Option<String>,
        }

        #[derive(Deserialize)]
        struct PageContext {
            page: i32,
            per_page: i32,
            has_more_page: bool,
        }

        let url = format!(
            "https://commerce.zoho.com/store/api/v1/products?page={}&per_page={}",
            page + 1, // Zoho uses 1-based page indexing
            limit
        );

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Zoho-oauthtoken {}", access_token))
            .header("X-com-zoho-store-organizationid", &self.tenant_id)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to fetch products: {}", e)))?;

        if response.status() != StatusCode::OK {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Failed to fetch products: {}",
                error_text
            )));
        }

        let products_response: ProductsResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse products response: {}", e))
        })?;

        if products_response.code != 0 {
            return Err(AppError::ExternalApiError(format!(
                "Zoho API error: {}",
                products_response.message
            )));
        }

        let products = products_response
            .products
            .unwrap_or_default()
            .into_iter()
            .map(|p| {
                let (price, sku, stock_quantity) = (p.min_rate.unwrap_or(0.0), String::new(), None);

                let variants: Vec<ProductVariant> = vec![];

                Product {
                    product_id: format!("zoho_{}", p.product_id),
                    platform_product_id: p.product_id.clone(),
                    shop_id: "".to_string(),
                    platform_shop_id: "".to_string(),
                    platform: PlatformType::Zoho,
                    title: p.name,
                    brand: "".to_string(),
                    description: Some(p.description.unwrap_or_default()),
                    price: Price {
                        amount: Decimal::from_f64_retain(price).unwrap_or(Decimal::ZERO),
                        currency: "USD".to_string(),
                        original_price: None,
                        discount_percentage: None,
                    },
                    currency: "USD".to_string(),
                    images: vec![], // Zoho doesn't return images in the list API
                    sku,
                    quantity: stock_quantity.unwrap_or(0),
                    status: match p.status.as_str() {
                        "active" => ProductStatus::Active,
                        "inactive" => ProductStatus::Inactive,
                        _ => ProductStatus::Inactive,
                    },
                    categories: p.categories.unwrap_or_default(),
                    attributes: {
                        let mut attrs = HashMap::new();
                        if !variants.is_empty() {
                            attrs.insert(
                                "variants".to_string(),
                                serde_json::to_string(&variants).unwrap_or_default(),
                            );
                        }
                        attrs
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
        struct ProductResponse {
            code: i32,
            message: String,
            product: Option<ZohoProduct>,
        }

        #[derive(Deserialize)]
        struct ZohoProduct {
            #[serde(rename = "product_id")]
            product_id: String,
            name: String,
            status: String,
            min_rate: Option<f64>,

            description: Option<String>,

            categories: Option<Vec<String>>,
            images: Option<Vec<ZohoImage>>,
        }

        #[derive(Deserialize)]
        struct ZohoVariant {
            variant_product_id: String,
            name: String,
            rate: f64,
            stock_on_hand: Option<i32>,
            sku: Option<String>,
        }

        #[derive(Deserialize)]
        struct ZohoImage {
            image_url: String,
            is_primary: bool,
        }

        let url = format!(
            "https://commerce.zoho.com/store/api/v1/products/{}",
            product_id
        );

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Zoho-oauthtoken {}", access_token))
            .header("X-com-zoho-store-organizationid", &self.tenant_id)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to fetch product: {}", e)))?;

        if response.status() != StatusCode::OK {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Failed to fetch product: {}",
                error_text
            )));
        }

        let product_response: ProductResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse product response: {}", e))
        })?;

        if product_response.code != 0 {
            return Err(AppError::ExternalApiError(format!(
                "Zoho API error: {}",
                product_response.message
            )));
        }

        let p = product_response
            .product
            .ok_or_else(|| AppError::ExternalApiError("Product not found".to_string()))?;

        let images = p
            .images
            .map(|imgs| {
                imgs.into_iter()
                    .enumerate()
                    .map(|(i, img)| ProductImage {
                        url: img.image_url,
                        alt: None,
                        is_primary: i == 0,
                        position: i as i32,
                    })
                    .collect()
            })
            .unwrap_or_default();

        let (price, sku, stock_quantity) = (p.min_rate.unwrap_or(0.0), String::new(), None);

        let variants: Vec<ProductVariant> = vec![];

        Ok(Product {
            product_id: format!("zoho_{}", p.product_id),
            platform_product_id: p.product_id.clone(),
            shop_id: "".to_string(),
            platform_shop_id: "".to_string(),
            platform: PlatformType::Zoho,
            title: p.name,
            brand: "".to_string(),
            description: Some(p.description.unwrap_or_default()),
            price: Price {
                amount: Decimal::from_f64_retain(price).unwrap_or(Decimal::ZERO),
                currency: "USD".to_string(),
                original_price: None,
                discount_percentage: None,
            },
            currency: "USD".to_string(),
            sku,
            quantity: stock_quantity.unwrap_or(0),
            images,
            categories: p.categories.unwrap_or_default(),
            attributes: {
                let mut attrs = HashMap::new();
                if !variants.is_empty() {
                    attrs.insert(
                        "variants".to_string(),
                        serde_json::to_string(&variants).unwrap_or_default(),
                    );
                }
                attrs
            },
            status: match p.status.as_str() {
                "active" => ProductStatus::Active,
                "inactive" => ProductStatus::Inactive,
                _ => ProductStatus::Inactive,
            },
            created_at: Utc::now(),
            updated_at: Utc::now(),
            synced_at: Some(chrono::Utc::now()),
        })
    }
}
