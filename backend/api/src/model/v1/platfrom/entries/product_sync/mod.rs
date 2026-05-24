/// โมดูลสำหรับ entries ของ product sync
///
/// โมดูลนี้จัดการโครงสร้างข้อมูลที่ใช้ในการซิงโครไนซ์ผลิตภัณฑ์
/// ระหว่างแพลตฟอร์มอีคอมเมิร์ซต่างๆ
pub mod messages;
pub mod schema;

pub use messages::*;
pub use schema::*;
