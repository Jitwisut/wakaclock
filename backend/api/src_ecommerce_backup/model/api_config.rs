//! API Configuration Model
//! โมเดลสำหรับการจัดการ API configuration และ handler settings
//!
//! ใช้สำหรับการกำหนดค่า API providers, URLs, TLS และการจัดเก็บข้อมูล
//! รองรับการตั้งค่า multiple environments และ API versions

use std::collections::HashMap;

/// โครงสร้างข้อมูลสำหรับการกำหนดค่า API handler
/// ประกอบด้วยข้อมูลที่จำเป็นสำหรับการเชื่อมต่อกับ external APIs
#[derive(Debug, Clone)]
pub struct HandlerConfig {
    /// ชื่อ provider หรือแพลตฟอร์ม
    /// เช่น "tiktok", "lazada", "shopee" เป็นต้น
    pub provider: String,

    /// ข้อมูล base URLs ของ third-party APIs
    /// มีค่าเมื่อต้องการใช้ multiple environments
    pub base_url_3rd: Option<BaseURL3rd>,

    /// HTTP headers ที่จะส่งไปกับทุก request
    /// ใช้สำหรับ authentication headers, API keys เป็นต้น
    pub header_key_values: Option<HashMap<String, String>>,

    /// ข้อมูลการตั้งค่า TLS/SSL
    /// ใช้สำหรับการเชื่อมต่อแบบปลอดภัย
    pub tls_config: Option<TlsConfig>,

    /// ข้อมูลการจัดเก็บข้อมูล
    /// ใช้สำหรับการกำหนด table names และ file paths
    pub stored: Option<Stored>,

    /// ชื่อ database provider
    /// เช่น "clickhouse", "postgres" เป็นต้น
    pub provider_database: String,
}

/// โครงสร้างข้อมูลสำหรับ base URLs ของ third-party services
/// ใช้สำหรับการจัดการ multiple environments
#[derive(Debug, Clone)]
pub struct BaseURL3rd {
    /// URL สำหรับ production environment
    /// ใช้ในระบบ production ที่มีความเสถียร
    pub stable: String,

    /// URL สำหรับ beta/testing environment
    /// ใช้สำหรับการทดสอบ features ใหม่
    pub beta: String,

    /// URL สำหรับ legacy/old API version
    /// ใช้สำหรับ backward compatibility
    pub old_version: String,
}

/// โครงสร้างข้อมูลสำหรับการจัดเก็บข้อมูล
/// ใช้สำหรับการกำหนด prefixes สำหรับ tables และ file paths
#[derive(Debug, Clone)]
pub struct Stored {
    /// prefix สำหรับ table names
    /// ใช้เพื่อจัดกลุ่ม tables ตาม environment หรือ provider
    pub table_name_prefix: String,

    /// prefix สำหรับ upload file paths
    /// ใช้เพื่อจัดการ file organization และป้องกัน collision
    pub upload_path_prefix: String,
}

/// โครงสร้างข้อมูลสำหรับ TLS/SSL configuration
/// ใช้สำหรับการตั้งค่าความปลอดภัยในการเชื่อมต่อ HTTPS
#[derive(Debug, Clone)]
pub struct TlsConfig {
    /// ข้ามการตรวจสอบ SSL certificate
    /// true = ไม่ตรวจสอบ (insecure), false = ตรวจสอบตามปกติ
    // TLS configuration fields would go here
    // This is a simplified representation since Rust has its own TLS libraries
    pub insecure_skip_verify: bool,

    /// TLS version ต่ำสุดที่รับ
    /// เช่น "1.2", "1.3" เป็นต้น
    pub min_version: Option<String>,

    /// Client certificates สำหรับ mutual TLS
    /// เก็บ certificate data เป็น binary format
    pub certificates: Vec<Vec<u8>>,
}
