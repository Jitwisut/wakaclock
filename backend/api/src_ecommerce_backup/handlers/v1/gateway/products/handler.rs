use axum::{
    routing::{get, put},
    Router,
};
use std::sync::Arc;

use crate::{
    handlers::v1::platform::product::product::{
        create_product, delete_product, get_product, get_product_detail, list_categories,
        list_products, list_unique_products, update_product,
    },
    AppState,
};

use super::merchant::{get_merchant_product_detail, update_merchant_product_visibility};
/// Products Management Handler - ตัวจัดการสินค้า
///
/// จัดการการดำเนินงานเกี่ยวกับสินค้าทั้งหมดข้ามแพลตฟอร์มที่เชื่อมต่อ
/// Handler นี้รวมบริการ:
/// - การจัดการ CRUD operations สำหรับสินค้า
/// - การ listing และ search สินค้า
/// - การจัดการหมวดหมู่ (Category management)
/// - การดึงข้อมูลรายละเอียดสินค้าแบบครบถ้วน
///
/// ## รูปแบบการทำงาน
/// เชื่อมโยงกับ platform-specific handlers เพื่อให้สามารถดึงข้อมูลสินค้า
/// จากแพลตฟอร์มต่างๆ ได้ในรูปแบบที่สม่ำเสมอ (unified format)
pub struct ProductsHandler {
    state: Arc<AppState>,
}

impl ProductsHandler {
    /// สร้าง Products handler instance ใหม่
    ///
    /// รับ AppState เพื่อเข้าถึง product services, database connections
    /// และ platform integrations ที่จำเป็น
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// สร้างและส่งคืน router พร้อม product routes ทั้งหมด
    ///
    /// กำหนดค่า endpoints ทั้งหมดสำหรับการจัดการสินค้า
    pub fn build(&self) -> Router<Arc<AppState>> {
        self.routes()
    }

    /// ลงทะเบียน product management routes ทั้งหมด
    ///
    /// กำหนด REST endpoints:
    /// - `GET /` - ดึงรายการสินค้าทั้งหมด
    /// - `POST /` - สร้างสินค้าใหม่
    /// - `GET /:id` - ดึงข้อมูลสินค้าตาม ID
    /// - `PUT /:id` - อัพเดทสินค้า
    /// - `DELETE /:id` - ลบสินค้า
    /// - `GET /list` - ดึงรายการสินค้าแบบ unique
    /// - `GET /detail/:id` - ดึงข้อมูลรายละเอียดครบถ้วน
    /// - `GET /categories` - ดึงรายการหมวดหมู่สินค้า
    fn routes(&self) -> Router<Arc<AppState>> {
        Router::new()
            .route("/", get(list_products).post(create_product))
            .route(
                "/:id",
                get(get_product).put(update_product).delete(delete_product),
            )
            .route("/list", get(list_unique_products))
            .route("/detail/:id", get(get_product_detail))
            .route("/merchant/:id", get(get_merchant_product_detail))
            .route(
                "/merchant/:id/visibility",
                put(update_merchant_product_visibility),
            )
            .route("/categories", get(list_categories))
            .with_state(self.state.clone())
    }
}

/// Legacy compatibility function - ฟังก์ชันเพื่อความเข้ากันได้แบบเก่า
///
/// ให้บริการ routes แบบโดยตรงสำหรับ backward compatibility
/// กับโค้ดเก่าที่อาจยังใช้งานรูปแบบนี้อยู่
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_products).post(create_product))
        .route(
            "/:id",
            get(get_product).put(update_product).delete(delete_product),
        )
        .route("/list", get(list_unique_products))
        .route("/detail/:id", get(get_product_detail))
        .route("/merchant/:id", get(get_merchant_product_detail))
        .route(
            "/merchant/:id/visibility",
            put(update_merchant_product_visibility),
        )
        .route("/categories", get(list_categories))
}
