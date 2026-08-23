use anyhow::Result;
use clickhouse::Row;
use serde::Deserialize;
use std::{cmp::Ordering, collections::HashSet, sync::Arc};
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use wakaclock_core::heartbeat::{ActivitySegment, MAX_ACTIVITY_GAP_SECONDS};

/// One raw interval recovered from a heartbeat. The fallback interval for a legacy
/// heartbeat is deliberately capped at the strict 120-second window; old payloads that
/// claimed ten minutes are retained as audit data but never inflate the canonical clock.
#[derive(Debug, Clone)]
pub struct ActivityInterval {
    pub segment_id: String,
    pub heartbeat_id: String,
    pub start: f64,
    pub end: f64,
    pub source: String,
    pub entity: String,
    pub project: Option<String>,
    pub language: Option<String>,
    pub category: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CanonicalInterval {
    pub segment_id: String,
    pub heartbeat_id: String,
    pub start: f64,
    pub end: f64,
    pub source: String,
    pub entity: String,
    pub project: Option<String>,
    pub language: Option<String>,
    pub category: String,
}

#[derive(Debug, Row, Deserialize)]
struct RawActivityRow {
    entity: String,
    time: f64,
    project: Option<String>,
    language: Option<String>,
    category: String,
    is_ai_generated: bool,
    heartbeat_id: Option<String>,
    active_seconds: Option<f64>,
    activity_segments: String,
}

#[derive(Debug, Row, Deserialize)]
struct ProjectedActivityRow {
    segment_id: String,
    heartbeat_id: String,
    start: f64,
    end: f64,
    source: String,
    entity: String,
    project: Option<String>,
    language: Option<String>,
    category: String,
}

pub struct ActivityTimelineService {
    clickhouse: Arc<ClickHouseClient>,
    /// See `Config::idle_timeout_seconds`. Passed in rather than read from a global so
    /// a test can pin it and two deployments can disagree without a rebuild.
    idle_timeout_seconds: f64,
}

impl ActivityTimelineService {
    pub fn new(clickhouse: Arc<ClickHouseClient>, idle_timeout_seconds: f64) -> Self {
        Self {
            clickhouse,
            idle_timeout_seconds,
        }
    }

    pub fn idle_timeout_seconds(&self) -> f64 {
        self.idle_timeout_seconds
    }

    pub async fn intervals(
        &self,
        user_id: Uuid,
        start: f64,
        end: f64,
    ) -> Result<Vec<ActivityInterval>> {
        // New clients are projected into a deduplicated interval table at ingest. Read it
        // first; the raw-heartbeat path below is a compatibility fallback for old rows
        // and for deployments that have not run the additive migration yet.
        let projected = self
            .clickhouse
            .get_client()
            .query(
                "SELECT segment_id, heartbeat_id, `start`, `end`, source, entity, project, language, category
                 FROM wakaclock.activity_intervals FINAL
                 WHERE user_id = ? AND `end` > ? AND `start` < ?
                 ORDER BY `start` ASC, heartbeat_id ASC",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<ProjectedActivityRow>()
            .await
            .unwrap_or_default();
        let mut seen_heartbeats = HashSet::new();
        let mut seen_segments = HashSet::new();
        let mut intervals = Vec::new();
        for row in projected {
            let start_value = row.start.max(start);
            let end_value = row.end.min(end);
            if end_value <= start_value {
                continue;
            }
            seen_heartbeats.insert(row.heartbeat_id.clone());
            if !seen_segments.insert(row.segment_id.clone()) {
                continue;
            }
            intervals.push(ActivityInterval {
                segment_id: row.segment_id,
                heartbeat_id: row.heartbeat_id,
                start: start_value,
                end: end_value,
                source: normalized_source(Some(&row.source), false),
                entity: row.entity,
                project: row.project,
                language: row.language,
                category: row.category,
            });
        }
        let rows = self
            .clickhouse
            .get_client()
            .query(
                "SELECT entity, time, project, language, category, is_ai_generated,
                        heartbeat_id, active_seconds, activity_segments
                 FROM wakaclock.heartbeats
                 -- A legacy heartbeat stores only its end timestamp plus
                 -- `active_seconds`. Include one strict window on either side so an
                 -- interval crossing a day/range boundary is still recovered before
                 -- it is clipped below. New segment-bearing rows are also safe here.
                 WHERE user_id = ? AND time >= ? AND time < ?
                 ORDER BY time ASC, heartbeat_id ASC",
            )
            .bind(user_id)
            .bind(start - MAX_ACTIVITY_GAP_SECONDS)
            .bind(end + MAX_ACTIVITY_GAP_SECONDS)
            .fetch_all::<RawActivityRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse activity timeline query error: {error}")
            })?;

