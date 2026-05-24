use std::{collections::HashMap, sync::Arc, time::Duration};

use async_trait::async_trait;
use axum::http::{HeaderMap, StatusCode};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use once_cell::sync::Lazy;
use reqwest::Client;
use serde_json::{json, Value};
use tracing::{error, warn};
use uuid::Uuid;

use crate::{
    client::ecommerce::{etsy::EtsyGateway, jd::JDGateway, lineshopping::LineShoppingGateway},
    config::PlatformCredentials,
    handlers::v1::platform::shop::handler::{
        AuthPayload, ConnectRequestV1, OAuth2Credentials, OAuth2Params,
    },
    infrastructure::transport::gateway_http::GatewayHttpClient,
    interfaces::platform_gateway::{
        Credentials as GatewayCredentials, ListProductParams, PlatformGateway,
    },
    model::{
        error::{AppError, AppResult},
        v1::gateway::request::queries::ConnectQuery,
    },
    AppState,
};

pub async fn call_gateway_ecommerce_connect(
    state: &Arc<AppState>,
    platform_name: &str,
    query: &ConnectQuery,
    headers: &HeaderMap,
) -> AppResult<Value> {
    let base_url =
        std::env::var("INTERNAL_API_URL").unwrap_or_else(|_| "http://localhost:8080".to_string());
    let app_name = crate::helpers::app_config::load_app_name("credentials/crendential.json")
        .unwrap_or_else(|err| {
            warn!(
                "Falling back to default app name after load failure: {}",
                err
            );
            crate::helpers::app_config::DEFAULT_APP_NAME.to_string()
        });

    let connect_url = format!(
        "{}/api/v1/{}/gateway/ecommerce/{}/connect",
        base_url, app_name, platform_name
    );

    let mut params = vec![
        ("shop_id".to_string(), query.shop_id.clone()),
        ("org_id".to_string(), query.org_id.clone()),
    ];

    if let Some(user_id) = &query.user_id {
        params.push(("user_id".to_string(), user_id.clone()));
    } else {
        params.push(("user_id".to_string(), query.org_id.clone()));
    }

    if let Some(redirect_uri) = &query.redirect_uri {
        params.push(("redirect_uri".to_string(), redirect_uri.clone()));
    }

    if let Some(shop_domain) = &query.shop_domain {
        params.push(("shop_domain".to_string(), shop_domain.clone()));
    }

    if let Some(shop_region) = &query.shop_region {
        params.push(("shop_region".to_string(), shop_region.clone()));
    }

    let client = Client::new();
    let mut request_builder = client.get(&connect_url).query(&params);

    if let Some(auth_header) = headers.get("authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            request_builder = request_builder.header("authorization", auth_str);
        }
    }

    if let Some(content_type) = headers.get("content-type") {
        if let Ok(content_str) = content_type.to_str() {
            request_builder = request_builder.header("content-type", content_str);
        }
    }

    let response = request_builder.send().await.map_err(|e| {
        error!("Failed to call gateway connect API: {}", e);
        AppError::ExternalApiError(format!("Failed to call gateway connect API: {}", e))
    })?;

    let status = response.status();
    let response_text = response.text().await.map_err(|e| {
        error!("Failed to read connect response body: {}", e);
        AppError::ExternalApiError(format!("Failed to read connect response body: {}", e))
    })?;

    if !status.is_success() {
        error!(
            "Gateway connect API call failed with status {}: {}",
            status, response_text
        );
        return Err(AppError::ExternalApiError(format!(
            "Gateway connect API call failed with status {}: {}",
            status, response_text
        )));
    }

    let json_response: Value = serde_json::from_str(&response_text).map_err(|e| {
        error!("Failed to parse connect JSON response: {}", e);
        AppError::SerializationError(format!("Failed to parse connect JSON response: {}", e))
    })?;

    Ok(json_response)
}

#[derive(Debug)]
pub struct ProbeError {
    pub status: StatusCode,
    pub message: String,
    pub details: Value,
}

impl ProbeError {
    fn validation(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
            details: json!({}),
        }
    }

    fn failure(message: impl Into<String>, details: Value) -> Self {
        Self {
            status: StatusCode::UNPROCESSABLE_ENTITY,
            message: message.into(),
            details,
        }
    }

    fn unavailable(message: impl Into<String>, details: Value) -> Self {
        Self {
            status: StatusCode::BAD_GATEWAY,
            message: message.into(),
            details,
        }
    }

    fn unsupported(platform: &str) -> Self {
        Self::validation(format!(
            "Platform '{}' is not yet supported for probes",
            platform
        ))
    }
}

struct ProbeContext<'a> {
    state: &'a Arc<AppState>,
    headers: &'a HeaderMap,
    shop_id: &'a str,
    platform: &'a str,
    request: &'a ConnectRequestV1,
}

#[async_trait]
trait PlatformProbe: Send + Sync {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError>;
}

type ProbeRegistry = HashMap<&'static str, Arc<dyn PlatformProbe>>;

static PLATFORM_PROBES: Lazy<ProbeRegistry> = Lazy::new(|| {
    let mut registry: ProbeRegistry = HashMap::new();
    register_probe(&mut registry, &["amazon_sp"], Arc::new(AmazonSpProbe));
    register_probe(&mut registry, &["jd", "jd_open"], Arc::new(JdOpenProbe));
    register_probe(&mut registry, &["ecwid"], Arc::new(EcwidProbe));
    register_probe(&mut registry, &["magento"], Arc::new(MagentoProbe));
    register_probe(&mut registry, &["shopify"], Arc::new(ShopifyProbe));
    register_probe(&mut registry, &["bigcommerce"], Arc::new(BigCommerceProbe));
    register_probe(
        &mut registry,
        &["zoho", "zoho_commerce"],
        Arc::new(ZohoProbe),
    );
    register_probe(&mut registry, &["alibaba", "daraz"], Arc::new(AlibabaProbe));
    register_probe(&mut registry, &["aliexpress"], Arc::new(AliexpressProbe));
    register_probe(&mut registry, &["etsy", "esty"], Arc::new(EtsyProbe));
    register_probe(
        &mut registry,
        &["line_myshop", "lineshopping", "line_shopping"],
        Arc::new(LineShoppingProbe),
    );
    register_probe(
        &mut registry,
        &["tiktok", "tiktok_shop"],
        Arc::new(TiktokProbe),
    );
    register_probe(&mut registry, &["odoo"], Arc::new(OdooProbe));
    register_probe(&mut registry, &["erpnext"], Arc::new(ErpNextProbe));
    register_probe(&mut registry, &["woocommerce"], Arc::new(WooCommerceProbe));
    register_probe(&mut registry, &["medusa"], Arc::new(MedusaProbe));
    register_probe(&mut registry, &["lazada"], Arc::new(LazadaProbe));
    register_probe(&mut registry, &["wix"], Arc::new(WixProbe));
    register_probe(&mut registry, &["shopee"], Arc::new(ShopeeProbe));
    register_probe(&mut registry, &["custom"], Arc::new(CustomProbe));
    registry
});

fn register_probe(
    registry: &mut ProbeRegistry,
    aliases: &[&'static str],
    probe: Arc<dyn PlatformProbe>,
) {
    for alias in aliases {
        registry.insert(*alias, Arc::clone(&probe));
    }
}

struct AmazonSpProbe;

#[async_trait]
impl PlatformProbe for AmazonSpProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_amazon_sp(ctx.request)
    }
}

struct JdOpenProbe;

#[async_trait]
impl PlatformProbe for JdOpenProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_jd_open(ctx.state, ctx.request).await
    }
}

struct EcwidProbe;

#[async_trait]
impl PlatformProbe for EcwidProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_ecwid(ctx.request)
    }
}

struct MagentoProbe;

#[async_trait]
impl PlatformProbe for MagentoProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_magento(ctx.request)
    }
}

struct ShopifyProbe;

#[async_trait]
impl PlatformProbe for ShopifyProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_shopify(ctx.state, ctx.headers, ctx.shop_id, ctx.request).await
    }
}

struct BigCommerceProbe;

#[async_trait]
impl PlatformProbe for BigCommerceProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_bigcommerce(ctx.request).await
    }
}

struct ZohoProbe;

#[async_trait]
impl PlatformProbe for ZohoProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_zoho(ctx.request).await
    }
}

struct AlibabaProbe;

#[async_trait]
impl PlatformProbe for AlibabaProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_alibaba(
            ctx.state,
            ctx.headers,
            ctx.shop_id,
            ctx.platform,
            ctx.request,
        )
        .await
    }
}

struct AliexpressProbe;

#[async_trait]
impl PlatformProbe for AliexpressProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_aliexpress(ctx.state, ctx.headers, ctx.shop_id, ctx.request).await
    }
}

struct EtsyProbe;

#[async_trait]
impl PlatformProbe for EtsyProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_etsy(ctx.state, ctx.request).await
    }
}

struct LineShoppingProbe;

#[async_trait]
impl PlatformProbe for LineShoppingProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_lineshopping(ctx.state, ctx.request).await
    }
}

struct TiktokProbe;

#[async_trait]
impl PlatformProbe for TiktokProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_tiktok(ctx.state, ctx.headers, ctx.shop_id, ctx.request).await
    }
}

struct WooCommerceProbe;

#[async_trait]
impl PlatformProbe for WooCommerceProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_woocommerce(ctx.state, ctx.request).await
    }
}

struct MedusaProbe;

#[async_trait]
impl PlatformProbe for MedusaProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_medusa(ctx.state, ctx.request).await
    }
}

struct LazadaProbe;

#[async_trait]
impl PlatformProbe for LazadaProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_lazada(ctx.state, ctx.headers, ctx.shop_id, ctx.request).await
    }
}

struct WixProbe;

#[async_trait]
impl PlatformProbe for WixProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_wix(ctx.state, ctx.headers, ctx.shop_id, ctx.request).await
    }
}

struct ShopeeProbe;

#[async_trait]
impl PlatformProbe for ShopeeProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_shopee(ctx.state, ctx.headers, ctx.shop_id, ctx.request).await
    }
}

struct CustomProbe;

struct OdooProbe;

struct ErpNextProbe;

