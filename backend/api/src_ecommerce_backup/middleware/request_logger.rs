use axum::{
    extract::Request,
    http::{HeaderMap, Method, Uri, Version},
    middleware::Next,
    response::Response,
};
use std::time::{Duration, Instant};
use tracing::{info, warn};
use urlencoding;

/// Abstract sink for request/response logging.
pub trait RequestLogSink: Send + Sync {
    fn log_request(&self, method: &Method, uri: &Uri, version: Version, headers: &HeaderMap);
    fn log_response(
        &self,
        method: &Method,
        uri: &Uri,
        status: axum::http::StatusCode,
        duration: Duration,
    );
}

/// Tracing-based log sink used by default.
#[derive(Clone, Copy, Default)]
pub struct TracingLogSink;

impl RequestLogSink for TracingLogSink {
    fn log_request(&self, method: &Method, uri: &Uri, version: Version, headers: &HeaderMap) {
        fn format_http_version(version: Version) -> &'static str {
            match version {
                Version::HTTP_09 => "HTTP/0.9",
                Version::HTTP_10 => "HTTP/1.0",
                Version::HTTP_11 => "HTTP/1.1",
                Version::HTTP_2 => "HTTP/2.0",
                Version::HTTP_3 => "HTTP/3.0",
                _ => "HTTP/UNKNOWN",
            }
        }

        let user_agent = headers
            .get("user-agent")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("unknown");

        let content_type = headers
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("none");

        let x_auth_token = headers
            .get("x-auth-token")
            .map(|_| "present")
            .unwrap_or("absent");

        let authorization = headers
            .get("authorization")
            .map(|_| "present")
            .unwrap_or("absent");

        let client_ip = headers
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .or_else(|| headers.get("x-real-ip").and_then(|v| v.to_str().ok()))
            .unwrap_or("unknown");

        info!(
            "REQUEST: {} {} {} | IP: {} | UA: {} | Content-Type: {} | x-auth-token: {} | Authorization: {}",
            method,
            uri,
            format_http_version(version),
            client_ip,
            user_agent,
            content_type,
            x_auth_token,
            authorization
        );

        if let Some(query) = uri.query() {
            let decoded_query = urlencoding::decode(query)
                .map(|v| v.into_owned())
                .unwrap_or_else(|_| query.to_string());
            info!("  └─ Query: {}", decoded_query);
        }

        if uri.path() != "/" {
            info!("  └─ Path: {}", uri.path());
        }
    }

    fn log_response(
        &self,
        method: &Method,
        uri: &Uri,
        status: axum::http::StatusCode,
        duration: Duration,
    ) {
        let duration_ms = duration.as_millis();

        if status.is_success() || status.is_redirection() {
            info!(
                "RESPONSE: {} {} -> {} ({}ms)",
                method, uri, status, duration_ms
            );
        } else {
            warn!(
                "RESPONSE: {} {} -> {} ({}ms)",
                method, uri, status, duration_ms
            );
        }
    }
}

/// Structured request logger that delegates to a sink implementation.
pub struct RequestLogger<S = TracingLogSink> {
    sink: S,
}

impl<S> RequestLogger<S>
where
    S: RequestLogSink,
{
    pub fn new(sink: S) -> Self {
        Self { sink }
    }

    pub async fn handle(
        &self,
        req: Request,
        next: Next,
    ) -> Result<Response, axum::http::StatusCode> {
        let start = Instant::now();

        let method = req.method().clone();
        let uri = req.uri().clone();
        let version = req.version();
        let headers = req.headers().clone();

        self.sink.log_request(&method, &uri, version, &headers);

        let response = next.run(req).await;

        self.sink
            .log_response(&method, &uri, response.status(), start.elapsed());

        Ok(response)
    }
}

impl<S> RequestLogger<S>
where
    S: Default + RequestLogSink,
{
    pub fn with_default_sink() -> Self {
        Self { sink: S::default() }
    }
}

impl Default for RequestLogger<TracingLogSink> {
    fn default() -> Self {
        Self::with_default_sink()
    }
}

/// Middleware สำหรับ log incoming requests พร้อมรายละเอียด
pub async fn request_logger_middleware(
    req: Request,
    next: Next,
) -> Result<Response, axum::http::StatusCode> {
    RequestLogger::default().handle(req, next).await
}
