/// ไฟล์ mod.rs - Product Sync Service Module
/// บริการจัดการการ sync สินค้าระหว่าง platforms
/// ประกอบด้วย 3 components หลัก:
/// 1. Coordinator - ประสานงานการ sync ระหว่าง platforms
/// 2. Field Analyzer - วิเคราะห์และ mapping fields ระหว่าง platforms
/// 3. State Manager - จัดการสถานะการ sync

///    Coordinator module - ประสานงานการ sync
///    จัดการ workflow การ sync สินค้าแบบ batch และ real-time
pub mod coordinator;

/// Field Analyzer module - วิเคราะห์ fields
/// วิเคราะห์ความแตกต่างของ fields ระหว่าง platforms
/// และสร้าง mapping rules อัตโนมัติ
pub mod field_analyzer;

/// State Manager module - จัดการสถานะ
/// ติดตามสถานะการ sync, จัดการ conflicts, และ retry logic
pub mod state_manager;

// Re-export public APIs สำหรับใช้งานจากภายนอก module
pub use coordinator::*;
pub use field_analyzer::*;
pub use state_manager::*;
