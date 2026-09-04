# DECISION — accuracy-over-coverage: pause investment in inferred/unknown attribution

**Status: decided 2026-09-04. Code unchanged — this is a direction record, not
an implementation.** Nothing in `ObserverConfig`, `CorrelationEngine`, the
filesystem/process observers, or the adapter registry was edited to make this
decision. The next engineering session should read this file before touching
any of those, and before resuming work under `planai2.md` or `planplugin.md`.

## Context

Three things were true as of 2026-09-03/04, in this order:

1. `planai2.md` ("Universal AI Detection") shipped a three-tier confidence
   model — `ai_verified` (native hook / structured MCP / completed tool call),
   `ai_inferred` (filesystem + process observer evidence run through
   `CorrelationEngine`'s §5 decision ladder), `unknown`. RUN COMPLETE per
   [`../planai2-progress.md`](../planai2-progress.md); `CorrelationEngine` had
   no production call site at that point.
2. A concurrent process (untracked-by-us at first, reconciled mid-session)
   wired that engine into `wakaclock-cli`'s broker as `BrokerInferenceRuntime`
   — tracked in [`plan-phase8-progress.md`](plan-phase8-progress.md) (p8.1–p8.10,
   all "implemented", gates green). It ingests native-hook + filesystem +
   session/process evidence every poll, runs `verdict_for_within`, and — only
   when `ObserverConfig.feeds_production()` is true (`enabled=true` +
   `AttributionMode::Infer`) — applies the verdict to the real heartbeat via
   `apply_verdict()`. **Default ships `enabled=false`**, so this has changed
   nothing in production yet; it is fully built and fully inert.
3. Researched how WakaTime — the product this whole platform is
   WakaTime-compatible with — actually does AI attribution (2026-09-04,
   sources below). Finding: **WakaTime has no inferred/unknown tier and no
   filesystem/process heuristic at all.** It lists 13–15 named tools
   (Claude Code, Codex, Cursor, Copilot, Continue, Cody, Roo Code, OpenCode,
   Windsurf, Qoder, Kiro, Cline, Gemini, Pi, Goose) each via an official
   native plugin/hook. A tool outside that list is simply not tracked for AI
   attribution — no guess, no fallback, no partial credit.

## Decision

**Prioritize attribution accuracy over attribution coverage, matching
WakaTime's model.** Concretely, going forward:

- **`ObserverConfig` stays `observe_only` (or fully disabled) in production.**
  Not promoting it to `AttributionMode::Infer` was already the safe default;
  this decision makes staying there *deliberate product policy*, not a
  temporary gate pending a precision number. The shadow/inferred pipeline may
  keep recording comparison data for research, but its verdicts must not reach
  a real heartbeat's `actor_type` until a separate, explicit decision reverses
  this one.
- **New engineering investment on "which AI wrote this" goes to more
  native-hook-verified adapters**, not to the inference heuristics. Concrete,
  already-scoped next candidates (real npm packages confirmed to exist and
  match the adapter manifests, 2026-09-03):
  - `gemini-cli` — `@google/gemini-cli`, bin `gemini`, matches
    `adapter.rs`'s `ExecutableDetection`.
  - `kilo-code` — `@kilocode/cli`, bins `kilo`/`kilocode`, matches exactly.
  - `kimi-code-cli` and standalone `deep-code` have no confirmed real
    integration point yet (see `plans/planplugin/progress.md`) — this
    decision does not change that; it only says *when* one exists, wiring it
    as a verified native adapter is preferred work over deepening inference.
- **`ai_inferred` / `unknown` stay in the data model.** They are not being
  ripped out — real shadow/historical data and the `ActorType` enum depend on
  them, and removing them would be a destructive schema change with no
  upside. They are simply not a target for further *accuracy* investment.

## Explicitly NOT decided here (open follow-ups)

- **Dashboard presentation of `ai_inferred`/`unknown`.** Whether the frontend
  should visually de-emphasize, relabel, or hide these next to `ai_verified`
  is a separate, smaller decision — flagged as the natural next question, not
  answered by this doc.
- **Whether to remove the already-built Phase 8 broker wiring.** It costs
  nothing at rest (default off) and is tested; ripping out working code was
  judged premature. If it is never promoted to `Infer` mode, it is dead code
  in practice — a future session may reasonably propose deleting it, but that
  is its own decision, not implied by this one.
- **`planai2.md` / `planplugin.md` themselves are untracked and unedited.**
  This file is the tracked record of the redirect until/unless someone edits
  those source plans directly.

## Rationale

WakaTime proves the narrower model is commercially viable and is the
compatibility target this whole product already measures itself against
(`docs/wakatime-compatibility-manifest.json`). Every `ai_inferred`/`unknown`
row is, by construction, a lower-confidence guess than a native-hook row —
the §5 decision ladder in `CorrelationEngine` itself ranks `ai_verified`
strictly above `ai_inferred` above `unknown` for exactly this reason. Coverage
built on top of that lower tier trades user-visible trust (an emphatically
wrong "which AI" answer is worse than no answer) for breadth the market
leader has not needed to claim.

## Implementation plan

[`plan-accuracy-first-coverage.md`](plan-accuracy-first-coverage.md) (2026-09-04)
turns this decision into phased work. Its key refinement: the accuracy line is
drawn at *filesystem/process inference*, **not** at "native hooks only" —
`EvidenceKind::is_verified_ai_edit()` already counts a completed transcript tool
call as verified-tier, so transcript parsing remains an allowed mechanism for
agents that expose no hook API (Cline, Roo Code, Continue).

## Cross-references

- Supersedes the "still owed: wire `CorrelationEngine` into the live
  heartbeat / actor-attribution path" item recorded in
  `../planai2-progress.md`'s Current position and in this session's own
  memory (`planai2-universal-ai-detection-run`, `ai-attribution-live-path`).
  That wiring *exists* now (point 2 above) — this decision is about whether
  to ever turn it on, which is a different question than whether to build it.
- `plans/planplugin/progress.md`'s per-agent table (Kilo Code / Kimi Code CLI
  / DeepSeek scaffolds) is unchanged by this decision — if anything, that
  work is now higher priority, not lower.
- A second, independent implementation of the Phase 8 wiring exists in a
  separate git worktree (`.worktrees/phase8`, branch
  `phase8/production-wiring`, not merged into `planai2/universal-ai-detection`
  as of 2026-09-03) — unrelated to this decision, but a future session
  reconciling that branch should read this file first.

## Sources (WakaTime research, 2026-09-04)

- [wakatime.com/ai](https://wakatime.com/ai) — the named-tool list and the
  only technical description offered ("WakaTime quietly captures the signal
  in the background").
- [github.com/wakatime/claude-code-wakatime](https://github.com/wakatime/claude-code-wakatime)
  — installed via `claude plugin marketplace add ...`; a native Claude Code
  plugin, not a universal detector.
