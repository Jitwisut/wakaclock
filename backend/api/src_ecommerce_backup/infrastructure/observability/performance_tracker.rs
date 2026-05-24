//! โมดูล Performance Tracker (Performance Tracker Module)
//!
//! ไฟล์นี้ประกอบด้วยระบบติดตามและวิเคราะห์ Performance Metrics
//! ของ Gateway operations สำหรับการ Optimization และ Monitoring
//!
//! ## ความสามารถ (Features)
//! - ติดตามและบันทึก Performance Snapshots แบบ Real-time
//! - คำนวณ Performance Percentiles (P50, P90, P95, P99)
//! - วิเคราะห์ Trends และ Patterns ในข้อมูล Performance
//! - จัดการ Sliding Window สำหรับ Historical Data
//! - สนับสนุน Performance Alerts และ Degradation Detection
//!
//! ## การใช้งาน
//! - เก็บ Performance Snapshots จากทุก Gateway Operation
//! - คำนวณ Percentile Metrics สำหรับ SLA Monitoring
//! - วิเคราะห์ Performance Trends เพื่อ Capacity Planning
//! - ตรวจจับ Performance Regressions และ Optimization Opportunities
//!
//! ## ส่วนของ Sprint 6, Task 6.3
//! ติดตามและวิเคราะห์ Gateway performance metrics
//!
//! ## ไดเรกทอรี
//! `src/infrastructure/observability/`

use crate::model::v1::platfrom::entries::Platform;
use std::str::FromStr;
// Performance Tracking - Sprint 6, Task 6.3
// Tracks and analyzes gateway performance metrics

use chrono::{DateTime, Duration, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tracing::{info, warn};

/// Performance snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceSnapshot {
    pub timestamp: DateTime<Utc>,
    pub platform: Platform,
    pub operation: String,
    pub response_time_ms: u64,
    pub success: bool,
    pub error_type: Option<String>,
}

/// Performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub p50: f64,
    pub p90: f64,
    pub p95: f64,
    pub p99: f64,
    pub mean: f64,
    pub std_dev: f64,
    pub min: f64,
    pub max: f64,
    pub success_rate: f64,
    pub throughput: f64,
    pub error_rate: f64,
}

/// Performance window for rolling metrics
#[derive(Debug, Clone)]
pub struct PerformanceWindow {
    snapshots: VecDeque<PerformanceSnapshot>,
    window_duration: Duration,
    max_size: usize,
}

impl PerformanceWindow {
    pub fn new(window_duration: Duration, max_size: usize) -> Self {
        Self {
            snapshots: VecDeque::with_capacity(max_size),
            window_duration,
            max_size,
        }
    }

    pub fn add_snapshot(&mut self, snapshot: PerformanceSnapshot) {
        // Remove old snapshots outside window
        let cutoff = Utc::now() - self.window_duration;
        while let Some(front) = self.snapshots.front() {
            if front.timestamp < cutoff {
                self.snapshots.pop_front();
            } else {
                break;
            }
        }

        // Add new snapshot
        self.snapshots.push_back(snapshot);

        // Maintain max size
        while self.snapshots.len() > self.max_size {
            self.snapshots.pop_front();
        }
    }

    pub fn calculate_metrics(&self) -> Option<PerformanceMetrics> {
        if self.snapshots.is_empty() {
            return None;
        }

        let mut response_times: Vec<f64> = self
            .snapshots
            .iter()
            .map(|s| s.response_time_ms as f64)
            .collect();

        response_times.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let success_count = self.snapshots.iter().filter(|s| s.success).count();
        let total_count = self.snapshots.len();
        let error_count = total_count - success_count;

        // Calculate percentiles
        let p50 = percentile(&response_times, 0.50);
        let p90 = percentile(&response_times, 0.90);
        let p95 = percentile(&response_times, 0.95);
        let p99 = percentile(&response_times, 0.99);

        // Calculate mean and std dev
        let sum: f64 = response_times.iter().sum();
        let mean = sum / total_count as f64;

        let variance: f64 = response_times
            .iter()
            .map(|x| (x - mean).powi(2))
            .sum::<f64>()
            / total_count as f64;
        let std_dev = variance.sqrt();

        // Calculate time window for throughput
        if let (Some(first), Some(last)) = (self.snapshots.front(), self.snapshots.back()) {
            let duration_secs = (last.timestamp - first.timestamp).num_seconds() as f64;
            let throughput = if duration_secs > 0.0 {
                total_count as f64 / duration_secs
            } else {
                0.0
            };

            Some(PerformanceMetrics {
                p50,
                p90,
                p95,
                p99,
                mean,
                std_dev,
                min: response_times.first().copied().unwrap_or(0.0),
                max: response_times.last().copied().unwrap_or(0.0),
                success_rate: success_count as f64 / total_count as f64,
                throughput,
                error_rate: error_count as f64 / total_count as f64,
            })
        } else {
            None
        }
    }
}

