# Design — canonical operation, aliases, revision and correction protocol

วันที่: 2026-09-05 · Task: [F0-05](ai-coverage-task-ledger.md) · สถานะ: design record; F1 local storage slice now implements the core rules

The design record below remains the protocol decision and worked-example source of
truth. F1 has since selected initial operational defaults (15-second grace, 24-hour
pending observations, 30-day superseded-revision and alias retention) and implemented
the local SQLite ledger in [`ai/revision.rs`](../backend/api/crates/wakaclock-core/src/ai/revision.rs)
and [`ai/state.rs`](../backend/api/crates/wakaclock-core/src/ai/state.rs). Those values
are still benchmark-tunable; the server writer and projections remain F1 work.

Depends on [F0-03](decision-unknown-authorship-vs-unattributed-ai.md) and
[F0-04](../docs/vscode-human-input-capability-spike-2026-09-05.md), both closed.
Elaborates [ai-coverage-execution-plan.md](ai-coverage-execution-plan.md) §6.3
("Identity และ versioning") and §6.4 ("Editor buffering และ late evidence"),
which already state the rules this document turns into a concrete protocol.
This is what unblocks the two F0-02 scenarios deferred in
[ai-coverage-progress.md](ai-coverage-progress.md) (delayed sidecar, mixed
human+AI edits) — F1-05/F1-06/F1-09 implement what's designed here.

## 1. What already exists (do not redesign this)

Three primitives already implement part of §6.3/§6.4, in
`backend/api/crates/wakaclock-core/src/`:

- **Stable per-producer event ID**: `ai/event.rs::opaque_file_event_id(prefix,
  operation_id, raw_path)` hashes a producer's own operation ID + the file
  path into a UUIDv5. Same input → same ID on retry; two files touched by one
  tool call get distinct IDs. `broker.rs::normalize()` (line 437-441) applies
  this to any incoming `event_id` that isn't already `is_safe_event_id`
  (opaque, ≤128 chars, no path-shaped content). This is producer-local
  stability, not yet cross-producer.
- **Evidence ranking**: `broker.rs::evidence_rank_key` /
  `evidence_supersedes` / `strongest_evidence` (lines 337-389) already rank
  competing evidence for "the same logical change" by transport class →
  source → self-asserted confidence → recency. This is the *selection*
  algorithm a canonical operation needs when more than one producer reports
  the same edit — it exists, it just isn't wired to a persistent
  cross-producer identity yet (§3).
- **Single-pass editor correlation**: `ai/correlation.rs::correlate()` matches
  one `EditorObservation` (a flushed buffer window) against a pool of pending
  `AiEditEvent`s by entity + a 5-second window, returns `AiMatch` /
  `PartialAiMatch` / `Unattributed`. This is a **synchronous, one-shot**
  decision at flush time — it has no notion of revisiting an `Unattributed`
  result later when strong evidence shows up after the flush. That gap is
  exactly what §4 (revision) below designs.

No "attribution revision" concept exists anywhere in the codebase today
(checked: the only `revision` hits are `head_revision`, a Git commit SHA,
unrelated). F1-06 is genuinely new work, not a partial implementation to
extend.

## 2. Canonical operation ID

**Definition**: the canonical operation ID identifies one real-world file
mutation, independent of how many producers reported it or how many times a
retry resent it.

**Construction rule**: for a single producer, the canonical operation ID *is*
that producer's own stable `event_id` (already deterministic per §1). A
canonical operation gains no new ID of its own until a second producer's event
is proven to describe the same mutation (§3) — at that point the canonical ID
is the `event_id` of whichever event ranks strongest under
`evidence_rank_key`, and the other event(s) become aliases of it (§3). This
avoids minting a third, parallel ID space: the canonical ID is always a real
`event_id` that already exists, never a synthetic UUID nobody stored a
producer's own evidence under.

**Multi-file operations**: an agent's single tool call touching N files
already produces N distinct `event_id`s via `opaque_file_event_id`'s
`raw_path` input (confirmed by the existing test
`an_ai_edit_touching_fifty_files_is_captured_once_per_file`,
`broker_process.rs`/`broker.rs` test suite). A canonical operation is always
**one file's** mutation — "multifile" is N canonical operations sharing one
`operation_id`/`tool_event_id`, not one canonical operation spanning files.
Worked example in §5.3.

## 3. Aliases (cross-producer identity)

**Rule** (already stated in §6.3, formalized here): two events from different
producers become aliases of the same canonical operation only when they share
*proof*, not proximity — a matching native tool-call ID/session AND file
identity/version, never "same file within N seconds and similar line delta"
alone (execution plan D07 already forbids exactly that heuristic).

