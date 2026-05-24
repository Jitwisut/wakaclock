/// # Client Layer - ชั้น Client
/// โมดูลหลักสำหรับจัดการ clients ทั้งหมดในระบบ
/// รวมถึงการติดต่อกับ external services, databases, caches, และ queues
///
/// ## ความสำคัญ
/// - เป็นจุดรวมของ clients ทั้งหมดในระบบ
/// - จัดการ request processing และ response handling
/// - ควบคุม quota และ rate limiting
/// - รองรับทั้ง direct forwarding และ integration processing
///
/// ## โครงสร้าง
/// - `ai/` - AI service clients สำหรับ ML และ embeddings
/// - `database/` - Database clients (ClickHouse, Qdrant)
/// - `ecommerce/` - E-commerce platform clients (TikTok, Shopee, etc.)
/// - `cache/` - Cache clients (Redis, memory)
/// - `queue/` - Message queue clients (RabbitMQ)
/// - `strapi/` - Strapi CMS proxy client
//
use crate::infrastructure::app::App;
use crate::model::{
    DatabaseConfig, HandlerConfig, ProcessingContext, ServiceCheckConfig, WrapperType,
};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Method, Request, Response};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::Arc;

pub mod ai;
pub mod api;
pub mod cache;
pub mod database;
pub mod ecommerce;
pub mod integration;
pub mod queue;
pub mod request;
pub mod response;
pub mod strapi;
pub mod upload;
pub mod vector;

// Common types for client module
use serde::{Deserialize, Serialize};

/// โครงสร้างสำหรับ response แบบ raw JSON
/// ใช้สำหรับจัดเก็บ response ที่ยังไม่ได้ประมวลผล
///
/// # Fields
/// - `status` - HTTP status code
/// - `headers` - Response headers
/// - `body` - JSON response body
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawJsonResponse {
    pub status: u16,
    pub headers: std::collections::HashMap<String, String>,
    pub body: serde_json::Value,
}

use self::{
    cache::CacheClient,
    integration::{IntegrationClient, IntegrationProcessor, IntegrationResponse},
    queue::QueueClient,
    request::{RequestClient, RequestDispatcher},
    response::{ResponseClient, ResponseProcessor},
    upload::UploadClient,
};

/// Client คือโครงสร้างที่ใช้ในการเก็บข้อมูลที่จำเป็นในการทำงานของระบบ
/// Client is the structure that stores necessary data for system operations
pub struct Client {
    /// สำหรับเรียกใช้ข้อมูลแอพที่สร้างไว้ตอนเริ่มต้น
    /// For accessing app data created at startup
    pub app: Arc<App>,

    /// ใช้สำหรับจัดการแคชของข้อมูล
    /// For managing data cache
    pub cache: Arc<CacheClient>,

    /// ใช้ในการจัดการคิวของงาน
    /// For managing job queues
    pub queue: Arc<QueueClient>,

    /// ใช้ในการจัดการคำขอที่ได้รับจากผู้ใช้
    /// For managing user requests
    pub request: Arc<RequestClient>,

    /// ใช้ในการจัดการการอินทิเกรตระบบต่าง ๆ
    /// For managing system integrations
    pub integration: Arc<IntegrationClient>,

    /// ใช้ในการจัดการข้อมูล Response
    /// For managing response data
    pub response: Arc<ResponseClient>,

    /// ใช้ในการจัดการการอัปโหลดข้อมูล
    /// For managing data uploads
    pub upload: Arc<UploadClient>,

    /// ใช้ในการจัดการจำนวน quota ขอใช้งาน API
    /// For managing API quota usage
    pub quota: Arc<QuotaManager>,

    /// ผู้ช่วยสำหรับตรวจสอบระบบพื้นฐานก่อนประมวลผลคำขอ
    system_guard: SystemGuard,
}

