# plan-phase8.md Execution Tracker — Production Wiring + Zero-Touch Setup

**Durable state of the Phase 8 build.** Read top to bottom, then act. Source plan
is [`plan-phase8.md`](plan-phase8.md).

---

## Run parameters

| Parameter | Value |
|---|---|
| Worktree | `.worktrees/phase8` (isolated from the concurrent session editing the main worktree) |
| Branch | `phase8/production-wiring`, based on `integration/all-branches-2026-09-02` (`36f58e4` — has planai2 Phases 0–7 **and** planplugin Phases 0–5) |
| Base is stale by | the concurrent session's uncommitted `TransportKind` test fixes — pulled in as p8.0 below |
| Git per item | one commit per closed item: `feat(phase8-p8.M): ...`. `git add` only that item's files. Footer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. |
| Push / PR | ask before pushing |
| When blocked on a real tool not installed | scaffold + mark `unverified` in code + `VERIFICATION.md`, move on. `[~]` never `[x]`. |

---

## Gates — every item before it can be ticked

From `.worktrees/phase8/backend/api`:

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Baseline at p8.0 (`303` wakaclock-core lib tests, workspace green, clippy clean).

### Conditional gates

**Touches heartbeat / duration / attribution** (≈ every Track A item) — from repo root:

```bash
python3 scripts/duration-audit/verify_port.py
python3 scripts/duration-audit/golden.py          # MUST stay total_error: 0.0
python3 scripts/duration-audit/verify_actor_migration.py
python3 scripts/duration-audit/verify_certification.py
```

**Touches `extensions/vscode/`** — `cd extensions/vscode && npm run lint && npm test`
**Touches `frontend/app/`** — `cd frontend/app && npm run validate`

---

## Hard invariants — never violate

- **Metadata only.** No prompt / response / source / patch-diff body / command
  args / terminal output / clipboard / arbitrary unknown fields.
- `RAW_FILE_CHANGE_WITHOUT_PROVENANCE != HUMAN` · `PROCESS_RUNNING != AI_FILE_EDIT`
  · `CONFLICTING_EVIDENCE != HUMAN`.
- **Duration never regresses** — `golden.py` `total_error: 0.0` every item.
- fixture ≠ live verification (planai2.md line 604). Live-blocked adapter is
  `[~] scaffolded`, never `[x]`.
- offline replay reuses event identity, adds no total.
- **Never write another tool's config without consent** (Track B).
- The engine runs **client-side in the broker** (p8.0 DECISION). Server
  `resolve_attribution` / `ActorType` wire contract is untouched.
- Concurrent session is still editing the **main** worktree. This worktree is
  isolated; do not reach into the main tree except read-only.

---

## Run Definition of Done

1. Every non-blocked item `[x]` with its named test present and passing.
2. Live-blocked items `[~]`, in `VERIFICATION.md`.
3. Full gate suite green at the final commit.
4. **p8.A1 passes end-to-end** — `observe_only` heartbeats byte-identical to
   observer-off (this is the whole point; it retires p7.A1's module-contract
   caveat).
5. `infer` is **not** enabled by default — it flips only per-agent/per-platform
   after p8.6's precision gate passes on a real labelled corpus.

---

## Loop protocol — one iteration

1. Read this whole file. Note "Current position".
2. If the current phase has an unresolved `DECISION:` item, resolve it: write
   into **Decisions log**, commit `docs(phase8-p8.0): ...`, end iteration.
3. Pick the first `[ ]` item in the lowest-numbered incomplete section.
4. Read the `.context/` files it triggers.
5. Implement it. Add/extend the **named test(s)**.
6. Run gates (global + conditional). All green required.
7. `git add <this item's files>` then commit `feat(phase8-p8.M): ...`.
8. Tick the box, append `→ <sha> | tests: <names> | gates: green`.
9. Update **Current position** and append to **Iteration log**.
10. If Run DoD met, stop.

Box legend: `[ ]` todo · `[x]` done+verified · `[~]` scaffolded, live owed · `BLOCKED:`.

---

## Current position

**p8.0 + p8.1 done.** Next: **p8.2 — broker correlation pass** (wire `intake` +
`CorrelationEngine::verdict_for_within` into the `wakaclock-cli/src/broker.rs`
poll loop, bounded).

Track A (p8.2 → p8.6) is the critical path and must go in order through p8.3
(shadow gate) before p8.4 (canonical emit). Track B (p8.7 → p8.10) can start
after p8.1. Do **not** flip `infer` before p8.6's gate passes.

**Note on `broker.rs` (cli):** heavily churned by the concurrent session in the
**main** worktree. This worktree (`.worktrees/phase8`) is isolated — edit
freely; reconciliation happens at merge time, not now.

---

## Sections

### Blocker

