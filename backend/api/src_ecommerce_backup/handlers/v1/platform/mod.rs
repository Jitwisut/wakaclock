/// Platform Handlers Module - โมดูลตัวจัดการแพลตฟอร์ม
///
/// จัดกลุ่มและส่งออก handlers ทั้งหมดสำหรับการจัดการแพลตฟอร์ม e-commerce
/// รวมถึงการจัดการสินค้า ร้านค้า และ audit logs
///
/// # Modules
/// - `handler` - Platform handler หลักสำหรับ routing และการจัดกลุ่ม sub-handlers
/// - `product` - การจัดการสินค้าและ product sync ข้ามแพลตฟอร์ม
/// - `shop` - การจัดการร้านค้าและการเชื่อมต่อกับแพลตฟอร์ม
/// - `audit` - การติดตามและ logging สำหรับ compliance
pub mod handler;
// pub mod platform; // Legacy module - deprecated
pub mod audit;
pub mod product;
pub mod shop;
pub mod webhook;

pub use handler::PlatformHandler;

// Legacy compatibility exports for external use
use crate::AppState;
use axum::Router;
use std::sync::Arc;

/// ลงทะเบียนเส้นทาง platform โดยใช้รูปแบบ handler pattern
///
/// สร้าง PlatformHandler และจัดกลุ่มเส้นทางทั้งหมดภายใต้ `/platform` prefix
/// ใช้สำหรับการรวมเข้ากับ main application router
///
/// # Arguments
/// * `state` - Arc<AppState> สำหรับการแชร์สถานะระหว่าง handlers
///
/// # Returns
/// Router<Arc<AppState>> - router ที่ประกอบด้วยเส้นทาง platform ทั้งหมด
///
/// # Usage
/// ```rust
/// let platform_routes = register_platform_routes(app_state);
/// let app = Router::new().merge(platform_routes);
/// ```
pub fn register_platform_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    let handler = PlatformHandler::new(state.clone());
    Router::new()
        .nest("/platform", handler.build())
        .with_state(state)
}
