use std::{collections::HashMap, sync::Arc};

use axum::{
    extract::{Path, State},
    http::HeaderMap,
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use rust_decimal::prelude::ToPrimitive;
use serde::Deserialize;
use serde_json::{json, Value};
use tracing::{error, warn};

use crate::{
    client::{
        ecommerce::{
            lineshopping::LineShoppingGateway, medusa::MedusaGateway, wix::WixGateway,
            woocommerce::WooCommerceGateway, zoho::ZohoGateway,
        },
        strapi::shop_tokens::{fetch_shop_token, resolve_api_key as resolve_cached_api_key},
    },
    config::PlatformCredentials,
    interfaces::platform_gateway::{
        Credentials, ListProductParams, PlatformGateway, PlatformProduct, ProductList, ShopInfo,
    },
    model::error::AppError,
    model::v1::platfrom::entries::Product as DomainProduct,
    AppState,
};

/// Build router for gateway proxy endpoints (non-versioned).
pub fn router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/:platform/oauth/validate",
            post(validate_credentials_handler),
        )
        .route("/:platform/shop/info", get(shop_info_handler))
        .route("/:platform/products/list", post(list_products_handler))
        .with_state(state)
}

async fn validate_credentials_handler(
    State(state): State<Arc<AppState>>,
    Path(platform): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    match platform.as_str() {
        "woocommerce" => validate_woocommerce(headers).await,
        "medusa" => validate_medusa(headers).await,
        "lineshopping" => validate_lineshopping(&state, headers).await,
        "wix" => validate_wix(&state, headers).await,
        "zoho" => validate_zoho(&state, headers).await,
        other => Err(AppError::BadRequest(format!(
            "Unsupported platform: {}",
            other
        ))),
    }
}

async fn shop_info_handler(
    State(state): State<Arc<AppState>>,
    Path(platform): Path<String>,
    headers: HeaderMap,
) -> Result<Json<ShopInfo>, AppError> {
    match platform.as_str() {
        "woocommerce" => shop_info_woocommerce(headers).await,
        "medusa" => shop_info_medusa(headers).await,
        "lineshopping" => shop_info_lineshopping(&state, headers).await,
        "wix" => shop_info_wix(&state, headers).await,
        "zoho" => shop_info_zoho(&state, headers).await,
        other => Err(AppError::BadRequest(format!(
            "Unsupported platform: {}",
            other
        ))),
    }
}

#[derive(Debug, Deserialize)]
struct ProductListBody {
    page: Option<u32>,
    limit: Option<u32>,
    status: Option<String>,
    search: Option<String>,
    #[allow(dead_code)]
    category: Option<u32>,
    offset: Option<u32>,
    sort: Option<String>,
    shop_id: Option<String>,
}

struct WixGatewayContext {
    gateway: WixGateway,
    access_token: String,
    site_id: String,
    store_url: Option<String>,
}

struct ZohoGatewayContext {
    gateway: ZohoGateway,
    access_token: String,
    tenant_id: String,
    store_url: Option<String>,
}

async fn list_products_handler(
    State(state): State<Arc<AppState>>,
    Path(platform): Path<String>,
    headers: HeaderMap,
    Json(body): Json<ProductListBody>,
) -> Result<Json<ProductList>, AppError> {
    match platform.as_str() {
        "woocommerce" => list_products_woocommerce(headers, body).await,
        "medusa" => list_products_medusa(headers, body).await,
        "lineshopping" => list_products_lineshopping(&state, headers, body).await,
        "wix" => list_products_wix(&state, headers, body).await,
        "zoho" => list_products_zoho(&state, headers, body).await,
        other => Err(AppError::BadRequest(format!(
            "Unsupported platform: {}",
            other
        ))),
    }
}

fn get_required_header(headers: &HeaderMap, name: &str) -> Result<String, AppError> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::BadRequest(format!("Missing required header '{}'", name)))
}

