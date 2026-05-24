//! # Dead Letter Queue Manager - ตัวจัดการ Dead Letter Queue
//!
//! Service สำหรับจัดการ messages ที่ไม่สามารถประมวลผลได้สำเร็จ
//! รวมถึง retry logic, error tracking และ message recovery
//!
//! ## หน้าที่หลัก
//! - จัดการ failed messages ใน Dead Letter Queue
//! - ดำเนินการ retry mechanisms
//! - ติดตาม error patterns และ statistics
//! - ให้บริการ message recovery และ reprocessing

use async_trait::async_trait;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{error, info, instrument, warn};
use uuid::Uuid;

use crate::{
    infrastructure::{logger::Logger, queue::jetstream_config::SubjectBuilder},
    model::v1::{
        platfrom::entries::product_sync::messages::{DlqEnvelope, DlqError, DlqErrorKind},
        platfrom::entries::{AppError, AppResult},
    },
    worker::Worker,
    AppState,
};

/// Dead Letter Queue manager for handling failed messages
/// Provides analysis, retry, and recovery capabilities
pub struct DlqManager {
    state: Arc<AppState>,
    clickhouse_client: Arc<clickhouse::Client>,
    logger: Arc<Logger>,
    auto_recovery_enabled: bool,
    max_auto_retries: u32,
}

