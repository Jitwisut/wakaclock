//! # Quickwit Audit Repository - ระบบจัดการ Audit Logs
//!
//! โมดูลนี้จัดการการเชื่อมต่อกับ Quickwit search engine สำหรับการจัดเก็บ
//! และค้นหา audit logs สำหรับการตรวจสอบความปลอดภัยและการปฏิบัติตาม compliance
//!
//! ## คุณสมบัติหลัก:
//! - Real-time audit log ingestion
//! - Full-text search สำหรับ audit events
//! - Time-based indexing สำหรับ performance
//! - Security event tracking และ monitoring
//! - Compliance reporting และ analytics
//!
//! ## Audit Event Types:
//! - **Credential Access**: การเข้าถึงข้อมูลรับรอง
//! - **Authentication**: เหตุการณ์การยืนยันตัวตน
//! - **Authorization**: การตรวจสอบสิทธิ์
//! - **Data Access**: การเข้าถึงข้อมูลสำคัญ
//! - **System Changes**: การเปลี่ยนแปลงระบบ
//!
//! ## Search Features:
//! - Full-text search ใน log messages
//! - Time-based filtering สำหรับ time ranges
//! - User และ organization filtering
//! - Event type และ severity filtering

use base64::Engine;
use chrono::{DateTime, Utc};
use reqwest::{
    header::{HeaderMap, HeaderValue, AUTHORIZATION},
    Client,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, warn};
use uuid::Uuid;

use crate::model::error::{AppError, AppResult};
use crate::model::v1::platfrom::entries::{AuditAction, CredentialAuditLog};

/// Quickwit configuration
#[derive(Debug, Clone)]
pub struct QuickwitConfig {
    pub url: String,
    pub index_name: String,
    pub timeout_secs: u64,
    pub username: Option<String>,
    pub password: Option<String>,
}

impl Default for QuickwitConfig {
    fn default() -> Self {
        Self {
            url: std::env::var("QUICKWIT_URL")
                .unwrap_or_else(|_| "http://localhost:7280".to_string()),
            index_name: "where-on-sales-logger".to_string(),
            timeout_secs: 30,
            username: std::env::var("QUICKWIT_USERNAME").ok(),
            password: std::env::var("QUICKWIT_PASSWORD").ok(),
        }
    }
}

/// Quickwit audit log repository
pub struct QuickwitAuditRepository {
    client: Arc<Client>,
    config: QuickwitConfig,
}

