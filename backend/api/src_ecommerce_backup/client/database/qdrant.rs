/// # Qdrant Vector Database Client - Qdrant Vector Database Client
/// Client wrapper สำหรับ Qdrant vector database
/// ใช้สำหรับจัดเก็บและค้นหา product embeddings และ semantic search
///
/// ## การใช้งาน
/// - เก็บ product embeddings สำหรับ semantic search
/// - ค้นหาสินค้าคล้ายกันตาม features และคุณสมบัติ
/// - จัดการ vector collections และ metadata
/// - รองรับการสร้าง, อัปเดต, ค้นหา, และลบ vector points
///
/// ## ฟีเจอร์หลัก
/// - Collection management (สร้าง, ตรวจสอบ, ข้อมูล collection)
/// - Vector operations (upsert, search, delete)
/// - Metadata และ payload support
/// - Health monitoring และ status checking
use anyhow::Result;
use qdrant_client::qdrant::{
    point_id::PointIdOptions, vectors_config::Config as VectorConfig, CreateCollection, Distance,
    Filter, PointStruct, SearchPoints, Value as QdrantValue, VectorParams, VectorsConfig,
};
use qdrant_client::Qdrant;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Qdrant vector database client wrapper
/// ปรับปรุงการใช้งาน Qdrant client ให้ง่ายขึ้นและ type-safe
pub struct QdrantClient {
    /// Qdrant client instance
    client: Qdrant,
}

impl QdrantClient {
    /// Create a new Qdrant client
    pub async fn new(url: &str) -> Result<Self> {
        let client = Qdrant::from_url(url).build()?;
        Ok(Self { client })
    }

    /// Create a collection
    pub async fn create_collection(
        &self,
        collection_name: &str,
        vector_size: u64,
        distance: Distance,
    ) -> Result<()> {
        self.client
            .create_collection(CreateCollection {
                collection_name: collection_name.to_string(),
                vectors_config: Some(VectorsConfig {
                    config: Some(VectorConfig::Params(VectorParams {
                        size: vector_size,
                        distance: distance.into(),
                        hnsw_config: None,
                        quantization_config: None,
                        on_disk: None,
                        datatype: None,
                        multivector_config: None,
                    })),
                }),
                ..Default::default()
            })
            .await?;
        Ok(())
    }

    /// Check if collection exists
    pub async fn collection_exists(&self, collection_name: &str) -> Result<bool> {
        let collections = self.client.list_collections().await?;
        Ok(collections
            .collections
            .iter()
            .any(|c| c.name == collection_name))
    }

    /// Insert vectors with metadata
    pub async fn upsert_points(
        &self,
        collection_name: &str,
        points: Vec<VectorPoint>,
    ) -> Result<()> {
        let points: Vec<PointStruct> = points
            .into_iter()
            .map(|p| {
                let payload: HashMap<String, QdrantValue> = p
                    .payload
                    .into_iter()
                    .map(|(k, v)| (k, serde_json_value_to_qdrant_value(v)))
                    .collect();

                PointStruct {
                    id: Some(p.id.into()),
                    vectors: Some(qdrant_client::qdrant::Vectors::from(p.vector)),
                    payload,
                }
            })
            .collect();

        use qdrant_client::qdrant::UpsertPoints;

        let upsert = UpsertPoints {
            collection_name: collection_name.to_string(),
            points,
            ordering: None,
            wait: None,
            shard_key_selector: None,
        };

        self.client.upsert_points(upsert).await?;
        Ok(())
    }

    /// Search for similar vectors
    pub async fn search(
        &self,
        collection_name: &str,
        query_vector: Vec<f32>,
        limit: u64,
        filter: Option<Filter>,
    ) -> Result<Vec<SearchResult>> {
        let search_result = self
            .client
            .search_points(SearchPoints {
                collection_name: collection_name.to_string(),
                vector: query_vector,
                limit,
                filter,
                with_payload: Some(qdrant_client::qdrant::WithPayloadSelector::from(true)),
                ..Default::default()
            })
            .await?;

        let results = search_result
            .result
            .into_iter()
            .map(|point| {
                let id = point
                    .id
                    .and_then(|id| id.point_id_options)
                    .map(|id_opts| match id_opts {
                        PointIdOptions::Uuid(uuid) => uuid,
                        PointIdOptions::Num(num) => num.to_string(),
                    })
                    .unwrap_or_default();

                let payload: HashMap<String, serde_json::Value> = point
                    .payload
                    .into_iter()
                    .map(|(k, v)| (k, qdrant_value_to_serde_json_value(v)))
                    .collect();

                SearchResult {
                    id,
                    score: point.score,
                    payload,
                }
            })
            .collect();

        Ok(results)
    }

