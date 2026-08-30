use chrono::{DateTime, Datelike, Duration, TimeZone, Timelike, Utc};
use std::collections::BTreeMap;
use uuid::Uuid;

use crate::model::analytics_explorer::{
    AnalyticsExplorerResponse, ExplorerAppliedFilters, ExplorerBreakdowns, ExplorerCalendarCell,
    ExplorerDurationSplit, ExplorerFilterOption, ExplorerFilterOptions, ExplorerSummary,
    ExplorerTimeCell, ExplorerTimeline, ExplorerTimelineBucket, ANALYTICS_EXPLORER_SCHEMA_VERSION,
};
use crate::model::date_range::ResolvedRange;
use crate::services::activity_timeline::CanonicalInterval;
use wakaclock_core::heartbeat::ActorType;

const WEEKDAYS: [&str; 7] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
];

#[derive(Debug, Clone, Default)]
pub struct ExplorerFilters {
    pub category: Option<String>,
    pub editor: Option<String>,
    pub language: Option<String>,
    pub operating_system: Option<String>,
    pub project_id: Option<Uuid>,
    pub source: Option<String>,
    pub actor_type: Option<ActorType>,
}

impl ExplorerFilters {
    fn matches(&self, interval: &CanonicalInterval) -> bool {
        self.project_id
            .is_none_or(|project_id| interval.project_id == Some(project_id))
            && self
                .actor_type
                .is_none_or(|actor_type| interval.actor_type == actor_type)
            && matches_text(self.language.as_deref(), interval.language.as_deref())
            && matches_text(self.editor.as_deref(), Some(&interval.editor))
            && matches_text(self.category.as_deref(), Some(&interval.category))
            && matches_text(
                self.operating_system.as_deref(),
                Some(&interval.operating_system),
            )
            && self.source.as_deref().is_none_or(|source| match source {
                "human" | "editor" => interval.source == "editor",
                "ai" => interval.source == "ai",
                "other" => interval.source != "editor" && interval.source != "ai",
                _ => true,
            })
    }

    fn applied(&self) -> ExplorerAppliedFilters {
        ExplorerAppliedFilters {
            category: self.category.clone(),
            editor: self.editor.clone(),
            language: self.language.clone(),
            operating_system: self.operating_system.clone(),
            project_id: self.project_id.map(|value| value.to_string()),
            source: self.source.clone(),
            actor_type: self.actor_type.map(|value| value.to_string()),
        }
    }
}

pub fn build_explorer_response(
    intervals: &[CanonicalInterval],
    range: &ResolvedRange,
    filters: &ExplorerFilters,
) -> AnalyticsExplorerResponse {
    let filter_options = build_filter_options(intervals);
    let filtered = intervals
        .iter()
        .filter(|interval| filters.matches(interval))
        .collect::<Vec<_>>();
    let calendar_heatmap = build_calendar_heatmap(&filtered, range);
    let time_heatmap = build_time_heatmap(&filtered, range);
    let timeline = build_timeline(&filtered, range, &calendar_heatmap);
    let duration = split_duration(filtered.iter().copied());
    let active_days = calendar_heatmap
        .iter()
        .filter(|cell| cell.duration.total_seconds > 0.0)
        .count();
    let ai_share_percent = (duration.total_seconds > 0.0)
        .then(|| duration.ai_seconds * 100.0 / duration.total_seconds);

    AnalyticsExplorerResponse {
        applied_filters: filters.applied(),
        breakdowns: build_breakdowns(&filtered),
        calendar_heatmap,
        filter_options,
        generated_at: Utc::now().to_rfc3339(),
        range: range.info(),
        schema_version: ANALYTICS_EXPLORER_SCHEMA_VERSION,
        summary: ExplorerSummary {
            active_days,
            ai_share_percent,
            duration,
        },
        time_heatmap,
        timeline,
    }
}

fn matches_text(filter: Option<&str>, value: Option<&str>) -> bool {
    let Some(filter) = filter.map(str::trim).filter(|value| !value.is_empty()) else {
        return true;
    };
    value
        .unwrap_or("Unknown")
        .trim()
        .eq_ignore_ascii_case(filter)
}

fn seconds(interval: &CanonicalInterval) -> f64 {
    (interval.end - interval.start).max(0.0)
}

fn split_duration<'a>(
    intervals: impl IntoIterator<Item = &'a CanonicalInterval>,
) -> ExplorerDurationSplit {
    let mut split = ExplorerDurationSplit::default();
    for interval in intervals {
        split.add_actor(&interval.actor_type, seconds(interval));
    }
    split
}

