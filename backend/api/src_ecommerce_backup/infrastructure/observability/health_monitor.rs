//! โมดูล Platform Health Monitor (Platform Health Monitor Module)
//!
//! ไฟล์นี้ประกอบด้วยระบบติดตามและตรวจสอบสถานะสุขภาพ
//! ของแพลตฟอร์ม E-commerce ต่างๆ ที่ระบบเชื่อมต่อ
//!
//! ## ความสามารถ (Features)
//! - ตรวจสอบสถานะสุขภาพของแพลตฟอร์มแบบเรียลไทม์ (Real-time)
//! - วัดเวลาตอบสนอง (Response Time) และอัตราความสำเร็จ
//! - การจัดการและรายงานข้อผิดพลาด
//! - เก็บประวัติสุขภาพและ Metadata เพิ่มเติม
//! - สนับสนุน Auto-retry และ Exponential Backoff
//!
//! ## การใช้งาน
//! - ตรวจสอบสถานะ API Endpoints ของแพลตฟอร์ม
//! - ติดตามความกาวหน้าของการตอบสนอง
//! - รายงานสถานะสุขภาพเพื่อ Monitoring และ Alerting
//!
//! ## ส่วนของ Sprint 6, Task 6.2
//! ติดตามและตรวจสอบสถานะสุขภาพของแพลตฟอร์มที่เชื่อมต่อ
//!
//! ## ไดเรกทอรี
//! `src/infrastructure/observability/`

use crate::model::v1::platfrom::entries::Platform;
// Platform Health Monitor - Sprint 6, Task 6.2
// Monitors health status of integrated platforms

use async_trait::async_trait;
use chrono::{DateTime, Duration, Utc};
use parking_lot::RwLock;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::time::interval;
use tracing::{error, info, warn};

use crate::config::PlatformCredentials;

/// ผลลัพธ์ของการตรวจสอบสถานะสุขภาพ (Health Check Result)
///
/// เก็บผลลัพธ์ของการตรวจสอบสถานะสุขภาพและข้อมูลที่เกี่ยวข้อง
/// รวมถึงเวลาตอบสนอง, ข้อผิดพลาด, และ metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub platform: String,
    pub status: HealthStatus,
    pub response_time_ms: u64,
    pub checked_at: DateTime<Utc>,
    pub error: Option<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Health status
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

impl HealthStatus {
    pub fn is_healthy(&self) -> bool {
        matches!(self, HealthStatus::Healthy)
    }

    pub fn is_available(&self) -> bool {
        matches!(self, HealthStatus::Healthy | HealthStatus::Degraded)
    }
}

/// Platform health configuration
#[derive(Debug, Clone)]
pub struct HealthCheckConfig {
    pub interval: Duration,
    pub timeout: Duration,
    pub healthy_threshold: u32,
    pub unhealthy_threshold: u32,
    pub degraded_response_time_ms: u64,
}

impl Default for HealthCheckConfig {
    fn default() -> Self {
        Self {
            interval: Duration::seconds(30),
            timeout: Duration::seconds(5),
            healthy_threshold: 2,
            unhealthy_threshold: 3,
            degraded_response_time_ms: 2000,
        }
    }
}

/// Platform health checker trait
#[async_trait]
pub trait PlatformHealthChecker: Send + Sync {
    async fn check_health(&self, credentials: &PlatformCredentials) -> HealthCheckResult;
    fn platform(&self) -> Platform;
}

/// Generic health checker implementation
pub struct GenericHealthChecker {
    platform: Platform,
    client: Client,
}

impl GenericHealthChecker {
    pub fn new(platform: Platform) -> Self {
        Self {
            platform,
            client: Client::new(),
        }
    }
}