#[async_trait]
impl PlatformProbe for CustomProbe {
    async fn probe(&self, _: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        Ok(json!({
            "note": "Probe not implemented; skipping connectivity verification"
        }))
    }
}

#[async_trait]
impl PlatformProbe for OdooProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_odoo(ctx.request)
    }
}

#[async_trait]
impl PlatformProbe for ErpNextProbe {
    async fn probe(&self, ctx: &ProbeContext<'_>) -> Result<Value, ProbeError> {
        probe_erpnext(ctx.request)
    }
}

fn is_gateway_transport_error(message: &str) -> bool {
    let normalized = message.to_lowercase();
    [
        "gateway request failed",
        "error sending request",
        "connection refused",
        "connection reset",
        "timed out",
        "dns error",
    ]
    .iter()
    .any(|needle| normalized.contains(needle))
}

pub async fn run_probe(
    state: &Arc<AppState>,
    headers: &HeaderMap,
    shop_id: &str,
    platform: &str,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    let ctx = ProbeContext {
        state,
        headers,
        shop_id,
        platform,
        request,
    };

    if let Some(probe) = PLATFORM_PROBES.get(platform) {
        probe.probe(&ctx).await
    } else {
        warn!(
            "No probe registered for platform '{}'; skipping automated test_connect.",
            platform
        );
        Ok(json!({
            "platform": platform,
            "status": "manual_verification",
            "note": format!("{} credentials will be validated after the initial connect flow. You can disable test_connect to skip this step.", platform),
        }))
    }
}

fn probe_amazon_sp(request: &ConnectRequestV1) -> Result<Value, ProbeError> {
    match &request.auth {
        AuthPayload::Spapi { lwa, aws, .. } => {
            if lwa.client_id.is_empty()
                || lwa.client_secret.is_empty()
                || lwa.refresh_token.is_empty()
            {
                return Err(ProbeError::validation(
                    "Amazon SP-API requires client_id, client_secret, and refresh_token",
                ));
            }

            if let Some(mode) = &aws.mode {
                if mode != "role" && mode != "keys" {
                    return Err(ProbeError::validation(
                        "Amazon AWS mode must be 'role' or 'keys'",
                    ));
                }
            }

            Ok(json!({
                "note": "Amazon SP-API probe stub executed",
                "marketplace": request.shop.marketplace_ids.clone().unwrap_or_default(),
                "region": request.shop.region
            }))
        }
        _ => Err(ProbeError::validation(
            "Amazon SP-API requires auth.type = 'spapi'",
        )),
    }
}

async fn probe_jd_open(
    state: &Arc<AppState>,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    match &request.auth {
        AuthPayload::Oauth2 {
            credentials,
            oauth_params,
            signing,
        } => {
            if credentials.client_id.trim().is_empty()
                || credentials.client_secret.trim().is_empty()
            {
                return Err(ProbeError::validation(
                    "JD Open Platform requires OAuth2 credentials.client_id and credentials.client_secret",
                ));
            }

            let signing_cfg = signing.as_ref().ok_or_else(|| {
                ProbeError::validation(
                    "JD Open Platform requires signing configuration (type=hmac, profile=jd_v1)",
                )
            })?;

            if signing_cfg.signing_type.to_lowercase().trim().ne("hmac") {
                return Err(ProbeError::validation(
                    "JD Open Platform requires signing.type = 'hmac'",
                ));
            }

            let signing_profile = signing_cfg.profile.clone().unwrap_or_default();
            if signing_profile.to_lowercase() != "jd_v1" {
                return Err(ProbeError::validation(
                    "JD Open Platform requires signing.profile = 'jd_v1'",
                ));
            }

            let scopes = oauth_params
                .as_ref()
                .and_then(|params| params.scopes.clone())
                .unwrap_or_default();

            let access_token = credentials
                .access_token
                .as_ref()
                .map(|token| token.trim())
                .filter(|token| !token.is_empty())
                .map(ToString::to_string);

            if let Some(token) = access_token {
                let mut payload = probe_gateway_platform(state, "jd", request).await?;

                if let Value::Object(ref mut map) = payload {
                    map.entry("platform")
                        .or_insert_with(|| Value::String("jd".to_string()));
                    if !scopes.is_empty() {
                        map.entry("scopes")
                            .or_insert_with(|| Value::from(scopes.clone()));
                    }
                    map.insert("token_length".to_string(), Value::from(token.len()));
                    map.insert(
                        "has_refresh_token".to_string(),
                        Value::from(
                            credentials
                                .refresh_token
                                .as_ref()
                                .map(|value| !value.trim().is_empty())
                                .unwrap_or(false),
                        ),
                    );
                    map.insert(
                        "signing_profile".to_string(),
                        Value::String(signing_profile.clone()),
                    );
                }

                Ok(payload)
            } else {
                let (auth_url, state_token) =
                    build_jd_auth_bundle(state, request, credentials, oauth_params)?;
                Ok(json!({
                    "note": "JD Open Platform access_token is required before running test_connect. Start the connect flow to generate a client_credentials token.",
                    "platform": "jd",
                    "auth_url": auth_url,
                    "state": state_token,
                    "required_credentials": ["client_id", "client_secret", "access_token", "signing.profile"],
                    "recommended_steps": [
                        "Call the JD connect init endpoint to get the authorization/setup URL.",
                        "Provide the JD seller credentials or follow the portal instructions to authorize the app.",
                        "Call the JD callback endpoint to exchange the authorization data for an access token.",
                        "Persist the returned tokens and re-run connect without options.test_connect=true."
                    ],
                    "auth_flow": {
                        "init_endpoint": "/api/v1/{app_name}/gateway/ecommerce/jd/connect",
                        "callback_endpoint": "/api/v1/{app_name}/gateway/ecommerce/jd/callback",
                        "platform_callback": "/api/v1/{app_name}/platform/shop/{shop_id}/connect/jd/callback"
                    }
                }))
            }
        }
        _ => Err(ProbeError::validation(
            "JD Open Platform requires auth.type = 'oauth2'",
        )),
    }
}

fn probe_ecwid(request: &ConnectRequestV1) -> Result<Value, ProbeError> {
    if request
        .shop
        .store_id
        .as_ref()
        .map(|s| s.is_empty())
        .unwrap_or(true)
        && request
            .shop
            .store_url
            .as_ref()
            .map(|s| s.is_empty())
            .unwrap_or(true)
    {
        return Err(ProbeError::validation(
            "Ecwid requires shop.store_id or shop.store_url",
        ));
    }

    match &request.auth {
        AuthPayload::Oauth2 { credentials, .. } => {
            if credentials
                .access_token
                .as_deref()
                .unwrap_or_default()
                .is_empty()
            {
                return Err(ProbeError::validation("Ecwid OAuth2 requires access_token"));
            }
            Ok(json!({ "note": "Ecwid OAuth2 probe stub executed" }))
        }
        AuthPayload::ApiKey { credentials, .. } => {
            if credentials.api_key.is_empty() {
                return Err(ProbeError::validation("Ecwid API key cannot be empty"));
            }
            Ok(json!({ "note": "Ecwid API token probe stub executed" }))
        }
        _ => Err(ProbeError::validation(
            "Ecwid requires auth.type = 'oauth2' or 'api_key'",
        )),
    }
}

fn ensure_store_url(request: &ConnectRequestV1, platform: &str) -> Result<String, ProbeError> {
    if let Some(url) = request.shop.store_url.clone() {
        if url.is_empty() {
            Err(ProbeError::validation(format!(
                "{} requires shop.store_url to be non-empty",
                platform
            )))
        } else {
            Ok(url)
        }
    } else if let Some(endpoint) = request.platform.endpoint.clone() {
        Ok(endpoint)
    } else {
        Err(ProbeError::validation(format!(
            "{} requires either shop.store_url or platform.endpoint",
            platform
        )))
    }
}

fn probe_odoo(request: &ConnectRequestV1) -> Result<Value, ProbeError> {
    match &request.auth {
        AuthPayload::Basic { credentials, .. } => {
            let username = credentials.consumer_key.trim();
            let api_key = credentials.consumer_secret.trim();
            let base_url = request
                .shop
                .store_url
                .as_deref()
                .or(request.platform.endpoint.as_deref())
                .filter(|value| !value.trim().is_empty())
                .map(|value| value.trim().to_string());

            if username.is_empty() || api_key.is_empty() {
                return Err(ProbeError::validation(
                    "Odoo connect requires auth.credentials.username and auth.credentials.password/api_key",
                ));
            }

            Ok(json!({
                "platform": "odoo",
                "status": "manual_verification",
                "note": "Odoo credentials captured. Complete the connect flow to store them in Strapi.",
                "base_url_present": base_url.is_some(),
                "required_fields": ["base_url","database","username","api_key"]
            }))
        }
        _ => Err(ProbeError::validation(
            "Odoo connect expects auth.type = 'basic' with API key credentials.",
        )),
    }
}

fn probe_erpnext(request: &ConnectRequestV1) -> Result<Value, ProbeError> {
    match &request.auth {
        AuthPayload::Basic { credentials, .. } => {
            let api_key = credentials.consumer_key.trim();
            let api_secret = credentials.consumer_secret.trim();
            let base_url = request
                .shop
                .store_url
                .as_deref()
                .or(request.platform.endpoint.as_deref())
                .filter(|value| !value.trim().is_empty())
                .map(|value| value.trim().to_string());

            if api_key.is_empty() || api_secret.is_empty() {
                return Err(ProbeError::validation(
                    "ERPNext connect requires auth.credentials.username (API Key) and auth.credentials.password (API Secret).",
                ));
            }

            Ok(json!({
                "platform": "erpnext",
                "status": "manual_verification",
                "note": "ERPNext API key/secret received. Complete the connect flow to persist shop tokens.",
                "base_url_present": base_url.is_some(),
                "required_headers": ["Authorization: token api_key:api_secret"]
            }))
        }
        _ => Err(ProbeError::validation(
            "ERPNext connect expects auth.type = 'basic' with API key/secret credentials.",
        )),
    }
}

