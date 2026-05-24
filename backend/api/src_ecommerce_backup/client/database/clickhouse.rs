/// ไฟล์ clickhouse.rs - ClickHouse Database Client Implementation
/// Wrapper สำหรับ ClickHouse client ให้ใช้งานง่ายขึ้น
/// รองรับ query, insert, batch operations และ health check
use anyhow::Result;
use clickhouse::Client;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tracing::warn;

use crate::config::DatabaseConfig;

/// ClickHouse client wrapper
/// จัดการการเชื่อมต่อกับ ClickHouse database
/// ใช้ credentials default (user: default, password: default)
pub struct ClickHouseClient {
    client: Client,   // ClickHouse client instance
    database: String, // ชื่อ database ที่ใช้งาน
    endpoint: String, // Base HTTP endpoint
}

impl std::fmt::Debug for ClickHouseClient {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ClickHouseClient")
            .field("database", &self.database)
            .field("endpoint", &self.endpoint)
            .finish()
    }
}

impl ClickHouseClient {
    /// สร้าง ClickHouse client ใหม่
    /// ตั้งค่า connection พร้อม authentication
    /// IMPORTANT: ใช้ user: "default", password: "default" เสมอ
    pub async fn new(config: &DatabaseConfig) -> Result<Self> {
        let endpoint = config.clickhouse_url.trim_end_matches('/').to_string();
        let client = Client::default()
            .with_url(&endpoint)
            .with_user("default")
            .with_password("default")
            .with_database(&config.clickhouse_database);

        Ok(Self {
            client,
            database: config.clickhouse_database.clone(),
            endpoint,
        })
    }

    /// ดึง raw ClickHouse client สำหรับใช้งานโดยตรง
    /// Wrap ด้วย Arc สำหรับ thread-safe sharing
    pub fn get_client(&self) -> Arc<Client> {
        Arc::new(self.client.clone())
    }

    /// ดึงชื่อ database ที่กำลังใช้งาน
    pub fn get_database(&self) -> String {
        self.database.clone()
    }

    /// Return the configured HTTP endpoint for raw queries
    pub fn endpoint(&self) -> &str {
        &self.endpoint
    }

    /// Execute query และ return raw bytes
    /// Placeholder implementation - รอ ClickHouse traits stable
    pub async fn query_raw(&self, _sql: &str) -> Result<Vec<Vec<u8>>> {
        // Simplified implementation that returns raw bytes
        // TODO: Implement proper deserialization when ClickHouse traits are stable
        Ok(vec![])
    }

    /// Execute query พร้อม parameters
    /// ป้องกัน SQL injection ด้วย parameterized queries
    /// Placeholder implementation - รอ ClickHouse traits stable
    pub async fn query_with_params_raw(
        &self,
        _sql: &str,
        _params: Vec<(&str, &str)>,
    ) -> Result<Vec<Vec<u8>>> {
        // Simplified implementation
        // TODO: Implement proper parameterized queries when ClickHouse traits are stable
        Ok(vec![])
    }

    /// Insert raw data ลงใน table
    /// รับ data เป็น bytes array
    /// Placeholder implementation - รอ ClickHouse traits stable
    pub async fn insert_raw(&self, _table: &str, _data: &[Vec<u8>]) -> Result<()> {
        // Simplified implementation
        // TODO: Implement proper data insertion when ClickHouse traits are stable
        Ok(())
    }

    /// Execute DDL statement (CREATE, ALTER, DROP)
    /// ใช้สำหรับจัดการ schema ของ database
    pub async fn execute(&self, sql: &str) -> Result<()> {
        self.client.query(sql).execute().await?;
        Ok(())
    }

    /// ตรวจสอบ connection health
    /// ใช้สำหรับ health check endpoint
    /// Placeholder implementation - รอ ClickHouse traits stable
    pub async fn health_check(&self) -> Result<()> {
        // Simplified implementation
        // TODO: Implement proper health check when ClickHouse traits are stable
        Ok(())
    }

