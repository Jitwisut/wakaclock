//! # Middleware Pipeline - ระบบจัดการ Middleware
//!
//! โมดูลนี้ให้บริการระบบจัดการ middleware แบบ pipeline pattern
//! สำหรับประมวลผลคำขอ HTTP ตามลำดับที่กำหนด
//!
//! ## คุณสมบัติหลัก:
//! - Pipeline pattern สำหรับเรียงลำดับ middleware
//! - Async trait support สำหรับการประมวลผลแบบอะซิงโครนัส
//! - Chain of responsibility pattern
//! - ระบบกู้คืนจาก panic และ timeout
//! - Support สำหรับ custom middleware
//!
//! ## Middleware ที่รวมอยู่:
//! - Recovery: จัดการ panic และข้อผิดพลาด
//! - Timeout: จำกัดเวลาประมวลผล request
//! - CORS: จัดการ Cross-Origin Resource Sharing
//! - Headers: ประมวลผล HTTP headers
//! - Logging: บันทึก request/response logs
//! - Authentication: ตรวจสอบ tokens
//! - Authorization: ตรวจสอบสิทธิ์ด้วย Casbin
//! - Quota: จัดการ rate limiting และ quotas
//! - Webhook: จัดการ webhook endpoints

use std::sync::Arc;
use std::future::Future;
use std::pin::Pin;
use async_trait::async_trait;
use anyhow::Result;
use hyper::{Request, Response, Body};
use crate::app::App;

/// Next เป็น function pointer สำหรับเรียก middleware ถัดไป
/// Next is a function pointer for calling the next middleware
pub type Next = Box<dyn Fn(Request<Body>) -> Pin<Box<dyn Future<Output = Result<Response<Body>>> + Send>> + Send + Sync>;

/// Middleware trait สำหรับประมวลผลคำขอ
/// Middleware trait for processing requests
#[async_trait]
pub trait Middleware: Send + Sync {
    /// จัดการคำขอและส่งต่อไปยัง middleware ถัดไป
    /// Handle request and pass to next middleware
    async fn handle(&self, req: Request<Body>, next: Next) -> Result<Response<Body>>;
}

/// MiddlewarePipeline เป็นตัวจัดการ middleware ทั้งหมดในระบบ
/// MiddlewarePipeline manages all middleware in the system
pub struct MiddlewarePipeline {
    /// รายการ middleware ที่จะประมวลผลตามลำดับ
    /// List of middleware to process in order
    middlewares: Vec<Arc<dyn Middleware>>,
}

impl MiddlewarePipeline {
    /// สร้าง MiddlewarePipeline ใหม่พร้อม middleware มาตรฐาน
    /// Create new MiddlewarePipeline with standard middleware
    pub fn new(app: Arc<App>) -> Self {
        use super::*;

        Self {
            middlewares: vec![
                // Middleware สำหรับกู้คืนจาก panic
                // Middleware for panic recovery
                Arc::new(RecoveryMiddleware::new()),

                // Middleware สำหรับจำกัดเวลาประมวลผล
                // Middleware for request timeout
                Arc::new(TimeoutMiddleware::new(app.config.server.request_timeout)),

                // Middleware สำหรับจัดการ CORS
                // Middleware for CORS handling
                Arc::new(CorsMiddleware::new(app.config.cors.clone())),

                // Middleware สำหรับประมวลผล headers
                // Middleware for header processing
                Arc::new(HeaderMiddleware::new()),

                // Middleware สำหรับบันทึก log
                // Middleware for logging
                Arc::new(LoggingMiddleware::new(app.logger.clone())),

                // Middleware สำหรับตรวจสอบ token
                // Middleware for token validation
                Arc::new(TokenMiddleware::new(app.config.auth.clone())),

                // Middleware สำหรับตรวจสอบสิทธิ์ด้วย Casbin
                // Middleware for authorization with Casbin
                Arc::new(CasbinMiddleware::new(app.authorization.clone())),

                // Middleware สำหรับจัดการ quota
                // Middleware for quota management
                Arc::new(QuotaMiddleware::new(app.clone())),

                // Middleware สำหรับจัดการ webhook
                // Middleware for webhook handling
                Arc::new(WebhookMiddleware::new(app.clone())),
            ],
        }
    }

    /// เพิ่ม middleware เข้าไปใน pipeline
    /// Add middleware to the pipeline
    pub fn add(&mut self, middleware: Arc<dyn Middleware>) {
        self.middlewares.push(middleware);
    }

    /// ประมวลผลคำขอผ่าน middleware pipeline
    /// Process request through middleware pipeline
    pub async fn process(&self, req: Request<Body>, handler: impl Fn(Request<Body>) -> Future<Output = Result<Response<Body>>> + Send + Sync + 'static) -> Result<Response<Body>> {
        // สร้าง chain ของ middleware
        // Build middleware chain
        let mut chain = Box::new(move |req| {
            Box::pin(handler(req)) as Pin<Box<dyn Future<Output = Result<Response<Body>>> + Send>>
        }) as Next;

        // สร้าง chain จากท้ายไปหน้า
        // Build chain from back to front
        for middleware in self.middlewares.iter().rev() {
            let m = middleware.clone();
            let prev_chain = chain.clone();
            chain = Box::new(move |req| {
                let m = m.clone();
                let prev_chain = prev_chain.clone();
                Box::pin(async move {
                    m.handle(req, prev_chain).await
                })
            });
        }

        // เรียกใช้ chain
        // Execute chain
        chain(req).await
    }
}
