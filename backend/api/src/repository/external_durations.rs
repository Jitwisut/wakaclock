use anyhow::{anyhow, Context, Result};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::external_duration::{ExternalDuration, ExternalDurationRequest, ExternalDurationRow};

#[derive(Debug, Clone, Default)]
pub struct ExternalDurationFilter {
    pub start_time: Option<f64>,
    pub end_time: Option<f64>,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Copy)]
pub enum DeleteExternalDurationResult {
    Scheduled,
    NotFound,
}

#[derive(Debug, serde::Serialize, clickhouse::Row)]
struct ExternalDurationInsertRow {
    #[serde(with = "clickhouse::serde::uuid")]
    id: Uuid,
    #[serde(with = "clickhouse::serde::uuid")]
    user_id: Uuid,
    source: String,
    external_id: String,
    start_time: f64,
    end_time: f64,
    duration_seconds: f64,
    category: String,
    entity_type: String,
    entity: String,
    project: Option<String>,
    description: Option<String>,
    source_url: Option<String>,
    provenance: String,
    sync_version: String,
}

pub struct ExternalDurationRepository {
    client: Arc<ClickHouseClient>,
}

impl ExternalDurationRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    pub async fn migrate(&self) -> Result<()> {
        self.client
            .get_client()
            .query(
                "CREATE TABLE IF NOT EXISTS wakaclock.external_durations_raw (
                    id UUID,
                    user_id UUID,
                    source String,
                    external_id String,
                    start_time Float64,
                    end_time Float64,
                    duration_seconds Float64,
                    category String,
                    entity_type String,
                    entity String,
                    project Nullable(String),
                    description Nullable(String),
                    source_url Nullable(String),
                    provenance String,
                    sync_version String,
                    created_at UInt32 DEFAULT toUInt32(now())
                 ) ENGINE = ReplacingMergeTree(created_at)
                 ORDER BY (user_id, source, external_id)",
            )
            .execute()
            .await
            .context("failed to create external_durations_raw")?;
        Ok(())
    }

    pub async fn upsert(
        &self,
        user_id: Uuid,
        request: ExternalDurationRequest,
    ) -> Result<ExternalDuration> {
        validate(&request)?;
        let end_time = request
            .end_time
            .unwrap_or(request.start_time + request.duration_seconds.unwrap_or(0.0));
        let duration_seconds = request
            .duration_seconds
            .unwrap_or_else(|| (end_time - request.start_time).max(0.0));
        let id = Uuid::now_v7();
        let row = ExternalDurationInsertRow {
            id,
            user_id,
            source: request.source,
            external_id: request.external_id,
            start_time: request.start_time,
            end_time,
            duration_seconds,
            category: request.category,
            entity_type: request.entity_type,
            entity: request.entity,
            project: request.project,
            description: request.description,
            source_url: request.source_url,
            provenance: request.provenance,
            sync_version: request.sync_version,
        };
        let model = ExternalDuration {
            id: row.id,
            user_id: row.user_id,
            source: row.source.clone(),
            external_id: row.external_id.clone(),
            start_time: row.start_time,
            end_time: row.end_time,
            duration_seconds: row.duration_seconds,
            category: row.category.clone(),
            entity_type: row.entity_type.clone(),
            entity: row.entity.clone(),
            project: row.project.clone(),
            description: row.description.clone(),
            source_url: row.source_url.clone(),
            provenance: row.provenance.clone(),
            sync_version: row.sync_version.clone(),
        };
        let mut insert = self
            .client
            .get_client()
            .insert("wakaclock.external_durations_raw")
            .map_err(|error| anyhow!("external duration insert error: {error}"))?;
        insert
            .write(&row)
            .await
            .map_err(|error| anyhow!("external duration row error: {error}"))?;
        insert
            .end()
            .await
            .map_err(|error| anyhow!("external duration flush error: {error}"))?;
        Ok(model)
    }

    pub async fn list(
        &self,
        user_id: Uuid,
        filter: ExternalDurationFilter,
    ) -> Result<Vec<ExternalDuration>> {
        let mut query = String::from(
            "SELECT id, user_id, source, external_id, start_time, end_time,
                    duration_seconds, category, entity_type, entity, project,
                    description, source_url, provenance, sync_version
             FROM wakaclock.external_durations_raw FINAL
             WHERE user_id = ?",
        );
        if filter.start_time.is_some() {
            query.push_str(" AND end_time >= ?");
        }
        if filter.end_time.is_some() {
            query.push_str(" AND start_time <= ?");
        }
        if filter.source.is_some() {
            query.push_str(" AND source = ?");
        }
        query.push_str(" ORDER BY start_time ASC LIMIT 10000");

        let mut request = self.client.get_client().query(&query).bind(user_id);
        if let Some(start) = filter.start_time {
            request = request.bind(start);
        }
        if let Some(end) = filter.end_time {
            request = request.bind(end);
        }
        if let Some(source) = filter.source {
            request = request.bind(source);
        }
        let rows = request
            .fetch_all::<ExternalDurationRow>()
            .await
            .context("failed to list external durations")?;
        Ok(rows
            .into_iter()
            .map(ExternalDurationRow::into_model)
            .collect())
    }

    pub async fn delete_source(&self, user_id: Uuid, source: &str) -> Result<DeleteExternalDurationResult> {
        if source.trim().is_empty() {
            return Err(anyhow!("source is required"));
        }
        let count = self
            .client
            .get_client()
            .query("SELECT count() AS count FROM wakaclock.external_durations_raw WHERE user_id = ? AND source = ?")
            .bind(user_id)
            .bind(source)
            .fetch_one::<CountRow>()
            .await
            .context("failed to inspect external durations")?;
        if count.count == 0 {
            return Ok(DeleteExternalDurationResult::NotFound);
        }
        // ClickHouse mutations are asynchronous. The API returns after scheduling the
        // delete and the disconnect audit record is owned by PostgreSQL.
        self.client
            .get_client()
            .query("ALTER TABLE wakaclock.external_durations_raw DELETE WHERE user_id = ? AND source = ?")
            .bind(user_id)
            .bind(source)
            .execute()
            .await
            .context("failed to schedule external duration deletion")?;
        Ok(DeleteExternalDurationResult::Scheduled)
    }
}

