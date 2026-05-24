//! # Configuration Module - ระบบจัดการการตั้งค่า
//!
//! โมดูลนี้จัดการ configuration ทั้งหมดของระบบ
//! รองรับการโหลดจาก environment variables, JSON files, และ defaults
//!
//! ## คุณสมบัติหลัก:
//! - Centralized configuration management
//! - Multi-source configuration loading (env vars, JSON, defaults)
//! - Platform-specific authentication configuration
//! - Runtime configuration validation
//! - Hot-reload support สำหรับ development environment
//!
//! ## Configuration Types:
//! - **Platform Credentials**: OAuth keys, API secrets, endpoints
//! - **Authentication Config**: JWT secrets, session settings
//! - **Database Config**: ClickHouse, Redis, Qdrant connections
//! - **API Config**: Rate limits, CORS settings, timeouts
//!
//! ## Security:
//! - Environment variable expansion สำหรับ sensitive data
//! - Configuration validation และ sanitization
//! - Credential masking ใน logs และ debug output
use crate::model::error::AppResult;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

fn normalize_secret_values(value: Value) -> Vec<String> {
    match value {
        Value::String(secret) => vec![secret],
        Value::Array(items) => items
            .into_iter()
            .filter_map(|entry| match entry {
                Value::String(secret) => Some(secret),
                _ => None,
            })
            .collect(),
        Value::Object(mut map) => {
            if let Some(secrets_value) = map.remove("secrets") {
                normalize_secret_values(secrets_value)
            } else if let Some(Value::String(secret)) = map.remove("secret") {
                vec![secret]
            } else {
                vec![]
            }
        }
        _ => vec![],
    }
}

fn parse_webhook_secret_map(raw: &str) -> Option<HashMap<String, Vec<String>>> {
    let value: Value = serde_json::from_str(raw).ok()?;
    let object = value.as_object()?;

    let mut result = HashMap::new();
    for (tenant, entry) in object {
        let secrets = normalize_secret_values(entry.clone());
        if !secrets.is_empty() {
            result.insert(tenant.clone(), secrets);
        }
    }

    if result.is_empty() {
        None
    } else {
        Some(result)
    }
}

fn default_webhook_secret_map() -> HashMap<String, Vec<String>> {
    let mut map = HashMap::new();
    map.insert(
        "default".to_string(),
        vec!["dev-webhook-shared-secret-change".to_string()],
    );
    map
}

const DEFAULT_PRODUCT_SYNC_SUBJECT: &str = "ecommerce.product_sync.request";
const DEFAULT_PRODUCT_SYNC_LOW_SUBJECT: &str = "ecommerce.product_sync.request.low";

fn parse_priority_set(raw: &str) -> HashSet<String> {
    raw.split(|c: char| matches!(c, ',' | ';' | '\n' | '\r'))
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|value| value.to_lowercase())
        .collect()
}

/// Config loader module - โหลด config จากไฟล์และ environment
pub mod config_loader;

/// Platform authentication module - จัดการ auth config ของแต่ละ platform
pub mod platform_auth;

// Re-export types ที่ใช้บ่อย
pub use config_loader::{
    create_sample_config, PlatformCredentialEntry, PlatformCredentialsConfig,
    PlatformSpecificConfig,
};
pub use platform_auth::{AuthType, PlatformAuthConfig, PlatformRegistry};

/// Security configuration - ความปลอดภัยและการเข้ารหัส
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SecurityConfig {
    pub encryption_key: Option<String>, // คีย์สำหรับเข้ารหัสข้อมูลละเอียดอ่อน
    pub x_auth_token_secret: Option<String>, // Token ลับสำหรับตรวจสอบ API requests
    pub strapi_backend_token: Option<String>, // Token สำหรับเชื่อมต่อ Strapi backend
}

impl Config {
    /// Get platform credentials สำหรับ platform ที่ระบุ
    /// ค้นหา credentials จาก JSON config ก่อน ถ้าไม่เจอจะ fallback ไป environment
    ///
    /// # ลำดับการค้นหา:
    /// 1. JSON config file (credentials/credential.json)
    /// 2. Environment variables ({PLATFORM}_APP_KEY, {PLATFORM}_APP_SECRET)
    /// 3. Default values (ถ้ามี)
    pub fn get_platform_credentials(&self, platform: &str) -> AppResult<PlatformCredentials> {
        tracing::debug!("Getting platform credentials for: {}", platform);

        // First try to get from JSON config if loaded
        // ลองหาจาก JSON config ก่อน (ถ้ามีการโหลด)
        if let Some(json_config) = &self.platform_credentials {
            tracing::debug!("JSON config available, checking platform: {}", platform);
            if let Some(entry) = json_config.get_platform(platform) {
                tracing::debug!(
                    "Platform {} found in JSON config, enabled: {}",
                    platform,
                    entry.enabled
                );
                if entry.enabled {
                    // Get environment-specific credentials if available
                    let env = std::env::var("APP_ENV").unwrap_or_else(|_| "production".to_string());
                    tracing::debug!("Using environment: {}", env);
                    if let Some(creds) = json_config.get_platform_for_env(platform, &env) {
                        tracing::debug!("Using JSON config for platform: {}", platform);
                        return Ok(json_config.apply_defaults(creds));
                    }
                }
            } else {
                tracing::debug!("Platform {} not found in JSON config", platform);
            }
        } else {
            tracing::debug!("No JSON config available, using environment-based config");
        }

        // Fall back to environment-based config
        // ถ้าไม่เจอใน JSON config ให้ใช้ค่าจาก environment variables
        tracing::debug!(
            "Falling back to environment-based config for platform: {}",
            platform
        );

        // เลือก credentials ตาม platform ที่ระบุ
        let mut creds = match platform {
            "tiktok" => self.platforms.tiktok.clone(),
            "shopee" => self.platforms.shopee.clone(),
            "lazada" => self.platforms.lazada.clone(),
            "shopify" => self.platforms.shopify.clone(),
            "woocommerce" => self.platforms.woocommerce.clone(),
            "ecwid" => self.platforms.ecwid.clone(),
            "magento" => self.platforms.magento.clone(),
            "medusa" => self.platforms.medusa.clone(),
            "zoho" => self.platforms.zoho.clone(),
            "alibaba" => self.platforms.alibaba.clone(),
            "aliexpress" => self.platforms.aliexpress.clone(),
            "amazon" => self.platforms.amazon.clone(),
            "ebay" => self.platforms.ebay.clone(),
            "etsy" => self.platforms.etsy.clone(),
            "flipkart" => self.platforms.flipkart.clone(),
            "bigcommerce" => self.platforms.bigcommerce.clone(),
            "wix" => self.platforms.wix.clone(),
            "jd" => self.platforms.jd.clone(),
            "walmart" => self.platforms.walmart.clone(),
            "rakuten" => self.platforms.rakuten.clone(),
            "taobao" => self.platforms.taobao.clone(),
            "lineshopping" => self.platforms.lineshopping.clone(),
            _ => {
                return Err(crate::model::error::AppError::BadRequest(format!(
                    "Unknown platform: {}",
                    platform
                )))
            }
        };

        // Ensure api_key mirrors app_key when only app_key is provided (legacy env mapping)
        if creds.api_key.is_empty() && !creds.app_key.is_empty() {
            creds.api_key = creds.app_key.clone();
        }

        let registry = PlatformRegistry::new();
        let auth_type = registry
            .get(platform)
            .map(|config| config.auth_type.clone());

        if matches!(auth_type, Some(AuthType::ApiKey)) {
            let has_key = !creds.api_key.is_empty() || !creds.app_key.is_empty();
            tracing::info!(
                "Platform '{}' credentials loaded for API key auth - api_key_present: {}",
                platform,
                has_key
            );

            if !has_key {
                tracing::warn!(
                    "Platform '{}' API key is not configured via config/env; runtime credentials are required",
                    platform
                );
            }

            return Ok(creds);
        }

        // Check if credentials are actually configured
        tracing::info!(
            "Platform '{}' credentials loaded - app_key: '{}', app_secret: '{}'",
            platform,
            if creds.app_key.is_empty() {
                "EMPTY"
            } else {
                &creds.app_key[..4.min(creds.app_key.len())]
            },
            if creds.app_secret.is_empty() {
                "EMPTY"
            } else {
                "SET"
            }
        );

        // Check if credentials are empty and return error if so
        if creds.app_key.is_empty() || creds.app_secret.is_empty() {
            tracing::error!(
                "Platform '{}' credentials are empty - app_key: {}, app_secret: {}",
                platform,
                if creds.app_key.is_empty() {
                    "EMPTY"
                } else {
                    "SET"
                },
                if creds.app_secret.is_empty() {
                    "EMPTY"
                } else {
                    "SET"
                }
            );
            return Err(crate::model::error::AppError::BadRequest(format!(
                "Platform '{}' is not configured",
                platform
            )));
        }

        Ok(creds)
    }

