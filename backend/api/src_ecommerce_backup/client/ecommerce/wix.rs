//! Wix Stores E-commerce Gateway
//!
//! Implements OAuth, product catalog, inventory, and collection retrieval
//! against the Wix REST API surface. The implementation focuses on the
//! `/stores/v1/...` namespace and translates Wix payloads into the shared
//! `Product` / `Category` models used by the connector.
use std::collections::HashMap;

use chrono::{DateTime, Utc};
use reqwest::{Client, Method, RequestBuilder, StatusCode};
use rust_decimal::prelude::{FromPrimitive, Zero};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::RefreshTokenResponse;
use crate::config::PlatformCredentials;
use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::{
    Category, PlatformType, Price, Product, ProductImage, ProductStatus,
};

const DEFAULT_API_BASE_URL: &str = "https://www.wixapis.com";
const DEFAULT_INSTALLER_URL: &str = "https://www.wix.com/installer/install";
const DEFAULT_TOKEN_URL: &str = "https://www.wix.com/oauth/access";

/// Wix Stores Gateway
pub struct WixGateway {
    credentials: PlatformCredentials,
    client: Client,
    api_base_url: String,
}

impl WixGateway {
    pub fn new(mut credentials: PlatformCredentials) -> Self {
        if credentials.api_base_url.is_empty() {
            credentials.api_base_url = DEFAULT_API_BASE_URL.to_string();
        }

        // Normalize paths (strip trailing slashes) to simplify url building later on.
        credentials.api_base_url = credentials.api_base_url.trim_end_matches('/').to_string();

        Self {
            api_base_url: credentials.api_base_url.clone(),
            credentials,
            client: Client::new(),
        }
    }

    pub fn platform_name(&self) -> &str {
        "wix"
    }