        for row in rows {
            let heartbeat_id = row
                .heartbeat_id
                .clone()
                .unwrap_or_else(|| format!("legacy:{}:{:.6}", row.entity, row.time));
            // Stable heartbeat IDs make retries idempotent. For old rows without one, the
            // deterministic entity/time identity still removes exact retry copies.
            if !seen_heartbeats.insert(heartbeat_id.clone()) {
                continue;
            }
            let mut segments = serde_json::from_str::<Vec<ActivitySegment>>(&row.activity_segments)
                .unwrap_or_default();
            if segments.is_empty() {
                // A claim longer than the evidence window is clamped, never dropped.
                // Dropping it was silent data loss — the client had observed real work
                // and the whole heartbeat contributed zero. The clamp keeps only what
                // one heartbeat can prove; the gap in front of it is recovered by
                // `bridge_idle_gaps` when a neighbouring interval vouches for it.
                if let Some(seconds) = row
                    .active_seconds
                    .filter(|value| value.is_finite() && *value > 0.0)
                    .map(|value| value.min(MAX_ACTIVITY_GAP_SECONDS))
                {
                    segments.push(ActivitySegment {
                        segment_id: format!("{heartbeat_id}:legacy-segment"),
                        start: (row.time - seconds).max(start),
                        end: row.time.min(end),
                        source: None,
                    });
                }
            }
            if segments.is_empty() {
                // The heartbeat measured no duration — an editor switch, or an agent
                // edit whose previous event was more than the evidence window ago. It is
                // still proof the developer was in this file at this instant, which is
                // exactly what a WakaTime heartbeat is, so it is kept as a zero-length
                // anchor. Anchors add no time by themselves; they give `bridge_idle_gaps`
                // something to reach, and without them an isolated agent edit could never
                // be worth anything at all.
                if row.time >= start && row.time < end {
                    intervals.push(ActivityInterval {
                        segment_id: format!("{heartbeat_id}:anchor"),
                        heartbeat_id: heartbeat_id.clone(),
                        start: row.time,
                        end: row.time,
                        source: normalized_source(None, row.is_ai_generated),
                        entity: row.entity.clone(),
                        project: row.project.clone(),
                        language: row.language.clone(),
                        category: row.category.clone(),
                    });
                }
                continue;
            }
            for segment in segments {
                // Ingest validation rejects oversized segments, so this only fires for
                // rows written before that rule existed. Clamp to the trailing window
                // rather than discarding the row's entire contribution.
                let clamped_start = segment.start.max(segment.end - MAX_ACTIVITY_GAP_SECONDS);
                let segment_start = clamped_start.max(start);
                let segment_end = segment.end.min(end);
                if !segment_start.is_finite() || !segment_end.is_finite() || segment_end <= segment_start
                {
                    continue;
                }
                let segment_id = if segment.segment_id.trim().is_empty() {
                    format!("{heartbeat_id}:{:.6}:{:.6}", segment.start, segment.end)
                } else {
                    segment.segment_id
                };
                if !seen_segments.insert(segment_id.clone()) {
                    continue;
                }
                intervals.push(ActivityInterval {
                    segment_id,
                    heartbeat_id: heartbeat_id.clone(),
                    start: segment_start,
                    end: segment_end,
                    source: normalized_source(segment.source.as_deref(), row.is_ai_generated),
                    entity: row.entity.clone(),
                    project: row.project.clone(),
                    language: row.language.clone(),
                    category: row.category.clone(),
                });
            }
        }
        Ok(intervals)
    }

    pub async fn canonical(
        &self,
        user_id: Uuid,
        start: f64,
        end: f64,
    ) -> Result<Vec<CanonicalInterval>> {
        Ok(canonicalize_bridged(
            &self.intervals(user_id, start, end).await?,
            self.idle_timeout_seconds,
        ))
    }
}

