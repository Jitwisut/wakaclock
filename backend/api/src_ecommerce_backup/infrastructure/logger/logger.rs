/// ไฟล์ logger.rs - ระบบ logging แบบ structured (Zap-inspired)
/// รองรับ context-aware logging, correlation IDs, และ performance tracking
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, error, info, trace, warn, Level};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// Logger struct inspired by Go's zap logger
/// Provides structured logging with high performance
/// โครงสร้าง Logger ที่ดัดแปลงมาจาก Go's zap logger
/// ให้การ logging แบบ structured ที่มีประสิทธิภาพสูง
#[derive(Clone, Debug)]
pub struct Logger {
    /// Internal logger handle for structured logging
    /// ใช้ tracing crate เป็น backend สำหรับ logging
    #[allow(dead_code)]
    inner: Arc<()>, // Placeholder since tracing is global
}

/// Log model for structured logging
/// โครงสร้างข้อมูล context สำหรับ structured logging
/// เก็บข้อมูลที่จำเป็นสำหรับ tracking, debugging, และ monitoring
#[derive(Debug, Clone, Serialize, Default)]
pub struct LogContext {
    pub uuid: Option<String>,            // correlation ID สำหรับ tracking request
    pub method: Option<String>,          // HTTP method (GET, POST, etc.)
    pub path: Option<String>,            // API endpoint path
    pub ip: Option<String>,              // client IP address
    pub app_name: Option<String>,        // ชื่อแอพพลิเคชัน
    pub provider: Option<String>,        // e-commerce platform provider
    pub third_party_url: Option<String>, // URL ของ third-party API
    pub request_body_size: Option<i64>,  // ขนาด request body (ใน bytes)
    pub is_queue: bool,                  // เป็น request จาก queue หรือไม่
    pub is_upload_request_file: bool,    // มีการ upload ไฟล์หรือไม่
    pub client_to_server_duration_us: Option<i64>, // เวลา client -> server (ใน microseconds)
    pub server_to_third_party_duration_us: Option<i64>, // เวลา server -> third-party
    pub is_send_webhook_to_client: bool, // ส่ง webhook กลับไป client หรือไม่
    pub webhook_client_url: Option<String>, // webhook URL ของ client
    pub start_time: Option<String>,      // เวลาเริ่มต้น request
    pub end_time: Option<String>,        // เวลาสิ้นสุด request
    pub worker_log: Option<WorkerLog>,   // ข้อมูลเฉพาะสำหรับ worker
    pub custom_fields: HashMap<String, serde_json::Value>, // fields เพิ่มเติมแบบ dynamic
}

/// โครงสร้างข้อมูล log สำหรับ worker processes
#[derive(Debug, Clone, Serialize)]
pub struct WorkerLog {
    pub message_id: String,                 // ID ของ message ที่ worker กำลังประมวลผล
    pub process_message_method: String,     // วิธีการประมวลผล message
    pub is_auto_confirmation_message: bool, // เป็น auto-confirm message หรือไม่
    pub worker_id: i32,                     // ID ของ worker thread/process
}

/// Response codes for structured logging
/// HTTP status codes ที่ใช้บ่อยสำหรับ logging
#[derive(Debug, Clone, Copy, Serialize)]
#[repr(i32)]
pub enum ResponseCode {
    Success = 200,            // สำเร็จ
    Created = 201,            // สร้าง resource ใหม่สำเร็จ
    Accepted = 202,           // รับ request แล้วแต่ยังประมวลผลไม่เสร็จ
    NoContent = 204,          // สำเร็จแต่ไม่มีข้อมูลตอบกลับ
    BadRequest = 400,         // request ไม่ถูกต้อง
    Unauthorized = 401,       // ยังไม่ได้ authenticate
    Forbidden = 403,          // ไม่มีสิทธิ์เข้าถึง
    NotFound = 404,           // ไม่พบ resource
    Conflict = 409,           // ขัดแย้งกับ state ปัจจุบัน
    InternalError = 500,      // ข้อผิดพลาดภายใน server
    ServiceUnavailable = 503, // service ไม่สามารถให้บริการได้ชั่วคราว
}

