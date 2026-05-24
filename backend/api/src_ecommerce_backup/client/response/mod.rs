// ResponseClient - ระบบจัดการ HTTP responses และการประมวลผล response
// ใช้ในการ transform, filter และ modify responses ก่อนส่งกลับไปยัง client
// รวมกับ App container เพื่อเข้าถึง shared dependencies

use crate::infrastructure::app::App;
use crate::model::{ProcessingContext, ResponseConfig};
use anyhow::Result;
use async_trait::async_trait;
use axum::body::Body;
use axum::http::Response;
use std::sync::Arc;

/// ResponseClient - คลายเนต์สำหรับจัดการ outgoing responses
/// ใช้ในการประมวลผล responses ก่อนส่งกลับ
pub struct ResponseClient {
    app: Arc<App>, // App container เพื่อเข้าถึง shared dependencies
}

impl ResponseClient {
    /// new - สร้าง ResponseClient ใหม่
    /// รับ App container เพื่อใช้ shared dependencies
    pub fn new(app: Arc<App>) -> Self {
        Self { app }
    }

    /// handle - ประมวลผล response ตาม configuration
    /// จัดการ response transformation และ filtering ตามที่กำหนด
    pub async fn handle(
        &self,
        response: Response<Body>,
        _config: &ResponseConfig,
        _context: &ProcessingContext,
    ) -> Result<Response<Body>> {
        // Implementation for handling responses
        Ok(response)
    }
}

/// High-level contract for response post-processing.
#[async_trait]
pub trait ResponseProcessor: Send + Sync {
    async fn process(
        &self,
        response: Response<Body>,
        config: &ResponseConfig,
        context: &ProcessingContext,
    ) -> Result<Response<Body>>;
}

#[async_trait]
impl ResponseProcessor for ResponseClient {
    async fn process(
        &self,
        response: Response<Body>,
        config: &ResponseConfig,
        context: &ProcessingContext,
    ) -> Result<Response<Body>> {
        self.handle(response, config, context).await
    }
}
