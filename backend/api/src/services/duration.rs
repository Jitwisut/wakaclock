use anyhow::Result;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::date_range::ResolvedRange;
use crate::model::duration::DurationBlockRow;
use crate::services::activity_timeline::{total_seconds, ActivityTimelineService, BridgeConfig};

/// Blocks plus the range-level diagnostics used by the combined duration rollout.
/// Keeping this separate from `DurationBlockRow` preserves the existing block shape and
/// lets older callers keep using `get_by_date` while the HTTP response exposes the optional
/// metrics at the top level.
#[derive(Debug)]
pub struct DurationResult {
    pub blocks: Vec<DurationBlockRow>,
    pub comparable_seconds: f64,
    pub ai_measured_seconds: f64,
    pub ai_additional_seconds: f64,
    pub calculation_version: &'static str,
    pub active_seconds: f64,
    pub active_human_seconds: f64,
    pub active_ai_seconds: f64,
    pub active_overlap_seconds: f64,
    pub active_coverage: &'static str,
    pub wakatime_compatible_seconds: f64,
}

/// Project durations from the canonical overlap-free timeline. The previous raw
/// heartbeat/session-gap query could turn an idle switch into ten minutes of coding.
pub struct DurationService {
    timeline: ActivityTimelineService,
}

impl DurationService {
    pub fn new(clickhouse: Arc<ClickHouseClient>, bridge: impl Into<BridgeConfig>) -> Self {
        Self {
            timeline: ActivityTimelineService::new(clickhouse, bridge),
        }
    }

    #[allow(dead_code)]
    pub async fn get_by_date(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
    ) -> Result<Vec<DurationBlockRow>> {
        Ok(self.get_by_date_with_metrics(user_id, range).await?.blocks)
    }

    pub async fn get_by_date_with_metrics(
        &self,
        user_id: Uuid,
        range: &ResolvedRange,
    ) -> Result<DurationResult> {
        let (start, end) = range.unix_bounds();
        let timeline = self.timeline.build_timeline(user_id, start, end).await?;
        let wakatime_compatible_seconds = total_seconds(&timeline.bridged);
        let mut rows: Vec<DurationBlockRow> = Vec::new();
        for interval in timeline.bridged {
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
        Ok(DurationResult {
            blocks: rows,
            comparable_seconds: timeline.comparable_seconds,
            ai_measured_seconds: timeline.ai_measured_seconds,
            ai_additional_seconds: timeline.ai_additional_seconds,
            calculation_version: timeline.calculation_version,
            active_seconds: timeline.active_seconds,
            active_human_seconds: timeline.active_human_seconds,
            active_ai_seconds: timeline.active_ai_seconds,
            active_overlap_seconds: timeline.active_overlap_seconds,
            active_coverage: timeline.active_coverage,
            wakatime_compatible_seconds,
        })
    }
}