fn probe_magento(request: &ConnectRequestV1) -> Result<Value, ProbeError> {
    let store_url = ensure_store_url(request, "Magento")?;

    match &request.auth {
        AuthPayload::Bearer { credentials, .. } => {
            if credentials.token.is_empty() {
                return Err(ProbeError::validation(
                    "Magento bearer token cannot be empty",
                ));
            }
            Ok(json!({
                "note": "Magento bearer probe stub executed",
                "store_url": store_url
            }))
        }
        _ => Err(ProbeError::validation(
            "Magento requires auth.type = 'bearer'",
        )),
    }
}

async fn probe_shopify(
    state: &Arc<AppState>,
    headers: &HeaderMap,
    shop_id: &str,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    let store_url = ensure_store_url(request, "Shopify")?;
    match &request.auth {
        AuthPayload::Oauth2 { credentials, .. } => {
            let has_access_token = credentials
                .access_token
                .as_ref()
                .map(|token| !token.trim().is_empty())
                .unwrap_or(false);

            if !has_access_token {
                let connect_payload =
                    fetch_gateway_connect_payload(state, headers, "shopify", shop_id, request)
                        .await?;
                let (auth_url, state_token, auth_flow) =
                    extract_auth_bundle("shopify", &connect_payload, request)?;
                return Ok(json!({
                    "note": "Shopify OAuth2 tokens are required before running test_connect. Start the connect flow to obtain an access_token.",
                    "platform": "shopify",
                    "auth_url": auth_url,
                    "state": state_token,
                    "store_url": store_url,
                    "recommended_steps": [
                        "Call the Shopify connect init endpoint to retrieve the authorization URL.",
                        "Redirect the merchant to Shopify so they can grant consent.",
                        "Handle the gateway callback to exchange the auth code for tokens.",
                        "Persist the returned access/refresh tokens and proceed without options.test_connect=true."
                    ],
                    "auth_flow": auth_flow
                }));
            }

            let mut payload = probe_gateway_platform(state, "shopify", request).await?;
            if let Value::Object(ref mut map) = payload {
                map.entry("store_url".to_string())
                    .or_insert_with(|| Value::String(store_url.clone()));
            }
            Ok(payload)
        }
        AuthPayload::Bearer { credentials, .. } => {
            if credentials.token.is_empty() {
                return Err(ProbeError::validation(
                    "Shopify bearer token cannot be empty",
                ));
            }
            Ok(json!({
                "note": "Shopify private app probe stub executed",
                "store_url": store_url
            }))
        }
        _ => Err(ProbeError::validation(
            "Shopify requires auth.type = 'oauth2' or 'bearer'",
        )),
    }
}

async fn probe_bigcommerce(request: &ConnectRequestV1) -> Result<Value, ProbeError> {
    let store_hash = request
        .shop
        .seller_id
        .as_ref()
        .filter(|value| !value.trim().is_empty())
        .cloned()
        .or_else(|| {
            request
                .metadata
                .as_object()
                .and_then(|meta| meta.get("store_hash"))
                .and_then(|value| value.as_str())
                .map(|s| s.to_string())
        })
        .or_else(|| {
            request.platform.endpoint.as_ref().and_then(|endpoint| {
                endpoint
                    .split("stores/")
                    .nth(1)
                    .and_then(|rest| rest.split('/').next())
                    .map(|hash| hash.to_string())
            })
        })
        .ok_or_else(|| {
            ProbeError::validation("BigCommerce requires shop.seller_id (store hash)")
        })?;

    let (access_token, token_kind, client_id) = match &request.auth {
        AuthPayload::Bearer {
            credentials,
            signing: _,
        } => {
            let token = credentials.token.trim().to_string();
            if token.is_empty() {
                return Err(ProbeError::validation(
                    "BigCommerce bearer token cannot be empty",
                ));
            }
            (token, "bearer".to_string(), None)
        }
        AuthPayload::Oauth2 {
            credentials,
            oauth_params: _,
            signing: _,
        } => {
            let token = credentials
                .access_token
                .as_deref()
                .map(str::trim)
                .filter(|token| !token.is_empty())
                .ok_or_else(|| ProbeError::validation("BigCommerce OAuth2 requires access_token"))?
                .to_string();
            let client_id = if credentials.client_id.trim().is_empty() {
                None
            } else {
                Some(credentials.client_id.clone())
            };
            (token, "oauth2".to_string(), client_id)
        }
        AuthPayload::ApiKey { credentials, .. } => {
            let token = credentials.api_key.trim().to_string();
            if token.is_empty() {
                return Err(ProbeError::validation(
                    "BigCommerce API key cannot be empty",
                ));
            }
            (token, "api_key".to_string(), None)
        }
        _ => {
            return Err(ProbeError::validation(
                "BigCommerce requires auth.type = 'bearer', 'oauth2', or 'api_key'",
            ))
        }
    };

    let endpoint = request
        .platform
        .endpoint
        .clone()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("https://api.bigcommerce.com/stores/{}", store_hash));

    let base_endpoint = endpoint.trim_end_matches('/');
    let products_url = if base_endpoint.ends_with("/v3") {
        format!("{}/catalog/products", base_endpoint)
    } else {
        format!("{}/v3/catalog/products", base_endpoint)
    };

    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|err| {
            ProbeError::failure(
                "Failed to initialize HTTP client for BigCommerce probe",
                json!({ "error": err.to_string() }),
            )
        })?;

    let mut request_builder = client
        .get(&products_url)
        .query(&[("limit", "1")])
        .header("X-Auth-Token", access_token.as_str())
        .header("Accept", "application/json");

    if let Some(client_id) = client_id.as_ref() {
        request_builder = request_builder.header("X-Auth-Client", client_id.as_str());
    }

    let response = request_builder.send().await.map_err(|err| {
        ProbeError::failure(
            "BigCommerce probe request failed",
            json!({
                "error": err.to_string(),
                "store_hash": store_hash,
                "endpoint": products_url
            }),
        )
    })?;

    let status = response.status();
    let body_text = response.text().await.unwrap_or_default();

    if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
        return Err(ProbeError::failure(
            "BigCommerce probe failed: unauthorized",
            json!({
                "status": status.as_u16(),
                "body": body_text.chars().take(512).collect::<String>(),
                "store_hash": store_hash,
                "endpoint": products_url
            }),
        ));
    }

    if !status.is_success() {
        return Err(ProbeError::failure(
            "BigCommerce probe failed",
            json!({
                "status": status.as_u16(),
                "body": body_text.chars().take(512).collect::<String>(),
                "store_hash": store_hash,
                "endpoint": products_url
            }),
        ));
    }

    let parsed_body: Value = serde_json::from_str(&body_text).map_err(|err| {
        ProbeError::failure(
            "Failed to parse BigCommerce probe response",
            json!({
                "error": err.to_string(),
                "raw_body": body_text.chars().take(512).collect::<String>(),
                "store_hash": store_hash
            }),
        )
    })?;

    let total_products = parsed_body
        .get("meta")
        .and_then(|meta| meta.get("pagination"))
        .and_then(|pagination| pagination.get("total"))
        .and_then(|value| value.as_u64());

    let returned_count = parsed_body
        .get("data")
        .and_then(|data| data.as_array())
        .map(|array| array.len());

    Ok(json!({
        "note": "BigCommerce probe executed",
        "store_hash": store_hash,
        "endpoint": products_url,
        "token_type": token_kind,
        "client_id_present": client_id.is_some(),
        "returned_products": returned_count,
        "total_products": total_products,
    }))
}

async fn probe_zoho(request: &ConnectRequestV1) -> Result<Value, ProbeError> {
    let metadata_object = request.metadata.as_object();
    let organization_id = request
        .shop
        .store_id
        .as_ref()
        .filter(|value| !value.trim().is_empty())
        .cloned()
        .or_else(|| {
            request
                .shop
                .seller_id
                .as_ref()
                .filter(|value| !value.trim().is_empty())
                .cloned()
        })
        .or_else(|| {
            metadata_object.and_then(|meta| {
                for key in ["organization_id", "org_id", "zoho_org_id"] {
                    if let Some(value) = meta.get(key).and_then(|value| value.as_str()) {
                        if !value.trim().is_empty() {
                            return Some(value.trim().to_string());
                        }
                    }
                }
                None
            })
        })
        .or_else(|| {
            let org_id = request.org.org_id.trim();
            if !org_id.is_empty() {
                Some(org_id.to_string())
            } else {
                request
                    .org
                    .user_id
                    .as_ref()
                    .map(|value| value.trim())
                    .filter(|value| !value.is_empty())
                    .map(|value| value.to_string())
            }
        })
        .ok_or_else(|| {
            ProbeError::validation(
                "Zoho Commerce requires organization ID (set shop.store_id, metadata.organization_id, or org.org_id)",
            )
        })?;

    let api_domain = request
        .platform
        .endpoint
        .clone()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            metadata_object
                .and_then(|meta| meta.get("api_domain"))
                .and_then(|value| value.as_str())
                .map(|value| value.to_string())
        })
        .unwrap_or_else(|| "https://commerce.zoho.com".to_string());

    let (access_token, client_id) = match &request.auth {
        AuthPayload::Oauth2 {
            credentials,
            oauth_params: _,
            signing: _,
        } => {
            let token = credentials
                .access_token
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| {
                    ProbeError::validation("Zoho Commerce requires OAuth2 access_token")
                })?
                .to_string();

            let client_id = credentials
                .client_id
                .trim()
                .is_empty()
                .then(|| None)
                .unwrap_or_else(|| Some(credentials.client_id.clone()));

            (token, client_id)
        }
        AuthPayload::Bearer { credentials, .. } => {
            let token = credentials.token.trim().to_string();
            if token.is_empty() {
                return Err(ProbeError::validation(
                    "Zoho Commerce bearer token cannot be empty",
                ));
            }
            (token, None)
        }
        _ => {
            return Err(ProbeError::validation(
                "Zoho Commerce requires auth.type = 'oauth2' or 'bearer'",
            ))
        }
    };

    let products_url = format!("{}/store/api/v1/products", api_domain.trim_end_matches('/'));

    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|err| {
            ProbeError::failure(
                "Failed to initialize HTTP client for Zoho probe",
                json!({ "error": err.to_string() }),
            )
        })?;

    let mut request_builder = client
        .get(&products_url)
        .query(&[("per_page", "1")])
        .header("Authorization", format!("Zoho-oauthtoken {}", access_token))
        .header("Accept", "application/json")
        .header("X-com-zoho-store-organizationid", organization_id.as_str());

    if let Some(client_id) = client_id.as_ref() {
        request_builder = request_builder.header("X-Zoho-Client-Id", client_id.as_str());
    }

    let response = request_builder.send().await.map_err(|err| {
        ProbeError::failure(
            "Zoho Commerce probe request failed",
            json!({
                "error": err.to_string(),
                "organization_id": organization_id,
                "endpoint": products_url
            }),
        )
    })?;

    let status = response.status();
    let body_text = response.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(ProbeError::failure(
            "Zoho Commerce probe failed",
            json!({
                "status": status.as_u16(),
                "body": body_text.chars().take(512).collect::<String>(),
                "organization_id": organization_id,
                "endpoint": products_url
            }),
        ));
    }

    let parsed_body: Value = serde_json::from_str(&body_text).map_err(|err| {
        ProbeError::failure(
            "Failed to parse Zoho Commerce probe response",
            json!({
                "error": err.to_string(),
                "raw_body": body_text.chars().take(512).collect::<String>(),
                "organization_id": organization_id
            }),
        )
    })?;

    let code = parsed_body
        .get("code")
        .and_then(|value| value.as_i64())
        .unwrap_or(-1);

    if code != 0 {
        return Err(ProbeError::failure(
            "Zoho Commerce probe returned error code",
            json!({
                "code": code,
                "message": parsed_body.get("message"),
                "organization_id": organization_id
            }),
        ));
    }

    let returned_products = parsed_body
        .get("products")
        .and_then(|value| value.as_array())
        .map(|value| value.len());

    let has_more = parsed_body
        .get("page_context")
        .and_then(|value| value.get("has_more_page"))
        .and_then(|value| value.as_bool());

    Ok(json!({
        "note": "Zoho Commerce probe executed",
        "organization_id": organization_id,
        "endpoint": products_url,
        "returned_products": returned_products,
        "has_more": has_more
    }))
}

