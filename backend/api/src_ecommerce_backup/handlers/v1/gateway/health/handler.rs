use axum::{http::StatusCode, routing::get, Json, Router};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

/// Health Check Handler - ตัวจัดการ Health Check
///
/// ให้บริการ health status endpoints สำหรับการติดตาม service
/// Handler นี้รวมบริการ:
/// - การตรวจสอบสถานะพื้นฐานของระบบ
/// - ข้อมูลเวอร์ชันของ service
/// - Readiness/liveness probes สำหรับ container orchestration
///
/// ## การใช้งาน
/// ใช้สำหรับ monitoring tools เช่น Kubernetes, Prometheus หรือ load balancers
/// เพื่อตรวจสอบว่า service พร้อมรับ traffic หรือไม่
pub struct HealthHandler {
    state: Arc<AppState>,
}

impl HealthHandler {
    /// สร้าง Health handler instance ใหม่
    ///
    /// รับ AppState เพื่อเข้าถึง dependencies ในอนาคต
    /// (เช่น การตรวจสอบสถานะ database หรือ external services)
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// สร้างและส่งคืน router พร้อม health routes ทั้งหมด
    ///
    /// กำหนดค่า endpoints สำหรับ health checking
    pub fn build(&self) -> Router<Arc<AppState>> {
        self.routes()
    }

    /// ลงทะเบียน health check routes
    ///
    /// กำหนด route `/` สำหรับ basic health check
    /// ในอนาคตอาจเพิ่ม `/ready` และ `/live` สำหรับ Kubernetes probes
    fn routes(&self) -> Router<Arc<AppState>> {
        Router::new()
            .route("/", get(health_check))
            .with_state(self.state.clone())
    }
}

/// Health check endpoint - endpoint ตรวจสอบสุขภาพระบบ
///
/// ส่งคืนสถานะสุขภาพของ service พร้อมข้อมูลเวอร์ชัน
//
/// ## API Response
/// - `200 OK` - ระบบทำงานปกติ พร้อมข้อมูลสถานะและเวอร์ชัน
/// - `503 Service Unavailable` - ระบบมีปัญหา (ในอนาคต)
///
/// ## การใช้งาน
/// - Load balancers ใช้เพื่อตรวจสอบว่า service พร้อมรับ traffic
/// - Monitoring systems ใช้สำหรับ alerting
/// - CI/CD pipelines ใช้ตรวจสอบการ deploy
#[utoipa::path(
    get,
    path = "/health",
    tag = "health",
    responses(
        (status = 200, description = "Service is healthy", body = Value),
        (status = 503, description = "Service is unhealthy")
    )
)]
pub async fn health_check() -> (StatusCode, Json<serde_json::Value>) {
    // ตอนนี้ส่งคืนสถานะ healthy เสมอ
    // ในอนาคตอาจเพิ่มการตรวจสอบ database, cache หรือ external services
    (
        StatusCode::OK,
        Json(json!({
            "status": "healthy",
            "service": "ecommerce-connect",
            "version": "2.4.0"
        })),
    )
}
