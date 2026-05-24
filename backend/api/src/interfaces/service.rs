/// Service Interface - อินเทอร์เฟซสำหรับ Business Logic Services
///
/// โมดูลนี้กำหนด interface patterns สำหรับ service layer ในระบบ
/// รวมถึง health checking, metrics collection, และ event-driven capabilities
/// ใช้สำหรับสร้าง unified contract สำหรับ services ทั้งหมดในระบบ
///
/// # Architecture
/// - Service trait สำหรับ base service functionality
/// - EventDrivenService trait สำหรับ event publishing/subscribing
/// - Health monitoring และ metrics collection
/// - Graceful initialization และ shutdown patterns
///
/// # Usage
/// ```rust
/// impl Service for MyService {
///     fn name(&self) -> &str { "my_service" }
///     async fn health_check(&self) -> InterfaceResult<ServiceHealth> { ... }
/// }
/// ```
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use super::InterfaceResult;

/// Service interface สำหรับ business logic services
///
/// Interface หลักสำหรับกำหนด contract ของ services ทั้งหมดในระบบ
/// รองรับ health checking, metrics collection, lifecycle management
/// และการทำงานแบบ asynchronous
#[async_trait]
pub trait Service: Send + Sync {
    /// ดึงชื่อ service
    ///
    /// คืนค่าชื่อที่ใช้ระบุ service สำหรับ logging และ monitoring
    fn name(&self) -> &str;

    /// ตรวจสอบสถานะสุขภาพของ service
    ///
    /// ทำการ health check และคืนค่าสถานะปัจจุบันของ service
    /// ใช้สำหรับ monitoring และ load balancer decisions
    async fn health_check(&self) -> InterfaceResult<ServiceHealth>;

    /// ดึงข้อมูล metrics ของ service
    ///
    /// คืนค่าสถิติการทำงาน เช่น request count, response time, success rate
    /// สำหรับการ monitoring และ performance analysis
    async fn metrics(&self) -> InterfaceResult<ServiceMetrics>;

    /// เริ่มต้น service
    ///
    /// ดำเนินการ initialization ที่จำเป็น เช่น database connection,
    /// external service setup, resource allocation
    async fn initialize(&self) -> InterfaceResult<()>;

    /// ปิด service อย่างปลอดภัย
    ///
    /// ดำเนินการ graceful shutdown รวมถึง cleanup resources,
    /// finish ongoing operations, save state
    async fn shutdown(&self) -> InterfaceResult<()>;
}

/// สถานะสุขภาพของ service
///
/// ประกอบด้วยสถานะ, ข้อความอธิบาย, และรายละเอียดเพิ่มเติม
/// ใช้สำหรับ health check endpoints และ monitoring systems
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceHealth {
    /// สถานะสุขภาพปัจจุบัน
    pub status: HealthStatus,
    /// ข้อความอธิบายเพิ่มเติม
    pub message: Option<String>,
    /// รายละเอียดสถานะแยกตาม component
    pub details: std::collections::HashMap<String, serde_json::Value>,
}

/// สถานะสุขภาพที่เป็นไปได้
///
/// - Healthy: ทำงานได้ปกติ
/// - Degraded: ทำงานได้บางส่วน มีปัญหาไม่รุนแรง
/// - Unhealthy: ไม่สามารถทำงานได้
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HealthStatus {
    /// ทำงานได้ปกติทุกอย่าง
    Healthy,
    /// ทำงานได้แต่มีปัญหาบางอย่าง
    Degraded,
    /// ไม่สามารถทำงานได้
    Unhealthy,
}

/// เมตริกส์การทำงานของ service
///
/// รวบรวมสถิติการทำงานสำหรับการ monitoring และ performance analysis
/// ใช้สำหรับการตัดสินใจด้าน scaling และ optimization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceMetrics {
    /// จำนวน request ทั้งหมด
    pub requests_total: u64,
    /// จำนวน request ที่สำเร็จ
    pub requests_success: u64,
    /// จำนวน request ที่ล้มเหลว
    pub requests_failed: u64,
    /// เวลาตอบสนองเฉลี่ย (มิลลิวินาที)
    pub average_response_time_ms: f64,
    /// เวลาตอบสนอง percentile 95
    pub p95_response_time_ms: f64,
    /// เวลาตอบสนอง percentile 99
    pub p99_response_time_ms: f64,
}

/// Event-driven service interface - อินเทอร์เฟซสำหรับ service ที่ทำงานแบบ event-driven
///
/// ขยายจาก Service trait เพิ่มความสามารถในการ publish และ subscribe events
/// ใช้สำหรับการสื่อสารระหว่าง services แบบ asynchronous
/// รองรับ event sourcing และ CQRS patterns
#[async_trait]
pub trait EventDrivenService: Service {
    /// ส่ง event ไปยัง event bus
    ///
    /// เผยแพร่ event ให้ subscribers ที่สนใจได้รับและประมวลผล
    /// ใช้สำหรับการแจ้งเหตุการณ์ที่เกิดขึ้นใน service
    async fn publish_event(&self, event: ServiceEvent) -> InterfaceResult<()>;

    /// สมัครรับ events
    ///
    /// ลงทะเบียนเพื่อรับ events ของประเภทที่กำหนด
    /// และกำหนด handler function สำหรับประมวลผล event
    async fn subscribe_events<F>(&self, event_type: &str, handler: F) -> InterfaceResult<()>
    where
        F: Fn(ServiceEvent) -> InterfaceResult<()> + Send + Sync + 'static;
}

/// Service Event structure - โครงสร้างของ event ในระบบ
///
/// กำหนดรูปแบบมาตรฐานสำหรับ events ที่ส่งผ่านระหว่าง services
/// รวมถึง metadata สำหรับ tracing และ debugging
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceEvent {
    /// ID เฉพาะของ event
    pub id: String,
    /// ประเภทของ event
    pub event_type: String,
    /// แหล่งที่มาของ event
    pub source: String,
    /// เวลาที่ event เกิดขึ้น
    pub timestamp: chrono::DateTime<chrono::Utc>,
    /// ข้อมูล payload ของ event
    pub data: serde_json::Value,
    /// metadata เพิ่มเติมสำหรับ tracing
    pub metadata: std::collections::HashMap<String, String>,
}

impl ServiceEvent {
    pub fn new(event_type: String, source: String, data: serde_json::Value) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            event_type,
            source,
            timestamp: chrono::Utc::now(),
            data,
            metadata: std::collections::HashMap::new(),
        }
    }
}
