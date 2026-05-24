/// ไฟล์ vector.rs - Vector Search Service Implementation
/// จัดการ vector embeddings สำหรับ semantic search
/// ใช้ Qdrant vector database สำหรับเก็บและค้นหา embeddings
/// รองรับการค้นหาแบบ similarity matching
use async_trait::async_trait;
use std::sync::Arc;

use crate::{
    model::error::AppResult,
    model::response_code::HttpError,
    model::v1::gateway::response::GatewayResponse,
    model::v1::platfrom::{
        request::vector::VectorSearchRequest,
        response::vector::{VectorMatch, VectorSearchResult},
    },
    repository::VectorRepository,
    AppState,
};

/// VectorService trait - Interface สำหรับ vector operations
/// กำหนด methods สำหรับ search, get, และ upsert vector embeddings
#[async_trait]
pub trait VectorService: Send + Sync {
    /// ค้นหา vectors ที่คล้ายกันด้วย similarity search
    /// รับ query vector และ return matches พร้อม scores
    async fn search(&self, request: VectorSearchRequest) -> AppResult<VectorSearchResult>;

    /// ดึง vector embedding ของสินค้าที่กำหนด
    /// Return vector และ metadata ของสินค้า
    async fn get_product_vector(
        &self,
        platform: &str,
        shop_id: &str,
        product_id: &str,
    ) -> GatewayResponse<Option<(Vec<f32>, serde_json::Value)>>;

    /// บันทึกหรืออัพเดท vector embedding ของสินค้า
    /// เก็บ vector พร้อม metadata สำหรับการค้นหา
    async fn upsert_vector(
        &self,
        platform: &str,
        shop_id: &str,
        product_id: &str,
        vector: Vec<f32>,
        metadata: serde_json::Value,
    ) -> GatewayResponse<()>;
}

/// VectorServiceImpl - Implementation ของ VectorService
/// จัดการ vector operations ผ่าน Qdrant repository
/// แยก collection ตาม platform และ embedding model
pub struct VectorServiceImpl {
    #[allow(dead_code)]
    state: Arc<AppState>, // Application state พร้อม config
    vector_repo: Arc<dyn VectorRepository>, // Repository สำหรับ vector operations
}

impl VectorServiceImpl {
    /// สร้าง VectorService instance ใหม่
    pub fn new(state: Arc<AppState>, vector_repo: Arc<dyn VectorRepository>) -> Self {
        Self { state, vector_repo }
    }

    /// สร้างชื่อ collection สำหรับ Qdrant
    /// Format: collection_{platform}_{model}
    /// แปลง special characters เป็น underscore
    fn get_collection_name(&self, platform: &str, model: &str) -> String {
        let model_suffix = model.replace("-", "_").replace(".", "_");
        format!("collection_{}_{}", platform, model_suffix)
    }
}

#[async_trait]
impl VectorService for VectorServiceImpl {
    /// ค้นหา vectors ที่คล้ายกันใน Qdrant
    /// 1. รับ query vector จาก request
    /// 2. ค้นหาใน collection ที่ตรงกับ platform
    /// 3. Filter ตาม shop_id ถ้ากำหนด
    /// 4. Return matches พร้อม scores และ metadata
    async fn search(&self, request: VectorSearchRequest) -> AppResult<VectorSearchResult> {
        let start_time = std::time::Instant::now();

        // The request.query is already a vector embedding
        // Query vector ที่ได้มาจาก embedding model แล้ว
        let query_vector = request.query.clone();

        let platform = request.platform.as_deref().unwrap_or("default");
        let model = "default"; // Use default model for collection name
        let collection = self.get_collection_name(platform, model);
        let limit = request.limit.unwrap_or(10); // Default 10 results

        let results = self
            .vector_repo
            .search_vectors(&collection, &query_vector, limit)
            .await?;

        let matches: Vec<VectorMatch> = results
            .into_iter()
            .filter(|(_, _score, metadata)| {
                if let Some(shop_id_value) = metadata.get("shop_id") {
                    if let Some(ref request_shop_id) = request.shop_id {
                        shop_id_value.as_str() == Some(request_shop_id.as_str())
                    } else {
                        true // If no shop_id filter specified, include all
                    }
                } else {
                    false
                }
            })
            .map(|(id, score, metadata)| VectorMatch {
                product_id: id,
                score,
                metadata: metadata.clone(),
            })
            .collect();

        let query_time_ms = start_time.elapsed().as_millis() as u64;

        let total = matches.len();
        Ok(VectorSearchResult {
            product_id: matches
                .first()
                .map(|m| m.product_id.clone())
                .unwrap_or_default(),
            score: matches.first().map(|m| m.score).unwrap_or(0.0),
            metadata: matches
                .first()
                .map(|m| m.metadata.clone())
                .unwrap_or_else(|| serde_json::json!({})),
            matches: Some(matches),
            total: Some(total),
            query_time_ms: Some(query_time_ms),
        })
    }

    /// ดึง vector embedding ของสินค้าจาก Qdrant
    /// ใช้ default embedding model จาก config
    /// Return vector พร้อม metadata ถ้าพบ
    async fn get_product_vector(
        &self,
        platform: &str,
        _shop_id: &str,
        product_id: &str,
    ) -> GatewayResponse<Option<(Vec<f32>, serde_json::Value)>> {
        let model = "openai-text-embedding-3-large"; // Use default model

        let collection = self.get_collection_name(platform, model);

        self.vector_repo
            .get_vector(&collection, product_id)
            .await
            .map_err(|e| HttpError::InternalServerError(e.to_string()))
    }

    /// บันทึกหรืออัพเดท vector embedding ใน Qdrant
    /// เพิ่ม shop_id, platform, product_id ใน metadata
    /// สร้าง collection name ตาม platform และ model
    async fn upsert_vector(
        &self,
        platform: &str,
        shop_id: &str,
        product_id: &str,
        vector: Vec<f32>,
        mut metadata: serde_json::Value,
    ) -> GatewayResponse<()> {
        if let Some(obj) = metadata.as_object_mut() {
            obj.insert(
                "shop_id".to_string(),
                serde_json::Value::String(shop_id.to_string()),
            );
            obj.insert(
                "platform".to_string(),
                serde_json::Value::String(platform.to_string()),
            );
            obj.insert(
                "product_id".to_string(),
                serde_json::Value::String(product_id.to_string()),
            );
        }

        let model = metadata
            .get("embedding_model")
            .and_then(|m| m.as_str())
            .unwrap_or("openai-text-embedding-3-large");

        let collection = self.get_collection_name(platform, model);

        self.vector_repo
            .upsert_vector(&collection, product_id, &vector, &metadata)
            .await
            .map_err(|e| HttpError::InternalServerError(e.to_string()))
    }
}
