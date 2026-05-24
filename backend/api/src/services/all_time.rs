use anyhow::Result;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::all_time::{AllTimeData, AllTimeResponse, AllTimeRow};

pub struct AllTimeService {
    clickhouse: Arc<ClickHouseClient>,
}

impl AllTimeService {
    pub fn new(clickhouse: Arc<ClickHouseClient>) -> Self {
        Self { clickhouse }
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
        self.clickhouse
            .get_client()
            .query(
                "
                SELECT
                    coalesce(sum(total_seconds), 0.0) AS total_seconds,
                    count() AS days_with_activity,
                    if(count() = 0, NULL, toString(min(date))) AS since
                FROM wakaclock.daily_totals
                WHERE user_id = ?
                ",
            )
            .bind(user_id)
            .fetch_one::<AllTimeRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse all_time query error: {error}"))
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
