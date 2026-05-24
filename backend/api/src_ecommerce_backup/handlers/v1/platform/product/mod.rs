/// Product Platform Handlers Module - โมดูลตัวจัดการสินค้าของแพลตฟอร์ม
///
/// จัดการ API endpoints ทั้งหมดที่เกี่ยวข้องกับการจัดการสินค้าบนแพลตฟอร์ม e-commerce
/// รวมถึงการ sync ข้อมูลสินค้าจากหลายแพลตฟอร์ม การ update และ monitoring
///
/// # Modules
/// - `handler` - ProductHandler หลักสำหรับ routing และการจัดการ requests
/// - `product` - Business logic และ domain models สำหรับสินค้า
///
/// # Features
/// - Product catalog sync across multiple platforms (TikTok, Shopee, Lazada, etc.)
/// - Real-time product updates และ inventory management
/// - Cross-platform product mapping และ normalization
/// - Background product sync jobs ผ่าน message queue
///
/// # Usage
/// ```rust
/// let product_handler = ProductHandler::new(app_state);
/// let router = product_handler.build();
/// ```
pub mod handler;
pub mod ingrest;
#[allow(clippy::module_inception)]
pub mod product;

pub use handler::ProductHandler;
pub use product::*;
