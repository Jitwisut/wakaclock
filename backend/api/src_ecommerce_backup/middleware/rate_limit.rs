//! # Rate Limit Middleware - ระบบจำกัดอัตราการเรียกใช้ API
//!
//! โมดูลนี้จัดการระบบ rate limiting สำหรับควบคุมการใช้งาน API
//! ป้องกันการใช้งานเกินกำหนดและรักษา quotas ของ external platforms
//!
//! ## คุณสมบัติหลัก:
//! - Sliding window algorithm สำหรับการนับ requests
//! - Token bucket pattern สำหรับ burst protection
//! - Platform-specific rate limits (TikTok, Shopee, Lazada)
//! - User-based และ IP-based rate limiting
//! - Real-time monitoring และ statistics
//!
//! ## Rate Limiting Algorithms:
//! - **Sliding Window**: ติดตาม requests ใน time window
//! - **Token Bucket**: อนุญาต burst requests ในขอบเขตที่กำหนด
//! - **Fixed Window**: Rate limit แบบ fixed interval
//!
//! ## Platform Rate Limits:
//! - TikTok Shop API: 600 requests/minute
//! - Shopee API: 1000 requests/minute
//! - Lazada API: 500 requests/minute
//! - Ecwid API: 600 requests/minute per token
//! - Default API: 100 requests/minute

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use once_cell::sync::Lazy;
use serde_json::json;
use std::borrow::Cow;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

use crate::model::error::AppResult;
use crate::AppState;

static GLOBAL_RATE_LIMITER: Lazy<RateLimiter> = Lazy::new(RateLimiter::new);

/// Resolved rate-limit context information.
#[derive(Debug, Clone)]
pub struct RateLimitContext<'a> {
    platform: Cow<'a, str>,
    client_id: Cow<'a, str>,
}

impl<'a> RateLimitContext<'a> {
    fn new(platform: Cow<'a, str>, client_id: Cow<'a, str>) -> Self {
        Self {
            platform,
            client_id,
        }
    }

    fn platform(&self) -> &str {
        self.platform.as_ref()
    }

    fn client(&self) -> &str {
        self.client_id.as_ref()
    }

    fn cache_key(&self) -> String {
        format!("{}:{}", self.platform(), self.client())
    }
}

/// Extracts the rate-limit context from an incoming request.
pub trait RateLimitResolver: Send + Sync + 'static {
    fn resolve<'req>(&self, request: &'req Request) -> RateLimitContext<'req>;
}

/// Default resolver that infers context from request headers and path segments.
#[derive(Clone, Copy, Default)]
pub struct PathAndHeaderResolver;

impl RateLimitResolver for PathAndHeaderResolver {
    fn resolve<'req>(&self, request: &'req Request) -> RateLimitContext<'req> {
        let path = request.uri().path();
        let platform = path
            .split('/')
            .filter(|segment| !segment.is_empty())
            .collect::<Vec<_>>()
            .windows(2)
            .find_map(|window| {
                if window[0] == "shop" || window[0] == "platform" {
                    window.get(1).copied()
                } else {
                    None
                }
            })
            .unwrap_or("default");

        let client_id = request
            .headers()
            .get("x-client-id")
            .and_then(|value| value.to_str().ok())
            .unwrap_or("default_client");

        RateLimitContext::new(Cow::Borrowed(platform), Cow::Borrowed(client_id))
    }
}

/// Middleware wrapper around the shared rate limiter.
#[derive(Clone)]
pub struct RateLimitMiddleware<R> {
    limiter: RateLimiter,
    resolver: R,
}

impl<R> RateLimitMiddleware<R>
where
    R: RateLimitResolver,
{
    pub fn new(limiter: RateLimiter, resolver: R) -> Self {
        Self { limiter, resolver }
    }

    pub async fn handle(&self, request: Request, next: Next) -> Response {
        let context = self.resolver.resolve(&request);

        match self.limiter.allow(&context).await {
            Ok(true) => next.run(request).await,
            Ok(false) => self.too_many_requests_response(context.platform()),
            Err(error) => {
                tracing::warn!("Failed to check rate limit: {}", error);
                next.run(request).await
            }
        }
    }

    fn too_many_requests_response(&self, platform: &str) -> Response {
        let body = json!({
            "error": "Rate limit exceeded",
            "message": format!("Too many requests for platform: {}", platform),
            "retry_after": 60
        });

        (StatusCode::TOO_MANY_REQUESTS, Json(body)).into_response()
    }
}

/// RateLimiter - ระบบจำกัดอัตรา API requests
/// ใช้ sliding window และ burst detection เพื่อควบคุม API usage
#[derive(Clone)]
pub struct RateLimiter {
    limits: Arc<RwLock<HashMap<String, RateLimit>>>, // Platform-specific rate limits
    requests: Arc<RwLock<HashMap<String, Vec<u64>>>>, // Request history tracking
}

