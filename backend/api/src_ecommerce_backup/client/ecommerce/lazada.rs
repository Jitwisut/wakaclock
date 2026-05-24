/// ไฟล์ lazada.rs - Lazada platform gateway client สำหรับการเชื่อมต่อกับ Lazada API
/// รองรับการ OAuth authentication, ดึงข้อมูลสินค้า, และซิงค์ inventory
/// ใช้ HMAC-SHA256 signature สำหรับการยืนยันตัวตนกับ Lazada API endpoints
use chrono::Utc;
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::Deserialize;
use serde_json::json;
use serde_urlencoded;
use sha2::Sha256;
use std::collections::BTreeMap;
use urlencoding;

use super::RefreshTokenResponse;
use crate::{
    config::PlatformCredentials,
    model::error::{AppError, AppResult},
    model::v1::platfrom::entries::{
        Category, PlatformType, Price, Product, ProductImage, ProductStatus,
    },
};
type HmacSha256 = Hmac<Sha256>;

/// LazadaGateway - Client สำหรับการเชื่อมต่อกับ Lazada API
/// จัดการการ authentication, product sync, และ regional API endpoints
/// รองรับหลายประเทศในเอเชียตะวันออกเฉียงใต้
pub struct LazadaGateway {
    /// ข้อมูล credentials สำหรับ Lazada app
    credentials: PlatformCredentials,

    /// HTTP client สำหรับเรียก API
    client: Client,

    /// Frontend URL for OAuth callbacks
    frontend_url: String,
}

impl LazadaGateway {
    /// สร้าง LazadaGateway instance ใหม่
    ///
    /// # Arguments
    /// * `credentials` - ข้อมูล app key, secret, และ API endpoints
    pub fn new(credentials: PlatformCredentials) -> Self {
        Self::with_frontend_url(credentials, "https://app.lodashventure.local".to_string())
    }

    /// สร้าง LazadaGateway instance ใหม่ with custom frontend URL
    pub fn with_frontend_url(credentials: PlatformCredentials, frontend_url: String) -> Self {
        Self {
            credentials,
            client: Self::build_http_client(),
            frontend_url,
        }
    }

    /// สร้าง HMAC-SHA256 signature สำหรับ Lazada API authentication
    ///
    /// # Algorithm
    /// 1. เรียง parameters ตามลำดับตัวอักษร
    /// 2. รวม path + parameters เป็น key1value1key2value2...
    /// 3. คำนวณ HMAC-SHA256 ด้วย app_secret
    /// 4. คืนค่าเป็น uppercase hex string
    ///
    /// # Arguments
    /// * `path` - API endpoint path
    /// * `params` - Parameters ที่จะส่งไปกับ request
    fn generate_signature(&self, path: &str, params: &BTreeMap<String, String>) -> String {
        let mut sign_string = path.to_string();

        // รวม parameters ที่เรียงแล้วเข้ากับ path
        for (key, value) in params.iter() {
            sign_string.push_str(key);
            sign_string.push_str(value);
        }

        let mut mac = HmacSha256::new_from_slice(self.credentials.app_secret.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(sign_string.as_bytes());

        format!("{:X}", mac.finalize().into_bytes())
    }

    fn build_http_client() -> Client {
        Client::builder()
            .no_proxy()
            .build()
            .expect("Failed to create Lazada HTTP client")
    }
}

/// การ implement public methods สำหรับ LazadaGateway
/// รองรับ OAuth flow, product sync, และ platform-specific operations
/// TODO: อัปเดตให้รองรับ PlatformGateway trait ใหม่
impl LazadaGateway {
    /// คืนค่าชื่อแพลตฟอร์ม
    pub fn platform_name(&self) -> &str {
        "lazada"
    }

