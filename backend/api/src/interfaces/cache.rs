use async_trait::async_trait;
use std::{borrow::Cow, time::Duration};

use super::InterfaceResult;

/// Borrow-friendly cache entry used for batch operations.
#[derive(Debug, Clone)]
pub struct CacheEntry<'a> {
    key: Cow<'a, str>,
    value: Cow<'a, [u8]>,
}

impl<'a> CacheEntry<'a> {
    /// Construct an entry borrowing the provided key and value.
    pub fn borrowed(key: &'a str, value: &'a [u8]) -> Self {
        Self {
            key: Cow::Borrowed(key),
            value: Cow::Borrowed(value),
        }
    }

    /// Construct an entry that owns its key and value.
    pub fn owned<K, V>(key: K, value: V) -> Self
    where
        K: Into<String>,
        V: Into<Vec<u8>>,
    {
        Self {
            key: Cow::Owned(key.into()),
            value: Cow::Owned(value.into()),
        }
    }

    /// Access the cache key.
    pub fn key(&self) -> &str {
        self.key.as_ref()
    }

    /// Access the cache value.
    pub fn value(&self) -> &[u8] {
        self.value.as_ref()
    }

    /// Convert the entry into an owned representation.
    pub fn into_owned(self) -> CacheEntry<'static> {
        CacheEntry {
            key: Cow::Owned(self.key.into_owned()),
            value: Cow::Owned(self.value.into_owned()),
        }
    }
}

// CacheInterface กำหนดฟังก์ชันพื้นฐานที่ต้องการสำหรับการทำงานกับ Cache
#[async_trait]
pub trait CacheInterface: Send + Sync {
    // Get ใช้สำหรับดึงข้อมูลจาก Cache โดยใช้คีย์
    // key: คีย์ที่ใช้ในการอ้างอิงข้อมูล
    // คืนค่าข้อมูลที่ดึงออกมาเป็น []byte และ error ถ้ามีข้อผิดพลาดในการดึงข้อมูล
    async fn get(&self, key: &str) -> InterfaceResult<Option<Vec<u8>>>;

    // Set ใช้สำหรับเก็บข้อมูลใน Cache
    // key: คีย์ที่ใช้ในการอ้างอิงข้อมูล
    // value: ข้อมูลที่ต้องการเก็บใน Cache (เก็บในรูปแบบ []byte)
    // duration: เวลาหมดอายุของข้อมูลใน Cache (หน่วย: วินาที)
    // คืนค่า error ถ้ามีข้อผิดพลาดในการเก็บข้อมูล
    async fn set(&self, key: &str, value: &[u8], ttl: Option<Duration>) -> InterfaceResult<()>;

    /// Delete a value from cache
    async fn delete(&self, key: &str) -> InterfaceResult<()>;

    /// Check if a key exists
    async fn exists(&self, key: &str) -> InterfaceResult<bool>;

    /// Set multiple values at once
    async fn set_many(
        &self,
        entries: &[CacheEntry<'_>],
        ttl: Option<Duration>,
    ) -> InterfaceResult<()> {
        for entry in entries {
            self.set(entry.key(), entry.value(), ttl).await?;
        }
        Ok(())
    }

    /// Get multiple values at once
    async fn get_many(&self, keys: &[&str]) -> InterfaceResult<Vec<Option<Vec<u8>>>> {
        let mut results = Vec::with_capacity(keys.len());
        for key in keys {
            results.push(self.get(key).await?);
        }
        Ok(results)
    }

    /// Clear all cache entries (use with caution)
    async fn clear(&self) -> InterfaceResult<()>;

    /// Delete multiple keys at once
    async fn delete_many(&self, keys: &[&str]) -> InterfaceResult<()> {
        for key in keys {
            self.delete(key).await?;
        }
        Ok(())
    }

    // Ping ใช้สำหรับตรวจสอบการเชื่อมต่อกับ Cache ว่ายังใช้งานได้อยู่หรือไม่
    // คืนค่า error ถ้ามีข้อผิดพลาดในการเชื่อมต่อ
    async fn ping(&self) -> InterfaceResult<()>;
}
