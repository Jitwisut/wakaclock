//! # Auth Config Repository - ระบบจัดการการตั้งค่าการยืนยันตัวตน
//!
//! โมดูลนี้จัดการข้อมูลการตั้งค่าการยืนยันตัวตนแบบ runtime, OAuth state,
//! และการเชื่อมโยงข้อมูลผู้ใช้กับ identity providers ต่างๆ
//!
//! ## คุณสมบัติหลัก:
//! - Dynamic authentication configuration
//! - OAuth state management และ validation
//! - Multi-provider identity linking
//! - PKCE และ state validation support
//! - Runtime configuration updates
//!
//! ## การจัดเก็บข้อมูล:
//! - **ClickHouse**: สำหรับข้อมูลการตั้งค่าและ audit logs
//! - **Redis**: สำหรับ OAuth state caching
//! - **Memory**: สำหรับ frequently accessed configs
//!
//! ## Security Features:
//! - OAuth state validation
//! - PKCE (Proof Key for Code Exchange) support
//! - Redirect URI validation
//! - Nonce validation สำหรับ OpenID Connect
use anyhow::{Context, Result};
use clickhouse::Row;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

use crate::client::database::ClickHouseClient;

/// โครงสร้างข้อมูลสำหรับการตั้งค่าการยืนยันตัวตนแบบ runtime
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct AuthRuntimeConfig {
    pub config_id: String,
    pub config_version: u32,
    pub allowed_redirect_uris: Vec<String>,
    pub allowed_origins: Vec<String>,
    pub scopes: Vec<String>,
    pub google_client_id: String,
    pub enable_pkce: u8,
    pub enable_state_validation: u8,
    pub enable_nonce_validation: u8,
    pub max_redirect_uris: u32,
    pub max_origins: u32,
    pub updated_by: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub is_active: u8,
}

impl AuthRuntimeConfig {
    pub fn is_pkce_enabled(&self) -> bool {
        self.enable_pkce == 1
    }

    pub fn is_state_validation_enabled(&self) -> bool {
        self.enable_state_validation == 1
    }

    pub fn is_nonce_validation_enabled(&self) -> bool {
        self.enable_nonce_validation == 1
    }

    pub fn is_active(&self) -> bool {
        self.is_active == 1
    }
}

/// โครงสร้างข้อมูลสำหรับการอัปเดตการตั้งค่าการยืนยันตัวตน
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAuthConfig {
    pub allowed_redirect_uris: Option<Vec<String>>,
    pub allowed_origins: Option<Vec<String>>,
    pub scopes: Option<Vec<String>>,
    pub enable_pkce: Option<bool>,
    pub enable_state_validation: Option<bool>,
    pub enable_nonce_validation: Option<bool>,
}

/// โครงสร้างข้อมูลสำหรับเก็บสถานะ Google OAuth
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct GoogleOAuthState {
    pub state: String,
    pub code_verifier: String,
    pub code_challenge: String,
    pub code_challenge_method: String,
    pub nonce: String,
    pub redirect_uri: String,
    pub requested_scopes: Vec<String>,
    pub return_to: String,
    pub user_agent: String,
    pub ip_address: String,
    pub expires_at: chrono::DateTime<chrono::Utc>,
}