    /// สร้าง OAuth authorization URL สำหรับ Lazada
    ///
    /// # Arguments
    /// * `_state` - State parameter (ยังไม่ใช้ใน Lazada implementation)
    ///
    /// # Returns
    /// OAuth URL ที่ user ควรไปยืนยันตัวตน
    pub fn get_oauth_url(&self, state: &str) -> String {
        // Get the proper OAuth redirect URL using the centralized logic
        let redirect_uri = self
            .credentials
            .get_oauth_redirect_url("lazada", &self.frontend_url);

        // Lazada supports state parameter for maintaining context
        let base_url = self
            .credentials
            .oauth_authorize_url
            .as_deref()
            .unwrap_or("https://auth.lazada.com/oauth/authorize");

        let redirect_url = redirect_uri.clone();

        let mut params = vec![
            ("response_type".to_string(), "code".to_string()),
            ("redirect_url".to_string(), redirect_url.clone()),
            ("client_id".to_string(), self.credentials.app_key.clone()),
            ("state".to_string(), state.to_string()),
        ];

        if let Some(market) = &self.credentials.market {
            if !market.trim().is_empty() {
                params.push(("country".to_string(), market.trim().to_uppercase()));
            }
        }

        let query_string = serde_urlencoded::to_string(&params).unwrap_or_else(|err| {
            tracing::error!("Failed to encode Lazada OAuth params: {}", err);
            format!(
                "response_type=code&redirect_url={}&client_id={}&state={}",
                urlencoding::encode(&redirect_url),
                self.credentials.app_key,
                urlencoding::encode(state)
            )
        });

        format!("{}?{}", base_url.trim_end_matches('?'), query_string)
    }

    /// แลกเปลี่ยน authorization code เป็น access token
    ///
    /// # Arguments
    /// * `code` - Authorization code จาก OAuth callback
    ///
    /// # Returns
    /// Tuple ของ (access_token, refresh_token, expires_in)
    pub async fn exchange_code_for_token(&self, code: &str) -> AppResult<(String, String, i64)> {
        let (access_token, refresh_token, expires_in, _account_info) =
            self.exchange_code(code, "").await?;
        Ok((access_token, refresh_token, expires_in))
    }

