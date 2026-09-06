use anyhow::Result;
use clickhouse::Row;
use serde::Deserialize;
use std::{
    cmp::Ordering,
    collections::{BTreeMap, HashSet},
    sync::Arc,
};
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use wakaclock_core::heartbeat::{
    normalize_activity_source, ActivitySegment, ActorType, MAX_ACTIVITY_GAP_SECONDS,
};

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
    /// Canonical actor identity carried through canonicalization. `source` is retained
    /// as the coarse legacy duration bucket, while this field keeps verified and inferred
    /// AI distinct for attribution-aware surfaces.
    pub actor_type: ActorType,
    pub actor_confidence: f32,
    pub entity: String,
    pub project: Option<String>,
    /// Stable project identity, so a project breakdown groups the way the project
    /// pages key rather than by a display name that can be renamed.
    pub project_id: Option<Uuid>,
    /// VCS branch, so a branch-filtered view can be built from this timeline.
    pub branch: Option<String>,
    pub language: Option<String>,
    pub category: String,
    /// Carried on the interval, not looked up per surface, so the editor and OS
    /// breakdowns can be built from this timeline instead of from `editor_daily` /
    /// `os_daily`. Those aggregate a different algorithm and cannot agree with it.
    pub editor: String,
    pub operating_system: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CanonicalInterval {
    pub segment_id: String,
    pub heartbeat_id: String,
    pub start: f64,
    pub end: f64,
    pub source: String,
    pub actor_type: ActorType,
    pub actor_confidence: f32,
    pub entity: String,
    pub project: Option<String>,
    /// Stable project identity, so a project breakdown groups the way the project
    /// pages key rather than by a display name that can be renamed.
    pub project_id: Option<Uuid>,
    /// VCS branch, so a branch-filtered view can be built from this timeline.
    pub branch: Option<String>,
    pub language: Option<String>,
    pub category: String,
    pub editor: String,
    pub operating_system: String,
}

#[derive(Debug, Row, Deserialize)]
struct RawActivityRow {
    entity: String,
    time: f64,
    project: Option<String>,
    #[serde(with = "clickhouse::serde::uuid::option")]
    project_id: Option<Uuid>,
    branch: Option<String>,
    language: Option<String>,
    category: String,
    heartbeat_id: Option<String>,
    active_seconds: Option<f64>,
    activity_segments: String,
    editor: String,
    operating_system: String,
    actor_type: String,
    actor_confidence: f32,
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
    #[serde(with = "clickhouse::serde::uuid::option")]
    project_id: Option<Uuid>,
    branch: Option<String>,
    language: Option<String>,
    category: String,
    editor: String,
    operating_system: String,
    actor_type: String,
    actor_confidence: f32,
}

/// How long a pause may be and still count as working time — one timeout per stream.
///
/// WakaTime has a single knob because a WakaTime plugin only emits a heartbeat when a
/// human does something. wakaclock also ingests agent hooks, which fire on a cadence no
/// human controls: `extensions/ai-agents/.../hooks.json` sends a heartbeat on every
/// `PostToolUse`, so one 15-minute timeout turned an unattended Claude Code run into
/// continuous billed work. See docs/duration-accuracy-audit.md, Finding 2.
#[derive(Debug, Clone, Copy)]
pub struct BridgeConfig {
    /// WakaTime's timeout, applied to human editor activity. See `Config::idle_timeout_seconds`.
    pub idle_timeout_seconds: f64,
    /// The same knob for agent-emitted activity. `None` puts every source on one
    /// timeline at `idle_timeout_seconds` — the single-stream behaviour that shipped
    /// before the split, kept so a deployment can roll back without a revert.
    pub agent_idle_timeout_seconds: Option<f64>,
}

impl BridgeConfig {
    /// One timeline for every source. WakaTime's own model, and what the parity tests
    /// in this module measure against.
    pub fn single(idle_timeout_seconds: f64) -> Self {
        Self {
            idle_timeout_seconds,
            agent_idle_timeout_seconds: None,
        }
    }

    /// Human and agent activity bridged independently. An agent timeout of zero lets
    /// agent heartbeats contribute their measured evidence and nothing more.
    pub fn split(idle_timeout_seconds: f64, agent_idle_timeout_seconds: f64) -> Self {
        Self {
            idle_timeout_seconds,
            agent_idle_timeout_seconds: Some(agent_idle_timeout_seconds),
        }
    }
}

impl From<f64> for BridgeConfig {
    fn from(idle_timeout_seconds: f64) -> Self {
        Self::single(idle_timeout_seconds)
    }
}

pub struct ActivityTimelineService {
    clickhouse: Arc<ClickHouseClient>,
    /// Passed in rather than read from a global so a test can pin it and two
    /// deployments can disagree without a rebuild.
    bridge: BridgeConfig,
}

impl ActivityTimelineService {
    pub fn new(clickhouse: Arc<ClickHouseClient>, bridge: impl Into<BridgeConfig>) -> Self {
        Self {
            clickhouse,
            bridge: bridge.into(),
        }
    }

    pub fn bridge_config(&self) -> BridgeConfig {
        self.bridge
    }

