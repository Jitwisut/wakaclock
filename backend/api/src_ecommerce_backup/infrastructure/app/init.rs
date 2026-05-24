/// ไฟล์ init.rs - สำหรับเริ่มต้นและสร้าง App Container
/// ใช้ Dependency Injection pattern แบบ Go-style
/// รวบรวม dependencies ทั้งหมดไว้ในที่เดียวสำหรับง่ายต่อการจัดการ
use anyhow::{Context, Result};
use std::collections::HashMap;
use std::sync::Arc;

use crate::client::{
    database::clickhouse::ClickHouseClient,
    ecommerce::connector::{
        AliExpressConnector, AlibabaConnector, AmazonConnector, ApiKeyConnector,
        BigCommerceConnector, ConnectorRegistry, EbayConnector, EcwidConnector, EtsyConnector,
        JDConnector, JwtConnector, LazadaConnector, ShopeeConnector, ShopifyConnector,
        TikTokConnector, WixConnector, ZohoConnector,
    },
};
use crate::config::Config;
use crate::infrastructure::{
    cache::{memory::MemoryCache, redis::RedisCache, CacheManager},
    logger::Logger,
    queue::{memory::MemoryQueue, rabbitmq::RabbitMqQueue, MessageQueue},
    sync::{NoopSyncStateManager, RedisSyncStateManager, SyncConfig, SyncStateManager},
    validator::Validator,
};
use crate::interfaces::platform::PlatformRegistry;
use crate::interfaces::platform_gateway::{GatewayFactory, GatewayFactoryImpl};

use super::stubs;
use crate::repository::{
    clickhouse::ClickHouseRepository,
    gateway::{GatewayRepository, GatewayRepositoryImpl},
    product_ingest::ProductIngestionRepository,
    unified_product::UnifiedProductRepository,
};
// use crate::services::gateway::GatewayService;
// use crate::services::gateway_impl::GatewayServiceImpl;

/// Enhanced App Container following Clean Architecture
/// โครงสร้าง App Container ที่ปฏิบัติตาม Clean Architecture
/// เก็บ dependencies ทั้งหมดของแอพพลิเคชันไว้ในที่เดียว
pub struct App {
    // Core Infrastructure
    // โครงสร้างพื้นฐานหลัก
    pub logger: Arc<Logger>,       // ระบบ logging แบบ structured
    pub config: Arc<Config>,       // main application configuration
    pub validator: Arc<Validator>, // ตรวจสอบความถูกต้องของข้อมูล

    // Database Management
    // จัดการฐานข้อมูล
    pub clickhouse: Arc<ClickHouseClient>, // ClickHouse client สำหรับ analytics
    pub database_manager: Arc<DatabaseManager>, // จัดการ database operations ทั้งหมด

    // Cache Management
    // จัดการ caching
    pub cache: Arc<dyn CacheManager>, // interface สำหรับ cache (Redis/Memory)
    pub cache_manager: Arc<CacheManagerWrapper>, // wrapper สำหรับจัดการ cache strategies

    // Queue Management
    // จัดการ message queue
    pub queue: Arc<dyn MessageQueue>, // interface สำหรับ queue (RabbitMQ/Memory)
    pub queue_manager: Arc<QueueManager>, // จัดการ queue operations ทั้งหมด

    // Security & Configuration
    // ความปลอดภัยและการตั้งค่า
    pub enforcer: Arc<dyn std::any::Any + Send + Sync>, // RBAC authorization (using stub for now)
    pub credential_store: Arc<CredentialStore>,         // เก็บ credentials แบบปลอดภัย
    pub initial_data: Arc<InitialData>,                 // ข้อมูลเริ่มต้นของระบบ

    // API Management
    // จัดการ API connections
    pub api_manager: Arc<ApiManager>, // จัดการ external APIs
    pub internal_api_manager: Arc<InternalApiManager>, // จัดการ internal APIs

    // Repositories
    // Data access layer
    pub product_repo: Arc<ClickHouseRepository>, // repository สำหรับ products
    pub unified_product_repo: Arc<UnifiedProductRepository>, // repository รวมทุก platform
    pub product_ingest_repo: Arc<ProductIngestionRepository>, // ingestion repository
    pub gateway_repo: Arc<dyn GatewayRepository>, // repository สำหรับ gateway data

