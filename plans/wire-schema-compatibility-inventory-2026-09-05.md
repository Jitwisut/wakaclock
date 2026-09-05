# Wire/schema compatibility inventory

วันที่: 2026-09-05 · Task: [F0-06](ai-coverage-task-ledger.md) · สถานะ: inventory + sequencing decision; local F1 storage slice now implemented

Depends on [F0-05](design-canonical-operation-and-revision-protocol.md).
Covers every wire/schema surface F0's work touched or that F1 will touch, per
execution-plan §6.3's field list. Cross-references
[ai-coverage-validation-plan.md](ai-coverage-validation-plan.md) §5's V-R
matrix, which already names the scenarios this inventory's findings map to.

## 1. The boundaries, and why they need different rules

There are three structurally different boundaries in this system, and
"server-first" only literally applies to one of them:

| Boundary | What crosses it | Same machine? | Strictness today |
| --- | --- | --- | --- |
| **A. Local wire**: hook script → `wakaclock` CLI stdin → broker inbox | `BrokerEventV1`, `GenericAiEventInput`, `LegacyAiEventInput` (JSON over stdin/local files) | Yes — hook, CLI, and broker daemon are three processes on the *same* machine, often three different binary/script versions if not all updated together | **Strict**: all three structs use `#[serde(deny_unknown_fields)]` |
| **B. CLI ↔ API**: `wakaclock-cli`/extensions → `POST /api/v1/heartbeats` etc. | `Heartbeat`/`HeartbeatRow`-shaped JSON over HTTPS | No — genuinely client/server | **Lenient**: no `deny_unknown_fields` found on `src/model/heartbeat.rs` or `crates/wakaclock-core/src/api_client.rs` — unknown fields are ignored, matching WakaTime-compatibility expectations |
| **C. API ↔ ClickHouse/Postgres** | SQL DDL/DML | No — server to datastore | **Additive-only by convention**: `migrate()` runs `IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS` on every boot (see [.context/data/migrations.md](../.context/data/migrations.md)) |

Boundary B and C already follow "old side tolerates new/absent fields," which
is what "server-first" rollout assumes. **Boundary A does not**, and it is
the one boundary that isn't client/server at all — there is no "server" to go
first. This is the inventory's main finding.

## 2. Finding: Boundary A's strict-everywhere parsing is a real version-skew hazard

Confirmed by reading the actual parse chain, not assumed:

- `broker.rs::BrokerEventV1` — `#[serde(deny_unknown_fields)]` (line 274).
- `wakaclock-cli/src/main.rs::GenericAiEventInput` — `#[serde(deny_unknown_fields)]`
  (line 602).
- `wakaclock-cli/src/main.rs::LegacyAiEventInput` — `#[serde(deny_unknown_fields)]`
  (line 709).
- `parse_broker_event_input` (`main.rs:3395`) tries all three in order — comment
  at line ~3410 states this is **deliberate**: *"Keep the old flat producer
  shape working without weakening the v1 HTTP contract. The fallback is still
  deny-unknown-fields."*

