/// Redis-based OAuth state storage implementation
/// Direct implementation using Redis infrastructure cache for OAuth state management
use async_trait::async_trait;
use chrono::{Duration, Utc};
use std::sync::Arc;

use crate::{
    infrastructure::cache::CacheManager,
    interfaces::{
        oauth_state::{OAuthState, OAuthStateConfig, OAuthStateInterface},
        InterfaceError, InterfaceResult,
    },
};

/// RedisOAuthStateStorage - Redis-specific OAuth state storage
/// Uses Redis cache directly for high-performance OAuth state management
pub struct RedisOAuthStateStorage {
    /// Redis cache instance
    cache: Arc<dyn CacheManager>,

    /// Configuration for OAuth state storage
    config: OAuthStateConfig,
}

impl RedisOAuthStateStorage {
    /// Create new Redis OAuth state storage with default config
    pub fn new(cache: Arc<dyn CacheManager>) -> Self {
        Self::with_config(cache, OAuthStateConfig::default())
    }

    /// Create new Redis OAuth state storage with custom config
    pub fn with_config(cache: Arc<dyn CacheManager>, config: OAuthStateConfig) -> Self {
        Self { cache, config }
    }

    /// Generate cache key for OAuth state
    fn make_key(&self, state_token: &str) -> String {
        format!("{}:{}", self.config.key_prefix, state_token)
    }

    /// Generate pattern for searching OAuth states
    fn make_pattern(&self) -> String {
        format!("{}:*", self.config.key_prefix)
    }
}

#[async_trait]
impl OAuthStateInterface for RedisOAuthStateStorage {
    /// Store OAuth state in Redis with TTL
    async fn store(&self, state: &OAuthState) -> InterfaceResult<()> {
        let key = self.make_key(&state.state);

        // Calculate expiration time
        let now = Utc::now();
        let expires_at = now + Duration::seconds(self.config.ttl_seconds as i64);

        // Update state with expiration
        let mut state_with_expiry = state.clone();
        state_with_expiry.expires_at = expires_at;

        // Serialize state to JSON
        let json_bytes = serde_json::to_vec(&state_with_expiry)
            .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;

        // Store in Redis with TTL
        self.cache
            .set_bytes(&key, json_bytes, Some(self.config.ttl_seconds))
            .await
            .map_err(|e| {
                InterfaceError::OperationFailed(format!(
                    "Failed to store OAuth state in Redis: {}",
                    e
                ))
            })?;

        Ok(())
    }

    /// Retrieve OAuth state from Redis
    async fn get(&self, state_token: &str) -> InterfaceResult<Option<OAuthState>> {
        let key = self.make_key(state_token);

        // Get from Redis
        let bytes = self.cache.get_bytes(&key).await.map_err(|e| {
            InterfaceError::OperationFailed(format!("Failed to get OAuth state from Redis: {}", e))
        })?;

        match bytes {
            Some(data) => {
                // Deserialize state
                let state: OAuthState = serde_json::from_slice(&data)
                    .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;

                // Check if expired
                if state.expires_at < Utc::now() {
                    // Delete expired state
                    let _ = self.delete(state_token).await;
                    Ok(None)
                } else {
                    Ok(Some(state))
                }
            }
            None => Ok(None),
        }
    }

    /// Delete OAuth state from Redis
    async fn delete(&self, state_token: &str) -> InterfaceResult<()> {
        let key = self.make_key(state_token);

        self.cache.del(&key).await.map_err(|e| {
            InterfaceError::OperationFailed(format!(
                "Failed to delete OAuth state from Redis: {}",
                e
            ))
        })?;

        Ok(())
    }

    /// Clean up expired OAuth states
    async fn cleanup_expired(&self) -> InterfaceResult<usize> {
        // Get all OAuth state keys
        let pattern = self.make_pattern();
        let keys = self.cache.keys(&pattern).await.map_err(|e| {
            InterfaceError::OperationFailed(format!("Failed to list OAuth states in Redis: {}", e))
        })?;

        let mut deleted_count = 0;
        let now = Utc::now();

        // Check each key for expiration
        for key in keys {
            // Extract state token from key
            if let Some(_state_token) = key.strip_prefix(&format!("{}:", self.config.key_prefix)) {
                // Get state data to check expiration
                if let Ok(Some(data)) = self.cache.get_bytes(&key).await {
                    // Try to deserialize and check expiration
                    if let Ok(state) = serde_json::from_slice::<OAuthState>(&data) {
                        if state.expires_at < now {
                            // Delete expired state
                            if self.cache.del(&key).await.is_ok() {
                                deleted_count += 1;
                            }
                        }
                    }
                }
            }
        }

        Ok(deleted_count)
    }

    /// Check if OAuth state exists in Redis
    async fn exists(&self, state_token: &str) -> InterfaceResult<bool> {
        let key = self.make_key(state_token);

        self.cache.exists(&key).await.map_err(|e| {
            InterfaceError::OperationFailed(format!(
                "Failed to check OAuth state existence in Redis: {}",
                e
            ))
        })
    }
}

