//! # CORS Middleware Configuration - การตั้งค่า CORS
//!
//! โมดูลนี้จัดการ Cross-Origin Resource Sharing (CORS) สำหรับ API
//! อนุญาตการเข้าถึงจาก origins ที่กำหนดใน config
//!
//! ## คุณสมบัติหลัก:
//! - Dynamic origin configuration จาก AuthConfigService
//! - Support สำหรับ credentials และ custom headers
//! - Preflight request handling สำหรับ OPTIONS method
//! - Security headers configuration
//!
//! ## Allowed Origins:
//! - Frontend applications (Next.js, React)
//! - Development environments (localhost)
//! - Production domains จาก config
//!
//! ## Security Features:
//! - Origin validation จาก config
//! - Credential support สำหรับ authentication
//! - Custom headers support (x-auth-token)
//! - Preflight caching สำหรับ performance

use std::{sync::Arc, time::Duration};

use async_trait::async_trait;
use axum::http::{header, HeaderValue, Method};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tracing::warn;

use crate::{model::error::AppResult, services::auth_config::AuthConfigService};

const DEFAULT_ORIGIN: &str = "http://localhost:3000";

/// Source of trusted origins for CORS configuration.
#[async_trait]
pub trait CorsOriginSource: Send + Sync {
    async fn allowed_origins(&self) -> AppResult<Vec<HeaderValue>>;
}

/// Origin source backed by the runtime authentication configuration.
pub struct AuthServiceCorsSource {
    service: Arc<AuthConfigService>,
}

impl AuthServiceCorsSource {
    pub fn new(service: Arc<AuthConfigService>) -> Self {
        Self { service }
    }
}

#[async_trait]
impl CorsOriginSource for AuthServiceCorsSource {
    async fn allowed_origins(&self) -> AppResult<Vec<HeaderValue>> {
        let config = self.service.get_config().await?;

        let mut origins = Vec::with_capacity(config.allowed_origins.len());
        for origin in config.allowed_origins.iter() {
            match HeaderValue::from_str(origin) {
                Ok(value) => origins.push(value),
                Err(err) => warn!("Invalid CORS origin '{}': {}", origin, err),
            }
        }

        Ok(origins)
    }
}

/// Factory responsible for converting allowed origins into a CORS layer.
pub struct CorsLayerFactory<S> {
    source: S,
}

impl<S> CorsLayerFactory<S>
where
    S: CorsOriginSource,
{
    pub fn new(source: S) -> Self {
        Self { source }
    }

    pub async fn build(&self) -> AppResult<CorsLayer> {
        let origins = self.source.allowed_origins().await?;
        Ok(build_cors_layer(origins))
    }
}

/// สร้าง CORS layer สำหรับ Axum application
/// ดึง allowed origins จาก auth config service
/// กำหนด methods, headers, และ credentials ที่อนุญาต
pub async fn create_cors_layer(auth_config_service: Arc<AuthConfigService>) -> CorsLayer {
    let source = AuthServiceCorsSource::new(auth_config_service);
    let factory = CorsLayerFactory::new(source);

    factory.build().await.unwrap_or_else(|error| {
        tracing::error!("Failed to get auth config for CORS: {}", error);
        panic!("Failed to initialize CORS configuration");
    })
}

fn build_cors_layer(origins: Vec<HeaderValue>) -> CorsLayer {
    let methods = [
        Method::GET,
        Method::POST,
        Method::PUT,
        Method::DELETE,
        Method::OPTIONS,
    ];

    let headers = [
        header::AUTHORIZATION,
        header::CONTENT_TYPE,
        header::HeaderName::from_static("x-auth-token"),
    ];

    let layer = if origins.is_empty() {
        CorsLayer::new().allow_origin(AllowOrigin::exact(HeaderValue::from_static(DEFAULT_ORIGIN)))
    } else {
        CorsLayer::new().allow_origin(AllowOrigin::list(origins))
    };

    layer
        .allow_methods(methods)
        .allow_headers(headers)
        .allow_credentials(true)
        .max_age(Duration::from_secs(3600))
}
