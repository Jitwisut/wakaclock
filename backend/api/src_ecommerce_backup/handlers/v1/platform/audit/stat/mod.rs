/// Audit Statistics Handlers Module - โมดูลตัวจัดการสถิติ Audit
///
/// จัดการการสร้างและเข้าถึงสถิติของ audit logs และกิจกรรมต่างๆ
/// เพื่อให้ข้อมูลเชิงลึกสำหรับการตัดสินใจและการวิเคราะห์
///
/// # Features
/// - Activity statistics - สถิติการใช้งานและกิจกรรม
/// - Time-based analytics - การวิเคราะห์ตามช่วงเวลา (daily, weekly, monthly)
/// - User behavior insights - ข้อมูลเชิงลึกพฤติกรรมของผู้ใช้
/// - Compliance metrics - เมตริกส์สำหรับการปฏิบัติตามกฎระเบียบ
/// - Security event aggregation - การรวมและวิเคราะห์เหตุการณ์ด้านความปลอดภัย
///
/// # Data Sources
/// - ClickHouse สำหรับ analytical queries
/// - Quickwit สำหรับ log aggregation
/// - Redis สำหรับ caching และ performance optimization
///
/// # Usage
/// ```rust
/// let stats_handler = AuditStatsHandler::new(app_state);
/// let router = stats_handler.build();
/// ```
pub mod handler;

pub use handler::AuditStatsHandler;
