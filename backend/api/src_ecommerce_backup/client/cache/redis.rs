// RedisCache - ระบบแคช Redis สำหรับ production environment
// ใช้ ConnectionManager เพื่อ connection pooling และ automatic reconnection
// รองรับ TTL, expiration และคำสั่ง Redis ต่างๆ

use async_trait::async_trait;
use redis::aio::ConnectionManager;
use redis::{AsyncCommands, Client};
use std::time::Duration;

use crate::interfaces::{CacheInterface, InterfaceError, InterfaceResult};

/// RedisCache - การจัดการแคช Redis
/// ใช้ ConnectionManager เพื่อการจัดการ connection pool และ auto-reconnect
pub struct RedisCache {
    client: Client,                // Redis client instance
    connection: ConnectionManager, // Connection manager สำหรับ connection pooling
}

impl RedisCache {
    /// new - สร้าง RedisCache ใหม่พร้อมการเชื่อมต่อ
    /// สร้าง connection ไปยัง Redis server และตั้งค่า connection manager
    pub async fn new(url: &str) -> InterfaceResult<Self> {
        let client =
            Client::open(url).map_err(|e| InterfaceError::ConnectionError(e.to_string()))?;

        let connection = client
            .get_connection_manager()
            .await
            .map_err(|e| InterfaceError::ConnectionError(e.to_string()))?;

        Ok(Self { client, connection })
    }
}

#[async_trait]
impl CacheInterface for RedisCache {
    /// get - ดึงข้อมูลจาก Redis ตาม key
    /// คืนค่า None หากไม่มีข้อมูลหรือหมดอายุ
    async fn get(&self, key: &str) -> InterfaceResult<Option<Vec<u8>>> {
        let mut conn = self.connection.clone();
        let value: Option<Vec<u8>> = conn
            .get(key)
            .await
            .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?;
        Ok(value)
    }

    /// set - เก็บข้อมูลลง Redis พร้อม TTL
    /// ใช้ SET หรือ SETEX ตามการมี TTL หรือไม่
    async fn set(&self, key: &str, value: &[u8], ttl: Option<Duration>) -> InterfaceResult<()> {
        let mut conn = self.connection.clone();

        if let Some(ttl) = ttl {
            conn.set_ex::<_, _, ()>(key, value, ttl.as_secs())
                .await
                .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?;
        } else {
            conn.set::<_, _, ()>(key, value)
                .await
                .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?;
        }

        Ok(())
    }

    /// delete - ลบข้อมูลจาก Redis ตาม key
    /// ใช้คำสั่ง DEL ของ Redis
    async fn delete(&self, key: &str) -> InterfaceResult<()> {
        let mut conn = self.connection.clone();
        conn.del::<_, ()>(key)
            .await
            .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?;
        Ok(())
    }

    /// exists - ตรวจสอบว่ามี key อยู่ใน Redis
    /// คืนค่า true หาก key มีอยู่
    async fn exists(&self, key: &str) -> InterfaceResult<bool> {
        let mut conn = self.connection.clone();
        let exists: bool = conn
            .exists(key)
            .await
            .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?;
        Ok(exists)
    }

    /// clear - ล้างข้อมูลทั้งหมดใน database ปัจจุบัน
    /// ใช้คำสั่ง FLUSHDB เพื่อล้าง database ทั้งหมด
    async fn clear(&self) -> InterfaceResult<()> {
        let mut conn = self.connection.clone();
        redis::cmd("FLUSHDB")
            .query_async::<()>(&mut conn)
            .await
            .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?;
        Ok(())
    }

    /// ping - ตรวจสอบสถานะการเชื่อมต่อกับ Redis
    /// ใช้คำสั่ง PING เพื่อตรวจสอบความพร้อมใช้ของ Redis
    async fn ping(&self) -> InterfaceResult<()> {
        let mut conn = self.connection.clone();
        redis::cmd("PING")
            .query_async::<()>(&mut conn)
            .await
            .map_err(|e| InterfaceError::OperationFailed(e.to_string()))?;
        Ok(())
    }
}
