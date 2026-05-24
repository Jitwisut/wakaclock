/// ไฟล์ etsy.rs - Etsy Marketplace Platform Gateway
/// เชื่อมต่อกับ Etsy API สำหรับการจัดการสินค้า handmade และ vintage
/// ใช้ OAuth 2.0 authentication และรองรับ shop management
/// รองรับการจัดการ listings, orders, และ seller tools สำหรับ creative products
use base64::{engine::general_purpose::URL_SAFE_NO_PAD as BASE64_URL, Engine};
use reqwest::{
    header::{HeaderMap, HeaderValue, AUTHORIZATION},
    Client,
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::HashMap;

use super::RefreshTokenResponse;
use crate::config::PlatformCredentials;
use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::Category;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};
pub struct EtsyGateway {
    client: Client,
    credentials: PlatformCredentials,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EtsyTokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub token_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EtsyListing {
    pub listing_id: i64,
    pub user_id: i64,
    pub shop_id: i64,
    pub title: String,
    pub description: String,
    pub state: String,
    pub creation_timestamp: i64,
    pub ending_timestamp: Option<i64>,
    pub original_creation_timestamp: i64,
    pub last_modified_timestamp: i64,
    pub price: EtsyMoney,
    pub currency_code: String,
    pub quantity: i32,
    pub sku: Vec<String>,
    pub tags: Vec<String>,
    pub materials: Vec<String>,
    pub shop_section_id: Option<i64>,
    pub featured_rank: Option<i32>,
    pub state_timestamp: Option<i64>,
    pub url: String,
    pub views: i32,
    pub num_favorers: i32,
    pub is_customizable: bool,
    pub is_digital: bool,
    pub file_data: Option<String>,
    pub language: Option<String>,
    pub has_variations: bool,
    pub taxonomy_id: Option<i64>,
    pub production_partners: Vec<Value>,
    pub skus: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EtsyMoney {
    pub amount: i32,
    pub divisor: i32,
    pub currency_code: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EtsyImage {
    pub listing_image_id: i64,
    pub listing_id: i64,
    pub url_75x75: String,
    pub url_170x135: String,
    #[serde(rename = "url_570xN")]
    pub url_570x_n: String,
    pub url_fullxfull: String,
    pub rank: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EtsyListingResponse {
    pub count: i32,
    pub results: Vec<EtsyListing>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EtsyCategory {
    pub id: i64,
    pub level: i32,
    pub name: String,
    pub parent_id: Option<i64>,
    pub parent_name: Option<String>,
    pub path: String,
    pub taxonomy_id: i64,
    pub children_ids: Vec<i64>,
}

impl EtsyGateway {
    pub fn new(credentials: PlatformCredentials) -> Self {
        Self {
            client: Client::new(),
            credentials,
        }
    }

    fn generate_code_verifier() -> String {
        // Generate random 43-128 character code verifier for PKCE
        let random_bytes: Vec<u8> = (0..64).map(|_| rand::random::<u8>()).collect();
        BASE64_URL.encode(&random_bytes)
    }

    fn generate_code_challenge(verifier: &str) -> String {
        // SHA256 hash of verifier, then base64url encode
        let mut hasher = Sha256::new();
        hasher.update(verifier.as_bytes());
        let result = hasher.finalize();
        BASE64_URL.encode(result)
    }

    async fn call_api(
        &self,
        method: &str,
        path: &str,
        params: Option<HashMap<String, String>>,
        body: Option<Value>,
        access_token: &str,
    ) -> AppResult<Value> {
        let url = format!("https://openapi.etsy.com/v3{}", path);

        let mut headers = HeaderMap::new();
        headers.insert(
            "x-api-key",
            HeaderValue::from_str(&self.credentials.app_key)
                .map_err(|_| AppError::ExternalApiError("Invalid API key".to_string()))?,
        );
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", access_token))
                .map_err(|_| AppError::ExternalApiError("Invalid access token".to_string()))?,
        );

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
            .map_err(|e| AppError::ExternalApiError(format!("Etsy API error: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Etsy API returned error: {}",
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
impl EtsyGateway {
    pub fn platform_name(&self) -> &str {
        "etsy"
    }

    pub fn get_oauth_url(&self, state: &str) -> String {
        let code_verifier = Self::generate_code_verifier();
        let code_challenge = Self::generate_code_challenge(&code_verifier);

        // Store code_verifier for later use (would need to persist this)

        let scopes = [
            "listings_r",
            "listings_w",
            "listings_d",
            "shops_r",
            "shops_w",
            "profile_r",
            "email_r",
            "transactions_r",
        ]
        .join(" ");

        format!(
            "https://www.etsy.com/oauth/connect?response_type=code&redirect_uri={}&scope={}&client_id={}&state={}&code_challenge={}&code_challenge_method=S256",
            urlencoding::encode(self.credentials.redirect_uri.as_ref().unwrap_or(&String::new())),
            urlencoding::encode(&scopes),
            self.credentials.app_key,
            state,
            code_challenge
        )
    }

    pub async fn exchange_code_for_token(&self, code: &str) -> AppResult<(String, String, i64)> {
        // Note: In production, you'd retrieve the code_verifier that was stored during get_oauth_url
        let code_verifier = "stored_code_verifier"; // This should be retrieved from storage

        let mut params = HashMap::new();
        params.insert("grant_type", "authorization_code");
        params.insert("client_id", &self.credentials.app_key);
        let empty_string = String::new();
        let redirect_uri = self
            .credentials
            .redirect_uri
            .as_ref()
            .unwrap_or(&empty_string);
        params.insert("redirect_uri", redirect_uri.as_str());
        params.insert("code", code);
        params.insert("code_verifier", code_verifier);

        let response = self
            .client
            .post("https://api.etsy.com/v3/public/oauth/token")
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

        let token_response: EtsyTokenResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse token response: {}", e))
        })?;

        Ok((
            token_response.access_token,
            token_response.refresh_token,
            token_response.expires_in,
        ))
    }

    pub async fn refresh_access_token(
        &self,
        refresh_token: &str,
    ) -> AppResult<RefreshTokenResponse> {
        let mut params = HashMap::new();
        params.insert("grant_type", "refresh_token");
        params.insert("client_id", &self.credentials.app_key);
        params.insert("refresh_token", refresh_token);

        let response = self
            .client
            .post("https://api.etsy.com/v3/public/oauth/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Token refresh failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::ExternalApiError(
                "Token refresh failed".to_string(),
            ));
        }

        let token_response: EtsyTokenResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse token response: {}", e))
        })?;

        Ok(RefreshTokenResponse {
            access_token: token_response.access_token,
            refresh_token: Some(token_response.refresh_token),
            expires_in: Some(token_response.expires_in),
        })
    }

    pub async fn fetch_products(
        &self,
        access_token: &str,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        // First get the shop ID
        let shop_response = self
            .call_api("GET", "/application/shops", None, None, access_token)
            .await?;

        let shop_id = shop_response["results"][0]["shop_id"]
            .as_i64()
            .ok_or_else(|| AppError::ExternalApiError("Failed to get shop ID".to_string()))?;

        let mut params = HashMap::new();
        params.insert(
            "limit".to_string(),
            limit.unwrap_or(25).min(100).to_string(),
        );
        params.insert("offset".to_string(), offset.unwrap_or(0).to_string());
        params.insert("state".to_string(), "active".to_string());

        let response = self
            .call_api(
                "GET",
                &format!("/application/shops/{}/listings", shop_id),
                Some(params),
                None,
                access_token,
            )
            .await?;

        let empty_vec = vec![];
        let listings = response["results"].as_array().unwrap_or(&empty_vec);

        Ok(listings
            .iter()
            .filter_map(|listing| {
                let etsy_listing: EtsyListing = serde_json::from_value(listing.clone()).ok()?;

                Some(Product {
                    product_id: format!("etsy_{}", etsy_listing.listing_id),
                    shop_id: "".to_string(),
                    platform_shop_id: "".to_string(),
                    platform_product_id: etsy_listing.listing_id.to_string(),
                    platform: PlatformType::Etsy,
                    title: etsy_listing.title,
                    brand: "".to_string(),
                    description: Some(etsy_listing.description),
                    price: Price {
                        amount: rust_decimal::Decimal::from_f64_retain(
                            (etsy_listing.price.amount as f64)
                                / (etsy_listing.price.divisor as f64),
                        )
                        .unwrap_or_default(),
                        currency: etsy_listing.price.currency_code.clone(),
                        original_price: None,
                        discount_percentage: None,
                    },
                    currency: etsy_listing.price.currency_code,
                    sku: etsy_listing
                        .sku
                        .first()
                        .cloned()
                        .unwrap_or_else(|| "".to_string()),
                    quantity: etsy_listing.quantity as i16,
                    images: vec![], // Would need separate API call for images
                    categories: etsy_listing
                        .taxonomy_id
                        .map(|id| vec![id.to_string()])
                        .unwrap_or_default(),
                    attributes: HashMap::new(),
                    status: match etsy_listing.state.as_str() {
                        "active" => ProductStatus::Active,
                        "inactive" | "draft" => ProductStatus::Inactive,
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
                &format!("/application/listings/{}", product_id),
                None,
                None,
                access_token,
            )
            .await?;

        let etsy_listing: EtsyListing = serde_json::from_value(response)
            .map_err(|e| AppError::ExternalApiError(format!("Failed to parse listing: {}", e)))?;

        // Get images
        let images_response = self
            .call_api(
                "GET",
                &format!("/application/listings/{}/images", product_id),
                None,
                None,
                access_token,
            )
            .await?;

        let empty_vec = vec![];
        let images: Vec<String> = images_response["results"]
            .as_array()
            .unwrap_or(&empty_vec)
            .iter()
            .filter_map(|img| img["url_fullxfull"].as_str().map(String::from))
            .collect();

        Ok(Product {
            product_id: format!("etsy_{}", etsy_listing.listing_id),
            shop_id: "".to_string(),
            platform_shop_id: "".to_string(),
            platform: PlatformType::Etsy,
            platform_product_id: etsy_listing.listing_id.to_string(),
            title: etsy_listing.title,
            brand: "".to_string(),
            description: Some(etsy_listing.description),
            price: Price {
                amount: rust_decimal::Decimal::from_f64_retain(
                    (etsy_listing.price.amount as f64) / (etsy_listing.price.divisor as f64),
                )
                .unwrap_or_default(),
                currency: etsy_listing.price.currency_code.clone(),
                original_price: None,
                discount_percentage: None,
            },
            currency: etsy_listing.price.currency_code,
            sku: etsy_listing
                .sku
                .first()
                .cloned()
                .unwrap_or_else(|| "".to_string()),
            quantity: etsy_listing.quantity as i16,
            images: images
                .into_iter()
                .map(|url| ProductImage {
                    url,
                    alt: None,
                    is_primary: false,
                    position: 0,
                })
                .collect(),
            categories: etsy_listing
                .taxonomy_id
                .map(|id| vec![id.to_string()])
                .unwrap_or_default(),
            attributes: {
                let mut attrs = HashMap::new();
                attrs.insert(
                    "tags".to_string(),
                    serde_json::to_string(&etsy_listing.tags).unwrap_or_default(),
                );
                attrs.insert(
                    "materials".to_string(),
                    serde_json::to_string(&etsy_listing.materials).unwrap_or_default(),
                );
                attrs.insert(
                    "is_digital".to_string(),
                    etsy_listing.is_digital.to_string(),
                );
                attrs.insert(
                    "is_customizable".to_string(),
                    etsy_listing.is_customizable.to_string(),
                );
                attrs
            },
            status: match etsy_listing.state.as_str() {
                "active" => ProductStatus::Active,
                "inactive" | "draft" => ProductStatus::Inactive,
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
        params.insert("keywords".to_string(), query.to_string());
        params.insert(
            "limit".to_string(),
            limit.unwrap_or(25).min(100).to_string(),
        );

        let response = self
            .call_api(
                "GET",
                "/application/listings/active",
                Some(params),
                None,
                access_token,
            )
            .await?;

        let empty_vec = vec![];
        let listings = response["results"].as_array().unwrap_or(&empty_vec);

        Ok(listings
            .iter()
            .filter_map(|listing| {
                let etsy_listing: EtsyListing = serde_json::from_value(listing.clone()).ok()?;

                Some(Product {
                    product_id: format!("etsy_{}", etsy_listing.listing_id),
                    shop_id: "".to_string(),
                    platform_shop_id: "".to_string(),
                    platform_product_id: etsy_listing.listing_id.to_string(),
                    platform: PlatformType::Etsy,
                    title: etsy_listing.title,
                    brand: "".to_string(),
                    description: Some(etsy_listing.description),
                    price: Price {
                        amount: rust_decimal::Decimal::from_f64_retain(
                            (etsy_listing.price.amount as f64)
                                / (etsy_listing.price.divisor as f64),
                        )
                        .unwrap_or_default(),
                        currency: etsy_listing.price.currency_code.clone(),
                        original_price: None,
                        discount_percentage: None,
                    },
                    currency: etsy_listing.price.currency_code,
                    sku: etsy_listing
                        .sku
                        .first()
                        .cloned()
                        .unwrap_or_else(|| "".to_string()),
                    quantity: etsy_listing.quantity as i16,
                    images: vec![],
                    categories: etsy_listing
                        .taxonomy_id
                        .map(|id| vec![id.to_string()])
                        .unwrap_or_default(),
                    attributes: HashMap::new(),
                    status: match etsy_listing.state.as_str() {
                        "active" => ProductStatus::Active,
                        "inactive" | "draft" => ProductStatus::Inactive,
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
            .call_api(
                "GET",
                "/application/seller-taxonomy/nodes",
                None,
                None,
                access_token,
            )
            .await?;

        let empty_vec = vec![];
        let categories = response["results"].as_array().unwrap_or(&empty_vec);

        Ok(categories
            .iter()
            .filter_map(|cat| {
                let id = cat["id"].as_i64()?;
                let name = cat["name"].as_str()?;
                let _path = cat["path"].as_str().unwrap_or(name);
                let _level = cat["level"].as_i64().unwrap_or(0) as i32;
                Some(Category {
                    id: id.to_string(),
                    name: name.to_string(),
                    parent_id: None,
                })
            })
            .collect())
    }
}
