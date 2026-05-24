//! # Configuration Loader - ระบบโหลดการตั้งค่า
//!
//! โมดูลนี้จัดการการโหลดและ parsing การตั้งค่าจากไฟล์ JSON และ environment variables
//! สำหรับการตั้งค่า platform credentials และ application configuration
//!
//! ## คุณสมบัติหลัก:
//! - JSON configuration file loading
//! - Environment variable substitution
//! - Configuration validation และ error handling
//! - Default values และ fallback configuration
//! - Hot-reload support สำหรับ development
//!
//! ## Configuration Sources:
//! - **JSON Files**: Primary configuration storage
//! - **Environment Variables**: Secret injection และ overrides
//! - **Default Values**: Fallback configuration
//! - **Runtime Updates**: Dynamic configuration changes
//!
//! ## Security Features:
//! - Environment variable expansion สำหรับ secrets
//! - Configuration validation
//! - Error handling สำหรับ missing or invalid config
//! - Credential masking ใน logs

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::Path};
use tracing::{info, warn};

use super::PlatformCredentials;
use crate::model::error::{AppError, AppResult};

/// Platform credentials configuration loaded from JSON
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PlatformCredentialsConfig {
    /// Version of the configuration schema
    pub version: String,

    /// Platform configurations indexed by platform name
    pub platforms: HashMap<String, PlatformCredentialEntry>,

    /// Default values for all platforms
    pub defaults: Option<PlatformDefaults>,
}

/// Individual platform credential entry
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PlatformCredentialEntry {
    /// Display name for the platform
    pub display_name: String,

    /// Platform type (oauth, api_key, hybrid)
    pub auth_type: String,

    /// Whether the platform is enabled
    pub enabled: bool,

    /// OAuth/API credentials
    pub credentials: PlatformCredentials,

    /// Platform-specific configuration
    pub config: Option<PlatformSpecificConfig>,

    /// Environment-specific overrides
    pub environments: Option<HashMap<String, PlatformCredentials>>,
}

/// Platform-specific configuration options
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PlatformSpecificConfig {
    /// API version to use
    pub api_version: Option<String>,

    /// Region-specific endpoints
    pub regions: Option<HashMap<String, String>>,

    /// Webhook URLs
    pub webhook_urls: Option<HashMap<String, String>>,

    /// Custom headers
    pub custom_headers: Option<HashMap<String, String>>,

    /// Feature flags
    pub features: Option<HashMap<String, bool>>,

    /// Rate limiting configuration
    pub rate_limits: Option<RateLimitConfig>,
}

/// Rate limiting configuration
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RateLimitConfig {
    /// Requests per second
    pub requests_per_second: f64,

    /// Burst size
    pub burst_size: u32,

    /// Retry after rate limit hit (seconds)
    pub retry_after_seconds: u64,
}

/// Default values for platform configuration
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PlatformDefaults {
    pub redirect_uri: Option<String>,
    pub rate_limit_rps: Option<f64>,
    pub api_timeout_seconds: Option<u64>,
    pub max_retries: Option<u32>,
}

/// Expand environment variables in a string like ${VAR_NAME}
fn expand_env_vars(text: &str) -> String {
    let re = Regex::new(r"\$\{([^}]+)\}").unwrap();
    let result = re
        .replace_all(text, |caps: &regex::Captures| {
            let var_name = &caps[1];
            match std::env::var(var_name) {
                Ok(value) => {
                    // Log only partial value for security
                    let display_value = if var_name.contains("SECRET") || var_name.contains("KEY") {
                        format!("{}...", &value.chars().take(6).collect::<String>())
                    } else {
                        value.clone()
                    };
                    tracing::debug!("Expanded environment variable {}={}", var_name, display_value);
                    value
                }
                Err(_) => {
                    tracing::error!("Environment variable {} not found! This may cause API authentication to fail.", var_name);
                    // For critical auth variables, return empty string to make errors more obvious
                    if var_name.contains("_KEY") || var_name.contains("_SECRET") {
                        tracing::error!("Critical authentication variable {} is missing! API calls will fail.", var_name);
                        String::new()
                    } else {
                        format!("${{{}}}", var_name) // Keep original for non-critical vars
                    }
                }
            }
        })
        .to_string();
    if result != text {
        let display_result = if text.contains("SECRET") || text.contains("KEY") {
            format!("{}...", &result.chars().take(10).collect::<String>())
        } else {
            result.clone()
        };
        tracing::debug!("Environment expansion: '{}' -> '{}'", text, display_result);
    }
    result
}