fn percentile(sorted_data: &[f64], percentile: f64) -> f64 {
    if sorted_data.is_empty() {
        return 0.0;
    }

    let index = (percentile * (sorted_data.len() - 1) as f64) as usize;
    sorted_data[index]
}

/// Performance tracker service
pub struct PerformanceTracker {
    windows: Arc<RwLock<HashMap<String, PerformanceWindow>>>,
    alerts: Arc<RwLock<Vec<PerformanceAlert>>>,
    config: PerformanceConfig,
}

/// Performance configuration
#[derive(Debug, Clone)]
pub struct PerformanceConfig {
    pub window_duration: Duration,
    pub max_snapshots: usize,
    pub p95_threshold_ms: u64,
    pub error_rate_threshold: f64,
    pub min_samples: usize,
}

impl Default for PerformanceConfig {
    fn default() -> Self {
        Self {
            window_duration: Duration::seconds(300), // 5 minutes
            max_snapshots: 1000,
            p95_threshold_ms: 2000,
            error_rate_threshold: 0.05, // 5%
            min_samples: 10,
        }
    }
}

/// Performance alert
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceAlert {
    pub timestamp: DateTime<Utc>,
    pub platform: Platform,
    pub operation: String,
    pub alert_type: AlertType,
    pub message: String,
    pub metrics: PerformanceMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertType {
    HighLatency,
    HighErrorRate,
    Degradation,
}

impl PerformanceTracker {
    pub fn new(config: PerformanceConfig) -> Self {
        Self {
            windows: Arc::new(RwLock::new(HashMap::new())),
            alerts: Arc::new(RwLock::new(Vec::new())),
            config,
        }
    }

    /// Track a performance snapshot
    pub fn track(
        &self,
        platform: Platform,
        operation: String,
        response_time_ms: u64,
        success: bool,
        error_type: Option<String>,
    ) {
        let snapshot = PerformanceSnapshot {
            timestamp: Utc::now(),
            platform,
            operation: operation.clone(),
            response_time_ms,
            success,
            error_type,
        };

        let key = format!("{}:{}", platform, operation);

        // Update window
        let mut windows = self.windows.write();
        let window = windows.entry(key.clone()).or_insert_with(|| {
            PerformanceWindow::new(self.config.window_duration, self.config.max_snapshots)
        });

        window.add_snapshot(snapshot);

        // Check for alerts
        if let Some(metrics) = window.calculate_metrics() {
            if window.snapshots.len() >= self.config.min_samples {
                self.check_alerts(&key, platform, &operation, &metrics);
            }
        }
    }

    fn check_alerts(
        &self,
        key: &str,
        platform: Platform,
        operation: &str,
        metrics: &PerformanceMetrics,
    ) {
        let mut alerts = Vec::new();

        // Check P95 latency
        if metrics.p95 > self.config.p95_threshold_ms as f64 {
            alerts.push(PerformanceAlert {
                timestamp: Utc::now(),
                platform,
                operation: operation.to_string(),
                alert_type: AlertType::HighLatency,
                message: format!(
                    "P95 latency {}ms exceeds threshold {}ms",
                    metrics.p95 as u64, self.config.p95_threshold_ms
                ),
                metrics: metrics.clone(),
            });
        }

        // Check error rate
        if metrics.error_rate > self.config.error_rate_threshold {
            alerts.push(PerformanceAlert {
                timestamp: Utc::now(),
                platform,
                operation: operation.to_string(),
                alert_type: AlertType::HighErrorRate,
                message: format!(
                    "Error rate {:.2}% exceeds threshold {:.2}%",
                    metrics.error_rate * 100.0,
                    self.config.error_rate_threshold * 100.0
                ),
                metrics: metrics.clone(),
            });
        }

        // Log and store alerts
        for alert in alerts {
            match alert.alert_type {
                AlertType::HighLatency => {
                    warn!("Performance alert for {}: {}", key, alert.message);
                }
                AlertType::HighErrorRate => {
                    warn!("Error rate alert for {}: {}", key, alert.message);
                }
                AlertType::Degradation => {
                    info!("Performance degradation for {}: {}", key, alert.message);
                }
            }

            self.alerts.write().push(alert);
        }
    }

    /// Get metrics for a platform/operation
    pub fn get_metrics(&self, platform: Platform, operation: &str) -> Option<PerformanceMetrics> {
        let key = format!("{}:{}", platform, operation);
        self.windows.read().get(&key)?.calculate_metrics()
    }

    /// Get all current metrics
    pub fn get_all_metrics(&self) -> HashMap<String, PerformanceMetrics> {
        let mut all_metrics = HashMap::new();
        let windows = self.windows.read();

        for (key, window) in windows.iter() {
            if let Some(metrics) = window.calculate_metrics() {
                all_metrics.insert(key.clone(), metrics);
            }
        }

        all_metrics
    }

    /// Get recent alerts
    pub fn get_alerts(&self, limit: usize) -> Vec<PerformanceAlert> {
        let alerts = self.alerts.read();
        alerts.iter().rev().take(limit).cloned().collect()
    }

    /// Clear old alerts
    pub fn clear_old_alerts(&self, older_than: Duration) {
        let cutoff = Utc::now() - older_than;
        self.alerts.write().retain(|a| a.timestamp >= cutoff);
    }

    /// Get platform summary
    pub fn platform_summary(&self, platform: Platform) -> PlatformPerformanceSummary {
        let windows = self.windows.read();
        let mut operations = Vec::new();
        let mut total_requests = 0;
        let mut total_errors = 0;
        let mut total_response_time = 0.0;

        for (key, window) in windows.iter() {
            if key.starts_with(&format!("{}:", platform)) {
                if let Some(metrics) = window.calculate_metrics() {
                    let operation = key.split(':').nth(1).unwrap_or("unknown");
                    let request_count = window.snapshots.len();
                    total_requests += request_count;
                    total_errors += (request_count as f64 * metrics.error_rate) as usize;
                    total_response_time += metrics.mean * request_count as f64;

                    operations.push(OperationPerformance {
                        operation: operation.to_string(),
                        metrics,
                    });
                }
            }
        }

        PlatformPerformanceSummary {
            platform,
            operations,
            total_requests,
            total_errors,
            avg_response_time: if total_requests > 0 {
                total_response_time / total_requests as f64
            } else {
                0.0
            },
            overall_success_rate: if total_requests > 0 {
                (total_requests - total_errors) as f64 / total_requests as f64
            } else {
                0.0
            },
        }
    }
}

/// Platform performance summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformPerformanceSummary {
    pub platform: Platform,
    pub operations: Vec<OperationPerformance>,
    pub total_requests: usize,
    pub total_errors: usize,
    pub avg_response_time: f64,
    pub overall_success_rate: f64,
}

