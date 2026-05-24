//! โมดูลการตอบสนองสำหรับ Gateway (Gateway Response Module)
//!
//! ไฟล์นี้ประกอบด้วยโครงสร้างข้อมูลสำหรับการตอบสนองต่างๆ ในระบบ Gateway
//! รวมถึงการเชื่อมต่อแพลตฟอร์ม, การจัดการ Token, และสถานะระบบ
//!
//! ## ฟีเจอร์หลัก (Main Features)
//! - การตอบสนองการเชื่อมต่อแพลตฟอร์ม (Platform Connection Response)
//! - การจัดการ Token และการ Authentication
//! - การแสดงสถานะและข้อผิดพลาด
//! - การรองรับ OAuth และ API Key Authentication
//!
//! ## ไดเรกทอรี
//! `src/model/v1/gateway/response/gateway/`

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// โครงสร้างการตอบสนองสำหรับการเชื่อมต่อแพลตฟอร์ม (Platform Connection Response)
///
/// ใช้สำหรับส่งข้อมูลการเชื่อมต่อกลับไปยัง Client รวมถึง OAuth URL และสถานะต่างๆ
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ConnectResponse {
    /// URL สำหรับ OAuth Authorization (สำหรับแพลตฟอร์มที่ใช้ OAuth)
    pub oauth_url: Option<String>,
    /// ชื่อแพลตฟอร์ม (เช่น "shopify", "lazada")
    pub platform: String,
    /// ประเภทการยืนยันตัวตน ("oauth", "api_key", "credentials")
    pub auth_type: String,
    /// สถานะการเชื่อมต่อ (สำหรับแพลตฟอร์ม API Key)
    pub connected: Option<bool>,
    /// State parameter สำหรับ OAuth flow
    pub state: Option<String>,
    /// วันที่หมดอายุของ Token
    pub expires_at: Option<DateTime<Utc>>,
    /// คำแนะนำสำหรับผู้ใช้
    pub instructions: Option<String>,
    /// ฟิลด์ที่จำเป็นต้องกรอก
    pub required_fields: Option<Vec<String>>,
    /// Endpoint สำหรับส่ง Credentials
    pub credentials_endpoint: Option<String>,
    /// สถานะการเก็บ Credentials
    pub credentials_stored: Option<bool>,
    /// วันที่ Sync ล่าสุด
    pub last_sync: Option<DateTime<Utc>>,
}

/// โครงสร้างการตอบสนองสำหรับ OAuth Callback (OAuth Callback Response)
///
/// ใช้สำหรับส่งผลลัพธ์การรับ OAuth Authorization Code กลับมาจากแพลตฟอร์ม
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallbackResponse {
    /// สถานะความสำเร็จ
    pub success: bool,
    /// ชื่อแพลตฟอร์ม
    pub platform: String,
    /// ID ของร้านค้า (ถ้ามี)
    pub shop_id: Option<String>,
    /// ข้อความเพิ่มเติม
    pub message: Option<String>,
    /// Access Token ที่ได้รับ
    pub access_token: Option<String>,
    /// Refresh Token ที่ได้รับ
    pub refresh_token: Option<String>,
    /// อายุของ Token (วินาที)
    pub expires_in: Option<i64>,
}

/// โครงสร้างการตอบสนองสำหรับการอัพเดต Token (Token Refresh Response)
///
/// ใช้สำหรับส่ง Token ใหม่หลังจาก Refresh Token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenRefreshResponse {
    /// Access Token ใหม่
    pub access_token: String,
    /// Refresh Token ใหม่ (ถ้ามี)
    pub refresh_token: Option<String>,
    /// วันที่หมดอายุของ Token
    pub expires_at: Option<DateTime<Utc>>,
}