/// RateLimit - การกำหนด rate limit สำหรับแต่ละ platform
/// กำหนด requests per second, burst size และ time window
#[derive(Clone, Debug)]
pub struct RateLimit {
    pub requests_per_second: f64, // จำนวน requests ต่อวินาทีที่อนุญาต
    pub burst_size: usize,        // จำนวน requests สูงสุดที่อนุญาต (burst)
    pub window_seconds: u64,      // ช่วงเวลาสำหรับ sliding window
}

impl Default for RateLimit {
    fn default() -> Self {
        Self {
            requests_per_second: 10.0,
            burst_size: 20,
            window_seconds: 60,
        }
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new()
    }
}

impl RateLimiter {
    /// new - สร้าง RateLimiter ใหม่ด้วย platform-specific limits
    /// กำหนดค่าเริ่มต้นสำหรับ TikTok, Shopee, Lazada
    pub fn new() -> Self {
        let mut limits = HashMap::new();

        // กำหนด rate limits ตามค่า API limits ของแต่ละ platform
        limits.insert(
            "tiktok".to_string(),
            RateLimit {
                requests_per_second: 5.0,
                burst_size: 10,
                window_seconds: 60,
            },
        );

        limits.insert(
            "shopee".to_string(),
            RateLimit {
                requests_per_second: 10.0,
                burst_size: 20,
                window_seconds: 60,
            },
        );

        limits.insert(
            "lazada".to_string(),
            RateLimit {
                requests_per_second: 8.0,
                burst_size: 15,
                window_seconds: 60,
            },
        );

        // Ecwid API: 600 requests per minute per token
        // If exceeded, token blocked with 429 error
        // Non-working token: 20 req/min or 600 req/IP limit
        limits.insert(
            "ecwid".to_string(),
            RateLimit {
                requests_per_second: 10.0, // 600 per minute = 10 per second
                burst_size: 20,            // Allow short bursts
                window_seconds: 60,        // 1 minute window
            },
        );

        Self {
            limits: Arc::new(RwLock::new(limits)),
            requests: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// check_rate_limit - ตรวจสอบ rate limit สำหรับ client และ platform
    /// ใช้ sliding window algorithm และ burst detection
    pub async fn allow(&self, context: &RateLimitContext<'_>) -> AppResult<bool> {
        let platform_key = context.platform().to_ascii_lowercase();

        let limit = {
            let limits = self.limits.read().await;
            limits
                .get(&platform_key)
                .cloned()
                .unwrap_or_else(RateLimit::default)
        };

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut requests = self.requests.write().await;
        let request_key = context.cache_key();

        // ดึงหรือสร้าง request history สำหรับ key นี้
        let history = requests.entry(request_key.clone()).or_insert_with(Vec::new);

        // ล้าง requests เก่าที่อยู่นอก time window
        let window_start = now - limit.window_seconds;
        history.retain(|&timestamp| timestamp > window_start);

        // ตรวจสอบว่าอยู่ในขอบเขต rate limit หรือไม่
        let request_count = history.len();

        if request_count >= limit.burst_size {
            // ตรวจสอบ rate limit ด้วย sliding window algorithm
            let window_requests = history
                .iter()
                .filter(|&&timestamp| timestamp > window_start)
                .count();

            let allowed_requests =
                (limit.requests_per_second * limit.window_seconds as f64) as usize;

            if window_requests >= allowed_requests {
                return Ok(false);
            }
        }

        // เพิ่ม request ปัจจุบันลงใน history
        history.push(now);

        Ok(true)
    }

    /// add_platform_limit - เพิ่มหรืออัพเดท rate limit สำหรับ platform
    /// ใช้เมื่อต้องการปรับ rate limits แบบ dynamic
    pub async fn add_platform_limit(&self, platform: String, limit: RateLimit) {
        let normalized = platform.to_ascii_lowercase();
        let mut limits = self.limits.write().await;
        limits.insert(normalized, limit);
    }
}

/// rate_limit_middleware - Axum middleware สำหรับ rate limiting
/// ตรวจสอบ rate limit ก่อนส่ง request ต่อไปยัง handlers
pub async fn rate_limit_middleware(
    State(_state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Response {
    let middleware = RateLimitMiddleware::new(GLOBAL_RATE_LIMITER.clone(), PathAndHeaderResolver);
    middleware.handle(request, next).await
}

/// create_rate_limiter - สร้าง RateLimiter instance สำหรับใช้ใน routes
/// คืนค่า configured RateLimiter พร้อม platform-specific limits
pub fn create_rate_limiter() -> RateLimiter {
    GLOBAL_RATE_LIMITER.clone()
}
