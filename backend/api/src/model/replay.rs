use serde::Serialize;
use uuid::Uuid;

use crate::model::analytics_explorer::{
    ExplorerAppliedFilters, ExplorerDurationSplit, ExplorerFilterOptions,
};
use crate::model::date_range::RangeInfo;
use wakaclock_core::heartbeat::ActorType;

pub const REPLAY_SCHEMA_VERSION: u32 = 1;
/// `build_timeline` is the cost of this endpoint and its sweep is O(n²), so replay keeps a
/// tighter window than the 366 days explorer accepts.
pub const REPLAY_MAX_RANGE_DAYS: i64 = 92;
/// A range over this limit is refused. Dropping segments instead would make the replay
/// total disagree with the canonical timeline without saying so.
pub const REPLAY_MAX_SEGMENTS: usize = 20_000;

/// Deliberately not `CanonicalInterval`: replay exposes no heartbeat, segment, machine or
/// file identity, and leaving `entity` out lets adjacent intervals coalesce.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ReplaySegment {
    pub start: f64,
    pub end: f64,
    pub project_id: Option<Uuid>,
    pub project: Option<String>,
    pub language: Option<String>,
    pub category: String,
    pub branch: Option<String>,
    pub actor_type: ActorType,
    pub source: String,
}

/// Context only. These windows are never part of `summary`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ReplayAiSession {
    pub start: f64,
    pub end: f64,
    pub agent: String,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReplayAiSessionsStatus {
    Available,
    /// `ai_sessions` has no proven project or language, so it cannot honour a filter.
    Filtered,
    NotPermitted,
}

#[derive(Debug, Serialize)]
pub struct ReplayResponse {
    pub ai_sessions: Vec<ReplayAiSession>,
    pub ai_sessions_status: ReplayAiSessionsStatus,
    pub applied_filters: ExplorerAppliedFilters,
    pub filter_options: ExplorerFilterOptions,
    pub generated_at: String,
    pub range: RangeInfo,
    pub schema_version: u32,
    pub segments: Vec<ReplaySegment>,
    pub summary: ExplorerDurationSplit,
}