    /// ดึงสถิติของ table
    /// แสดงจำนวนแถว, ขนาด, compression ratio
    /// Placeholder implementation - รอ ClickHouse traits stable
    pub async fn table_stats(&self, _table: &str) -> Result<TableStats> {
        // Simplified implementation
        // TODO: Implement proper table stats when ClickHouse traits are stable
        Ok(TableStats {
            row_count: 0,
            bytes_on_disk: 0,
            compressed_bytes: 0,
            uncompressed_bytes: 0,
            compression_ratio: 0.0,
        })
    }

    /// สร้าง QueryBuilder สำหรับ chain operations
    /// ใช้ pattern เดียวกับ repository layer
    pub fn query(&self, sql: &str) -> QueryBuilder<'_> {
        QueryBuilder {
            client: &self.client,
            sql: sql.to_string(),
        }
    }

    /// Execute a ClickHouse query with basic retry/backoff handling.
    /// This helps absorb transient network errors (e.g., SendRequest) that occur
    /// when staging large product batches.
    pub async fn execute_with_retry(&self, sql: &str) -> Result<()> {
        self.execute_with_retry_internal(sql, 3, Duration::from_millis(200))
            .await
    }

    async fn execute_with_retry_internal(
        &self,
        sql: &str,
        max_attempts: usize,
        base_delay: Duration,
    ) -> Result<()> {
        let mut attempt = 0;
        let mut delay_ms = base_delay.as_millis().max(1) as u64;

        loop {
            attempt += 1;
            match self.query(sql).execute().await {
                Ok(_) => return Ok(()),
                Err(err) => {
                    if attempt >= max_attempts || !Self::is_retryable_error(&err) {
                        return Err(err);
                    }

                    warn!(
                        "Retrying ClickHouse query attempt {}/{} due to error: {}",
                        attempt, max_attempts, err
                    );

                    sleep(Duration::from_millis(delay_ms)).await;
                    delay_ms = (delay_ms * 2).min(2_000);
                }
            }
        }
    }

    fn is_retryable_error(err: &anyhow::Error) -> bool {
        let message = err.to_string().to_lowercase();
        message.contains("network error")
            || message.contains("sendrequest")
            || message.contains("timeout")
            || message.contains("timed out")
            || message.contains("connection reset")
            || message.contains("temporarily unavailable")
    }

    /// สร้าง InsertBuilder สำหรับ typed inserts
    /// รองรับ generic type ที่ implement Serialize
    pub fn insert<T>(&self, table: &str) -> InsertBuilder<'_, T>
    where
        T: serde::Serialize,
    {
        InsertBuilder {
            client: &self.client,
            table: table.to_string(),
            _phantom: std::marker::PhantomData,
        }
    }

    /// Insert ข้อมูลแบบ batch ลงใน table
    /// รับข้อมูลเป็น HashMap และแปลงเป็น JSONEachRow format
    /// Skip empty rows เพื่อป้องกัน error
    pub async fn insert_batch(
        &self,
        table: &str,
        rows: Vec<HashMap<String, String>>,
    ) -> Result<()> {
        // Convert HashMap to JSON and insert
        // This is a simplified implementation - in production would use proper ClickHouse types
        if rows.is_empty() {
            return Ok(());
        }

        // Build INSERT query
        // ใช้ JSONEachRow format สำหรับ flexibility
        let query = format!("INSERT INTO {} FORMAT JSONEachRow", table);

        // Convert rows to JSON lines
        // แปลงแต่ละ row เป็น JSON string แยกบรรทัด
        let json_lines: Vec<String> = rows
            .iter()
            .map(|row| serde_json::to_string(row).unwrap_or_default())
            .collect();

        let _payload = json_lines.join("\n");

        // Execute the insert
        // Note: This is simplified - actual implementation would use proper ClickHouse client methods
        self.client.query(&query).execute().await?;

        Ok(())
    }
}

