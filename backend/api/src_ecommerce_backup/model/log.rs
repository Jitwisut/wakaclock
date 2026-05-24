//! Log Model
//! โมเดลสำหรับจัดการการบันทึก logs และ monitoring
//!
//! ใช้สำหรับการบันทึกข้อมูล HTTP requests, worker jobs, และ system events
//! รวมถึงการติดตาม performance, debugging และ audit trails
//! รองรับ structured logging และ metrics collection

use chrono::{DateTime, Utc};
use std::collections::HashMap;

/// โครงสร้างข้อมูลสำหรับการบันทึก log entries
/// เก็บข้อมูลที่สำคัญสำหรับ debugging, monitoring และ analytics
pub struct Log {
    pub uuid: Option<String>,
    pub method: Option<String>,
    pub code: Option<i32>,
    pub path: Option<String>,
    pub ip: Option<String>,
    pub provider: Option<String>,
    pub third_party_url: Option<String>,
    pub app_name: Option<String>,
    pub request_body_size: Option<i64>,
    pub worker_log: Option<WorkerLog>,
    pub is_queue: Option<bool>,
    pub is_upload_request_file: Option<bool>,
    pub is_send_webhook_to_client: bool,
    pub custom_headers: Option<HashMap<String, String>>,
    pub webhook_client_url: String,
    pub client_to_server_duration_microseconds: Option<i64>,
    pub server_to_third_party_duration_microseconds: Option<i64>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub start_time_type_time: Option<DateTime<Utc>>,
}

/// โครงสร้างข้อมูลสำหรับการบันทึก worker job logs
/// ใช้สำหรับการติดตาม background jobs และ queue processing
pub struct WorkerLog {
    /// ID ของ worker instance
    /// ใช้สำหรับระบุ worker ที่ประมวลผล job
    pub worker_id: Option<i32>,
    /// ID ของ message ใน queue
    /// ใช้สำหรับการติดตาม queue messages
    pub message_id: Option<String>,
    /// flag สำหรับ auto confirmation
    /// true = ยืนยันอัตโนมัติ, false = manual confirmation
    pub is_auto_confirmation_message: Option<bool>,
    /// วิธีการที่ใช้ในการประมวลผล message
    /// เช่น "sync", "async", "batch" เป็นต้น
    pub process_message_method: Option<String>,
}

impl Default for Log {
    fn default() -> Self {
        Self::new()
    }
}

impl Log {
    pub fn new() -> Self {
        Self {
            uuid: None,
            method: None,
            code: None,
            path: None,
            ip: None,
            provider: None,
            third_party_url: None,
            app_name: None,
            request_body_size: None,
            worker_log: None,
            is_queue: None,
            is_upload_request_file: None,
            is_send_webhook_to_client: false,
            custom_headers: None,
            webhook_client_url: String::new(),
            client_to_server_duration_microseconds: None,
            server_to_third_party_duration_microseconds: None,
            start_time: None,
            end_time: None,
            start_time_type_time: None,
        }
    }
}

impl Default for WorkerLog {
    fn default() -> Self {
        Self::new()
    }
}

impl WorkerLog {
    pub fn new() -> Self {
        Self {
            worker_id: None,
            message_id: None,
            is_auto_confirmation_message: None,
            process_message_method: None,
        }
    }
}