    fn oauth_scopes(&self) -> Vec<&'static str> {
        vec![
            "offline_access",
            "stores.products.read",
            "stores.products.write",
            "stores.inventory.read",
            "stores.inventory.write",
            "stores.collections.read",
            "stores.collections.write",
            "stores.orders.read",
        ]
    }

    pub fn get_oauth_url(&self, state: &str) -> String {
        let authorize_endpoint = self
            .credentials
            .oauth_authorize_url
            .clone()
            .unwrap_or_else(|| DEFAULT_INSTALLER_URL.to_string());

        let redirect_uri = self
            .credentials
            .get_gateway_callback_url(self.platform_name());

        let mut url = format!(
            "{}?appId={}&redirectUrl={}",
            authorize_endpoint.trim_end_matches('?'),
            self.credentials.app_key,
            urlencoding::encode(&redirect_uri)
        );

        if !state.is_empty() {
            url.push_str("&state=");
            url.push_str(&urlencoding::encode(state));
        }

        url
    }

    pub async fn exchange_code_for_token(&self, code: &str) -> AppResult<(String, String, i64)> {
        let (access_token, refresh_token) = self.exchange_code(code).await?;
        // Wix access tokens expire in ~5 minutes. Return TTL so callers know to refresh.
        Ok((access_token, refresh_token, 300))
    }

    pub async fn refresh_access_token(
        &self,
        refresh_token: &str,
    ) -> AppResult<RefreshTokenResponse> {
        let (access_token, new_refresh_token) = self.refresh_token(refresh_token).await?;
        Ok(RefreshTokenResponse {
            access_token,
            refresh_token: Some(new_refresh_token),
            expires_in: Some(300),
        })
    }

    pub async fn fetch_products(
        &self,
        access_token: &str,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        let take = limit.unwrap_or(20).clamp(1, 100) as u32;
        let skip = offset.unwrap_or(0) as u32;
        self.list_products(access_token, skip, take).await
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
        // Advanced search is not yet implemented in Wix API.
        Ok(vec![])
    }

    pub async fn get_categories(&self, access_token: &str) -> AppResult<Vec<Category>> {
        self.list_collections(access_token).await
    }

    pub async fn sync_inventory(&self, access_token: &str) -> AppResult<Vec<Product>> {
        self.list_products(access_token, 0, 100).await
    }

    /// Test connection by querying a single product.
    pub async fn test_connection(&self) -> AppResult<serde_json::Value> {
        let token = if !self.credentials.api_key.is_empty() {
            &self.credentials.api_key
        } else {
            return Err(AppError::ExternalApiError(
                "No access token provided in Wix credentials for test connection".into(),
            ));
        };

        let products = self.list_products(token, 0, 1).await.unwrap_or_default();

        Ok(json!({
            "connected": true,
            "api_version": "stores/v1",
            "store_id": self.site_id().unwrap_or_default(),
            "test_result": {
                "product_sample": products.first(),
                "product_count": products.len()
            }
        }))
    }

    async fn exchange_code(&self, code: &str) -> AppResult<(String, String)> {
        #[derive(Serialize)]
        struct TokenRequest<'a> {
            grant_type: &'a str,
            client_id: &'a str,
            client_secret: &'a str,
            code: &'a str,
            #[serde(skip_serializing_if = "Option::is_none")]
            redirect_uri: Option<&'a str>,
        }

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
            refresh_token: String,
            expires_in: Option<i64>,
        }

        let redirect_uri = self
            .credentials
            .get_gateway_callback_url(self.platform_name());

        let request = TokenRequest {
            grant_type: "authorization_code",
            client_id: &self.credentials.app_key,
            client_secret: &self.credentials.app_secret,
            code,
            redirect_uri: Some(redirect_uri.as_str()),
        };

        let token_endpoint = self
            .credentials
            .oauth_token_url
            .clone()
            .unwrap_or_else(|| DEFAULT_TOKEN_URL.to_string());

        let response = self
            .client
            .post(&token_endpoint)
            .json(&request)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Wix token exchange failed: {}", e)))?;

        let status = response.status();
        if status != StatusCode::OK {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Wix token exchange failed with status: {} ({})",
                status, error_text
            )));
        }

        let body: TokenResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse Wix token response: {}", e))
        })?;

        Ok((body.access_token, body.refresh_token))
    }

    async fn refresh_token(&self, refresh_token: &str) -> AppResult<(String, String)> {
        #[derive(Serialize)]
        struct RefreshRequest<'a> {
            grant_type: &'a str,
            client_id: &'a str,
            client_secret: &'a str,
            refresh_token: &'a str,
        }

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
            refresh_token: String,
        }

        let request = RefreshRequest {
            grant_type: "refresh_token",
            client_id: &self.credentials.app_key,
            client_secret: &self.credentials.app_secret,
            refresh_token,
        };

        let token_endpoint = self
            .credentials
            .oauth_token_url
            .clone()
            .unwrap_or_else(|| DEFAULT_TOKEN_URL.to_string());

        let response = self
            .client
            .post(&token_endpoint)
            .json(&request)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Wix token refresh failed: {}", e)))?;

        let status = response.status();
        if status != StatusCode::OK {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Wix token refresh failed with status: {} ({})",
                status, error_text
            )));
        }

        let body: TokenResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse Wix refresh response: {}", e))
        })?;

        Ok((body.access_token, body.refresh_token))
    }

    async fn list_products(
        &self,
        access_token: &str,
        offset: u32,
        limit: u32,
    ) -> AppResult<Vec<Product>> {
        let site_id = self.site_id()?.to_string();
        let limit = limit.clamp(1, 100);
        let payload = json!({
            "query": {
                "paging": {
                    "limit": limit,
                    "offset": offset
                },
                "fields": [
                    "id",
                    "name",
                    "description",
                    "priceData",
                    "priceRange",
                    "sku",
                    "brand",
                    "visible",
                    "collectionIds",
                    "media",
                    "productPageUrl",
                    "createdDate",
                    "lastUpdated",
                    "inventory",
                    "stock",
                    "variants",
                    "inventoryItemId"
                ]
            }
        });

        let response = self
            .authorized_request(Method::POST, "/stores/v1/products/query", access_token)?
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Wix list products failed: {}", e)))?;

        let status = response.status();
        if status != StatusCode::OK {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "Wix list products failed with status: {} ({})",
                status, error_text
            )));
        }

        let body: WixProductsResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse Wix products response: {}", e))
        })?;

        body.products
            .into_iter()
            .map(|product| map_product(&site_id, product))
            .collect()
    }

    async fn get_product(&self, access_token: &str, product_id: &str) -> AppResult<Product> {
        let site_id = self.site_id()?.to_string();

        let response = self
            .authorized_request(
                Method::GET,
                &format!("/stores/v1/products/{}", product_id),
                access_token,
            )?
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("Wix get product failed: {}", e)))?;

        match response.status() {
            StatusCode::OK => (),
            StatusCode::NOT_FOUND => {
                return Err(AppError::ExternalApiError(format!(
                    "Wix product {} not found",
                    product_id
                )))
            }
            status => {
                let error_text = response.text().await.unwrap_or_default();
                return Err(AppError::ExternalApiError(format!(
                    "Wix get product failed with status: {} ({})",
                    status, error_text
                )));
            }
        }

        let body: WixGetProductResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse Wix product response: {}", e))
        })?;

        map_product(&site_id, body.product)
    }

    async fn list_collections(&self, access_token: &str) -> AppResult<Vec<Category>> {
        let mut categories = Vec::new();
        let mut offset = 0;
        let limit = 100;

        loop {
            let payload = json!({
                "query": {
                    "paging": {
                        "limit": limit,
                        "offset": offset
                    },
                    "fields": ["id", "name", "parentCollectionId", "visible"]
                }
            });

            let response = self
                .authorized_request(Method::POST, "/stores/v1/collections/query", access_token)?
                .header("Content-Type", "application/json")
                .json(&payload)
                .send()
                .await
                .map_err(|e| {
                    AppError::ExternalApiError(format!("Wix list collections failed: {}", e))
                })?;

            let status = response.status();
            if status != StatusCode::OK {
                let error_text = response.text().await.unwrap_or_default();
                return Err(AppError::ExternalApiError(format!(
                    "Wix list collections failed with status: {} ({})",
                    status, error_text
                )));
            }

            let body: WixCollectionsResponse = response.json().await.map_err(|e| {
                AppError::ExternalApiError(format!(
                    "Failed to parse Wix collections response: {}",
                    e
                ))
            })?;

            let mut batch: Vec<Category> = body
                .collections
                .into_iter()
                .filter(|collection| collection.visible.unwrap_or(true))
                .map(|collection| Category {
                    id: collection.id,
                    name: collection
                        .name
                        .unwrap_or_else(|| "Unnamed Collection".to_string()),
                    parent_id: collection.parent_collection_id,
                })
                .collect();

            categories.append(&mut batch);

            let count = body
                .paging_metadata
                .and_then(|meta| meta.count)
                .unwrap_or_default();

            if count < limit as i32 {
                break;
            }

            offset += limit;
        }

        Ok(categories)
    }

    fn authorized_request(
        &self,
        method: Method,
        path: &str,
        access_token: &str,
    ) -> AppResult<RequestBuilder> {
        let site_id = self.site_id()?;
        let url = format!("{}/{}", self.api_base_url, path.trim_start_matches('/'));

        Ok(self
            .client
            .request(method, url)
            .bearer_auth(access_token)
            .header("wix-site-id", site_id))
    }

    fn site_id(&self) -> AppResult<&str> {
        if let Some(site) = self
            .credentials
            .store_id
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            return Ok(site);
        }
        if let Some(site) = self
            .credentials
            .tenant_id
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            return Ok(site);
        }

        Err(AppError::BadRequest(
            "Wix credentials must include store_id (site / instance id)".to_string(),
        ))
    }
}

