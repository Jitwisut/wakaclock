use anyhow::Result;
use chrono::{DateTime, NaiveDate, Utc};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::model::all_time::{AllTimeData, AllTimeResponse, AllTimeRow};
use crate::model::date_range::ResolvedRange;
use crate::services::activity_timeline::{total_seconds, ActivityTimelineService, BridgeConfig};

pub struct AllTimeService {
    timeline: ActivityTimelineService,
}

impl AllTimeService {
    pub fn new(clickhouse: Arc<ClickHouseClient>, bridge: impl Into<BridgeConfig>) -> Self {
        Self {
            timeline: ActivityTimelineService::new(clickhouse, bridge),
        }
    }

    #[allow(dead_code)]
    pub async fn get(&self, user_id: Uuid) -> Result<AllTimeResponse> {
        self.get_in_timezone(user_id, None).await
    }

    pub async fn get_in_timezone(
        &self,
        user_id: Uuid,
        timezone: Option<&str>,
    ) -> Result<AllTimeResponse> {
        let row = self.fetch_all_time(user_id, timezone).await?;

        Ok(AllTimeResponse {
            data: AllTimeData {
                total_seconds: row.total_seconds,
                hours: row.total_seconds / 3600.0,
                text: format_duration(row.total_seconds),
                days_with_activity: row.days_with_activity,
                since: row.since,
                comparable_seconds: Some(row.comparable_seconds),
                ai_measured_seconds: Some(row.ai_measured_seconds),
                ai_additional_seconds: Some(row.ai_additional_seconds),
                calculation_version: Some(row.calculation_version),
                active_seconds: Some(row.active_seconds),
                active_human_seconds: Some(row.active_human_seconds),
                active_human_only_seconds: Some(row.active_human_only_seconds),
                active_ai_only_seconds: Some(row.active_ai_only_seconds),
                active_ai_seconds: Some(row.active_ai_seconds),
                active_overlap_seconds: Some(row.active_overlap_seconds),
                active_coverage: Some(row.active_coverage),
                wakatime: None,
            },
        })
    }

    async fn fetch_all_time(&self, user_id: Uuid, timezone: Option<&str>) -> Result<AllTimeRow> {
        // Validate and resolve the display zone once. The timeline remains an all-time
        // query, while `days_with_activity` and `since` follow the viewer's calendar.
        let today = ResolvedRange::today_date_string(timezone)
            .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        let display_timezone = ResolvedRange::parse(&today, &today, timezone)
            .map_err(|error| anyhow::anyhow!(error.to_string()))?
            .timezone;
        let timeline = self.timeline.build_timeline(user_id, 0.0, f64::MAX).await?;
        let canonical = timeline.bridged.clone();
        let total = total_seconds(&canonical);
        let mut days = std::collections::HashSet::new();
        for interval in &canonical {
            let Some((first_day, last_day)) = local_interval_dates(interval, &display_timezone)
            else {
                continue;
            };
            let mut day = first_day;
            loop {
                days.insert(day.to_string());
                if day >= last_day {
                    break;
                }
                let Some(next) = day.succ_opt() else {
                    break;
                };
                day = next;
            }
        }
        let since = days.iter().min().cloned();
        Ok(AllTimeRow {
            total_seconds: total,
            days_with_activity: days.len() as u64,
            since,
            comparable_seconds: timeline.comparable_seconds,
            ai_measured_seconds: timeline.ai_measured_seconds,
            ai_additional_seconds: timeline.ai_additional_seconds,
            calculation_version: timeline.calculation_version.to_string(),
            active_seconds: timeline.active_seconds,
            active_human_seconds: timeline.active_human_seconds,
            active_human_only_seconds: (timeline.active_human_seconds
                - timeline.active_overlap_seconds)
                .max(0.0),
            active_ai_only_seconds: (timeline.active_ai_seconds - timeline.active_overlap_seconds)
                .max(0.0),
            active_ai_seconds: timeline.active_ai_seconds,
            active_overlap_seconds: timeline.active_overlap_seconds,
            active_coverage: timeline.active_coverage.to_string(),
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

/// Return every local calendar date touched by an interval. The end is exclusive, so an
/// interval that ends exactly at local midnight belongs to the preceding date only. This
/// keeps all-time `days_with_activity` consistent with the daily summary when a bridged
/// session crosses midnight.
fn local_interval_dates(
    interval: &crate::services::activity_timeline::CanonicalInterval,
    timezone: &chrono_tz::Tz,
) -> Option<(NaiveDate, NaiveDate)> {
    if !interval.start.is_finite() || !interval.end.is_finite() || interval.end <= interval.start {
        return None;
    }
    let start_seconds = interval.start.floor();
    let end_seconds = interval.end.ceil();
    if start_seconds < i64::MIN as f64
        || start_seconds > i64::MAX as f64
        || end_seconds <= i64::MIN as f64
        || end_seconds > i64::MAX as f64
    {
        return None;
    }
    let start = DateTime::<Utc>::from_timestamp(start_seconds as i64, 0)?
        .with_timezone(timezone)
        .date_naive();
    let last_observed_second = (end_seconds as i64).saturating_sub(1);
    let end = DateTime::<Utc>::from_timestamp(last_observed_second, 0)?
        .with_timezone(timezone)
        .date_naive();
    Some((start, end.max(start)))
}

#[cfg(test)]
mod tests {
    use super::local_interval_dates;
    use crate::services::activity_timeline::CanonicalInterval;
    use chrono::NaiveDate;
    use chrono_tz::Asia::Bangkok;
    use wakaclock_core::heartbeat::ActorType;

    fn interval(start: f64, end: f64) -> CanonicalInterval {
        CanonicalInterval {
            segment_id: "segment".into(),
            heartbeat_id: "heartbeat".into(),
            start,
            end,
            source: "editor".into(),
            actor_type: ActorType::Human,
            actor_confidence: 1.0,
            entity: "file".into(),
            project: None,
            project_id: None,
            branch: None,
            language: None,
            category: "coding".into(),
            editor: "vscode".into(),
            operating_system: "macos".into(),
            machine: "test".into(),
        }
    }

    #[test]
    fn cross_midnight_interval_counts_both_local_dates() {
        let start = NaiveDate::from_ymd_opt(2026, 9, 12)
            .unwrap()
            // 23:59:30 in Asia/Bangkok is 16:59:30 UTC.
            .and_hms_opt(16, 59, 30)
            .unwrap()
            .and_utc()
            .timestamp() as f64;
        let end = start + 90.0;
        assert_eq!(
            local_interval_dates(&interval(start, end), &Bangkok),
            Some((
                NaiveDate::from_ymd_opt(2026, 9, 12).unwrap(),
                NaiveDate::from_ymd_opt(2026, 9, 13).unwrap(),
            ))
        );
    }

    #[test]
    fn exact_midnight_end_does_not_add_the_next_date() {
        let end = NaiveDate::from_ymd_opt(2026, 9, 13)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_local_timezone(Bangkok)
            .single()
            .unwrap()
            .timestamp() as f64;
        assert_eq!(
            local_interval_dates(&interval(end - 30.0, end), &Bangkok),
            Some((
                NaiveDate::from_ymd_opt(2026, 9, 12).unwrap(),
                NaiveDate::from_ymd_opt(2026, 9, 12).unwrap(),
            ))
        );
    }
}
