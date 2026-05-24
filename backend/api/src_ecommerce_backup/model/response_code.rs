//! HTTP Response Code Model
//! โมเดลสำหรับจัดการ HTTP response codes และ error types
//!
//! ใช้สำหรับการจัดการ HTTP status codes และ error responses
//! ที่เป็นมาตรฐานใน REST API และ web services
//! รวมถึงการแปลงเป็น Axum HTTP responses

use axum::http::StatusCode;
use thiserror::Error;

/// ประเภทของ HTTP error responses ตามมาตรฐาน
/// ครอบคลุม HTTP status codes ที่ใช้บ่อยใน REST APIs
/// และสามารถแปลงเป็น Axum responses ได้โดยตรง
#[derive(Debug, Error)]
pub enum HttpError {
    #[error("OK: {0}")]
    Ok(String),

    #[error("Created: {0}")]
    Created(String),

    #[error("Accepted: {0}")]
    Accepted(String),

    #[error("No Content: {0}")]
    NoContent(String),

    #[error("Bad Request: {0}")]
    BadRequest(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Not Found: {0}")]
    NotFound(String),

    #[error("Method Not Allowed: {0}")]
    MethodNotAllowed(String),

    #[error("Not Acceptable: {0}")]
    NotAcceptable(String),

    #[error("Request Timeout: {0}")]
    RequestTimeout(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Gone: {0}")]
    Gone(String),

    #[error("Payload Too Large: {0}")]
    PayloadTooLarge(String),

    #[error("Unsupported Media Type: {0}")]
    UnsupportedMediaType(String),

    #[error("Unprocessable Entity: {0}")]
    UnprocessableEntity(String),

    #[error("Too Many Requests: {0}")]
    TooManyRequests(String),

    #[error("Internal Server Error: {0}")]
    InternalServerError(String),

    #[error("Not Implemented: {0}")]
    NotImplemented(String),

    #[error("Bad Gateway: {0}")]
    BadGateway(String),

    #[error("Service Unavailable: {0}")]
    ServiceUnavailable(String),

    #[error("Gateway Timeout: {0}")]
    GatewayTimeout(String),
}

impl HttpError {
    /// คืนค่า HTTP status code ที่เหมาะสมสำหรับ error นี้
    /// แปลงจาก error type เป็น HTTP status code ที่เหมาะสม
    pub fn status_code(&self) -> StatusCode {
        match self {
            HttpError::Ok(_) => StatusCode::OK,
            HttpError::Created(_) => StatusCode::CREATED,
            HttpError::Accepted(_) => StatusCode::ACCEPTED,
            HttpError::NoContent(_) => StatusCode::NO_CONTENT,
            HttpError::BadRequest(_) => StatusCode::BAD_REQUEST,
            HttpError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            HttpError::Forbidden(_) => StatusCode::FORBIDDEN,
            HttpError::NotFound(_) => StatusCode::NOT_FOUND,
            HttpError::MethodNotAllowed(_) => StatusCode::METHOD_NOT_ALLOWED,
            HttpError::NotAcceptable(_) => StatusCode::NOT_ACCEPTABLE,
            HttpError::RequestTimeout(_) => StatusCode::REQUEST_TIMEOUT,
            HttpError::Conflict(_) => StatusCode::CONFLICT,
            HttpError::Gone(_) => StatusCode::GONE,
            HttpError::PayloadTooLarge(_) => StatusCode::PAYLOAD_TOO_LARGE,
            HttpError::UnsupportedMediaType(_) => StatusCode::UNSUPPORTED_MEDIA_TYPE,
            HttpError::UnprocessableEntity(_) => StatusCode::UNPROCESSABLE_ENTITY,
            HttpError::TooManyRequests(_) => StatusCode::TOO_MANY_REQUESTS,
            HttpError::InternalServerError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            HttpError::NotImplemented(_) => StatusCode::NOT_IMPLEMENTED,
            HttpError::BadGateway(_) => StatusCode::BAD_GATEWAY,
            HttpError::ServiceUnavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            HttpError::GatewayTimeout(_) => StatusCode::GATEWAY_TIMEOUT,
        }
    }

    /// สร้าง HTTP response จาก error นี้
    /// คืนค่า tuple ของ (status code, error message)
    pub fn into_response(self) -> (StatusCode, String) {
        (self.status_code(), self.to_string())
    }
}