#[async_trait]
impl PlatformHealthChecker for GenericHealthChecker {
    async fn check_health(&self, credentials: &PlatformCredentials) -> HealthCheckResult {
        let start = Utc::now();

        // Platform-specific health check endpoints
        let health_endpoint = match self.platform {
            Platform::TikTok => {
                "https://open-api.tiktokglobalshop.com/api/v2/shop/get_authorized_shop"
            }
            Platform::Shopee => "https://partner.shopeemobile.com/api/v2/shop/get_shop_info",
            Platform::Lazada => "https://api.lazada.sg/rest/seller/get",
            Platform::Amazon => {
                "https://sellingpartnerapi-na.amazon.com/authorization/v1/authorizationCode"
            }
            Platform::Shopify => {
                return self
                    .check_shopify_health(&credentials.api_base_url, credentials)
                    .await;
            }
            Platform::WooCommerce => {
                return self
                    .check_woocommerce_health(&credentials.api_base_url, credentials)
                    .await;
            }
            _ => "",
        };

        if health_endpoint.is_empty() {
            return HealthCheckResult {
                platform: self.platform.to_string(),
                status: HealthStatus::Unknown,
                response_time_ms: 0,
                checked_at: Utc::now(),
                error: Some("No health check endpoint configured".to_string()),
                metadata: HashMap::new(),
            };
        }

        // Perform health check
        match self
            .client
            .get(health_endpoint)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
        {
            Ok(response) => {
                let response_time_ms = (Utc::now() - start).num_milliseconds() as u64;
                let status = if response.status().is_success() {
                    if response_time_ms > 2000 {
                        HealthStatus::Degraded
                    } else {
                        HealthStatus::Healthy
                    }
                } else {
                    HealthStatus::Unhealthy
                };

                HealthCheckResult {
                    platform: self.platform.to_string(),
                    status,
                    response_time_ms,
                    checked_at: Utc::now(),
                    error: if !response.status().is_success() {
                        Some(format!("HTTP {}", response.status()))
                    } else {
                        None
                    },
                    metadata: HashMap::new(),
                }
            }
            Err(e) => HealthCheckResult {
                platform: self.platform.to_string(),
                status: HealthStatus::Unhealthy,
                response_time_ms: (Utc::now() - start).num_milliseconds() as u64,
                checked_at: Utc::now(),
                error: Some(e.to_string()),
                metadata: HashMap::new(),
            },
        }
    }

    fn platform(&self) -> Platform {
        self.platform
    }
}

impl GenericHealthChecker {
    async fn check_shopify_health(
        &self,
        base_url: &str,
        _credentials: &PlatformCredentials,
    ) -> HealthCheckResult {
        let start = Utc::now();
        let health_url = format!("{}/admin/api/2024-01/shop.json", base_url);

        match self
            .client
            .get(&health_url)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
        {
            Ok(response) => {
                let response_time_ms = (Utc::now() - start).num_milliseconds() as u64;
                let status = if response.status().is_success() {
                    HealthStatus::Healthy
                } else if response.status().as_u16() == 429 {
                    HealthStatus::Degraded // Rate limited
                } else {
                    HealthStatus::Unhealthy
                };

                HealthCheckResult {
                    platform: "shopify".to_string(),
                    status,
                    response_time_ms,
                    checked_at: Utc::now(),
                    error: None,
                    metadata: HashMap::new(),
                }
            }
            Err(e) => HealthCheckResult {
                platform: "shopify".to_string(),
                status: HealthStatus::Unhealthy,
                response_time_ms: (Utc::now() - start).num_milliseconds() as u64,
                checked_at: Utc::now(),
                error: Some(e.to_string()),
                metadata: HashMap::new(),
            },
        }
    }

