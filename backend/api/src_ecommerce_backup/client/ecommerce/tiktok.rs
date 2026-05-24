/// ไฟล์ tiktok.rs - TikTok Shop API Gateway Implementation
/// จัดการการเชื่อมต่อกับ TikTok Shop API สำหรับจัดการสินค้า
/// รองรับ OAuth 2.0, Product Management, Order Management
use super::RefreshTokenResponse;
use crate::interfaces::platform_gateway::{
    ListProductParams, OAuthTokens, OAuthUrl, PlatformGateway, PlatformLimits, PlatformProduct,
    ProductList, RateLimit, ShopInfo,
};
use crate::interfaces::{InterfaceError, InterfaceResult};
use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::{
    Category, PlatformType, Price, Product, ProductImage, ProductStatus,
};
use crate::{client::RawJsonResponse, config::PlatformCredentials};
use anyhow::Result;
use async_trait::async_trait;
use chrono::Utc;
use hmac::{Hmac, Mac};
use num_traits::ToPrimitive;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_urlencoded;
use sha2::Sha256;
use std::collections::HashMap;

// TikTok API ต้องใช้ HMAC-SHA256 สำหรับ signing requests
type HmacSha256 = Hmac<Sha256>;

/// โครงสร้างข้อมูล OAuth Token ที่ได้รับจาก TikTok API
#[derive(Debug, Clone, Deserialize)]
pub struct TokenData {
    pub access_token: String,                // token สำหรับเข้าถึง API
    pub refresh_token: String,               // token สำหรับ refresh access token
    pub access_token_expire_in: i64,         // อายุของ access token (วินาที)
    pub refresh_token_expire_in: i64,        // อายุของ refresh token (วินาที)
    pub open_id: String,                     // unique ID ของ seller ใน TikTok
    pub seller_name: Option<String>,         // ชื่อร้านค้า
    pub seller_base_region: Option<String>,  // ภูมิภาคหลักของร้านค้า
    pub user_type: Option<i32>,              // ประเภทผู้ใช้ (seller, brand, etc.)
    pub granted_scopes: Option<Vec<String>>, // สิทธิ์ที่ได้รับอนุญาต
}

/// TikTok Gateway - ตัวเชื่อมต่อหลักกับ TikTok Shop API
/// ใช้ PlatformGateway trait เพื่อให้สามารถใช้งานร่วมกับ platform อื่นๆ ได้
pub struct TikTokGateway {
    credentials: PlatformCredentials, // ข้อมูล app key/secret สำหรับ API
    client: Client,                   // HTTP client สำหรับเรียก API
    shop_cipher: Option<String>,      // shop cipher สำหรับ signing (TikTok specific)
    shop_id: Option<String>,          // Shop ID ในระบบ TikTok
    access_token: Option<String>,     // OAuth access token ที่ใช้งานอยู่
}

/// การ implement PlatformGateway trait สำหรับ TikTok
/// ทำให้สามารถใช้ TikTokGateway ผ่าน interface กลางได้
#[async_trait]
impl PlatformGateway for TikTokGateway {
    /// ระบุ platform ID สำหรับระบบ
    fn platform_id(&self) -> &str {
        "tiktok"
    }

    /// ชื่อ platform ที่แสดงต่อผู้ใช้
    fn platform_name(&self) -> &str {
        "TikTok Shop"
    }

    async fn init_oauth(&self, state: &str, _redirect_uri: &str) -> InterfaceResult<OAuthUrl> {
        let url = self.get_oauth_url(state);
        Ok(OAuthUrl {
            url,
            state: state.to_string(),
        })
    }

    async fn get_oauth_url(&self, state: &str) -> Result<String> {
        Ok(self.get_oauth_url_sync(state))
    }

    async fn handle_oauth_callback(
        &self,
        code: &str,
        _state: &str,
    ) -> InterfaceResult<OAuthTokens> {
        let (access_token, refresh_token, token_data) = self
            .exchange_code_for_tokens_detailed(code)
            .await
            .map_err(|e| InterfaceError::External(e.to_string()))?;

        let expires_at = if token_data.access_token_expire_in > 0 {
            Some(Utc::now() + chrono::Duration::seconds(token_data.access_token_expire_in))
        } else {
            None
        };

        Ok(OAuthTokens {
            access_token,
            refresh_token: Some(refresh_token),
            expires_at,
            token_type: Some("Bearer".to_string()),
        })
    }

    async fn exchange_code_for_token(&self, code: &str) -> Result<(String, String), anyhow::Error> {
        let (access_token, refresh_token) = self.exchange_code(code, "").await?;
        Ok((access_token, refresh_token))
    }

    async fn refresh_token(&self, refresh_token: &str) -> Result<(String, String), anyhow::Error> {
        self.refresh_oauth_token(refresh_token)
            .await
            .map_err(Into::into)
    }

    async fn refresh_tokens(&self, refresh_token: &str) -> InterfaceResult<OAuthTokens> {
        let (access_token, new_refresh_token) = self
            .refresh_oauth_token(refresh_token)
            .await
            .map_err(|e| InterfaceError::External(e.to_string()))?;

        Ok(OAuthTokens {
            access_token,
            refresh_token: Some(new_refresh_token),
            expires_at: Some(Utc::now() + chrono::Duration::hours(2)),
            token_type: Some("Bearer".to_string()),
        })
    }

    async fn list_products(&self, params: &ListProductParams) -> InterfaceResult<ProductList> {
        let page = params.page.unwrap_or(1);
        let limit = params.limit.unwrap_or(20);
        let access_token = self
            .access_token
            .as_ref()
            .ok_or_else(|| InterfaceError::External("Missing access token".to_string()))?;

        let products = self
            .list_products_impl(access_token, page, limit)
            .await
            .map_err(|e| InterfaceError::External(e.to_string()))?;

        let platform_products = products
            .iter()
            .map(|p| PlatformProduct {
                id: p.product_id.clone(),
                platform_id: Some(p.platform_product_id.clone()),
                title: p.title.clone(),
                description: p.description.clone(),
                price: p.price.amount.to_f64().unwrap_or(0.0),
                currency: p.currency.clone(),
                sku: Some(p.sku.clone()),
                quantity: Some(p.quantity as i32),
                images: p.images.iter().map(|img| img.url.clone()).collect(),
                variants: vec![],
                status: match p.status {
                    ProductStatus::Active => "active".to_string(),
                    ProductStatus::Inactive => "inactive".to_string(),
                    _ => "unknown".to_string(),
                },
                attributes: p.attributes.clone(),
                created_at: Some(p.created_at),
                updated_at: Some(p.updated_at),
            })
            .collect();

        Ok(ProductList {
            products: platform_products,
            total: products.len() as u64,
            has_more: products.len() == limit as usize,
            next_cursor: None,
        })
    }

    async fn fetch_products(
        &self,
        access_token: &str,
        page: Option<u32>,
        limit: Option<u32>,
    ) -> Result<Vec<serde_json::Value>, anyhow::Error> {
        let products = self
            .list_products_impl(access_token, page.unwrap_or(1), limit.unwrap_or(20))
            .await?;
        Ok(products
            .into_iter()
            .map(|p| serde_json::to_value(p).unwrap())
            .collect())
    }

    async fn get_product(&self, product_id: &str) -> InterfaceResult<PlatformProduct> {
        let access_token = self
            .access_token
            .as_ref()
            .ok_or_else(|| InterfaceError::External("Missing access token".to_string()))?;

        let product = self
            .get_product_impl(access_token, product_id)
            .await
            .map_err(|e| InterfaceError::External(e.to_string()))?;

        Ok(PlatformProduct {
            id: product.product_id.clone(),
            platform_id: Some(product.platform_product_id.clone()),
            title: product.title.clone(),
            description: product.description.clone(),
            price: product.price.amount.to_f64().unwrap_or(0.0),
            currency: product.currency.clone(),
            sku: Some(product.sku.clone()),
            quantity: Some(product.quantity as i32),
            images: product.images.iter().map(|img| img.url.clone()).collect(),
            variants: vec![],
            status: match product.status {
                ProductStatus::Active => "active".to_string(),
                ProductStatus::Inactive => "inactive".to_string(),
                _ => "unknown".to_string(),
            },
            attributes: product.attributes.clone(),
            created_at: Some(product.created_at),
            updated_at: Some(product.updated_at),
        })
    }

    async fn fetch_product_details(
        &self,
        access_token: &str,
        product_id: &str,
    ) -> Result<serde_json::Value, anyhow::Error> {
        let product = self.get_product_impl(access_token, product_id).await?;
        serde_json::to_value(product).map_err(Into::into)
    }

    async fn create_product(&self, product: &PlatformProduct) -> InterfaceResult<String> {
        let access_token = self
            .access_token
            .as_ref()
            .ok_or_else(|| InterfaceError::External("Missing access token".to_string()))?;

        let internal_product = Product {
            product_id: product.id.clone(),
            platform_product_id: product
                .platform_id
                .clone()
                .unwrap_or_else(|| product.id.clone()),
            shop_id: self.shop_id.clone().unwrap_or_default(),
            platform_shop_id: self.shop_id.clone().unwrap_or_default(),
            platform: PlatformType::TikTok,
            title: product.title.clone(),
            description: product.description.clone(),
            price: Price {
                amount: rust_decimal::Decimal::from_f64_retain(product.price)
                    .unwrap_or(rust_decimal::Decimal::ZERO),
                currency: product.currency.clone(),
                original_price: None,
                discount_percentage: None,
            },
            brand: String::new(),
            currency: product.currency.clone(),
            sku: product.sku.clone().unwrap_or_default(),
            quantity: product.quantity.unwrap_or(0) as i16,
            images: product
                .images
                .iter()
                .enumerate()
                .map(|(idx, url)| ProductImage {
                    url: url.clone(),
                    alt: None,
                    is_primary: idx == 0,
                    position: idx as i32,
                })
                .collect(),
            categories: vec![],
            attributes: product.attributes.clone(),
            status: ProductStatus::Active,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            synced_at: Some(Utc::now()),
        };

        let created = self
            .create_product_impl(access_token, &internal_product)
            .await
            .map_err(|e| InterfaceError::External(e.to_string()))?;

        Ok(created.product_id)
    }

    async fn update_product(
        &self,
        _product_id: &str,
        _product: &PlatformProduct,
    ) -> InterfaceResult<()> {
        Err(InterfaceError::NotImplemented(
            "TikTok product update not yet implemented".to_string(),
        ))
    }

    async fn upsert_product(
        &self,
        _access_token: &str,
        _product: serde_json::Value,
    ) -> Result<serde_json::Value, anyhow::Error> {
        anyhow::bail!("TikTok product upsert not yet implemented")
    }