async fn probe_alibaba(
    state: &Arc<AppState>,
    headers: &HeaderMap,
    shop_id: &str,
    platform_variant: &str,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    match &request.auth {
        AuthPayload::Oauth2 {
            credentials,
            oauth_params,
            signing,
        } => {
            if credentials.client_id.trim().is_empty() {
                return Err(ProbeError::validation(
                    "Alibaba requires OAuth2 credentials.client_id",
                ));
            }

            if credentials.client_secret.trim().is_empty() {
                return Err(ProbeError::validation(
                    "Alibaba requires OAuth2 credentials.client_secret",
                ));
            }

            let access_token = credentials
                .access_token
                .as_ref()
                .map(|token| token.trim())
                .filter(|token| !token.is_empty())
                .map(ToString::to_string);

            if access_token.is_none() {
                let connect_payload = fetch_gateway_connect_payload(
                    state,
                    headers,
                    platform_variant,
                    shop_id,
                    request,
                )
                .await?;
                let (auth_url, state_token, auth_flow) =
                    extract_auth_bundle(platform_variant, &connect_payload, request)?;
                return Ok(json!({
                    "note": format!(
                        "{} OAuth2 tokens are required before running test_connect. Start the connect flow to obtain an access_token.",
                        platform_variant
                    ),
                    "platform": platform_variant,
                    "auth_url": auth_url,
                    "state": state_token,
                    "region": request.shop.region,
                    "required_credentials": ["access_token", "refresh_token", "signing.profile"],
                    "auth_flow": auth_flow,
                    "recommended_steps": [
                        "Call the connect init endpoint to fetch the authorization URL.",
                        "Redirect the merchant to Alibaba/Daraz so they can grant consent.",
                        "Handle the gateway callback to exchange the authorization code for access and refresh tokens.",
                        "Persist the returned tokens along with the md5 signing profile (alibaba_v1 or daraz_v1) and re-run connect without test_connect=true."
                    ],
                    "signing": {
                        "type": "md5",
                        "profile": ["alibaba_v1", "daraz_v1"],
                        "param_position": "body",
                        "case": "upper"
                    }
                }));
            }

            let signing_cfg = signing.as_ref().ok_or_else(|| {
                ProbeError::validation(
                    "Alibaba requires signing configuration (type=md5, profile=alibaba_v1)",
                )
            })?;

            if signing_cfg.signing_type.to_lowercase() != "md5" {
                return Err(ProbeError::validation("Alibaba signing.type must be 'md5'"));
            }

            if let Some(profile) = &signing_cfg.profile {
                let normalized = profile.to_lowercase();
                if normalized != "alibaba_v1" && normalized != "daraz_v1" {
                    return Err(ProbeError::validation(
                        "Alibaba signing.profile must be 'alibaba_v1' or 'daraz_v1'",
                    ));
                }
            } else {
                return Err(ProbeError::validation(
                    "Alibaba signing.profile is required (use 'alibaba_v1' or 'daraz_v1')",
                ));
            }

            let scopes = oauth_params
                .as_ref()
                .and_then(|params| params.scopes.clone())
                .unwrap_or_default();

            let marketplace_ids = request.shop.marketplace_ids.clone().unwrap_or_default();
            let region = request.shop.region.clone().unwrap_or_default();

            Ok(json!({
                "note": format!("{} probe stub executed", platform_variant),
                "region": region,
                "marketplace_ids": marketplace_ids,
                "scopes": scopes,
                "token_length": access_token.unwrap().len(),
                "has_refresh_token": credentials
                    .refresh_token
                    .as_ref()
                    .map(|token| !token.trim().is_empty())
                    .unwrap_or(false),
                "signing_profile": signing_cfg.profile.clone(),
                "signing_case": signing_cfg.case.clone().unwrap_or_else(|| "upper".to_string()),
                "signing_param_position": signing_cfg.param_position.clone().unwrap_or_else(|| "body".to_string())
            }))
        }
        _ => Err(ProbeError::validation(
            "Alibaba requires auth.type = 'oauth2'",
        )),
    }
}

async fn probe_aliexpress(
    state: &Arc<AppState>,
    headers: &HeaderMap,
    shop_id: &str,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    match &request.auth {
        AuthPayload::Oauth2 {
            credentials,
            oauth_params,
            ..
        } => {
            if credentials.client_id.trim().is_empty() {
                return Err(ProbeError::validation(
                    "AliExpress requires OAuth2 credentials.client_id",
                ));
            }

            if credentials.client_secret.trim().is_empty() {
                return Err(ProbeError::validation(
                    "AliExpress requires OAuth2 credentials.client_secret",
                ));
            }

            let scopes = oauth_params
                .as_ref()
                .and_then(|params| params.scopes.clone())
                .unwrap_or_default();

            let marketplace_ids = request.shop.marketplace_ids.clone().unwrap_or_default();
            let region = request.shop.region.clone();
            let store_url = request.shop.store_url.clone();

            let access_token = credentials
                .access_token
                .as_ref()
                .map(|token| token.trim())
                .filter(|token| !token.is_empty())
                .map(ToString::to_string);

            if access_token.is_none() {
                let connect_payload =
                    fetch_gateway_connect_payload(state, headers, "aliexpress", shop_id, request)
                        .await?;
                let (auth_url, state_token, auth_flow) =
                    extract_auth_bundle("aliexpress", &connect_payload, request)?;
                return Ok(json!({
                    "note": "AliExpress OAuth2 tokens are required before running test_connect. Start the connect flow to obtain an access_token.",
                    "platform": "aliexpress",
                    "auth_url": auth_url,
                    "state": state_token,
                    "region": region,
                    "marketplace_ids": marketplace_ids,
                    "required_credentials": ["access_token", "refresh_token"],
                    "recommended_steps": [
                        "Call the AliExpress connect init endpoint to fetch the authorization URL.",
                        "Redirect the merchant to AliExpress so they can grant consent.",
                        "Handle the gateway callback to exchange the authorization code for access and refresh tokens.",
                        "Persist the returned tokens and re-run connect without options.test_connect=true."
                    ],
                    "auth_flow": auth_flow
                }));
            }

            let mut payload = probe_gateway_platform(state, "aliexpress", request).await?;

            if let Value::Object(ref mut map) = payload {
                map.entry("platform".to_string())
                    .or_insert_with(|| Value::String("aliexpress".to_string()));

                if let Some(region) = region.clone() {
                    map.entry("region".to_string())
                        .or_insert_with(|| Value::String(region));
                }

                if let Some(url) = store_url.clone() {
                    if !url.trim().is_empty() {
                        map.entry("store_url".to_string())
                            .or_insert_with(|| Value::String(url));
                    }
                }

                if !marketplace_ids.is_empty() {
                    map.entry("marketplace_ids".to_string())
                        .or_insert_with(|| Value::from(marketplace_ids.clone()));
                }

                if !scopes.is_empty() {
                    map.entry("scopes".to_string())
                        .or_insert_with(|| Value::from(scopes.clone()));
                }

                map.insert(
                    "has_refresh_token".to_string(),
                    Value::from(
                        credentials
                            .refresh_token
                            .as_ref()
                            .map(|value| !value.trim().is_empty())
                            .unwrap_or(false),
                    ),
                );

                if let Ok(cap_value) = serde_json::to_value(&request.capabilities) {
                    map.entry("capabilities".to_string()).or_insert(cap_value);
                }
            }

            Ok(payload)
        }
        _ => Err(ProbeError::validation(
            "AliExpress requires auth.type = 'oauth2'",
        )),
    }
}