    // Services
    // Business logic layer
    // pub gateway_service: Arc<dyn GatewayService>,  // Needs implementation
    pub gateway_factory: Arc<dyn GatewayFactory>, // factory สำหรับ platform gateway transports
    pub oauth_state_service: Arc<dyn crate::interfaces::OAuthStateInterface>, // OAuth state management

    pub services: Arc<ServiceRegistry>, // registry สำหรับ services ทั้งหมด

    // Sync state management
    pub sync_state_manager: Arc<dyn SyncStateManager>,

    // Platform Integration
    // เชื่อมต่อกับ e-commerce platforms
    pub platform_registry: Arc<PlatformRegistry>, // registry สำหรับ platform adapters
    pub connector_registry: Arc<ConnectorRegistry>, // registry สำหรับ platform connectors

    // Configuration
    // การตั้งค่าเพิ่มเติม
    pub response_config: Arc<ResponseConfig>, // config สำหรับ API responses
    pub upload_config: Arc<UploadConfig>,     // config สำหรับ file uploads

    // Memory Management
    // จัดการหน่วยความจำ
    pub file_data_pool: Arc<ObjectPool<FileContent>>, // object pool สำหรับ file operations

    // Application metadata
    // ข้อมูล metadata ของแอพพลิเคชัน
    pub metadata: AppMetadata,
}

/// Database Manager for unified database operations
/// ตัวจัดการฐานข้อมูลแบบรวมศูนย์ รวบรวม database operations ไว้ที่เดียว
pub struct DatabaseManager {
    clickhouse: Arc<ClickHouseClient>,
}

impl DatabaseManager {
    /// ตรวจสอบการเชื่อมต่อกับ database
    pub async fn ping(&self) -> Result<()> {
        self.clickhouse.health_check().await
    }

    /// สร้าง table และ indexes ใน database
    /// รองรับการสร้าง table แบบ dynamic ตาม schema ที่กำหนด
    pub async fn create_table_and_index(
        &self,
        table_name: &str,
        _indexes: HashMap<String, bool>,
        _options: &str,
    ) -> Result<()> {
        // Create table using ClickHouse execute method
        // This is a simplified implementation - in production, you'd build the DDL based on options
        let create_table_sql = format!(
            "CREATE TABLE IF NOT EXISTS {} (
                id String,
                data String,
                created_at DateTime DEFAULT now()
            ) ENGINE = MergeTree()
            ORDER BY id",
            table_name
        );
        self.clickhouse.execute(&create_table_sql).await
    }
}

/// Cache Manager Wrapper for advanced caching operations
pub struct CacheManagerWrapper {
    inner: Arc<dyn CacheManager>,
    stats: Arc<CacheStats>,
}

impl CacheManagerWrapper {
    pub async fn ping(&self) -> Result<()> {
        self.inner.ping().await
    }

    pub async fn get<T: serde::de::DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        match self.inner.get_json(key).await? {
            Some(json) => Ok(Some(serde_json::from_value(json)?)),
            None => Ok(None),
        }
    }

    pub async fn set<T: serde::Serialize>(&self, key: &str, value: &T, ttl: u64) -> Result<()> {
        let json = serde_json::to_value(value)?;
        self.inner.set_json(key, json, Some(ttl)).await
    }
}

/// Queue Manager for unified queue operations
pub struct QueueManager {
    inner: Arc<dyn MessageQueue>,
    retry_policy: RetryPolicy,
}

impl QueueManager {
    pub async fn ping(&self) -> Result<()> {
        // Queue health check - for now just return Ok
        Ok(())
    }
}

/// Credential Store for secure credential management
#[allow(dead_code)]
pub struct CredentialStore {
    credentials: HashMap<String, PlatformCredentials>,
}

/// Initial Data loaded at startup
#[allow(dead_code)]
pub struct InitialData {
    api_configs: HashMap<String, ApiConfig>,
    platform_configs: HashMap<String, PlatformConfig>,
}

/// API Manager for external API management
#[allow(dead_code)]
pub struct ApiManager {
    clients: HashMap<String, Arc<dyn ApiClient>>,
}

/// Internal API Manager for inter-service communication
#[allow(dead_code)]
pub struct InternalApiManager {
    endpoints: HashMap<String, Box<dyn InternalEndpoint>>,
}

