use clickhouse::Row;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// One group co-working session in one room (plan.md Phase 7.4). Group, not pairwise:
/// a session can gain participants over time (someone else drags in and joins the same
/// session) rather than spawning a new session per pair — see `services/coworking_session.rs`
/// for how that clustering decision is made.
///
/// `team_id` is copied from the room's `team_id` once, at session creation — it freezes
/// the label at the moment the session started rather than tracking the room's current
/// team assignment, so a session's label never silently changes after the fact.
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct CoworkingSessionRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub session_id: Uuid,
    #[serde(with = "clickhouse::serde::uuid")]
    pub room_id: Uuid,
    #[serde(with = "clickhouse::serde::uuid::option")]
    pub team_id: Option<Uuid>,
    #[serde(with = "clickhouse::serde::uuid::option")]
    pub zone_id: Option<Uuid>,
    pub source: String,
    pub ended_reason: String,
    pub started_at: u32,
    /// `None` means the session is still active — this is the field a query filters on
    /// to find "sessions currently in progress" (`ended_at IS NULL`).
    pub ended_at: Option<u32>,
    pub updated_at: u32,
    pub last_observed_at: u32,
}

/// One user's membership window within a session. Modeling membership as its own table
/// with `joined_at`/`left_at` — rather than a fixed participant list on the session row —
/// is what makes the group model work: people can join a session already in progress and
/// leave it while it continues for everyone else.
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct CoworkingParticipantRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub session_id: Uuid,
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    pub joined_at: u32,
    /// `None` means still an active participant.
    pub left_at: Option<u32>,
    pub updated_at: u32,
}

/// Read model for the personal history endpoint. Participant IDs are strings because
/// ClickHouse returns them from `groupArray(toString(...))`; the API resolves names through
/// PostgreSQL and never exposes another participant's project metadata.
#[derive(Debug, Clone, Serialize, Deserialize, Row)]
pub struct CoworkingHistoryRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub session_id: Uuid,
    #[serde(with = "clickhouse::serde::uuid")]
    pub room_id: Uuid,
    #[serde(with = "clickhouse::serde::uuid::option")]
    pub team_id: Option<Uuid>,
    #[serde(with = "clickhouse::serde::uuid::option")]
    pub zone_id: Option<Uuid>,
    pub source: String,
    pub ended_reason: String,
    pub started_at: u32,
    pub ended_at: Option<u32>,
    /// The authenticated viewer's own membership window inside the group session.
    /// This is intentionally separate from the session bounds because a person can join
    /// an existing session later or leave while the rest of the group keeps working.
    pub my_joined_at: u32,
    pub my_left_at: Option<u32>,
    pub participant_ids: Vec<String>,
}
