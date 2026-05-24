//! # Gateway Audit Response Models
//!
//! โมดูลนี้กำหนดโครงสร้างข้อมูลสำหรับการ audit และ logging
//! ใช้สำหรับติดตามการใช้งานและความปลอดภัยของระบบ
//!
//! ## ฟีเจอร์หลัก
//! - Audit action tracking และ logging
//! - Credential access monitoring
//! - Success rate และ performance metrics
//! - Search และ filter capabilities
//! - Security compliance reporting

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditAction {
    Create,
    Read,
    Update,
    Rotate,
    Delete,
    RefreshToken,
    Share,
    RevokeShare,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialAuditLog {
    pub id: String,
    pub credential_id: String,
    pub principal_id: String,
    pub platform: String,
    pub action: AuditAction,
    pub success: bool,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AuditStats {
    pub total_logs: usize,
    pub success_rate: f64,
    pub actions_by_type: HashMap<String, usize>,
}

#[derive(Debug, Serialize)]
pub struct AuditLogSearchResponse {
    pub logs: Vec<CredentialAuditLog>,
    pub total: usize,
    pub page: usize,
    pub limit: usize,
}