/// Service Registry for all business services
#[allow(dead_code)]
pub struct ServiceRegistry {
    services: HashMap<String, Arc<dyn Service>>,
}

/// Response Configuration
#[allow(dead_code)]
pub struct ResponseConfig {
    default_format: ResponseFormat,
    etl_enabled: bool,
}

/// Upload Configuration
#[allow(dead_code)]
pub struct UploadConfig {
    pub max_file_size: usize,
    pub allowed_types: Vec<String>,
    pub storage_path: String,
    pub cf_worker_upload_url: Option<String>,
    pub cf_worker_download_url: Option<String>,
    pub cf_worker_token: Option<String>,
}

/// Object Pool for file content
/// ใช้ Object Pool pattern สำหรับ reuse file content objects
/// ลดการ allocate/deallocate memory บ่อยๆ
pub struct ObjectPool<T> {
    pool: Vec<T>,
    factory: Arc<dyn Fn() -> T + Send + Sync>,
}

/// File Content for object pool
/// โครงสร้างข้อมูลสำหรับเก็บเนื้อหาไฟล์ในระบบ
#[allow(dead_code)]
pub struct FileContent {
    data: Vec<u8>,          // ข้อมูล binary ของไฟล์
    metadata: FileMetadata, // metadata ของไฟล์ (ชื่อ, ขนาด, type)
}

/// Application metadata
/// ข้อมูล metadata ของแอพพลิเคชันสำหรับ tracking และ monitoring
#[derive(Clone)]
pub struct AppMetadata {
    /// Application name
    /// ชื่อแอพพลิเคชัน
    pub name: String,

    /// Application version
    /// เวอร์ชันของแอพพลิเคชัน (จาก Cargo.toml)
    pub version: String,

    /// Service name for distributed systems
    /// ชื่อ service สำหรับระบบ distributed tracing
    pub service_name: String,

    /// Environment (development, staging, production)
    /// สภาพแวดล้อมการทำงาน (dev, staging, prod)
    pub environment: String,
}

// Add missing imports for new types
use crate::client::api::ApiClient;
use crate::infrastructure::cache::CacheStats;
use crate::infrastructure::queue::RetryPolicy;
use crate::interfaces::service::Service;
use crate::model::config::ApiConfig;
use crate::model::FileMetadata;
use crate::model::PlatformConfig;
use crate::model::PlatformCredentials;
use crate::model::ResponseFormat;

// Trait definitions
pub trait InternalEndpoint: Send + Sync {
    fn path(&self) -> &str;
    fn method(&self) -> &str;
}

