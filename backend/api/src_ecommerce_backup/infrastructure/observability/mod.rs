/// Observability Infrastructure Module - โมดูลโครงสร้างพื้นฐานสำหรับการติดตามและ Monitoring
///
/// จัดการระบบ observability ทั้งหมดสำหรับ application monitoring
/// รวมถึง metrics collection, tracing, health monitoring, และ performance tracking
///
/// # Modules
/// - `gateway_metrics` - เมตริกส์สำหรับ Gateway API และ platform integrations
/// - `health_monitor` - ระบบติดตามสุขภาพ services และ dependencies
/// - `metrics` - ระบบ metrics collection และ aggregation
/// - `performance_tracker` - การติดตาม performance และ response times
///
/// # Features
/// - OpenTelemetry integration (กำลัง disabled เนื่องจาก version conflicts)
/// - Structured logging ผ่าน tracing-subscriber
/// - Health check endpoints สำหรับ load balancers
/// - Performance metrics สำหรับ monitoring dashboards
/// - Request/response tracking และ error monitoring
///
/// # Usage
/// ```rust
/// // เริ่มต้น observability systems
/// init_telemetry("my-service")?;
/// init_metrics()?;
/// ```
pub mod gateway_metrics;
pub mod health_monitor;
pub mod metrics;
pub mod performance_tracker;

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

/// เริ่มต้นระบบ telemetry และ tracing
///
/// ตั้งค่า structured logging ผ่าน tracing-subscriber
/// **หมายเหตุ**: OpenTelemetry ถูก disabled ชั่วคราวเนื่องจาก axum version conflicts
///
/// # Arguments
/// * `service_name` - ชื่อ service (ไม่ได้ใช้ในปัจจุบัน)
///
/// # Returns
/// Result<()> - ผลลัพธ์การตั้งค่า telemetry
pub fn init_telemetry(service_name: &str) -> anyhow::Result<()> {
    // Set up basic tracing without OpenTelemetry dependency
    // Original OpenTelemetry integration was removed due to dependency conflicts
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::fmt::layer()
                .with_target(true)
                .with_thread_ids(true)
                .with_thread_names(true),
        )
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    // Log service startup with name
    tracing::info!(service = service_name, "Telemetry initialized");

    Ok(())
}

/// เริ่มต้นระบบ metrics collection
///
/// ตั้งค่าระบบสำหรับการรวบรวมและส่ง metrics
/// Metrics จะถูก initialize แบบ lazy loading ผ่าน once_cell::sync::Lazy
///
/// # Returns
/// Result<()> - ผลลัพธ์การตั้งค่า metrics
pub fn init_metrics() -> anyhow::Result<()> {
    // Register default process metrics (only available on Linux with process feature)
    #[cfg(all(target_os = "linux", feature = "collect_process_metrics"))]
    {
        prometheus::default_registry().register(Box::new(
            prometheus::process_collector::ProcessCollector::for_self(),
        ))?;
    }

    // Initialize lazy static metrics by accessing them
    // This ensures they are registered with the default registry
    let _ = &*metrics::HTTP_REQUESTS_TOTAL;
    let _ = &*metrics::HTTP_REQUEST_DURATION;
    let _ = &*metrics::PLATFORM_API_CALLS;
    let _ = &*metrics::PLATFORM_API_DURATION;
    let _ = &*metrics::OAUTH_ATTEMPTS;
    let _ = &*metrics::OAUTH_TOKEN_REFRESHES;
    let _ = &*metrics::PRODUCT_SYNC_TOTAL;
    let _ = &*metrics::PRODUCT_SYNC_DURATION;
    let _ = &*metrics::PRODUCT_SYNC_BATCH_SIZE;
    let _ = &*metrics::VECTOR_SEARCH_QUERIES;
    let _ = &*metrics::VECTOR_SEARCH_LATENCY;
    let _ = &*metrics::VECTOR_EMBEDDINGS_GENERATED;
    let _ = &*metrics::DATABASE_QUERIES;
    let _ = &*metrics::DATABASE_QUERY_DURATION;
    let _ = &*metrics::CACHE_HITS;
    let _ = &*metrics::CACHE_MISSES;
    let _ = &*metrics::WORKER_JOBS_PROCESSED;
    let _ = &*metrics::WORKER_JOB_DURATION;
    let _ = &*metrics::WORKER_QUEUE_SIZE;
    let _ = &*metrics::ACTIVE_CONNECTIONS;
    let _ = &*metrics::SHOP_CONNECTIONS;

    tracing::info!("Prometheus metrics initialized");
    Ok(())
}
