//! # Gateway Handlers Module - โมดูล Gateway Handlers
//!
//! โมดูลหลักสำหรับจัดการ Gateway API endpoints ที่เชื่อมต่อกับแพลตฟอร์ม e-commerce ต่างๆ
//! รวมถึงการจัดการสินค้า, การค้นหาแบบ vector และการเชื่อมต่อ OAuth
//!
//! ## หน้าที่หลัก (Main Responsibilities)
//! - จัดการ routing สำหรับ gateway endpoints ทั้งหมด
//! - รวมบริการย่อยสำหรับ ecommerce, products, vectors และ health
//! - ให้ API สำหรับการเชื่อมต่อแพลตฟอร์มต่างๆ
//!
//! ## โครงสร้าง Sub-modules
//! - `ecommerce` - การเชื่อมต่อแพลตฟอร์ม e-commerce
//! - `products` - การจัดการสินค้าข้ามแพลตฟอร์ม
//! - `vectors` - การค้นหาแบบ AI/semantic search
//! - `health` - health check endpoints

pub mod ai;
pub mod ecommerce;
pub mod handler;
pub mod health;
pub mod products;
pub mod vectors;

pub use handler::GatewayHandler;

use crate::AppState;
use axum::Router;
use std::sync::Arc;

/// ลงทะเบียน gateway routes โดยใช้ handler pattern
///
/// สร้างและกำหนดค่า router สำหรับ Gateway API endpoints ทั้งหมด
/// ซึ่งรวมถึงการจัดการสินค้า, การเชื่อมต่อแพลตฟอร์ม และ AI features
pub fn register_gateway_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    let handler = GatewayHandler::new(state.clone());
    Router::new()
        .nest("/gateway", handler.build())
        .with_state(state)
}
