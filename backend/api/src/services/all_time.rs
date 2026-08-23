use anyhow::Result;
use chrono::{DateTime, Utc};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::all_time::{AllTimeData, AllTimeResponse, AllTimeRow};
use crate::services::activity_timeline::{
    canonicalize_bridged, total_seconds, ActivityTimelineService,
};

pub struct AllTimeService {
    timeline: ActivityTimelineService,
}

impl AllTimeService {
    pub fn new(clickhouse: Arc<ClickHouseClient>, idle_timeout_seconds: f64) -> Self {
        Self {
            timeline: ActivityTimelineService::new(clickhouse, idle_timeout_seconds),
        }
    }

    pub async fn get(&self, user_id: Uuid) -> Result<AllTimeResponse> {
        let row = self.fetch_all_time(user_id).await?;

        Ok(AllTimeResponse {
            data: AllTimeData {
                total_seconds: row.total_seconds,
                hours: row.total_seconds / 3600.0,
                text: format_duration(row.total_seconds),
                days_with_activity: row.days_with_activity,
                since: row.since,
            },
        })
    }

    async fn fetch_all_time(&self, user_id: Uuid) -> Result<AllTimeRow> {
        let intervals = self.timeline.intervals(user_id, 0.0, f64::MAX).await?;
        let canonical = canonicalize_bridged(&intervals, self.timeline.idle_timeout_seconds());
        let total = total_seconds(&canonical);
        let mut days = std::collections::HashSet::new();
        let since = canonical
            .iter()
            .filter_map(|interval| {
                let timestamp = DateTime::<Utc>::from_timestamp(interval.start.floor() as i64, 0)?;
                let date = timestamp.date_naive().to_string();
                days.insert(date.clone());
                Some(date)
            })
            .min();
        Ok(AllTimeRow {
            total_seconds: total,
            days_with_activity: days.len() as u64,
            since,
        })
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
