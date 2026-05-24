/// Shop Platform Handlers Module - โมดูลตัวจัดการร้านค้าของแพลตฟอร์ม
///
/// จัดการ API endpoints สำหรับการจัดการร้านค้าบนแพลตฟอร์ม e-commerce ต่างๆ
/// รวมถึงการเชื่อมต่อ การจัดการตั้งค่า และการอัพเดตข้อมูลร้าน
///
/// # Features
/// - Shop connection management - การจัดการการเชื่อมต่อร้านค้า
/// - Multi-platform support - สนับสนุนหลายแพลตฟอร์มพร้อมกัน (TikTok, Shopee, Lazada, etc.)
/// - Shop configuration และ settings management
/// - Real-time shop status monitoring
/// - OAuth credential management - การจัดการ credentials และ tokens
///
/// # Architecture
/// ใช้ Clean Architecture pattern แยก handler layer จาก business logic
/// Handler รับผิดชอบ HTTP requests และเรียกใช้ services ต่างๆ
///
/// # Usage
/// ```rust
/// let shop_handler = ShopHandler::new(app_state);
/// let router = shop_handler.build();
/// ```
pub mod handler;

pub use handler::ShopHandler;
