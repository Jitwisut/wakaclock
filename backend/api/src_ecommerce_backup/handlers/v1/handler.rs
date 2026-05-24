/// ไฟล์ handler.rs - V1 API Handler Implementation
/// จัดการ routing หลักสำหรับ API version 1
/// รวม platform และ gateway routes พร้อม middleware
use axum::Router;
use std::sync::Arc;
use tower_http::trace::TraceLayer;

use crate::AppState;

/// V1 API Handler
/// Root handler สำหรับ API version 1
/// ประกอบด้วย:
/// - Health check endpoint สำหรับตรวจสอบสถานะ service
/// - Platform API routes สำหรับจัดการ platform connections
/// - Gateway API routes สำหรับ e-commerce integrations
/// - Common middleware configuration (tracing, CORS, etc.)
pub struct V1Handler {
    state: Arc<AppState>, // Shared application state
}

impl V1Handler {
    /// สร้าง V1 handler instance ใหม่
    /// รับ application state สำหรับ share ระหว่าง routes
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// Build router พร้อม routes ทั้งหมดของ v1
    /// Return configured Router
    pub fn build(&self) -> Router<Arc<AppState>> {
        self.routes()
    }

    /// Register routes - alias ของ build() เพื่อความเข้ากันได้
    /// ใช้ในกรณีที่ code เก่าเรียก register_routes
    pub fn register_routes(&self) -> Router<Arc<AppState>> {
        self.build()
    }

    /// ลงทะเบียน v1 routes ทั้งหมด
    /// สร้าง nested structure สำหรับ /v1 endpoints
    fn routes(&self) -> Router<Arc<AppState>> {
        // Create base v1 router
        let mut router: Router<Arc<AppState>> = Router::new();

        // Add health check endpoint
        router = router.route(
            "/health",
            axum::routing::get(|| async {
                axum::Json(serde_json::json!({
                    "status": "Service is working v2.4.0"
                }))
            }),
        );

        // Register platform routes
        let platform_handler = super::platform::PlatformHandler::new(self.state.clone());
        router = router.nest("/platform", platform_handler.build());

        // Register gateway routes
        let gateway_handler = super::gateway::GatewayHandler::new(self.state.clone());
        router = router.nest("/gateway", gateway_handler.build());

        // Add common middleware and state
        router
            .layer(TraceLayer::new_for_http())
            .with_state(self.state.clone())
    }
}
