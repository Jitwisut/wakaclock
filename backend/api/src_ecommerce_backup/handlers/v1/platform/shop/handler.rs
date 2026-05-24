use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    Router,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, sync::Arc};
use tokio::time::Instant;
use tracing::{debug, error, info, warn};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    client::ecommerce::{
        bigcommerce::BigCommerceGateway, ecwid::EcwidGateway, etsy::EtsyGateway, jd::JDGateway,
        lineshopping::LineShoppingGateway, magento::MagentoGateway, medusa::MedusaGateway,
        shopify::ShopifyGateway, woocommerce::WooCommerceGateway,
    },
    config::PlatformCredentials,
    infrastructure::transport::gateway_http::GatewayHttpClient,
    interfaces::platform_gateway::{
        Credentials as GatewayCredentials, ListProductParams, PlatformGateway,
    },
    model::{
        error::{AppError, AppResult},
        v1::gateway::request::queries::ConnectQuery,
    },
    services::probe::{call_gateway_ecommerce_connect, run_probe},
    AppState,
};

/// Shop API Handler
///
/// Manages shop-related operations and platform connections.
/// This handler provides:
/// - Shop connection to e-commerce platforms
/// - Shop management operations
/// - Internal API calls to gateway services
pub struct ShopHandler {
    state: Arc<AppState>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(example = json!({
    "version": "v1",
    "org": { "org_id": "org-123", "user_id": "u-456" },
    "shop": {
        "store_url": "https://mystore.com",
        "timezone": "Asia/Bangkok",
        "region": "NA",
        "marketplace_ids": ["ATVPDKIKX0DER"]
    },
    "platform": {
        "name": "amazon_sp",
        "environment": "production",
        "endpoint": "https://sellingpartnerapi-na.amazon.com"
    },
    "auth": {
        "type": "spapi",
        "lwa": {
            "client_id": "amzn1.app-oa2-client...",
            "client_secret": "secret",
            "refresh_token": "Atzr|token",
            "grantless_scopes": ["sellingpartnerapi::notifications"]
        },
        "aws": {
            "mode": "role",
            "role_arn": "arn:aws:iam::123456789012:role/sp-role"
        },
        "rdt": {
            "enable": false,
            "resources": []
        }
    },
    "capabilities": {
        "catalog": true,
        "listings": true,
        "inventory": true,
        "orders": false,
        "pricing": true,
        "notifications": false
    },
    "options": {
        "test_connect": true,
        "rate_limit_profile": "default",
        "retry_policy": { "max_retries": 5, "backoff": "exponential_jitter" },
        "user_agent": "WhereOnSales/1.0 (platform-connector; rust)"
    },
    "metadata": {
        "labels": ["pilot"],
        "notes": "Initial connection"
    }
}))]
pub struct ConnectRequestV1 {
    pub version: String,
    pub org: OrgContext,
    pub shop: ShopContext,
    pub platform: PlatformContext,
    pub auth: AuthPayload,
    #[serde(default)]
    pub capabilities: CapabilityFlags,
    pub options: ConnectOptions,
    #[serde(default = "empty_object")]
    pub metadata: Value,
}