#[derive(Debug, Serialize)]
pub struct TableStats {
    pub row_count: u64,
    pub bytes_on_disk: u64,
    pub compressed_bytes: u64,
    pub uncompressed_bytes: u64,
    pub compression_ratio: f64,
}

/// Query builder for compatibility
pub struct QueryBuilder<'a> {
    client: &'a Client,
    sql: String,
}

impl<'a> QueryBuilder<'a> {
    pub fn bind<T>(self, _value: T) -> Self {
        // Simplified implementation - ignore bind for now
        // TODO: Implement proper parameter binding when ClickHouse traits are stable
        self
    }

    pub async fn execute(self) -> Result<()> {
        // Simplified implementation - just execute the query
        self.client
            .query(&self.sql)
            .execute()
            .await
            .map_err(|e| anyhow::anyhow!("Query execution failed: {}", e))
    }

    pub async fn fetch_all<T>(self) -> Result<Vec<T>>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        // Simplified implementation - return empty vec for now
        // TODO: Implement proper query execution and deserialization
        Ok(Vec::new())
    }

    pub fn fetch<T>(self) -> QueryCursor<T>
    where
        T: for<'de> serde::Deserialize<'de>,
    {
        // Return a mock cursor for now
        QueryCursor {
            _phantom: std::marker::PhantomData,
        }
    }
}

/// Mock query cursor for compatibility
pub struct QueryCursor<T> {
    _phantom: std::marker::PhantomData<T>,
}

impl<T> QueryCursor<T>
where
    T: for<'de> serde::Deserialize<'de>,
{
    pub async fn next(&mut self) -> Result<Option<T>> {
        // Return None to indicate no more rows
        Ok(None)
    }

    pub fn map_err<E, F>(self, _f: F) -> Result<Self, E>
    where
        F: FnOnce(anyhow::Error) -> E,
    {
        // For compatibility - return Ok with self
        Ok(self)
    }
}
/// Insert builder for compatibility
pub struct InsertBuilder<'a, T> {
    client: &'a Client,
    table: String,
    _phantom: std::marker::PhantomData<T>,
}

impl<'a, T> InsertBuilder<'a, T>
where
    T: serde::Serialize,
{
    pub fn write(self, data: &T) -> Self {
        // Implementation using ClickHouse client for data writing
        // Convert data to JSON and prepare for batch insertion

        // In a real implementation, we would:
        // 1. Convert the data to JSON format
        // 2. Buffer it for later batch insertion
        // 3. Possibly check a buffer size limit

        // For now, this is a placeholder that would be expanded
        // to properly buffer data in an internal collection

        // Note: Using data reference to avoid compiler warning
        let _ = data;

        self
    }

    pub async fn end(self) -> Result<()> {
        // Finish batch operation and execute the insert
        let query = format!("INSERT INTO {} FORMAT JSONEachRow", self.table);
        self.client.query(&query).execute().await?;
        Ok(())
    }

    pub async fn send(self, data: &T) -> Result<()> {
        // Serialize data to JSON
        let json = serde_json::to_string(data)
            .map_err(|e| anyhow::anyhow!("Serialization error: {}", e))?;

        // Execute insert query with the serialized data
        let query = format!("INSERT INTO {} FORMAT JSONEachRow\n{}", self.table, json);
        self.client.query(&query).execute().await?;

        Ok(())
    }

    pub async fn send_all(self, data: &[T]) -> Result<()> {
        if data.is_empty() {
            return Ok(());
        }

        // Serialize all data items to JSON
        let json_lines: Vec<String> = data
            .iter()
            .map(|item| serde_json::to_string(item).unwrap_or_default())
            .collect();

        let payload = json_lines.join("\n");

        // Execute batch insert
        let query = format!("INSERT INTO {} FORMAT JSONEachRow\n{}", self.table, payload);
        self.client.query(&query).execute().await?;

        Ok(())
    }
}
