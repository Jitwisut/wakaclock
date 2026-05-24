/// ไฟล์ redis.rs - Redis Cache Implementation
/// จัดการ cache ด้วย Redis สำหรับ high-performance caching
/// รองรับ connection pooling, automatic reconnection, และ statistics tracking
use crate::infrastructure::logger::Logger;

use super::{Cache, CacheConfig, CacheManager, CacheStats};
use async_trait::async_trait;
use redis::aio::ConnectionManager;
use redis::{AsyncCommands, Client};

use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

/// RedisCache - Redis-based cache implementation
/// ใช้สำหรับการตั้งค่าและการจัดการการเชื่อมต่อ Redis Cache
/// ประกอบด้วยการตั้งค่าและการจัดการทั้งการอ่านและเขียนข้อมูลจาก Redis
pub struct RedisCache {
    // client ตัวแปรที่เก็บข้อมูลการเชื่อมต่อ Redis สำหรับการอ่านและการเขียน
    client: Method,

    // config การตั้งค่าเกี่ยวกับการตอบสนองจาก Redis Cache
    config: CacheConfig,

    // Logger instance สำหรับ logging operations
    logger: Logger,

    // Cache statistics
    // เก็บสถิติการใช้งาน cache (hits, misses, etc.)
    stats: Arc<RwLock<CacheStats>>,
}
/// Method - เก็บ connection managers แยกสำหรับ read/write
/// เก็บการเชื่อมต่อ Redis สำหรับทั้งการอ่านและการเขียน
/// โดยใช้ `redis.Client` ในการทำงานทั้งสองฝั่ง
#[allow(dead_code)]
pub struct Method {
    // write การเชื่อมต่อ Redis สำหรับการเขียนข้อมูล
    #[allow(dead_code)]
    write: Arc<RwLock<Option<ConnectionManager>>>,
    // read การเชื่อมต่อ Redis สำหรับการอ่านข้อมูล
    read: Arc<RwLock<Option<ConnectionManager>>>,
}

impl RedisCache {
    /// สร้าง Redis cache instance ใหม่
    /// เชื่อมต่อกับ Redis server และเตรียม connection pool
    pub async fn new(config: &CacheConfig, logger: Logger) -> anyhow::Result<Self> {
        let redis_url = config
            .redis_url
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Redis URL not provided"))?;

        logger.info(
            &format!("Initializing Redis cache with URL: {}", redis_url),
            None,
        );

        let client = Client::open(redis_url.as_str())?;

        // Create read connection
        let read_conn = client.get_connection_manager().await?;
        // Create write connection
        let write_conn = client.get_connection_manager().await?;

        logger.info("Redis connection managers created successfully", None);

        Ok(Self {
            client: Method {
                read: Arc::new(RwLock::new(Some(read_conn))),
                write: Arc::new(RwLock::new(Some(write_conn))),
            },
            config: config.clone(),
            logger,
            stats: Arc::new(RwLock::new(CacheStats::default())),
        })
    }

    async fn get_connection(&self) -> anyhow::Result<ConnectionManager> {
        let mut conn_lock = self.client.read.write().await;

        // Try to test the connection first if it exists
        if let Some(ref conn) = *conn_lock {
            // Test if connection is still alive by attempting a ping
            let mut test_conn = conn.clone();
            if redis::cmd("PING")
                .query_async::<String>(&mut test_conn)
                .await
                .is_ok()
            {
                // Connection is healthy, return it
                return Ok(conn.clone());
            }

            // Connection test failed, need to reconnect
            self.logger.warn(
                "Redis connection broken (broken pipe), attempting reconnection",
                None,
            );
            *conn_lock = None;
        }

        // Connection is None or broken, create new connection
        if conn_lock.is_none() {
            self.logger
                .warn("Redis connection lost, attempting reconnection", None);

            let redis_url = self
                .config
                .redis_url
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("Redis URL not provided"))?;
            let client = Client::open(redis_url.as_str())?;
            *conn_lock = Some(client.get_connection_manager().await?);

            self.logger
                .info("Redis connection re-established successfully", None);
        }

        Ok(conn_lock.as_ref().unwrap().clone())
    }

    async fn update_stats<F>(&self, f: F)
    where
        F: FnOnce(&mut CacheStats),
    {
        if self.config.enable_stats {
            let mut stats = self.stats.write().await;
            f(&mut stats);
        }
    }
}