    pub async fn exchange_code_for_tokens_detailed(
        &self,
        code: &str,
    ) -> AppResult<(String, String, serde_json::Value)> {
        let (access_token, refresh_token, _expires_in, account_info) =
            self.exchange_code(code, "").await?;
        Ok((access_token, refresh_token, account_info))
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

    /// ดึงรายการสินค้าจาก Lazada โดยใช้ pagination
    ///
    /// # Arguments
    /// * `access_token` - Access token ของ seller
    /// * `limit` - จำนวนสินค้าสูงสุดที่ต้องการ
    /// * `offset` - จำนวนสินค้าที่จะข้าม
    ///
    /// # Returns
    /// Vector ของ Product objects
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
        _state: &str,
    ) -> AppResult<(String, String, i64, serde_json::Value)> {
        let timestamp = Utc::now().timestamp_millis();
        let path = "/auth/token/create";

        let mut params = BTreeMap::new();
        params.insert("app_key".to_string(), self.credentials.app_key.clone());
        params.insert("code".to_string(), code.to_string());
        params.insert("sign_method".to_string(), "sha256".to_string());
        params.insert("timestamp".to_string(), timestamp.to_string());

        let sign = self.generate_signature(path, &params);
        params.insert("sign".to_string(), sign);

        #[derive(Deserialize, Debug)]
        struct TokenResponse {
            #[serde(default)]
            code: String,
            access_token: Option<String>,
            refresh_token: Option<String>,
            #[serde(default)]
            message: String,
            expires_in: Option<i64>,
            refresh_expires_in: Option<i64>,
            account: Option<String>,
            account_id: Option<String>,
            country: Option<String>,
            account_platform: Option<String>,
            country_user_info: Option<Vec<CountryUserInfo>>,
        }

        #[derive(Deserialize, Debug, serde::Serialize)]
        struct CountryUserInfo {
            country: Option<String>,
            user_id: Option<String>,
            seller_id: Option<String>,
            short_code: Option<String>,
        }

        // Use the auth endpoint, not the API endpoint
        let auth_base_url = "https://auth.lazada.com/rest";
        let response = self
            .client
            .post(format!("{}{}", auth_base_url, path))
            // Lazada expects form-encoded parameters, not JSON
            .form(&params)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("Lazada token exchange failed: {}", e))
            })?;

        let response_text = response
            .text()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to read response: {}", e)))?;

        tracing::debug!("Lazada token exchange response: {}", response_text);

        let token_response: TokenResponse = serde_json::from_str(&response_text).map_err(|e| {
            AppError::ExternalApiError(format!(
                "Failed to parse token response: {} - Response: {}",
                e, response_text
            ))
        })?;

        // Check for error response
        if token_response.code != "0" {
            return Err(AppError::ExternalApiError(format!(
                "Lazada token exchange failed: {}",
                token_response.message
            )));
        }

        let access_token = token_response
            .access_token
            .ok_or_else(|| AppError::ExternalApiError("No access token in response".to_string()))?;

        let refresh_token = token_response.refresh_token.ok_or_else(|| {
            AppError::ExternalApiError("No refresh token in response".to_string())
        })?;

        // Extract expires_in, default to 7 days (604800 seconds) if not provided
        let expires_in = token_response.expires_in.unwrap_or(604800);

        // Prepare account info for detailed response
        let account_info = serde_json::json!({
            "access_token": access_token.clone(),
            "refresh_token": refresh_token.clone(),
            "expires_in": expires_in,
            "refresh_expires_in": token_response.refresh_expires_in.unwrap_or(2592000), // 30 days default
            "account": token_response.account.unwrap_or_default(),
            "account_id": token_response.account_id.unwrap_or_default(),
            "country": token_response.country.unwrap_or_default(),
            "account_platform": token_response.account_platform.unwrap_or_default(),
            "country_user_info": token_response.country_user_info.unwrap_or_default(),
        });

        Ok((access_token, refresh_token, expires_in, account_info))
    }

    async fn refresh_token(&self, refresh_token: &str) -> AppResult<(String, String)> {
        let timestamp = Utc::now().timestamp_millis();
        let path = "/auth/token/refresh";

        let mut params = BTreeMap::new();
        params.insert("app_key".to_string(), self.credentials.app_key.clone());
        params.insert("refresh_token".to_string(), refresh_token.to_string());
        params.insert("sign_method".to_string(), "sha256".to_string());
        params.insert("timestamp".to_string(), timestamp.to_string());

        let sign = self.generate_signature(path, &params);
        params.insert("sign".to_string(), sign);

        #[derive(Deserialize, Debug)]
        struct TokenResponse {
            #[serde(default)]
            code: String,
            access_token: Option<String>,
            refresh_token: Option<String>,
            #[serde(default)]
            message: String,
            expires_in: Option<i64>,
            refresh_expires_in: Option<i64>,
        }

        // Use the auth endpoint
        let auth_base_url = "https://auth.lazada.com/rest";
        let response = self
            .client
            .post(format!("{}{}", auth_base_url, path))
            // Lazada expects form-encoded parameters, not JSON
            .form(&params)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("Lazada token refresh failed: {}", e))
            })?;

        let response_text = response
            .text()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to read response: {}", e)))?;

        let token_response: TokenResponse = serde_json::from_str(&response_text).map_err(|e| {
            AppError::ExternalApiError(format!(
                "Failed to parse refresh response: {} - Response: {}",
                e, response_text
            ))
        })?;

        // Check for error response
        if token_response.code != "0" {
            return Err(AppError::ExternalApiError(format!(
                "Lazada token refresh failed: {}",
                token_response.message
            )));
        }

        let access_token = token_response
            .access_token
            .ok_or_else(|| AppError::ExternalApiError("No access token in response".to_string()))?;

        let refresh_token = token_response.refresh_token.ok_or_else(|| {
            AppError::ExternalApiError("No refresh token in response".to_string())
        })?;

        Ok((access_token, refresh_token))
    }

    /// ดึงรายการสินค้าจาก Lazada API (internal method)
    ///
    /// # Arguments
    /// * `access_token` - Access token ของ seller
    /// * `page` - หน้าที่ต้องการดึง (เริ่มจาก 1)
    /// * `limit` - จำนวนสินค้าต่อหน้า
    ///
    /// # Returns
    /// Vector ของ Product objects ที่แปลงแล้วเป็น unified format
    async fn list_products(
        &self,
        access_token: &str,
        page: u32,
        limit: u32,
    ) -> AppResult<Vec<Product>> {
        let timestamp = Utc::now().timestamp_millis();
        let path = "/products/get";

        let mut params = BTreeMap::new();
        params.insert("access_token".to_string(), access_token.to_string());
        params.insert("app_key".to_string(), self.credentials.app_key.clone());
        params.insert("filter".to_string(), "all".to_string());
        params.insert("limit".to_string(), limit.to_string());
        params.insert("offset".to_string(), ((page - 1) * limit).to_string());
        params.insert("sign_method".to_string(), "sha256".to_string());
        params.insert("timestamp".to_string(), timestamp.to_string());

        let sign = self.generate_signature(path, &params);
        params.insert("sign".to_string(), sign);

        #[derive(Deserialize, Debug)]
        struct ProductResponse {
            #[serde(default)]
            code: String,
            data: Option<ProductData>,
            #[serde(default)]
            message: String,
        }

        #[derive(Deserialize, Debug)]
        struct ProductData {
            products: Vec<LazadaProduct>,
            total_products: Option<String>,
        }

        #[derive(Deserialize, Debug)]
        struct LazadaProduct {
            item_id: String,
            attributes: ProductAttributes,
            skus: Vec<LazadaSku>,
            images: Option<Vec<String>>,
            created_time: Option<String>,
            updated_time: Option<String>,
            status: Option<String>,
        }

        #[derive(Deserialize, Debug)]
        struct ProductAttributes {
            name: String,
            description: Option<String>,
            brand: Option<String>,
            warranty_type: Option<String>,
        }

        #[derive(Deserialize, Debug)]
        struct LazadaSku {
            #[serde(rename = "SellerSku")]
            seller_sku: String,
            #[serde(rename = "ShopSku")]
            shop_sku: Option<String>,
            price: f64,
            special_price: Option<f64>,
            quantity: Option<i32>,
            #[serde(rename = "Status")]
            status: Option<String>,
            #[serde(rename = "Images")]
            images: Option<Vec<String>>,
        }

        // Get the correct regional API endpoint
        let api_base_url = self.get_regional_api_url();
        let response = self
            .client
            .get(format!("{}{}", api_base_url, path))
            .query(&params)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("Lazada list products failed: {}", e))
            })?;

        let response_text = response
            .text()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to read response: {}", e)))?;

        tracing::debug!("Lazada products response: {}", response_text);

        let product_response: ProductResponse =
            serde_json::from_str(&response_text).map_err(|e| {
                AppError::ExternalApiError(format!(
                    "Failed to parse products response: {} - Response: {}",
                    e, response_text
                ))
            })?;

        // Check for error response
        if product_response.code != "0" {
            return Err(AppError::ExternalApiError(format!(
                "Lazada list products failed: {}",
                product_response.message
            )));
        }

        let product_data = product_response.data.ok_or_else(|| {
            AppError::ExternalApiError("No data in products response".to_string())
        })?;

        let products = product_data
            .products
            .into_iter()
            .map(|p| {
                let sku = p.skus.first();
                let price_amount = sku.map(|s| s.price).unwrap_or(0.0);
                let special_price = sku.and_then(|s| s.special_price);

                // Collect images from product level or SKU level
                let mut all_images = Vec::new();

                // Add product-level images
                if let Some(product_images) = p.images {
                    all_images.extend(product_images);
                }

                // Add SKU-level images
                if let Some(sku_images) = sku.and_then(|s| s.images.clone()) {
                    all_images.extend(sku_images);
                }

                let images = all_images
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
                    product_id: p.item_id.clone(),
                    shop_id: "".to_string(),
                    platform_shop_id: "".to_string(),
                    platform: PlatformType::Lazada,
                    platform_product_id: p.item_id,
                    sku: sku.map(|s| s.seller_sku.clone()).unwrap_or_default(),
                    title: p.attributes.name,
                    brand: p.attributes.brand.unwrap_or_default(),
                    description: p.attributes.description,
                    price: Price {
                        amount: rust_decimal::Decimal::from_f64_retain(
                            special_price.unwrap_or(price_amount),
                        )
                        .unwrap_or_default(),
                        currency: "USD".to_string(),
                        original_price: if special_price.is_some() {
                            Some(
                                rust_decimal::Decimal::from_f64_retain(price_amount)
                                    .unwrap_or_default(),
                            )
                        } else {
                            None
                        },
                        discount_percentage: if let Some(sp) = special_price {
                            if price_amount > 0.0 {
                                Some(
                                    rust_decimal::Decimal::from_f64_retain(
                                        ((price_amount - sp) / price_amount) * 100.0,
                                    )
                                    .unwrap_or_default(),
                                )
                            } else {
                                None
                            }
                        } else {
                            None
                        },
                    },
                    currency: "USD".to_string(),
                    quantity: sku.and_then(|s| s.quantity).unwrap_or(0) as i16,
                    images,
                    categories: vec![],
                    attributes: std::collections::HashMap::new(),
                    status: match p.status.as_deref() {
                        Some("Active") | Some("active") => ProductStatus::Active,
                        _ => ProductStatus::Inactive,
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
        self.list_products(access_token, 1, 100).await
    }

    /// ได้ regional API URL ตาม configuration
    /// รองรับหลายประเทศในเอเชียตะวันออกเฉียงใต้ เช่น SG, MY, TH, ID, PH, VN
    ///
    /// # Returns
    /// API base URL สำหรับภูมิภาคที่กำหนด (default: Singapore)
    fn get_regional_api_url(&self) -> String {
        // ตรวจสอบ regional API URL จาก configuration
        if self.credentials.api_base_url.contains("lazada") {
            self.credentials.api_base_url.clone()
        } else {
            // Default ใช้ Singapore endpoint
            "https://api.lazada.sg/rest".to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::PlatformCredentials;

    #[test]
    fn test_lazada_oauth_url_generation() {
        let credentials = PlatformCredentials {
            app_key: "test_app_key".to_string(),
            app_secret: "test_app_secret".to_string(),
            redirect_uri: Some("http://localhost:8080/callback".to_string()),
            api_base_url: "https://api.lazada.sg/rest".to_string(),
            ..Default::default()
        };

        let gateway = LazadaGateway::new(credentials);
        let oauth_url = gateway.get_oauth_url("test_state");

        assert!(oauth_url.contains("https://auth.lazada.com/oauth/authorize"));
        assert!(oauth_url.contains("client_id=test_app_key"));
        assert!(oauth_url.contains("response_type=code"));
        assert!(oauth_url.contains("redirect_url="));
    }

    #[test]
    fn test_signature_generation() {
        let credentials = PlatformCredentials {
            app_key: "test_app_key".to_string(),
            app_secret: "test_app_secret".to_string(),
            api_base_url: "https://api.lazada.sg/rest".to_string(),
            ..Default::default()
        };

        let gateway = LazadaGateway::new(credentials);

        let mut params = std::collections::BTreeMap::new();
        params.insert("app_key".to_string(), "test_app_key".to_string());
        params.insert("timestamp".to_string(), "1234567890".to_string());
        params.insert("sign_method".to_string(), "sha256".to_string());

        let signature = gateway.generate_signature("/auth/token/create", &params);

        // Signature should be a hex string
        assert!(!signature.is_empty());
        assert!(signature.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_regional_api_url() {
        let credentials = PlatformCredentials {
            app_key: "test_app_key".to_string(),
            app_secret: "test_app_secret".to_string(),
            api_base_url: "https://api.lazada.com.my/rest".to_string(),
            ..Default::default()
        };

        let gateway = LazadaGateway::new(credentials);
        let api_url = gateway.get_regional_api_url();

        assert_eq!(api_url, "https://api.lazada.com.my/rest");
    }

    #[test]
    fn test_platform_name() {
        let credentials = PlatformCredentials::default();
        let gateway = LazadaGateway::new(credentials);

        assert_eq!(gateway.platform_name(), "lazada");
    }
}
