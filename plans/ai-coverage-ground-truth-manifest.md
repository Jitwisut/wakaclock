# Ground-truth corpus, benchmark environment, and first release tuple

วันที่: 2026-09-05 · Task: [F0-07](ai-coverage-task-ledger.md) · สถานะ: manifest, ไม่มี placeholder result

Depends on [F0-02](ai-coverage-progress.md). This is a corpus **definition**,
not a report — every scenario below is `status: not_run`. Target budgets
(accuracy/latency/resource) are already proposed in
[ai-coverage-validation-plan.md](ai-coverage-validation-plan.md) §8 and are
referenced, not restated. Scenario IDs (`V-M*`/`V-C*`/`V-R*`/`V-H*`/`V-A*`)
are the validation plan's own §3-7 matrices.

## 1. Two kinds of ground truth already in play — don't confuse them

- **Parser/transcript-shape ground truth** (already exists):
  `wakaclock-core/src/ai/CAPABILITIES.md` documents a real capability
  inventory captured from actual local transcript files — Claude Code and
  Codex verified against real sessions (2026-08-14, corrected 2026-08-31
  after checking 156 real Codex session files), Gemini CLI explicitly marked
  `unknown` because it was never installed on the inspection machine.
  `VERIFICATION.md` documents one real end-to-end `wakaclock ai sync` run
  against a live Claude Code session (32 real tool calls, a real bug found
  and fixed). **This F0-07 manifest does not duplicate that work** — it
  covers a different, currently-empty layer.
- **End-to-end scenario ground truth** (what this manifest defines): the
  85 scenarios across validation-plan §3-7 (V-M01-20, V-C01-16, V-R01-16,
  V-H01-18, V-A01-15) need actual fixtures with a known true actor/outcome to
  compare system output against. Almost none of these have a concrete
  fixture yet — this manifest picks a first tier and states what each one
  needs.

## 2. Tier 1 — small, local-only, zero external account (build first)

These scenarios have ground truth **by construction**: the test harness
writes the file changes and/or crafts the `BrokerEventV1`/`AiEditEvent`
JSON directly, so "what actually happened" is whatever the test wrote, not
something inferred from a real tool's behavior. No AI account, no network
call, no cost. This is the "เล็ก" (small) fixture tier from execution-plan F0
item 7.

| Scenario | Ground truth construction | Existing infra to build on |
| --- | --- | --- |
| V-M01 create, V-M02 edit, V-M04 delete, V-M05 rename, V-M06 rename+edit | Write files directly in a `temp_home`-style disposable project (pattern already used in `broker_process.rs::temp_home`), craft the matching `BrokerEventV1` by hand — true line delta is whatever the test wrote | `broker_process.rs`'s existing `temp_home`/`spawn_broker`/`event()` helpers |
| V-M07 multi-file, V-M13 CRLF/LF/Unicode/empty | Same, with N files or specific byte content chosen by the test | Same |
| V-M09 dirty-before-AI | Seed a file with an uncommitted human edit (git status dirty) before posting the AI event | `tool_snapshot.rs`'s existing git-dirty-detection tests (`preexisting_dirty_git_file_keeps_modified_line_delta_unknown`) are the closest existing pattern |
| V-C01 human-only typing | Drive `HeartbeatBufferManager.recordTextChange` directly with synthetic `TextDocumentContentChangeEvent`-shaped input, no AI event posted | `extensions/vscode/test/*.test.ts`'s existing harness (no real VS Code host needed — these are already unit-style tests per F0-04) |
| V-C08 equal line counts, human vs AI | Construct one `EditorObservation` and one `AiEditEvent` with identical `lines_added` by hand, feed to `correlate()` | `ai/correlation.rs`'s own test module already does exactly this shape |
| V-C11 paste same-file/workspace/external | Drive the clipboard MIME token path (`clipboardTracking.ts`) with controlled `dataTransfer` content | Existing clipboard tracking tests |
| V-R02 retry exact payload, V-R03 conflicting same-ID | Post the same/conflicting `BrokerEventV1` twice through `BrokerStore` directly | `broker.rs`'s own test suite (`batch_deduplicates_repeated_ids_without_double_inserting`, `duplicate_and_conflicting_ids_are_distinguished`) already covers this at the store level — extending to the F0-05 revision layer once F1-06 exists |
| V-R13 old producer/new broker, new producer/old broker | Run an *older* checked-out binary (or a hand-built payload missing/adding the newest field) against the current broker, and vice versa | New — this is exactly [F0-06](wire-schema-compatibility-inventory-2026-09-05.md)'s finding; a fixture here would have caught the `editor`-field hazard before it shipped |
| V-H01 broker running/stopped/probe denied, V-H03 queue empty/unreadable | Spawn/kill a real broker process, corrupt the DB file to force a probe error | `broker_process.rs::spawn_broker`/`ChildGuard`, plus the new `f0_02_ai_doctor_and_doctor_ai_disagree_on_broker_running_state` reproducer's pattern |

Sizing: ~12 scenarios, each a single-digit-second subprocess or in-process
test — this tier should run in CI on every PR touching the AI attribution
path, the same way `broker_process.rs`'s existing suite does today.

## 3. Tier 2 — needs a real AI tool account/runner (large, live)

These scenarios require an actual AI coding tool to act on a real (disposable,
synthetic-project) workspace — there is no way to construct honest ground
truth for "does the real tool's transcript/hook format match what we assume"
without running the real tool. This is the "ใหญ่" (large) tier.