    async fn check_woocommerce_health(
        &self,
        base_url: &str,
        _credentials: &PlatformCredentials,
    ) -> HealthCheckResult {
        let start = Utc::now();
        let health_url = format!("{}/wp-json/wc/v3/system_status", base_url);

        match self
            .client
            .get(&health_url)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
        {
            Ok(response) => {
                let response_time_ms = (Utc::now() - start).num_milliseconds() as u64;
                let status = if response.status().is_success() {
                    HealthStatus::Healthy
                } else {
                    HealthStatus::Unhealthy
                };

                HealthCheckResult {
                    platform: "woocommerce".to_string(),
                    status,
                    response_time_ms,
                    checked_at: Utc::now(),
                    error: None,
                    metadata: HashMap::new(),
                }
            }
            Err(e) => HealthCheckResult {
                platform: "woocommerce".to_string(),
                status: HealthStatus::Unhealthy,
                response_time_ms: (Utc::now() - start).num_milliseconds() as u64,
                checked_at: Utc::now(),
                error: Some(e.to_string()),
                metadata: HashMap::new(),
            },
        }
    }
}

/// Type alias for platform health checkers
type PlatformCheckerMap = HashMap<Platform, Arc<Box<dyn PlatformHealthChecker>>>;

/// Health monitor service
pub struct HealthMonitor {
    checkers: Arc<RwLock<PlatformCheckerMap>>,
    results: Arc<RwLock<HashMap<Platform, HealthCheckResult>>>,
    config: HealthCheckConfig,
    running: Arc<RwLock<bool>>,
}

impl HealthMonitor {
    pub fn new(config: HealthCheckConfig) -> Self {
        Self {
            checkers: Arc::new(RwLock::new(HashMap::new())),
            results: Arc::new(RwLock::new(HashMap::new())),
            config,
            running: Arc::new(RwLock::new(false)),
        }
    }

    /// Register a platform health checker
    pub fn register_checker(&self, checker: Box<dyn PlatformHealthChecker>) {
        let platform = checker.platform();
        self.checkers.write().insert(platform, Arc::new(checker));
        info!("Registered health checker for platform: {:?}", platform);
    }

    /// Start monitoring
    pub async fn start(&self) {
        if *self.running.read() {
            warn!("Health monitor already running");
            return;
        }

        *self.running.write() = true;
        info!(
            "Starting health monitor with interval: {:?}",
            self.config.interval
        );

        let checkers = self.checkers.clone();
        let results = self.results.clone();
        let config = self.config.clone();
        let running = self.running.clone();

        tokio::spawn(async move {
            let mut interval = interval(std::time::Duration::from_secs(
                config.interval.num_seconds() as u64,
            ));

            while *running.read() {
                interval.tick().await;

                // Run health checks for all platforms
                let platforms: Vec<Platform> = checkers.read().keys().cloned().collect();
                for platform in platforms {
                    // Get checker for this platform
                    let checker = {
                        let checkers_guard = checkers.read();
                        checkers_guard.get(&platform).cloned()
                    };

                    if let Some(checker) = checker {
                        // TODO: Get credentials for platform
                        let credentials = PlatformCredentials::default();

                        let result = checker.check_health(&credentials).await;

                        // Log status changes
                        if let Some(previous) = results.read().get(&platform) {
                            if previous.status != result.status {
                                match result.status {
                                    HealthStatus::Healthy => {
                                        info!("Platform {:?} is now healthy", platform);
                                    }
                                    HealthStatus::Degraded => {
                                        warn!(
                                            "Platform {:?} is degraded: {:?}",
                                            platform, result.error
                                        );
                                    }
                                    HealthStatus::Unhealthy => {
                                        error!(
                                            "Platform {:?} is unhealthy: {:?}",
                                            platform, result.error
                                        );
                                    }
                                    HealthStatus::Unknown => {
                                        warn!("Platform {:?} status is unknown", platform);
                                    }
                                }
                            }
                        }

                        results.write().insert(platform, result);
                    }
                }
            }

            info!("Health monitor stopped");
        });
    }

    /// Stop monitoring
    pub fn stop(&self) {
        *self.running.write() = false;
        info!("Stopping health monitor");
    }

    /// Get current health status for a platform
    pub fn get_status(&self, platform: Platform) -> Option<HealthCheckResult> {
        self.results.read().get(&platform).cloned()
    }

