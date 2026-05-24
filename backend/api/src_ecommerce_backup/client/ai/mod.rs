/// โมดูลสำหรับ AI และ Machine Learning clients
/// จัดการการติดต่อกับบริการ AI ต่างๆ เช่น OpenAI, Claude, หรือ local models
///
/// # การใช้งาน
/// - สำหรับ text embeddings ของสินค้า
/// - การวิเคราะห์และจับคู่สินค้า
/// - การแนะนำสินค้า (product recommendation)
///
/// # Module exports
/// - `ai` - AI service client หลัก
#[allow(clippy::module_inception)]
pub mod ai;