#[async_trait]
impl Cache for RedisCache {
    async fn set_bytes(&self, key: &str, value: Vec<u8>, ttl: Option<u64>) -> anyhow::Result<()> {
        self.logger
            .debug(&format!("Setting cache key: {}", key), None);

        let mut conn = self.get_connection().await?;

        if let Some(ttl_seconds) = ttl.or(self.config.default_ttl) {
            conn.set_ex::<_, _, ()>(key, value, ttl_seconds).await?;
            self.logger.debug(
                &format!("Set cache key: {} with TTL: {}s", key, ttl_seconds),
                None,
            );
        } else {
            conn.set::<_, _, ()>(key, value).await?;
            self.logger
                .debug(&format!("Set cache key: {} with no TTL", key), None);
        }

        self.update_stats(|s| s.sets += 1).await;

        Ok(())
    }

    async fn get_bytes(&self, key: &str) -> anyhow::Result<Option<Vec<u8>>> {
        self.logger
            .debug(&format!("Getting cache key: {}", key), None);

        let mut conn = self.get_connection().await?;
        let value: Option<Vec<u8>> = conn.get(key).await?;

        self.update_stats(|s| {
            if value.is_some() {
                s.hits += 1;
                self.logger
                    .debug(&format!("Cache HIT for key: {}", key), None);
            } else {
                s.misses += 1;
                self.logger
                    .debug(&format!("Cache MISS for key: {}", key), None);
            }
        })
        .await;

        Ok(value)
    }

    async fn del(&self, key: &str) -> anyhow::Result<()> {
        self.logger
            .debug(&format!("Deleting cache key: {}", key), None);

        let mut conn = self.get_connection().await?;
        conn.del::<_, ()>(key).await?;

        self.update_stats(|s| s.deletes += 1).await;
        Ok(())
    }

    async fn exists(&self, key: &str) -> anyhow::Result<bool> {
        self.logger
            .debug(&format!("Checking existence of cache key: {}", key), None);

        let mut conn = self.get_connection().await?;
        let exists: bool = conn.exists(key).await?;

        if exists {
            self.logger
                .debug(&format!("Cache key exists: {}", key), None);
        } else {
            self.logger
                .debug(&format!("Cache key does not exist: {}", key), None);
        }

        Ok(exists)
    }
}

#[async_trait]
impl CacheManager for RedisCache {
    async fn flush(&self) -> anyhow::Result<()> {
        self.logger.info("Flushing Redis cache", None);

        let mut conn = self.get_connection().await?;
        redis::cmd("FLUSHDB").query_async::<()>(&mut conn).await?;

        // Reset stats
        if self.config.enable_stats {
            let mut stats = self.stats.write().await;
            *stats = CacheStats::default();
            self.logger.info("Cache statistics reset", None);
        }

        self.logger.info("Redis cache flushed successfully", None);
        Ok(())
    }

    async fn ping(&self) -> anyhow::Result<()> {
        self.logger.debug("Pinging Redis server", None);

        let mut conn = self.get_connection().await?;
        let _: String = redis::cmd("PING").query_async(&mut conn).await?;

        self.logger.debug("Redis server responded to PING", None);
        Ok(())
    }

    async fn stats(&self) -> anyhow::Result<CacheStats> {
        self.logger.debug("Retrieving cache statistics", None);
        Ok(self.stats.read().await.clone())
    }

    async fn get_many(&self, keys: &[&str]) -> anyhow::Result<Vec<Option<Vec<u8>>>> {
        if keys.is_empty() {
            self.logger
                .debug("get_many called with empty keys array", None);
            return Ok(vec![]);
        }

        self.logger.debug(
            &format!("Getting multiple cache keys: {}", keys.join(", ")),
            None,
        );

        let mut conn = self.get_connection().await?;
        let mut results = Vec::with_capacity(keys.len());

        for key in keys {
            let value: Option<Vec<u8>> = conn.get(*key).await?;
            results.push(value);
        }

        Ok(results)
    }