/// Response types for categorizing responses
/// ประเภทของ response สำหรับจัดกลุ่มและวิเคราะห์
#[derive(Debug, Clone, Serialize)]
pub enum ResponseType {
    Success,     // สำเร็จ (2xx)
    ClientError, // ข้อผิดพลาดจาก client (4xx)
    ServerError, // ข้อผิดพลาดจาก server (5xx)
    Redirect,    // redirect (3xx)
    Info,        // informational (1xx)
}

impl Logger {
    /// Create a new logger instance
    pub fn new() -> anyhow::Result<Self> {
        Ok(Logger {
            inner: Arc::new(()),
        })
    }

    /// Initialize global tracing/logging system
    pub fn init() -> anyhow::Result<Self> {
        let env_filter =
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

        let fmt_layer = fmt::layer()
            .with_target(false)
            .with_thread_ids(false)
            .with_thread_names(false)
            .with_file(true)
            .with_line_number(true)
            .with_level(true)
            .json();

        tracing_subscriber::registry()
            .with(env_filter)
            .with(fmt_layer)
            .try_init()
            .ok(); // Ignore if already initialized

        Ok(Logger {
            inner: Arc::new(()),
        })
    }

    /// Log info level with structured fields
    pub fn info(&self, message: &str, context: Option<&LogContext>) {
        match context {
            Some(ctx) => {
                info!(
                    message = message,
                    uuid = ctx.uuid.as_deref(),
                    method = ctx.method.as_deref(),
                    path = ctx.path.as_deref(),
                    ip = ctx.ip.as_deref(),
                    app_name = ctx.app_name.as_deref(),
                    provider = ctx.provider.as_deref(),
                    request_body_size = ctx.request_body_size,
                    is_queue = ctx.is_queue,
                    custom_fields = ?ctx.custom_fields,
                );
            }
            None => info!(message),
        }
    }

    /// Log error level with structured fields
    pub fn error(
        &self,
        message: &str,
        err: Option<&dyn std::error::Error>,
        context: Option<&LogContext>,
    ) {
        match (context, err) {
            (Some(ctx), Some(e)) => {
                error!(
                    message = message,
                    error = %e,
                    uuid = ctx.uuid.as_deref(),
                    method = ctx.method.as_deref(),
                    path = ctx.path.as_deref(),
                    ip = ctx.ip.as_deref(),
                    app_name = ctx.app_name.as_deref(),
                    provider = ctx.provider.as_deref(),
                    custom_fields = ?ctx.custom_fields,
                );
            }
            (Some(ctx), None) => {
                error!(
                    message = message,
                    uuid = ctx.uuid.as_deref(),
                    method = ctx.method.as_deref(),
                    path = ctx.path.as_deref(),
                    ip = ctx.ip.as_deref(),
                    custom_fields = ?ctx.custom_fields,
                );
            }
            (None, Some(e)) => error!(message = message, error = %e),
            (None, None) => error!(message),
        }
    }

    /// Log warning level with structured fields
    pub fn warn(&self, message: &str, context: Option<&LogContext>) {
        match context {
            Some(ctx) => {
                warn!(
                    message = message,
                    uuid = ctx.uuid.as_deref(),
                    method = ctx.method.as_deref(),
                    path = ctx.path.as_deref(),
                    ip = ctx.ip.as_deref(),
                    custom_fields = ?ctx.custom_fields,
                );
            }
            None => warn!(message),
        }
    }

    /// Log debug level with structured fields
    pub fn debug(&self, message: &str, context: Option<&LogContext>) {
        match context {
            Some(ctx) => {
                debug!(
                    message = message,
                    uuid = ctx.uuid.as_deref(),
                    method = ctx.method.as_deref(),
                    path = ctx.path.as_deref(),
                    custom_fields = ?ctx.custom_fields,
                );
            }
            None => debug!(message),
        }
    }

    /// Log trace level with structured fields
    pub fn trace(&self, message: &str, context: Option<&LogContext>) {
        match context {
            Some(ctx) => {
                trace!(
                    message = message,
                    uuid = ctx.uuid.as_deref(),
                    method = ctx.method.as_deref(),
                    path = ctx.path.as_deref(),
                    custom_fields = ?ctx.custom_fields,
                );
            }
            None => trace!(message),
        }
    }

