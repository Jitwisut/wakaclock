# AtoAxis AI Attribution Roadmap — Accuracy-first

**Status:** canonical implementation plan, updated 2026-09-05

This is the single source of truth for the AI attribution work. The SEO CSV
audit is complete at `origin/main` commit `62325fa` and is intentionally not
part of this roadmap.

## Non-negotiable policy

We prefer an explicit unattributed result over a wrong AI name. An AI identity
may be emitted only when the local evidence is one of:

1. a native hook;
2. a structured MCP event; or
3. a completed transcript tool call that clearly records the file edit.

Filesystem and process observations are diagnostics only. They must never set
`ai_agent`, `ai_provider`, `ai_model`, or alter heartbeat attribution. Historical
`ai_inferred` and `unknown` values remain readable for compatibility; API reads
return a `null` identity for those rows and dashboards group them as
**Unattributed AI**, never as a named tool.

The observer is disabled by default. Consent can enable `observe_only`, but
`feeds_production()` is permanently false. Legacy `attribution_mode = "infer"`
is accepted for parsing and downgraded to `observe_only`.

## Git guardrails

- This work starts from `origin/main` at `62325fa` on
  `codex/accuracy-first-roadmap`.
- The dirty `planai2/universal-ai-detection` work was snapshotted locally as
  `7b8faf2` on `codex/planai2-wip-backup-20260905`. Its 106-commit history is
  reference material, not a merge source.
- `phase8/production-wiring` is not merged. Compare it only for diagnostics or
  onboarding behavior; never restore a production inference path from it.
- Each completed phase lands as a small tested commit, fast-forwarded to local
  `main`, then pushed to `origin/main`. Unverified adapters never block the
  release and never receive a fabricated certification artifact.

## Phases and deliverables

### P0 — Enforce the accuracy boundary (land first)

- Sanitize inferred/unverified identity at both CLI/broker and API boundaries.
- Preserve legacy schema values without a destructive migration.
- Make AI stats, analytics and the dashboard use an explicit Unattributed AI
  bucket for AI rows without verified identity.
- Add regression tests for client/server redaction, idempotency and verified
  hook/transcript identity.

### P1 — Diagnostics-only observer and compatibility

- Keep observer default-off and consent-gated; downgrade legacy `infer` config.
- Expose only bounded health metadata: broker counters, parser lag and adapter
  lifecycle state (`Scaffold`, `Installed`, `Live-tested`, `Verified`,
  `Unsupported`).
- Keep paths, prompts, diffs, source, transcript content and process arguments
  local. The backend accepts sanitized reports only.
- Add `ai doctor` and the dashboard health panel. Diagnostics must not create or
  mutate heartbeat attribution.

### P2 — Idempotent setup and onboarding

- Make `ai setup`, `ai status`, `ai doctor` and `ai uninstall` repeatable.
- Register workspaces to discover adapters without assigning authorship.
- Keep VS Code onboarding consent-based and actionable.
- Installer/Homebrew paths must preserve user-owned configuration and remove only
  AtoAxis-owned blocks/files.
- Setup success is not certification; only a live run can promote `Verified`.

### P3 — Verified coverage, in order

1. **Gemini CLI:** real package/version, setup, multi-file edit, sidecar → broker
   → backend → dashboard inspection.
2. **Kilo Code:** exercise both `kilo` and `kilocode` with the same checklist.
3. **Cursor:** capture a real `afterFileEdit` payload. Use a before/after
   snapshot only when the file evidence is explicit; never estimate line deltas
   from timing or process presence.
4. **Cline, Roo Code, Continue:** survey storage first. Build a parser only when
   per-edit records and file paths exist; otherwise record Unsupported/Unverified
   and stop.
5. **OpenCode, Goose, Copilot CLI:** after the shared setup path is proven.
6. **Kimi Code CLI and standalone Deep Code:** parked until a real hook/API/
   transcript evidence source exists.

## Certification gate

An adapter is `Verified` only when all of these are recorded in a sanitized
artifact: real version; real setup; real edit event; broker processed it;
correct backend row; idempotent retry; correct multi-file behavior; and no
personal data. Fixtures and unit tests alone can never promote an adapter.
The diagnostics endpoint also downgrades a client-only `Verified` claim until
that certification artifact is attached server-side.

Every adapter must also pass malformed-event, retry/offline queue, dedup,
stale-manifest and privacy checks. If authentication blocks a live run, retain
`Unverified` and document the blocker.

## Test gates and push order

Run Rust format/clippy/tests, VS Code compile/lint/tests and generated-resource
checks, frontend typecheck/lint/tests/build, installer syntax and repeated
install/setup/uninstall checks before each push. Audit duration totals and
verify diagnostics toggling leaves heartbeat/duration bytes unchanged.

Push order: **P0 policy/ADR → P1 diagnostics boundary → P2 setup/onboarding →
Gemini → Kilo → Cursor → surveyed adapters**. The inference engine,
filesystem/process correlation and shadow corpus stay on research references;
they are not production attribution code.

## Related records

- [`ai-coverage-execution-plan.md`](ai-coverage-execution-plan.md) — detailed
  execution plan derived from the 2026-09-05 coverage audit, including contracts,
  dependencies, rollout and rollback. It elaborates this roadmap; it is not a
  claim that the planned implementation or live certification is complete.
- [`ai-coverage-task-ledger.md`](ai-coverage-task-ledger.md) — actionable work
  packages and acceptance criteria, initially all planned.
- [`ai-coverage-validation-plan.md`](ai-coverage-validation-plan.md) — scenario
  matrix, proposed measurement targets and real-runtime certification procedure.
- [`decision-accuracy-over-coverage.md`](decision-accuracy-over-coverage.md) —
  rationale/ADR.
- [`plan-accuracy-first-coverage.md`](plan-accuracy-first-coverage.md) —
  historical phase detail, superseded by this roadmap.
- [`legacy-plan-index.md`](legacy-plan-index.md) — disposition of older plans.
- Adapter setup/certification ledgers are evidence records, not alternate
  roadmaps.
