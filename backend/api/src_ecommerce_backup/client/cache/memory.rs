// MemoryCache - ระบบแคชในหน่วยความจำสำหรับการทดสอบและพัฒนา
// ใช้ HashMap เก็บข้อมูลพร้อม TTL และการจัดการ expiration
// ใช้ RwLock เพื่อรองรับ concurrent access แบบปลอดภัย

use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

use crate::interfaces::{CacheInterface, InterfaceResult};

/// MemoryCache - การจัดการแคชในหน่วยความจำ
/// ใช้สำหรับการทดสอบและการพัฒนาโดยไม่ต้องพึ่งพา Redis
pub struct MemoryCache {
    data: Arc<RwLock<HashMap<String, CacheEntry>>>,
}

/// CacheEntry - รายการแคชพร้อมข้อมูลและเวลาหมดอายุ
struct CacheEntry {
    value: Vec<u8>,              // ข้อมูลที่เก็บในแคช
    expires_at: Option<Instant>, // เวลาหมดอายุ (None = ไม่หมดอายุ)
}

impl MemoryCache {
    /// new - สร้าง MemoryCache ใหม่
    /// เริ่มต้น HashMap ด้วย Arc และ RwLock เพื่อ thread safety
    pub fn new() -> Self {
        Self {
            data: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// cleanup_expired - ล้างรายการที่หมดอายุ
    /// สแกนหาและลบรายการที่หมดอายุเพื่อลดการใช้หน่วยความจำ
    async fn cleanup_expired(&self) {
        let mut data = self.data.write().await;

        let now = Instant::now();

        let expired_keys: Vec<String> = data
            .iter()
            .filter_map(|(key, entry)| {
                if let Some(expires_at) = entry.expires_at {
                    if expires_at <= now {
                        return Some(key.clone());
                    }
                }
                None
            })
            .collect();

        for key in expired_keys {
            data.remove(&key);
        }
    }
}

#[async_trait]
impl CacheInterface for MemoryCache {
    /// get - ดึงข้อมูลจากแคชตาม key
    /// ตรวจสอบ expiration ก่อนส่งคืนข้อมูล
    async fn get(&self, key: &str) -> InterfaceResult<Option<Vec<u8>>> {
        self.cleanup_expired().await;

        let data = self.data.read().await;

        match data.get(key) {
            Some(entry) => {
                if let Some(expires_at) = entry.expires_at {
                    if expires_at <= Instant::now() {
                        return Ok(None);
                    }
                }
                Ok(Some(entry.value.clone()))
            }
            None => Ok(None),
        }
    }

    /// set - เก็บข้อมูลในแคชพร้อม TTL
    /// ข้อมูลจะหมดอายุตาม Duration หรือไม่หมดอายุหาก ttl เป็น None
    async fn set(&self, key: &str, value: &[u8], ttl: Option<Duration>) -> InterfaceResult<()> {
        let expires_at = ttl.map(|duration| Instant::now() + duration);

        let entry = CacheEntry {
            value: value.to_vec(),
            expires_at,
        };

        let mut data = self.data.write().await;
        data.insert(key.to_string(), entry);

        Ok(())
    }

    /// delete - ลบข้อมูลจากแคช
    /// ลบ entry ที่มี key ตรงกัน
    async fn delete(&self, key: &str) -> InterfaceResult<()> {
        let mut data = self.data.write().await;
        data.remove(key);
        Ok(())
    }

    /// exists - ตรวจสอบว่ามี key อยู่ในแคชและยังไม่หมดอายุ
    /// คืนค่า true หาก key มีอยู่และยังไม่หมดอายุ
    async fn exists(&self, key: &str) -> InterfaceResult<bool> {
        self.cleanup_expired().await;
        let data = self.data.read().await;

        match data.get(key) {
            Some(entry) => {
                if let Some(expires_at) = entry.expires_at {
                    Ok(expires_at > Instant::now())
                } else {
                    Ok(true)
                }
            }
            None => Ok(false),
        }
    }

    /// clear - ล้างข้อมูลทั้งหมดในแคช
    /// ลบ entry ทั้งหมดใน HashMap
    async fn clear(&self) -> InterfaceResult<()> {
        let mut data = self.data.write().await;
        data.clear();

        Ok(())
    }

    /// ping - ตรวจสอบสถานะการเชื่อมต่อ
    /// Memory cache จะพร้อมใช้งานเสมอ
    async fn ping(&self) -> InterfaceResult<()> {
        // Memory cache is always available
        Ok(())
    }
}

impl Default for MemoryCache {
    fn default() -> Self {
        Self::new()
    }
}
