# AI coverage — retention policy for attribution history

วันที่: 2026-09-05 · Scope: F1-05/F1-06 local durable slice

This policy resolves the retention gap recorded by F0-06. The values are explicit
defaults for the first implementation; F0-07/F1 benchmark work may tune them later,
but a migration must not leave them implicit.

| Data | Owner / consumer | Retention | Rule |
| --- | --- | ---: | --- |
| Late-reconciliation pending observation | F1 pending store; reconciliation worker | 24 hours | Must outlive the 15-second grace window. An observation is kept until it is reconciled or expires. |
| Superseded attribution revision | `AiAttributionState` now; server revision repository in F1-06 | 30 days after its row was superseded | Delete only rows below the current max revision. The current winner is retained even when old. |
| Event alias mapping | `AiAttributionState` now; server `event_aliases` repository in F1-05 | 30 days after `last_seen_at` | Keep one direct hop from alias event to a real producer event. Never resolve an alias chain. |
| Delivered-event dedup IDs | Existing local state | 30 days | Existing policy; separate from attribution corrections. |

The grace window is **15 seconds**. A late event inside that window may still be
handled by the pending reconciliation path. Evidence arriving later can create a
revision only when it has direct alias proof or a stable observation ID; time and line
delta similarity alone never creates an alias.

The local implementation lives in
[`wakaclock-core/src/ai/revision.rs`](../backend/api/crates/wakaclock-core/src/ai/revision.rs)
and [`wakaclock-core/src/ai/state.rs`](../backend/api/crates/wakaclock-core/src/ai/state.rs).
`AiAttributionState::append_attribution_revision` stores full-value correction rows
with an idempotent `payload_hash`; `latest_attribution_revision` is the canonical-winner
read (`max(revision)`); `prune_attribution_history` removes only superseded revisions
and stale aliases. Revision validation also keeps measured active seconds and total
line counts invariant while allowing lines to move between human, AI and unattributed
buckets. The SQLite schema is additive, so existing databases are upgraded
by `CREATE TABLE IF NOT EXISTS` without rewriting old delivery state.

The server-side ClickHouse `heartbeats.revision` and `heartbeats_incoming.revision`
columns are now additive with default `0`, and `HeartbeatRow` plus reprocess reads
carry the field. Server correction writers, alias table, and canonical-winner
projection queries remain F1 work. Existing rows are implicitly revision `0` until a
correction writer lands. No live adapter or ground-truth pass is claimed by this policy.
