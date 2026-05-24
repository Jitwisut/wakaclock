//! # API Documentation Module
//!
//! โมดูลสำหรับการจัดการเอกสาร API documentation
//! โมดูลนี้จัดการการสร้างและเสิร์ฟ API documentation สำหรับ API versions ต่างๆ
//! รวมถึงการตั้งค่า Scalar UI สำหรับการแสดงผล OpenAPI documentation
//!
//! ## ฟีเจอร์หลัก
//! - OpenAPI 3.0 specification generation
//! - Scalar UI integration สำหรับ interactive documentation
//! - Versioned API documentation support
//! - Auto-generated endpoint documentation
//! - Schema และ model documentation
pub mod v1;

use crate::AppState;
use axum::Router;
use std::sync::Arc;

/// Legacy function สำหรับ backward compatibility - ใช้ unified docs router แทน
pub fn docs_routes(_api: aide::openapi::OpenApi) -> Router<Arc<AppState>> {
    // Create a new state for the docs router
    // This will be replaced by the actual state from main.rs
    Router::new()
        // Fallback route that redirects to the Scalar documentation
        .fallback(|| async move { axum::response::Redirect::permanent("/docs/scalar") })
}