fn get_optional_header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn extract_access_token(headers: &HeaderMap, platform_label: &str) -> Result<String, AppError> {
    if let Some(token) = get_optional_header(headers, "x-access-token") {
        return Ok(token);
    }

    if let Some(token) = get_optional_header(headers, "authorization") {
        let token = token
            .strip_prefix("Bearer ")
            .unwrap_or(token.as_str())
            .trim()
            .to_string();
        if !token.is_empty() {
            return Ok(token);
        }
    }

    Err(AppError::Unauthorized(format!(
        "{platform_label} access token is required; provide x-access-token or Authorization header."
    )))
}

fn build_wix_context(
    state: &Arc<AppState>,
    headers: &HeaderMap,
) -> Result<WixGatewayContext, AppError> {
    let mut credentials = state
        .config
        .get_platform_credentials_optional("wix")
        .unwrap_or_else(PlatformCredentials::default);

    if let Some(base_url) = get_optional_header(headers, "x-api-base-url")
        .or_else(|| get_optional_header(headers, "x-base-url"))
        .or_else(|| get_optional_header(headers, "x-store-url"))
    {
        credentials.api_base_url = base_url.clone();
        credentials.base_url = Some(base_url);
    }

    let store_url = get_optional_header(headers, "x-store-url");

    let site_id = get_optional_header(headers, "x-site-id")
        .or_else(|| get_optional_header(headers, "x-instance-id"))
        .or_else(|| get_optional_header(headers, "x-shop-id"))
        .or_else(|| get_optional_header(headers, "x-platform-shop-id"))
        .or_else(|| credentials.store_id.clone())
        .ok_or_else(|| {
            AppError::BadRequest(
                "Missing Wix site identifier. Provide x-site-id or x-shop-id header.".to_string(),
            )
        })?;

    credentials.store_id = Some(site_id.clone());

    let access_token = extract_access_token(headers, "Wix")?;
    if credentials.api_key.is_empty() {
        credentials.api_key = access_token.clone();
    }

    let gateway = WixGateway::new(credentials);

    Ok(WixGatewayContext {
        gateway,
        access_token,
        site_id,
        store_url,
    })
}

fn build_zoho_context(
    state: &Arc<AppState>,
    headers: &HeaderMap,
) -> Result<ZohoGatewayContext, AppError> {
    let mut credentials = state
        .config
        .get_platform_credentials_optional("zoho")
        .unwrap_or_else(PlatformCredentials::default);

    if let Some(base_url) = get_optional_header(headers, "x-api-base-url")
        .or_else(|| get_optional_header(headers, "x-store-url"))
    {
        credentials.api_base_url = base_url.clone();
        credentials.base_url = Some(base_url);
    }

    let tenant_id = get_optional_header(headers, "x-zoho-organization-id")
        .or_else(|| get_optional_header(headers, "x-org-id"))
        .or_else(|| get_optional_header(headers, "x-organization-id"))
        .or_else(|| get_optional_header(headers, "x-tenant-id"))
        .or_else(|| get_optional_header(headers, "x-shop-id"))
        .or_else(|| get_optional_header(headers, "x-platform-shop-id"))
        .or_else(|| credentials.tenant_id.clone())
        .ok_or_else(|| {
            AppError::BadRequest(
                "Missing Zoho organization identifier. Provide x-org-id or configure ZOHO_TENANT_ID."
                    .to_string(),
            )
        })?;

    credentials.tenant_id = Some(tenant_id.clone());

    let access_token = extract_access_token(headers, "Zoho")?;
    let store_url =
        get_optional_header(headers, "x-store-url").or_else(|| credentials.base_url.clone());

    let gateway = ZohoGateway::new(credentials, tenant_id.clone());

    Ok(ZohoGatewayContext {
        gateway,
        access_token,
        tenant_id,
        store_url,
    })
}

