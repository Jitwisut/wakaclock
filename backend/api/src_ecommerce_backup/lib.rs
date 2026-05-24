#![allow(dead_code, unused_imports, unused_variables, clippy::all)]

//! # E-commerce Connect API Library
//!
//! ไฟล์ lib.rs - จุดเริ่มต้นของ library module
//! รวบรวม public modules ทั้งหมดสำหรับใช้งานในโปรเจค
//! แบ่งตาม Clean Architecture layers
//!
//! ## ฟีเจอร์หลัก
//! - Clean Architecture implementation
//! - Multi-platform e-commerce integration
//! - Product synchronization และ management
//! - Vector search และ AI capabilities
//! - Background job processing

/// Client layer - การเชื่อมต่อกับ external services
/// รวม database clients, cache, queue, และ platform integrations
pub mod client; // Needed for database and gateway

/// Configuration module - จัดการ configuration ของระบบ
/// โหลดและ parse configuration จาก files และ environment
pub mod config;

/// Documentation module - สร้าง OpenAPI/Swagger documentation
/// auto-generate API docs สำหรับ gateway และ platform APIs
pub mod docs;

/// Handlers layer - HTTP request handlers
/// จัดการ routing และ request/response สำหรับ REST API
pub mod handlers; // API handlers

/// Helper utilities - ฟังก์ชันช่วยต่างๆ
/// รวม crypto, mapping, และ utility functions
pub mod helpers; // Helper modules

/// Infrastructure layer - core infrastructure components
/// รวม app container, logger, cache, database, queue implementations
pub mod infrastructure;

/// Interfaces layer - trait definitions และ contracts
/// กำหนด interfaces สำหรับ platform gateway, repository, services
pub mod interfaces; // Needed for platform gateway traits

/// Middleware layer - HTTP middleware components
/// จัดการ auth, CORS, rate limiting, error handling
pub mod middleware;

/// Model layer - data structures และ domain models
/// รวม request/response DTOs, entities, และ value objects
pub mod model;

/// Repository layer - data access abstractions
/// จัดการการเข้าถึงข้อมูลจาก database และ external storage
pub mod repository; // Needed for data access

/// Services layer - business logic และ application services
/// orchestrate การทำงานระหว่าง layers ต่างๆ
pub mod services; // Needed for auth_config in middleware // Needed for PlatformGateway

/// Worker layer - background job processors
/// จัดการ async tasks และ message queue consumers
pub mod worker; // Needed for product_consumer

// Re-export AppState and create_app_state for main.rs
// ส่งออก AppState และ create_app_state สำหรับใช้ใน main.rs
// AppState เก็บ dependencies ทั้งหมดของแอพพลิเคชัน
pub use infrastructure::{create_app_state, AppState};

// Re-export Config with server field
// ส่งออก Config struct สำหรับการตั้งค่าระบบ
pub use config::Config;

// Re-export modules needed by binaries
// ส่งออก modules ที่จำเป็นสำหรับ binary executables อื่นๆ
pub use client::database;
pub use client::queue;