impl QuickwitAuditRepository {
    pub fn new(config: QuickwitConfig) -> Self {
        let mut headers = HeaderMap::new();

        // Add basic auth header if credentials are provided
        if let (Some(username), Some(password)) = (&config.username, &config.password) {
            let credentials = format!("{}:{}", username, password);
            let encoded = base64::engine::general_purpose::STANDARD.encode(credentials.as_bytes());
            let auth_value = HeaderValue::from_str(&format!("Basic {}", encoded))
                .expect("Failed to create auth header");
            headers.insert(AUTHORIZATION, auth_value);
        }

        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_secs))
            .default_headers(headers)
            .no_proxy()
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client: Arc::new(client),
            config,
        }
    }

    /// Check if index exists
    async fn index_exists(&self) -> AppResult<bool> {
        let url = format!(
            "{}/api/v1/indexes/{}",
            self.config.url, self.config.index_name
        );

        let response = self.client.get(&url).send().await.map_err(|e| {
            AppError::ExternalServiceError(format!("Failed to check index existence: {}", e))
        })?;

        Ok(response.status().is_success())
    }

    /// Initialize Quickwit index for audit logs
    pub async fn init_index(&self) -> AppResult<()> {
        // First check if index already exists
        if self.index_exists().await.unwrap_or(false) {
            info!("Quickwit audit log index already exists");
            return Ok(());
        }

        let index_config = json!({
            "version": "0.7",
            "index_id": &self.config.index_name,
            "doc_mapping": {
                "mode": "dynamic",
                "field_mappings": [
                    {
                        "name": "id",
                        "type": "text",
                        "tokenizer": "raw",
                        "record": "basic",
                        "stored": true
                    },
                    {
                        "name": "credential_id",
                        "type": "text",
                        "tokenizer": "raw",
                        "record": "basic",
                        "stored": true
                    },
                    {
                        "name": "platform",
                        "type": "text",
                        "tokenizer": "default",
                        "record": "position",
                        "stored": true
                    },
                    {
                        "name": "account_id",
                        "type": "text",
                        "tokenizer": "raw",
                        "record": "basic",
                        "stored": true
                    },
                    {
                        "name": "action",
                        "type": "text",
                        "tokenizer": "raw",
                        "record": "basic",
                        "stored": true
                    },
                    {
                        "name": "principal_id",
                        "type": "text",
                        "tokenizer": "raw",
                        "record": "basic",
                        "stored": true
                    },
                    {
                        "name": "principal_type",
                        "type": "text",
                        "tokenizer": "raw",
                        "record": "basic",
                        "stored": true
                    },
                    {
                        "name": "ip_address",
                        "type": "text",
                        "tokenizer": "raw",
                        "record": "basic",
                        "stored": true
                    },
                    {
                        "name": "user_agent",
                        "type": "text",
                        "tokenizer": "default",
                        "record": "position",
                        "stored": true
                    },
                    {
                        "name": "service_name",
                        "type": "text",
                        "tokenizer": "raw",
                        "record": "basic",
                        "stored": true
                    },
                    {
                        "name": "request_id",
                        "type": "text",
                        "tokenizer": "raw",
                        "record": "basic",
                        "stored": true
                    },
                    {
                        "name": "success",
                        "type": "bool",
                        "stored": true
                    },
                    {
                        "name": "error_message",
                        "type": "text",
                        "tokenizer": "default",
                        "record": "position",
                        "stored": true
                    },
                    {
                        "name": "metadata",
                        "type": "json",
                        "stored": true
                    },
                    {
                        "name": "timestamp",
                        "type": "datetime",
                        "input_formats": ["iso8601"],
                        "fast": true,
                        "stored": true
                    }
                ],
                "timestamp_field": "timestamp"
            },
            "search_settings": {
                "default_search_fields": ["platform", "account_id", "principal_id", "action"]
            },
            "indexing_settings": {
                "commit_timeout_secs": 10
            }
        });

        let url = format!("{}/api/v1/indexes", self.config.url);

        let response = self
            .client
            .post(&url)
            .json(&index_config)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalServiceError(format!("Failed to create index: {}", e))
            })?;

        if !response.status().is_success() {
            // 409 Conflict means index already exists, which is OK since we checked above
            // but might have been created between check and create
            if response.status().as_u16() == 409 {
                info!("Quickwit audit log index was created by another process");
            } else {
                let error_text = response.text().await.unwrap_or_default();
                return Err(AppError::ExternalApiError(format!(
                    "Failed to create Quickwit index: {}",
                    error_text
                )));
            }
        } else {
            info!("Quickwit audit log index created successfully");
        }
        Ok(())
    }

    /// Log an audit event to Quickwit
    pub async fn log_audit(&self, audit_log: CredentialAuditLog) -> AppResult<()> {
        let document = json!({
            "id": audit_log.id.to_string(),
            "credential_id": audit_log.credential_id.to_string(),
            "platform": audit_log.platform,
            "account_id": audit_log.account_id,
            // TODO: Add action field to CredentialAuditLog
            // "action": serde_json::to_string(&audit_log.action)?,
            "principal_id": audit_log.principal_id,
            // TODO: Add principal_type field to CredentialAuditLog
            // "principal_type": serde_json::to_string(&audit_log.principal_type)?,
            "ip_address": audit_log.ip_address,
            "user_agent": audit_log.user_agent,
            "service_name": audit_log.service_name,
            "request_id": audit_log.request_id,
            "success": audit_log.success,
            "error_message": audit_log.error_message,
            "metadata": audit_log.metadata,
            "timestamp": audit_log.timestamp.to_rfc3339(),
        });

        let url = format!(
            "{}/api/v1/{}/ingest",
            self.config.url, self.config.index_name
        );

        let response = match self.client.post(&url).json(&vec![document]).send().await {
            Ok(resp) => resp,
            Err(err) => {
                warn!(
                    error = %err,
                    "Quickwit unavailable while logging audit; skipping ingest"
                );
                return Ok(());
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            warn!(
                status = status.as_u16(),
                "Quickwit rejected audit log: {}", error_text
            );
            return Ok(());
        }

        Ok(())
    }

    /// Search audit logs
    pub async fn search_audit_logs(
        &self,
        query: AuditLogQuery,
    ) -> AppResult<Vec<CredentialAuditLog>> {
        let mut search_query = Vec::new();

        if let Some(credential_id) = query.credential_id {
            search_query.push(format!("credential_id:{}", credential_id));
        }
        if let Some(principal_id) = &query.principal_id {
            search_query.push(format!("principal_id:{}", principal_id));
        }
        if let Some(platform) = &query.platform {
            search_query.push(format!("platform:{}", platform));
        }
        if let Some(action) = &query.action {
            search_query.push(format!("action:\"{}\"", serde_json::to_string(action)?));
        }
        if let Some(success) = query.success {
            search_query.push(format!("success:{}", success));
        }

        let query_string = if search_query.is_empty() {
            "*".to_string()
        } else {
            search_query.join(" AND ")
        };

        let search_request = json!({
            "query": query_string,
            "start_timestamp": query.start_time.map(|t| t.timestamp()),
            "end_timestamp": query.end_time.map(|t| t.timestamp()),
            "max_hits": query.limit.unwrap_or(100),
            "start_offset": query.offset.unwrap_or(0),
            "sort_by": "-timestamp"
        });

        let url = format!(
            "{}/api/v1/{}/search",
            self.config.url, self.config.index_name
        );

        let response = match self.client.post(&url).json(&search_request).send().await {
            Ok(resp) => resp,
            Err(err) => {
                warn!(
                    error = %err,
                    "Quickwit unavailable while searching audit logs; returning empty result"
                );
                return Ok(Vec::new());
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            warn!(
                status = status.as_u16(),
                "Quickwit search failed: {}", error_text
            );
            return Ok(Vec::new());
        }

        let search_response: SearchResponse = match response.json().await {
            Ok(value) => value,
            Err(err) => {
                warn!(
                    error = %err,
                    "Quickwit search returned invalid payload; returning empty result"
                );
                return Ok(Vec::new());
            }
        };

        let audit_logs = search_response
            .hits
            .into_iter()
            .map(|hit| self.parse_audit_log(hit))
            .collect::<AppResult<Vec<_>>>()?;

        Ok(audit_logs)
    }

    /// Get audit log statistics
    pub async fn get_audit_stats(
        &self,
        principal_id: Option<String>,
        time_range: Option<(DateTime<Utc>, DateTime<Utc>)>,
    ) -> AppResult<AuditStats> {
        let mut query = Vec::new();
        if let Some(principal_id) = principal_id {
            query.push(format!("principal_id:{}", principal_id));
        }

        let query_string = if query.is_empty() {
            "*".to_string()
        } else {
            query.join(" AND ")
        };

        let agg_request = json!({
            "query": query_string,
            "start_timestamp": time_range.map(|(start, _)| start.timestamp()),
            "end_timestamp": time_range.map(|(_, end)| end.timestamp()),
            "aggs": {
                "by_action": {
                    "terms": {
                        "field": "action",
                        "size": 10
                    }
                },
                "by_platform": {
                    "terms": {
                        "field": "platform",
                        "size": 20
                    }
                },
                "by_success": {
                    "terms": {
                        "field": "success",
                        "size": 2
                    }
                }
            }
        });

        let url = format!(
            "{}/api/v1/{}/search",
            self.config.url, self.config.index_name
        );

        let response = match self.client.post(&url).json(&agg_request).send().await {
            Ok(resp) => resp,
            Err(err) => {
                warn!(
                    error = %err,
                    "Quickwit unavailable while retrieving audit stats; returning defaults"
                );
                return Ok(AuditStats::default());
            }
        };

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            warn!(
                status = status.as_u16(),
                "Quickwit stats query failed: {}", error_text
            );
            return Ok(AuditStats::default());
        }

        let agg_response: serde_json::Value = match response.json().await {
            Ok(value) => value,
            Err(err) => {
                warn!(
                    error = %err,
                    "Quickwit stats payload could not be parsed; returning defaults"
                );
                return Ok(AuditStats::default());
            }
        };

        // Parse aggregation results
        let stats = AuditStats {
            total_events: agg_response["num_hits"].as_u64().unwrap_or(0),
            successful_events: agg_response["aggs"]["by_success"]["buckets"]
                .as_array()
                .and_then(|buckets| {
                    buckets
                        .iter()
                        .find(|b| b["key"].as_bool() == Some(true))
                        .and_then(|b| b["doc_count"].as_u64())
                })
                .unwrap_or(0),
            failed_events: agg_response["aggs"]["by_success"]["buckets"]
                .as_array()
                .and_then(|buckets| {
                    buckets
                        .iter()
                        .find(|b| b["key"].as_bool() == Some(false))
                        .and_then(|b| b["doc_count"].as_u64())
                })
                .unwrap_or(0),
            by_action: self.parse_bucket_counts(&agg_response["aggs"]["by_action"]["buckets"]),
            by_platform: self.parse_bucket_counts(&agg_response["aggs"]["by_platform"]["buckets"]),
        };

        Ok(stats)
    }

    fn parse_audit_log(&self, hit: serde_json::Value) -> AppResult<CredentialAuditLog> {
        let doc = &hit["_source"];

        Ok(CredentialAuditLog {
            id: doc["id"]
                .as_str()
                .and_then(|s| Uuid::parse_str(s).ok())
                .ok_or_else(|| AppError::InvalidInput("Invalid UUID for id".to_string()))?,
            credential_id: doc["credential_id"]
                .as_str()
                .and_then(|s| Uuid::parse_str(s).ok())
                .ok_or_else(|| {
                    AppError::InvalidInput("Invalid UUID for credential_id".to_string())
                })?,
            platform: doc["platform"].as_str().unwrap_or_default().to_string(),
            account_id: doc["account_id"].as_str().unwrap_or_default().to_string(),

            principal_id: doc["principal_id"].as_str().unwrap_or_default().to_string(),

            ip_address: doc["ip_address"].as_str().map(|s| s.to_string()),
            user_agent: doc["user_agent"].as_str().map(|s| s.to_string()),
            service_name: doc["service_name"].as_str().map(|s| s.to_string()),
            request_id: Some(doc["request_id"].as_str().unwrap_or_default().to_string()),
            success: doc["success"].as_bool().unwrap_or(false),
            error_message: doc["error_message"].as_str().map(|s| s.to_string()),
            metadata: Some(doc["metadata"].clone()),
            timestamp: doc["timestamp"]
                .as_str()
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(Utc::now),
        })
    }

    fn parse_bucket_counts(&self, buckets: &serde_json::Value) -> Vec<(String, u64)> {
        buckets
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|bucket| {
                        let key = bucket["key"].as_str()?.to_string();
                        let count = bucket["doc_count"].as_u64()?;
                        Some((key, count))
                    })
                    .collect()
            })
            .unwrap_or_default()
    }
}