impl Client {
    /// สร้าง Client instance ใหม่
    /// Create new Client instance
    pub fn new(app: Arc<App>) -> Self {
        // สร้างคอมโพเนนต์ย่อยทั้งหมด
        // Create all sub-components
        let cache = Arc::new(CacheClient::new(app.clone()));
        let queue = Arc::new(QueueClient::new(app.clone()));
        let request = Arc::new(RequestClient::new(app.clone()));
        let upload = Arc::new(UploadClient::new(app.clone()));
        let response = Arc::new(ResponseClient::new(app.clone()));
        let integration = Arc::new(IntegrationClient::new(
            app.clone(),
            queue.clone(),
            cache.clone(),
        ));
        let quota = Arc::new(QuotaManager::new(app.clone()));
        let system_guard = SystemGuard::new(app.clone());

        Self {
            app,
            cache,
            queue,
            request,
            integration,
            response,
            upload,
            quota,
            system_guard,
        }
    }

    /// ประมวลผลคำขอหลักของระบบ
    /// Main request processing for the system
    pub async fn process(
        &self,
        handler_config: HandlerConfig,
        req: Request<Body>,
    ) -> Result<Response<Body>> {
        let context = ProcessingContext::from_request(&req)?;
        let request_path = req.uri().path().to_string();

        self.log_processing_start(&context, &request_path);

        if let Some(service_check) = handler_config.service_check.as_ref() {
            self.system_guard.ensure_services(service_check).await?;
        }

        if let Some(db_config) = handler_config.database_config.as_ref() {
            self.system_guard.prepare_database_table(db_config).await?;
        }

        if handler_config.quota_enabled {
            QuotaEnforcer::apply(&*self.quota, &context).await?;
        }

        let response = self.dispatch(&handler_config, req, &context).await?;

        let response = ResponseProcessor::process(
            &*self.response,
            response,
            &handler_config.response_config,
            &context,
        )
        .await?;

        self.log_processing_completion(&context);

        Ok(response)
    }

    async fn dispatch(
        &self,
        handler_config: &HandlerConfig,
        req: Request<Body>,
        context: &ProcessingContext,
    ) -> Result<Response<Body>> {
        match handler_config.request_config.wrapper_type {
            WrapperType::Integration => self.handle_integration(handler_config, req, context).await,
            WrapperType::Direct => self.forward_direct(handler_config, req, context).await,
        }
    }

    async fn handle_integration(
        &self,
        handler_config: &HandlerConfig,
        req: Request<Body>,
        context: &ProcessingContext,
    ) -> Result<Response<Body>> {
        self.app.logger.debug("Using Integration wrapper", None);

        let integration_response = IntegrationProcessor::execute(
            &*self.integration,
            &handler_config.provider,
            handler_config,
            req,
            context,
        )
        .await?;

        self.integration_response_to_http(integration_response)
    }

    async fn forward_direct(
        &self,
        handler_config: &HandlerConfig,
        req: Request<Body>,
        context: &ProcessingContext,
    ) -> Result<Response<Body>> {
        self.app.logger.debug("Using Direct wrapper", None);
        RequestDispatcher::dispatch(
            &*self.request,
            &handler_config.provider,
            handler_config,
            req,
            context,
        )
        .await
    }

    fn integration_response_to_http(
        &self,
        integration_response: IntegrationResponse,
    ) -> Result<Response<Body>> {
        let status = if integration_response.success {
            200
        } else {
            500
        };
        let body = Body::from(serde_json::to_vec(&integration_response)?);
        Ok(Response::builder()
            .status(status)
            .header("Content-Type", "application/json")
            .body(body)?)
    }

    fn log_processing_start(&self, context: &ProcessingContext, path: &str) {
        let context_logger = crate::infrastructure::logger::Logger::context()
            .uuid(context.request_id.clone())
            .path(path)
            .build();
        self.app
            .logger
            .info("Starting request processing", Some(&context_logger));
    }

    fn log_processing_completion(&self, context: &ProcessingContext) {
        let end_context = crate::infrastructure::logger::Logger::context()
            .uuid(context.request_id.clone())
            .build();
        self.app
            .logger
            .info("Request processing completed", Some(&end_context));
    }

