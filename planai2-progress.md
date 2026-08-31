# planai2.md Execution Tracker — Universal AI Detection

**This file is the durable state of an autonomous `/loop` run.** It must be
self-sufficient for a cold-context agent: read it top to bottom, then act. The
source plan is [`planai2.md`](planai2.md) (untracked, do not commit it).

---

## Run parameters (decided by the user 2026-08-31, do not re-ask)

| Parameter | Value |
|---|---|
| Branch | `planai2/universal-ai-detection` — **never touch `main` or the old integration branch** |
| Baseline commit | `d95bb002f638210582d61fc2302c56141963f808` (pre-existing uncommitted WIP, not authored by this run) |
| Git per item | One commit per closed item: `feat(planai2-pN.M): ...` / `test(...)` / `refactor(...)`. Footer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. **`git add` only that item's files — never `git add -A` again.** |
| Push / PR | **No.** Commit locally only. |
| When blocked on a real tool that isn't installed | Scaffold the code, mark it `unverified` / `scaffold` in code **and** in the adapter manifest, record the missing live check in `backend/api/crates/wakaclock-core/src/ai/VERIFICATION.md`, then move on. |
| Reporting | Run continuously, no pause for review. |
| Loop pacing | Self-paced (`ScheduleWakeup` dynamic mode). |

---

## Gates — every item must pass these before it can be ticked

Run from `backend/api`:

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Baseline result at `d95bb00` (for "did I break it or was it already broken?"):
`cargo test --workspace` = **365 passed / 0 failed / 7 ignored** (the 7 need
`CLICKHOUSE_TEST_URL` / `POSTGRES_TEST_URL`; leave them ignored). clippy clean,
fmt clean.

### Conditional gates

**If the item touches heartbeat generation, duration, or actor attribution**, also run from repo root:

```bash
python3 scripts/duration-audit/verify_port.py
python3 scripts/duration-audit/golden.py
python3 scripts/duration-audit/verify_actor_migration.py
python3 scripts/duration-audit/verify_certification.py
```

All four pass at baseline. `golden.py` must stay `total_error: 0.0`.
`verify_certification.py` reads `scripts/duration-audit/certifications/latest.json`
— do **not** edit that file; it is a sealed certification artifact.

**If the item touches `frontend/app/`**, also:

```bash
cd frontend/app && npm run validate
```

Baseline: 211 passed / 38 files, exit 0.

**If the item touches `extensions/vscode/`**, also:

```bash
cd extensions/vscode && npm test
```

---

## Hard invariants (from CLAUDE.md + planai2.md privacy contract) — never violate

- **Never store or log**: prompt, response, source code, patch/diff content,
  clipboard, terminal output, command arguments, arbitrary unknown fields.
  Metadata only crosses every producer boundary.
- `RAW_FILE_CHANGE_WITHOUT_PROVENANCE != HUMAN`. `PROCESS_RUNNING != AI_FILE_EDIT`.
  `CONFLICTING_EVIDENCE != HUMAN`.
- Handlers never touch the DB (handler → service → repository).
- Never trust a client-supplied `user_id` — identity only from `auth::resolve_user_id`.
- Every TanStack Query key includes `userId`.
- Backend migrations run in code, in order, from `main.rs` — do not reorder.
- Do not copy patterns from the dead e-commerce tree (`src_ecommerce_backup/`,
  and see `.context/dead-code.md`).
- Read the `.context/` file a task triggers (CLAUDE.md routing table) **before**
  editing, not after. Backend edits → `.context/dead-code.md` first.
- Phase numbers here are **planai2**. Existing code comments say `planai.md Phase N`
  — a different plan. Always write `planai2-pN.M` in commits and new comments.

---

## Run Definition of Done

The loop stops when **all** of:

1. Every non-blocked item below is `[x]` with its named invariant test present and passing.
2. Every item blocked on live verification of a tool not installed on this
   machine is `[~]` (scaffolded), marked `unverified` in code + manifest, and
   listed in `VERIFICATION.md` with the exact live check still owed.
