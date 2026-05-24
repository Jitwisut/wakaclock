//! eBay Stores Gateway
//!
//! Provides OAuth helpers plus catalog, offer, and taxonomy lookups using the
//! Sell Inventory and Commerce Taxonomy APIs. The implementation focuses on the
//! Inventory → Offer workflow that underpins modern eBay listings.

use std::collections::HashMap;
use std::str::FromStr;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::{DateTime, Utc};
use reqwest::{
    header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE, USER_AGENT},
    Client, Method, RequestBuilder, StatusCode,
};
use rust_decimal::{prelude::FromPrimitive, Decimal};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use super::RefreshTokenResponse;
use crate::config::PlatformCredentials;
use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::{
    Category, PlatformType, Price, Product, ProductImage, ProductStatus,
};

const DEFAULT_MARKETPLACE_ID: &str = "EBAY_US";
const PROD_API_BASE: &str = "https://api.ebay.com";
const SANDBOX_API_BASE: &str = "https://api.sandbox.ebay.com";
const PROD_AUTH_BASE: &str = "https://auth.ebay.com";
const SANDBOX_AUTH_BASE: &str = "https://auth.sandbox.ebay.com";

/// eBay gateway implementation
pub struct EbayGateway {
    credentials: PlatformCredentials,
    client: Client,
    api_base_url: String,
    auth_base_url: String,
    marketplace_id: String,
}

impl EbayGateway {
    pub fn new(credentials: PlatformCredentials) -> Self {
        let mut api_base_url = credentials
            .api_base_url
            .trim()
            .trim_end_matches('/')
            .to_string();
        if api_base_url.is_empty() {
            api_base_url = PROD_API_BASE.to_string();
        }

        let is_sandbox = api_base_url.contains("sandbox");
        let auth_base_url = if is_sandbox {
            SANDBOX_AUTH_BASE.to_string()
        } else {
            PROD_AUTH_BASE.to_string()
        };

        let marketplace_id = credentials
            .market
            .clone()
            .filter(|m| !m.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_MARKETPLACE_ID.to_string());

        Self {
            credentials,
            client: Client::new(),
            api_base_url,
            auth_base_url,
            marketplace_id,
        }
    }

