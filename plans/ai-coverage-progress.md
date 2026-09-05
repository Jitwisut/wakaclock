# AI coverage — implementation ledger (F0)

Updated 2026-09-05. Tracks actual status against [ai-coverage-task-ledger.md](ai-coverage-task-ledger.md);
this file records what is wired/tested in `features/ai-coverage-f0-baseline`, it
is not a claim of merge or live certification. Statuses use the ledger's own
vocabulary: `planned → in_progress → implemented → validated`.

| Task | Status | Evidence / remaining caveat |
| --- | --- | --- |
| F0-01 baseline | implemented | [docs/ai-coverage-baseline-2026-09-05.md](../docs/ai-coverage-baseline-2026-09-05.md) — branch point, component versions, module-wiring check (ObserverConfig defaults confirmed off/observe_only; naming collision noted). |
| F0-02 doctor placeholders (audit gap #4) | implemented, failing on purpose | `f0_02_ai_doctor_and_doctor_ai_disagree_on_broker_running_state` in [backend/api/crates/wakaclock-cli/tests/broker_process.rs](../backend/api/crates/wakaclock-cli/tests/broker_process.rs), `#[ignore]`d with reason. Spawns a real broker, confirms `doctor ai` sees it running, shows `ai doctor` hardcodes `running: false` regardless. Run with `cargo test -p wakaclock-cli -- --ignored f0_02_ai_doctor`. |
| F0-02 unmatched AI edit (audit gap #1) | implemented, failing on purpose | `it.fails(...)` reproducer in [extensions/vscode/test/aiAttribution.test.ts](../extensions/vscode/test/aiAttribution.test.ts) — an edit with zero sidecar candidates currently returns `human`; decision D06 says it should be `unattributed`. `it.fails` keeps `npm test` green while the gap stands; if it starts unexpectedly *passing*, `vitest` fails the run, which is the signal to promote it back to a normal `it`. |
| F0-02 delayed sidecar | **fixture only, no assertion yet — now explained, still deferred** | `classify()`'s correlation window (`CORRELATION_WINDOW_SECONDS = 15`) already has a boundary test (`does not match an event one second past the 15-second boundary`) that pins current behavior. F0-05 (below) designed the revision mechanism this scenario needs, and found the specific reason it can't be closed yet: an editor-flushed observation has **zero available alias proof** against a later AI event today (no shared content-version signal exists on both sides) — see [design doc](design-canonical-operation-and-revision-protocol.md) §3/§5.1.5. Needs a new capability (F1) before this fixture can get a real assertion. |
| F0-02 mixed human+AI edits | **fixture only, no assertion yet** | Not written, for the same reason: per-change ownership (F1-02) and exact editor↔agent reconciliation (F1-04) define what "correct" looks like for a batch containing both human and AI keystrokes on the same file/window, and that protocol isn't decided yet. |
| F0-03 ADR: unknown vs Unattributed AI | implemented | [plans/decision-unknown-authorship-vs-unattributed-ai.md](decision-unknown-authorship-vs-unattributed-ai.md) — truth table across Rust core/ClickHouse/API JSON/frontend confirms no layer promotes `Unknown → AI`. Found and documented (not fixed) a real instance of the *opposite* conflation: `wakatime_import.rs::map_heartbeat` maps historical AI-generated WakaTime data to `actor_type: "unknown"` instead of `ai_inferred`, bypassing `resolve_attribution` entirely. Flagged for F1-07. |
| F0-04 VS Code capability spike | implemented | [docs/vscode-human-input-capability-spike-2026-09-05.md](../docs/vscode-human-input-capability-spike-2026-09-05.md) — `TextDocumentChangeReason` only ever distinguishes undo/redo; "keystrokes" is a content-delta heuristic, not a keyboard count; IME composition is unobservable by any VS Code extension API; formatter/paste rewrites are only partially distinguishable (paste, only when the custom clipboard MIME token round-trips); `vscode.env.appName`/`vscode.version` are never captured today, meaning the extension can't tell it's running inside a VS Code fork (Cursor/Windsurf) with its own built-in AI features. |
| F0-05 canonical operation/alias/revision/correction protocol | implemented | [plans/design-canonical-operation-and-revision-protocol.md](design-canonical-operation-and-revision-protocol.md) — canonical operation ID is always a real producer `event_id` (never a synthetic third ID); aliases require ID/session or content-version proof only (never time+line-delta); revision protocol picks full-value correction rows with `max(revision)`-per-operation as the only valid read (naive `sum()` across revisions double-counts — named as a required F1-08 change to every existing line-summing query, e.g. `ai_stats.rs::fetch_agents`). Three worked examples (late event, retry, multifile) with real numbers. Explicitly identifies that the editor↔AI late-evidence pairing has no available proof today — a capability gap for F1, not solved by this design. |

## Why two of the four F0-02 scenarios are deferred

The ledger's F0-02 closing criterion is "มี expected/actual และ failing assertion
ที่ชี้ช่องว่างจริง" (an expected/actual pair and a failing assertion that points at
a real gap). For **unmatched AI edit** and **doctor placeholders**, "expected" is
already fully determined by decisions already on record (D06; `doctor ai`'s own
correct output as ground truth) — the reproducer just has to show the other path
disagrees. For **delayed sidecar** and **mixed edits**, no committed decision yet
defines "expected": F0-05 ("ออกแบบ canonical operation, aliases, revision และ
correction protocol") is explicitly the task that produces that answer, and F0-05
depends on F0-03 and F0-04, which have not started. Asserting a value now would be
guessing, not reproducing a known gap — exactly what [ai-coverage-task-ledger.md](ai-coverage-task-ledger.md)
§1 warns against ("เขียน code แล้ว ไม่เท่ากับ validated").

## Gates run locally for what's implemented so far

- `cargo test -p wakaclock-core -p wakaclock-cli` (backend/api) — 233 passed, 1
  intentionally `#[ignore]`d (the new F0-02 reproducer).
- `cargo test -p wakaclock-cli -- --ignored f0_02_ai_doctor` — confirms the
  reproducer fails for the documented reason (`left: false, right: true` on
  `broker.running`).
- `bash extensions/ai-agents/common/tests/emit-event.test.sh` — passed.
- `npm test` (extensions/vscode) — 96 passed, 1 expected fail (the new F0-02
  reproducer via `it.fails`).
- `npm run validate` (frontend/app) — **not green**, but confirmed pre-existing
  on `main` before this branch (reproduced against commit `98e2455`); unrelated
  to AI coverage, flagged separately, not fixed here.