impl App {
    /// Create and initialize a new App with all dependencies
    /// สร้างและเริ่มต้น App Container พร้อม dependencies ทั้งหมด
    /// ฟังก์ชันนี้จะ initialize components ตามลำดับที่เหมาะสม
    pub async fn new() -> Result<Self> {
        // Initialize logger first
        // เริ่มต้น logger ก่อนเพื่อให้สามารถ log การ init components อื่นๆ ได้
        let logger = Logger::init().context("Failed to initialize logger")?;
        let logger = Arc::new(logger);

        // Load configuration
        // โหลด main application configuration
        let config = Config::from_env().context("Failed to load configuration")?;
        let config = Arc::new(config);

        // Initialize validator
        // สร้าง validator สำหรับตรวจสอบ input data
        let validator = Arc::new(Validator::new());

        // Initialize metadata
        // กำหนดข้อมูล metadata ของแอพพลิเคชัน
        let metadata = AppMetadata {
            name: "ecommerce-connect".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            service_name: "ecommerce-api".to_string(),
            environment: "production".to_string(), // Default environment
        };

        // Initialize Database Management
        // เริ่มต้นการเชื่อมต่อกับ database (ClickHouse)
        logger.info("Initializing database management", None);
        let clickhouse = Arc::new(
            ClickHouseClient::new(&config.database)
                .await
                .context("Failed to create ClickHouse client")?,
        );

        // สร้าง database manager สำหรับจัดการ database operations
        let database_manager = Arc::new(DatabaseManager {
            clickhouse: clickhouse.clone(),
        });

        // Initialize Cache Management
        // เริ่มต้นระบบ cache (เลือกใช้ Redis หรือ Memory cache ตาม config)
        logger.info("Initializing cache management", None);
        let cache: Arc<dyn CacheManager> = if !config.redis_url.is_empty() {
            let cache_config = crate::infrastructure::cache::CacheConfig {
                redis_url: Some(config.redis_url.clone()),
                memcache_url: None,
                max_connections: Some(10),
                connection_timeout: Some(10),
                default_ttl: Some(300), // Default 5 minutes
                enable_stats: true,
                max_memory_mb: Some(100),
                eviction_policy: Some(crate::infrastructure::cache::EvictionPolicy::Lru),
            };
            Arc::new(
                RedisCache::new(&cache_config, (*logger).clone())
                    .await
                    .context("Failed to connect to Redis")?,
            )
        } else {
            Arc::new(MemoryCache::new())
        };

        let cache_manager = Arc::new(CacheManagerWrapper {
            inner: cache.clone(),
            stats: Arc::new(CacheStats::default()),
        });

        // Initialize Queue Management
        logger.info("Initializing queue management", None);
        let queue: Arc<dyn MessageQueue> = if !config.rabbitmq.url.is_empty() {
            match RabbitMqQueue::new_with_settings(
                &config.rabbitmq.url,
                &config.rabbitmq.exchange,
                &config.rabbitmq.queue_prefix,
                config.rabbitmq.prefetch_count,
            )
            .await
            {
                Ok(rabbit_queue) => {
                    logger.info("Connected to RabbitMQ successfully", None);
                    Arc::new(rabbit_queue)
                }
                Err(e) => {
                    logger.warn(
                        &format!(
                            "Failed to connect to RabbitMQ ({}), falling back to MemoryQueue",
                            e
                        ),
                        None,
                    );
                    Arc::new(MemoryQueue::new())
                }
            }
        } else {
            logger.info("Using MemoryQueue (RabbitMQ URL not configured)", None);
            Arc::new(MemoryQueue::new())
        };

        let queue_manager = Arc::new(QueueManager {
            inner: queue.clone(),
            retry_policy: RetryPolicy::exponential(3, 1000),
        });

        let sync_state_manager: Arc<dyn SyncStateManager> = match RedisSyncStateManager::new(
            &config.redis_url,
            SyncConfig::default(),
            logger.as_ref().clone(),
        )
        .await
        {
            Ok(manager) => Arc::new(manager),
            Err(err) => {
                logger.warn(
                    &format!(
                        "Failed to initialize Redis sync state manager ({}), falling back to noop",
                        err
                    ),
                    None,
                );
                Arc::new(NoopSyncStateManager::default())
            }
        };

        // Initialize Security & Configuration
        logger.info("Initializing security and configuration", None);
        // Use stub enforcer for now since casbin config is not in main config
        let enforcer = Arc::new(stubs::StubEnforcer::new());

        let credential_store = Arc::new(CredentialStore {
            credentials: Self::load_credentials(&config).await?,
        });

        let initial_data = Arc::new(InitialData {
            api_configs: Self::load_api_configs(&config).await?,
            platform_configs: Self::load_platform_configs(&config).await?,
        });

        // Initialize API Management
        let api_manager = Arc::new(ApiManager {
            clients: HashMap::new(),
        });

        let internal_api_manager = Arc::new(InternalApiManager {
            endpoints: HashMap::new(),
        });

        // Initialize repositories
        logger.info("Initializing repositories", None);
        let product_repo = Arc::new(ClickHouseRepository::new(clickhouse.clone()));
        let unified_product_repo = Arc::new(UnifiedProductRepository::new(
            clickhouse.get_client(),
            clickhouse.get_database(),
        ));
        let product_ingest_repo = Arc::new(ProductIngestionRepository::new(clickhouse.clone()));

        let gateway_repo: Arc<dyn GatewayRepository> = Arc::new(GatewayRepositoryImpl::new(
            clickhouse.clone(),
            logger.clone(),
        ));

        // Initialize gateway factory for transport clients
        let gateway_factory: Arc<dyn GatewayFactory> = Arc::new(GatewayFactoryImpl::default());

        // Initialize services
        logger.info("Initializing services", None);
        // TODO: Implement gateway service
        // let gateway_service: Arc<dyn GatewayService> = Arc::new(GatewayServiceImpl::new(
        //     gateway_repo.clone(),
        //     logger.clone(),
        // ));

        // Initialize OAuth state service
        // Use Redis-specific implementation when Redis is available for better performance
        let oauth_state_service: Arc<dyn crate::interfaces::OAuthStateInterface> =
            if !config.redis_url.is_empty() {
                // Use Redis-specific OAuth state storage for production
                Arc::new(crate::infrastructure::oauth::RedisOAuthStateStorage::new(
                    cache.clone(),
                ))
            } else {
                // Fallback to generic cache-based OAuth state service for development
                Arc::new(crate::services::oauth_state::OAuthStateService::new(
                    cache.clone(),
                ))
            };

        let services = Arc::new(ServiceRegistry {
            services: HashMap::new(),
        });

        // Initialize Platform Integration
        let platform_registry = Arc::new(PlatformRegistry::new());
        let mut connector_registry = ConnectorRegistry::default();
        let config_handle = config.clone();

        connector_registry.register(Arc::new(ShopifyConnector::new(config_handle.clone())));
        connector_registry.register(Arc::new(TikTokConnector::new(config_handle.clone())));
        connector_registry.register(Arc::new(ShopeeConnector::new(config_handle.clone())));
        connector_registry.register(Arc::new(LazadaConnector::new(config_handle.clone())));
        connector_registry.register(Arc::new(AlibabaConnector::new(config_handle.clone())));
        connector_registry.register(Arc::new(AliExpressConnector::new(config_handle.clone())));
        connector_registry.register(Arc::new(AmazonConnector::new(config_handle.clone())));
        connector_registry.register(Arc::new(EbayConnector::new(config_handle.clone())));
        connector_registry.register(Arc::new(EtsyConnector::new(config_handle.clone())));
        connector_registry.register(Arc::new(BigCommerceConnector::new(config_handle.clone())));
        connector_registry.register(Arc::new(WixConnector::new(config_handle.clone())));
        connector_registry.register(Arc::new(EcwidConnector::new(config_handle.clone())));
        connector_registry.register(Arc::new(ZohoConnector::new(config_handle.clone())));
        connector_registry.register(Arc::new(JDConnector::new(config_handle.clone())));

        connector_registry.register(Arc::new(ApiKeyConnector::new(
            "woocommerce",
            vec!["consumer_key", "consumer_secret", "store_url"],
            "Collect WooCommerce consumer credentials and store URL, then submit them via the shop connect API.",
            Some(
                "WooCommerce requires API key authentication. Please provide API credentials."
                    .to_string(),
            ),
        )));
        connector_registry.register(Arc::new(ApiKeyConnector::new(
            "magento",
            vec!["api_key", "api_secret", "store_url"],
            "Collect Magento API key/secret and store URL before invoking the connect endpoint.",
            Some(
                "Magento requires API key authentication. Please provide API credentials."
                    .to_string(),
            ),
        )));
        connector_registry.register(Arc::new(ApiKeyConnector::new(
            "lineshopping",
            vec!["api_key"],
            "Collect a LINE Shopping API key and submit it to POST /api/v1/{app_name}/platform/shop/{shop_id}/connect/lineshopping.",
            Some(
                "LINE Shopping requires API key authentication. Please provide API credentials."
                    .to_string(),
            ),
        )));
        connector_registry.register(Arc::new(ApiKeyConnector::new(
            "odoo",
            vec!["base_url", "database", "username", "api_key"],
            "Collect the Odoo base URL, database name, username/email, and API key, then submit them via the shop connect API (auth.type = basic).",
            Some(
                "Odoo issues API keys per user. Provide the instance URL plus credentials generated in User Settings → API Access."
                    .to_string(),
            ),
        )));
        connector_registry.register(Arc::new(ApiKeyConnector::new(
            "erpnext",
            vec!["base_url", "api_key", "api_secret"],
            "Generate an ERPNext API Key + Secret for the integration user and send them along with the base URL through the connect endpoint.",
            Some(
                "ERPNext uses token-based authentication (`Authorization: token api_key:api_secret`). Supply both values and the instance URL."
                    .to_string(),
            ),
        )));
        connector_registry.register(Arc::new(ApiKeyConnector::new(
            "taobao",
            vec!["app_key", "app_secret", "redirect_uri"],
            "Provide the Taobao app_key, app_secret, and redirect_uri configured in the Taobao developer console.",
            Some(
                "Taobao requires the app’s key/secret plus the callback URL registered in Taobao Open Platform."
                    .to_string(),
            ),
        )));

        connector_registry.register(Arc::new(JwtConnector::new(
            "medusa",
            vec!["api_key", "store_url"],
            "Provide an API key with JWT issuance rights and the store URL to complete the connection.",
        )));

        let connector_registry = Arc::new(connector_registry);

        // Initialize Configuration
        let response_config = Arc::new(ResponseConfig {
            default_format: ResponseFormat::Json,
            etl_enabled: true,
        });

        let upload_config = Arc::new(UploadConfig {
            max_file_size: 10 * 1024 * 1024, // 10MB
            allowed_types: vec!["image/jpeg".to_string(), "image/png".to_string()],
            storage_path: "/tmp/uploads".to_string(),
            cf_worker_upload_url: config.media.cf_worker_upload_url.clone(),
            cf_worker_download_url: config.media.cf_worker_download_url.clone(),
            cf_worker_token: config.media.cf_worker_api_token.clone(),
        });

        // Initialize Memory Management
        let file_data_pool = Arc::new(ObjectPool {
            pool: Vec::new(),
            factory: Arc::new(|| FileContent {
                data: Vec::new(),
                metadata: FileMetadata::default(),
            }),
        });

        Ok(App {
            // Core Infrastructure
            logger,
            config,
            validator,

            // Database Management
            clickhouse,
            database_manager,

            // Cache Management
            cache,
            cache_manager,

            // Queue Management
            queue,
            queue_manager,

            // Security & Configuration
            enforcer,
            credential_store,
            initial_data,

            // API Management
            api_manager,
            internal_api_manager,

            // Repositories
            product_repo,
            unified_product_repo,
            product_ingest_repo,
            gateway_repo,

            // Services
            // gateway_service,  // TODO: Implement gateway service
            gateway_factory,
            oauth_state_service,
            services,

            sync_state_manager,

            // Platform Integration
            platform_registry,
            connector_registry,

            // Configuration
            response_config,
            upload_config,

            // Memory Management
            file_data_pool,

            // Metadata
            metadata,
        })
    }

