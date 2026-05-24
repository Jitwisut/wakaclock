/// Infrastructure Layer - โครงสร้างพื้นฐานของระบบ
/// จัดการ dependencies, logging, caching, database, queue และ components พื้นฐานอื่นๆ

/// App container module - dependency injection container แบบ Go-style
/// จัดการ lifecycle ของ components ทั้งหมดในระบบ
pub mod app;

// pub mod auth; // Module not yet implemented
// โมดูล authentication ยังไม่ได้ implement (ใช้ Strapi แทน)

/// Cache infrastructure - ระบบ caching หลายระดับ
/// รองรับทั้ง Redis และ in-memory cache
pub mod cache;

/// Casbin integration - Role-Based Access Control (RBAC)
/// จัดการ permissions และ authorization policies
pub mod casbin;

/// Configuration management - จัดการ config ของระบบ
/// โหลด config จาก files และ environment variables
pub mod config;

/// Database connections - การเชื่อมต่อ database
/// รวม ClickHouse, PostgreSQL, และ database pools
pub mod database;

/// Error handling infrastructure - จัดการ error ทั่วระบบ
/// custom error types และ error handling utilities
pub mod error;

/// Structured logging - ระบบ logging แบบ structured (Zap-inspired)
/// รองรับ context, correlation IDs, และ distributed tracing
pub mod logger;

/// Transport clients - HTTP clients for internal service communication
pub mod transport;

/// Observability - monitoring และ metrics collection
/// รวม health checks, metrics, และ performance tracking
pub mod observability;

/// Message queue infrastructure - ระบบ message queue
/// รองรับ RabbitMQ และ in-memory queue สำหรับ testing
pub mod queue;

/// OAuth infrastructure - OAuth state management
/// Redis-based OAuth state storage for secure OAuth flow
pub mod oauth;

// pub mod storage; // Module removed - schema definitions moved to model layer
// โมดูล storage ถูกย้ายไปที่ model layer แล้ว

/// Product sync infrastructure - โครงสร้างสำหรับ sync สินค้า
/// จัดการ backpressure, pagination, และ selective sync
pub mod sync; // Product sync infrastructure

/// Input validation - ตรวจสอบความถูกต้องของข้อมูล
/// validation rules และ error messages
pub mod validator;

// Core infrastructure exports
// ส่งออก types และ functions หลักของ infrastructure layer
pub use app::{new_app, App, AppHealth, AppMetadata, ComponentHealth, HealthStatus};
pub use config::Config;
// pub use factory::AppContext; // Factory module not implemented
// Factory pattern ยังไม่ได้ implement

// Legacy compatibility - redirect to new App structure
// รักษา backward compatibility กับ code เดิมที่ใช้ AppState
pub type AppState = App;

/// สร้าง application state (wrapper สำหรับ backward compatibility)
/// เรียกใช้ new_app() ภายในเพื่อสร้าง App instance
pub async fn create_app_state() -> anyhow::Result<App> {
    new_app().await
}
