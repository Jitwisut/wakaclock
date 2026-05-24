/// โมดูล Cache Infrastructure - ระบบจัดการแคชแบบรวมศูนย์
///
/// โมดูลนี้จัดการการแคชข้อมูลผ่าน interface ที่เป็นมาตรฐาน รองรับ:
/// - Redis cache: สำหรับ distributed caching
/// - Memory cache: สำหรับ in-memory caching ด้วย DashMap
/// - Memcache cache: สำหรับ memcache server
///
/// # หลักการทำงาน
/// - ใช้ trait `Cache` และ `CacheManager` เป็น interface หลัก
/// - รองรับการจัดเก็บข้อมูลแบบ bytes และ JSON
/// - มี statistics และ health check
/// - รองรับ batch operations สำหรับ performance
///
/// # ตัวอย่างการใช้งาน
/// ```rust
/// let cache = RedisCache::new(&config).await?;
/// cache.set_json("key", json!({"data": "value"}), Some(3600)).await?;
/// let value = cache.get_json("key").await?;
/// ```
use async_trait::async_trait;

use std::time::Duration;

/// Unified cache trait สำหรับ backend implementations ต่างๆ
///
/// Trait นี้กำหนด interface มาตรฐานสำหรับการจัดการแคช
/// ที่สามารถใช้งานได้กับ Redis, Memory, หรือ Memcache
#[async_trait]
pub trait Cache: Send + Sync {
    /// ตั้งค่าข้อมูลในแคชพร้อม TTL (หน่วยเป็นวินาที)
    ///
    /// # Parameters
    /// - `key`: คีย์สำหรับจัดเก็บข้อมูล
    /// - `value`: ข้อมูลที่จะเก็บในรูปแบบ bytes
    /// - `ttl`: เวลาหมดอายุในวินาที (None = ไม่หมดอายุ)
    async fn set_bytes(&self, key: &str, value: Vec<u8>, ttl: Option<u64>) -> anyhow::Result<()>;

    /// ดึงข้อมูลจากแคชในรูปแบบ bytes
    ///
    /// # Parameters
    /// - `key`: คีย์ที่ต้องการค้นหา
    ///
    /// # Returns
    /// `Some(Vec<u8>)` หากพบข้อมูล, `None` หากไม่พบ
    async fn get_bytes(&self, key: &str) -> anyhow::Result<Option<Vec<u8>>>;

    /// ลบข้อมูลจากแคช
    ///
    /// # Parameters
    /// - `key`: คีย์ที่ต้องการลบ
    async fn del(&self, key: &str) -> anyhow::Result<()>;

    /// ตรวจสอบว่ามีคีย์นี้ในแคชหรือไม่
    ///
    /// # Parameters
    /// - `key`: คีย์ที่ต้องการตรวจสอบ
    ///
    /// # Returns
    /// `true` หากมีคีย์นี้, `false` หากไม่มี
    async fn exists(&self, key: &str) -> anyhow::Result<bool>;

    /// ตั้งค่าข้อมูล JSON ในแคช (non-generic เพื่อ dyn compatibility)
    ///
    /// # Parameters
    /// - `key`: คีย์สำหรับจัดเก็บข้อมูล
    /// - `value`: ข้อมูล JSON value
    /// - `ttl`: เวลาหมดอายุในวินาที
    async fn set_json(
        &self,
        key: &str,
        value: serde_json::Value,
        ttl: Option<u64>,
    ) -> anyhow::Result<()> {
        let bytes = serde_json::to_vec(&value)?;
        self.set_bytes(key, bytes, ttl).await
    }

