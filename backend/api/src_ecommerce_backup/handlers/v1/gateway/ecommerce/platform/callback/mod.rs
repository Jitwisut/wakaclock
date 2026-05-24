//! # OAuth Callback Module - โมดูล OAuth Callback
//!
//! โมดูลสำหรับจัดการ OAuth callbacks จากแพลตฟอร์ม e-commerce ต่างๆ
//! รับและประมวลผล authorization codes เพื่อแลกเป็น access tokens
//!
//! ## หน้าที่หลัก
//! - รับ OAuth callback จากแพลตฟอร์มต่างๆ
//! - แลก authorization code เป็น access token
//! - จัดเก็บ credentials อย่างปลอดภัย
//! - Redirect user กลับไปยัง frontend พร้อมสถานะ

pub mod handler;

pub use handler::{
    bigcommerce_auth_get, bigcommerce_auth_post, callback, CallbackRequest, CallbackResponse,
};
