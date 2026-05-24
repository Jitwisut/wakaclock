//! Request Model
//! โมเดลสำหรับจัดการ HTTP requests, responses และการเชื่อมต่อระบบ
//!
//! ใช้สำหรับการจัดการ request/response models, file uploads, และ API integration
//! รวมถึง traits สำหรับ async request processing, streaming และ logging
//! รองรับ type-safe API configuration และ handler patterns

use async_trait::async_trait;
use bytes::Bytes;
use futures::stream::Stream;
use rustls::ClientConfig;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::io::AsyncWrite;

/// ประเภทของการบันทึก log ในระบบ
/// กำหนดระดับการบันทึก request/response logs
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum SaveLogType {
    /// บันทึกเฉพาะ headers
    /// เก็บเฉพาะ HTTP headers สำหรับ debug
    Headers,
    /// บันทึก log แบบสมบูรณ์
    /// เก็บทั้ง request และ response data
    Save,
    /// ไม่บันทึก log
    /// ไม่เก็บข้อมูล request/response
    NotSave,
}

/// Function type สำหรับการจัดการ integration requests
/// ใช้เป็น callback function สำหรับการประมวลผล requests
pub type HandlerFunc =
    fn(&HandleIntegrationParams, Box<dyn std::any::Any>) -> Result<HandlerResponse, anyhow::Error>;

/// Function type สำหรับ integration handlers
/// ใช้สำหรับการเชื่อมต่อกับ external systems
pub type HandlerIntegration =
    fn(&HandleIntegrationParams, Box<dyn std::any::Any>) -> Result<HandlerResponse, anyhow::Error>;

/// โครงสร้างข้อมูลสำหรับ integration request
/// ประกอบด้วย type และ payload data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationRequest {
    /// ประเภทของ integration
    /// เช่น "payment", "inventory", "shipping" เป็นต้น
    pub r#type: String,
    /// ข้อมูลที่จะส่งไปยัง integration
    /// เก็บเป็น JSON เพื่อความยืดหยุ่น
    pub payload: serde_json::Value,
}

/// Defines configuration for file requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileRequest {
    pub file_key: String,
    pub base64_key: String,
    pub url_key: String,
    pub is_required: bool,
    pub is_multi_files: bool,
}

/// Parameters related to upload configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadConfigParams {
    pub request_body: Option<Upload>,
    pub request_path: String,
    pub response_path: String,
}

/// File content structure for file handling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub filename: String,
    pub content_type: String,
    pub data: Vec<u8>,
}

/// Upload information structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Upload {
    pub filename: String,
    pub file_type: String,
    pub content: Vec<u8>,
}

/// Configuration for API calls
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfigParams {
    pub method: String,
    pub third_party_url: String,
    pub is_construct_path_params: bool,
    pub is_construct_query_params: bool,
    pub header_key_values: Option<HashMap<String, String>>,
}

/// Database configuration parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfigParams {
    pub provider: String,
    pub table_name: String,
}

/// Custom table definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Table {
    pub queries: String,
    pub index: HashMap<String, bool>,
}

/// Request body configuration parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestBodyConfigParams {
    pub request_wrapper_function_type: String,
    pub set_body_paths_value: Option<HashMap<String, serde_json::Value>>,
    pub is_request_struct: bool,
    pub request_struct: Option<serde_json::Value>,
    pub request_files_key: Option<Vec<FileRequest>>,
    pub request_files_content: Option<Vec<FileContent>>,
    pub is_webhook: bool,
    pub webhook_ref_json_path: String,
    pub stream_path: String,
}

/// Response configuration parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseConfigParams {
    pub save_log_type: SaveLogType,
    pub is_return_response_struct: bool,
    pub is_etl_response: bool,
    pub response_struct: Option<serde_json::Value>,
    pub json_file_paths: Option<Vec<String>>,
    pub is_stream: bool,
    pub header_prefix_key: String,
}

/// Queue configuration parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueConfigParams {
    pub is_disabled_queue: bool,
}

/// Service check configuration parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceCheckConfigParams {
    pub database: bool,
    pub queue: bool,
    pub cache: bool,
}

/// Time tracking for requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeUsed {
    pub server_to_third_party: Duration,
    pub client_to_server: Duration,
}