    /// ดึงข้อมูล JSON จากแคช (non-generic เพื่อ dyn compatibility)
    ///
    /// # Parameters
    /// - `key`: คีย์ที่ต้องการค้นหา
    ///
    /// # Returns
    /// `Some(serde_json::Value)` หากพบข้อมูล, `None` หากไม่พบ
    async fn get_json(&self, key: &str) -> anyhow::Result<Option<serde_json::Value>> {
        match self.get_bytes(key).await? {
            Some(bytes) => {
                let value = serde_json::from_slice(&bytes)?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }
}

/// Extended cache manager trait พร้อมฟังก์ชันเพิ่มเติม
///
/// Trait นี้ขยาย Cache trait ด้วยฟังก์ชันขั้นสูงสำหรับการจัดการ
/// และ monitoring แคช
#[async_trait]
pub trait CacheManager: Cache {
    /// ล้างข้อมูลแคชทั้งหมด
    ///
    /// # Warning
    /// การใช้ function นี้จะลบข้อมูลแคชทั้งหมด ใช้ด้วยความระมัดระวัง
    async fn flush(&self) -> anyhow::Result<()>;

    /// ตรวจสอบสุขภาพของ cache connection
    ///
    /// # Returns
    /// `Ok(())` หาก connection ปกติ, `Err` หากมีปัญหา
    async fn ping(&self) -> anyhow::Result<()>;

    /// ดึงสถิติการใช้งานแคช
    ///
    /// # Returns
    /// `CacheStats` ที่มีข้อมูล hits, misses, evictions เป็นต้น
    async fn stats(&self) -> anyhow::Result<CacheStats>;

    /// ดึงข้อมูลหลายคีย์พร้อมกัน (batch operation)
    ///
    /// # Parameters
    /// - `keys`: array ของคีย์ที่ต้องการดึง
    ///
    /// # Returns
    /// Vector ของ `Option<Vec<u8>>` ตามลำดับคีย์
    async fn get_many(&self, keys: &[&str]) -> anyhow::Result<Vec<Option<Vec<u8>>>>;

    /// ตั้งค่าข้อมูลหลายคีย์พร้อมกัน (batch operation)
    ///
    /// # Parameters
    /// - `items`: array ของ (key, value, ttl) tuples
    async fn set_many(&self, items: &[(&str, Vec<u8>, Option<u64>)]) -> anyhow::Result<()>;

    /// ลบข้อมูลหลายคีย์พร้อมกัน (batch operation)
    ///
    /// # Parameters
    /// - `keys`: array ของคีย์ที่ต้องการลบ
    ///
    /// # Returns
    /// จำนวนคีย์ที่ถูกลบจริง
    async fn delete_many(&self, keys: &[&str]) -> anyhow::Result<usize>;

    /// เพิ่มค่าตัวเลข (atomic increment)
    ///
    /// # Parameters
    /// - `key`: คีย์ที่ต้องการเพิ่มค่า
    /// - `delta`: จำนวนที่ต้องการเพิ่ม
    ///
    /// # Returns
    /// ค่าใหม่หลังจากเพิ่ม
    async fn increment(&self, key: &str, delta: i64) -> anyhow::Result<i64>;

    /// ลดค่าตัวเลข (atomic decrement)
    ///
    /// # Parameters
    /// - `key`: คีย์ที่ต้องการลดค่า
    /// - `delta`: จำนวนที่ต้องการลด
    ///
    /// # Returns
    /// ค่าใหม่หลังจากลด
    async fn decrement(&self, key: &str, delta: i64) -> anyhow::Result<i64>;

    /// ค้นหาคีย์ทั้งหมดที่ตรงกับ pattern
    ///
    /// # Parameters
    /// - `pattern`: pattern สำหรับการค้นหา (เช่น "user:*", "*:cache")
    ///
    /// # Returns
    /// Vector ของคีย์ที่ตรงกับ pattern
    async fn keys(&self, pattern: &str) -> anyhow::Result<Vec<String>>;

    /// ตั้งค่าเวลาหมดอายุให้คีย์ที่มีอยู่แล้ว
    ///
    /// # Parameters
    /// - `key`: คีย์ที่ต้องการตั้งค่าเวลาหมดอายุ
    /// - `ttl`: เวลาหมดอายุ
    ///
    /// # Returns
    /// `true` หากตั้งค่าสำเร็จ, `false` หากคีย์ไม่มีอยู่
    async fn expire(&self, key: &str, ttl: Duration) -> anyhow::Result<bool>;

    /// ดูเวลาหมดอายุที่เหลือของคีย์
    ///
    /// # Parameters
    /// - `key`: คีย์ที่ต้องการตรวจสอบ
    ///
    /// # Returns
    /// `Some(Duration)` หากยังไม่หมดอายุ, `None` หากไม่มี TTL หรือหมดอายุแล้ว
    async fn ttl(&self, key: &str) -> anyhow::Result<Option<Duration>>;

    /// แปลง cache เป็น `Any` type สำหรับ downcasting
    ///
    /// # Returns
    /// Reference ไปยัง `dyn std::any::Any`
    fn as_any(&self) -> &dyn std::any::Any;
}

/// สถิติการใช้งานแคช
///
/// Struct นี้เก็บข้อมูลสถิติต่างๆ ของการใช้งานแคชเพื่อใช้ในการ
/// monitoring และ optimization ประสิทธิภาพ
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct CacheStats {
    /// จำนวนครั้งที่พบข้อมูลในแคช (cache hits)
    pub hits: u64,
    /// จำนวนครั้งที่ไม่พบข้อมูลในแคช (cache misses)
    pub misses: u64,
    /// จำนวนครั้งที่มีการตั้งค่าข้อมูล
    pub sets: u64,
    /// จำนวนครั้งที่มีการลบข้อมูล
    pub deletes: u64,
    /// จำนวนครั้งที่ข้อมูลถูกเอาออกโดย eviction policy
    pub evictions: u64,
    /// ขนาดข้อมูลทั้งหมดในแคช (bytes)
    pub size_bytes: u64,
    /// จำนวนคีย์ทั้งหมดในแคช
    pub num_keys: u64,
    /// จำนวน request ทั้งหมด
    pub total_requests: u64,
}

impl CacheStats {
    /// คำนวณอัตราการ hit ของแคช (hit rate)
    ///
    /// # Returns
    /// อัตราส่วน hits ต่อ total requests (0.0 - 1.0)
    /// โดย 1.0 หมายถึง cache hit 100%
    pub fn hit_rate(&self) -> f64 {
        let total = self.hits + self.misses;
        if total == 0 {
            0.0 // ยังไม่มีข้อมูล
        } else {
            self.hits as f64 / total as f64
        }
    }
}

/// การกำหนดค่าแคช
///
/// Struct นี้เก็บการตั้งค่าทั้งหมดสำหรับการเชื่อมต่อและใช้งานแคช
/// รองรับทั้ง Redis, Memcache, และ in-memory cache
#[derive(Debug, Clone, serde::Deserialize)]
pub struct CacheConfig {
    /// Redis URL (หากใช้ Redis cache)
    pub redis_url: Option<String>,

    /// Memcache URL (หากใช้ Memcache cache)
    pub memcache_url: Option<String>,

    /// จำนวนการเชื่อมต่อสูงสุดใน connection pool
    pub max_connections: Option<u32>,

    /// Timeout สำหรับการเชื่อมต่อ (วินาที)
    pub connection_timeout: Option<u64>,

    /// TTL เริ่มต้น (วินาที)
    pub default_ttl: Option<u64>,

    /// เปิดใช้งานการเก็บสถิติหรือไม่
    pub enable_stats: bool,

    /// ขนาดสูงสุดของ memory cache (MB) สำหรับ in-memory cache
    pub max_memory_mb: Option<usize>,

    /// นีคำสำหรับการลบข้อมูล (eviction policy) ใน memory cache
    pub eviction_policy: Option<EvictionPolicy>,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            redis_url: None,
            memcache_url: None,
            max_connections: Some(10),
            connection_timeout: Some(5),
            default_ttl: Some(3600), // 1 hour
            enable_stats: true,
            max_memory_mb: Some(100),
            eviction_policy: Some(EvictionPolicy::Lru),
        }
    }
}

/// นโยบายการลบข้อมูลในแคช (Cache eviction policies)
///
/// Enum นี้กำหนดวิธีการลบข้อมูลออกจากแคชเมื่อเต็ม
/// ใช้กับ in-memory cache เป็นหลัก
#[derive(Debug, Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EvictionPolicy {
    /// Least Recently Used - ลบข้อมูลที่ใช้ล่าสุดก่อน
    Lru,
    /// Least Frequently Used - ลบข้อมูลที่ใช้น้อยที่สุดก่อน
    Lfu,
    /// First In First Out - ลบข้อมูลที่เข้ามาก่อนก่อน
    Fifo,
    /// Random eviction - ลบข้อมูลแบบสุ่ม
    Random,
}

// Export sub-modules สำหรับ cache implementations ต่างๆ
pub mod memcache;
pub mod memory;
pub mod redis;

// Export public structs สำหรับการใช้งาน
pub use memcache::MemcacheCache;
pub use memory::MemoryCache;
pub use redis::RedisCache;
