/// โมดูลสำหรับ Metrics และ Observability
///
/// โมดูลนี้จัดการการเก็บ metrics ต่างๆ ของระบบโดยใช้ Prometheus
/// เพื่อติดตามประสิทธิภาพและสุขภาพของแอปพลิเคชัน
///
/// ประเภท Metrics ที่เก็บ:
/// - HTTP requests และ response times
/// - Platform API calls และ durations
/// - OAuth attempts และ token refreshes
/// - Product sync operations
/// - Vector search queries
/// - Database query performance
/// - Cache hit/miss ratios
/// - Worker job processing
/// - System resources และ connections
use axum::{extract::Request, middleware::Next, response::Response};
use once_cell::sync::Lazy;
use prometheus::{
    register_counter_vec, register_gauge_vec, register_histogram_vec, CounterVec, Encoder,
    GaugeVec, HistogramVec, TextEncoder,
};
use std::time::Instant;

// HTTP metrics
pub static HTTP_REQUESTS_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "http_requests_total",
        "Total number of HTTP requests",
        &["method", "endpoint", "status"]
    )
    .unwrap()
});

pub static HTTP_REQUEST_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "http_request_duration_seconds",
        "HTTP request duration in seconds",
        &["method", "endpoint", "status"]
    )
    .unwrap()
});

// Platform metrics
pub static PLATFORM_API_CALLS: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "platform_api_calls_total",
        "Total number of platform API calls",
        &["platform", "operation", "status"]
    )
    .unwrap()
});

pub static PLATFORM_API_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "platform_api_duration_seconds",
        "Platform API call duration in seconds",
        &["platform", "operation"]
    )
    .unwrap()
});

// OAuth metrics
pub static OAUTH_ATTEMPTS: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "oauth_attempts_total",
        "Total number of OAuth attempts",
        &["platform", "status"]
    )
    .unwrap()
});

pub static OAUTH_TOKEN_REFRESHES: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "oauth_token_refreshes_total",
        "Total number of OAuth token refreshes",
        &["platform", "status"]
    )
    .unwrap()
});

// Product sync metrics
pub static PRODUCT_SYNC_TOTAL: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "product_sync_total",
        "Total number of products synced",
        &["platform", "shop_id"]
    )
    .unwrap()
});

pub static PRODUCT_SYNC_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "product_sync_duration_seconds",
        "Product sync duration in seconds",
        &["platform", "shop_id"]
    )
    .unwrap()
});

pub static PRODUCT_SYNC_BATCH_SIZE: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "product_sync_batch_size",
        "Number of products in sync batch",
        &["platform"]
    )
    .unwrap()
});

// Vector search metrics
pub static VECTOR_SEARCH_QUERIES: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "vector_search_queries_total",
        "Total number of vector search queries",
        &["status"]
    )
    .unwrap()
});

pub static VECTOR_SEARCH_LATENCY: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "vector_search_latency_seconds",
        "Vector search query latency in seconds",
        &["operation"]
    )
    .unwrap()
});

pub static VECTOR_EMBEDDINGS_GENERATED: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "vector_embeddings_generated_total",
        "Total number of embeddings generated",
        &["model"]
    )
    .unwrap()
});

// Database metrics
pub static DATABASE_QUERIES: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "database_queries_total",
        "Total number of database queries",
        &["database", "operation", "status"]
    )
    .unwrap()
});

pub static DATABASE_QUERY_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "database_query_duration_seconds",
        "Database query duration in seconds",
        &["database", "operation"]
    )
    .unwrap()
});

// Cache metrics
pub static CACHE_HITS: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "cache_hits_total",
        "Total number of cache hits",
        &["cache_type"]
    )
    .unwrap()
});

pub static CACHE_MISSES: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "cache_misses_total",
        "Total number of cache misses",
        &["cache_type"]
    )
    .unwrap()
});

// Worker metrics
pub static WORKER_JOBS_PROCESSED: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "worker_jobs_processed_total",
        "Total number of worker jobs processed",
        &["job_type", "status"]
    )
    .unwrap()
});

pub static WORKER_JOB_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "worker_job_duration_seconds",
        "Worker job processing duration in seconds",
        &["job_type"]
    )
    .unwrap()
});

pub static WORKER_QUEUE_SIZE: Lazy<GaugeVec> = Lazy::new(|| {
    register_gauge_vec!(
        "worker_queue_size",
        "Current size of worker job queue",
        &["job_type"]
    )
    .unwrap()
});

// System metrics
pub static ACTIVE_CONNECTIONS: Lazy<GaugeVec> = Lazy::new(|| {
    register_gauge_vec!(
        "active_connections",
        "Number of active connections",
        &["connection_type"]
    )
    .unwrap()
});

pub static SHOP_CONNECTIONS: Lazy<GaugeVec> = Lazy::new(|| {
    register_gauge_vec!(
        "shop_connections_total",
        "Total number of shop connections",
        &["platform", "status"]
    )
    .unwrap()
});

// Middleware to track HTTP metrics
pub async fn metrics_middleware(request: Request, next: Next) -> Response {
    let start = Instant::now();
    let method = request.method().to_string();
    let path = request.uri().path().to_string();

    // Normalize path for metrics (remove IDs)
    let endpoint = normalize_path(&path);

    let response = next.run(request).await;

    let duration = start.elapsed().as_secs_f64();
    let status = response.status().as_u16().to_string();

    HTTP_REQUESTS_TOTAL
        .with_label_values(&[&method, &endpoint, &status])
        .inc();

    HTTP_REQUEST_DURATION
        .with_label_values(&[&method, &endpoint, &status])
        .observe(duration);

    response
}

