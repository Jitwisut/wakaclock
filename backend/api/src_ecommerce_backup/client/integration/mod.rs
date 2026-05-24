// client/integration/mod.rs
use super::{cache::CacheClient, queue::QueueClient};
use crate::infrastructure::app::App;
use crate::model::{HandlerConfig, ProcessingContext};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use axum::body::Body;
use axum::http::Request;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

pub mod v1;

/// Integration ใช้ในการจัดการการอินทิเกรต (integration) ของระบบ
/// Integration is used for managing system integrations
pub struct IntegrationClient {
    /// สำหรับเรียกใช้ข้อมูลแอพที่สร้างไว้ตอนเริ่มต้น
    /// For accessing app data created at startup
    app: Arc<App>,

    /// ใช้ในการจัดการคิวของงาน
    /// For managing job queues
    queue: Arc<QueueClient>,

    /// ใช้สำหรับจัดการแคชของข้อมูล
    /// For managing data cache
    cache: Arc<CacheClient>,

    /// เก็บ platform integrations ทั้งหมด
    /// Store all platform integrations
    platforms: HashMap<String, Box<dyn PlatformIntegration>>,
}

/// PlatformIntegration trait สำหรับ platform-specific integration
/// PlatformIntegration trait for platform-specific integration
#[async_trait]
pub trait PlatformIntegration: Send + Sync {
    /// ตรวจสอบความถูกต้องของคำขอ
    /// Validate request
    async fn validate(&self, request: &IntegrationRequest) -> Result<()>;

    /// เตรียมคำขอสำหรับส่งไปยัง platform
    /// Prepare request for sending to platform
    async fn prepare(&self, request: IntegrationRequest) -> Result<PreparedRequest>;

    /// ส่งคำขอไปยัง platform และรับผลลัพธ์
    /// Execute request to platform and get response
    async fn execute(&self, request: PreparedRequest) -> Result<PlatformResponse>;

    /// แปลงผลลัพธ์จาก platform ให้เป็นรูปแบบมาตรฐาน
    /// Transform platform response to standard format
    async fn transform(&self, response: PlatformResponse) -> Result<IntegrationResponse>;

    /// จัดการ error ที่เกิดขึ้น
    /// Handle errors
    async fn handle_error(&self, error: &anyhow::Error) -> Result<ErrorResponse>;
}

/// High-level contract for executing an integration pipeline.
#[async_trait]
pub trait IntegrationProcessor: Send + Sync {
    async fn execute(
        &self,
        platform: &str,
        config: &HandlerConfig,
        request: Request<Body>,
        context: &ProcessingContext,
    ) -> Result<IntegrationResponse>;
}

/// คำขอสำหรับ integration
/// Request for integration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationRequest {
    pub shop_id: String,
    pub platform: String,
    pub operation: String,
    pub data: serde_json::Value,
    pub options: HashMap<String, String>,
}

/// คำขอที่เตรียมแล้วสำหรับส่งไปยัง platform
/// Prepared request for sending to platform
#[derive(Debug, Clone)]
pub struct PreparedRequest {
    pub url: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
    pub timeout: u64,
}

/// ผลลัพธ์จาก platform
/// Response from platform
#[derive(Debug, Clone)]
pub struct PlatformResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
}

/// ผลลัพธ์ที่แปลงแล้ว
/// Transformed response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationResponse {
    pub success: bool,
    pub data: serde_json::Value,
    pub metadata: HashMap<String, String>,
    pub follow_up_tasks: Option<Vec<FollowUpTask>>,
}

/// งานที่ต้องทำต่อ
/// Follow-up tasks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FollowUpTask {
    pub task_type: String,
    pub payload: serde_json::Value,
    pub delay_ms: Option<u64>,
}

/// ผลลัพธ์ error
/// Error response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub retry_after: Option<u64>,
}

impl IntegrationClient {
    /// สร้าง IntegrationClient ใหม่
    /// Create new IntegrationClient
    pub fn new(app: Arc<App>, queue: Arc<QueueClient>, cache: Arc<CacheClient>) -> Self {
        let platforms = HashMap::new();

        // ลงทะเบียน platform integrations
        // Register platform integrations
        // platforms จะถูกเพิ่มจาก platform registry ใน App
        // platforms will be added from platform registry in App

        Self {
            app,
            queue,
            cache,
            platforms,
        }
    }