async fn probe_etsy(
    state: &Arc<AppState>,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    match &request.auth {
        AuthPayload::Oauth2 {
            credentials,
            oauth_params,
            ..
        } => {
            if credentials.client_id.trim().is_empty() {
                return Err(ProbeError::validation(
                    "Etsy requires OAuth2 credentials.client_id",
                ));
            }

            if credentials.client_secret.trim().is_empty() {
                return Err(ProbeError::validation(
                    "Etsy requires OAuth2 credentials.client_secret",
                ));
            }

            let scopes = oauth_params
                .as_ref()
                .and_then(|params| params.scopes.clone())
                .unwrap_or_default();

            let marketplace_ids = request.shop.marketplace_ids.clone().unwrap_or_default();
            let region = request.shop.region.clone();
            let store_url = request.shop.store_url.clone();

            let access_token = credentials
                .access_token
                .as_ref()
                .map(|token| token.trim())
                .filter(|token| !token.is_empty())
                .map(ToString::to_string);

            if let Some(token) = access_token {
                let mut payload = probe_gateway_platform(state, "etsy", request).await?;

                if let Value::Object(ref mut map) = payload {
                    map.entry("platform")
                        .or_insert_with(|| Value::String("etsy".to_string()));

                    if let Some(region) = region.clone() {
                        map.entry("region").or_insert_with(|| Value::String(region));
                    }

                    if let Some(url) = store_url.clone() {
                        if !url.trim().is_empty() {
                            map.entry("store_url").or_insert_with(|| Value::String(url));
                        }
                    }

                    if !marketplace_ids.is_empty() {
                        map.entry("marketplace_ids")
                            .or_insert_with(|| Value::from(marketplace_ids.clone()));
                    }

                    if !scopes.is_empty() {
                        map.entry("scopes")
                            .or_insert_with(|| Value::from(scopes.clone()));
                    }

                    map.insert("token_length".to_string(), Value::from(token.len()));
                    map.insert(
                        "has_refresh_token".to_string(),
                        Value::from(
                            credentials
                                .refresh_token
                                .as_ref()
                                .map(|value| !value.trim().is_empty())
                                .unwrap_or(false),
                        ),
                    );

                    if let Ok(cap_value) = serde_json::to_value(&request.capabilities) {
                        map.entry("capabilities").or_insert(cap_value);
                    }
                }

                Ok(payload)
            } else {
                let (auth_url, state_token) =
                    build_etsy_auth_bundle(state, request, credentials, oauth_params)?;
                Ok(json!({
                    "note": "Etsy OAuth2 tokens are required before running test_connect. Start the connect flow to obtain an access_token.",
                    "platform": "etsy",
                    "auth_url": auth_url,
                    "state": state_token,
                    "region": region,
                    "marketplace_ids": marketplace_ids,
                    "required_credentials": ["access_token", "refresh_token"],
                    "recommended_steps": [
                        "Call the Etsy connect init endpoint to fetch the authorization URL.",
                        "Redirect the merchant to Etsy so they can grant consent.",
                        "Handle the gateway callback to exchange the authorization code for access and refresh tokens.",
                        "Persist the returned tokens and re-run connect without options.test_connect=true."
                    ],
                    "auth_flow": {
                        "init_endpoint": "/api/v1/{app_name}/gateway/ecommerce/etsy/connect",
                        "callback_endpoint": "/api/v1/{app_name}/gateway/ecommerce/etsy/callback",
                        "platform_callback": "/api/v1/{app_name}/platform/shop/{shop_id}/connect/etsy/callback"
                    }
                }))
            }
        }
        _ => Err(ProbeError::validation("Etsy requires auth.type = 'oauth2'")),
    }
}

async fn probe_wix(
    state: &Arc<AppState>,
    headers: &HeaderMap,
    shop_id: &str,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    match &request.auth {
        AuthPayload::Oauth2 {
            credentials,
            oauth_params,
            ..
        } => {
            if credentials.client_id.trim().is_empty()
                || credentials.client_secret.trim().is_empty()
            {
                return Err(ProbeError::validation(
                    "Wix requires OAuth2 credentials.client_id and credentials.client_secret",
                ));
            }

            let scopes = oauth_params
                .as_ref()
                .and_then(|params| params.scopes.clone())
                .unwrap_or_default();

            let marketplace_ids = request.shop.marketplace_ids.clone().unwrap_or_default();
            let region = request.shop.region.clone();
            let store_url = request.shop.store_url.clone();

            let access_token = credentials
                .access_token
                .as_ref()
                .map(|token| token.trim())
                .filter(|token| !token.is_empty())
                .map(ToString::to_string);

            if let Some(token) = access_token {
                let mut payload = probe_gateway_platform(state, "wix", request).await?;

                if let Value::Object(ref mut map) = payload {
                    map.entry("platform")
                        .or_insert_with(|| Value::String("wix".to_string()));

                    if let Some(region) = region.clone() {
                        map.entry("region").or_insert_with(|| Value::String(region));
                    }

                    if let Some(url) = store_url.clone() {
                        if !url.trim().is_empty() {
                            map.entry("store_url").or_insert_with(|| Value::String(url));
                        }
                    }

                    if !marketplace_ids.is_empty() {
                        map.entry("marketplace_ids")
                            .or_insert_with(|| Value::from(marketplace_ids.clone()));
                    }

                    if !scopes.is_empty() {
                        map.entry("scopes")
                            .or_insert_with(|| Value::from(scopes.clone()));
                    }

                    map.insert("token_length".to_string(), Value::from(token.len()));
                    map.insert(
                        "has_refresh_token".to_string(),
                        Value::from(
                            credentials
                                .refresh_token
                                .as_ref()
                                .map(|value| !value.trim().is_empty())
                                .unwrap_or(false),
                        ),
                    );
                }

                Ok(payload)
            } else {
                let bundle = build_wix_auth_bundle(
                    state,
                    headers,
                    shop_id,
                    request,
                    credentials,
                    oauth_params,
                )
                .await?;

                let mut recommended_steps = vec![
                    "Call the Wix connect init endpoint to fetch the authorization URL.",
                    "Redirect the merchant to Wix so they can grant consent.",
                    "Handle the gateway callback to exchange the authorization code for access and refresh tokens.",
                    "Persist the returned tokens and re-run connect without options.test_connect=true.",
                ];

                if bundle.installer_url.is_some() {
                    recommended_steps.insert(
                        0,
                        "Open the Wix installer URL so the merchant can finalize the custom authentication handshake (token → code).",
                    );
                }

                let mut response = json!({
                    "note": "Wix OAuth2 tokens are required before running test_connect. Start the connect flow to obtain an access_token.",
                    "platform": "wix",
                    "auth_url": bundle.auth_url,
                    "state": bundle.state,
                    "region": region,
                    "marketplace_ids": marketplace_ids,
                    "required_credentials": ["access_token", "refresh_token"],
                    "recommended_steps": recommended_steps,
                    "auth_flow": {
                        "init_endpoint": "/api/v1/{app_name}/gateway/ecommerce/wix/connect",
                        "callback_endpoint": "/api/v1/{app_name}/gateway/ecommerce/wix/callback",
                        "platform_callback": "/api/v1/{app_name}/platform/shop/{shop_id}/connect/wix/callback"
                    }
                });

                if let Some(installer_url) = bundle.installer_url {
                    if let Value::Object(ref mut map) = response {
                        map.insert("installer_url".to_string(), Value::String(installer_url));
                    }
                }

                Ok(response)
            }
        }
        _ => Err(ProbeError::validation("Wix requires auth.type = 'oauth2'")),
    }
}

async fn probe_tiktok(
    state: &Arc<AppState>,
    headers: &HeaderMap,
    shop_id: &str,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    match &request.auth {
        AuthPayload::Oauth2 { .. } => {
            let connect_payload =
                fetch_gateway_connect_payload(state, headers, "tiktok", shop_id, request).await?;
            let (auth_url, state_token, auth_flow) =
                extract_auth_bundle("tiktok", &connect_payload, request)?;

            Ok(json!({
                "note": "TikTok OAuth credentials received. Complete the redirect flow to validate tokens.",
                "auth_url": auth_url,
                "state": state_token,
                "region": request.shop.region,
                "auth_flow": auth_flow,
                "recommended_steps": [
                    "Call the TikTok connect init endpoint to retrieve the authorization URL.",
                    "Redirect the merchant to TikTok so they can grant consent.",
                    "Handle the gateway callback to exchange the auth code for tokens.",
                    "Persist the returned access/refresh tokens and proceed with product sync without test_connect=true."
                ]
            }))
        }
        _ => Err(ProbeError::validation(
            "TikTok requires auth.type = 'oauth2'. Initiate the OAuth connect flow instead of providing basic credentials.",
        )),
    }
}

fn derive_shop_identifier(request: &ConnectRequestV1) -> String {
    request
        .shop
        .store_id
        .clone()
        .or_else(|| request.shop.store_url.clone())
        .or_else(|| request.org.user_id.clone())
        .unwrap_or_else(|| request.org.org_id.clone())
}

fn build_state_token(platform: &str, request: &ConnectRequestV1) -> String {
    let nonce = Uuid::new_v4().to_string();
    let shop_id = derive_shop_identifier(request);
    let org_id = request.org.org_id.clone();
    let user_id = request
        .org
        .user_id
        .clone()
        .unwrap_or_else(|| request.org.org_id.clone());

    if matches!(
        platform,
        "tiktok" | "lazada" | "alibaba" | "aliexpress" | "shopify"
    ) {
        let mut payload = json!({
            "tenant_id": org_id,
            "shop_id": shop_id,
            "platform": platform,
            "state": nonce
        });

        if let Some(domain) = &request.shop.store_url {
            payload["shop_domain"] = json!(domain);
        }

        BASE64.encode(payload.to_string())
    } else if platform == "shopee" {
        json!({
            "org_id": org_id,
            "user_id": user_id,
            "shop_id": shop_id,
            "state": nonce
        })
        .to_string()
    } else {
        nonce
    }
}

fn set_market_from_request(creds: &mut PlatformCredentials, region: Option<&String>) {
    if let Some(region) = region {
        let region_upper = region.trim().to_uppercase();
        if !region_upper.is_empty() {
            creds.market = Some(region_upper);
        }
    }
}

