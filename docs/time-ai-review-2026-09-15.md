# Time and AI attribution review — 2026-09-15

Reviewed commit: `00d03b64225bcf831dfe6909e83c4fd8182ba48f`.
Scope: local production code, existing tests, synthetic probes against the compiled
core library, committed certification records, and current official WakaTime docs.
No production account data, deployment configuration, or live side-by-side campaign
was inspected. No production code was changed.

## Verdict

ยังไม่มีหลักฐานเพียงพอว่าแม่นกว่า WakaTime ทั้งด้านเวลาและ AI attribution.
ระบบมีฐานที่ดี: canonical timeline, overlap union, separate measured AI time,
unknown/conflict identity, revision-safe repair และ evidence-based matching.
แต่พบ correctness defects และหลักฐาน live certification ยังไม่ครอบคลุมรุ่นปัจจุบัน.

WakaTime already documents AI additions/deletions, per-model line changes and
token-based estimated costs. AI support alone is not a differentiator:

- https://wakatime.com/developers
- https://wakatime.com/faq

## Confirmed issues

### P1 — Failed Codex calls can become verified edits

Location: `backend/api/crates/wakaclock-core/src/ai/codex.rs:596`.
The parser rejects explicit failed status but accepts an absent status, then ignores
the output entirely. A tool returning an error is not proof that its patch applied.

Reproduction: use the committed session/turn/call fixtures; replace the paired
output with `Error: Failed to find expected lines. No files were modified.` and
leave status absent, as in the committed output fixture. Run the actual CodexParser.
Observed: two `Verified` events, additions 3+3 and deletions 1+0. Expected: no proven
file edits. This is a parser-level reproduction, not a measured production incident.

Fix: normalize tool-level success/failure using supported result envelopes; inspect
bounded result metadata locally without retaining content. An ambiguous completion
must not promote planned patch counts to verified applied counts. Cover direct calls,
wrapped calls, outer-wrapper success with inner failure, and partial outcomes.

### P2 — Diff-body lines starting with triple signs are dropped

Location: `backend/api/crates/wakaclock-core/src/ai/patch.rs:15`.
`add_line` excludes every `+++` and `---` prefix even inside a hunk or apply_patch body.
Adding source `++counter;` produces body `+++counter;`; deleting `--counter;`
produces `---counter;`. Actual parser result: +0/-0; expected +1/-1.
The helper also serves Claude structured hunks, which have no file headers.

Fix: distinguish diff headers by parser state and format. In structured hunks and
apply_patch bodies, count the first sign as the operation and the remainder as content.

### P2 — Whole-file deletion reports unknown magnitude as zero

Locations: `patch.rs:101` and `codex.rs:688`.
A `*** Delete File: a.rs` section without body lines initializes an empty delta.
The event then emits `lines_deleted: Some(0)` although it lacks pre-delete content.
Actual probe returns deleted=0. Existing delete fixture includes synthetic removed
lines, so it misses this case.

Fix: recover the count from trusted pre-delete evidence, or emit null/unavailable
with a reason. Keep the deletion event visible independently of line availability.

### P2 — Editor line metrics depend on event batching

Location: `extensions/vscode/src/utils.ts:53`.
Executed current source through TypeScript transpilation:

| Same-line operation | Added | Deleted |
| --- | ---: | ---: |
| Type `abc` as three changes | 0 | 0 |
| Insert `abc` as one change | 1 | 0 |
| Delete `abc` within one line | 0 | 0 |

These event counters are not equivalent to the AI patch line-change metric.
Likewise, `keystrokes` uses character/range lengths and is not a measured physical
key count. This makes human/AI line ratios misleading unless their definitions differ
explicitly. Attribution may move these editor counts to Unknown; that does not fix
their inconsistent measurement unit.

Fix: define line changes over a bounded before/after document version (or label event
counters explicitly); use the same definition for comparable human and AI totals.
Keep source snapshots local/in memory. Distinguish churn (added/deleted across edits)
from retained code in the current tree or a commit; neither proves productivity.

## Time validation and coverage gaps

### P1 release evidence gap — No current external parity proof

`scripts/duration-audit/certifications/latest.json` reports 0.43% total error, but
`certify_live.py` computes its reference using the local `wakatime_durations` function
on the Wakaclock export. It does not call WakaTime. Thus it validates reconstruction
consistency, not capture completeness against an independent system.

The separate `wakatime-parity.json` is an advisory run from 2026-08-31 covering
2026-08-12 through 2026-08-30: Wakaclock 61,210.305 seconds, WakaTime 298,074.162
seconds, relative difference 79.46%. It predates current changes and does not prove
the current build has that error; missing collection and unlike activity definitions
must be ruled out before treating either total as ground truth.

`combined_v2` exists but is opt-in (`config/mod.rs:338` defaults to legacy).
The actual deployment mode was not inspected. The comparison script now selects
Wakaclock `comparable_seconds`, but `_fetch` only pins dates/timezone; timeout and
writes-only preferences are not explicitly pinned or validated.

Next: controlled same-machine collection for at least seven completed days with
the same timezone, timeout, filters and client versions; inspect delivery queues,
separate editor-comparable time from AI measured time, and reconcile missing ranges.
Use independently recorded task intervals to assess accuracy, because agreement with
WakaTime alone is not proof of real working time. Refresh current-commit evidence.

### P1 release evidence gap — Agent inventory is not certified coverage

All five entries in `certifications/ai-adapters/catalog-v1.json` are historical and
`promotable=false`. The F5 closeout records a Codex CLI campaign with eight events
through dashboard readback, but nested execution and release promotion remain open.
Other surveyed runtimes have missing live gates. These records describe the available
evidence, not a fresh check of today's installed runtimes or authentication state.

Next: certify each client/runtime/version separately, including model switches,
multiple models in one session, multi-file edits, failures, deletions, restart/retry,
and inline acceptance. Publish supported/observed/unavailable status plus model-identity
and line-measurement coverage separately. Preserve unknown values instead of guessing.

## Validation performed

- Core AI tests: 204 passed (`cargo test -p wakaclock-core ai:: --lib --offline`).
- Rust activity timeline: 31 passed.
- VS Code: 108 passed across 11 test files.
- Duration comparison unit tests: 8 passed.
- Python timeline port checks and golden fixture: passed.
- Certification catalog validation: passed; structural validity is not live proof.
- Three Rust defect probes and TypeScript event-counter probes reproduced above.

The Xcode-selected linker initially failed due to its license state. Re-running with
the already installed CommandLineTools via command-local `DEVELOPER_DIR` succeeded;
no system setting or license acceptance was changed.

Synthetic Rust probe source/input are at `/tmp/wakaclock-audit-20260915/` for this
session. Existing test success does not cover the newly demonstrated defects.

## Recommended order

1. Stop false verified edits on failed/ambiguous tool results.
2. Correct diff-body counting and unknown deletion magnitude.
3. Align line measurement definitions and show coverage explicitly.
4. Pin comparison semantics and run a fresh controlled time/AI campaign.
5. Promote only the exact runtime tuples whose end-to-end evidence passes.