    fn oauth_scopes(&self) -> Vec<&'static str> {
        vec![
            "https://api.ebay.com/oauth/api_scope",
            "https://api.ebay.com/oauth/api_scope/sell.inventory",
            "https://api.ebay.com/oauth/api_scope/sell.offer",
            "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
            "https://api.ebay.com/oauth/api_scope/sell.account",
            "https://api.ebay.com/oauth/api_scope/sell.marketing",
        ]
    }

    fn auth_header_basic(&self) -> AppResult<String> {
        let header = BASE64.encode(format!(
            "{}:{}",
            self.credentials.app_key, self.credentials.app_secret
        ));
        Ok(format!("Basic {}", header))
    }

    fn seller_id(&self) -> Option<&str> {
        self.credentials
            .store_id
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| {
                self.credentials
                    .tenant_id
                    .as_deref()
                    .filter(|value| !value.trim().is_empty())
            })
    }

    fn category_tree_id(&self) -> &str {
        if let Some(tree) = self
            .credentials
            .service_id
            .as_deref()
            .filter(|value| !value.trim().is_empty())
        {
            return tree;
        }

        match self.marketplace_id.as_str() {
            "EBAY_US" => "0",
            "EBAY_CA" => "2",
            "EBAY_GB" => "3",
            "EBAY_DE" => "77",
            "EBAY_AU" => "15",
            "EBAY_FR" => "71",
            "EBAY_IT" => "101",
            "EBAY_ES" => "186",
            _ => "0",
        }
    }

    fn authorized_request(
        &self,
        method: Method,
        path: &str,
        access_token: &str,
        include_marketplace_header: bool,
    ) -> AppResult<RequestBuilder> {
        let url = format!(
            "{}/{}",
            self.api_base_url.trim_end_matches('/'),
            path.trim_start_matches('/')
        );

        let mut builder = self.client.request(method, url).bearer_auth(access_token);

        if include_marketplace_header {
            builder = builder.header("X-EBAY-C-MARKETPLACE-ID", &self.marketplace_id);
        }

        builder = builder.header(USER_AGENT, "ecommerce-connect/ebay-gateway (rust)");
        Ok(builder)
    }

    pub fn platform_name(&self) -> &str {
        "ebay"
    }

    pub fn get_oauth_url(&self, state: &str) -> String {
        let scopes = self.oauth_scopes().join(" ");
        let redirect_uri = self
            .credentials
            .get_oauth_redirect_url(self.platform_name(), "https://app.lodashventure.local");

        format!(
            "{}/oauth2/authorize?client_id={}&response_type=code&redirect_uri={}&scope={}&state={}",
            PROD_AUTH_BASE,
            self.credentials.app_key,
            urlencoding::encode(&redirect_uri),
            urlencoding::encode(&scopes),
            state
        )
    }

    pub async fn exchange_code_for_token(&self, code: &str) -> AppResult<(String, String, i64)> {
        let redirect_uri = self.credentials.redirect_uri.clone().unwrap_or_else(|| {
            self.credentials
                .get_oauth_redirect_url(self.platform_name(), "https://app.lodashventure.local")
        });

        let form = [
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", redirect_uri.as_str()),
        ];

        let response = self
            .client
            .post(format!("{}/identity/v1/oauth2/token", self.auth_base_url))
            .header(AUTHORIZATION, self.auth_header_basic()?)
            .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
            .form(&form)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("eBay token exchange failed: {}", e))
            })?;

        let status = response.status();
        if status != StatusCode::OK {
            let text = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "eBay token exchange failed: status {} ({})",
                status, text
            )));
        }

        let body: EbayTokenResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse eBay token response: {}", e))
        })?;

        Ok((
            body.access_token,
            body.refresh_token.unwrap_or_default(),
            body.expires_in.unwrap_or(7200),
        ))
    }

    pub async fn refresh_access_token(
        &self,
        refresh_token: &str,
    ) -> AppResult<RefreshTokenResponse> {
        let scopes_joined = self.oauth_scopes().join(" ");
        let form = [
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("scope", scopes_joined.as_str()),
        ];

        let response = self
            .client
            .post(format!("{}/identity/v1/oauth2/token", self.auth_base_url))
            .header(AUTHORIZATION, self.auth_header_basic()?)
            .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
            .form(&form)
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("eBay token refresh failed: {}", e)))?;

        let status = response.status();
        if status != StatusCode::OK {
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "eBay token refresh failed with status {} ({})",
                status, body
            )));
        }

        let body: EbayTokenResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse eBay refresh response: {}", e))
        })?;

        Ok(RefreshTokenResponse {
            access_token: body.access_token,
            refresh_token: body.refresh_token,
            expires_in: body.expires_in,
        })
    }

    pub async fn fetch_products(
        &self,
        access_token: &str,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        let limit = limit.unwrap_or(20).clamp(1, 100) as u32;
        let offset = offset.unwrap_or(0) as u32;

        let response = self
            .authorized_request(
                Method::GET,
                "/sell/inventory/v1/inventory_item",
                access_token,
                false,
            )?
            .query(&[("limit", limit.to_string()), ("offset", offset.to_string())])
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("eBay inventory list failed: {}", e))
            })?;

        let status = response.status();
        if status != StatusCode::OK {
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "eBay inventory list failed with status {} ({})",
                status, body
            )));
        }

        let payload: InventoryItemsResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse eBay inventory response: {}", e))
        })?;

        let seller_id = self.seller_id().unwrap_or_default().to_string();

        let mut products = Vec::new();
        if let Some(items) = payload.inventory_items {
            for item in items {
                if let Ok(product) = self
                    .map_inventory_item(access_token, &seller_id, item)
                    .await
                {
                    products.push(product);
                }
            }
        }

        Ok(products)
    }

    pub async fn fetch_product_detail(
        &self,
        access_token: &str,
        product_id: &str,
    ) -> AppResult<Product> {
        let response = self
            .authorized_request(
                Method::GET,
                &format!("/sell/inventory/v1/inventory_item/{}", product_id),
                access_token,
                false,
            )?
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("eBay inventory get failed: {}", e)))?;

        match response.status() {
            StatusCode::OK => (),
            StatusCode::NOT_FOUND => {
                return Err(AppError::ExternalApiError(format!(
                    "eBay inventory item {} not found",
                    product_id
                )))
            }
            status => {
                let body = response.text().await.unwrap_or_default();
                return Err(AppError::ExternalApiError(format!(
                    "eBay inventory get failed with status {} ({})",
                    status, body
                )));
            }
        }

        let item: InventoryItem = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse eBay inventory item: {}", e))
        })?;

        let seller_id = self.seller_id().unwrap_or_default().to_string();
        self.map_inventory_item(access_token, &seller_id, item)
            .await
    }

    pub async fn search_products(
        &self,
        access_token: &str,
        query: &str,
        limit: Option<usize>,
    ) -> AppResult<Vec<Product>> {
        // eBay inventory search does not provide fuzzy search by keyword.
        // As a fallback, iterate through inventory items and filter locally.
        let mut products = self
            .fetch_products(access_token, Some(limit.unwrap_or(20)), Some(0))
            .await?;
        products.retain(|product| product.title.to_lowercase().contains(&query.to_lowercase()));
        Ok(products)
    }

    pub async fn get_categories(&self, access_token: &str) -> AppResult<Vec<Category>> {
        let response = self
            .authorized_request(
                Method::GET,
                &format!(
                    "/commerce/taxonomy/v1/category_tree/{}",
                    self.category_tree_id()
                ),
                access_token,
                false,
            )?
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalApiError(format!("eBay taxonomy request failed: {}", e))
            })?;

        let status = response.status();
        if status != StatusCode::OK {
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "eBay taxonomy request failed with status {} ({})",
                status, body
            )));
        }

        let tree: CategoryTreeResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse eBay taxonomy tree: {}", e))
        })?;

        let mut categories = Vec::new();
        flatten_category_tree(&tree.root_category_node, None, &mut categories);
        Ok(categories)
    }

    pub async fn test_connection(&self) -> AppResult<serde_json::Value> {
        let token = if !self.credentials.api_key.is_empty() {
            self.credentials.api_key.clone()
        } else {
            return Err(AppError::ExternalApiError(
                "No access_token available for eBay test connection".to_string(),
            ));
        };

        let products = self
            .fetch_products(&token, Some(1), Some(0))
            .await
            .unwrap_or_default();

        Ok(json!({
            "connected": true,
            "marketplace": self.marketplace_id,
            "seller_id": self.seller_id(),
            "sample_product": products.first()
        }))
    }

    pub async fn sync_inventory(&self, access_token: &str) -> AppResult<Vec<Product>> {
        self.fetch_products(access_token, Some(100), Some(0)).await
    }

    async fn map_inventory_item(
        &self,
        access_token: &str,
        seller_id: &str,
        item: InventoryItem,
    ) -> AppResult<Product> {
        let InventoryItem {
            sku,
            product,
            availability,
        } = item;

        let product_meta = product.unwrap_or_default();
        let quantity = availability
            .and_then(|avail| avail.ship_to_location_availability)
            .and_then(|avail| avail.quantity)
            .unwrap_or(0)
            .clamp(0, i16::MAX as i32) as i16;

        let images: Vec<ProductImage> = product_meta
            .image_urls
            .clone()
            .unwrap_or_default()
            .into_iter()
            .enumerate()
            .map(|(idx, url)| ProductImage {
                url,
                alt: None,
                is_primary: idx == 0,
                position: idx as i32,
            })
            .collect();

        let aspects = product_meta
            .aspects
            .clone()
            .unwrap_or_default()
            .into_iter()
            .map(|(key, values)| (key, values.join(", ")))
            .collect::<HashMap<_, _>>();

        let price_info = self.get_price_for_sku(access_token, &sku).await?;
        let currency = price_info.currency.clone();

        Ok(Product {
            product_id: format!("ebay:{}:{}", seller_id, sku),
            shop_id: seller_id.to_string(),
            platform_shop_id: seller_id.to_string(),
            platform_product_id: sku.clone(),
            platform: PlatformType::Ebay,
            sku: sku.clone(),
            title: product_meta.title.clone().unwrap_or_else(|| sku.clone()),
            brand: product_meta.brand.unwrap_or_default(),
            description: product_meta.description.clone(),
            price: price_info.clone(),
            currency,
            quantity,
            images,
            categories: Vec::new(), // category id requires taxonomy mapping per offer; not returned in inventory item
            attributes: aspects,
            status: if quantity > 0 {
                ProductStatus::Active
            } else {
                ProductStatus::Inactive
            },
            created_at: Utc::now(),
            updated_at: Utc::now(),
            synced_at: Some(Utc::now()),
        })
    }

    async fn get_price_for_sku(&self, access_token: &str, sku: &str) -> AppResult<Price> {
        let response = self
            .authorized_request(Method::GET, "/sell/inventory/v1/offer", access_token, true)?
            .query(&[("sku", sku)])
            .send()
            .await
            .map_err(|e| AppError::ExternalApiError(format!("eBay offers query failed: {}", e)))?;

        if response.status() == StatusCode::NOT_FOUND {
            return Ok(Price {
                amount: Decimal::ZERO,
                currency: "USD".to_string(),
                original_price: None,
                discount_percentage: None,
            });
        }

        let status = response.status();
        if status != StatusCode::OK {
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApiError(format!(
                "eBay offers query failed with status {} ({})",
                status, body
            )));
        }

        let offers: OffersResponse = response.json().await.map_err(|e| {
            AppError::ExternalApiError(format!("Failed to parse eBay offers response: {}", e))
        })?;

        let mut price = Price {
            amount: Decimal::ZERO,
            currency: "USD".to_string(),
            original_price: None,
            discount_percentage: None,
        };

        if let Some(offer) = offers.offers.and_then(|mut list| list.pop()) {
            if let Some(pricing) = offer.pricing_summary {
                if let Some(price_money) = pricing.price.as_ref() {
                    if let Some(amount) =
                        parse_decimal(price_money.value.clone(), price_money.currency.as_deref())
                    {
                        price.amount = amount;
                    }
                    if let Some(currency) = price_money.currency.clone() {
                        price.currency = currency;
                    }
                }

                if let Some(original_money) = pricing.original_price.as_ref() {
                    if let Some(original) = parse_decimal(
                        original_money.value.clone(),
                        original_money.currency.as_deref(),
                    ) {
                        price.original_price = Some(original);
                        if original > Decimal::ZERO && price.amount < original {
                            if let Some(hundred) = Decimal::from_i32(100) {
                                let discount = (original - price.amount) / original * hundred;
                                price.discount_percentage = Some(discount.round_dp(2));
                            }
                        }
                    }
                }
            }
        }

        Ok(price)
    }
}