    async fn set_many(&self, items: &[(&str, Vec<u8>, Option<u64>)]) -> anyhow::Result<()> {
        if items.is_empty() {
            self.logger
                .debug("set_many called with empty items array", None);
            return Ok(());
        }

        self.logger
            .debug(&format!("Setting {} cache items", items.len()), None);

        let mut conn = self.get_connection().await?;

        for (key, value, ttl) in items {
            let ttl_value = ttl.or(self.config.default_ttl);
            if let Some(ttl_seconds) = ttl_value {
                conn.set_ex::<_, _, ()>(*key, value.as_slice(), ttl_seconds)
                    .await?;
                self.logger.debug(
                    &format!("Set cache key: {} with TTL: {}s", key, ttl_seconds),
                    None,
                );
            } else {
                conn.set::<_, _, ()>(*key, value.as_slice()).await?;
                self.logger
                    .debug(&format!("Set cache key: {} with no TTL", key), None);
            }
        }

        self.update_stats(|s| s.sets += items.len() as u64).await;
        self.logger.debug(
            &format!("Successfully set {} cache items", items.len()),
            None,
        );
        Ok(())
    }

    async fn delete_many(&self, keys: &[&str]) -> anyhow::Result<usize> {
        if keys.is_empty() {
            self.logger
                .debug("delete_many called with empty keys array", None);
            return Ok(0);
        }

        self.logger.debug(
            &format!("Deleting multiple cache keys: {}", keys.join(", ")),
            None,
        );

        let mut conn = self.get_connection().await?;
        let deleted: usize = conn.del(keys).await?;

        self.update_stats(|s| s.deletes += deleted as u64).await;
        self.logger.debug(
            &format!("Successfully deleted {} cache keys", deleted),
            None,
        );
        Ok(deleted)
    }

    async fn increment(&self, key: &str, delta: i64) -> anyhow::Result<i64> {
        self.logger.debug(
            &format!("Incrementing cache key: {} by {}", key, delta),
            None,
        );

        let mut conn = self.get_connection().await?;
        let result: i64 = conn.incr(key, delta).await?;

        self.logger.debug(
            &format!("Incremented cache key: {}, new value: {}", key, result),
            None,
        );
        Ok(result)
    }

    async fn decrement(&self, key: &str, delta: i64) -> anyhow::Result<i64> {
        self.logger.debug(
            &format!("Decrementing cache key: {} by {}", key, delta),
            None,
        );

        let mut conn = self.get_connection().await?;
        let result: i64 = conn.incr(key, -delta).await?;

        self.logger.debug(
            &format!("Decremented cache key: {}, new value: {}", key, result),
            None,
        );
        Ok(result)
    }

    async fn keys(&self, pattern: &str) -> anyhow::Result<Vec<String>> {
        self.logger.debug(
            &format!("Retrieving keys matching pattern: {}", pattern),
            None,
        );

        let mut conn = self.get_connection().await?;
        let keys: Vec<String> = conn.keys(pattern).await?;

        self.logger.debug(
            &format!("Found {} keys matching pattern: {}", keys.len(), pattern),
            None,
        );
        Ok(keys)
    }

    async fn expire(&self, key: &str, ttl: Duration) -> anyhow::Result<bool> {
        self.logger.debug(
            &format!("Setting expiry for key: {} to {}s", key, ttl.as_secs()),
            None,
        );

        let mut conn = self.get_connection().await?;
        let result: bool = conn.expire(key, ttl.as_secs() as i64).await?;

        if result {
            self.logger
                .debug(&format!("Successfully set expiry for key: {}", key), None);
        } else {
            self.logger.debug(
                &format!("Failed to set expiry for key: {} (key may not exist)", key),
                None,
            );
        }

        Ok(result)
    }

    async fn ttl(&self, key: &str) -> anyhow::Result<Option<Duration>> {
        self.logger
            .debug(&format!("Getting TTL for key: {}", key), None);

        let mut conn = self.get_connection().await?;
        let ttl: i64 = conn.ttl(key).await?;

        if ttl == -2 {
            // Key doesn't exist
            self.logger
                .debug(&format!("Key does not exist: {}", key), None);
            Ok(None)
        } else if ttl == -1 {
            // Key exists but has no TTL
            self.logger
                .debug(&format!("Key exists but has no TTL: {}", key), None);
            Ok(None)
        } else {
            self.logger
                .debug(&format!("TTL for key {}: {}s", key, ttl), None);
            Ok(Some(Duration::from_secs(ttl as u64)))
        }
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}