    async fn delete_product(&self, _product_id: &str) -> InterfaceResult<()> {
        Err(InterfaceError::NotImplemented(
            "TikTok product deletion not yet implemented".to_string(),
        ))
    }

    async fn get_shop_info(&self) -> InterfaceResult<ShopInfo> {
        let access_token = self
            .access_token
            .as_ref()
            .ok_or_else(|| InterfaceError::External("Missing access token".to_string()))?;

        let (shop_id, shop_cipher) = self
            .get_shop_info_impl(access_token)
            .await
            .map_err(|e| InterfaceError::External(e.to_string()))?;

        Ok(ShopInfo {
            id: shop_id,
            name: shop_cipher,
            url: None,
            country: None,
            currency: None,
            platform: Some("tiktok".to_string()),
            status: Some("active".to_string()),
            created_at: None,
        })
    }

    async fn validate_credentials(&self) -> InterfaceResult<bool> {
        if self.access_token.is_none() {
            return Ok(false);
        }

        match self.get_shop_info().await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    async fn get_limits(&self) -> InterfaceResult<PlatformLimits> {
        Ok(PlatformLimits {
            requests_per_second: Some(10),
            requests_per_minute: Some(100),
            requests_per_hour: Some(5000),
            max_page_size: Some(100),
        })
    }

    async fn check_rate_limit(&self) -> InterfaceResult<RateLimit> {
        Ok(RateLimit {
            limit: 100,
            remaining: 100,
            reset_at: Some(Utc::now() + chrono::Duration::minutes(1)),
        })
    }
}

impl TikTokGateway {
    pub fn platform_name_internal(&self) -> &str {
        "tiktok"
    }

    pub fn with_shop_cipher(mut self, shop_cipher: Option<String>) -> Self {
        self.shop_cipher = shop_cipher;
        self
    }

    pub fn with_shop_id(mut self, shop_id: Option<String>) -> Self {
        self.shop_id = shop_id;
        self
    }

    pub fn with_access_token(mut self, access_token: Option<String>) -> Self {
        self.access_token = access_token;
        self
    }

    /// Fetch products from TikTok API using JSON with better error handling
    pub async fn fetch_products_json(
        &self,
        access_token: &str,
        page: u32,
        limit: u32,
    ) -> AppResult<serde_json::Value> {
        let timestamp = Utc::now().timestamp();
        let path = "/product/202309/products/search";

        // Get shop info if not cached
        let (shop_cipher, _shop_id) =
            if let (Some(cipher), Some(id)) = (&self.shop_cipher, &self.shop_id) {
                (cipher.clone(), id.clone())
            } else {
                self.get_shop_info_impl(access_token).await?
            };

        let mut params = HashMap::new();
        params.insert("app_key".to_string(), self.credentials.app_key.clone());
        params.insert("timestamp".to_string(), timestamp.to_string());
        params.insert("page_number".to_string(), page.to_string());
        params.insert("page_size".to_string(), limit.to_string());
        params.insert("shop_cipher".to_string(), shop_cipher);

        let signature = self.generate_signature(path, &params, timestamp);
        params.insert("sign".to_string(), signature);

        let url = format!("{}{}", self.credentials.api_base_url, path);

        let response = self
            .client
            .post(&url)
            .header("x-tts-access-token", access_token)
            .header("Content-Type", "application/json")
            .query(&params)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Product fetch failed: {}", e)))?;

        if response.status() != StatusCode::OK {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Product fetch failed: {}",
                error_text
            )));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Invalid JSON: {}", e)))?;

        // Check API response code
        if json["code"].as_i64().unwrap_or(-1) != 0 {
            let message = json["message"].as_str().unwrap_or("Unknown error");
            return Err(AppError::ExternalApiError(format!(
                "API error: {}",
                message
            )));
        }