/// Query parameters for searching audit logs
#[derive(Debug, Default)]
pub struct AuditLogQuery {
    pub credential_id: Option<Uuid>,
    pub principal_id: Option<String>,
    pub platform: Option<String>,
    pub action: Option<AuditAction>,
    pub success: Option<bool>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Audit statistics
#[derive(Debug, Serialize, Default)]
pub struct AuditStats {
    pub total_events: u64,
    pub successful_events: u64,
    pub failed_events: u64,
    pub by_action: Vec<(String, u64)>,
    pub by_platform: Vec<(String, u64)>,
}

/// Quickwit search response
#[derive(Debug, Deserialize)]
struct SearchResponse {
    pub hits: Vec<serde_json::Value>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_quickwit_audit_repository() {
        let config = QuickwitConfig::default();
        let repo = QuickwitAuditRepository::new(config);

        // Initialize index
        let _ = repo.init_index().await;

        // Create test audit log
        let audit_log = CredentialAuditLog {
            id: Uuid::new_v4(),
            credential_id: Uuid::new_v4(),
            platform: "test_platform".to_string(),
            account_id: "test_account".to_string(),

            principal_id: "test_user".to_string(),

            ip_address: Some("127.0.0.1".to_string()),
            user_agent: Some("test_agent".to_string()),
            service_name: Some("test_service".to_string()),
            request_id: Some(Uuid::new_v4().to_string()),
            success: true,
            error_message: None,
            metadata: Some(json!({"test": "data"})),
            timestamp: Utc::now(),
        };

        // Log audit event
        let result = repo.log_audit(audit_log.clone()).await;
        assert!(result.is_ok());

        // Search for the audit log
        let query = AuditLogQuery {
            credential_id: Some(audit_log.credential_id),
            ..Default::default()
        };

        // Note: Quickwit needs time to index, so immediate search might not return results
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        let search_results = repo.search_audit_logs(query).await;
        assert!(search_results.is_ok());
    }