fn build_filter_options(intervals: &[CanonicalInterval]) -> ExplorerFilterOptions {
    ExplorerFilterOptions {
        actor_types: actor_type_options(intervals.iter()),
        projects: project_options(intervals.iter()),
        languages: dimension_options(intervals.iter(), |interval| {
            interval.language.as_deref().unwrap_or("Unknown")
        }),
        editors: dimension_options(intervals.iter(), |interval| &interval.editor),
        categories: dimension_options(intervals.iter(), |interval| &interval.category),
        operating_systems: dimension_options(intervals.iter(), |interval| {
            &interval.operating_system
        }),
    }
}

fn build_breakdowns(intervals: &[&CanonicalInterval]) -> ExplorerBreakdowns {
    ExplorerBreakdowns {
        actor_types: actor_type_options(intervals.iter().copied()),
        projects: project_options(intervals.iter().copied()),
        languages: dimension_options(intervals.iter().copied(), |interval| {
            interval.language.as_deref().unwrap_or("Unknown")
        }),
        editors: dimension_options(intervals.iter().copied(), |interval| &interval.editor),
        categories: dimension_options(intervals.iter().copied(), |interval| &interval.category),
        operating_systems: dimension_options(intervals.iter().copied(), |interval| {
            &interval.operating_system
        }),
    }
}

fn dimension_options<'a>(
    intervals: impl IntoIterator<Item = &'a CanonicalInterval>,
    value: impl Fn(&'a CanonicalInterval) -> &'a str,
) -> Vec<ExplorerFilterOption> {
    let mut totals = BTreeMap::<String, f64>::new();
    for interval in intervals {
        let raw = value(interval).trim();
        let name = if raw.is_empty() { "Unknown" } else { raw };
        *totals.entry(name.to_string()).or_default() += seconds(interval);
    }
    sorted_options(totals)
}

fn project_options<'a>(
    intervals: impl IntoIterator<Item = &'a CanonicalInterval>,
) -> Vec<ExplorerFilterOption> {
    let mut totals = BTreeMap::<String, (String, f64)>::new();
    for interval in intervals {
        let Some(project_id) = interval.project_id else {
            continue;
        };
        let name = interval
            .project
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or("Unknown project")
            .to_string();
        let entry = totals
            .entry(project_id.to_string())
            .or_insert_with(|| (name.clone(), 0.0));
        if entry.0 == "Unknown project" && name != "Unknown project" {
            entry.0 = name;
        }
        entry.1 += seconds(interval);
    }
    let mut options = totals
        .into_iter()
        .map(|(key, (name, total_seconds))| ExplorerFilterOption {
            key,
            name,
            total_seconds,
        })
        .collect::<Vec<_>>();
    sort_filter_options(&mut options);
    options
}

fn actor_type_options<'a>(
    intervals: impl IntoIterator<Item = &'a CanonicalInterval>,
) -> Vec<ExplorerFilterOption> {
    let mut totals = BTreeMap::<String, f64>::new();
    for interval in intervals {
        *totals.entry(interval.actor_type.to_string()).or_default() += seconds(interval);
    }
    sorted_options(totals)
}

fn sorted_options(totals: BTreeMap<String, f64>) -> Vec<ExplorerFilterOption> {
    let mut options = totals
        .into_iter()
        .map(|(name, total_seconds)| ExplorerFilterOption {
            key: name.clone(),
            name,
            total_seconds,
        })
        .collect::<Vec<_>>();
    sort_filter_options(&mut options);
    options
}

fn sort_filter_options(options: &mut [ExplorerFilterOption]) {
    options.sort_by(|left, right| {
        right
            .total_seconds
            .partial_cmp(&left.total_seconds)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| left.name.cmp(&right.name))
    });
}

