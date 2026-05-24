//! # Products Management Module - โมดูลจัดการสินค้า
//!
//! โมดูลสำหรับจัดการข้อมูลสินค้าข้ามแพลตฟอร์ม e-commerce ต่างๆ
//! รวมถึงการซิงค์ข้อมูลและการจัดหมวดหมู่สินค้า
//!
//! ## หน้าที่หลัก
//! - จัดการ CRUD operations สำหรับสินค้า
//! - ให้บริการ listing และ search สินค้า
//! - จัดการหมวดหมู่สินค้า (categories)
//! - ดึงข้อมูลรายละเอียดสินค้าแบบครบถ้วน

pub mod handler;
pub mod merchant;

pub use handler::{routes, ProductsHandler};