    #[tokio::test]
    async fn test_quickwit_audit_repository_with_basic_auth() {
        let config = QuickwitConfig {
            url: "http://localhost:7280".to_string(),
            index_name: "test-audit-logs".to_string(),
            timeout_secs: 30,
            username: Some("admin".to_string()),
            password: Some("secret".to_string()),
        };
        let repo = QuickwitAuditRepository::new(config);

        // Note: We can't directly verify headers on the built client since it's wrapped in Arc
        // The headers are set during client building and will be included in requests
        // To properly test this, we'd need to make an actual request and inspect it

        // For now, just verify the repository was created
        assert_eq!(repo.config.username, Some("admin".to_string()));
        assert_eq!(repo.config.password, Some("secret".to_string()));
    }

    #[tokio::test]
    async fn test_quickwit_config_from_env() {
        // Test environment variable loading
        std::env::set_var("QUICKWIT_USERNAME", "env_user");
        std::env::set_var("QUICKWIT_PASSWORD", "env_pass");

        let config = QuickwitConfig::default();

        assert_eq!(config.username, Some("env_user".to_string()));
        assert_eq!(config.password, Some("env_pass".to_string()));

        // Clean up
        std::env::remove_var("QUICKWIT_USERNAME");
        std::env::remove_var("QUICKWIT_PASSWORD");
    }
}
