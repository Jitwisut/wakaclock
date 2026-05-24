//! Credential Model
//! โมเดลสำหรับจัดการข้อมูล credential ของแอปพลิเคชัน
//!
//! ใช้สำหรับเก็บข้อมูลการยืนยันตัวตนของแอปพลิเคชัน
//! รวมถึงการเชื่อมต่อกับระบบภายนอก

use serde::{Deserialize, Serialize};

/// โครงสร้างข้อมูลสำหรับ credential ของแอปพลิเคชัน
/// ใช้สำหรับการยืนยันตัวตนและการเชื่อมต่อกับแพลตฟอร์มต่างๆ
#[derive(Debug, Serialize, Deserialize)]
pub struct Credential {
    /// ชื่อแอปพลิเคชัน
    /// ใช้สำหรับระบุแอปพลิเคชันที่ต้องการเข้าถึง
    #[serde(rename = "app_name")]
    pub app_name: String,

    /// รหัส 3 ตัวอักษรของแอปพลิเคชัน
    /// ใช้สำหรับการระบุแอปพลิเคชันแบบสั้น
    #[serde(rename = "app_code_3")]
    pub app_code_3: String,
}