pub fn normalized_source(source: Option<&str>, is_ai_generated: bool) -> String {
    let source = source.unwrap_or(if is_ai_generated { "ai" } else { "editor" });
    if source.eq_ignore_ascii_case("human") || source.eq_ignore_ascii_case("editor") {
        "editor".to_string()
    } else if source.eq_ignore_ascii_case("ai") || source.to_ascii_lowercase().contains("agent") {
        "ai".to_string()
    } else {
        "other".to_string()
    }
}

fn source_priority(source: &str) -> u8 {
    match source {
        "editor" => 0,
        "ai" => 1,
        _ => 2,
    }
}

/// Sweep all interval boundaries and choose one deterministic owner per second. Human
/// editor activity wins over AI, then other sources; ties use heartbeat/segment IDs.
pub fn canonicalize(intervals: &[ActivityInterval]) -> Vec<CanonicalInterval> {
    let mut boundaries = intervals
        .iter()
        .flat_map(|interval| [interval.start, interval.end])
        .filter(|value| value.is_finite())
        .collect::<Vec<_>>();
    boundaries.sort_by(|left, right| left.partial_cmp(right).unwrap_or(Ordering::Equal));
    boundaries.dedup_by(|left, right| (*left - *right).abs() < 0.000_001);

    let mut result: Vec<CanonicalInterval> = Vec::new();
    for pair in boundaries.windows(2) {
        let start = pair[0];
        let end = pair[1];
        if end <= start {
            continue;
        }
        let Some(owner) = intervals
            .iter()
            .filter(|interval| interval.start <= start && interval.end >= end)
            .min_by(|left, right| {
                source_priority(&left.source)
                    .cmp(&source_priority(&right.source))
                    .then_with(|| left.heartbeat_id.cmp(&right.heartbeat_id))
                    .then_with(|| left.segment_id.cmp(&right.segment_id))
            })
        else {
            continue;
        };

        if let Some(previous) = result.last_mut() {
            if previous.end == start
                && previous.heartbeat_id == owner.heartbeat_id
                && previous.segment_id == owner.segment_id
            {
                previous.end = end;
                continue;
            }
        }
        result.push(CanonicalInterval {
            segment_id: owner.segment_id.clone(),
            heartbeat_id: owner.heartbeat_id.clone(),
            start,
            end,
            source: owner.source.clone(),
            entity: owner.entity.clone(),
            project: owner.project.clone(),
            language: owner.language.clone(),
            category: owner.category.clone(),
        });
    }
    result
}

/// Credit the pause between two *proven* activity intervals to the earlier one.
///
/// This is the piece wakaclock was missing relative to WakaTime. A segment can only ever
/// be 120 seconds long, because that is all one heartbeat can prove — so a pause spent
/// reading, thinking, or watching a test run produced nothing at all, and a real day of
/// work reported minutes. WakaTime solves this in its duration builder: consecutive
/// heartbeats less than the user's timeout apart are one continuous session.
///
/// The rule here is deliberately stricter than "extend the last heartbeat by the
/// timeout": time is only ever added *between* two intervals that both actually
/// happened, so the clock can never run past the last thing the user was observed doing.
/// A trailing pause at the end of a session stays uncounted, exactly as in WakaTime.
///
/// The gap is attributed to the earlier interval — same as WakaTime's heartbeat-to-next
/// mini-duration — so switching files does not retroactively hand the pause to the file
/// that happened to be opened next.
pub fn bridge_idle_gaps(
    intervals: Vec<CanonicalInterval>,
    idle_timeout_seconds: f64,
) -> Vec<CanonicalInterval> {
    bridge_idle_gaps_with_anchors(intervals, &[], idle_timeout_seconds)
}

