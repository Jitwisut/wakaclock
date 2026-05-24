//! Webhook Model
//! โมเดลสำหรับจัดการระบบ webhook และการเชื่อมต่อกับระบบภายนอก
//!
//! ใช้สำหรับการส่งข้อมูลไปยังปลายทางภายนอกผ่าน HTTP callbacks
//! รองรับการกำหนดค่า headers และการจัดการ JSON paths

use std::collections::HashMap;

/// โครงสร้างข้อมูลสำหรับ endpoint ปลายทาง
/// ประกอบด้วย URL และ headers ที่จำเป็น
/// @Description webhook config สำหรับใช้งาน mode X-Queue : true
#[allow(dead_code)]
struct Endpoint {
    /// URL ปลายทางสำหรับส่ง webhook
    url: String,
    /// HTTP headers ที่จะส่งไปพร้อมกับ request
    header: HashMap<String, String>,
}

/// Client สำหรับจัดการการส่ง webhook
/// ใช้สำหรับการส่งข้อมูลไปยัง endpoint ที่กำหนด
#[allow(dead_code)]
pub struct WebhookClient {
    /// ข้อมูล endpoint ปลายทาง
    endpoint: Endpoint,
}

/// โครงสร้างสำหรับ webhook ของระบบภายนอก
/// ใช้สำหรับกำหนด path ของ JSON reference
pub struct Webhook3rd {
    /// path ของ JSON reference สำหรับการอ้างอิง
    /// ใช้สำหรับการติดตาม webhook events
    pub json_ref_path: String,
}