/// โครงสร้างการตอบสนองสำหรับการตรวจสอบ Token (Token Validation Response)
///
/// ใช้สำหรับแสดงผลการตรวจสอบความถูกต้องและสิทธิ์ของ Token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenValidateResponse {
    /// สถานะความถูกต้องของ Token
    pub valid: bool,
    /// วันที่หมดอายุ (ถ้ามี)
    pub expires_at: Option<DateTime<Utc>>,
    /// Scopes ที่ Token มีสิทธิ์ในการเข้าถึง
    pub scopes: Vec<String>,
}

/// โครงสร้างสถานะแพลตฟอร์ม (Platform Status)
///
/// ใช้สำหรับแสดงสถานะการเชื่อมต่อและการซิงค์ข้อมูลของแพลตฟอร์ม
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformStatus {
    /// ชื่อแพลตฟอร์ม
    pub platform: String,
    /// สถานะการเชื่อมต่อ
    pub connected: bool,
    /// วันที่ซิงค์ล่าสุด
    pub last_sync: Option<DateTime<Utc>>,
    /// สถานะการเก็บ Credentials
    pub credentials_stored: bool,
}

/// โครงสร้างข้อผิดพลาดสำหรับ Gateway (Gateway Error Response)
///
/// ใช้สำหรับส่งข้อมูลข้อผิดพลาดที่เกิดขึ้นในระบบ Gateway
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayError {
    /// รหัสข้อผิดพลาด
    pub error: String,
    /// ข้อความข้อผิดพลาด
    pub message: String,
    /// รายละเอียดเพิ่มเติม (ถ้ามี)
    pub details: Option<serde_json::Value>,
    /// เวลาที่เกิดข้อผิดพลาด
    pub timestamp: DateTime<Utc>,
}

/// โครงสร้างการตอบสนองสำหรับการ Upsert เวกเตอร์ (Vector Upsert Response)
///
/// ใช้สำหรับส่งผลลัพธ์การบันทึกหรืออัพเดตเวกเตอร์ในฐานข้อมูล
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpsertResponse {
    /// สถานะความสำเร็จ
    pub success: bool,
    /// ข้อความผลลัพธ์
    pub message: String,
    /// ID ของเวกเตอร์ที่ถูกบันทึก (ถ้ามี)
    pub vector_id: Option<String>,
}

/// โครงสร้างเวกเตอร์สินค้า (Product Vector)
///
/// ใช้สำหรับเก็บและส่งข้อมูลเวกเตอร์ของสินค้า
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductVector {
    /// ID ของสินค้า
    pub product_id: String,
    /// ชื่อแพลตฟอร์ม
    pub platform: String,
    /// ID ของร้านค้า
    pub shop_id: String,
    /// เวกเตอร์ของสินค้า (array ของ floating point numbers)
    pub vector: Vec<f32>,
    /// Metadata เพิ่มเติมของสินค้า
    pub metadata: serde_json::Value,
}

/// โครงสร้างสถานะการซิงค์ (Sync Status)
///
/// ใช้สำหรับติดตามและแสดงความคืบหน้าของการซิงค์ข้อมูล
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    /// ID ของ Job การซิงค์ (ถ้ามี)
    pub job_id: Option<String>,
    /// สถานะของการซิงค์
    pub status: String,
    /// จำนวนที่ซิงค์เสร็จแล้ว
    pub synced_count: usize,
    /// จำนวนทั้งหมดที่ต้องซิงค์
    pub total_count: usize,
    /// เวลาเริ่มต้นการซิงค์ (ถ้ามี)
    pub started_at: Option<DateTime<Utc>>,
    /// เวลาเสร็จสิ้นการซิงค์ (ถ้ามี)
    pub completed_at: Option<DateTime<Utc>>,
}

/// โครงสร้างข้อมูลร้านค้า (Shop Information)
///
/// ใช้สำหรับเก็บและส่งข้อมูลพื้นฐานของร้านค้า
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShopInfo {
    /// ID ของร้านค้า
    pub shop_id: String,
    /// ชื่อร้านค้า
    pub shop_name: String,
    /// ชื่อแพลตฟอร์ม
    pub platform: String,
    /// สถานะของร้านค้า
    pub status: String,
}
