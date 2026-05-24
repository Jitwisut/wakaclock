/// ไฟล์ mod.rs - Credential Request Models Module
/// รวม request models สำหรับ credential management
/// จัดการ credential rotation และ authentication
/// ใช้ในการจัดการ platform credentials

/// Module สำหรับ credential rotation requests
pub mod rotate;

// Re-export types สำหรับความสะดวกในการใช้งาน
pub use rotate::{ApiKeyCredential, OAuthCredential, RotateCredentialRequest};