        Ok(json)
    }

    /// Map JSON product to Product struct with comprehensive field mapping
    pub fn map_json_to_product(
        &self,
        json: &serde_json::Value,
        shop_id: &str,
    ) -> AppResult<Product> {
        // Extract product ID
        let product_id = json["id"]
            .as_str()
            .or_else(|| json["product_id"].as_str())
            .ok_or_else(|| AppError::ExternalApiError("Missing product ID".to_string()))?
            .to_string();

        // Extract title
        let title = json["title"]
            .as_str()
            .or_else(|| json["product_name"].as_str())
            .unwrap_or("")
            .to_string();

        // Extract description
        let description = json["description"].as_str().map(String::from);

        // Extract SKU data
        let skus = json["skus"].as_array();
        let first_sku = skus.and_then(|arr| arr.first());

        // Build price from SKU data
        let price = self.extract_price_from_sku(first_sku);
        let currency = price.currency.clone();

        // Extract SKU code
        let sku = first_sku
            .and_then(|s| s["seller_sku"].as_str())
            .unwrap_or("")
            .to_string();

        // Extract inventory quantity
        let quantity = first_sku
            .and_then(|s| s["inventory"].as_array())
            .and_then(|inv| inv.first())
            .and_then(|i| i["quantity"].as_i64())
            .unwrap_or(0) as i16;

        // Extract status
        let status = self.extract_status(json);

        // Extract images
        let images = self.extract_images(json);

        // Extract categories
        let categories = self.extract_categories(json);

        // Build comprehensive attributes
        let mut attributes = HashMap::new();
        self.add_attributes_from_json(&mut attributes, json, first_sku);

        // Extract brand
        let brand = json["brand"]["name"].as_str().unwrap_or("").to_string();

        Ok(Product {
            product_id: uuid::Uuid::new_v4().to_string(),
            platform_product_id: product_id,
            shop_id: "".to_string(),
            platform_shop_id: shop_id.to_string(),
            platform: PlatformType::TikTok,
            title,
            description,
            price,
            brand,
            currency,
            sku,
            quantity,
            images,
            categories,
            attributes,
            status,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            synced_at: Some(Utc::now()),
        })
    }

    /// Extract price from SKU JSON
    fn extract_price_from_sku(&self, sku: Option<&serde_json::Value>) -> Price {
        if let Some(sku) = sku {
            let price_obj = &sku["price"];
            let amount_str = price_obj["sale_price"]
                .as_str()
                .or_else(|| price_obj["tax_exclusive_price"].as_str())
                .unwrap_or("0");
            let amount = amount_str.parse::<f64>().unwrap_or(0.0);
            let currency = price_obj["currency"].as_str().unwrap_or("USD");

            Price {
                amount: rust_decimal::Decimal::from_f64_retain(amount)
                    .unwrap_or(rust_decimal::Decimal::ZERO),
                currency: currency.to_string(),
                original_price: None,
                discount_percentage: None,
            }
        } else {
            Price {
                amount: rust_decimal::Decimal::ZERO,
                currency: "USD".to_string(),
                original_price: None,
                discount_percentage: None,
            }
        }
    }

    /// Extract status from JSON
    fn extract_status(&self, json: &serde_json::Value) -> ProductStatus {
        let status_str = json["status"]
            .as_str()
            .or_else(|| json["product_status"].as_str());

        match status_str {
            Some("ACTIVATE") | Some("ACTIVE") => ProductStatus::Active,
            _ => ProductStatus::Inactive,
        }
    }

    /// Extract images from JSON
    fn extract_images(&self, json: &serde_json::Value) -> Vec<ProductImage> {
        if let Some(main_images) = json["main_images"].as_array() {
            main_images
                .iter()
                .flat_map(|img| {
                    img["urls"]
                        .as_array()
                        .map(|urls| {
                            urls.iter()
                                .filter_map(|u| u.as_str())
                                .map(String::from)
                                .collect::<Vec<_>>()
                        })
                        .unwrap_or_else(|| vec![img["uri"].as_str().unwrap_or("").to_string()])
                })
                .enumerate()
                .map(|(idx, url)| ProductImage {
                    url,
                    alt: None,
                    is_primary: idx == 0,
                    position: idx as i32,
                })
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Extract categories from JSON
    fn extract_categories(&self, json: &serde_json::Value) -> Vec<String> {
        if let Some(chains) = json["category_chains"].as_array() {
            chains
                .iter()
                .filter_map(|c| c["local_name"].as_str())
                .map(String::from)
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Add attributes from JSON to HashMap
    fn add_attributes_from_json(
        &self,
        attributes: &mut HashMap<String, String>,
        json: &serde_json::Value,
        first_sku: Option<&serde_json::Value>,
    ) {
        // Add timestamps
        if let Some(create_time) = json["create_time"].as_i64() {
            attributes.insert("create_time".to_string(), create_time.to_string());
        }
        if let Some(update_time) = json["update_time"].as_i64() {
            attributes.insert("update_time".to_string(), update_time.to_string());
        }

        // Add SKU details
        if let Some(sku) = first_sku {
            if let Some(sku_id) = sku["id"].as_str() {
                attributes.insert("sku_id".to_string(), sku_id.to_string());
            }

            // Add sales attributes
            if let Some(sales_attrs) = sku["sales_attributes"].as_array() {
                let attrs_json = serde_json::to_string(sales_attrs).unwrap_or_default();
                attributes.insert("sales_attributes".to_string(), attrs_json);
            }
        }

        // Add brand info
        if let Some(brand) = json["brand"].as_object() {
            if let Some(brand_id) = brand["id"].as_str() {
                attributes.insert("brand_id".to_string(), brand_id.to_string());
            }
            if let Some(brand_name) = brand["name"].as_str() {
                attributes.insert("brand_name".to_string(), brand_name.to_string());
            }
        }

        // Add package dimensions
        if let Some(dims) = json["package_dimensions"].as_object() {
            for (key, value) in dims {
                if let Some(v) = value.as_str() {
                    attributes.insert(format!("package_{}", key), v.to_string());
                }
            }
        }

        // Add package weight
        if let Some(weight) = json["package_weight"].as_object() {
            if let Some(value) = weight["value"].as_str() {
                attributes.insert("package_weight_value".to_string(), value.to_string());
            }
            if let Some(unit) = weight["unit"].as_str() {
                attributes.insert("package_weight_unit".to_string(), unit.to_string());
            }
        }

        // Add product attributes
        if let Some(prod_attrs) = json["product_attributes"].as_array() {
            let attrs_json = serde_json::to_string(prod_attrs).unwrap_or_default();
            attributes.insert("product_attributes".to_string(), attrs_json);
        }

        // Add additional metadata
        if let Some(v) = json["is_cod_allowed"].as_bool() {
            attributes.insert("is_cod_allowed".to_string(), v.to_string());
        }
        if let Some(v) = json["is_not_for_sale"].as_bool() {
            attributes.insert("is_not_for_sale".to_string(), v.to_string());
        }
        if let Some(v) = json["minimum_order_quantity"].as_i64() {
            attributes.insert("minimum_order_quantity".to_string(), v.to_string());
        }
    }

    /// Convert JSON products array to Product structs using improved mapping
    pub async fn fetch_products_with_json(
        &self,
        access_token: &str,
        page: u32,
        limit: u32,
    ) -> AppResult<Vec<Product>> {
        // Fetch raw JSON
        let json = self.fetch_products_json(access_token, page, limit).await?;

        // Get shop_id for mapping
        let shop_id = self.shop_id.as_deref().unwrap_or("");

        // Extract product array
        let data = &json["data"];
        let empty_vec = Vec::new();
        let product_array = data["products"]
            .as_array()
            .or_else(|| data["items"].as_array())
            .unwrap_or(&empty_vec);

        // Map each JSON product to Product struct
        let products: Vec<Product> = product_array
            .iter()
            .filter_map(|p| self.map_json_to_product(p, shop_id).ok())
            .collect();

        tracing::info!(
            "Fetched {} products from TikTok using JSON mapping",
            products.len()
        );

        Ok(products)
    }

    pub async fn get_shop_info_impl(&self, access_token: &str) -> AppResult<(String, String)> {
        // Get authorized shops to retrieve the shop_id and shop_cipher
        let timestamp = Utc::now().timestamp();
        let path = "/authorization/202309/shops";

        let mut params = HashMap::new();
        params.insert("app_key".to_string(), self.credentials.app_key.clone());
        params.insert("timestamp".to_string(), timestamp.to_string());

        let signature = self.generate_signature(path, &params, timestamp);
        params.insert("sign".to_string(), signature);

        let response = self
            .client
            .get(format!("{}{}", self.credentials.api_base_url, path))
            .header("x-tts-access-token", access_token)
            .header("Content-Type", "application/json")
            .query(&params)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to get shop info: {}", e)))?;

        if response.status() != StatusCode::OK {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            tracing::error!("Failed to get shop info: {}", error_text);
            return Err(AppError::ExternalApiError(format!(
                "Failed to get shop info: {}",
                error_text
            )));
        }

        // Get raw JSON response
        let raw_json: RawJsonResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse shops response: {}", e))
        })?;

        // Check API response code
        let code = raw_json.body["code"].as_i64().unwrap_or(-1);
        if code != 0 {
            let message = raw_json.body["message"].as_str().unwrap_or("Unknown error");
            return Err(AppError::ExternalApiError(format!(
                "TikTok API error: {}",
                message
            )));
        }

        // Extract shop info from the first shop
        let shop = &raw_json.body["data"]["shops"][0];
        let shop_id = shop["id"]
            .as_str()
            .ok_or_else(|| AppError::ExternalApiError("No shop ID found".to_string()))?
            .to_string();
        let shop_cipher = shop["cipher"]
            .as_str()
            .ok_or_else(|| AppError::ExternalApiError("No shop cipher found".to_string()))?
            .to_string();

        Ok((shop_id, shop_cipher))
    }

    async fn get_shop_cipher(&self, access_token: &str) -> AppResult<String> {
        // Get authorized shops to retrieve the shop_cipher
        let timestamp = Utc::now().timestamp();
        let path = "/authorization/202309/shops";

        let mut params = HashMap::new();
        params.insert("app_key".to_string(), self.credentials.app_key.clone());
        params.insert("timestamp".to_string(), timestamp.to_string());

        let signature = self.generate_signature(path, &params, timestamp);
        params.insert("sign".to_string(), signature);

        let response = self
            .client
            .get(format!("{}{}", self.credentials.api_base_url, path))
            .header("x-tts-access-token", access_token)
            .header("Content-Type", "application/json")
            .query(&params)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to get shop cipher: {}", e)))?;

        if response.status() != StatusCode::OK {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            tracing::error!("Failed to get shop cipher: {}", error_text);
            return Err(AppError::ExternalApiError(format!(
                "Failed to get shop cipher: {}",
                error_text
            )));
        }

        // Get raw JSON response
        let raw_json: RawJsonResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse shops response: {}", e))
        })?;

        // Check API response code
        let code = raw_json.body["code"].as_i64().unwrap_or(-1);
        if code != 0 {
            let message = raw_json.body["message"].as_str().unwrap_or("Unknown error");
            return Err(AppError::ExternalApiError(format!(
                "TikTok API error: {}",
                message
            )));
        }

        // Extract cipher from the first shop
        raw_json.body["data"]["shops"][0]["cipher"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| AppError::ExternalApiError("No shops found".to_string()))
    }

    pub async fn exchange_code_for_tokens_detailed(
        &self,
        code: &str,
    ) -> AppResult<(String, String, TokenData)> {
        tracing::debug!("TikTok detailed token exchange started");

        #[derive(Deserialize)]
        struct TokenResponse {
            code: i32,
            message: String,
            #[serde(default)]
            data: Option<TokenData>,
        }

        // Use configured OAuth token URL or fall back to default
        let token_url = if let Some(url) = &self.credentials.oauth_token_url {
            url.clone()
        } else {
            "https://auth.tiktok-shops.com/api/v2/token/get".to_string()
        };

        tracing::debug!("Making GET token exchange request to: {}", token_url);
        tracing::debug!(
            "Request params: app_key={}, auth_code={}, grant_type=authorized_code",
            self.credentials.app_key,
            code
        );

        // Build query parameters for GET request
        let query_params = [
            ("app_key", self.credentials.app_key.as_str()),
            ("app_secret", self.credentials.app_secret.as_str()),
            ("auth_code", code),
            ("grant_type", "authorized_code"),
        ];

        let response = self
            .client
            .get(&token_url)
            .query(&query_params)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("TikTok token exchange HTTP request failed: {}", e);
                AppError::ExternalApiError(format!("TikTok token exchange failed: {}", e))
            })?;

        tracing::debug!("Token exchange response status: {}", response.status());

        if response.status() != StatusCode::OK {
            let status = response.status();
            let response_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unable to read response".to_string());
            tracing::error!(
                "TikTok token exchange failed - Status: {}, Response: {}",
                status,
                response_text
            );
            return Err(AppError::ExternalApiError(format!(
                "TikTok token exchange failed with status: {}, response: {}",
                status, response_text
            )));
        }

        let response_text = response.text().await.map_err(|e| {
            tracing::error!("Failed to read token response text: {}", e);
            AppError::ExternalApiError(format!("Failed to read response: {}", e))
        })?;

        tracing::debug!("Token response received: {}", response_text);

        let token_response: TokenResponse = serde_json::from_str(&response_text).map_err(|e| {
            tracing::error!(
                "Failed to parse token response JSON: {}, response was: {}",
                e,
                response_text
            );
            AppError::ExternalApiError(format!("Failed to parse token response: {}", e))
        })?;

        // Check TikTok API response code
        if token_response.code != 0 {
            tracing::error!(
                "TikTok API returned error - Code: {}, Message: {}",
                token_response.code,
                token_response.message
            );
            return Err(AppError::ExternalApiError(format!(
                "TikTok API error: {} (code: {})",
                token_response.message, token_response.code
            )));
        }

        // Extract data from successful response
        let data = token_response.data.ok_or_else(|| {
            AppError::ExternalApiError("TikTok response missing data field".to_string())
        })?;

        tracing::info!(
            "TikTok detailed token exchange successful - open_id: {}, expires_in: {} seconds",
            data.open_id,
            data.access_token_expire_in
        );

        Ok((data.access_token.clone(), data.refresh_token.clone(), data))
    }

    fn generate_signature(
        &self,
        path: &str,
        params: &HashMap<String, String>,
        _timestamp: i64,
    ) -> String {
        // Step 1: Extract all query parameters excluding 'sign' and 'access_token'
        let mut sorted_params: Vec<_> = params
            .iter()
            .filter(|(k, _)| *k != "sign" && *k != "access_token")
            .collect();

        // Reorder parameters alphabetically by key
        sorted_params.sort_by_key(|&(k, _)| k);

        // Step 2: Concatenate all parameters in format {key}{value}
        let param_str: String = sorted_params
            .iter()
            .map(|(k, v)| format!("{}{}", k, v))
            .collect::<Vec<_>>()
            .join("");

        // Step 3: Append path to the beginning
        let input = format!("{}{}", path, param_str);

        // Step 4: If we had a request body (not multipart), we would append it here
        // For GET requests like product search, there's no body

        // Step 5: Wrap the string with app_secret
        let wrapped_input = format!(
            "{}{}{}",
            self.credentials.app_secret, input, self.credentials.app_secret
        );

        tracing::debug!("Signature input (before HMAC): {}", wrapped_input);

        // Step 6: Encode using HMAC-SHA256
        let mut mac = HmacSha256::new_from_slice(self.credentials.app_secret.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(wrapped_input.as_bytes());

        let result = mac.finalize();
        let signature = format!("{:x}", result.into_bytes());

        tracing::debug!("Generated HMAC-SHA256 signature: {}", signature);

        signature
    }

    pub fn generate_signature_with_body(
        &self,
        path: &str,
        params: &HashMap<String, String>,
        _timestamp: i64,
        body: &str,
    ) -> String {
        // Step 1: Extract all query parameters excluding 'sign' and 'access_token'
        let mut sorted_params: Vec<_> = params
            .iter()
            .filter(|(k, _)| *k != "sign" && *k != "access_token")
            .collect();

        // Reorder parameters alphabetically by key
        sorted_params.sort_by_key(|&(k, _)| k);

        // Step 2: Concatenate all parameters in format {key}{value}
        let param_str: String = sorted_params
            .iter()
            .map(|(k, v)| format!("{}{}", k, v))
            .collect::<Vec<_>>()
            .join("");

        // Step 3: Append path to the beginning
        let input = format!("{}{}", path, param_str);

        // Step 4: Append request body
        let input_with_body = format!("{}{}", input, body);

        // Step 5: Wrap the string with app_secret
        let wrapped_input = format!(
            "{}{}{}",
            self.credentials.app_secret, input_with_body, self.credentials.app_secret
        );

        tracing::debug!(
            "Signature input with body (before HMAC): {} chars",
            wrapped_input.len()
        );

        // Step 6: Encode using HMAC-SHA256
        let mut mac = HmacSha256::new_from_slice(self.credentials.app_secret.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(wrapped_input.as_bytes());

        let result = mac.finalize();
        let signature = format!("{:x}", result.into_bytes());

        tracing::debug!("Generated HMAC-SHA256 signature with body: {}", signature);

        signature
    }
    pub fn new(credentials: PlatformCredentials) -> Self {
        tracing::debug!(
            "TikTok Gateway credentials - oauth_authorize_url: {:?}",
            credentials.oauth_authorize_url
        );
        tracing::debug!(
            "TikTok Gateway credentials - api_base_url: {}",
            credentials.api_base_url
        );
        Self {
            credentials,
            client: Client::new(),
            shop_cipher: None,
            shop_id: None,
            access_token: None,
        }
    }

    pub fn get_oauth_url(&self, state: &str) -> String {
        self.get_oauth_url_sync(state)
    }

    fn get_oauth_url_sync(&self, state: &str) -> String {
        tracing::debug!(
            "TikTok get_oauth_url - oauth_authorize_url: {:?}",
            &self.credentials.oauth_authorize_url
        );
        tracing::debug!(
            "TikTok get_oauth_url - app_key: {:?}, state: {:?}",
            &self.credentials.app_key,
            state
        );

        let base_url = self
            .credentials
            .oauth_authorize_url
            .clone()
            .unwrap_or_else(|| {
                Self::resolve_authorize_base(self.credentials.market.as_ref()).to_string()
            });

        tracing::debug!(
            "Using OAuth URL: {} with app_key: {}",
            base_url,
            self.credentials.app_key
        );
        let redirect_uri = self.credentials.redirect_uri.clone().unwrap_or_else(|| {
            tracing::warn!("TikTok redirect_uri not configured; falling back to default callback");
            "https://app.lodashventure.local/dashboard/connect/tiktok/callback".to_string()
        });

        let mut params: Vec<(String, String)> = vec![
            ("app_key".to_string(), self.credentials.app_key.clone()),
            ("state".to_string(), state.to_string()),
            ("redirect_uri".to_string(), redirect_uri.clone()),
            ("response_type".to_string(), "code".to_string()),
        ];

        if let Some(market) = &self.credentials.market {
            if !market.trim().is_empty() {
                params.push(("market".to_string(), market.trim().to_uppercase()));
            }
        }

        if let Some(service_id) = &self.credentials.service_id {
            if !service_id.trim().is_empty() {
                params.push(("service_id".to_string(), service_id.clone()));
            }
        }

        let scopes = "seller.product.basic,seller.order.info".to_string();

        params.push(("scope".to_string(), scopes));

        let query_string = serde_urlencoded::to_string(&params).unwrap_or_else(|err| {
            tracing::error!("Failed to encode TikTok OAuth params: {}", err);
            format!(
                "app_key={}&state={}&redirect_uri={}",
                self.credentials.app_key,
                state,
                urlencoding::encode(&redirect_uri)
            )
        });

        format!("{}?{}", base_url.trim_end_matches('?'), query_string)
    }

    fn resolve_authorize_base(region: Option<&String>) -> &'static str {
        if let Some(region) = region {
            match region.trim().to_uppercase().as_str() {
                "SG" | "MY" | "TH" | "VN" | "ID" | "PH" | "BR" => {
                    "https://auth.tiktokglobalshop.com/oauth/authorize"
                }
                _ => "https://auth.tiktok-shops.com/oauth/authorize",
            }
        } else {
            "https://auth.tiktok-shops.com/oauth/authorize"
        }
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
        self.list_products_impl(access_token, page as u32, limit.unwrap_or(20) as u32)
            .await
    }

    pub async fn fetch_product_detail(
        &self,
        access_token: &str,
        product_id: &str,
    ) -> AppResult<Product> {
        self.get_product_impl(access_token, product_id).await
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
        self.exchange_code_for_tokens(code, "").await
    }

    pub async fn exchange_code_for_tokens(
        &self,
        code: &str,
        _redirect_uri: &str,
    ) -> AppResult<(String, String)> {
        tracing::debug!("TikTok token exchange started");

        // Use configured OAuth token URL or fall back to default
        let token_url = if let Some(url) = &self.credentials.oauth_token_url {
            url.clone()
        } else {
            "https://auth.tiktok-shops.com/api/v2/token/get".to_string()
        };

        tracing::debug!("Making GET token exchange request to: {}", token_url);
        tracing::debug!(
            "Request params: app_key={}, auth_code={}, grant_type=authorized_code",
            self.credentials.app_key,
            code
        );

        // Build query parameters for GET request
        let query_params = [
            ("app_key", self.credentials.app_key.as_str()),
            ("app_secret", self.credentials.app_secret.as_str()),
            ("auth_code", code),
            ("grant_type", "authorized_code"),
        ];

        let response = self
            .client
            .get(&token_url)
            .query(&query_params)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("TikTok token exchange HTTP request failed: {}", e);
                AppError::ExternalApiError(format!("TikTok token exchange failed: {}", e))
            })?;

        tracing::debug!("Token exchange response status: {}", response.status());

        if response.status() != StatusCode::OK {
            let status = response.status();
            let response_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unable to read response".to_string());
            tracing::error!(
                "TikTok token exchange failed - Status: {}, Response: {}",
                status,
                response_text
            );
            return Err(AppError::ExternalApiError(format!(
                "TikTok token exchange failed with status: {}, response: {}",
                status, response_text
            )));
        }

        // Get raw JSON response
        let raw_json: RawJsonResponse = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse token response JSON: {}", e);
            AppError::ExternalApiError(format!("Failed to parse token response: {}", e))
        })?;

        tracing::debug!("Token response received: {:?}", raw_json);

        // Check TikTok API response code
        let code = raw_json.body["code"].as_i64().unwrap_or(-1);
        if code != 0 {
            let message = raw_json.body["message"].as_str().unwrap_or("Unknown error");
            tracing::error!(
                "TikTok API returned error - Code: {}, Message: {}",
                code,
                message
            );
            return Err(AppError::ExternalApiError(format!(
                "TikTok API error: {} (code: {})",
                message, code
            )));
        }

        // Extract token data from raw JSON
        let data = &raw_json.body["data"];
        let access_token = data["access_token"]
            .as_str()
            .ok_or_else(|| AppError::ExternalApiError("Missing access_token".to_string()))?
            .to_string();
        let refresh_token = data["refresh_token"]
            .as_str()
            .ok_or_else(|| AppError::ExternalApiError("Missing refresh_token".to_string()))?
            .to_string();
        let open_id = data["open_id"].as_str().unwrap_or("unknown").to_string();
        let expires_in = data["access_token_expire_in"].as_i64().unwrap_or(0);

        tracing::info!(
            "TikTok token exchange successful - open_id: {}, expires_in: {} seconds",
            open_id,
            expires_in
        );

        Ok((access_token, refresh_token))
    }

    async fn refresh_token(&self, refresh_token: &str) -> AppResult<(String, String)> {
        self.refresh_oauth_token(refresh_token).await
    }

    async fn refresh_oauth_token(&self, refresh_token: &str) -> AppResult<(String, String)> {
        tracing::debug!("TikTok token refresh started");

        #[derive(Deserialize)]
        struct RefreshTokenResponse {
            code: i32,
            message: String,
            data: RefreshTokenData,
        }

        #[derive(Deserialize)]
        struct RefreshTokenData {
            access_token: String,
            refresh_token: String,
            access_token_expire_in: i64,
            refresh_token_expire_in: i64,
        }

        // Use configured OAuth refresh URL or fall back to default
        let refresh_url = if let Some(url) = &self.credentials.oauth_refresh_url {
            url.clone()
        } else {
            "https://auth.tiktok-shops.com/api/v2/token/refresh".to_string()
        };

        tracing::debug!("Making GET token refresh request to: {}", refresh_url);

        // Build query parameters for GET request (TikTok uses GET for refresh)
        let query_params = [
            ("app_key", self.credentials.app_key.as_str()),
            ("app_secret", self.credentials.app_secret.as_str()),
            ("refresh_token", refresh_token),
            ("grant_type", "refresh_token"),
        ];

        let response = self
            .client
            .get(&refresh_url)
            .query(&query_params)
            .send()
            .await
            .map_err(|e| {
                tracing::error!("TikTok token refresh HTTP request failed: {}", e);
                AppError::ExternalApiError(format!("TikTok token refresh failed: {}", e))
            })?;

        tracing::debug!("Token refresh response status: {}", response.status());

        if response.status() != StatusCode::OK {
            let status = response.status();
            let response_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unable to read response".to_string());
            tracing::error!(
                "TikTok token refresh failed - Status: {}, Response: {}",
                status,
                response_text
            );
            return Err(AppError::ExternalApiError(format!(
                "TikTok token refresh failed with status: {}, response: {}",
                status, response_text
            )));
        }

        let response_text = response.text().await.map_err(|e| {
            tracing::error!("Failed to read refresh response text: {}", e);
            AppError::ExternalApiError(format!("Failed to read response: {}", e))
        })?;

        tracing::debug!("Refresh response received: {}", response_text);

        let refresh_response: RefreshTokenResponse =
            serde_json::from_str(&response_text).map_err(|e| {
                tracing::error!(
                    "Failed to parse refresh response JSON: {}, response was: {}",
                    e,
                    response_text
                );
                AppError::ExternalApiError(format!("Failed to parse refresh response: {}", e))
            })?;

        // Check TikTok API response code
        if refresh_response.code != 0 {
            tracing::error!(
                "TikTok API returned error - Code: {}, Message: {}",
                refresh_response.code,
                refresh_response.message
            );
            return Err(AppError::ExternalApiError(format!(
                "TikTok API error: {} (code: {})",
                refresh_response.message, refresh_response.code
            )));
        }

        tracing::info!(
            "TikTok token refresh successful - new expires_in: {} seconds",
            refresh_response.data.access_token_expire_in
        );

        Ok((
            refresh_response.data.access_token,
            refresh_response.data.refresh_token,
        ))
    }

    async fn revoke_oauth_token(&self, token: &str) -> AppResult<()> {
        // Use configured OAuth revoke URL if available
        if let Some(revoke_url) = &self.credentials.oauth_revoke_url {
            #[derive(Serialize)]
            struct RevokeRequest {
                app_key: String,
                app_secret: String,
                access_token: String,
            }

            let request = RevokeRequest {
                app_key: self.credentials.app_key.clone(),
                app_secret: self.credentials.app_secret.clone(),
                access_token: token.to_string(),
            };

            let response = self
                .client
                .post(revoke_url)
                .json(&request)
                .send()
                .await
                .map_err(|e| {
                    AppError::ExternalApiError(format!("TikTok token revoke failed: {}", e))
                })?;

            if response.status() != StatusCode::OK {
                return Err(AppError::ExternalApiError(format!(
                    "TikTok token revoke failed with status: {}",
                    response.status()
                )));
            }
        }

        Ok(())
    }

    async fn list_products_impl(
        &self,
        access_token: &str,
        page: u32,
        limit: u32,
    ) -> AppResult<Vec<Product>> {
        let timestamp = Utc::now().timestamp();
        let path = "/product/202309/products/search";

        // Get shop info (shop_cipher and shop_id) from API if not already set
        let (shop_cipher, shop_id) =
            if let (Some(ref cipher), Some(ref id)) = (&self.shop_cipher, &self.shop_id) {
                (cipher.clone(), id.clone())
            } else {
                // Get shop info from the authorized shops endpoint
                match self.get_shop_info_impl(access_token).await {
                    Ok((id, cipher)) => {
                        tracing::info!("Got shop info - ID: {}, Cipher: {}", id, cipher);
                        (cipher, id)
                    }
                    Err(e) => {
                        tracing::warn!("Could not get shop info: {}", e);
                        ("".to_string(), "".to_string())
                    }
                }
            };

        let mut params = HashMap::new();
        params.insert("app_key".to_string(), self.credentials.app_key.clone());
        params.insert("timestamp".to_string(), timestamp.to_string());
        params.insert("page_number".to_string(), page.to_string());
        params.insert("page_size".to_string(), limit.to_string());

        // Add shop_cipher - it's required for product listing
        if !shop_cipher.is_empty() {
            params.insert("shop_cipher".to_string(), shop_cipher);
        } else {
            tracing::warn!("No shop_cipher available - TikTok API will likely reject the request");
        }

        let signature = self.generate_signature(path, &params, timestamp);
        params.insert("sign".to_string(), signature);

        tracing::info!("TikTok API request - Path: {}, Params: {:?}", path, params);

        #[derive(Deserialize)]
        struct ProductResponse {
            code: i32,
            message: String,
            data: ProductData,
            request_id: Option<String>,
        }

        #[derive(Deserialize, Debug)]
        struct ProductData {
            #[serde(default)]
            products: Option<Vec<TikTokProduct>>,
            #[serde(default)]
            items: Option<Vec<TikTokProduct>>, // Some API versions use 'items' instead of 'products'
            #[serde(default)]
            total_count: Option<i32>, // TikTok uses total_count
            total: Option<i32>, // Keep for compatibility
            next_page_token: Option<String>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokProduct {
            #[serde(alias = "product_id")]
            id: String,
            #[serde(alias = "product_status")]
            status: Option<String>, // e.g., "ACTIVATE", "SELLER_DEACTIVATED"
            #[serde(alias = "product_name")]
            title: String,
            description: Option<String>,
            #[serde(default)]
            category_chains: Vec<CategoryChain>,
            brand: Option<TikTokBrand>,
            #[serde(default)]
            main_images: Vec<TikTokImage>,
            video: Option<TikTokVideo>,
            skus: Vec<TikTokSku>,
            #[serde(default)]
            certifications: Vec<TikTokCertification>,
            size_chart: Option<TikTokSizeChart>,
            is_cod_allowed: Option<bool>,
            #[serde(default)]
            product_attributes: Vec<TikTokProductAttribute>,
            #[serde(default)]
            audit_failed_reasons: Vec<TikTokAuditFailedReason>,
            update_time: Option<i64>,
            create_time: Option<i64>,
            #[serde(default)]
            delivery_options: Vec<TikTokDeliveryOption>,
            external_product_id: Option<String>,
            #[serde(default)]
            product_types: Vec<String>,
            is_not_for_sale: Option<bool>,
            #[serde(default)]
            recommended_categories: Vec<serde_json::Value>,
            #[serde(default)]
            manufacturer_ids: Vec<String>,
            #[serde(default)]
            responsible_person_ids: Vec<String>,
            listing_quality_tier: Option<String>,
            #[serde(default)]
            integrated_platform_statuses: Vec<TikTokIntegratedPlatformStatus>,
            shipping_insurance_requirement: Option<String>,
            minimum_order_quantity: Option<i32>,
            is_pre_owned: Option<bool>,
            audit: Option<TikTokAudit>,
            global_product_association: Option<serde_json::Value>,
            prescription_requirement: Option<TikTokPrescriptionRequirement>,
            #[serde(default)]
            product_families: Vec<serde_json::Value>,
            has_draft: Option<bool>,
            package_dimensions: Option<TikTokPackageDimensions>,
            package_weight: Option<TikTokPackageWeight>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokBrand {
            id: String,
            name: String,
        }

        #[derive(Deserialize, Serialize, Debug)]
        struct TikTokImage {
            height: Option<i32>,
            width: Option<i32>,
            #[serde(default)]
            thumb_urls: Vec<String>,
            uri: String,
            #[serde(default)]
            urls: Vec<String>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokVideo {
            id: String,
            cover_url: Option<String>,
            format: Option<String>,
            url: Option<String>,
            width: Option<i32>,
            height: Option<i32>,
            size: Option<i64>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokCertification {
            id: String,
            title: String,
            #[serde(default)]
            files: Vec<serde_json::Value>,
            #[serde(default)]
            images: Vec<TikTokImage>,
            expiration_date: Option<i64>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokSizeChart {
            image: Option<TikTokImage>,
            template: Option<serde_json::Value>,
        }

        #[derive(Deserialize, Serialize, Debug)]
        struct TikTokProductAttribute {
            id: String,
            name: String,
            #[serde(default)]
            values: Vec<TikTokAttributeValue>,
        }

        #[derive(Deserialize, Serialize, Debug)]
        struct TikTokAttributeValue {
            id: String,
            name: String,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokAuditFailedReason {
            position: String,
            #[serde(default)]
            reasons: Vec<String>,
            #[serde(default)]
            suggestions: Vec<String>,
            listing_platform: Option<String>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokDeliveryOption {
            id: String,
            name: String,
            is_available: bool,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokIntegratedPlatformStatus {
            platform: String,
            status: String,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokAudit {
            status: String,
            #[serde(default)]
            pre_approved_reasons: Vec<String>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokPrescriptionRequirement {
            needs_prescription: bool,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokPackageDimensions {
            length: String,
            width: String,
            height: String,
            unit: String,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokPackageWeight {
            value: String,
            unit: String,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokSku {
            id: String, // SKU ID from TikTok
            seller_sku: String,
            price: TikTokPrice,
            #[serde(default)]
            inventory: Vec<TikTokInventory>,
            identifier_code: Option<TikTokIdentifierCode>,
            #[serde(default)]
            sales_attributes: Vec<TikTokSalesAttribute>,
            external_sku_id: Option<String>,
            #[serde(default)]
            combined_skus: Vec<serde_json::Value>,
            global_listing_policy: Option<serde_json::Value>,
            sku_unit_count: Option<String>,
            #[serde(default)]
            external_urls: Vec<String>,
            #[serde(default)]
            extra_identifier_codes: Vec<String>,
            pre_sale: Option<serde_json::Value>,
            list_price: Option<TikTokListPrice>,
            #[serde(default)]
            external_list_prices: Vec<serde_json::Value>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokIdentifierCode {
            code: String,
            #[serde(rename = "type")]
            code_type: String,
        }

        #[derive(Deserialize, Serialize, Debug)]
        struct TikTokSalesAttribute {
            id: String,
            name: String,
            value_id: String,
            value_name: String,
            sku_img: Option<TikTokImage>,
            #[serde(default)]
            supplementary_sku_images: Vec<TikTokImage>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokListPrice {
            amount: String,
            currency: String,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokPrice {
            currency: String,
            sale_price: Option<String>, // Can be a string like "117.5"
            tax_exclusive_price: Option<String>, // Can be a string like "110"
            unit_price: Option<String>, // Unit price if applicable
        }

        #[derive(Deserialize, Debug)]
        struct TikTokInventory {
            quantity: i32,
            warehouse_id: String,
        }

        #[derive(Deserialize, Debug)]
        struct CategoryChain {
            id: String,
            parent_id: Option<String>,
            local_name: String,
            is_leaf: Option<bool>,
        }

        let url = format!("{}{}", self.credentials.api_base_url, path);
        tracing::info!("Making request to TikTok API: {}", url);

        let response = self
            .client
            .post(&url)
            .header("x-tts-access-token", access_token)
            .header("Content-Type", "application/json")
            .query(&params)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("TikTok list products failed: {}", e))
            })?;

        let status = response.status();
        if status != StatusCode::OK {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unable to read response".to_string());
            tracing::error!(
                "TikTok API error - Status: {}, Response: {}",
                status,
                error_text
            );
            return Err(AppError::ExternalApiError(format!(
                "TikTok list products failed with status: {} - {}",
                status, error_text
            )));
        }

        let response_text = response
            .text()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to read response: {}", e)))?;

        // Log the raw response to understand the structure
        tracing::info!("TikTok API raw response: {}", response_text);

        // Try to parse as generic JSON first to understand structure
        if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&response_text) {
            tracing::info!("Response structure: {:#?}", json_value);
        }

        // First check if this is an error response
        if let Ok(error_response) = serde_json::from_str::<serde_json::Value>(&response_text) {
            if let Some(code) = error_response.get("code").and_then(|v| v.as_i64()) {
                if code != 0 {
                    let message = error_response
                        .get("message")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown error");
                    return Err(AppError::ExternalApiError(format!(
                        "TikTok API error: {} (code: {})",
                        message, code
                    )));
                }
            }
        }

        let product_response: ProductResponse =
            serde_json::from_str(&response_text).map_err(|e| {
                tracing::error!(
                    "Failed to parse TikTok response: {}, Response first 500 chars: {}",
                    e,
                    &response_text.chars().take(500).collect::<String>()
                );
                AppError::ExternalApiError(format!("Failed to parse products response: {}", e))
            })?;

        // Check if the API returned an error code
        if product_response.code != 0 {
            tracing::error!(
                "TikTok API returned error - Code: {}, Message: {}",
                product_response.code,
                product_response.message
            );
            return Err(AppError::ExternalApiError(format!(
                "TikTok API error: {} (code: {})",
                product_response.message, product_response.code
            )));
        }

        // Use products if available, otherwise fall back to items
        let product_list = if let Some(products) = product_response.data.products {
            products
        } else if let Some(items) = product_response.data.items {
            items
        } else {
            // Return empty list if no products found
            tracing::warn!("No products found in TikTok response");
            Vec::new()
        };

        let products = product_list
            .into_iter()
            .map(|p| {
                // Extract product ID - it's now a required field
                let product_id = p.id.clone();

                // Extract product name/title
                let title = p.title.clone();

                let sku = p.skus.first();

                // Parse price from string to Price struct
                let price_amount = sku
                    .and_then(|s| {
                        s.price
                            .sale_price
                            .as_ref()
                            .or(s.price.tax_exclusive_price.as_ref())
                            .and_then(|price_str| price_str.parse::<f64>().ok())
                    })
                    .unwrap_or(0.0);

                let currency = sku
                    .map(|s| s.price.currency.clone())
                    .unwrap_or_else(|| "USD".to_string());

                let price = Price {
                    amount: rust_decimal::Decimal::from_f64_retain(price_amount)
                        .unwrap_or(rust_decimal::Decimal::ZERO),
                    currency: currency.clone(),
                    original_price: None,
                    discount_percentage: None,
                };

                let quantity = sku
                    .and_then(|s| s.inventory.first())
                    .map(|i| i.quantity)
                    .unwrap_or(0) as i16;

                // Determine status based on string value
                let status = match p.status.as_deref() {
                    Some("ACTIVATE") | Some("ACTIVE") => ProductStatus::Active,
                    Some("SELLER_DEACTIVATED") => ProductStatus::Inactive,
                    _ => ProductStatus::Inactive,
                };

                // Extract image URLs from main_images
                let images: Vec<ProductImage> = p
                    .main_images
                    .into_iter()
                    .flat_map(|img| img.urls)
                    .enumerate()
                    .map(|(idx, url)| ProductImage {
                        url,
                        alt: None,
                        is_primary: idx == 0,
                        position: idx as i32,
                    })
                    .collect();

                // Extract categories
                let categories = p
                    .category_chains
                    .into_iter()
                    .map(|c| c.local_name)
                    .collect();

                // Build comprehensive attributes
                let mut attributes = HashMap::new();
                if let Some(create_time) = p.create_time {
                    attributes.insert("create_time".to_string(), create_time.to_string());
                }
                if let Some(update_time) = p.update_time {
                    attributes.insert("update_time".to_string(), update_time.to_string());
                }

                if let Some(s) = sku {
                    attributes.insert("sku_id".to_string(), s.id.clone());
                    if let Some(inv) = s.inventory.first() {
                        attributes.insert("warehouse_id".to_string(), inv.warehouse_id.clone());
                    }
                }

                // Add brand info if available
                if let Some(brand) = p.brand {
                    attributes.insert("brand_id".to_string(), brand.id);
                    attributes.insert("brand_name".to_string(), brand.name);
                }

                // Add package dimensions if available
                if let Some(dims) = p.package_dimensions {
                    attributes.insert("package_length".to_string(), dims.length);
                    attributes.insert("package_width".to_string(), dims.width);
                    attributes.insert("package_height".to_string(), dims.height);
                    attributes.insert("package_dim_unit".to_string(), dims.unit);
                }

                // Add package weight if available
                if let Some(weight) = p.package_weight {
                    attributes.insert("package_weight_value".to_string(), weight.value);
                    attributes.insert("package_weight_unit".to_string(), weight.unit);
                }

                // Add product attributes if available
                if !p.product_attributes.is_empty() {
                    let attr_json =
                        serde_json::to_string(&p.product_attributes).unwrap_or_default();
                    attributes.insert("product_attributes".to_string(), attr_json);
                }

                // Add sales attributes from SKU if available
                if let Some(sku) = sku {
                    if !sku.sales_attributes.is_empty() {
                        let attr_json =
                            serde_json::to_string(&sku.sales_attributes).unwrap_or_default();
                        attributes.insert("sales_attributes".to_string(), attr_json);
                    }

                    // Add identifier code if available
                    if let Some(code) = &sku.identifier_code {
                        attributes.insert("identifier_code".to_string(), code.code.clone());
                        attributes
                            .insert("identifier_type".to_string(), code.code_type.to_string());
                    }
                }

                // Add additional product metadata
                if let Some(is_cod_allowed) = p.is_cod_allowed {
                    attributes.insert("is_cod_allowed".to_string(), is_cod_allowed.to_string());
                }
                if let Some(is_not_for_sale) = p.is_not_for_sale {
                    attributes.insert("is_not_for_sale".to_string(), is_not_for_sale.to_string());
                }
                if let Some(is_pre_owned) = p.is_pre_owned {
                    attributes.insert("is_pre_owned".to_string(), is_pre_owned.to_string());
                }
                if let Some(min_order_qty) = p.minimum_order_quantity {
                    attributes.insert(
                        "minimum_order_quantity".to_string(),
                        min_order_qty.to_string(),
                    );
                }
                if let Some(tier) = p.listing_quality_tier {
                    attributes.insert("listing_quality_tier".to_string(), tier.to_string());
                }
                if let Some(has_draft) = p.has_draft {
                    attributes.insert("has_draft".to_string(), has_draft.to_string());
                }

                Product {
                    product_id: product_id.clone(),
                    platform_product_id: p.id.clone(),
                    shop_id: "".to_string(),
                    platform_shop_id: shop_id.clone(),
                    platform: PlatformType::TikTok,
                    title,
                    description: p.description,
                    price,
                    brand: "".to_string(),
                    currency,
                    sku: sku.map(|s| s.seller_sku.clone()).unwrap_or_default(),
                    quantity,
                    images,
                    categories,
                    attributes,
                    status,
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                    synced_at: Some(chrono::Utc::now()),
                }
            })
            .collect();

        Ok(products)
    }

    async fn get_product_impl(&self, access_token: &str, product_id: &str) -> AppResult<Product> {
        let timestamp = Utc::now().timestamp();
        let path = format!("/product/202309/products/{}", product_id);

        // Get shop info (shop_cipher and shop_id) from API if not already set
        let (shop_cipher, shop_id) =
            if let (Some(ref cipher), Some(ref id)) = (&self.shop_cipher, &self.shop_id) {
                (cipher.clone(), id.clone())
            } else {
                // Get shop info from the authorized shops endpoint
                match self.get_shop_info_impl(access_token).await {
                    Ok((id, cipher)) => {
                        tracing::info!("Got shop info - ID: {}, Cipher: {}", id, cipher);
                        (cipher, id)
                    }
                    Err(e) => {
                        tracing::warn!("Could not get shop info: {}", e);
                        ("".to_string(), "".to_string())
                    }
                }
            };

        let mut params = HashMap::new();
        params.insert("app_key".to_string(), self.credentials.app_key.clone());
        params.insert("timestamp".to_string(), timestamp.to_string());

        // Add shop_cipher if available
        if !shop_cipher.is_empty() {
            params.insert("shop_cipher".to_string(), shop_cipher);
        }

        let signature = self.generate_signature(&path, &params, timestamp);
        params.insert("sign".to_string(), signature);

        tracing::debug!("TikTok get product - Path: {}, Params: {:?}", path, params);

        #[derive(Deserialize, Debug)]
        struct ProductDetailResponse {
            code: i32,
            message: String,
            data: Option<TikTokProductDetail>,
            request_id: Option<String>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokProductDetail {
            id: String,
            status: Option<String>,
            title: String,
            description: Option<String>,
            #[serde(default)]
            main_images: Vec<TikTokImage>,
            video: Option<TikTokVideo>,
            #[serde(default)]
            category_chains: Vec<TikTokCategoryChain>,
            brand: Option<TikTokBrand>,
            #[serde(default)]
            skus: Vec<TikTokDetailSku>,
            #[serde(default)]
            certifications: Vec<TikTokCertification>,
            size_chart: Option<TikTokSizeChart>,
            is_cod_allowed: Option<bool>,
            #[serde(default)]
            product_attributes: Vec<TikTokAttribute>,
            #[serde(default)]
            audit_failed_reasons: Vec<TikTokAuditReason>,
            #[serde(default)]
            delivery_options: Vec<TikTokDeliveryOption>,
            external_product_id: Option<String>,
            #[serde(default)]
            product_types: Vec<String>,
            is_not_for_sale: Option<bool>,
            #[serde(default)]
            recommended_categories: Vec<TikTokRecommendedCategory>,
            #[serde(default)]
            manufacturer_ids: Vec<String>,
            #[serde(default)]
            responsible_person_ids: Vec<String>,
            listing_quality_tier: Option<String>,
            #[serde(default)]
            integrated_platform_statuses: Vec<TikTokPlatformStatus>,
            shipping_insurance_requirement: Option<String>,
            minimum_order_quantity: Option<i32>,
            is_pre_owned: Option<bool>,
            audit: Option<TikTokAudit>,
            global_product_association: Option<TikTokGlobalProductAssoc>,
            prescription_requirement: Option<TikTokPrescriptionReq>,
            #[serde(default)]
            product_families: Vec<TikTokProductFamily>,
            has_draft: Option<bool>,
            #[serde(default)]
            sales_regions: Vec<String>,
            package_dimensions: Option<TikTokPackageDimensions>,
            package_weight: Option<TikTokPackageWeight>,
            create_time: Option<i64>,
            update_time: Option<i64>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokImage {
            height: Option<i32>,
            width: Option<i32>,
            #[serde(default)]
            thumb_urls: Vec<String>,
            uri: Option<String>,
            #[serde(default)]
            urls: Vec<String>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokVideo {
            id: Option<String>,
            cover_url: Option<String>,
            format: Option<String>,
            url: Option<String>,
            width: Option<i32>,
            height: Option<i32>,
            size: Option<i32>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokCategoryChain {
            id: String,
            parent_id: Option<String>,
            local_name: String,
            is_leaf: Option<bool>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokBrand {
            id: String,
            name: String,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokDetailSku {
            id: String,
            seller_sku: Option<String>,
            price: Option<TikTokPrice>,
            #[serde(default)]
            inventory: Vec<TikTokInventory>,
            identifier_code: Option<TikTokIdentifierCode>,
            #[serde(default)]
            sales_attributes: Vec<TikTokSalesAttribute>,
            external_sku_id: Option<String>,
            #[serde(default)]
            combined_skus: Vec<TikTokCombinedSku>,
            global_listing_policy: Option<TikTokGlobalListingPolicy>,
            sku_unit_count: Option<String>,
            #[serde(default)]
            external_urls: Vec<String>,
            #[serde(default)]
            extra_identifier_codes: Vec<String>,
            pre_sale: Option<TikTokPreSale>,
            list_price: Option<TikTokListPrice>,
            #[serde(default)]
            external_list_prices: Vec<TikTokExternalListPrice>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokIdentifierCode {
            code: Option<String>,
            #[serde(rename = "type")]
            code_type: Option<String>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokCombinedSku {
            product_id: Option<String>,
            sku_id: Option<String>,
            sku_count: Option<i32>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokGlobalListingPolicy {
            price_sync: Option<bool>,
            inventory_type: Option<String>,
            replicate_source: Option<TikTokReplicateSource>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokReplicateSource {
            product_id: Option<String>,
            shop_id: Option<String>,
            sku_id: Option<String>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokPreSale {
            #[serde(rename = "type")]
            sale_type: Option<String>,
            fulfillment_type: Option<TikTokFulfillmentType>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokFulfillmentType {
            handling_duration_days: Option<i32>,
            release_date: Option<i64>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokListPrice {
            amount: Option<String>,
            currency: Option<String>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokExternalListPrice {
            source: Option<String>,
            amount: Option<String>,
            currency: Option<String>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokPrice {
            tax_exclusive_price: Option<String>,
            sale_price: Option<String>,
            currency: Option<String>,
            unit_price: Option<String>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokInventory {
            warehouse_id: String,
            quantity: i32,
        }

        #[derive(Deserialize, Serialize, Debug)]
        struct TikTokSalesAttribute {
            id: String,
            name: String,
            value_id: String,
            value_name: String,
            sku_img: Option<TikTokImage>,
            #[serde(default)]
            supplementary_sku_images: Vec<TikTokImage>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokCertification {
            id: Option<String>,
            title: Option<String>,
            #[serde(default)]
            files: Vec<TikTokCertFile>,
            #[serde(default)]
            images: Vec<TikTokImage>,
            expiration_date: Option<i64>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokCertFile {
            id: Option<String>,
            #[serde(default)]
            urls: Vec<String>,
            name: Option<String>,
            format: Option<String>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokSizeChart {
            image: Option<TikTokImage>,
            template: Option<TikTokSizeChartTemplate>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokSizeChartTemplate {
            id: Option<String>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokAuditReason {
            position: Option<String>,
            #[serde(default)]
            reasons: Vec<String>,
            #[serde(default)]
            suggestions: Vec<String>,
            listing_platform: Option<String>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokDeliveryOption {
            id: Option<String>,
            name: Option<String>,
            is_available: Option<bool>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokRecommendedCategory {
            id: Option<String>,
            local_name: Option<String>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokPlatformStatus {
            platform: Option<String>,
            status: Option<String>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokAudit {
            status: Option<String>,
            #[serde(default)]
            pre_approved_reasons: Vec<String>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokGlobalProductAssoc {
            global_product_id: Option<String>,
            #[serde(default)]
            sku_mappings: Vec<TikTokSkuMapping>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokSkuMapping {
            global_sku_id: Option<String>,
            local_sku_id: Option<String>,
            #[serde(default)]
            sales_attribute_mappings: Vec<TikTokAttributeMapping>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokAttributeMapping {
            local_attribute_id: Option<String>,
            global_attribute_id: Option<String>,
            local_value_id: Option<String>,
            global_value_id: Option<String>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokPrescriptionReq {
            needs_prescription: Option<bool>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokProductFamily {
            id: Option<String>,
            #[serde(default)]
            products: Vec<TikTokProductRef>,
        }

        #[derive(Deserialize, Debug, Serialize)]
        struct TikTokProductRef {
            id: Option<String>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokAttribute {
            id: String,
            name: String,
            #[serde(default)]
            values: Vec<TikTokAttributeValue>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokAttributeValue {
            id: String,
            name: String,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokPackageDimensions {
            length: Option<String>,
            width: Option<String>,
            height: Option<String>,
            unit: Option<String>,
        }

        #[derive(Deserialize, Debug)]
        struct TikTokPackageWeight {
            value: Option<String>,
            unit: Option<String>,
        }

        let response = self
            .client
            .get(format!("{}{}", self.credentials.api_base_url, path))
            .header("x-tts-access-token", access_token)
            .header("Content-Type", "application/json")
            .query(&params)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("TikTok get product failed: {}", e)))?;

        if response.status() != StatusCode::OK {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            tracing::error!("TikTok get product failed: {}", error_text);
            return Err(AppError::ExternalApiError(format!(
                "TikTok get product failed: {}",
                error_text
            )));
        }

        let response_text = response
            .text()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to read response: {}", e)))?;

        tracing::debug!("TikTok product detail response: {}", response_text);

        let product_response: ProductDetailResponse = serde_json::from_str(&response_text)
            .map_err(|e| {
                AppError::ExternalApiError(format!("Failed to parse product response: {}", e))
            })?;

        if product_response.code != 0 {
            return Err(AppError::ExternalApiError(format!(
                "TikTok API error: {} (code: {})",
                product_response.message, product_response.code
            )));
        }

        let product_detail = product_response
            .data
            .ok_or_else(|| AppError::ExternalApiError("Product not found".to_string()))?;

        // Map TikTok product to unified Product model
        let status = match product_detail.status.as_deref() {
            Some("ACTIVATE") | Some("SELLER_DEACTIVATED") => ProductStatus::Active,
            _ => ProductStatus::Inactive,
        };

        // Extract first SKU price and inventory
        let (price, currency, quantity) = if let Some(first_sku) = product_detail.skus.first() {
            let price = first_sku
                .price
                .as_ref()
                .and_then(|p| p.tax_exclusive_price.as_ref())
                .and_then(|p| p.parse::<f64>().ok())
                .unwrap_or(0.0);

            let currency = first_sku
                .price
                .as_ref()
                .and_then(|p| p.currency.clone())
                .unwrap_or_else(|| "USD".to_string());

            let quantity = first_sku
                .inventory
                .first()
                .map(|inv| inv.quantity)
                .unwrap_or(0);

            (price, currency, quantity)
        } else {
            (0.0, "USD".to_string(), 0)
        };

        // Extract main images
        let images: Vec<ProductImage> = product_detail
            .main_images
            .into_iter()
            .flat_map(|img| img.urls)
            .enumerate()
            .map(|(idx, url)| ProductImage {
                url,
                alt: None,
                is_primary: idx == 0,
                position: idx as i32,
            })
            .collect();

        // Extract categories
        let categories = product_detail
            .category_chains
            .into_iter()
            .map(|cat| cat.local_name)
            .collect();

        // Build attributes JSON including sales_regions, SKU details, etc.
        let mut attributes = serde_json::json!({});

        // Add sales regions
        if !product_detail.sales_regions.is_empty() {
            attributes["sales_regions"] = serde_json::json!(product_detail.sales_regions);
        }

        // Add brand info
        if let Some(brand) = product_detail.brand {
            attributes["brand_id"] = serde_json::json!(brand.id);
            attributes["brand_name"] = serde_json::json!(brand.name);
        }

        // Add video info
        if let Some(video) = product_detail.video {
            attributes["video"] = serde_json::json!({
                "id": video.id,
                "cover_url": video.cover_url,
                "format": video.format,
                "url": video.url,
                "width": video.width,
                "height": video.height,
                "size": video.size
            });
        }

        // Add certifications
        if !product_detail.certifications.is_empty() {
            attributes["certifications"] = serde_json::json!(product_detail.certifications);
        }

        // Add size chart
        if let Some(size_chart) = product_detail.size_chart {
            attributes["size_chart"] = serde_json::json!(size_chart);
        }

        // Add COD allowed flag
        if let Some(cod) = product_detail.is_cod_allowed {
            attributes["is_cod_allowed"] = serde_json::json!(cod);
        }

        // Add audit information
        if !product_detail.audit_failed_reasons.is_empty() {
            attributes["audit_failed_reasons"] =
                serde_json::json!(product_detail.audit_failed_reasons);
        }

        if let Some(audit) = product_detail.audit {
            attributes["audit"] = serde_json::json!(audit);
        }

        // Add delivery options
        if !product_detail.delivery_options.is_empty() {
            attributes["delivery_options"] = serde_json::json!(product_detail.delivery_options);
        }

        // Add external product ID
        if let Some(ext_id) = product_detail.external_product_id {
            attributes["external_product_id"] = serde_json::json!(ext_id);
        }

        // Add product types
        if !product_detail.product_types.is_empty() {
            attributes["product_types"] = serde_json::json!(product_detail.product_types);
        }

        // Add flags
        if let Some(not_for_sale) = product_detail.is_not_for_sale {
            attributes["is_not_for_sale"] = serde_json::json!(not_for_sale);
        }

        if let Some(pre_owned) = product_detail.is_pre_owned {
            attributes["is_pre_owned"] = serde_json::json!(pre_owned);
        }

        // Add recommended categories
        if !product_detail.recommended_categories.is_empty() {
            attributes["recommended_categories"] =
                serde_json::json!(product_detail.recommended_categories);
        }

        // Add manufacturer and responsible person IDs
        if !product_detail.manufacturer_ids.is_empty() {
            attributes["manufacturer_ids"] = serde_json::json!(product_detail.manufacturer_ids);
        }

        if !product_detail.responsible_person_ids.is_empty() {
            attributes["responsible_person_ids"] =
                serde_json::json!(product_detail.responsible_person_ids);
        }

        // Add listing quality tier
        if let Some(tier) = product_detail.listing_quality_tier {
            attributes["listing_quality_tier"] = serde_json::json!(tier);
        }

        // Add integrated platform statuses
        if !product_detail.integrated_platform_statuses.is_empty() {
            attributes["integrated_platform_statuses"] =
                serde_json::json!(product_detail.integrated_platform_statuses);
        }

        // Add shipping insurance requirement
        if let Some(insurance) = product_detail.shipping_insurance_requirement {
            attributes["shipping_insurance_requirement"] = serde_json::json!(insurance);
        }

        // Add minimum order quantity
        if let Some(moq) = product_detail.minimum_order_quantity {
            attributes["minimum_order_quantity"] = serde_json::json!(moq);
        }

        // Add global product association
        if let Some(global_assoc) = product_detail.global_product_association {
            attributes["global_product_association"] = serde_json::json!(global_assoc);
        }

        // Add prescription requirement
        if let Some(prescription) = product_detail.prescription_requirement {
            attributes["prescription_requirement"] = serde_json::json!(prescription);
        }

        // Add product families
        if !product_detail.product_families.is_empty() {
            attributes["product_families"] = serde_json::json!(product_detail.product_families);
        }

        // Add draft flag
        if let Some(has_draft) = product_detail.has_draft {
            attributes["has_draft"] = serde_json::json!(has_draft);
        }

        // Add product attributes
        if !product_detail.product_attributes.is_empty() {
            let attrs: Vec<serde_json::Value> = product_detail
                .product_attributes
                .into_iter()
                .map(|attr| {
                    serde_json::json!({
                        "id": attr.id,
                        "name": attr.name,
                        "values": attr.values.into_iter().map(|v| {
                            serde_json::json!({
                                "id": v.id,
                                "name": v.name
                            })
                        }).collect::<Vec<_>>()
                    })
                })
                .collect();
            attributes["product_attributes"] = serde_json::json!(attrs);
        }

        // Add SKU information
        let sku_data: Vec<serde_json::Value> = product_detail
            .skus
            .into_iter()
            .map(|sku| {
                let mut sku_obj = serde_json::json!({
                    "sku_id": sku.id,
                    "seller_sku": sku.seller_sku,
                });

                if let Some(price) = sku.price {
                    sku_obj["price"] = serde_json::json!({
                        "tax_exclusive": price.tax_exclusive_price,
                        "sale_price": price.sale_price,
                        "currency": price.currency,
                        "unit_price": price.unit_price
                    });
                }

                if !sku.inventory.is_empty() {
                    sku_obj["inventory"] = serde_json::json!(sku
                        .inventory
                        .into_iter()
                        .map(|inv| {
                            serde_json::json!({
                                "warehouse_id": inv.warehouse_id,
                                "quantity": inv.quantity
                            })
                        })
                        .collect::<Vec<_>>());
                }

                if let Some(identifier_code) = sku.identifier_code {
                    sku_obj["identifier_code"] = serde_json::json!({
                        "code": identifier_code.code,
                        "type": identifier_code.code_type
                    });
                }

                if !sku.sales_attributes.is_empty() {
                    sku_obj["sales_attributes"] = serde_json::json!(sku
                        .sales_attributes
                        .into_iter()
                        .map(|attr| {
                            let mut attr_obj = serde_json::json!({
                                "id": attr.id,
                                "name": attr.name,
                                "value_id": attr.value_id,
                                "value_name": attr.value_name
                            });

                            if let Some(sku_img) = attr.sku_img {
                                attr_obj["sku_img"] = serde_json::json!(sku_img);
                            }

                            if !attr.supplementary_sku_images.is_empty() {
                                attr_obj["supplementary_sku_images"] =
                                    serde_json::json!(attr.supplementary_sku_images);
                            }

                            attr_obj
                        })
                        .collect::<Vec<_>>());
                }

                if let Some(external_sku_id) = sku.external_sku_id {
                    sku_obj["external_sku_id"] = serde_json::json!(external_sku_id);
                }

                if !sku.combined_skus.is_empty() {
                    sku_obj["combined_skus"] = serde_json::json!(sku.combined_skus);
                }

                if let Some(global_listing_policy) = sku.global_listing_policy {
                    sku_obj["global_listing_policy"] = serde_json::json!(global_listing_policy);
                }

                if let Some(sku_unit_count) = sku.sku_unit_count {
                    sku_obj["sku_unit_count"] = serde_json::json!(sku_unit_count);
                }

                if !sku.external_urls.is_empty() {
                    sku_obj["external_urls"] = serde_json::json!(sku.external_urls);
                }

                if !sku.extra_identifier_codes.is_empty() {
                    sku_obj["extra_identifier_codes"] =
                        serde_json::json!(sku.extra_identifier_codes);
                }

                if let Some(pre_sale) = sku.pre_sale {
                    sku_obj["pre_sale"] = serde_json::json!(pre_sale);
                }

                if let Some(list_price) = sku.list_price {
                    sku_obj["list_price"] = serde_json::json!(list_price);
                }

                if !sku.external_list_prices.is_empty() {
                    sku_obj["external_list_prices"] = serde_json::json!(sku.external_list_prices);
                }

                sku_obj
            })
            .collect();

        if !sku_data.is_empty() {
            attributes["skus"] = serde_json::json!(sku_data);
        }

        // Add package dimensions
        if let Some(dims) = product_detail.package_dimensions {
            attributes["package_dimensions"] = serde_json::json!({
                "length": dims.length,
                "width": dims.width,
                "height": dims.height,
                "unit": dims.unit
            });
        }

        // Add package weight
        if let Some(weight) = product_detail.package_weight {
            attributes["package_weight"] = serde_json::json!({
                "value": weight.value,
                "unit": weight.unit
            });
        }

        Ok(Product {
            product_id: product_detail.id.clone(),
            platform_product_id: product_detail.id.clone(),
            shop_id: String::new(), // Will be set by the caller
            platform_shop_id: if !shop_id.is_empty() {
                shop_id
            } else {
                String::new()
            }, // Set the actual TikTok shop ID
            platform: PlatformType::TikTok,
            title: product_detail.title,
            brand: "".to_string(),
            description: product_detail.description,
            price: Price {
                amount: rust_decimal::Decimal::from_f64_retain(price)
                    .unwrap_or(rust_decimal::Decimal::ZERO),
                currency: currency.clone(),
                original_price: None,
                discount_percentage: None,
            },
            currency,
            sku: product_detail.id, // Use product ID as default SKU
            quantity: quantity as i16,
            images,
            categories,
            attributes: serde_json::from_value(attributes).unwrap_or_default(),
            status,
            created_at: product_detail
                .create_time
                .map(|t| chrono::DateTime::from_timestamp(t, 0).unwrap_or_else(Utc::now))
                .unwrap_or_else(Utc::now),
            updated_at: product_detail
                .update_time
                .map(|t| chrono::DateTime::from_timestamp(t, 0).unwrap_or_else(Utc::now))
                .unwrap_or_else(Utc::now),
            synced_at: Some(Utc::now()),
        })
    }

    async fn sync_inventory(&self, access_token: &str) -> AppResult<Vec<Product>> {
        // For TikTok, sync inventory means getting all products with updated stock levels
        // We'll fetch products in batches and include their current inventory levels
        let mut all_products = Vec::new();
        let mut page = 1;
        let page_size = 50;
        let max_pages = 10; // Limit to prevent infinite loops

        tracing::info!("Starting TikTok inventory sync");

        loop {
            let products = self
                .list_products_impl(access_token, page, page_size)
                .await?;

            if products.is_empty() || page >= max_pages {
                break;
            }

            all_products.extend(products);
            page += 1;

            // Add a small delay between requests to avoid rate limiting
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }

        tracing::info!(
            "TikTok inventory sync completed - {} products synced",
            all_products.len()
        );
        Ok(all_products)
    }

    async fn create_product_impl(
        &self,
        access_token: &str,
        product: &Product,
    ) -> AppResult<Product> {
        let timestamp = Utc::now().timestamp();
        let path = "/product/202309/products";

        // Get shop info (shop_cipher and shop_id) from API if not already set
        let (shop_cipher, shop_id) =
            if let (Some(ref cipher), Some(ref id)) = (&self.shop_cipher, &self.shop_id) {
                (cipher.clone(), id.clone())
            } else {
                // Get shop info from the authorized shops endpoint
                match self.get_shop_info_impl(access_token).await {
                    Ok((id, cipher)) => {
                        tracing::info!("Got shop info - ID: {}, Cipher: {}", id, cipher);
                        (cipher, id)
                    }
                    Err(e) => {
                        return Err(AppError::ExternalApiError(format!(
                            "Cannot create product without shop info: {}",
                            e
                        )));
                    }
                }
            };

        let mut params = HashMap::new();

        params.insert("timestamp".to_string(), timestamp.to_string());
        params.insert("shop_cipher".to_string(), shop_cipher.clone());

        // Build the product creation request body
        let request_body = serde_json::json!({
            "title": product.title,
            "description": product.description.as_deref().unwrap_or(""),
            "category_id": product.categories.first().cloned().unwrap_or_else(|| "0".to_string()),
            "brand": if product.brand.is_empty() { "" } else { &product.brand },
            "images": product.images,
            "skus": [{
                "seller_sku": if product.sku.is_empty() { &product.product_id } else { &product.sku },
                "price": product.price,
                "inventory": product.quantity
            }]
        });
        let body_json = serde_json::to_string(&request_body).map_err(|e| {
            AppError::ExternalApiError(format!("Failed to serialize request: {}", e))
        })?;

        let signature = self.generate_signature_with_body(path, &params, timestamp, &body_json);
        params.insert("sign".to_string(), signature);

        tracing::info!(
            "Creating TikTok product - Path: {}, Shop cipher: {}, Shop ID: {}",
            path,
            shop_cipher,
            shop_id
        );
        tracing::info!("Request body: {}", body_json);
        tracing::info!("Request params: {:?}", params);

        let response = self
            .client
            .post(format!("{}{}", self.credentials.api_base_url, path))
            .header("x-tts-access-token", access_token)
            .header("Content-Type", "application/json")
            .query(&params)
            .json(&request_body)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("TikTok create product failed: {}", e))
            })?;

        let status = response.status();
        let response_text = response
            .text()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to read response: {}", e)))?;

        tracing::info!("TikTok create product response status: {}", status);
        tracing::debug!("Response: {}", response_text);

        if status != StatusCode::OK {
            tracing::error!(
                "TikTok create product failed - Status: {}, Response: {}",
                status,
                response_text
            );
            return Err(AppError::ExternalApiError(format!(
                "TikTok create product failed with status: {} - {}",
                status, response_text
            )));
        }

        #[derive(Deserialize)]
        struct CreateProductResponse {
            code: i32,
            message: String,
            data: Option<CreateProductData>,
            request_id: Option<String>,
        }

        #[derive(Deserialize)]
        struct CreateProductData {
            product_id: String,
            skus: Vec<CreatedSku>,
            warnings: Option<Vec<Warning>>,
        }

        #[derive(Deserialize)]
        struct CreatedSku {
            id: String,
            seller_sku: String,
            sales_attributes: Option<Vec<SalesAttributeRef>>,
            external_sku_id: Option<String>,
        }

        #[derive(Deserialize)]
        struct SalesAttributeRef {
            id: String,
            value_id: String,
        }

        #[derive(Deserialize)]
        struct Warning {
            message: String,
        }

        let create_response: CreateProductResponse =
            serde_json::from_str(&response_text).map_err(|e| {
                AppError::ExternalApiError(format!("Failed to parse create response: {}", e))
            })?;

        if create_response.code != 0 {
            return Err(AppError::ExternalApiError(format!(
                "TikTok API error: {} (code: {})",
                create_response.message, create_response.code
            )));
        }

        let data = create_response
            .data
            .ok_or_else(|| AppError::ExternalApiError("No data in create response".to_string()))?;

        // Log any warnings
        if let Some(warnings) = &data.warnings {
            for warning in warnings {
                tracing::warn!("TikTok product creation warning: {}", warning.message);
            }
        }

        // Return the created product with updated ID
        let mut created_product = product.clone();
        created_product.product_id = data.product_id;
        created_product.platform_shop_id = shop_id;

        // Add SKU IDs to attributes
        if !data.skus.is_empty() {
            let sku_ids: Vec<String> = data.skus.iter().map(|s| s.id.clone()).collect();
            created_product.attributes.insert(
                "sku_ids".to_string(),
                serde_json::json!(sku_ids).to_string(),
            );
        }

        Ok(created_product)
    }
}
