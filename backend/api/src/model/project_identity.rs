use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A project's stable server-side identity (plan.md 9.3).
///
/// `project_id` is what URLs, ownership checks and analytics dimensions key off, so it has
/// to survive everything a display name does not: renames, merges, duplicate names and
/// characters that are unsafe in a path. The name a client sends is treated as input to
/// resolution, never as identity.
///
/// Timestamps are `u32` unix epoch seconds rather than the `DateTime64(6)` the plan sketches.
/// That is deliberate: every live table on this database uses `UInt32` (see
/// `heartbeats.created_at` and `project_merges.created_at`), because the repository
/// `migrate()` calls — not `migrations/001_init.sql` — are what actually built the schema.
/// Matching the live convention matters more than matching the sketch.
#[derive(Debug, Clone, Serialize, Deserialize, clickhouse::Row)]
pub struct ProjectIdentityRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    #[serde(with = "clickhouse::serde::uuid")]
    pub project_id: Uuid,
    /// The merge-resolved name this identity was minted from. Stable; changing it would
    /// fork the project, which is what `project_aliases` exists to prevent.
    pub canonical_name: String,
    /// What the UI shows. Free to change without breaking links or history.
    pub display_name: String,
    pub repository: String,
    /// Privacy-safe stand-in for "where this project lives" — never a raw absolute path,
    /// which plan.md 9.3 forbids exposing as a public identifier.
    pub root_fingerprint: String,
    pub first_heartbeat_at: u32,
    pub last_heartbeat_at: u32,
    pub created_at: u32,
    pub updated_at: u32,
    /// ReplacingMergeTree version column: the newest write for a `(user_id, project_id)`
    /// wins, so re-resolving an existing project updates rather than duplicates it.
    pub version: u64,
}

/// A historical name that resolves to a canonical `project_id`.
///
/// Aliases are the reason a rename or a merge does not orphan history: the old name keeps
/// resolving to the same identity, so old URLs redirect and previously-recorded rows stay
/// attached to the project they belong to.
#[derive(Debug, Clone, Serialize, Deserialize, clickhouse::Row)]
pub struct ProjectAliasRow {
    #[serde(with = "clickhouse::serde::uuid")]
    pub user_id: Uuid,
    /// The name as it was seen on the way in, before merge resolution.
    pub alias: String,
    #[serde(with = "clickhouse::serde::uuid")]
    pub project_id: Uuid,
    pub created_at: u32,
    pub updated_at: u32,
}

/// One row of the backfill dry-run: what PR 9.9 would assign to an existing project name,
/// and how much history hangs off it. Reported only — the dry-run never writes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackfillPreviewItem {
    /// The `project` value as stored on existing heartbeats.
    pub project: String,
    /// What that name resolves to after following merges.
    pub canonical_name: String,
    /// The identity the name would be attached to.
    pub project_id: Uuid,
    /// True when the merge mapping would move this name onto another project's identity.
    pub is_merged: bool,
    /// True when the identity already exists, so the backfill would attach rather than mint.
    pub identity_exists: bool,
    pub heartbeat_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackfillPreview {
    /// Distinct project names found on heartbeats that have no `project_id` yet.
    pub unresolved_projects: usize,
    /// Heartbeats those names account for.
    pub unresolved_heartbeats: u64,
    /// Identities the backfill would have to create.
    pub identities_to_create: usize,
    pub items: Vec<BackfillPreviewItem>,
}

/// Raw aggregation row behind the dry-run. Kept separate from the reported item because the
/// resolution (merges, ids) happens in the service, not in SQL.
#[derive(Debug, Clone, Serialize, Deserialize, clickhouse::Row)]
pub struct UnresolvedProjectRow {
    pub project: String,
    pub heartbeat_count: u64,
}