fn build_jd_auth_bundle(
    state: &Arc<AppState>,
    request: &ConnectRequestV1,
    oauth_credentials: &OAuth2Credentials,
    oauth_params: &Option<OAuth2Params>,
) -> Result<(String, String), ProbeError> {
    let mut creds = match state.config.get_platform_credentials("jd") {
        Ok(creds) => {
            if creds.app_key.is_empty() || creds.app_secret.is_empty() {
                warn!(
                    "JD platform credentials missing app_key/app_secret in config; falling back to request payload"
                );
                None
            } else {
                Some(creds)
            }
        }
        Err(err) => {
            warn!(
                "JD platform credentials not configured in config/env ({}); falling back to request payload",
                err
            );
            None
        }
    }
    .unwrap_or_else(|| PlatformCredentials {
        api_key: oauth_credentials.client_id.clone(),
        app_key: oauth_credentials.client_id.clone(),
        app_secret: oauth_credentials.client_secret.clone(),
        redirect_uri: oauth_params
            .as_ref()
            .and_then(|params| params.redirect_uri.clone()),
        api_base_url: "https://api.jd.com".to_string(),
        rate_limit_rps: 10.0,
        oauth_authorize_url: Some("https://seller.jd.com/api-register".to_string()),
        oauth_token_url: Some("https://api.jd.com/oauth/token".to_string()),
        oauth_refresh_url: None,
        oauth_revoke_url: None,
        store_id: None,
        base_url: None,
        tenant_id: None,
        service_id: None,
        market: None,
    });

    if creds.app_key.is_empty() {
        creds.app_key = oauth_credentials.client_id.clone();
    }

    if creds.api_key.is_empty() {
        creds.api_key = creds.app_key.clone();
    }

    if creds.app_secret.is_empty() {
        creds.app_secret = oauth_credentials.client_secret.clone();
    }

    if creds.redirect_uri.is_none() {
        let redirect = oauth_params
            .as_ref()
            .and_then(|params| params.redirect_uri.clone())
            .unwrap_or_else(|| {
                format!(
                    "{}/dashboard/connect/jd/callback",
                    state.config.frontend_url.trim_end_matches('/')
                )
            });
        creds.redirect_uri = Some(redirect);
    }

    if creds.api_base_url.trim().is_empty() {
        creds.api_base_url = "https://api.jd.com".to_string();
    }

    set_market_from_request(&mut creds, request.shop.region.as_ref());
    let gateway = JDGateway::new(creds);
    let state_token = build_state_token("jd", request);
    let auth_url = gateway.get_oauth_url(&state_token);
    Ok((auth_url, state_token))
}

struct WixAuthBundle {
    auth_url: String,
    state: String,
    installer_url: Option<String>,
}

async fn build_wix_auth_bundle(
    state: &Arc<AppState>,
    headers: &HeaderMap,
    shop_id: &str,
    request: &ConnectRequestV1,
    oauth_credentials: &OAuth2Credentials,
    oauth_params: &Option<OAuth2Params>,
) -> Result<WixAuthBundle, ProbeError> {
    let connect_payload =
        fetch_gateway_connect_payload(state, headers, "wix", shop_id, request).await?;

    let auth_url = connect_payload
        .get("auth_url")
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
        .ok_or_else(|| {
            ProbeError::failure(
                "Gateway connect response missing auth_url",
                json!({ "platform": "wix", "payload": connect_payload }),
            )
        })?;

    let state_token = connect_payload
        .get("state")
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
        .unwrap_or_else(|| build_state_token("wix", request));

    let creds = build_wix_platform_credentials(state, request, oauth_credentials, oauth_params);
    let installer_url = build_wix_installer_url_from_creds(&creds, request, &state_token);

    Ok(WixAuthBundle {
        auth_url,
        state: state_token,
        installer_url,
    })
}

fn build_wix_platform_credentials(
    state: &Arc<AppState>,
    request: &ConnectRequestV1,
    oauth_credentials: &OAuth2Credentials,
    oauth_params: &Option<OAuth2Params>,
) -> PlatformCredentials {
    let mut creds = state
        .config
        .get_platform_credentials("wix")
        .ok()
        .filter(|creds| !creds.app_key.is_empty() && !creds.app_secret.is_empty())
        .or_else(|| {
            warn!(
                "Wix platform credentials missing or incomplete in config/env; falling back to request payload"
            );
            None
        })
        .unwrap_or_else(|| PlatformCredentials {
            api_key: oauth_credentials.client_id.clone(),
            app_key: oauth_credentials.client_id.clone(),
            app_secret: oauth_credentials.client_secret.clone(),
            redirect_uri: oauth_params
                .as_ref()
                .and_then(|params| params.redirect_uri.clone()),
            api_base_url: "https://www.wixapis.com".to_string(),
            rate_limit_rps: 10.0,
            oauth_authorize_url: Some("https://www.wixapis.com/oauth/access".to_string()),
            oauth_token_url: Some("https://www.wixapis.com/oauth/access".to_string()),
            oauth_refresh_url: None,
            oauth_revoke_url: None,
            store_id: None,
            base_url: None,
            tenant_id: None,
            service_id: None,
            market: None,
        });

    if creds.app_key.is_empty() {
        creds.app_key = oauth_credentials.client_id.clone();
    }

    if creds.api_key.is_empty() {
        creds.api_key = creds.app_key.clone();
    }

    if creds.app_secret.is_empty() {
        creds.app_secret = oauth_credentials.client_secret.clone();
    }

    if creds.redirect_uri.is_none() {
        let redirect = oauth_params
            .as_ref()
            .and_then(|params| params.redirect_uri.clone())
            .unwrap_or_else(|| {
                format!(
                    "{}/dashboard/connect/wix/callback",
                    state.config.frontend_url.trim_end_matches('/')
                )
            });
        creds.redirect_uri = Some(redirect);
    }

    if creds.oauth_authorize_url.is_none() {
        creds.oauth_authorize_url = Some("https://www.wixapis.com/oauth/access".to_string());
    }

    if creds.oauth_token_url.is_none() {
        creds.oauth_token_url = Some("https://www.wixapis.com/oauth/access".to_string());
    }

    if creds.api_base_url.trim().is_empty() {
        creds.api_base_url = "https://www.wixapis.com".to_string();
    }

    if creds
        .store_id
        .as_ref()
        .map(|id| id.trim().is_empty())
        .unwrap_or(true)
    {
        if let Some(store_id) = request
            .shop
            .store_id
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            creds.store_id = Some(store_id.to_string());
        } else if let Some(instance_id) = request
            .metadata
            .as_object()
            .and_then(|map| map.get("instance_id"))
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            creds.store_id = Some(instance_id.to_string());
        }
    }

    set_market_from_request(&mut creds, request.shop.region.as_ref());

    creds
}

fn build_wix_installer_url_from_creds(
    creds: &PlatformCredentials,
    request: &ConnectRequestV1,
    state: &str,
) -> Option<String> {
    let token = request
        .metadata
        .as_object()
        .and_then(|meta| {
            meta.get("installer_token")
                .or_else(|| meta.get("token"))
                .or_else(|| meta.get("authorization_token"))
        })
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())?;

    let redirect_uri = creds
        .redirect_uri
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())?;

    let app_id = creds.app_key.trim();
    if app_id.is_empty() {
        return None;
    }

    Some(format!(
        "https://www.wix.com/installer/install?token={}&appId={}&redirectUrl={}&state={}",
        urlencoding::encode(token),
        urlencoding::encode(app_id),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(state)
    ))
}

fn extract_auth_bundle(
    platform: &str,
    connect_payload: &Value,
    request: &ConnectRequestV1,
) -> Result<(String, String, Value), ProbeError> {
    let auth_url = connect_payload
        .get("auth_url")
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
        .ok_or_else(|| {
            ProbeError::failure(
                format!(
                    "Gateway connect response missing auth_url for platform '{}'",
                    platform
                ),
                connect_payload.clone(),
            )
        })?;

    let state_token = connect_payload
        .get("state")
        .and_then(|value| value.as_str())
        .map(|value| value.to_string())
        .unwrap_or_else(|| build_state_token(platform, request));

    let auth_flow = connect_payload
        .get("auth_flow")
        .cloned()
        .unwrap_or_else(|| default_auth_flow(platform));

    Ok((auth_url, state_token, auth_flow))
}

fn default_auth_flow(platform: &str) -> Value {
    json!({
        "init_endpoint": format!("/api/v1/{{app_name}}/gateway/ecommerce/{}/connect", platform),
        "callback_endpoint": format!("/api/v1/{{app_name}}/gateway/ecommerce/{}/callback", platform),
        "platform_callback": format!("/api/v1/{{app_name}}/platform/shop/{{shop_id}}/connect/{}/callback", platform)
    })
}

fn build_connect_query_from_request(shop_id: &str, request: &ConnectRequestV1) -> ConnectQuery {
    ConnectQuery {
        shop_id: shop_id.to_string(),
        org_id: request.org.org_id.clone(),
        user_id: request.org.user_id.clone(),
        redirect_uri: extract_redirect_uri(request),
        shop_domain: request.shop.store_url.clone(),
        shop_region: request.shop.region.clone(),
    }
}

fn extract_redirect_uri(request: &ConnectRequestV1) -> Option<String> {
    match &request.auth {
        AuthPayload::Oauth2 { oauth_params, .. } => oauth_params
            .as_ref()
            .and_then(|params| params.redirect_uri.clone()),
        _ => None,
    }
}

async fn fetch_gateway_connect_payload(
    state: &Arc<AppState>,
    headers: &HeaderMap,
    platform: &str,
    shop_id: &str,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    let query = build_connect_query_from_request(shop_id, request);
    call_gateway_ecommerce_connect(state, platform, &query, headers)
        .await
        .map_err(|err| {
            let message = err.to_string();
            if matches!(err, AppError::ExternalApiError(_)) && is_gateway_transport_error(&message)
            {
                ProbeError::unavailable(
                    "Gateway service unavailable for connect flow",
                    json!({ "error": message, "platform": platform }),
                )
            } else {
                ProbeError::failure(
                    "Gateway connect request failed",
                    json!({ "error": message, "platform": platform }),
                )
            }
        })
}

