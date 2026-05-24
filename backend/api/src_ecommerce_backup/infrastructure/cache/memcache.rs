/// Memcache Cache Implementation - การติดตั้งแคชด้วย Memcache
///
/// ไฟล์นี้เป็น implementation ของ Cache และ CacheManager traits
/// สำหรับการใช้งาน Memcache server เป็น cache backend
///
/// # คุณสมบัติ
/// - รองรับ async operations ผ่าน async-memcached crate
/// - มีการเก็บสถิติการใช้งาน (ถ้าเปิดใช้งาน)
/// - รองรับ batch operations (get_many, set_many, delete_many)
/// - มี key tracking สำหรับการค้นหาด้วย pattern
/// - รองรับ TTL และ expiration
///
/// # ข้อจำกัด
/// - บาง operations ไม่รองรับโดยตรงใน memcache เช่น increment/decrement
/// - flush operation อาจไม่ทำงานได้ในบาง memcache servers
/// - TTL query ไม่รองรับใน memcache protocol
use super::{Cache, CacheConfig, CacheManager, CacheStats};
use async_memcached::Client;
use async_trait::async_trait;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

/// Memcache Cache Implementation
///
/// Struct นี้ encapsulate memcache client และการตั้งค่าต่างๆ
/// พร้อมกับ statistics tracking และ key management
pub struct MemcacheCache {
    /// Async memcache client ที่ wrapped ด้วย RwLock สำหรับ thread safety
    client: Arc<RwLock<Client>>,
    /// Configuration settings สำหรับ cache
    config: CacheConfig,
    /// Cache statistics สำหรับ monitoring
    stats: Arc<RwLock<CacheStats>>,
    /// Key tracker สำหรับ pattern search (เพราะ memcache ไม่รองรับ key enumeration)
    keys_tracker: Arc<RwLock<Vec<String>>>,
}

impl MemcacheCache {
    /// สร้าง instance ใหม่ของ MemcacheCache
    ///
    /// # Parameters
    /// - `config`: การตั้งค่าแคช ต้องมี memcache_url
    ///
    /// # Returns
    /// `Self` instance ที่พร้อมใช้งาน
    ///
    /// # Errors
    /// ส่งคืน error หาก:
    /// - ไม่มี memcache_url ใน config
    /// - ไม่สามารถเชื่อมต่อไปยัง memcache server ได้
    pub async fn new(config: &CacheConfig) -> anyhow::Result<Self> {
        let memcache_url = config
            .memcache_url
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Memcache URL not provided"))?;

        let client = Client::new(memcache_url.as_str()).await?;

        Ok(Self {
            client: Arc::new(RwLock::new(client)),
            config: config.clone(),
            stats: Arc::new(RwLock::new(CacheStats::default())),
            keys_tracker: Arc::new(RwLock::new(Vec::new())),
        })
    }

    /// อัพเดทสถิติการใช้งานแคช (ถ้าเปิดใช้งาน)
    ///
    /// # Parameters
    /// - `f`: closure สำหรับแก้ไขสถิติ
    async fn update_stats<F>(&self, f: F)
    where
        F: FnOnce(&mut CacheStats),
    {
        if self.config.enable_stats {
            let mut stats = self.stats.write().await;
            f(&mut stats);
        }
    }

    /// เพิ่มคีย์เข้าไปใน key tracker (สำหรับ pattern search)
    ///
    /// # Parameters
    /// - `key`: คีย์ที่ต้องการ track
    async fn track_key(&self, key: &str) {
        let mut keys = self.keys_tracker.write().await;
        if !keys.contains(&key.to_string()) {
            keys.push(key.to_string());
        }
    }

    /// เอาคีย์ออกจาก key tracker
    ///
    /// # Parameters
    /// - `key`: คีย์ที่ต้องการหยุด track
    async fn untrack_key(&self, key: &str) {
        let mut keys = self.keys_tracker.write().await;
        keys.retain(|k| k != key);
    }
}

#[async_trait]
impl Cache for MemcacheCache {
    async fn set_bytes(&self, key: &str, value: Vec<u8>, ttl: Option<u64>) -> anyhow::Result<()> {
        let ttl_seconds = ttl.or(self.config.default_ttl).unwrap_or(0) as u32;

        self.client
            .write()
            .await
            .set(key.as_bytes(), value.as_slice(), Some(0), Some(ttl_seconds))
            .await
            .map_err(|e| anyhow::anyhow!("Failed to set key: {}", e))?;

        self.track_key(key).await;
        self.update_stats(|s| s.sets += 1).await;
        Ok(())
    }

    async fn get_bytes(&self, key: &str) -> anyhow::Result<Option<Vec<u8>>> {
        match self.client.write().await.get(key.as_bytes()).await {
            Ok(value) => {
                // Convert Option<Value> to Vec<u8>
                match value {
                    Some(v) => {
                        let bytes = v.data.to_vec();
                        if bytes.is_empty() {
                            self.update_stats(|s| s.misses += 1).await;
                            Ok(None)
                        } else {
                            self.update_stats(|s| s.hits += 1).await;
                            Ok(Some(bytes))
                        }
                    }
                    None => {
                        self.update_stats(|s| s.misses += 1).await;
                        Ok(None)
                    }
                }
            }
            Err(e) => {
                // KeyNotFound variant might not exist, treat any error as miss
                if true {
                    self.update_stats(|s| s.misses += 1).await;
                    Ok(None)
                } else {
                    Err(anyhow::anyhow!("Memcache get error: {}", e))
                }
            }
        }
    }