/// Headers configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeadersConfig {
    pub headers: HashMap<String, String>,
}

/// Log information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Log {
    pub request: Option<serde_json::Value>,
    pub response: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// Response for third-party webhooks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RespWebhook3rd {
    pub is_enabled: bool,
    pub key: String,
    pub table_name: String,
    pub data: Option<HashMap<String, serde_json::Value>>,
    pub headers_config: Option<HeadersConfig>,
}

/// Response from a handler
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandlerResponse {
    pub time_used: Option<TimeUsed>,
    pub request_wrapper_function_type: String,
    pub is_stream: bool,
    pub status_code: i32,
    pub content_type: String,
    pub resp_headers: Option<HashMap<String, String>>,
    pub resp_integration: Option<serde_json::Value>,
    pub resp_queue: Option<serde_json::Value>,
    pub resp_webhook_3rd: Option<RespWebhook3rd>,
    pub resp_file: Option<Vec<u8>>,
    pub resp_text: Option<Vec<u8>>,
    pub files_to_upload: Option<Vec<FileContent>>,
}

/// Parameters for request wrapper handlers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandleRequestWrapperParams {
    pub provider: String,
    pub database_config: Option<DatabaseConfigParams>,
    pub upload_config: Option<UploadConfigParams>,
    pub api_config: Option<ApiConfigParams>,
    pub request_config: Option<RequestBodyConfigParams>,
    pub response_config: Option<ResponseConfigParams>,
    pub queue_config: Option<QueueConfigParams>,
    pub service_check_config: Option<ServiceCheckConfigParams>,
}

/// Function type wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestWrapperFunctionType {
    pub handle_request_function: String,
    pub integration: String,
    pub queue: String,
}

/// Integration parameters
#[derive(Debug, Clone)]
pub struct HandleIntegrationParams {
    pub client_to_server_start: Option<Instant>,
    pub service: String,
    pub r#type: String,
    pub provider: String,
    pub database_config: Option<DatabaseConfigParams>,
    pub upload_config: Option<UploadConfigParams>,
    pub api_config: Option<ApiConfigParams>,
    pub request_config: Option<RequestBodyConfigParams>,
    pub response_config: Option<ResponseConfigParams>,
    pub queue_config: Option<QueueConfigParams>,
    pub headers_config: Option<HeadersConfig>,
    pub url_params: HashMap<String, String>,
    pub url_query: HashMap<String, String>,
    pub req_body: Option<serde_json::Value>,
    pub custom_headers: Option<HashMap<String, String>>,
    pub logs: Option<Log>,
}

/// Parameters for forwarding requests
#[derive(Debug, Clone)]
pub struct ForwardRequestParams {
    pub method: String,
    pub url: String,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<Vec<u8>>,
    pub is_stream: bool,
    pub is_mode_dev: bool,
    pub tls_config: Option<ClientConfig>,
}

/// Response parameters for request wrappers
#[derive(Debug, Clone)]
pub struct HandleRequestWrapperResponseParams {
    pub client_to_server_start: Option<Instant>,
    pub provider: String,
    pub database_config: Option<DatabaseConfigParams>,
    pub upload_config: Option<UploadConfigParams>,
    pub api_config: Option<ApiConfigParams>,
    pub request_config: Option<RequestBodyConfigParams>,
    pub response_config: Option<ResponseConfigParams>,
    pub queue_config: Option<QueueConfigParams>,
    pub headers_config: Option<HeadersConfig>,
    pub logs: Option<Log>,
}

/// Trait for request handlers
#[async_trait]
pub trait RequestHandler {
    async fn handle_request(
        &self,
        params: &HandleIntegrationParams,
    ) -> Result<HandlerResponse, anyhow::Error>;
}

/// Trait for response processors
#[async_trait]
pub trait ResponseProcessor {
    async fn process_response(
        &self,
        response: &HandlerResponse,
    ) -> Result<serde_json::Value, anyhow::Error>;
}

/// Trait for streaming data
#[async_trait]
pub trait StreamProcessor {
    async fn process_stream<S, W>(&self, stream: S, writer: &mut W) -> Result<(), anyhow::Error>
    where
        S: Stream<Item = Result<Bytes, reqwest::Error>> + Send + Unpin,
        W: AsyncWrite + Send + Unpin;
}