/// `anchors` are heartbeats that prove the developer was working at an instant without
/// any measurable duration attached — an editor switch, or an agent edit whose previous
/// event was longer ago than the evidence window. They are what makes a chain of pauses
/// behave the way WakaTime's does: three heartbeats ten minutes apart are one 20-minute
/// session, not three zero-second events, because each is close enough to the last.
///
/// An anchor with nothing before it opens a run rather than being discarded — WakaTime's
/// first heartbeat starts the clock too. It contributes nothing on its own; a run that
/// never grows past zero length is dropped at the end.
pub fn bridge_idle_gaps_with_anchors(
    intervals: Vec<CanonicalInterval>,
    anchors: &[ActivityInterval],
    idle_timeout_seconds: f64,
) -> Vec<CanonicalInterval> {
    if !idle_timeout_seconds.is_finite() || idle_timeout_seconds <= 0.0 {
        return intervals;
    }

    enum Event {
        Interval(CanonicalInterval),
        Anchor(CanonicalInterval),
    }

    let mut events: Vec<Event> = Vec::with_capacity(intervals.len() + anchors.len());
    events.extend(intervals.into_iter().map(Event::Interval));
    events.extend(
        anchors
            .iter()
            .filter(|anchor| anchor.start.is_finite())
            .map(|anchor| {
                Event::Anchor(CanonicalInterval {
                    segment_id: anchor.segment_id.clone(),
                    heartbeat_id: anchor.heartbeat_id.clone(),
                    start: anchor.start,
                    end: anchor.start,
                    source: anchor.source.clone(),
                    entity: anchor.entity.clone(),
                    project: anchor.project.clone(),
                    language: anchor.language.clone(),
                    category: anchor.category.clone(),
                })
            }),
    );
    // An interval sorts before an anchor at the same instant so a measured interval, not
    // a bare instant, owns the run they share.
    events.sort_by(|left, right| {
        let key = |event: &Event| match event {
            Event::Interval(interval) => (interval.start, 0u8),
            Event::Anchor(anchor) => (anchor.start, 1u8),
        };
        let (left_start, left_kind) = key(left);
        let (right_start, right_kind) = key(right);
        left_start
            .partial_cmp(&right_start)
            .unwrap_or(Ordering::Equal)
            .then_with(|| left_kind.cmp(&right_kind))
    });

    let mut result: Vec<CanonicalInterval> = Vec::new();
    for event in events {
        let (at, candidate, is_anchor) = match event {
            Event::Interval(interval) => (interval.start, interval, false),
            Event::Anchor(anchor) => (anchor.start, anchor, true),
        };
        if let Some(previous) = result.last_mut() {
            let gap = at - previous.end;
            if gap > 0.0 && gap <= idle_timeout_seconds {
                previous.end = at;
            }
            // Keep the output shape identical to `canonicalize`'s: one row per contiguous
            // run of the same segment, not one row per bridge.
            if previous.heartbeat_id == candidate.heartbeat_id
                && previous.segment_id == candidate.segment_id
                && previous.end >= candidate.start
            {
                previous.end = previous.end.max(candidate.end);
                continue;
            }
            if previous.end > candidate.start {
                // `canonicalize` already resolved ownership; never double-count.
                previous.end = candidate.start;
            }
            if is_anchor {
                // The anchor has done its job by extending the run above. It only opens
                // a run of its own when there is nothing to extend.
                continue;
            }
        }
        result.push(candidate);
    }
    // A run that never grew — a lone heartbeat with nothing near it — proves an instant,
    // not a duration.
    result.retain(|interval| interval.end > interval.start);
    result
}

/// `canonicalize` plus idle bridging. Every duration surface should call this rather
/// than `canonicalize` directly, otherwise two endpoints report different totals for the
/// same day.
pub fn canonicalize_bridged(
    intervals: &[ActivityInterval],
    idle_timeout_seconds: f64,
) -> Vec<CanonicalInterval> {
    let anchors: Vec<ActivityInterval> = intervals
        .iter()
        .filter(|interval| interval.end <= interval.start)
        .cloned()
        .collect();
    bridge_idle_gaps_with_anchors(canonicalize(intervals), &anchors, idle_timeout_seconds)
}

