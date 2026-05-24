//! Gateway Request Models
//!
//! โมดูลนี้จัดการโครงสร้างข้อมูลสำหรับ Gateway API requests ที่เป็น core functionality
//! รวมถึง shop connections, OAuth flows, token management และ vector operations
//!
//! # Core Features
//! - **Shop Connections** - ConnectRequest, CallbackRequest, DisconnectRequest
//! - **Token Management** - TokenRefreshRequest, TokenValidateRequest
//! - **Product Operations** - ProductListRequest พร้อม pagination
//! - **Credential Management** - CredentialRequest พร้อม metadata support
//! - **Vector Operations** - UpsertRequest สำหรับ AI embeddings
//! - **Query Parameters** - GetProductVectorQuery, SyncStatusQuery
//!
//! # OAuth Flow Support
//! - Standard OAuth 2.0 authorization code flow
//! - PKCE extension support สำหรับ enhanced security
//! - Platform-specific URL suffix handling (Lazada, Shopee)
//! - State parameter for CSRF protection

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Connection requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectRequest {
    pub shop_id: String,
    pub org_id: String,
    pub user_id: String,
    pub state: String,
    pub redirect_uri: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallbackRequest {
    pub code: String,
    pub state: Option<String>,
    pub redirect_suffix: Option<String>, // For platforms like Lazada/Shopee that use URL suffix
    pub error: Option<String>,
    pub error_description: Option<String>,
}

// Token management requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenRefreshRequest {
    pub shop_id: String,
    pub refresh_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenValidateRequest {
    pub shop_id: String,
    pub access_token: String,
}

// Product requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductListRequest {
    pub shop_id: String,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub status: Option<String>,
}

// Credential requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialRequest {
    pub shop_id: String,
    pub org_id: String,
    pub user_id: String,
    pub credentials: HashMap<String, String>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

// Disconnect request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisconnectRequest {
    pub shop_id: String,
    pub org_id: String,
    pub user_id: String,
    pub reason: Option<String>,
}

// Vector requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertRequest {
    pub platform: String,
    pub shop_id: String,
    pub product_id: String,
    pub vector: Vec<f32>,
    pub metadata: serde_json::Value,
}

// Query parameters
#[derive(Debug, Deserialize)]
pub struct GetProductVectorQuery {
    pub platform: String,
    pub shop_id: String,
}

#[derive(Debug, Deserialize)]
pub struct SyncStatusQuery {
    pub platform: String,
    pub shop_id: String,
    pub job_id: Option<String>,
}