fn domain_product_to_platform_product(product: &DomainProduct) -> PlatformProduct {
    let has_platform_id = !product.platform_product_id.trim().is_empty();
    let id = if has_platform_id {
        product.platform_product_id.clone()
    } else {
        product.product_id.clone()
    };

    let platform_id = if has_platform_id {
        Some(product.platform_product_id.clone())
    } else {
        None
    };

    let sku_value = product.sku.trim();
    let sku = if sku_value.is_empty() {
        None
    } else {
        Some(product.sku.clone())
    };

    let images = product
        .images
        .iter()
        .map(|image| image.url.clone())
        .collect::<Vec<String>>();

    PlatformProduct {
        id,
        platform_id,
        title: product.title.clone(),
        description: product.description.clone(),
        price: product.price.amount.to_f64().unwrap_or(0.0),
        currency: product.currency.clone(),
        sku,
        quantity: Some(i32::from(product.quantity)),
        images,
        variants: Vec::new(),
        status: product.status.to_string(),
        attributes: product.attributes.clone(),
        created_at: Some(product.created_at),
        updated_at: Some(product.updated_at),
    }
}

fn build_woocommerce_credentials(
    headers: &HeaderMap,
) -> Result<(PlatformCredentials, String), AppError> {
    let consumer_key = get_required_header(headers, "x-api-key")?;
    let consumer_secret = get_required_header(headers, "x-api-secret")?;

    let store_url = headers
        .get("x-store-url")
        .or_else(|| headers.get("x-shop-id"))
        .and_then(|value| value.to_str().ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            AppError::BadRequest(
                "Missing required header 'x-shop-id' or 'x-store-url' for WooCommerce".to_string(),
            )
        })?;

    let mut credentials = PlatformCredentials::default();
    credentials.api_key = consumer_key.clone();
    credentials.app_key = consumer_key;
    credentials.app_secret = consumer_secret;
    credentials.api_base_url = store_url.clone();
    credentials.base_url = Some(store_url.clone());

    Ok((credentials, store_url))
}

fn build_medusa_credentials(headers: &HeaderMap) -> Result<(Credentials, String), AppError> {
    let publishable_key = get_required_header(headers, "x-publishable-api-key")?;

    let store_url = headers
        .get("x-store-url")
        .or_else(|| headers.get("x-base-url"))
        .or_else(|| headers.get("x-shop-id"))
        .and_then(|value| value.to_str().ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            AppError::BadRequest("Missing required header 'x-store-url' for Medusa".to_string())
        })?;

    let admin_token = headers
        .get("x-api-token")
        .or_else(|| headers.get("authorization"))
        .and_then(|value| value.to_str().ok())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.strip_prefix("Bearer ").unwrap_or(s).to_string());

    let mut extra = HashMap::new();
    extra.insert("base_url".to_string(), store_url.clone());

    let credentials = Credentials {
        api_key: Some(publishable_key),
        api_secret: None,
        access_token: admin_token,
        refresh_token: None,
        store_url: Some(store_url.clone()),
        shop_id: None,
        additional: HashMap::new(),
        extra,
    };

    Ok((credentials, store_url))
}

