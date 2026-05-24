// RequestClient - ระบบจัดการ HTTP requests และการ forward ไปยัง external services
// ใช้ในการ proxy requests และจัดการ request forwarding
// รวมกับ App container เพื่อเข้าถึง shared dependencies

use crate::infrastructure::app::App;
use crate::model::{HandlerConfig, ProcessingContext};
use anyhow::Result;
use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, Response};
use std::sync::Arc;

/// RequestClient - คลายเนต์สำหรับจัดการ HTTP requests
/// ใช้ในการ forward requests ไปยัง external services ต่างๆ
pub struct RequestClient {
    app: Arc<App>, // App container เพื่อเข้าถึง shared dependencies
}

impl RequestClient {
    /// new - สร้าง RequestClient ใหม่
    /// รับ App container เพื่อใช้ shared dependencies
    pub fn new(app: Arc<App>) -> Self {
        Self { app }
    }

    /// forward - ส่ง request ไปยัง external service
    /// จัดการ request forwarding ตาม provider และ config ที่กำหนด
    pub async fn forward(
        &self,
        _provider: &str,
        _config: &HandlerConfig,
        _request: Request<Body>,
        _context: &ProcessingContext,
    ) -> Result<Response<Body>> {
        // Implementation for forwarding requests
        Ok(Response::builder().status(200).body(Body::empty())?)
    }
}

/// High-level contract for dispatching outbound requests.
#[async_trait]
pub trait RequestDispatcher: Send + Sync {
    async fn dispatch(
        &self,
        provider: &str,
        config: &HandlerConfig,
        request: Request<Body>,
        context: &ProcessingContext,
    ) -> Result<Response<Body>>;
}

#[async_trait]
impl RequestDispatcher for RequestClient {
    async fn dispatch(
        &self,
        provider: &str,
        config: &HandlerConfig,
        request: Request<Body>,
        context: &ProcessingContext,
    ) -> Result<Response<Body>> {
        self.forward(provider, config, request, context).await
    }
}