fn empty_object() -> Value {
    json!({})
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CallbackRequest {
    pub code: Option<String>,
    pub state: Option<String>,
    pub shop_id: Option<String>,
    pub redirect_suffix: Option<String>,
    pub error: Option<String>,
    // TikTok-specific parameters
    pub app_key: Option<String>,
    pub locale: Option<String>,
    pub shop_region: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct OrgContext {
    pub org_id: String,
    #[serde(default)]
    pub user_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Default)]
pub struct ShopContext {
    #[serde(default, alias = "storeUrl")]
    pub store_url: Option<String>,
    #[serde(default, alias = "storeId")]
    pub store_id: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub region: Option<String>,
    #[serde(default, alias = "marketplaceIds")]
    pub marketplace_ids: Option<Vec<String>>,
    #[serde(default)]
    pub seller_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PlatformContext {
    pub name: String,
    #[serde(default = "default_platform_environment")]
    pub environment: String,
    #[serde(default, alias = "endpointUrl")]
    pub endpoint: Option<String>,
}

fn default_platform_environment() -> String {
    "production".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Default)]
pub struct CapabilityFlags {
    #[serde(default)]
    pub catalog: bool,
    #[serde(default)]
    pub listings: bool,
    #[serde(default)]
    pub inventory: bool,
    #[serde(default)]
    pub orders: bool,
    #[serde(default)]
    pub pricing: bool,
    #[serde(default)]
    pub notifications: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ConnectOptions {
    #[serde(default, alias = "testConnect")]
    pub test_connect: bool,
    #[serde(default, alias = "rateLimitProfile")]
    pub rate_limit_profile: Option<String>,
    #[serde(default, alias = "retryPolicy")]
    pub retry_policy: Option<RetryPolicy>,
    #[serde(default, alias = "userAgent")]
    pub user_agent: Option<String>,
}

impl Default for ConnectOptions {
    fn default() -> Self {
        Self {
            test_connect: false,
            rate_limit_profile: None,
            retry_policy: None,
            user_agent: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Default)]
pub struct RetryPolicy {
    #[serde(default, alias = "maxRetries")]
    pub max_retries: Option<u32>,
    #[serde(default, alias = "backoffStrategy")]
    pub backoff: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AuthPayload {
    ApiKey {
        credentials: ApiKeyCredentials,
        #[serde(default)]
        webhook: Option<WebhookConfig>,
        #[serde(default)]
        signing: Option<SigningConfig>,
    },
    Basic {
        credentials: BasicCredentials,
        #[serde(default)]
        signing: Option<SigningConfig>,
    },
    Oauth2 {
        #[serde(default)]
        credentials: OAuth2Credentials,
        #[serde(default)]
        oauth_params: Option<OAuth2Params>,
        #[serde(default)]
        signing: Option<SigningConfig>,
    },
    Bearer {
        credentials: BearerCredentials,
        #[serde(default)]
        signing: Option<SigningConfig>,
    },
    Hmac {
        credentials: HmacCredentials,
        #[serde(default)]
        hmac_params: Option<HmacParams>,
        #[serde(default)]
        signing: Option<SigningConfig>,
    },
    Spapi {
        lwa: SpApiLwaCredentials,
        aws: SpApiAwsCredentials,
        #[serde(default)]
        rdt: Option<SpApiRestrictedData>,
        #[serde(default)]
        signing: Option<SigningConfig>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ApiKeyCredentials {
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WebhookConfig {
    #[serde(default)]
    pub verify_signature: bool,
    #[serde(default)]
    pub secret: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BasicCredentials {
    #[serde(alias = "username", alias = "user_name", alias = "consumerKey")]
    pub consumer_key: String,
    #[serde(
        alias = "password",
        alias = "pass",
        alias = "consumerSecret",
        alias = "consumer_secret"
    )]
    pub consumer_secret: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Default)]
pub struct OAuth2Credentials {
    #[serde(default)]
    pub client_id: String,
    #[serde(default)]
    pub client_secret: String,
    #[serde(default)]
    pub access_token: Option<String>,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Default)]
pub struct OAuth2Params {
    #[serde(default)]
    pub redirect_uri: Option<String>,
    #[serde(default)]
    pub scopes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BearerCredentials {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HmacCredentials {
    pub partner_id: i64,
    pub partner_key: String,
    pub shop_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Default)]
pub struct HmacParams {
    #[serde(default = "default_hmac_algo")]
    pub algo: String,
}

fn default_hmac_algo() -> String {
    "HMAC-SHA256".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SpApiLwaCredentials {
    pub client_id: String,
    pub client_secret: String,
    pub refresh_token: String,
    #[serde(default)]
    pub grantless_scopes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SpApiAwsCredentials {
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub role_arn: Option<String>,
    #[serde(default)]
    pub external_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, Default)]
pub struct SpApiRestrictedData {
    #[serde(default)]
    pub enable: bool,
    #[serde(default)]
    pub resources: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SigningConfig {
    #[serde(rename = "type")]
    pub signing_type: String,
    #[serde(default)]
    pub profile: Option<String>,
    #[serde(default)]
    pub secret_field: Option<String>,
    #[serde(default)]
    pub param_position: Option<String>,
    #[serde(default)]
    pub case: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(example = json!({
    "connection_id": "conn_01j5d37vf80ypc9vy25x9p7e7n",
    "platform": "amazon_sp",
    "shop_id": "shop_123",
    "org_id": "org-123",
    "status": "connected",
    "capabilities": {
        "catalog": true,
        "listings": true,
        "inventory": true,
        "orders": false,
        "pricing": true,
        "notifications": false
    },
    "verification": {
        "test_connect": true,
        "webhook_delivered": false,
        "details": {
            "latency_ms": 320,
            "note": "Amazon SP-API probe stub executed"
        }
    },
    "created_at": "2025-11-06T10:00:00Z"
}))]
pub struct ConnectionResponse {
    pub connection_id: String,
    pub platform: String,
    pub shop_id: String,
    pub org_id: String,
    pub status: String,
    pub capabilities: CapabilityFlags,
    pub verification: VerificationStatus,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct VerificationStatus {
    pub test_connect: bool,
    pub webhook_delivered: bool,
    pub details: Value,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CallbackResponse {
    pub success: bool,
    pub platform: String,
    pub shop_id: String,
    pub message: Option<String>,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ValidateCredentialsRequest {
    pub store_url: String,
    pub consumer_key: String,
    pub consumer_secret: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ValidateCredentialsResponse {
    pub success: bool,
    pub message: String,
    pub store_info: Option<Value>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct TestConnectionRequest {
    pub credentials: serde_json::Value,
    pub org_id: Option<String>,
    pub shop_id: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TestConnectionResponse {
    pub success: bool,
    pub message: String,
    pub platform: String,
    pub store_info: Option<serde_json::Value>,
}

impl ShopHandler {
    /// Create a new Shop handler instance
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// Build and return the router with all shop routes
    pub fn build(&self) -> Router<Arc<AppState>> {
        self.routes()
    }

    /// Register all shop routes
    fn routes(&self) -> Router<Arc<AppState>> {
        Router::new()
            .route(
                "/:platform_name/connect",
                axum::routing::get(get_platform_oauth_url),
            )
            .route(
                "/:shop_id/connect/:platform_name",
                axum::routing::post(connect_platform),
            )
            .route(
                "/:shop_id/connect/:platform_name/callback",
                axum::routing::get(platform_callback),
            )
            .route(
                "/:platform_name/test-connection",
                axum::routing::post(test_connection),
            )
            .with_state(self.state.clone())
    }
}

/// Connect a shop to a platform
///
/// This endpoint handles the platform connection process. For OAuth platforms,
/// it makes an internal REST API call to the gateway ecommerce connect endpoint.
/// For credential-based platforms (WooCommerce, Shopify, etc.), it validates
/// credentials and optionally tests the connection.
///
/// Path: /api/v1/platform/shop/:shop_id/connect/:platform_name
/// Query param: ?test_connect=true (optional, for credential-based platforms)
#[utoipa::path(
    get,
    path = "/platform/shop/{platform_name}/connect",
    params(
        ("platform_name" = String, Path, description = "Platform identifier (tiktok, shopee, lazada, etc.)"),
        ConnectQuery
    ),
    responses(
        (status = 200, description = "OAuth URL generated successfully", body = Value,
            example = json!({
                "auth_url": "https://oauth.tiktok.com/authorize?...",
                "state": "abc123",
                "platform": "tiktok",
                "shop_id": "shop_123"
            })
        ),
        (status = 400, description = "Invalid request parameters"),
        (status = 500, description = "Internal server error")
    ),
    tag = "shop"
)]
pub async fn get_platform_oauth_url(
    State(state): State<Arc<AppState>>,
    Path(platform_name): Path<String>,
    Query(mut query): Query<ConnectQuery>,
    headers: HeaderMap,
) -> AppResult<Json<Value>> {
    info!(
        "Generating OAuth URL for platform={} shop={} org={}",
        platform_name, query.shop_id, query.org_id
    );

    if query.user_id.is_none() {
        query.user_id = Some(query.org_id.clone());
    }

    let result = call_gateway_ecommerce_connect(&state, &platform_name, &query, &headers).await?;

    info!(
        "Generated OAuth URL for platform={} shop={} org={}",
        platform_name, query.shop_id, query.org_id
    );

    Ok(Json(result))
}

#[utoipa::path(
    post,
    path = "/shop/{shop_id}/connect/{platform_name}",
    params(
        ("shop_id" = String, Path, description = "Shop identifier"),
        ("platform_name" = String, Path, description = "Platform name (woocommerce, shopify, bigcommerce, ecwid, magento, medusa, tiktok, etc.)")
    ),
    request_body(
        content = ConnectRequestV1,
        description = "Connection parameters",
        example = json!({
            "version": "v1",
            "org": { "org_id": "org-123", "user_id": "u-456" },
            "shop": {
                "store_url": "https://mystore.com",
                "timezone": "Asia/Bangkok",
                "region": "NA"
            },
            "platform": {
                "name": "shopify",
                "environment": "production",
                "endpoint": "https://myshop.myshopify.com"
            },
            "auth": {
                "type": "oauth2",
                "credentials": {
                    "client_id": "client",
                    "client_secret": "secret",
                    "access_token": "token"
                },
                "oauth_params": {
                    "redirect_uri": "https://app/callback",
                    "scopes": ["read_products"]
                }
            },
            "capabilities": {
                "catalog": true,
                "listings": true,
                "inventory": true,
                "orders": false,
                "pricing": true,
                "notifications": true
            },
            "options": {
                "test_connect": true,
                "rate_limit_profile": "default"
            },
            "metadata": {
                "labels": ["pilot"],
                "notes": "Initial connection"
            }
        })
    ),
    responses(
        (status = 200, description = "Platform connection initiated successfully", body = ConnectionResponse,
            example = json!({
                "connection_id": "conn_01HZX...",
                "platform": "amazon_sp",
                "shop_id": "shop_123",
                "org_id": "org-123",
                "status": "connected",
                "capabilities": {
                    "catalog": true,
                    "listings": true,
                    "inventory": true,
                    "orders": false,
                    "pricing": true,
                    "notifications": false
                },
                "verification": {
                    "test_connect": true,
                    "webhook_delivered": false,
                    "details": { "latency_ms": 320 }
                },
                "created_at": "2025-11-06T10:00:00Z"
            })
        ),
        (status = 400, description = "Invalid request parameters"),
        (status = 422, description = "Verification probe failed"),
        (status = 500, description = "Internal server error")
    ),
    tag = "shop"
)]
pub async fn connect_platform(
    State(state): State<Arc<AppState>>,
    Path((shop_id, platform_name)): Path<(String, String)>,
    headers: HeaderMap,
    Json(mut request): Json<ConnectRequestV1>,
) -> AppResult<(StatusCode, Json<Value>)> {
    info!(
        "Initiating platform connection: shop_id={}, platform={}, version={}",
        shop_id, platform_name, request.version
    );

    if request.version.to_lowercase() != "v1" {
        return Err(AppError::BadRequest(format!(
            "Unsupported payload version: {}",
            request.version
        )));
    }

    let normalized_platform = platform_name.to_lowercase();
    if normalized_platform != request.platform.name.to_lowercase() {
        return Err(AppError::BadRequest(format!(
            "Platform name mismatch between path ({}) and payload ({})",
            platform_name, request.platform.name
        )));
    }

    if request.org.org_id.trim().is_empty() {
        return Err(AppError::BadRequest("org.org_id is required".to_string()));
    }

    hydrate_oauth_credentials_from_config(&state, &normalized_platform, &mut request)?;
    let org_id_clone = request.org.org_id.clone();
    hydrate_oauth_tokens_from_strapi(
        &state,
        &normalized_platform,
        &shop_id,
        &org_id_clone,
        &mut request,
    )
    .await?;

    let idempotency_key = extract_header(&headers, "x-idempotency-key");
    let request_fingerprint = compute_request_fingerprint(&shop_id, &normalized_platform, &request)
        .map_err(|err| AppError::InternalError(err.to_string()))?;
    let cache_key = build_cache_key(idempotency_key, &request_fingerprint);

    if let Some(cached) = fetch_cached_response(&state, &cache_key).await? {
        info!(
            "Duplicate connection detected for shop_id={} platform={} - returning cached response",
            shop_id, normalized_platform
        );
        let cached_value = serde_json::to_value(&cached)
            .map_err(|err| AppError::SerializationError(err.to_string()))?;
        return Ok((StatusCode::OK, Json(cached_value)));
    }

    let mut verification = VerificationStatus {
        test_connect: false,
        webhook_delivered: false,
        details: json!({ "message": "probe not requested" }),
    };

    if request.options.test_connect {
        let start = Instant::now();
        match run_probe(&state, &headers, &shop_id, &normalized_platform, &request).await {
            Ok(details) => {
                let latency_ms = start.elapsed().as_millis() as u64;
                let mut merged = details;
                if let Some(obj) = merged.as_object_mut() {
                    obj.entry("latency_ms".to_string())
                        .or_insert(Value::from(latency_ms));
                } else {
                    merged = json!({
                        "result": merged,
                        "latency_ms": latency_ms
                    });
                }
                verification.test_connect = true;
                verification.details = merged;
            }
            Err(err) => {
                let payload = json!({
                    "error": err.message,
                    "details": err.details,
                });
                return Ok((err.status, Json(payload)));
            }
        }
    }

    let connection_id = format!("conn_{}", Uuid::new_v4().simple().to_string());
    let has_manual_step = verification
        .details
        .as_object()
        .map(|details| details.contains_key("auth_url") || details.contains_key("auth_url_example"))
        .unwrap_or(false);
    let connection_status = if has_manual_step {
        "initialized"
    } else {
        "connected"
    };

    let response = ConnectionResponse {
        connection_id: connection_id.clone(),
        platform: normalized_platform.clone(),
        shop_id: shop_id.clone(),
        org_id: request.org.org_id.clone(),
        status: connection_status.to_string(),
        capabilities: request.capabilities.clone(),
        verification,
        created_at: Utc::now().to_rfc3339(),
    };

    let response_value = serde_json::to_value(&response)
        .map_err(|err| AppError::SerializationError(err.to_string()))?;

    if let Err(err) = state
        .cache
        .set_json(&cache_key, response_value.clone(), Some(300))
        .await
    {
        warn!("Failed to persist connection cache: {}", err);
    }

    info!(
        "Platform connection completed: shop_id={}, platform={}",
        shop_id, normalized_platform
    );

    if should_store_credentials(&request.auth) {
        if let Some(credentials) = platform_credentials_from_connect_request(&request) {
            if let Err(err) = save_credentials_to_strapi(
                &normalized_platform,
                &request.org.org_id,
                &shop_id,
                &credentials,
                None,
                &headers,
            )
            .await
            {
                warn!(
                    "Failed to persist non-OAuth credentials to Strapi for platform {} shop {}: {}",
                    normalized_platform, shop_id, err
                );
            } else {
                info!(
                    "Stored non-OAuth credentials to Strapi for platform {} shop {}",
                    normalized_platform, shop_id
                );
            }
        } else {
            warn!(
                "Unable to derive credential payload for platform {} shop {}; credentials were not saved",
                normalized_platform, shop_id
            );
        }
    }

    Ok((StatusCode::OK, Json(response_value)))
}

fn extract_header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn stable_hash(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    hex::encode(hasher.finalize())
}

fn compute_request_fingerprint(
    shop_id: &str,
    platform: &str,
    request: &ConnectRequestV1,
) -> Result<String, serde_json::Error> {
    let auth_bytes = serde_json::to_vec(&request.auth)?;
    let metadata_bytes = serde_json::to_vec(&request.metadata)?;
    let auth_hash = stable_hash(&String::from_utf8_lossy(&auth_bytes));
    let metadata_hash = stable_hash(&String::from_utf8_lossy(&metadata_bytes));

    let raw = format!(
        "{}:{}:{}:{}:{}",
        request.org.org_id, shop_id, platform, auth_hash, metadata_hash
    );
    Ok(raw)
}

fn build_cache_key(idempotency: Option<String>, fingerprint: &str) -> String {
    let base = match idempotency {
        Some(key) => stable_hash(&key),
        None => stable_hash(fingerprint),
    };
    format!("platform_connect:v1:{}", base)
}

fn should_store_credentials(auth: &AuthPayload) -> bool {
    !matches!(auth, AuthPayload::Oauth2 { .. })
}

fn platform_credentials_from_connect_request(
    request: &ConnectRequestV1,
) -> Option<PlatformCredentials> {
    let mut creds = PlatformCredentials::default();
    let normalized_platform = request.platform.name.to_lowercase();

    let mut store_url = request
        .shop
        .store_url
        .clone()
        .or_else(|| request.platform.endpoint.clone())
        .filter(|value| !value.trim().is_empty());

    if store_url.is_none() {
        if let Some(meta) = request.metadata.as_object() {
            if let Some(platform_meta) = meta
                .get(&normalized_platform)
                .and_then(|value| value.as_object())
            {
                if let Some(url) = platform_meta
                    .get("base_url")
                    .and_then(|value| value.as_str())
                    .filter(|value| !value.trim().is_empty())
                {
                    store_url = Some(url.to_string());
                }
            }
        }
    }

    let store_url = store_url.unwrap_or_default();

    if !store_url.is_empty() {
        creds.api_base_url = store_url.clone();
        creds.base_url = Some(store_url);
    }

    if let Some(store_id) = &request.shop.store_id {
        if !store_id.is_empty() {
            creds.store_id = Some(store_id.clone());
        }
    }

    match &request.auth {
        AuthPayload::ApiKey { credentials, .. } => {
            let api_key = credentials.api_key.trim();
            if api_key.is_empty() {
                return None;
            }
            creds.api_key = credentials.api_key.clone();
            creds.app_key = creds.api_key.clone();
            creds.app_secret = creds.api_key.clone();
            Some(creds)
        }
        AuthPayload::Basic { credentials, .. } => {
            let consumer_key = credentials.consumer_key.trim();
            let consumer_secret = credentials.consumer_secret.trim();
            if consumer_key.is_empty() || consumer_secret.is_empty() {
                return None;
            }
            creds.app_key = consumer_key.to_string();
            creds.app_secret = consumer_secret.to_string();
            // Default basic connectors treat username as API key, but Odoo/ERPNext need the secret persisted
            if normalized_platform == "odoo" || normalized_platform == "erpnext" {
                creds.api_key = consumer_secret.to_string();
            } else {
                creds.api_key = creds.app_key.clone();
            }
            Some(creds)
        }
        AuthPayload::Bearer { credentials, .. } => {
            let token = credentials.token.trim();
            if token.is_empty() {
                return None;
            }
            creds.api_key = token.to_string();
            Some(creds)
        }
        AuthPayload::Hmac { credentials, .. } => {
            let partner_key = credentials.partner_key.trim();
            if partner_key.is_empty() {
                return None;
            }
            creds.api_key = credentials.partner_id.to_string();
            creds.app_secret = partner_key.to_string();
            if let Some(shop_id) = credentials.shop_id {
                creds.store_id = Some(shop_id.to_string());
            }
            Some(creds)
        }
        AuthPayload::Spapi { lwa, .. } => {
            let client_id = lwa.client_id.trim();
            let client_secret = lwa.client_secret.trim();
            if client_id.is_empty() || client_secret.is_empty() {
                return None;
            }
            creds.api_key = client_id.to_string();
            creds.app_key = client_id.to_string();
            creds.app_secret = client_secret.to_string();
            Some(creds)
        }
        AuthPayload::Oauth2 { .. } => None,
    }
}

fn hydrate_oauth_credentials_from_config(
    state: &Arc<AppState>,
    platform: &str,
    request: &mut ConnectRequestV1,
) -> AppResult<()> {
    if let AuthPayload::Oauth2 { credentials, .. } = &mut request.auth {
        let missing_id = credentials.client_id.trim().is_empty();
        let missing_secret = credentials.client_secret.trim().is_empty();

        if !(missing_id || missing_secret) {
            return Ok(());
        }

        let platform_creds = state.config.get_platform_credentials(platform)?;
        let PlatformCredentials {
            app_key,
            app_secret,
            ..
        } = platform_creds;

        if missing_id {
            credentials.client_id = app_key;
        }

        if missing_secret {
            credentials.client_secret = app_secret;
        }

        if credentials.client_id.trim().is_empty() || credentials.client_secret.trim().is_empty() {
            return Err(AppError::BadRequest(format!(
                "OAuth2 credentials for platform '{}' are not configured",
                platform
            )));
        }
    }

    Ok(())
}

async fn hydrate_oauth_tokens_from_strapi(
    state: &Arc<AppState>,
    platform: &str,
    shop_id: &str,
    org_id: &str,
    request: &mut ConnectRequestV1,
) -> AppResult<()> {
    let credentials = match &mut request.auth {
        AuthPayload::Oauth2 { credentials, .. } => credentials,
        _ => return Ok(()),
    };

    let has_access_token = credentials
        .access_token
        .as_ref()
        .map(|token| !token.trim().is_empty())
        .unwrap_or(false);

    if has_access_token {
        return Ok(());
    }

    let strapi_url = match std::env::var("STRAPI_BACKEND_URL") {
        Ok(url) => url.trim_end_matches('/').to_string(),
        Err(_) => {
            warn!(
                "STRAPI_BACKEND_URL not configured; cannot hydrate tokens for platform {}",
                platform
            );
            return Ok(());
        }
    };

    let auth_token = state.config.auth_token.trim().to_string();
    if auth_token.is_empty() {
        warn!(
            "X_AUTH_TOKEN_SECRET not configured; cannot hydrate tokens for platform {}",
            platform
        );
        return Ok(());
    }

    #[derive(Debug, Deserialize)]
    struct StrapiTokenCacheResponse {
        data: Option<StrapiTokenCacheEntry>,
    }

    #[derive(Debug, Deserialize)]
    struct StrapiTokenCacheEntry {
        access_token: Option<String>,
        refresh_token: Option<String>,
        expires_at: Option<String>,
    }

    let endpoint = format!(
        "{}/api/shop-tokens/cache/{}/{}/{}",
        strapi_url, platform, shop_id, org_id
    );

    let client = Client::new();
    let response = client
        .get(&endpoint)
        .header("x-auth-token", auth_token)
        .send()
        .await
        .map_err(|err| {
            AppError::ExternalApiError(format!("Failed to fetch tokens from Strapi cache: {}", err))
        })?;

    let status = response.status();

    if status == StatusCode::NOT_FOUND {
        warn!(
            "No cached tokens found in Strapi for platform={} shop_id={} org_id={}",
            platform, shop_id, org_id
        );
        return Ok(());
    }

    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::ExternalApiError(format!(
            "Failed to fetch tokens from Strapi (status {}): {}",
            status, body
        )));
    }

    let payload: StrapiTokenCacheResponse = response.json().await.map_err(|err| {
        AppError::SerializationError(format!(
            "Failed to parse Strapi token cache response: {}",
            err
        ))
    })?;

    if let Some(mut entry) = payload.data {
        match entry.access_token.take() {
            Some(token) if !token.trim().is_empty() => {
                credentials.access_token = Some(token);
            }
            _ => {
                warn!(
                    "Strapi cache entry missing access_token for platform={} shop_id={} org_id={}",
                    platform, shop_id, org_id
                );
            }
        }

        let refresh_missing = credentials
            .refresh_token
            .as_ref()
            .map(|token| token.trim().is_empty())
            .unwrap_or(true);

        if refresh_missing {
            if let Some(refresh_token) = entry
                .refresh_token
                .take()
                .filter(|token| !token.trim().is_empty())
            {
                credentials.refresh_token = Some(refresh_token);
            }
        }

        if credentials.expires_at.is_none() {
            credentials.expires_at = entry.expires_at.take();
        }
    } else {
        warn!(
            "Strapi token cache response did not include data for platform={} shop_id={} org_id={}",
            platform, shop_id, org_id
        );
    }

    Ok(())
}

async fn fetch_cached_response(
    state: &Arc<AppState>,
    cache_key: &str,
) -> AppResult<Option<ConnectionResponse>> {
    let cached = state
        .cache
        .get_json(cache_key)
        .await
        .map_err(|err| AppError::InternalError(err.to_string()))?;

    if let Some(value) = cached {
        let response: ConnectionResponse = serde_json::from_value(value)
            .map_err(|err| AppError::SerializationError(err.to_string()))?;
        Ok(Some(response))
    } else {
        Ok(None)
    }
}

/// Handle OAuth callback for a shop-platform connection
///
/// This endpoint handles the OAuth callback from the e-commerce platform
/// after the user has authorized the application. It makes an internal
/// call to the gateway ecommerce callback endpoint.
///
/// Path: /api/v1/platform/shop/:shop_id/connect/:platform_name/callback
/// Internal call: /api/v1/gateway/ecommerce/:platform_name/callback
#[utoipa::path(
    get,
    path = "/shop/{shop_id}/connect/{platform_name}/callback",
    params(
        ("shop_id" = String, Path, description = "Shop identifier"),
        ("platform_name" = String, Path, description = "Platform name (tiktok, shopee, lazada, etc.)"),
        ("code" = Option<String>, Query, description = "Authorization code from OAuth provider"),
        ("state" = Option<String>, Query, description = "OAuth state parameter for CSRF protection"),
        ("error" = Option<String>, Query, description = "Error parameter if OAuth failed"),
        ("app_key" = Option<String>, Query, description = "Application key (TikTok)"),
        ("locale" = Option<String>, Query, description = "User locale (TikTok)"),
        ("shop_region" = Option<String>, Query, description = "Shop region (TikTok)")
    ),
    responses(
        (status = 200, description = "OAuth callback processed successfully", body = Value,
            example = json!({
                "success": true,
                "platform": "tiktok",
                "shop_id": "shop_123",
                "message": "OAuth tokens exchanged successfully",
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            })
        ),
        (status = 400, description = "Invalid callback data"),
        (status = 500, description = "Internal server error")
    ),
    tag = "shop"
)]
pub async fn platform_callback(
    State(state): State<Arc<AppState>>,
    Path((shop_id, platform_name)): Path<(String, String)>,
    Query(callback_params): Query<CallbackRequest>,
    headers: HeaderMap,
) -> AppResult<Json<Value>> {
    info!(
        "Processing OAuth callback: shop_id={}, platform={}, code_present={}, error={}",
        shop_id,
        platform_name,
        callback_params.code.is_some(),
        callback_params.error.as_deref().unwrap_or("none")
    );

    // Check for OAuth errors first
    if let Some(error) = &callback_params.error {
        error!("OAuth callback error: {}", error);
        return Ok(Json(serde_json::json!({
            "success": false,
            "platform": platform_name,
            "shop_id": shop_id,
            "message": format!("OAuth error: {}", error)
        })));
    }

    // Make internal REST API call to gateway ecommerce callback endpoint
    let result = call_gateway_ecommerce_callback(
        &state,
        &platform_name,
        &shop_id,
        &callback_params,
        &headers,
    )
    .await?;

    info!(
        "OAuth callback completed: shop_id={}, platform={}, success={}",
        shop_id,
        platform_name,
        result
            .get("success")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
    );

    Ok(Json(result))
}

/// Make internal REST API call to gateway ecommerce callback endpoint
async fn call_gateway_ecommerce_callback(
    _state: &Arc<AppState>,
    platform_name: &str,
    shop_id: &str,
    callback_params: &CallbackRequest,
    headers: &HeaderMap,
) -> AppResult<Value> {
    // Get the internal API base URL (same as current service)
    let base_url =
        std::env::var("INTERNAL_API_URL").unwrap_or_else(|_| "http://localhost:8080".to_string());

    // Load app_name from credentials
    let app_name = crate::helpers::app_config::load_app_name("credentials/crendential.json")
        .unwrap_or_else(|err| {
            warn!(
                "Falling back to default app name after load failure: {}",
                err
            );
            crate::helpers::app_config::DEFAULT_APP_NAME.to_string()
        });

    let gateway_url = format!(
        "{}/api/v1/{}/gateway/ecommerce/{}/callback",
        base_url, app_name, platform_name
    );

    info!("Making internal callback API call to: {}", gateway_url);

    // Create HTTP client
    let client = Client::new();

    // Build query parameters from callback request
    let mut query_params = vec![("shop_id", shop_id.to_string())];

    if let Some(code) = &callback_params.code {
        query_params.push(("code", code.clone()));
    }
    if let Some(state) = &callback_params.state {
        query_params.push(("state", state.clone()));
    }
    if let Some(error) = &callback_params.error {
        query_params.push(("error", error.clone()));
    }
    if let Some(app_key) = &callback_params.app_key {
        query_params.push(("app_key", app_key.clone()));
    }
    if let Some(locale) = &callback_params.locale {
        query_params.push(("locale", locale.clone()));
    }
    if let Some(shop_region) = &callback_params.shop_region {
        query_params.push(("shop_region", shop_region.clone()));
    }
    if let Some(redirect_suffix) = &callback_params.redirect_suffix {
        query_params.push(("redirect_suffix", redirect_suffix.clone()));
    }

    // Prepare request
    let mut request_builder = client.get(&gateway_url).query(&query_params);

    // Forward relevant headers
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

    // Execute the request
    let response = request_builder.send().await.map_err(|e| {
        error!("Failed to call gateway callback API: {}", e);
        AppError::ExternalApiError(format!("Failed to call gateway callback API: {}", e))
    })?;

    // Check response status
    let status = response.status();
    let response_text = response.text().await.map_err(|e| {
        error!("Failed to read callback response body: {}", e);
        AppError::ExternalApiError(format!("Failed to read callback response body: {}", e))
    })?;

    if !status.is_success() {
        error!(
            "Gateway callback API call failed with status {}: {}",
            status, response_text
        );
        return Err(AppError::ExternalApiError(format!(
            "Gateway callback API call failed with status {}: {}",
            status, response_text
        )));
    }

    // Parse JSON response
    let json_response: Value = serde_json::from_str(&response_text).map_err(|e| {
        error!("Failed to parse callback JSON response: {}", e);
        AppError::SerializationError(format!("Failed to parse callback JSON response: {}", e))
    })?;

    info!("Gateway callback API call successful");
    Ok(json_response)
}

/// Validate WooCommerce store credentials
///
/// This endpoint tests the WooCommerce API credentials by attempting to
/// connect to the store and fetch basic information.
#[utoipa::path(
    post,
    path = "/platform/shop/{platform_name}/validate",
    request_body = ValidateCredentialsRequest,
    responses(
        (status = 200, description = "Credentials validated successfully",
            body = ValidateCredentialsResponse,
            example = json!({
                "success": true,
                "message": "WooCommerce credentials validated successfully",
                "store_info": {
                    "name": "My Store",
                    "url": "https://mystore.com",
                    "woocommerce_version": "8.0.0",
                    "products_count": 100
                }
            })
        ),
        (status = 400, description = "Invalid credentials"),
        (status = 500, description = "Internal server error")
    ),
    tag = "shop"
)]
pub async fn validate_platform_credentials(
    State(_state): State<Arc<AppState>>,
    Path(platform_name): Path<String>,
    Json(request): Json<ValidateCredentialsRequest>,
) -> AppResult<Json<ValidateCredentialsResponse>> {
    info!("Validating credentials for store: {}", request.store_url);

    // Create WooCommerce gateway with provided credentials
    let credentials = PlatformCredentials {
        api_key: String::new(),
        app_key: request.consumer_key.clone(),
        app_secret: request.consumer_secret.clone(),
        api_base_url: request.store_url.clone(),
        redirect_uri: None,
        rate_limit_rps: 10.0,
        oauth_authorize_url: None,
        oauth_token_url: None,
        oauth_refresh_url: None,
        oauth_revoke_url: None,
        store_id: None,
        base_url: None,
        tenant_id: None,
        service_id: None,
        market: None,
    };

    match platform_name.as_str() {
        "woocommerce" => {
            let gateway = WooCommerceGateway::new(credentials);
            match gateway.test_connection().await {
                Ok(store_info) => {
                    info!("WooCommerce credentials validated successfully");
                    Ok(Json(ValidateCredentialsResponse {
                        success: true,
                        message: "WooCommerce credentials validated successfully".to_string(),
                        store_info: Some(store_info),
                    }))
                }
                Err(e) => {
                    error!("WooCommerce validation failed: {}", e);
                    Ok(Json(ValidateCredentialsResponse {
                        success: false,
                        message: format!("Validation failed: {}", e),
                        store_info: None,
                    }))
                }
            }
        }

        _ => {
            error!("Unsupported platform for validation: {}", platform_name);
            Ok(Json(ValidateCredentialsResponse {
                success: false,
                message: format!("Platform {} is not supported for validation", platform_name),
                store_info: None,
            }))
        }
    }
}

/// Test connection for credential-based platforms
///
/// Tests the connection to a platform using provided credentials
/// without saving them to the database.
///
/// # Arguments
/// * `platform_name` - The name of the platform to test
/// * `request` - JSON body containing the credentials to test
///
/// # Returns
/// * `TestConnectionResponse` with success status and store information if successful
#[utoipa::path(
    post,
    path = "/shop/{platform_name}/test-connection",
    params(

        ("platform_name" = String, Path, description = "E-commerce platform name")
    ),
    request_body = TestConnectionRequest,
    responses(
        (status = 200, description = "Connection test result", body = TestConnectionResponse),
        (status = 400, description = "Invalid platform or credentials"),
        (status = 500, description = "Internal server error")
    ),
    tag = "shop"
)]
pub async fn test_connection(
    State(_state): State<Arc<AppState>>,
    Path(platform_name): Path<String>,
    headers: HeaderMap,
    Json(request): Json<TestConnectionRequest>,
) -> Result<Json<TestConnectionResponse>, AppError> {
    info!("Testing connection for platform: {}", platform_name);

    // Map platforms to standardized names
    let platform_name = match platform_name.as_str() {
        "woocommerce" | "woo" => "woocommerce",
        "shopify" => "shopify",
        "bigcommerce" | "big" => "bigcommerce",
        "ecwid" => "ecwid",
        "magento" | "magento2" => "magento",
        "medusa" => "medusa",
        "line" | "lineshopping" | "line_shopping" => "lineshopping",
        _ => {
            return Ok(Json(TestConnectionResponse {
                success: false,
                message: format!("Unsupported platform: {}", platform_name),
                platform: platform_name,
                store_info: None,
            }));
        }
    };

    // Convert JSON credentials to PlatformCredentials with platform-specific field mapping
    let mut creds_json = request.credentials.clone();

    // Map platform-specific field names to standard PlatformCredentials fields
    if platform_name == "woocommerce" {
        // WooCommerce uses consumer_key and consumer_secret
        if let Some(consumer_key) = creds_json.get("consumer_key") {
            creds_json["app_key"] = consumer_key.clone();
        }
        if let Some(consumer_secret) = creds_json.get("consumer_secret") {
            creds_json["app_secret"] = consumer_secret.clone();
        }
        // Ensure api_key exists (required field)
        if creds_json.get("api_key").is_none() {
            creds_json["api_key"] = creds_json
                .get("consumer_key")
                .cloned()
                .unwrap_or_else(|| serde_json::Value::String("".to_string()));
        }
        // Map store_url to api_base_url if needed
        if let Some(store_url) = creds_json.get("store_url") {
            if creds_json.get("api_base_url").is_none() {
                creds_json["api_base_url"] = store_url.clone();
            }
        }
        // Set default rate_limit_rps if not provided
        if creds_json.get("rate_limit_rps").is_none() {
            creds_json["rate_limit_rps"] =
                serde_json::Value::Number(serde_json::Number::from_f64(10.0).unwrap());
        }
    } else if platform_name == "lineshopping" {
        // LINE Shopping only uses api_key, provide defaults for other required fields
        if creds_json.get("app_key").is_none() {
            creds_json["app_key"] = serde_json::Value::String("".to_string());
        }
        if creds_json.get("app_secret").is_none() {
            creds_json["app_secret"] = serde_json::Value::String("".to_string());
        }
        if creds_json.get("api_base_url").is_none() {
            creds_json["api_base_url"] = serde_json::Value::String(
                "https://developers-oaplus.line.biz/myshop/v1".to_string(),
            );
        }
        if creds_json.get("rate_limit_rps").is_none() {
            creds_json["rate_limit_rps"] =
                serde_json::Value::Number(serde_json::Number::from_f64(10.0).unwrap());
        }
    } else if platform_name == "medusa" {
        // Medusa uses email and password for JWT authentication
        // Map email to app_key and password to app_secret for authentication
        if let Some(email) = creds_json.get("email") {
            creds_json["app_key"] = email.clone();
        }
        if let Some(password) = creds_json.get("password") {
            creds_json["app_secret"] = password.clone();
        }
        // Ensure api_key exists (required field) - use email as api_key for now
        if creds_json.get("api_key").is_none() {
            creds_json["api_key"] = creds_json
                .get("email")
                .cloned()
                .unwrap_or_else(|| serde_json::Value::String("".to_string()));
        }
        // Map store_url to base_url and api_base_url if needed
        if let Some(store_url) = creds_json.get("store_url").cloned() {
            if creds_json.get("base_url").is_none() {
                creds_json["base_url"] = store_url.clone();
            }
            if creds_json.get("api_base_url").is_none() {
                creds_json["api_base_url"] = store_url;
            }
        }
        // Set default rate_limit_rps if not provided
        if creds_json.get("rate_limit_rps").is_none() {
            creds_json["rate_limit_rps"] =
                serde_json::Value::Number(serde_json::Number::from_f64(10.0).unwrap());
        }
    }

    let credentials: PlatformCredentials = match serde_json::from_value(creds_json.clone()) {
        Ok(creds) => creds,
        Err(e) => {
            return Ok(Json(TestConnectionResponse {
                success: false,
                message: format!("Invalid credentials format: {}", e),
                platform: platform_name.to_string(),
                store_info: None,
            }));
        }
    };

    // Test connection based on platform
    let test_result = match platform_name {
        "woocommerce" => {
            let gateway = WooCommerceGateway::new(credentials.clone());
            match gateway.test_connection().await {
                Ok(result) => TestConnectionResponse {
                    success: true,
                    message: "Connection successful".to_string(),
                    platform: platform_name.to_string(),
                    store_info: Some(result),
                },
                Err(e) => TestConnectionResponse {
                    success: false,
                    message: format!("Connection failed: {}", e),
                    platform: platform_name.to_string(),
                    store_info: None,
                },
            }
        }
        "shopify" => {
            let gateway = ShopifyGateway::new(credentials.clone());
            match gateway.test_connection().await {
                Ok(result) => TestConnectionResponse {
                    success: true,
                    message: "Connection successful".to_string(),
                    platform: platform_name.to_string(),
                    store_info: Some(result),
                },
                Err(e) => TestConnectionResponse {
                    success: false,
                    message: format!("Connection failed: {}", e),
                    platform: platform_name.to_string(),
                    store_info: None,
                },
            }
        }
        "bigcommerce" => {
            let gateway = BigCommerceGateway::new(credentials.clone());
            match gateway.test_connection().await {
                Ok(result) => TestConnectionResponse {
                    success: true,
                    message: "Connection successful".to_string(),
                    platform: platform_name.to_string(),
                    store_info: Some(result),
                },
                Err(e) => TestConnectionResponse {
                    success: false,
                    message: format!("Connection failed: {}", e),
                    platform: platform_name.to_string(),
                    store_info: None,
                },
            }
        }
        "ecwid" => {
            let store_id = credentials.store_id.clone().unwrap_or_default();
            let gateway = EcwidGateway::new(credentials.clone(), store_id);
            match gateway.test_connection().await {
                Ok(result) => TestConnectionResponse {
                    success: true,
                    message: "Connection successful".to_string(),
                    platform: platform_name.to_string(),
                    store_info: Some(result),
                },
                Err(e) => TestConnectionResponse {
                    success: false,
                    message: format!("Connection failed: {}", e),
                    platform: platform_name.to_string(),
                    store_info: None,
                },
            }
        }
        "magento" => {
            let base_url = credentials.base_url.clone().unwrap_or_default();
            let gateway = MagentoGateway::new(credentials.clone(), base_url);
            match gateway.test_connection().await {
                Ok(result) => TestConnectionResponse {
                    success: true,
                    message: "Connection successful".to_string(),
                    platform: platform_name.to_string(),
                    store_info: Some(result),
                },
                Err(e) => TestConnectionResponse {
                    success: false,
                    message: format!("Connection failed: {}", e),
                    platform: platform_name.to_string(),
                    store_info: None,
                },
            }
        }
        "medusa" => {
            // Convert to Medusa Credentials struct
            let mut extra = HashMap::new();
            extra.insert(
                "base_url".to_string(),
                credentials.base_url.clone().unwrap_or_default(),
            );

            let medusa_creds = GatewayCredentials {
                api_key: Some(credentials.api_key.clone()),
                api_secret: None,
                access_token: None,
                refresh_token: None,
                store_url: None,
                shop_id: None,
                additional: HashMap::new(),
                extra,
            };
            let gateway = match MedusaGateway::new(&medusa_creds) {
                Ok(g) => g,
                Err(e) => {
                    return Ok(Json(TestConnectionResponse {
                        success: false,
                        message: format!("Failed to create gateway: {}", e),
                        platform: platform_name.to_string(),
                        store_info: None,
                    }));
                }
            };
            match gateway.test_connection().await {
                Ok(result) => TestConnectionResponse {
                    success: true,
                    message: "Connection successful".to_string(),
                    platform: platform_name.to_string(),
                    store_info: Some(result),
                },
                Err(e) => TestConnectionResponse {
                    success: false,
                    message: format!("Connection failed: {}", e),
                    platform: platform_name.to_string(),
                    store_info: None,
                },
            }
        }
        "lineshopping" => {
            let gateway = LineShoppingGateway::new(credentials.clone());
            match gateway.test_connection().await {
                Ok(mut info) => {
                    if let Value::Object(ref mut map) = info {
                        map.entry("platform")
                            .or_insert_with(|| Value::String(platform_name.to_string()));
                    }
                    TestConnectionResponse {
                        success: true,
                        message: "Connection successful".to_string(),
                        platform: platform_name.to_string(),
                        store_info: Some(info),
                    }
                }
                Err(err) => TestConnectionResponse {
                    success: false,
                    message: format!("Connection failed: {}", err),
                    platform: platform_name.to_string(),
                    store_info: None,
                },
            }
        }
        _ => TestConnectionResponse {
            success: false,
            message: format!("Platform {} not yet implemented", platform_name),
            platform: platform_name.to_string(),
            store_info: None,
        },
    };

    // If test was successful, try to save credentials to Strapi
    if test_result.success {
        // Try to get org_id and shop_id from request or headers
        let org_id = request
            .org_id
            .clone()
            .or_else(|| {
                headers
                    .get("x-organization-id")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string())
            })
            .or_else(|| {
                headers
                    .get("x-org-id")
                    .and_then(|v| v.to_str().ok())
                    .map(|s| s.to_string())
            });

        let shop_id = request.shop_id.clone().or_else(|| {
            headers
                .get("x-shop-id")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string())
        });

        if let (Some(org_id), Some(shop_id)) = (org_id, shop_id) {
            // Save credentials to Strapi
            if let Err(e) = save_credentials_to_strapi(
                platform_name,
                &org_id,
                &shop_id,
                &credentials,
                test_result.store_info.as_ref(),
                &headers,
            )
            .await
            {
                error!("Failed to save credentials to Strapi: {}", e);
                // Don't fail the test response, just log the error
            } else {
                info!(
                    "Successfully saved credentials to Strapi for platform: {} shop: {}",
                    platform_name, shop_id
                );
            }
        } else {
            warn!(
                "Connection test successful but credentials not saved - missing org_id or shop_id. \
                Please provide org_id and shop_id in request body or as x-organization-id/x-org-id and x-shop-id headers"
            );
        }
    }

    Ok(Json(test_result))
}

