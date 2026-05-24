//! โมดูลการจัดการ Query ใน Request (Query Request Module)
//!
//! ไฟล์นี้รวบรวมและส่งออก Query ต่างๆ ที่ใช้ในการค้นหาและดึงข้อมูล
//! จากระบบโดยไม่มีการเปลี่ยนแปลงสถานะของข้อมูล
//!
//! ## โมดูลย่อย
//! - `connect`: Query สำหรับการเชื่อมต่อแพลตฟอร์ม
//! - `product_queries`: Query สำหรับข้อมูลสินค้า
//!
//! ## หลักการ CQRS
//! Query คือการดำเนินการที่ไม่มีการเปลี่ยนแปลงสถานะ (อ่านอย่างเดียว)
//! แยกจาก Command ที่ใช้สำหรับการเปลี่ยนแปลงข้อมูล
//!
//! ## ไดเรกทอรี
//! `src/model/v1/gateway/request/queries/`

// Query handlers will be implemented here
// Queries represent read operations that don't change state

pub mod connect;
pub mod product_queries;

pub use connect::*;
pub use product_queries::*;
