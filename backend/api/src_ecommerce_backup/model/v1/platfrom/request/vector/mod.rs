/// โมดูล request models สำหรับ vector operations
///
/// โมดูลนี้รวมโครงสร้างข้อมูลที่ใช้ในการส่งคำขอ
/// สำหรับการจัดการ vector database operations
pub mod search;
pub mod sync;
pub mod upsert;

// Re-export commonly used types
pub use search::VectorSearchRequest;
pub use sync::{GetProductVectorQuery, SyncStatusQuery};
pub use upsert::UpsertRequest;