    // Helper methods for loading configuration
    async fn load_credentials(_config: &Config) -> Result<HashMap<String, PlatformCredentials>> {
        let mut credentials = HashMap::new();

        // Load from environment or config file
        if let Ok(creds_json) = std::fs::read_to_string("credentials/platform_credentials.json") {
            if let Ok(parsed) =
                serde_json::from_str::<HashMap<String, PlatformCredentials>>(&creds_json)
            {
                credentials = parsed;
            }
        }

        Ok(credentials)
    }

    async fn load_api_configs(_config: &Config) -> Result<HashMap<String, ApiConfig>> {
        let mut configs = HashMap::new();

        // Load from environment or config file
        if let Ok(config_json) = std::fs::read_to_string("credentials/api_config.json") {
            if let Ok(parsed) = serde_json::from_str::<HashMap<String, ApiConfig>>(&config_json) {
                configs = parsed;
            }
        }

        Ok(configs)
    }

    async fn load_platform_configs(_config: &Config) -> Result<HashMap<String, PlatformConfig>> {
        let mut configs = HashMap::new();

        // Load from environment or config file
        if let Ok(config_json) = std::fs::read_to_string("credentials/platform_config.json") {
            if let Ok(parsed) =
                serde_json::from_str::<HashMap<String, PlatformConfig>>(&config_json)
            {
                configs = parsed;
            }
        }

        Ok(configs)
    }