fn flatten_category_tree(
    node: &CategoryTreeNode,
    parent: Option<String>,
    output: &mut Vec<Category>,
) {
    output.push(Category {
        id: node.category_id.clone(),
        name: node.category_name.clone(),
        parent_id: parent,
    });

    if let Some(children) = &node.child_category_tree_nodes {
        for child in children {
            flatten_category_tree(child, Some(node.category_id.clone()), output);
        }
    }
}

fn parse_decimal(value: Option<String>, _currency: Option<&str>) -> Option<Decimal> {
    value.as_deref().and_then(|v| Decimal::from_str(v).ok())
}

// -------------------- API payload models --------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EbayTokenResponse {
    access_token: String,
    #[serde(default)]
    refresh_token: Option<String>,
    #[serde(default)]
    expires_in: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InventoryItemsResponse {
    #[serde(default)]
    inventory_items: Option<Vec<InventoryItem>>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InventoryItem {
    sku: String,
    #[serde(default)]
    product: Option<InventoryProduct>,
    #[serde(default)]
    availability: Option<Availability>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InventoryProduct {
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    brand: Option<String>,
    #[serde(default)]
    image_urls: Option<Vec<String>>,
    #[serde(default)]
    aspects: Option<HashMap<String, Vec<String>>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Availability {
    #[serde(default)]
    ship_to_location_availability: Option<ShipToLocationAvailability>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ShipToLocationAvailability {
    #[serde(default)]
    quantity: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OffersResponse {
    #[serde(default)]
    offers: Option<Vec<Offer>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Offer {
    #[serde(default)]
    pricing_summary: Option<PricingSummary>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PricingSummary {
    #[serde(default)]
    price: Option<EbayAmount>,
    #[serde(default)]
    original_price: Option<EbayAmount>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EbayAmount {
    #[serde(default)]
    value: Option<String>,
    #[serde(default)]
    currency: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CategoryTreeResponse {
    root_category_node: CategoryTreeNode,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CategoryTreeNode {
    category_id: String,
    category_name: String,
    #[serde(default)]
    child_category_tree_nodes: Option<Vec<CategoryTreeNode>>,
}
