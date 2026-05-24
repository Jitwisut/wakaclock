//! # Qdrant Vector Repository - ระบบจัดการ Vector Database
//!
//! โมดูลนี้จัดการการเชื่อมต่อและการดำเนินการกับ Qdrant สำหรับการจัดเก็บ
//! และค้นหาเวกเตอร์สำหรับฟีเจอร์การค้นหาผลิตภัณฑ์โดยใช้ AI
//!
//! ## คุณสมบัติหลัก:
//! - Vector similarity search สำหรับ product recommendations
//! - Semantic product search ด้วย embeddings
//! - High-performance vector storage และ retrieval
//! - Metadata filtering สำหรับ complex queries
//! - Collection management และ indexing
//!
//! ## Vector Operations:
//! - **Upsert**: เพิ่มหรืออัปเดต product embeddings
//! - **Search**: ค้นหา similar products ด้วย cosine similarity
//! - **Filter**: กรองผลลัพธ์ด้วย metadata (platform, category, price)
//! - **Delete**: ลบ vectors ที่ไม่ใช้แล้ว
//!
//! ## Performance Features:
//! - HNSW (Hierarchical Navigable Small World) indexing
//! - Batch operations สำหรับ bulk data processing
//! - Connection pooling และ async operations
//! - Memory-efficient vector storage
use async_trait::async_trait;
use qdrant_client::qdrant::{
    CreateCollection, DeletePoints, Distance, GetPoints, ListValue, PointStruct, PointsIdsList,
    SearchParams, SearchPoints, UpsertPoints, VectorParams, VectorsConfig,
};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    model::v1::platfrom::entries::{AppError, AppResult},
    repository::VectorRepository,
};

/// Repository implementation สำหรับ Qdrant vector database
pub struct QdrantRepository {
    client: Arc<qdrant_client::Qdrant>,
    collection_prefix: String,
}

impl QdrantRepository {
    pub fn new(client: Arc<qdrant_client::Qdrant>, collection_prefix: String) -> Self {
        Self {
            client,
            collection_prefix,
        }
    }

    fn get_collection_name(&self, collection: &str) -> String {
        if collection.starts_with(&self.collection_prefix) {
            collection.to_string()
        } else {
            format!("{}_{}", self.collection_prefix, collection)
        }
    }

    pub async fn ensure_collection(&self, collection: &str, dimensions: u64) -> AppResult<()> {
        let collection_name = self.get_collection_name(collection);

        let exists = self
            .client
            .collection_exists(&collection_name)
            .await
            .map_err(|e| {
                AppError::VectorStoreError(format!("Failed to check collection: {}", e))
            })?;

        if !exists {
            self.client
                .create_collection(CreateCollection {
                    collection_name: collection_name.clone(),
                    vectors_config: Some(VectorsConfig {
                        config: Some(qdrant_client::qdrant::vectors_config::Config::Params(
                            VectorParams {
                                size: dimensions,
                                distance: Distance::Cosine.into(),
                                hnsw_config: None,
                                quantization_config: None,
                                on_disk: Some(false),
                                datatype: None,
                                multivector_config: None,
                            },
                        )),
                    }),
                    ..Default::default()
                })
                .await
                .map_err(|e| {
                    AppError::VectorStoreError(format!("Failed to create collection: {}", e))
                })?;
        }

        Ok(())
    }
}