3. Full gate suite green at the final commit.

**planai2.md line 604 is binding**: a fixture or synthetic payload is *not* live
verification. A live-blocked adapter is `[~] scaffolded`, never `[x] done`.

---

## Loop protocol — one iteration

1. Read this whole file. Note "Current position".
2. If the current phase has an unresolved `DECISION:` item, resolve it now:
   write the decision + rationale into **Decisions log**, commit
   `docs(planai2-pN.0): ...`, end iteration.
3. Pick the first `[ ]` item in the lowest-numbered incomplete phase.
4. Read the `.context/` files it triggers. If a file contradicts the plan, the file wins — note the conflict.
5. Implement it. Add/extend the **named test(s)** listed on the item.
6. Run gates (global + conditional). All green required.
   - If a gate fails and you can't fix it this iteration: `git checkout -- .`
     and `git clean -fd` the item's new files, write a `BLOCKED:` note under the
     item, move to the next item.
7. `git add <this item's files>` then commit with the `planai2-pN.M` prefix.
8. Tick the box, append an evidence line: `→ <sha> | tests: <names> | gates: green`.
9. Update **Current position** and append to **Iteration log**.
10. If Run DoD is met, stop the loop (`ScheduleWakeup stop:true`).

Box legend: `[ ]` todo · `[x]` done+verified · `[~]` scaffolded, live-verification owed · `BLOCKED:` needs attention.

---

## Current position

**Phase 0 — item p0.2b** (VS Code broker fallback hardening), then p0.3. p0.1 +
p0.2 done. Baseline `d95bb00` already contains substantial prior Phase 0 work
(doctor ai, codex `response_item`, observer scaffolds) — each p0 item is
**audit + finish + test**, not build-from-zero.

---

# Phase 0 — Runtime Recovery and Diagnostics

Goal: make existing capability actually work and be inspectable before any inference layer.