    /// ประมวลผลคำขอ integration
    /// Process integration request
    pub async fn process(
        &self,
        platform: &str,
        config: &HandlerConfig,
        request: Request<Body>,
        context: &ProcessingContext,
    ) -> Result<IntegrationResponse> {
        let log_context = crate::infrastructure::logger::Logger::context()
            .uuid(context.request_id.clone())
            .custom("platform", serde_json::json!(platform))
            .build();
        self.app.logger.info(
            &format!("Starting integration for platform: {}", platform),
            Some(&log_context),
        );

        // ดึง platform integration
        // Get platform integration
        let integration = self
            .app
            .platform_registry
            .get(platform)
            .ok_or_else(|| anyhow!("Platform {} not supported", platform))?;

        // แปลงคำขอเป็น IntegrationRequest
        // Parse request to IntegrationRequest
        let integration_request = self.parse_request(request, config).await?;

        // ตรวจสอบแคช
        // Check cache
        let cache_key = self.generate_cache_key(&integration_request);
        if !config.skip_cache {
            if let Some(cached) = self.cache.get::<IntegrationResponse>(&cache_key).await? {
                self.app.logger.debug("Found data in cache", None);
                return Ok(cached);
            }
        }

        // ประมวลผลผ่าน platform pipeline
        // Process through platform pipeline

        // Convert to interfaces type
        let platform_request = crate::interfaces::platform::IntegrationRequest {
            platform: integration_request.platform.clone(),
            operation: integration_request.operation.clone(),
            data: integration_request.data.clone(),
            headers: HashMap::new(),
            query_params: integration_request.options.clone(),
        };

        // 1. ตรวจสอบความถูกต้อง / Validate
        integration.validate(&platform_request).await.map_err(|e| {
            self.app
                .logger
                .error(&format!("Validation failed: {}", e), None, None);
            e
        })?;

        // 2. เตรียมคำขอ / Prepare request
        let prepared = integration
            .prepare(platform_request.clone())
            .await
            .map_err(|e| {
                self.app
                    .logger
                    .error(&format!("Request preparation failed: {}", e), None, None);
                e
            })?;

        // 3. ส่งคำขอไปยัง platform / Execute request
        let platform_response = integration.execute(prepared).await.map_err(|e| {
            self.app
                .logger
                .error(&format!("Request execution failed: {}", e), None, None);
            e
        })?;

        // 4. แปลงผลลัพธ์ / Transform response
        let response = integration
            .transform(platform_response)
            .await
            .map_err(|e| {
                self.app.logger.error(
                    &format!("Response transformation failed: {}", e),
                    None,
                    None,
                );
                e
            })?;

        // บันทึกผลลัพธ์ที่สำเร็จลงแคช
        // Cache successful response
        if response.success && !config.skip_cache {
            self.cache
                .set(&cache_key, &response, config.cache_ttl.unwrap_or(300))
                .await?;
            self.app.logger.debug("Cached response", None);
        }

        // ส่งงานที่ต้องทำต่อไปยังคิว
        // Queue follow-up tasks if needed
        if let Some(follow_up_tasks) = &response.follow_up_tasks {
            for task in follow_up_tasks {
                self.queue.publish(&task.task_type, task).await?;
                self.app
                    .logger
                    .debug(&format!("Queued follow-up task: {}", task.task_type), None);
            }
        }

        let end_context = crate::infrastructure::logger::Logger::context()
            .uuid(context.request_id.clone())
            .build();
        self.app.logger.info(
            &format!("Integration successful for platform: {}", platform),
            Some(&end_context),
        );

        // Convert back to local type
        let local_response = IntegrationResponse {
            success: response.success,
            data: response.data,
            metadata: response.metadata,
            follow_up_tasks: response.follow_up_tasks.map(|tasks| {
                tasks
                    .into_iter()
                    .map(|t| FollowUpTask {
                        task_type: t.task_type,
                        payload: t.data,
                        delay_ms: t.delay_ms,
                    })
                    .collect()
            }),
        };

        Ok(local_response)
    }

    /// แปลงคำขอ HTTP เป็น IntegrationRequest
    /// Parse HTTP request to IntegrationRequest
    async fn parse_request(
        &self,
        request: Request<Body>,
        _config: &HandlerConfig,
    ) -> Result<IntegrationRequest> {
        let body_bytes = axum::body::to_bytes(request.into_body(), usize::MAX).await?;
        let integration_request: IntegrationRequest = serde_json::from_slice(&body_bytes)?;
        Ok(integration_request)
    }

    /// สร้าง cache key จากคำขอ
    /// Generate cache key from request
    fn generate_cache_key(&self, request: &IntegrationRequest) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        request.data.to_string().hash(&mut hasher);
        let hash = hasher.finish();

        format!(
            "integration:{}:{}:{}:{:x}",
            request.platform, request.shop_id, request.operation, hash
        )
    }
}

#[async_trait]
impl IntegrationProcessor for IntegrationClient {
    async fn execute(
        &self,
        platform: &str,
        config: &HandlerConfig,
        request: Request<Body>,
        context: &ProcessingContext,
    ) -> Result<IntegrationResponse> {
        self.process(platform, config, request, context).await
    }
}
