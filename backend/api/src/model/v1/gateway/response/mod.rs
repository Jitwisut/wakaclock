//! # Gateway Response Models Module
//!
//! โมดูลนี้รวบรวมโมเดลสำหรับการ response ของ Gateway API
//! ใช้สำหรับกำหนดโครงสร้างข้อมูลที่ส่งคืนจาก API endpoints
//!
//! ## ฟีเจอร์หลัก
//! - Response models สำหรับทุก API endpoints
//! - Error handling และ status codes
//! - Type-safe response structures
//! - Multi-platform data aggregation
//! - Standardized API response format

pub mod ai;
pub mod audit;
pub mod auth;
pub mod embedding;
pub mod gateway;
pub mod product;
pub mod shop;
pub mod token;
pub mod vector;

use crate::model::response_code::HttpError;

pub type GatewayResponse<T> = Result<T, HttpError>;
