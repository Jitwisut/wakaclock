//! File Type Detection Model
//! โมเดลสำหรับการตรวจสอบและระบุประเภทไฟล์
//!
//! ใช้ร่วมกับ Magika library สำหรับการวิเคราะห์
//! และจำแนกประเภทไฟล์โดยใช้ AI

use serde::{Deserialize, Serialize};

/// Response structure จาก Magika API สำหรับการตรวจสอบประเภทไฟล์
/// ประกอบด้วยข้อมูลจากการวิเคราะห์และผลลัพธ์ของการตรวจสอบ
#[derive(Debug, Serialize, Deserialize)]
pub struct MagikaResp {
    /// ผลการตรวจสอบจาก deep learning model
    /// ใช้สำหรับการวิเคราะห์แบบเจาะลงด้วย AI
    #[serde(rename = "dl")]
    pub dl: FileTypeInfo,

    /// ผลการตรวจสอบขั้นสุดท้าย
    /// ผลรวมจากทั้ง deep learning และ traditional methods
    #[serde(rename = "output")]
    pub output: FileTypeInfo,

    /// path ของไฟล์ที่ถูกตรวจสอบ
    /// ใช้สำหรับระบุตำแหน่งไฟล์ที่ถูกวิเคราะห์
    #[serde(rename = "path")]
    pub path: String,
}

/// ข้อมูลรายละเอียดเกี่ยวกับประเภทไฟล์
/// รวมคะแนนความเชื่อมั่น, MIME type และ metadata ต่างๆ
#[derive(Debug, Serialize, Deserialize)]
pub struct FileTypeInfo {
    /// label ของประเภทไฟล์
    /// เช่น "pdf", "jpg", "docx" เป็นต้น
    #[serde(rename = "ct_label")]
    pub ct_label: String,

    /// คำอธิบายของประเภทไฟล์
    /// ให้คำอธิบายที่เข้าใจได้เกี่ยวกับประเภทไฟล์
    #[serde(rename = "description")]
    pub description: String,

    /// กลุ่มหรือหมวดหมู่ของประเภทไฟล์
    /// เช่น "document", "image", "video" เป็นต้น
    #[serde(rename = "group")]
    pub group: String,

    /// magic bytes หรือ signature ของไฟล์
    /// ใช้สำหรับการระบุประเภทไฟล์โดยดูจาก bytes ต้นไฟล์
    #[serde(rename = "magic")]
    pub magic: String,

    /// MIME type ของไฟล์
    /// เช่น "application/pdf", "image/jpeg" เป็นต้น
    #[serde(rename = "mime_type")]
    pub mime_type: String,

    /// คะแนนความเชื่อมั่นของการตรวจสอบ
    /// ค่าอยู่ระหว่าง 0.0 - 1.0 โดย 1.0 = มั่นใจ 100%
    #[serde(rename = "score")]
    pub score: f32,
}
