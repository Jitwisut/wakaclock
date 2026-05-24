/// ไฟล์ handler.rs - OAuth Callback Handler สำหรับ E-commerce Platforms
/// จัดการ OAuth callback จากแต่ละ platform หลังจากผู้ใช้ authorize แอพพลิเคชัน
/// รองรับหลาย platforms: TikTok, Shopee, Lazada, Shopify, etc.
use axum::{
    extract::{Form, Path, Query, State},
    response::Redirect,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};

use std::sync::Arc;

use crate::{
    client::ecommerce::{
        bigcommerce::BigCommerceGateway, shopify::ShopifyGateway, wix::WixGateway,
        zoho::ZohoGateway,
    },
    model::error::AppError,
    AppState,
};

/// OAuth callback request
/// โครงสร้างข้อมูลที่ได้รับจาก OAuth provider เมื่อ redirect กลับมา
/// รองรับ parameters จากหลาย platforms ที่อาจแตกต่างกัน
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct CallbackRequest {
    pub code: String,                    // Authorization code สำหรับแลกเป็น access token
    pub state: Option<String>,           // State parameter สำหรับป้องกัน CSRF attacks
    pub shop_id: Option<String>,         // Shop ID จาก platform (บาง platform ส่งมาใน callback)
    pub shop: Option<String>,            // Shopify shop domain (shopify-specific)
    pub hmac: Option<String>,            // Shopify HMAC signature
    pub host: Option<String>,            // Shopify host parameter
    pub timestamp: Option<String>,       // Shopify timestamp parameter
    pub redirect_suffix: Option<String>, // Path suffix สำหรับ platforms ที่ encode data ใน URL
    pub error: Option<String>,           // Error message ถ้า authorization ล้มเหลว
    // TikTok-specific parameters
    // Parameters เฉพาะของ TikTok Shop
    pub app_key: Option<String>,     // Application key ของ TikTok
    pub locale: Option<String>,      // ภาษา/locale ของผู้ใช้
    pub shop_region: Option<String>, // ภูมิภาคของร้านค้า
    // Tenant info fields (for platforms like Shopee that pass via path params)
    pub org_id: Option<String>, // Organization ID (passed via path for Shopee)
    pub user_id: Option<String>, // User ID (passed via path for Shopee)
    pub tenant_id: Option<String>, // Alias for org_id (for compatibility)
    #[serde(rename = "accounts-server")]
    pub accounts_server: Option<String>, // Zoho accounts server URL for multi-DC
    pub location: Option<String>, // Zoho DC location code (us, eu, in, etc.)
    #[serde(rename = "instanceId")]
    pub instance_id: Option<String>, // Wix meta site / instance id
    pub context: Option<String>, // BigCommerce context (stores/{hash})
    pub scope: Option<String>,  // OAuth scopes
    #[serde(rename = "account_uuid")]
    pub account_uuid: Option<String>, // BigCommerce account UUID
}

#[derive(Debug, Deserialize)]
pub struct BigCommerceCallbackInput {
    pub code: Option<String>,
    pub state: Option<String>,
    pub scope: Option<String>,
    pub context: Option<String>,
    pub account_uuid: Option<String>,
}

fn resolve_zoho_accounts_server(location: &str) -> Option<String> {
    match location.to_lowercase().as_str() {
        "us" | "com" => Some("https://accounts.zoho.com".to_string()),
        "eu" => Some("https://accounts.zoho.eu".to_string()),
        "in" => Some("https://accounts.zoho.in".to_string()),
        "au" => Some("https://accounts.zoho.com.au".to_string()),
        "jp" => Some("https://accounts.zoho.jp".to_string()),
        "cn" => Some("https://accounts.zoho.com.cn".to_string()),
        _ => None,
    }
}

/// OAuth callback response
/// โครงสร้างข้อมูล response ที่ส่งกลับหลังจากประมวลผล callback
#[derive(Debug, Serialize)]
pub struct CallbackResponse {
    pub success: bool,           // สถานะการประมวลผล callback
    pub shop_id: String,         // Shop ID ที่ได้จากการ authorize
    pub platform: String,        // ชื่อ platform (tiktok, shopee, etc.)
    pub message: Option<String>, // ข้อความเพิ่มเติม (error หรือ success message)
}

/// Callback Handler - จัดการ OAuth callbacks
/// ประมวลผล authorization code และแลกเป็น access token
pub struct CallbackHandler {
    state: Arc<AppState>, // Application state พร้อม dependencies
}

