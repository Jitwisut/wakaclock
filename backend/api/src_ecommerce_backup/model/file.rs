//! File Model
//! โมเดลสำหรับจัดการไฟล์ และการอัปโหลดไฟล์
//!
//! ใช้สำหรับการจัดการ file types, file content และ file metadata
//! รวมถึงการรองรับ multiple file formats (binary, URL, base64)
//! รองรับ type-safe file handling และ validation

/// ประเภทของไฟล์ที่ระบบรองรับ
/// ใช้สำหรับการระบุรูปแบบของไฟล์ input
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FileType {
    /// ไฟล์แบบ binary/raw bytes
    /// ใช้สำหรับ uploaded files หรือ local files
    File,
    /// ไฟล์จาก URL/remote location
    /// ใช้สำหรับ files จาก HTTP URLs
    URL,
    /// ไฟล์ที่ encode เป็น base64 string
    /// ใช้สำหรับ embedded files ใน JSON/API
    Base64,
}

impl FileType {
    /// แปลง FileType เป็น string representation
    /// ใช้สำหรับ serialization และ API responses
    pub fn as_str(&self) -> &'static str {
        match self {
            FileType::File => "file",
            FileType::URL => "url",
            FileType::Base64 => "base64",
        }
    }

    /// สร้าง FileType จาก string
    /// ใช้สำหรับ deserialization และ parsing user input
    pub fn from_string(s: &str) -> Option<Self> {
        match s {
            "file" => Some(FileType::File),
            "url" => Some(FileType::URL),
            "base64" => Some(FileType::Base64),
            _ => None,
        }
    }
}

/// โครงสร้างข้อมูลสำหรับ file content และ metadata
/// เก็บข้อมูลที่จำเป็นสำหรับการจัดการไฟล์ในระบบ
#[derive(Debug, Clone)]
pub struct FileContent {
    /// MIME type ของไฟล์
    /// เช่น "image/jpeg", "application/pdf" เป็นต้น
    pub content_type: String,
    /// นามสกุลไฟล์
    /// เช่น ".jpg", ".pdf", ".docx" เป็นต้น
    pub extension: String,
    /// ชื่อไฟล์เต็ม
    /// รวมนามสกุล เช่น "document.pdf"
    pub filename: String,
    /// ข้อมูลไฟล์เป็น bytes
    /// มีค่าเมื่อไฟล์ถูกโหลดเข้า memory แล้ว
    pub byte_container: Option<Vec<u8>>,
    /// ข้อมูลไฟล์ที่ encode เป็น base64
    /// ใช้สำหรับการส่งผ่าน JSON APIs
    pub base64: String,
    /// unique key สำหรับไฟล์
    /// ใช้ในการเก็บและอ้างอิงไฟล์
    pub key: String,
    /// ชื่อ field ใน form data
    /// ใช้ใน multipart form uploads
    pub field_name: String,
    /// UUID เฉพาะสำหรับไฟล์
    /// ใช้สำหรับ tracking และ logging
    pub uuid: String,
    /// flag บอกว่าเป็น file request
    /// true = มาจาก HTTP request, false = สร้างในระบบ
    pub is_file_request: bool,
}

impl Default for FileContent {
    fn default() -> Self {
        Self::new()
    }
}

impl FileContent {
    pub fn new() -> Self {
        FileContent {
            content_type: String::new(),
            extension: String::new(),
            filename: String::new(),
            byte_container: None,
            base64: String::new(),
            key: String::new(),
            field_name: String::new(),
            uuid: String::new(),
            is_file_request: false,
        }
    }
}
