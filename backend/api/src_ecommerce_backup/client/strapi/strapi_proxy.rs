/// จัดการการ proxy HTTP requests จาก Rust backend ไปยัง Strapi API
/// รวมถึงการจัดการ headers, query parameters และ request body
///
/// คุณสมบัติ:
/// - รองรับ HTTP methods ทั้งหมดที่จำเป็น (GET, POST, PUT, PATCH, DELETE)
/// - Forward authorization headers อัตโนมัติ
/// - จัดการ query parameters และ request body
/// - Error handling และ logging
/// - Security headers filtering
use axum::{
    body::Body,
    extract::{OriginalUri, State},
    http::{header, HeaderMap, Method, StatusCode},
    response::Response,
};
use reqwest::Client;
use std::sync::Arc;
use tracing::{error, info};

use crate::AppState;

pub async fn proxy_to_strapi(
    State(_state): State<Arc<AppState>>,
    method: Method,
    OriginalUri(original_uri): OriginalUri,
    headers: HeaderMap,
    body: Body,
) -> Result<Response<Body>, StatusCode> {
    let strapi_url =
        std::env::var("STRAPI_BACKEND_URL").unwrap_or_else(|_| "http://localhost:1338".to_string());

    // Extract the path and query from the original URI
    let path = original_uri.path();
    let query = original_uri.query();

    // Build the full URL with query parameters
    let url = if let Some(q) = query {
        format!("{}{}?{}", strapi_url, path, q)
    } else {
        format!("{}{}", strapi_url, path)
    };

    info!("Proxying request to Strapi: {} {}", method, url);

    let client = Client::new();
    let mut request = match method {
        Method::GET => client.get(&url),
        Method::POST => client.post(&url),
        Method::PUT => client.put(&url),
        Method::PATCH => client.patch(&url),
        Method::DELETE => client.delete(&url),
        _ => {
            error!("Unsupported method: {}", method);
            return Err(StatusCode::METHOD_NOT_ALLOWED);
        }
    };

    // Forward relevant headers
    if let Some(content_type) = headers.get(header::CONTENT_TYPE) {
        request = request.header(header::CONTENT_TYPE, content_type);
    }

    // Forward authorization header if present
    if let Some(auth) = headers.get(header::AUTHORIZATION) {
        request = request.header(header::AUTHORIZATION, auth);
    }

    // Add body if present and method supports it
    if matches!(method, Method::POST | Method::PUT | Method::PATCH) {
        // Convert axum Body to bytes
        let body_bytes = match axum::body::to_bytes(body, usize::MAX).await {
            Ok(bytes) => bytes,
            Err(e) => {
                error!("Failed to read request body: {}", e);
                return Err(StatusCode::BAD_REQUEST);
            }
        };

        if !body_bytes.is_empty() {
            request = request.body(body_bytes);
        }
    }

    // Execute the request
    let response = request.send().await.map_err(|e| {
        error!("Failed to proxy request to Strapi: {}", e);
        StatusCode::BAD_GATEWAY
    })?;

    let status = response.status();
    let headers = response.headers().clone();
    let body_bytes = response.bytes().await.map_err(|e| {
        error!("Failed to read response body: {}", e);
        StatusCode::BAD_GATEWAY
    })?;

    // Build the response
    let mut response_builder = Response::builder().status(status.as_u16());

    // Copy relevant headers
    for (key, value) in headers.iter() {
        if key != header::CONNECTION && key != header::TRANSFER_ENCODING && key != "keep-alive" {
            response_builder = response_builder.header(key, value);
        }
    }

    response_builder.body(Body::from(body_bytes)).map_err(|e| {
        error!("Failed to build response: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })
}