impl CallbackHandler {
    /// Create a new Ecommerce handler instance
    /// สร้าง handler instance ใหม่พร้อม application state
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// Build and return the router with all ecommerce routes
    /// สร้าง router พร้อม routes ทั้งหมดสำหรับ callback handling
    pub fn build(&self) -> Router<Arc<AppState>> {
        self.routes()
    }

    /// Register all ecommerce platform routes
    /// ลงทะเบียน routes สำหรับจัดการ OAuth callbacks
    fn routes(&self) -> Router<Arc<AppState>> {
        Router::new()
            .route("/", get(callback))
            .route("/:org_id/:user_id", get(callback_with_tenant))
            .with_state(self.state.clone())
    }
}

/// Handle OAuth callback for a platform
/// จัดการ OAuth callback จาก e-commerce platforms
///
/// This handler processes the OAuth callback from the e-commerce platform
/// after the user has authorized the application.
///
/// ขั้นตอนการทำงาน:
/// 1. รับ authorization code จาก query parameters
/// 2. ตรวจสอบ state parameter สำหรับ CSRF protection
/// 3. แลก authorization code เป็น access token
/// 4. บันทึก token และข้อมูลร้านค้า
/// 5. Redirect ไปยัง frontend พร้อมผลลัพธ์
#[utoipa::path(
    get,
    path = "/ecommerce/{platform}/callback",
    params(
        ("platform" = String, Path, description = "E-commerce platform identifier"),
        ("code" = String, Query, description = "Authorization code from OAuth provider"),
        ("state" = Option<String>, Query, description = "OAuth state parameter for CSRF protection"),
        ("shop_id" = Option<String>, Query, description = "Shop identifier"),
        ("app_key" = Option<String>, Query, description = "Application key (TikTok)"),
        ("locale" = Option<String>, Query, description = "User locale (TikTok)"),
        ("shop_region" = Option<String>, Query, description = "Shop region (TikTok)")
    ),
    responses(
        (status = 200, description = "OAuth callback processed successfully"),
        (status = 400, description = "Invalid callback data"),
        (status = 500, description = "Internal server error")
    ),
    tag = "ecommerce"
)]
pub async fn callback(
    State(state): State<Arc<AppState>>,
    Path(platform): Path<String>,
    Query(request): Query<CallbackRequest>,
) -> Result<Redirect, AppError> {
    handle_callback(state, platform, request).await
}

pub async fn callback_with_tenant(
    State(state): State<Arc<AppState>>,
    Path((platform, first_segment, second_segment)): Path<(String, String, String)>,
    Query(mut request): Query<CallbackRequest>,
) -> Result<Redirect, AppError> {
    let looks_like_internal_shop = |value: &str| value.starts_with("S-");

    let mut resolved_org = first_segment.clone();
    let mut resolved_user = second_segment.clone();
    let mut resolved_shop = request.shop_id.clone();

    if looks_like_internal_shop(&first_segment) && !looks_like_internal_shop(&second_segment) {
        // Preferred sandbox format: /callback/{internal_shop_id}/{org_id}
        resolved_shop = Some(first_segment.clone());
        resolved_org = second_segment.clone();
        resolved_user = second_segment.clone();
    } else if looks_like_internal_shop(&second_segment) && !looks_like_internal_shop(&first_segment)
    {
        // Legacy format where org_id is first and shop_id second
        resolved_shop = Some(second_segment.clone());
        resolved_org = first_segment.clone();
        resolved_user = first_segment.clone();
    } else if resolved_shop.is_none() && looks_like_internal_shop(&second_segment) {
        resolved_shop = Some(second_segment.clone());
    }

    request.org_id = Some(resolved_org.clone());
    request.tenant_id = Some(resolved_org.clone());
    request.user_id = Some(resolved_user.clone());

    if let Some(shop_id) = resolved_shop.clone() {
        request.shop_id = Some(shop_id);
    }

    tracing::info!(
        "Callback with tenant info - platform: {}, org_id: {}, internal_shop_id: {:?}",
        platform,
        request.org_id.as_deref().unwrap_or_default(),
        request.shop_id
    );

    handle_callback(state, platform, request).await
}

pub async fn bigcommerce_auth_get(
    State(state): State<Arc<AppState>>,
    Query(payload): Query<BigCommerceCallbackInput>,
) -> Result<Redirect, AppError> {
    process_bigcommerce_callback(state, payload).await
}

pub async fn bigcommerce_auth_post(
    State(state): State<Arc<AppState>>,
    Form(payload): Form<BigCommerceCallbackInput>,
) -> Result<Redirect, AppError> {
    process_bigcommerce_callback(state, payload).await
}

