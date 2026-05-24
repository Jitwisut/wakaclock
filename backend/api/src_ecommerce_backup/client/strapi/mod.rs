pub mod shop_tokens;
/// โมดูล Strapi Client
///
/// ระบบจัดการการเชื่อมต่อกับ Strapi backend สำหรับ user และ organization management
/// ทำหน้าที่เป็น proxy จาก Rust backend ไปยัง Strapi API
///
/// ความรับผิดชอบ:
/// - User accounts และ authentication
/// - Organization และ team management
/// - Shop CRUD operations
/// - Platform credentials storage
/// - OAuth token management
/// - Billing metadata
pub mod strapi_proxy;
