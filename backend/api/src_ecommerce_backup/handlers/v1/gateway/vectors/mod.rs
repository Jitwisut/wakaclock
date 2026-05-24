//! # Vector Search Module - โมดูลค้นหาแบบ Vector
//!
//! โมดูลสำหรับจัดการการค้นหาสินค้าแบบ semantic search โดยใช้ AI และ vector embeddings
//! เพื่อให้สามารถค้นหาสินค้าได้อย่างชาญฉลาดมากขึ้น
//!
//! ## หน้าที่หลัก
//! - จัดการ vector search endpoints
//! - ดำเนินการ upsert vector data
//! - ติดตามสถานะการซิงค์ vector
//! - ให้บริการ semantic product search

pub mod handler;
pub mod vector;

pub use handler::{routes, VectorsHandler};