/// DLQ message classification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DlqMessage {
    pub id: String,
    pub original_subject: String,
    pub payload: serde_json::Value,
    pub error: DlqError,
    pub dlq_timestamp: DateTime<Utc>,
    pub trace_id: String,

    // Classification
    pub error_category: ErrorCategory,
    pub recovery_strategy: RecoveryStrategy,
    pub priority: u8,

    // Retry tracking
    pub dlq_retry_count: u32,
    pub last_retry_at: Option<DateTime<Utc>>,
    pub next_retry_at: Option<DateTime<Utc>>,

    // Resolution tracking
    pub status: DlqStatus,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<String>,
    pub resolution_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCategory {
    TransientNetworkError,
    RateLimitExceeded,
    AuthenticationFailure,
    AuthorizationFailure,
    ResourceNotFound,
    ValidationError,
    PlatformError,
    UnknownError,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecoveryStrategy {
    AutoRetry,
    ManualReview,
    SkipProduct,
    UpdateCredentials,
    ContactSupport,
    NoRecovery,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum DlqStatus {
    Pending,
    InReview,
    Retrying,
    Resolved,
    Skipped,
    Escalated,
}

/// DLQ analytics and statistics
#[derive(Debug, Serialize, Deserialize)]
pub struct DlqAnalytics {
    pub total_messages: u64,
    pub messages_by_platform: HashMap<String, u64>,
    pub messages_by_error_category: HashMap<ErrorCategory, u64>,
    pub messages_by_status: HashMap<DlqStatus, u64>,
    pub avg_resolution_time_hours: f64,
    pub top_error_patterns: Vec<ErrorPattern>,
    pub recovery_success_rate: f64,
    pub trend_data: TrendData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorPattern {
    pub pattern: String,
    pub count: u64,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
    pub platforms_affected: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrendData {
    pub daily_counts: Vec<(DateTime<Utc>, u64)>,
    pub hourly_distribution: HashMap<u32, u64>, // hour -> count
    pub platform_trends: HashMap<String, Vec<(DateTime<Utc>, u64)>>,
}

impl DlqManager {
    pub fn new(state: Arc<AppState>) -> Self {
        let clickhouse_client = Arc::new(
            clickhouse::Client::default()
                .with_url(&state.config.database.clickhouse_url)
                .with_user("default")
                .with_password("default")
                .with_database(&state.config.database.clickhouse_database),
        );

        Self {
            state,
            clickhouse_client,
            logger: crate::infrastructure::logger::global(),
            auto_recovery_enabled: true,
            max_auto_retries: 3,
        }
    }

    pub fn with_config(mut self, auto_recovery: bool, max_retries: u32) -> Self {
        self.auto_recovery_enabled = auto_recovery;
        self.max_auto_retries = max_retries;
        self
    }

    /// Process incoming DLQ messages from RabbitMQ
    #[instrument(skip(self, envelope))]
    pub async fn handle_dlq_message(&self, envelope: DlqEnvelope) -> AppResult<()> {
        info!(
            "Processing DLQ message for subject: {}",
            envelope.original_subject
        );

        // Classify the error and determine recovery strategy
        let error_category = self.classify_error(&envelope.error);
        let recovery_strategy = self.determine_recovery_strategy(&error_category, &envelope);

        let dlq_message = DlqMessage {
            id: Uuid::new_v4().to_string(),
            original_subject: envelope.original_subject.clone(),
            payload: envelope.payload.clone(),
            error: envelope.error.clone(),
            dlq_timestamp: envelope.dlq_timestamp,
            trace_id: envelope.trace_id.clone(),
            error_category: error_category.clone(),
            recovery_strategy: recovery_strategy.clone(),
            priority: self.calculate_priority(&error_category, &envelope),
            dlq_retry_count: 0,
            last_retry_at: None,
            next_retry_at: None,
            status: DlqStatus::Pending,
            resolved_at: None,
            resolved_by: None,
            resolution_notes: None,
        };

        // Store in DLQ storage for analysis and manual review
        self.store_dlq_message(&dlq_message).await?;

        // Attempt automatic recovery if enabled and appropriate
        if self.auto_recovery_enabled && self.should_auto_retry(&recovery_strategy) {
            self.attempt_auto_recovery(&dlq_message).await?;
        }

        // Send alerts for critical errors
        if self.is_critical_error(&error_category) {
            self.send_error_alert(&dlq_message).await?;
        }

        // Update analytics
        self.update_analytics(&dlq_message).await?;

        Ok(())
    }

    /// Classify error into categories for better handling
    fn classify_error(&self, error: &DlqError) -> ErrorCategory {
        match error.kind {
            DlqErrorKind::RateLimited => ErrorCategory::RateLimitExceeded,
            DlqErrorKind::Unauthorized => ErrorCategory::AuthenticationFailure,
            DlqErrorKind::Forbidden => ErrorCategory::AuthorizationFailure,
            DlqErrorKind::NotFound => ErrorCategory::ResourceNotFound,
            DlqErrorKind::ServerError => ErrorCategory::PlatformError,
            DlqErrorKind::NetworkTimeout => ErrorCategory::TransientNetworkError,
            DlqErrorKind::ParseError => ErrorCategory::ValidationError,
            DlqErrorKind::ValidationError => ErrorCategory::ValidationError,
            DlqErrorKind::MaxRetriesExceeded => {
                // Look at the original error message to classify
                if error.message.contains("rate limit") || error.message.contains("429") {
                    ErrorCategory::RateLimitExceeded
                } else if error.message.contains("timeout") || error.message.contains("network") {
                    ErrorCategory::TransientNetworkError
                } else if error.message.contains("auth") || error.message.contains("401") {
                    ErrorCategory::AuthenticationFailure
                } else {
                    ErrorCategory::UnknownError
                }
            }
        }
    }

    /// Determine the best recovery strategy for the error
    fn determine_recovery_strategy(
        &self,
        category: &ErrorCategory,
        envelope: &DlqEnvelope,
    ) -> RecoveryStrategy {
        match category {
            ErrorCategory::TransientNetworkError => RecoveryStrategy::AutoRetry,
            ErrorCategory::RateLimitExceeded => RecoveryStrategy::AutoRetry,
            ErrorCategory::ResourceNotFound => {
                // If it's a product not found, might want to skip
                if envelope.original_subject.contains("detail.request") {
                    RecoveryStrategy::SkipProduct
                } else {
                    RecoveryStrategy::ManualReview
                }
            }
            ErrorCategory::AuthenticationFailure => RecoveryStrategy::UpdateCredentials,
            ErrorCategory::AuthorizationFailure => RecoveryStrategy::UpdateCredentials,
            ErrorCategory::ValidationError => RecoveryStrategy::ManualReview,
            ErrorCategory::PlatformError => RecoveryStrategy::ContactSupport,
            ErrorCategory::UnknownError => RecoveryStrategy::ManualReview,
        }
    }

    /// Calculate priority for DLQ message processing
    fn calculate_priority(&self, category: &ErrorCategory, envelope: &DlqEnvelope) -> u8 {
        let mut priority: i32 = 128; // Medium priority baseline

        // Adjust based on error category
        match category {
            ErrorCategory::AuthenticationFailure | ErrorCategory::AuthorizationFailure => {
                priority = 50; // High priority - affects entire sync
            }
            ErrorCategory::RateLimitExceeded => {
                priority = 200; // Low priority - will resolve itself
            }
            ErrorCategory::TransientNetworkError => {
                priority = 150; // Lower priority
            }
            ErrorCategory::ResourceNotFound => {
                priority = 180; // Low priority
            }
            _ => {}
        }

        // Adjust based on original subject importance
        if envelope.original_subject.contains("list.request") {
            priority = priority.saturating_sub(30); // List requests more important
        }

        // Adjust based on retry count
        if envelope.error.retries > 5 {
            priority = priority.saturating_sub(20); // Higher priority for repeatedly failing items
        }

        priority.clamp(0, 255) as u8
    }

    /// Check if automatic retry should be attempted
    fn should_auto_retry(&self, strategy: &RecoveryStrategy) -> bool {
        matches!(strategy, RecoveryStrategy::AutoRetry)
    }

    /// Check if error is critical and needs immediate attention
    fn is_critical_error(&self, category: &ErrorCategory) -> bool {
        matches!(
            category,
            ErrorCategory::AuthenticationFailure | ErrorCategory::AuthorizationFailure
        )
    }

    /// Store DLQ message in ClickHouse for analysis
    async fn store_dlq_message(&self, message: &DlqMessage) -> AppResult<()> {
        let query = r#"
            INSERT INTO dlq_messages (
                id, original_subject, payload, error_kind, error_message, error_retries,
                dlq_timestamp, trace_id, error_category, recovery_strategy, priority,
                dlq_retry_count, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
        "#;

        self.clickhouse_client
            .query(query)
            .bind(&message.id)
            .bind(&message.original_subject)
            .bind(serde_json::to_string(&message.payload).unwrap())
            .bind(format!("{:?}", message.error.kind))
            .bind(&message.error.message)
            .bind(message.error.retries)
            .bind(message.dlq_timestamp)
            .bind(&message.trace_id)
            .bind(format!("{:?}", message.error_category))
            .bind(format!("{:?}", message.recovery_strategy))
            .bind(message.priority)
            .bind(message.dlq_retry_count)
            .bind(format!("{:?}", message.status))
            .execute()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to store DLQ message: {}", e)))?;

        Ok(())
    }

    /// Attempt automatic recovery for eligible messages
    async fn attempt_auto_recovery(&self, message: &DlqMessage) -> AppResult<()> {
        if message.dlq_retry_count >= self.max_auto_retries {
            warn!("DLQ message {} exceeded max auto retries", message.id);
            return Ok(());
        }

        info!("Attempting auto recovery for DLQ message {}", message.id);

        // Calculate retry delay based on error category
        let delay = self.calculate_retry_delay(&message.error_category, message.dlq_retry_count);

        // Wait for the delay
        tokio::time::sleep(std::time::Duration::from_millis(delay)).await;

        // Republish to original subject with retry headers
        let retry_payload = json!({
            "original_payload": message.payload,
            "dlq_retry_attempt": message.dlq_retry_count + 1,
            "dlq_message_id": message.id,
            "auto_recovery": true
        });

        let payload_bytes = serde_json::to_vec(&retry_payload).map_err(|e| {
            AppError::SerializationError(format!("Failed to serialize retry payload: {}", e))
        })?;

        match self
            .state
            .queue
            .publish_bytes(&message.original_subject, payload_bytes)
            .await
        {
            Ok(_) => {
                info!(
                    "Successfully republished DLQ message {} for auto recovery",
                    message.id
                );
                self.update_dlq_message_status(&message.id, DlqStatus::Retrying)
                    .await?;
            }
            Err(e) => {
                error!(
                    "Failed to republish DLQ message {} for auto recovery: {:?}",
                    message.id, e
                );
                self.increment_dlq_retry_count(&message.id).await?;
            }
        }

        Ok(())
    }

    /// Calculate retry delay with exponential backoff
    fn calculate_retry_delay(&self, category: &ErrorCategory, retry_count: u32) -> u64 {
        let base_delay = match category {
            ErrorCategory::RateLimitExceeded => 60000,     // 1 minute
            ErrorCategory::TransientNetworkError => 30000, // 30 seconds
            ErrorCategory::PlatformError => 120000,        // 2 minutes
            _ => 60000,                                    // 1 minute default
        };

        let max_delay = 15 * 60 * 1000; // 15 minutes max
        let delay = base_delay * 2_u64.pow(retry_count);
        delay.min(max_delay)
    }

    /// Send alert for critical errors
    async fn send_error_alert(&self, message: &DlqMessage) -> AppResult<()> {
        let alert_payload = json!({
            "alert_type": "DLQ_CRITICAL_ERROR",
            "dlq_message_id": message.id,
            "error_category": message.error_category,
            "original_subject": message.original_subject,
            "error_message": message.error.message,
            "trace_id": message.trace_id,
            "timestamp": Utc::now()
        });

        // Publish to alerts channel
        let payload_bytes = serde_json::to_vec(&alert_payload).map_err(|e| {
            AppError::SerializationError(format!("Failed to serialize alert: {}", e))
        })?;

        self.state
            .queue
            .publish_bytes("alerts.dlq.critical", payload_bytes)
            .await
            .map_err(|e| AppError::QueueError(format!("Failed to send alert: {}", e)))?;

        warn!("Sent critical error alert for DLQ message {}", message.id);
        Ok(())
    }

    /// Update analytics with new DLQ message
    async fn update_analytics(&self, message: &DlqMessage) -> AppResult<()> {
        // Extract platform from subject
        let platform = self.extract_platform_from_subject(&message.original_subject);

        // Update counters in ClickHouse analytics tables
        let query = r#"
            INSERT INTO dlq_analytics (
                date, platform, error_category, count, created_at
            ) VALUES (?, ?, ?, 1, now())
        "#;

        self.clickhouse_client
            .query(query)
            .bind(message.dlq_timestamp.date_naive())
            .bind(platform)
            .bind(format!("{:?}", message.error_category))
            .execute()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to update analytics: {}", e)))?;

        Ok(())
    }

    /// Extract platform name from RabbitMQ subject
    fn extract_platform_from_subject(&self, subject: &str) -> String {
        // Subject format: sync.products.{type}.request.{tenant}.{platform}
        let parts: Vec<&str> = subject.split('.').collect();
        if parts.len() >= 6 {
            parts[5].to_string()
        } else {
            "unknown".to_string()
        }
    }

    /// Update DLQ message status
    async fn update_dlq_message_status(
        &self,
        message_id: &str,
        status: DlqStatus,
    ) -> AppResult<()> {
        let query = r#"
            ALTER TABLE dlq_messages
            UPDATE status = ?, updated_at = now()
            WHERE id = ?
        "#;

        self.clickhouse_client
            .query(query)
            .bind(format!("{:?}", status))
            .bind(message_id)
            .execute()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to update DLQ status: {}", e)))?;

        Ok(())
    }

    /// Increment retry count for DLQ message
    async fn increment_dlq_retry_count(&self, message_id: &str) -> AppResult<()> {
        let query = r#"
            ALTER TABLE dlq_messages
            UPDATE dlq_retry_count = dlq_retry_count + 1, last_retry_at = now(), updated_at = now()
            WHERE id = ?
        "#;

        self.clickhouse_client
            .query(query)
            .bind(message_id)
            .execute()
            .await
            .map_err(|e| {
                AppError::DatabaseError(format!("Failed to increment retry count: {}", e))
            })?;

        Ok(())
    }

    /// Get DLQ messages for manual review
    pub async fn get_pending_dlq_messages(&self, _limit: u32) -> AppResult<Vec<DlqMessage>> {
        let _query = r#"
            SELECT * FROM dlq_messages
            WHERE status = 'Pending' OR status = 'InReview'
            ORDER BY priority ASC, dlq_timestamp ASC
            LIMIT ?
        "#;

        // TODO: Implement proper ClickHouse query for DLQ messages
        // For now, return empty list as this is a placeholder implementation
        Ok(Vec::new())
    }

    /// Manually resolve a DLQ message
    pub async fn resolve_dlq_message(
        &self,
        message_id: &str,
        resolution: DlqResolution,
        resolved_by: &str,
        notes: Option<String>,
    ) -> AppResult<()> {
        match resolution {
            DlqResolution::Retry => {
                // Republish the message
                let message = self.get_dlq_message(message_id).await?;
                let payload_bytes = serde_json::to_vec(&message.payload).map_err(|e| {
                    AppError::SerializationError(format!("Failed to serialize payload: {}", e))
                })?;

                self.state
                    .queue
                    .publish_bytes(&message.original_subject, payload_bytes)
                    .await
                    .map_err(|e| AppError::QueueError(format!("Failed to republish: {}", e)))?;

                self.update_dlq_resolution(message_id, DlqStatus::Resolved, resolved_by, notes)
                    .await?;
            }
            DlqResolution::Skip => {
                self.update_dlq_resolution(message_id, DlqStatus::Skipped, resolved_by, notes)
                    .await?;
            }
            DlqResolution::Escalate => {
                self.update_dlq_resolution(message_id, DlqStatus::Escalated, resolved_by, notes)
                    .await?;
                // Send escalation notification
                self.send_escalation_notification(message_id).await?;
            }
        }

        info!(
            "DLQ message {} resolved by {} with action: {:?}",
            message_id, resolved_by, resolution
        );
        Ok(())
    }

    async fn get_dlq_message(&self, _message_id: &str) -> AppResult<DlqMessage> {
        // Fetch DLQ message by ID
        // Implementation similar to get_pending_dlq_messages but for single message
        todo!("Implement get_dlq_message")
    }

    async fn update_dlq_resolution(
        &self,
        message_id: &str,
        status: DlqStatus,
        resolved_by: &str,
        notes: Option<String>,
    ) -> AppResult<()> {
        let query = r#"
            ALTER TABLE dlq_messages
            UPDATE status = ?, resolved_at = now(), resolved_by = ?, resolution_notes = ?, updated_at = now()
            WHERE id = ?
        "#;

        self.clickhouse_client
            .query(query)
            .bind(format!("{:?}", status))
            .bind(resolved_by)
            .bind(notes)
            .bind(message_id)
            .execute()
            .await
            .map_err(|e| AppError::DatabaseError(format!("Failed to update resolution: {}", e)))?;

        Ok(())
    }

    async fn send_escalation_notification(&self, message_id: &str) -> AppResult<()> {
        let notification = json!({
            "notification_type": "DLQ_ESCALATION",
            "dlq_message_id": message_id,
            "escalated_at": Utc::now(),
            "requires_attention": true
        });

        let payload_bytes = serde_json::to_vec(&notification).map_err(|e| {
            AppError::SerializationError(format!("Failed to serialize notification: {}", e))
        })?;

        self.state
            .queue
            .publish_bytes("notifications.dlq.escalation", payload_bytes)
            .await
            .map_err(|e| AppError::QueueError(format!("Failed to send escalation: {}", e)))?;

        Ok(())
    }

    /// Get comprehensive DLQ analytics
    pub async fn get_dlq_analytics(&self, _days: u32) -> AppResult<DlqAnalytics> {
        // Implementation would query ClickHouse for analytics data
        // This is a simplified structure
        Ok(DlqAnalytics {
            total_messages: 0,
            messages_by_platform: HashMap::new(),
            messages_by_error_category: HashMap::new(),
            messages_by_status: HashMap::new(),
            avg_resolution_time_hours: 0.0,
            top_error_patterns: Vec::new(),
            recovery_success_rate: 0.0,
            trend_data: TrendData {
                daily_counts: Vec::new(),
                hourly_distribution: HashMap::new(),
                platform_trends: HashMap::new(),
            },
        })
    }
}

/// DLQ resolution actions
#[derive(Debug, Clone)]
pub enum DlqResolution {
    Retry,    // Republish the message
    Skip,     // Mark as resolved without action
    Escalate, // Escalate to higher support level
}

/// DLQ subscriber that listens to DLQ subjects
pub struct DlqSubscriber {
    manager: Arc<DlqManager>,
}

impl DlqSubscriber {
    pub fn new(manager: Arc<DlqManager>) -> Self {
        Self { manager }
    }

    /// Start subscribing to DLQ subjects
    pub async fn start(&self) -> AppResult<()> {
        info!("Starting DLQ Subscriber");

        let dlq_subjects = vec![SubjectBuilder::list_dlq(), SubjectBuilder::detail_dlq()];

        for subject in dlq_subjects {
            let manager_clone = self.manager.clone();
            self.manager
                .state
                .queue
                .subscribe_bytes(
                    &subject,
                    Box::new(move |payload| {
                        let manager = manager_clone.clone();
                        tokio::spawn(async move {
                            if let Ok(envelope) = serde_json::from_slice::<DlqEnvelope>(&payload) {
                                if let Err(e) = manager.handle_dlq_message(envelope).await {
                                    error!("Failed to handle DLQ message: {:?}", e);
                                }
                            }
                        });
                        Ok(())
                    }),
                )
                .await?;
        }

        info!("DLQ Subscriber started successfully");
        Ok(())
    }
}

#[async_trait]
impl Worker for DlqManager {
    async fn start(&self) -> AppResult<()> {
        info!("Starting DLQ Manager");

        // Start DLQ subscriber
        let subscriber = DlqSubscriber::new(Arc::new(self.clone()));
        subscriber.start().await?;

        // Start periodic cleanup and analysis
        self.run_periodic_tasks().await
    }

    async fn stop(&self) -> AppResult<()> {
        info!("Stopping DLQ Manager");
        Ok(())
    }

    async fn process_job(&self, job_data: Vec<u8>) -> AppResult<()> {
        let envelope: DlqEnvelope = serde_json::from_slice(&job_data).map_err(|e| {
            AppError::SerializationError(format!("Failed to deserialize DLQ envelope: {}", e))
        })?;

        self.handle_dlq_message(envelope).await
    }
}

impl Clone for DlqManager {
    fn clone(&self) -> Self {
        Self {
            state: self.state.clone(),
            clickhouse_client: self.clickhouse_client.clone(),
            logger: self.logger.clone(),
            auto_recovery_enabled: self.auto_recovery_enabled,
            max_auto_retries: self.max_auto_retries,
        }
    }
}

impl DlqManager {
    async fn run_periodic_tasks(&self) -> AppResult<()> {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600)); // 1 hour

        loop {
            interval.tick().await;

            // Cleanup old resolved DLQ messages
            if let Err(e) = self.cleanup_old_messages(30).await {
                error!("Failed to cleanup old DLQ messages: {:?}", e);
            }

            // Generate periodic analytics reports
            if let Err(e) = self.generate_analytics_report().await {
                error!("Failed to generate analytics report: {:?}", e);
            }
        }
    }

    async fn cleanup_old_messages(&self, retention_days: u32) -> AppResult<()> {
        let cutoff_date = Utc::now() - Duration::days(retention_days as i64);

        let query = r#"
            ALTER TABLE dlq_messages
            DELETE WHERE status IN ('Resolved', 'Skipped')
            AND resolved_at < ?
        "#;

        self.clickhouse_client
            .query(query)
            .bind(cutoff_date)
            .execute()
            .await
            .map_err(|e| {
                AppError::DatabaseError(format!("Failed to cleanup DLQ messages: {}", e))
            })?;

        info!(
            "Cleaned up old DLQ messages older than {} days",
            retention_days
        );
        Ok(())
    }

    async fn generate_analytics_report(&self) -> AppResult<()> {
        let analytics = self.get_dlq_analytics(7).await?;

        info!(
            "DLQ Analytics Report: {} total messages",
            analytics.total_messages
        );
        // Additional reporting logic would go here

        Ok(())
    }
}