#[async_trait]
impl VectorRepository for QdrantRepository {
    async fn upsert_vector(
        &self,
        collection: &str,
        id: &str,
        vector: &[f32],
        payload: &JsonValue,
    ) -> AppResult<()> {
        let collection_name = self.get_collection_name(collection);

        let point_id = id.parse::<u64>().unwrap_or_else(|_| {
            let uuid = Uuid::parse_str(id).unwrap_or_else(|_| Uuid::new_v4());
            uuid.as_u128() as u64
        });

        let payload_map: HashMap<String, qdrant_client::qdrant::Value> = serde_json::from_value::<
            HashMap<String, JsonValue>,
        >(payload.clone())
        .unwrap_or_default()
        .into_iter()
        .map(|(k, v)| {
            let qdrant_value = match v {
                JsonValue::String(s) => qdrant_client::qdrant::Value {
                    kind: Some(qdrant_client::qdrant::value::Kind::StringValue(s)),
                },
                JsonValue::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        qdrant_client::qdrant::Value {
                            kind: Some(qdrant_client::qdrant::value::Kind::IntegerValue(i)),
                        }
                    } else if let Some(f) = n.as_f64() {
                        qdrant_client::qdrant::Value {
                            kind: Some(qdrant_client::qdrant::value::Kind::DoubleValue(f)),
                        }
                    } else {
                        qdrant_client::qdrant::Value {
                            kind: Some(qdrant_client::qdrant::value::Kind::StringValue(
                                n.to_string(),
                            )),
                        }
                    }
                }
                JsonValue::Bool(b) => qdrant_client::qdrant::Value {
                    kind: Some(qdrant_client::qdrant::value::Kind::BoolValue(b)),
                },
                JsonValue::Array(arr) => {
                    let values: Vec<qdrant_client::qdrant::Value> = arr
                        .into_iter()
                        .filter_map(|v| {
                            if let JsonValue::String(s) = v {
                                Some(qdrant_client::qdrant::Value {
                                    kind: Some(qdrant_client::qdrant::value::Kind::StringValue(s)),
                                })
                            } else {
                                None
                            }
                        })
                        .collect();

                    qdrant_client::qdrant::Value {
                        kind: Some(qdrant_client::qdrant::value::Kind::ListValue(ListValue {
                            values,
                        })),
                    }
                }
                _ => qdrant_client::qdrant::Value {
                    kind: Some(qdrant_client::qdrant::value::Kind::StringValue(
                        v.to_string(),
                    )),
                },
            };
            (k, qdrant_value)
        })
        .collect();

        let point = PointStruct {
            id: Some(point_id.into()),
            vectors: Some(vector.to_vec().into()),
            payload: payload_map,
        };

        let upsert_points = UpsertPoints {
            collection_name,
            wait: None,
            points: vec![point],
            ordering: None,
            shard_key_selector: None,
        };

        self.client
            .upsert_points(upsert_points)
            .await
            .map_err(|e| AppError::VectorStoreError(format!("Failed to upsert vector: {}", e)))?;

        Ok(())
    }

    async fn search_vectors(
        &self,
        collection: &str,
        vector: &[f32],
        limit: usize,
    ) -> AppResult<Vec<(String, f32, JsonValue)>> {
        let collection_name = self.get_collection_name(collection);

        let search_result = self
            .client
            .search_points(SearchPoints {
                collection_name: collection_name.clone(),
                vector: vector.to_vec(),
                limit: limit as u64,
                with_payload: Some(true.into()),
                params: Some(SearchParams {
                    hnsw_ef: Some(128),
                    exact: Some(false),
                    quantization: None,
                    indexed_only: Some(true),
                }),
                filter: None,
                offset: Some(0),
                with_vectors: None,
                score_threshold: None,
                vector_name: None,
                timeout: None,
                shard_key_selector: None,
                read_consistency: None,
                sparse_indices: None,
            })
            .await
            .map_err(|e| AppError::VectorStoreError(format!("Failed to search vectors: {}", e)))?;

        let results = search_result
            .result
            .into_iter()
            .map(|point| {
                let id = match &point.id {
                    Some(point_id) => match &point_id.point_id_options {
                        Some(qdrant_client::qdrant::point_id::PointIdOptions::Num(n)) => {
                            n.to_string()
                        }
                        Some(qdrant_client::qdrant::point_id::PointIdOptions::Uuid(u)) => u.clone(),
                        None => "unknown".to_string(),
                    },
                    None => "unknown".to_string(),
                };

                let payload_json: JsonValue = point
                    .payload
                    .into_iter()
                    .map(|(k, v)| {
                        let json_value = match v.kind {
                            Some(qdrant_client::qdrant::value::Kind::StringValue(s)) => {
                                JsonValue::String(s)
                            }
                            Some(qdrant_client::qdrant::value::Kind::IntegerValue(i)) => {
                                JsonValue::Number(i.into())
                            }
                            Some(qdrant_client::qdrant::value::Kind::DoubleValue(d)) => {
                                serde_json::Number::from_f64(d)
                                    .map(JsonValue::Number)
                                    .unwrap_or(JsonValue::Null)
                            }
                            Some(qdrant_client::qdrant::value::Kind::BoolValue(b)) => {
                                JsonValue::Bool(b)
                            }
                            _ => JsonValue::Null,
                        };
                        (k, json_value)
                    })
                    .collect::<serde_json::Map<String, JsonValue>>()
                    .into();

                (id, point.score, payload_json)
            })
            .collect();

        Ok(results)
    }

    async fn get_vector(
        &self,
        collection: &str,
        id: &str,
    ) -> AppResult<Option<(Vec<f32>, JsonValue)>> {
        let collection_name = self.get_collection_name(collection);

        let point_id = id.parse::<u64>().unwrap_or_else(|_| {
            let uuid = Uuid::parse_str(id).unwrap_or_else(|_| Uuid::new_v4());
            uuid.as_u128() as u64
        });

        let get_points = GetPoints {
            collection_name,
            ids: vec![point_id.into()],
            with_payload: Some(true.into()),
            with_vectors: Some(true.into()),
            read_consistency: None,
            shard_key_selector: None,
            timeout: None,
        };

        let points = self
            .client
            .get_points(get_points)
            .await
            .map_err(|e| AppError::VectorStoreError(format!("Failed to get vector: {}", e)))?;

        if let Some(point) = points.result.first() {
            let vector = match &point.vectors {
                Some(vectors) => match &vectors.vectors_options {
                    Some(qdrant_client::qdrant::vectors_output::VectorsOptions::Vector(v)) => {
                        v.data.clone()
                    }
                    _ => return Ok(None),
                },
                None => return Ok(None),
            };

            let payload_json: JsonValue = point
                .payload
                .iter()
                .map(|(k, v)| {
                    let json_value = match &v.kind {
                        Some(qdrant_client::qdrant::value::Kind::StringValue(s)) => {
                            JsonValue::String(s.clone())
                        }
                        Some(qdrant_client::qdrant::value::Kind::IntegerValue(i)) => {
                            JsonValue::Number((*i).into())
                        }
                        Some(qdrant_client::qdrant::value::Kind::DoubleValue(d)) => {
                            serde_json::Number::from_f64(*d)
                                .map(JsonValue::Number)
                                .unwrap_or(JsonValue::Null)
                        }
                        Some(qdrant_client::qdrant::value::Kind::BoolValue(b)) => {
                            JsonValue::Bool(*b)
                        }
                        _ => JsonValue::Null,
                    };
                    (k.clone(), json_value)
                })
                .collect::<serde_json::Map<String, JsonValue>>()
                .into();

            Ok(Some((vector, payload_json)))
        } else {
            Ok(None)
        }
    }

    async fn delete_vector(&self, collection: &str, id: &str) -> AppResult<()> {
        let collection_name = self.get_collection_name(collection);

        let point_id = id.parse::<u64>().unwrap_or_else(|_| {
            let uuid = Uuid::parse_str(id).unwrap_or_else(|_| Uuid::new_v4());
            uuid.as_u128() as u64
        });

        let points_selector = qdrant_client::qdrant::PointsSelector {
            points_selector_one_of: Some(
                qdrant_client::qdrant::points_selector::PointsSelectorOneOf::Points(
                    PointsIdsList {
                        ids: vec![point_id.into()],
                    },
                ),
            ),
        };

        let delete_points = DeletePoints {
            collection_name,
            wait: None,
            points: Some(points_selector),
            ordering: None,
            shard_key_selector: None,
        };

        self.client
            .delete_points(delete_points)
            .await
            .map_err(|e| AppError::VectorStoreError(format!("Failed to delete vector: {}", e)))?;

        Ok(())
    }
}