/// Save credentials to Strapi shop-tokens endpoint
async fn save_credentials_to_strapi(
    platform: &str,
    org_id: &str,
    shop_id: &str,
    credentials: &PlatformCredentials,
    store_info: Option<&serde_json::Value>,
    headers: &HeaderMap,
) -> Result<(), AppError> {
    let strapi_url =
        std::env::var("STRAPI_BACKEND_URL").unwrap_or_else(|_| "http://localhost:1338".to_string());

    let endpoint_url = format!("{}/api/shop-tokens", strapi_url);

    info!(
        "Saving credentials to Strapi - URL: {}, platform: {}, org_id: {}, shop_id: {}",
        endpoint_url, platform, org_id, shop_id
    );

    // Build the Strapi payload based on platform type
    let strapi_payload = match platform {
        "ecwid" => {
            // For Ecwid, save the API token and store ID
            // Use api_key if available, otherwise fallback to app_secret (where Ecwid API token is stored)
            let access_token = if !credentials.api_key.is_empty() {
                credentials.api_key.clone()
            } else {
                credentials.app_secret.clone()
            };
            serde_json::json!({
                "data": {
                    "tenant_id": org_id,
                    "org_id": org_id,
                    "shop_id": shop_id,
                    "platform": platform,
                    "platform_shop_id": credentials.store_id.clone().unwrap_or_default(),
                    "access_token": access_token.clone(), // Required by Strapi
                    "credentials": {
                        "api_token": access_token,
                        "store_id": credentials.store_id.clone().unwrap_or_default(),
                        "api_base_url": credentials.api_base_url.clone(),
                    },
                    "metadata": store_info,
                    "token_status": "connected",
                    "connected_at": chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
                }
            })
        }
        "woocommerce" => {
            serde_json::json!({
                "data": {
                    "tenant_id": org_id,
                    "org_id": org_id,
                    "shop_id": shop_id,
                    "platform": platform,
                    "access_token": credentials.app_key.clone(), // Required by Strapi - use consumer_key as access_token
                    "credentials": {
                        "consumer_key": credentials.app_key.clone(),
                        "consumer_secret": credentials.app_secret.clone(),
                        "store_url": credentials.api_base_url.clone(),
                    },
                    "metadata": store_info,
                    "token_status": "connected",
                    "connected_at": chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
                }
            })
        }
        "shopify" => {
            let metadata_value = store_info.cloned();
            let expires_at_from_metadata = metadata_value
                .as_ref()
                .and_then(|meta| meta.get("expires_at"))
                .and_then(|value| value.as_str())
                .map(|value| value.to_string());

            let mut payload = serde_json::json!({
                "data": {
                    "tenant_id": org_id,
                    "org_id": org_id,
                    "shop_id": shop_id,
                    "platform": platform,
                    "access_token": credentials.api_key.clone(),
                    "credentials": {
                        "api_key": credentials.app_key.clone(),
                        "api_secret": credentials.app_secret.clone(),
                        "access_token": credentials.api_key.clone(),
                        "store_url": credentials.api_base_url.clone(),
                    },
                    "metadata": metadata_value,
                    "token_status": "connected",
                    "connected_at": chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
                }
            });

            if let Some(expires_at) = expires_at_from_metadata {
                payload["data"]["expires_at"] = Value::String(expires_at);
            }

            payload
        }
        "bigcommerce" => {
            serde_json::json!({
                "data": {
                    "tenant_id": org_id,
                    "org_id": org_id,
                    "shop_id": shop_id,
                    "platform": platform,
                    "platform_shop_id": credentials.store_id.clone().unwrap_or_default(),
                    "access_token": credentials.api_key.clone(),
                    "credentials": {
                        "access_token": credentials.api_key.clone(),
                        "store_id": credentials.store_id.clone().unwrap_or_default(),
                        "store_url": credentials.api_base_url.clone(),
                    },
                    "metadata": store_info,
                    "token_status": "connected",
                    "connected_at": chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
                }
            })
        }
        "magento" => {
            serde_json::json!({
                "data": {
                    "tenant_id": org_id,
                    "org_id": org_id,
                    "shop_id": shop_id,
                    "platform": platform,
                    "access_token": credentials.api_key.clone(),
                    "credentials": {
                        "access_token": credentials.api_key.clone(),
                        "base_url": credentials.base_url.clone().unwrap_or_default(),
                        "username": credentials.app_key.clone(),
                        "password": credentials.app_secret.clone(),
                    },
                    "metadata": store_info,
                    "token_status": "connected",
                    "connected_at": chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
                }
            })
        }
        "medusa" => {
            serde_json::json!({
                "data": {
                    "tenant_id": org_id,
                    "org_id": org_id,
                    "shop_id": shop_id,
                    "platform": platform,
                    "access_token": credentials.api_key.clone(),
                    "credentials": {
                        "api_key": credentials.api_key.clone(),
                        "base_url": credentials.base_url.clone().unwrap_or_default(),
                    },
                    "metadata": store_info,
                    "token_status": "connected",
                    "connected_at": chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
                }
            })
        }
        "lineshopping" | "line" => {
            serde_json::json!({
                "data": {
                    "tenant_id": org_id,
                    "org_id": org_id,
                    "shop_id": shop_id,
                    "platform": "lineshopping", // Normalize to lineshopping
                    "access_token": credentials.api_key.clone(), // Use API key as access token for LINE
                    "credentials": {
                        "api_key": credentials.api_key.clone(),
                    },
                    "metadata": store_info,
                    "token_status": "connected",
                    "connected_at": chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
                }
            })
        }
        _ => {
            // For any other platform, save with generic structure
            warn!(
                "Saving credentials for platform {} using generic structure",
                platform
            );
            let access_token = if !credentials.api_key.is_empty() {
                credentials.api_key.clone()
            } else if !credentials.app_secret.is_empty() {
                credentials.app_secret.clone()
            } else {
                credentials.app_key.clone()
            };
            serde_json::json!({
                "data": {
                    "tenant_id": org_id,
                    "org_id": org_id,
                    "shop_id": shop_id,
                    "platform": platform,
                    "platform_shop_id": credentials.store_id.clone().unwrap_or_default(),
                    "access_token": access_token,
                    "credentials": {
                        "api_key": credentials.api_key.clone(),
                        "app_key": credentials.app_key.clone(),
                        "app_secret": credentials.app_secret.clone(),
                        "api_base_url": credentials.api_base_url.clone(),
                    },
                    "metadata": store_info,
                    "token_status": "connected",
                    "connected_at": chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
                }
            })
        }
    };

    // Log the payload being sent
    debug!(
        "Strapi payload: {}",
        serde_json::to_string_pretty(&strapi_payload).unwrap_or_default()
    );

    // Send to Strapi
    let client = Client::new();
    let mut request_builder = client.post(&endpoint_url).json(&strapi_payload);

    // Forward auth headers to Strapi if present
    if let Some(auth_header) = headers.get("authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            request_builder = request_builder.header("authorization", auth_str);
        }
    }

    if let Some(x_auth_token) = headers.get("x-auth-token") {
        if let Ok(token_str) = x_auth_token.to_str() {
            request_builder = request_builder.header("x-auth-token", token_str);
        }
    }

    info!("Sending POST request to Strapi at: {}", endpoint_url);

    let response = request_builder.send().await.map_err(|e| {
        error!(
            "Failed to send request to Strapi at {}: {}",
            endpoint_url, e
        );
        AppError::ExternalApiError(format!("Failed to connect to Strapi: {}", e))
    })?;

    if response.status().is_success() {
        let response_text = response.text().await.unwrap_or_default();
        info!(
            "Successfully stored credentials in Strapi for shop: {}, response: {}",
            shop_id, response_text
        );
        Ok(())
    } else {
        let status = response.status();
        let response_text = response.text().await.unwrap_or_default();
        error!(
            "Strapi credential storage failed (HTTP {}). Response: {}",
            status, response_text
        );
        Err(AppError::ExternalApiError(format!(
            "Failed to save credentials to Strapi (HTTP {}): {}",
            status, response_text
        )))
    }
}
