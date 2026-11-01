use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A refused range stays honest; a truncated one would hide the latest events.
pub const TEAM_REPLAY_MAX_EVENTS: usize = 2_000;
pub const TEAM_REPLAY_MAX_ITEMS: usize = 1_000;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReplayEventsQuery {
    pub start: String,
    pub end: String,
    pub timezone: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReplayEventKind {
    PrOpened,
    PrReady,
    PrFirstReview,
    PrMerged,
    PrClosed,
    CiSuccess,
    CiFailure,
    CiCancelled,
}

/// Metadata only: GitHub titles, bodies, reviewers and check names never reach replay.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ReplayEvent {
    pub id: String,
    pub at: f64,
    pub kind: ReplayEventKind,
    pub number: i32,
    pub project_ids: Vec<Uuid>,
    pub repository: String,
    pub url: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReplayEventsStatus {
    Available,
    /// Authorship is matched on a verified GitHub identity, never on a name or email.
    IdentityRequired,
}

#[derive(Debug, Serialize)]
pub struct ReplayEventsResponse {
    pub events: Vec<ReplayEvent>,
    pub status: ReplayEventsStatus,
    /// Pull requests whose timeline detail has not been confirmed by a sync yet.
    pub unconfirmed_items: usize,
}

#[derive(Debug, Clone)]
pub struct ReplayWorkItem {
    pub repository_id: Uuid,
    pub external_id: i64,
    pub number: i32,
    pub head_sha: Option<String>,
    pub opened_at: DateTime<Utc>,
    pub ready_at: Option<DateTime<Utc>>,
    pub first_review_at: Option<DateTime<Utc>>,
    pub merged_at: Option<DateTime<Utc>>,
    pub closed_at: Option<DateTime<Utc>>,
    pub lifecycle_coverage: String,
    pub repository: String,
    pub project_ids: Vec<Uuid>,
}

#[derive(Debug, Clone)]
pub struct ReplayCheckFact {
    pub repository_id: Uuid,
    pub external_id: i64,
    pub occurred_at: DateTime<Utc>,
    pub metadata: Value,
}