/// โครงสร้างข้อมูลสำหรับการเชื่อมโยงข้อมูลผู้ใช้กับ identity providers
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct UserIdentityLink {
    pub link_id: String,
    pub user_id: String,
    pub provider: String,
    pub provider_user_id: String,
    pub email: String,
    pub email_verified: bool,
    pub linked_at: chrono::DateTime<chrono::Utc>,
    pub last_used_at: chrono::DateTime<chrono::Utc>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Repository สำหรับการจัดการการตั้งค่าการยืนยันตัวตน
pub struct AuthConfigRepository {
    pub client: Arc<ClickHouseClient>,
}

impl AuthConfigRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    pub async fn get_active_config(&self) -> Result<AuthRuntimeConfig> {
        let query = r#"
            SELECT 
                config_id,
                config_version,
                allowed_redirect_uris,
                allowed_origins,
                scopes,
                google_client_id,
                enable_pkce,
                enable_state_validation,
                enable_nonce_validation,
                max_redirect_uris,
                max_origins,
                updated_by,
                created_at,
                updated_at,
                is_active
            FROM auth_runtime_config
            WHERE is_active = 1
            ORDER BY config_version DESC
            LIMIT 1
        "#;

        let configs = self
            .client
            .query(query)
            .fetch_all::<AuthRuntimeConfig>()
            .await
            .context("Failed to query active auth config")?;

        configs
            .into_iter()
            .next()
            .ok_or_else(|| anyhow::anyhow!("No active auth configuration found"))
    }

    pub async fn update_config(
        &self,
        update: UpdateAuthConfig,
        updated_by: &str,
    ) -> Result<AuthRuntimeConfig> {
        // Get current config
        let current = self.get_active_config().await?;

        // Prepare new config with incremented version
        let new_version = current.config_version + 1;
        let new_config_id = uuid::Uuid::new_v4().to_string();

        // Build update values
        let allowed_redirect_uris = update
            .allowed_redirect_uris
            .clone()
            .unwrap_or(current.allowed_redirect_uris.clone());
        let allowed_origins = update
            .allowed_origins
            .clone()
            .unwrap_or(current.allowed_origins.clone());
        let scopes = update.scopes.clone().unwrap_or(current.scopes.clone());

        // Validate limits
        if allowed_redirect_uris.len() > current.max_redirect_uris as usize {
            anyhow::bail!(
                "Too many redirect URIs. Maximum allowed: {}",
                current.max_redirect_uris
            );
        }
        if allowed_origins.len() > current.max_origins as usize {
            anyhow::bail!("Too many origins. Maximum allowed: {}", current.max_origins);
        }

        // Deactivate current config
        let deactivate_query = format!(
            "ALTER TABLE auth_runtime_config UPDATE is_active = 0 WHERE config_id = '{}'",
            current.config_id
        );
        self.client
            .query(&deactivate_query)
            .execute()
            .await
            .context("Failed to deactivate current config")?;

        // Insert new config
        let insert_query = r#"
            INSERT INTO auth_runtime_config (
                config_id,
                config_version,
                allowed_redirect_uris,
                allowed_origins,
                scopes,
                google_client_id,
                enable_pkce,
                enable_state_validation,
                enable_nonce_validation,
                max_redirect_uris,
                max_origins,
                updated_by,
                is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        "#;

        self.client
            .query(insert_query)
            .bind(new_config_id.clone())
            .bind(new_version)
            .bind(allowed_redirect_uris.clone())
            .bind(allowed_origins.clone())
            .bind(scopes.clone())
            .bind(current.google_client_id.clone())
            .bind(if update.enable_pkce.unwrap_or(current.is_pkce_enabled()) {
                1u8
            } else {
                0u8
            })
            .bind(
                if update
                    .enable_state_validation
                    .unwrap_or(current.is_state_validation_enabled())
                {
                    1u8
                } else {
                    0u8
                },
            )
            .bind(
                if update
                    .enable_nonce_validation
                    .unwrap_or(current.is_nonce_validation_enabled())
                {
                    1u8
                } else {
                    0u8
                },
            )
            .bind(current.max_redirect_uris)
            .bind(current.max_origins)
            .bind(updated_by)
            .execute()
            .await
            .context("Failed to insert new auth config")?;

        // Log audit trail
        self.audit_config_change(
            &new_config_id,
            new_version,
            "update",
            updated_by,
            &current,
            &update,
        )
        .await?;

        // Return new config
        self.get_active_config().await
    }

    async fn audit_config_change(
        &self,
        config_id: &str,
        config_version: u32,
        action: &str,
        changed_by: &str,
        old_config: &AuthRuntimeConfig,
        update: &UpdateAuthConfig,
    ) -> Result<()> {
        let changed_fields = serde_json::to_string(&update)?;
        let old_values = serde_json::json!({
            "allowed_redirect_uris": old_config.allowed_redirect_uris,
            "allowed_origins": old_config.allowed_origins,
            "scopes": old_config.scopes,
            "enable_pkce": old_config.is_pkce_enabled(),
            "enable_state_validation": old_config.is_state_validation_enabled(),
            "enable_nonce_validation": old_config.is_nonce_validation_enabled(),
        })
        .to_string();

        let new_values = serde_json::json!({
            "allowed_redirect_uris": update.allowed_redirect_uris.as_ref().unwrap_or(&old_config.allowed_redirect_uris),
            "allowed_origins": update.allowed_origins.as_ref().unwrap_or(&old_config.allowed_origins),
            "scopes": update.scopes.as_ref().unwrap_or(&old_config.scopes),
            "enable_pkce": update.enable_pkce.unwrap_or(old_config.is_pkce_enabled()),
            "enable_state_validation": update.enable_state_validation.unwrap_or(old_config.is_state_validation_enabled()),
            "enable_nonce_validation": update.enable_nonce_validation.unwrap_or(old_config.is_nonce_validation_enabled()),
        })
        .to_string();

        let query = r#"
            INSERT INTO auth_config_audit (
                config_id,
                config_version,
                action,
                changed_by,
                changed_fields,
                old_values,
                new_values
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        "#;

        self.client
            .query(query)
            .bind(config_id)
            .bind(config_version)
            .bind(action)
            .bind(changed_by)
            .bind(changed_fields)
            .bind(old_values)
            .bind(new_values)
            .execute()
            .await
            .context("Failed to insert audit log")?;

        Ok(())
    }

    pub async fn save_oauth_state(&self, state: &GoogleOAuthState) -> Result<()> {
        let query = r#"
            INSERT INTO google_oauth_state (
                state,
                code_verifier,
                code_challenge,
                code_challenge_method,
                nonce,
                redirect_uri,
                requested_scopes,
                return_to,
                user_agent,
                ip_address,
                expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#;

        self.client
            .query(query)
            .bind(&state.state)
            .bind(&state.code_verifier)
            .bind(&state.code_challenge)
            .bind(&state.code_challenge_method)
            .bind(&state.nonce)
            .bind(&state.redirect_uri)
            .bind(&state.requested_scopes)
            .bind(&state.return_to)
            .bind(&state.user_agent)
            .bind(&state.ip_address)
            .bind(state.expires_at)
            .execute()
            .await
            .context("Failed to save OAuth state")?;

        Ok(())
    }

    pub async fn get_oauth_state(&self, state: &str) -> Result<GoogleOAuthState> {
        let query = r#"
            SELECT 
                state,
                code_verifier,
                code_challenge,
                code_challenge_method,
                nonce,
                redirect_uri,
                requested_scopes,
                return_to,
                user_agent,
                ip_address,
                expires_at
            FROM google_oauth_state
            WHERE state = ? AND expires_at > now()
            LIMIT 1
        "#;

        let states = self
            .client
            .query(query)
            .bind(state)
            .fetch_all::<GoogleOAuthState>()
            .await
            .context("Failed to query OAuth state")?;

        states
            .into_iter()
            .next()
            .ok_or_else(|| anyhow::anyhow!("OAuth state not found or expired"))
    }

    pub async fn delete_oauth_state(&self, state: &str) -> Result<()> {
        let query = format!(
            "ALTER TABLE google_oauth_state DELETE WHERE state = '{}'",
            state
        );

        self.client
            .query(&query)
            .execute()
            .await
            .context("Failed to delete OAuth state")?;

        Ok(())
    }

    pub async fn link_identity(
        &self,
        user_id: &str,
        provider: &str,
        provider_user_id: &str,
        email: &str,
        email_verified: bool,
        metadata: HashMap<String, serde_json::Value>,
    ) -> Result<UserIdentityLink> {
        let link_id = uuid::Uuid::new_v4().to_string();
        let metadata_str = serde_json::to_string(&metadata)?;

        let query = r#"
            INSERT INTO user_identity_links (
                link_id,
                user_id,
                provider,
                provider_user_id,
                email,
                email_verified,
                metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        "#;

        self.client
            .query(query)
            .bind(&link_id)
            .bind(user_id)
            .bind(provider)
            .bind(provider_user_id)
            .bind(email)
            .bind(if email_verified { 1u8 } else { 0u8 })
            .bind(metadata_str)
            .execute()
            .await
            .context("Failed to link identity")?;

        Ok(UserIdentityLink {
            link_id,
            user_id: user_id.to_string(),
            provider: provider.to_string(),
            provider_user_id: provider_user_id.to_string(),
            email: email.to_string(),
            email_verified,
            linked_at: chrono::Utc::now(),
            last_used_at: chrono::Utc::now(),
            metadata,
        })
    }

    pub async fn find_linked_user(
        &self,
        provider: &str,
        provider_user_id: &str,
    ) -> Result<Option<String>> {
        let query = r#"
            SELECT user_id
            FROM user_identity_links
            WHERE provider = ? AND provider_user_id = ?
            LIMIT 1
        "#;

        #[derive(Row, Deserialize)]
        struct UserIdRow {
            user_id: String,
        }

        let users = self
            .client
            .query(query)
            .bind(provider)
            .bind(provider_user_id)
            .fetch_all::<UserIdRow>()
            .await
            .context("Failed to query linked user")?;

        Ok(users.into_iter().next().map(|row| row.user_id))
    }

    pub async fn find_user_by_email(&self, email: &str) -> Result<Option<String>> {
        let query = r#"
            SELECT user_id
            FROM user_profiles
            WHERE email = ?
            LIMIT 1
        "#;

        #[derive(Row, Deserialize)]
        struct UserIdRow {
            user_id: String,
        }

        let users = self
            .client
            .query(query)
            .bind(email)
            .fetch_all::<UserIdRow>()
            .await
            .context("Failed to query user by email")?;

        Ok(users.into_iter().next().map(|row| row.user_id))
    }

    pub async fn update_last_used(&self, link_id: &str) -> Result<()> {
        let query = format!(
            "ALTER TABLE user_identity_links UPDATE last_used_at = now() WHERE link_id = '{}'",
            link_id
        );

        self.client
            .query(&query)
            .execute()
            .await
            .context("Failed to update last used time")?;

        Ok(())
    }
}
