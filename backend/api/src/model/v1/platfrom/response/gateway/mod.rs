/// โมดูล response models สำหรับ gateway operations
///
/// โมดูลนี้รวมโครงสร้างข้อมูล response สำหรับ gateway endpoints
/// ที่ใช้ในการเชื่อมต่อกับแพลตฟอร์มต่างๆ
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// Connection responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectResponse {
    pub oauth_url: Option<String>,
    pub platform: String,
    pub auth_type: String,       // "oauth", "api_key", or "credentials"
    pub connected: Option<bool>, // For credential/API key platforms
    pub state: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
    pub instructions: Option<String>,
    pub required_fields: Option<Vec<String>>,
    pub credentials_endpoint: Option<String>,
    pub credentials_stored: Option<bool>, // For credential/API key platforms
    pub last_sync: Option<DateTime<Utc>>, // For connected platforms
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallbackResponse {
    pub success: bool,
    pub platform: String,
    pub shop_id: Option<String>,
    pub message: Option<String>,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_in: Option<i64>,
}

// Token responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenRefreshResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenValidateResponse {
    pub valid: bool,
    pub expires_at: Option<DateTime<Utc>>,
    pub scopes: Vec<String>,
}

// Platform status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformStatus {
    pub platform: String,
    pub connected: bool,
    pub last_sync: Option<DateTime<Utc>>,
    pub credentials_stored: bool,
}

// Error response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayError {
    pub error: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub timestamp: DateTime<Utc>,
}

// Vector responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertResponse {
    pub success: bool,
    pub message: String,
    pub vector_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductVector {
    pub product_id: String,
    pub platform: String,
    pub shop_id: String,
    pub vector: Vec<f32>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub job_id: Option<String>,
    pub status: String,
    pub synced_count: usize,
    pub total_count: usize,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
}

// Shop info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShopInfo {
    pub shop_id: String,
    pub shop_name: String,
    pub platform: String,
    pub status: String,
}
