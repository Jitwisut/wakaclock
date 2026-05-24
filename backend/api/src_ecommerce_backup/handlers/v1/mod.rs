/// V1 API Handlers Module - โมดูลตัวจัดการ API เวอร์ชั่น 1
///
/// จัดกลุ่มและส่งออก handlers ทั้งหมดสำหรับ API endpoints เวอร์ชั่น 1
/// แยกเป็น 2 กลุ่มหลัก: Gateway API และ Platform API
///
/// # Modules
/// - `gateway` - Gateway API handlers สำหรับ external clients
/// - `platform` - Platform API handlers สำหรับ internal platform management
/// - `handler` - V1Handler หลักสำหรับการจัดกลุ่มและ routing
///
/// # API Structure
/// ```
/// /api/v1/
/// ├── /gateway/          # สำหรับ external clients
/// │   ├── /ecommerce/    # E-commerce platform integration
/// │   ├── /products/     # Product management
/// │   ├── /vectors/      # AI/Vector search
/// │   └── /health/       # Health checks
/// └── /platform/         # สำหรับ internal management
///     ├── /product/      # Product sync operations
///     ├── /shop/         # Shop management
///     └── /audit/        # Audit & compliance
/// ```
///
/// # Usage
/// ```rust
/// let v1_handler = V1Handler::new(app_state);
/// let router = v1_handler.build();
/// ```
pub mod gateway;
pub mod handler;
pub mod platform;

pub use handler::V1Handler;

use crate::AppState;
use axum::Router;
use std::sync::Arc;

/// ลงทะเบียนเส้นทาง V1 API - convenience function
///
/// สร้าง V1Handler และคืนค่า router ที่ประกอบด้วยเส้นทาง V1 ทั้งหมด
/// Function นี้ใช้สำหรับการรวมเข้ากับ main application router
///
/// # Arguments
/// * `state` - Arc<AppState> สำหรับการแชร์สถานะและ dependencies
///
/// # Returns
/// Router<Arc<AppState>> - router ที่ประกอบด้วย V1 API endpoints
///
/// # Usage
/// ```rust
/// let v1_routes = routes(app_state);
/// let app = Router::new().nest("/api/v1", v1_routes);
/// ```
pub fn routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    let handler = V1Handler::new(state);
    handler.build()
}
