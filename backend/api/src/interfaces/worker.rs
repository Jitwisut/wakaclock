// Worker Interface - อินเตอร์เฟสสำหรับ background job processing
// กำหนด traits สำหรับ Worker และ Job handlers
// รวมถึง job payload, result structures และ metrics

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;

use super::InterfaceResult;

/// Worker - อินเตอร์เฟสสำหรับ background job processing
/// ใช้ในการจัดการ background workers และ job handlers
#[async_trait]
pub trait Worker: Send + Sync {
    /// start - เริ่มต้น worker
    /// เริ่มการประมวลผล background jobs
    async fn start(&self) -> InterfaceResult<()>;

    /// stop - หยุด worker อย่างปลอดภัย
    /// รอให้ jobs ที่กำลังทำงานเสร็จก่อนหยุด
    async fn stop(&self) -> InterfaceResult<()>;

    /// register_job - ลงทะเบียน job handler
    /// เชื่อมโยง job type กับ handler สำหรับประมวลผล
    fn register_job(&mut self, job_type: &str, handler: Arc<dyn Job>);

    /// status - ดึงสถานะของ worker
    /// แสดงข้อมูล running status, active jobs, queued jobs
    async fn status(&self) -> InterfaceResult<WorkerStatus>;

    /// metrics - ดึงสถิติการทำงานของ worker
    /// รวมถึง performance metrics, processing times, success rates
    async fn metrics(&self) -> InterfaceResult<WorkerMetrics>;
}

/// Job - อินเตอร์เฟสสำหรับ individual job handlers
/// แต่ละ job type จะมี handler ที่ implement trait นี้
#[async_trait]
pub trait Job: Send + Sync {
    /// job_type - ดึง job type identifier
    /// คืนค่าชื่อที่ใช้ระบุ job type
    fn job_type(&self) -> &str;

    /// execute - รัน job ด้วย payload ที่กำหนด
    /// ประมวลผล job และคืนค่า result
    async fn execute(&self, payload: JobPayload) -> InterfaceResult<JobResult>;

    /// on_failure - จัดการเมื่อ job ล้มเหลว
    /// กำหนด default behavior สำหรับ error handling
    async fn on_failure(&self, _payload: JobPayload, error: String) -> InterfaceResult<()> {
        // Default implementation - log the error
        tracing::error!("Job {} failed: {}", self.job_type(), error);
        Ok(())
    }

    /// config - ดึงการตั้งค่าของ job
    /// กำหนด retry policy, timeout, priority
    fn config(&self) -> JobConfig {
        JobConfig::default()
    }
}

/// JobPayload - โครงสร้างข้อมูลสำหรับ job
/// บรรจุข้อมูลที่จำเป็นสำหรับการประมวลผล job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobPayload {
    pub id: String,
    pub job_type: String,
    pub data: serde_json::Value,
    pub metadata: std::collections::HashMap<String, String>,
    pub retry_count: u32,
    pub scheduled_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl JobPayload {
    /// new - สร้าง JobPayload ใหม่
    /// สร้าง payload ด้วย job_type และ data
    pub fn new(job_type: String, data: serde_json::Value) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            job_type,
            data,
            metadata: std::collections::HashMap::new(),
            retry_count: 0,
            scheduled_at: None,
        }
    }

    /// get_string - ดึงค่า string จาก data ตาม key
    /// คืนค่า string หากมี key และเป็น string type
    pub fn get_string(&self, key: &str) -> InterfaceResult<String> {
        self.data
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| super::InterfaceError::InvalidInput(format!("Missing key: {}", key)))
    }

    /// get_i64 - ดึงค่า integer จาก data ตาม key
    /// คืนค่า i64 หากมี key และเป็น integer type
    pub fn get_i64(&self, key: &str) -> InterfaceResult<i64> {
        self.data
            .get(key)
            .and_then(|v| v.as_i64())
            .ok_or_else(|| super::InterfaceError::InvalidInput(format!("Missing key: {}", key)))
    }
}

/// JobResult - ผลลัพธ์ของการประมวลผล job
/// บรรจุ status, message และ data ที่ได้จากการประมวลผล
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobResult {
    pub status: JobStatus,
    pub message: Option<String>,
    pub data: Option<serde_json::Value>,
}

/// JobStatus - สถานะของ job หลังการประมวลผล
/// กำหนดสถานะต่างๆ ของ job execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobStatus {
    Success,
    Failed,
    Retry,
    Cancelled,
}

/// JobConfig - การตั้งค่าสำหรับ job execution
/// กำหนด retry policy, timeout, priority ของ job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobConfig {
    pub max_retries: u32,
    pub retry_delay: Duration,
    pub timeout: Duration,
    pub priority: JobPriority,
}

impl Default for JobConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            retry_delay: Duration::from_secs(60),
            timeout: Duration::from_secs(300),
            priority: JobPriority::Normal,
        }
    }
}

/// JobPriority - ระดับความสำคัญของ job
/// ใช้ในการกำหนดลำดับการประมวลผล job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobPriority {
    Low,
    Normal,
    High,
    Critical,
}

/// WorkerStatus - สถานะปัจจุบันของ worker
/// แสดง running status, job counts และ timing information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerStatus {
    pub is_running: bool,
    pub active_jobs: u32,
    pub queued_jobs: u32,
    pub failed_jobs: u32,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// WorkerMetrics - เมตริกการทำงานของ worker
/// รวม performance metrics, processing times และ success rates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerMetrics {
    pub jobs_processed: u64,
    pub jobs_succeeded: u64,
    pub jobs_failed: u64,
    pub jobs_retried: u64,
    pub average_processing_time_ms: f64,
    pub p95_processing_time_ms: f64,
    pub p99_processing_time_ms: f64,
}
