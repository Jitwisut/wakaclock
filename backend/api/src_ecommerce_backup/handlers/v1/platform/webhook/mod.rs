//! Webhook handlers module - โมดูลจัดการ webhook endpoints
//!
//! โมดูลนี้รวม handler functions และ routing สำหรับ webhook management
//! รองรับ CRUD operations, การทดสอบ, และสถิติการส่ง webhook

pub mod handler;

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::AppState;

// ส่งออก handler functions ทั้งหมดเพื่อใช้งานในที่อื่น
pub use handler::{
    create_webhook, delete_webhook, get_webhook, get_webhook_deliveries, get_webhook_stats,
    list_webhooks, test_webhook, toggle_webhook, update_webhook,
};

/// Webhook Handler - ตัวจัดการ routes สำหรับ webhook
///
/// รับผิดชอบในการ:
/// - สร้าง routing structure สำหรับ webhook endpoints
/// - จัดการ state และ dependencies
/// - ลงทะเบียน middleware และ authentication
pub struct WebhookHandler {
    state: Arc<AppState>,
}

impl WebhookHandler {
    /// สร้าง webhook handler instance ใหม่
    ///
    /// รับ AppState สำหรับเข้าถึง services และ dependencies
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// สร้างและคืน router พร้อม routes ทั้งหมด
    ///
    /// เรียกใช้เมื่อต้องการ mount webhook routes ไปยัง application router
    pub fn build(&self) -> Router<Arc<AppState>> {
        self.routes()
    }

    /// ลงทะเบียน webhook routes ทั้งหมด
    ///
    /// Routes ที่รองรับ:
    /// - POST /webhooks - สร้าง webhook ใหม่
    /// - GET /webhooks - ดึงรายการ webhooks
    /// - GET /webhooks/:id - ดึงข้อมูล webhook
    /// - PUT /webhooks/:id - อัพเดท webhook
    /// - DELETE /webhooks/:id - ลบ webhook
    /// - POST /webhooks/:id/toggle - เปิด/ปิดการใช้งาน
    /// - POST /webhooks/:id/test - ทดสอบ webhook
    /// - GET /webhooks/:id/deliveries - ดูประวัติการส่ง
    /// - GET /webhooks/:id/stats - ดูสถิติ
    fn routes(&self) -> Router<Arc<AppState>> {
        Router::new()
            .route("/", post(create_webhook).get(list_webhooks))
            .route(
                "/:webhook_id",
                get(get_webhook).put(update_webhook).delete(delete_webhook),
            )
            .route("/:webhook_id/toggle", post(toggle_webhook))
            .route("/:webhook_id/test", post(test_webhook))
            .route("/:webhook_id/deliveries", get(get_webhook_deliveries))
            .route("/:webhook_id/stats", get(get_webhook_stats))
            .with_state(self.state.clone())
    }
}
