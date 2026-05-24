//! Worker Model
//! โมเดลสำหรับจัดการข้อมูล background worker และ job queue
//!
//! ใช้สำหรับการจัดการและติดตาม background jobs
//! รวมถึงการ tracking และ monitoring

/// โครงสร้างข้อมูลสำหรับ tracking queue system
/// ใช้สำหรับการติดตามและจัดการ job queue ในระบบ
pub struct TrackingQueue {
    /// URL ของ queue endpoint สำหรับ tracking
    /// ใช้สำหรับการส่ง tracking data ไปยัง queue system
    pub url: String,
}
