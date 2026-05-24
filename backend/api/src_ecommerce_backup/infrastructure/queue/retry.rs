//! โมดูล Retry Policy สำหรับ Message Queue
//!
//! จัดการ retry logic และ backoff strategies สำหรับการส่งข้อความที่ล้มเหลว
//! รองรับทั้ง exponential และ linear backoff พร้อม jitter

use serde::{Deserialize, Serialize};

/// Retry policy สำหรับการดำเนินการ queue operations
///
/// กำหนดนโยบายการ retry เมื่อการประมวลผลข้อความล้มเหลว
/// รองรับการปรับ delay แบบ exponential และ linear
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub max_retries: u32,
    pub base_delay_ms: u64,
    pub max_delay_ms: u64,
    pub jitter: bool,
}

impl RetryPolicy {
    /// สร้าง exponential backoff retry policy
    ///
    /// Delay เพิ่มขึ้นเป็นเลขยกกำลัง 2 ในแต่ละครั้ง
    /// เหมาะสำหรับลดภาระ server เมื่อมี failures หลายครั้ง
    pub fn exponential(max_retries: u32, base_delay_ms: u64) -> Self {
        Self {
            max_retries,
            base_delay_ms,
            max_delay_ms: base_delay_ms * (2_u64.pow(max_retries.min(10))),
            jitter: true,
        }
    }

    /// สร้าง linear backoff retry policy
    ///
    /// Delay เพิ่มขึ้นแบบเชิงเส้นในแต่ละครั้ง
    /// เหมาะสำหรับ operations ที่ต้องการ retry เร็วๆ
    pub fn linear(max_retries: u32, delay_ms: u64) -> Self {
        Self {
            max_retries,
            base_delay_ms: delay_ms,
            max_delay_ms: delay_ms * max_retries as u64,
            jitter: false,
        }
    }

    /// คำนวณ delay สำหรับการ retry ในครั้งที่กำหนด
    ///
    /// รองรับการเพิ่ม jitter เพื่อป้องกัน thundering herd problem
    pub fn calculate_delay(&self, attempt: u32) -> u64 {
        if attempt >= self.max_retries {
            return 0;
        }

        let delay = if attempt == 0 {
            self.base_delay_ms
        } else {
            (self.base_delay_ms * 2_u64.pow(attempt.min(10))).min(self.max_delay_ms)
        };

        if self.jitter {
            // เพิ่ม jitter แบบสุ่มได้ถึง 25% ของ delay
            // ช่วยกระจาย retry attempts ป้องกัน server overload
            let jitter = (delay / 4) as f64 * rand::random::<f64>();
            (delay as f64 + jitter) as u64
        } else {
            delay
        }
    }

    /// ตรวจสอบว่าควร retry หรือไม่
    ///
    /// คืน true ถ้ายังไม่ถึงจำนวนครั้งสูงสุด
    pub fn should_retry(&self, attempt: u32) -> bool {
        attempt < self.max_retries
    }
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self::exponential(3, 1000)
    }
}
