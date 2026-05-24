//! ไฟล์ rotate.rs - Request models สำหรับการ rotate credentials
//! จัดการโครงสร้างข้อมูลสำหรับการเปลี่ยนแปลงข้อมูลการยืนยันตัวตนของ platform ต่างๆ
//! รองรับทั้งระบบ OAuth และ API Key authentication พร้อมการจัดการ rotation ที่ปลอดภัย

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// RotateCredentialRequest - โครงสร้าง request สำหรับการ rotate credential
/// ใช้สำหรับการอัพเดทข้อมูลการยืนยันตัวตนแบบปลอดภัย โดยสามารถเก็บ credential เก่าไว้ชั่วคราว
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RotateCredentialRequest {
    /// UUID ของ credential ที่ต้องการ rotate
    pub credential_id: Uuid,

    /// ข้อมูล OAuth ใหม่ (ถ้าใช้ระบบ OAuth)
    pub new_oauth_data: Option<OAuthCredential>,

    /// ข้อมูล API key ใหม่ (ถ้าใช้ระบบ API key)
    pub new_api_key_data: Option<ApiKeyCredential>,

    /// จำนวนนาทีที่จะเก็บ credential เก่าไว้ก่อนลบ (สำหรับ graceful rotation)
    pub keep_old_version_minutes: Option<i32>,
}

/// OAuthCredential - ข้อมูล OAuth credential
/// เก็บข้อมูลทั้งหมดที่จำเป็นสำหรับการยืนยันตัวตนผ่านระบบ OAuth 2.0
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthCredential {
    /// Access token สำหรับการเข้าถึง API
    pub access_token: String,

    /// Refresh token สำหรับการต่ออายุ access token
    pub refresh_token: Option<String>,

    /// เวลาหมดอายุของ access token
    pub expires_at: DateTime<Utc>,

    /// ประเภทของ token (เช่น "Bearer")
    pub token_type: Option<String>,

    /// Scope หรือสิทธิ์การเข้าถึงของ token
    pub scope: Option<String>,
}

/// ApiKeyCredential - ข้อมูล API key credential
/// สำหรับ platform ที่ใช้ระบบ API key + secret แทน OAuth
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyCredential {
    /// API key หลัก
    pub api_key: String,

    /// API secret (ถ้าจำเป็น)
    pub api_secret: Option<String>,
}