async fn build_lineshopping_credentials(
    state: &Arc<AppState>,
    headers: &HeaderMap,
) -> Result<PlatformCredentials, AppError> {
    let header_api_key = get_optional_header(headers, "x-api-key");
    let mut credentials = state
        .config
        .get_platform_credentials_optional("lineshopping")
        .unwrap_or_else(PlatformCredentials::default);

    if let Some(api_key) = header_api_key {
        credentials.api_key = api_key;
    } else {
        let org_id = get_optional_header(headers, "x-org-id")
            .or_else(|| get_optional_header(headers, "x-organization-id"));
        let shop_id = get_optional_header(headers, "x-shop-id")
            .or_else(|| get_optional_header(headers, "x-platform-shop-id"));

        let (org_id, shop_id) = org_id.zip(shop_id).ok_or_else(|| {
            AppError::Unauthorized(
                "Provide x-api-key header or include x-org-id and x-shop-id headers so cached credentials can be used."
                    .to_string(),
            )
        })?;

        match fetch_shop_token("lineshopping", &shop_id, &org_id).await? {
            Some(entry) => {
                if let Some(api_key) = resolve_cached_api_key(&entry) {
                    credentials.api_key = api_key;
                    if credentials.store_id.is_none() {
                        credentials.store_id = entry.platform_shop_id.clone();
                    }
                } else {
                    return Err(AppError::Unauthorized(
                        "Stored LINE Shopping credentials are missing an API key; reconnect the shop."
                            .to_string(),
                    ));
                }
            }
            None => {
                return Err(AppError::Unauthorized(format!(
                    "No cached LINE Shopping credentials for shop {} (org {}). Reconnect the shop or pass x-api-key.",
                    shop_id, org_id
                )));
            }
        }
    }

    let base_url = headers
        .get("x-api-base-url")
        .or_else(|| headers.get("x-base-url"))
        .or_else(|| headers.get("x-store-url"))
        .and_then(|value| value.to_str().ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if let Some(url) = base_url {
        credentials.api_base_url = url.clone();
        credentials.base_url = Some(url);
    }

    if credentials.api_key.is_empty() {
        return Err(AppError::Unauthorized(
            "LINE Shopping API key is required; none found in config, headers, or Strapi cache."
                .to_string(),
        ));
    }

    Ok(credentials)
}

async fn validate_woocommerce(headers: HeaderMap) -> Result<Json<Value>, AppError> {
    let (credentials, _store_url) = build_woocommerce_credentials(&headers)?;
    let gateway = WooCommerceGateway::new(credentials);

    match gateway.test_connection().await {
        Ok(details) => Ok(Json(json!({
            "valid": true,
            "details": details
        }))),
        Err(AppError::ExternalApiError(message))
        | Err(AppError::ValidationError(message))
        | Err(AppError::BadRequest(message)) => Ok(Json(json!({
            "valid": false,
            "error": message
        }))),
        Err(err) => Err(err),
    }
}

async fn validate_medusa(headers: HeaderMap) -> Result<Json<Value>, AppError> {
    let (credentials, _store_url) = build_medusa_credentials(&headers)?;
    let gateway = MedusaGateway::new(&credentials).map_err(AppError::from)?;

    match gateway.test_connection().await {
        Ok(details) => Ok(Json(json!({
            "valid": true,
            "details": details
        }))),
        Err(AppError::ExternalApiError(message))
        | Err(AppError::ValidationError(message))
        | Err(AppError::BadRequest(message)) => Ok(Json(json!({
            "valid": false,
            "error": message
        }))),
        Err(err) => Err(err),
    }
}

async fn validate_lineshopping(
    state: &Arc<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    let credentials = build_lineshopping_credentials(state, &headers).await?;
    let gateway = LineShoppingGateway::new(credentials);

    match gateway.test_connection().await {
        Ok(details) => Ok(Json(json!({
            "valid": true,
            "details": details
        }))),
        Err(err) => match AppError::from(err) {
            AppError::ExternalApiError(message)
            | AppError::ValidationError(message)
            | AppError::BadRequest(message) => Ok(Json(json!({
                "valid": false,
                "error": message
            }))),
            other => Err(other),
        },
    }
}

async fn validate_wix(state: &Arc<AppState>, headers: HeaderMap) -> Result<Json<Value>, AppError> {
    let context = build_wix_context(state, &headers)?;

    match context.gateway.test_connection().await {
        Ok(details) => Ok(Json(json!({
            "valid": true,
            "details": details
        }))),
        Err(AppError::ExternalApiError(message))
        | Err(AppError::ValidationError(message))
        | Err(AppError::BadRequest(message)) => Ok(Json(json!({
            "valid": false,
            "error": message
        }))),
        Err(err) => Err(err),
    }
}

async fn validate_zoho(state: &Arc<AppState>, headers: HeaderMap) -> Result<Json<Value>, AppError> {
    let context = build_zoho_context(state, &headers)?;

    match context
        .gateway
        .fetch_products(&context.access_token, Some(1), Some(0))
        .await
    {
        Ok(products) => Ok(Json(json!({
            "valid": true,
            "details": {
                "sample_products": products.len()
            }
        }))),
        Err(AppError::ExternalApiError(message))
        | Err(AppError::ValidationError(message))
        | Err(AppError::BadRequest(message)) => Ok(Json(json!({
            "valid": false,
            "error": message
        }))),
        Err(err) => Err(err),
    }
}

async fn shop_info_woocommerce(headers: HeaderMap) -> Result<Json<ShopInfo>, AppError> {
    let (credentials, store_url) = build_woocommerce_credentials(&headers)?;
    let gateway = WooCommerceGateway::new(credentials);

    let _ = gateway.test_connection().await.map_err(|err| {
        error!("WooCommerce shop info validation failed: {}", err);
        err
    })?;

    let normalized_name = store_url
        .trim_end_matches('/')
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .to_string();

    let info = ShopInfo {
        id: store_url.clone(),
        name: normalized_name.clone(),
        url: Some(store_url),
        country: None,
        currency: None,
        platform: Some("woocommerce".to_string()),
        status: Some("connected".to_string()),
        created_at: None,
    };

    Ok(Json(info))
}

async fn shop_info_medusa(headers: HeaderMap) -> Result<Json<ShopInfo>, AppError> {
    let (credentials, store_url) = build_medusa_credentials(&headers)?;
    let gateway = MedusaGateway::new(&credentials).map_err(AppError::from)?;

    let _ = gateway.test_connection().await.map_err(|err| {
        error!("Medusa shop info validation failed: {}", err);
        err
    })?;

    let mut info = match gateway.get_shop_info().await.map_err(AppError::from) {
        Ok(info) => info,
        Err(err) => {
            warn!("Unable to fetch Medusa shop info: {}", err);
            let normalized_name = store_url
                .trim_end_matches('/')
                .trim_start_matches("https://")
                .trim_start_matches("http://")
                .to_string();

            ShopInfo {
                id: store_url.clone(),
                name: normalized_name,
                url: Some(store_url.clone()),
                country: None,
                currency: None,
                platform: Some("medusa".to_string()),
                status: Some("connected".to_string()),
                created_at: None,
            }
        }
    };

    if info.url.is_none() {
        info.url = Some(store_url.clone());
    }
    if info.platform.is_none() {
        info.platform = Some("medusa".to_string());
    }
    if info.status.is_none() {
        info.status = Some("connected".to_string());
    }

    Ok(Json(info))
}

async fn shop_info_lineshopping(
    state: &Arc<AppState>,
    headers: HeaderMap,
) -> Result<Json<ShopInfo>, AppError> {
    let credentials = build_lineshopping_credentials(state, &headers).await?;
    let gateway = LineShoppingGateway::new(credentials);
    let info = gateway.get_shop_info().await.map_err(AppError::from)?;
    Ok(Json(info))
}

async fn shop_info_wix(
    state: &Arc<AppState>,
    headers: HeaderMap,
) -> Result<Json<ShopInfo>, AppError> {
    let context = build_wix_context(state, &headers)?;

    let _ = context.gateway.test_connection().await.map_err(|err| {
        error!("Wix shop info validation failed: {}", err);
        err
    })?;

    let name = context
        .store_url
        .clone()
        .unwrap_or_else(|| context.site_id.clone());

    let info = ShopInfo {
        id: context.site_id.clone(),
        name,
        url: context.store_url.clone(),
        country: None,
        currency: None,
        platform: Some("wix".to_string()),
        status: Some("connected".to_string()),
        created_at: None,
    };

    Ok(Json(info))
}

async fn shop_info_zoho(
    state: &Arc<AppState>,
    headers: HeaderMap,
) -> Result<Json<ShopInfo>, AppError> {
    let context = build_zoho_context(state, &headers)?;

    // Lightweight product fetch to validate the token/shop combination.
    let _ = context
        .gateway
        .fetch_products(&context.access_token, Some(1), Some(0))
        .await
        .map_err(|err| {
            error!("Zoho shop info validation failed: {}", err);
            err
        })?;

    let info = ShopInfo {
        id: context.tenant_id.clone(),
        name: context.tenant_id.clone(),
        url: context
            .store_url
            .clone()
            .or_else(|| Some("https://commerce.zoho.com".to_string())),
        country: None,
        currency: None,
        platform: Some("zoho".to_string()),
        status: Some("connected".to_string()),
        created_at: None,
    };

    Ok(Json(info))
}

async fn list_products_woocommerce(
    headers: HeaderMap,
    body: ProductListBody,
) -> Result<Json<ProductList>, AppError> {
    let (credentials, _store_url) = build_woocommerce_credentials(&headers)?;
    let gateway = WooCommerceGateway::new(credentials);

    let page = body.page.unwrap_or(1).max(1);
    let limit = body.limit.unwrap_or(20).max(1);

    let raw_products = gateway
        .list_products(
            page,
            limit,
            body.search.clone(),
            body.category,
            body.status.clone(),
        )
        .await?;

    let products_array = match raw_products {
        Value::Array(items) => items,
        Value::Object(ref map) => map
            .get("data")
            .and_then(|value| value.as_array())
            .cloned()
            .unwrap_or_default(),
        _ => Vec::new(),
    };

    let mut products = Vec::with_capacity(products_array.len());
    for item in &products_array {
        match map_woocommerce_product(item) {
            Ok(product) => products.push(product),
            Err(err) => {
                warn!("Unable to map WooCommerce product: {}", err);
            }
        }
    }

    let has_more = (products.len() as u32) >= limit;
    let response = ProductList {
        products,
        total: products_array.len() as u64,
        has_more,
        next_cursor: None,
    };

    Ok(Json(response))
}

async fn list_products_medusa(
    headers: HeaderMap,
    body: ProductListBody,
) -> Result<Json<ProductList>, AppError> {
    let (credentials, _store_url) = build_medusa_credentials(&headers)?;
    let gateway = MedusaGateway::new(&credentials).map_err(AppError::from)?;

    let ProductListBody {
        page,
        limit,
        status,
        search,
        category: _,
        offset,
        sort,
        shop_id,
    } = body;

    let limit = limit.unwrap_or(50).max(1);
    let page = page.unwrap_or(1).max(1);
    let offset = offset.unwrap_or_else(|| (page - 1) * limit);

    let params = ListProductParams {
        page: Some(page),
        limit: Some(limit),
        offset: Some(offset),
        status,
        search,
        sort,
        shop_id,
    };

    let products = gateway
        .list_products(&params)
        .await
        .map_err(AppError::from)?;

    Ok(Json(products))
}

async fn list_products_lineshopping(
    state: &Arc<AppState>,
    headers: HeaderMap,
    body: ProductListBody,
) -> Result<Json<ProductList>, AppError> {
    let credentials = build_lineshopping_credentials(state, &headers).await?;
    let gateway = LineShoppingGateway::new(credentials);

    let ProductListBody {
        page,
        limit,
        status,
        search,
        category: _,
        offset,
        sort,
        shop_id,
    } = body;

    let limit = limit.unwrap_or(50).clamp(1, 100);
    let page = page.unwrap_or(1).max(1);
    let offset = offset.unwrap_or_else(|| (page - 1) * limit);

    let params = ListProductParams {
        page: Some(page),
        limit: Some(limit),
        offset: Some(offset),
        status,
        search,
        sort,
        shop_id,
    };

    let products = gateway
        .list_products(&params)
        .await
        .map_err(AppError::from)?;

    Ok(Json(products))
}

async fn list_products_wix(
    state: &Arc<AppState>,
    headers: HeaderMap,
    body: ProductListBody,
) -> Result<Json<ProductList>, AppError> {
    let context = build_wix_context(state, &headers)?;

    let ProductListBody {
        page,
        limit,
        status: _,
        search: _,
        category: _,
        offset,
        sort: _,
        shop_id: _,
    } = body;

    let limit = limit.unwrap_or(50).clamp(1, 100);
    let offset = offset.unwrap_or_else(|| {
        let current_page = page.unwrap_or(1).max(1);
        (current_page - 1) * limit
    });

    let domain_products = context
        .gateway
        .fetch_products(
            &context.access_token,
            Some(limit as usize),
            Some(offset as usize),
        )
        .await?;

    let products = domain_products
        .iter()
        .map(domain_product_to_platform_product)
        .collect::<Vec<_>>();

    let has_more = (products.len() as u32) >= limit;
    let response = ProductList {
        products,
        total: domain_products.len() as u64,
        has_more,
        next_cursor: None,
    };

    Ok(Json(response))
}

async fn list_products_zoho(
    state: &Arc<AppState>,
    headers: HeaderMap,
    body: ProductListBody,
) -> Result<Json<ProductList>, AppError> {
    let context = build_zoho_context(state, &headers)?;

    let ProductListBody {
        page,
        limit,
        status: _,
        search: _,
        category: _,
        offset,
        sort: _,
        shop_id: _,
    } = body;

    let limit = limit.unwrap_or(50).clamp(1, 100);
    let offset = offset.unwrap_or_else(|| {
        let current_page = page.unwrap_or(1).max(1);
        (current_page - 1) * limit
    });

    let domain_products = context
        .gateway
        .fetch_products(
            &context.access_token,
            Some(limit as usize),
            Some(offset as usize),
        )
        .await?;

    let products = domain_products
        .iter()
        .map(domain_product_to_platform_product)
        .collect::<Vec<_>>();

    let has_more = (products.len() as u32) >= limit;
    let response = ProductList {
        products,
        total: domain_products.len() as u64,
        has_more,
        next_cursor: None,
    };

    Ok(Json(response))
}

fn map_woocommerce_product(value: &Value) -> Result<PlatformProduct, AppError> {
    let id = value
        .get("id")
        .map(|v| v.to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| AppError::SerializationError("Missing product id".to_string()))?;

    let title = value
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::SerializationError("Missing product name".to_string()))?;

    let description = value
        .get("description")
        .or_else(|| value.get("short_description"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty());

    let price = value
        .get("price")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .or_else(|| {
            value
                .get("regular_price")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<f64>().ok())
        })
        .unwrap_or(0.0);

    let currency = value
        .get("currency")
        .and_then(|v| v.as_str())
        .unwrap_or("USD")
        .to_string();

    let sku = value
        .get("sku")
        .and_then(|v| v.as_str())
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    let quantity = value
        .get("stock_quantity")
        .and_then(|v| v.as_i64())
        .map(|q| q as i32);

    let images = value
        .get("images")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|image| image.get("src").and_then(|src| src.as_str()))
                .map(|url| url.to_string())
                .collect::<Vec<String>>()
        })
        .unwrap_or_default();

    let status = value
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let mut attributes = HashMap::new();
    if let Some(product_type) = value.get("type").and_then(|v| v.as_str()) {
        attributes.insert("type".to_string(), product_type.to_string());
    }
    if let Some(categories) = value.get("categories").and_then(|v| v.as_array()) {
        let names = categories
            .iter()
            .filter_map(|cat| cat.get("name").and_then(|n| n.as_str()))
            .collect::<Vec<&str>>()
            .join(", ");
        if !names.is_empty() {
            attributes.insert("categories".to_string(), names);
        }
    }

    let created_at =
        parse_datetime(value, "date_created_gmt").or_else(|| parse_datetime(value, "date_created"));
    let updated_at = parse_datetime(value, "date_modified_gmt")
        .or_else(|| parse_datetime(value, "date_modified"));

    Ok(PlatformProduct {
        id: id.clone(),
        platform_id: Some(id),
        title,
        description,
        price,
        currency,
        sku,
        quantity,
        images,
        variants: Vec::new(),
        status,
        attributes,
        created_at,
        updated_at,
    })
}

fn parse_datetime(value: &Value, field: &str) -> Option<DateTime<Utc>> {
    value
        .get(field)
        .and_then(|v| v.as_str())
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc))
}