/// Expand environment variables in platform credentials
fn expand_credentials_env_vars(mut creds: PlatformCredentials) -> PlatformCredentials {
    creds.app_key = expand_env_vars(&creds.app_key);
    creds.app_secret = expand_env_vars(&creds.app_secret);
    if let Some(ref uri) = creds.redirect_uri {
        creds.redirect_uri = Some(expand_env_vars(uri));
    }
    creds.api_base_url = expand_env_vars(&creds.api_base_url);
    if let Some(ref url) = creds.oauth_authorize_url {
        creds.oauth_authorize_url = Some(expand_env_vars(url));
    }
    if let Some(ref url) = creds.oauth_token_url {
        creds.oauth_token_url = Some(expand_env_vars(url));
    }
    if let Some(ref url) = creds.oauth_refresh_url {
        creds.oauth_refresh_url = Some(expand_env_vars(url));
    }
    if let Some(ref url) = creds.oauth_revoke_url {
        creds.oauth_revoke_url = Some(expand_env_vars(url));
    }
    if let Some(ref id) = creds.store_id {
        creds.store_id = Some(expand_env_vars(id));
    }
    if let Some(ref url) = creds.base_url {
        creds.base_url = Some(expand_env_vars(url));
    }
    if let Some(ref id) = creds.tenant_id {
        creds.tenant_id = Some(expand_env_vars(id));
    }
    creds
}

impl PlatformCredentialsConfig {
    /// Load platform credentials from a JSON file
    pub fn from_file<P: AsRef<Path>>(path: P) -> AppResult<Self> {
        let path = path.as_ref();

        if !path.exists() {
            return Err(AppError::ValidationError(format!(
                "Platform credentials file not found: {}",
                path.display()
            )));
        }

        let contents = fs::read_to_string(path).map_err(|e| {
            AppError::ValidationError(format!("Failed to read platform credentials file: {}", e))
        })?;

        let config: PlatformCredentialsConfig = serde_json::from_str(&contents).map_err(|e| {
            AppError::ValidationError(format!("Failed to parse platform credentials JSON: {}", e))
        })?;

        info!(
            "Loaded platform credentials for {} platforms from {}",
            config.platforms.len(),
            path.display()
        );

        config.validate()?;

        Ok(config)
    }

    /// Load from environment variable pointing to file path
    pub fn from_env() -> AppResult<Self> {
        let path = std::env::var("PLATFORM_CREDENTIALS_FILE")
            .unwrap_or_else(|_| "config/platform_credentials.json".to_string());

        Self::from_file(path)
    }

    /// Load with fallback to default path
    pub fn load() -> AppResult<Self> {
        // Try multiple paths in order
        let paths = vec![
            "platform_credentials.json",
            "config/platform_credentials.json",
            "/etc/ecommerce-connect/platform_credentials.json",
        ];

        for path in paths {
            if Path::new(path).exists() {
                return Self::from_file(path);
            }
        }

        // If no file found, try from environment
        Self::from_env()
    }

    /// Validate the configuration
    fn validate(&self) -> AppResult<()> {
        // Check version
        if self.version != "1.0" && self.version != "1.1" {
            warn!(
                "Unknown platform credentials config version: {}",
                self.version
            );
        }

        // Validate each platform
        for (name, entry) in &self.platforms {
            if !entry.enabled {
                info!("Platform {} is disabled", name);
                continue;
            }

            // Validate auth type
            match entry.auth_type.as_str() {
                "oauth" | "api_key" | "hybrid" => {}
                _ => {
                    return Err(AppError::ValidationError(format!(
                        "Invalid auth_type '{}' for platform {}",
                        entry.auth_type, name
                    )));
                }
            }

            // Validate required fields based on auth type
            if entry.auth_type == "oauth" {
                if entry.credentials.app_key.is_empty() {
                    return Err(AppError::ValidationError(format!(
                        "Missing app_key for OAuth platform {}",
                        name
                    )));
                }
                if entry.credentials.app_secret.is_empty() {
                    return Err(AppError::ValidationError(format!(
                        "Missing app_secret for OAuth platform {}",
                        name
                    )));
                }
            }

            // For hybrid platforms, only validate if the credentials are being used
            if entry.auth_type == "hybrid" && entry.credentials.app_key.is_empty() {
                return Err(AppError::ValidationError(format!(
                    "Missing app_key for hybrid platform {}",
                    name
                )));
            }
            // app_secret is optional for hybrid platforms (may use API key only)

            if (entry.auth_type == "api_key" || entry.auth_type == "hybrid")
                && entry.credentials.app_key.is_empty()
            {
                return Err(AppError::ValidationError(format!(
                    "Missing API key for platform {}",
                    name
                )));
            }

            // Platform-specific validation
            match name.as_str() {
                "ecwid" => {
                    if entry.credentials.store_id.is_none() {
                        warn!("Ecwid configuration missing store_id");
                    }
                }
                "magento" | "medusa" | "woocommerce" => {
                    if entry.credentials.base_url.is_none() {
                        warn!("{} configuration missing base_url", name);
                    }
                }
                "zoho" => {
                    if entry.credentials.tenant_id.is_none() {
                        warn!("Zoho configuration missing tenant_id");
                    }
                }
                _ => {}
            }
        }

        Ok(())
    }

