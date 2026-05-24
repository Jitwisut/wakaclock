//! # Platform Configuration Module
//!
//! โมดูลนี้จัดการการกำหนดค่าสำหรับแพลตฟอร์ม E-commerce ต่างๆ
//! รองรับการปรับแต่งการเชื่อมต่อ OAuth, API Key และ Credentials
//!
//! ## ฟีเจอร์หลัก
//! - OAuth configuration สำหรับแพลตฟอร์มที่ใช้ OAuth
//! - API Key configuration สำหรับ API key authentication
//! - Credentials configuration สำหรับ basic auth และ JWT
//! - Dynamic platform loading จาก configuration files
//! - Fallback configuration สำหรับ default settings

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformConfigs {
    pub platforms: HashMap<String, PlatformConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformConfig {
    pub name: String,
    pub auth_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub oauth: Option<OAuthConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<ApiKeyConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credentials: Option<CredentialsConfig>,
    pub required_env: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    pub authorize_url: String,
    pub token_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scopes: Option<Vec<String>>,
    #[serde(default)]
    pub state_support: bool,
    #[serde(default)]
    pub uses_hmac_signature: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub redirect_suffix_pattern: Option<String>,
    #[serde(default)]
    pub requires_shop_domain: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub header_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query_param: Option<String>,
    pub required_fields: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialsConfig {
    pub auth_method: String, // "basic", "jwt", "token"
    pub required_fields: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub header_name: Option<String>,
}

impl PlatformConfigs {
    /// Load platform configurations from JSON file
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let config_path = std::env::var("PLATFORM_CONFIG_PATH")
            .unwrap_or_else(|_| "config/platforms.json".to_string());

        let config_data = std::fs::read_to_string(&config_path)?;
        let configs: PlatformConfigs = serde_json::from_str(&config_data)?;

        Ok(configs)
    }

    /// Load with fallback to embedded default config
    pub fn load_with_fallback() -> Self {
        Self::load().unwrap_or_else(|e| {
            tracing::warn!(
                "Failed to load platform config from file: {}, using defaults",
                e
            );
            Self::default()
        })
    }

    /// Get configuration for a specific platform
    pub fn get_platform(&self, platform_id: &str) -> Option<&PlatformConfig> {
        self.platforms.get(&platform_id.to_lowercase())
    }

    /// Get authentication type for a platform
    pub fn get_auth_type(&self, platform_id: &str) -> Option<String> {
        self.get_platform(platform_id).map(|c| c.auth_type.clone())
    }
}

impl Default for PlatformConfigs {
    fn default() -> Self {
        // Minimal default configuration as fallback
        let mut platforms = HashMap::new();

        // Add a few default platforms
        platforms.insert(
            "tiktok".to_string(),
            PlatformConfig {
                name: "TikTok Shop".to_string(),
                auth_type: "oauth".to_string(),
                oauth: Some(OAuthConfig {
                    authorize_url: "https://auth.tiktok-shops.com/oauth/authorize".to_string(),
                    token_url: "https://auth.tiktok-shops.com/api/v2/token".to_string(),
                    scopes: Some(vec!["seller.product.basic".to_string()]),
                    state_support: true,
                    uses_hmac_signature: false,
                    redirect_suffix_pattern: None,
                    requires_shop_domain: false,
                }),
                api_key: None,
                credentials: None,
                required_env: vec![
                    "TIKTOK_APP_KEY".to_string(),
                    "TIKTOK_APP_SECRET".to_string(),
                ],
            },
        );

        platforms.insert(
            "woocommerce".to_string(),
            PlatformConfig {
                name: "WooCommerce".to_string(),
                auth_type: "credentials".to_string(),
                oauth: None,
                api_key: None,
                credentials: Some(CredentialsConfig {
                    auth_method: "basic".to_string(),
                    required_fields: vec![
                        "consumer_key".to_string(),
                        "consumer_secret".to_string(),
                        "store_url".to_string(),
                    ],
                    header_name: None,
                }),
                required_env: vec![],
            },
        );

        Self { platforms }
    }
}