fn build_timeline(
    intervals: &[&CanonicalInterval],
    range: &ResolvedRange,
    calendar: &[ExplorerCalendarCell],
) -> ExplorerTimeline {
    let days = range.days_included();
    if days > 7 {
        return ExplorerTimeline {
            bucket_seconds: 86_400,
            items: calendar
                .iter()
                .map(|cell| ExplorerTimelineBucket {
                    bucket: cell.date.clone(),
                    label: cell.date.clone(),
                    duration: cell.duration.clone(),
                })
                .collect(),
        };
    }

    let bucket_seconds = if days == 1 { 1_800 } else { 3_600 };
    let (range_start, range_end) = range.unix_bounds();
    let bucket_width = bucket_seconds as f64;
    let bucket_count = ((range_end - range_start) / bucket_width).ceil().max(0.0) as usize;
    let mut totals = vec![ExplorerDurationSplit::default(); bucket_count];

    for interval in intervals {
        let mut cursor = interval.start.max(range_start);
        let end = interval.end.min(range_end);
        while cursor < end {
            let index = ((cursor - range_start) / bucket_width).floor().max(0.0) as usize;
            if index >= totals.len() {
                break;
            }
            let boundary = (range_start + (index + 1) as f64 * bucket_width).min(end);
            totals[index].add_actor(&interval.actor_type, boundary - cursor);
            cursor = boundary;
        }
    }

    let items = totals
        .into_iter()
        .enumerate()
        .map(|(index, duration)| {
            let timestamp = range_start + index as f64 * bucket_width;
            let local = local_datetime(timestamp, range);
            ExplorerTimelineBucket {
                bucket: local.to_rfc3339(),
                label: if days == 1 {
                    local.format("%H:%M").to_string()
                } else {
                    local.format("%a %H:%M").to_string()
                },
                duration,
            }
        })
        .collect();

    ExplorerTimeline {
        bucket_seconds,
        items,
    }
}

fn build_calendar_heatmap(
    intervals: &[&CanonicalInterval],
    range: &ResolvedRange,
) -> Vec<ExplorerCalendarCell> {
    let mut totals = BTreeMap::<String, ExplorerDurationSplit>::new();
    for offset in 0..range.days_included() {
        totals.insert(
            (range.start + Duration::days(offset)).to_string(),
            ExplorerDurationSplit::default(),
        );
    }
    for interval in intervals {
        for_minute_slice(interval, range, |timestamp, slice_seconds| {
            let date = timestamp.date_naive().to_string();
            totals
                .entry(date)
                .or_default()
                .add_actor(&interval.actor_type, slice_seconds);
        });
    }
    totals
        .into_iter()
        .map(|(date, duration)| ExplorerCalendarCell { date, duration })
        .collect()
}

fn build_time_heatmap(
    intervals: &[&CanonicalInterval],
    range: &ResolvedRange,
) -> Vec<ExplorerTimeCell> {
    let mut totals = vec![ExplorerDurationSplit::default(); 7 * 24];
    for interval in intervals {
        for_minute_slice(interval, range, |timestamp, slice_seconds| {
            let weekday = timestamp.weekday().num_days_from_monday() as usize;
            let hour = timestamp.hour() as usize;
            totals[weekday * 24 + hour].add_actor(&interval.actor_type, slice_seconds);
        });
    }

    totals
        .into_iter()
        .enumerate()
        .map(|(index, duration)| {
            let weekday = index / 24;
            ExplorerTimeCell {
                hour: (index % 24) as u8,
                weekday: weekday as u8,
                weekday_name: WEEKDAYS[weekday].to_string(),
                duration,
            }
        })
        .collect()
}

fn for_minute_slice(
    interval: &CanonicalInterval,
    range: &ResolvedRange,
    mut visit: impl FnMut(DateTime<chrono_tz::Tz>, f64),
) {
    let (range_start, range_end) = range.unix_bounds();
    let mut cursor = interval.start.max(range_start);
    let end = interval.end.min(range_end);
    while cursor < end {
        let next_minute = ((cursor / 60.0).floor() + 1.0) * 60.0;
        let next = end.min(next_minute.max(cursor + 0.000_001));
        let midpoint = cursor + (next - cursor) / 2.0;
        visit(local_datetime(midpoint, range), next - cursor);
        cursor = next;
    }
}

fn local_datetime(timestamp: f64, range: &ResolvedRange) -> DateTime<chrono_tz::Tz> {
    let seconds = timestamp.floor() as i64;
    let nanos =
        ((timestamp - timestamp.floor()) * 1_000_000_000.0).clamp(0.0, 999_999_999.0) as u32;
    Utc.timestamp_opt(seconds, nanos)
        .single()
        .unwrap_or_else(Utc::now)
        .with_timezone(&range.timezone)
}

