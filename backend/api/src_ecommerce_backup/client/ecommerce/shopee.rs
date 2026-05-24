/// ไฟล์ shopee.rs - Shopee E-commerce Platform Gateway
/// เชื่อมต่อกับ Shopee Open Platform API
/// ใช้ HMAC-SHA256 สำหรับ request signing
/// รองรับ OAuth 2.0 และ product management
use chrono::Utc;
use hmac::{Hmac, Mac};
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

use super::RefreshTokenResponse;
use crate::config::PlatformCredentials;
use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::Category;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};
type HmacSha256 = Hmac<Sha256>;

/// Shopee Gateway - จัดการการเชื่อมต่อกับ Shopee API
/// ใช้ signature-based authentication
/// รองรับ multi-region operations
pub struct ShopeeGateway {
    credentials: PlatformCredentials, // Shopee app credentials
    client: Client,                   // HTTP client
    frontend_url: String,             // Frontend URL for OAuth callbacks
}

impl ShopeeGateway {
    /// สร้าง Shopee gateway instance ใหม่
    pub fn new(credentials: PlatformCredentials) -> Self {
        Self::with_frontend_url(credentials, "https://app.lodashventure.local".to_string())
    }

    /// สร้าง Shopee gateway instance ใหม่ with custom frontend URL
    pub fn with_frontend_url(credentials: PlatformCredentials, frontend_url: String) -> Self {
        Self {
            credentials,
            client: Client::new(),
            frontend_url,
        }
    }