- [x] **p8.0 Clear the concurrent `TransportKind` rework blocker.** The base branch carried the concurrent session's mid-refactor `TransportKind` snapshot (`"shell_hook"` moved `NativePlugin`→`ToolSnapshot`, new `process_observer`⇒`Other` / `ide_telemetry`⇒`Editor` arms) with 2 stale test assertions. Pulled in the concurrent session's own fixes: `ai/dedup.rs` p6_a2 fixture hook transport `"shell_hook"`→`"native_plugin"`; `broker.rs` `transport_kind_ranks…` assertion `NativePlugin`→`ToolSnapshot`. Both are test-only, no logic change.
  - Tests: `broker::tests::transport_kind_ranks_producers_by_evidence_strength`, `ai::dedup::tests::p6_a2_vscode_hook_transcript_and_filesystem_evidence_for_one_edit_is_one_activity` — both green (wakaclock-core lib 301→303).

### Track A — Wire the engine into production

- [x] **p8.1 Evidence intake adapter.** `wakaclock-core/src/ai/intake.rs` — `from_broker_event` / `from_file_change` / `from_session_evidence` / `from_editor_input`, all → `CorrelationInput`, collected in `IntakeBatch { inputs, drops }`. Broker transport → `EvidenceKind` via `TransportKind::classify` with a `source`-field fallback for `Cli`/`Other`. Malformed (no entity) → `IntakeDrop { lineage_id, reason }` (content-free), **never patched**. `evidence_strength` carried through so the engine decides `is_strong_enough_to_infer`, not the producer.
  - → `d3d18e7` | tests (5, core 303→308): `every_producer_shape_maps_to_a_correlation_input_with_its_lineage`, `transport_drives_the_evidence_kind_with_a_source_fallback`, `an_intake_record_carries_no_content_field`, `a_malformed_producer_record_is_dropped_not_guessed`, `a_non_file_change_broker_event_is_dropped` | gates: fmt/clippy/test --workspace green; duration-audit golden (total_error 0.0) / verify_port green.
- [ ] **p8.2 Broker correlation pass.** `wakaclock-cli/src/broker.rs` poll loop — after transcript auto-scan, gather in-window evidence → `intake` → `CorrelationEngine::ingest` → `verdict_for_within(entity, at, ClipBounds::utc_day(at))` → `Vec<(entity, Verdict)>`. Bounded per poll (`BoundedEventBuffer` pattern); engine rebuilt each poll (state lives in the inbox).
  - Tests: `a_poll_with_mixed_evidence_produces_one_verdict_per_entity`, `an_empty_poll_is_a_no_op`, `the_correlation_pass_is_bounded_under_a_file_storm`.
- [ ] **p8.3 Shadow gate at the emit boundary.** `shadow::observe()` between verdict and heartbeat. `ObserverConfig` from `~/.wakaclock/observer.toml` (absent = Default = off). Kill switches checked at **intake**. `observe_only` → `ShadowRecord` to a bounded rotating `shadow_log` in broker SQLite, **no new heartbeat, no change to existing**. `infer` → verdict becomes `actor_type`.
  - Tests: `p8_a1_observe_only_emits_byte_identical_heartbeats_to_observer_off` (**the key test** — diff the whole heartbeat JSON set, observer-off vs observe_only, byte-equal), `flipping_to_infer_is_the_only_switch_that_emits_a_correlated_actor_type`, `a_killed_source_never_reaches_the_engine`.
- [ ] **p8.4 Canonical heartbeat emission.** N evidence → `DedupObservation` (fingerprint `CanonicalFingerprint::v1`) → `dedup()` → 1 heartbeat per `CanonicalActivity` (`actor_type` = verdict, seconds = strongest obs). Legacy direct-emit **disabled under the same flag** — no parallel double-emit. `conflicts` → diagnostic, no overwrite.
  - Tests: `one_edit_seen_by_four_producers_emits_exactly_one_heartbeat`, `a_multi_file_tool_call_keeps_its_interval_on_the_first_record_only`, `restart_and_replay_emit_no_additional_heartbeat`. **Duration gate mandatory.**
- [ ] **p8.5 Pipeline observability + close p7.2c.** `PipelineTracker::observe()` at all 7 real stages. `snapshot()` into `doctor ai --json`. `doctor ai` calls `report_from_doctor_json()` + `api_client.send_ai_diagnostics()` (the owed p7.2c call site) → the dashboard `AiDiagnosticsPanel` gets real data.
  - Tests: `every_pipeline_stage_is_observed_on_a_real_delivery`, `a_rejected_delivery_lands_on_the_rejected_stage`, `doctor_ai_pushes_a_diagnostics_report`.
- [ ] **p8.6 Labelled shadow corpus + precision gate.** New `ai/shadow_corpus.rs` — build `ShadowRecord` with non-circular `ground_truth` from tool-call scope (hook reports one tool call touching N files → per-file-direct-evidence files = `ai_verified` proposal, the rest = `ai_inferred` proposal, label `Ai` from the tool-call manifest; keystroke-logged editor session → label `Human`). New `wakaclock ai shadow-report --json` → `ShadowComparisonReport`. Gate for flipping `infer`: inference precision ≥ 99%, unknown→human = 0%, native recall reported **separately**, duplicate canonical activity < 0.1%.
  - Tests: `the_corpus_labels_come_from_tool_call_scope_not_from_the_proposal`, `precision_and_native_recall_stay_two_numbers`, `the_gate_refuses_infer_below_the_precision_bar`.

