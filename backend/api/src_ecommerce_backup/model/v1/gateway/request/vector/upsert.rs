//! โมดูลการจัดการ Vector Upsert Request (Vector Upsert Request Module)
//!
//! ไฟล์นี้ประกอบด้วยโครงสร้างและฟังก์ชันสำหรับการ Upsert
//! (บันทึกหรืออัพเดต) ข้อมูลเวกเตอร์สินค้าลงในฐานข้อมูลเวกเตอร์
//!
//! ## คำอธิบาย
//! Request นี้ใช้สำหรับส่งข้อมูลเวกเตอร์ของสินค้าไปยังระบบ Vector Database
//! เพื่อให้สามารถค้นหาและเปรียบเทียบสินค้าได้
//!
//! ## การใช้งาน
//! - บันทึกเวกเตอร์ใหม่ลงในฐานข้อมูล
//! - อัพเดตเวกเตอร์ที่มีอยู่แล้ว
//!
//! ## ไดเรกทอรี
//! `src/model/v1/gateway/request/vector/`

use serde::Deserialize;
use utoipa::ToSchema;

/// โครงสร้างคำขอ Upsert เวกเตอร์ (Vector Upsert Request)
///
/// ใช้สำหรับส่งข้อมูลเวกเตอร์ของสินค้าไปยัง Vector Database
/// เพื่อบันทึกหรืออัพเดตข้อมูล
#[derive(Debug, Deserialize, ToSchema)]
pub struct UpsertRequest {
    /// ชื่อแพลตฟอร์ม (เช่น "shopify", "lazada")
    pub platform: String,
    /// ID ของร้านค้า
    pub shop_id: String,
    /// ID ของสินค้า
    pub product_id: String,
    /// เวกเตอร์ของสินค้า (array ของ floating point numbers)
    pub vector: Vec<f32>,
    /// Metadata เพิ่มเติมของสินค้า
    pub metadata: serde_json::Value,
}
