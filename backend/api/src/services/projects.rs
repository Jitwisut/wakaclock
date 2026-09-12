use anyhow::Result;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::date_range::ResolvedRange;
use crate::model::projects::{ProjectItem, ProjectRow, ProjectsResponse};
use crate::services::activity_timeline::{ActivityTimelineService, BridgeConfig, Dimension};

pub struct ProjectsService {
    clickhouse: Arc<ClickHouseClient>,
    /// `/projects` used to sum `project_daily`, so it reported different seconds from the
    /// dashboard for the same range — no union across overlapping emitters and no idle
    /// bridging. It reads the canonical timeline now, and applies project merges on top of
    /// it in Rust rather than in the JOIN the aggregate query used.
    timeline: ActivityTimelineService,
}

impl ProjectsService {
    pub fn new(clickhouse: Arc<ClickHouseClient>, bridge: impl Into<BridgeConfig>) -> Self {
        Self {
            timeline: ActivityTimelineService::new(clickhouse.clone(), bridge),
            clickhouse,
        }
    }

    #[allow(dead_code)]
    pub async fn get_range(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
    ) -> Result<ProjectsResponse> {
        self.get_range_in_timezone(user_id, start, end, None).await
    }

    pub async fn get_range_in_timezone(
        &self,
        user_id: Uuid,
        start: &str,
        end: &str,
        timezone: Option<&str>,
    ) -> Result<ProjectsResponse> {
        let range = ResolvedRange::parse(start, end, timezone)
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;

        let rows = self.fetch_projects(user_id, &range).await?;

        Ok(ProjectsResponse {
            start: start.to_string(),
            end: end.to_string(),
            data: rows
                .into_iter()
                .map(|row| ProjectItem {
                    name: row.name,
                    total_seconds: row.total_seconds,
                    hours: row.total_seconds / 3600.0,
                    text: format_duration(row.total_seconds),
                    heartbeats: row.heartbeat_count,
                })
                .collect(),
        })
    }

    async fn fetch_projects(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
    ) -> Result<Vec<ProjectRow>> {
        let (start_epoch, end_epoch) = range.unix_bounds();
        let merges = self.merge_map(user_id).await?;
        let canonical = self
            .timeline
            .canonical(user_id, start_epoch, end_epoch)
            .await?;

        let mut grouped: HashMap<String, (f64, HashSet<String>)> = HashMap::new();
        for interval in &canonical {
            // A merged project reports under its target name, exactly as the JOIN this
            // replaces did.
            let name = Dimension::Project.value_of(interval);
            let name = merges.get(&name).cloned().unwrap_or(name);
            let entry = grouped.entry(name).or_default();
            entry.0 += interval.end - interval.start;
            entry.1.insert(interval.heartbeat_id.clone());
        }

        let mut rows: Vec<ProjectRow> = grouped
            .into_iter()
            .map(|(name, (total_seconds, heartbeats))| ProjectRow {
                name,
                total_seconds,
                heartbeat_count: heartbeats.len() as u64,
            })
            .collect();
        rows.sort_by(|left, right| {
            right
                .total_seconds
                .partial_cmp(&left.total_seconds)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| left.name.cmp(&right.name))
        });
        Ok(rows)
    }

    /// Latest merge target per source project name.
    async fn merge_map(&self, user_id: Uuid) -> Result<HashMap<String, String>> {
        #[derive(Debug, clickhouse::Row, serde::Deserialize)]
        struct MergeRow {
            source_project: String,
            target_project: String,
        }

        let rows = self
            .clickhouse
            .get_client()
            .query(
                "SELECT source_project, argMax(target_project, updated_at) AS target_project
                 FROM wakaclock.project_merges
                 WHERE user_id = ?
                 GROUP BY source_project",
            )
            .bind(user_id)
            .fetch_all::<MergeRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse project merges query error: {error}"))?;

        Ok(rows
            .into_iter()
            .filter(|row| !row.target_project.is_empty())
            .map(|row| (row.source_project, row.target_project))
            .collect())
    }
}

fn format_duration(secs: f64) -> String {
    let total = secs as u64;
    let hours = total / 3600;
    let minutes = (total % 3600) / 60;
    if hours > 0 {
        format!("{}h {}m", hours, minutes)
    } else {
        format!("{}m", minutes)
    }
}
