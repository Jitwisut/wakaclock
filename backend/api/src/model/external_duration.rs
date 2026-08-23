use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
pub struct ExternalDurationRequest {
    pub source: String,
    pub external_id: String,
    #[serde(alias = "time")]
    pub start_time: f64,
    pub end_time: Option<f64>,
    pub duration_seconds: Option<f64>,
    pub category: String,
    pub entity_type: String,
    pub entity: String,
    pub project: Option<String>,
    pub description: Option<String>,
    pub source_url: Option<String>,
    #[serde(default = "default_provenance")]
    pub provenance: String,
    #[serde(default = "default_sync_version")]
    pub sync_version: String,
}

fn default_provenance() -> String {
    "api".to_string()
}

fn default_sync_version() -> String {
    "1".to_string()
}

#[derive(Debug, Clone, Serialize)]
pub struct ExternalDuration {
    pub id: Uuid,
    pub user_id: Uuid,
    pub source: String,
    pub external_id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub duration_seconds: f64,
    pub category: String,
    pub entity_type: String,
    pub entity: String,
    pub project: Option<String>,
    pub description: Option<String>,
    pub source_url: Option<String>,
    pub provenance: String,
    pub sync_version: String,
}

#[derive(Debug, Clone, Deserialize, clickhouse::Row)]
pub struct ExternalDurationRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub id: Uuid,
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    pub source: String,
    pub external_id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub duration_seconds: f64,
    pub category: String,
    pub entity_type: String,
    pub entity: String,
    pub project: Option<String>,
    pub description: Option<String>,
    pub source_url: Option<String>,
    pub provenance: String,
    pub sync_version: String,
}

impl ExternalDurationRow {
    pub fn into_model(self) -> ExternalDuration {
        ExternalDuration {
            id: self.id,
            user_id: self.user_id,
            source: self.source,
            external_id: self.external_id,
            start_time: self.start_time,
            end_time: self.end_time,
            duration_seconds: self.duration_seconds,
            category: self.category,
            entity_type: self.entity_type,
            entity: self.entity,
            project: self.project,
            description: self.description,
            source_url: self.source_url,
            provenance: self.provenance,
            sync_version: self.sync_version,
        }
    }
}
