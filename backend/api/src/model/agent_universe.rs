use serde::Serialize;

use crate::model::date_range::RangeInfo;

pub const AGENT_UNIVERSE_SCHEMA_VERSION: u32 = 1;
pub const AGENT_UNIVERSE_MAX_RANGE_DAYS: i64 = 92;
/// A refused range stays honest; a truncated one would shrink every agent silently.
pub const AGENT_UNIVERSE_MAX_ROWS: usize = 50_000;
pub const AGENT_UNIVERSE_MAX_PROJECTS: usize = 12;
pub const AGENT_LIVE_SCHEMA_VERSION: u32 = 1;
/// How far back the live view looks. This is "latest activity", not a stream.
pub const AGENT_LIVE_WINDOW_SECONDS: u32 = 900;
/// A client clock this far ahead still counts, pinned to the server's now. Further ahead is
/// excluded so a wrong clock cannot keep an agent "live" for days.
pub const AGENT_LIVE_FUTURE_SLACK_SECONDS: u32 = 300;
pub const AGENT_LIVE_MAX_ROWS: usize = 200;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CostStatus {
    Complete,
    /// Some events have no price, so `cost_microusd` is a lower bound.
    Partial,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UniverseAgent {
    pub cost_microusd: Option<u64>,
    pub cost_status: CostStatus,
    pub events: u64,
    pub model: Option<String>,
    pub name: String,
    /// `None` when the agent reported no prompts: its transcripts may not carry them.
    pub prompts: Option<u64>,
    pub sessions: u32,
    pub tokens: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UniverseProject {
    /// On the shared "other" planet: the ids of the projects folded into it, so live activity
    /// lands there only for a project that is really part of it.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub folded_keys: Vec<String>,
    pub key: String,
    pub name: String,
    pub sessions: u32,
    pub tokens: u64,
}

/// One hour of one session on one project. Indexes point into the response arrays, so a raw
/// session identifier never leaves the service.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UniverseActivity {
    pub agent: usize,
    pub hour: u32,
    pub project: usize,
    pub session: u32,
    pub tokens: u64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct UniverseCoverage {
    pub events: u64,
    pub events_with_inferred_project: u64,
    pub events_without_project: u64,
    pub last_event_at: Option<u32>,
    pub projects_total: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentUniverseResponse {
    pub activity: Vec<UniverseActivity>,
    pub agents: Vec<UniverseAgent>,
    pub coverage: UniverseCoverage,
    pub projects: Vec<UniverseProject>,
    pub range: RangeInfo,
    pub schema_version: u32,
}

/// One agent seen on one project in the live window. No path, entity or session id.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LiveAgentActivity {
    pub agent: String,
    pub heartbeats: u64,
    /// The latest heartbeat time, never later than `server_time`.
    pub last_seen_at: u32,
    pub model: Option<String>,
    /// The project's id, matching `UniverseProject::key`, or `unassigned`.
    pub project_key: String,
    pub project_name: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct LiveCoverage {
    /// Heartbeats stamped after `server_time` by a fast client clock, shown at `server_time`.
    pub future_heartbeats: u64,
    pub heartbeats: u64,
    pub heartbeats_without_project: u64,
    /// Agent heartbeats whose identity is not confirmed. Their agent name is not shown, as
    /// everywhere else heartbeats are read back.
    pub unverified_heartbeats: u64,
    /// More agent and project pairs were active than the response carries.
    pub truncated: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgentLiveResponse {
    pub activity: Vec<LiveAgentActivity>,
    pub coverage: LiveCoverage,
    pub schema_version: u32,
    pub server_time: u32,
    pub window_seconds: u32,
}
