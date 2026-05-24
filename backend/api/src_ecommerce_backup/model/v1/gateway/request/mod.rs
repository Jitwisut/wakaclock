//! Gateway Request Models Module
//!
//! โมดูลนี้จัดการโครงสร้างข้อมูลสำหรับ HTTP requests ที่เข้ามาผ่าน Gateway API
//! รวมถึง authentication, shop connections, product operations และ vector operations
//!
//! # Modules
//! - `audit` - Audit logging request models
//! - `auth` - Authentication request models
//! - `body` - Request body structures และ MIME type handling
//! - `credential` - Credential management request models
//! - `embedding` - AI embedding request models
//! - `gateway` - Gateway-specific request models
//! - `product` - Product management request models
//! - `queries` - Query parameters และ search filters
//! - `shop` - Shop connection request models
//! - `vector` - Vector search และ AI operations request models
//!
//! # Usage
//! ```rust
//! use crate::model::v1::gateway::request::{
//!     shop::ConnectQuery,
//!     vector::VectorSearchRequest,
//!     auth::AuthRequest
//! };
//! ```

pub mod ai;
pub mod audit;
pub mod auth;
pub mod body;
pub mod credential;
pub mod embedding;
pub mod gateway;
pub mod product;
pub mod queries;
pub mod shop;
pub mod vector;
