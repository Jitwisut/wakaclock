//! # Platform Integration Module - โมดูลการเชื่อมต่อแพลตฟอร์ม
//!
//! โมดูลสำหรับจัดการการเชื่อมต่อและ OAuth flows กับแพลตฟอร์ม e-commerce แต่ละตัว
//! แยกการจัดการเป็นสองส่วนหลัก: การเริ่มต้นการเชื่อมต่อ และการรับ callback
//!
//! ## หน้าที่หลัก
//! - จัดการ OAuth connection initiation
//! - รับและประมวลผล OAuth callbacks
//! - ตรวจสอบและจัดเก็บ access tokens
//! - จัดการข้อผิดพลาดของ OAuth flows

pub mod callback;
pub mod connect;
pub mod handler;

pub use handler::PlatformHandler;
