/// ไฟล์ jd.rs - JD.com E-commerce Platform Gateway
/// เชื่อมต่อกับ JD.com API สำหรับการจัดการสินค้าในตลาดออนไลน์จีน
/// ใช้ HMAC-SHA256 สำหรับ API request signing และรองรับ OAuth 2.0
/// รองรับการจัดการสินค้า, การค้นหา, inventory และ order management
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chrono::Utc;
use hmac::{Hmac, Mac};
use reqwest::{
    header::{HeaderMap, HeaderValue},
    Client,
};

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::Sha256;
use std::collections::HashMap;

use super::RefreshTokenResponse;
use crate::config::PlatformCredentials;
use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::Category;
use crate::model::v1::platfrom::entries::{PlatformType, Price, Product, ProductStatus};
pub struct JDGateway {
    client: Client,
    credentials: PlatformCredentials,
    is_sandbox: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JDTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JDProduct {
    pub listing_id: String,
    pub sku_id: String,
    pub fsn: String,
    pub product_title: String,
    pub description: Option<String>,
    pub brand: String,
    pub product_specification: HashMap<String, Value>,
    pub price: JDPrice,
    pub listing_status: String,
    pub inventory_count: i32,
    pub selling_price: f64,
    pub mrp: f64,
    pub fulfillment_profile: String,
    pub packages: Vec<Package>,
    pub tax: Tax,
    pub listing_validations: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JDPrice {
    pub minimum: f64,
    pub maximum: f64,
    pub currency: String,
    pub mrp: f64,
    pub selling_price: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Package {
    pub weight: f64,
    pub dimensions: Dimensions,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Dimensions {
    pub length: f64,
    pub breadth: f64,
    pub height: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Tax {
    pub hsn: String,
    pub tax_rate: f64,
}

impl JDGateway {
    pub fn new(credentials: PlatformCredentials) -> Self {
        let is_sandbox = credentials.api_base_url.contains("sandbox");

        Self {
            client: Client::new(),
            credentials,
            is_sandbox,
        }
    }

    fn get_api_base(&self) -> &str {
        if self.is_sandbox {
            "https://sandbox-api.jd.com/sellers"
        } else {
            "https://api.jd.com/sellers"
        }
    }

    fn generate_signature(&self, method: &str, path: &str, timestamp: &str) -> String {
        let string_to_sign = format!("{}\n{}\n{}", method, path, timestamp);

        type HmacSha256 = Hmac<Sha256>;
        let mut mac = HmacSha256::new_from_slice(self.credentials.app_secret.as_bytes())
            .expect("HMAC can take key of any size");
        mac.update(string_to_sign.as_bytes());

        let result = mac.finalize();
        BASE64.encode(result.into_bytes())
    }

    async fn call_api(
        &self,
        method: &str,
        path: &str,
        params: Option<HashMap<String, String>>,
        body: Option<Value>,
        access_token: &str,
    ) -> AppResult<Value> {
        let url = format!("{}{}", self.get_api_base(), path);
        let timestamp = Utc::now().to_rfc3339();
        let signature = self.generate_signature(method, path, &timestamp);

        let mut headers = HeaderMap::new();
        headers.insert(
            "Authorization",
            HeaderValue::from_str(&format!("Bearer {}", access_token))
                .map_err(|_| AppError::ExternalApiError("Invalid access token".to_string()))?,
        );
        headers.insert(
            "X-JD-Client-Id",
            HeaderValue::from_str(&self.credentials.app_key)
                .map_err(|_| AppError::ExternalApiError("Invalid client ID".to_string()))?,
        );
        headers.insert(
            "X-JD-Client-Signature",
            HeaderValue::from_str(&signature)
                .map_err(|_| AppError::ExternalApiError("Invalid signature".to_string()))?,
        );
        headers.insert(
            "X-Timestamp",
            HeaderValue::from_str(&timestamp)
                .map_err(|_| AppError::ExternalApiError("Invalid timestamp".to_string()))?,
        );
        headers.insert("Content-Type", HeaderValue::from_static("application/json"));

        let mut request_builder = match method {
            "GET" => self.client.get(&url),
            "POST" => self.client.post(&url),
            "PUT" => self.client.put(&url),
            "DELETE" => self.client.delete(&url),
            _ => {
                return Err(AppError::ExternalApiError(
                    "Unsupported HTTP method".to_string(),
                ))
            }
        };

        if let Some(params) = params {
            request_builder = request_builder.query(&params);
        }

        if let Some(body) = body {
            request_builder = request_builder.json(&body);
        }

        let response = request_builder
            .headers(headers)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("JD API error: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "JD API returned error: {}",
                error_text
            )));
        }

        response
            .json::<Value>()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to parse response: {}", e)))
    }
}

// #[async_trait]
// TODO: Update to match new PlatformGateway trait
// The following methods need to be updated to match the new PlatformGateway trait
impl JDGateway {
    pub fn platform_name(&self) -> &str {
        "jd"
    }

    pub fn get_oauth_url(&self, state: &str) -> String {
        // JD uses app-only authentication, not OAuth
        // Sellers need to generate app credentials from JD Seller Hub
        format!("https://seller.jd.com/api-register?state={}", state)
    }

    pub async fn exchange_code_for_token(&self, _code: &str) -> AppResult<(String, String, i64)> {
        // JD uses app credentials directly
        let mut headers = HeaderMap::new();
        headers.insert(
            "Content-Type",
            HeaderValue::from_static("application/x-www-form-urlencoded"),
        );

        let mut params = HashMap::new();
        params.insert("grant_type", "client_credentials");
        params.insert("client_id", &self.credentials.app_key);
        params.insert("client_secret", &self.credentials.app_secret);
        params.insert("scope", "Seller_Api");

        let response = self
            .client
            .post(format!("{}/oauth/token", self.get_api_base()))
            .headers(headers)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Token exchange failed: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Token exchange failed: {}",
                error_text
            )));
        }

        let token_response: JDTokenResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse token response: {}", e))
        })?;

        Ok((
            token_response.access_token,
            String::new(), // No refresh token in client credentials flow
            token_response.expires_in,
        ))
    }

    pub async fn refresh_access_token(
        &self,
        _refresh_token: &str,
    ) -> AppResult<RefreshTokenResponse> {
        // JD uses client credentials, so we just get a new token
        let (access_token, _, expires_in) = self.exchange_code_for_token("").await?;

        Ok(RefreshTokenResponse {
            access_token,
            refresh_token: None,
            expires_in: Some(expires_in),
        })
    }

    pub async fn fetch_products(
        &self,
        access_token: &str,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        let mut params = HashMap::new();
        params.insert("filter".to_string(), "ACTIVE".to_string());
        params.insert("limit".to_string(), limit.unwrap_or(20).min(50).to_string());
        params.insert("offset".to_string(), offset.unwrap_or(0).to_string());

        let response = self
            .call_api("GET", "/v3/listings", Some(params), None, access_token)
            .await?;

        let empty_vec = vec![];
        let listings = response["listings"].as_array().unwrap_or(&empty_vec);

        Ok(listings
            .iter()
            .filter_map(|listing| {
                let product: JDProduct = serde_json::from_value(listing.clone()).ok()?;

                Some(Product {
                    product_id: format!("jd_{}", product.listing_id),
                    platform_product_id: product.listing_id.clone(),
                    shop_id: "".to_string(),
                    platform_shop_id: product.sku_id.clone(),
                    platform: PlatformType::JD,
                    title: product.product_title,
                    brand: "".to_string(),
                    description: product.description,
                    price: Price {
                        amount: Decimal::from_f64_retain(product.selling_price)
                            .unwrap_or(Decimal::ZERO),
                        currency: "INR".to_string(),
                        original_price: None,
                        discount_percentage: None,
                    },
                    currency: "INR".to_string(),
                    sku: product.sku_id,
                    quantity: product.inventory_count as i16,
                    images: vec![], // Would need separate API call
                    categories: vec![],
                    attributes: HashMap::new(), // TODO: Convert product_specification to HashMap
                    status: match product.listing_status.as_str() {
                        "ACTIVE" => ProductStatus::Active,
                        "INACTIVE" => ProductStatus::Inactive,
                        _ => ProductStatus::Inactive,
                    },
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                    synced_at: Some(chrono::Utc::now()),
                })
            })
            .collect())
    }

    pub async fn fetch_product_detail(
        &self,
        access_token: &str,
        product_id: &str,
    ) -> AppResult<Product> {
        let response = self
            .call_api(
                "GET",
                &format!("/v3/listings/{}", product_id),
                None,
                None,
                access_token,
            )
            .await?;

        let product: JDProduct = serde_json::from_value(response)
            .map_err(|e| AppError::ExternalApiError(format!("Failed to parse product: {}", e)))?;

        Ok(Product {
            product_id: format!("jd_{}", product.listing_id),
            platform_product_id: product.listing_id.clone(),
            shop_id: "".to_string(),
            platform_shop_id: "".to_string(),
            platform: PlatformType::JD,
            title: product.product_title,
            brand: "".to_string(),
            description: product.description,
            price: Price {
                amount: Decimal::from_f64_retain(product.selling_price).unwrap_or(Decimal::ZERO),
                currency: "INR".to_string(),
                original_price: None,
                discount_percentage: None,
            },
            currency: "INR".to_string(),
            sku: product.sku_id,
            quantity: product.inventory_count as i16,
            images: vec![],
            categories: vec![],
            attributes: HashMap::new(), // TODO: Convert product_specification to HashMap
            status: match product.listing_status.as_str() {
                "ACTIVE" => ProductStatus::Active,
                "INACTIVE" => ProductStatus::Inactive,
                _ => ProductStatus::Inactive,
            },
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            synced_at: Some(chrono::Utc::now()),
        })
    }

    pub async fn search_products(
        &self,
        access_token: &str,
        query: &str,
        limit: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        let mut params = HashMap::new();
        params.insert("query".to_string(), query.to_string());
        params.insert("limit".to_string(), limit.unwrap_or(20).min(50).to_string());

        let response = self
            .call_api(
                "GET",
                "/v3/search/listings",
                Some(params),
                None,
                access_token,
            )
            .await?;

        let empty_vec = vec![];
        let listings = response["listings"].as_array().unwrap_or(&empty_vec);

        Ok(listings
            .iter()
            .filter_map(|listing| {
                let product: JDProduct = serde_json::from_value(listing.clone()).ok()?;

                Some(Product {
                    product_id: format!("jd_{}", product.listing_id),
                    platform_product_id: product.listing_id.clone(),
                    shop_id: "".to_string(),
                    platform_shop_id: "".to_string(),
                    platform: PlatformType::JD,
                    title: product.product_title,
                    brand: "".to_string(),
                    description: product.description,
                    price: Price {
                        amount: Decimal::from_f64_retain(product.selling_price)
                            .unwrap_or(Decimal::ZERO),
                        currency: "INR".to_string(),
                        original_price: None,
                        discount_percentage: None,
                    },
                    currency: "INR".to_string(),
                    sku: product.sku_id,
                    quantity: product.inventory_count as i16,
                    images: vec![],
                    categories: vec![],
                    attributes: HashMap::new(),
                    status: match product.listing_status.as_str() {
                        "ACTIVE" => ProductStatus::Active,
                        "INACTIVE" => ProductStatus::Inactive,
                        _ => ProductStatus::Inactive,
                    },
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                    synced_at: Some(chrono::Utc::now()),
                })
            })
            .collect())
    }

    pub async fn get_categories(&self, access_token: &str) -> AppResult<Vec<Category>> {
        let response = self
            .call_api("GET", "/v2/categories", None, None, access_token)
            .await?;

        let empty_vec = vec![];
        let categories = response["categories"].as_array().unwrap_or(&empty_vec);

        Ok(categories
            .iter()
            .filter_map(|cat| {
                let id = cat["id"].as_str()?;
                let name = cat["name"].as_str()?;
                Some(Category {
                    id: id.to_string(),
                    name: name.to_string(),
                    parent_id: None,
                })
            })
            .collect())
    }
}
