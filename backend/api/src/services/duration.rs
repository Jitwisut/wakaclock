use anyhow::{Context, Result};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::duration::DurationBlockRow;

const SESSION_GAP_SECONDS: u32 = 15 * 60;

pub struct DurationService {
    clickhouse: Arc<ClickHouseClient>,
}

impl DurationService {
    pub fn new(clickhouse: Arc<ClickHouseClient>) -> Self {
        Self { clickhouse }
    }

    pub async fn get_by_date(&self, user_id: Uuid, date: &str) -> Result<Vec<DurationBlockRow>> {
        chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
            .context("Invalid date format, expected YYYY-MM-DD")?;

        let rows = self
            .clickhouse
            .get_client()
            .query(
                "
                WITH ordered AS (
                    SELECT
                        time,
                        entity,
                        project,
                        language,
                        category,
                        lagInFrame(time, 1, time) OVER (ORDER BY time ASC) AS prev_time,
                        row_number() OVER (ORDER BY time ASC) AS row_num
                    FROM wakaclock.heartbeats
                    WHERE user_id = ? AND date = toDate(?)
                ),
                segmented AS (
                    SELECT
                        *,
                        if(row_num = 1 OR (time - prev_time) > ?, 1, 0) AS is_new_session
                    FROM ordered
                ),
                numbered AS (
                    SELECT
                        *,
                        sum(is_new_session)
                            OVER (ORDER BY time ASC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
                            AS session_id
                    FROM segmented
                )
                SELECT
                    min(time) AS start,
                    max(time) AS end,
                    max(time) - min(time) AS duration_seconds,
                    count() AS heartbeat_count,
                    argMin(project, time) AS project,
                    argMin(language, time) AS language,
                    argMin(category, time) AS category,
                    argMin(entity, time) AS entity
                FROM numbered
                GROUP BY session_id
                ORDER BY start ASC
                ",
            )
            .bind(user_id)
            .bind(date)
            .bind(SESSION_GAP_SECONDS)
            .fetch_all::<DurationBlockRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse durations query error: {error}"))?;

        Ok(rows)
    }

    pub fn today_date_string() -> String {
        Utc::now().format("%Y-%m-%d").to_string()
    }
}
