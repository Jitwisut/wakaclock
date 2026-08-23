use anyhow::Result;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::date_range::ResolvedRange;
use crate::model::duration::DurationBlockRow;
use crate::services::activity_timeline::ActivityTimelineService;

/// Project durations from the canonical overlap-free timeline. The previous raw
/// heartbeat/session-gap query could turn an idle switch into ten minutes of coding.
pub struct DurationService {
    timeline: ActivityTimelineService,
}

impl DurationService {
    pub fn new(clickhouse: Arc<ClickHouseClient>, idle_timeout_seconds: f64) -> Self {
        Self {
            timeline: ActivityTimelineService::new(clickhouse, idle_timeout_seconds),
        }
    }

    pub async fn get_by_date(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
    ) -> Result<Vec<DurationBlockRow>> {
        let (start, end) = range.unix_bounds();
        let canonical = self.timeline.canonical(user_id, start, end).await?;
        let mut rows: Vec<DurationBlockRow> = Vec::new();
        for interval in canonical {
            if let Some(previous) = rows.last_mut() {
                if previous.end == interval.start
                    && previous.project == interval.project
                    && previous.language == interval.language
                    && previous.category == interval.category
                    && previous.entity == interval.entity
                {
                    previous.end = interval.end;
                    previous.duration_seconds += interval.end - interval.start;
                    previous.heartbeat_count += 1;
                    continue;
                }
            }
            rows.push(DurationBlockRow {
                start: interval.start,
                end: interval.end,
                duration_seconds: interval.end - interval.start,
                heartbeat_count: 1,
                project: interval.project,
                language: interval.language,
                category: interval.category,
                entity: interval.entity,
            });
        }
        Ok(rows)
    }
}
