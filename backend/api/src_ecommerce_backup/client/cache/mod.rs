/// # Cache Client Module - โมดูล Cache Client
/// โมดูลสำหรับจัดการ cache clients ทั้ง Redis และ memory cache
/// ให้อินเตอร์เฟสเดียวสำหรับการเข้าถึง cache แบบต่างๆ
///
/// ## Cache Implementations
/// - `memory` - In-memory cache ด้วย DashMap (สำหรับ development)
/// - `redis` - Redis cache พร้อม connection pooling (สำหรับ production)
///
/// ## การใช้งาน
/// - ใช้ CacheClient สำหรับการเข้าถึง cache ผ่าน App container
/// - ใช้ CacheManager สำหรับสร้าง cache instance ตาม configuration
pub mod memory;
pub mod redis;

use crate::infrastructure::app::App;
use crate::interfaces::CacheInterface;
use anyhow::Result;
use std::sync::Arc;

/// Cache manager สำหรับเลือก cache implementation ตาม configuration
/// จัดการการสร้าง cache instances แบบต่างๆ
pub struct CacheManager;

impl CacheManager {
    /// สร้าง cache instance ตาม configuration type
    /// รองรับ Redis และ memory cache
    /// Create cache based on configuration
    pub async fn create(cache_type: &str, url: &str) -> anyhow::Result<Arc<dyn CacheInterface>> {
        match cache_type {
            "redis" => {
                // สร้าง Redis cache พร้อม connection pooling
                // Create Redis cache with connection pooling
                Ok(Arc::new(redis::RedisCache::new(url).await?))
            }
            _ => {
                // ใช้ memory cache เป็น default (development mode)
                // Use memory cache as default (development mode)
                Ok(Arc::new(memory::MemoryCache::new()))
            }
        }
    }
}

/// Cache client สำหรับจัดการการดำเนินการ cache ผ่าน App container
/// ให้ high-level interface สำหรับ serialization และ deserialization
pub struct CacheClient {
    /// Reference ไปยัง App container ที่มี cache manager
    app: Arc<App>,
}

impl CacheClient {
    /// สร้าง CacheClient instance ใหม่
    /// Create new CacheClient instance
    pub fn new(app: Arc<App>) -> Self {
        Self { app }
    }

    /// ดึงค่าจาก cache และ deserialize เป็น type ที่กำหนด
    /// Get value from cache and deserialize to specified type
    pub async fn get<T: serde::de::DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        match self.app.cache.get_json(key).await? {
            Some(json) => {
                // Deserialize JSON value เป็น target type
                // Deserialize JSON value to target type
                Ok(serde_json::from_value(json)?)
            }
            None => Ok(None),
        }
    }

    /// เก็บค่าใน cache พร้อม TTL และ serialize จาก type ที่กำหนด
    /// Set value in cache with TTL and serialize from specified type
    pub async fn set<T: serde::Serialize>(&self, key: &str, value: &T, ttl: u64) -> Result<()> {
        // Serialize value เป็น JSON
        // Serialize value to JSON
        let json = serde_json::to_value(value)?;
        self.app.cache.set_json(key, json, Some(ttl)).await
    }
}
