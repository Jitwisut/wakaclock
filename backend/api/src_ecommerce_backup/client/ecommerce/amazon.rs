/// ไฟล์ amazon.rs - Amazon Seller Central Platform Gateway
/// เชื่อมต่อกับ Amazon SP-API สำหรับการจัดการสินค้าและการขายใน Amazon
/// ใช้ AWS Signature Version 4 authentication และ access token
/// รองรับการจัดการ listings, inventory, orders และ FBA integration
use chrono::Utc;
use hmac::{Hmac, Mac};
use reqwest::{
    header::{HeaderMap, HeaderValue, USER_AGENT},
    Client,
};

use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

use super::RefreshTokenResponse;
use crate::config::PlatformCredentials;
use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::Category;
use crate::model::v1::platfrom::entries::{
    PlatformType, Price, Product, ProductImage, ProductStatus,
};

pub struct AmazonGateway {
    client: Client,
    credentials: PlatformCredentials,
    marketplace_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AmazonTokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub token_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CatalogItem {
    pub asin: String,
    pub attributes: Option<ItemAttributes>,
    pub identifiers: Option<Vec<ItemIdentifier>>,
    pub images: Option<Vec<ItemImage>>,
    pub product_types: Option<Vec<ProductType>>,
    pub sales_ranks: Option<Vec<SalesRank>>,
    pub summaries: Option<Vec<ItemSummary>>,
    pub vendor_details: Option<Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ItemAttributes {
    pub item_name: Option<Vec<LanguageTaggedText>>,
    pub brand: Option<Vec<LanguageTaggedText>>,
    pub manufacturer: Option<Vec<LanguageTaggedText>>,
    pub model_number: Option<Vec<LanguageTaggedText>>,
    pub list_price: Option<Vec<CurrencyAmount>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LanguageTaggedText {
    pub language_tag: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CurrencyAmount {
    pub currency: String,
    pub amount: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ItemIdentifier {
    pub identifier_type: String,
    pub identifier: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ItemImage {
    pub variant: String,
    pub link: String,
    pub height: i32,
    pub width: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductType {
    pub product_type: String,
    pub marketplace_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SalesRank {
    pub marketplace_id: String,
    pub classification_ranks: Vec<ClassificationRank>,
    pub display_group_ranks: Option<Vec<DisplayGroupRank>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClassificationRank {
    pub classification_id: String,
    pub title: String,
    pub rank: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DisplayGroupRank {
    pub website_display_group: String,
    pub title: String,
    pub rank: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ItemSummary {
    pub marketplace_id: String,
    pub brand: Option<String>,
    pub item_name: Option<String>,
    pub manufacturer: Option<String>,
    pub model_number: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CatalogSearchResponse {
    pub items: Vec<CatalogItem>,
    pub pagination: Option<Pagination>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Pagination {
    pub next_token: Option<String>,
}

// Listings API structures
#[derive(Debug, Serialize, Deserialize)]
pub struct ListingSubmission {
    pub product_type: String,
    pub attributes: serde_json::Map<String, Value>,
    pub offers: Option<Vec<OfferSubmission>>,
    pub fulfillment_availability: Option<Vec<FulfillmentAvailability>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OfferSubmission {
    pub marketplace_id: String,
    pub price: PriceSubmission,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PriceSubmission {
    pub value: f64,
    pub currency: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FulfillmentAvailability {
    pub fulfillment_channel_code: String,
    pub quantity: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductTypeDefinition {
    pub schema: Value,
    pub requirements: String,
    pub requirements_enforced: String,
    pub property_groups: HashMap<String, PropertyGroup>,
    pub locale: String,
    pub marketplace_ids: Vec<String>,
    pub product_type: String,
    pub product_type_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PropertyGroup {
    pub title: String,
    pub description: String,
    pub property_names: Vec<String>,
}

impl AmazonGateway {
    pub fn new(credentials: PlatformCredentials) -> Self {
        // Default to US marketplace, can be overridden
        let marketplace_id = "ATVPDKIKX0DER".to_string();

        Self {
            client: Client::new(),
            credentials,
            marketplace_id,
        }
    }

    fn sign_request(&self, method: &str, uri: &str, _headers: &HeaderMap, payload: &str) -> String {
        // AWS Signature Version 4 signing process
        let now = Utc::now();
        let date_stamp = now.format("%Y%m%d").to_string();
        let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();

        // Create canonical request
        let canonical_headers = format!(
            "host:{}\nx-amz-date:{}\n",
            "sellingpartnerapi-na.amazon.com", amz_date
        );

        let signed_headers = "host;x-amz-date";

        let payload_hash = format!("{:x}", Sha256::digest(payload.as_bytes()));

        let canonical_request = format!(
            "{}\n{}\n{}\n{}\n{}\n{}",
            method,
            uri,
            "", // query string
            canonical_headers,
            signed_headers,
            payload_hash
        );

        // Create string to sign
        let algorithm = "AWS4-HMAC-SHA256";
        let credential_scope = format!("{}/us-east-1/execute-api/aws4_request", date_stamp);

        let canonical_request_hash = format!("{:x}", Sha256::digest(canonical_request.as_bytes()));

        let string_to_sign = format!(
            "{}\n{}\n{}\n{}",
            algorithm, amz_date, credential_scope, canonical_request_hash
        );

        // Calculate signature
        type HmacSha256 = Hmac<Sha256>;

        let mut key = format!("AWS4{}", self.credentials.app_secret).into_bytes();

        let mut mac = HmacSha256::new_from_slice(&key).unwrap();
        mac.update(date_stamp.as_bytes());
        key = mac.finalize().into_bytes().to_vec();

        let mut mac = HmacSha256::new_from_slice(&key).unwrap();
        mac.update(b"us-east-1");
        key = mac.finalize().into_bytes().to_vec();

        let mut mac = HmacSha256::new_from_slice(&key).unwrap();
        mac.update(b"execute-api");
        key = mac.finalize().into_bytes().to_vec();

        let mut mac = HmacSha256::new_from_slice(&key).unwrap();
        mac.update(b"aws4_request");
        key = mac.finalize().into_bytes().to_vec();

        let mut mac = HmacSha256::new_from_slice(&key).unwrap();
        mac.update(string_to_sign.as_bytes());
        let signature = mac.finalize();

        let signature_hex = hex::encode(signature.into_bytes());

        // Create authorization header
        format!(
            "{} Credential={}/{}, SignedHeaders={}, Signature={}",
            algorithm, self.credentials.app_key, credential_scope, signed_headers, signature_hex
        )
    }

    async fn call_sp_api(
        &self,
        method: &str,
        path: &str,
        params: Option<HashMap<String, String>>,
        access_token: &str,
    ) -> AppResult<Value> {
        let url = format!("https://sellingpartnerapi-na.amazon.com{}", path);

        let mut headers = HeaderMap::new();
        headers.insert(
            "x-amz-access-token",
            HeaderValue::from_str(access_token)
                .map_err(|_| AppError::ExternalApiError("Invalid access token".to_string()))?,
        );
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("rust-ecommerce-connect/1.0"),
        );

        let mut request_builder = match method {
            "GET" => self.client.get(&url),
            "POST" => self.client.post(&url),
            _ => {
                return Err(AppError::ExternalApiError(
                    "Unsupported HTTP method".to_string(),
                ))
            }
        };

        if let Some(params) = params {
            request_builder = request_builder.query(&params);
        }

        let response = request_builder
            .headers(headers)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Amazon SP API error: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Amazon SP API returned error: {}",
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
impl AmazonGateway {
    pub fn platform_name(&self) -> &str {
        "amazon"
    }

    pub fn get_oauth_url(&self, state: &str) -> String {
        let scopes = self.oauth_scopes().join(" ");
        let redirect_uri = self
            .credentials
            .get_gateway_callback_url(self.platform_name());
        let authorize_url = self
            .credentials
            .oauth_authorize_url
            .clone()
            .unwrap_or_else(|| "https://www.amazon.com/ap/oa".to_string());

        format!(
            "{}?client_id={}&scope={}&response_type=code&redirect_uri={}&state={}",
            authorize_url.trim_end_matches('/'),
            self.credentials.app_key,
            urlencoding::encode(&scopes),
            urlencoding::encode(&redirect_uri),
            state
        )
    }

    fn oauth_scopes(&self) -> Vec<String> {
        if let Ok(raw_scopes) = std::env::var("AMAZON_OAUTH_SCOPES") {
            let parsed: Vec<String> = raw_scopes
                .split(|c| c == ',' || c == ' ')
                .filter_map(|scope| {
                    let trimmed = scope.trim();
                    if trimmed.is_empty() {
                        None
                    } else {
                        Some(trimmed.to_string())
                    }
                })
                .collect();

            if !parsed.is_empty() {
                return parsed;
            }
        }

        vec!["sellingpartnerapi::migration".to_string()]
    }

    pub async fn exchange_code_for_token(&self, code: &str) -> AppResult<(String, String, i64)> {
        let redirect_uri_owned = self
            .credentials
            .get_gateway_callback_url(self.platform_name());
        let mut params = HashMap::new();
        params.insert("grant_type", "authorization_code");
        params.insert("code", code);
        params.insert("redirect_uri", redirect_uri_owned.as_str());
        params.insert("client_id", &self.credentials.app_key);
        params.insert("client_secret", &self.credentials.app_secret);

        let response = self
            .client
            .post("https://api.amazon.com/auth/o2/token")
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

        let token_response: AmazonTokenResponse = response.json().await.map_err(|e| {
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
        params.insert("refresh_token", refresh_token);
        params.insert("client_id", &self.credentials.app_key);
        params.insert("client_secret", &self.credentials.app_secret);

        let response = self
            .client
            .post("https://api.amazon.com/auth/o2/token")
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Token refresh failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::ExternalApiError(
                "Token refresh failed".to_string(),
            ));
        }

        let token_response: AmazonTokenResponse = response.json().await.map_err(|e| {
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
        // Amazon doesn't have a direct "list my products" API in the same way
        // We need to search using specific criteria or maintain a list of ASINs

        let mut params = HashMap::new();
        params.insert("marketplaceIds".to_string(), self.marketplace_id.clone());
        params.insert(
            "includedData".to_string(),
            "attributes,identifiers,images,productTypes,salesRanks,summaries".to_string(),
        );
        params.insert(
            "pageSize".to_string(),
            limit.unwrap_or(20).min(20).to_string(),
        );

        if let Some(offset) = offset {
            if offset > 0 {
                // Would need to implement pagination token handling
            }
        }

        let response = self
            .call_sp_api(
                "GET",
                "/catalog/2022-04-01/items",
                Some(params),
                access_token,
            )
            .await?;

        let empty_vec = vec![];
        let items = response["items"].as_array().unwrap_or(&empty_vec);

        Ok(items
            .iter()
            .filter_map(|item| {
                let catalog_item: CatalogItem = serde_json::from_value(item.clone()).ok()?;

                let title = catalog_item
                    .attributes
                    .as_ref()
                    .and_then(|a| a.item_name.as_ref())
                    .and_then(|names| names.first())
                    .map(|n| n.value.clone())
                    .unwrap_or_else(|| catalog_item.asin.clone());

                let price = catalog_item
                    .attributes
                    .as_ref()
                    .and_then(|a| a.list_price.as_ref())
                    .and_then(|prices| prices.first())
                    .map(|p| p.amount)
                    .unwrap_or(0.0);

                let currency = catalog_item
                    .attributes
                    .as_ref()
                    .and_then(|a| a.list_price.as_ref())
                    .and_then(|prices| prices.first())
                    .map(|p| p.currency.clone())
                    .unwrap_or_else(|| "USD".to_string());

                let images: Vec<ProductImage> = catalog_item
                    .images
                    .unwrap_or_default()
                    .into_iter()
                    .enumerate()
                    .map(|(i, img)| ProductImage {
                        url: img.link,
                        alt: None,
                        is_primary: i == 0,
                        position: i as i32,
                    })
                    .collect();

                Some(Product {
                    product_id: format!("amazon_{}", catalog_item.asin.clone()),
                    shop_id: "".to_string(),
                    platform: PlatformType::Amazon,
                    platform_shop_id: "".to_string(),
                    platform_product_id: catalog_item.asin.clone(),
                    sku: catalog_item.asin,
                    title,
                    brand: "".to_string(),
                    description: None,
                    price: Price {
                        amount: rust_decimal::Decimal::from_f64_retain(price).unwrap_or_default(),
                        currency: currency.clone(),
                        original_price: None,
                        discount_percentage: None,
                    },
                    quantity: 0, // Would need inventory API
                    images,
                    currency,
                    attributes: HashMap::new(),
                    categories: catalog_item
                        .product_types
                        .unwrap_or_default()
                        .into_iter()
                        .map(|pt| pt.product_type)
                        .collect(),
                    status: ProductStatus::Active,
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
        let mut params = HashMap::new();
        params.insert("marketplaceIds".to_string(), self.marketplace_id.clone());
        params.insert(
            "includedData".to_string(),
            "attributes,identifiers,images,productTypes,salesRanks,summaries,vendorDetails"
                .to_string(),
        );

        let response = self
            .call_sp_api(
                "GET",
                &format!("/catalog/2022-04-01/items/{}", product_id),
                Some(params),
                access_token,
            )
            .await?;

        let catalog_item: CatalogItem = serde_json::from_value(response)
            .map_err(|e| AppError::ExternalApiError(format!("Failed to parse product: {}", e)))?;

        let title = catalog_item
            .attributes
            .as_ref()
            .and_then(|a| a.item_name.as_ref())
            .and_then(|names| names.first())
            .map(|n| n.value.clone())
            .unwrap_or_else(|| catalog_item.asin.clone());

        let price = catalog_item
            .attributes
            .as_ref()
            .and_then(|a| a.list_price.as_ref())
            .and_then(|prices| prices.first())
            .map(|p| p.amount)
            .unwrap_or(0.0);

        let currency = catalog_item
            .attributes
            .as_ref()
            .and_then(|a| a.list_price.as_ref())
            .and_then(|prices| prices.first())
            .map(|p| p.currency.clone())
            .unwrap_or_else(|| "USD".to_string());

        let images: Vec<ProductImage> = catalog_item
            .images
            .unwrap_or_default()
            .into_iter()
            .enumerate()
            .map(|(i, img)| ProductImage {
                url: img.link,
                alt: None,
                is_primary: i == 0,
                position: i as i32,
            })
            .collect();

        Ok(Product {
            product_id: format!("amazon_{}", catalog_item.asin.clone()),
            shop_id: "".to_string(),
            platform: PlatformType::Amazon,
            platform_shop_id: "".to_string(),
            platform_product_id: catalog_item.asin.clone(),
            sku: catalog_item.asin,
            title,
            brand: "".to_string(),
            description: catalog_item
                .summaries
                .and_then(|s| s.first().and_then(|sum| sum.item_name.clone())),
            price: Price {
                amount: rust_decimal::Decimal::from_f64_retain(price).unwrap_or_default(),
                currency: currency.clone(),
                original_price: None,
                discount_percentage: None,
            },
            quantity: 0, // Would need inventory API
            images,
            currency,
            attributes: HashMap::new(),
            categories: catalog_item
                .product_types
                .unwrap_or_default()
                .into_iter()
                .map(|pt| pt.product_type)
                .collect(),
            status: ProductStatus::Active,
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
        params.insert("marketplaceIds".to_string(), self.marketplace_id.clone());
        params.insert(
            "includedData".to_string(),
            "attributes,images,summaries".to_string(),
        );
        params.insert(
            "pageSize".to_string(),
            limit.unwrap_or(20).min(20).to_string(),
        );

        let response = self
            .call_sp_api(
                "GET",
                "/catalog/2022-04-01/items",
                Some(params),
                access_token,
            )
            .await?;

        let empty_vec = vec![];
        let items = response["items"].as_array().unwrap_or(&empty_vec);

        Ok(items
            .iter()
            .filter_map(|item| {
                let catalog_item: CatalogItem = serde_json::from_value(item.clone()).ok()?;

                let title = catalog_item
                    .attributes
                    .as_ref()
                    .and_then(|a| a.item_name.as_ref())
                    .and_then(|names| names.first())
                    .map(|n| n.value.clone())
                    .unwrap_or_else(|| catalog_item.asin.clone());

                let price = catalog_item
                    .attributes
                    .as_ref()
                    .and_then(|a| a.list_price.as_ref())
                    .and_then(|prices| prices.first())
                    .map(|p| p.amount)
                    .unwrap_or(0.0);

                let currency = catalog_item
                    .attributes
                    .as_ref()
                    .and_then(|a| a.list_price.as_ref())
                    .and_then(|prices| prices.first())
                    .map(|p| p.currency.clone())
                    .unwrap_or_else(|| "USD".to_string());

                let images: Vec<ProductImage> = catalog_item
                    .images
                    .unwrap_or_default()
                    .into_iter()
                    .enumerate()
                    .map(|(i, img)| ProductImage {
                        url: img.link,
                        alt: None,
                        is_primary: i == 0,
                        position: i as i32,
                    })
                    .collect();

                Some(Product {
                    product_id: format!("amazon_{}", catalog_item.asin.clone()),
                    shop_id: "".to_string(),
                    platform: PlatformType::Amazon,
                    platform_shop_id: "".to_string(),
                    platform_product_id: catalog_item.asin.clone(),
                    sku: catalog_item.asin,
                    title,
                    brand: "".to_string(),
                    description: None,
                    price: Price {
                        amount: rust_decimal::Decimal::from_f64_retain(price).unwrap_or_default(),
                        currency: currency.clone(),
                        original_price: None,
                        discount_percentage: None,
                    },
                    quantity: 0,
                    images,
                    currency,
                    attributes: HashMap::new(),
                    categories: vec![],
                    status: ProductStatus::Active,
                    created_at: chrono::Utc::now(),
                    updated_at: chrono::Utc::now(),
                    synced_at: Some(chrono::Utc::now()),
                })
            })
            .collect())
    }

    pub async fn get_categories(&self, access_token: &str) -> AppResult<Vec<Category>> {
        // Amazon doesn't provide a simple category list API
        // Categories are obtained through Product Type Definitions API

        let params = HashMap::new();

        let response = self
            .call_sp_api(
                "GET",
                "/definitions/2020-09-01/productTypes",
                Some(params),
                access_token,
            )
            .await?;

        let empty_vec = vec![];
        let product_types = response["productTypes"].as_array().unwrap_or(&empty_vec);

        Ok(product_types
            .iter()
            .filter_map(|pt| {
                let name = pt["name"].as_str()?;
                let display_name = pt["displayName"].as_str().unwrap_or(name);
                Some(Category {
                    id: name.to_string(),
                    name: display_name.to_string(),
                    parent_id: None,
                })
            })
            .collect())
    }

    pub async fn create_product(
        &self,
        access_token: &str,
        product: &Product,
    ) -> AppResult<Product> {
        // Create or update a listing using the Listings Items API
        // PUT /listings/2021-08-01/items/{sellerSKU}

        let seller_sku = &product.sku;

        // Build the listing submission payload
        let mut attributes = serde_json::Map::new();
        attributes.insert("item_name".to_string(), json!(product.title));
        attributes.insert("brand".to_string(), json!(product.brand));

        if let Some(desc) = &product.description {
            attributes.insert("product_description".to_string(), json!(desc));
        }

        // Add product images if available
        if !product.images.is_empty() {
            let main_image = product
                .images
                .iter()
                .find(|img| img.is_primary)
                .or_else(|| product.images.first());

            if let Some(img) = main_image {
                attributes.insert("main_image_url".to_string(), json!(img.url));
            }

            // Add additional images
            let other_images: Vec<String> = product
                .images
                .iter()
                .filter(|img| !img.is_primary)
                .take(8) // Amazon typically allows up to 8 additional images
                .map(|img| img.url.clone())
                .collect();

            if !other_images.is_empty() {
                attributes.insert("other_image_urls".to_string(), json!(other_images));
            }
        }

        // Determine product type - this should ideally be provided or mapped
        let product_type = product
            .categories
            .first()
            .cloned()
            .unwrap_or_else(|| "PRODUCT".to_string());

        let listing = ListingSubmission {
            product_type,
            attributes,
            offers: Some(vec![OfferSubmission {
                marketplace_id: self.marketplace_id.clone(),
                price: PriceSubmission {
                    value: product.price.amount.to_f64().unwrap_or(0.0),
                    currency: product.currency.clone(),
                },
            }]),
            fulfillment_availability: Some(vec![FulfillmentAvailability {
                fulfillment_channel_code: "DEFAULT".to_string(),
                quantity: product.quantity as i32,
            }]),
        };

        let url = format!(
            "https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items/{}/{}",
            urlencoding::encode(&self.credentials.app_key), // sellerId
            urlencoding::encode(seller_sku)
        );

        let response = self
            .client
            .put(&url)
            .header("x-amz-access-token", access_token)
            .header("Content-Type", "application/json")
            .json(&listing)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to create product: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Failed to create product: {}",
                error_text
            )));
        }

        // Return the created product
        Ok(product.clone())
    }

    pub async fn update_product(
        &self,
        access_token: &str,
        product_id: &str,
        updates: HashMap<String, Value>,
    ) -> AppResult<Product> {
        // Use PATCH to update specific fields
        // PATCH /listings/2021-08-01/items/{sellerSKU}

        let url = format!(
            "https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items/{}/{}",
            urlencoding::encode(&self.credentials.app_key),
            urlencoding::encode(product_id)
        );

        // Build patch operations
        let mut patches = Vec::new();

        for (key, value) in updates.iter() {
            let op = json!({
                "op": "replace",
                "path": format!("/attributes/{}", key),
                "value": value
            });
            patches.push(op);
        }

        let response = self
            .client
            .patch(&url)
            .header("x-amz-access-token", access_token)
            .header("Content-Type", "application/json-patch+json")
            .json(&patches)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to update product: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Failed to update product: {}",
                error_text
            )));
        }

        // Fetch and return the updated product
        self.fetch_product_detail(access_token, product_id).await
    }

    pub async fn delete_product(&self, access_token: &str, product_id: &str) -> AppResult<()> {
        // DELETE /listings/2021-08-01/items/{sellerSKU}

        let url = format!(
            "https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items/{}/{}",
            urlencoding::encode(&self.credentials.app_key),
            urlencoding::encode(product_id)
        );

        let response = self
            .client
            .delete(&url)
            .header("x-amz-access-token", access_token)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to delete product: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Failed to delete product: {}",
                error_text
            )));
        }

        Ok(())
    }

    pub async fn fetch_product_by_sku(
        &self,
        access_token: &str,
        seller_sku: &str,
    ) -> AppResult<Product> {
        // GET /listings/2021-08-01/items/{sellerSKU}

        let mut params = HashMap::new();
        params.insert("marketplaceIds".to_string(), self.marketplace_id.clone());
        params.insert("issueLocale".to_string(), "en_US".to_string());

        let url = format!(
            "/listings/2021-08-01/items/{}/{}",
            urlencoding::encode(&self.credentials.app_key),
            urlencoding::encode(seller_sku)
        );

        let response = self
            .call_sp_api("GET", &url, Some(params), access_token)
            .await?;

        // Parse the listing response and convert to Product
        let sku = response["sku"].as_str().unwrap_or(seller_sku).to_string();
        let attributes = response["attributes"].as_object();

        let title = attributes
            .and_then(|a| a.get("item_name"))
            .and_then(|v| v.as_str())
            .unwrap_or(&sku)
            .to_string();

        let brand = attributes
            .and_then(|a| a.get("brand"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let description = attributes
            .and_then(|a| a.get("product_description"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        // Extract price from offers
        let price_amount = response["offers"]
            .as_array()
            .and_then(|offers| offers.first())
            .and_then(|offer| offer["price"]["amount"].as_f64())
            .unwrap_or(0.0);

        let currency = response["offers"]
            .as_array()
            .and_then(|offers| offers.first())
            .and_then(|offer| offer["price"]["currency"].as_str())
            .unwrap_or("USD")
            .to_string();

        // Extract quantity from fulfillment availability
        let quantity = response["fulfillmentAvailability"]
            .as_array()
            .and_then(|fa| fa.first())
            .and_then(|f| f["quantity"].as_i64())
            .unwrap_or(0) as i32;

        // Extract images
        let mut images = Vec::new();

        if let Some(main_image) = attributes
            .and_then(|a| a.get("main_image_url"))
            .and_then(|v| v.as_str())
        {
            images.push(ProductImage {
                url: main_image.to_string(),
                alt: None,
                is_primary: true,
                position: 0,
            });
        }

        if let Some(other_images) = attributes
            .and_then(|a| a.get("other_image_urls"))
            .and_then(|v| v.as_array())
        {
            for (i, img_url) in other_images.iter().enumerate() {
                if let Some(url) = img_url.as_str() {
                    images.push(ProductImage {
                        url: url.to_string(),
                        alt: None,
                        is_primary: false,
                        position: (i + 1) as i32,
                    });
                }
            }
        }

        Ok(Product {
            product_id: format!("amazon_{}", sku),
            shop_id: "".to_string(),
            platform: PlatformType::Amazon,
            platform_shop_id: "".to_string(),
            platform_product_id: sku.clone(),
            sku,
            title,
            brand,
            description,
            price: Price {
                amount: rust_decimal::Decimal::from_f64_retain(price_amount).unwrap_or_default(),
                currency: currency.clone(),
                original_price: None,
                discount_percentage: None,
            },
            quantity: quantity as i16,
            images,
            currency,
            attributes: HashMap::new(),
            categories: vec![],
            status: ProductStatus::Active,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
            synced_at: Some(chrono::Utc::now()),
        })
    }

    pub async fn get_product_type_definition(
        &self,
        access_token: &str,
        product_type: &str,
    ) -> AppResult<ProductTypeDefinition> {
        // GET /definitions/2020-09-01/productTypes/{productType}

        let mut params = HashMap::new();
        params.insert("marketplaceIds".to_string(), self.marketplace_id.clone());
        params.insert("locale".to_string(), "en_US".to_string());

        let response = self
            .call_sp_api(
                "GET",
                &format!("/definitions/2020-09-01/productTypes/{}", product_type),
                Some(params),
                access_token,
            )
            .await?;

        serde_json::from_value(response).map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse product type definition: {}", e))
        })
    }

    pub async fn bulk_create_or_update_products(
        &self,
        access_token: &str,
        products: Vec<Product>,
    ) -> AppResult<String> {
        // Use JSON_LISTINGS_FEED for bulk operations
        // Step 1: Create feed document
        let feed_type = "JSON_LISTINGS_FEED";

        // Build the feed content
        let mut feed_items = Vec::new();

        for product in products {
            let mut attributes = serde_json::Map::new();
            attributes.insert("item_name".to_string(), json!(product.title));
            attributes.insert("brand".to_string(), json!(product.brand));

            if let Some(desc) = &product.description {
                attributes.insert("product_description".to_string(), json!(desc));
            }

            // Add images
            if let Some(main_image) = product.images.iter().find(|img| img.is_primary) {
                attributes.insert("main_image_url".to_string(), json!(main_image.url));
            }

            let other_images: Vec<String> = product
                .images
                .iter()
                .filter(|img| !img.is_primary)
                .take(8)
                .map(|img| img.url.clone())
                .collect();

            if !other_images.is_empty() {
                attributes.insert("other_image_urls".to_string(), json!(other_images));
            }

            let product_type = product
                .categories
                .first()
                .cloned()
                .unwrap_or_else(|| "PRODUCT".to_string());

            let feed_item = json!({
                "sku": product.sku,
                "product_type": product_type,
                "attributes": attributes,
                "offers": [{
                    "marketplace_id": self.marketplace_id,
                    "price": {
                        "value": product.price.amount.to_f64().unwrap_or(0.0),
                        "currency": product.currency,
                    }
                }],
                "fulfillment_availability": [{
                    "fulfillment_channel_code": "DEFAULT",
                    "quantity": product.quantity,
                }]
            });

            feed_items.push(feed_item);
        }

        let feed_content = json!({
            "header": {
                "sellerId": self.credentials.app_key,
                "version": "2.0",
                "issueLocale": "en_US"
            },
            "messages": feed_items
        });

        // Step 2: Create feed document
        let create_feed_doc_response = self
            .call_sp_api(
                "POST",
                "/feeds/2021-06-30/documents",
                Some([("contentType".to_string(), "application/json".to_string())].into()),
                access_token,
            )
            .await?;

        let feed_document_id = create_feed_doc_response["feedDocumentId"]
            .as_str()
            .ok_or_else(|| {
                AppError::ExternalApiError("Failed to get feed document ID".to_string())
            })?;

        let upload_url = create_feed_doc_response["url"]
            .as_str()
            .ok_or_else(|| AppError::ExternalApiError("Failed to get upload URL".to_string()))?;

        // Step 3: Upload feed content
        let upload_response = self
            .client
            .put(upload_url)
            .header("Content-Type", "application/json")
            .body(feed_content.to_string())
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to upload feed: {}", e)))?;

        if !upload_response.status().is_success() {
            return Err(AppError::ExternalApiError(
                "Failed to upload feed content".to_string(),
            ));
        }

        // Step 4: Create feed
        let create_feed_payload = json!({
            "feedType": feed_type,
            "marketplaceIds": [self.marketplace_id],
            "inputFeedDocumentId": feed_document_id
        });

        let create_feed_response = self
            .client
            .post("https://sellingpartnerapi-na.amazon.com/feeds/2021-06-30/feeds")
            .header("x-amz-access-token", access_token)
            .header("Content-Type", "application/json")
            .json(&create_feed_payload)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Failed to create feed: {}", e)))?;

        if !create_feed_response.status().is_success() {
            let error_text = create_feed_response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Failed to create feed: {}",
                error_text
            )));
        }

        let feed_response: Value = create_feed_response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse feed response: {}", e))
        })?;

        let feed_id = feed_response["feedId"]
            .as_str()
            .unwrap_or("unknown")
            .to_string();

        Ok(feed_id)
    }

    pub async fn get_feed_status(&self, access_token: &str, feed_id: &str) -> AppResult<String> {
        // GET /feeds/2021-06-30/feeds/{feedId}

        let response = self
            .call_sp_api(
                "GET",
                &format!("/feeds/2021-06-30/feeds/{}", feed_id),
                None,
                access_token,
            )
            .await?;

        let processing_status = response["processingStatus"]
            .as_str()
            .unwrap_or("UNKNOWN")
            .to_string();

        Ok(processing_status)
    }

    pub fn set_marketplace(&mut self, marketplace_id: &str) {
        // Allow setting different marketplace IDs for different regions
        // Common marketplace IDs:
        // ATVPDKIKX0DER - US
        // A2EUQ1WTGCTBG2 - Canada
        // A1AM78C64UM0Y8 - Mexico
        // A2Q3Y263D00KWC - Brazil
        // A1F83G8C2ARO7P - UK
        // A13V1IB3VIYZZH - France
        // A1PA6795UKMFR9 - Germany
        // APJ6JRA9NG5V4 - Italy
        // A1RKKUPIHCS9HS - Spain
        // A21TJRUUN4KGV - India
        // A39IBJ37TRP1C6 - Australia
        // A1VC38T7YXB528 - Japan
        // AAHKV2X7AFYLW - China
        // A19VAU5U5O7RUS - Singapore
        // A2VIGQ35RCS4UG - UAE
        // A1805IZSGTT6HS - Netherlands
        // A17E79C6D8DWNP - Saudi Arabia
        // A33AVAJ2PDY3EV - Turkey
        // A2NODRKZP88ZB9 - Sweden
        // A1C3SOZRARQ6R3 - Poland
        // ARBP9OOSHTCHU - Egypt
        // AMEN7PMS3EDWL - Belgium

        self.marketplace_id = marketplace_id.to_string();
    }
}