    /// Get credentials for a specific platform
    pub fn get_platform(&self, platform: &str) -> Option<&PlatformCredentialEntry> {
        self.platforms.get(platform)
    }

    /// Get credentials for a specific platform and environment
    pub fn get_platform_for_env(
        &self,
        platform: &str,
        environment: &str,
    ) -> Option<PlatformCredentials> {
        self.platforms.get(platform).map(|entry| {
            // Check for environment-specific override
            if let Some(envs) = &entry.environments {
                if let Some(env_creds) = envs.get(environment) {
                    return expand_credentials_env_vars(env_creds.clone());
                }
            }

            // Fall back to default credentials with environment variable expansion
            expand_credentials_env_vars(entry.credentials.clone())
        })
    }

    /// Apply defaults to a platform credentials
    pub fn apply_defaults(&self, mut creds: PlatformCredentials) -> PlatformCredentials {
        if let Some(defaults) = &self.defaults {
            if creds.redirect_uri.is_none() {
                creds.redirect_uri = defaults.redirect_uri.clone();
            }
            if creds.rate_limit_rps == 0.0 {
                creds.rate_limit_rps = defaults.rate_limit_rps.unwrap_or(10.0);
            }
        }
        creds
    }

    /// Get all enabled platforms
    pub fn get_enabled_platforms(&self) -> Vec<String> {
        self.platforms
            .iter()
            .filter(|(_, entry)| entry.enabled)
            .map(|(name, _)| name.clone())
            .collect()
    }

    /// Export to JSON string
    pub fn to_json(&self) -> AppResult<String> {
        serde_json::to_string_pretty(self).map_err(|e| {
            AppError::SerializationError(format!("Failed to serialize platform credentials: {}", e))
        })
    }

    /// Save to file
    pub fn save_to_file<P: AsRef<Path>>(&self, path: P) -> AppResult<()> {
        let json = self.to_json()?;
        fs::write(path.as_ref(), json).map_err(|e| {
            AppError::IoError(format!("Failed to write platform credentials file: {}", e))
        })?;

        info!("Saved platform credentials to {}", path.as_ref().display());
        Ok(())
    }
}

