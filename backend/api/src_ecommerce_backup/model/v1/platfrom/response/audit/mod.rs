use chrono::{DateTime, Utc};
/// ไฟล์ mod.rs - Audit Log Response Models
/// โครงสร้าง response สำหรับ audit logging system
/// ติดตามการใช้งาน credentials และการกระทำต่างๆ
/// ใช้สำหรับ compliance และ security monitoring
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// ประเภทของ audit action
/// ใช้สำหรับติดตามการกระทำต่างๆ ของ users
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuditAction {
    /// สร้าง resource ใหม่
    Create,
    /// อ่านข้อมูล
    Read,
    /// อัปเดทข้อมูล
    Update,
    /// Rotate credentials
    Rotate,
    /// ลบข้อมูล
    Delete,
    /// Refresh OAuth token
    RefreshToken,
    /// แชร์ credentials กับผู้อื่น
    Share,
    /// เพิกถอนการแชร์
    RevokeShare,
}

/// Audit log record สำหรับ credential actions
/// เก็บรายละเอียดการกระทำทั้งหมด
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialAuditLog {
    /// Unique audit log ID
    pub id: String,
    /// Credential ID ที่ถูกกระทำ
    pub credential_id: String,
    /// User ID ที่ทำการกระทำ
    pub principal_id: String,
    /// Platform name
    pub platform: String,
    /// ประเภทของ action
    pub action: AuditAction,
    /// สถานะความสำเร็จของ action
    pub success: bool,
    /// เวลาที่ทำ action
    pub timestamp: DateTime<Utc>,
}

/// สถิติสรุป audit logs
/// ใช้สำหรับ dashboard และ reporting
#[derive(Debug, Clone, Serialize)]
pub struct AuditStats {
    /// จำนวน logs ทั้งหมด
    pub total_logs: usize,
    /// อัตราความสำเร็จ (0.0 - 1.0)
    pub success_rate: f64,
    /// จำนวน actions แยกตามประเภท
    pub actions_by_type: HashMap<String, usize>,
}

/// Response สำหรับการค้นหา audit logs
/// รวม pagination และ total count
#[derive(Debug, Serialize)]
pub struct AuditLogSearchResponse {
    /// รายการ audit logs
    pub logs: Vec<CredentialAuditLog>,
    /// จำนวนทั้งหมด
    pub total: usize,
    /// หน้าปัจจุบัน
    pub page: usize,
    /// จำนวนต่อหน้า
    pub limit: usize,
}
