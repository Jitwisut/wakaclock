//! # Repository Layer Module - โมดูลชั้น Repository
//!
//! ชั้น repository ที่จัดการการเข้าถึงข้อมูลจากแหล่งต่างๆ
//! รวมถึง databases, external services และ storage systems
//!
//! ## หน้าที่หลัก
//! - จัดการการเข้าถึงข้อมูลแบบ abstract
//! - ให้ interface สำหรับ data persistence operations
//! - จัดการ database connections และ query optimization
//! - รองรับ multiple data sources (ClickHouse, Qdrant, etc.)
//!
//! ## โครงสร้าง Repositories
//! - `clickhouse` - ClickHouse database operations
//! - `qdrant` - Vector database operations
//! - `unified_product` - Unified product data access
//! - `auth_config` - Authentication configuration storage
//! - `credentials` - Platform credentials management
//! - `quickwit_audit` - Audit logging with Quickwit

pub mod auth_config;
pub mod clickhouse;
pub mod credentials;
pub mod gateway;

pub mod manager;
pub mod product;
pub mod product_ingest;
pub mod qdrant;
pub mod quickwit_audit;
pub mod traits;
pub mod unified_product;
pub mod webhook;

pub use manager::RepositoryManager;
pub use traits::{JobRepository, ProductRepository, VectorRepository, VectorSyncRepository};
pub use unified_product::UnifiedProductRepository;