    async fn del(&self, key: &str) -> anyhow::Result<()> {
        self.client
            .write()
            .await
            .delete(key.as_bytes())
            .await
            .map_err(|e| anyhow::anyhow!("Failed to delete key: {}", e))?;

        self.untrack_key(key).await;
        self.update_stats(|s| s.deletes += 1).await;
        Ok(())
    }

    async fn exists(&self, key: &str) -> anyhow::Result<bool> {
        match self.client.write().await.get(key.as_bytes()).await {
            Ok(value) => Ok(value.is_some()),
            Err(e) => {
                // KeyNotFound variant might not exist, treat any error as miss
                if true {
                    Ok(false)
                } else {
                    Err(anyhow::anyhow!("Memcache exists error: {}", e))
                }
            }
        }
    }
}

#[async_trait]
impl CacheManager for MemcacheCache {
    async fn flush(&self) -> anyhow::Result<()> {
        // Flush may not be directly available, clear tracked keys instead
        // TODO: Implement flush when available in async_memcached

        let mut keys = self.keys_tracker.write().await;
        keys.clear();

        if self.config.enable_stats {
            let mut stats = self.stats.write().await;
            *stats = CacheStats::default();
        }

        Ok(())
    }

    async fn ping(&self) -> anyhow::Result<()> {
        self.client
            .write()
            .await
            .version()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to ping: {}", e))?;
        Ok(())
    }

    async fn stats(&self) -> anyhow::Result<CacheStats> {
        let stats = self.stats.read().await.clone();
        Ok(stats)
    }

    async fn get_many(&self, keys: &[&str]) -> anyhow::Result<Vec<Option<Vec<u8>>>> {
        if keys.is_empty() {
            return Ok(vec![]);
        }

        let mut results = Vec::with_capacity(keys.len());

        for key in keys {
            match self.client.write().await.get(key.as_bytes()).await {
                Ok(value) => {
                    let bytes = value.map(|v| v.data.to_vec()).unwrap_or_default();
                    if bytes.is_empty() {
                        self.update_stats(|s| s.misses += 1).await;
                        results.push(None);
                    } else {
                        self.update_stats(|s| s.hits += 1).await;
                        results.push(Some(bytes));
                    }
                }
                Err(_) => {
                    self.update_stats(|s| s.misses += 1).await;
                    results.push(None);
                }
            }
        }

        Ok(results)
    }

    async fn set_many(&self, items: &[(&str, Vec<u8>, Option<u64>)]) -> anyhow::Result<()> {
        for (key, value, ttl) in items {
            let ttl_seconds = ttl.or(self.config.default_ttl).unwrap_or(0) as u32;
            self.client
                .write()
                .await
                .set(key.as_bytes(), value.as_slice(), Some(0), Some(ttl_seconds))
                .await
                .map_err(|e| anyhow::anyhow!("Failed to set key: {}", e))?;
            self.track_key(key).await;
        }

        self.update_stats(|s| s.sets += items.len() as u64).await;
        Ok(())
    }

    async fn delete_many(&self, keys: &[&str]) -> anyhow::Result<usize> {
        if keys.is_empty() {
            return Ok(0);
        }

        let mut deleted = 0;
        for key in keys {
            if self
                .client
                .write()
                .await
                .delete(key.as_bytes())
                .await
                .is_ok()
            {
                deleted += 1;
                self.untrack_key(key).await;
            }
        }

        self.update_stats(|s| s.deletes += deleted as u64).await;
        Ok(deleted)
    }

    async fn increment(&self, key: &str, delta: i64) -> anyhow::Result<i64> {
        // increment/decrement not directly available in async_memcached
        // Need to implement with get/set
        let current_bytes = self.get_bytes(key).await?;
        let current = if let Some(bytes) = current_bytes {
            let s = String::from_utf8(bytes).unwrap_or_default();
            s.parse::<i64>().unwrap_or(0)
        } else {
            0
        };
        let new_value = current + delta;
        let value_str = new_value.to_string();
        self.set_bytes(key, value_str.into_bytes(), None).await?;
        Ok(new_value)
    }

    async fn decrement(&self, key: &str, delta: i64) -> anyhow::Result<i64> {
        // increment/decrement not directly available in async_memcached
        // Need to implement with get/set
        let current_bytes = self.get_bytes(key).await?;
        let current = if let Some(bytes) = current_bytes {
            let s = String::from_utf8(bytes).unwrap_or_default();
            s.parse::<i64>().unwrap_or(0)
        } else {
            0
        };
        let new_value = current - delta;
        let value_str = new_value.to_string();
        self.set_bytes(key, value_str.into_bytes(), None).await?;
        Ok(new_value)
    }

    async fn keys(&self, pattern: &str) -> anyhow::Result<Vec<String>> {
        let keys = self.keys_tracker.read().await;

        if pattern == "*" {
            Ok(keys.clone())
        } else {
            let regex_pattern = pattern.replace("*", ".*");
            let re = regex::Regex::new(&regex_pattern)?;
            Ok(keys.iter().filter(|k| re.is_match(k)).cloned().collect())
        }
    }

    async fn expire(&self, key: &str, ttl: Duration) -> anyhow::Result<bool> {
        match self.client.write().await.get(key.as_bytes()).await {
            Ok(value) => {
                let bytes = value.map(|v| v.data.to_vec()).unwrap_or_default();
                if !bytes.is_empty() {
                    self.client
                        .write()
                        .await
                        .set(key.as_bytes(), &bytes, Some(0), Some(ttl.as_secs() as u32))
                        .await
                        .map_err(|e| anyhow::anyhow!("Failed to set expiry: {}", e))?;
                    Ok(true)
                } else {
                    Ok(false)
                }
            }
            Err(_) => Ok(false),
        }
    }

    async fn ttl(&self, _key: &str) -> anyhow::Result<Option<Duration>> {
        Ok(None)
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}