/// Operation performance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationPerformance {
    pub operation: String,
    pub metrics: PerformanceMetrics,
}

/// Performance comparison
pub struct PerformanceComparator {
    tracker: Arc<PerformanceTracker>,
}

impl PerformanceComparator {
    pub fn new(tracker: Arc<PerformanceTracker>) -> Self {
        Self { tracker }
    }

    /// Compare platforms
    pub fn compare_platforms(&self) -> Vec<PlatformComparison> {
        let mut comparisons = Vec::new();
        let all_metrics = self.tracker.get_all_metrics();

        // Group by operation
        let mut operations: HashMap<String, Vec<(Platform, PerformanceMetrics)>> = HashMap::new();

        for (key, metrics) in all_metrics {
            if let Some((platform_str, operation)) = key.split_once(':') {
                if let Ok(platform) = Platform::from_str(platform_str) {
                    operations
                        .entry(operation.to_string())
                        .or_default()
                        .push((platform, metrics));
                }
            }
        }

        // Create comparisons
        for (operation, platform_metrics) in operations {
            if platform_metrics.len() > 1 {
                comparisons.push(PlatformComparison {
                    operation,
                    platforms: platform_metrics,
                });
            }
        }

        comparisons
    }
}

/// Platform comparison result
#[derive(Debug, Clone, Serialize)]
pub struct PlatformComparison {
    pub operation: String,
    pub platforms: Vec<(Platform, PerformanceMetrics)>,
}

lazy_static::lazy_static! {
    static ref PERFORMANCE_TRACKER: PerformanceTracker = PerformanceTracker::new(PerformanceConfig::default());
}

/// Get global performance tracker
pub fn performance_tracker() -> &'static PerformanceTracker {
    &PERFORMANCE_TRACKER
}