| Tool | Runner/account needed | Current readiness (from `CAPABILITIES.md`/`VERIFICATION.md`) |
| --- | --- | --- |
| Claude Code CLI | A machine with `claude` installed and logged in (interactive OAuth or API key in the *operator's own* environment — never committed to this repo) | Most mature: real transcript shape verified 2026-08-14, one real end-to-end sync run documented in `VERIFICATION.md`. Ledger's own F5-01 says this needs a **refresh** post-migration (hooks/transcript/write/edit/failures) before being re-certified current. |
| Codex CLI | A machine with `codex` installed and authenticated | Real transcript shape verified against 156 real local sessions (2026-08-31 correction), current dominant shape (`custom_tool_call`/`custom_tool_call_output`) implemented. No documented full end-to-end live sync run comparable to Claude Code's `VERIFICATION.md` yet. |
| Gemini CLI | A machine with `@google/gemini-cli` (`gemini` bin) installed and authenticated — confirmed as a real, installable npm package matching `adapter.rs`'s `ExecutableDetection`, but never run against the real tool | **Not started** — `fixtures/gemini_cli/README.md` explicitly says "do not add synthetic fixtures here from guesswork." This is the actual next capability-inventory step, before any scenario in this tier can be attempted for Gemini. |
| Kilo CLI | A machine with `@kilocode/cli` (`kilo`/`kilocode` bins) installed, with a selected provider/model configured | Not started — same status as Gemini, per the same 2026-09-03 confirmation. |
| Cursor Agent, other F5 adapters | Per-tool, not yet surveyed | Out of scope for this manifest — F5 backlog |

**Credential handling**: none of the above are stored in this repo, this
manifest, or any file it points to. "Needed" here means the *human operator*
running the live-certification pass (validation-plan §9) provisions that
tool's own login on their own machine/CI runner outside this repository —
matching validation-plan §2's existing rule ("แยก test home/config/database/
API account ... จากของผู้ใช้").

## 4. Runtime access / cost budget

- **Claude Code / Codex refresh (Tier 2, existing tools)**: bounded by
  validation-plan §9's live-certification procedure (a fixed scenario list
  run once per tuple) — order of tens of tool calls against a synthetic
  project, not an open-ended session. No new API cost beyond what the
  operator's own subscription/API key already covers; this manifest does not
  propose a specific dollar budget because neither ledger nor validation plan
  currently prices per-call cost, and fabricating one would violate the
  "no placeholder result" rule this document itself is bound by.
- **Gemini CLI / Kilo CLI (Tier 2, net-new)**: first cost is the
  capability-inventory pass itself (installing the real CLI, authenticating,
  capturing real transcript/session shapes the way `CAPABILITIES.md` did for
  Claude Code/Codex) — this must happen **before** any scenario fixture is
  written for them, exactly as their own `fixtures/*/README.md` files already
  say. Budget this as a fixed inventory task (comparable effort to the
  existing Claude Code/Codex inventory passes), not a per-scenario cost yet.
- **Reference hardware/OS**: validation-plan §8.3 already requires defining
  reference hardware before measuring performance/resource bounds (broker
  idle CPU, RSS, scan latency) — this manifest doesn't repeat those numbers,
  it only notes that Tier 2 runs should happen on that same declared
  reference environment so results are comparable across tuples.

## 5. First release tuple

Two different things both plausibly answer "first tuple," and conflating them
would misrepresent readiness:

- **First tuple to prove the F4 live-certification *process* end-to-end**:
  recommend **Claude Code CLI × current version × macOS × CLI runtime**. It
  has the most existing real-run evidence to compare a fresh run against (a
  regression check on the process itself, not just the tool), needs no new
  account provisioning (it's the tool this development environment already
  uses), and is explicitly named as needing a refresh (F5-01) rather than a
  cold start. Running this first de-risks the certification harness itself
  before spending it on a tool nobody has run yet.
- **First genuinely new adapter per the roadmap's stated order** ("Gemini →
  Kilo → Cursor → surveyed adapters"): **Gemini CLI**, per the
  already-confirmed-installable npm package. This is a capability-inventory
  task first (§3), a scenario run second — it cannot skip straight to
  live certification the way the Claude Code refresh can.

This manifest does not pick one over the other as *the* answer — that's a
scheduling decision for whoever runs F1/F4, not a fact this document can
assert. Both are named so the choice is explicit rather than defaulted.

## 6. What this manifest is not

- Not a set of results. Every scenario above is `not_run` (matching the
  status vocabulary validation-plan §10's artifact schema already uses).
- Not a replacement for `CAPABILITIES.md`/`VERIFICATION.md` — those already
  cover parser-shape ground truth for Claude Code/Codex; this covers the
  separate end-to-end scenario layer.
- Not a commitment to run Tier 2 scenarios in this session or without the
  operator's own account/consent — per this repo's own tool-permission rules,
  no live AI-tool credential is available to or handled by this work.
- Not a full enumeration of all 85 validation-plan scenarios into a build
  order — only Tier 1 (buildable now, no account) is scoped concretely;
  Tier 2's remaining scenarios (V-M15-20 tool lifecycle edge cases, V-H14/18
  live certification, V-A11 cloud job, etc.) wait on the account/inventory
  prerequisites named in §3.
