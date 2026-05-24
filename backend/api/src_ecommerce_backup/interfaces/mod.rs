//! Interfaces Module
//! โมดูลสำหรับ interface definitions และ contracts
//!
//! ประกอบด้วย interfaces สำหรับ:
//! - `cache`: Cache operations
//! - `database`: Database operations
//! - `oauth_state`: OAuth state management
//! - `platform`: Platform integrations
//! - `platform_gateway`: Platform gateway patterns
//! - `queue`: Message queue operations
//! - `repository`: Data repository patterns
//! - `service`: Service layer patterns
//! - `worker`: Background worker patterns

/// Cache interface definitions
pub mod cache;

/// Database interface definitions
pub mod database;

/// OAuth state management interface
pub mod oauth_state;

/// Platform integration interfaces
pub mod platform;

/// Platform gateway interfaces
pub mod platform_gateway;

/// Message queue interfaces
pub mod queue;

/// Repository pattern interfaces
pub mod repository;

/// Service layer interfaces
pub mod service;

/// Worker pattern interfaces
pub mod worker;

/// Webhook interfaces
pub mod webhook;

pub use cache::{CacheEntry, CacheInterface};
pub use database::DatabaseInterface;
pub use oauth_state::{OAuthState, OAuthStateConfig, OAuthStateInterface};
pub use platform_gateway::{GatewayFactory, GatewayFactoryImpl, PlatformGateway};
pub use queue::{QueueInterface, QueueMessage, QueueStats, TopicConfig};
pub use repository::{QueryParams, Repository};
pub use service::Service;
pub use worker::{Job, Worker};

/// Common result type สำหรับ interfaces ทั้งหมด
/// ใช้สำหรับ type-safe error handling ข้าม interface boundaries
pub type InterfaceResult<T> = Result<T, InterfaceError>;

/// Common error type สำหรับ interface operations
/// กำหนด error categories สำหรับการทำงานระหว่าง layers
#[derive(Debug, thiserror::Error)]
pub enum InterfaceError {
    #[error("Operation failed: {0}")]
    OperationFailed(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Connection error: {0}")]
    ConnectionError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Internal error: {0}")]
    InternalError(String),

    #[error("External service error: {0}")]
    External(String),

    #[error("Not implemented: {0}")]
    NotImplemented(String),
}

impl From<anyhow::Error> for InterfaceError {
    fn from(err: anyhow::Error) -> Self {
        InterfaceError::InternalError(err.to_string())
    }
}

impl From<serde_json::Error> for InterfaceError {
    fn from(err: serde_json::Error) -> Self {
        InterfaceError::SerializationError(err.to_string())
    }
}