#[cfg(test)]
pub fn total_breakdown_seconds(items: &[ExplorerFilterOption]) -> f64 {
    items.iter().map(|item| item.total_seconds).sum()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::activity_timeline::CanonicalInterval;

    fn interval(
        id: &str,
        source: &str,
        start: f64,
        end: f64,
        project_id: Uuid,
        language: &str,
    ) -> CanonicalInterval {
        CanonicalInterval {
            segment_id: id.to_string(),
            heartbeat_id: id.to_string(),
            start,
            end,
            source: source.to_string(),
            actor_type: match source {
                "editor" => wakaclock_core::heartbeat::ActorType::Human,
                "ai" => wakaclock_core::heartbeat::ActorType::AiVerified,
                _ => wakaclock_core::heartbeat::ActorType::Unknown,
            },
            actor_confidence: if source == "other" { 0.0 } else { 1.0 },
            entity: format!("{id}.rs"),
            project: Some("AtoAxis".to_string()),
            project_id: Some(project_id),
            branch: Some("main".to_string()),
            language: Some(language.to_string()),
            category: "coding".to_string(),
            editor: "VS Code".to_string(),
            operating_system: "macOS".to_string(),
        }
    }

    #[test]
    fn filters_duration_without_changing_available_filter_options() {
        let range = ResolvedRange::parse("2026-08-28", "2026-08-28", Some("UTC")).unwrap();
        let (start, _) = range.unix_bounds();
        let project_id = Uuid::new_v4();
        let intervals = vec![
            interval("human", "editor", start, start + 600.0, project_id, "Rust"),
            interval("ai", "ai", start + 600.0, start + 900.0, project_id, "Rust"),
        ];
        let filters = ExplorerFilters {
            source: Some("ai".to_string()),
            ..ExplorerFilters::default()
        };
        let response = build_explorer_response(&intervals, &range, &filters);

        assert_eq!(response.summary.duration.total_seconds, 300.0);
        assert_eq!(response.summary.duration.ai_seconds, 300.0);
        assert_eq!(response.filter_options.projects.len(), 1);
        assert_eq!(response.filter_options.languages[0].name, "Rust");
    }

    #[test]
    fn timeline_and_heatmaps_conserve_filtered_duration() {
        let range = ResolvedRange::parse("2026-08-28", "2026-08-28", Some("Asia/Bangkok")).unwrap();
        let (start, _) = range.unix_bounds();
        let project_id = Uuid::new_v4();
        let intervals = vec![interval(
            "cross-hour",
            "editor",
            start + 3_570.0,
            start + 3_690.0,
            project_id,
            "Rust",
        )];
        let response = build_explorer_response(&intervals, &range, &ExplorerFilters::default());
        let timeline_total: f64 = response
            .timeline
            .items
            .iter()
            .map(|bucket| bucket.duration.total_seconds)
            .sum();
        let calendar_total: f64 = response
            .calendar_heatmap
            .iter()
            .map(|cell| cell.duration.total_seconds)
            .sum();
        let heatmap_total: f64 = response
            .time_heatmap
            .iter()
            .map(|cell| cell.duration.total_seconds)
            .sum();

        assert_eq!(timeline_total, 120.0);
        assert_eq!(calendar_total, 120.0);
        assert_eq!(heatmap_total, 120.0);
        assert_eq!(response.summary.duration.total_seconds, 120.0);
    }

    #[test]
    fn project_filter_uses_stable_project_identity() {
        let range = ResolvedRange::parse("2026-08-28", "2026-08-28", Some("UTC")).unwrap();
        let (start, _) = range.unix_bounds();
        let first = Uuid::new_v4();
        let second = Uuid::new_v4();
        let intervals = vec![
            interval("first", "editor", start, start + 60.0, first, "Rust"),
            interval(
                "second",
                "editor",
                start + 60.0,
                start + 180.0,
                second,
                "Rust",
            ),
        ];
        let response = build_explorer_response(
            &intervals,
            &range,
            &ExplorerFilters {
                project_id: Some(second),
                ..ExplorerFilters::default()
            },
        );
        assert_eq!(response.summary.duration.total_seconds, 120.0);
        assert_eq!(response.breakdowns.projects.len(), 1);
        assert_eq!(response.breakdowns.projects[0].key, second.to_string());
    }

    #[test]
    fn breakdown_totals_match_the_response_total() {
        let range = ResolvedRange::parse("2026-08-28", "2026-08-28", Some("UTC")).unwrap();
        let (start, _) = range.unix_bounds();
        let project_id = Uuid::new_v4();
        let intervals = vec![
            interval("rust", "editor", start, start + 100.0, project_id, "Rust"),
            interval(
                "ts",
                "editor",
                start + 100.0,
                start + 220.0,
                project_id,
                "TypeScript",
            ),
        ];
        let response = build_explorer_response(&intervals, &range, &ExplorerFilters::default());
        assert_eq!(
            total_breakdown_seconds(&response.breakdowns.languages),
            response.summary.duration.total_seconds
        );
    }
}
