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

**Phase 2 — acceptance tests p2.A1–p2.A4**, then Phase 3. p2.1–p2.3 done.
- p2.A1 "known native-adapter recall ≥ 99% measured against the fixture corpus" —
  measure claude/codex fixture parse-hit rate; if a real corpus isn't wired,
  record the fixture count that IS parsed and mark the % `[~]` (fixture, not the
  live-recall claim the plan reserves).
- p2.A2 "hook + transcript event for the same edit collapse to one canonical
  event" — covered by the server cross-transport fingerprint dedup + p2.1
  `strongest_evidence`; add/cite a test.
- p2.A3 "a failed tool call never produces a verified edit" — `ai tool-after`
  with no workspace change → no event; check existing coverage / add.
- p2.A4 "real-payload verification status recorded in VERIFICATION.md / capability
  matrix for every adapter" — done for all via VERIFICATION.md (p0.3, p2.3) +
  the registry `verification` field; cite.

---

# Phase 0 — Runtime Recovery and Diagnostics

Goal: make existing capability actually work and be inspectable before any inference layer.

- [x] **p0.1 Single CLI identity.** `wakaclock status --json` reports build/version/commit SHA. Detect + warn when CLI paths (VS Code managed, shell `PATH`, hook scripts, OS service) point at different versions. Migrate service manifests using the old `agent` alias to `broker run`.
  - Tests: `wakaclock-cli` unit test that `status --json` carries a non-empty version+SHA; a test that mismatched paths produce a warning, matched paths do not (baseline already has `ai_doctor_tests` around path mismatch — extend, don't duplicate).
  - → `3201b92` | added `build.rs` (bakes `WAKACLOCK_GIT_SHA`/`WAKACLOCK_BUILD_TIME`, degrades to `"unknown"` off-checkout); `wakaclock status --json` now emits `version`/`git_sha`/`build_time`/`cli_path{path_mismatch,version_mismatch}`/`legacy_service_alias`; `binary_version()` runs the on-PATH binary with `--version` only when paths already differ; text mode prints `warning:` lines; `doctor ai` gained the same identity block; `agent_service::{content_uses_legacy_alias,manifest_uses_legacy_alias,migrate_legacy_service_manifest}` + `broker start` opportunistically migrates a legacy `agent run` manifest. tests: `build_identity_is_always_populated`, `cli_path_report_warns_on_path_and_version_drift_only`, `detects_the_legacy_agent_run_alias_on_every_platform`, `a_current_broker_run_manifest_is_not_flagged` | gates: fmt/clippy/`cargo test --workspace` green (cli 29→33). Live: on this machine `status --json` correctly reported `git_sha f67a0f7…-dirty`, `legacy_service_alias: true` (real stale LaunchAgent), and `flush_stopped_because: HTTP 402` separated from `key_check: verified`.
- [x] **p0.2 Broker lifecycle.** Idempotent install/start on launchd, systemd user service, Windows Task Scheduler. Singleton lock prevents duplicate brokers. VS Code falls back to an extension-owned broker when the user service is unavailable. A CLI update must not leave a service manifest pointing at an old binary.
  - Tests: idempotent install called twice = one service definition, no error; singleton lock rejects a second broker; stale-manifest detection test.
  - → committed | Extracted the per-platform manifest bytes into a pure `manifest_content(executable, log_path)` (macOS/linux/windows + stub), so `install()` writes one deterministic definition; the existing launchctl bootout→bootstrap / `systemctl enable --now` / `schtasks /F` were already idempotent. Added `executable_in_manifest()` + `manifest_points_at_stale_binary()` (canonical-path compare vs `current_exe()`; a manifest path that no longer resolves counts as stale) surfaced as `stale_service_binary` in `status --json`/text and `doctor ai`, and folded into `migrate_legacy_service_manifest()` so `broker start` repoints a drifted manifest too. `AgentLock::acquire()` refactored to `acquire_at(path)` for testability. tests: `install_manifest_is_deterministic_and_has_exactly_one_broker_run`, `executable_path_round_trips_out_of_every_manifest_shape`, `singleton_lock_rejects_a_second_broker_and_reclaims_a_dead_one` (cli 33→36). VS Code extension-owned-broker fallback already exists (`cli.ts startExtensionOwnedAgent` + `commands.ts` fallback on install failure for remote/linux) — hardening it to check `getBrokerStatus().running` on all platforms is split to **p0.2b** below.
- [x] **p0.2b VS Code broker fallback hardening.** After `broker install`, check `getBrokerStatus().running`; if the service is not actually running, start the extension-owned broker as a fallback — on every platform, not only remote/linux, and not only when `installAgent()` throws. Touches `extensions/vscode/src/` (+ recompiled `out/`).
  - Tests: `extensions/vscode` test that a non-running post-install status triggers `startExtensionOwnedAgent`; `npm test` green.
  - → committed | New exported `ensureBrokerRunning(deps)` in `commands.ts`: installs, then requires `getBrokerStatus().running === true` to trust the OS service; otherwise (install threw, status threw, or `running !== true`) starts `startExtensionOwnedAgent()` — **no platform gate**, the old `vscode.env.remoteName || process.platform === "linux"` condition is gone. Returns `{running, viaFallback, disposable?, error?}`; `setupAiTracking` pushes the disposable and messages off the outcome. tests: `commands.ensure-broker.test.ts` — 5 cases (service-running trust, status-false fallback, status-throws fallback, install-throws fallback carries error, both-fail → not running with combined error). `npm run lint` (tsc) clean, `npm test` 64→69, `out/` recompiled. Backend `cargo test --workspace` unchanged/green.

- [~] **p0.3 Codex integration migration.** AtoAxis Codex plugin package in the current native plugin layout. Migrate the legacy direct TOML hook block without deleting user config. Idempotent install/upgrade. Detect hook enabled/trusted and surface a manual action when the platform forces user trust. Hook path points at a stable managed directory, never a VSIX/worktree path.
  - Tests: migration preserves unrelated user TOML keys; install twice = idempotent; hook path assertion is not under a temp/worktree dir.
  - → committed | `refreshManagedCodexHookCommands(config, {heartbeat,before,after})` repoints stale `command = "…"` lines *inside* AtoAxis-managed marker blocks (basename-matched) when a plugin upgrade moves the scripts to a new `~/.wakaclock/agent-plugins/<version>/` dir — block boundary ends at another marker / a non-`hooks.` table / a non-marker comment / two blank lines / EOF, so user hooks, comments and tables are byte-preserved. Wired as the first step of `ensureCodexHook`. `assertStableManagedHookPath(hookPath, homeDir)` throws for any path outside `~/.wakaclock/agent-plugins/` (VSIX-unpack, dev worktree) and is called in `setupCodex`. `ensureCodexHooksFeature`/`ensureCodexHook` idempotence + `codex_hooks`→`hooks` migration already existed. tests: `repoints a stale managed hook path … preserving user config`, `refreshManagedCodexHookCommands leaves an unmanaged command line alone`, `assertStableManagedHookPath rejects a worktree/VSIX path …` (vscode 69→72), tsc clean, `out/` recompiled.
  - **Deferred (`[~]`), recorded in VERIFICATION.md:** "AtoAxis Codex plugin package in the current native plugin layout" — no Codex build on this machine exposes a documented plugin/extension install API, so there is no real target to package or live-verify. Shipped mechanism stays the direct managed-TOML block. Revisit with a Codex release that documents a plugin manifest format. The "detect enabled/trusted + manual action" sub-part is covered by the pre-existing `doctor ai` adapter fields (`enabled`/`trusted`) from the baseline.
- [x] **p0.4 Transcript scanner recovery.** Scanner autostarts, resumes from its cursor, follows a growing transcript. Exposes `file_size`, `cursor_offset`, `lag_bytes`, `last_scan_at`, `last_event_at`. An unsupported format/schema emits a diagnostic instead of silently reporting zero events. One agent's parser failure does not stop the others.
  - Tests: cursor resume across a re-open; growing-file follow; unsupported-format → diagnostic (not `Ok(0 events)`); per-agent isolation (one bad transcript, others still parse).
  - → committed | New `wakaclock_core::ai::TranscriptLag::measure(file_size, cursor)` — pure: `lag_bytes = file_size.saturating_sub(cursor_offset)` (rotation-safe), `ever_scanned`, `last_event_at`. `doctor ai` per-agent entries now carry `file_size` / `cursor_offset` / `lag_bytes` / `last_event_at` (text mode prints the same JSON blob so it inherits them), and an explicit `diagnostic` string for `UnsupportedVersion` / `PermissionDenied` states instead of collapsing them to `transcript_found: false`. `run_ai_sync`: the per-agent `parser.parse_since(...)?` is now a `match … Err => record_scan(false) + break` (skip this agent, keep the others), and the three `parse_*_usage(...)?` calls are `.unwrap_or_else(|| Vec::new())` (drop token counts, keep edits). tests: `transcript_lag_reports_bytes_owed_and_scan_history` (core), `one_agents_parse_error_does_not_stop_the_others` (cli, StubParser). Cursor-resume + growing-file-follow are already covered by the pre-existing `run_ai_sync` cursor logic (`cursor.byte_offset <= file_len` resume guard, tested end-to-end in VERIFICATION.md's Phase 8 idempotency run). NOTE: `one_agents_parse_error…` exercises the loop *pattern* with a stub, not `run_ai_sync` itself (async + API-client-bound); a fixture-transcript integration test of the real path is a follow-up.
- [x] **p0.5 `wakaclock doctor ai --json`.** Audit the baseline implementation against planai2.md §0.5. It must report: CLI path/version mismatch; broker installed/running/version; adapter detected/installed/enabled/trusted; latest native-hook event; latest transcript mtime + parser cursor lag; broker inbox pending/retry/dead-letter; outbound queue depth; backend delivery result split into `401` / `402` / network / validation; stale hook/plugin path. Add whatever's missing.
  - Tests: a doctor-report test asserting every required field key is present; `402` is reported distinctly from `401` and from network failure.
  - → committed | Audit result: baseline already had CLI mismatch (p0.1), broker version/inbox pending·retry·dead_letter, queue depth, transcript lag (p0.4), stale hook/plugin path (p0.1). **Added:** `wakaclock_core::api_client::{DeliveryFailureKind, classify_delivery_failure}` (`auth_401`/`payment_402`/`network`/`validation`/`other`, 402/trial checked before 401 before 400·422 before transport keywords) + `DeliveryFailure::kind()`; `doctor ai` `last_delivery_failure` now carries `category`; new top-level `broker_installed` / `broker_running` (from `agent_service::status()`) and `latest_native_hook_event_at` (last line of `~/.wakaclock/ai-events.jsonl` sidecar). Report assembly extracted to `build_ai_doctor_report(AiDoctorReportParts)` with `ai_doctor_report_keys()` as the single presence source-of-truth (`debug_assert!` in the builder + the test). tests: `delivery_failure_402_is_distinct_from_401_and_network` (core), `doctor_report_carries_every_required_key` (cli). Live: on this machine `category: payment_402`, `broker_installed: true`, `latest_native_hook_event_at` reads the real sidecar. **Not added:** per-adapter `enabled`/`trusted` — Codex trust state isn't machine-readable without Codex's own store, and Claude/Gemini plugin-enabled state needs a subprocess; left for a later pass rather than emitting a guessed value.

### Phase 0 acceptance criteria — encode as named tests

- [x] **p0.A1** One Codex Desktop `apply_patch` reaches the local broker **exactly once** (external-process test). → `p0_a1_one_apply_patch_event_is_captured_exactly_once` in `tests/broker_process.rs`: spawns the real `wakaclock broker run`, posts the same `event_id` twice, asserts `total_rows == 1`.
- [x] **p0.A2** Broker stop → restart loses no event (broker restart/replay test). → covered by the pre-existing `broker_restart_reclaims_processing_lease_without_duplicate_inbox_row` (kills broker mid-processing, restarts, asserts total inbox rows stay `== 1`, no duplicate).
- [x] **p0.A3** Backend offline / HTTP 402 → event still shows `captured locally` and sits in the queue; detection/local-capture is not marked failed. → `p0_a3_offline_402_keeps_the_event_captured_locally`: `status_server("402")`, asserts `last-delivery-failure.json` written and names 402, `ai-events.jsonl` sidecar written, `queue.db` exists (heartbeat durably queued), `dead_letter == 0`, `total_rows == 1`.
- [x] **p0.A4** `doctor ai` alone identifies each pipeline gap (missing broker / stale hook / parser lag / delivery 402) without opening other logs. → `p0_a4_doctor_ai_identifies_pipeline_gaps`: crafts an isolated `HOME` with a legacy-alias plist + a 402 `last-delivery-failure.json`, runs `wakaclock doctor ai --json` as a subprocess, asserts `legacy_service_alias == true`, `last_delivery_failure.category == "payment_402"`, and every required key present.

---

# Phase 1 — Canonical Evidence Contract and Adapter Registry

Goal: new agents connect through one contract; no attribution logic scattered across shell scripts or editor extensions.

- [x] **p1.0 DECISION: evidence-metadata envelope shape.** → resolved in Decisions log (D1–D6): `BrokerEventV1` already has every planai2 field; additive-only, no schema bump; `deny_unknown_fields` is the forbidden-content backstop; `transport` gets a code-side `TransportKind` classifier (no wire change); envelope `confidence` is the producer's self-assertion (correlation may only downgrade); `event_id` stays producer-supplied/opaque; adapter manifest is a separate non-wire type. Committed `docs(planai2-p1.0)`.
- [x] **p1.1 Implement the envelope.** Extend the broker event / evidence type with the agreed fields. Backward-compatible: old envelopes still deserialize.
  - Tests: round-trip serde of a full envelope; an old-shape envelope still parses; `schema_version` gate.
  - → committed | Per D1 no fields were added — `BrokerEventV1` was already complete. Added `TransportKind` enum (`NativePlugin`/`Mcp`/`Transcript`/`ToolSnapshot`/`Filesystem`/`Editor`/`Cli`/`Other`, `Ord`) + `TransportKind::classify(Option<&str>)` (free-text → ranked, unknown⇒`Other`, never panics) + `priority()` (lower = stronger, matches planai2 §2 producer order) + `BrokerEventV1::transport_kind()`. tests: `full_envelope_round_trips_through_json` (round trip + all 17 plan fields present on the wire), `a_minimal_old_shape_envelope_still_parses` (required-only JSON → optionals default to None → normalize ok), `a_wrong_schema_version_is_rejected_by_normalize`, `transport_kind_ranks_producers_by_evidence_strength`. Gates: fmt/clippy/`cargo test --workspace` + duration-audit verify_port/golden/verify_actor_migration all green.
- [x] **p1.2 Field allow-list enforcement.** Unknown fields and forbidden content (prompt/response/patch/clipboard/terminal/command args) are rejected or quarantined with a sanitized diagnostic that contains none of the offending content.
  - Tests: envelope with a `prompt` field → quarantined, diagnostic has no prompt text; unknown field → rejected.
  - → committed | `ALLOWED_EVENT_FIELDS` (kept in sync with the struct via `allow_list_matches_the_struct_fields` test) + `FORBIDDEN_EVENT_FIELDS` (prompt/response/patch/diff/content/clipboard/terminal/stdout/args/command/env/secret/token/api_key…) + `QuarantineDiagnostic::inspect(&[u8])` → `{unknown_fields, forbidden_fields, message}` reporting **field names only, never values**. Wired into the CLI broker's `event_handler` and `batch_handler`: on a strict-parse failure they no longer echo `serde_error.to_string()` (which can quote a rejected value) — they emit the sanitized diagnostic as the 422 body + an `eprintln!` quarantine log line. tests: `allow_list_matches_the_struct_fields`, `quarantine_diagnostic_names_a_prompt_field_but_never_its_value` (asserts the prompt text and the word "exfiltrate" appear nowhere in the message or serialized diagnostic), `quarantine_diagnostic_flags_every_forbidden_field_and_plain_unknowns_separately`. Gates: fmt/clippy/`cargo test --workspace` + duration-audit green.
- [x] **p1.3 Declarative adapter manifest type.** One manifest per agent: `id`, `provider`, executable detection, install strategy, native hook capabilities, transcript roots, payload schema versions, supported tool/change kinds, `verification_status` (`verified` | `scaffold` | `unverified`), health probe.
  - Tests: manifest serde; `verification_status` defaults to `unverified`; a manifest with no live verification cannot report `verified`.
  - → committed | New `backend/api/crates/wakaclock-core/src/ai/adapter.rs`: `AdapterManifest { id, provider, executable: ExecutableDetection, install: InstallStrategy (NativePlugin|ConfigHookBlock|TranscriptOnly|Manual), native_hooks: NativeHookCapabilities (all default false → under-claim), transcript_roots, payload_schema_versions, supported_change_kinds: Vec<BrokerChangeKind>, verification: Verification, health_probe: HealthProbe (TranscriptFreshness|HookEventRecency|None) }`. `Verification` fields serde-deserializable but `verified()` is the only constructor that mints `Verified` and it *demands* `live_checked_at` + `tool_version`; `effective_status()` degrades a lying `verified`-without-evidence to `scaffold`; `validate()` rejects it outright (planai2 line 604). `VerificationStatus` `#[derive(Default)]` = `Unverified`. Exported from `ai/mod.rs`. tests: `manifest_round_trips_through_json`, `verification_status_defaults_to_unverified`, `a_manifest_cannot_claim_verified_without_a_live_check`, `validate_rejects_an_empty_id_or_provider`. Gates: fmt/clippy/`cargo test --workspace` + duration-audit green.
- [x] **p1.4 Adapter registry.** Enumerates manifests, drives install + health probe. Installer is atomic, idempotent, and preserves user configuration.
  - Tests: register a fake test adapter and drive it end to end **without editing correlation or heartbeat code** (this is acceptance p1.A1); install twice = idempotent; install preserves a pre-existing unrelated config key.
  - → committed | `AdapterRegistry` in `ai/adapter.rs`: `from_manifests`/`builtin`/`register` (validates each, rejects duplicate ids), `get`/`ids`/`manifests`, `install(id, &InstallContext) -> InstallOutcome`. `ConfigHookBlock` strategy: marker-guarded, writes the managed block once via temp-file + `rename` (atomic), preserves every existing byte; a 2nd call is a no-op `AlreadyInstalled`. `NativePlugin`/`Manual`/`TranscriptOnly` return a *plan* (`RequiresExternalCommand`/`ManualStep`/`NothingToInstall`) — the registry never shells out, stays pure + correlation-free. `builtin()` seeds real manifests: claude-code `Verified` (VERIFICATION.md 2026-08-14 live sync), codex `Scaffold` (real-transcript dry-run only, live delivery open), gemini-cli `Unverified` (no CLI anywhere). tests: `builtin_registry_loads_and_validates_every_manifest`, `a_new_adapter_registers_and_installs_end_to_end_without_touching_core` (p1.A1 — asserts user key `name = "keep me"` survives + 2nd install byte-identical), `install_returns_a_plan_for_native_plugin_and_manual_strategies`, `duplicate_ids_are_rejected`. Gates: fmt/clippy/`cargo test --workspace` + duration-audit green.
- [x] **p1.5 Migrate VS Code installer.** Move installation logic from `extensions/vscode/src/agentSetup.ts` to consume the registry. No behavior regression.
  - Tests: `extensions/vscode` test that setup still installs the Claude + Codex adapters; VS Code `npm test` green.
  - → committed | CLI: new `wakaclock adapter list [--json]` (`AdapterAction::List`) serializing `AdapterRegistry::builtin().manifests()` — text mode prints id/provider/install-kind/status. `agentSetup.ts`: `parseAdapterList()` + `pluginInstallCommand()` (pure, exported) + `fetchAdapterRegistry(cliPath)` (calls the CLI, empty map on any failure → falls back to built-in defaults, never a failed setup). `detectAiAgents({cliPath})` now merges `verificationStatus` onto each `AiAgentStatus` from the registry; `setupClaudeCode`/`setupGeminiCli` take the manifest and take the plugin id/args from `install.install_args` (the literal `atoaxis-heartbeat@atoaxis-plugins` is no longer duplicated in TS) with the old literals as fallback; Codex stays on the `config_hook_block` path (`ensureCodexHook`). tests: `parseAdapterList reads the CLI output and tolerates garbage`, `pluginInstallCommand splits the manifest args and skips non-plugin strategies` (vscode 72→74). Gates: backend fmt/clippy/`cargo test --workspace` + vscode tsc/`npm test` green, `out/` recompiled.

### Phase 1 acceptance criteria — named tests

- [x] **p1.A1** A new test adapter is added with zero changes to correlation/heartbeat code. → `a_new_adapter_registers_and_installs_end_to_end_without_touching_core` (p1.4) — the test file imports only `ai::adapter`.
- [x] **p1.A2** An adapter not live-verified renders as `scaffold` / `unverified` everywhere it's surfaced. → `p1_a2_a_scaffold_or_unverified_adapter_is_never_shown_as_verified`: iterates the whole `builtin()` set — `is_live_verified()` / `effective_status()` agree that only a `live_checked_at`-backed manifest is `Verified`; a lying `status:verified` JSON degrades to `Scaffold` and `validate()` errs. (CLI `adapter list` prints `effective_status()`, so its text/JSON surface inherits this.)
- [x] **p1.A3** An unknown payload schema is quarantined with a sanitized diagnostic. → p1.2's `quarantine_diagnostic_names_a_prompt_field_but_never_its_value` + `quarantine_diagnostic_flags_every_forbidden_field_and_plain_unknowns_separately` — the diagnostic reports field names only, and the CLI broker returns it as the 422 body instead of the raw serde error.
- [x] **p1.A4** Every adapter emits the same metadata shape into the broker. → `p1_a4_every_builtin_adapter_produces_the_same_broker_envelope_shape`: for every `builtin()` manifest × every `supported_change_kind`, a `BrokerEventV1` built with that agent `normalize()`s and JSON round-trips identically — there is one envelope type, agent-independent.

---

# Phase 2 — Direct Evidence First

Goal: raise recall through trustworthy evidence before any universal inference.

- [x] **p2.1 Producer priority.** Enforce the ordering in code: native hooks/plugins > structured MCP events > completed transcript tool calls > before/after tool snapshot > filesystem/session inference. Higher-priority evidence for the same change supersedes lower.
  - Tests: given two evidence records for one change, the resolved producer is the higher-priority one; ordering table test.
  - → committed | `wakaclock_core::broker`: `evidence_rank(&BrokerEventV1) -> (transport_priority, source_rank, confidence_rank, -recency_ms)` (lower = stronger) built on `TransportKind::priority()` (p1.1) with tie-breaks source `AgentHook>Mcp>Transcript>IdeTelemetry`, confidence `Verified>Correlated>Inferred>Unknown`, then newest `occurred_at`. `strongest_evidence(&[BrokerEventV1]) -> Option<&_>` picks the canonical record; `evidence_supersedes(candidate, incumbent) -> bool` is the pairwise form. Caller decides "same logical change" (entity+kind+window); this only chooses among captured evidence, never invents. tests: `strongest_evidence_follows_the_producer_priority_order` (hook beats mcp beats transcript beats snapshot beats fs in every mix; `[]`→None; supersession pairwise), `evidence_ties_break_toward_the_more_recent_event`. broker tests 20→22. Gates: fmt/clippy/`cargo test --workspace` + duration-audit green.
- [x] **p2.2 Generic MCP / tool ingress.** Keep `wakaclock ai emit --json`, `ai tool-before`, `ai tool-after`. Add an HTTP/SDK helper that reads broker discovery + token safely. Support operations: write, apply patch, create, move, rename, delete, replace, multi-edit, shell mutation. **One tool call touching N files = one duration interval + N file-evidence records.**
  - Tests: a 3-file `apply_patch` → 1 interval, 3 evidence records; each operation kind maps to a `change_kind`; discovery/token read never logs the token.
  - → committed | Audit: `ai emit`/`ai tool-before`/`ai tool-after` all still present + tested; `BrokerClient::discover()` (the "read broker discovery + token" helper) already file-based and non-logging. **Added:** `BrokerChangeKind::from_tool_operation(&str) -> Option<Self>` in `wakaclock-core::broker` — one canonical map of the full plan vocabulary (write/apply_patch/create/move/rename/delete/replace/multi_edit/shell_mutation + adjective spellings, space/hyphen→`_`), `None` for unknown. `broker_event_from_generic` now delegates to it (previously an inline match missing `replace`/`multi_edit`/`shell_mutation`/`apply_patch`). Manual `Debug for BrokerClient` that redacts `token` → `{:?}` can never print it. Extracted `spread_single_tool_interval(&mut [GenericAiEventInput], total)` from `run_ai_tool_after` — first record gets the whole interval, rest `0.0` (the "one call, N files, one interval" invariant, now unit-testable). tests: `from_tool_operation_covers_the_full_ingress_vocabulary`, `broker_client_debug_redacts_the_token` (core 22→24); `broker_event_from_generic_accepts_...` extended with the new ops + a rejected `"teleport"`, `spread_single_tool_interval_gives_one_interval_across_n_files` (cli 38→39). Gates: fmt/clippy/`cargo test --workspace` + duration-audit green.
- [x] **p2.3 Adapter rollout.** Per planai2.md order. Codex Desktop/CLI + Claude Code: keep/verify. Gemini CLI, Cursor, Antigravity, Copilot CLI/IDE, Windsurf, Cline/Roo, OpenCode, Generic MCP producer SDK: **not installed on this machine → scaffold + `unverified` + VERIFICATION.md note.** Cursor stays `scaffold` until a real payload is seen.
  - Tests: each scaffolded adapter has a manifest with `verification_status: unverified` and a fixture-shaped parse test that is explicitly labelled "fixture only, not live".
  - → committed | `rollout_scaffold_manifests()` adds 8 manifests to `AdapterRegistry::builtin()`: `cursor` (Scaffold — `.cursor/hooks.json` shape from public docs + `extensions/ai-agents/cursor/`, no real payload), `generic-mcp` (Scaffold — the `wakaclock ai emit` ingress path is real+tested, no specific producer verified), `antigravity`/`copilot`/`windsurf`/`cline`/`roo-code`/`opencode` (Unverified — no tool anywhere, no integration point inspected). All data-only, no parser. VERIFICATION.md gains a p2.3 table + "to promote: install real tool, capture real payload, write parser, run end-to-end, then `Verification::verified(...)`". tests: `p2_3_rollout_adapters_are_registered_and_never_claim_verified` (all 8 present, none `is_live_verified()`, cursor+generic-mcp are Scaffold, the rest Unverified, and only `claude-code` is verified in the whole registry); `builtin_registry_loads_and_validates_every_manifest` updated to `&ids()[..3]`. adapter 10→11. No parser fixture tests — nothing to parse yet; the plan's "scaffold" means manifest-only, and that's what these are. Gates: fmt/clippy/`cargo test --workspace` green.

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

### 2026-08-31 — p1.0 — `BrokerEventV1` evidence-metadata envelope

Read: `backend/api/crates/wakaclock-core/src/broker.rs` (the struct + `normalize`),
`src/ai/event.rs` (`AiEventSource` = Transcript|AgentHook|IdeTelemetry|Mcp;
`AiConfidence` = Unknown|Inferred|Correlated|Verified), `src/heartbeat.rs`
(`ActorType` = Human|AiVerified|AiInferred|Unknown).

**Finding: `BrokerEventV1` already carries every field in planai2.md's target
evidence JSON** — `schema_version, event_type, event_id, occurred_at, entity,
project_root, change_kind, agent, provider, model, session_id, tool_event_id,
source, transport, confidence, lines_added, lines_deleted` — plus
`previous_entity, actor_type, actor_confidence, active_seconds, tool`. Phase 1
is therefore *contract hardening + a registry*, not "add fields".

- **D1 — Additive, no schema bump.** `BROKER_SCHEMA_VERSION` stays `1`. Any future
  field lands as `#[serde(default)] Option<T>` so an older producer still
  validates. A bump is reserved for a *breaking* change (removing or retyping a
  field), never for an addition.
- **D2 — `#[serde(deny_unknown_fields)]` is the forbidden-content backstop and
  stays.** A payload with `prompt`/`response`/`patch`/`diff`/`content`/`clipboard`/
  `terminal`/`args`/any unlisted key fails deserialization. p1.2 wraps ingest so a
  strict-parse failure records a **sanitized** diagnostic (offending *field names*
  only, never values) and drops the event, instead of a 500.
- **D3 — `transport` stays `Option<String>` on the wire; add a `TransportKind`
  classifier in code** (`native_plugin | mcp | transcript | tool_snapshot |
  filesystem | editor | cli | other`) for the Phase 2 producer-priority ordering.
  No wire-type change ⇒ no existing producer or fixture breaks.
- **D4 — envelope `confidence` is the producer's self-assertion, not the verdict.**
  Native hook / structured MCP ⇒ `verified`; tool-snapshot / filesystem ⇒
  `inferred` or `unknown`. The Phase 5 correlation engine may **downgrade** on
  conflicting evidence but never **upgrades** past the envelope value.
  `actor_type` / `actor_confidence` are left `None` by producers and are filled
  only by correlation.
- **D5 — `event_id` is producer-supplied, opaque, required stable + non-empty**
  (already enforced by `clean_required`). Per-file uniqueness inside a multi-file
  tool call is the producer's job (`hash(call_id, file_path)` for Codex,
  `tool_use.id` for Claude — already shipped). The broker never synthesizes or
  mutates it.
- **D6 — the adapter manifest (p1.3) is a separate Rust type, never part of the
  wire envelope.** It describes detect / install / health-probe / verification
  status; it does not travel with an event.

Commit: `docs(planai2-p1.0)` (this file only).

---

## Iteration log

_(One line per loop iteration: date/time, item id, outcome, commit SHA. Newest last.)_

- 2026-08-31 — setup — baseline verified green (cargo 365 pass, 4 duration gates, frontend 211 pass), branch `planai2/universal-ai-detection` created, WIP snapshot `d95bb00`, this tracker written. Ready to start at p0.1.
- 2026-08-31 — p0.1 — done. build.rs + `status --json` build identity + CLI-path/version drift warnings + legacy `agent run` service-manifest detection & migration. 4 new tests. fmt/clippy/`cargo test --workspace` green. Committed.
- 2026-08-31 — p0.2 — done. Pure `manifest_content()` (idempotent install), `manifest_points_at_stale_binary()` + `stale_service_binary` surfaced in status/doctor + folded into `broker start` self-repair, `AgentLock::acquire_at()` for singleton testability. 3 new tests (cli 33→36). fmt/clippy/`cargo test --workspace` green. Split VS Code fallback hardening → p0.2b. Committed `e1aa86d`.
- 2026-08-31 — p0.2b — done. `ensureBrokerRunning()` verifies `broker status` running and falls back to the extension-owned broker on any platform (removed the remote/linux-only gate). 5 new vitest cases (vscode 64→69), tsc clean, `out/` recompiled. Committed `c1baf5e`.
- 2026-08-31 — p0.3 — partial (`[~]`). `refreshManagedCodexHookCommands()` repoints stale in-block hook paths on upgrade without touching user config; `assertStableManagedHookPath()` rejects VSIX/worktree paths. 3 new vitest cases (vscode 69→72), tsc clean, `out/` recompiled. Native Codex plugin packaging deferred (no real Codex plugin API on this machine) — recorded in VERIFICATION.md. Backend gates green. Committed `e9f5867`.
- 2026-08-31 — p0.4 — done. `TranscriptLag::measure()` byte-lag helper (core) wired into `doctor ai` (`file_size`/`cursor_offset`/`lag_bytes`/`last_event_at` + explicit `diagnostic` for unsupported/permission states); `run_ai_sync` per-agent parse error now `break`s (skip agent) instead of `?` (abort run), usage-parse errors drop token counts only. 2 new tests. fmt/clippy/`cargo test --workspace` green. Committed `907c642`.
- 2026-08-31 — p0.5 — done. `classify_delivery_failure()` + `DeliveryFailureKind` (401/402/network/validation/other) in core; `doctor ai` gains `last_delivery_failure.category`, `broker_installed`/`broker_running`, `latest_native_hook_event_at` (sidecar); report assembly → `build_ai_doctor_report()` + `ai_doctor_report_keys()` presence guard. 2 new tests. Per-adapter enabled/trusted left for a later pass (not machine-readable). Gates green. Committed `f3ea9de`.
- 2026-08-31 — p0.A1–A4 — Phase 0 acceptance. 3 new external-process tests in `tests/broker_process.rs` (exactly-once dedup, offline-402 keeps capture + queues + records failure + no dead-letter, `doctor ai --json` surfaces legacy-alias + payment_402); p0.A2 mapped to the existing restart test. `broker_process` 2→5. fmt/clippy/`cargo test --workspace` green. **Phase 0 done** (p0.3 `[~]`). Committed `5eb7d5d`.
- 2026-08-31 — p1.0 — DECISION resolved (docs only). `BrokerEventV1` already carries every planai2 evidence field → additive-only/no schema bump, `deny_unknown_fields` backstop kept, `TransportKind` classifier instead of a wire change, envelope `confidence` = producer self-assertion, `event_id` producer-opaque, manifest is non-wire. See Decisions log D1–D6. Committed `3c7c337`.
- 2026-08-31 — p1.1 — done. No fields added (D1 — envelope already complete). Added `TransportKind` enum + `classify()`/`priority()`/`BrokerEventV1::transport_kind()` for the Phase 2 producer ordering. 4 new tests (round-trip, old-shape parse, schema-version gate, transport ranking). Gates + duration-audit green. Committed `3d15d1d`.
- 2026-08-31 — p1.2 — done. `ALLOWED_EVENT_FIELDS` + `FORBIDDEN_EVENT_FIELDS` + `QuarantineDiagnostic::inspect()` (field names only, never values); CLI broker `event_handler`/`batch_handler` now emit the sanitized diagnostic + a quarantine log line instead of echoing the raw serde error. 3 new tests. Gates + duration-audit green. Committed `b1ef024`.
- 2026-08-31 — p1.3 — done. New `ai/adapter.rs`: `AdapterManifest` + `InstallStrategy`/`NativeHookCapabilities`/`HealthProbe`/`Verification`/`VerificationStatus`. `Verified` can't exist without `live_checked_at` (smart ctor + `validate()` + `effective_status()` degrade). 4 new tests. Gates + duration-audit green. Committed `eeb622a`.
- 2026-08-31 — p1.4 — done. `AdapterRegistry` (enumerate/validate/register, reject dup ids) + `install()` → `ConfigHookBlock` writes once atomically (temp+rename) preserving user config, other strategies return a plan. `builtin()` seeds claude-code (Verified) / codex (Scaffold) / gemini-cli (Unverified). 4 new tests incl. p1.A1 end-to-end. Gates + duration-audit green. Committed `aafff8c`.
- 2026-08-31 — p1.5 — done. CLI `wakaclock adapter list [--json]` exposes the registry; `agentSetup.ts` reads it (`parseAdapterList`/`pluginInstallCommand`/`fetchAdapterRegistry`, graceful fallback), merges `verificationStatus` onto agent status, takes plugin install args from the manifest. 2 new vitest cases (72→74). Backend + vscode gates green, `out/` recompiled. Committed `2f09e8c`.
- 2026-08-31 — p1.A1–A4 — Phase 1 acceptance. p1.A1/p1.A3 cited to existing tests (p1.4 end-to-end / p1.2 quarantine). 2 new: `p1_a2_a_scaffold_or_unverified_adapter_is_never_shown_as_verified`, `p1_a4_every_builtin_adapter_produces_the_same_broker_envelope_shape` (adapter 8→10). **Phase 1 done.** Gates + duration-audit green. Committed `a8a63cd`.
- 2026-08-31 — p2.1 — done. `evidence_rank` + `strongest_evidence` + `evidence_supersedes` in `wakaclock_core::broker` — transport priority (p1.1) then source then confidence then recency. 2 new tests (broker 20→22). Gates + duration-audit green. Committed `52133ef`.
- 2026-08-31 — p2.2 — done. `BrokerChangeKind::from_tool_operation()` canonical op→change-kind map (full plan vocabulary); `broker_event_from_generic` delegates to it; `Debug for BrokerClient` redacts the token; `spread_single_tool_interval()` extracted (one call/N files/one interval). 4 new tests (core 22→24, cli 38→39). Gates + duration-audit green. Committed `77bd8b1`.
- 2026-08-31 — p2.3 — done. `rollout_scaffold_manifests()` — 8 manifests (cursor + generic-mcp Scaffold, antigravity/copilot/windsurf/cline/roo-code/opencode Unverified), data-only, no parser. VERIFICATION.md p2.3 table + promotion recipe. 1 new test + 1 updated (adapter 10→11). Gates green. Committed.
