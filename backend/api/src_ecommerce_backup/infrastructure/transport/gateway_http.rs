//!  REST client for communicating with the gateway service.
//! Keeps request/response wiring in the transport layer so higher-level
//! services can stay focused on orchestration.

use std::time::Duration;

use anyhow::Result;
use async_trait::async_trait;
use reqwest::Client;
use serde_json::{json, Value};

use crate::{
    interfaces::{
        platform_gateway::{
            Credentials, ListProductParams, OAuthTokens, OAuthUrl, PlatformGateway, PlatformLimits,
            PlatformProduct, ProductList, RateLimit, ShopInfo,
        },
        InterfaceError, InterfaceResult,
    },
    model::error::AppResult,
};

/// HTTP client that proxies platform operations to the gateway service.
pub struct GatewayHttpClient {
    http_client: Client,
    gateway_url: String,
    platform: String,
    shop_id: Option<String>,
    credentials: Option<Credentials>,
}

impl GatewayHttpClient {
    /// Create a new REST client instance.
    pub fn new(
        platform: String,
        shop_id: Option<String>,
        credentials: Option<Credentials>,
    ) -> Self {
        let gateway_url =
            std::env::var("GATEWAY_SERVICE_URL").unwrap_or_else(|_| "http://localhost:8080".into());

        let http_client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            http_client,
            gateway_url,
            platform,
            shop_id,
            credentials,
        }
    }

    /// Execute an HTTP request against the gateway service.
    async fn request(&self, method: &str, path: &str, body: Option<Value>) -> AppResult<Value> {
        let url = format!(
            "{}/api/gateway/{}/{}",
            self.gateway_url, self.platform, path
        );

        let mut request = match method {
            "GET" => self.http_client.get(&url),
            "POST" => self.http_client.post(&url).json(&body),
            "PUT" => self.http_client.put(&url).json(&body),
            "DELETE" => self.http_client.delete(&url),
            _ => return Err(anyhow::anyhow!("Unsupported HTTP method: {}", method).into()),
        };

        if let Some(creds) = &self.credentials {
            if let Some(token) = &creds.access_token {
                request = request.header("X-Access-Token", token);
            }
            if let Some(key) = &creds.api_key {
                request = request.header("X-API-Key", key);
            }
            if let Some(secret) = &creds.api_secret {
                request = request.header("X-API-Secret", secret);
            }
            if let Some(store_url) = &creds.store_url {
                request = request.header("X-Store-Url", store_url);
            }

            if self.platform == "medusa" {
                if let Some(key) = &creds.api_key {
                    request = request.header("x-publishable-api-key", key);
                }
                if let Some(store_url) = &creds.store_url {
                    request = request.header("x-store-url", store_url);
                    request = request.header("x-base-url", store_url);
                }
                if let Some(token) = &creds.access_token {
                    let bearer = format!("Bearer {}", token);
                    request = request.header("Authorization", bearer);
                    request = request.header("x-api-token", token);
                }
            }
        }

        if let Some(shop_id) = &self.shop_id {
            request = request.header("X-Shop-Id", shop_id);
        }

        let response = request
            .send()
            .await
            .map_err(|e| anyhow::anyhow!("Gateway request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            return Err(
                anyhow::anyhow!("Gateway returned error: {} - {}", status, error_text).into(),
            );
        }

        response
            .json()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to parse response: {}", e).into())
    }

    pub async fn call_json(
        &self,
        method: &str,
        path: &str,
        body: Option<Value>,
    ) -> AppResult<Value> {
        self.request(method, path, body).await
    }
}

#[async_trait]
impl PlatformGateway for GatewayHttpClient {
    fn platform_id(&self) -> &str {
        &self.platform
    }

    fn platform_name(&self) -> &str {
        &self.platform
    }

