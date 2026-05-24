//! Error Model
//! โมเดลสำหรับจัดการ error handling และ error types ในระบบ
//!
//! ใช้สำหรับการจัดการ application errors, domain errors และ HTTP responses
//! รวมถึงการแปลง errors เป็น Axum HTTP responses
//! รองรับ type-safe error handling และ error propagation

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

/// ประเภทของ application errors หลักในระบบ
/// ครอบคลุม error types ที่อาจเกิดขึ้นในแอปพลิเคชัน
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Authentication error: {0}")]
    AuthError(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Internal error: {0}")]
    InternalError(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("External API error: {0}")]
    ExternalApiError(String),

    #[error("External service error: {0}")]
    ExternalServiceError(String),

    #[error("Queue error: {0}")]
    QueueError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Conflict error: {0}")]
    ConflictError(String),

    #[error("IO error: {0}")]
    IoError(String),

    #[error("Vector store error: {0}")]
    VectorStoreError(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Not implemented: {0}")]
    NotImplemented(String),

    #[error("Timeout error: {0}")]
    TimeoutError(String),

    #[error("RateLimit error {0}")]
    RateLimitError(String),

    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),
}

/// Type alias สำหรับ Result ที่ใช้ AppError
/// ใช้ทั่วทั้งแอปพลิเคชันเพื่อความสะดวกในการจัดการ errors
pub type AppResult<T> = Result<T, AppError>;

/// ประเภทของ domain-specific errors
/// ใช้สำหรับ business logic errors ใน domain layer
#[derive(Error, Debug)]
pub enum DomainError {
    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Entity not found: {0}")]
    EntityNotFound(String),

    #[error("Duplicate entity: {0}")]
    DuplicateEntity(String),

    #[error("External API error: {0}")]
    ExternalApiError(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Internal error: {0}")]
    InternalError(String),

    #[error(transparent)]
    Anyhow(#[from] anyhow::Error),
}

impl From<std::io::Error> for DomainError {
    fn from(err: std::io::Error) -> Self {
        DomainError::InternalError(err.to_string())
    }
}

/// Type alias สำหรับ external API errors
/// ใช้สำหรับ errors จากการเรียกใช้ third-party APIs
pub type ExternalApiError = anyhow::Error;

impl From<DomainError> for AppError {
    fn from(err: DomainError) -> Self {
        match err {
            DomainError::ValidationError(msg) => AppError::ValidationError(msg),
            DomainError::EntityNotFound(msg) => AppError::NotFound(msg),
            DomainError::DuplicateEntity(msg) => AppError::BadRequest(msg),
            DomainError::ExternalApiError(msg) => AppError::ExternalApiError(msg),
            DomainError::BadRequest(msg) => AppError::BadRequest(msg),
            DomainError::InternalError(msg) => AppError::InternalError(msg),
            DomainError::Anyhow(e) => AppError::Anyhow(e),
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::IoError(err.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::ExternalApiError(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::SerializationError(err.to_string())
    }
}

impl From<clickhouse::error::Error> for AppError {
    fn from(err: clickhouse::error::Error) -> Self {
        AppError::DatabaseError(err.to_string())
    }
}

impl From<crate::interfaces::InterfaceError> for AppError {
    fn from(err: crate::interfaces::InterfaceError) -> Self {
        match err {
            crate::interfaces::InterfaceError::OperationFailed(msg) => AppError::InternalError(msg),
            crate::interfaces::InterfaceError::NotFound(msg) => AppError::NotFound(msg),
            crate::interfaces::InterfaceError::InvalidInput(msg) => AppError::InvalidInput(msg),
            _ => AppError::InternalError(err.to_string()),
        }
    }
}

/// Implementation สำหรับการแปลง AppError เป็น Axum HTTP Response
/// จับคู่ status codes และ error messages เพื่อส่งกลับไปยัง client
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            AppError::AuthError(msg) => (StatusCode::UNAUTHORIZED, msg),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::ConflictError(msg) => (StatusCode::CONFLICT, msg),
            AppError::ValidationError(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::InvalidInput(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::RateLimitError(msg) => (StatusCode::TOO_MANY_REQUESTS, msg),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
        };

        let body = Json(json!({
            "error": error_message,
        }));

        (status, body).into_response()
    }
}
