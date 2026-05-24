/// ไฟล์ mod.rs - Vector Response Models Module
/// รวม vector database response models
/// จัดการ search, sync, upsert operations
/// ใช้กับ Qdrant vector database integration

/// Module สำหรับ vector search responses
pub mod search;
/// Module สำหรับ vector sync responses
pub mod sync;
/// Module สำหรับ vector upsert responses
pub mod upsert;

// Re-export types สำหรับความสะดวกในการใช้งาน
pub use search::{VectorMatch, VectorSearchResult};
pub use sync::{ProductVector, SyncStatus};
pub use upsert::UpsertResponse;