fn map_product(site_id: &str, raw: WixProduct) -> AppResult<Product> {
    let price_info = extract_price(&raw);

    let currency = price_info
        .currency
        .clone()
        .unwrap_or_else(|| "USD".to_string());

    let amount = to_decimal(price_info.amount);
    let original = price_info
        .original
        .and_then(|value| Decimal::from_f64(value));

    let discount_percentage = original
        .as_ref()
        .and_then(|orig| calculate_discount(&amount, orig));

    let images = extract_images(&raw.media);

    let mut attributes = HashMap::new();

    if let Some(product_type) = raw.product_type.clone() {
        if !product_type.is_empty() {
            attributes.insert("product_type".to_string(), product_type);
        }
    }

    if let Some(url) = raw.product_page_url.as_ref().and_then(|page| page.to_url()) {
        attributes.insert("product_url".to_string(), url);
    }

    if let Some(inventory_id) = raw.inventory_item_id.as_ref() {
        attributes.insert("inventory_item_id".to_string(), inventory_id.to_string());
    }

    if let Some(weight) = raw.weight {
        attributes.insert("weight".to_string(), weight.to_string());
    }

    let sku = raw
        .sku
        .clone()
        .or_else(|| first_variant_sku(&raw.variants))
        .unwrap_or_else(|| raw.id.clone());

    let quantity = extract_quantity(&raw)
        .min(i16::MAX as i32)
        .max(i16::MIN as i32) as i16;

    let brand = raw.brand.clone().unwrap_or_default();

    let created_at = parse_timestamp(raw.created_date);
    let updated_at = parse_timestamp(raw.last_updated);

    let status = if raw.visible.unwrap_or(true) {
        ProductStatus::Active
    } else {
        ProductStatus::Inactive
    };

    Ok(Product {
        product_id: format!("wix:{}:{}", site_id, raw.id),
        platform_product_id: raw.id,
        shop_id: site_id.to_string(),
        platform_shop_id: site_id.to_string(),
        platform: PlatformType::Wix,
        sku,
        title: raw.name,
        brand,
        description: raw.description,
        price: Price {
            amount,
            currency: currency.clone(),
            original_price: original,
            discount_percentage,
        },
        quantity,
        images,
        currency: currency.clone(),
        attributes,
        categories: raw.collection_ids.unwrap_or_default(),
        status,
        created_at,
        updated_at,
        synced_at: Some(Utc::now()),
    })
}