    /// Delete points by ID
    pub async fn delete_points(&self, collection_name: &str, ids: Vec<String>) -> Result<()> {
        let point_ids: Vec<qdrant_client::qdrant::PointId> =
            ids.into_iter().map(|id| id.into()).collect();

        use qdrant_client::qdrant::points_selector::PointsSelectorOneOf;
        use qdrant_client::qdrant::{DeletePoints, PointsIdsList, PointsSelector};

        let delete_request = DeletePoints {
            collection_name: collection_name.to_string(),
            points: Some(PointsSelector {
                points_selector_one_of: Some(PointsSelectorOneOf::Points(PointsIdsList {
                    ids: point_ids,
                })),
            }),
            ordering: None,
            wait: None,
            shard_key_selector: None,
        };

        self.client.delete_points(delete_request).await?;
        Ok(())
    }

    /// Health check
    pub async fn health_check(&self) -> Result<()> {
        self.client.health_check().await?;
        Ok(())
    }

    /// Get collection info
    pub async fn collection_info(&self, collection_name: &str) -> Result<CollectionInfo> {
        let info = self.client.collection_info(collection_name).await?;

        let result = info.result.as_ref();
        Ok(CollectionInfo {
            vectors_count: result.and_then(|r| r.vectors_count).unwrap_or(0),
            points_count: result.and_then(|r| r.points_count).unwrap_or(0),
            indexed_vectors_count: result.and_then(|r| r.indexed_vectors_count).unwrap_or(0),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorPoint {
    pub id: String,
    pub vector: Vec<f32>,
    pub payload: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub score: f32,
    pub payload: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct CollectionInfo {
    pub vectors_count: u64,
    pub points_count: u64,
    pub indexed_vectors_count: u64,
}

/// Convert serde_json::Value to qdrant_client::qdrant::Value
fn serde_json_value_to_qdrant_value(value: serde_json::Value) -> QdrantValue {
    use qdrant_client::qdrant::value::Kind;

    let kind = match value {
        serde_json::Value::Null => Kind::NullValue(0),
        serde_json::Value::Bool(b) => Kind::BoolValue(b),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Kind::IntegerValue(i)
            } else if let Some(f) = n.as_f64() {
                Kind::DoubleValue(f)
            } else {
                Kind::NullValue(0)
            }
        }
        serde_json::Value::String(s) => Kind::StringValue(s),
        serde_json::Value::Array(arr) => {
            let list_value = qdrant_client::qdrant::ListValue {
                values: arr
                    .into_iter()
                    .map(serde_json_value_to_qdrant_value)
                    .collect(),
            };
            Kind::ListValue(list_value)
        }
        serde_json::Value::Object(obj) => {
            let fields: HashMap<String, QdrantValue> = obj
                .into_iter()
                .map(|(k, v)| (k, serde_json_value_to_qdrant_value(v)))
                .collect();
            let struct_value = qdrant_client::qdrant::Struct { fields };
            Kind::StructValue(struct_value)
        }
    };

    QdrantValue { kind: Some(kind) }
}

/// Convert qdrant_client::qdrant::Value to serde_json::Value
fn qdrant_value_to_serde_json_value(value: QdrantValue) -> serde_json::Value {
    use qdrant_client::qdrant::value::Kind;

    match value.kind {
        Some(kind) => match kind {
            Kind::NullValue(_) => serde_json::Value::Null,
            Kind::BoolValue(b) => serde_json::Value::Bool(b),
            Kind::IntegerValue(i) => serde_json::Number::from(i).into(),
            Kind::DoubleValue(f) => serde_json::Number::from_f64(f)
                .map(Into::into)
                .unwrap_or(serde_json::Value::Null),
            Kind::StringValue(s) => serde_json::Value::String(s),
            Kind::ListValue(list) => {
                let array: Vec<serde_json::Value> = list
                    .values
                    .into_iter()
                    .map(qdrant_value_to_serde_json_value)
                    .collect();
                serde_json::Value::Array(array)
            }
            Kind::StructValue(s) => {
                let map: serde_json::Map<String, serde_json::Value> = s
                    .fields
                    .into_iter()
                    .map(|(k, v)| (k, qdrant_value_to_serde_json_value(v)))
                    .collect();
                serde_json::Value::Object(map)
            }
        },
        None => serde_json::Value::Null,
    }
}