**Consequence, conditional on how the hook resolves its binary**:
`emit-event.sh` resolves the CLI it pipes to in this order (line 16-20):
`$WAKACLOCK_CLI_PATH` env var → `~/.wakaclock/cli-path` file contents →
bare `wakaclock` on `PATH`. None of these is guaranteed to be the exact same
binary version the hook script itself shipped with. The hook script's own
source is copied into a **version-pinned** directory per extension version
(`agentSetup.ts::syncAgentPluginsToStableDir`, `~/.wakaclock/agent-plugins/
<extensionVersion>`, chosen specifically so an already-registered agent
config keeps pointing at a stable path across extension upgrades) — but
`cli-path`/`PATH` resolution is a *separate* mechanism from that versioned
copy, and this repository already treats hook-vs-binary drift as a real,
anticipated failure mode: `main.rs`'s `CliPathReport`/`cli_identity_mismatch`
(`main.rs:2316-2324, 2428-2435`) exists specifically to detect "the binary a
hook would resolve to" differing from "the binary currently running,"
including a dedicated test fixture for a stale binary 8 days out of date with
no `broker` subcommand at all (`main.rs`, `doctor` test module, "found for
real on this machine's own `~/.cargo/bin/wakaclock`... on 2026-08-31").

**So the mechanism is real and already anticipated by this codebase, but
this inventory did not verify a live drop actually occurred** — that would
require tracing whether `cli-path`/agent-plugin-directory updates happen
atomically with hook-script updates in every install/update path, which is
out of scope for this pass. What *is* verified: if a hook script resolves to
a `wakaclock` binary built before `c4d36f5` (which added `editor` to
`BrokerEventV1`/`GenericAiEventInput`/`LegacyAiEventInput` and to
`emit-event.sh`'s own JSON output, already on `main`), every parse attempt
in `parse_broker_event_input` fails on the unrecognized `"editor"` key, and
`emit-event.sh`'s fail-open design (`|| true`, "hooks must always fail open
so telemetry cannot block an agent's edit") swallows that failure —
**the event would be silently dropped**, not queued, not retried, not
diagnosed, with no evidence left behind that it happened. This maps directly
to validation-plan **V-R13** ("old producer/new broker และ new producer/old
broker") and **V-R14** ("old client/new API และ new client/old API") — except
V-R14's framing assumes a client/server pair, and this is the
client-only-machine variant of the same failure mode neither V-R13's title
nor the execution plan's §6.3 line ("ห้ามส่ง field ใหม่ให้ binary รุ่นเก่า
เงียบ ๆ") currently distinguishes from the true client/server case. A V-R13
fixture (§2 of the ground-truth manifest already lists this as a Tier 1
candidate) would catch this class of regression before it ships, rather than
relying on this kind of after-the-fact code reading.

**Not fixed here** — F0 is inventory, not implementation. Recorded for F1-07
("Broker/server policy boundary และ compatibility projection ของ legacy
fields"), which already owns this compatibility surface. Two directions worth
weighing there, not decided by this document:
- Make Boundary A tolerant (drop `deny_unknown_fields` on the three structs,
  accept and discard unrecognized keys) — matches Boundary B's already-proven
  pattern, but loses the "quarantine anything shaped wrong" safety net
  `QuarantineDiagnostic` (`broker.rs:213-268`) currently provides for
  malformed/forbidden-content payloads on the same structs.
- Keep strictness but add a capability/version negotiation step before a
  newer hook script emits a new field (execution plan §6.3 already says
  "negotiate schema/capability ก่อน" as the alternative to tolerant parsing)
  — more precise, more implementation work.

## 3. Field-by-field inventory

Fields introduced or extended by F0's own work (the `editor` field) plus the
fields F0-05's revision design proposes, checked against the additive-safety
rule in [.context/data/migrations.md](../.context/data/migrations.md).

| Field/table | Boundary | Status | Additive-safe? | Owner | Consumer | Retention |
| --- | --- | --- | --- | --- | --- | --- |
| `BrokerEventV1.editor: Option<String>` | A | Shipped (`c4d36f5`, on `main`) | Nullable/`#[serde(default)]`, so *content*-wise additive — but Boundary A's strictness (§2) makes it **not** deploy-order-safe until hook/CLI/broker are all rebuilt together | client/core | `build_ai_heartbeat`/`broker_event_from_heartbeat` (editor attribution) | Same as the heartbeat row it rides on — no separate retention; not yet documented anywhere as a distinct policy |
| `GenericAiEventInput.editor` / `LegacyAiEventInput` (`into_generic`) | A | Shipped (`c4d36f5`) | Same caveat as above | client/core | Same | Same |
| `ALLOWED_EVENT_FIELDS` allowlist (+`"editor"`) | A (quarantine diagnostic) | Shipped (`c4d36f5`) | Yes — allowlist-only change, quarantine still correctly flags truly-unknown fields | client/core | `QuarantineDiagnostic::inspect` | N/A — compiled-in constant, not stored data |
| `heartbeats.revision` | C | Additive column implemented on `features/ai-coverage-f0-baseline` | Yes — trailing `UInt32 DEFAULT 0` with `ADD COLUMN IF NOT EXISTS`; old rows are implicitly revision 0 | backend | `HeartbeatRow`/reprocess readers now carry it; canonical-winner projection is F1-08 | 30 days for superseded rows; keep the current max revision — [retention policy](ai-coverage-retention-policy.md) |
| `event_aliases` table | C/local ledger slice | Local SQLite table and one-hop writer implemented; server table remains F1-05 | Yes — new table, additive create | `AiAttributionState::record_event_alias`; server canonical operation resolution remains | 30 days after `last_seen_at` — [retention policy](ai-coverage-retention-policy.md) |
| Materialized views summing `ai_lines_added`/`human_lines_added` (`mv_ai_summary`, `mv_inc_*`, per [.context/data/overview.md](../.context/data/overview.md)) | C | Existing | **Not yet additive-safe against revisions** — per F0-05 §4, once `revision` exists these must filter to `max(revision)` per canonical operation before summing, or they silently double-count corrected rows. This is the concrete instance of F0-05's named F1-08 consequence. | backend | Dashboard analytics (F6) | Follows existing rollup retention (undocumented here — out of this inventory's scope) |
| Postgres (`001_phase10_foundation.sql`) | — | N/A | **No F0/F1 field in this design lands in Postgres.** Postgres owns identity/access/org/OAuth/billing state ([.context/data/overview.md](../.context/data/overview.md)); attribution/revision data is ClickHouse-only. Sequence and downgrade semantics for Postgres are therefore **unchanged by this work** — stated explicitly so this isn't mistaken for an unreviewed gap. | — | — | — |

Retention is now explicit for the first implementation: 15 seconds of late
reconciliation grace, 24 hours for pending observations, and 30 days for superseded
revisions and aliases. The server projection and writer are still F1 work, but their
retention owner and default are no longer implicit.

## 4. Server-first sequence (Boundary B/C — the case it actually applies to)

For a schema change that only touches Boundary B (CLI↔API) and/or C
(API↔datastore) — e.g., adding the `revision` column and reading it in a new
API response field:

1. Ship the ClickHouse `migrate()` change first (idempotent `ADD COLUMN IF NOT
   EXISTS`), deployed with a new server binary. Old server binaries still
   running elsewhere are unaffected (they never look at the new column).
2. Confirm the new column is live (via `.context/data/migrations.md`'s
   existing convention: `migrate()` runs on every boot and aborts startup on
   failure — a failed migration is loud, not silent).
3. Only after the server is confirmed running with the new column can client
   code (CLI, extensions) start sending/expecting the new field. An older
   client that never sends it is unaffected (nullable/defaulted column).
4. Update the materalized views / aggregation queries identified in §3 to be
   revision-aware **before** any correction row can be written — a
   correction row landing before the query layer knows to pick
   `max(revision)` would double-count from the moment it's inserted, not
   just from the moment someone happens to run the old query.

## 5. Downgrade semantics

- **Boundary C (server ↔ ClickHouse)**: verified, not assumed, how reads
  actually decode rows — `repository/heartbeat.rs`'s own comment on its
  `get_by_date` query states it directly: *"Column order must match
  `HeartbeatRow` field order exactly — the client decodes positionally, so an
  omitted or reordered column misaligns every field after it rather than
  failing cleanly"* (`heartbeat.rs:612-613`). Every read in this repository
  uses an **explicit column list**, never `SELECT *` — confirmed by grep,
  zero matches against the heartbeats table. That means adding `revision` as
  a new trailing column is safe for any query that doesn't list it: an old
  binary's explicit column list is unaffected by a table gaining a column it
  never asks for, and nothing decodes positionally past the columns it
  actually requested. The real hazard this positional-decoding fact creates
  is different from a downgrade: **every explicit column list across every
  repository method that reads `HeartbeatRow` must independently stay in
  sync with `HeartbeatRow`'s Rust field order** — the SQL string and the
  struct are two places that must agree with nothing but code review holding
  them together. Adding `revision` to `HeartbeatRow` without adding it, in
  the same relative position, to every one of those SQL strings would
  silently misalign every field the query decodes after the insertion point
  — a bug this repo's own tooling cannot catch at compile time. This is a
  named risk for F1-06 to check exhaustively (every `fetch_all::<HeartbeatRow>()`
  call site, not just `get_by_date`) when it adds the column, independent of
  any client/server version-skew question.

  Separately, the *downgrade* question this section is actually about: a
  server binary rolled back to before `revision` existed keeps using its old
  explicit column list (which never mentions `revision`), so it structurally
  cannot see or be confused by it. What it **cannot** do is give a correct
  *answer* once a canonical operation has a real correction: its query logic
  has no `max(revision)` concept at all, so if any other, non-`heartbeats`
  aggregation path sums `ai_lines_added`/etc. directly (the materialized
  views named in §3) rather than reading through the revision-aware logic
  F1-08 adds, a downgraded server serves double-counted totals for any
  corrected operation until it's upgraded again. This is a genuine, named
  downgrade hazard — **not** solved by "additive migrations are safe," which
  only covers schema presence, not query correctness. F1-08 should treat
  "can this server binary be safely downgraded once revisions exist" as an
  explicit test case (candidate addition to the V-R matrix), not an
  assumption from the additive-column rule.
- **Boundary A (local wire)**: symmetric to §2 — downgrading the CLI/broker
  binary while hook scripts still emit newer fields reproduces the exact
  same silent-drop hazard, just in the other direction. Whatever F1-07
  chooses (tolerant parsing vs. negotiation) must handle both directions
  identically; there is no "old is always the server" asymmetry to lean on
  here.
- **Boundary B (CLI↔API)**: already downgrade-safe today by construction — no
  `deny_unknown_fields` on either side, `#[serde(default)]` throughout.

## 6. Migration ownership

| Surface | Owner (per CLAUDE.md role) | Change mechanism |
| --- | --- | --- |
| `BrokerEventV1`, `GenericAiEventInput`, `LegacyAiEventInput`, `ALLOWED_EVENT_FIELDS` | client/core | Edit the struct + allowlist in the same commit as any hook-script change; no separate migration step (compiled-in, not runtime-migrated) |
| ClickHouse `heartbeats`, `ai_*`, `mv_*` | backend | `migrate()` in the owning repository, called from `main.rs` in the fixed order documented in [.context/data/migrations.md](../.context/data/migrations.md) |
| PostgreSQL (Phase 10 state) | backend | Append to `001_phase10_foundation.sql`, idempotent | 
| API JSON response shapes (v1/v2) | backend | Additive field only; `docs/wakatime-compatibility-manifest.json` governs `/api/v1`, run `scripts/verify-compatibility-manifest.mjs` after editing |
| Hook scripts (`extensions/ai-agents/**`) | integration/release | Versioned via the extension/package bundle they ship in; no independent version negotiation exists yet (§2's open question for F1-07) |

## 7. Non-goals

- Does not implement the server-side correction writer, `event_aliases` ClickHouse
  table, canonical-winner projections, or any parsing-strictness change — these remain
  F1 (F1-05/F1-06/F1-07/F1-08). The additive `revision` column and local SQLite
  alias/revision ledger are the first implementation slice and are documented above.
- Does not decide tolerant-parsing vs. negotiation for Boundary A — flagged
  as an open F1-07 decision, not resolved here.
- Does not audit every existing field on `BrokerEventV1` for historical
  version-skew incidents — only the field F0's own work just shipped, which
  is the one this session can verify firsthand.
- Does not verify, for the Boundary A hazard in §2, whether any actual
  install/update path lets the hook script and CLI binary drift in practice
  — states the mechanism and cites this repo's own evidence that it treats
  the risk as real (`CliPathReport`), not a confirmed live incident.

## 8. F0 exit-gate status (honest answer, not assumed)

F0's own closing criterion (execution-plan §7) requires *"ทุก planned schema
field มี consumer/owner/retention"* — every planned schema field has a
consumer, owner, and retention policy. The retention decision is now recorded and
enforced by the local ledger, so this specific F0 gate is reviewable. F0 still has no
live ground-truth certification; implementation and server projection work continues
under F1.
