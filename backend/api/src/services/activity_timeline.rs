use anyhow::Result;
use clickhouse::Row;
use serde::Deserialize;
use std::{
    cmp::Ordering,
    collections::{BTreeMap, HashMap, HashSet},
    sync::Arc,
};
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use wakaclock_core::heartbeat::{
    normalize_activity_source, ActivitySegment, ActorType, ACTIVE_LEASE_SECONDS,
    MAX_ACTIVITY_GAP_SECONDS, MAX_AI_TOOL_DURATION_SECONDS,
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
    /// Machine identity is carried through the timeline so the dashboard's machine
    /// breakdown uses the same overlap union as every other duration dimension.
    pub machine: String,
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
    pub machine: String,
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
    machine: String,
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
    pub combined_v2: bool,
    /// WakaTime's timeout, applied to human editor activity. See `Config::idle_timeout_seconds`.
    pub idle_timeout_seconds: f64,
    /// The same knob for agent-emitted activity. `None` puts every source on one
    /// timeline at `idle_timeout_seconds` — the single-stream behaviour that shipped
    /// before the split, kept so a deployment can roll back without a revert.
    pub agent_idle_timeout_seconds: Option<f64>,
    /// Which duration is presented as primary by canaried surfaces. Both streams
    /// are always computed; this only changes presentation when explicitly enabled.
    pub primary_mode: crate::config::DurationPrimaryMode,
}

impl BridgeConfig {
    /// One timeline for every source. WakaTime's own model, and what the parity tests
    /// in this module measure against.
    pub fn single(idle_timeout_seconds: f64) -> Self {
        Self {
            combined_v2: false,
            idle_timeout_seconds,
            agent_idle_timeout_seconds: None,
            primary_mode: crate::config::DurationPrimaryMode::WakatimeCompatible,
        }
    }