/// Additional Redis-specific OAuth operations
impl RedisOAuthStateStorage {
    /// Get all active OAuth states (not expired)
    pub async fn get_all_active(&self) -> InterfaceResult<Vec<OAuthState>> {
        let pattern = self.make_pattern();
        let keys = self.cache.keys(&pattern).await.map_err(|e| {
            InterfaceError::OperationFailed(format!("Failed to list OAuth states: {}", e))
        })?;

        let mut active_states = Vec::new();
        let now = Utc::now();

        for key in keys {
            if let Ok(Some(data)) = self.cache.get_bytes(&key).await {
                if let Ok(state) = serde_json::from_slice::<OAuthState>(&data) {
                    if state.expires_at > now {
                        active_states.push(state);
                    }
                }
            }
        }

        Ok(active_states)
    }

    /// Count active OAuth states
    pub async fn count_active(&self) -> InterfaceResult<usize> {
        let states = self.get_all_active().await?;
        Ok(states.len())
    }

    /// Get OAuth states by platform
    pub async fn get_by_platform(&self, platform: &str) -> InterfaceResult<Vec<OAuthState>> {
        let states = self.get_all_active().await?;
        Ok(states
            .into_iter()
            .filter(|s| s.platform == platform)
            .collect())
    }

    /// Extend TTL for an existing OAuth state
    pub async fn extend_ttl(
        &self,
        state_token: &str,
        additional_seconds: u64,
    ) -> InterfaceResult<()> {
        // Get existing state
        if let Some(mut state) = self.get(state_token).await? {
            // Update expiration
            state.expires_at += Duration::seconds(additional_seconds as i64);

            // Re-store with new expiration
            self.store(&state).await?;
            Ok(())
        } else {
            Err(InterfaceError::NotFound(format!(
                "OAuth state not found: {}",
                state_token
            )))
        }
    }

    /// Batch delete OAuth states
    pub async fn delete_many(&self, state_tokens: &[&str]) -> InterfaceResult<usize> {
        if state_tokens.is_empty() {
            return Ok(0);
        }

        let keys: Vec<String> = state_tokens
            .iter()
            .map(|token| self.make_key(token))
            .collect();

        let key_refs: Vec<&str> = keys.iter().map(|s| s.as_str()).collect();

        self.cache.delete_many(&key_refs).await.map_err(|e| {
            InterfaceError::OperationFailed(format!("Failed to delete OAuth states: {}", e))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::cache::memory::MemoryCache;

    #[tokio::test]
    async fn test_redis_oauth_state_storage() {
        // Use memory cache for testing
        let cache = Arc::new(MemoryCache::new()) as Arc<dyn CacheManager>;
        let storage = RedisOAuthStateStorage::new(cache);

        // Create test state
        let state = OAuthState {
            platform: "shopify".to_string(),
            state: "test-state-456".to_string(),
            shop_id: "shop-789".to_string(),
            org_id: "org-123".to_string(),
            redirect_uri: Some("https://example.com/callback".to_string()),
            created_at: Utc::now(),
            expires_at: Utc::now() + Duration::seconds(300),
        };

        // Store state
        storage.store(&state).await.unwrap();

        // Retrieve state
        let retrieved = storage.get("test-state-456").await.unwrap();
        assert!(retrieved.is_some());

        let retrieved_state = retrieved.unwrap();
        assert_eq!(retrieved_state.platform, "shopify");
        assert_eq!(retrieved_state.shop_id, "shop-789");

        // Check existence
        assert!(storage.exists("test-state-456").await.unwrap());

        // Count active states
        let count = storage.count_active().await.unwrap();
        assert_eq!(count, 1);

        // Get by platform
        let platform_states = storage.get_by_platform("shopify").await.unwrap();
        assert_eq!(platform_states.len(), 1);

        // Extend TTL
        storage.extend_ttl("test-state-456", 60).await.unwrap();

        // Delete state
        storage.delete("test-state-456").await.unwrap();

        // Verify deletion
        assert!(!storage.exists("test-state-456").await.unwrap());
    }

    #[tokio::test]
    async fn test_batch_operations() {
        let cache = Arc::new(MemoryCache::new()) as Arc<dyn CacheManager>;
        let storage = RedisOAuthStateStorage::new(cache);

        // Create multiple states
        for i in 0..5 {
            let state = OAuthState {
                platform: "tiktok".to_string(),
                state: format!("state-{}", i),
                shop_id: format!("shop-{}", i),
                org_id: "org-1".to_string(),
                redirect_uri: None,
                created_at: Utc::now(),
                expires_at: Utc::now() + Duration::seconds(300),
            };
            storage.store(&state).await.unwrap();
        }

        // Verify all stored
        assert_eq!(storage.count_active().await.unwrap(), 5);

        // Batch delete
        let tokens: Vec<&str> = vec!["state-0", "state-1", "state-2"];
        let deleted = storage.delete_many(&tokens).await.unwrap();
        assert_eq!(deleted, 3);

        // Verify remaining
        assert_eq!(storage.count_active().await.unwrap(), 2);
    }
}