// Helper function to normalize paths for metrics
fn normalize_path(path: &str) -> String {
    let normalized_parts: Vec<String> = path
        .split('/')
        .filter(|part| !part.is_empty())
        .map(|part| {
            if is_dynamic_segment(part) {
                ":id".to_string()
            } else {
                part.to_string()
            }
        })
        .collect();

    if normalized_parts.is_empty() {
        String::new()
    } else {
        format!("/{}", normalized_parts.join("/"))
    }
}

fn is_dynamic_segment(part: &str) -> bool {
    if part.is_empty() {
        return false;
    }

    if part.chars().all(|c| c.is_ascii_digit()) {
        return true;
    }

    let digit_count = part.chars().filter(|c| c.is_ascii_digit()).count();
    if digit_count == 0 {
        return false;
    }

    if part.len() <= 3 && part.starts_with(|c| c == 'v' || c == 'V') {
        if part.chars().skip(1).all(|c| c.is_ascii_digit()) {
            return false;
        }
    }

    if part.contains('-') || part.contains('_') {
        return true;
    }

    digit_count >= 3 || part.len() > 10
}

// Export metrics in Prometheus format
pub async fn export_metrics() -> String {
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::new();
    encoder.encode(&metric_families, &mut buffer).unwrap();
    String::from_utf8(buffer).unwrap()
}

// Helper functions for tracking metrics
pub fn track_platform_api_call(platform: &str, operation: &str, success: bool) {
    let status = if success { "success" } else { "failure" };
    PLATFORM_API_CALLS
        .with_label_values(&[platform, operation, status])
        .inc();
}

pub fn track_platform_api_duration(platform: &str, operation: &str, duration: f64) {
    PLATFORM_API_DURATION
        .with_label_values(&[platform, operation])
        .observe(duration);
}

pub fn track_oauth_attempt(platform: &str, success: bool) {
    let status = if success { "success" } else { "failure" };
    OAUTH_ATTEMPTS.with_label_values(&[platform, status]).inc();
}

pub fn track_product_sync(platform: &str, shop_id: &str, count: u64, duration: f64) {
    PRODUCT_SYNC_TOTAL
        .with_label_values(&[platform, shop_id])
        .inc_by(count as f64);

    PRODUCT_SYNC_DURATION
        .with_label_values(&[platform, shop_id])
        .observe(duration);

    PRODUCT_SYNC_BATCH_SIZE
        .with_label_values(&[platform])
        .observe(count as f64);
}

pub fn track_vector_search(success: bool, duration: f64) {
    let status = if success { "success" } else { "failure" };
    VECTOR_SEARCH_QUERIES.with_label_values(&[status]).inc();

    VECTOR_SEARCH_LATENCY
        .with_label_values(&["search"])
        .observe(duration);
}

pub fn track_database_query(database: &str, operation: &str, success: bool, duration: f64) {
    let status = if success { "success" } else { "failure" };
    DATABASE_QUERIES
        .with_label_values(&[database, operation, status])
        .inc();

    DATABASE_QUERY_DURATION
        .with_label_values(&[database, operation])
        .observe(duration);
}

pub fn track_cache_access(cache_type: &str, hit: bool) {
    if hit {
        CACHE_HITS.with_label_values(&[cache_type]).inc();
    } else {
        CACHE_MISSES.with_label_values(&[cache_type]).inc();
    }
}

pub fn track_worker_job(job_type: &str, success: bool, duration: f64) {
    let status = if success { "success" } else { "failure" };
    WORKER_JOBS_PROCESSED
        .with_label_values(&[job_type, status])
        .inc();

    WORKER_JOB_DURATION
        .with_label_values(&[job_type])
        .observe(duration);
}

pub fn update_worker_queue_size(job_type: &str, size: f64) {
    WORKER_QUEUE_SIZE.with_label_values(&[job_type]).set(size);
}

pub fn update_active_connections(connection_type: &str, delta: f64) {
    ACTIVE_CONNECTIONS
        .with_label_values(&[connection_type])
        .add(delta);
}

pub fn update_shop_connections(platform: &str, active: u64, inactive: u64) {
    SHOP_CONNECTIONS
        .with_label_values(&[platform, "active"])
        .set(active as f64);

    SHOP_CONNECTIONS
        .with_label_values(&[platform, "inactive"])
        .set(inactive as f64);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_path() {
        assert_eq!(normalize_path("/api/products"), "/api/products");
        assert_eq!(
            normalize_path("/api/products/abc123def456"),
            "/api/products/:id"
        );
        assert_eq!(
            normalize_path("/api/shops/shop-123/products"),
            "/api/shops/:id/products"
        );
        assert_eq!(normalize_path("/"), "");
    }

    #[test]
    fn test_metrics_registration() {
        // Ensure metrics are registered without panic
        let _ = &*HTTP_REQUESTS_TOTAL;
        let _ = &*HTTP_REQUEST_DURATION;
        let _ = &*PLATFORM_API_CALLS;
        let _ = &*OAUTH_ATTEMPTS;
        let _ = &*PRODUCT_SYNC_TOTAL;
        let _ = &*VECTOR_SEARCH_QUERIES;
        let _ = &*DATABASE_QUERIES;
        let _ = &*CACHE_HITS;
        let _ = &*WORKER_JOBS_PROCESSED;
        let _ = &*ACTIVE_CONNECTIONS;
    }
}
