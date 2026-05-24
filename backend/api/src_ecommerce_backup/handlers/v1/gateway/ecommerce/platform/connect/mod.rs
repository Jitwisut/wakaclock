//! # OAuth Connect Module - โมดูล OAuth Connect
//!
//! โมดูลสำหรับเริ่มต้น OAuth connection flows กับแพลตฟอร์ม e-commerce
//! สร้าง authorization URLs และ redirect users ไปยัง OAuth providers
//!
//! ## หน้าที่หลัก
//! - เริ่มต้น OAuth authorization flows
//! - สร้าง OAuth state สำหรับ CSRF protection
//! - สร้าง authorization URLs สำหรับแต่ละแพลตฟอร์ม
//! - Redirect users ไปยัง OAuth providers

pub mod handler;

pub use handler::connect;
