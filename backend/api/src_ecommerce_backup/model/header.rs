//! Header Configuration Model
//! โมเดลสำหรับจัดการข้อมูล HTTP headers และการกำหนดค่า
//!
//! ใช้สำหรับการจัดการคำขอ HTTP request headers
//! รวมถึงการกำหนด flags ต่างๆ สำหรับพฤติกรรมของระบบ

use serde::{Deserialize, Serialize};

/// โครงสร้างข้อมูลสำหรับการกำหนดค่า HTTP headers
/// ประกอบด้วยข้อมูลสำหรับควบคุมพฤติกรรมระบบ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeadersConfig {
    /// ชื่อแอปพลิเคชัน
    /// ใช้สำหรับระบุและติดตามแอปพลิเคชัน
    #[serde(rename = "app_name")]
    pub app_name: String,

    /// ID ของ token สำหรับการยืนยันตัวตน
    /// ใช้เป็น unique identifier สำหรับ session
    #[serde(rename = "token_id")]
    pub token_id: String,

    /// flag สำหรับการบันทึก log
    /// true = บันทึก log, false = ไม่บันทึก log
    #[serde(rename = "is_save_log")]
    pub is_save_log: bool,

    /// flag สำหรับการใช้ระบบ queue
    /// true = ใช้ message queue, false = ประมวลผลโดยตรง
    #[serde(rename = "is_queue")]
    pub is_queue: bool,

    /// flag สำหรับการรัน background worker
    /// true = รันใน background, false = รันแบบ sync
    #[serde(rename = "is_worker_run")]
    pub is_worker_run: bool,

    /// flag สำหรับการรันบน cloud environment
    /// true = รันบน cloud, false = รัน local
    #[serde(rename = "is_cloud_run")]
    pub is_cloudrun: bool,

    /// flag สำหรับการส่ง webhook กลับไปยัง client
    /// true = ส่ง webhook, false = ไม่ส่ง webhook
    #[serde(rename = "is_send_webhook_to_client")]
    pub is_send_webhook_to_client: bool,

    /// flag สำหรับการอัปโหลดไฟล์จาก request
    /// true = อัปโหลดไฟล์, false = ไม่อัปโหลดไฟล์
    #[serde(rename = "is_upload_request_files")]
    pub is_upload_request_files: bool,

    /// UUID เฉพาะสำหรับ request
    /// ใช้สำหรับการ trace และ debug request
    #[serde(rename = "uuid")]
    pub uuid: String,

    /// cURL command string ของ request
    /// ใช้สำหรับ debug และจำลอง request
    #[serde(rename = "curl")]
    pub curl: String,

    /// ข้อมูลการตั้งค่า webhook client
    /// มีค่าเมื่อต้องการส่ง webhook กลับไปยัง client
    #[serde(rename = "webhook_client")]
    pub webhook_client: Option<WebhookClient>,

    /// ข้อมูลการตั้งค่า webhook ของระบบภายนอก
    /// มีค่าเมื่อต้องการรับ webhook จาก third party
    #[serde(rename = "webhook_3rd")]
    pub webhook_3rd: Option<Webhook3rd>,

    /// Reference field สำหรับการติดตาม
    /// ใช้เป็น correlation ID สำหรับการติดตามข้าม services
    #[serde(rename = "ref")]
    pub ref_field: String,
}

/// โครงสร้างข้อมูลสำหรับ webhook client configuration
/// ใช้สำหรับการกำหนดค่า webhook ที่ส่งไปยัง client
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookClient {
    // TODO: กำหนด fields ตามความต้องการ
    // เช่น URL, headers, authentication เป็นต้น
}

/// โครงสร้างข้อมูลสำหรับ third-party webhook configuration
/// ใช้สำหรับการกำหนดค่า webhook ที่รับจาก third party
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Webhook3rd {
    // TODO: กำหนด fields ตามความต้องการ
    // เช่น callback URLs, event types เป็นต้น
}
