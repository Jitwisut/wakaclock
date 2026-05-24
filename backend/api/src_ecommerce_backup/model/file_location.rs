//! File Location Model
//! โมเดลสำหรับจัดการข้อมูลตำแหน่งไฟล์ที่อัปโหลด
//!
//! ใช้สำหรับเก็บข้อมูลเกี่ยวกับไฟล์ที่อัปโหลดแล้ว
//! รวมถึงข้อมูล path, CDN URL และสถานะความเป็นส่วนตัว

use serde::{Deserialize, Serialize};

/// โครงสร้างข้อมูลสำหรับ response ของการอัปโหลดไฟล์
/// ใช้สำหรับเก็บข้อมูลตำแหน่งไฟล์หลังจากอัปโหลดสำเร็จ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadResponseLocation {
    /// คีย์เฉพาะสำหรับระบุไฟล์
    /// ใช้เป็น unique identifier สำหรับการอ้างอิง
    pub key: String,

    /// path แบบสัมพัทธ์ของไฟล์
    /// ใช้สำหรับการเก็บ path แบบไม่รวม domain
    pub relative_path: String,

    /// path เต็มของไฟล์
    /// รวม domain และ path สมบูรณ์
    #[serde(rename = "fullPath")]
    pub full_path: String,

    /// URL ของ CDN สำหรับเข้าถึงไฟล์
    /// ใช้สำหรับการแสดงผลหรือดาวน์โหลดไฟล์
    #[serde(rename = "cdnPath")]
    pub cdn_path: String,

    /// สถานะความเป็นส่วนตัวของไฟล์
    /// true = ไฟล์ส่วนตัว, false = ไฟล์สาธารณะ
    pub private: bool,
}

/// โครงสร้างข้อมูลสำหรับ platform-specific file location
/// ใช้สำหรับระบบแพลตฟอร์มต่างๆ ที่อาจมีโครงสร้างไฟล์แตกต่าง
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UploadResponseLocationPlatform {
    /// คีย์เฉพาะของไฟล์ในแพลตฟอร์ม
    pub key: String,

    /// path สัมพัทธ์สำหรับแพลตฟอร์ม
    pub relative_path: String,

    /// path เต็มสำหรับแพลตฟอร์ม (ไม่ใช้ serde rename)
    pub full_path: String,

    /// CDN path สำหรับแพลตฟอร์ม (ไม่ใช้ serde rename)
    pub cdn_path: String,

    /// สถานะความเป็นส่วนตัวในแพลตฟอร์ม
    pub private: bool,
}
