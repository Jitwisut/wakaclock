use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::AppState;

use super::vector;

/// Vector/AI Search Handler - ตัวจัดการ Vector Search และ AI
///
/// จัดการ endpoints สำหรับการค้นหาแบบ vector และการค้นพบสินค้าด้วย AI
/// Handler นี้รวมบริการ:
/// - การค้นหาสินค้าแบบ semantic search
/// - การดำเนินการ vector upsert operations
/// - การดึงข้อมูล product vector
/// - การติดตามสถานะการซิงค์ข้อมูล
///
/// ## เทคโนโลยีที่ใช้
/// - Qdrant vector database สำหรับเก็บ embeddings
/// - OpenAI หรือ local models สำหรับการสร้าง embeddings
/// - Cosine similarity สำหรับการเปรียบเทียบ vectors
pub struct VectorsHandler {
    state: Arc<AppState>,
}

impl VectorsHandler {
    /// สร้าง Vectors handler instance ใหม่
    ///
    /// รับ AppState เพื่อเข้าถึง vector services, Qdrant connections
    /// และ AI/embedding services ที่จำเป็น
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// สร้างและส่งคืน router พร้อม vector routes ทั้งหมด
    ///
    /// กำหนดค่า endpoints ทั้งหมดสำหรับ vector operations
    pub fn build(&self) -> Router<Arc<AppState>> {
        self.routes()
    }

    /// ลงทะเบียน vector/AI search routes ทั้งหมด
    ///
    /// กำหนด endpoints สำหรับ vector operations:
    /// - `POST /search` - ค้นหาสินค้าโดยใช้ semantic search
    /// - `POST /upsert` - เพิ่มหรืออัพเดท vector embeddings
    /// - `GET /products/:id` - ดึง vector data ของสินค้า
    /// - `GET /sync/status` - ตรวจสอบสถานะการซิงค์ vector
    fn routes(&self) -> Router<Arc<AppState>> {
        Router::new()
            .route("/search", post(vector::search))
            .route("/upsert", post(vector::upsert))
            .route("/products/:id", get(vector::get_product_vector))
            .route("/sync/status", get(vector::sync_status))
            .with_state(self.state.clone())
    }
}

/// Legacy compatibility function - ฟังก์ชันเพื่อความเข้ากันได้แบบเก่า
///
/// ให้บริการ vector routes แบบโดยตรงสำหรับ backward compatibility
/// กับโค้ดเก่าที่อาจยังใช้งานรูปแบบนี้อยู่
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/search", post(vector::search))
        .route("/upsert", post(vector::upsert))
        .route("/products/:id", get(vector::get_product_vector))
        .route("/sync/status", get(vector::sync_status))
}
