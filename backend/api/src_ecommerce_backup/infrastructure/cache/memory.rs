/// ไฟล์ memory.rs - In-Memory Cache Implementation
/// ใช้ DashMap สำหรับ concurrent access
/// รองรับ TTL, auto-eviction, และ statistics tracking
/// เหมาะสำหรับข้อมูลที่ต้องการ access แบบเร็วมาก
use super::{Cache, CacheConfig, CacheManager, CacheStats};
use async_trait::async_trait;
use dashmap::DashMap;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::time::sleep;

/// โครงสร้างข้อมูลที่เก็บใน cache
/// เก็บทั้งข้อมูล, เวลาหมดอายุ, และ access pattern
#[derive(Clone)]
struct CacheEntry {
    data: Vec<u8>,               // ข้อมูลที่เก็บเป็น bytes
    expires_at: Option<Instant>, // เวลาหมดอายุ (optional)
    last_accessed: Instant,      // เวลาที่เข้าถึงล่าสุด
    access_count: u64,           // จำนวนครั้งที่เข้าถึง
}

/// In-memory cache implementation
/// ใช้ DashMap สำหรับ thread-safe concurrent operations
/// มี background task สำหรับ cleanup expired entries
pub struct MemoryCache {
    store: Arc<DashMap<String, CacheEntry>>, // Main storage
    config: CacheConfig,                     // Configuration
    // Statistics - ใช้ atomic types สำหรับ thread safety
    hits: Arc<AtomicU64>,                 // จำนวน cache hits
    misses: Arc<AtomicU64>,               // จำนวน cache misses
    sets: Arc<AtomicU64>,                 // จำนวนครั้งที่ set
    deletes: Arc<AtomicU64>,              // จำนวนครั้งที่ delete
    evictions: Arc<AtomicU64>,            // จำนวน entries ที่ถูก evict
    current_size_bytes: Arc<AtomicUsize>, // ขนาดข้อมูลปัจจุบันใน bytes
}

impl Default for MemoryCache {
    fn default() -> Self {
        Self::new()
    }
}

impl MemoryCache {
    /// สร้าง memory cache ใหม่ด้วย default config
    pub fn new() -> Self {
        Self::with_config(&CacheConfig::default())
    }

    /// สร้าง memory cache ด้วย config ที่กำหนด
    /// เริ่ม background cleanup task อัตโนมัติ
    pub fn with_config(config: &CacheConfig) -> Self {
        let cache = Self {
            store: Arc::new(DashMap::new()),
            config: config.clone(),
            hits: Arc::new(AtomicU64::new(0)),
            misses: Arc::new(AtomicU64::new(0)),
            sets: Arc::new(AtomicU64::new(0)),
            deletes: Arc::new(AtomicU64::new(0)),
            evictions: Arc::new(AtomicU64::new(0)),
            current_size_bytes: Arc::new(AtomicUsize::new(0)),
        };

        // Start background cleanup task
        // เริ่ม task สำหรับลบ entries ที่หมดอายุ
        cache.start_cleanup_task();

        cache
    }

    /// ตรวจสอบว่า entry หมดอายุหรือไม่
    /// Return true ถ้าหมดอายุแล้ว
    fn is_expired(&self, entry: &CacheEntry) -> bool {
        if let Some(expires_at) = entry.expires_at {
            Instant::now() > expires_at
        } else {
            false
        }
    }

    /// เริ่ม background task สำหรับ cleanup
    /// ทำงานทุก 60 วินาที เพื่อลบ expired entries
    fn start_cleanup_task(&self) {
        let store = self.store.clone();
        let evictions = self.evictions.clone();
        let current_size = self.current_size_bytes.clone();

        tokio::spawn(async move {
            loop {
                sleep(Duration::from_secs(60)).await;

                let mut expired_keys = Vec::new();
                let mut expired_size = 0usize;

                // Find expired entries
                for entry in store.iter() {
                    if let Some(expires_at) = entry.expires_at {
                        if Instant::now() > expires_at {
                            expired_keys.push(entry.key().clone());
                            expired_size += entry.data.len();
                        }
                    }
                }

                // Remove expired entries
                for key in expired_keys {
                    store.remove(&key);
                    evictions.fetch_add(1, Ordering::Relaxed);
                }

                if expired_size > 0 {
                    current_size.fetch_sub(expired_size, Ordering::Relaxed);
                }
            }
        });
    }
}

#[async_trait]
impl Cache for MemoryCache {
    async fn set_bytes(&self, key: &str, value: Vec<u8>, ttl: Option<u64>) -> anyhow::Result<()> {
        let expires_at = ttl
            .or(self.config.default_ttl)
            .map(|seconds| Instant::now() + Duration::from_secs(seconds));

        let value_size = value.len();
        let old_size = self.store.get(key).map(|e| e.data.len()).unwrap_or(0);

        let entry = CacheEntry {
            data: value,
            expires_at,
            last_accessed: Instant::now(),
            access_count: 0,
        };

        self.store.insert(key.to_string(), entry);

        // Update statistics
        self.sets.fetch_add(1, Ordering::Relaxed);
        if old_size > 0 {
            self.current_size_bytes
                .fetch_sub(old_size, Ordering::Relaxed);
        }
        self.current_size_bytes
            .fetch_add(value_size, Ordering::Relaxed);

        Ok(())
    }