    /// สร้าง signature สำหรับ Shopee API request
    /// ใช้ HMAC-SHA256 กับ format: partner_id (as integer) + path + timestamp (as integer)
    /// Return hex string ของ signature
    fn generate_signature(&self, partner_id: i64, path: &str, timestamp: i64) -> String {
        // Create base string for HMAC - partner_id and timestamp as integers
        let base_string = format!("{}{}{}", partner_id, path, timestamp);

        // Create HMAC-SHA256 signature using partner key
        let mut mac = HmacSha256::new_from_slice(self.credentials.app_secret.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(base_string.as_bytes());
        hex::encode(mac.finalize().into_bytes())
    }

    /// สร้าง signature สำหรับ authenticated endpoints ที่ต้องการ shop_id
    /// ใช้ HMAC-SHA256 กับ format: partner_id + path + timestamp + access_token + shop_id
    fn generate_auth_signature(
        &self,
        partner_id: i64,
        path: &str,
        timestamp: i64,
        access_token: &str,
        shop_id: i64,
    ) -> String {
        let base_string = format!(
            "{}{}{}{}{}",
            partner_id, path, timestamp, access_token, shop_id
        );

        let mut mac = HmacSha256::new_from_slice(self.credentials.app_secret.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(base_string.as_bytes());
        hex::encode(mac.finalize().into_bytes())
    }

    fn api_base_url(&self) -> &str {
        if self.credentials.api_base_url.contains("open.sandbox") {
            "https://openplatform.sandbox.test-stable.shopee.sg"
        } else {
            self.credentials.api_base_url.as_str()
        }
    }
}

// #[async_trait]
// TODO: Update to match new PlatformGateway trait
// The following methods need to be updated to match the new PlatformGateway trait
// Methods ต่อไปนี้ต้องปรับให้ตรงกับ PlatformGateway trait ใหม่
impl ShopeeGateway {
    /// ชื่อ platform
    pub fn platform_name(&self) -> &str {
        "shopee"
    }

    /// สร้าง OAuth URL สำหรับ shop authorization
    /// ใช้ timestamp และ signature สำหรับความปลอดภัย
    /// State parameter สำหรับป้องกัน CSRF
    pub fn get_oauth_url(&self, state: &str) -> String {
        let timestamp = Utc::now().timestamp();
        let partner_id: i64 = self.credentials.app_key.parse().unwrap_or(0);
        // Determine which authorization endpoint to use.
        // Shopee Sandbox V2 exposes https://open.sandbox.test-stable.shopee.{sg|cn}/auth
        // while production still relies on /api/v2/shop/auth_partner.
        let base_url = self
            .credentials
            .oauth_authorize_url
            .as_deref()
            .or(Some(self.credentials.api_base_url.as_str()))
            .unwrap_or("https://openplatform.sandbox.test-stable.shopee.sg");

        let normalized_base = base_url.trim_end_matches('/');
        let using_sandbox_portal =
            normalized_base.contains("open.sandbox") || normalized_base.contains("account.sandbox");

        let auth_path = if using_sandbox_portal {
            "/auth"
        } else {
            "/api/v2/shop/auth_partner"
        };
        let redirect_param = if using_sandbox_portal {
            "redirect_uri"
        } else {
            "redirect"
        };

        let sign = self.generate_signature(partner_id, auth_path, timestamp);

        // Parse the state to extract org_id and user_id for path parameters
        // State contains the UUID but we also stored org_id and user_id in Redis
        // We'll encode tenant info directly in the redirect path
        let mut requested_auth_type: Option<String> = None;
        let (org_id, user_id, shop_id_ctx, state_uuid) = if state.contains('{') {
            // Try to parse as JSON
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(state) {
                let extracted_org_id = parsed
                    .get("org_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("default")
                    .to_string();
                let extracted_user_id = parsed
                    .get("user_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("default")
                    .to_string();
                let extracted_state = parsed
                    .get("state")
                    .and_then(|v| v.as_str())
                    .unwrap_or(state)
                    .to_string();
                let extracted_shop_id = parsed
                    .get("shop_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                requested_auth_type = parsed
                    .get("auth_type")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                tracing::info!(
                    "Shopee OAuth - Parsed state JSON: org_id={}, user_id={}, state={}",
                    extracted_org_id,
                    extracted_user_id,
                    extracted_state
                );

                (
                    extracted_org_id,
                    extracted_user_id,
                    extracted_shop_id,
                    extracted_state,
                )
            } else {
                tracing::warn!("Failed to parse state as JSON: {}", state);
                (
                    "default".to_string(),
                    "default".to_string(),
                    String::new(),
                    state.to_string(),
                )
            }
        } else {
            // State is just UUID, but we need org_id and user_id
            // They should have been passed in the original request
            // For now we'll use state as UUID
            tracing::warn!("State is not JSON, using defaults: {}", state);
            (
                "default".to_string(),
                "default".to_string(),
                String::new(),
                state.to_string(),
            )
        };

        // Build redirect URI with tenant info in path
        // Format: /api/v1/where_on_sales/gateway/ecommerce/shopee/callback/{org_id}/{user_id}
        let base_redirect = self.credentials.redirect_uri.as_deref()
            .unwrap_or("https://api.lodashventure.local/api/v1/where_on_sales/gateway/ecommerce/shopee/callback");

        // Ensure base_redirect doesn't already have org_id/user_id appended
        // Check if the redirect URI already contains path segments after /callback/
        let redirect_uri = if base_redirect.ends_with("/callback") {
            // No path params yet, append shop_id (internal) and org_id
            format!(
                "{}/{}/{}",
                base_redirect,
                if shop_id_ctx.is_empty() {
                    org_id.clone()
                } else {
                    shop_id_ctx.clone()
                },
                org_id
            )
        } else if base_redirect.contains("/callback/") {
            // Check if it already has valid org_id/user_id or placeholder values
            let parts: Vec<&str> = base_redirect.split("/callback/").collect();
            if parts.len() > 1 {
                let path_params = parts[1];
                // If path params contain "shopee" or look like placeholders, replace them
                if path_params.contains("shopee")
                    || path_params == "org_id/user_id"
                    || path_params.starts_with("default")
                {
                    // Replace the placeholder values with actual org_id and user_id
                    format!(
                        "{}/callback/{}/{}",
                        parts[0],
                        if shop_id_ctx.is_empty() {
                            org_id.clone()
                        } else {
                            shop_id_ctx.clone()
                        },
                        org_id
                    )
                } else {
                    // Keep existing path params
                    base_redirect.to_string()
                }
            } else {
                format!(
                    "{}/{}/{}",
                    base_redirect,
                    if shop_id_ctx.is_empty() {
                        org_id.clone()
                    } else {
                        shop_id_ctx.clone()
                    },
                    org_id
                )
            }
        } else {
            format!(
                "{}/{}/{}",
                base_redirect,
                if shop_id_ctx.is_empty() {
                    org_id.clone()
                } else {
                    shop_id_ctx.clone()
                },
                org_id
            )
        };

        // Debug logging to understand what's being used
        tracing::info!(
            "Shopee OAuth URL - redirect_uri: {}, org_id: {}, user_id: {}, state: {}",
            redirect_uri,
            org_id,
            user_id,
            state_uuid
        );

        // Note: Shopee doesn't actually use the state parameter in the response
        // So we embed tenant info in the redirect URI path instead
        let auth_type = requested_auth_type
            .as_deref()
            .unwrap_or("seller")
            .to_string();

        let mut auth_url = format!(
            "{}{}?auth_type={}&partner_id={}&timestamp={}&sign={}&{}={}",
            normalized_base,
            auth_path,
            auth_type,
            partner_id,
            timestamp,
            sign,
            redirect_param,
            urlencoding::encode(&redirect_uri)
        );

        auth_url.push_str("&response_type=code");
        auth_url.push_str("&state=");
        auth_url.push_str(&urlencoding::encode(&state_uuid));

        if let Some(market) = &self.credentials.market {
            if !market.trim().is_empty() {
                auth_url.push_str("&shop_region=");
                auth_url.push_str(&market.trim().to_uppercase());
            }
        }

        auth_url
    }

    /// แลกเปลี่ยน authorization code เป็น access token
    /// Return (access_token, refresh_token, expires_in)
    /// Default expiry 4 hours (14400 seconds)
    pub async fn exchange_code_for_token(&self, code: &str) -> AppResult<(String, String, i64)> {
        self.exchange_code_for_token_with_shop_id(code, None).await
    }

    /// แลกเปลี่ยน authorization code เป็น access token with shop_id
    /// Shopee requires shop_id parameter for token exchange
    /// Return (access_token, refresh_token, expires_in)
    pub async fn exchange_code_for_token_with_shop_id(
        &self,
        code: &str,
        shop_id: Option<i64>,
    ) -> AppResult<(String, String, i64)> {
        self.exchange_code_for_token_internal(code, shop_id, None)
            .await
    }

    /// แลกเปลี่ยน authorization code เป็น access token with main_account_id
    /// For main account level authorization
    /// Return (access_token, refresh_token, expires_in)
    pub async fn exchange_code_for_token_with_main_account(
        &self,
        code: &str,
        main_account_id: i64,
    ) -> AppResult<(String, String, i64)> {
        self.exchange_code_for_token_internal(code, None, Some(main_account_id))
            .await
    }

    /// Internal method for token exchange
    async fn exchange_code_for_token_internal(
        &self,
        code: &str,
        shop_id: Option<i64>,
        main_account_id: Option<i64>,
    ) -> AppResult<(String, String, i64)> {
        let timestamp = Utc::now().timestamp();
        let path = "/api/v2/auth/token/get";

        // Log current time for debugging
        tracing::info!(
            "Current UTC timestamp: {}, datetime: {}",
            timestamp,
            Utc::now().to_rfc3339()
        );

        // Parse partner_id as i64 for consistency
        let partner_id: i64 = self.credentials.app_key.parse().map_err(|_| {
            AppError::ConfigError(format!("Invalid partner_id: {}", self.credentials.app_key))
        })?;

        // According to Shopee documentation, signature for /api/v2/auth/token/get only needs basic signature
        // The shop_id is passed in the request body, not in the signature
        // Base string format: partner_id + path + timestamp (as per Shopee API v2 documentation)
        let base_string = format!("{}{}{}", partner_id, path, timestamp);

        tracing::info!(
            "Shopee token exchange - partner_id: {}, path: {}, timestamp: {}, base_string: '{}', partner_key_len: {}",
            partner_id,
            path,
            timestamp,
            base_string,
            self.credentials.app_secret.len()
        );

        // Log shop_id if provided for debugging
        if let Some(sid) = shop_id {
            tracing::info!("Shop ID provided for token exchange: {}", sid);
        }
        if let Some(mid) = main_account_id {
            tracing::info!("Main account ID provided for token exchange: {}", mid);
        }

        let sign = self.generate_signature(partner_id, path, timestamp);

        tracing::info!(
            "Generated signature: {}, API base URL: {}",
            sign,
            self.api_base_url()
        );

        #[derive(Serialize)]
        struct TokenRequest {
            code: String,
            partner_id: i64,
            #[serde(skip_serializing_if = "Option::is_none")]
            shop_id: Option<i64>,
            #[serde(skip_serializing_if = "Option::is_none")]
            main_account_id: Option<i64>,
        }

        #[derive(Deserialize, Debug)]
        struct ApiResponse {
            #[serde(default)]
            request_id: String,
            #[serde(default)]
            error: String,
            #[serde(default)]
            message: String,
            access_token: Option<String>,
            refresh_token: Option<String>,
            expire_in: Option<i64>,
            #[serde(default)]
            merchant_id_list: Vec<i64>,
            #[serde(default)]
            shop_id_list: Vec<i64>,
        }

        // Validate that we have either shop_id or main_account_id (but not both)
        if shop_id.is_some() && main_account_id.is_some() {
            return Err(AppError::ConfigError(
                "Cannot specify both shop_id and main_account_id".to_string(),
            ));
        }

        // Shopee requires either shop_id or main_account_id for token exchange
        // For shop-level authorization, use shop_id
        // For main account authorization (multi-shop), use main_account_id
        if shop_id.is_none() && main_account_id.is_none() {
            tracing::warn!("Neither shop_id nor main_account_id provided - Shopee requires one of these for token exchange");
            // Try to proceed anyway, but it will likely fail
        }

        let request = TokenRequest {
            code: code.to_string(),
            partner_id,
            shop_id,
            main_account_id,
        };

        // Log the request details for debugging
        let request_url = format!("{}{}", self.api_base_url(), path);
        let _request_json = serde_json::to_string_pretty(&request)
            .unwrap_or_else(|_| "failed to serialize".to_string());

        // Create a debug JSON object with all request details
        let debug_request = serde_json::json!({
            "url": request_url.clone(),
            "method": "POST",
            "query_params": {
                "partner_id": partner_id,
                "timestamp": timestamp,
                "sign": sign.clone()
            },
            "headers": {
                "Content-Type": "application/json"
            },
            "body": request,
            "debug_info": {
                "base_string": base_string.clone(),
                "partner_key_length": self.credentials.app_secret.len(),
                "partner_key_first_10": &self.credentials.app_secret.chars().take(10).collect::<String>(),
                "timestamp_unix": timestamp,
                "full_url": format!("{}?partner_id={}&timestamp={}&sign={}", request_url, partner_id, timestamp, sign)
            }
        });

        tracing::info!(
            "Shopee token exchange REQUEST JSON:\n{}",
            serde_json::to_string_pretty(&debug_request)
                .unwrap_or_else(|_| "failed to serialize".to_string())
        );

        let response = self
            .client
            .post(request_url)
            .header("Content-Type", "application/json")
            .query(&[
                ("partner_id", partner_id.to_string()),
                ("timestamp", timestamp.to_string()),
                ("sign", sign.clone()),
            ])
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("Shopee token exchange failed: {}", e))
            })?;

        let status = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to read response: {}", e)))?;

        // Always log the response for debugging
        tracing::info!("Shopee API response (status {}): {}", status, response_text);

        if status != StatusCode::OK {
            // Try to parse error response
            if let Ok(error_resp) = serde_json::from_str::<ApiResponse>(&response_text) {
                tracing::error!(
                    "Shopee token exchange failed - Error: '{}', Message: '{}', Request ID: '{}'",
                    error_resp.error,
                    error_resp.message,
                    error_resp.request_id
                );

                // Provide more specific error messages
                let base_string = format!("{}{}{}", partner_id, path, timestamp);
                let error_msg = match error_resp.error.as_str() {
                    "error_sign" => format!(
                        "Wrong signature. Please check: 1) partner_key is correct, 2) timestamp is within 5 minutes, 3) base string format is correct. Base string used: '{}'",
                        base_string
                    ),
                    "error_param" => "Invalid parameters. Check that shop_id and partner_id are correct.".to_string(),
                    "error_auth" => "Authorization failed. The code may have expired or already been used.".to_string(),
                    _ => error_resp.message.clone(),
                };

                return Err(AppError::ExternalApiError(format!(
                    "Shopee token exchange failed: {} - {}",
                    error_resp.error, error_msg
                )));
            }
            return Err(AppError::ExternalApiError(format!(
                "Shopee token exchange failed with status: {} - Response: {}",
                status, response_text
            )));
        }

        let api_response: ApiResponse = serde_json::from_str(&response_text).map_err(|e| {
            AppError::ExternalApiError(format!(
                "Failed to parse token response: {} - Raw: {}",
                e, response_text
            ))
        })?;

        // Check if we have valid tokens
        if let (Some(access_token), Some(refresh_token)) =
            (api_response.access_token, api_response.refresh_token)
        {
            // Use expire_in from response, default to 4 hours (14400 seconds) as per docs
            let expires_in = api_response.expire_in.unwrap_or(14400);

            // Log shop_id_list and merchant_id_list if present (for main_account_id authorization)
            if !api_response.shop_id_list.is_empty() {
                tracing::info!("Authorized shop_ids: {:?}", api_response.shop_id_list);
            }
            if !api_response.merchant_id_list.is_empty() {
                tracing::info!(
                    "Authorized merchant_ids: {:?}",
                    api_response.merchant_id_list
                );
            }

            Ok((access_token, refresh_token, expires_in))
        } else {
            Err(AppError::ExternalApiError(format!(
                "Shopee response missing tokens. Error: {} - Message: {} - Request ID: {}",
                api_response.error, api_response.message, api_response.request_id
            )))
        }
    }

    /// Refresh access token ที่หมดอายุ
    /// ใช้ refresh token เพื่อขอ access token ใหม่
    /// Return RefreshTokenResponse พร้อม token และ expiry ใหม่
    pub async fn refresh_access_token(
        &self,
        refresh_token: &str,
    ) -> AppResult<RefreshTokenResponse> {
        self.refresh_access_token_with_shop_id(refresh_token, None)
            .await
    }

    /// Refresh access token ที่หมดอายุ with shop_id
    /// Shopee requires shop_id for refresh token operations
    pub async fn refresh_access_token_with_shop_id(
        &self,
        refresh_token: &str,
        shop_id: Option<i64>,
    ) -> AppResult<RefreshTokenResponse> {
        self.refresh_access_token_internal(refresh_token, shop_id, None)
            .await
    }

    /// Refresh access token with merchant_id for merchant-level authorization
    pub async fn refresh_access_token_with_merchant_id(
        &self,
        refresh_token: &str,
        merchant_id: i64,
    ) -> AppResult<RefreshTokenResponse> {
        self.refresh_access_token_internal(refresh_token, None, Some(merchant_id))
            .await
    }

    /// Internal method for refresh token
    async fn refresh_access_token_internal(
        &self,
        refresh_token: &str,
        shop_id: Option<i64>,
        merchant_id: Option<i64>,
    ) -> AppResult<RefreshTokenResponse> {
        let timestamp = Utc::now().timestamp();
        let path = "/api/v2/auth/access_token/get";
        let partner_id: i64 = self.credentials.app_key.parse().map_err(|_| {
            AppError::ConfigError(format!("Invalid partner_id: {}", self.credentials.app_key))
        })?;

        // For refresh token endpoint, the signature does NOT include shop_id or merchant_id
        // Base string is always: partner_id + path + timestamp
        let sign = self.generate_signature(partner_id, path, timestamp);

        #[derive(Serialize)]
        struct RefreshRequest {
            refresh_token: String,
            partner_id: i64,
            #[serde(skip_serializing_if = "Option::is_none")]
            shop_id: Option<i64>,
            #[serde(skip_serializing_if = "Option::is_none")]
            merchant_id: Option<i64>,
        }

        #[derive(Deserialize, Debug)]
        struct ApiResponse {
            #[serde(default)]
            request_id: String,
            #[serde(default)]
            error: String,
            #[serde(default)]
            message: String,
            access_token: Option<String>,
            refresh_token: Option<String>,
            expire_in: Option<i64>,
            shop_id: Option<i64>,
            merchant_id: Option<i64>,
            partner_id: Option<i64>,
        }

        // Validate that we have either shop_id or merchant_id (but not both)
        if shop_id.is_some() && merchant_id.is_some() {
            return Err(AppError::ConfigError(
                "Cannot specify both shop_id and merchant_id for refresh token".to_string(),
            ));
        }

        let request = RefreshRequest {
            refresh_token: refresh_token.to_string(),
            partner_id,
            shop_id,
            merchant_id,
        };

        let response = self
            .client
            .post(format!("{}{}", self.api_base_url(), path))
            .query(&[
                ("partner_id", partner_id.to_string()),
                ("timestamp", timestamp.to_string()),
                ("sign", sign.clone()),
            ])
            .json(&request)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("Shopee token refresh failed: {}", e))
            })?;

