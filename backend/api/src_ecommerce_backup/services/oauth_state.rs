/// ไฟล์ oauth_state.rs - OAuth state service สำหรับจัดการ temporary state ในกระบวนการ OAuth
/// จัดเก็บและตรวจสอบ state tokens ที่ใช้ป้องกัน CSRF attacks ในระหว่าง OAuth flow
/// รองรับ TTL และ automatic cleanup สำหรับความปลอดภัย
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

/// OAuthStateService - Service สำหรับจัดการ OAuth state tokens
/// ใช้ cache (Redis หรือ Memory) เก็บ temporary state ระหว่าง OAuth flow
/// ป้องกัน CSRF attacks และจัดการ expiration อัตโนมัติ
pub struct OAuthStateService {
    /// Cache manager สำหรับเก็บ state data
    cache: Arc<dyn CacheManager>,

    /// Configuration สำหรับ TTL และ key prefix
    config: OAuthStateConfig,
}

impl OAuthStateService {
    /// สร้าง OAuth state service ใหม่ด้วย default configuration
    ///
    /// # Arguments
    /// * `cache` - Cache manager instance (Redis หรือ Memory)
    pub fn new(cache: Arc<dyn CacheManager>) -> Self {
        Self::with_config(cache, OAuthStateConfig::default())
    }

    /// สร้าง OAuth state service ด้วย custom configuration
    ///
    /// # Arguments
    /// * `cache` - Cache manager instance
    /// * `config` - Custom configuration สำหรับ TTL และ key prefix
    pub fn with_config(cache: Arc<dyn CacheManager>, config: OAuthStateConfig) -> Self {
        Self { cache, config }
    }

    /// สร้าง cache key สำหรับ state token
    ///
    /// # Arguments
    /// * `state_token` - State token string
    ///
    /// # Returns
    /// Key ที่ใช้เก็บใน cache (format: prefix:token)
    fn make_key(&self, state_token: &str) -> String {
        format!("{}:{}", self.config.key_prefix, state_token)
    }
}

/// การ implement OAuthStateInterface สำหรับ OAuthStateService
/// จัดการการเก็บ, ดึง, และลบ OAuth state data ด้วย cache backend
#[async_trait]
impl OAuthStateInterface for OAuthStateService {
    /// เก็บ OAuth state ลง cache พร้อม TTL
    ///
    /// # Arguments
    /// * `state` - OAuth state object ที่ต้องการเก็บ
    ///
    /// # Returns
    /// Result ว่าง หรือ error
    async fn store(&self, state: &OAuthState) -> InterfaceResult<()> {
        let key = self.make_key(&state.state);

        // คำนวณเวลา expiration
        let now = Utc::now();
        let expires_at = now + Duration::seconds(self.config.ttl_seconds as i64);

        // อัปเดต state ด้วยเวลา expiration
        let mut state_with_expiry = state.clone();
        state_with_expiry.expires_at = expires_at;

        // Serialize state เป็น JSON bytes
        let json_bytes = serde_json::to_vec(&state_with_expiry)
            .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;

        // บันทึกลง cache พร้อม TTL
        self.cache
            .set_bytes(&key, json_bytes, Some(self.config.ttl_seconds))
            .await
            .map_err(|e| {
                InterfaceError::OperationFailed(format!("Failed to store OAuth state: {}", e))
            })?;

        Ok(())
    }

    /// ดึง OAuth state จาก cache และตรวจสอบ expiration
    ///
    /// # Arguments
    /// * `state_token` - State token ที่ต้องการดึง
    ///
    /// # Returns
    /// Option ของ OAuthState หรือ None ถ้าไม่มี/หมดอายุ
    async fn get(&self, state_token: &str) -> InterfaceResult<Option<OAuthState>> {
        let key = self.make_key(state_token);

        // ดึงข้อมูลจาก cache
        let bytes = self.cache.get_bytes(&key).await.map_err(|e| {
            InterfaceError::OperationFailed(format!("Failed to get OAuth state: {}", e))
        })?;

        match bytes {
            Some(data) => {
                // Deserialize state จาก JSON bytes
                let state: OAuthState = serde_json::from_slice(&data)
                    .map_err(|e| InterfaceError::SerializationError(e.to_string()))?;

                // ตรวจสอบว่าหมดอายุหรือไม่
                if state.expires_at < Utc::now() {
                    // ลบ state ที่หมดอายุออก
                    let _ = self.delete(state_token).await;
                    Ok(None)
                } else {
                    Ok(Some(state))
                }
            }
            None => Ok(None),
        }
    }

