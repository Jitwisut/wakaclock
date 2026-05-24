/// โมดูลระบบ Logging - Structured Logging System
///
/// โมดูลนี้จัดการระบบ logging ที่ได้รับแรงบันดาลใจจาก Go's zap logger
/// รองรับการสร้าง context สำหรับ request tracing และ structured logging
///
/// # คุณสมบัติ
/// - LogContext สำหรับการสร้าง structured log entries
/// - WorkerLog สำหรับ background worker logging
/// - ResponseCode และ ResponseType สำหรับ HTTP response logging
/// - Global logger instance สำหรับใช้งานง่าย
/// - Fluent builder API สำหรับการสร้าง log context
///
/// # ตัวอย่างการใช้งาน
/// ```rust
/// use infrastructure::logger::{global, LogContext};
///
/// let logger = global();
/// let context = LogContext::builder()
///     .uuid("request-123")
///     .path("/api/products")
///     .build();
/// logger.info_with_context(&context, "Processing request");
/// ```
#[allow(clippy::module_inception)]
pub mod logger;

/// Export public API ของระบบ logging
pub use logger::{
    global, init_tracing, LogContext, LogContextBuilder, Logger, ResponseCode, ResponseType,
    WorkerLog,
};
