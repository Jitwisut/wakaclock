use axum::Router;
use std::sync::Arc;

use crate::AppState;

use super::platform::PlatformHandler;

/// E-commerce Platform Handler - ตัวจัดการแพลตฟอร์ม E-commerce
///
/// จัดการ OAuth flows และการเชื่อมต่อแพลตฟอร์มสำหรับแพลตฟอร์ม e-commerce ต่างๆ
///
/// ## โครงสร้าง Routes
/// - `GET /:platform/connect` - เริ่มต้น OAuth connection สำหรับแพลตฟอร์ม
/// - `POST /:platform/callback` - จัดการ OAuth callback จากแพลตฟอร์ม
///
/// ## แพลตฟอร์มที่รองรับ
/// TikTok Shop, Shopee, Lazada, Shopify, Amazon, eBay และอื่นๆ อีกมากมาย
/// แต่ละแพลตฟอร์มจะมี OAuth flow และ callback handling ที่แตกต่างกัน
pub struct EcommerceHandler {
    state: Arc<AppState>,
}

impl EcommerceHandler {
    /// สร้าง Ecommerce handler instance ใหม่
    ///
    /// รับ AppState เพื่อเข้าถึง platform integrations, OAuth services
    /// และ credential management systems
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// สร้างและส่งคืน router พร้อม ecommerce routes ทั้งหมด
    ///
    /// กำหนดค่า routing structure สำหรับแพลตฟอร์ม e-commerce ต่างๆ
    pub fn build(&self) -> Router<Arc<AppState>> {
        self.routes()
    }

    /// ลงทะเบียน ecommerce platform routes ทั้งหมด
    ///
    /// ใช้ dynamic routing pattern `/:platform` เพื่อรองรับแพลตฟอร์มหลายประเภท
    /// Platform handler จะจัดการ routing ย่อยสำหรับ connect และ callback endpoints
    ///
    /// ## รูปแบบ URL ที่รองรับ
    /// - `/tiktok/connect` - เชื่อมต่อ TikTok Shop
    /// - `/shopee/connect` - เชื่อมต่อ Shopee
    /// - `/lazada/callback` - รับ callback จาก Lazada
    /// - และอื่นๆ ตามแพลตฟอร์มที่รองรับ
    fn routes(&self) -> Router<Arc<AppState>> {
        Router::new()
            .nest(
                "/:platform",
                PlatformHandler::new(self.state.clone()).build(),
            )
            .with_state(self.state.clone())
    }
}