    /// ลบ OAuth state จาก cache
    ///
    /// # Arguments
    /// * `state_token` - State token ที่ต้องการลบ
    ///
    /// # Returns
    /// Result ว่าง หรือ error
    async fn delete(&self, state_token: &str) -> InterfaceResult<()> {
        let key = self.make_key(state_token);

        self.cache.del(&key).await.map_err(|e| {
            InterfaceError::OperationFailed(format!("Failed to delete OAuth state: {}", e))
        })?;

        Ok(())
    }

    /// ล้าง OAuth states ที่หมดอายุแล้วออกจาก cache
    ///
    /// # Returns
    /// จำนวน states ที่ถูกลบ
    async fn cleanup_expired(&self) -> InterfaceResult<usize> {
        // ค้นหา keys ทั้งหมดของ OAuth states
        let pattern = format!("{}:*", self.config.key_prefix);
        let keys = self.cache.keys(&pattern).await.map_err(|e| {
            InterfaceError::OperationFailed(format!("Failed to list OAuth states: {}", e))
        })?;

        let mut deleted_count = 0;

        for key in keys {
            // แยก state token จาก key
            if let Some(state_token) = key.strip_prefix(&format!("{}:", self.config.key_prefix)) {
                // ดึง state มาตรวจสอบ expiration
                if let Ok(Some(state)) = self.get(state_token).await {
                    if state.expires_at < Utc::now() && self.delete(state_token).await.is_ok() {
                        deleted_count += 1;
                    }
                }
            }
        }

        Ok(deleted_count)
    }

    /// ตรวจสอบว่า OAuth state มีอยู่ใน cache หรือไม่
    ///
    /// # Arguments
    /// * `state_token` - State token ที่ต้องการตรวจสอบ
    ///
    /// # Returns
    /// true ถ้ามี state อยู่, false ถ้าไม่มี
    async fn exists(&self, state_token: &str) -> InterfaceResult<bool> {
        let key = self.make_key(state_token);

        self.cache.exists(&key).await.map_err(|e| {
            InterfaceError::OperationFailed(format!("Failed to check OAuth state existence: {}", e))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::cache::memory::MemoryCache;

    #[tokio::test]
    async fn test_oauth_state_service() {
        // Create memory cache for testing
        let cache = Arc::new(MemoryCache::new()) as Arc<dyn CacheManager>;
        let service = OAuthStateService::new(cache);

        // Create a test state
        let state = OAuthState {
            platform: "tiktok".to_string(),
            state: "test-state-123".to_string(),
            shop_id: "shop-456".to_string(),
            org_id: "org-789".to_string(),
            redirect_uri: Some("https://example.com/callback".to_string()),
            created_at: Utc::now(),
            expires_at: Utc::now() + Duration::seconds(300),
        };

        // Store the state
        service.store(&state).await.unwrap();

        // Retrieve the state
        let retrieved = service.get("test-state-123").await.unwrap();
        assert!(retrieved.is_some());

        let retrieved_state = retrieved.unwrap();
        assert_eq!(retrieved_state.platform, "tiktok");
        assert_eq!(retrieved_state.shop_id, "shop-456");

        // Check existence
        assert!(service.exists("test-state-123").await.unwrap());

        // Delete the state
        service.delete("test-state-123").await.unwrap();

        // Verify deletion
        assert!(!service.exists("test-state-123").await.unwrap());
    }
}
