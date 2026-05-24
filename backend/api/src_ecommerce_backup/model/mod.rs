/// Model Layer - ชั้น Model สำหรับ Domain Objects และ Data Structures
///
/// โมดูลหลักสำหรับกำหนดและจัดการ domain models, DTOs, และ data structures
/// ในระบบ e-commerce platform integration ทั้งหมด
///
/// # Modules
/// - `api_config` - API configuration models
/// - `config` - การตั้งค่าระบบและ service configurations
/// - `credential` - ข้อมูล credentials และ authentication
/// - `database` - Database models และ schema definitions
/// - `detection_file_type` - File type detection utilities
/// - `error` - Error types และ error handling models
/// - `file` - File handling models
/// - `file_location` - File storage location models
/// - `header` - HTTP header models
/// - `log` - Logging models และ audit trail
/// - `request` - HTTP request models
/// - `response` - HTTP response models
/// - `response_code` - Response code definitions
/// - `v1` - Version 1 API models
/// - `webhook` - Webhook models และ event handling
/// - `worker` - Background worker models
pub mod api_config;
pub mod config;
pub mod credential;
pub mod database;
pub mod detection_file_type;
pub mod error;
pub mod file;
pub mod file_location;
pub mod header;
pub mod ingestion;
pub mod log;
pub mod request;
pub mod response;
pub mod response_code;
pub mod v1;
pub mod webhook;
pub mod worker;

// Re-export commonly used types - ส่งออก types ที่ใช้บ่อย
/// ส่งออก types ที่ใช้บ่อยเพื่อความสะดวกในการ import
pub use config::{
    DatabaseConfig, HandlerConfig, ProcessingContext, QueueConfig, RequestConfig, ResponseConfig,
    SaveLogType, ServiceCheckConfig, WrapperType,
};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// การตั้งค่าแพลตฟอร์ม e-commerce
///
/// ประกอบด้วยข้อมูลการตั้งค่าสำหรับแต่ละแพลตฟอร์ม
/// รวมถึง API endpoints, OAuth settings, rate limiting, และ webhook configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformConfig {
    /// ชื่อแพลตฟอร์ม
    pub name: String,
    /// Base URL ของ API
    pub api_base_url: String,
    /// OAuth authorization URL
    pub oauth_authorize_url: Option<String>,
    /// Redirect URI สำหรับ OAuth callback
    pub redirect_uri: Option<String>,
    /// Rate limit (requests per second)
    pub rate_limit_rps: f64,
    /// Request timeout (milliseconds)
    pub timeout_ms: u64,
    /// เปิดใช้งาน retry mechanism
    pub retry_enabled: bool,
    /// เปิดใช้งาน webhook
    pub webhook_enabled: bool,
}

/// Credentials ของแพลตฟอร์ม
///
/// เก็บข้อมูล credentials สำหรับการเชื่อมต่อกับแพลตฟอร์ม e-commerce
/// รวมถึง API keys, OAuth tokens, และ additional parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformCredentials {
    /// ชื่อแพลตฟอร์ม
    pub platform: String,
    /// Application key/client ID
    pub app_key: String,
    /// Application secret/client secret
    pub app_secret: String,
    /// OAuth access token
    pub access_token: Option<String>,
    /// OAuth refresh token
    pub refresh_token: Option<String>,
    /// Token expiration timestamp (Unix timestamp)
    pub expires_at: Option<i64>,
    /// Additional platform-specific parameters
    pub additional_params: HashMap<String, String>,
}

/// รูปแบบ response ที่รองรับ
///
/// กำหนดรูปแบบของ response ที่สามารถรับจาก API endpoints
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResponseFormat {
    /// JSON format
    Json,
    /// XML format
    Xml,
    /// HTML format
    Html,
    /// Plain text format
    Text,
    /// Binary data format
    Binary,
}

/// Metadata ของไฟล์
///
/// เก็บข้อมูล metadata ของไฟล์ที่อัพโหลดหรือจัดเก็บในระบบ
/// ใช้สำหรับการ tracking และจัดการไฟล์ uploads
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    /// ชื่อไฟล์
    pub filename: String,
    /// MIME type ของไฟล์
    pub content_type: String,
    /// ขนาดไฟล์ (bytes)
    pub size: usize,
    /// เวลาที่สร้างไฟล์
    pub created_at: chrono::DateTime<chrono::Utc>,
}