    /// Combine log fields for structured output
    pub fn combine_log_fields(
        &self,
        mut context: LogContext,
        error: Option<Box<dyn std::error::Error>>,
        code: Option<ResponseCode>,
        response_type: Option<ResponseType>,
    ) -> LogContext {
        // Add error information if present
        if let Some(err) = error {
            context
                .custom_fields
                .insert("error".to_string(), serde_json::json!(err.to_string()));
        }

        // Add response code if present
        if let Some(c) = code {
            context
                .custom_fields
                .insert("code".to_string(), serde_json::json!(c as i32));
        }

        // Add response type if present
        if let Some(rt) = response_type {
            context
                .custom_fields
                .insert("type".to_string(), serde_json::json!(rt));
        }

        context
    }

    /// Log with custom level and context
    pub fn log(&self, level: Level, message: &str, context: Option<&LogContext>) {
        match level {
            Level::ERROR => self.error(message, None, context),
            Level::WARN => self.warn(message, context),
            Level::INFO => self.info(message, context),
            Level::DEBUG => self.debug(message, context),
            Level::TRACE => self.trace(message, context),
        }
    }

    /// Create a new log context builder
    pub fn context() -> LogContextBuilder {
        LogContextBuilder::new()
    }
}

/// Builder for LogContext
pub struct LogContextBuilder {
    context: LogContext,
}

impl Default for LogContextBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl LogContextBuilder {
    pub fn new() -> Self {
        LogContextBuilder {
            context: LogContext::default(),
        }
    }

    pub fn uuid(mut self, uuid: impl Into<String>) -> Self {
        self.context.uuid = Some(uuid.into());
        self
    }

    pub fn method(mut self, method: impl Into<String>) -> Self {
        self.context.method = Some(method.into());
        self
    }

    pub fn path(mut self, path: impl Into<String>) -> Self {
        self.context.path = Some(path.into());
        self
    }

    pub fn ip(mut self, ip: impl Into<String>) -> Self {
        self.context.ip = Some(ip.into());
        self
    }

    pub fn app_name(mut self, app_name: impl Into<String>) -> Self {
        self.context.app_name = Some(app_name.into());
        self
    }

    pub fn provider(mut self, provider: impl Into<String>) -> Self {
        self.context.provider = Some(provider.into());
        self
    }

    pub fn custom(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.context.custom_fields.insert(key.into(), value);
        self
    }

    pub fn build(self) -> LogContext {
        self.context
    }
}

/// Global logger instance
use std::sync::OnceLock;

static GLOBAL_LOGGER: OnceLock<Arc<Logger>> = OnceLock::new();

/// Get global logger instance
pub fn global() -> Arc<Logger> {
    GLOBAL_LOGGER
        .get_or_init(|| Arc::new(Logger::init().expect("Failed to initialize logger")))
        .clone()
}

/// Initialize tracing for compatibility
pub fn init_tracing() -> anyhow::Result<()> {
    Logger::init()?;
    Ok(())
}

/// Convenience macros for logging
#[macro_export]
macro_rules! log_info {
    ($msg:expr) => {
        $crate::infrastructure::logger::global().info($msg, None)
    };
    ($msg:expr, $ctx:expr) => {
        $crate::infrastructure::logger::global().info($msg, Some($ctx))
    };
}

#[macro_export]
macro_rules! log_error {
    ($msg:expr) => {
        $crate::infrastructure::logger::global().error($msg, None, None)
    };
    ($msg:expr, $err:expr) => {
        $crate::infrastructure::logger::global().error($msg, Some($err), None)
    };
    ($msg:expr, $err:expr, $ctx:expr) => {
        $crate::infrastructure::logger::global().error($msg, Some($err), Some($ctx))
    };
}

#[macro_export]
macro_rules! log_warn {
    ($msg:expr) => {
        $crate::infrastructure::logger::global().warn($msg, None)
    };
    ($msg:expr, $ctx:expr) => {
        $crate::infrastructure::logger::global().warn($msg, Some($ctx))
    };
}

#[macro_export]
macro_rules! log_debug {
    ($msg:expr) => {
        $crate::infrastructure::logger::global().debug($msg, None)
    };
    ($msg:expr, $ctx:expr) => {
        $crate::infrastructure::logger::global().debug($msg, Some($ctx))
    };
}
