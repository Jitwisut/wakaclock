/// ไฟล์ error.rs - Infrastructure error types และ re-exports
/// จัดการ error handling ในระดับ infrastructure layer
/// Re-export error types จาก model layer เพื่อความสะดวกในการใช้งาน
// Re-export error types จาก model layer สำหรับ infrastructure components
pub use crate::model::error::{AppError, AppResult, DomainError, ExternalApiError};
