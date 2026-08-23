use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// One model request's token usage (plan.md 9.4).
///
/// `(user_id, usage_event_id)` is the logical identity. `usage_event_id` is the provider's own
/// message id, which is what makes ingest idempotent: re-sending a transcript re-sends the same
/// ids, and ReplacingMergeTree collapses them instead of double-counting tokens.
///
/// Timestamps are `u32` unix epochs to match every live table on this database (see
/// `model/project_identity.rs` for why the plan's `DateTime64(6)` is not what's used here).
#[derive(Debug, Clone, Serialize, Deserialize, clickhouse::Row)]
pub struct AiUsageEventRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    pub date: u16,
    pub usage_event_id: String,
    pub ai_session_id: String,
    pub event_time: u32,
    #[serde(with = "clickhouse::serde::uuid::option")]
    pub project_id: Option<Uuid>,
    pub ai_agent: String,
    pub ai_provider: Option<String>,
    pub ai_model: Option<String>,
    pub prompt_count: u32,
    /// Null means the provider did not report the figure — never zero (plan.md 9.4).
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cache_read_tokens: Option<u64>,
    pub cache_write_tokens: Option<u64>,
    /// Null whenever any component of the price is unknown, rather than a misleading zero.
    pub estimated_cost_microusd: Option<u64>,
    /// The catalog version the cost was computed from, so a later price change cannot silently
    /// rewrite history (plan.md 9.4).
    pub pricing_version: Option<String>,
    /// Provenance of the token figures — see `wakaclock_core::ai::TokenSource`.
    pub token_source: String,
    pub version: u64,
    pub received_at: u32,
    /// Nullable so old transcript imports remain distinguishable from a measured zero.
    pub prompt_character_count: Option<u64>,
}

/// A coding session as the agent itself identifies it (plan.md 9.4).
///
/// Session counts come from distinct `ai_session_id` values, never from heartbeat counts.
#[derive(Debug, Clone, Serialize, Deserialize, clickhouse::Row)]
pub struct AiSessionRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    pub ai_session_id: String,
    pub started_at: u32,
    pub ended_at: Option<u32>,
    pub ai_agent: String,
    pub ai_provider: Option<String>,
    /// Null for a multi-model session unless a distribution is also available — plan.md 9.4
    /// forbids arbitrarily picking the last model. On real transcripts half of all sessions are
    /// multi-model, so null here is the common case rather than an edge case.
    pub primary_model: Option<String>,
    pub ai_client: Option<String>,
    pub editor: Option<String>,
    pub machine: Option<String>,
    pub operating_system: Option<String>,
    pub prompt_count: u64,
    pub version: u64,
    pub updated_at: u32,
}

/// Which projects a session touched (plan.md 9.4).
///
/// Deliberately carries no token or cost columns. Allocation rule 5 forbids copying a session
/// total onto every linked project, and rule 4's stated recommendation is to leave tokens
/// unattributed rather than imply a precision the data does not support.
#[derive(Debug, Clone, Serialize, Deserialize, clickhouse::Row)]
pub struct AiSessionProjectRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    pub ai_session_id: String,
    #[serde(with = "clickhouse::serde::uuid")]
    pub project_id: Uuid,
    pub first_event_at: u32,
    pub last_event_at: u32,
    pub event_count: u64,
    pub ai_lines_changed: u64,
    /// Records how the projects were attached, so a later, better allocation can be distinguished
    /// from this one without guessing.
    pub token_allocation_method: String,
    pub version: u64,
}

/// A time-versioned price for one provider/model (plan.md 9.5).
///
/// Money is integer micro-USD per million tokens — never a float, and never a rate scraped at
/// request time. Input, output, cache-read and cache-write are kept separate because providers
/// bill them at genuinely different rates.
#[derive(Debug, Clone, Serialize, Deserialize, clickhouse::Row)]
pub struct AiModelPricingRow {
    pub provider: String,
    pub model: String,
    pub effective_from: u32,
    /// Null means "still current". A price change closes the old row and opens a new one, so a
    /// historical event keeps pricing at the rate that applied when it happened.
    pub effective_to: Option<u32>,
    pub input_microusd_per_million: u64,
    pub output_microusd_per_million: u64,
    pub cache_read_microusd_per_million: Option<u64>,
    pub cache_write_microusd_per_million: Option<u64>,
    pub currency: String,
    pub pricing_version: String,
    pub updated_at: u32,
}

/// What an ingest call did. Reported rather than inferred, so a client can tell "already had it"
/// from "stored it" — the two are indistinguishable from a bare success.
pub use wakaclock_core::ai::AiUsageIngestReport;