async fn process_bigcommerce_callback(
    state: Arc<AppState>,
    payload: BigCommerceCallbackInput,
) -> Result<Redirect, AppError> {
    let code = payload.code.ok_or_else(|| {
        AppError::BadRequest("BigCommerce callback missing 'code' parameter".to_string())
    })?;
    let context = payload.context.clone().ok_or_else(|| {
        AppError::BadRequest("BigCommerce callback missing 'context' parameter".to_string())
    })?;

    tracing::info!(
        "Handling BigCommerce callback via /auth (scope: {:?}, context: {:?})",
        payload.scope,
        payload.context
    );

    let request = build_minimal_callback_request(
        code,
        payload.state,
        Some(context),
        payload.scope,
        payload.account_uuid,
    );
    handle_callback(state, "bigcommerce".to_string(), request).await
}

fn build_minimal_callback_request(
    code: String,
    state: Option<String>,
    context: Option<String>,
    scope: Option<String>,
    account_uuid: Option<String>,
) -> CallbackRequest {
    CallbackRequest {
        code,
        state,
        shop_id: None,
        shop: None,
        hmac: None,
        host: None,
        timestamp: None,
        redirect_suffix: None,
        error: None,
        app_key: None,
        locale: None,
        shop_region: None,
        org_id: None,
        user_id: None,
        tenant_id: None,
        accounts_server: None,
        location: None,
        instance_id: None,
        context,
        scope,
        account_uuid,
    }
}

fn extract_store_hash(context: &str) -> String {
    context
        .trim()
        .trim_start_matches("stores/")
        .split('/')
        .next()
        .unwrap_or(context)
        .to_string()
}

