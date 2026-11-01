use chrono::Utc;

use crate::model::analytics_explorer::ExplorerDurationSplit;
use crate::model::date_range::ResolvedRange;
use crate::model::replay::{
    ReplayAiSession, ReplayAiSessionsStatus, ReplayResponse, ReplaySegment, REPLAY_MAX_SEGMENTS,
    REPLAY_SCHEMA_VERSION,
};
use crate::services::activity_timeline::CanonicalInterval;
use crate::services::analytics_explorer::{build_filter_options, ExplorerFilters};

#[derive(Debug, PartialEq, Eq)]
pub struct TooManySegments;

fn same_dimensions(segment: &ReplaySegment, interval: &CanonicalInterval) -> bool {
    segment.project_id == interval.project_id
        && segment.project == interval.project
        && segment.language == interval.language
        && segment.category == interval.category
        && segment.branch == interval.branch
        && segment.actor_type == interval.actor_type
        && segment.source == interval.source
}

/// Build replay from the same bridged intervals and filters as explorer. Nothing is
/// calculated here beyond the actor split, so for one range and filter set
/// `summary.total_seconds` equals explorer's and the segments sum to it.
pub fn build_replay_response(
    intervals: &[CanonicalInterval],
    range: &ResolvedRange,
    filters: &ExplorerFilters,
    ai_sessions: Vec<ReplayAiSession>,
    ai_sessions_status: ReplayAiSessionsStatus,
) -> Result<ReplayResponse, TooManySegments> {
    let mut filtered = intervals
        .iter()
        .filter(|interval| filters.matches(interval))
        .collect::<Vec<_>>();
    let mut summary = ExplorerDurationSplit::default();
    for interval in &filtered {
        summary.add_actor(&interval.actor_type, interval.end - interval.start);
    }
    filtered.sort_by(|left, right| left.start.total_cmp(&right.start));

    let mut segments: Vec<ReplaySegment> = Vec::new();
    for interval in filtered {
        if interval.end <= interval.start {
            continue;
        }
        if let Some(last) = segments.last_mut() {
            if last.end == interval.start && same_dimensions(last, interval) {
                last.end = interval.end;
                continue;
            }
        }
        if segments.len() == REPLAY_MAX_SEGMENTS {
            return Err(TooManySegments);
        }
        segments.push(ReplaySegment {
            start: interval.start,
            end: interval.end,
            project_id: interval.project_id,
            project: interval.project.clone(),
            language: interval.language.clone(),
            category: interval.category.clone(),
            branch: interval.branch.clone(),
            actor_type: interval.actor_type,
            source: interval.source.clone(),
        });
    }

    Ok(ReplayResponse {
        ai_sessions,
        ai_sessions_status,
        applied_filters: filters.applied(),
        filter_options: build_filter_options(intervals),
        generated_at: Utc::now().to_rfc3339(),
        range: range.info(),
        schema_version: REPLAY_SCHEMA_VERSION,
        segments,
        summary,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::analytics_explorer::build_explorer_response;
    use uuid::Uuid;
    use wakaclock_core::heartbeat::ActorType;

    const DAY_START: f64 = 1_785_542_400.0; // 2026-08-01T00:00:00Z

    fn interval(
        id: &str,
        actor_type: ActorType,
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
            source: match actor_type {
                ActorType::Human => "editor",
                ActorType::AiVerified | ActorType::AiInferred => "ai",
                ActorType::Unknown => "other",
            }
            .to_string(),
            actor_type,
            actor_confidence: 1.0,
            entity: format!("/Users/someone/private/{id}.rs"),
            project: Some("AtoAxis".to_string()),
            project_id: Some(project_id),
            branch: Some("main".to_string()),
            language: Some(language.to_string()),
            category: "coding".to_string(),
            editor: "VS Code".to_string(),
            operating_system: "macOS".to_string(),
            machine: "private-laptop".to_string(),
        }
    }

    fn range(timezone: &str) -> ResolvedRange {
        ResolvedRange::parse("2026-08-01", "2026-08-02", Some(timezone)).unwrap()
    }

    fn fixture(project_a: Uuid, project_b: Uuid) -> Vec<CanonicalInterval> {
        vec![
            interval(
                "later",
                ActorType::AiInferred,
                DAY_START + 7_200.0,
                DAY_START + 7_500.0,
                project_b,
                "TypeScript",
            ),
            interval(
                "first",
                ActorType::Human,
                DAY_START,
                DAY_START + 600.0,
                project_a,
                "Rust",
            ),
            interval(
                "adjacent",
                ActorType::Human,
                DAY_START + 600.0,
                DAY_START + 1_000.25,
                project_a,
                "Rust",
            ),
            interval(
                "agent",
                ActorType::AiVerified,
                DAY_START + 1_000.25,
                DAY_START + 1_300.0,
                project_a,
                "Rust",
            ),
            interval(
                "gap",
                ActorType::Human,
                DAY_START + 3_600.0,
                DAY_START + 3_660.0,
                project_a,
                "Go",
            ),
            interval(
                "unknown",
                ActorType::Unknown,
                DAY_START + 3_660.0,
                DAY_START + 3_700.0,
                project_b,
                "Go",
            ),
        ]
    }

    fn build(
        intervals: &[CanonicalInterval],
        range: &ResolvedRange,
        filters: &ExplorerFilters,
    ) -> ReplayResponse {
        build_replay_response(
            intervals,
            range,
            filters,
            Vec::new(),
            ReplayAiSessionsStatus::Available,
        )
        .unwrap()
    }

    fn segment_seconds(response: &ReplayResponse) -> f64 {
        response
            .segments
            .iter()
            .map(|segment| segment.end - segment.start)
            .sum()
    }

    fn assert_conserves_explorer(
        intervals: &[CanonicalInterval],
        range: &ResolvedRange,
        filters: &ExplorerFilters,
    ) {
        let explorer = build_explorer_response(intervals, range, filters);
        let replay = build(intervals, range, filters);
        let expected = &explorer.summary.duration;
        assert!(
            (replay.summary.total_seconds - expected.total_seconds).abs() < 1e-9,
            "summary {} != explorer {}",
            replay.summary.total_seconds,
            expected.total_seconds
        );
        assert!((replay.summary.human_seconds - expected.human_seconds).abs() < 1e-9);
        assert!((replay.summary.ai_seconds - expected.ai_seconds).abs() < 1e-9);
        assert!((replay.summary.ai_verified_seconds - expected.ai_verified_seconds).abs() < 1e-9);
        assert!((replay.summary.ai_inferred_seconds - expected.ai_inferred_seconds).abs() < 1e-9);
        assert!((replay.summary.unknown_seconds - expected.unknown_seconds).abs() < 1e-9);
        assert!(
            (segment_seconds(&replay) - expected.total_seconds).abs() < 1e-6,
            "segments {} != explorer {}",
            segment_seconds(&replay),
            expected.total_seconds
        );
    }

    #[test]
    fn conserves_explorer_totals_for_every_filter() {
        let (project_a, project_b) = (Uuid::new_v4(), Uuid::new_v4());
        let intervals = fixture(project_a, project_b);
        let filters = [
            ExplorerFilters::default(),
            ExplorerFilters {
                project_id: Some(project_a),
                ..Default::default()
            },
            ExplorerFilters {
                language: Some("Rust".to_string()),
                ..Default::default()
            },
            ExplorerFilters {
                editor: Some("VS Code".to_string()),
                ..Default::default()
            },
            ExplorerFilters {
                category: Some("coding".to_string()),
                ..Default::default()
            },
            ExplorerFilters {
                operating_system: Some("macOS".to_string()),
                ..Default::default()
            },
            ExplorerFilters {
                source: Some("ai".to_string()),
                ..Default::default()
            },
            ExplorerFilters {
                actor_type: Some(ActorType::AiVerified),
                ..Default::default()
            },
            ExplorerFilters {
                language: Some("Missing".to_string()),
                ..Default::default()
            },
        ];
        for timezone in ["UTC", "Asia/Bangkok", "America/New_York"] {
            for filter in &filters {
                assert_conserves_explorer(&intervals, &range(timezone), filter);
            }
        }
    }

    #[test]
    fn conserves_explorer_totals_across_a_dst_change() {
        let spring_forward = 1_772_953_200.0; // 2026-03-08T07:00:00Z, New York 02:00 → 03:00
        let project = Uuid::new_v4();
        let intervals = vec![
            interval(
                "before",
                ActorType::Human,
                spring_forward - 1_800.0,
                spring_forward,
                project,
                "Rust",
            ),
            interval(
                "after",
                ActorType::Human,
                spring_forward,
                spring_forward + 1_800.0,
                project,
                "Rust",
            ),
        ];
        let range =
            ResolvedRange::parse("2026-03-08", "2026-03-08", Some("America/New_York")).unwrap();
        assert_conserves_explorer(&intervals, &range, &ExplorerFilters::default());
        let replay = build(&intervals, &range, &ExplorerFilters::default());
        assert_eq!(replay.segments.len(), 1);
        assert_eq!(replay.segments[0].end - replay.segments[0].start, 3_600.0);
    }

    #[test]
    fn coalesces_only_touching_intervals_with_identical_dimensions() {
        let project = Uuid::new_v4();
        let replay = build(
            &fixture(project, Uuid::new_v4()),
            &range("UTC"),
            &ExplorerFilters::default(),
        );
        let starts = replay
            .segments
            .iter()
            .map(|segment| segment.start - DAY_START)
            .collect::<Vec<_>>();
        // `first` + `adjacent` merge; the actor change, the gap and the project change do not.
        assert_eq!(starts, vec![0.0, 1_000.25, 3_600.0, 3_660.0, 7_200.0]);
        assert_eq!(replay.segments[0].end - DAY_START, 1_000.25);
    }

    #[test]
    fn segments_ignore_empty_intervals_and_stay_ordered() {
        let project = Uuid::new_v4();
        let mut intervals = fixture(project, project);
        intervals.push(interval(
            "empty",
            ActorType::Human,
            DAY_START + 50.0,
            DAY_START + 50.0,
            project,
            "C",
        ));
        let replay = build(&intervals, &range("UTC"), &ExplorerFilters::default());
        assert!(replay
            .segments
            .windows(2)
            .all(|pair| pair[0].end <= pair[1].start));
        assert!(replay.segments.iter().all(|s| s.end > s.start));
        assert!(replay
            .segments
            .iter()
            .all(|s| s.language.as_deref() != Some("C")));
    }

    #[test]
    fn filter_options_stay_available_while_a_filter_narrows_segments() {
        let intervals = fixture(Uuid::new_v4(), Uuid::new_v4());
        let replay = build(
            &intervals,
            &range("UTC"),
            &ExplorerFilters {
                language: Some("Rust".to_string()),
                ..Default::default()
            },
        );
        let languages = replay
            .filter_options
            .languages
            .iter()
            .map(|option| option.key.as_str())
            .collect::<Vec<_>>();
        assert!(languages.contains(&"TypeScript"));
        assert!(replay
            .segments
            .iter()
            .all(|s| s.language.as_deref() == Some("Rust")));
    }

    #[test]
    fn ai_sessions_never_change_the_measured_total() {
        let intervals = fixture(Uuid::new_v4(), Uuid::new_v4());
        let range = range("UTC");
        let filters = ExplorerFilters::default();
        let without = build(&intervals, &range, &filters);
        let with = build_replay_response(
            &intervals,
            &range,
            &filters,
            vec![ReplayAiSession {
                start: DAY_START,
                end: DAY_START + 50_000.0,
                agent: "claude-code".to_string(),
                model: None,
            }],
            ReplayAiSessionsStatus::Available,
        )
        .unwrap();
        assert_eq!(with.summary.total_seconds, without.summary.total_seconds);
        assert_eq!(with.segments, without.segments);
    }

    #[test]
    fn refuses_a_range_over_the_segment_limit_instead_of_truncating() {
        let project = Uuid::new_v4();
        // Alternating languages cannot coalesce.
        let build_intervals = |count: usize| {
            (0..count)
                .map(|index| {
                    let start = DAY_START + index as f64;
                    interval(
                        "row",
                        ActorType::Human,
                        start,
                        start + 1.0,
                        project,
                        if index % 2 == 0 { "Rust" } else { "Go" },
                    )
                })
                .collect::<Vec<_>>()
        };
        let range = range("UTC");
        let filters = ExplorerFilters::default();
        let status = ReplayAiSessionsStatus::Available;
        let at_limit = build_replay_response(
            &build_intervals(REPLAY_MAX_SEGMENTS),
            &range,
            &filters,
            Vec::new(),
            status,
        );
        assert_eq!(at_limit.unwrap().segments.len(), REPLAY_MAX_SEGMENTS);
        let over = build_replay_response(
            &build_intervals(REPLAY_MAX_SEGMENTS + 1),
            &range,
            &filters,
            Vec::new(),
            status,
        );
        assert_eq!(over.err(), Some(TooManySegments));
    }

    #[test]
    fn wire_format_exposes_no_private_interval_identity() {
        let replay = build(
            &fixture(Uuid::new_v4(), Uuid::new_v4()),
            &range("UTC"),
            &ExplorerFilters::default(),
        );
        let json = serde_json::to_string(&replay).unwrap();
        for private in [
            "private-laptop",
            "/Users/someone",
            "heartbeat_id",
            "segment_id",
        ] {
            assert!(!json.contains(private), "leaked {private}");
        }
        assert!(json.contains("\"actor_type\":\"ai_verified\""));
        assert!(json.contains("\"ai_sessions_status\":\"available\""));
    }
}
