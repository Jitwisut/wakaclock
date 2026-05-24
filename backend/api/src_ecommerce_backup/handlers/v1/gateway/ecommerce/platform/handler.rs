use axum::Router;
use std::sync::Arc;

use crate::AppState;

/// E-commerce Platform Handler - ตัวจัดการแพลตฟอร์มเฉพาะ
///
/// จัดการ OAuth flows และการเชื่อมต่อแพลตฟอร์มสำหรับแพลตฟอร์ม e-commerce ต่างๆ
///
/// ## โครงสร้าง Routes
/// - `GET /connect` - เริ่มต้น OAuth connection สำหรับแพลตฟอร์ม
/// - `POST /callback` - จัดการ OAuth callback จากแพลตฟอร์ม
///
/// ## การทำงาน
/// Handler นี้ทำหน้าที่เป็นตัวกลางระหว่าง connect และ callback handlers
/// โดยแยกความรับผิดชอบให้ชัดเจนและง่ายต่อการบำรุงรักษา
pub struct PlatformHandler {
    state: Arc<AppState>,
}

impl PlatformHandler {
    /// สร้าง Platform handler instance ใหม่
    ///
    /// รับ AppState เพื่อเข้าถึง OAuth services, credential storage
    /// และ platform-specific configurations
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// สร้างและส่งคืน router พร้อม platform routes ทั้งหมด
    ///
    /// รวม connect และ callback handlers เข้าด้วยกัน
    pub fn build(&self) -> Router<Arc<AppState>> {
        self.routes()
    }

    /// ลงทะเบียน platform routes ทั้งหมด
    ///
    /// จัดระเบียบ routes แยกตามหน้าที่:
    /// - `/callback/*` - จัดการ OAuth callbacks จากแพลตฟอร์มต่างๆ
    /// - `/connect/*` - เริ่มต้น OAuth connection flows
    ///
    /// ## Flow การทำงาน
    /// 1. User เรียก `/connect` endpoint
    /// 2. System redirect user ไปยัง OAuth provider
    /// 3. User authorize และถูก redirect กลับมาที่ `/callback`
    /// 4. System ประมวลผล callback และเก็บ access token
    fn routes(&self) -> Router<Arc<AppState>> {
        use super::callback::handler::CallbackHandler;
        use super::connect::handler::ConnectHandler;

        Router::new()
            .nest(
                "/callback",
                CallbackHandler::new(self.state.clone()).build(),
            )
            .nest("/connect", ConnectHandler::new(self.state.clone()).build())
            .with_state(self.state.clone())
    }
}