**Concrete proof shapes**, ranked by how directly they establish identity:
1. Same `tool_event_id`/`session_id` pair reported by two producers for the
   same `entity` (e.g. a native hook and an MCP bridge both observing the
   same tool call) — direct proof, safe to alias unconditionally.
2. Same `entity` + a file-content-version signal both producers independently
   captured (e.g. a git blob hash or mtime+size tuple neither producer could
   have guessed) — direct proof.
3. Anything weaker (time proximity, line-delta similarity) is **not** alias
   proof. It stays two separate canonical operations, or — if one clearly
   supersedes the other under `evidence_rank_key` for what looks like the
   same edit without ID proof — it is a **correction candidate** (§4), not an
   alias. The distinction matters: an alias means "these are definitely the
   same event, keep one." A correction candidate means "these might describe
   the same real-world edit, but we cannot prove it, so treat the second one
   as new evidence about the operation the first one already recorded — never
   silently merge line counts from an unproven guess."

**Gap, checked, not assumed**: proof shapes 1 and 2 both require the
*editor-buffer* side to carry something an AI producer could independently
reproduce. Checked what the editor observation actually captures today
(`extensions/vscode/src/buffer.ts`, `clipboardTracking.ts`): `TextDocument.
version` is used (`clipboardTracking.ts:90,114`), but it is VS Code's own
in-process counter — no AI producer (a shell hook, a transcript reader) can
see or reproduce it, so it cannot serve as shape 2's "both producers
independently captured" signal. No content hash or mtime+size tuple is
computed on the editor side at all (that exists only on the CLI side, in
`tool_snapshot.rs`, for a different purpose — snapshotting file state around
a tool call, never sent to or compared against the editor extension). **So
today, an editor-flushed observation has zero available alias-proof against a
later AI event, by either shape.** This is not a flaw in this design; it is
an honestly-reported capability gap the design cannot paper over. See the
consequence for the "delayed sidecar" scenario in §5.1, and the
recommendation for F1: capture a comparable content-version signal (e.g. a
lightweight hash of the post-edit buffer content, or the same `size:mtime`
shape `filesystem_observer.rs:589`/`main.rs:4499` already use elsewhere) on
*both* the editor flush and the AI producer's own file write, so shape 2
becomes available for this specific pairing.

Proof shape 1, by contrast, **is** fully available today between two
*AI-producer-side* events (e.g. a native hook and a transcript reader both
describing the same tool call) — both can carry the same `tool_event_id`/
`session_id` on their own `BrokerEventV1` fields, independent of anything the
editor observes. §5.1 uses this case, not the editor-pairing case, because it
is the one this design can actually deliver without new capability work.

**Storage shape** (design, not yet built): an `event_aliases` mapping —
`(alias_event_id, canonical_event_id, proof_kind)` — populated only when a
rule in the list above fires. The canonical event's own row is never mutated
by adding an alias; aliasing is additive, and `canonical_event_id` always
resolves through zero or one hop (an alias never points to another alias).

## 4. Revision protocol (the new piece)

**Problem this solves**: `correlate()` (§1) makes an irrevocable decision at
flush time. If the true AI evidence for a file's edit arrives 20 seconds
*after* the editor already flushed that window as `Unattributed` (or
`unknown`, per D06), today there is no path back to that decision. The
execution plan (§6.4.7) requires exactly this path: *"ถ้า strong late evidence
มาภายหลัง ต้อง reconcile ก่อน claim ownership ซ้ำ"*.

**Design**:

- A canonical operation's attribution decision is a **revision**, numbered
  from 0. Revision 0 is whatever `correlate()` (or the doctor/backend
  equivalent) decided at flush time — including `Unattributed`/`unknown`.