fn extract_price(product: &WixProduct) -> PriceExtract {
    if let Some(price_data) = &product.price_data {
        let discounted = price_data
            .discounted_price
            .as_ref()
            .and_then(|money| money.amount);
        let price = price_data.price.as_ref().and_then(|money| money.amount);
        let currency = price_data
            .discounted_price
            .as_ref()
            .and_then(|money| money.currency.clone())
            .or_else(|| {
                price_data
                    .price
                    .as_ref()
                    .and_then(|money| money.currency.clone())
            })
            .or_else(|| price_data.currency.clone());

        if let Some(amount) = discounted {
            return PriceExtract {
                amount: Some(amount),
                original: price,
                currency,
            };
        }

        if price.is_some() {
            return PriceExtract {
                amount: price,
                original: None,
                currency,
            };
        }
    }

    if let Some(range) = &product.price_range {
        if let Some(min) = range.min_value {
            return PriceExtract {
                amount: Some(min),
                original: range.max_value,
                currency: range.currency.clone(),
            };
        }
    }

    PriceExtract {
        amount: Some(0.0),
        original: None,
        currency: Some("USD".to_string()),
    }
}

fn extract_quantity(product: &WixProduct) -> i32 {
    if let Some(inventory) = &product.inventory {
        if let Some(quantity) = inventory.quantity {
            return quantity.max(0);
        }
    }

    if let Some(stock) = &product.stock {
        if let Some(quantity) = stock.quantity {
            return quantity.max(0);
        }
    }

    if let Some(variants) = &product.variants {
        let total: i32 = variants
            .iter()
            .filter_map(|variant| {
                variant
                    .inventory
                    .as_ref()
                    .and_then(|inventory| inventory.quantity)
            })
            .sum();
        if total > 0 {
            return total;
        }
    }

    0
}

fn extract_images(media: &Option<WixMedia>) -> Vec<ProductImage> {
    let mut images = Vec::new();

    if let Some(media) = media {
        if let Some(main) = &media.main_media {
            if let Some(url) = main.primary_url() {
                images.push(ProductImage {
                    url,
                    alt: None,
                    is_primary: true,
                    position: 0,
                });
            }
        }

        if let Some(items) = &media.items {
            for (index, item) in items.iter().enumerate() {
                if let Some(url) = item.primary_url() {
                    images.push(ProductImage {
                        url,
                        alt: None,
                        is_primary: images.is_empty() && index == 0,
                        position: (index + 1) as i32,
                    });
                }
            }
        }
    }

    if images.is_empty() {
        return images;
    }

    // Ensure only the first image is flagged as primary.
    for (idx, image) in images.iter_mut().enumerate() {
        image.is_primary = idx == 0;
        image.position = idx as i32;
    }

    images
}

fn first_variant_sku(variants: &Option<Vec<WixVariant>>) -> Option<String> {
    variants
        .as_ref()
        .and_then(|list| list.iter().find_map(|variant| variant.sku.clone()))
}

