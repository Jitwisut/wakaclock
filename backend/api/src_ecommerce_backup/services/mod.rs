//! # Services Layer Module - โมดูลชั้น Services
//!
//! ชั้น services ที่รวบรวม business logic และ domain operations หลักของระบบ
//! ตาม Clean Architecture patterns แยกเป็นส่วนต่างๆ ตามหน้าที่
//!
//! ## หน้าที่หลัก
//! - จัดการ business logic ของระบบทั้งหมด
//! - ประสานงานระหว่าง repositories และ external services
//! - ดำเนินการ data transformation และ validation
//! - จัดการ async operations และ background jobs
//!
//! ## โครงสร้าง Services
//! ### Core Services
//! - `auth_config` - การจัดการ authentication configuration
//! - `oauth_state` - จัดการ OAuth state สำหรับ CSRF protection
//! - `product` - business logic สำหรับสินค้า
//! - `vector` - semantic search และ AI operations
//!
//! ### Platform Integration
//! - `platform_product` - การจัดการสินค้าข้ามแพลตฟอร์ม
//!
//! ### Background Processing
//! - `product_sync` - การซิงค์ข้อมูลสินค้าแบบ async
//! - `backpressure_manager` - จัดการ rate limiting
//! - `dlq_manager` - Dead Letter Queue management
//! - `progress_tracker` - ติดตามความคืบหน้าของ jobs

// Audit logging moved to Quickwit for better performance and search capabilities

pub mod ai;
pub mod auth_config;
// pub mod gateway;      // Module files need to be created
// pub mod gateway_impl;  // Module files need to be created
pub mod gateway_proxy;

pub mod oauth_state;
pub mod platform_product;
pub mod probe;
pub mod product;
pub mod product_ingest;
pub mod product_listing;
pub mod vector;
pub mod vector_ingest;
pub mod webhook;

// Product sync services
pub mod backpressure_manager;
pub mod dlq_manager;
pub mod product_sync;
pub mod progress_tracker;
