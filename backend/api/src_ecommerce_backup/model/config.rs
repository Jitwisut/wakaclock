/// Configuration Models - โมเดลสำหรับการตั้งค่าระบบ
///
/// โมดูลนี้ประกอบด้วย configuration structures สำหรับการตั้งค่าต่างๆ ของระบบ
/// รวมถึง API configuration, request/response handling, database settings,
/// queue configuration, และ service monitoring
///
/// # Features
/// - Handler configuration สำหรับ API endpoints
/// - Request/Response processing configuration
/// - Database และ queue configuration
/// - Service monitoring และ health checks
/// - Caching และ quota management settings
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// การตั้งค่า Handler หลักสำหรับ API endpoints
///
/// ประกอบด้วยการตั้งค่าทั้งหมดที่จำเป็นสำหรับการทำงานของ API handler
/// รวมถึง provider configuration, API settings, request/response handling,
/// database และ queue configuration, service monitoring, และ caching
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandlerConfig {
    /// ชื่อ provider (e.g., "tiktok", "shopee", "lazada")
    pub provider: String,
    /// การตั้งค่า API endpoints และ HTTP methods
    pub api_config: ApiConfig,
    /// การตั้งค่าการประมวลผล requests
    pub request_config: RequestConfig,
    /// การตั้งค่าการประมวลผล responses
    pub response_config: ResponseConfig,
    /// การตั้งค่า database (optional)
    pub database_config: Option<DatabaseConfig>,
    /// การตั้งค่า message queue (optional)
    pub queue_config: Option<QueueConfig>,
    /// การตั้งค่า service health checks (optional)
    pub service_check: Option<ServiceCheckConfig>,
    /// เปิดใช้งาน quota management
    pub quota_enabled: bool,
    /// ข้าม caching mechanism
    pub skip_cache: bool,
    /// Cache TTL (seconds)
    pub cache_ttl: Option<u64>,
}

impl HandlerConfig {
    /// ตั้งค่า default values สำหรับ configuration
    ///
    /// กำหนดค่าเริ่มต้นสำหรับ fields ที่ยังไม่ได้กำหนดค่า
    /// เพื่อให้แน่ใจว่า configuration สามารถใช้งานได้
    pub fn set_defaults(&mut self) {
        if self.provider.is_empty() {
            self.provider = "default".to_string();
        }
    }
}

/// การตั้งค่า API configuration
///
/// กำหนดการตั้งค่าสำหรับ API calls รวมถึง HTTP methods,
/// parameter construction, และ custom headers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    /// HTTP method (GET, POST, PUT, DELETE, etc.)
    pub method: String,
    /// สร้าง path parameters อัตโนมัติ
    pub construct_path_params: bool,
    /// สร้าง query parameters อัตโนมัติ
    pub construct_query_params: bool,
    /// Custom HTTP headers
    pub header_key_values: Option<HashMap<String, String>>,
}

/// การตั้งค่าการประมวลผล requests
///
/// กำหนดวิธีการประมวลผล incoming requests รวมถึง
/// wrapper types, struct usage, webhooks, และ streaming
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestConfig {
    /// ประเภทของ request wrapper
    pub wrapper_type: WrapperType,
    /// ใช้ struct สำหรับ request parsing
    pub use_struct: bool,
    /// ชื่อ struct สำหรับ request
    pub request_struct: String,
    /// เปิดใช้งาน webhook support
    pub webhook_enabled: bool,
    /// เปิดใช้งาน streaming support
    pub stream_enabled: bool,
}

/// การตั้งค่าการประมวลผล responses
///
/// กำหนดวิธีการประมวลผล outgoing responses รวมถึง
/// logging behavior, struct serialization, ETL processing, และ response formats
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseConfig {
    /// ประเภทการบันทึก log
    pub save_log_type: SaveLogType,
    /// ใช้ struct สำหรับ response serialization
    pub return_struct: bool,
    /// ชื่อ struct สำหรับ response
    pub response_struct: String,
    /// เปิดใช้งาน ETL processing
    pub etl_enabled: bool,
    /// รูปแบบ response เริ่มต้น
    pub default_format: crate::model::ResponseFormat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub provider: String,
    pub table_name: String,
    pub indexes: HashMap<String, bool>,
    pub options: String,
    pub schema: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueConfig {
    pub enabled: bool,
    pub queue_name: String,
    pub retry_policy: crate::infrastructure::queue::RetryPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceCheckConfig {
    pub database: bool,
    pub cache: bool,
    pub queue: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WrapperType {
    Integration,
    Direct,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SaveLogType {
    Database,
    File,
    Queue,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessingContext {
    pub request_id: String,
    pub user_id: String,
    pub org_id: String,
    pub platform: Option<String>,
    pub path: String,
    pub method: String,
    pub timestamp: i64,
}

impl ProcessingContext {
    pub fn from_request(req: &axum::http::Request<axum::body::Body>) -> anyhow::Result<Self> {
        use uuid::Uuid;

        let request_id = req
            .headers()
            .get("x-request-id")
            .and_then(|v| v.to_str().ok())
            .unwrap_or(&Uuid::new_v4().to_string())
            .to_string();

        let user_id = req
            .headers()
            .get("x-user-id")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("anonymous")
            .to_string();

        let org_id = req
            .headers()
            .get("x-org-id")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("default")
            .to_string();

        Ok(Self {
            request_id,
            user_id,
            org_id,
            platform: None,
            path: req.uri().path().to_string(),
            method: req.method().to_string(),
            timestamp: chrono::Utc::now().timestamp(),
        })
    }
}