#[derive(Debug, serde::Deserialize, clickhouse::Row)]
struct CountRow {
    count: u64,
}

fn validate(request: &ExternalDurationRequest) -> Result<()> {
    if request.source.trim().is_empty() || request.source.len() > 120 {
        return Err(anyhow!("source must contain 1-120 characters"));
    }
    if request.external_id.trim().is_empty() || request.external_id.len() > 512 {
        return Err(anyhow!("external_id must contain 1-512 characters"));
    }
    if !request.start_time.is_finite() || request.start_time < 0.0 {
        return Err(anyhow!("start_time must be a finite Unix timestamp"));
    }
    if let Some(end) = request.end_time {
        if !end.is_finite() || end < request.start_time {
            return Err(anyhow!("end_time must be on or after start_time"));
        }
    }
    if let Some(duration) = request.duration_seconds {
        if !duration.is_finite() || !(0.0..=86_400.0).contains(&duration) {
            return Err(anyhow!("duration_seconds must be between 0 and 86400"));
        }
    }
    if request.description.as_ref().is_some_and(|value| value.len() > 2_000) {
        return Err(anyhow!("description is too long"));
    }
    if request.source_url.as_ref().is_some_and(|value| value.len() > 2_000) {
        return Err(anyhow!("source_url is too long"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> ExternalDurationRequest {
        ExternalDurationRequest {
            source: "calendar".into(),
            external_id: "evt-1".into(),
            start_time: 1_000.0,
            end_time: Some(1_600.0),
            duration_seconds: None,
            category: "meeting".into(),
            entity_type: "event".into(),
            entity: "calendar-event".into(),
            project: None,
            description: Some("Planning".into()),
            source_url: None,
            provenance: "calendar".into(),
            sync_version: "1".into(),
        }
    }

    #[test]
    fn validates_external_duration_bounds() {
        assert!(validate(&request()).is_ok());
        let mut invalid = request();
        invalid.end_time = Some(900.0);
        assert!(validate(&invalid).is_err());
    }
}
