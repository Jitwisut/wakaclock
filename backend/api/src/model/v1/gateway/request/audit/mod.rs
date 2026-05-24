//! Audit Request Models
//!
//! โมดูลนี้จัดการโครงสร้างข้อมูลสำหรับ audit logging requests
//! รวมถึงการค้นหาและสถิติของ audit logs สำหรับ compliance และ monitoring
//!
//! # Features
//! - Query parameters สำหรับกรอง audit logs
//! - Time range filtering สำหรับ historical analysis
//! - Platform และ action-specific filtering
//! - Statistics query parameters สำหรับ dashboard reporting

use chrono::{DateTime, Utc};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct AuditLogQueryParams {
    pub credential_id: Option<String>,
    pub principal_id: Option<String>,
    pub platform: Option<String>,
    pub action: Option<String>,
    pub success: Option<bool>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct AuditStatsQueryParams {
    pub principal_id: Option<String>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
}
