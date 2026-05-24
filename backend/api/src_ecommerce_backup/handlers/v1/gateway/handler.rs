use axum::Router;
use std::sync::Arc;

use crate::handlers::v1::gateway::{
    ai::AiHandler, ecommerce::EcommerceHandler, health::HealthHandler, products::ProductsHandler,
    vectors::VectorsHandler,
};

use crate::AppState;

/// Gateway API Handler - ตัวจัดการ Gateway API หลัก
///
/// จัดการ routes ทั้งหมดที่เกี่ยวข้องกับ gateway สำหรับการเชื่อมต่อแพลตฟอร์มและ OAuth flows
/// Handler นี้รวมบริการ:
/// - endpoint สำหรับจัดการสินค้า (Product management)
/// - การซิงค์ข้อมูล (Synchronization operations)
/// - ความสามารถค้นหาแบบ Vector/AI
/// - การเชื่อมต่อแพลตฟอร์ม E-commerce ต่างๆ
///
/// ## ลักษณะการทำงาน
/// ใช้ modular structure แยกการจัดการเป็นส่วนๆ ตาม domain เพื่อความชัดเจน
/// และง่ายต่อการบำรุงรักษา
pub struct GatewayHandler {
    state: Arc<AppState>,
}

impl GatewayHandler {
    /// สร้าง Gateway handler instance ใหม่
    ///
    /// รับ AppState เพื่อเข้าถึง dependencies ทั้งหมดที่จำเป็น
    /// เช่น database connections, cache, และ external services
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// สร้างและส่งคืน router พร้อม gateway routes ทั้งหมด
    ///
    /// เป็น entry point หลักสำหรับการสร้าง router structure
    /// ที่รวม handlers ย่อยทั้งหมดเข้าด้วยกัน
    pub fn build(&self) -> Router<Arc<AppState>> {
        self.routes()
    }

    /// ลงทะเบียน gateway routes ทั้งหมดโดยใช้ modular structure
    ///
    /// จัดระเบียบ routes แยกตาม domain/feature:
    /// - `/ecommerce` - การเชื่อมต่อแพลตฟอร์ม e-commerce
    /// - `/products` - การจัดการสินค้า
    /// - `/vectors` - การค้นหาแบบ semantic search
    /// - `/health` - health checks และ monitoring
    fn routes(&self) -> Router<Arc<AppState>> {
        let ecommerce_handler = EcommerceHandler::new(self.state.clone());
        let ai_handler = AiHandler::new(self.state.clone());
        let products_handler = ProductsHandler::new(self.state.clone());
        let vectors_handler = VectorsHandler::new(self.state.clone());
        let health_handler = HealthHandler::new(self.state.clone());

        Router::new()
            .nest("/ai", ai_handler.build())
            .nest("/ecommerce", ecommerce_handler.build())
            .nest("/products", products_handler.build())
            .nest("/vectors", vectors_handler.build())
            .nest("/health", health_handler.build())
            .with_state(self.state.clone())
    }
}