    // /// Get gateway service
    // pub fn gateway_service(&self) -> Arc<dyn GatewayService> {
    //     Arc::clone(&self.gateway_service)
    // }

    /// Convenience accessor for the ClickHouse product repository so upper
    /// layers do not need to construct fresh instances on every call.
    pub fn product_repository(&self) -> Arc<ClickHouseRepository> {
        self.product_repo.clone()
    }

    /// Accessor for the product ingestion repository used by webhook/crawler pipelines.
    pub fn product_ingestion_repository(&self) -> Arc<ProductIngestionRepository> {
        self.product_ingest_repo.clone()
    }

    /// Expose the configured gateway repository for services that need it.
    pub fn gateway_repository(&self) -> Arc<dyn GatewayRepository> {
        self.gateway_repo.clone()
    }

    /// Retrieve the gateway factory for creating platform transports.
    pub fn gateway_factory(&self) -> Arc<dyn GatewayFactory> {
        self.gateway_factory.clone()
    }

    /// Retrieve the platform registry that holds registered platform adapters.
    pub fn platform_registry(&self) -> Arc<PlatformRegistry> {
        self.platform_registry.clone()
    }

    /// Obtain a cloned cache manager wrapper for request scoped usage.
    pub fn cache_manager(&self) -> Arc<CacheManagerWrapper> {
        self.cache_manager.clone()
    }

