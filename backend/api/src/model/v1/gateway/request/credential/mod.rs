//! Credential Request Models
//!
//! โมดูลนี้จัดการโครงสร้างข้อมูลสำหรับ credential management requests
//! รวมถึง API keys, OAuth credentials และ rotation operations
//!
//! # Features
//! - Credential rotation requests
//! - API key credential structures
//! - OAuth credential handling
//! - Secure credential management

pub mod rotate;

pub use rotate::{ApiKeyCredential, OAuthCredential, RotateCredentialRequest};
