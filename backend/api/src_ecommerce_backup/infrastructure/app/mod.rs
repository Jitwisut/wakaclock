/// โมดูลแอพพลิเคชันคอนเทนเนอร์ - ใช้ในการจัดการ dependency injection และ lifecycle ของแอพ
///
/// โมดูลนี้เป็นหัวใจสำคัญของ Clean Architecture ที่จัดการ:
/// - การเชื่อมต่อและจัดการ dependencies ระหว่าง layers ต่างๆ
/// - การตรวจสอบสุขภาพของระบบ (health checks)
/// - การจัดการ lifecycle ของแอพพลิเคชัน
/// - การแบ่งแยกระหว่าง implementation จริงกับ stub สำหรับการพัฒนา

///   การติดตั้งและกำหนดค่าแอพพลิเคชันแบบเต็ม (สำหรับใช้งานจริงเมื่อ components ทั้งหมดพร้อม)
pub mod init;

/// การติดตั้งแบบ stub สำหรับ components ที่ยังไม่พร้อม (ใช้ในการพัฒนา)
pub mod stubs;

/// Application container for dependency injection
pub mod container;

/// Service providers for dependency injection
pub mod providers;

pub use container::{new_app_container, AppContainer};
/// ส่งออกฟังก์ชันและ struct หลักสำหรับการใช้งาน
///
/// # ตัวอย่างการใช้งาน
/// ```rust
/// let app = new_app().await?;
/// let health = app.health().await;
/// ```
pub use init::{new_app, App, AppHealth, AppMetadata, ComponentHealth, HealthStatus};