    async fn get_bytes(&self, key: &str) -> anyhow::Result<Option<Vec<u8>>> {
        if let Some(mut entry) = self.store.get_mut(key) {
            if self.is_expired(&entry) {
                let size = entry.data.len();
                drop(entry);
                self.store.remove(key);
                self.misses.fetch_add(1, Ordering::Relaxed);
                self.evictions.fetch_add(1, Ordering::Relaxed);
                self.current_size_bytes.fetch_sub(size, Ordering::Relaxed);
                return Ok(None);
            }

            // Update access info
            entry.last_accessed = Instant::now();
            entry.access_count += 1;
            let data = entry.data.clone();

            self.hits.fetch_add(1, Ordering::Relaxed);
            Ok(Some(data))
        } else {
            self.misses.fetch_add(1, Ordering::Relaxed);
            Ok(None)
        }
    }

    async fn del(&self, key: &str) -> anyhow::Result<()> {
        if let Some((_, entry)) = self.store.remove(key) {
            self.deletes.fetch_add(1, Ordering::Relaxed);
            self.current_size_bytes
                .fetch_sub(entry.data.len(), Ordering::Relaxed);
        }
        Ok(())
    }

    async fn exists(&self, key: &str) -> anyhow::Result<bool> {
        if let Some(entry) = self.store.get(key) {
            if self.is_expired(&entry) {
                let size = entry.data.len();
                drop(entry);
                self.store.remove(key);
                self.evictions.fetch_add(1, Ordering::Relaxed);
                self.current_size_bytes.fetch_sub(size, Ordering::Relaxed);
                Ok(false)
            } else {
                Ok(true)
            }
        } else {
            Ok(false)
        }
    }
}

#[async_trait]
impl CacheManager for MemoryCache {
    async fn flush(&self) -> anyhow::Result<()> {
        self.store.clear();
        self.hits.store(0, Ordering::Relaxed);
        self.misses.store(0, Ordering::Relaxed);
        self.sets.store(0, Ordering::Relaxed);
        self.deletes.store(0, Ordering::Relaxed);
        self.evictions.store(0, Ordering::Relaxed);
        self.current_size_bytes.store(0, Ordering::Relaxed);
        Ok(())
    }

    async fn ping(&self) -> anyhow::Result<()> {
        Ok(())
    }

    async fn stats(&self) -> anyhow::Result<CacheStats> {
        let hits = self.hits.load(Ordering::Relaxed);
        let misses = self.misses.load(Ordering::Relaxed);
        Ok(CacheStats {
            hits,
            misses,
            sets: self.sets.load(Ordering::Relaxed),
            deletes: self.deletes.load(Ordering::Relaxed),
            evictions: self.evictions.load(Ordering::Relaxed),
            size_bytes: self.current_size_bytes.load(Ordering::Relaxed) as u64,
            num_keys: self.store.len() as u64,
            total_requests: hits + misses,
        })
    }

    async fn get_many(&self, keys: &[&str]) -> anyhow::Result<Vec<Option<Vec<u8>>>> {
        let mut results = Vec::with_capacity(keys.len());
        for key in keys {
            results.push(self.get_bytes(key).await?);
        }
        Ok(results)
    }

    async fn set_many(&self, items: &[(&str, Vec<u8>, Option<u64>)]) -> anyhow::Result<()> {
        for (key, value, ttl) in items {
            self.set_bytes(key, value.clone(), *ttl).await?;
        }
        Ok(())
    }

    async fn delete_many(&self, keys: &[&str]) -> anyhow::Result<usize> {
        let mut deleted = 0;
        for key in keys {
            if self.store.remove(&key.to_string()).is_some() {
                deleted += 1;
                self.deletes.fetch_add(1, Ordering::Relaxed);
            }
        }
        Ok(deleted)
    }

    async fn increment(&self, key: &str, delta: i64) -> anyhow::Result<i64> {
        let current = match self.get_bytes(key).await? {
            Some(bytes) => {
                let s = String::from_utf8(bytes)?;
                s.parse::<i64>().unwrap_or(0)
            }
            None => 0,
        };

        let new_value = current + delta;
        self.set_bytes(key, new_value.to_string().into_bytes(), None)
            .await?;
        Ok(new_value)
    }

    async fn decrement(&self, key: &str, delta: i64) -> anyhow::Result<i64> {
        self.increment(key, -delta).await
    }

    async fn keys(&self, pattern: &str) -> anyhow::Result<Vec<String>> {
        let regex = glob_to_regex(pattern)?;
        let keys: Vec<String> = self
            .store
            .iter()
            .filter(|entry| regex.is_match(entry.key()))
            .map(|entry| entry.key().clone())
            .collect();
        Ok(keys)
    }

    async fn expire(&self, key: &str, ttl: Duration) -> anyhow::Result<bool> {
        if let Some(mut entry) = self.store.get_mut(key) {
            entry.expires_at = Some(Instant::now() + ttl);
            Ok(true)
        } else {
            Ok(false)
        }
    }

    async fn ttl(&self, key: &str) -> anyhow::Result<Option<Duration>> {
        if let Some(entry) = self.store.get(key) {
            if let Some(expires_at) = entry.expires_at {
                let now = Instant::now();
                if expires_at > now {
                    Ok(Some(expires_at - now))
                } else {
                    Ok(None)
                }
            } else {
                Ok(None)
            }
        } else {
            Ok(None)
        }
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

/// Convert glob pattern to regex
fn glob_to_regex(pattern: &str) -> anyhow::Result<regex::Regex> {
    let mut regex_str = String::from("^");

    for ch in pattern.chars() {
        match ch {
            '*' => regex_str.push_str(".*"),
            '?' => regex_str.push('.'),
            '.' | '(' | ')' | '+' | '|' | '^' | '$' | '@' | '%' => {
                regex_str.push('\\');
                regex_str.push(ch);
            }
            _ => regex_str.push(ch),
        }
    }

    regex_str.push('$');
    Ok(regex::Regex::new(&regex_str)?)
}