fn build_etsy_auth_bundle(
    state: &Arc<AppState>,
    request: &ConnectRequestV1,
    oauth_credentials: &OAuth2Credentials,
    oauth_params: &Option<OAuth2Params>,
) -> Result<(String, String), ProbeError> {
    let mut creds = match state.config.get_platform_credentials("etsy") {
        Ok(creds) => {
            if creds.app_key.is_empty() || creds.app_secret.is_empty() {
                warn!(
                    "Etsy platform credentials missing app_key/app_secret in config; falling back to request payload"
                );
                None
            } else {
                Some(creds)
            }
        }
        Err(err) => {
            warn!(
                "Etsy platform credentials not configured in config/env ({}); falling back to request payload",
                err
            );
            None
        }
    }
    .unwrap_or_else(|| PlatformCredentials {
        api_key: oauth_credentials.client_id.clone(),
        app_key: oauth_credentials.client_id.clone(),
        app_secret: oauth_credentials.client_secret.clone(),
        redirect_uri: oauth_params
            .as_ref()
            .and_then(|params| params.redirect_uri.clone()),
        api_base_url: "https://openapi.etsy.com".to_string(),
        rate_limit_rps: 10.0,
        oauth_authorize_url: Some("https://www.etsy.com/oauth/connect".to_string()),
        oauth_token_url: Some("https://api.etsy.com/v3/public/oauth/token".to_string()),
        oauth_refresh_url: None,
        oauth_revoke_url: None,
        store_id: None,
        base_url: None,
        tenant_id: None,
        service_id: None,
        market: None,
    });

    if creds.app_key.is_empty() {
        creds.app_key = oauth_credentials.client_id.clone();
    }

    if creds.api_key.is_empty() {
        creds.api_key = creds.app_key.clone();
    }

    if creds.app_secret.is_empty() {
        creds.app_secret = oauth_credentials.client_secret.clone();
    }

    if creds.redirect_uri.is_none() {
        let redirect = oauth_params
            .as_ref()
            .and_then(|params| params.redirect_uri.clone())
            .unwrap_or_else(|| {
                format!(
                    "{}/dashboard/connect/etsy/callback",
                    state.config.frontend_url.trim_end_matches('/')
                )
            });
        creds.redirect_uri = Some(redirect);
    }

    if creds.oauth_authorize_url.is_none() {
        creds.oauth_authorize_url = Some("https://www.etsy.com/oauth/connect".to_string());
    }

    if creds.oauth_token_url.is_none() {
        creds.oauth_token_url = Some("https://api.etsy.com/v3/public/oauth/token".to_string());
    }

    if creds.api_base_url.trim().is_empty() {
        creds.api_base_url = "https://openapi.etsy.com".to_string();
    }

    set_market_from_request(&mut creds, request.shop.region.as_ref());
    let gateway = EtsyGateway::new(creds);
    let state_token = build_state_token("etsy", request);
    let auth_url = gateway.get_oauth_url(&state_token);
    Ok((auth_url, state_token))
}

fn build_gateway_credentials_from_request(
    state: &Arc<AppState>,
    platform: &str,
    request: &ConnectRequestV1,
) -> Result<GatewayCredentials, ProbeError> {
    let mut additional = HashMap::new();
    if let Some(region) = &request.shop.region {
        additional.insert("region".to_string(), region.clone());
    }
    if let Some(timezone) = &request.shop.timezone {
        additional.insert("timezone".to_string(), timezone.clone());
    }
    if let Some(marketplace_ids) = &request.shop.marketplace_ids {
        additional.insert("marketplace_ids".to_string(), marketplace_ids.join(","));
    }
    if let Some(seller_id) = &request.shop.seller_id {
        additional.insert("seller_id".to_string(), seller_id.clone());
    }
    if let Some(user_id) = &request.org.user_id {
        additional.insert("user_id".to_string(), user_id.clone());
    }

    let mut extra = HashMap::new();
    if !request.platform.environment.trim().is_empty() {
        extra.insert(
            "environment".to_string(),
            request.platform.environment.clone(),
        );
    }
    if let Some(endpoint) = &request.platform.endpoint {
        extra.insert("endpoint".to_string(), endpoint.clone());
    } else if let Ok(creds) = state.config.get_platform_credentials(platform) {
        if !creds.api_base_url.is_empty() {
            extra.insert("endpoint".to_string(), creds.api_base_url);
        }
    }

    let store_url = request.shop.store_url.clone();

    let mut gateway_creds = GatewayCredentials {
        api_key: None,
        api_secret: None,
        access_token: None,
        refresh_token: None,
        store_url,
        shop_id: request
            .shop
            .store_id
            .clone()
            .or_else(|| request.shop.seller_id.clone())
            .or_else(|| request.shop.store_url.clone())
            .or_else(|| Some(request.org.org_id.clone())),
        additional,
        extra,
    };

    if let Some(url) = gateway_creds.store_url.clone() {
        if !url.trim().is_empty() {
            gateway_creds
                .extra
                .entry("base_url".to_string())
                .or_insert(url);
        }
    }

    match &request.auth {
        AuthPayload::ApiKey { credentials, .. } => {
            let api_key = credentials.api_key.trim();
            if api_key.is_empty() {
                return Err(ProbeError::validation("API key cannot be empty"));
            }
            gateway_creds.api_key = Some(api_key.to_string());
        }
        AuthPayload::Basic { credentials, .. } => {
            let consumer_key = credentials.consumer_key.trim();
            let consumer_secret = credentials.consumer_secret.trim();
            if consumer_key.is_empty() || consumer_secret.is_empty() {
                return Err(ProbeError::validation(
                    "Basic authentication requires consumer_key and consumer_secret",
                ));
            }
            gateway_creds.api_key = Some(consumer_key.to_string());
            gateway_creds.api_secret = Some(consumer_secret.to_string());
        }
        AuthPayload::Oauth2 { credentials, .. } => {
            let mut client_id = credentials.client_id.trim().to_string();
            let mut client_secret = credentials.client_secret.trim().to_string();

            if client_id.is_empty() || client_secret.is_empty() {
                if let Ok(platform_creds) = state.config.get_platform_credentials(platform) {
                    if client_id.is_empty() {
                        client_id = platform_creds.app_key;
                    }
                    if client_secret.is_empty() {
                        client_secret = platform_creds.app_secret;
                    }
                }
            }

            if client_id.is_empty() || client_secret.is_empty() {
                return Err(ProbeError::validation(
                    "OAuth2 requires client_id and client_secret",
                ));
            }

            gateway_creds.api_key = Some(client_id);
            gateway_creds.api_secret = Some(client_secret);
            if let Some(token) = &credentials.access_token {
                let token = token.trim();
                if !token.is_empty() {
                    gateway_creds.access_token = Some(token.to_string());
                }
            }
            if let Some(refresh) = &credentials.refresh_token {
                let refresh = refresh.trim();
                if !refresh.is_empty() {
                    gateway_creds.refresh_token = Some(refresh.to_string());
                }
            }
        }
        AuthPayload::Bearer { credentials, .. } => {
            let token = credentials.token.trim();
            if token.is_empty() {
                return Err(ProbeError::validation("Bearer token cannot be empty"));
            }
            gateway_creds.access_token = Some(token.to_string());
        }
        AuthPayload::Hmac { credentials, .. } => {
            let partner_key = credentials.partner_key.trim();
            gateway_creds.api_key = Some(credentials.partner_id.to_string());
            gateway_creds.api_secret = Some(partner_key.to_string());
            if let Some(shop_id) = credentials.shop_id {
                gateway_creds.shop_id = Some(shop_id.to_string());
            }
        }
        AuthPayload::Spapi { lwa, .. } => {
            if lwa.client_id.trim().is_empty()
                || lwa.client_secret.trim().is_empty()
                || lwa.refresh_token.trim().is_empty()
            {
                return Err(ProbeError::validation(
                    "SP-API requires client_id, client_secret, and refresh_token",
                ));
            }
            gateway_creds.api_key = Some(lwa.client_id.trim().to_string());
            gateway_creds.api_secret = Some(lwa.client_secret.trim().to_string());
            gateway_creds.refresh_token = Some(lwa.refresh_token.trim().to_string());
        }
    }

    Ok(gateway_creds)
}

async fn probe_lineshopping(
    state: &Arc<AppState>,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    let api_key = match &request.auth {
        AuthPayload::ApiKey { credentials, .. } => {
            let key = credentials.api_key.trim();
            if key.is_empty() {
                return Err(ProbeError::validation(
                    "LINE Shopping requires auth.credentials.api_key",
                ));
            }
            key.to_string()
        }
        _ => {
            return Err(ProbeError::validation(
                "LINE Shopping requires auth.type = 'api_key'",
            ))
        }
    };

    let default_base_url = "https://developers-oaplus.line.biz/myshop/v1";

    let mut platform_creds = state
        .config
        .get_platform_credentials("lineshopping")
        .map_err(|err| {
            ProbeError::failure(
                "Failed to load LINE Shopping platform configuration",
                json!({ "error": err.to_string() }),
            )
        })?;

    let api_key_header = api_key.clone();
    platform_creds.api_key = api_key;

    let mut base_url = request
        .platform
        .endpoint
        .as_ref()
        .map(|endpoint| endpoint.trim())
        .filter(|endpoint| !endpoint.is_empty())
        .map(|endpoint| endpoint.to_string())
        .unwrap_or_else(|| platform_creds.api_base_url.clone());

    if base_url.trim().is_empty() {
        base_url = default_base_url.to_string();
    }

    platform_creds.api_base_url = base_url.clone();

    if let Some(store_url) = &request.shop.store_url {
        platform_creds.base_url = Some(store_url.clone());
    }

    let products_endpoint = format!("{}/products", base_url.trim_end_matches('/'));

    let gateway = LineShoppingGateway::new(platform_creds);

    let mut details = gateway.test_connection().await.map_err(|err| {
        ProbeError::failure(
            "LINE Shopping API key validation failed",
            json!({ "error": err.to_string() }),
        )
    })?;

    let http_client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|err| {
            ProbeError::failure(
                "Failed to initialize HTTP client for LINE Shopping probe",
                json!({ "error": err.to_string() }),
            )
        })?;

    let response = http_client
        .get(&products_endpoint)
        .header("X-API-KEY", &api_key_header)
        .header("Accept", "application/json")
        .query(&[("perPage", "1"), ("page", "1")])
        .send()
        .await
        .map_err(|err| {
            ProbeError::failure(
                "Failed to call LINE Shopping products API",
                json!({
                    "error": err.to_string(),
                    "endpoint": products_endpoint
                }),
            )
        })?;

    let status = response.status();
    let body_text = response.text().await.map_err(|err| {
        ProbeError::failure(
            "Failed to read LINE Shopping products response",
            json!({
                "error": err.to_string(),
                "endpoint": products_endpoint
            }),
        )
    })?;

    if !status.is_success() {
        return Err(ProbeError::failure(
            "LINE Shopping products API returned error",
            json!({
                "status": status.as_u16(),
                "body": body_text.chars().take(512).collect::<String>(),
                "endpoint": products_endpoint
            }),
        ));
    }

    let products_value: Value = serde_json::from_str(&body_text).map_err(|err| {
        ProbeError::failure(
            "Failed to parse LINE Shopping products response",
            json!({
                "error": err.to_string(),
                "endpoint": products_endpoint,
                "raw_body": body_text.chars().take(512).collect::<String>()
            }),
        )
    })?;

    let sample_products = products_value
        .get("data")
        .or_else(|| products_value.get("products"))
        .and_then(|value| value.as_array())
        .map(|arr| arr.iter().take(1).cloned().collect::<Vec<_>>())
        .unwrap_or_default();

    if let Value::Object(ref mut map) = details {
        map.entry("platform")
            .or_insert_with(|| Value::String("lineshopping".to_string()));
        if let Some(store_url) = &request.shop.store_url {
            map.entry("store_url")
                .or_insert_with(|| Value::String(store_url.clone()));
        }
        map.entry("product_fetch_endpoint")
            .or_insert_with(|| Value::String(products_endpoint));
        map.entry("sample_products")
            .or_insert(Value::Array(sample_products));
        map.entry("product_response_raw").or_insert(products_value);
    }

    Ok(details)
}

