/// Audit Logs Handlers Module - โมดูลตัวจัดการ Audit Logs
///
/// จัดการการเข้าถึง ค้นหา และจัดการ audit logs ของระบบ
/// ให้ความสามารถในการติดตามกิจกรรมและการวิเคราะห์เพื่อ compliance
///
/// # Features
/// - การค้นหา audit logs ด้วย filters และ pagination
/// - การเข้าถึง log entries แบบ real-time
/// - Integration กับ Quickwit สำหรับ full-text search
/// - Export capabilities สำหรับ reporting และ analysis
/// - Multi-tenant log isolation - การแยก logs ตาม organization
///
/// # Usage
/// ```rust
/// let logs_handler = AuditLogsHandler::new(app_state);
/// let router = logs_handler.build();
/// ```
pub mod handler;

pub use handler::AuditLogsHandler;
