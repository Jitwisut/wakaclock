# AI coverage — implementation ledger (F0/F1)

Updated 2026-09-05. Tracks actual status against [ai-coverage-task-ledger.md](ai-coverage-task-ledger.md);
this file records what is wired/tested in `features/ai-coverage-f0-baseline`, it
is not a claim of merge or live certification. F0 is closed; F1 has started with
the transport slice below. Statuses use the ledger's own vocabulary:
`planned → in_progress → implemented → validated`.

| Task | Status | Evidence / remaining caveat |
| --- | --- | --- |
| F0-01 baseline | validated | [docs/ai-coverage-baseline-2026-09-05.md](../docs/ai-coverage-baseline-2026-09-05.md) — branch point, component versions, module-wiring check (ObserverConfig defaults confirmed off/observe_only; naming collision noted). |
| F0-02 doctor placeholders (audit gap #4) | validated, failing on purpose | `f0_02_ai_doctor_and_doctor_ai_disagree_on_broker_running_state` in [backend/api/crates/wakaclock-cli/tests/broker_process.rs](../backend/api/crates/wakaclock-cli/tests/broker_process.rs), `#[ignore]`d with reason. Spawns a real broker, confirms `doctor ai` sees it running, shows `ai doctor` hardcodes `running: false` regardless. Run with `cargo test -p wakaclock-cli -- --ignored f0_02_ai_doctor`. |
| F0-02 unmatched AI edit (audit gap #1) | validated, failing on purpose | `it.fails(...)` reproducer in [extensions/vscode/test/aiAttribution.test.ts](../extensions/vscode/test/aiAttribution.test.ts) — an edit with zero sidecar candidates currently returns `human`; decision D06 says it should be `unattributed`. `it.fails` keeps `npm test` green while the gap stands; if it starts unexpectedly *passing*, `vitest` fails the run, which is the signal to promote it back to a normal `it`. |
| F0-02 delayed sidecar | validated, failing on purpose | `a sidecar that arrives after the editor flush is retained for late reconciliation` in [extensions/vscode/test/aiAttribution.test.ts](../extensions/vscode/test/aiAttribution.test.ts) records expected `unattributed/pending` vs actual immediate `human`, then confirms the late event is only visible on a later call. F1 must add the durable pending ledger and correction path. |
| F0-02 mixed human+AI edits | validated, failing on purpose | `a mixed human+AI editor batch is split by change ownership instead of one scalar verdict` in [extensions/vscode/test/aiAttribution.test.ts](../extensions/vscode/test/aiAttribution.test.ts) records expected AI=4/human=6 vs the current all-or-nothing `unattributed` result. F1-02/F1-04 own the per-change split. |
| F0-03 ADR: unknown vs Unattributed AI | validated | [plans/decision-unknown-authorship-vs-unattributed-ai.md](decision-unknown-authorship-vs-unattributed-ai.md) — truth table across Rust core/ClickHouse/API JSON/frontend confirms no layer promotes `Unknown → AI`. Found and documented (not fixed) a real instance of the *opposite* conflation: `wakatime_import.rs::map_heartbeat` maps historical AI-generated WakaTime data to `actor_type: "unknown"` instead of `ai_inferred`, bypassing `resolve_attribution` entirely. Flagged for F1-07. |
| F0-04 VS Code capability spike | validated | [docs/vscode-human-input-capability-spike-2026-09-05.md](../docs/vscode-human-input-capability-spike-2026-09-05.md) — `TextDocumentChangeReason` only ever distinguishes undo/redo; "keystrokes" is a content-delta heuristic, not a keyboard count; IME composition is unobservable by any VS Code extension API; formatter/paste rewrites are only partially distinguishable (paste, only when the custom clipboard MIME token round-trips); `vscode.env.appName`/`vscode.version` are never captured today, meaning the extension can't tell it's running inside a VS Code fork (Cursor/Windsurf) with its own built-in AI features. |
| F0-05 canonical operation/alias/revision/correction protocol | validated | [plans/design-canonical-operation-and-revision-protocol.md](design-canonical-operation-and-revision-protocol.md) — canonical operation ID is always a real producer `event_id` (never a synthetic third ID); aliases require ID/session or content-version proof only (never time+line-delta); revision protocol picks full-value correction rows with `max(revision)`-per-operation as the only valid read (naive `sum()` across revisions double-counts — named as a required F1-08 change to every existing line-summing query, e.g. `ai_stats.rs::fetch_agents`). Three worked examples (late event, retry, multifile) with real numbers. Explicitly identifies that the editor↔AI late-evidence pairing has no available proof today — a capability gap for F1, not solved by this design. |
| F0-06 wire/schema compatibility inventory | validated | [plans/wire-schema-compatibility-inventory-2026-09-05.md](wire-schema-compatibility-inventory-2026-09-05.md) — three boundaries (local hook↔broker wire, CLI↔API, API↔ClickHouse), only the first is strict (`deny_unknown_fields` everywhere in the parse chain, verified via `main.rs`); found this codebase already anticipates the resulting hook/binary version-skew risk (`CliPathReport`/`cli_identity_mismatch`) though no live drop was confirmed. Verified ClickHouse reads decode positionally by explicit column list (not `SELECT *`) and named the real hazard: every `fetch_all::<HeartbeatRow>()` call site must independently track `HeartbeatRow`'s field order. Postgres confirmed out of scope for F1's fields. The previously open retention decision is now recorded in [plans/ai-coverage-retention-policy.md](ai-coverage-retention-policy.md) and enforced by the local ledger; server migration remains F1-05/F1-06 work. |
| F0-07 ground-truth corpus manifest | validated | [plans/ai-coverage-ground-truth-manifest.md](ai-coverage-ground-truth-manifest.md) — Tier 1 (local/synthetic/no-account, ~12 scenarios mapped to existing test infra, buildable now) and Tier 2 (needs a real AI tool account per adapter; status per adapter drawn from existing `CAPABILITIES.md`/`VERIFICATION.md`, not re-measured). Every scenario `not_run`, no fabricated results or cost figures. Names two candidate "first release tuples" (Claude Code refresh vs. Gemini CLI as next-new-adapter) without picking one — a scheduling call outside this document's scope. |

## F0 phase status

**Validated and closed.** F0-01 through F0-07 now have their documents and
reproduction artifacts, including expected/actual assertions for unmatched AI,
delayed sidecar, mixed human+AI, and doctor placeholder gaps. The retention decision
is explicit and implemented for the local durable ledger: 15-second grace,
24-hour pending observations, and 30-day superseded-revision and alias history.
The closeout evidence is recorded in
[docs/ai-coverage-f0-closeout-2026-09-05.md](../docs/ai-coverage-f0-closeout-2026-09-05.md).
F0 closure records the gaps; it does not claim that F1/F2 fixes or live ground-truth
certification are complete.

## F1 implementation started

| Task | Status | Evidence / remaining caveat |
| --- | --- | --- |
| F1-01 pure attribution decision + conformance fixture | implemented | [docs/ai-coverage-f1-01a-attribution-conformance-2026-09-05.md](../docs/ai-coverage-f1-01a-attribution-conformance-2026-09-05.md) — versioned JSON truth table passes the Rust resolver, pure VS Code mirror, and v1 heartbeat ingestion adapter. Read-side actor reconstruction and analytics projection alignment remain follow-up work under F1-07/F1-08. |
| F1-03 sidecar version/sequence/resume | implemented | [docs/ai-coverage-f1-03-sidecar-transport-2026-09-05.md](../docs/ai-coverage-f1-03-sidecar-transport-2026-09-05.md) — broker SQLite cursor allocates a durable opaque stream and monotonic sequence; retries reuse the event mapping; VS Code reads bounded byte ranges, handles partial lines and rotation, skips future schemas, and persists pending/consumed metadata across extension restart. Focused transport tests pass. F1-10 crash/concurrency integration and the downstream reconciliation work remain. |
| F1-05 canonical IDs/aliases | in_progress | `ai/revision.rs` enforces direct tool-event/entity or content-version/entity proof; `AiAttributionState::record_event_alias` persists one-hop aliases and rejects session-only/time-only guesses. Server alias storage and producer wiring remain. |
| F1-06 revision storage/read semantics | in_progress | `attribution_revisions` SQLite table, idempotent payload-hash append, full-value correction rows, max-revision read, and retention pruning are implemented and tested. The ClickHouse `heartbeats`/`heartbeats_incoming` schemas and `HeartbeatRow` now carry additive `revision` (default `0`), including reprocess reads; correction writers, canonical-winner projections, and client revision input remain. |

### F1-03 sidecar transport slice

The first F1 implementation slice is deliberately limited to transport
reliability. New sidecar rows are v2 metadata records with a durable
`stream_id` and monotonic `sequence`; v1 rows remain readable and future schema
versions are ignored. The broker reservation is durable before JSONL append,
while the extension reader uses a bounded byte cursor and a private checkpoint
file so partial writes, rotation, retries, and extension restarts do not discard
or replay ownership evidence. The full evidence and test matrix is in
[docs/ai-coverage-f1-03-sidecar-transport-2026-09-05.md](../docs/ai-coverage-f1-03-sidecar-transport-2026-09-05.md).

This slice intentionally leaves attribution policy unchanged. The unmatched
`human` fallback, mixed-batch split, late correction, canonical revision
projection, and rollout control remain owned by later F1 tasks.

### F1-01a attribution decision slice

The shared `decision-v1` fixture now drives the pure Rust/TypeScript resolver
tests and the v1 heartbeat ingestion adapter. The adapter accepts legacy actor
aliases, validates canonical `actor_confidence` (while preserving the older
`attribution_confidence` field), returns HTTP 400 for contradictory evidence,
and derives `actor_type`, `actor_confidence`, and `is_ai_generated` from one
resolution. The history serializer and analytics read projections still need
the same canonical winner semantics before F1-07/F1-08 can close the full
server boundary.

## Codex Desktop detection repair (2026-09-05)

The live Codex Desktop transcript shape was added to `wakaclock-core::ai::codex`: a
`custom_tool_call` named `exec` now unwraps both literal
`tools.apply_patch("...")` and `const patch = "..."` variable wrappers, then still
requires the matching `custom_tool_call_output` before emitting verified file events.
`run_ai_sync` validates each transcript event before batching so an unsafe historical
Claude path is skipped without aborting later agents. Automatic sync now gives each
agent its own bounded pass and scans newest transcripts first. Core tests (207 passed),
CLI integration tests (6 passed, 1 ignored), and a replay of the real Codex Desktop
session all pass; the replay grew from `0` to `44` parsed events, and the live broker
processed Codex rows while keeping new retries at zero.

## Why the F0-02 failures remain intentional

The four F0-02 tests now all have an expected/actual pair and a failing assertion
that points at a real gap. The two VS Code cases use `it.fails`; the broker doctor
case remains an explicitly ignored subprocess reproducer because it needs a real
broker process. These are evidence artifacts for F1/F2, not production failures
that should be hidden by changing the expected result or enabling heuristic AI
attribution.

## Gates run locally for what's implemented so far

- `cargo test -p wakaclock-core` (backend/api) — 207 unit tests plus 1 shared
  attribution conformance integration test passed, including the revision/
  alias/retention ledger tests and the invariant that corrections cannot add
  measured time or line totals.
- `cargo test -p wakaclock-cli --bin wakaclock` (backend/api) — 40 passed.
- `cargo test -p wakaclock-cli --test broker_process` (backend/api) — 6 passed,
  1 ignored. The ignored F0 doctor reproducer still intentionally fails with
  the documented assertion (`left: false, right: true` on `broker.running`)
  when run explicitly with `--ignored`; a sandboxed run that could not bind
  localhost is an environment limitation, not the recorded result.
- `bash extensions/ai-agents/common/tests/emit-event.test.sh` — passed.
- `npm test` (extensions/vscode) — 101 passed, 3 expected failures (unmatched,
  delayed-sidecar, and mixed human+AI F0-02 reproducers via `it.fails`).
- `npm run lint` (extensions/vscode) — passed.
- `cargo test -p wakaclock-server handlers::v1::heartbeats::tests` (backend/api) — 8
  handler tests passed, including every shared attribution fixture case and
  validation of the normalized heartbeat invariant.
- `cargo test -p wakaclock-server` (backend/api) — 170 passed, 7 ignored
  database-backed tests.
- `npm run validate` (frontend/app) — **not green**, but confirmed pre-existing
  on `main` before this branch (reproduced against commit `98e2455`); unrelated
  to AI coverage, flagged separately, not fixed here.
- `cargo fmt --all -- --check` — workspace check still reports the pre-existing
  `wakaclock-core/src/git.rs` formatting diff from the earlier worktree-name fix;
  no F0 closeout source file is affected.
