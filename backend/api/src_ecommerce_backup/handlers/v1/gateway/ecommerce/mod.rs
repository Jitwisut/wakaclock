//! # E-commerce Integration Module - โมดูลการเชื่อมต่อ E-commerce
//!
//! โมดูลหลักสำหรับจัดการการเชื่อมต่อกับแพลตฟอร์ม e-commerce ต่างๆ
//! รวมถึงการจัดการ OAuth flows และการซิงค์ข้อมูลสินค้า
//!
//! ## หน้าที่หลัก
//! - จัดการการเชื่อมต่อแพลตฟอร์ม e-commerce ทั้งหมด
//! - ดำเนินการ OAuth authentication flows
//! - จัดการ callback handlers สำหรับแต่ละแพลตฟอร์ม
//! - ประสานงานการซิงค์ข้อมูลระหว่างแพลตฟอร์ม

pub mod handler;
pub mod platform;

pub use handler::EcommerceHandler;
