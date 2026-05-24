// crates/wakaclock-core/src/error.rs

use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("ClickHouse error: {0}")]
    ClickHouse(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Authentication failed: {0}")]
    Auth(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Queue error: {0}")]
    Queue(#[from] rusqlite::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

// ทำให้ส่งกลับ HTTP response ได้ (ใช้ใน server)
pub type AppResult<T> = Result<T, AppError>;
