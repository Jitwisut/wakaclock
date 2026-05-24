use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, clickhouse::Row)]
pub struct ProjectMergeRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    #[serde(with = "clickhouse::serde::uuid")]
    pub merge_id: Uuid,
    pub source_project: String,
    pub target_project: String,
    pub created_at: u32,
    pub updated_at: u32,
}
