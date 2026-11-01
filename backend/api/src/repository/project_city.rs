//! Read-only daily file facts for the Time Machine city. No duration is read or derived.

use anyhow::Result;
use clickhouse::Row;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::project_city::PROJECT_CITY_MAX_ROWS;

#[derive(Debug, Clone, Row, Deserialize, PartialEq, Eq)]
pub struct CityFileDayRow {
    pub entity: String,
    pub day: String,
    pub lines: u32,
    pub language: String,
    pub dependencies: Vec<String>,
}

pub struct ProjectCityRepository {
    client: Arc<ClickHouseClient>,
}

impl ProjectCityRepository {
    pub fn new(client: Arc<ClickHouseClient>) -> Self {
        Self { client }
    }

    /// One row per file per local day. A value a client did not report stays empty, so the
    /// service can carry the last known one forward instead of reading it as zero.
    pub async fn file_days(
        &self,
        user_id: Uuid,
        project_id: Uuid,
        timezone: &str,
    ) -> Result<Vec<CityFileDayRow>> {
        self.client
            .get_client()
            .query(
                "SELECT entity,
                        toString(toDate(toDateTime(toUInt32(time), ?))) AS day,
                        toUInt32(ifNull(argMaxIf(lines, time, ifNull(lines, 0) > 0), 0)) AS lines,
                        ifNull(argMaxIf(language, time, notEmpty(ifNull(language, ''))), '') AS language,
                        argMaxIf(dependencies, time, notEmpty(dependencies)) AS dependencies
                 FROM wakaclock.heartbeats_canonical
                 WHERE user_id = ? AND project_id = ? AND entity_type = 'file'
                 GROUP BY entity, day
                 ORDER BY day ASC, entity ASC
                 LIMIT ?",
            )
            .bind(timezone)
            .bind(user_id)
            .bind(project_id)
            .bind(PROJECT_CITY_MAX_ROWS as u64 + 1)
            .fetch_all::<CityFileDayRow>()
            .await
            .map_err(|error| anyhow::anyhow!("Project city query failed: {error}"))
    }
}