        let status = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to read response: {}", e)))?;

        // Log the response for debugging
        tracing::debug!(
            "Shopee refresh API response (status {}): {}",
            status,
            response_text
        );

        if status != StatusCode::OK {
            // Try to parse error response
            if let Ok(error_resp) = serde_json::from_str::<ApiResponse>(&response_text) {
                return Err(AppError::ExternalApiError(format!(
                    "Shopee token refresh failed: {} - {}",
                    error_resp.error, error_resp.message
                )));
            }
            return Err(AppError::ExternalApiError(format!(
                "Shopee token refresh failed with status: {} - Response: {}",
                status, response_text
            )));
        }

        let api_response: ApiResponse = serde_json::from_str(&response_text).map_err(|e| {
            AppError::ExternalApiError(format!(
                "Failed to parse refresh response: {} - Raw: {}",
                e, response_text
            ))
        })?;

        // Check if we have valid tokens
        if let (Some(access_token), Some(refresh_token)) =
            (api_response.access_token, api_response.refresh_token)
        {
            // Use expire_in from response, default to 4 hours (14400 seconds) as per docs
            let expires_in = api_response.expire_in.unwrap_or(14400);

            // Log shop_id or merchant_id if present
            if let Some(sid) = api_response.shop_id {
                tracing::info!("Refreshed tokens for shop_id: {}", sid);
            }
            if let Some(mid) = api_response.merchant_id {
                tracing::info!("Refreshed tokens for merchant_id: {}", mid);
            }

            Ok(RefreshTokenResponse {
                access_token,
                refresh_token: Some(refresh_token),
                expires_in: Some(expires_in),
            })
        } else {
            Err(AppError::ExternalApiError(format!(
                "Shopee refresh response missing tokens. Error: {} - Message: {} - Request ID: {}",
                api_response.error, api_response.message, api_response.request_id
            )))
        }
    }

    /// Get shop information using access token
    /// Fetches shop details including shop_id, name, and status
    pub async fn get_shop_info(&self, access_token: &str) -> AppResult<serde_json::Value> {
        let timestamp = Utc::now().timestamp();
        let path = "/api/v2/shop/get_shop_info";
        let partner_id: i64 = self.credentials.app_key.parse().map_err(|_| {
            AppError::ConfigError(format!("Invalid partner_id: {}", self.credentials.app_key))
        })?;

        // For authenticated endpoints without shop_id, use basic signature
        let sign = self.generate_signature(partner_id, path, timestamp);

        let query_params = vec![
            ("partner_id", partner_id.to_string()),
            ("timestamp", timestamp.to_string()),
            ("sign", sign.clone()),
            ("access_token", access_token.to_string()),
        ];

        let response = self
            .client
            .get(format!("{}{}", self.api_base_url(), path))
            .query(&query_params)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("Shopee get shop info failed: {}", e))
            })?;

        let status = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to read response: {}", e)))?;

        tracing::info!(
            "Shopee get_shop_info response (status {}): {}",
            status,
            response_text
        );

        if status != StatusCode::OK {
            return Err(AppError::ExternalApiError(format!(
                "Shopee get shop info failed with status: {} - Response: {}",
                status, response_text
            )));
        }

        let response_json: serde_json::Value =
            serde_json::from_str(&response_text).map_err(|e| {
                AppError::ExternalApiError(format!(
                    "Failed to parse shop info response: {} - Raw: {}",
                    e, response_text
                ))
            })?;

        // Check if there's an error in the response
        if let Some(error) = response_json.get("error").and_then(|v| v.as_str()) {
            if !error.is_empty() {
                return Err(AppError::ExternalApiError(format!(
                    "Shopee get shop info failed: {} - {}",
                    error,
                    response_json
                        .get("message")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                )));
            }
        }

        Ok(response_json)
    }

    pub async fn fetch_products(
        &self,
        access_token: &str,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        self.fetch_products_with_shop_id(access_token, None, limit, offset)
            .await
    }

    pub async fn fetch_products_with_shop_id(
        &self,
        access_token: &str,
        shop_id: Option<i64>,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        let timestamp = Utc::now().timestamp();
        let path = "/api/v2/product/get_item_list";
        let partner_id: i64 = self.credentials.app_key.parse().map_err(|_| {
            AppError::ConfigError(format!("Invalid partner_id: {}", self.credentials.app_key))
        })?;

        // For authenticated endpoints, signature includes shop_id and access_token
        let sign = if let Some(sid) = shop_id {
            self.generate_auth_signature(partner_id, path, timestamp, access_token, sid)
        } else {
            // Try without shop_id - may fail
            tracing::warn!("Fetching products without shop_id - this may fail");
            self.generate_signature(partner_id, path, timestamp)
        };

        #[derive(Deserialize)]
        struct ProductListResponse {
            response: ProductListData,
        }

        #[derive(Deserialize)]
        struct ProductListData {
            item: Vec<ShopeeItem>,
        }

        #[derive(Deserialize)]
        struct ShopeeItem {
            item_id: i64,
            item_name: String,
            description: Option<String>,
            item_sku: Option<String>,
            images: Vec<String>,
            category_id: i64,
            price_info: Vec<PriceInfo>,
            stock_info: Vec<StockInfo>,
            item_status: String,
        }

        #[derive(Deserialize)]
        struct PriceInfo {
            currency: String,
            current_price: f64,
        }

        #[derive(Deserialize)]
        struct StockInfo {
            current_stock: i32,
        }

        let page_limit = limit.unwrap_or(20) as u32;
        let page_offset = offset.unwrap_or(0) as u32;

        let mut query_params = vec![
            ("partner_id", partner_id.to_string()),
            ("timestamp", timestamp.to_string()),
            ("sign", sign.clone()),
            ("access_token", access_token.to_string()),
            ("offset", page_offset.to_string()),
            ("page_size", page_limit.to_string()),
            ("item_status", "NORMAL".to_string()),
        ];

        if let Some(sid) = shop_id {
            query_params.push(("shop_id", sid.to_string()));
        }

        let response = self
            .client
            .get(format!("{}{}", self.api_base_url(), path))
            .query(&query_params)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("Shopee list products failed: {}", e))
            })?;

        if response.status() != StatusCode::OK {
            return Err(AppError::ExternalApiError(format!(
                "Shopee list products failed with status: {}",
                response.status()
            )));
        }

        let product_response: ProductListResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse products response: {}", e))
        })?;

        let products = product_response
            .response
            .item
            .into_iter()
            .map(|item| {
                let price_amount = item
                    .price_info
                    .first()
                    .map(|p| p.current_price)
                    .unwrap_or(0.0);
                let currency = item
                    .price_info
                    .first()
                    .map(|p| p.currency.clone())
                    .unwrap_or_else(|| "USD".to_string());
                let quantity = item
                    .stock_info
                    .first()
                    .map(|s| s.current_stock)
                    .unwrap_or(0) as i16;

                let images = item
                    .images
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
                    product_id: item.item_id.to_string(),
                    shop_id: "".to_string(),
                    platform_shop_id: "".to_string(),
                    platform: PlatformType::Shopee,
                    platform_product_id: item.item_id.to_string(),
                    sku: item.item_sku.unwrap_or_default(),
                    title: item.item_name,
                    brand: "".to_string(),
                    description: item.description,
                    price: Price {
                        amount: rust_decimal::Decimal::from_f64_retain(price_amount)
                            .unwrap_or_default(),
                        currency: currency.clone(),
                        original_price: None,
                        discount_percentage: None,
                    },
                    currency,
                    quantity,
                    images,
                    categories: vec![item.category_id.to_string()],
                    attributes: std::collections::HashMap::new(),
                    status: if item.item_status == "NORMAL" {
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

    pub async fn fetch_product_detail(
        &self,
        _access_token: &str,
        _product_id: &str,
    ) -> AppResult<Product> {
        // TODO: Implement product detail fetching
        Err(AppError::ExternalApiError(
            "Product detail not yet implemented".to_string(),
        ))
    }

    pub async fn search_products(
        &self,
        access_token: &str,
        _query: &str,
        limit: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        self.search_products_with_shop_id(access_token, None, _query, limit)
            .await
    }

    pub async fn search_products_with_shop_id(
        &self,
        access_token: &str,
        shop_id: Option<i64>,
        _query: &str,
        limit: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        // Shopee doesn't have a direct search API, so we return all products
        self.fetch_products_with_shop_id(access_token, shop_id, limit, Some(0))
            .await
    }

    pub async fn get_categories(&self, _access_token: &str) -> AppResult<Vec<Category>> {
        // TODO: Implement category fetching
        Ok(vec![])
    }
}
