/// Audit Platform Handlers Module - โมดูลตัวจัดการ Audit และ Compliance
///
/// จัดการ API endpoints สำหรับการติดตาม บันทึก และรายงานกิจกรรม
/// ของระบบเพื่อความปลอดภัยและการปฏิบัติตามกฎระเบียบ
///
/// # Modules
/// - `handler` - AuditHandler หลักสำหรับ routing และการจัดการ audit requests
/// - `logs` - การจัดการและการค้นหา log entries
/// - `stat` - สถิติและการวิเคราะห์ข้อมูล audit
///
/// # Features
/// - Activity logging - บันทึกกิจกรรมของผู้ใช้และระบบ
/// - Compliance monitoring - การติดตามการปฏิบัติตามกฎระเบียบ
/// - Security tracking - ติดตามเหตุการณ์ด้านความปลอดภัย
/// - Report generation - การสร้างรายงานสำหรับผู้บริหาร
/// - Integration กับ Quickwit สำหรับ search และ analytics
///
/// # Usage
/// ```rust
/// let audit_handler = AuditHandler::new(app_state);
/// let router = audit_handler.build();
/// ```
pub mod handler;
pub mod logs;
pub mod stat;

pub use handler::AuditHandler;
