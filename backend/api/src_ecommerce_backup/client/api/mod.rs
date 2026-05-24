/// # API Client Module - โมดูล API Client
/// โมดูลสำหรับจัดการการเรียก external APIs
/// ให้ interface ที่เป็นมาตรฐานสำหรับ HTTP client operations
///
/// ## หน้าที่หลัก
/// - ให้ trait interface สำหรับ HTTP operations (GET, POST, PUT, DELETE, PATCH)
/// - จัดการ HTTP responses และ error handling
/// - รองรับ headers และ request body serialization
/// - ใช้ร่วมกับ platform clients สำหรับการเชื่อมต่อ APIs
///
/// ## การใช้งาน
/// ```rust
/// impl ApiClient for MyClient {
///     async fn get(&self, url: &str, headers: HashMap<String, String>) -> Result<ApiResponse> {
///         // Implementation
///     }
/// }
/// ```
use anyhow::Result;
use async_trait::async_trait;
use std::collections::HashMap;

/// API Client trait สำหรับการเรียก external APIs
/// ให้ interface ที่เป็นมาตรฐานสำหรับ HTTP operations
#[async_trait]
pub trait ApiClient: Send + Sync {
    /// ชื่อของ client สำหรับ identification และ logging
    /// Client name for identification and logging
    fn name(&self) -> &str;

    /// ส่ง HTTP GET request
    /// Make a GET request
    async fn get(&self, url: &str, headers: HashMap<String, String>) -> Result<ApiResponse>;

    /// ส่ง HTTP POST request พร้อม body
    /// Make a POST request with body
    async fn post(
        &self,
        url: &str,
        body: Vec<u8>,
        headers: HashMap<String, String>,
    ) -> Result<ApiResponse>;

    /// ส่ง HTTP PUT request พร้อม body
    /// Make a PUT request with body
    async fn put(
        &self,
        url: &str,
        body: Vec<u8>,
        headers: HashMap<String, String>,
    ) -> Result<ApiResponse>;

    /// ส่ง HTTP DELETE request
    /// Make a DELETE request
    async fn delete(&self, url: &str, headers: HashMap<String, String>) -> Result<ApiResponse>;

    /// ส่ง HTTP PATCH request พร้อม body
    /// Make a PATCH request with body
    async fn patch(
        &self,
        url: &str,
        body: Vec<u8>,
        headers: HashMap<String, String>,
    ) -> Result<ApiResponse>;
}

/// API Response
#[derive(Debug, Clone)]
pub struct ApiResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
}

impl ApiResponse {
    /// Get response body as string
    pub fn text(&self) -> Result<String> {
        Ok(String::from_utf8(self.body.clone())?)
    }

    /// Get response body as JSON
    pub fn json<T: serde::de::DeserializeOwned>(&self) -> Result<T> {
        Ok(serde_json::from_slice(&self.body)?)
    }

    /// Check if response is successful (2xx)
    pub fn is_success(&self) -> bool {
        self.status >= 200 && self.status < 300
    }
}