    /// เริ่มต้น handlers ทั้งหมด
    /// Initialize all handlers
    pub fn init_handlers(&self, handlers: &mut [HandlerRegistration]) {
        for handler in handlers.iter_mut() {
            // เตรียมตารางฐานข้อมูลสำหรับแต่ละ handler
            // Prepare database table for each handler
            if let Some(db_config) = &handler.config.database_config {
                let table_name = format_table_name(&db_config.table_name);

                // อัปเดตชื่อตารางในคอนฟิก
                // Update table name in config
                if let Some(db_config) = &mut handler.config.database_config {
                    db_config.table_name = table_name;
                }
            }

            // กำหนดค่าเริ่มต้นสำหรับคอนฟิกที่ขาด
            // Set defaults for missing configs
            handler.config.set_defaults();
        }
    }
}

struct SystemGuard {
    app: Arc<App>,
}

impl SystemGuard {
    fn new(app: Arc<App>) -> Self {
        Self { app }
    }

    async fn ensure_services(&self, config: &ServiceCheckConfig) -> Result<()> {
        self.app.logger.debug("Checking services", None);

        if config.database {
            self.app
                .database_manager
                .ping()
                .await
                .map_err(|e| anyhow!("Database not ready: {}", e))?;
        }

        if config.cache {
            self.app
                .cache_manager
                .ping()
                .await
                .map_err(|e| anyhow!("Cache not ready: {}", e))?;
        }

        if config.queue {
            self.app
                .queue_manager
                .ping()
                .await
                .map_err(|e| anyhow!("Queue not ready: {}", e))?;
        }

        Ok(())
    }

    async fn prepare_database_table(&self, config: &DatabaseConfig) -> Result<()> {
        let table_name = format_table_name(&config.table_name);
        let final_table_name = if table_name.len() > 64 {
            hash_table_name(&table_name)
        } else {
            table_name
        };

        self.app.logger.debug(
            &format!("Creating table if not exists: {}", final_table_name),
            None,
        );

        self.app
            .database_manager
            .create_table_and_index(&final_table_name, config.indexes.clone(), &config.options)
            .await?;

        Ok(())
    }
}

/// สัญญาสำหรับการบังคับใช้ quota
#[async_trait]
pub trait QuotaEnforcer: Send + Sync {
    async fn apply(&self, context: &ProcessingContext) -> Result<()>;
}

/// ตัวจัดการ Quota
/// Quota Manager
pub struct QuotaManager {
    app: Arc<App>,
}

impl QuotaManager {
    pub fn new(app: Arc<App>) -> Self {
        Self { app }
    }

    /// บังคับใช้ quota สำหรับ context ที่ระบุ
    pub async fn enforce(&self, context: &ProcessingContext) -> Result<()> {
        let cache_key = format!("quota:{}:{}", context.org_id, context.user_id);

        let current_quota: i64 = self
            .app
            .cache_manager
            .get(&cache_key)
            .await?
            .unwrap_or(100000); // Default quota per month

        if current_quota <= 0 {
            return Err(anyhow!("Quota exceeded"));
        }

        let new_quota = current_quota - 1;
        self.app
            .cache_manager
            .set(&cache_key, &new_quota, 86400) // เก็บ 24 ชั่วโมง / Store for 24 hours
            .await?;

        self.app
            .logger
            .debug(&format!("Quota consumed: {} remaining", new_quota), None);

        Ok(())
    }

    /// API เดิมสำหรับความเข้ากันได้ย้อนหลัง
    pub async fn check_and_consume(&self, context: &ProcessingContext) -> Result<()> {
        self.enforce(context).await
    }
}

#[async_trait]
impl QuotaEnforcer for QuotaManager {
    async fn apply(&self, context: &ProcessingContext) -> Result<()> {
        self.enforce(context).await
    }
}

/// การลงทะเบียน Handler
/// Handler Registration
pub struct HandlerRegistration {
    pub path: String,
    pub method: Method,
    pub config: HandlerConfig,
    pub handler: Box<dyn Fn(Request<Body>) -> Response<Body> + Send + Sync>,
}

// Helper functions
fn format_table_name(table_name: &str) -> String {
    table_name
        .replace("-", "_")
        .replace(" ", "_")
        .to_lowercase()
}

fn hash_table_name(table_name: &str) -> String {
    let mut hasher = DefaultHasher::new();
    table_name.hash(&mut hasher);
    let hash = hasher.finish();
    format!("tbl_{:x}", hash)
}
