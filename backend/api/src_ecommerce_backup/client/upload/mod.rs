// UploadClient - ระบบจัดการอัปโหลดไฟล์
// ใช้ในการอัปโหลดไฟล์ภาพ, documents และ attachments ต่างๆ
// รวมกับ App container เพื่อเข้าถึง shared storage services

use crate::infrastructure::app::App;
use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;

/// UploadClient - คลายเนต์สำหรับจัดการการอัปโหลดไฟล์
/// จัดการการอัปโหลด, validation และ storage ของไฟล์
pub struct UploadClient {
    app: Arc<App>, // App container เพื่อเข้าถึง storage services
    http_client: reqwest::Client,
}

impl UploadClient {
    /// new - สร้าง UploadClient ใหม่
    /// รับ App container เพื่อเข้าถึง shared storage dependencies
    pub fn new(app: Arc<App>) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self { app, http_client }
    }

    /// upload - ประมวลผลการอัปโหลดไฟล์ผ่าน Cloudflare Worker
    /// รับข้อมูลไฟล์และ metadata แล้วคืนค่า key/URL ของไฟล์ที่อัปโหลด
    pub async fn upload(
        &self,
        file_data: &[u8],
        filename: &str,
        content_type: &str,
        folder: Option<&str>,
    ) -> Result<WorkerUploadResult> {
        let upload_url = self
            .app
            .upload_config
            .cf_worker_upload_url
            .as_deref()
            .or_else(|| self.app.config.media.cf_worker_upload_url.as_deref())
            .ok_or_else(|| anyhow!("Cloudflare worker upload URL is not configured"))?;

        let token = self
            .app
            .upload_config
            .cf_worker_token
            .as_deref()
            .or_else(|| self.app.config.media.cf_worker_api_token.as_deref());

        let payload = json!({
            "filename": filename,
            "contentType": content_type,
            "data": BASE64.encode(file_data),
            "folder": folder,
        });

        let mut request = self.http_client.post(upload_url).json(&payload);
        if let Some(token) = token {
            request = request.bearer_auth(token);
        }

        let response = request
            .send()
            .await
            .context("failed to call upload worker")?;
        if !response.status().is_success() {
            let status = response.status();
            let body = response
                .text()
                .await
                .unwrap_or_else(|_| "<empty>".to_string());
            return Err(anyhow!(
                "upload worker returned error {} with body {}",
                status,
                body
            ));
        }

        let worker_response: WorkerUploadResponse = response
            .json()
            .await
            .context("failed to parse upload worker response")?;

        if !worker_response.success {
            let error = worker_response
                .error
                .or(worker_response.message)
                .unwrap_or_else(|| "upload worker reported failure".to_string());
            return Err(anyhow!(error));
        }

        let key = worker_response
            .key
            .ok_or_else(|| anyhow!("upload worker did not return a storage key"))?;

        Ok(WorkerUploadResult {
            key,
            public_url: worker_response.url,
            download_url: worker_response.download_url,
        })
    }

    /// build a download URL either from worker response or configuration
    pub fn build_download_url(&self, key: &str) -> Result<String> {
        if key.is_empty() {
            return Err(anyhow!("download key is required"));
        }

        if let Some(base) = self
            .app
            .upload_config
            .cf_worker_download_url
            .as_deref()
            .or_else(|| self.app.config.media.cf_worker_download_url.as_deref())
        {
            let normalized = base.trim_end_matches('/');
            return Ok(format!("{}/{}", normalized, key));
        }

        Err(anyhow!("Cloudflare worker download URL is not configured"))
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerUploadResponse {
    success: bool,
    key: Option<String>,
    url: Option<String>,
    #[serde(alias = "downloadUrl")]
    download_url: Option<String>,
    error: Option<String>,
    message: Option<String>,
}

/// Result returned after uploading content to the worker
#[derive(Debug, Clone)]
pub struct WorkerUploadResult {
    pub key: String,
    pub public_url: Option<String>,
    pub download_url: Option<String>,
}