    pub fn from_env() -> AppResult<Self> {
        // Load configuration from environment variables with defaults
        let webhook_secrets = std::env::var("WEBHOOK_SHARED_SECRETS")
            .ok()
            .and_then(|raw| parse_webhook_secret_map(&raw))
            .unwrap_or_else(default_webhook_secret_map);

        Ok(Self {
            server: ServerConfig {
                host: std::env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
                port: std::env::var("SERVER_PORT")
                    .unwrap_or_else(|_| "8080".to_string())
                    .parse()
                    .unwrap_or(8080),
                base_url: std::env::var("BASE_URL")
                    .unwrap_or_else(|_| "http://localhost:8080".to_string()),
                cors_origins: std::env::var("CORS_ORIGINS")
                    .unwrap_or_else(|_| "http://localhost:3000".to_string())
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .collect(),
                request_timeout_secs: 30,
                max_body_size: 10 * 1024 * 1024, // 10MB
            },
            database: DatabaseConfig {
                clickhouse_url: std::env::var("CLICKHOUSE_URL")
                    .unwrap_or_else(|_| "http://localhost:8123".to_string()),
                clickhouse_database: std::env::var("CLICKHOUSE_DATABASE")
                    .unwrap_or_else(|_| "ecommerce".to_string()),
                max_connections: 10,
                connection_timeout_secs: 30,
            },

            security: SecurityConfig {
                encryption_key: Some(
                    std::env::var("TOKEN_ENCRYPTION_KEY")
                        .unwrap_or_else(|_| "defaultencryptionkeychangeinprod".to_string()),
                ),
                x_auth_token_secret: std::env::var("X_AUTH_TOKEN_SECRET").ok(),
                strapi_backend_token: std::env::var("STRAPI_BACKEND_TOKEN").ok(),
            },
            qdrant: QdrantConfig {
                url: std::env::var("QDRANT_URL")
                    .unwrap_or_else(|_| "http://localhost:6333".to_string()),
                api_key: std::env::var("QDRANT_API_KEY").ok(),
                collection_prefix: std::env::var("QDRANT_COLLECTION_PREFIX")
                    .unwrap_or_else(|_| "ecommerce".to_string()),
                default_limit: 10,
            },
            rabbitmq: RabbitMqConfig {
                url: std::env::var("RABBITMQ_URL").unwrap_or_else(|_| {
                    "amqp://guest:guest@localhost:5672/%2f".to_string()
                }),
                exchange: std::env::var("RABBITMQ_EXCHANGE")
                    .unwrap_or_else(|_| "ecommerce".to_string()),
                queue_prefix: std::env::var("RABBITMQ_QUEUE_PREFIX")
                    .unwrap_or_else(|_| "ecommerce".to_string()),
                prefetch_count: std::env::var("RABBITMQ_PREFETCH")
                    .ok()
                    .and_then(|v| v.parse::<u16>().ok())
                    .unwrap_or(50),
            },
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            auth: AuthConfig {
                jwt_secret: std::env::var("JWT_SECRET")
                    .unwrap_or_else(|_| "dev-secret-change-in-production".to_string()),
                jwt_expiration_hours: 24,
                encryption_key: std::env::var("ENCRYPTION_KEY")
                    .unwrap_or_else(|_| "YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=".to_string()),
                x_auth_token_secret: std::env::var("X_AUTH_TOKEN_SECRET")
                    .unwrap_or_else(|_| "development-token".to_string()),
                ory_kratos_url: std::env::var("ORY_KRATOS_URL").ok(),
                ory_hydra_url: std::env::var("ORY_HYDRA_URL").ok(),
                dev_mode: std::env::var("DEV_MODE")
                    .unwrap_or_else(|_| "false".to_string())
                    .to_lowercase()
                    == "true",
                google_client_id: std::env::var("GOOGLE_CLIENT_ID").ok(),
                google_client_secret: std::env::var("GOOGLE_CLIENT_SECRET").ok(),
            },
            keto: KetoConfig {
                read_url: std::env::var("KETO_READ_URL")
                    .unwrap_or_else(|_| "http://localhost:4466".to_string()),
                write_url: std::env::var("KETO_WRITE_URL")
                    .unwrap_or_else(|_| "http://localhost:4467".to_string()),
            },
            hydra: HydraConfig {
                admin_url: std::env::var("HYDRA_ADMIN_URL")
                    .unwrap_or_else(|_| "http://localhost:4445".to_string()),
                public_url: std::env::var("HYDRA_PUBLIC_URL")
                    .unwrap_or_else(|_| "http://localhost:4444".to_string()),
            },
            kratos: KratosConfig {
                admin_url: std::env::var("KRATOS_ADMIN_URL")
                    .unwrap_or_else(|_| "http://localhost:4434".to_string()),
                public_url: std::env::var("KRATOS_PUBLIC_URL")
                    .unwrap_or_else(|_| "http://localhost:4433".to_string()),
            },
            platforms: PlatformConfig {
                tiktok: PlatformCredentials {
                    app_key: std::env::var("TIKTOK_APP_KEY").unwrap_or_default(),
                    app_secret: std::env::var("TIKTOK_APP_SECRET").unwrap_or_default(),
                    redirect_uri: std::env::var("TIKTOK_REDIRECT_URI").ok().or_else(|| {
                        Some("https://app.lodashventure.local/dashboard/connect/tiktok/callback".to_string())
                    }),
                    api_base_url: std::env::var("TIKTOK_API_BASE_URL")
                        .unwrap_or_else(|_| "https://open-api.tiktokglobalshop.com".to_string()),
                    rate_limit_rps: std::env::var("TIKTOK_RATE_LIMIT_RPS")
                        .unwrap_or_else(|_| "10.0".to_string())
                        .parse()
                        .unwrap_or(10.0),
                    oauth_authorize_url: std::env::var("TIKTOK_OAUTH_AUTHORIZE_URL").ok(),
                    oauth_token_url: std::env::var("TIKTOK_OAUTH_TOKEN_URL").ok(),
                    oauth_refresh_url: std::env::var("TIKTOK_OAUTH_REFRESH_URL").ok(),
                    oauth_revoke_url: std::env::var("TIKTOK_OAUTH_REVOKE_URL").ok(),
                    service_id: std::env::var("TIKTOK_SERVICE_ID").ok(),
                    market: std::env::var("TIKTOK_MARKET").ok(),
                    ..Default::default()
                },
                shopee: PlatformCredentials {
                    app_key: std::env::var("SHOPEE_PARTNER_ID")
                        .unwrap_or_else(|_| "1003034".to_string()),
                    app_secret: std::env::var("SHOPEE_PARTNER_KEY").unwrap_or_else(|_| {
                        "8d16623761ed86bfe6cc1da01b32e5a5af8dfbcf61d990aaeeac735b3b38b684"
                            .to_string()
                    }),
                    redirect_uri: std::env::var("SHOPEE_REDIRECT_URI").ok().or_else(|| {
                        Some(
                            "https://app.lodashventure.local/dashboard/connect/shopee/callback"
                                .to_string(),
                        )
                    }),
                    api_base_url: std::env::var("SHOPEE_API_BASE_URL")
                        .unwrap_or_else(|_| "https://openplatform.sandbox.test-stable.shopee.sg".to_string()),
                    rate_limit_rps: std::env::var("SHOPEE_RATE_LIMIT_RPS")
                        .unwrap_or_else(|_| "10.0".to_string())
                        .parse()
                        .unwrap_or(10.0),
                    oauth_authorize_url: std::env::var("SHOPEE_OAUTH_AUTHORIZE_URL").ok().or_else(|| {
                        Some("https://open.sandbox.test-stable.shopee.com".to_string())
                    }),
                    oauth_token_url: std::env::var("SHOPEE_OAUTH_TOKEN_URL").ok().or_else(|| {
                        Some(
                            "https://openplatform.sandbox.test-stable.shopee.sg/api/v2/auth/token/get"
                                .to_string(),
                        )
                    }),
                    oauth_refresh_url: std::env::var("SHOPEE_OAUTH_REFRESH_URL").ok().or_else(
                        || {
                            Some(
                                "https://openplatform.sandbox.test-stable.shopee.sg/api/v2/auth/access_token/get"
                                    .to_string(),
                            )
                        },
                    ),
                    oauth_revoke_url: std::env::var("SHOPEE_OAUTH_REVOKE_URL").ok(),
                    ..Default::default()
                },
                lazada: PlatformCredentials {
                    app_key: std::env::var("LAZADA_APP_KEY")
                        .unwrap_or_else(|_| "125832".to_string()), // Hardcoded for development
                    app_secret: std::env::var("LAZADA_APP_SECRET")
                        .unwrap_or_else(|_| "0aba2e83a4296419bf27e76e2fb063f46e90cf30".to_string()), // Hardcoded for development
                    redirect_uri: std::env::var("LAZADA_REDIRECT_URI").ok().or_else(|| {
                        Some("https://app.lodashventure.local/dashboard/connect/lazada/callback".to_string())
                    }),
                    api_base_url: std::env::var("LAZADA_API_BASE_URL")
                        .unwrap_or_else(|_| "https://api.lazada.sg/rest".to_string()),
                    rate_limit_rps: std::env::var("LAZADA_RATE_LIMIT_RPS")
                        .unwrap_or_else(|_| "10.0".to_string())
                        .parse()
                        .unwrap_or(10.0),
                    oauth_authorize_url: std::env::var("LAZADA_OAUTH_AUTHORIZE_URL")
                        .ok()
                        .or_else(|| Some("https://auth.lazada.com/oauth/authorize".to_string())),
                    oauth_token_url: std::env::var("LAZADA_OAUTH_TOKEN_URL").ok().or_else(|| {
                        Some("https://auth.lazada.com/rest/auth/token/create".to_string())
                    }),
                    oauth_refresh_url: std::env::var("LAZADA_OAUTH_REFRESH_URL").ok().or_else(
                        || Some("https://auth.lazada.com/rest/auth/token/refresh".to_string()),
                    ),
                    oauth_revoke_url: std::env::var("LAZADA_OAUTH_REVOKE_URL").ok(),
                    ..Default::default()
                },
                shopify: PlatformCredentials {
                    app_key: std::env::var("SHOPIFY_APP_KEY").unwrap_or_default(),
                    app_secret: std::env::var("SHOPIFY_APP_SECRET").unwrap_or_default(),
                    redirect_uri: std::env::var("SHOPIFY_REDIRECT_URI").ok().or_else(|| {
                        Some("https://app.lodashventure.local/dashboard/connect/shopify/callback".to_string())
                    }),
                    api_base_url: std::env::var("SHOPIFY_API_BASE_URL")
                        .unwrap_or_else(|_| "https://admin.shopify.com".to_string()),
                    rate_limit_rps: std::env::var("SHOPIFY_RATE_LIMIT_RPS")
                        .unwrap_or_else(|_| "2.0".to_string())
                        .parse()
                        .unwrap_or(2.0),
                    oauth_authorize_url: std::env::var("SHOPIFY_OAUTH_AUTHORIZE_URL").ok(),
                    oauth_token_url: std::env::var("SHOPIFY_OAUTH_TOKEN_URL").ok(),
                    oauth_refresh_url: std::env::var("SHOPIFY_OAUTH_REFRESH_URL").ok(),
                    oauth_revoke_url: std::env::var("SHOPIFY_OAUTH_REVOKE_URL").ok(),
                    ..Default::default()
                },
                woocommerce: PlatformCredentials {
                    app_key: std::env::var("WOOCOMMERCE_APP_KEY").unwrap_or_default(),
                    app_secret: std::env::var("WOOCOMMERCE_APP_SECRET").unwrap_or_default(),
                    redirect_uri: std::env::var("WOOCOMMERCE_REDIRECT_URI").ok().or_else(|| {
                        Some("https://app.lodashventure.local/dashboard/connect/woocommerce/callback".to_string())
                    }),
                    api_base_url: std::env::var("WOOCOMMERCE_API_BASE_URL").unwrap_or_default(),
                    rate_limit_rps: std::env::var("WOOCOMMERCE_RATE_LIMIT_RPS")
                        .unwrap_or_else(|_| "10.0".to_string())
                        .parse()
                        .unwrap_or(10.0),
                    oauth_authorize_url: std::env::var("WOOCOMMERCE_OAUTH_AUTHORIZE_URL").ok(),
                    oauth_token_url: std::env::var("WOOCOMMERCE_OAUTH_TOKEN_URL").ok(),
                    oauth_refresh_url: std::env::var("WOOCOMMERCE_OAUTH_REFRESH_URL").ok(),
                    oauth_revoke_url: std::env::var("WOOCOMMERCE_OAUTH_REVOKE_URL").ok(),
                    ..Default::default()
                },
                alibaba: PlatformCredentials {
                    app_key: std::env::var("ALIBABA_APP_KEY").unwrap_or_default(),
                    app_secret: std::env::var("ALIBABA_APP_SECRET").unwrap_or_default(),
                    redirect_uri: std::env::var("ALIBABA_REDIRECT_URI").ok(),
                    api_base_url: std::env::var("ALIBABA_API_URL")
                        .unwrap_or_else(|_| "https://gw.api.alibaba.com".to_string()),
                    oauth_authorize_url: std::env::var("ALIBABA_OAUTH_AUTHORIZE_URL").ok(),
                    ..Default::default()
                },
                aliexpress: PlatformCredentials {
                    app_key: std::env::var("ALIEXPRESS_CLIENT_ID").unwrap_or_default(),
                    app_secret: std::env::var("ALIEXPRESS_CLIENT_SECRET").unwrap_or_default(),
                    redirect_uri: std::env::var("ALIEXPRESS_REDIRECT_URI").ok(),
                    api_base_url: std::env::var("ALIEXPRESS_API_BASE_URL")
                        .unwrap_or_else(|_| "https://api-sg.aliexpress.com/rest".to_string()),
                    oauth_authorize_url: std::env::var("ALIEXPRESS_OAUTH_AUTHORIZE_URL").ok(),
                    oauth_token_url: Some(
                        std::env::var("ALIEXPRESS_OAUTH_TOKEN_URL")
                            .unwrap_or_else(|_| "https://oauth.aliexpress.com/token".to_string()),
                    ),
                    rate_limit_rps: std::env::var("ALIEXPRESS_RATE_LIMIT_RPS")
                        .unwrap_or_else(|_| "5.0".to_string())
                        .parse()
                        .unwrap_or(5.0),
                    ..Default::default()
                },
                zoho: PlatformCredentials {
                    app_key: std::env::var("ZOHO_CLIENT_ID").unwrap_or_default(),
                    app_secret: std::env::var("ZOHO_CLIENT_SECRET").unwrap_or_default(),
                    redirect_uri: std::env::var("ZOHO_REDIRECT_URI").ok().or_else(|| {
                        Some("https://app.lodashventure.local/dashboard/connect/zoho/callback".to_string())
                    }),
                    api_base_url: std::env::var("ZOHO_API_BASE_URL")
                        .unwrap_or_else(|_| "https://commerce.zoho.com".to_string()),
                    rate_limit_rps: std::env::var("ZOHO_RATE_LIMIT_RPS")
                        .unwrap_or_else(|_| "5.0".to_string())
                        .parse()
                        .unwrap_or(5.0),
                    oauth_authorize_url: std::env::var("ZOHO_OAUTH_AUTHORIZE_URL")
                        .ok()
                        .or_else(|| Some("https://accounts.zoho.com/oauth/v2/auth".to_string())),
                    oauth_token_url: std::env::var("ZOHO_OAUTH_TOKEN_URL")
                        .ok()
                        .or_else(|| Some("https://accounts.zoho.com/oauth/v2/token".to_string())),
                    oauth_refresh_url: std::env::var("ZOHO_OAUTH_REFRESH_URL")
                        .ok()
                        .or_else(|| Some("https://accounts.zoho.com/oauth/v2/token".to_string())),
                    tenant_id: std::env::var("ZOHO_TENANT_ID").ok(),
                    ..Default::default()
                },
                amazon: PlatformCredentials {
                    app_key: std::env::var("AMAZON_APP_ID")
                        .or_else(|_| std::env::var("AMAZON_CLIENT_ID"))
                        .or_else(|_| std::env::var("AMAZON_LWA_CLIENT_ID"))
                        .unwrap_or_default(),
                    app_secret: std::env::var("AMAZON_CLIENT_SECRET")
                        .or_else(|_| std::env::var("AMAZON_APP_SECRET"))
                        .or_else(|_| std::env::var("AMAZON_LWA_CLIENT_SECRET"))
                        .unwrap_or_default(),
                    redirect_uri: std::env::var("AMAZON_REDIRECT_URI").ok().or_else(|| {
                        Some(format!(
                            "{}/api/v1/where_on_sales/gateway/ecommerce/amazon/callback",
                            PlatformCredentials::gateway_base_url()
                        ))
                    }),
                    api_base_url: std::env::var("AMAZON_API_BASE_URL")
                        .unwrap_or_else(|_| "https://sellingpartnerapi.amazon.com".to_string()),
                    oauth_authorize_url: std::env::var("AMAZON_OAUTH_AUTHORIZE_URL")
                        .ok()
                        .or_else(|| Some("https://www.amazon.com/ap/oa".to_string())),
                    oauth_token_url: std::env::var("AMAZON_OAUTH_TOKEN_URL")
                        .ok()
                        .or_else(|| Some("https://api.amazon.com/auth/o2/token".to_string())),
                    oauth_refresh_url: std::env::var("AMAZON_OAUTH_REFRESH_URL").ok(),
                    ..Default::default()
                },
                ebay: PlatformCredentials {
                    app_key: std::env::var("EBAY_CLIENT_ID").unwrap_or_default(),
                    app_secret: std::env::var("EBAY_CLIENT_SECRET").unwrap_or_default(),
                    ..Default::default()
                },
                etsy: {
                    let app_key = std::env::var("ETSY_CLIENT_ID")
                        .or_else(|_| std::env::var("ETSY_API_KEY"))
                        .or_else(|_| std::env::var("ETSY_APP_KEY"))
                        .unwrap_or_default();
                    let app_secret = std::env::var("ETSY_CLIENT_SECRET")
                        .or_else(|_| std::env::var("ETSY_API_SECRET"))
                        .or_else(|_| std::env::var("ETSY_APP_SECRET"))
                        .or_else(|_| std::env::var("ETSY_SECRET"))
                        .unwrap_or_default();
                    let api_base_url = std::env::var("ETSY_API_BASE_URL")
                        .unwrap_or_else(|_| "https://openapi.etsy.com".to_string());
                    let authorize_url = std::env::var("ETSY_OAUTH_AUTHORIZE_URL")
                        .unwrap_or_else(|_| "https://www.etsy.com/oauth/connect".to_string());
                    let token_url = std::env::var("ETSY_OAUTH_TOKEN_URL")
                        .unwrap_or_else(|_| {
                            "https://api.etsy.com/v3/public/oauth/token".to_string()
                        });
                    let refresh_url = std::env::var("ETSY_OAUTH_REFRESH_URL")
                        .ok()
                        .unwrap_or_else(|| token_url.clone());
                    let revoke_url = std::env::var("ETSY_OAUTH_REVOKE_URL").ok();
                    PlatformCredentials {
                        api_key: app_key.clone(),
                        app_key,
                        app_secret,
                        redirect_uri: std::env::var("ETSY_REDIRECT_URI").ok(),
                        api_base_url,
                        rate_limit_rps: 10.0,
                        oauth_authorize_url: Some(authorize_url),
                        oauth_token_url: Some(token_url),
                        oauth_refresh_url: Some(refresh_url),
                        oauth_revoke_url: revoke_url,
                        store_id: None,
                        base_url: None,
                        tenant_id: None,
                        service_id: None,
                        market: None,
                    }
                },
                flipkart: PlatformCredentials {
                    app_key: std::env::var("FLIPKART_CLIENT_ID").unwrap_or_default(),
                    app_secret: std::env::var("FLIPKART_CLIENT_SECRET").unwrap_or_default(),
                    ..Default::default()
                },
                bigcommerce: PlatformCredentials {
                    app_key: std::env::var("BIGCOMMERCE_CLIENT_ID").unwrap_or_default(),
                    app_secret: std::env::var("BIGCOMMERCE_CLIENT_SECRET").unwrap_or_default(),
                    redirect_uri: std::env::var("BIGCOMMERCE_REDIRECT_URI").ok().or_else(|| {
                        Some("https://api.lodashventure.local/auth".to_string())
                    }),
                    ..Default::default()
                },
                wix: PlatformCredentials {
                    app_key: std::env::var("WIX_CLIENT_ID").unwrap_or_default(),
                    app_secret: std::env::var("WIX_CLIENT_SECRET").unwrap_or_default(),
                    redirect_uri: std::env::var("WIX_REDIRECT_URI").ok(),
                    oauth_authorize_url: std::env::var("WIX_OAUTH_AUTHORIZE_URL").ok(),
                    oauth_token_url: std::env::var("WIX_OAUTH_TOKEN_URL").ok(),
                    ..Default::default()
                },
                jd: PlatformCredentials {
                    app_key: std::env::var("JD_CLIENT_ID").unwrap_or_default(),
                    app_secret: std::env::var("JD_CLIENT_SECRET").unwrap_or_default(),
                    ..Default::default()
                },
                walmart: PlatformCredentials {
                    app_key: std::env::var("WALMART_CLIENT_ID").unwrap_or_default(),
                    app_secret: std::env::var("WALMART_CLIENT_SECRET").unwrap_or_default(),
                    ..Default::default()
                },
                rakuten: PlatformCredentials {
                    app_key: std::env::var("RAKUTEN_APPLICATION_ID").unwrap_or_default(),
                    app_secret: std::env::var("RAKUTEN_APPLICATION_SECRET").unwrap_or_default(),
                    ..Default::default()
                },
                taobao: PlatformCredentials {
                    app_key: std::env::var("TAOBAO_CLIENT_ID").unwrap_or_default(),
                    app_secret: std::env::var("TAOBAO_CLIENT_SECRET").unwrap_or_default(),
                    ..Default::default()
                },
                lineshopping: PlatformCredentials {
                    api_key: std::env::var("LINESHOPPING_API_KEY").unwrap_or_default(),
                    app_key: std::env::var("LINESHOPPING_API_KEY").unwrap_or_default(),
                    app_secret: std::env::var("LINESHOPPING_API_SECRET").unwrap_or_default(),
                    api_base_url: std::env::var("LINESHOPPING_API_BASE_URL")
                        .unwrap_or_else(|_| "https://developers-oaplus.line.biz/myshop/v1".to_string()),
                    ..Default::default()
                },
                ..Default::default()
            },
            ai: {
                let mut completion_models = HashMap::new();
                completion_models.insert(
                    "lite-chat".to_string(),
                    CompletionModel {
                        provider: "lite-llm".to_string(),
                        supports_stream: true,
                        description: Some("Deterministic offline-friendly chat model".to_string()),
                    },
                );

                AiConfig {
                    llm_api_base_url: std::env::var("OPENAI_API_BASE_URL")
                        .unwrap_or_else(|_| "https://api.openai.com/v1".to_string()),
                    llm_api_key: std::env::var("OPENAI_API_KEY").unwrap_or_default(),
                    llm_timeout_ms: std::env::var("OPENAI_TIMEOUT_MS")
                        .unwrap_or_else(|_| "30000".to_string())
                        .parse()
                        .unwrap_or(30000),
                    llm_retry_max: std::env::var("OPENAI_RETRY_MAX")
                        .unwrap_or_else(|_| "3".to_string())
                        .parse()
                        .unwrap_or(3),
                    embedding_models: HashMap::new(),
                    completion_models,
                    default_completion_model: Some("lite-chat".to_string()),
                }
            },
            worker: WorkerConfig::default(),
            observability: ObservabilityConfig {
                jaeger_endpoint: std::env::var("JAEGER_ENDPOINT").ok(),
                prometheus_port: std::env::var("PROMETHEUS_PORT")
                    .unwrap_or_else(|_| "9090".to_string())
                    .parse()
                    .unwrap_or(9090),
                log_level: std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
                log_format: std::env::var("LOG_FORMAT").unwrap_or_else(|_| "json".to_string()),
            },
            frontend_url: std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            auth_token: std::env::var("X_AUTH_TOKEN_SECRET")
                .unwrap_or_else(|_| "dev-auth-token-change-in-production".to_string()),
            strapi_url: std::env::var("STRAPI_URL").ok(),
            ingestion: IngestionConfig {
                webhook_shared_secrets: webhook_secrets,
                webhook_max_batch_items: std::env::var("WEBHOOK_MAX_BATCH_ITEMS")
                    .ok()
                    .and_then(|v| v.parse::<usize>().ok())
                    .unwrap_or(100),
                webhook_max_body_bytes: std::env::var("WEBHOOK_MAX_BODY_BYTES")
                    .ok()
                    .and_then(|v| v.parse::<usize>().ok())
                    .unwrap_or(5 * 1024 * 1024),
                webhook_idempotency_ttl_secs: std::env::var("WEBHOOK_IDEMPOTENCY_TTL_SECS")
                    .ok()
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(24 * 60 * 60),
                webhook_queue_routing_key: std::env::var("WEBHOOK_QUEUE_ROUTING_KEY")
                    .unwrap_or_else(|_| "product.batch.upsert".to_string()),
                crawler_url_queue: std::env::var("CRAWLER_URL_QUEUE")
                    .unwrap_or_else(|_| "merchant.crawl.urls".to_string()),
                crawler_prefetch: std::env::var("CRAWLER_PREFETCH")
                    .ok()
                    .and_then(|v| v.parse::<u16>().ok())
                    .unwrap_or(10),
                crawler_result_queue: std::env::var("CRAWLER_RESULT_QUEUE")
                    .unwrap_or_else(|_| "merchant.crawl.results".to_string()),
                crawler_dlq: std::env::var("CRAWLER_DLQ")
                    .unwrap_or_else(|_| "merchant.crawl.dlq".to_string()),
            },
            media: MediaConfig {
                worker_url: std::env::var("MEDIA_WORKER_URL").unwrap_or_default(),
                auth_token: std::env::var("MEDIA_WORKER_TOKEN").ok(),
                cf_worker_upload_url: std::env::var("CF_WORKER_UPLOAD_URL").ok(),
                cf_worker_download_url: std::env::var("CF_WORKER_DOWNLOAD_URL").ok(),
                cf_worker_api_token: std::env::var("CF_WORKER_API_TOKEN").ok(),
            },
            product_sync_queue: {
                let low_priority_shops_raw =
                    std::env::var("PRODUCT_SYNC_LOW_PRIORITY_SHOPS").unwrap_or_default();
                let low_priority_platforms_raw =
                    std::env::var("PRODUCT_SYNC_LOW_PRIORITY_PLATFORMS").unwrap_or_default();
                ProductSyncQueueConfig {
                    default_subject: std::env::var("PRODUCT_SYNC_QUEUE_DEFAULT_SUBJECT")
                        .unwrap_or_else(|_| DEFAULT_PRODUCT_SYNC_SUBJECT.to_string()),
                    low_priority_subject: std::env::var("PRODUCT_SYNC_QUEUE_LOW_SUBJECT")
                        .unwrap_or_else(|_| DEFAULT_PRODUCT_SYNC_LOW_SUBJECT.to_string()),
                    low_priority_shops: parse_priority_set(&low_priority_shops_raw),
                    low_priority_platforms: parse_priority_set(&low_priority_platforms_raw),
                }
            },
            platform_credentials: None,
        })
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Config {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub qdrant: QdrantConfig,
    pub rabbitmq: RabbitMqConfig,
    pub redis_url: String,
    pub auth: AuthConfig,

    pub security: SecurityConfig,
    pub keto: KetoConfig,
    pub hydra: HydraConfig,
    pub kratos: KratosConfig,
    pub platforms: PlatformConfig,
    pub ai: AiConfig,
    pub worker: WorkerConfig,
    pub observability: ObservabilityConfig,
    pub frontend_url: String,
    pub auth_token: String,
    pub strapi_url: Option<String>,
    pub ingestion: IngestionConfig,
    pub media: MediaConfig,
    #[serde(default)]
    pub product_sync_queue: ProductSyncQueueConfig,

    /// Platform credentials loaded from JSON file
    #[serde(skip)]
    pub platform_credentials: Option<PlatformCredentialsConfig>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub base_url: String,
    pub cors_origins: Vec<String>,
    pub request_timeout_secs: u64,
    pub max_body_size: usize,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DatabaseConfig {
    pub clickhouse_url: String,
    pub clickhouse_database: String,
    pub max_connections: u32,
    pub connection_timeout_secs: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct QdrantConfig {
    pub url: String,
    pub api_key: Option<String>,
    pub collection_prefix: String,
    pub default_limit: usize,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RabbitMqConfig {
    pub url: String,
    pub exchange: String,
    pub queue_prefix: String,
    pub prefetch_count: u16,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct IngestionConfig {
    pub webhook_shared_secrets: HashMap<String, Vec<String>>,
    pub webhook_max_batch_items: usize,
    pub webhook_max_body_bytes: usize,
    pub webhook_idempotency_ttl_secs: u64,
    pub webhook_queue_routing_key: String,
    pub crawler_url_queue: String,
    pub crawler_prefetch: u16,
    pub crawler_result_queue: String,
    pub crawler_dlq: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MediaConfig {
    pub worker_url: String,
    pub auth_token: Option<String>,
    pub cf_worker_upload_url: Option<String>,
    pub cf_worker_download_url: Option<String>,
    pub cf_worker_api_token: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub jwt_expiration_hours: i64,
    pub encryption_key: String,
    pub x_auth_token_secret: String, // Secret token for Strapi proxy authentication
    pub ory_kratos_url: Option<String>,
    pub ory_hydra_url: Option<String>,
    pub dev_mode: bool, // Enable development mode to bypass Kratos validation
    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct KetoConfig {
    pub read_url: String,
    pub write_url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct HydraConfig {
    pub admin_url: String,
    pub public_url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct KratosConfig {
    pub admin_url: String,
    pub public_url: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct PlatformConfig {
    pub tiktok: PlatformCredentials,
    pub shopee: PlatformCredentials,
    pub lazada: PlatformCredentials,
    pub shopify: PlatformCredentials,
    pub woocommerce: PlatformCredentials,
    pub ecwid: PlatformCredentials,
    pub magento: PlatformCredentials,
    pub medusa: PlatformCredentials,
    pub zoho: PlatformCredentials,
    pub alibaba: PlatformCredentials,
    pub aliexpress: PlatformCredentials,
    pub amazon: PlatformCredentials,
    pub ebay: PlatformCredentials,
    pub etsy: PlatformCredentials,
    pub flipkart: PlatformCredentials,
    pub bigcommerce: PlatformCredentials,
    pub wix: PlatformCredentials,
    pub jd: PlatformCredentials,
    pub walmart: PlatformCredentials,
    pub rakuten: PlatformCredentials,
    pub taobao: PlatformCredentials,
    pub lineshopping: PlatformCredentials,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PlatformCredentials {
    pub api_key: String,
    pub app_key: String,
    pub app_secret: String,
    pub redirect_uri: Option<String>,
    pub api_base_url: String,
    pub rate_limit_rps: f64,
    // OAuth-specific URLs
    pub oauth_authorize_url: Option<String>, // OAuth authorization endpoint
    pub oauth_token_url: Option<String>,     // OAuth token exchange endpoint
    pub oauth_refresh_url: Option<String>,   // OAuth token refresh endpoint
    pub oauth_revoke_url: Option<String>,    // OAuth token revocation endpoint
    // Additional optional fields for specific platforms
    pub store_id: Option<String>,   // For Ecwid
    pub base_url: Option<String>,   // For Magento, Medusa
    pub tenant_id: Option<String>,  // For Zoho
    pub service_id: Option<String>, // For TikTok Shop (different per market)
    pub market: Option<String>,     // Market region (US, ROW) for TikTok
}

impl Default for PlatformCredentials {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            app_key: String::new(),
            app_secret: String::new(),
            redirect_uri: None,
            api_base_url: String::new(),
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
        }
    }
}

impl PlatformCredentials {
    /// Get the OAuth redirect URL for frontend callback
    /// This ensures we always use the correct frontend URL for OAuth redirects
    /// and not the API base URL which is for backend-to-backend communication
    pub fn get_oauth_redirect_url(&self, platform: &str, frontend_url: &str) -> String {
        if let Some(ref uri) = self.redirect_uri {
            return uri.clone();
        }

        // Default to frontend URL with platform-specific callback path
        format!("{}/dashboard/connect/{}/callback", frontend_url, platform)
    }

    /// Resolve the public API callback URL for a platform OAuth flow.
    ///
    /// Falls back to `https://api.lodashventure.local` when no override is provided.
    pub fn get_gateway_callback_url(&self, platform: &str) -> String {
        if let Some(ref uri) = self.redirect_uri {
            if Self::looks_like_gateway_callback(uri) {
                return uri.clone();
            } else {
                tracing::warn!(
                    "Redirect URI '{}' does not point to the gateway callback path; falling back to API base",
                    uri
                );
            }
        }

        let base_url = Self::gateway_base_url();
        format!(
            "{}/api/v1/where_on_sales/gateway/ecommerce/{}/callback",
            base_url, platform
        )
    }

    fn looks_like_gateway_callback(uri: &str) -> bool {
        uri.contains("/api/v1/where_on_sales/gateway/ecommerce/")
    }

    fn gateway_base_url() -> String {
        const ENV_CANDIDATES: [&str; 8] = [
            "PUBLIC_GATEWAY_BASE_URL",
            "GATEWAY_PUBLIC_BASE_URL",
            "GATEWAY_PUBLIC_URL",
            "PUBLIC_API_BASE_URL",
            "PUBLIC_API_URL",
            "API_BASE_URL",
            "SERVER_BASE_URL",
            "BASE_URL",
        ];

        for key in ENV_CANDIDATES {
            if let Ok(value) = std::env::var(key) {
                if let Some(normalized) = Self::normalize_base_url(&value) {
                    return normalized;
                }
            }
        }

        let fallback = std::env::var("BASE_URL")
            .or_else(|_| std::env::var("SERVER_BASE_URL"))
            .unwrap_or_else(|_| "http://localhost:8080".to_string());

        Self::normalize_base_url(&fallback)
            .unwrap_or_else(|| "https://api.lodashventure.local".to_string())
    }

    fn normalize_base_url(value: &str) -> Option<String> {
        let trimmed = value.trim().trim_matches('"');
        if trimmed.is_empty() {
            return None;
        }

        let with_scheme = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            trimmed.to_string()
        } else {
            format!("https://{}", trimmed.trim_start_matches("://"))
        };

        Some(with_scheme.trim_end_matches('/').to_string())
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AiConfig {
    pub llm_api_base_url: String,
    pub llm_api_key: String,
    pub llm_timeout_ms: u64,
    pub llm_retry_max: u32,
    pub embedding_models: HashMap<String, EmbeddingModel>,
    pub completion_models: HashMap<String, CompletionModel>,
    pub default_completion_model: Option<String>,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            llm_api_base_url: "https://api.openai.com/v1".to_string(),
            llm_api_key: String::new(),
            llm_timeout_ms: 30000,
            llm_retry_max: 3,
            embedding_models: HashMap::new(),
            completion_models: HashMap::new(),
            default_completion_model: None,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EmbeddingModel {
    pub provider: String,
    pub dimensions: usize,
    pub max_input_tokens: usize,
    pub chunking_strategy: String,
    pub chunk_size_tokens: usize,
    pub chunk_overlap_tokens: usize,
    pub rate_limit_rps: f64,
    pub qdrant_collection_pattern: String,
    pub default_for_platforms: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CompletionModel {
    pub provider: String,
    pub supports_stream: bool,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WorkerConfig {
    pub batch_size: usize,
    pub poll_interval_ms: u64,
    pub max_retries: u32,
    pub retry_delay_ms: u64,
}

impl Default for WorkerConfig {
    fn default() -> Self {
        Self {
            batch_size: 100,
            poll_interval_ms: 5000,
            max_retries: 3,
            retry_delay_ms: 1000,
        }
    }
}

fn default_product_sync_subject() -> String {
    DEFAULT_PRODUCT_SYNC_SUBJECT.to_string()
}

fn default_product_sync_low_subject() -> String {
    DEFAULT_PRODUCT_SYNC_LOW_SUBJECT.to_string()
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ProductSyncQueueConfig {
    #[serde(default = "default_product_sync_subject")]
    pub default_subject: String,
    #[serde(default = "default_product_sync_low_subject")]
    pub low_priority_subject: String,
    #[serde(default)]
    pub low_priority_shops: HashSet<String>,
    #[serde(default)]
    pub low_priority_platforms: HashSet<String>,
}

impl Default for ProductSyncQueueConfig {
    fn default() -> Self {
        Self {
            default_subject: default_product_sync_subject(),
            low_priority_subject: default_product_sync_low_subject(),
            low_priority_shops: HashSet::new(),
            low_priority_platforms: HashSet::new(),
        }
    }
}

impl ProductSyncQueueConfig {
    fn normalize_key(value: &str) -> String {
        value.trim().to_lowercase()
    }

    fn is_low_priority_hint(hint: &str) -> bool {
        if hint.trim().is_empty() {
            return false;
        }

        let normalized_owned = hint.trim().to_lowercase();
        let mut slice = normalized_owned.as_str();
        for prefix in [
            "queue:",
            "queue.",
            "priority:",
            "priority.",
            "source:",
            "source.",
        ] {
            if let Some(rest) = slice.strip_prefix(prefix) {
                slice = rest;
                break;
            }
        }

        if slice.is_empty() {
            return false;
        }

        slice
            .split(|c| c == '_' || c == '-' || c == '.' || c == '/')
            .any(|token| token == "low")
    }

    fn should_use_low_priority(
        &self,
        shop_id: &str,
        platform: &str,
        source_hint: Option<&str>,
    ) -> bool {
        let shop_key = Self::normalize_key(shop_id);
        if !shop_key.is_empty() && self.low_priority_shops.contains(&shop_key) {
            return true;
        }

        let platform_key = Self::normalize_key(platform);
        if !platform_key.is_empty() && self.low_priority_platforms.contains(&platform_key) {
            return true;
        }

        if let Some(hint) = source_hint.and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        }) {
            return Self::is_low_priority_hint(hint);
        }

        false
    }

    pub fn subject_for(&self, shop_id: &str, platform: &str, source_hint: Option<&str>) -> String {
        if self.should_use_low_priority(shop_id, platform, source_hint) {
            let subject = self.low_priority_subject.trim();
            if subject.is_empty() {
                return default_product_sync_subject();
            }
            subject.to_string()
        } else {
            let subject = self.default_subject.trim();
            if subject.is_empty() {
                return default_product_sync_subject();
            }
            subject.to_string()
        }
    }

    pub fn subjects(&self) -> Vec<String> {
        let mut dedup = Vec::new();
        for subject in [
            self.default_subject.trim(),
            self.low_priority_subject.trim(),
        ] {
            if subject.is_empty()
                || dedup
                    .iter()
                    .any(|existing: &String| existing.eq_ignore_ascii_case(subject))
            {
                continue;
            }
            dedup.push(subject.to_string());
        }

        if dedup.is_empty() {
            dedup.push(default_product_sync_subject());
        }

        dedup
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ObservabilityConfig {
    pub jaeger_endpoint: Option<String>,
    pub prometheus_port: u16,
    pub log_level: String,
    pub log_format: String,
}

impl Config {
    /// Load configuration from environment and files
    pub fn load() -> AppResult<Self> {
        // First load base config from environment
        let mut config = Self::from_env().map_err(|e| {
            crate::model::error::AppError::ConfigError(format!("Failed to load config: {}", e))
        })?;

        // Then try to load platform credentials from JSON
        match PlatformCredentialsConfig::load() {
            Ok(platform_config) => {
                config.platform_credentials = Some(platform_config);
                tracing::info!("Loaded platform credentials from JSON file");
            }
            Err(e) => {
                tracing::warn!("Failed to load platform credentials from JSON: {}", e);
                // Continue without JSON credentials, will fall back to env vars
            }
        }

        Ok(config)
    }

    pub fn from_env_config() -> Result<Self, config::ConfigError> {
        let mut builder = config::Config::builder();

        builder = builder
            .set_default("server.host", "0.0.0.0")?
            .set_default("server.port", 8080)?
            .set_default("server.cors_origins", vec!["*"])?
            .set_default("server.request_timeout_secs", 30)?
            .set_default("server.max_body_size", 10485760)?
            .set_default("database.max_connections", 10)?
            .set_default("database.connection_timeout_secs", 10)?
            .set_default("redis.pool_size", 10)?
            .set_default("redis.connection_timeout_secs", 10)?
            .set_default("qdrant.collection_prefix", "collection")?
            .set_default("qdrant.default_limit", 10)?
            .set_default("rabbitmq.url", "amqp://guest:guest@localhost:5672/%2f")?
            .set_default("rabbitmq.exchange", "ecommerce")?
            .set_default("rabbitmq.queue_prefix", "ecommerce")?
            .set_default("rabbitmq.prefetch_count", 50)?
            .set_default("auth.jwt_expiration_hours", 24)?
            .set_default("ai.llm_timeout_ms", 30000)?
            .set_default("ai.llm_retry_max", 3)?
            .set_default("worker.batch_size", 100)?
            .set_default("worker.poll_interval_ms", 1000)?
            .set_default("worker.max_retries", 3)?
            .set_default("worker.retry_delay_ms", 5000)?
            .set_default("observability.prometheus_port", 9090)?
            .set_default("observability.log_level", "info")?
            .set_default("observability.log_format", "json")?;

        builder = builder.add_source(
            config::Environment::with_prefix("EC")
                .separator("__")
                .try_parsing(true),
        );

        if std::path::Path::new("config.toml").exists() {
            builder = builder.add_source(config::File::with_name("config"));
        }

        builder.build()?.try_deserialize()
    }

    pub fn get_platform_credentials_optional(&self, platform: &str) -> Option<PlatformCredentials> {
        // First try to get from JSON config if loaded
        if let Some(json_config) = &self.platform_credentials {
            if let Some(entry) = json_config.get_platform(platform) {
                if entry.enabled {
                    // Get environment-specific credentials if available
                    let env = std::env::var("APP_ENV").unwrap_or_else(|_| "production".to_string());
                    if let Some(creds) = json_config.get_platform_for_env(platform, &env) {
                        return Some(json_config.apply_defaults(creds));
                    }
                }
            }
        }

        // Fall back to environment-based config
        self.get_platform_credentials_ref(platform).cloned()
    }

    /// Get platform credentials by reference (for backward compatibility)
    pub fn get_platform_credentials_ref(&self, platform: &str) -> Option<&PlatformCredentials> {
        match platform {
            "tiktok" => Some(&self.platforms.tiktok),
            "shopee" => Some(&self.platforms.shopee),
            "lazada" => Some(&self.platforms.lazada),
            "shopify" => Some(&self.platforms.shopify),
            "woocommerce" => Some(&self.platforms.woocommerce),
            "ecwid" => Some(&self.platforms.ecwid),
            "magento" => Some(&self.platforms.magento),
            "medusa" => Some(&self.platforms.medusa),
            "zoho" => Some(&self.platforms.zoho),
            "alibaba" => Some(&self.platforms.alibaba),
            "aliexpress" => Some(&self.platforms.aliexpress),
            "amazon" => Some(&self.platforms.amazon),
            "ebay" => Some(&self.platforms.ebay),
            "etsy" => Some(&self.platforms.etsy),
            "flipkart" => Some(&self.platforms.flipkart),
            "bigcommerce" => Some(&self.platforms.bigcommerce),
            "wix" => Some(&self.platforms.wix),
            "jd" => Some(&self.platforms.jd),
            "walmart" => Some(&self.platforms.walmart),
            "rakuten" => Some(&self.platforms.rakuten),
            "taobao" => Some(&self.platforms.taobao),
            "lineshopping" => Some(&self.platforms.lineshopping),
            _ => None,
        }
    }

    /// Check if a platform is enabled
    pub fn is_platform_enabled(&self, platform: &str) -> bool {
        if let Some(json_config) = &self.platform_credentials {
            if let Some(entry) = json_config.get_platform(platform) {
                return entry.enabled;
            }
        }

        // Check if platform exists in env config
        self.get_platform_credentials_ref(platform).is_some()
    }

    /// Get all enabled platforms
    pub fn get_enabled_platforms(&self) -> Vec<String> {
        let mut platforms = Vec::new();

        // Get from JSON config if available
        if let Some(json_config) = &self.platform_credentials {
            platforms.extend(json_config.get_enabled_platforms());
        } else {
            // Get from env config
            for platform in &["tiktok", "shopee", "lazada", "shopify", "woocommerce"] {
                if self.get_platform_credentials_ref(platform).is_some() {
                    platforms.push(platform.to_string());
                }
            }
        }

        platforms.sort();
        platforms.dedup();
        platforms
    }

    pub fn get_embedding_model(&self, model_id: &str) -> Option<&EmbeddingModel> {
        self.ai.embedding_models.get(model_id)
    }

    pub fn get_default_embedding_model(
        &self,
        platform: &str,
    ) -> Option<(&String, &EmbeddingModel)> {
        self.ai
            .embedding_models
            .iter()
            .find(|(_, model)| model.default_for_platforms.contains(&platform.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_single_secret_map() {
        let raw = r#"{"tenant_a":"whsec_live"}"#;
        let map = parse_webhook_secret_map(raw).expect("map");
        assert_eq!(
            map.get("tenant_a").unwrap(),
            &vec!["whsec_live".to_string()]
        );
    }

    #[test]
    fn parses_array_secret_map() {
        let raw = r#"{"tenant_b":["whsec_one","whsec_two"]}"#;
        let map = parse_webhook_secret_map(raw).expect("map");
        assert_eq!(
            map.get("tenant_b").unwrap(),
            &vec!["whsec_one".to_string(), "whsec_two".to_string()]
        );
    }

    #[test]
    fn parses_nested_object_secret_map() {
        let raw = r#"{"tenant_c":{"secrets":["whsec_rotated"]}}"#;
        let map = parse_webhook_secret_map(raw).expect("map");
        assert_eq!(
            map.get("tenant_c").unwrap(),
            &vec!["whsec_rotated".to_string()]
        );
    }
}