async fn probe_lazada(
    state: &Arc<AppState>,
    headers: &HeaderMap,
    shop_id: &str,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    match &request.auth {
        AuthPayload::Basic { .. } | AuthPayload::Oauth2 { .. } | AuthPayload::Hmac { .. } => {}
        _ => {
            return Err(ProbeError::validation(
                "Lazada requires auth.type = 'basic', 'oauth2', or 'hmac'",
            ))
        }
    }

    if let AuthPayload::Oauth2 { credentials, .. } = &request.auth {
        let has_access_token = credentials
            .access_token
            .as_ref()
            .map(|token| !token.trim().is_empty())
            .unwrap_or(false);

        if !has_access_token {
            let connect_payload =
                fetch_gateway_connect_payload(state, headers, "lazada", shop_id, request).await?;
            return build_lazada_connect_response(&connect_payload, request);
        }
    }

    let mut payload = probe_gateway_platform(state, "lazada", request).await?;

    if let Value::Object(ref mut map) = payload {
        if let Some(region) = request.shop.region.as_ref() {
            if !region.trim().is_empty() {
                map.entry("region")
                    .or_insert_with(|| Value::String(region.clone()));
            }
        }

        let environment = request.platform.environment.trim();
        if !environment.is_empty() {
            map.entry("environment")
                .or_insert_with(|| Value::String(environment.to_string()));
        }

        map.entry("platform")
            .or_insert_with(|| Value::String("lazada".to_string()));

        match fetch_gateway_connect_payload(state, headers, "lazada", shop_id, request).await {
            Ok(connect_payload) => {
                enrich_lazada_payload_with_connect_data(map, &connect_payload);
            }
            Err(err) => {
                warn!(
                    "Failed to fetch Lazada connect payload for enrichment: {}",
                    err.message
                );
            }
        }
    }

    Ok(payload)
}

fn build_lazada_connect_response(
    connect_payload: &Value,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    let (auth_url, state_token, auth_flow) =
        extract_auth_bundle("lazada", connect_payload, request)?;
    Ok(json!({
        "note": "Lazada OAuth2 tokens are required before running test_connect. Start the connect flow to obtain an access_token.",
        "platform": "lazada",
        "auth_url": auth_url,
        "state": state_token,
        "region": request.shop.region,
        "marketplace_ids": request.shop.marketplace_ids,

        "required_credentials": ["access_token", "refresh_token"],
        "recommended_steps": [
            "Open the Lazada auth_url in the seller's preferred country portal.",
            "Have the merchant sign in and approve the requested scopes.",
            "Wait for the callback to deliver the authorization code.",
            "Exchange the code for tokens and store them before making API calls."
        ],
        "auth_flow": auth_flow
    }))
}

fn enrich_lazada_payload_with_connect_data(
    map: &mut serde_json::Map<String, Value>,
    connect_payload: &Value,
) {
    if let Some(auth_url) = connect_payload
        .get("auth_url")
        .and_then(|value| value.as_str())
    {
        map.insert("auth_url".to_string(), Value::String(auth_url.to_string()));
    }

    if let Some(state) = connect_payload
        .get("state")
        .and_then(|value| value.as_str())
    {
        map.insert("state".to_string(), Value::String(state.to_string()));
    }

    if let Some(auth_flow) = connect_payload.get("auth_flow") {
        map.insert("auth_flow".to_string(), auth_flow.clone());
    }

    map.entry("recommended_steps").or_insert(json!([
        "Open the Lazada auth_url in the seller's preferred country portal.",
        "Have the merchant log in and approve the requested scopes.",
        "Wait for the callback to deliver the authorization code.",
        "Exchange the code for tokens and store them before making API calls."
    ]));
}

async fn probe_shopee(
    state: &Arc<AppState>,
    headers: &HeaderMap,
    shop_id: &str,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    let connect_payload =
        fetch_gateway_connect_payload(state, headers, "shopee", shop_id, request).await?;
    let (auth_url, state_token, auth_flow) =
        extract_auth_bundle("shopee", &connect_payload, request)?;

    Ok(json!({
        "note": "Shopee OAuth flow must be completed by the merchant in the appropriate country portal.",
        "auth_url": auth_url,
        "state": state_token,
        "region": request.shop.region,

        "auth_flow": auth_flow,
        "recommended_steps": [
            "Open the provided Shopee auth_url in a browser session that matches the seller's country.",
            "Let the merchant sign in and authorize your partner app.",
            "Wait for the Shopee callback to deliver auth_code and shop identifiers.",
            "Exchange the auth_code for access/refresh tokens and persist them before running product sync."
        ]
    }))
}

async fn probe_gateway_platform(
    state: &Arc<AppState>,
    platform: &str,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    let credentials = build_gateway_credentials_from_request(state, platform, request)?;
    let shop_id = credentials.shop_id.clone();
    let client = GatewayHttpClient::new(platform.to_string(), shop_id, Some(credentials));

    let valid = match client.validate_credentials().await {
        Ok(flag) => flag,
        Err(err) => {
            let error_text = err.to_string();
            if is_gateway_transport_error(&error_text) {
                return Err(ProbeError::unavailable(
                    "Gateway service unavailable for platform validation",
                    json!({
                        "error": error_text,
                        "hint": "Ensure the gateway service is running or disable options.test_connect during connect."
                    }),
                ));
            }

            return Err(ProbeError::failure(
                "Gateway validation request failed",
                json!({ "error": error_text }),
            ));
        }
    };

    if !valid {
        return Err(ProbeError::validation(format!(
            "{} credentials validation failed via gateway",
            platform
        )));
    }

    let shop_info = client.get_shop_info().await.map_err(|err| {
        let error_text = err.to_string();
        if is_gateway_transport_error(&error_text) {
            return ProbeError::unavailable(
                "Gateway service unavailable when fetching shop info",
                json!({
                    "error": error_text,
                    "hint": "Ensure the gateway service is reachable before using test_connect."
                }),
            );
        }

        ProbeError::failure(
            "Failed to retrieve shop info from gateway",
            json!({ "error": error_text }),
        )
    })?;

    let shop_value =
        serde_json::to_value(shop_info).unwrap_or_else(|_| json!({ "error": "serialization" }));

    Ok(json!({
        "note": format!("{} gateway probe executed", platform),
        "connected": true,
        "shop": shop_value
    }))
}

async fn probe_woocommerce(
    state: &Arc<AppState>,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    match &request.auth {
        AuthPayload::Basic { credentials, .. } => {
            if credentials.consumer_key.trim().is_empty()
                || credentials.consumer_secret.trim().is_empty()
            {
                return Err(ProbeError::validation(
                    "WooCommerce requires consumer key and consumer secret",
                ));
            }
        }
        _ => {
            return Err(ProbeError::validation(
                "WooCommerce requires auth.type = 'basic'",
            ))
        }
    }

    ensure_store_url(request, "WooCommerce")?;

    probe_gateway_platform(state, "woocommerce", request).await
}

async fn probe_medusa(
    state: &Arc<AppState>,
    request: &ConnectRequestV1,
) -> Result<Value, ProbeError> {
    let store_url = ensure_store_url(request, "Medusa")?;

    match &request.auth {
        AuthPayload::ApiKey { credentials, .. } => {
            if credentials.api_key.trim().is_empty() {
                return Err(ProbeError::validation(
                    "Medusa requires auth.credentials.api_key (publishable key)",
                ));
            }
        }
        _ => {
            return Err(ProbeError::validation(
                "Medusa requires auth.type = 'api_key' with a publishable key",
            ))
        }
    }

    let mut payload = probe_gateway_platform(state, "medusa", request).await?;

    if let Value::Object(ref mut map) = payload {
        map.entry("platform".to_string())
            .or_insert_with(|| Value::String("medusa".to_string()));
        map.entry("store_url".to_string())
            .or_insert_with(|| Value::String(store_url.clone()));
    }

    match build_gateway_credentials_from_request(state, "medusa", request) {
        Ok(mut creds) => {
            if creds.store_url.is_none() {
                creds.store_url = Some(store_url.clone());
            }

            let shop_id = creds.shop_id.clone();
            let client = GatewayHttpClient::new("medusa".to_string(), shop_id, Some(creds));
            let params = ListProductParams {
                page: Some(1),
                limit: Some(1),
                offset: Some(0),
                status: None,
                search: None,
                sort: None,
                shop_id: None,
            };

            match client.list_products(&params).await {
                Ok(list) => {
                    if let Value::Object(ref mut map) = payload {
                        if map.get("sample_products").is_none() {
                            if let Ok(products_json) = serde_json::to_value(list.products) {
                                map.insert("sample_products".to_string(), products_json);
                            }
                        }
                        map.entry("total_products".to_string())
                            .or_insert(Value::from(list.total));
                        map.entry("has_more".to_string())
                            .or_insert(Value::from(list.has_more));
                    }
                }
                Err(err) => {
                    warn!("Medusa probe sample product fetch failed: {}", err);
                }
            }
        }
        Err(err) => {
            warn!(
                "Failed to build Medusa gateway credentials: {}",
                err.message
            );
        }
    }

    Ok(payload)
}
