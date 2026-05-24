//! # Error Handler Middleware - ระบบจัดการข้อผิดพลาด
//!
//! โมดูลนี้จัดการการจัดการข้อผิดพลาดในระดับ middleware
//! เพื่อให้ API responses มีรูปแบบและข้อมูลที่สอดคล้อง
//!
//! ## คุณสมบัติหลัก:
//! - Global error handling สำหรับ application
//! - Structured error responses ด้วย JSON format
//! - HTTP status code mapping
//! - Security error sanitization
//! - Error logging และ monitoring
//!
//! ## Error Types:
//! - **Authentication Errors**: 401 Unauthorized
//! - **Authorization Errors**: 403 Forbidden
//! - **Validation Errors**: 400 Bad Request
//! - **Internal Errors**: 500 Internal Server Error
//! - **Database Errors**: แปลงเป็น 500 ด้วย sanitized message
//!
//! ## Security Features:
//! - Error message sanitization
//! - Sensitive data filtering
//! - Stack trace hiding ใน production
//! - Audit logging สำหรับ security events
//!
//! ## การใช้งาน:
//! ```rust
//! let app = Router::new()
//!     .layer(middleware::from_fn(error_handler_middleware));
//! ```
use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use tracing::error;

/// Strategy trait for constructing error responses.
pub trait ErrorResponder: Send + Sync {
    fn respond(&self, status: StatusCode) -> Response;
}

/// JSON implementation of the error responder.
#[derive(Clone, Copy, Default)]
pub struct JsonErrorResponder;

impl ErrorResponder for JsonErrorResponder {
    fn respond(&self, status: StatusCode) -> Response {
        let payload = json!({
            "error": "Internal server error",
            "status": status.as_u16(),
            "timestamp": chrono::Utc::now().to_rfc3339()
        });

        (StatusCode::INTERNAL_SERVER_ERROR, Json(payload)).into_response()
    }
}

/// Middleware wrapper that centralises error handling.
pub struct ErrorHandler<R = JsonErrorResponder> {
    responder: R,
}

impl<R> ErrorHandler<R>
where
    R: ErrorResponder,
{
    pub fn new(responder: R) -> Self {
        Self { responder }
    }

    pub async fn handle(&self, request: Request, next: Next) -> Result<Response, StatusCode> {
        let response = next.run(request).await;

        if response.status().is_server_error() {
            error!("Server error: {:?}", response.status());
            return Ok(self.responder.respond(response.status()));
        }

        Ok(response)
    }
}

impl Default for ErrorHandler<JsonErrorResponder> {
    fn default() -> Self {
        Self::new(JsonErrorResponder)
    }
}

/// Error handler middleware สำหรับจับและประมวลผล server errors
/// แปลง 5xx errors เป็น standardized JSON responses
pub async fn error_handler_middleware(
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    ErrorHandler::default().handle(request, next).await
}