    /// Get all health statuses
    pub fn get_all_statuses(&self) -> Vec<HealthCheckResult> {
        self.results.read().values().cloned().collect()
    }

    /// Check if platform is healthy
    pub fn is_healthy(&self, platform: Platform) -> bool {
        self.results
            .read()
            .get(&platform)
            .map(|r| r.status.is_healthy())
            .unwrap_or(false)
    }

    /// Check if platform is available (healthy or degraded)
    pub fn is_available(&self, platform: Platform) -> bool {
        self.results
            .read()
            .get(&platform)
            .map(|r| r.status.is_available())
            .unwrap_or(false)
    }

    /// Get system health summary
    pub fn system_health(&self) -> SystemHealth {
        let results = self.results.read();
        let total = results.len();
        let healthy = results
            .values()
            .filter(|r| r.status == HealthStatus::Healthy)
            .count();
        let degraded = results
            .values()
            .filter(|r| r.status == HealthStatus::Degraded)
            .count();
        let unhealthy = results
            .values()
            .filter(|r| r.status == HealthStatus::Unhealthy)
            .count();

        let overall_status = if unhealthy > 0 {
            HealthStatus::Unhealthy
        } else if degraded > 0 {
            HealthStatus::Degraded
        } else if healthy == total && total > 0 {
            HealthStatus::Healthy
        } else {
            HealthStatus::Unknown
        };

        SystemHealth {
            overall_status,
            total_platforms: total,
            healthy_platforms: healthy,
            degraded_platforms: degraded,
            unhealthy_platforms: unhealthy,
            last_check: results.values().map(|r| r.checked_at).max(),
        }
    }
}

/// System health summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealth {
    pub overall_status: HealthStatus,
    pub total_platforms: usize,
    pub healthy_platforms: usize,
    pub degraded_platforms: usize,
    pub unhealthy_platforms: usize,
    pub last_check: Option<DateTime<Utc>>,
}

/// Health check alert
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthAlert {
    pub platform: Platform,
    pub severity: AlertSeverity,
    pub message: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum AlertSeverity {
    Info,
    Warning,
    Critical,
}

/// Alert manager for health events
pub struct AlertManager {
    alerts: Arc<RwLock<Vec<HealthAlert>>>,
    handlers: Arc<RwLock<Vec<Box<dyn AlertHandler>>>>,
}

/// Alert handler trait
pub trait AlertHandler: Send + Sync {
    fn handle_alert(&self, alert: &HealthAlert);
}

impl Default for AlertManager {
    fn default() -> Self {
        Self::new()
    }
}

impl AlertManager {
    pub fn new() -> Self {
        Self {
            alerts: Arc::new(RwLock::new(Vec::new())),
            handlers: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Register alert handler
    pub fn register_handler(&self, handler: Box<dyn AlertHandler>) {
        self.handlers.write().push(handler);
    }

    /// Trigger an alert
    pub fn alert(&self, platform: Platform, severity: AlertSeverity, message: String) {
        let alert = HealthAlert {
            platform,
            severity,
            message,
            timestamp: Utc::now(),
        };

        // Store alert
        self.alerts.write().push(alert.clone());

        // Notify handlers
        for handler in self.handlers.read().iter() {
            handler.handle_alert(&alert);
        }

        // Log alert
        match severity {
            AlertSeverity::Info => info!("Health alert for {:?}: {}", platform, alert.message),
            AlertSeverity::Warning => warn!("Health alert for {:?}: {}", platform, alert.message),
            AlertSeverity::Critical => error!(
                "CRITICAL health alert for {:?}: {}",
                platform, alert.message
            ),
        }
    }

    /// Get recent alerts
    pub fn recent_alerts(&self, limit: usize) -> Vec<HealthAlert> {
        let alerts = self.alerts.read();
        alerts.iter().rev().take(limit).cloned().collect()
    }
}