    /// Human and agent activity bridged independently. An agent timeout of zero lets
    /// agent heartbeats contribute their measured evidence and nothing more.
    pub fn split(idle_timeout_seconds: f64, agent_idle_timeout_seconds: f64) -> Self {
        Self {
            combined_v2: false,
            idle_timeout_seconds,
            agent_idle_timeout_seconds: Some(agent_idle_timeout_seconds),
            primary_mode: crate::config::DurationPrimaryMode::WakatimeCompatible,
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

    fn query_context_seconds(&self) -> f64 {
        let mut context = MAX_ACTIVITY_GAP_SECONDS;
        if self.bridge.idle_timeout_seconds.is_finite() {
            context = context.max(self.bridge.idle_timeout_seconds.max(0.0));
        }
        if let Some(agent_timeout) = self.bridge.agent_idle_timeout_seconds {
            if agent_timeout.is_finite() {
                context = context.max(agent_timeout.max(0.0));
            }
        }
        context
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
        // Derive intervals from the winning raw revision. A projection may still
        // contain removed segments after a correction or a partially failed write.
        let mut seen_segments = HashSet::new();
        let mut intervals = Vec::new();
        let context_seconds = self.query_context_seconds();
        // All-time callers use `f64::MAX` as an open upper bound. Keep the SQL
        // parameters finite after adding the boundary context; ClickHouse accepts the
        // full Float64 range but not every driver serializes `+inf` consistently.
        let query_start = (start - context_seconds).max(f64::MIN);
        let query_end = (end + context_seconds).min(f64::MAX);
        let rows = self
            .clickhouse
            .get_client()
            .query(
                "SELECT entity, time, project, project_id, branch, language, category,
                        heartbeat_id, active_seconds, activity_segments, editor, operating_system,
                        machine, actor_type, actor_confidence
                 FROM wakaclock.heartbeats_canonical
                 -- A legacy heartbeat stores only its end timestamp plus
                 -- `active_seconds`. Include the configured timeout on either side so
                 -- an interval crossing a day/range boundary is still recovered before
                 -- clipping. Buffered explicit segments can predate the send timestamp
                 -- by hours; include them by their own bounds, not just heartbeat time.
                 WHERE user_id = ? AND (
                     (time >= ? AND time < ?)
                     OR arrayExists(segment -> segment.end > ? AND segment.start < ?,
                         JSONExtract(activity_segments, 'Array(Tuple(start Float64, end Float64))'))
                 )
                 ORDER BY time ASC, heartbeat_id ASC",
            )
            .bind(user_id)
            .bind(query_start)
            .bind(query_end)
            .bind(start)
            .bind(end)
            .fetch_all::<RawActivityRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse activity timeline query error: {error}")
            })?;

        // A range query still needs the nearest heartbeat on either side to decide whether
        // its first/last in-range event belongs to the same WakaTime session. Keep only a
        // zero-length boundary anchor; measured segments remain clipped to [start, end), so
        // context can extend a session without leaking time into the requested range.
        let make_boundary_anchor =
            |row: &RawActivityRow, heartbeat_id: &str, at: f64, suffix: &str| -> ActivityInterval {
                ActivityInterval {
                    segment_id: format!("{heartbeat_id}:{suffix}"),
                    heartbeat_id: heartbeat_id.to_string(),
                    start: at,
                    end: at,
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
                    machine: row.machine.clone(),
                }
            };
        let mut before_boundary: Option<ActivityInterval> = None;
        let mut after_boundary: Option<ActivityInterval> = None;
        let mut has_in_range_evidence = false;

        for (row_index, row) in rows.into_iter().enumerate() {
            let heartbeat_id = row
                .heartbeat_id
                .clone()
                .unwrap_or_else(|| format!("legacy-row:{row_index}"));
            if row.time < start && row.time >= start - context_seconds {
                // Rows are ordered by time, so the last one wins and is the nearest
                // predecessor for the requested range.
                before_boundary = Some(make_boundary_anchor(
                    &row,
                    &heartbeat_id,
                    row.time,
                    "boundary-start",
                ));
            } else if row.time >= end
                && row.time <= end + context_seconds
                && after_boundary.is_none()
            {
                after_boundary = Some(make_boundary_anchor(
                    &row,
                    &heartbeat_id,
                    row.time,
                    "boundary-end",
                ));
            }
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
                has_in_range_evidence = true;
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
                        machine: row.machine.clone(),
                    });
                }
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
                // Legacy segments are bounded to the 120-second evidence window.
                // A completed AI tool operation carries its own bounded start/end
                // interval (up to six hours) and must not be shortened to 120s.
                let max_span = match segment.source.as_deref() {
                    Some(source) if source.eq_ignore_ascii_case("editor_active_v1") => {
                        ACTIVE_LEASE_SECONDS
                    }
                    Some(source) if source.eq_ignore_ascii_case("ai_tool_v1") => {
                        MAX_AI_TOOL_DURATION_SECONDS
                    }
                    Some(source) if source.eq_ignore_ascii_case("browser_foreground_v1") => {
                        wakaclock_core::heartbeat::MAX_BROWSER_INTERVAL_SECONDS
                    }
                    _ => MAX_ACTIVITY_GAP_SECONDS,
                };
                let clamped_start = segment.start.max(segment.end - max_span);
                let segment_start = clamped_start.max(start);
                let segment_end = segment.end.min(end);
                if !segment_start.is_finite()
                    || !segment_end.is_finite()
                    || segment_end <= segment_start
                {
                    continue;
                }
                // A buffered segment may be the only evidence whose timestamp falls in
                // the requested range (the heartbeat carrying it can be flushed before
                // or after the range). Treat that as in-range evidence so a nearby
                // boundary anchor may extend the same session, while still keeping an
                // outside-only pair from bridging an otherwise empty range.
                has_in_range_evidence = true;
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
                    machine: row.machine.clone(),
                });
            }
        }
        if has_in_range_evidence {
            if let Some(anchor) = before_boundary {
                intervals.push(anchor);
            }
            if let Some(anchor) = after_boundary {
                intervals.push(anchor);
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
        Ok(self.build_timeline(user_id, start, end).await?.bridged)
    }

    /// Build the authoritative timeline, including project aliases, once for a request.
    ///
    /// Callers that need both the legacy-compatible total and the duration-v2 metrics should
    /// use this method instead of fetching `intervals` and constructing `Timeline` themselves.
    /// Keeping the merge pass here also means every duration surface groups a renamed project
    /// under the same identity as `/projects`.
    pub async fn build_timeline(&self, user_id: Uuid, start: f64, end: f64) -> Result<Timeline> {
        let mut raw = self.intervals(user_id, start, end).await?;
        // Resolve aliases before the sweep. Bridged seconds inherit the metadata of the
        // earlier interval, so applying a merge only after canonicalization could leave
        // an inferred pause attached to the old project while the measured rows moved to
        // the new one. The raw evidence is also retained by `Timeline` for project-level
        // AI metrics, which must union overlapping AI ranges independently of ownership.
        self.apply_project_merges_to_activity(user_id, &mut raw)
            .await?;
        Ok(Timeline::build_clipped(&raw, self.bridge, start, end))
    }

    /// Fold merged project names into their target, for the timeline as well as the
    /// project list.
    ///
    /// `ProjectIdentityService::resolve_project_id` already canonicalises the name when a
    /// heartbeat is *written*, so anything recorded after a merge exists arrives with the
    /// target's identity. Rows written before it keep the id they were minted with, and
    /// this view groups by `project_id` — so renaming alone would leave two rows carrying
    /// the same label. The id has to travel with the name, which is why this reads the
    /// target's persisted identity rather than re-deriving one.
    async fn apply_project_merges_to_activity(
        &self,
        user_id: Uuid,
        intervals: &mut [ActivityInterval],
    ) -> Result<()> {
        if intervals.iter().all(|interval| interval.project.is_none()) {
            return Ok(());
        }

        let merges = self.merge_map(user_id).await?;
        if merges.is_empty() {
            return Ok(());
        }

        let identities = self.identity_ids(user_id).await?;

        for interval in intervals.iter_mut() {
            let Some(target) = interval
                .project
                .as_deref()
                .and_then(|name| merges.get(name))
                .cloned()
            else {
                continue;
            };

            // Only move the id when the target has a persisted identity. Leaving the old
            // id in place keeps the row grouped where it already was, which is wrong but
            // visible; inventing an id would fork the project silently.
            if let Some(target_id) = identities.get(&target) {
                interval.project_id = Some(*target_id);
            }
            interval.project = Some(target);
        }

        Ok(())
    }

    /// Latest merge target per source project name.
    async fn merge_map(&self, user_id: Uuid) -> Result<HashMap<String, String>> {
        #[derive(Debug, Row, Deserialize)]
        struct MergeRow {
            source_project: String,
            target_project: String,
        }

        let rows = self
            .clickhouse
            .get_client()
            .query(
                "SELECT source_project, argMax(target_project, updated_at) AS target_project
                 FROM wakaclock.project_merges
                 WHERE user_id = ?
                 GROUP BY source_project",
            )
            .bind(user_id)
            .fetch_all::<MergeRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse project merges query error: {error}"))?;

        Ok(rows
            .into_iter()
            .filter(|row| {
                !row.target_project.is_empty() && row.source_project != row.target_project
            })
            .map(|row| (row.source_project, row.target_project))
            .collect())
    }

    /// Persisted project id per canonical name.
    async fn identity_ids(&self, user_id: Uuid) -> Result<HashMap<String, Uuid>> {
        #[derive(Debug, Row, Deserialize)]
        struct IdentityRow {
            canonical_name: String,
            #[serde(with = "clickhouse::serde::uuid")]
            project_id: Uuid,
        }

        let rows = self
            .clickhouse
            .get_client()
            .query(
                "SELECT canonical_name, argMax(project_id, version) AS project_id
                 FROM wakaclock.project_identities
                 WHERE user_id = ?
                 GROUP BY canonical_name",
            )
            .bind(user_id)
            .fetch_all::<IdentityRow>()
            .await
            .map_err(|error| {
                anyhow::anyhow!("ClickHouse project identities query error: {error}")
            })?;

        Ok(rows
            .into_iter()
            .map(|row| (row.canonical_name, row.project_id))
            .collect())
    }
}