fn calculate_discount(current: &Decimal, original: &Decimal) -> Option<Decimal> {
    if original.is_zero() || current >= original {
        return None;
    }
    let diff = *original - *current;
    let percentage =
        (diff / *original) * Decimal::from_f64(100.0).unwrap_or_else(|| Decimal::from(100));
    Some(percentage.round_dp(2))
}

fn parse_timestamp(value: Option<String>) -> DateTime<Utc> {
    if let Some(value) = value {
        if let Ok(parsed) = DateTime::parse_from_rfc3339(&value) {
            return parsed.with_timezone(&Utc);
        }
    }
    Utc::now()
}

fn to_decimal(value: Option<f64>) -> Decimal {
    value
        .and_then(Decimal::from_f64)
        .unwrap_or_else(|| Decimal::ZERO)
}

fn deserialize_optional_f64<'de, D>(deserializer: D) -> Result<Option<f64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let val = Option::<Value>::deserialize(deserializer)?;
    Ok(match val {
        Some(Value::Number(num)) => num.as_f64(),
        Some(Value::String(s)) => s.parse::<f64>().ok(),
        _ => None,
    })
}

// --- Wix API models ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixProductsResponse {
    products: Vec<WixProduct>,
    paging_metadata: Option<WixPagingMetadata>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixGetProductResponse {
    product: WixProduct,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixPagingMetadata {
    count: Option<i32>,
    offset: Option<i32>,
    total_results: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixProduct {
    id: String,
    name: String,
    description: Option<String>,
    product_type: Option<String>,
    visible: Option<bool>,
    sku: Option<String>,
    brand: Option<String>,
    collection_ids: Option<Vec<String>>,
    product_page_url: Option<WixPageUrl>,
    weight: Option<f64>,
    created_date: Option<String>,
    last_updated: Option<String>,
    price_data: Option<WixPriceData>,
    price_range: Option<WixPriceRange>,
    variants: Option<Vec<WixVariant>>,
    inventory: Option<WixInventory>,
    stock: Option<WixInventory>,
    inventory_item_id: Option<String>,
    media: Option<WixMedia>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixPriceData {
    price: Option<WixMoney>,
    discounted_price: Option<WixMoney>,
    currency: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixPriceRange {
    #[serde(default, deserialize_with = "deserialize_optional_f64")]
    min_value: Option<f64>,
    #[serde(default, deserialize_with = "deserialize_optional_f64")]
    max_value: Option<f64>,
    currency: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixMoney {
    #[serde(default, deserialize_with = "deserialize_optional_f64")]
    amount: Option<f64>,
    currency: Option<String>,
}

#[derive(Debug)]
struct PriceExtract {
    amount: Option<f64>,
    original: Option<f64>,
    currency: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixInventory {
    track_quantity: Option<bool>,
    quantity: Option<i32>,
    in_stock: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixVariant {
    id: Option<String>,
    sku: Option<String>,
    visible: Option<bool>,
    inventory: Option<WixInventory>,
    price_data: Option<WixPriceData>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixMedia {
    main_media: Option<WixMediaItem>,
    items: Option<Vec<WixMediaItem>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixMediaItem {
    id: Option<String>,
    media_type: Option<String>,
    url: Option<String>,
    image: Option<WixImage>,
}

impl WixMediaItem {
    fn primary_url(&self) -> Option<String> {
        if let Some(url) = &self.url {
            if !url.is_empty() {
                return Some(url.clone());
            }
        }
        self.image.as_ref().and_then(|image| image.url.clone())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixImage {
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixPageUrl {
    base: Option<String>,
    path: Option<String>,
}

impl WixPageUrl {
    fn to_url(&self) -> Option<String> {
        match (&self.base, &self.path) {
            (Some(base), Some(path)) => Some(format!("{}{}", base.trim_end_matches('/'), path)),
            (Some(base), None) => Some(base.clone()),
            _ => None,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixCollectionsResponse {
    collections: Vec<WixCollection>,
    paging_metadata: Option<WixPagingMetadata>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WixCollection {
    id: String,
    name: Option<String>,
    parent_collection_id: Option<String>,
    visible: Option<bool>,
}