- [x] **p0.1 Single CLI identity.** `wakaclock status --json` reports build/version/commit SHA. Detect + warn when CLI paths (VS Code managed, shell `PATH`, hook scripts, OS service) point at different versions. Migrate service manifests using the old `agent` alias to `broker run`.
  - Tests: `wakaclock-cli` unit test that `status --json` carries a non-empty version+SHA; a test that mismatched paths produce a warning, matched paths do not (baseline already has `ai_doctor_tests` around path mismatch — extend, don't duplicate).
  - → `3201b92` | added `build.rs` (bakes `WAKACLOCK_GIT_SHA`/`WAKACLOCK_BUILD_TIME`, degrades to `"unknown"` off-checkout); `wakaclock status --json` now emits `version`/`git_sha`/`build_time`/`cli_path{path_mismatch,version_mismatch}`/`legacy_service_alias`; `binary_version()` runs the on-PATH binary with `--version` only when paths already differ; text mode prints `warning:` lines; `doctor ai` gained the same identity block; `agent_service::{content_uses_legacy_alias,manifest_uses_legacy_alias,migrate_legacy_service_manifest}` + `broker start` opportunistically migrates a legacy `agent run` manifest. tests: `build_identity_is_always_populated`, `cli_path_report_warns_on_path_and_version_drift_only`, `detects_the_legacy_agent_run_alias_on_every_platform`, `a_current_broker_run_manifest_is_not_flagged` | gates: fmt/clippy/`cargo test --workspace` green (cli 29→33). Live: on this machine `status --json` correctly reported `git_sha f67a0f7…-dirty`, `legacy_service_alias: true` (real stale LaunchAgent), and `flush_stopped_because: HTTP 402` separated from `key_check: verified`.
- [x] **p0.2 Broker lifecycle.** Idempotent install/start on launchd, systemd user service, Windows Task Scheduler. Singleton lock prevents duplicate brokers. VS Code falls back to an extension-owned broker when the user service is unavailable. A CLI update must not leave a service manifest pointing at an old binary.
  - Tests: idempotent install called twice = one service definition, no error; singleton lock rejects a second broker; stale-manifest detection test.
  - → committed | Extracted the per-platform manifest bytes into a pure `manifest_content(executable, log_path)` (macOS/linux/windows + stub), so `install()` writes one deterministic definition; the existing launchctl bootout→bootstrap / `systemctl enable --now` / `schtasks /F` were already idempotent. Added `executable_in_manifest()` + `manifest_points_at_stale_binary()` (canonical-path compare vs `current_exe()`; a manifest path that no longer resolves counts as stale) surfaced as `stale_service_binary` in `status --json`/text and `doctor ai`, and folded into `migrate_legacy_service_manifest()` so `broker start` repoints a drifted manifest too. `AgentLock::acquire()` refactored to `acquire_at(path)` for testability. tests: `install_manifest_is_deterministic_and_has_exactly_one_broker_run`, `executable_path_round_trips_out_of_every_manifest_shape`, `singleton_lock_rejects_a_second_broker_and_reclaims_a_dead_one` (cli 33→36). VS Code extension-owned-broker fallback already exists (`cli.ts startExtensionOwnedAgent` + `commands.ts` fallback on install failure for remote/linux) — hardening it to check `getBrokerStatus().running` on all platforms is split to **p0.2b** below.
- [ ] **p0.2b VS Code broker fallback hardening.** After `broker install`, check `getBrokerStatus().running`; if the service is not actually running, start the extension-owned broker as a fallback — on every platform, not only remote/linux, and not only when `installAgent()` throws. Touches `extensions/vscode/src/` (+ recompiled `out/`).
  - Tests: `extensions/vscode` test that a non-running post-install status triggers `startExtensionOwnedAgent`; `npm test` green.

- [ ] **p0.3 Codex integration migration.** AtoAxis Codex plugin package in the current native plugin layout. Migrate the legacy direct TOML hook block without deleting user config. Idempotent install/upgrade. Detect hook enabled/trusted and surface a manual action when the platform forces user trust. Hook path points at a stable managed directory, never a VSIX/worktree path.
  - Tests: migration preserves unrelated user TOML keys; install twice = idempotent; hook path assertion is not under a temp/worktree dir.
- [ ] **p0.4 Transcript scanner recovery.** Scanner autostarts, resumes from its cursor, follows a growing transcript. Exposes `file_size`, `cursor_offset`, `lag_bytes`, `last_scan_at`, `last_event_at`. An unsupported format/schema emits a diagnostic instead of silently reporting zero events. One agent's parser failure does not stop the others.
  - Tests: cursor resume across a re-open; growing-file follow; unsupported-format → diagnostic (not `Ok(0 events)`); per-agent isolation (one bad transcript, others still parse).
- [ ] **p0.5 `wakaclock doctor ai --json`.** Audit the baseline implementation against planai2.md §0.5. It must report: CLI path/version mismatch; broker installed/running/version; adapter detected/installed/enabled/trusted; latest native-hook event; latest transcript mtime + parser cursor lag; broker inbox pending/retry/dead-letter; outbound queue depth; backend delivery result split into `401` / `402` / network / validation; stale hook/plugin path. Add whatever's missing.
  - Tests: a doctor-report test asserting every required field key is present; `402` is reported distinctly from `401` and from network failure.

### Phase 0 acceptance criteria — encode as named tests

- [ ] **p0.A1** One Codex Desktop `apply_patch` reaches the local broker **exactly once** (external-process test).
- [ ] **p0.A2** Broker stop → restart loses no event (broker restart/replay test).
- [ ] **p0.A3** Backend offline / HTTP 402 → event still shows `captured locally` and sits in the queue; detection/local-capture is not marked failed.
- [ ] **p0.A4** `doctor ai` alone identifies each pipeline gap (missing broker / stale hook / parser lag / delivery 402) without opening other logs.

---

# Phase 1 — Canonical Evidence Contract and Adapter Registry

Goal: new agents connect through one contract; no attribution logic scattered across shell scripts or editor extensions.

- [ ] **p1.0 DECISION: evidence-metadata envelope shape.** Decide the exact extension of `BrokerEventV1` (see `backend/api/crates/wakaclock-core/src/broker.rs` + `src/ai/event.rs`). Target fields from planai2.md: `schema_version`, `event_type`, `event_id`, `occurred_at`, `entity`, `project_root`, `change_kind`, `agent`, `provider`, `model`, `session_id`, `tool_event_id`, `source`, `transport`, `confidence`, `lines_added`, `lines_deleted`. Decide: additive vs new version; which fields are optional; how `confidence` enum relates to the existing `AiConfidence`. Write decision + rationale in **Decisions log**, then commit `docs(planai2-p1.0)`.
- [ ] **p1.1 Implement the envelope.** Extend the broker event / evidence type with the agreed fields. Backward-compatible: old envelopes still deserialize.
  - Tests: round-trip serde of a full envelope; an old-shape envelope still parses; `schema_version` gate.
- [ ] **p1.2 Field allow-list enforcement.** Unknown fields and forbidden content (prompt/response/patch/clipboard/terminal/command args) are rejected or quarantined with a sanitized diagnostic that contains none of the offending content.
  - Tests: envelope with a `prompt` field → quarantined, diagnostic has no prompt text; unknown field → rejected.
- [ ] **p1.3 Declarative adapter manifest type.** One manifest per agent: `id`, `provider`, executable detection, install strategy, native hook capabilities, transcript roots, payload schema versions, supported tool/change kinds, `verification_status` (`verified` | `scaffold` | `unverified`), health probe.
  - Tests: manifest serde; `verification_status` defaults to `unverified`; a manifest with no live verification cannot report `verified`.
- [ ] **p1.4 Adapter registry.** Enumerates manifests, drives install + health probe. Installer is atomic, idempotent, and preserves user configuration.
  - Tests: register a fake test adapter and drive it end to end **without editing correlation or heartbeat code** (this is acceptance p1.A1); install twice = idempotent; install preserves a pre-existing unrelated config key.
- [ ] **p1.5 Migrate VS Code installer.** Move installation logic from `extensions/vscode/src/agentSetup.ts` to consume the registry. No behavior regression.
  - Tests: `extensions/vscode` test that setup still installs the Claude + Codex adapters; VS Code `npm test` green.

### Phase 1 acceptance criteria — named tests

- [ ] **p1.A1** A new test adapter is added with zero changes to correlation/heartbeat code.
- [ ] **p1.A2** An adapter not live-verified renders as `scaffold` / `unverified` everywhere it's surfaced.
- [ ] **p1.A3** An unknown payload schema is quarantined with a sanitized diagnostic.
- [ ] **p1.A4** Every adapter emits the same metadata shape into the broker.

---

# Phase 2 — Direct Evidence First

Goal: raise recall through trustworthy evidence before any universal inference.

- [ ] **p2.1 Producer priority.** Enforce the ordering in code: native hooks/plugins > structured MCP events > completed transcript tool calls > before/after tool snapshot > filesystem/session inference. Higher-priority evidence for the same change supersedes lower.
  - Tests: given two evidence records for one change, the resolved producer is the higher-priority one; ordering table test.
- [ ] **p2.2 Generic MCP / tool ingress.** Keep `wakaclock ai emit --json`, `ai tool-before`, `ai tool-after`. Add an HTTP/SDK helper that reads broker discovery + token safely. Support operations: write, apply patch, create, move, rename, delete, replace, multi-edit, shell mutation. **One tool call touching N files = one duration interval + N file-evidence records.**
  - Tests: a 3-file `apply_patch` → 1 interval, 3 evidence records; each operation kind maps to a `change_kind`; discovery/token read never logs the token.
- [ ] **p2.3 Adapter rollout.** Per planai2.md order. Codex Desktop/CLI + Claude Code: keep/verify. Gemini CLI, Cursor, Antigravity, Copilot CLI/IDE, Windsurf, Cline/Roo, OpenCode, Generic MCP producer SDK: **not installed on this machine → scaffold + `unverified` + VERIFICATION.md note.** Cursor stays `scaffold` until a real payload is seen.
  - Tests: each scaffolded adapter has a manifest with `verification_status: unverified` and a fixture-shaped parse test that is explicitly labelled "fixture only, not live".

### Phase 2 acceptance criteria — named tests

- [ ] **p2.A1** Known native-adapter recall ≥ 99% measured against the fixture corpus (record the number).
- [ ] **p2.A2** A hook event and a transcript event for the same edit collapse to one canonical event.
- [ ] **p2.A3** A failed tool call never produces a `verified` edit.
- [ ] **p2.A4** Real-payload verification status is recorded in `VERIFICATION.md` / the capability matrix for every adapter (verified or "blocked, no local tool").

---

# Phase 3 — Workspace Registry and Universal Filesystem Observer

- [ ] **p3.1 Workspace lease registry.** Producers register a lease: `workspace_id`, `canonical_root`, `producer_id`, `pid`/`session_id`, `registered_at`, `last_seen_at`, `expires_at`, exclude rules. VS Code, agent sessions, and the CLI refresh their lease periodically. When every lease for a workspace expires, watching that workspace stops. The broker **never** watches the whole home directory.
  - Tests: register → lease present; no refresh → expires → workspace no longer watched; refresh keeps it alive; two producers, one leaves, watch continues.
- [ ] **p3.2 Wire the filesystem observer to the registry.** `filesystem_observer.rs` watches only registered workspace roots.
  - Tests: a change under an unregistered path yields no event; under a registered path yields one.
- [ ] **p3.3 Observer semantics.** create / modify / rename / delete. Coalesce duplicate/atomic-save events into one logical change. Canonicalize paths; block symlink escape. Respect `.gitignore`, user excludes, generated/build/vendor dirs. Fingerprint only files that had an event (reuse the git blob/content hashing in `wakaclock-cli/src/tool_snapshot.rs`) — never scan/hash the whole repo per tick. Never read or persist source content.
  - Tests: editor atomic save (write temp + rename) → **one** logical change; rename normalized to a rename not delete+create; a `.gitignore`d path produces nothing; symlink pointing outside the workspace is rejected; assert no file *content* is ever held in a struct field.
- [ ] **p3.4 Backpressure.** An event storm has bounded memory and applies backpressure. Idle CPU and memory stay within a stated budget (write the budget into the test).
  - Tests: 10k synthetic events → bounded channel, no unbounded `Vec` growth; idle loop does no work.

### Phase 3 acceptance criteria — named tests

- [ ] **p3.A1** The watcher runs only for registered workspaces.
- [ ] **p3.A2** An editor atomic save creates a single logical change.
- [ ] **p3.A3** rename / delete / create are normalized correctly.
- [ ] **p3.A4** An event storm stays within bounded memory / backpressure.
- [ ] **p3.A5** **A filesystem event on its own resolves to `unknown`** — never `human`, never `ai_*`.

---

# Phase 4 — Agent Session and Process Evidence

Session/process is corroborating evidence, never a verdict that AI edited a file.

- [ ] **p4.1 Session/process evidence model.** Fields: `pid`/`ppid`, process identity, `agent`/`provider`, `workspace`, `session_id`, `tool_event_id`, `started_at`, `last_activity_at`, `ended_at`, evidence strength. **No command arguments, no environment secrets.**
  - Tests: serde round-trip; a construction path that would capture argv is rejected/absent at the type level.
- [ ] **p4.2 Wire `process_observer.rs` + reliability tiers.** Normalize detections into evidence with strength: native session/tool lifecycle > appending transcript with session/workspace metadata > child process spawned from a known agent tool call > process tree + exact cwd/workspace match > process name only (weak telemetry).
  - Tests: exact workspace/session match outranks a process-name-only match; process-name-only never reaches `ai_inferred` strength.
- [ ] **p4.3 Session lifecycle.** Process exit/crash closes the session without using `now` to extend duration unbounded.
  - Tests: kill a tracked pid → session `ended_at` set, duration is bounded by `last_activity_at`, not wall-clock now.

### Phase 4 acceptance criteria — named tests

- [ ] **p4.A1** Process/session evidence never produces a heartbeat on its own.
- [ ] **p4.A2** An exact workspace/session match scores higher than a process-name match.
- [ ] **p4.A3** Multiple AI tools active + no direct match → `unknown`.
- [ ] **p4.A4** Process exit/crash closes the session cleanly (no unbounded duration).

---

# Phase 5 — Universal Correlation Engine

The core that planai.md left "not built".

- [ ] **p5.0 DECISION: named correlation windows.** Each evidence type gets a named window with a stated reason (hook↔transcript, editor↔AI-edit, filesystem↔session, snapshot↔hook, …). **No single shared constant.** Write the table + rationale in **Decisions log**, commit `docs(planai2-p5.0)`.
- [ ] **p5.1 Unified evidence intake.** One correlation input stream fed by every producer: native hook, structured MCP, completed transcript tool call, before/after snapshot, filesystem observer, session/process observer, editor input. (Extends `correlation.rs`, which today only matches AI events to editor buffers.)
  - Tests: each producer type can be pushed into the engine; intake preserves lineage IDs.
- [ ] **p5.2 Decision rules — exactly as planai2.md §5 states them.**
  - `ai_verified` ⇐ `NativeHook(file)` OR `StructuredMcpWrite(file)` OR `CompletedStructuredToolCall(file)`.
  - `ai_inferred` ⇐ `FileChanged(file)` AND `RecentAgentToolOrSession(workspace)` AND `TimeWindowMatches` AND `FingerprintOrChangeShapeMatches` AND `NoCompetingAgentEvidence`. **Process name alone is insufficient.**
  - `human` ⇐ `PositiveEditorInput(file)` AND `CorrelationWindowClosed` AND `NoConflictingAiEvidence`.
  - `unknown` ⇐ `FileChangedWithoutSufficientProvenance` OR `ConflictingHumanAndAiEvidence` OR `MultipleCompetingAiSessions`.
  - Tests: one per predicate branch, plus the five acceptance cases below.
- [ ] **p5.3 Boundary clipping.** Evidence is clipped to the query day / session boundary.
  - Tests: an edit spanning midnight is clipped to each day.
- [ ] **p5.4 System actors.** Formatter, build, `git checkout` / `git merge`, codegen get a `system`/`unknown` treatment, not `ai_*`.
  - Tests: a `prettier --write` burst → not `ai_inferred`; a `git merge` touching 40 files → not AI.
- [ ] **p5.5 Confidence + lineage.** Confidence derives from the *evidence combination*, never the agent name. Evidence lineage is retained so a result can be explained after the fact — **without** storing source content.
  - Tests: same agent, different evidence sets → different confidence; a lineage record contains IDs and reasons, no file content.

### Phase 5 acceptance criteria — named tests

- [ ] **p5.A1** `unknown` is never flipped to `human` by the mere absence of AI evidence.
- [ ] **p5.A2** Human input just before an AI edit is not retroactively swallowed by the AI edit.
- [ ] **p5.A3** A simultaneous human/AI conflict is not auto-resolved to `human`.
- [ ] **p5.A4** A shell mutation from an active verified tool session is correctly inferred.
- [ ] **p5.A5** Formatter / git / build never become an AI false positive.

---

# Phase 6 — Dedup and Canonical Heartbeat Generator

**Every item here is duration-gated** (run the four `duration-audit` scripts).

- [ ] **p6.1 Versioned canonical fingerprint.** From: workspace, normalized entity, change kind, bounded timestamp, line delta / content fingerprint, session/tool identity when present. Versioned so the scheme can evolve.
  - Tests: same logical edit from two transports → same fingerprint; a fingerprint-scheme version bump is explicit.
- [ ] **p6.2 Canonical activity aggregates child evidence IDs.** `canonical_event` holds child IDs: native hook / transcript / filesystem / editor.
  - Tests: a canonical activity built from 3 evidence sources lists all 3 child IDs.
- [ ] **p6.3 Dedup rules.** Same `event_id` + same payload → duplicate success (drop). Same `event_id` + different payload → conflict, kept as a diagnostic, **never a silent overwrite**. Different `event_id` + same fingerprint → merge. Weaker inferred evidence is superseded by verified. A multi-file event does not multiply duration by file count. The final heartbeat is generated from a single canonical-activity point.
  - Tests: one per rule; the multi-file case asserts duration is unchanged vs a single-file event of the same interval.

### Phase 6 acceptance criteria — named tests

- [ ] **p6.A1** Duplicate canonical activity rate < 0.1% over the test corpus (record it).
- [ ] **p6.A2** VS Code + hook + transcript + filesystem evidence for one edit → exactly one activity.
- [ ] **p6.A3** Restart / replay adds no duration (re-run the dedup + duration gates).
- [ ] **p6.A4** An evidence conflict is stored as a diagnostic, not silently overwritten.
- [ ] **p6.A5** `golden.py` still `total_error: 0.0`; `verify_port.py` still green.

---

# Phase 7 — Observability, Shadow Mode and Rollout

Duration-gated **and** frontend-gated where it touches `frontend/app/`.

- [ ] **p7.1 Pipeline stage model.** Represent and surface: Agent detected → Adapter installed/trusted → Evidence received → Correlated → Accepted locally → Queued for delivery → Delivered / Rejected. Backend model + API exposure.
  - Tests: a stage-transition test; the API returns the current stage per agent.
- [ ] **p7.2 Diagnostics UI + commands.** `AtoAxis: Test AI Detection`, `AtoAxis: Repair AI Integrations` (VS Code). Broker health/status panel, evidence source/confidence tooltip, parser-lag + stale-adapter warnings (frontend dashboard). 
  - Tests: VS Code command registration test; frontend panel render test with a query key that includes `userId`; `npm run validate` green.
- [ ] **p7.3 Shadow mode.** `observer.enabled` and `observer.attribution_mode = "observe_only" | "infer"`. In `observe_only`: record sanitized proposed attribution and compare against the native-hook oracle; change nothing in production attribution. Kill switch per workspace **and** per evidence source.
  - Tests: in `observe_only`, heartbeat + analytics output is byte-identical to observer-off; a per-source kill switch disables exactly that source; flipping to `infer` is the only thing that changes output.
- [ ] **p7.4 Precision/recall report.** A report comparing proposed (shadow) attribution to verified events, precision reported **separately** from native-adapter recall — never merged into one number.
  - Tests: report generation over a fixture shadow dataset; asserts the two numbers are reported distinctly.

### Phase 7 acceptance criteria — named tests

- [ ] **p7.A1** Observe-only mode does not change current heartbeat / analytics output.
- [ ] **p7.A2** A precision/recall report vs verified events exists and separates precision from recall.
- [ ] **p7.A3** Rollout can be enabled per-agent / per-platform.
- [ ] **p7.A4** Rollback requires no migration and deletes no data.

---

## Decisions log

_(Append here as `DECISION:` items are resolved. Newest last. Each entry: date, id, decision, rationale, files touched, commit SHA.)_

- _none yet_

---

## Iteration log

_(One line per loop iteration: date/time, item id, outcome, commit SHA. Newest last.)_

- 2026-08-31 — setup — baseline verified green (cargo 365 pass, 4 duration gates, frontend 211 pass), branch `planai2/universal-ai-detection` created, WIP snapshot `d95bb00`, this tracker written. Ready to start at p0.1.
- 2026-08-31 — p0.1 — done. build.rs + `status --json` build identity + CLI-path/version drift warnings + legacy `agent run` service-manifest detection & migration. 4 new tests. fmt/clippy/`cargo test --workspace` green. Committed.
- 2026-08-31 — p0.2 — done. Pure `manifest_content()` (idempotent install), `manifest_points_at_stale_binary()` + `stale_service_binary` surfaced in status/doctor + folded into `broker start` self-repair, `AgentLock::acquire_at()` for singleton testability. 3 new tests (cli 33→36). fmt/clippy/`cargo test --workspace` green. Split VS Code fallback hardening → p0.2b. Committed.