/// Create a sample platform credentials configuration
pub fn create_sample_config() -> PlatformCredentialsConfig {
    let mut platforms = HashMap::new();

    // OAuth platforms
    platforms.insert(
        "shopify".to_string(),
        PlatformCredentialEntry {
            display_name: "Shopify".to_string(),
            auth_type: "oauth".to_string(),
            enabled: true,
            credentials: PlatformCredentials {
                api_key: String::new(),
                app_key: "YOUR_SHOPIFY_API_KEY".to_string(),
                app_secret: "YOUR_SHOPIFY_API_SECRET".to_string(),
                redirect_uri: Some("https://app.lodashventure.local/callback/shopify".to_string()),
                api_base_url: "https://{{shop}}.myshopify.com/admin/api/2024-01".to_string(),
                rate_limit_rps: 2.0,
                store_id: None,
                base_url: None,
                tenant_id: None,
                oauth_authorize_url: Some(
                    "https://{{shop}}.myshopify.com/admin/oauth/authorize".to_string(),
                ),
                oauth_token_url: Some(
                    "https://{{shop}}.myshopify.com/admin/oauth/access_token".to_string(),
                ),
                oauth_refresh_url: None,
                oauth_revoke_url: None,
                market: None,
                service_id: None,
            },
            config: Some(PlatformSpecificConfig {
                api_version: Some("2024-01".to_string()),
                regions: None,
                webhook_urls: Some(HashMap::from([(
                    "orders".to_string(),
                    "https://app.lodashventure.local//webhooks/shopify/orders".to_string(),
                )])),
                custom_headers: None,
                features: Some(HashMap::from([
                    ("inventory_sync".to_string(), true),
                    ("order_sync".to_string(), false),
                ])),
                rate_limits: Some(RateLimitConfig {
                    requests_per_second: 2.0,
                    burst_size: 40,
                    retry_after_seconds: 60,
                }),
            }),
            environments: Some(HashMap::from([(
                "development".to_string(),
                PlatformCredentials {
                    api_key: String::new(),
                    app_key: "DEV_SHOPIFY_KEY".to_string(),
                    app_secret: "DEV_SHOPIFY_SECRET".to_string(),
                    redirect_uri: Some(
                        "https://app.lodashventure.local/callback/shopify".to_string(),
                    ),
                    api_base_url: "https://{{shop}}.myshopify.com/admin/api/2024-01".to_string(),
                    rate_limit_rps: 2.0,
                    store_id: None,
                    base_url: None,
                    tenant_id: None,
                    oauth_authorize_url: Some(
                        "https://{{shop}}.myshopify.com/admin/oauth/authorize".to_string(),
                    ),
                    oauth_token_url: Some(
                        "https://{{shop}}.myshopify.com/admin/oauth/access_token".to_string(),
                    ),
                    oauth_refresh_url: None,
                    oauth_revoke_url: None,
                    market: None,
                    service_id: None,
                },
            )])),
        },
    );

    // API Key platforms
    platforms.insert(
        "ecwid".to_string(),
        PlatformCredentialEntry {
            display_name: "Ecwid".to_string(),
            auth_type: "hybrid".to_string(), // Supports both OAuth and API key
            enabled: true,
            credentials: PlatformCredentials {
                api_key: String::new(),
                app_key: "YOUR_ECWID_API_KEY".to_string(),
                app_secret: "".to_string(),
                redirect_uri: None,
                api_base_url: "https://app.ecwid.com/api/v3".to_string(),
                rate_limit_rps: 10.0,
                store_id: Some("YOUR_STORE_ID".to_string()),
                base_url: None,
                tenant_id: None,
                oauth_authorize_url: None,
                oauth_token_url: None,
                oauth_refresh_url: None,
                oauth_revoke_url: None,
                market: None,
                service_id: None,
            },
            config: None,
            environments: None,
        },
    );

    platforms.insert(
        "magento".to_string(),
        PlatformCredentialEntry {
            display_name: "Magento".to_string(),
            auth_type: "api_key".to_string(),
            enabled: true,
            credentials: PlatformCredentials {
                api_key: String::new(),
                app_key: "YOUR_MAGENTO_ACCESS_TOKEN".to_string(),
                app_secret: "YOUR_MAGENTO_ACCESS_TOKEN_SECRET".to_string(),
                redirect_uri: None,
                api_base_url: "".to_string(), // Will be built from base_url
                rate_limit_rps: 5.0,
                store_id: None,
                base_url: Some("https://your-magento-store.com".to_string()),
                tenant_id: None,
                oauth_authorize_url: None,
                oauth_token_url: None,
                oauth_refresh_url: None,
                oauth_revoke_url: None,
                market: None,
                service_id: None,
            },
            config: Some(PlatformSpecificConfig {
                api_version: Some("V1".to_string()),
                regions: None,
                webhook_urls: None,
                custom_headers: Some(HashMap::from([(
                    "Accept".to_string(),
                    "application/json".to_string(),
                )])),
                features: None,
                rate_limits: None,
            }),
            environments: None,
        },
    );

    PlatformCredentialsConfig {
        version: "1.0".to_string(),
        platforms,
        defaults: Some(PlatformDefaults {
            redirect_uri: Some("https://app.lodashventure.local/callback".to_string()),
            rate_limit_rps: Some(10.0),
            api_timeout_seconds: Some(30),
            max_retries: Some(3),
        }),
    }
}