### Track B — Zero-touch setup

- [ ] **p8.7 Workspace auto-registration.** Each poll: `scan_ai_processes()` → per `DetectedAiProcess.cwd` find git root → `WorkspaceRegistry::register(root, "process-observer", ttl)`. Guard rails: never `$HOME` / `/` / `/tmp` / non-git-root; cap concurrent workspaces; lease expires when the process is gone.
  - Tests: `an_agent_running_in_an_unregistered_repo_registers_that_root`, `home_and_filesystem_root_are_never_registered`, `the_lease_expires_when_the_agent_process_is_gone`, `auto_registration_is_bounded_to_n_workspaces`.
- [ ] **p8.8 Broker auto-setup of native hooks.** Each poll (throttled ~10min): `AdapterRegistry::builtin()` → agent detected but unhooked / stale hook path → idempotent install (planplugin's config-preserving mechanism). **Consent invariant:** `wakaclock.autoInstallAgentHooks` default true, but first write needs a prompt (`ai setup --yes`); opt-out is permanent per agent; every write is audited and shown in `doctor ai`.
  - Tests: `a_detected_unhooked_agent_is_installed_once_then_is_a_no_op`, `an_opted_out_agent_config_is_never_written`, `unrelated_user_config_keys_survive_the_managed_block`, `a_stale_hook_path_is_repaired_in_place`.
- [ ] **p8.9 Extension zero-touch onboarding.** VS Code: activate → API key present → `ensureBrokerRunning()` → one consent prompt → everything background. Status only in the AI Stats page + status bar.
  - Tests: `activation_with_a_key_starts_the_broker_and_asks_consent_once`, `declining_consent_still_tracks_editor_activity`.
- [ ] **p8.10 Standalone installer.** `curl … | sh` + Homebrew formula → install `wakaclock` + register broker as a login service (planplugin Phase 0 mechanism). After that, p8.7 + p8.8 make it equivalent to the extension path.
  - Tests: `the_installer_registers_a_login_service_idempotently`.

### Acceptance criteria

- [ ] **p8.A1** `observe_only` emits byte-identical heartbeat/analytics output to observer-off — **end-to-end** (retires p7.A1's caveat).
- [ ] **p8.A2** A hookless agent (Codex CLI in a terminal) in an auto-registered folder → real `ai_inferred` down to a backend row.
- [ ] **p8.A3** One edit seen by hook + transcript + filesystem + editor → 1 heartbeat, 1 duration point end-to-end; `golden.py total_error 0.0`.
- [ ] **p8.A4** restart / replay adds no duration and no backend row.
- [ ] **p8.A5** On a labelled corpus: precision ≥ 99%, AI false positive < 1%, unknown→human = 0%, native recall reported separately.
- [ ] **p8.A6** Rollback = flip `attribution_mode` back to `observe_only` — no migration, no data deleted; auto-setup opt-out leaves agent configs untouched.

---

## Decisions log

_(Append as `DECISION:` items resolve. Newest last: date, id, decision, rationale, files, SHA.)_

### 2026-09-02 — p8.0 — engine runs client-side in the broker

Resolved in `plan-phase8.md` §p8.0. Three of §5's four evidence kinds
(filesystem observer, process/session observer, editor input) exist **only on
the user's machine** — the server never sees them (same reason p7.2c needed a
client→server push). `correlation_engine.rs` / `dedup.rs` / `shadow.rs` /
`WorkspaceRegistry` / `ObserverPool` / `scan_ai_processes` are already in
`wakaclock-core` (the client crate), and the broker is an always-on runtime with
a durable SQLite inbox + retry/dead-letter. Consequence: the **server needs no
attribution change** — `resolve_attribution` keeps owning `ActorType` on the
wire; the broker just delivers an already-correlated `actor_type`.

---

## Iteration log

- 2026-09-02 — p8.0 — done. Created isolated worktree `.worktrees/phase8` on `phase8/production-wiring` off `integration/all-branches-2026-09-02` (`36f58e4`). Base carried the concurrent session's mid-refactor `TransportKind` snapshot with 2 stale test assertions; pulled in the concurrent session's own fixes (`dedup.rs` p6_a2 fixture, `broker.rs` `transport_kind_ranks…` assertion — test-only). wakaclock-core lib 301→303 green, fmt clean, clippy clean, `golden.py` total_error 0.0. Commit `1169c4d`.
- 2026-09-02 — p8.1 — done. `ai/intake.rs`: four mapper fns → `CorrelationInput`, `IntakeBatch { inputs, drops }`. `broker_evidence_kind()` = `TransportKind::classify` → `EvidenceKind` with a `source` fallback for `Cli`/`Other`. Never guesses — no-entity records become content-free `IntakeDrop`. 5 tests, core 303→308. Gates + duration-audit (total_error 0.0) green. Commit `d3d18e7`.
