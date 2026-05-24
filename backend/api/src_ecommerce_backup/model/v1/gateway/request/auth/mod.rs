//! Authentication Request Models
//!
//! โมดูลนี้จัดการโครงสร้างข้อมูลสำหรับ authentication requests
//! รวมถึง login, registration, token refresh และ OAuth configuration
//!
//! # Features
//! - User login และ registration requests
//! - JWT token refresh mechanism
//! - OAuth configuration updates
//! - PKCE support สำหरับ enhanced security

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct UpdateAuthConfigRequest {
    pub allowed_redirect_uris: Vec<String>,
    pub allowed_origins: Vec<String>,
    pub scopes: Vec<String>,
    pub enable_pkce: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}
