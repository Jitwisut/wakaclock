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
| F0-02 delayed sidecar | **fixture only, no assertion yet** | Not written. `classify()`'s correlation window (`CORRELATION_WINDOW_SECONDS = 15`) already has a boundary test (`does not match an event one second past the 15-second boundary`) that pins current behavior, but a *delayed* sidecar (event arrives correctly, just late) needs the canonical revision/late-reconciliation model F0-05 hasn't designed yet ("late evidence เปลี่ยน classification แต่ไม่เพิ่ม event/time/lines ซ้ำ" — F1-06's job). Writing an expected value now would just be rewritten after F0-05; deferred deliberately, not forgotten. |
| F0-02 mixed human+AI edits | **fixture only, no assertion yet** | Not written, for the same reason: per-change ownership (F1-02) and exact editor↔agent reconciliation (F1-04) define what "correct" looks like for a batch containing both human and AI keystrokes on the same file/window, and that protocol isn't decided yet. |
| F0-03 ADR: unknown vs Unattributed AI | not started | Depends on F0-02 (closed above for the two implemented scenarios). |
| F0-04 VS Code capability spike | not started | — |

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