async fn handle_callback(
    state: Arc<AppState>,
    platform: String,
    request: CallbackRequest,
) -> Result<Redirect, AppError> {
    let request = request;
    // Get frontend URL from environment or use default
    let frontend_url = std::env::var("FRONTEND_URL")
        .unwrap_or_else(|_| "https://app.lodashventure.local".to_string());

    // Check for errors first
    if let Some(error) = &request.error {
        let redirect_url = format!(
            "{}/dashboard/connect/{}/callback?status=error&error={}",
            frontend_url,
            platform.to_lowercase(),
            urlencoding::encode(error)
        );
        return Ok(Redirect::to(&redirect_url));
    }

    // Validate OAuth state and retrieve stored context
    let mut state_shop_domain: Option<String> = None;
    let (stored_shop_id, stored_org_id, _stored_user_id) = if let Some(state_token) = &request.state
    {
        // For platforms that encode context in base64 (TikTok, Lazada, Alibaba)
        if platform == "tiktok"
            || platform == "lazada"
            || platform == "alibaba"
            || platform == "aliexpress"
            || platform == "shopify"
            || platform == "wix"
        {
            // Decode base64 state to get context
            use base64::{engine::general_purpose, Engine as _};
            let decoded = general_purpose::STANDARD
                .decode(state_token)
                .map_err(|e| AppError::BadRequest(format!("Invalid state encoding: {}", e)))?;
            let context_str = String::from_utf8(decoded)
                .map_err(|e| AppError::BadRequest(format!("Invalid state format: {}", e)))?;
            let context: serde_json::Value = serde_json::from_str(&context_str)
                .map_err(|e| AppError::BadRequest(format!("Invalid state JSON: {}", e)))?;

            // Extract context values
            let tenant_id = context
                .get("tenant_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let shop_id = context
                .get("shop_id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();

            let shop_domain = context
                .get("shop_domain")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            if let Some(domain) = &shop_domain {
                state_shop_domain = Some(domain.clone());
            }

            // Log the extracted values for debugging
            tracing::info!(
                "{} OAuth state decoded - shop_id: '{}', tenant_id: '{}', shop_domain: {:?}, full_context: {}",
                platform,
                shop_id,
                tenant_id,
                shop_domain,
                serde_json::to_string_pretty(&context).unwrap_or_default()
            );

            // Also validate with Redis if state UUID is included
            if let Some(state_uuid) = context.get("state").and_then(|v| v.as_str()) {
                let oauth_state_service = &state.oauth_state_service;
                if let Ok(Some(_oauth_state)) = oauth_state_service.get(state_uuid).await {
                    // Clean up the used state
                    let _ = oauth_state_service.delete(state_uuid).await;
                }
            }

            (shop_id, tenant_id.clone(), tenant_id)
        } else if platform == "shopee" {
            match serde_json::from_str::<serde_json::Value>(state_token) {
                Ok(context) => {
                    let org_id = context
                        .get("org_id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let shop_id = context
                        .get("shop_id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let user_id = context
                        .get("user_id")
                        .and_then(|v| v.as_str())
                        .unwrap_or(&org_id)
                        .to_string();

                    tracing::info!(
                        "Shopee OAuth state decoded - shop_id: '{}', org_id: '{}', user_id: '{}'",
                        shop_id,
                        org_id,
                        user_id
                    );

                    (shop_id, org_id, user_id)
                }
                Err(err) => {
                    tracing::warn!(
                        "Shopee state '{}' was not JSON ({}); falling back to legacy state storage",
                        state_token,
                        err
                    );

                    let oauth_state_service = &state.oauth_state_service;
                    let oauth_state = oauth_state_service.get(state_token).await.map_err(|e| {
                        AppError::DatabaseError(format!("Failed to retrieve OAuth state: {}", e))
                    })?;

                    if let Some(oauth_state) = oauth_state {
                        let shop_id = oauth_state.shop_id.clone();
                        let org_id = oauth_state.org_id.clone();
                        let user_id = org_id.clone();

                        oauth_state_service.delete(state_token).await.map_err(|e| {
                            AppError::DatabaseError(format!("Failed to delete OAuth state: {}", e))
                        })?;

                        (shop_id, org_id, user_id)
                    } else {
                        (String::new(), String::new(), String::new())
                    }
                }
            }
        } else {
            // For other platforms, use Redis-stored state
            let oauth_state_service = &state.oauth_state_service;
            let oauth_state = oauth_state_service.get(state_token).await.map_err(|e| {
                AppError::DatabaseError(format!("Failed to retrieve OAuth state: {}", e))
            })?;

            if let Some(oauth_state) = oauth_state {
                // Extract the stored values before cleaning up
                let shop_id = oauth_state.shop_id.clone();
                let org_id = oauth_state.org_id.clone();
                // For now, we don't have user_id in OAuth state, so we'll use org_id as a placeholder
                let user_id = org_id.clone();

                // Clean up the used state
                oauth_state_service.delete(state_token).await.map_err(|e| {
                    AppError::DatabaseError(format!("Failed to delete OAuth state: {}", e))
                })?;

                (shop_id, org_id, user_id)
            } else {
                let redirect_url = format!(
                    "{}/dashboard/connect/{}/callback?status=error&error=Invalid%20OAuth%20state",
                    frontend_url,
                    platform.to_lowercase()
                );
                return Ok(Redirect::to(&redirect_url));
            }
        }
    } else {
        // For Shopee and other platforms that don't return state parameter
        if platform == "shopee" {
            // Extract org_id and shop_id from the request
            // The preferred path is: /api/v1/.../callback/{shop_id}/{org_id}
            // org_id and shop_id are passed in the URL path

            tracing::info!(
                "Shopee callback - request.org_id: {:?}, request.tenant_id: {:?}, request.user_id: {:?}, request.shop_id: {:?}",
                request.org_id,
                request.tenant_id,
                request.user_id,
                request.shop_id
            );

            // Check if org_id was passed as query parameters (from path extraction)
            let org_id = request
                .org_id
                .clone()
                .or_else(|| request.tenant_id.clone())
                .unwrap_or_else(|| {
                    // Fallback to environment variable if not provided
                    let default = std::env::var("DEFAULT_ORG_ID")
                        .unwrap_or_else(|_| "org-default".to_string());
                    tracing::warn!("No org_id in request, using DEFAULT_ORG_ID: {}", default);
                    default
                });

            let shop_id_from_path = request
                .shop_id
                .clone()
                .or_else(|| {
                    request
                        .user_id
                        .as_ref()
                        .filter(|value| value.starts_with("S-"))
                        .cloned()
                })
                .unwrap_or_else(|| {
                    tracing::warn!(
                        "Shopee callback missing internal shop_id, falling back to empty value"
                    );
                    String::new()
                });

            // User ID should be extracted differently, not from the shop_id
            let user_id = org_id.clone(); // For now, use org_id as user_id placeholder

            tracing::info!(
                "Shopee OAuth callback - final values: org_id: {}, user_id: {}, shop_id: {}",
                org_id,
                user_id,
                shop_id_from_path
            );

            (shop_id_from_path, org_id, user_id)
        } else {
            // If no state provided and not Shopee, use defaults
            (String::new(), String::new(), String::new())
        }
    };

    // Get platform credentials
    let platform_creds = state
        .config
        .get_platform_credentials(&platform)
        .map_err(|_| AppError::BadRequest(format!("Platform '{}' is not configured", platform)))?;

    // Exchange authorization code for access token based on platform
    let token_result = match platform.as_str() {
        "tiktok" => {
            let gateway =
                crate::client::ecommerce::tiktok::TikTokGateway::new(platform_creds.clone());
            gateway
                .exchange_code_for_tokens_detailed(&request.code)
                .await
                .map(|(access_token, refresh_token, data)| {
                    serde_json::json!({
                        "access_token": access_token,
                        "refresh_token": refresh_token,
                        "expires_in": data.access_token_expire_in,
                        "open_id": data.open_id,
                        "seller_name": data.seller_name
                    })
                })
        }
        "bigcommerce" => {
            let context = request.context.clone().ok_or_else(|| {
                AppError::BadRequest(
                    "BigCommerce callback missing context. Please include 'context=stores/{store_hash}'"
                        .to_string(),
                )
            })?;
            let gateway = BigCommerceGateway::new(platform_creds.clone());
            gateway
                .exchange_code_for_token(&request.code, &context)
                .await
                .map(|token_response| {
                    let store_hash = extract_store_hash(&token_response.context);
                    serde_json::json!({
                        "access_token": token_response.access_token,
                        "refresh_token": "",
                        "expires_in": 0,
                        "scope": token_response.scope,
                        "context": token_response.context,
                        "account_uuid": token_response.account_uuid,
                        "user": token_response.user,
                        "store_hash": store_hash,
                        "shop_id": store_hash,
                    })
                })
        }
        "shopee" => {
            let gateway =
                crate::client::ecommerce::shopee::ShopeeGateway::new(platform_creds.clone());
            // Parse shop_id from the query parameter
            let shop_id = request.shop_id.as_ref().and_then(|s| s.parse::<i64>().ok());

            tracing::info!("Shopee callback - shop_id from request: {:?}", shop_id);

            // Exchange code for tokens
            match gateway
                .exchange_code_for_token_with_shop_id(&request.code, shop_id)
                .await
            {
                Ok((access_token, refresh_token, expires_in)) => {
                    // Now fetch shop information using the access token
                    let shop_info_result = gateway.get_shop_info(&access_token).await;

                    let (actual_shop_id, seller_name, seller_id) = if let Ok(shop_info_json) =
                        shop_info_result
                    {
                        tracing::info!(
                            "Shopee shop info response: {}",
                            serde_json::to_string_pretty(&shop_info_json).unwrap_or_default()
                        );

                        // Extract shop details from the response
                        let shop_data = shop_info_json
                            .get("response")
                            .or_else(|| shop_info_json.get("shop_list"))
                            .and_then(|v| {
                                // Check if it's an array (shop_list) or object (single shop)
                                if let Some(arr) = v.as_array() {
                                    arr.first()
                                } else {
                                    Some(v)
                                }
                            });

                        let shop_id = shop_data
                            .and_then(|s| s.get("shop_id"))
                            .and_then(|v| v.as_i64())
                            .unwrap_or(shop_id.unwrap_or(0));

                        let shop_name = shop_data
                            .and_then(|s| s.get("shop_name"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                            .unwrap_or_default();

                        let seller_id = shop_data
                            .and_then(|s| s.get("seller_id"))
                            .and_then(|v| v.as_i64())
                            .map(|id| id.to_string());

                        (shop_id, shop_name, seller_id)
                    } else {
                        tracing::warn!("Failed to fetch Shopee shop info, using default values");
                        (shop_id.unwrap_or(0), String::new(), None)
                    };

                    Ok(serde_json::json!({
                        "access_token": access_token,
                        "refresh_token": refresh_token,
                        "expires_in": expires_in,
                        "shop_id": actual_shop_id,
                        "seller_name": seller_name,
                        "seller_id": seller_id
                    }))
                }
                Err(e) => Err(e),
            }
        }
        "shopify" => {
            let shop_domain_candidate = request
                .shop
                .clone()
                .or_else(|| state_shop_domain.clone())
                .or_else(|| request.shop_id.clone());

            let shop_domain = shop_domain_candidate.ok_or_else(|| {
                AppError::BadRequest(
                    "Shopify callback missing shop domain. Expected 'shop' query parameter."
                        .to_string(),
                )
            })?;

            let normalized_domain = ShopifyGateway::normalize_shop_domain(&shop_domain)?;

            // Update state_shop_domain if it was empty
            if state_shop_domain.is_none() {
                state_shop_domain = Some(normalized_domain.clone());
            }

            let gateway = ShopifyGateway::with_shop_domain(
                platform_creds.clone(),
                frontend_url.clone(),
                normalized_domain.clone(),
            );

            match gateway.exchange_code_for_tokens(&request.code, "").await {
                Ok((access_token, refresh_token)) => Ok(serde_json::json!({
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "shop_domain": normalized_domain
                })),
                Err(e) => Err(e),
            }
        }
        "lazada" => {
            let gateway =
                crate::client::ecommerce::lazada::LazadaGateway::new(platform_creds.clone());
            gateway
                .exchange_code_for_tokens_detailed(&request.code)
                .await
                .map(|(_access_token, _refresh_token, data)| {
                    // The data already contains all the necessary fields
                    data
                })
        }
        "alibaba" => {
            let gateway =
                crate::client::ecommerce::alibaba::AlibabaGateway::new(platform_creds.clone());
            gateway
                .exchange_code_for_tokens_detailed(&request.code)
                .await
                .map(|(_access_token, _refresh_token, data)| {
                    // The data already contains all the necessary fields
                    data
                })
        }
        "aliexpress" => {
            let gateway = crate::client::ecommerce::aliexpress::AliExpressGateway::new(
                platform_creds.clone(),
            );
            gateway
                .exchange_code_for_tokens_detailed(&request.code)
                .await
        }
        "zoho" => {
            let tenant_id = if !stored_org_id.is_empty() {
                stored_org_id.clone()
            } else {
                platform_creds
                    .tenant_id
                    .clone()
                    .unwrap_or_else(|| String::new())
            };

            if tenant_id.is_empty() {
                return Err(AppError::BadRequest(
                    "Zoho callback requires org_id or configured tenant_id".to_string(),
                ));
            }

            let accounts_server_override = request.accounts_server.clone().or_else(|| {
                request
                    .location
                    .as_deref()
                    .and_then(resolve_zoho_accounts_server)
            });

            let gateway = ZohoGateway::new(platform_creds.clone(), tenant_id.clone());
            gateway
                .exchange_code_for_token_with_server(
                    &request.code,
                    accounts_server_override.as_deref(),
                )
                .await
                .map(|(access_token, refresh_token, expires_in)| {
                    serde_json::json!({
                        "access_token": access_token,
                        "refresh_token": refresh_token,
                        "expires_in": expires_in,
                        "organization_id": tenant_id,
                        "api_domain": platform_creds.api_base_url.clone(),
                        "accounts_server": accounts_server_override,
                        "location": request.location.clone()
                    })
                })
        }
        "wix" => {
            let instance_id = request.instance_id.clone();
            let shop_identifier = state_shop_domain
                .clone()
                .or_else(|| request.shop.clone())
                .or_else(|| instance_id.clone())
                .or_else(|| request.shop_id.clone())
                .or_else(|| {
                    if stored_shop_id.is_empty() {
                        None
                    } else {
                        Some(stored_shop_id.clone())
                    }
                })
                .unwrap_or_else(String::new);

            let gateway = WixGateway::new(platform_creds.clone());
            gateway.exchange_code_for_token(&request.code).await.map(
                move |(access_token, refresh_token, expires_in)| {
                    serde_json::json!({
                        "access_token": access_token,
                        "refresh_token": refresh_token,
                        "expires_in": expires_in,
                        "shop_domain": shop_identifier,
                        "instance_id": instance_id,
                    })
                },
            )
        }
        _ => {
            let redirect_url = format!(
                "{}/dashboard/connect/{}/callback?status=error&error=Platform%20OAuth%20not%20implemented",
                frontend_url,
                platform.to_lowercase()
            );
            return Ok(Redirect::to(&redirect_url));
        }
    };

    match token_result {
        Ok(tokens) => {
            // Extract platform shop_id from the token response or request
            let platform_shop_id = if platform == "shopee" {
                tokens
                    .get("shop_id")
                    .and_then(|v| {
                        if let Some(num) = v.as_i64() {
                            Some(num.to_string())
                        } else {
                            v.as_str().map(|s| s.to_string())
                        }
                    })
                    .or_else(|| request.shop_id.clone())
                    .unwrap_or_default()
            } else if platform == "bigcommerce" {
                tokens
                    .get("store_hash")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or_else(|| {
                        request
                            .context
                            .as_deref()
                            .map(|ctx| extract_store_hash(ctx))
                    })
                    .unwrap_or_default()
            } else if platform == "aliexpress" {
                tokens
                    .get("seller_id")
                    .and_then(|v| {
                        if let Some(s) = v.as_str() {
                            Some(s.to_string())
                        } else {
                            v.as_i64().map(|num| num.to_string())
                        }
                    })
                    .or_else(|| request.shop_id.clone())
                    .unwrap_or_default()
            } else if platform == "wix" {
                tokens
                    .get("instance_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or_else(|| {
                        tokens
                            .get("shop_domain")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                    })
                    .or_else(|| request.instance_id.clone())
                    .or_else(|| request.shop.clone())
                    .or_else(|| state_shop_domain.clone())
                    .or_else(|| request.shop_id.clone())
                    .unwrap_or_default()
            } else if platform == "shopify" {
                tokens
                    .get("shop_domain")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or_else(|| state_shop_domain.clone())
                    .or_else(|| request.shop.clone())
                    .unwrap_or_default()
            } else {
                // For other platforms, use shop_id from request or token response
                tokens
                    .get("shop_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or_else(|| request.shop_id.clone())
                    .unwrap_or_default()
            };

            // Determine the shop_id to use
            let wos_shop_id = if platform == "tiktok"
                || platform == "lazada"
                || platform == "alibaba"
                || platform == "aliexpress"
            {
                // For TikTok, Lazada, and Alibaba, MUST use the shop_id from the OAuth state
                if stored_shop_id.is_empty() {
                    // This is an error condition - these platforms MUST have shop_id in state
                    tracing::error!(
                        "CRITICAL: {} callback missing shop_id in OAuth state! State contained: {:?}",
                        platform,
                        request.state
                    );
                    let redirect_url = format!(
                        "{}/dashboard/connect/{}/callback?status=error&error=Missing%20shop%20ID%20in%20OAuth%20state",
                        frontend_url,
                        platform.to_lowercase()
                    );
                    return Ok(Redirect::to(&redirect_url));
                }
                tracing::info!(
                    "{} callback using shop_id from OAuth state: {}",
                    platform,
                    stored_shop_id
                );
                stored_shop_id.clone()
            } else if platform == "shopee" {
                // For Shopee, MUST use the shop_id from stored_shop_id (extracted earlier)
                // stored_shop_id was already extracted from the path or request
                if !stored_shop_id.is_empty() {
                    tracing::info!("Shopee callback using shop_id: {}", stored_shop_id);
                    stored_shop_id.clone()
                } else {
                    // This is an error - Shopee MUST have shop_id
                    tracing::error!(
                        "CRITICAL: Shopee callback missing shop_id! Check path parameters."
                    );
                    let redirect_url = format!(
                        "{}/dashboard/connect/{}/callback?status=error&error=Missing%20shop%20ID",
                        frontend_url,
                        platform.to_lowercase()
                    );
                    return Ok(Redirect::to(&redirect_url));
                }
            } else if platform == "shopify" || platform == "wix" {
                if !stored_shop_id.is_empty() {
                    stored_shop_id.clone()
                } else if !platform_shop_id.is_empty() {
                    platform_shop_id.clone()
                } else {
                    let now = chrono::Utc::now();
                    format!("S-{}", now.format("%Y%m%d"))
                }
            } else {
                // For other platforms, generate new shop_id or use from state
                if !stored_shop_id.is_empty() {
                    stored_shop_id.clone()
                } else {
                    let now = chrono::Utc::now();
                    format!("S-{}", now.format("%Y%m%d"))
                }
            };

            // Forward tokens to Strapi for storage
            {
                let strapi_url = std::env::var("STRAPI_BACKEND_URL")
                    .unwrap_or_else(|_| "http://localhost:1338".to_string());

                // Extract token data for Strapi storage
                let token_data = tokens.as_object().ok_or_else(|| {
                    AppError::InternalError("Invalid token response format".to_string())
                })?;

                // Prepare payload for Strapi token storage
                let expires_in_seconds = token_data
                    .get("expires_in")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(3600);
                let expires_at = chrono::Utc::now() + chrono::Duration::seconds(expires_in_seconds);

                // Debug: Log what org_id we're using for tenant_id
                tracing::info!(
                    "Preparing Strapi payload - platform: {}, shop_id: {}, platform_shop_id: {}, tenant_id (org_id): {}",
                    platform,
                    wos_shop_id,
                    platform_shop_id,
                    stored_org_id
                );

                let strapi_payload = serde_json::json!({
                        "data": {
                            "tenant_id": stored_org_id.clone(),
                            "org_id": stored_org_id.clone(),  // Also send org_id explicitly
                            "shop_id": wos_shop_id.clone(),
                            "platform_shop_id": platform_shop_id.clone(),  // Store the actual platform shop ID
                            "platform": platform.clone(),
                            "access_token": token_data.get("access_token").and_then(|v| v.as_str()).unwrap_or(""),
                            "refresh_token": token_data.get("refresh_token").and_then(|v| v.as_str()).unwrap_or(""),
                            "expires_at": expires_at.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string(),
                            "extra_data": {
                                "open_id": token_data.get("open_id").and_then(|v| v.as_str()).unwrap_or(""),
                                "seller_name": token_data.get("seller_name").and_then(|v| v.as_str()).unwrap_or(""),
                                "seller_id": token_data.get("seller_id").and_then(|v| v.as_str()),
                                "granted_scopes": token_data.get("granted_scopes"),
                                "access_token_expire_in": token_data.get("access_token_expire_in").and_then(|v| v.as_i64()),
                                "refresh_token_expire_in": token_data.get("refresh_token_expire_in").and_then(|v| v.as_i64()),
                            "shop_domain": token_data.get("shop_domain").and_then(|v| v.as_str()),
                            "instance_id": token_data.get("instance_id").and_then(|v| v.as_str()),
                            "account_id": token_data.get("account_id").and_then(|v| v.as_str()),
                            "account_platform": token_data.get("account_platform").and_then(|v| v.as_str()),
                            "user_id": token_data.get("user_id").and_then(|v| v.as_str()),
                            "locale": token_data.get("locale").and_then(|v| v.as_str()),
                            "sp": token_data.get("sp").and_then(|v| v.as_str()),
                            "store_hash": token_data.get("store_hash").and_then(|v| v.as_str()),
                            "context": token_data.get("context").and_then(|v| v.as_str()),
                            "account_uuid": token_data.get("account_uuid").and_then(|v| v.as_str()),
                            "user": token_data.get("user"),
                        },
                        "token_status": "connected",
                        "connected_at": chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
                    }
                });

                // Debug: Log the full payload being sent to Strapi
                tracing::info!(
                    "Sending to Strapi - Full payload: {}",
                    serde_json::to_string_pretty(&strapi_payload).unwrap_or_default()
                );

                // Send tokens to Strapi
                let client = reqwest::Client::new();
                let strapi_response = client
                    .post(format!("{}/api/shop-tokens", strapi_url))
                    .json(&strapi_payload)
                    .send()
                    .await;

                match strapi_response {
                    Ok(resp) if resp.status().is_success() => {
                        let response_text = resp.text().await.unwrap_or_default();
                        tracing::info!(
                            "Successfully stored tokens in Strapi for shop: {}, response: {}",
                            wos_shop_id,
                            response_text
                        );
                    }
                    Ok(resp) => {
                        let status = resp.status();
                        let response_text = resp.text().await.unwrap_or_default();
                        tracing::warn!(
                            "Strapi token storage failed (HTTP {}). Response: {}",
                            status,
                            response_text
                        );
                        tracing::debug!(
                            "Strapi request payload was: {}",
                            serde_json::to_string_pretty(&strapi_payload).unwrap_or_default()
                        );
                    }
                    Err(e) => {
                        tracing::error!(
                            "Failed to connect to Strapi at {}: {}. Tokens exchanged but not persisted.",
                            strapi_url,
                            e
                        );
                    }
                }
            }

            tracing::info!(
                "Successfully exchanged OAuth code for platform: {}",
                platform
            );
            tracing::debug!("Token data: {:?}", tokens);

            // Redirect to frontend with success status, passing all relevant data
            let open_id = tokens
                .as_object()
                .and_then(|o| o.get("open_id"))
                .and_then(|v| v.as_str())
                .unwrap_or("");

            let seller_name = tokens
                .as_object()
                .and_then(|o| o.get("seller_name"))
                .and_then(|v| v.as_str())
                .unwrap_or("");

            let redirect_url = format!(
                "{}/dashboard/connect/{}/callback?status=success&shop_id={}&org_id={}&platform_shopid={}&open_id={}&seller_name={}",
                frontend_url,
                platform.to_lowercase(),
                urlencoding::encode(&wos_shop_id),
                urlencoding::encode(&stored_org_id),
                urlencoding::encode(&platform_shop_id),
                urlencoding::encode(open_id),
                urlencoding::encode(seller_name)
            );
            Ok(Redirect::to(&redirect_url))
        }
        Err(e) => {
            tracing::error!(
                "Failed to exchange OAuth code for platform {}: {}",
                platform,
                e
            );
            let redirect_url = format!(
                "{}/dashboard/connect/{}/callback?status=error&error={}",
                frontend_url,
                platform.to_lowercase(),
                urlencoding::encode(&format!("Failed to exchange OAuth code: {}", e))
            );
            Ok(Redirect::to(&redirect_url))
        }
    }
}
