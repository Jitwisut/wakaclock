use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::InterfaceResult;

/// OAuth state data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthState {
    pub platform: String,
    pub state: String,
    pub shop_id: String,
    pub org_id: String,
    pub redirect_uri: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// OAuth state storage interface
#[async_trait]
pub trait OAuthStateInterface: Send + Sync {
    /// Store OAuth state with TTL
    async fn store(&self, state: &OAuthState) -> InterfaceResult<()>;

    /// Retrieve OAuth state by token
    async fn get(&self, state_token: &str) -> InterfaceResult<Option<OAuthState>>;

    /// Delete OAuth state
    async fn delete(&self, state_token: &str) -> InterfaceResult<()>;

    /// Clean up expired states
    async fn cleanup_expired(&self) -> InterfaceResult<usize>;

    /// Check if state exists
    async fn exists(&self, state_token: &str) -> InterfaceResult<bool>;
}

/// Configuration for OAuth state storage
#[derive(Debug, Clone)]
pub struct OAuthStateConfig {
    /// TTL for OAuth state in seconds (default: 5 minutes)
    pub ttl_seconds: u64,
    /// Key prefix for storage
    pub key_prefix: String,
}

impl Default for OAuthStateConfig {
    fn default() -> Self {
        Self {
            ttl_seconds: 300, // 5 minutes
            key_prefix: "oauth_state".to_string(),
        }
    }
}
