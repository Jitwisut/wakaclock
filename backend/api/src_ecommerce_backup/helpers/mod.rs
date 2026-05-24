//! # Helpers Module - โมดูล Helper Functions
//!
//! รวบรวม utility functions และ helper modules ที่ใช้ร่วมกันทั่วทั้งระบบ
//! รวมถึง data mapping, authentication utilities และ configuration helpers
//!
//! ## หน้าที่หลัก
//! - ให้บริการ utility functions ที่ใช้ซ้ำได้
//! - จัดการ data transformation และ mapping
//! - ช่วยเหลือในการจัดการ authentication และ configuration
//! - รองรับการแปลงข้อมูลระหว่างแพลตฟอร์มต่างๆ
//!
//! ## โครงสร้าง Modules
//! - `app_config` - Application configuration helpers
//! - `auth` - Authentication and cryptography utilities
//! - `mapping` - Platform-specific data mapping helpers

pub mod app_config;
pub mod auth;
pub mod mapping;
