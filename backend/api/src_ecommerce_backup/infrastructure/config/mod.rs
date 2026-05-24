/// # Infrastructure Configuration Module - โมดูลการกำหนดค่าโครงสร้างพื้นฐาน
/// โมดูลหลักสำหรับจัดการการกำหนดค่าทั้งหมดของระบบ
/// รวมถึง database, cache, queue, authentication, และ platform integrations
///
/// ## ความสำคัญ
/// - กำหนดค่าการเชื่อมต่อ database (ClickHouse, Qdrant)
/// - จัดการ platform credentials สำหรับ e-commerce integrations
/// - กำหนดค่า authentication และ security settings
/// - จัดการ worker configurations และ background jobs
/// - รองรับการโหลดค่าจาก environment variables และไฟล์
///
/// ## การใช้งาน
/// - โหลดค่าจาก .env ด้วย `Config::from_env()`
/// - บันทึกและโหลดจากไฟล์ JSON
/// - รองรับ hot-reload สำหรับ development
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::config::CompletionModel;

/// โครงสร้างการกำหนดค่าหลักของระบบ
/// รวมการกำหนดค่าทุก component ไว้ในที่เดียว
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// การกำหนดค่า HTTP server และ API endpoints
    pub server: ServerConfig,
    /// การกำหนดค่าฐานข้อมูล (ClickHouse, Qdrant)
    pub database: DatabaseConfig,
    /// การกำหนดค่า cache (Redis, memory)
    pub cache: CacheConfig,
    /// การกำหนดค่า message queue (RabbitMQ)
    pub queue: QueueConfig,
    /// การกำหนดค่า e-commerce platforms และ credentials
    pub platforms: PlatformConfig,
    /// การกำหนดค่า authentication และ security
    pub auth: AuthConfig,
    /// การกำหนดค่า background workers
    pub worker: WorkerConfig,
    /// การกำหนดค่า authorization engine (Casbin)
    pub casbin: CasbinConfig,
    /// การกำหนดค่า quota และ rate limiting
    pub quota: QuotaConfig,
    /// การกำหนดค่า AI services (OpenAI, embeddings)
    pub ai: AiConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub cors_origins: Vec<String>,
    pub request_timeout_secs: u64,
    pub max_body_size: usize,
    pub base_url: Option<String>, // Legacy compatibility
    pub service_name: Option<String>,
    pub environment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub clickhouse_url: String,
    pub clickhouse_database: String,
    pub qdrant_url: String,
    pub max_connections: u32,
    pub connection_timeout_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub cache_type: String, // "redis" or "memory"
    pub redis_url: Option<String>,
    pub default_ttl_secs: u64,
    pub max_memory_items: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueConfig {
    pub queue_type: String, // "rabbitmq" or "memory"
    pub rabbitmq_url: Option<String>,
    pub rabbitmq_exchange: Option<String>,
    pub rabbitmq_queue_prefix: Option<String>,
    pub max_retries: u32,
    pub retry_delay_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformConfig {
    pub credentials: HashMap<String, PlatformCredentials>,
    pub rate_limits: HashMap<String, RateLimitConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformCredentials {
    pub app_key: Option<String>,
    pub app_secret: Option<String>,
    pub api_key: Option<String>,
    pub api_secret: Option<String>,
    pub base_url: Option<String>,
    pub extra: HashMap<String, String>,
    pub market: Option<String>,
    pub service_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub requests_per_second: u32,
    pub requests_per_minute: u32,
    pub burst_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub strapi_url: String,
    pub x_auth_token: String,
    pub x_auth_token_secret: Option<String>, // Legacy compatibility
    pub jwt_secret: String,
    pub token_expiry_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerConfig {
    pub enabled: bool,
    pub num_workers: usize,
    pub job_timeout_secs: u64,
    pub poll_interval_ms: u64,
    pub batch_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CasbinConfig {
    pub model_path: String,
    pub policy_path: String,
    pub enable_log: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    pub llm_api_base_url: String,
    pub llm_api_key: String,
    pub llm_timeout_ms: u64,
    pub llm_retry_max: u32,
    pub completion_models: HashMap<String, CompletionModel>,
    pub default_completion_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaConfig {
    pub initial_per_month: i64,
    pub max_per_month: i64,
    pub enabled: bool,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();

        Ok(Self {
            server: ServerConfig {
                host: std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
                port: std::env::var("PORT")
                    .unwrap_or_else(|_| "8080".to_string())
                    .parse()?,
                cors_origins: std::env::var("CORS_ORIGINS")
                    .unwrap_or_else(|_| "*".to_string())
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .collect(),
                request_timeout_secs: std::env::var("REQUEST_TIMEOUT_SECS")
                    .unwrap_or_else(|_| "30".to_string())
                    .parse()?,
                max_body_size: std::env::var("MAX_BODY_SIZE")
                    .unwrap_or_else(|_| "10485760".to_string()) // 10MB
                    .parse()?,
                base_url: std::env::var("BASE_URL").ok(),
                service_name: std::env::var("SERVICE_NAME").ok(),
                environment: std::env::var("ENVIRONMENT")
                    .unwrap_or_else(|_| "development".to_string()),
            },
            database: DatabaseConfig {
                clickhouse_url: std::env::var("CLICKHOUSE_URL")
                    .unwrap_or_else(|_| "http://localhost:8123".to_string()),
                clickhouse_database: std::env::var("CLICKHOUSE_DATABASE")
                    .unwrap_or_else(|_| "ecommerce".to_string()),
                qdrant_url: std::env::var("QDRANT_URL")
                    .unwrap_or_else(|_| "http://localhost:6334".to_string()),
                max_connections: std::env::var("DB_MAX_CONNECTIONS")
                    .unwrap_or_else(|_| "10".to_string())
                    .parse()?,
                connection_timeout_secs: std::env::var("DB_CONNECTION_TIMEOUT_SECS")
                    .unwrap_or_else(|_| "5".to_string())
                    .parse()?,
            },
            cache: CacheConfig {
                cache_type: std::env::var("CACHE_TYPE").unwrap_or_else(|_| "memory".to_string()),
                redis_url: std::env::var("REDIS_URL").ok(),
                default_ttl_secs: std::env::var("CACHE_DEFAULT_TTL_SECS")
                    .unwrap_or_else(|_| "300".to_string())
                    .parse()?,
                max_memory_items: std::env::var("CACHE_MAX_MEMORY_ITEMS")
                    .unwrap_or_else(|_| "1000".to_string())
                    .parse()?,
            },
            queue: QueueConfig {
                queue_type: std::env::var("QUEUE_TYPE").unwrap_or_else(|_| "memory".to_string()),
                rabbitmq_url: std::env::var("RABBITMQ_URL").ok(),
                rabbitmq_exchange: std::env::var("RABBITMQ_EXCHANGE").ok(),
                rabbitmq_queue_prefix: std::env::var("RABBITMQ_QUEUE_PREFIX").ok(),
                max_retries: std::env::var("QUEUE_MAX_RETRIES")
                    .unwrap_or_else(|_| "3".to_string())
                    .parse()?,
                retry_delay_secs: std::env::var("QUEUE_RETRY_DELAY_SECS")
                    .unwrap_or_else(|_| "60".to_string())
                    .parse()?,
            },
            platforms: Self::load_platform_config()?,
            auth: AuthConfig {
                strapi_url: std::env::var("STRAPI_URL")
                    .unwrap_or_else(|_| "http://localhost:1337".to_string()),
                x_auth_token: std::env::var("X_AUTH_TOKEN")
                    .unwrap_or_else(|_| "development-token".to_string()),
                x_auth_token_secret: std::env::var("X_AUTH_TOKEN_SECRET").ok(),
                jwt_secret: std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string()),
                token_expiry_secs: std::env::var("TOKEN_EXPIRY_SECS")
                    .unwrap_or_else(|_| "3600".to_string())
                    .parse()?,
            },
            worker: WorkerConfig {
                enabled: std::env::var("WORKER_ENABLED")
                    .unwrap_or_else(|_| "false".to_string())
                    .parse()?,
                num_workers: std::env::var("NUM_WORKERS")
                    .unwrap_or_else(|_| "4".to_string())
                    .parse()?,
                job_timeout_secs: std::env::var("JOB_TIMEOUT_SECS")
                    .unwrap_or_else(|_| "300".to_string())
                    .parse()?,
                poll_interval_ms: std::env::var("WORKER_POLL_INTERVAL_MS")
                    .unwrap_or_else(|_| "1000".to_string())
                    .parse()?,
                batch_size: std::env::var("WORKER_BATCH_SIZE")
                    .unwrap_or_else(|_| "100".to_string())
                    .parse()?,
            },
            casbin: CasbinConfig {
                model_path: std::env::var("CASBIN_MODEL_PATH")
                    .unwrap_or_else(|_| "./credentials/model.conf".to_string()),
                policy_path: std::env::var("CASBIN_POLICY_PATH")
                    .unwrap_or_else(|_| "./credentials/policy.csv".to_string()),
                enable_log: std::env::var("CASBIN_ENABLE_LOG")
                    .unwrap_or_else(|_| "false".to_string())
                    .parse()
                    .unwrap_or(false),
            },
            quota: QuotaConfig {
                initial_per_month: std::env::var("QUOTA_INITIAL_PER_MONTH")
                    .unwrap_or_else(|_| "1000".to_string())
                    .parse()?,
                max_per_month: std::env::var("QUOTA_MAX_PER_MONTH")
                    .unwrap_or_else(|_| "10000".to_string())
                    .parse()?,
                enabled: std::env::var("QUOTA_ENABLED")
                    .unwrap_or_else(|_| "false".to_string())
                    .parse()?,
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
                        .parse()?,
                    llm_retry_max: std::env::var("OPENAI_RETRY_MAX")
                        .unwrap_or_else(|_| "3".to_string())
                        .parse()?,
                    completion_models,
                    default_completion_model: Some("lite-chat".to_string()),
                }
            },
        })
    }

    /// Load platform configuration from environment or file
    fn load_platform_config() -> Result<PlatformConfig> {
        let mut credentials = HashMap::new();
        let mut rate_limits = HashMap::new();

        // Load TikTok config
        if let (Ok(app_key), Ok(app_secret)) = (
            std::env::var("TIKTOK_APP_KEY"),
            std::env::var("TIKTOK_APP_SECRET"),
        ) {
            credentials.insert(
                "tiktok".to_string(),
                PlatformCredentials {
                    app_key: Some(app_key),
                    app_secret: Some(app_secret),
                    api_key: None,
                    api_secret: None,
                    base_url: Some("https://open-api.tiktokglobalshop.com".to_string()),
                    extra: HashMap::new(),
                    market: std::env::var("TIKTOK_MARKET").ok(),
                    service_id: std::env::var("TIKTOK_SERVICE_ID").ok(),
                },
            );

            rate_limits.insert(
                "tiktok".to_string(),
                RateLimitConfig {
                    requests_per_second: 10,
                    requests_per_minute: 500,
                    burst_size: 20,
                },
            );
        }

        // Load Lazada config
        let lazada_app_key =
            std::env::var("LAZADA_APP_KEY").unwrap_or_else(|_| "125832".to_string());
        let lazada_app_secret = std::env::var("LAZADA_APP_SECRET")
            .unwrap_or_else(|_| "0aba2e83a4296419bf27e76e2fb063f46e90cf30".to_string());

        if !lazada_app_key.is_empty() && !lazada_app_secret.is_empty() {
            credentials.insert(
                "lazada".to_string(),
                PlatformCredentials {
                    app_key: Some(lazada_app_key),
                    app_secret: Some(lazada_app_secret),
                    api_key: None,
                    api_secret: None,
                    base_url: Some("https://api.lazada.sg/rest".to_string()),
                    extra: HashMap::new(),
                    market: std::env::var("LAZADA_MARKET").ok(),
                    service_id: std::env::var("LAZADA_SERVICE_ID").ok(),
                },
            );

            rate_limits.insert(
                "lazada".to_string(),
                RateLimitConfig {
                    requests_per_second: 10,
                    requests_per_minute: 500,
                    burst_size: 20,
                },
            );
        }

        // Load Shopee config
        let shopee_partner_id =
            std::env::var("SHOPEE_PARTNER_ID").unwrap_or_else(|_| "1003034".to_string());
        let shopee_partner_key = std::env::var("SHOPEE_PARTNER_KEY").unwrap_or_else(|_| {
            "8d16623761ed86bfe6cc1da01b32e5a5af8dfbcf61d990aaeeac735b3b38b684".to_string()
        });

        if !shopee_partner_id.is_empty() && !shopee_partner_key.is_empty() {
            let mut extra = HashMap::new();
            extra.insert("partner_id".to_string(), shopee_partner_id.clone());

            credentials.insert(
                "shopee".to_string(),
                PlatformCredentials {
                    app_key: Some(shopee_partner_id), // Partner ID should be in app_key
                    app_secret: Some(shopee_partner_key), // Partner key should be in app_secret
                    api_key: None,
                    api_secret: None,
                    base_url: Some("https://partner.shopeemobile.com".to_string()),
                    extra,
                    market: None,
                    service_id: None,
                },
            );

            rate_limits.insert(
                "shopee".to_string(),
                RateLimitConfig {
                    requests_per_second: 5,
                    requests_per_minute: 200,
                    burst_size: 10,
                },
            );
        }

        // Load Shopify config
        let shopify_api_key =
            std::env::var("SHOPIFY_API_KEY").unwrap_or_else(|_| "default_shopify_key".to_string());
        let shopify_api_secret = std::env::var("SHOPIFY_API_SECRET")
            .unwrap_or_else(|_| "default_shopify_secret".to_string());

        if !shopify_api_key.is_empty() && !shopify_api_secret.is_empty() {
            credentials.insert(
                "shopify".to_string(),
                PlatformCredentials {
                    app_key: Some(shopify_api_key),
                    app_secret: Some(shopify_api_secret),
                    api_key: None,
                    api_secret: None,
                    base_url: Some("https://myshopify.com".to_string()),
                    extra: HashMap::new(),
                    market: None,
                    service_id: None,
                },
            );
            rate_limits.insert(
                "shopify".to_string(),
                RateLimitConfig {
                    requests_per_second: 4,
                    requests_per_minute: 240,
                    burst_size: 10,
                },
            );
        }

        // Load WooCommerce config
        credentials.insert(
            "woocommerce".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("WOOCOMMERCE_KEY")
                        .unwrap_or_else(|_| "default_woo_key".to_string()),
                ),
                app_secret: Some(
                    std::env::var("WOOCOMMERCE_SECRET")
                        .unwrap_or_else(|_| "default_woo_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: std::env::var("WOOCOMMERCE_URL").ok(),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load Amazon config
        credentials.insert(
            "amazon".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("AMAZON_CLIENT_ID")
                        .unwrap_or_else(|_| "default_amazon_id".to_string()),
                ),
                app_secret: Some(
                    std::env::var("AMAZON_CLIENT_SECRET")
                        .unwrap_or_else(|_| "default_amazon_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: Some("https://sellingpartnerapi.amazon.com".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load eBay config
        credentials.insert(
            "ebay".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("EBAY_CLIENT_ID")
                        .unwrap_or_else(|_| "default_ebay_id".to_string()),
                ),
                app_secret: Some(
                    std::env::var("EBAY_CLIENT_SECRET")
                        .unwrap_or_else(|_| "default_ebay_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: Some("https://api.ebay.com".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load Alibaba config
        credentials.insert(
            "alibaba".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("ALIBABA_APP_KEY")
                        .unwrap_or_else(|_| "default_alibaba_key".to_string()),
                ),
                app_secret: Some(
                    std::env::var("ALIBABA_APP_SECRET")
                        .unwrap_or_else(|_| "default_alibaba_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: Some("https://gw.open.1688.com".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load AliExpress config
        credentials.insert(
            "aliexpress".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("ALIEXPRESS_APP_KEY")
                        .unwrap_or_else(|_| "default_aliexpress_key".to_string()),
                ),
                app_secret: Some(
                    std::env::var("ALIEXPRESS_APP_SECRET")
                        .unwrap_or_else(|_| "default_aliexpress_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: Some("https://api-sg.aliexpress.com".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load Etsy config
        credentials.insert(
            "etsy".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("ETSY_API_KEY")
                        .unwrap_or_else(|_| "default_etsy_key".to_string()),
                ),
                app_secret: Some(
                    std::env::var("ETSY_API_SECRET")
                        .unwrap_or_else(|_| "default_etsy_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: Some("https://openapi.etsy.com".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load Flipkart config
        credentials.insert(
            "flipkart".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("FLIPKART_APP_ID")
                        .unwrap_or_else(|_| "default_flipkart_id".to_string()),
                ),
                app_secret: Some(
                    std::env::var("FLIPKART_APP_SECRET")
                        .unwrap_or_else(|_| "default_flipkart_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: Some("https://api.flipkart.net".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load BigCommerce config
        credentials.insert(
            "bigcommerce".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("BIGCOMMERCE_CLIENT_ID")
                        .unwrap_or_else(|_| "default_bigcommerce_id".to_string()),
                ),
                app_secret: Some(
                    std::env::var("BIGCOMMERCE_CLIENT_SECRET")
                        .unwrap_or_else(|_| "default_bigcommerce_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: Some("https://api.bigcommerce.com".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load Wix config
        credentials.insert(
            "wix".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("WIX_APP_ID").unwrap_or_else(|_| "default_wix_id".to_string()),
                ),
                app_secret: Some(
                    std::env::var("WIX_APP_SECRET")
                        .unwrap_or_else(|_| "default_wix_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: Some("https://www.wixapis.com".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load Ecwid config
        credentials.insert(
            "ecwid".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("ECWID_CLIENT_ID")
                        .unwrap_or_else(|_| "default_ecwid_id".to_string()),
                ),
                app_secret: Some(
                    std::env::var("ECWID_CLIENT_SECRET")
                        .unwrap_or_else(|_| "default_ecwid_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: Some("https://app.ecwid.com".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load Magento config
        credentials.insert(
            "magento".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("MAGENTO_CONSUMER_KEY")
                        .unwrap_or_else(|_| "default_magento_key".to_string()),
                ),
                app_secret: Some(
                    std::env::var("MAGENTO_CONSUMER_SECRET")
                        .unwrap_or_else(|_| "default_magento_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: std::env::var("MAGENTO_URL").ok(),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load Medusa config
        credentials.insert(
            "medusa".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("MEDUSA_API_KEY")
                        .unwrap_or_else(|_| "default_medusa_key".to_string()),
                ),
                app_secret: None,
                api_key: None,
                api_secret: None,
                base_url: std::env::var("MEDUSA_URL").ok(),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load Zoho Commerce config
        credentials.insert(
            "zoho".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("ZOHO_CLIENT_ID")
                        .unwrap_or_else(|_| "default_zoho_id".to_string()),
                ),
                app_secret: Some(
                    std::env::var("ZOHO_CLIENT_SECRET")
                        .unwrap_or_else(|_| "default_zoho_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: Some("https://commerce.zoho.com".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load LINE Shopping config
        credentials.insert(
            "lineshopping".to_string(),
            PlatformCredentials {
                app_key: None,
                app_secret: None,
                api_key: Some(
                    std::env::var("LINE_CHANNEL_ACCESS_TOKEN")
                        .unwrap_or_else(|_| "default_line_token".to_string()),
                ),
                api_secret: None,
                base_url: Some("https://api.line.me".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load Taobao config
        credentials.insert(
            "taobao".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("TAOBAO_APP_KEY")
                        .unwrap_or_else(|_| "default_taobao_key".to_string()),
                ),
                app_secret: Some(
                    std::env::var("TAOBAO_APP_SECRET")
                        .unwrap_or_else(|_| "default_taobao_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: Some("https://eco.taobao.com".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load JD config
        credentials.insert(
            "jd".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("JD_APP_KEY").unwrap_or_else(|_| "default_jd_key".to_string()),
                ),
                app_secret: Some(
                    std::env::var("JD_APP_SECRET")
                        .unwrap_or_else(|_| "default_jd_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: Some("https://api.jd.com".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load Walmart config
        credentials.insert(
            "walmart".to_string(),
            PlatformCredentials {
                app_key: Some(
                    std::env::var("WALMART_CLIENT_ID")
                        .unwrap_or_else(|_| "default_walmart_id".to_string()),
                ),
                app_secret: Some(
                    std::env::var("WALMART_CLIENT_SECRET")
                        .unwrap_or_else(|_| "default_walmart_secret".to_string()),
                ),
                api_key: None,
                api_secret: None,
                base_url: Some("https://marketplace.walmartapis.com".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        // Load Rakuten config
        credentials.insert(
            "rakuten".to_string(),
            PlatformCredentials {
                app_key: None,
                app_secret: None,
                api_key: Some(
                    std::env::var("RAKUTEN_API_KEY")
                        .unwrap_or_else(|_| "default_rakuten_key".to_string()),
                ),
                api_secret: None,
                base_url: Some("https://api.rakuten.net".to_string()),
                extra: HashMap::new(),
                market: None,
                service_id: None,
            },
        );

        Ok(PlatformConfig {
            credentials,
            rate_limits,
        })
    }

    /// Load configuration from file
    pub fn from_file(path: &str) -> Result<Self> {
        let contents = std::fs::read_to_string(path)?;
        let config: Self = serde_json::from_str(&contents)?;
        Ok(config)
    }

    /// Save configuration to file
    pub fn save_to_file(&self, path: &str) -> Result<()> {
        let contents = serde_json::to_string_pretty(self)?;
        std::fs::write(path, contents)?;
        Ok(())
    }

    /// Get platform credentials - compatibility with main config
    pub fn get_platform_credentials(
        &self,
        platform: &str,
    ) -> anyhow::Result<crate::config::PlatformCredentials> {
        if let Some(creds) = self.platforms.credentials.get(platform) {
            Ok(crate::config::PlatformCredentials {
                api_key: creds.api_key.clone().unwrap_or_default(),
                app_key: creds.app_key.clone().unwrap_or_default(),
                app_secret: creds.app_secret.clone().unwrap_or_default(),
                redirect_uri: creds.base_url.clone(),
                api_base_url: creds.base_url.clone().unwrap_or_default(),
                rate_limit_rps: 10.0, // Default rate limit
                oauth_authorize_url: None,
                oauth_token_url: None,
                oauth_refresh_url: None,
                oauth_revoke_url: None,
                store_id: creds.extra.get("store_id").cloned(),
                base_url: creds.base_url.clone(),
                tenant_id: creds.extra.get("tenant_id").cloned(),
                market: creds.market.clone(),
                service_id: creds.service_id.clone(),
            })
        } else {
            Err(anyhow::anyhow!("Platform {} not configured", platform))
        }
    }

    /// Get default embedding model - compatibility stub
    pub fn get_default_embedding_model(&self) -> String {
        // TODO: Add embedding model to config
        "text-embedding-ada-002".to_string()
    }
}