    async fn init_oauth(&self, state: &str, redirect_uri: &str) -> InterfaceResult<OAuthUrl> {
        let body = json!({
            "state": state,
            "redirect_uri": redirect_uri,
            "shop_id": self.shop_id,
        });

        let response = self
            .request("POST", "oauth/init", Some(body))
            .await
            .map_err(|e| anyhow::anyhow!("OAuth init failed: {}", e))?;

        let url = response
            .get("authorization_url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing authorization_url in response"))?;

        Ok(OAuthUrl {
            url: url.to_string(),
            state: state.to_string(),
        })
    }

    async fn get_oauth_url(&self, state: &str) -> Result<String> {
        let oauth_url = self.init_oauth(state, "").await?;
        Ok(oauth_url.url)
    }

    async fn handle_oauth_callback(&self, code: &str, state: &str) -> InterfaceResult<OAuthTokens> {
        let body = json!({
            "code": code,
            "state": state,
        });

        let response = self
            .request("POST", "oauth/callback", Some(body))
            .await
            .map_err(|e| anyhow::anyhow!("OAuth callback failed: {}", e))?;

        let access_token = response
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing access_token"))?
            .to_string();

        let refresh_token = response
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let expires_at = response
            .get("expires_at")
            .and_then(|v| v.as_str())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc));

        let token_type = response
            .get("token_type")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        Ok(OAuthTokens {
            access_token,
            refresh_token,
            expires_at,
            token_type,
        })
    }

    async fn exchange_code_for_token(&self, code: &str) -> Result<(String, String)> {
        let tokens = self.handle_oauth_callback(code, "").await?;
        Ok((
            tokens.access_token,
            tokens.refresh_token.unwrap_or_default(),
        ))
    }

    async fn refresh_token(&self, refresh_token: &str) -> Result<(String, String)> {
        let body = json!({
            "refresh_token": refresh_token,
        });

        let response = self
            .request("POST", "oauth/refresh", Some(body))
            .await
            .map_err(|e| anyhow::anyhow!("Token refresh failed: {}", e))?;

        let access_token = response
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing access_token"))?
            .to_string();

        let refresh_token = response
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_default();

        Ok((access_token, refresh_token))
    }

    async fn refresh_tokens(&self, refresh_token: &str) -> InterfaceResult<OAuthTokens> {
        let body = json!({
            "refresh_token": refresh_token,
        });

        let response = self
            .request("POST", "oauth/refresh", Some(body))
            .await
            .map_err(|e| anyhow::anyhow!("Token refresh failed: {}", e))?;

        let access_token = response
            .get("access_token")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing access_token"))?
            .to_string();

        let refresh_token = response
            .get("refresh_token")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let expires_at = response
            .get("expires_at")
            .and_then(|v| v.as_str())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc));

        Ok(OAuthTokens {
            access_token,
            refresh_token,
            expires_at,
            token_type: response
                .get("token_type")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
        })
    }

    async fn list_products(&self, params: &ListProductParams) -> InterfaceResult<ProductList> {
        let body = json!({
            "page": params.page,
            "limit": params.limit,
            "offset": params.offset,
            "status": params.status,
            "search": params.search,
            "sort": params.sort,
            "shop_id": params.shop_id,
        });

        let response = self
            .request("POST", "products/list", Some(body))
            .await
            .map_err(|e| anyhow::anyhow!("List products failed: {}", e))?;

        let products = serde_json::from_value(response)
            .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;
        Ok(products)
    }

    async fn fetch_products(
        &self,
        access_token: &str,
        page: Option<u32>,
        limit: Option<u32>,
    ) -> Result<Vec<serde_json::Value>> {
        let body = json!({
            "access_token": access_token,
            "page": page,
            "limit": limit,
        });

        let response = self.request("POST", "products/fetch", Some(body)).await?;

        let products = response
            .get("products")
            .cloned()
            .unwrap_or_else(|| Value::Array(vec![]));

        Ok(serde_json::from_value(products)?)
    }

    async fn get_product(&self, product_id: &str) -> InterfaceResult<PlatformProduct> {
        let path = format!("products/{}", product_id);
        let response = self
            .request("GET", &path, None)
            .await
            .map_err(|e| anyhow::anyhow!("Get product failed: {}", e))?;

        let parsed = serde_json::from_value(response)
            .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;
        Ok(parsed)
    }

    async fn fetch_product_details(
        &self,
        access_token: &str,
        product_id: &str,
    ) -> Result<serde_json::Value> {
        let path = format!("products/{}/detail", product_id);
        let body = json!({ "access_token": access_token });

        let response = self
            .request("POST", &path, Some(body))
            .await
            .map_err(|e| anyhow::anyhow!("Fetch product detail failed: {}", e))?;

        Ok(response)
    }

    async fn create_product(&self, product: &PlatformProduct) -> InterfaceResult<String> {
        let payload = serde_json::to_value(product)
            .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;
        let response = self
            .request("POST", "products", Some(payload))
            .await
            .map_err(|e| anyhow::anyhow!("Create product failed: {}", e))?;

        let id = response
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing product id"))?
            .to_string();

        Ok(id)
    }

    async fn update_product(
        &self,
        product_id: &str,
        product: &PlatformProduct,
    ) -> InterfaceResult<()> {
        let path = format!("products/{}", product_id);
        let payload = serde_json::to_value(product)
            .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;
        self.request("PUT", &path, Some(payload))
            .await
            .map_err(|e| anyhow::anyhow!("Update product failed: {}", e))?;
        Ok(())
    }

    async fn upsert_product(
        &self,
        access_token: &str,
        product: serde_json::Value,
    ) -> Result<serde_json::Value> {
        let body = json!({
            "access_token": access_token,
            "product": product,
        });

        let response = self
            .request("POST", "products/upsert", Some(body))
            .await
            .map_err(|e| anyhow::anyhow!("Upsert product failed: {}", e))?;

        Ok(response)
    }

    async fn delete_product(&self, product_id: &str) -> InterfaceResult<()> {
        let path = format!("products/{}", product_id);
        self.request("DELETE", &path, None)
            .await
            .map_err(|e| anyhow::anyhow!("Delete product failed: {}", e))?;
        Ok(())
    }

    async fn get_shop_info(&self) -> InterfaceResult<ShopInfo> {
        let response = self
            .request("GET", "shop/info", None)
            .await
            .map_err(|e| anyhow::anyhow!("Get shop info failed: {}", e))?;

        let info = serde_json::from_value(response)
            .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;
        Ok(info)
    }

    async fn validate_credentials(&self) -> InterfaceResult<bool> {
        if self.platform == "lineshopping" {
            // For LINE MyShop, perform a lightweight product list call via the gateway
            // This ensures the API key is valid without relying on OAuth endpoints
            let path = "products?perPage=1";
            self.request("GET", path, None)
                .await
                .map_err(|err| InterfaceError::ConnectionError(err.to_string()))?;
            return Ok(true);
        }

        let response = self
            .request("POST", "oauth/validate", None)
            .await
            .map_err(|e| anyhow::anyhow!("Validate credentials failed: {}", e))?;

        Ok(response
            .get("valid")
            .and_then(|v| v.as_bool())
            .unwrap_or(false))
    }

    async fn get_limits(&self) -> InterfaceResult<PlatformLimits> {
        let response = self
            .request("GET", "limits", None)
            .await
            .map_err(|e| anyhow::anyhow!("Get limits failed: {}", e))?;

        let limits = serde_json::from_value(response)
            .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;
        Ok(limits)
    }

    async fn check_rate_limit(&self) -> InterfaceResult<RateLimit> {
        let response = self
            .request("GET", "limits/current", None)
            .await
            .map_err(|e| anyhow::anyhow!("Check rate limit failed: {}", e))?;

        let rate_limit = serde_json::from_value(response)
            .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;
        Ok(rate_limit)
    }
}
