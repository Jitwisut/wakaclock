/// โมดูล Database Infrastructure
///
/// โมดูลหลักสำหรับจัดการ database connections, schema migrations
/// และการดำเนินการกับฐานข้อมูลต่างๆ ในระบบ
///
/// รองรับ:
/// - ClickHouse สำหรับ analytical data
/// - Connection pooling และ health checks
/// - Schema migrations และ versioning
pub mod clickhouse;

// pub mod migration; // Module not yet implemented
// Module สำหรับจัดการ database migrations
// จะ implement ในอนาคตสำหรับ schema versioning

// pub use migration::{Migration, MigrationManager, MigrationRecord};
// Re-export types สำหรับ migration management