    /// Provide access to the configured message queue.
    pub fn message_queue(&self) -> Arc<dyn MessageQueue> {
        self.queue.clone()
    }

    /// Register all platform integrations
    pub async fn register_platforms(&self) -> Result<()> {
        // Platform registrations will be added as integrations are implemented
        Ok(())
    }

    /// Gracefully shutdown the application
    pub async fn shutdown(&self) -> Result<()> {
        self.logger.info("Shutting down application", None);

        // Close queue connections if RabbitMQ
        if let Some(rabbit_queue) = self.queue.as_any().downcast_ref::<RabbitMqQueue>() {
            rabbit_queue.close().await?;
        }

        // Flush cache if needed
        self.cache.flush().await?;

        self.logger.info("Application shutdown complete", None);
        Ok(())
    }

    /// Health check for the application
    pub async fn health_check(&self) -> Result<AppHealth> {
        let mut health = AppHealth {
            status: HealthStatus::Healthy,
            components: Vec::new(),
        };

        // Check ClickHouse
        let db_healthy = self.clickhouse.health_check().await.is_ok();
        health.components.push(ComponentHealth {
            name: "clickhouse".to_string(),
            status: if db_healthy {
                HealthStatus::Healthy
            } else {
                HealthStatus::Unhealthy
            },
        });

        // Check cache
        let cache_healthy = self.cache.ping().await.is_ok();
        health.components.push(ComponentHealth {
            name: "cache".to_string(),
            status: if cache_healthy {
                HealthStatus::Healthy
            } else {
                HealthStatus::Unhealthy
            },
        });

        // Check queue
        // TODO: Add health check method to MessageQueue trait
        let queue_healthy = true; // Assume healthy for now
        health.components.push(ComponentHealth {
            name: "queue".to_string(),
            status: if queue_healthy {
                HealthStatus::Healthy
            } else {
                HealthStatus::Unhealthy
            },
        });

        // Set overall status
        if health
            .components
            .iter()
            .any(|c| c.status == HealthStatus::Unhealthy)
        {
            health.status = HealthStatus::Unhealthy;
        }

        Ok(health)
    }
}

/// Application health status
#[derive(Debug, Clone, serde::Serialize)]
pub struct AppHealth {
    pub status: HealthStatus,
    pub components: Vec<ComponentHealth>,
}

/// Component health status
#[derive(Debug, Clone, serde::Serialize)]
pub struct ComponentHealth {
    pub name: String,
    pub status: HealthStatus,
}

/// Health status enum
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub enum HealthStatus {
    Healthy,
    Unhealthy,
    Degraded,
}

/// Create a new App instance (convenience function)
pub async fn new_app() -> Result<App> {
    App::new().await
}

// Default implementations
// CacheStats uses derive(Default) now

impl Default for FileMetadata {
    fn default() -> Self {
        FileMetadata {
            filename: String::new(),
            content_type: String::new(),
            size: 0,
            created_at: chrono::Utc::now(),
        }
    }
}

impl<T> ObjectPool<T> {
    pub fn new(factory: impl Fn() -> T + Send + Sync + 'static) -> Self {
        Self {
            pool: Vec::new(),
            factory: Arc::new(factory),
        }
    }

    pub fn get(&mut self) -> T {
        self.pool.pop().unwrap_or_else(|| (self.factory)())
    }

    pub fn put(&mut self, item: T) {
        self.pool.push(item);
    }
}

// RetryPolicy implementation is in infrastructure/queue/retry.rs
