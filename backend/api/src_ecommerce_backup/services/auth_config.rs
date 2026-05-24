//! # Auth Config Service - บริการจัดการ Authentication Configuration
//!
//! Service สำหรับจัดการการกำหนดค่า authentication แบบ runtime
//! รวมถึงการจัดการ allowed origins และ security settings
//!
//! ## หน้าที่หลัก
//! - จัดการ runtime authentication configuration
//! - ตรวจสอบ allowed origins สำหรับ CORS
//! - อัพเดท security settings แบบ dynamic
//! - ให้บริการ configuration ให้กับส่วนอื่นๆ ของระบบ

use crate::model::error::{AppError, AppResult};
use crate::repository::auth_config::{AuthConfigRepository, AuthRuntimeConfig, UpdateAuthConfig};
use std::sync::Arc;

/// Auth Configuration Service - บริการจัดการการกำหนดค่า Authentication
///
/// จัดการการกำหนดค่า authentication ที่สามารถเปลี่ยนแปลงได้ในขณะที่โปรแกรมทำงาน
/// รวมถึงการตรวจสอบ origins ที่ได้รับอนุญาตและการอัพเดท security settings
pub struct AuthConfigService {
    repository: Arc<AuthConfigRepository>,
}

impl AuthConfigService {
    /// สร้าง AuthConfigService instance ใหม่
    ///
    /// รับ repository สำหรับเข้าถึงข้อมูล auth configuration
    /// ในฐานข้อมูลหรือ storage ที่กำหนด
    pub fn new(repository: Arc<AuthConfigRepository>) -> Self {
        Self { repository }
    }

    /// ดึง reference ของ repository
    ///
    /// ใช้สำหรับกรณีที่ต้องการเข้าถึง repository โดยตรง
    /// จากภายนอก service
    pub fn get_repository(&self) -> &Arc<AuthConfigRepository> {
        &self.repository
    }

    /// ดึงการกำหนดค่า authentication ปัจจุบัน
    ///
    /// ส่งคืน `AuthRuntimeConfig` ที่มีการกำหนดค่าทั้งหมด
    /// ที่ใช้งานอยู่ในขณะนี้ รวมถึง allowed origins และ security settings
    pub async fn get_config(&self) -> AppResult<AuthRuntimeConfig> {
        self.repository
            .get_active_config()
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to get auth config: {}", e)))
    }

    /// อัพเดทการกำหนดค่า authentication
    ///
    /// รับข้อมูล `UpdateAuthConfig` และ user_id ของผู้ที่ทำการอัพเดท
    /// เพื่อบันทึก audit trail และความปลอดภัย
    ///
    /// ## การใช้งาน
    /// - อัพเดท allowed origins สำหรับ CORS
    /// - เปลี่ยนแปลง security policies
    /// - กำหนดค่า token expiration
    pub async fn update_config(&self, update: UpdateAuthConfig, user_id: &str) -> AppResult<()> {
        self.repository
            .update_config(update, user_id)
            .await
            .map_err(|e| AppError::InternalError(format!("Failed to update auth config: {}", e)))?;
        Ok(())
    }

    /// ตรวจสอบว่า origin ที่ระบุได้รับอนุญาตหรือไม่
    ///
    /// ใช้สำหรับ CORS validation โดยตรวจสอบกับ allowed_origins list
    /// ในการกำหนดค่าปัจจุบัน
    ///
    /// ## ตัวอย่างการใช้งาน
    /// ```rust
    /// let is_allowed = service.is_origin_allowed("https://app.example.com").await?;
    /// if is_allowed {
    ///     // อนุญาตให้เข้าถึง
    /// }
    /// ```
    pub async fn is_origin_allowed(&self, origin: &str) -> AppResult<bool> {
        let config = self.get_config().await?;
        Ok(config.allowed_origins.contains(&origin.to_string()))
    }
}
