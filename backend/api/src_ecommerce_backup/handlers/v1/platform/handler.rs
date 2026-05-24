use axum::{middleware::from_fn_with_state, Router};
use std::sync::Arc;

use crate::middleware::{
    auth_middleware::auth_middleware, rate_limit::rate_limit_middleware,
    usage_tracking::usage_tracking_middleware,
};
use crate::AppState;

/// Platform API Handler - ตัวจัดการ API สำหรับแพลตฟอร์ม
///
/// จัดการเส้นทางและตัวจัดการย่อยทั้งหมดที่เกี่ยวข้องกับแพลตฟอร์ม
/// ตัวจัดการนี้ให้บริการ:
/// - การจัดการสินค้า (Product management)
/// - จุดเชื่อมต่อการบูรณาการแพลตฟอร์ม (Platform integration endpoints)
/// - การติดตามสุขภาพระบบ (Health check monitoring)
///
/// # Architecture
/// ใช้รูปแบบ Nested Router สำหรับแยกความรับผิดชอบของแต่ละโมดูล
/// - `/products` - การจัดการสินค้าและ sync ข้ามแพลตฟอร์ม
/// - `/shop` - การจัดการร้านค้าและการเชื่อมต่อ
/// - `/audit` - การติดตามและ logging สำหรับ compliance
///
/// # Usage
/// ```rust
/// let handler = PlatformHandler::new(app_state);
/// let router = handler.build();
/// ```
pub struct PlatformHandler {
    state: Arc<AppState>,
}

impl PlatformHandler {
    /// สร้างอินสแตนซ์ใหม่ของ Platform handler
    ///
    /// รับ Arc<AppState> เพื่อแชร์สถานะข้ามทุก sub-handler
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// สร้างและคืนค่า router พร้อมเส้นทาง platform ทั้งหมด
    ///
    /// # Returns
    /// Router<Arc<AppState>> - router ที่ประกอบด้วยเส้นทางย่อยทั้งหมด
    pub fn build(&self) -> Router<Arc<AppState>> {
        self.routes()
    }

    /// ลงทะเบียนเส้นทาง platform ทั้งหมด
    ///
    /// สร้าง sub-handler สำหรับแต่ละโมดูลและจัดกลุ่มเข้าด้วยกัน
    /// ใช้ nest() pattern เพื่อความชัดเจนในการจัดระเบียบ API
    fn routes(&self) -> Router<Arc<AppState>> {
        // Register product sub-handler
        let product_handler = super::product::ProductHandler::new(self.state.clone());

        // Register shop sub-handler
        let shop_handler = super::shop::ShopHandler::new(self.state.clone());

        // Register audit sub-handler
        let audit_handler = super::audit::AuditHandler::new(self.state.clone());

        // Register webhook sub-handler
        let webhook_handler = super::webhook::WebhookHandler::new(self.state.clone());

        Router::new()
            .route(
                "/:platform_name/test-connection",
                axum::routing::post(super::shop::handler::test_connection),
            )
            .merge(product_handler.build())
            .nest("/shop", shop_handler.build())
            .nest("/audit", audit_handler.build())
            .nest("/webhooks", webhook_handler.build())
            .with_state(self.state.clone())
            .layer(from_fn_with_state(self.state.clone(), auth_middleware))
            .layer(from_fn_with_state(
                self.state.clone(),
                rate_limit_middleware,
            ))
            .layer(from_fn_with_state(
                self.state.clone(),
                usage_tracking_middleware,
            ))
    }
}
