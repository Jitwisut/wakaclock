/// Header Configuration -  HTTP Headers
/// HTTP headers

/// authentication headers, CORS headers, A%0 custom headers
///
///

/// - Standard headers  API responses
/// - authentication headers (x-auth-token, Authorization)
/// - CORS headers  cross-origin requests
/// - custom headers  platform integrations
///
///

/// ```rust
/// use crate::infrastructure::api::header_config::HeaderConfig;
///
/// let config = HeaderConfig::new()
///     .with_cors()
///     .with_authentication()
///     .build();
/// ```
use axum::http::HeaderMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// HTTP headers
/// Configuration structure for HTTP headers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeaderConfig {
    /// Headers

    /// Standard headers to be used in all responses
    pub standard_headers: HashMap<String, String>,

    /// Headers CORS
    /// Headers for CORS
    pub cors_headers: HashMap<String, String>,

    /// Headers  authentication
    /// Headers for authentication
    pub auth_headers: HashMap<String, String>,

    /// Custom headers platform integrations
    /// Custom headers for platform integrations
    pub custom_headers: HashMap<String, String>,
}

impl Default for HeaderConfig {
    fn default() -> Self {
        Self::new()
    }
}

impl HeaderConfig {
    /// HeaderConfig
    /// Create new HeaderConfig with default values
    pub fn new() -> Self {
        let mut standard_headers = HashMap::new();
        standard_headers.insert("Content-Type".to_string(), "application/json".to_string());
        standard_headers.insert("X-API-Version".to_string(), "v1".to_string());
        standard_headers.insert(
            "X-Powered-By".to_string(),
            "ecommerce-connect-api".to_string(),
        );

        Self {
            standard_headers,
            cors_headers: HashMap::new(),
            auth_headers: HashMap::new(),
            custom_headers: HashMap::new(),
        }
    }

    /// CORS headers
    /// Add CORS headers
    pub fn with_cors(mut self) -> Self {
        self.cors_headers
            .insert("Access-Control-Allow-Origin".to_string(), "*".to_string());
        self.cors_headers.insert(
            "Access-Control-Allow-Methods".to_string(),
            "GET, POST, PUT, DELETE, OPTIONS".to_string(),
        );
        self.cors_headers.insert(
            "Access-Control-Allow-Headers".to_string(),
            "Content-Type, Authorization, x-auth-token".to_string(),
        );
        self.cors_headers
            .insert("Access-Control-Max-Age".to_string(), "86400".to_string());
        self
    }

    ///  authentication headers
    /// Add authentication headers
    pub fn with_authentication(mut self) -> Self {
        self.auth_headers
            .insert("WWW-Authenticate".to_string(), "Bearer".to_string());
        self
    }

    /// custom header
    /// Add custom header
    pub fn with_custom_header(mut self, key: String, value: String) -> Self {
        self.custom_headers.insert(key, value);
        self
    }

    /// HeaderMap axum
    /// Convert to HeaderMap for use with axum
    pub fn to_header_map(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();

        // standard headers
        // Add standard headers
        for (key, value) in &self.standard_headers {
            if let (Ok(name), Ok(val)) = (key.parse(), value.parse()) {
                headers.insert(name, val);
            }
        }

        // CORS headers
        // Add CORS headers
        for (key, value) in &self.cors_headers {
            if let (Ok(name), Ok(val)) = (key.parse(), value.parse()) {
                headers.insert(name, val);
            }
        }

        // auth headers
        // Add auth headers
        for (key, value) in &self.auth_headers {
            if let (Ok(name), Ok(val)) = (key.parse(), value.parse()) {
                headers.insert(name, val);
            }
        }

        // custom headers
        // Add custom headers
        for (key, value) in &self.custom_headers {
            if let (Ok(name), Ok(val)) = (key.parse(), value.parse()) {
                headers.insert(name, val);
            }
        }

        headers
    }

    /// headers HashMap
    /// Merge all headers into a single HashMap
    pub fn to_hashmap(&self) -> HashMap<String, String> {
        let mut all_headers = HashMap::new();

        all_headers.extend(self.standard_headers.clone());
        all_headers.extend(self.cors_headers.clone());
        all_headers.extend(self.auth_headers.clone());
        all_headers.extend(self.custom_headers.clone());

        all_headers
    }
}