- A later revision is created **only** when new evidence meets the alias-proof
  bar in §3, or when a previously-`Unattributed` observation's stable
  observation ID (§6.4.6's "unknown ที่มี stable observation ID") is matched
  by an AI event that arrives after the grace period. A revision is never
  created by re-running the same correlation logic against the same inputs —
  only new evidence triggers one.
- **A revision corrects a classification; it never adds new activity.** The
  observed `human_lines_added`/`human_lines_deleted`/`active_seconds` on the
  original observation are fixed at flush time (per §6.4.2, these are
  recorded before attribution is known) and are never re-measured. A
  revision only changes which bucket (human / AI-named / Unattributed AI /
  unknown) those already-measured numbers are currently assigned to.
- **Storage and the one valid read shape.** The `heartbeats` ClickHouse table
  is a plain `MergeTree()` ordered by `(user_id, date, time)`
  (`repository/heartbeat.rs:111-112`) — append-only, no engine-level
  replace-by-key. Per the duration-accuracy audit's own Finding 5 (still
  open), `ALTER TABLE ... DELETE` is the wrong tool here (leaves materialized
  views stale). The revision protocol therefore does **not** rewrite the
  original row; it appends a correction row for the same canonical
  `event_id`/`heartbeat_id` with a `revision` counter (new column, F1-06 to
  add).

  The correction row carries the **same full `human_lines_added`/
  `human_lines_deleted`/`active_seconds` values as the row it corrects**, not
  a zero or a delta, under the new `actor_type`. This is a deliberate choice
  between two options that are not both usable at once:

  - **(a) Full-value correction, `max(revision)`-only reads** — a correction
    row repeats the full measured activity under the new label. Reading
    `sum()` across *all* revisions of an operation double-counts (revision 0's
    10 lines plus revision 1's 10 lines = 20). The only valid read is
    "per canonical operation, keep the row with `max(revision)`, discard the
    rest" — which matches the execution plan's own §5 architecture label,
    "Canonical changes + attribution revisions" feeding "Canonical timeline /
    projections," i.e. a canonical-winner selection, not a sum.
  - **(b) Delta-only correction, `sum()`-only reads** — a correction row
    carries −10 under the old label and +10 under the new one; summing all
    revisions gives the right answer, but no single row holds "the" current
    truth, so `max(revision)` alone is meaningless.

  **This design picks (a).** It matches D12's "server-first, additive
  migration, do not rewrite raw history" framing more directly, and it keeps
  each stored row human-readable on its own (a support engineer looking at
  one row sees a complete, self-consistent classification, not half of a
  delta pair). **Consequence, stated plainly so F1-08 doesn't have to
  rediscover it**: every existing materialized view or aggregation query that
  currently sums `ai_lines_added`/`human_lines_added`/etc. directly off the
  `heartbeats` table must be changed to pick the max-revision row per
  canonical operation *before* summing, once any row can have more than one
  revision. Until F1-06 ships the `revision` column, every row is implicitly
  revision 0 and today's plain `sum()` queries remain correct by
  construction — this only becomes a required change at the moment
  corrections start being written, and F1-08 owns making that change to the
  same query surfaces this ADR's §2/§3 already touched
  (`ai_stats.rs::fetch_agents` and its siblings).
- **Idempotency under retry**: resending the same correction (e.g. after a
  network retry) must not advance `revision` again. The correction's own
  content hash (`payload_hash()`, already implemented at
  `broker.rs:517-520`) is the dedup key — a resent correction with the same
  hash as the last stored revision for that canonical operation is a no-op,
  not a new revision.

## 5. Worked examples

### 5.1 Late event

This uses the AI-side proof case (§3's shape 1, available today), not an
editor↔AI pairing — §3 already establishes the editor side has no usable
proof against a later AI event yet. It also shows why the *editor-buffer*
delayed-sidecar scenario from F0-02 stays deferred.

1. `t=0s`: a native hook fires for an edit to `agent.rs`, reporting
   `tool_event_id="call-9"`, `agent="claude-code"`, `lines_added=14`,
   `lines_deleted=3`, but — because the hook's own environment could not
   resolve a session identity at fire time — no verified session binding.
   `resolve_attribution` accepts it as `actor_type=ai_inferred` (agent name
   known, confidence not high enough for `ai_verified`). Stored as revision 0
   of canonical operation `event_id=E1`: `agent=claude-code, lines_added=14,
   lines_deleted=3, actor_type=ai_inferred`.
2. `t=45s`: the same tool call's transcript is finally parsed (transcript
   reads lag live hooks by design — `broker.rs`'s own comment on
   `event_from_ai_edit`: "Transcript discovery is async/replayed, minutes or
   longer after the edit"). The transcript-derived event carries the same
   `tool_event_id="call-9"` and the same `entity`, plus a verified session ID
   the transcript format always includes.
3. Same `tool_event_id` + same `entity` is §3's proof shape 1 — a direct
   alias, not a guess. `evidence_rank_key` ranks the transcript event's
   `AiConfidence::Verified` (from the session ID) above the hook's original
   `Inferred`, so it wins. A revision 1 is written for canonical operation
   `E1`, **repeating the same measured values** under the stronger
   classification: `agent=claude-code, lines_added=14, lines_deleted=3,
   actor_type=ai_verified`. Revision 0's row is left as written (append-only)
   but is no longer the max-revision row for `E1`.
4. **Before** (query at `t=30s`, only revision 0 exists): the canonical-winner
   read for `E1` returns `ai_inferred, lines_added=14`. **After** (query at
   `t=60s`): the canonical-winner read for `E1` returns `ai_verified,
   lines_added=14` — the same 14 lines, now attributed with verified
   confidence instead of inferred. No query ever double-counts to 28, because
   every read is "max-revision per `event_id`," never a plain `sum()` (§4).
5. **What this example does not solve**: if `agent.rs` had instead been open
   in an editor whose buffer flushed at `t=2s` with no AI evidence yet
   in the pending pool, `correlate()` would return `Unattributed` for that
   editor observation, and — per §3's stated gap — there is no proof shape
   available today to alias that editor observation to either of `E1`'s
   revisions above; the hook/transcript events describe the *file* mutation
   from the AI-producer side, and the editor observation has no
   content-version signal in common with them. That editor-side observation
   stays `unknown` under this design until F1 adds the shared content-version
   capability named in §3. This is exactly why F0-02's "delayed sidecar"
   fixture (the VS Code-side scenario) remains deferred past F0-05: the
   revision *mechanism* is now designed, but this specific pairing needs a
   capability this design doesn't have yet to invoke it.

### 5.2 Retry

1. A broker event for `b.ts` is posted, accepted, and a revision is written.
2. The network drops the ack; the CLI's outbound queue retries the same
   event.
3. `payload_hash()` on the retried payload matches the already-stored
   revision's hash exactly (same canonical operation, same evidence, nothing
   new). Per §4's idempotency rule, this is a no-op: no revision 2 is
   created, no line/time delta is added.
4. **Before and after**: identical. This is the existing
   `batch_deduplicates_repeated_ids_without_double_inserting` /
   `claim_process_and_retry_state_survives_reopen` guarantee at the broker
   layer (already tested, `broker.rs` test suite) extended one level up to
   the revision layer — the new requirement is that the *revision* counter,
   not just the inbox row, treats a byte-identical retry as a no-op.

### 5.3 Multifile

1. One agent tool call rewrites `x.ts`, `y.ts`, and `z.ts` in a single
   operation (`tool_event_id = "call-42"`).
2. Per §2, this produces three canonical operations — one per file — each
   with its own `event_id` derived from `opaque_file_event_id("...", "call-42",
   raw_path)`, so `x.ts`'s and `y.ts`'s IDs differ even though they share
   `tool_event_id`.
3. Each file's editor observation (if any editor has it open) correlates
   independently against its own file's pending AI events — `correlate()`
   already filters candidates by `entity` (`ai/correlation.rs`, candidate
   filter on `to_comparable_string(&event.entity) == target_entity`), so one
   file's match can never consume another file's evidence.
4. **Before**: if only `x.ts` is open in an editor and flushes before the
   tool call's events land, `x.ts` reads `Unattributed` (revision 0) while
   `y.ts`/`z.ts` (never observed as human activity, no editor open) go
   straight to a correct `ai_inferred` classification with no revision
   needed. **After** `x.ts`'s late event arrives: only `x.ts` gets a revision
   1, correcting just that file's bucket. `y.ts`/`z.ts` are untouched —
   multifile does not mean one revision decision applies to every file in the
   batch.

## 6. Mapping to F1 tasks

| Piece designed here | Already exists | Net-new for F1 |
| --- | --- | --- |
| Canonical operation ID (§2) | `opaque_file_event_id`, `is_safe_event_id` | Formal rule that the canonical ID is always a real producer `event_id`, never a synthetic third ID — F1-05 |
| Evidence selection among aliases (§3) | `evidence_rank_key`/`evidence_supersedes`/`strongest_evidence` | `event_aliases` storage + the proof-kind gate (only ID/session/version proof, never time+line-delta) — F1-05 |
| Revision counter + correction row shape (§4) | Nothing | New `revision` column, correction-row semantics, idempotency via `payload_hash` — F1-06 |
| Canonical-winner read path (§4) | Nothing | Projection/materialized-view logic that picks `max(revision)` per operation — F1-08 |
| Grace period → unknown → late reconcile (§5.1) | `correlate()`'s single-pass match; §6.4.5-6.4.9's numeric proposals (15s grace, 24h retention) are *proposed defaults*, not yet benchmarked | Persistent pending-observation store surviving past one flush, keyed by stable observation ID — F1-02/F1-03 |
| Unmatched fallback switch-over | N/A | Only turn on once revision/correction lands, to avoid trading a human-overcount bug for an AI+unknown double-count bug (execution plan §6.4, last line) — F1-09 |

## 7. Non-goals of this design

- Does not pick the final grace-period (15s) or late-reconcile retention (24h)
  numbers — those are benchmark-tuned in F0-07/F1, proposed defaults only.
- Does not decide whether the canonical-winner read is a live query
  (`max(revision)` per operation at query time) or a periodic rebuild
  (materialized projection) — left to F1-08 with real ClickHouse load data.
- Does not extend this protocol to non-editor producers' own retries beyond
  what §5.2 covers — the broker's existing inbox-level idempotency
  (`BrokerStore`) is unchanged and is the first line of defense; the revision
  layer is the second line, for retries that land as a *new* accepted event
  rather than a broker-level duplicate.
- Does not implement anything. F1-02, F1-03, F1-05, F1-06, F1-08, F1-09 do.