    /// Returns bounded AI-session intervals for a user and range. Closed sessions use
    /// their explicit end; open sessions stop at their last observed event. The latter
    /// is deliberately not `now` or `updated_at`, so a stale projection cannot turn an
    /// old agent session into unbounded working time.
    pub async fn ai_session_intervals(
        &self,
        user_id: Uuid,
        start: f64,
        end: f64,
    ) -> Result<Vec<(f64, f64)>> {
        #[derive(Debug, clickhouse::Row, Deserialize)]
        struct AiSessionIntervalRow {
            started_at: u32,
            ended_at: Option<u32>,
            last_event_at: u32,
        }

        let rows = self
            .clickhouse
            .get_client()
            .query(
                "SELECT started_at, ended_at, last_event_at
                 FROM wakaclock.ai_sessions FINAL
                 WHERE user_id = ?
                   AND started_at < toUInt32(?)
                   AND coalesce(ended_at, last_event_at) > toUInt32(?)",
            )
            .bind(user_id)
            .bind(end.max(0.0) as u32)
            .bind(start.max(0.0) as u32)
            .fetch_all::<AiSessionIntervalRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse AI session query error: {error}"))?;

        Ok(rows
            .into_iter()
            .filter_map(|row| {
                clipped_session_interval(
                    row.started_at,
                    row.ended_at,
                    row.last_event_at,
                    start,
                    end,
                )
            })
            .collect())
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
        let projected = match self
            .clickhouse
            .get_client()
            .query(
                "SELECT segment_id, heartbeat_id, `start`, `end`, source, entity, project, project_id, branch, language,
                        category, editor, operating_system, actor_type, actor_confidence
                 FROM wakaclock.activity_intervals FINAL
                 WHERE user_id = ? AND `end` > ? AND `start` < ?
                 ORDER BY `start` ASC, heartbeat_id ASC",
            )
            .bind(user_id)
            .bind(start)
            .bind(end)
            .fetch_all::<ProjectedActivityRow>()
            .await
        {
            Ok(rows) => rows,
            Err(error) => {
                tracing::warn!(
                    %error,
                    %user_id,
                    start,
                    end,
                    "activity_intervals query failed; falling back to raw heartbeats"
                );
                Vec::new()
            }
        };
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
                source: normalize_activity_source(Some(&row.source), &row.actor_type).to_string(),
                actor_type: row.actor_type.parse().unwrap_or_default(),
                actor_confidence: row.actor_confidence,
                entity: row.entity,
                project: row.project,
                project_id: row.project_id,
                branch: row.branch.clone(),
                language: row.language,
                category: row.category,
                editor: row.editor,
                operating_system: row.operating_system,
            });
        }
        let rows = self
            .clickhouse
            .get_client()
            .query(
                "SELECT entity, time, project, project_id, branch, language, category,
                        heartbeat_id, active_seconds, activity_segments, editor, operating_system,
                        actor_type, actor_confidence
                 FROM wakaclock.heartbeats_canonical
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

        for (row_index, row) in rows.into_iter().enumerate() {
            let has_stable_heartbeat_id = row.heartbeat_id.is_some();
            let heartbeat_id = row
                .heartbeat_id
                .clone()
                .unwrap_or_else(|| format!("legacy-row:{row_index}"));
            // Stable heartbeat IDs make retries idempotent. An old row without one has
            // no safe identity, so keep it as its own row rather than merging it with a
            // different observation that happens to share entity/time metadata.
            let already_projected =
                has_stable_heartbeat_id && !seen_heartbeats.insert(heartbeat_id.clone());

            // A heartbeat proves the developer was present at *its own* timestamp, and
            // that is true whatever its segments happen to cover.
            //
            // The editor buffers activity and flushes it later, so a segment routinely
            // describes a window that closed minutes before the heartbeat carrying it was
            // sent — one real stream had a heartbeat at 06:03:21 whose segment ended at
            // 06:01:12. Reading duration only off the segments threw the later instant
            // away, and with it the evidence that the developer was still there. The
            // following gap was then measured from 06:01:12 instead of 06:03:21, which
            // pushed it past the idle timeout and ended the session early: 8m reported
            // where WakaTime, which reads heartbeat timestamps, said 24m.
            //
            // The anchor is zero-length, so it adds no duration by itself — it only lets
            // `bridge_idle_gaps` reach, exactly as a WakaTime heartbeat does.
            if row.time >= start && row.time < end {
                let anchor_id = format!("{heartbeat_id}:anchor");
                if seen_segments.insert(anchor_id.clone()) {
                    intervals.push(ActivityInterval {
                        segment_id: anchor_id,
                        heartbeat_id: heartbeat_id.clone(),
                        start: row.time,
                        end: row.time,
                        source: normalize_activity_source(None, &row.actor_type).to_string(),
                        actor_type: row.actor_type.parse().unwrap_or_default(),
                        actor_confidence: row.actor_confidence,
                        entity: row.entity.clone(),
                        project: row.project.clone(),
                        project_id: row.project_id,
                        branch: row.branch.clone(),
                        language: row.language.clone(),
                        category: row.category.clone(),
                        editor: row.editor.clone(),
                        operating_system: row.operating_system.clone(),
                    });
                }
            }

            if already_projected {
                // The measured intervals for this heartbeat came from
                // `activity_intervals`; only its timestamp was still missing.
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
                // No measurable duration — an editor switch, or an agent edit whose
                // previous event was more than the evidence window ago. The timestamp
                // anchor pushed above is the whole of this heartbeat's contribution.
                continue;
            }
            for segment in segments {
                // Ingest validation rejects oversized segments, so this only fires for
                // rows written before that rule existed. Clamp to the trailing window
                // rather than discarding the row's entire contribution.
                let clamped_start = segment.start.max(segment.end - MAX_ACTIVITY_GAP_SECONDS);
                let segment_start = clamped_start.max(start);
                let segment_end = segment.end.min(end);
                if !segment_start.is_finite()
                    || !segment_end.is_finite()
                    || segment_end <= segment_start
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
                    source: normalize_activity_source(segment.source.as_deref(), &row.actor_type)
                        .to_string(),
                    actor_type: row.actor_type.parse().unwrap_or_default(),
                    actor_confidence: row.actor_confidence,
                    entity: row.entity.clone(),
                    project: row.project.clone(),
                    project_id: row.project_id,
                    branch: row.branch.clone(),
                    language: row.language.clone(),
                    category: row.category.clone(),
                    editor: row.editor.clone(),
                    operating_system: row.operating_system.clone(),
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
            self.bridge,
        ))
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
///
/// The sweep is quadratic — every boundary window is matched against every interval —
/// so it runs per *overlap component* rather than over the whole range. A window can
/// only ever be owned by an interval that covers it, so intervals separated by a gap
/// no interval spans cannot affect each other's ownership and their results simply
/// concatenate. Over a year of heavy use (87,600 intervals) this is the difference
/// between ~9 seconds and a few milliseconds, which matters because `/stats/all_time`
/// sweeps a user's entire history on every request.
pub fn canonicalize(intervals: &[ActivityInterval]) -> Vec<CanonicalInterval> {
    let mut ordered: Vec<&ActivityInterval> = intervals.iter().collect();
    ordered.sort_by(|left, right| {
        left.start
            .partial_cmp(&right.start)
            .unwrap_or(Ordering::Equal)
    });

    let mut result: Vec<CanonicalInterval> = Vec::new();
    let mut component: Vec<ActivityInterval> = Vec::new();
    let mut component_end = f64::NEG_INFINITY;
    for interval in ordered {
        if !interval.start.is_finite() {
            continue;
        }
        // A new component starts where nothing already collected still covers this
        // point. Touching at a shared edge still counts as separate: a window needs an
        // interval on both sides of it to have an owner.
        if interval.start >= component_end && !component.is_empty() {
            result.extend(canonicalize_component(&component));
            component.clear();
            component_end = f64::NEG_INFINITY;
        }
        component_end = component_end.max(interval.end);
        component.push(interval.clone());
    }
    if !component.is_empty() {
        result.extend(canonicalize_component(&component));
    }
    result
}

fn canonicalize_component(intervals: &[ActivityInterval]) -> Vec<CanonicalInterval> {
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
            actor_type: owner.actor_type,
            actor_confidence: owner.actor_confidence,
            entity: owner.entity.clone(),
            project: owner.project.clone(),
            project_id: owner.project_id,
            branch: owner.branch.clone(),
            language: owner.language.clone(),
            category: owner.category.clone(),
            editor: owner.editor.clone(),
            operating_system: owner.operating_system.clone(),
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
#[cfg(test)]
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
                    actor_type: anchor.actor_type,
                    actor_confidence: anchor.actor_confidence,
                    entity: anchor.entity.clone(),
                    project: anchor.project.clone(),
                    project_id: anchor.project_id,
                    branch: anchor.branch.clone(),
                    language: anchor.language.clone(),
                    category: anchor.category.clone(),
                    editor: anchor.editor.clone(),
                    operating_system: anchor.operating_system.clone(),
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
            if is_anchor && gap <= idle_timeout_seconds {
                // The anchor has done its job by extending the run above.
                //
                // It only skips the push when it was actually *within reach* of that
                // run. Skipping unconditionally — which is what this used to do — meant
                // that once any run existed, no later anchor could ever open another
                // one, so every session that resumed after a break with a bare heartbeat
                // (an editor switch, an agent tool call) was discarded and the clock
                // never restarted. WakaTime starts a new block there; so does this now.
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
///
/// Prefer [`Timeline::build`] when the caller also needs the unbridged total: this
/// function sweeps the intervals itself, so asking for both separately sweeps twice.
pub fn canonicalize_bridged(
    intervals: &[ActivityInterval],
    bridge: impl Into<BridgeConfig>,
) -> Vec<CanonicalInterval> {
    Timeline::build(intervals, bridge).bridged
}

/// Bridge the human-attended stream and the agent stream on their own timelines.
///
/// A heartbeat only licenses the pause in front of it if it is evidence the *developer*
/// was there. An agent hook firing every few seconds is evidence the agent was there, so
/// putting both on one timeline let a chain of tool calls carry the clock across hours
/// nobody attended. Each stream is bridged against its own kind, then the two are swept
/// together again: bridging them apart lets an agent interval grow across a window the
/// human already owns, and every breakdown in this module has to keep summing to the
/// total. Human activity wins those windows, same as anywhere else in `canonicalize`.
fn bridge_by_attendance(
    canonical: Vec<CanonicalInterval>,
    anchors: &[ActivityInterval],
    idle_timeout_seconds: f64,
    agent_idle_timeout_seconds: f64,
) -> Vec<CanonicalInterval> {
    if !idle_timeout_seconds.is_finite() || idle_timeout_seconds <= 0.0 {
        return canonical;
    }

    enum Event {
        Interval(CanonicalInterval),
        Anchor(CanonicalInterval),
    }

    let mut events: Vec<Event> = Vec::with_capacity(canonical.len() + anchors.len());
    events.extend(canonical.into_iter().map(Event::Interval));
    events.extend(
        anchors
            .iter()
            .filter(|anchor| anchor.start.is_finite())
            .map(|anchor| Event::Anchor(anchor_interval(anchor))),
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
    // Who emitted the last *real* event, which is not always the source of `result.last()`.
    // An anchor absorbed into a bridge leaves the synthetic `other` row on the end of
    // `result`, and reading the source back off that row reported "other" for whatever
    // came next — so one handover degraded every later event into another handover, and a
    // chain of them walked the clock forward in `other` blocks. Tracking the real source
    // separately keeps each decision about the events that actually happened.
    let mut previous_source: Option<String> = None;
    for event in events {
        let (at, candidate, is_anchor) = match event {
            Event::Interval(interval) => (interval.start, interval, false),
            Event::Anchor(anchor) => (anchor.start, anchor, true),
        };
        let mut timeout = idle_timeout_seconds;
        let mut inserted_handover = false;
        if let Some(previous) = result.last() {
            let previous_source = previous_source.as_deref().unwrap_or(&previous.source);
            let gap = at - previous.end;
            // The agent allowance applies only where *both* sides of the pause are agent
            // activity — the unattended-run case it exists to catch. A pause with a human
            // on either side is a developer driving an agent, which is ordinary attended
            // work and gets the human timeout.
            timeout = if is_attended(previous_source) || is_attended(&candidate.source) {
                idle_timeout_seconds
            } else {
                agent_idle_timeout_seconds
            };
            if gap > 0.0 && gap <= timeout {
                if previous_source == candidate.source {
                    result.last_mut().expect("previous was just observed").end = at;
                } else {
                    // A pause spanning a human/agent handover is real work that neither
                    // side can claim. Extending the preceding interval — what a single
                    // timeline does — silently labels it with whichever source happened to
                    // come first, and on this repository's own stream that reported 9h38m
                    // of human time against an editor stream that can only support 7h21m.
                    // Giving the pause its own `other` row keeps the total identical while
                    // leaving `attended` honest. It inherits the preceding interval's
                    // dimensions so every breakdown still sums to the total.
                    let bridged = CanonicalInterval {
                        source: "other".to_string(),
                        actor_type: ActorType::Unknown,
                        actor_confidence: 0.0,
                        start: previous.end,
                        end: at,
                        ..previous.clone()
                    };
                    result.push(bridged);
                    inserted_handover = true;
                }
            }
        }

        if let Some(previous) = result.last_mut() {
            // Keep the output shape identical to `canonicalize`'s: one row per contiguous
            // run of the same segment, not one row per bridge.
            if previous.heartbeat_id == candidate.heartbeat_id
                && previous.segment_id == candidate.segment_id
                && previous.source == candidate.source
                && previous.end >= candidate.start
            {
                previous.end = previous.end.max(candidate.end);
                previous_source = Some(candidate.source);
                continue;
            }
            if previous.end > candidate.start {
                // `canonicalize` already resolved ownership; never double-count.
                previous.end = candidate.start;
            }
            if is_anchor && !inserted_handover && at - previous.end <= timeout {
                // The anchor has done its job by extending the run above. It still opens a
                // run of its own when it was out of bridging reach, which is what lets a
                // session resume after a break.
                previous_source = Some(candidate.source);
                continue;
            }
        }
        previous_source = Some(candidate.source.clone());
        result.push(candidate);
    }
    // A run that never grew — a lone heartbeat with nothing near it — proves an instant,
    // not a duration.
    result.retain(|interval| interval.end > interval.start);
    result
}

/// A zero-length stand-in for an anchor, carrying its dimensions so a bridged row built
/// from it groups the same way a measured one would.
fn anchor_interval(anchor: &ActivityInterval) -> CanonicalInterval {
    CanonicalInterval {
        segment_id: anchor.segment_id.clone(),
        heartbeat_id: anchor.heartbeat_id.clone(),
        start: anchor.start,
        end: anchor.start,
        source: anchor.source.clone(),
        actor_type: anchor.actor_type,
        actor_confidence: anchor.actor_confidence,
        entity: anchor.entity.clone(),
        project: anchor.project.clone(),
        project_id: anchor.project_id,
        branch: anchor.branch.clone(),
        language: anchor.language.clone(),
        category: anchor.category.clone(),
        editor: anchor.editor.clone(),
        operating_system: anchor.operating_system.clone(),
    }
}

/// Only human editor activity proves the developer was at the keyboard. The canonical
/// source normalization in `wakaclock_core::heartbeat::normalize_activity_source` has
/// already folded every emitter into `editor` / `ai` / `other`.
fn is_attended(source: &str) -> bool {
    source == "editor"
}

/// The two views of one range that every duration surface reports together: the time a
/// client proved, and the WakaTime-compatible total after idle bridging.
///
/// `canonicalize` is an O(n²) boundary sweep, and computing the two separately ran it
/// twice per request — three times in `StatsService`, which also rebuilt the timeline
/// for its totals and its best day. Building both from one sweep keeps the cost of the
/// evidence split at zero.
pub struct Timeline {
    /// Seconds a client actually measured: the overlap-free union, no bridging.
    pub proven_seconds: f64,
    /// Measured canonical intervals retained so attribution-specific metrics can be
    /// derived without treating idle bridge time as AI coding.
    pub measured: Vec<CanonicalInterval>,
    pub bridged: Vec<CanonicalInterval>,
}

impl Timeline {
    pub fn build(intervals: &[ActivityInterval], bridge: impl Into<BridgeConfig>) -> Self {
        let bridge = bridge.into();
        let anchors: Vec<ActivityInterval> = intervals
            .iter()
            .filter(|interval| interval.end <= interval.start)
            .cloned()
            .collect();
        let canonical = canonicalize(intervals);
        let proven_seconds = total_seconds(&canonical);
        let measured = canonical.clone();
        let bridged = match bridge.agent_idle_timeout_seconds {
            Some(agent_idle_timeout_seconds) => bridge_by_attendance(
                canonical,
                &anchors,
                bridge.idle_timeout_seconds,
                agent_idle_timeout_seconds,
            ),
            None => bridge_idle_gaps_with_anchors(canonical, &anchors, bridge.idle_timeout_seconds),
        };
        Self {
            proven_seconds,
            measured,
            bridged,
        }
    }

    pub fn evidence(&self) -> EvidenceSplit {
        EvidenceSplit::new(self.proven_seconds, &self.bridged)
            .with_ai_coding_seconds(measured_ai_seconds(&self.measured))
    }
}

pub fn total_seconds(intervals: &[CanonicalInterval]) -> f64 {
    intervals
        .iter()
        .map(|interval| interval.end - interval.start)
        .sum()
}

/// The dimensions the duration surfaces break a total down by.
///
/// Grouping lives here, next to the timeline that produces the seconds, so a new
/// surface cannot quietly invent its own. Before this existed the grand total came
/// from `canonicalize_bridged` while the per-language/project/editor/OS rows came
/// from `sum(active_seconds)` in the `*_daily` aggregate tables — a different
/// algorithm over different evidence, so the parts of a day never added up to the
/// day. See docs/duration-accuracy-audit.md, finding 4.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Dimension {
    Language,
    Project,
    Branch,
    Editor,
    OperatingSystem,
    Category,
}

impl Dimension {
    /// `Unknown` rather than dropping the interval: the seconds are real even when the
    /// client did not say which language or editor produced them, and dropping them
    /// would make the breakdown disagree with the total again.
    pub fn value_of(self, interval: &CanonicalInterval) -> String {
        let value = match self {
            Self::Language => interval.language.as_deref().unwrap_or_default(),
            Self::Project => interval.project.as_deref().unwrap_or_default(),
            Self::Branch => interval.branch.as_deref().unwrap_or_default(),
            Self::Editor => interval.editor.as_str(),
            Self::OperatingSystem => interval.operating_system.as_str(),
            Self::Category => interval.category.as_str(),
        };
        if value.trim().is_empty() {
            "Unknown".to_string()
        } else {
            value.to_string()
        }
    }
}

/// Seconds and distinct heartbeat count per value of one dimension, ordered longest
/// first with ties broken by name so a response is stable between identical requests.
///
/// The count is deduplicated for the same reason `heartbeat_count` is: `canonicalize`
/// emits one row per boundary window, so one heartbeat can appear many times in a
/// bucket. Counting rows here would leave a day's `grand_total.heartbeats` disagreeing
/// with the sum of its `languages[].heartbeats` — the Finding 4 contradiction again, one
/// field over.
pub fn totals_by(intervals: &[CanonicalInterval], dimension: Dimension) -> Vec<(String, f64, u64)> {
    let mut grouped: BTreeMap<String, (f64, HashSet<&str>)> = BTreeMap::new();
    for interval in intervals {
        let entry = grouped.entry(dimension.value_of(interval)).or_default();
        entry.0 += interval.end - interval.start;
        entry.1.insert(interval.heartbeat_id.as_str());
    }
    let mut rows: Vec<(String, f64, u64)> = grouped
        .into_iter()
        .map(|(name, (seconds, heartbeats))| (name, seconds, heartbeats.len() as u64))
        .collect();
    rows.sort_by(|left, right| {
        right
            .1
            .partial_cmp(&left.1)
            .unwrap_or(Ordering::Equal)
            .then_with(|| left.0.cmp(&right.0))
    });
    rows
}

/// How much of a reported total the user can be shown a reason for.
///
/// `proven` is time a client actually measured; `inferred` is the pause-filling the
/// idle bridge added on top to stay WakaTime-compatible. On real data the second is
/// the larger of the two, and nothing used to say so.
#[derive(Debug, Clone, Copy, Default, serde::Serialize)]
pub struct EvidenceSplit {
    pub proven_seconds: f64,
    pub inferred_seconds: f64,
    /// Human editor activity. `attended + agent + other == total`.
    pub attended_seconds: f64,
    /// Time whose owning interval came from an AI agent hook or transcript sync.
    pub agent_seconds: f64,
    pub other_seconds: f64,
    /// Measured (non-bridged) time owned by an AI actor.
    pub ai_coding_seconds: f64,
    /// Union of AI session intervals, independent from the WakaTime-compatible total.
    pub ai_session_seconds: f64,
}

impl EvidenceSplit {
    /// `proven` is `total_seconds(&canonicalize(raw))` for the same slice of time the
    /// `bridged` intervals cover. Taking it as an argument rather than recomputing it
    /// lets a per-day breakdown and a whole-range total share one timeline build.
    pub fn new(proven_seconds: f64, bridged: &[CanonicalInterval]) -> Self {
        let mut split = Self {
            proven_seconds,
            inferred_seconds: (total_seconds(bridged) - proven_seconds).max(0.0),
            ..Self::default()
        };
        for interval in bridged {
            let seconds = interval.end - interval.start;
            match interval.source.as_str() {
                "editor" => split.attended_seconds += seconds,
                "ai" => split.agent_seconds += seconds,
                _ => split.other_seconds += seconds,
            }
        }
        split
    }

    pub fn with_ai_coding_seconds(mut self, seconds: f64) -> Self {
        self.ai_coding_seconds = seconds.max(0.0);
        self
    }

    pub fn with_ai_session_seconds(mut self, seconds: f64) -> Self {
        self.ai_session_seconds = seconds.max(0.0);
        self
    }
}

/// Union measured canonical intervals whose actor is explicitly AI. Bridged intervals
/// are intentionally excluded: their inferred gaps belong to `total_seconds`, not to
/// the measured AI coding metric.
pub fn measured_ai_seconds(intervals: &[CanonicalInterval]) -> f64 {
    let mut ai = intervals
        .iter()
        .filter(|interval| interval.actor_type.is_ai() && interval.end > interval.start)
        .map(|interval| (interval.start, interval.end))
        .collect::<Vec<_>>();
    ai.sort_by(|left, right| {
        left.0
            .total_cmp(&right.0)
            .then_with(|| left.1.total_cmp(&right.1))
    });
    union_ranges(&ai)
}

/// Union and clip arbitrary ranges. Session intervals may overlap when an agent uses
/// more than one logical session, and summing rows would double-count their overlap.
pub fn union_ranges(ranges: &[(f64, f64)]) -> f64 {
    let mut ranges = ranges.to_vec();
    ranges.sort_by(|left, right| {
        left.0
            .total_cmp(&right.0)
            .then_with(|| left.1.total_cmp(&right.1))
    });
    let mut total = 0.0;
    let mut current: Option<(f64, f64)> = None;
    for (start, end) in ranges {
        if !start.is_finite() || !end.is_finite() || end <= start {
            continue;
        }
        match current.as_mut() {
            Some((current_start, current_end)) if start <= *current_end => {
                *current_end = (*current_end).max(end);
            }
            Some((current_start, current_end)) => {
                total += *current_end - *current_start;
                *current_start = start;
                *current_end = end;
            }
            None => current = Some((start, end)),
        }
    }
    if let Some((start, end)) = current {
        total += end - start;
    }
    total
}

/// Select the safe end of one AI session and clip it to a requested range. A closed
/// session owns its explicit `ended_at`; an open session is bounded by its last event,
/// never by `now` or the projection's `updated_at`. A single-event session therefore
/// has no measurable duration and is omitted.
pub fn clipped_session_interval(
    started_at: u32,
    ended_at: Option<u32>,
    last_event_at: u32,
    range_start: f64,
    range_end: f64,
) -> Option<(f64, f64)> {
    let session_start = f64::from(started_at).max(range_start);
    let session_end = f64::from(ended_at.unwrap_or(last_event_at)).min(range_end);
    (session_end > session_start).then_some((session_start, session_end))
}

/// Distinct heartbeats behind a set of intervals. `canonicalize` splits one heartbeat
/// into as many rows as it has boundaries, so counting rows overstates the count.
pub fn heartbeat_count(intervals: &[CanonicalInterval]) -> u64 {
    intervals
        .iter()
        .map(|interval| interval.heartbeat_id.as_str())
        .collect::<HashSet<_>>()
        .len() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A heartbeat that proves an instant and no duration.
    fn anchor(id: &str, at: f64) -> ActivityInterval {
        interval(id, "editor", at, at)
    }

    fn anchor_at(id: &str, source: &str, at: f64) -> ActivityInterval {
        interval(id, source, at, at)
    }

    fn interval(id: &str, source: &str, start: f64, end: f64) -> ActivityInterval {
        let actor_type = match source {
            "editor" => ActorType::Human,
            "ai" => ActorType::AiVerified,
            _ => ActorType::Unknown,
        };
        ActivityInterval {
            segment_id: id.to_string(),
            heartbeat_id: id.to_string(),
            start,
            end,
            source: source.to_string(),
            actor_type,
            actor_confidence: actor_type.default_confidence(None, None),
            entity: "file".to_string(),
            project: None,
            project_id: None,
            branch: None,
            language: None,
            category: "coding".to_string(),
            editor: "vscode".to_string(),
            operating_system: "macos".to_string(),
        }
    }

    fn seconds_by_source(intervals: &[CanonicalInterval], source: &str) -> f64 {
        intervals
            .iter()
            .filter(|interval| interval.source == source)
            .map(|interval| interval.end - interval.start)
            .sum()
    }

    /// The defect this replaced: bridging the human and agent streams as two independent
    /// timelines meant neither could see the other, so a developer prompting an agent —
    /// type, agent edits, type again — had the session chopped into disconnected pieces
    /// and the handovers dropped. On this repository's own stream that read 20% below
    /// WakaTime on the days an agent was active.
    #[test]
    fn a_pause_across_a_human_agent_handover_is_credited() {
        let intervals = vec![
            interval("human", "editor", 0.0, 60.0),
            interval("agent", "ai", 300.0, 360.0),
        ];

        let bridged = canonicalize_bridged(&intervals, BridgeConfig::split(900.0, 120.0));

        // 0..360 continuous: the 240s handover is real work, not idle time.
        assert_eq!(total_seconds(&bridged), 360.0);
    }

    /// ...but it belongs to neither side. Extending the preceding interval — what a single
    /// timeline does — labels the pause with whichever source happened to come first, and
    /// that is what inflated `attended` past what the editor stream could support.
    #[test]
    fn a_handover_pause_is_attributed_to_neither_side() {
        let intervals = vec![
            interval("human", "editor", 0.0, 60.0),
            interval("agent", "ai", 300.0, 360.0),
        ];

        let bridged = canonicalize_bridged(&intervals, BridgeConfig::split(900.0, 120.0));

        assert_eq!(seconds_by_source(&bridged, "editor"), 60.0);
        assert_eq!(seconds_by_source(&bridged, "ai"), 60.0);
        assert_eq!(seconds_by_source(&bridged, "other"), 240.0);
    }

    /// The agent allowance still does its job: a chain of agent tool calls with no human
    /// anywhere near it is the unattended run, and it is capped at the agent timeout.
    #[test]
    fn an_unattended_agent_chain_is_capped_at_the_agent_timeout() {
        let intervals = vec![
            interval("a1", "ai", 0.0, 60.0),
            // 600s apart — well inside the human timeout, well outside the agent one.
            interval("a2", "ai", 660.0, 720.0),
        ];

        let bridged = canonicalize_bridged(&intervals, BridgeConfig::split(900.0, 120.0));

        // Two separate blocks of 60s, not one continuous 720s run.
        assert_eq!(total_seconds(&bridged), 120.0);
    }

    /// A human on *either* side is enough to make the pause attended work — the developer
    /// reading agent output, or prompting after it finishes. Only agent-to-agent uses the
    /// short allowance.
    #[test]
    fn a_human_on_either_side_of_a_pause_earns_the_human_timeout() {
        for (first, second) in [("editor", "ai"), ("ai", "editor")] {
            let intervals = vec![
                interval("first", first, 0.0, 60.0),
                interval("second", second, 660.0, 720.0),
            ];

            let bridged = canonicalize_bridged(&intervals, BridgeConfig::split(900.0, 120.0));

            assert_eq!(
                total_seconds(&bridged),
                720.0,
                "{first} -> {second} should bridge at the human timeout"
            );
        }
    }

    /// Both evidence partitions must keep describing the same total, `other` included.
    #[test]
    fn the_handover_bucket_keeps_the_attribution_partition_whole() {
        let intervals = vec![
            interval("human", "editor", 0.0, 60.0),
            interval("agent", "ai", 300.0, 360.0),
            interval("human2", "editor", 500.0, 560.0),
        ];

        let timeline = Timeline::build(&intervals, BridgeConfig::split(900.0, 120.0));
        let total = total_seconds(&timeline.bridged);
        let split = timeline.evidence();

        assert!(
            (split.attended_seconds + split.agent_seconds + split.other_seconds - total).abs()
                < 1e-6
        );
        assert!((split.proven_seconds + split.inferred_seconds - total).abs() < 1e-6);
        assert!(split.other_seconds > 0.0, "handovers must land in `other`");
    }

    /// A chain of bare heartbeats after a handover used to walk the clock forward in
    /// `other` blocks forever.
    ///
    /// An anchor absorbed into a bridge leaves the synthetic `other` row at the end of
    /// `result`, and the next iteration read the "previous source" back off that row. So
    /// once one handover happened, every later event compared against `"other"`, never
    /// matched, and minted another handover block — and because `is_attended("other")` is
    /// false, an agent chain could never be recognised as one again either.
    ///
    /// Observed live: three `other` blocks totalling 15 minutes built out of a handful of
    /// isolated heartbeats while nobody was at the keyboard.
    #[test]
    fn a_handover_does_not_turn_every_later_event_into_another_handover() {
        let mut intervals = vec![
            interval("human", "editor", 0.0, 60.0),
            // One genuine handover: editor -> ai.
            interval("agent", "ai", 300.0, 360.0),
        ];
        // Then a chain of bare agent heartbeats, each within the *human* timeout of the
        // last but far outside the agent one. With the source tracked correctly these are
        // agent-to-agent gaps and the agent allowance applies.
        for (index, at) in [660.0, 960.0, 1260.0].iter().enumerate() {
            intervals.push(anchor_at(&format!("a{index}"), "ai", *at));
        }

        let bridged = canonicalize_bridged(&intervals, BridgeConfig::split(900.0, 120.0));

        // 60s human + 240s handover + 60s agent. The bare agent chain adds nothing: each
        // gap is 300s, well past the 120s agent allowance.
        assert_eq!(total_seconds(&bridged), 360.0);
        assert_eq!(seconds_by_source(&bridged, "other"), 240.0);
    }

    /// The same guarantee stated as the user sees it: come back after a long absence and
    /// the clock must not have advanced while you were gone.
    #[test]
    fn returning_after_a_long_absence_adds_nothing_for_the_absence() {
        let intervals = vec![
            interval("before", "editor", 0.0, 1_560.0),
            // Away for an hour, then a single agent edit, then back at the keyboard.
            anchor_at("away", "ai", 5_160.0),
            interval("after", "editor", 5_220.0, 5_280.0),
        ];

        let bridged = canonicalize_bridged(&intervals, BridgeConfig::split(900.0, 120.0));

        // 26 minutes before + 60s after + the 60s handover the returning anchor licenses.
        // The hour away contributes nothing.
        assert_eq!(total_seconds(&bridged), 1_560.0 + 60.0 + 60.0);
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
        assert_eq!(
            total_seconds(&bridge_idle_gaps(canonical.clone(), 900.0)),
            120.0
        );

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
        let bridged = bridge_idle_gaps_with_anchors(canonical, &[anchor("first", 0.0)], 900.0);
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

    /// `canonicalize` is an O(n^2) boundary sweep, and `/stats/all_time` now runs it
    /// over a user's entire history rather than reading pre-aggregated daily rows. This
    /// is a guard rail, not a benchmark: it fails if a year of heavy use stops being
    /// tractable in a request. Run with `--nocapture` to see the timing.
    #[test]
    fn a_year_of_heavy_use_stays_tractable() {
        // A heavy user at the 120-second heartbeat cadence, 8 hours a day, 365 days:
        // 240 intervals a day. Deliberately larger than any real single-user range.
        let mut intervals = Vec::new();
        let mut at = 0.0_f64;
        for day in 0..365 {
            for _ in 0..240 {
                let id = format!("hb{day}:{at}");
                intervals.push(interval(&id, "editor", at, at + 60.0));
                at += 120.0;
            }
            at += 16.0 * 3_600.0;
        }
        assert_eq!(intervals.len(), 87_600);

        let started = std::time::Instant::now();
        let timeline = Timeline::build(&intervals, 900.0);
        let elapsed = started.elapsed();
        println!(
            "Timeline::build over {} intervals took {elapsed:?} -> {:.0}s reported",
            intervals.len(),
            total_seconds(&timeline.bridged)
        );
        assert!(timeline.proven_seconds > 0.0);
        // ~87ms debug / ~34ms release on the machine this was written on. The bound is
        // loose enough for a slow CI box but nowhere near the 9.1 seconds the
        // unchunked sweep took on this same input, so losing the per-component
        // chunking fails here rather than in production.
        assert!(
            elapsed < std::time::Duration::from_secs(3),
            "Timeline::build took {elapsed:?} for {} intervals — has the per-component \
             chunking in `canonicalize` been lost?",
            intervals.len()
        );
    }

    /// The invariant that was broken for as long as the breakdowns came from the
    /// `*_daily` aggregate tables: every dimension partitions the same timeline, so
    /// each one's rows must sum to the day's total. A future surface that groups by
    /// something new gets this for free by going through `totals_by`.
    #[test]
    fn every_breakdown_sums_to_the_total() {
        let intervals = vec![
            ActivityInterval {
                project: Some("wakaclock".to_string()),
                language: Some("Rust".to_string()),
                editor: "vscode".to_string(),
                operating_system: "macos".to_string(),
                ..interval("a", "editor", 0.0, 60.0)
            },
            ActivityInterval {
                project: Some("wakaclock".to_string()),
                language: Some("TypeScript".to_string()),
                editor: "vscode".to_string(),
                operating_system: "macos".to_string(),
                ..interval("b", "editor", 300.0, 360.0)
            },
            ActivityInterval {
                // No project and no language: these must group as "Unknown" rather than
                // being dropped, or the breakdown silently loses real seconds.
                project: None,
                project_id: None,
                branch: None,
                language: None,
                editor: "wakaclock-ai-sync".to_string(),
                operating_system: "linux".to_string(),
                ..interval("c", "ai", 900.0, 960.0)
            },
        ];
        let canonical = canonicalize_bridged(&intervals, 900.0);
        let total = total_seconds(&canonical);
        assert!(total > 0.0);

        for dimension in [
            Dimension::Language,
            Dimension::Project,
            Dimension::Editor,
            Dimension::OperatingSystem,
            Dimension::Category,
        ] {
            let rows = totals_by(&canonical, dimension);
            let summed: f64 = rows.iter().map(|(_, seconds, _)| seconds).sum();
            assert!(
                (summed - total).abs() < 1e-6,
                "{dimension:?} rows sum to {summed}, day total is {total}"
            );
            assert!(
                rows.iter().all(|(name, _, _)| !name.is_empty()),
                "{dimension:?} produced an empty bucket name"
            );
            // Seconds partitioning is not enough on its own: the counts are reported
            // next to them and must be deduplicated the same way `grand_total` is,
            // or the day and its breakdown contradict each other on heartbeats while
            // agreeing on time. `canonicalize` splits one heartbeat across boundary
            // windows, so a naive `+= 1` overstates every bucket.
            let counted: u64 = rows.iter().map(|(_, _, heartbeats)| heartbeats).sum();
            assert_eq!(
                counted,
                heartbeat_count(&canonical),
                "{dimension:?} counted {counted} heartbeats, day has {}",
                heartbeat_count(&canonical)
            );
        }

        let unknown_languages = totals_by(&canonical, Dimension::Language)
            .into_iter()
            .filter(|(name, _, _)| name == "Unknown")
            .count();
        assert_eq!(unknown_languages, 1);
    }

    /// `attended + agent + other` is a second partition of the same total, alongside
    /// `proven + inferred`. Both are reported next to `total_seconds`, so a drift in
    /// either is a visible contradiction in the payload. AI coding/session metrics are
    /// additive diagnostics and intentionally are not part of either partition.
    #[test]
    fn the_evidence_split_partitions_the_total_twice() {
        let intervals = vec![
            interval("a", "editor", 0.0, 60.0),
            interval("b", "ai", 300.0, 360.0),
            interval("c", "other", 700.0, 760.0),
        ];
        let proven = total_seconds(&canonicalize(&intervals));
        let canonical = canonicalize_bridged(&intervals, 900.0);
        let total = total_seconds(&canonical);
        let split = EvidenceSplit::new(proven, &canonical);

        assert!((split.proven_seconds + split.inferred_seconds - total).abs() < 1e-6);
        assert!(
            (split.attended_seconds + split.agent_seconds + split.other_seconds - total).abs()
                < 1e-6
        );
        // 180s measured, the rest bridged.
        assert_eq!(split.proven_seconds, 180.0);
        assert_eq!(split.inferred_seconds, total - 180.0);
    }

    #[test]
    fn measured_ai_seconds_excludes_bridged_gaps_and_unions_overlap() {
        let intervals = vec![
            interval("ai-1", "ai", 0.0, 60.0),
            interval("ai-2", "ai", 30.0, 90.0),
            interval("human", "editor", 90.0, 120.0),
        ];
        let timeline = Timeline::build(&intervals, BridgeConfig::split(900.0, 120.0));

        assert_eq!(measured_ai_seconds(&timeline.measured), 90.0);
        assert_eq!(timeline.evidence().ai_coding_seconds, 90.0);
        assert_eq!(timeline.evidence().ai_session_seconds, 0.0);
    }

    #[test]
    fn union_ranges_sorts_and_ignores_invalid_ranges() {
        assert_eq!(
            union_ranges(&[(10.0, 20.0), (0.0, 15.0), (30.0, 30.0), (40.0, 35.0)]),
            20.0
        );
    }

    #[test]
    fn closed_session_uses_ended_at_and_open_session_uses_last_event() {
        assert_eq!(
            clipped_session_interval(100, Some(160), 130, 0.0, 1_000.0),
            Some((100.0, 160.0))
        );
        assert_eq!(
            clipped_session_interval(100, None, 130, 0.0, 1_000.0),
            Some((100.0, 130.0))
        );
    }

    #[test]
    fn singleton_session_has_zero_duration_and_range_edges_are_clipped() {
        assert_eq!(clipped_session_interval(100, None, 100, 0.0, 1_000.0), None);
        assert_eq!(
            clipped_session_interval(100, Some(200), 150, 125.0, 175.0),
            Some((125.0, 175.0))
        );
    }

    /// WakaTime's duration builder, implemented straight from its definition so the
    /// two can be compared on the same input: sort the heartbeats, start a new block
    /// wherever the gap to the next one exceeds the timeout, and take each block's
    /// duration as `last - first`. A block of one heartbeat is worth nothing.
    ///
    /// This exists to pin the compatibility claim. `bridge_idle_gaps` is supposed to be
    /// the same rule expressed over intervals instead of instants, and if the two ever
    /// diverge on a plain heartbeat stream, that is a compatibility regression rather
    /// than a judgement call — hence a test rather than a comment.
    fn wakatime_reference(heartbeat_times: &[f64], timeout_seconds: f64) -> f64 {
        let mut times = heartbeat_times.to_vec();
        times.sort_by(|left, right| left.partial_cmp(right).unwrap_or(Ordering::Equal));
        let Some(&first) = times.first() else {
            return 0.0;
        };
        let mut total = 0.0;
        let mut block_start = first;
        let mut previous = first;
        for &time in &times[1..] {
            if time - previous > timeout_seconds {
                total += previous - block_start;
                block_start = time;
            }
            previous = time;
        }
        total + previous - block_start
    }

    /// Every heartbeat in these streams is a bare instant — no client-measured
    /// segments — which is exactly the shape WakaTime's own plugins produce. On that
    /// input wakaclock must return WakaTime's number to the second.
    #[test]
    fn anchor_only_streams_match_wakatime_exactly() {
        let streams: [&[f64]; 6] = [
            &[],
            &[100.0],
            // Steady two-minute cadence, the WakaTime plugin default.
            &[0.0, 120.0, 240.0, 360.0, 480.0],
            // One gap just inside the timeout and one just outside it.
            &[0.0, 120.0, 1_010.0, 1_130.0, 2_040.0],
            // A long unattended run at agent-hook cadence, then a real break.
            &[
                0.0, 45.0, 90.0, 200.0, 260.0, 700.0, 1_500.0, 5_000.0, 5_060.0,
            ],
            // Out-of-order arrival: an offline queue flush must not change the total.
            &[480.0, 0.0, 240.0, 120.0, 360.0],
        ];

        for timeout in [120.0, 300.0, 900.0] {
            for times in streams {
                let anchors = times
                    .iter()
                    .enumerate()
                    .map(|(index, &time)| anchor(&format!("hb{index}"), time))
                    .collect::<Vec<_>>();
                let ours = total_seconds(&canonicalize_bridged(&anchors, timeout));
                let theirs = wakatime_reference(times, timeout);
                assert!(
                    (ours - theirs).abs() < 1e-6,
                    "timeout {timeout}s, stream {times:?}: wakaclock {ours} != wakatime {theirs}"
                );
            }
        }
    }

    /// With measured segments in the stream wakaclock may report *more* than WakaTime,
    /// because a segment proves time before its heartbeat that WakaTime never sees. It
    /// must never report less, and it must never exceed the wall-clock span.
    #[test]
    fn measured_segments_only_ever_add_to_the_wakatime_number() {
        let intervals = [
            interval("a", "editor", 0.0, 60.0),
            interval("b", "editor", 300.0, 360.0),
            interval("c", "ai", 900.0, 960.0),
        ];
        // WakaTime sees only the heartbeat instants, which are the segment ends.
        let heartbeat_times = intervals.iter().map(|item| item.end).collect::<Vec<_>>();

        for timeout in [120.0, 300.0, 900.0] {
            let ours = total_seconds(&canonicalize_bridged(&intervals, timeout));
            let theirs = wakatime_reference(&heartbeat_times, timeout);
            assert!(
                ours >= theirs - 1e-6,
                "timeout {timeout}s: wakaclock {ours} lost time against wakatime {theirs}"
            );
            let span = 960.0 - 0.0;
            assert!(
                ours <= span + 1e-6,
                "timeout {timeout}s: wakaclock {ours} exceeds the {span}s wall-clock span"
            );
        }
    }

    /// The bridge is the whole difference between measured and reported time, so the
    /// audit in docs/duration-accuracy-audit.md needs it to be separable and bounded:
    /// bridging can only ever grow a total, never past the observed span.
    #[test]
    fn bridging_is_monotonic_in_the_timeout_and_bounded_by_the_span() {
        let intervals = [
            interval("a", "editor", 0.0, 30.0),
            interval("b", "editor", 200.0, 230.0),
            interval("c", "editor", 1_000.0, 1_030.0),
            interval("d", "ai", 1_900.0, 1_930.0),
        ];
        let span = 1_930.0;
        let mut previous = 0.0;
        for timeout in [0.0, 60.0, 120.0, 300.0, 600.0, 900.0, 1_800.0] {
            let total = total_seconds(&canonicalize_bridged(&intervals, timeout));
            assert!(
                total >= previous - 1e-6,
                "timeout {timeout}s reported {total}, less than the shorter timeout's {previous}"
            );
            assert!(
                total <= span + 1e-6,
                "timeout {timeout}s reported {total} > span {span}"
            );
            previous = total;
        }
        // 120s of measured evidence at a zero timeout, the whole span at a huge one.
        assert_eq!(total_seconds(&canonicalize_bridged(&intervals, 0.0)), 120.0);
        assert_eq!(
            total_seconds(&canonicalize_bridged(&intervals, 1_800.0)),
            span
        );
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