pub fn total_seconds(intervals: &[CanonicalInterval]) -> f64 {
    intervals
        .iter()
        .map(|interval| interval.end - interval.start)
        .sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A heartbeat that proves an instant and no duration.
    fn anchor(id: &str, at: f64) -> ActivityInterval {
        interval(id, "editor", at, at)
    }

    fn interval(id: &str, source: &str, start: f64, end: f64) -> ActivityInterval {
        ActivityInterval {
            segment_id: id.to_string(),
            heartbeat_id: id.to_string(),
            start,
            end,
            source: source.to_string(),
            entity: "file".to_string(),
            project: None,
            language: None,
            category: "coding".to_string(),
        }
    }

    #[test]
    fn idle_bridge_credits_the_pause_to_the_earlier_activity() {
        // Two proven bursts 5 minutes apart: 60s + 60s of evidence, 300s of pause.
        let canonical = canonicalize(&[
            interval("a", "editor", 0.0, 60.0),
            interval("b", "editor", 360.0, 420.0),
        ]);
        assert_eq!(total_seconds(&canonical), 120.0);

        let bridged = bridge_idle_gaps(canonical.clone(), 900.0);
        assert_eq!(total_seconds(&bridged), 420.0);
        // The pause belongs to the earlier interval, not the later one.
        assert_eq!(bridged[0].segment_id, "a");
        assert_eq!(bridged[0].end, 360.0);

        // Beyond the timeout the pause is idle time and stays uncounted.
        assert_eq!(total_seconds(&bridge_idle_gaps(canonical, 120.0)), 120.0);
    }

    #[test]
    fn idle_bridge_never_runs_past_the_last_observed_activity() {
        let canonical = canonicalize(&[interval("only", "editor", 0.0, 60.0)]);
        let bridged = bridge_idle_gaps(canonical, 900.0);
        assert_eq!(total_seconds(&bridged), 60.0);
        assert_eq!(bridged.last().unwrap().end, 60.0);
    }

    #[test]
    fn an_anchor_chain_connects_two_bursts_a_timeout_apart() {
        // Two bursts 20 minutes apart — further than the 15-minute timeout — but a
        // heartbeat in the middle proves the developer never left. WakaTime counts the
        // whole span; without anchors the middle heartbeat was worth nothing and the
        // pause was written off as idle.
        let canonical = canonicalize(&[
            interval("a", "editor", 0.0, 60.0),
            interval("b", "editor", 1_260.0, 1_320.0),
        ]);
        assert_eq!(total_seconds(&bridge_idle_gaps(canonical.clone(), 900.0)), 120.0);

        let bridged = bridge_idle_gaps_with_anchors(canonical, &[anchor("mid", 660.0)], 900.0);
        assert_eq!(total_seconds(&bridged), 1_320.0);
    }

    #[test]
    fn an_isolated_anchor_is_still_worth_nothing() {
        // A single agent edit with nothing near it proves an instant, not a duration.
        let bridged = bridge_idle_gaps_with_anchors(Vec::new(), &[anchor("lone", 500.0)], 900.0);
        assert_eq!(total_seconds(&bridged), 0.0);
        assert!(bridged.is_empty());
    }

    #[test]
    fn a_leading_anchor_starts_the_clock() {
        // WakaTime's first heartbeat opens the session; the pause up to the next proven
        // activity is working time, and it belongs to the file the anchor named.
        let canonical = canonicalize(&[interval("later", "editor", 600.0, 660.0)]);
        let bridged =
            bridge_idle_gaps_with_anchors(canonical, &[anchor("first", 0.0)], 900.0);
        assert_eq!(total_seconds(&bridged), 660.0);
        assert_eq!(bridged[0].segment_id, "first");
        assert_eq!(bridged[0].end, 600.0);
    }

    #[test]
    fn a_trailing_anchor_extends_the_last_run_but_no_further() {
        let canonical = canonicalize(&[interval("a", "ai", 0.0, 60.0)]);
        let bridged = bridge_idle_gaps_with_anchors(canonical, &[anchor("tail", 300.0)], 900.0);
        assert_eq!(total_seconds(&bridged), 300.0);
        assert_eq!(bridged.last().unwrap().end, 300.0);
    }

    #[test]
    fn idle_bridge_is_disabled_by_a_zero_timeout() {
        let canonical = canonicalize(&[
            interval("a", "editor", 0.0, 60.0),
            interval("b", "editor", 360.0, 420.0),
        ]);
        assert_eq!(total_seconds(&bridge_idle_gaps(canonical, 0.0)), 120.0);
    }

    #[test]
    fn union_deduplicates_overlap_and_prefers_editor() {
        let result = canonicalize(&[
            interval("ai", "ai", 0.0, 300.0),
            interval("human", "editor", 120.0, 180.0),
        ]);
        assert_eq!(total_seconds(&result), 300.0);
        assert_eq!(
            result
                .iter()
                .find(|item| item.start == 120.0)
                .unwrap()
                .source,
            "editor"
        );
    }
}