fn source_priority(source: &str) -> u8 {
    match source {
        "editor" | "editor_active_v1" => 0,
        "ai" | "ai_tool_v1" => 1,
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
            machine: owner.machine.clone(),
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
                    machine: anchor.machine.clone(),
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
        let (at, candidate) = match event {
            Event::Interval(interval) => (interval.start, interval),
            Event::Anchor(anchor) => (anchor.start, anchor),
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
            // Keep a reachable anchor as a zero-length ownership cursor. It contributes
            // no duration by itself, but if another event follows it, that next gap must
            // belong to this anchor's project/entity rather than the run before it.
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
        let (at, candidate) = match event {
            Event::Interval(interval) => (interval.start, interval),
            Event::Anchor(anchor) => (anchor.start, anchor),
        };
        if let Some(previous) = result.last() {
            let previous_source = previous_source.as_deref().unwrap_or(&previous.source);
            let gap = at - previous.end;
            // The agent allowance applies only where *both* sides of the pause are agent
            // activity — the unattended-run case it exists to catch. A pause with a human
            // on either side is a developer driving an agent, which is ordinary attended
            // work and gets the human timeout.
            let timeout = if is_attended(previous_source) || is_attended(&candidate.source) {
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
            // Keep reachable anchors as ownership cursors. The final retain removes a
            // cursor when no later event grows it into a real interval.
        }
        // Keep a zero-length anchor after it closes the preceding gap. It becomes the
        // owner of the *next* gap, preserving project/file/editor dimensions when a
        // session moves between files or workspaces. The final trailing anchor is still
        // removed below, so an isolated heartbeat never invents duration.
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
        machine: anchor.machine.clone(),
    }
}

/// Only human editor activity proves the developer was at the keyboard. The canonical
/// source normalization in `wakaclock_core::heartbeat::normalize_activity_source` has
/// already folded every emitter into `editor` / `ai` / `other`.
fn is_attended(source: &str) -> bool {
    source == "editor" || source == "editor_active_v1"
}

/// Old desktop clients emitted foreground-app samples before they populated `actor_type`,
/// leaving real editor evidence as `unknown`/`other`. Keep that one known emitter in the
/// WakaTime-comparable stream during the migration; a generic `unknown` row must stay out
/// because it could be an AI or integration event with no reliable human proof.
fn is_comparable_editor_interval(interval: &ActivityInterval) -> bool {
    interval.source == "editor"
        || interval.source == "editor_active_v1"
        || interval.actor_type == ActorType::Human
        || (interval.actor_type == ActorType::Unknown
            && interval
                .editor
                .trim()
                .eq_ignore_ascii_case("atoaxis desktop"))
}

/// The two views of one range that every duration surface reports together: the time a
/// client proved, and the WakaTime-compatible total after idle bridging.
///
/// `canonicalize` is an O(n²) boundary sweep, and computing the two separately ran it
/// twice per request — three times in `StatsService`, which also rebuilt the timeline
/// for its totals and its best day. Building both from one sweep keeps the cost of the
/// evidence split at zero.
pub struct Timeline {
    /// Raw interval evidence after project aliases have been resolved. Keeping this
    /// alongside the canonical ownership sweep lets project views calculate measured AI
    /// unions without losing AI ranges that overlap a human editor interval.
    raw: Vec<ActivityInterval>,
    comparable_ranges: Vec<(f64, f64)>,
    ai_ranges: Vec<(f64, f64)>,
    pub comparable_seconds: f64,
    pub ai_measured_seconds: f64,
    pub ai_additional_seconds: f64,
    pub calculation_version: &'static str,
    /// Seconds a client actually measured in the duration calculation's evidence streams:
    /// the overlap-free union, before idle bridging. In `combined_v2`, unresolved `other`
    /// rows remain available in the raw ledger but are intentionally outside the headline
    /// formula, so they do not make this partition larger than the reported total.
    pub proven_seconds: f64,
    /// Measured canonical intervals retained so attribution-specific metrics can be
    /// derived without treating idle bridge time as AI coding.
    pub measured: Vec<CanonicalInterval>,
    pub bridged: Vec<CanonicalInterval>,
    /// Measured browser foreground union; never bridged or added to Coding/AI totals.
    pub browsing: Vec<CanonicalInterval>,
    /// Strict Active v1 duration, derived only from explicit 15-second editor
    /// leases and completed AI tool intervals. Legacy/WakaTime-compatible rows
    /// are intentionally excluded from this union.
    pub active_seconds: f64,
    pub active_human_seconds: f64,
    pub active_ai_seconds: f64,
    pub active_overlap_seconds: f64,
    /// `measured` when at least one v1 interval exists, `partial` for a range that
    /// only contains legacy evidence, and `unavailable` for an empty range.
    pub active_coverage: &'static str,
}

impl Timeline {
    pub fn primary_seconds(&self, mode: crate::config::DurationPrimaryMode) -> f64 {
        match mode {
            crate::config::DurationPrimaryMode::ActiveV1 if self.active_coverage == "measured" => {
                self.active_seconds
            }
            _ => total_seconds(&self.bridged),
        }
    }

    /// Return strict Active v1 metrics clipped to one calendar/reporting range.
    ///
    /// A multi-day timeline is built once per request, but summary rows are emitted
    /// per day. Reusing the range-level fields for every row would duplicate the full
    /// range in each day, so day-level surfaces must clip the raw evidence first.
    pub fn active_metrics_in_range(
        &self,
        start: f64,
        end: f64,
    ) -> (f64, f64, f64, f64, &'static str) {
        let clipped = self
            .raw
            .iter()
            .cloned()
            .filter_map(|interval| clip_activity_interval(interval, start, end))
            .collect::<Vec<_>>();
        active_metrics(&clipped)
    }

    /// Strict Active metrics for one stable project identity. Filtering is applied to
    /// the already-resolved raw evidence and never changes bridge ownership.
    pub fn active_metrics_for_project_in_range(
        &self,
        start: f64,
        end: f64,
        project_id: Uuid,
        project_name: &str,
    ) -> (f64, f64, f64, f64, &'static str) {
        let clipped = self
            .raw
            .iter()
            .filter(|interval| match interval.project_id {
                Some(id) => id == project_id,
                None => interval.project.as_deref().unwrap_or("Unknown") == project_name,
            })
            .cloned()
            .filter_map(|interval| clip_activity_interval(interval, start, end))
            .collect::<Vec<_>>();
        active_metrics(&clipped)
    }

    pub fn build(intervals: &[ActivityInterval], bridge: impl Into<BridgeConfig>) -> Self {
        let bridge = bridge.into();
        let raw = intervals.to_vec();
        // `combined_v2` defines the headline as union(editor, measured AI). Keep generic
        // unknown/integration rows in `raw` for audit and project attribution, but do not
        // let them inflate the duration evidence partition or re-enter the combined sweep.
        let coding_intervals: Vec<ActivityInterval> = intervals
            .iter()
            .filter(|interval| {
                interval.category != "browsing" && interval.source != "browser_foreground_v1"
            })
            .cloned()
            .collect();
        let browsing = canonicalize(
            &intervals
                .iter()
                .filter(|interval| {
                    interval.category == "browsing" && interval.source == "browser_foreground_v1"
                })
                .cloned()
                .collect::<Vec<_>>(),
        );
        let intervals = coding_intervals.as_slice();
        let duration_intervals: Vec<ActivityInterval> = if bridge.combined_v2 {
            intervals
                .iter()
                .filter(|interval| {
                    is_comparable_editor_interval(interval)
                        || (interval.actor_type.is_ai() && interval.end > interval.start)
                })
                .cloned()
                .collect()
        } else {
            intervals.to_vec()
        };
        let anchors: Vec<ActivityInterval> = duration_intervals
            .iter()
            .filter(|interval| interval.end <= interval.start)
            .cloned()
            .collect();
        let canonical = canonicalize(&duration_intervals);
        let proven_seconds = total_seconds(&canonical);
        let measured = canonical.clone();
        let editor: Vec<_> = intervals
            .iter()
            .filter(|row| is_comparable_editor_interval(row))
            .cloned()
            .collect();
        let editor_anchors: Vec<_> = editor
            .iter()
            .filter(|row| row.end <= row.start)
            .cloned()
            .collect();
        let comparable = bridge_idle_gaps_with_anchors(
            canonicalize(&editor),
            &editor_anchors,
            bridge.idle_timeout_seconds,
        );
        let comparable_seconds = total_seconds(&comparable);
        let ai_ranges: Vec<_> = intervals
            .iter()
            .filter(|row| row.actor_type.is_ai() && row.end > row.start)
            .map(|row| (row.start, row.end))
            .collect();
        let ai_measured_seconds = union_ranges(&ai_ranges);
        let comparable_ranges: Vec<_> = comparable.iter().map(|row| (row.start, row.end)).collect();
        let mut combined_ranges = ai_ranges.clone();
        combined_ranges.extend(comparable_ranges.iter().copied());
        let ai_additional_seconds = (union_ranges(&combined_ranges) - comparable_seconds).max(0.0);
        let bridged = if bridge.combined_v2 {
            // Build editor time before overlaying AI: AI must neither extend an
            // editor timeout nor erase editor evidence through ownership selection.
            let editor: Vec<_> = intervals
                .iter()
                .filter(|interval| is_comparable_editor_interval(interval))
                .cloned()
                .collect();
            let editor_anchors: Vec<_> = editor
                .iter()
                .filter(|interval| interval.end <= interval.start)
                .cloned()
                .collect();
            let comparable = bridge_idle_gaps_with_anchors(
                canonicalize(&editor),
                &editor_anchors,
                bridge.idle_timeout_seconds,
            );
            let mut combined: Vec<ActivityInterval> = comparable
                .into_iter()
                .map(|interval| ActivityInterval {
                    segment_id: interval.segment_id,
                    heartbeat_id: interval.heartbeat_id,
                    start: interval.start,
                    end: interval.end,
                    source: interval.source,
                    actor_type: interval.actor_type,
                    actor_confidence: interval.actor_confidence,
                    entity: interval.entity,
                    project: interval.project,
                    project_id: interval.project_id,
                    branch: interval.branch,
                    language: interval.language,
                    category: interval.category,
                    editor: interval.editor,
                    operating_system: interval.operating_system,
                    machine: interval.machine,
                })
                .collect();
            combined.extend(
                intervals
                    .iter()
                    .filter(|interval| interval.actor_type.is_ai() && interval.end > interval.start)
                    .cloned(),
            );
            canonicalize(&combined)
        } else {
            match bridge.agent_idle_timeout_seconds {
                Some(agent_idle_timeout_seconds) => bridge_by_attendance(
                    canonical,
                    &anchors,
                    bridge.idle_timeout_seconds,
                    agent_idle_timeout_seconds,
                ),
                None => {
                    bridge_idle_gaps_with_anchors(canonical, &anchors, bridge.idle_timeout_seconds)
                }
            }
        };
        let (
            active_seconds,
            active_human_seconds,
            active_ai_seconds,
            active_overlap_seconds,
            active_coverage,
        ) = active_metrics(&raw);
        Self {
            raw,
            comparable_ranges,
            ai_ranges,
            comparable_seconds,
            ai_measured_seconds,
            ai_additional_seconds,
            calculation_version: if bridge.combined_v2 {
                "combined_v2"
            } else {
                "legacy"
            },
            proven_seconds,
            measured,
            bridged,
            browsing,
            active_seconds,
            active_human_seconds,
            active_ai_seconds,
            active_overlap_seconds,
            active_coverage,
        }
    }

    /// Build with original boundary-event timestamps, then clip the resulting
    /// ownership windows. Clipping anchors before idle-timeout comparison can turn
    /// a long cross-boundary absence into an apparently short active gap.
    pub fn build_clipped(
        intervals: &[ActivityInterval],
        bridge: impl Into<BridgeConfig>,
        start: f64,
        end: f64,
    ) -> Self {
        let mut timeline = Self::build(intervals, bridge);
        timeline.raw = timeline
            .raw
            .into_iter()
            .filter_map(|interval| clip_activity_interval(interval, start, end))
            .collect();
        timeline.measured = timeline
            .measured
            .into_iter()
            .filter_map(|interval| clip_canonical_interval(interval, start, end))
            .collect();
        timeline.bridged = timeline
            .bridged
            .into_iter()
            .filter_map(|interval| clip_canonical_interval(interval, start, end))
            .collect();
        timeline.comparable_ranges = timeline
            .comparable_ranges
            .into_iter()
            .filter_map(|range| clip_range(range, start, end))
            .collect();
        timeline.ai_ranges = timeline
            .ai_ranges
            .into_iter()
            .filter_map(|range| clip_range(range, start, end))
            .collect();
        timeline.browsing = timeline
            .browsing
            .into_iter()
            .filter_map(|interval| clip_canonical_interval(interval, start, end))
            .collect();
        timeline.proven_seconds = total_seconds(&timeline.measured);
        timeline.comparable_seconds = union_ranges(&timeline.comparable_ranges);
        timeline.ai_measured_seconds = union_ranges(&timeline.ai_ranges);
        let mut combined = timeline.comparable_ranges.clone();
        combined.extend(timeline.ai_ranges.iter().copied());
        timeline.ai_additional_seconds =
            (union_ranges(&combined) - timeline.comparable_seconds).max(0.0);
        let (
            active_seconds,
            active_human_seconds,
            active_ai_seconds,
            active_overlap_seconds,
            active_coverage,
        ) = active_metrics(&timeline.raw);
        timeline.active_seconds = active_seconds;
        timeline.active_human_seconds = active_human_seconds;
        timeline.active_ai_seconds = active_ai_seconds;
        timeline.active_overlap_seconds = active_overlap_seconds;
        timeline.active_coverage = active_coverage;
        timeline
    }

    /// Measured AI ranges for one stable project identity. This deliberately reads raw
    /// evidence rather than `measured`/`bridged`: canonical ownership gives an overlapping
    /// human editor interval the second, but the AI metric is defined as the independent
    /// union of observed agent ranges.
    #[allow(dead_code)]
    pub fn ai_ranges_for_project(
        &self,
        project_id: Uuid,
        project_name: Option<&str>,
    ) -> Vec<(f64, f64)> {
        self.ai_ranges_for_project_on_branch(project_id, project_name, None)
    }

    /// Measured AI ranges for one project and, when requested, one VCS branch. Branch
    /// filters need the same identity fallback as project filters; an old heartbeat may
    /// have no stable project id or may store an empty branch, but it still belongs to the
    /// displayed `Unknown` bucket when the evidence says so.
    pub fn ai_ranges_for_project_on_branch(
        &self,
        project_id: Uuid,
        project_name: Option<&str>,
        branch: Option<&str>,
    ) -> Vec<(f64, f64)> {
        self.raw
            .iter()
            .filter(|interval| {
                interval.actor_type.is_ai()
                    && interval.end > interval.start
                    && match interval.project_id {
                        Some(id) => id == project_id,
                        None => project_name.is_some_and(|name| {
                            interval.project.as_deref().unwrap_or("Unknown") == name
                        }),
                    }
                    && branch
                        .is_none_or(|name| interval.branch.as_deref().unwrap_or("Unknown") == name)
            })
            .map(|interval| (interval.start, interval.end))
            .collect()
    }

    pub fn evidence(&self) -> EvidenceSplit {
        let mut evidence = EvidenceSplit::new(self.proven_seconds, &self.bridged)
            .with_ai_coding_seconds(measured_ai_seconds(&self.measured));
        evidence.comparable_seconds = Some(self.comparable_seconds);
        evidence.ai_measured_seconds = Some(self.ai_measured_seconds);
        evidence.ai_additional_seconds = Some(self.ai_additional_seconds);
        evidence.calculation_version = Some(self.calculation_version);
        evidence
    }

    /// Clip already-built ranges, never rebuild day slices without their neighbours.
    pub fn add_duration_evidence(
        &self,
        mut evidence: EvidenceSplit,
        start: f64,
        end: f64,
    ) -> EvidenceSplit {
        let clip = |ranges: &[(f64, f64)]| {
            ranges
                .iter()
                .filter_map(|&(a, b)| {
                    let a = a.max(start);
                    let b = b.min(end);
                    (b > a).then_some((a, b))
                })
                .collect::<Vec<_>>()
        };
        let mut combined = clip(&self.comparable_ranges);
        let comparable = union_ranges(&combined);
        let ai = clip(&self.ai_ranges);
        evidence.ai_measured_seconds = Some(union_ranges(&ai));
        combined.extend(ai);
        evidence.comparable_seconds = Some(comparable);
        evidence.ai_additional_seconds = Some((union_ranges(&combined) - comparable).max(0.0));
        evidence.calculation_version = Some(self.calculation_version);
        evidence
    }
}

fn clip_range((range_start, range_end): (f64, f64), start: f64, end: f64) -> Option<(f64, f64)> {
    let clipped = (range_start.max(start), range_end.min(end));
    (clipped.1 > clipped.0).then_some(clipped)
}

fn active_metrics(intervals: &[ActivityInterval]) -> (f64, f64, f64, f64, &'static str) {
    let human = intervals
        .iter()
        .filter(|interval| interval.source == "editor_active_v1" && interval.end > interval.start)
        .map(|interval| (interval.start, interval.end))
        .collect::<Vec<_>>();
    let ai = intervals
        .iter()
        .filter(|interval| interval.source == "ai_tool_v1" && interval.end > interval.start)
        .map(|interval| (interval.start, interval.end))
        .collect::<Vec<_>>();
    let human_seconds = union_ranges(&human);
    let ai_seconds = union_ranges(&ai);
    let mut combined = human.clone();
    combined.extend(ai.iter().copied());
    let total = union_ranges(&combined);
    let overlap = (human_seconds + ai_seconds - total).max(0.0);
    let coverage = if !human.is_empty() || !ai.is_empty() {
        "measured"
    } else if intervals.is_empty() {
        "unavailable"
    } else {
        "partial"
    };
    (total, human_seconds, ai_seconds, overlap, coverage)
}

fn clip_canonical_interval(
    mut interval: CanonicalInterval,
    start: f64,
    end: f64,
) -> Option<CanonicalInterval> {
    let (clipped_start, clipped_end) = clip_range((interval.start, interval.end), start, end)?;
    interval.start = clipped_start;
    interval.end = clipped_end;
    Some(interval)
}

fn clip_activity_interval(
    mut interval: ActivityInterval,
    start: f64,
    end: f64,
) -> Option<ActivityInterval> {
    if interval.end <= interval.start {
        return (interval.start >= start && interval.start < end).then_some(interval);
    }
    let (clipped_start, clipped_end) = clip_range((interval.start, interval.end), start, end)?;
    interval.start = clipped_start;
    interval.end = clipped_end;
    Some(interval)
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
    Machine,
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
            Self::Machine => interval.machine.as_str(),
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comparable_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_measured_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ai_additional_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub calculation_version: Option<&'static str>,
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
                "editor" | "editor_active_v1" => split.attended_seconds += seconds,
                "ai" | "ai_tool_v1" => split.agent_seconds += seconds,
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

    #[test]
    fn combined_counts_overlap_once_and_does_not_bridge_ai_gaps() {
        let mut config = BridgeConfig::single(900.0);
        config.combined_v2 = true;
        let raw = vec![
            anchor("a", 0.0),
            anchor("b", 600.0),
            interval("ai1", "ai", 500.0, 700.0),
            interval("ai2", "ai", 800.0, 900.0),
        ];
        let timeline = Timeline::build(&raw, config);
        assert_eq!(total_seconds(&timeline.bridged), 800.0);
        assert_eq!(timeline.comparable_seconds, 600.0);
        assert_eq!(timeline.ai_measured_seconds, 300.0);
        assert_eq!(timeline.ai_additional_seconds, 200.0);
        assert_eq!(timeline.calculation_version, "combined_v2");
    }

    #[test]
    fn combined_completion_only_and_idle_process_have_no_duration() {
        let mut config = BridgeConfig::single(900.0);
        config.combined_v2 = true;
        let raw = vec![anchor_at("a", "ai", 0.0), anchor_at("b", "ai", 600.0)];
        assert_eq!(total_seconds(&Timeline::build(&raw, config).bridged), 0.0);
        assert_eq!(total_seconds(&Timeline::build(&[], config).bridged), 0.0);
    }

    #[test]
    fn combined_independent_agents_union_and_replay_is_idempotent() {
        let mut config = BridgeConfig::single(900.0);
        config.combined_v2 = true;
        let mut raw = vec![
            interval("a", "ai", 0.0, 120.0),
            interval("b", "ai", 60.0, 180.0),
        ];
        raw.extend(raw.clone());
        assert_eq!(total_seconds(&Timeline::build(&raw, config).bridged), 180.0);
    }

    #[test]
    fn combined_keeps_legacy_desktop_editor_evidence() {
        let mut config = BridgeConfig::single(900.0);
        config.combined_v2 = true;
        let legacy_desktop = ActivityInterval {
            editor: "AtoAxis Desktop".to_string(),
            ..interval("desktop", "other", 0.0, 60.0)
        };

        let timeline = Timeline::build(&[legacy_desktop], config);

        assert_eq!(timeline.comparable_seconds, 60.0);
        assert_eq!(total_seconds(&timeline.bridged), 60.0);
    }

    #[test]
    fn active_v1_unions_human_and_ai_and_reports_overlap_once() {
        let human = ActivityInterval {
            source: "editor_active_v1".to_string(),
            actor_type: ActorType::Human,
            actor_confidence: 1.0,
            ..interval("human-active", "editor", 0.0, 30.0)
        };
        let ai = ActivityInterval {
            source: "ai_tool_v1".to_string(),
            actor_type: ActorType::AiVerified,
            actor_confidence: 1.0,
            ..interval("ai-active", "ai", 20.0, 60.0)
        };
        let timeline = Timeline::build(&[human, ai], BridgeConfig::single(900.0));

        assert_eq!(timeline.active_seconds, 60.0);
        assert_eq!(timeline.active_human_seconds, 30.0);
        assert_eq!(timeline.active_ai_seconds, 40.0);
        assert_eq!(timeline.active_overlap_seconds, 10.0);
        assert_eq!(timeline.active_coverage, "measured");
    }

    #[test]
    fn active_v1_keeps_editor_lease_when_line_authorship_is_unknown() {
        let unknown_editor = ActivityInterval {
            source: "editor_active_v1".to_string(),
            actor_type: ActorType::Unknown,
            actor_confidence: 0.0,
            ..interval("mixed-editor", "other", 0.0, 15.0)
        };

        let timeline = Timeline::build(&[unknown_editor], BridgeConfig::single(900.0));

        assert_eq!(timeline.active_seconds, 15.0);
        assert_eq!(timeline.active_human_seconds, 15.0);
        assert_eq!(timeline.active_ai_seconds, 0.0);
        assert_eq!(timeline.active_coverage, "measured");
    }

    #[test]
    fn active_v1_metrics_can_be_clipped_per_day_without_repeating_the_range() {
        let human = ActivityInterval {
            source: "editor_active_v1".to_string(),
            actor_type: ActorType::Human,
            actor_confidence: 1.0,
            ..interval("human-day-1", "editor", 86_390.0, 86_400.0)
        };
        let ai = ActivityInterval {
            source: "ai_tool_v1".to_string(),
            actor_type: ActorType::AiVerified,
            actor_confidence: 1.0,
            ..interval("ai-day-2", "ai", 86_410.0, 86_430.0)
        };
        let timeline = Timeline::build(&[human, ai], BridgeConfig::single(900.0));

        let day_one = timeline.active_metrics_in_range(86_000.0, 86_400.0);
        assert_eq!(day_one.0, 10.0);
        assert_eq!(day_one.1, 10.0);
        assert_eq!(day_one.2, 0.0);
        assert_eq!(day_one.3, 0.0);
        assert_eq!(day_one.4, "measured");

        let day_two = timeline.active_metrics_in_range(86_400.0, 86_800.0);
        assert_eq!(day_two.0, 20.0);
        assert_eq!(day_two.1, 0.0);
        assert_eq!(day_two.2, 20.0);
        assert_eq!(day_two.3, 0.0);
        assert_eq!(day_two.4, "measured");
    }

    #[test]
    fn combined_keeps_unresolved_rows_out_of_the_duration_partition() {
        let mut config = BridgeConfig::single(900.0);
        config.combined_v2 = true;
        let raw = vec![
            interval("human", "editor", 0.0, 60.0),
            interval("unknown", "other", 120.0, 240.0),
            interval("ai", "ai", 300.0, 360.0),
        ];

        let timeline = Timeline::build(&raw, config);
        let total = total_seconds(&timeline.bridged);
        let evidence = timeline.evidence();

        assert_eq!(total, 120.0);
        assert_eq!(timeline.proven_seconds, 120.0);
        assert!((evidence.proven_seconds + evidence.inferred_seconds - total).abs() < 1e-6);
        assert!(
            (evidence.attended_seconds + evidence.agent_seconds + evidence.other_seconds - total)
                .abs()
                < 1e-6
        );
    }

    #[test]
    fn project_ai_ranges_keep_overlaps_hidden_by_canonical_editor_ownership() {
        let project_id = Uuid::new_v4();
        let mut human = interval("human", "editor", 0.0, 120.0);
        human.project_id = Some(project_id);
        human.project = Some("app".to_string());
        let mut ai = interval("ai", "ai", 60.0, 180.0);
        ai.project_id = Some(project_id);
        ai.project = Some("app".to_string());
        let timeline = Timeline::build(&[human, ai], BridgeConfig::single(900.0));

        assert_eq!(
            timeline.ai_ranges_for_project(project_id, Some("app")),
            vec![(60.0, 180.0)]
        );
        // Editor ownership wins the overlap in the canonical display stream, but it
        // must not erase the independently measured AI range.
        assert_eq!(timeline.bridged[0].source, "editor");
    }

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
            machine: "test".to_string(),
        }
    }

    #[test]
    fn browser_union_has_no_bridges_and_never_changes_coding_metrics() {
        let mut a = interval("browser-a", "browser_foreground_v1", 100.0, 160.0);
        a.category = "browsing".into();
        a.entity = "example.com".into();
        let mut b = a.clone();
        b.segment_id = "browser-b".into();
        b.heartbeat_id = "browser-b".into();
        b.start = 130.0;
        b.end = 190.0;
        let mut c = a.clone();
        c.segment_id = "browser-c".into();
        c.heartbeat_id = "browser-c".into();
        c.start = 400.0;
        c.end = 460.0;
        let coding = interval("code", "editor_active_v1", 120.0, 135.0);
        for bridge in [
            BridgeConfig::from(900.0),
            BridgeConfig {
                combined_v2: true,
                ..BridgeConfig::from(900.0)
            },
        ] {
            let before = Timeline::build(std::slice::from_ref(&coding), bridge);
            let after = Timeline::build(&[a.clone(), b.clone(), c.clone(), coding.clone()], bridge);
            assert_eq!(total_seconds(&after.browsing), 150.0);
            assert_eq!(after.active_seconds, before.active_seconds);
            assert_eq!(after.comparable_seconds, before.comparable_seconds);
            assert_eq!(
                total_seconds(&after.bridged),
                total_seconds(&before.bridged)
            );
        }
    }

    #[test]
    fn browser_union_is_clipped_at_query_boundaries() {
        let mut a = interval("browser", "browser_foreground_v1", 100.0, 160.0);
        a.category = "browsing".into();
        let timeline = Timeline::build_clipped(&[a], 900.0, 120.0, 150.0);
        assert_eq!(total_seconds(&timeline.browsing), 30.0);
        assert_eq!(total_seconds(&timeline.bridged), 0.0);
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

    #[test]
    fn agent_anchor_chain_switches_project_ownership_without_changing_total() {
        let mut first = anchor_at("first", "ai", 0.0);
        first.project = Some("alpha".to_string());
        let mut second = anchor_at("second", "ai", 60.0);
        second.project = Some("beta".to_string());
        let mut third = anchor_at("third", "ai", 120.0);
        third.project = Some("gamma".to_string());

        let bridged = bridge_by_attendance(Vec::new(), &[first, second, third], 900.0, 900.0);

        assert_eq!(total_seconds(&bridged), 120.0);
        assert_eq!(bridged.len(), 2);
        assert_eq!(bridged[0].project.as_deref(), Some("alpha"));
        assert_eq!((bridged[0].start, bridged[0].end), (0.0, 60.0));
        assert_eq!(bridged[1].project.as_deref(), Some("beta"));
        assert_eq!((bridged[1].start, bridged[1].end), (60.0, 120.0));
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
    fn each_anchor_owns_the_gap_after_its_project_switch() {
        let anchors = [
            ActivityInterval {
                project: Some("one".to_string()),
                ..anchor("one", 0.0)
            },
            ActivityInterval {
                project: Some("two".to_string()),
                ..anchor("two", 600.0)
            },
            ActivityInterval {
                project: Some("three".to_string()),
                ..anchor("three", 1_200.0)
            },
        ];

        let bridged = bridge_idle_gaps_with_anchors(Vec::new(), &anchors, 900.0);

        assert_eq!(bridged.len(), 2);
        assert_eq!(bridged[0].project.as_deref(), Some("one"));
        assert_eq!((bridged[0].start, bridged[0].end), (0.0, 600.0));
        assert_eq!(bridged[1].project.as_deref(), Some("two"));
        assert_eq!((bridged[1].start, bridged[1].end), (600.0, 1_200.0));
    }

    #[test]
    fn clipping_does_not_shorten_a_cross_boundary_idle_gap() {
        let raw = vec![anchor("before", -840.0), anchor("after", 840.0)];

        let timeline = Timeline::build_clipped(&raw, 900.0, 0.0, 86_400.0);

        assert_eq!(total_seconds(&timeline.bridged), 0.0);
    }

    #[test]
    fn clipping_keeps_the_in_range_part_of_a_real_session() {
        let raw = vec![anchor("before", -300.0), anchor("after", 300.0)];

        let timeline = Timeline::build_clipped(&raw, 900.0, 0.0, 86_400.0);

        assert_eq!(total_seconds(&timeline.bridged), 300.0);
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
            Dimension::Machine,
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

    /// Attribution must never change the headline clock. With equal human and agent
    /// timeouts, alternating editor/Codex anchors describe the same presence stream as
    /// WakaTime's source-agnostic builder; handover gaps may move into `other`, but no
    /// seconds may disappear from the total.
    #[test]
    fn mixed_source_anchors_match_wakatime_when_timeouts_are_equal() {
        let events = [
            (0.0, "editor"),
            (120.0, "editor"),
            (420.0, "ai"),
            (720.0, "editor"),
            (1_700.0, "ai"),
            (1_820.0, "ai"),
        ];
        let intervals = events
            .iter()
            .enumerate()
            .map(|(index, (at, source))| anchor_at(&format!("mixed-{index}"), source, *at))
            .collect::<Vec<_>>();
        let times = events.iter().map(|(at, _)| *at).collect::<Vec<_>>();

        let ours = total_seconds(&canonicalize_bridged(
            &intervals,
            BridgeConfig::split(900.0, 900.0),
        ));
        let reference = wakatime_reference(&times, 900.0);

        assert!(
            (ours - reference).abs() < 1e-6,
            "ours={ours}, reference={reference}"
        );
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

#[cfg(test)]
mod lifecycle_tests {
    use super::*;
    use crate::repository::heartbeat::HeartbeatRepository;

    #[tokio::test]
    #[ignore = "requires isolated ClickHouse via CLICKHOUSE_TEST_URL"]
    async fn corrections_and_deletions_override_stale_intervals_and_retries() {
        let ch = crate::test_support::clickhouse_client().await;
        let repo = HeartbeatRepository::new(ch.clone());
        repo.migrate().await.unwrap();
        let user = Uuid::now_v7();
        let other_user = Uuid::now_v7();
        let id = format!("lifecycle-{user}");
        let segments = serde_json::json!([{"segment_id":"old-segment", "start":1000.0, "end":1060.0, "source":"editor"}]).to_string();
        let seed = |owner, revision, data: String, seconds, time| {
            ch.get_client().query(
                "INSERT INTO wakaclock.heartbeats (user_id, entity, entity_type, time, dependencies, is_write, category,
                 editor, operating_system, machine, user_agent, is_ai_generated, created_at,
                 heartbeat_id, revision, activity_segments, active_seconds, actor_type, actor_confidence)
                 VALUES (?, 'a.rs', 'file', ?, [], 1, 'coding', 'vscode', 'test', 'test', 'test', 0, 1060, ?, ?, ?, ?, 'human', 1)"
            ).bind(owner).bind(time).bind(&id).bind(revision).bind(data).bind(seconds)
        };
        seed(user, 0u32, segments.clone(), 60.0, 1060.0)
            .execute()
            .await
            .unwrap();
        seed(other_user, 0u32, segments.clone(), 60.0, 1060.0)
            .execute()
            .await
            .unwrap();
        ch.get_client()
            .query(
                "INSERT INTO wakaclock.activity_intervals
            (user_id, segment_id, heartbeat_id, start, end, source, entity, category, created_at)
            VALUES (?, 'old-segment', ?, 1000, 1060, 'editor', 'a.rs', 'coding', 1060)",
            )
            .bind(user)
            .bind(&id)
            .execute()
            .await
            .unwrap();
        let timeline = ActivityTimelineService::new(ch.clone(), BridgeConfig::single(0.0));
        let duration = |intervals: Vec<ActivityInterval>| {
            intervals.iter().map(|i| i.end - i.start).sum::<f64>()
        };
        assert_eq!(
            duration(timeline.intervals(user, 900.0, 1200.0).await.unwrap()),
            60.0
        );
        seed(user, 1u32, "[]".into(), 0.0, 1060.0)
            .execute()
            .await
            .unwrap();
        assert_eq!(
            duration(timeline.intervals(user, 900.0, 1200.0).await.unwrap()),
            0.0
        );
        let delayed_user = Uuid::now_v7();
        seed(delayed_user, 0u32, segments, 60.0, 2000.0)
            .execute()
            .await
            .unwrap();
        assert_eq!(
            duration(
                timeline
                    .intervals(delayed_user, 900.0, 1200.0)
                    .await
                    .unwrap()
            ),
            60.0
        );
        repo.delete_ids(user, std::slice::from_ref(&id))
            .await
            .unwrap();
        assert_eq!(
            repo.existing_heartbeat_revisions(user, std::slice::from_ref(&id))
                .await
                .unwrap()
                .get(&id),
            Some(&u32::MAX)
        );
        seed(user, 0u32, "[]".into(), 60.0, 1060.0)
            .execute()
            .await
            .unwrap();
        assert!(timeline
            .intervals(user, 900.0, 1200.0)
            .await
            .unwrap()
            .is_empty());
        assert_eq!(
            duration(timeline.intervals(other_user, 900.0, 1200.0).await.unwrap()),
            60.0
        );
    }
}
