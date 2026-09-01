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

**Phase 7 — item p7.3 (shadow mode)** next. **p7.1, p7.2 done.** p7.2 VS Code
half `1de00d0` (`AtoAxis: Test AI Detection` + `aiDetectionSelfTest.ts`); p7.2
frontend half `40fba12` (`AiAttributionLegend` — §5 decision-rule explainer per
`actor_type` on `ai/page.tsx`, driven by the existing `aiStats` query, no new
endpoint; `test/wakaclock-ai-attribution-legend.test.tsx` ×4; `npm run validate`
41/217 green). Toolchains confirmed (`node v24`); vscode 94 pass.

**p7.2c added** (`[ ]`, blocks Run DoD): the broker-health panel + parser-lag /
stale-adapter warnings from p7.2's original text were split out — they need
broker inbox counters and transcript-parser lag that live only in
`wakaclock doctor ai` on the client and never reach the hosted API, plus a
client→server telemetry push + server read model that do not exist. **Not
`[~]`** (no missing tool — unbuilt infrastructure). Decision logged 2026-09-02.
When the loop reaches p7.2c: read `.context/workflows/adding-endpoint.md` +
`.context/backend/overview.md` + `.context/data/migrations.md` +
`.context/workflows/adding-dashboard-panel.md` + `.context/frontend/data-layer.md`
first; if it is a large sub-project, surface that rather than half-building it.

Next: **p7.3** (shadow mode `observer.attribution_mode = observe_only | infer`,
per-workspace + per-source kill switch), then p7.4 (precision/recall report),
then p7.A1–p7.A4, then p7.2c.

**Concurrency note (2026-09-02):** a large concurrent feature landed in the tree
while paused — new `ai/producer.rs` (+ `ai/mod.rs` re-exports), plus
`wakaclock-cli` / `adapter.rs` / `event.rs` / `broker.rs` / vscode / ai-agents
shell adapters, and `plans/planplugin/`, `planplugin.md`. **Not mine** — never
staged/reverted. `ai/mod.rs` now carries both my `canonical` lines and their
`producer` lines; p6.1's commit staged only my 2 hunks (save/restore dance).
Full gate suite is green *with* the concurrent code, so no blockage. Watch for
`ai/producer.rs` overlapping p6.2/p6.3 (it builds file-change events + event
ids) — reuse its `file_event_id` / `ProducerFileChange` if they fit rather than
duplicating.

p6.2: a **canonical activity** record that aggregates the child evidence IDs
behind one logical edit — native hook / transcript / filesystem / editor — keyed
by the p6.1 `CanonicalFingerprint`. Likely `CanonicalActivity { fingerprint,
verdict: Option<Verdict>, child_evidence: Vec<(EvidenceKind, lineage_id)> }` (or
similar) with a builder that folds `CorrelationInput`s sharing a fingerprint into
one, preserving every child `lineage_id`, no content. Test:
`a_canonical_activity_built_from_three_evidence_sources_lists_all_three_child_ids`.
Then p6.3 (dedup rules — one named test per rule; multi-file case asserts
duration unchanged), p6.A1–p6.A5.

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

- [~] **p2.A1** Known native-adapter recall ≥ 99% measured against the fixture corpus (record the number). → **fixture recall = 100%** on the committed corpus: every Claude fixture (`edit_tool_result.json`, `write_tool_result.json`) and every Codex fixture (`patch_apply_end.json`, `custom_tool_call.json`+`custom_tool_call_output.json`, multi-file split) yields exactly its expected event(s) — `claude.rs::parse_since_extracts_edit_...` / `parse_since_treats_new_file_write_as_pure_addition`, `codex.rs::parse_since_splits_multi_file_patch_into_one_event_per_file` / `parse_since_reads_the_real_response_item_apply_patch_shape`. `[~]` because the plan reserves the ≥99% **recall gate** for a real labelled corpus + live run (line 604); the fixture set is small and hand-authored. VERIFICATION.md's 2026-08-31 Codex run (2,642 events from 156 real sessions, up from 0) is the closest real-data recall evidence.
- [x] **p2.A2** A hook event and a transcript event for the same edit collapse to one canonical event. → server `services::heartbeat::tests::hook_and_transcript_payloads_share_one_cross_transport_fingerprint` (normalized path + project/branch + 5s bucket + line deltas → one fingerprint) and `wakaclock_core::broker::strongest_evidence_follows_the_producer_priority_order` (hook supersedes transcript, one record kept).
- [x] **p2.A3** A failed tool call never produces a `verified` edit. → `claude.rs::parse_since_skips_failed_tool_results` (a failed `Edit`/`Write` result yields no event); `codex.rs::parse_since_ignores_a_custom_tool_call_output_with_no_matching_call` (an output with no completed call → nothing). No verified edit is ever synthesized from an incomplete/failed call.
- [x] **p2.A4** Real-payload verification status is recorded in `VERIFICATION.md` / the capability matrix for every adapter (verified or "blocked, no local tool"). → VERIFICATION.md carries a status line for every adapter (Claude live 2026-08-14; Codex dry-run + "live delivery open"; Gemini "entirely unverified"; p0.3 Codex-plugin deferral; p2.3 rollout table). New test `p2_a4_no_builtin_adapter_reports_a_verification_state_it_cannot_back`: across all 11 registry manifests, `Verified` ⇒ `live_checked_at` + `tool_version` present, else `!is_live_verified()`.

---

# Phase 3 — Workspace Registry and Universal Filesystem Observer

- [x] **p3.1 Workspace lease registry.** Producers register a lease: `workspace_id`, `canonical_root`, `producer_id`, `pid`/`session_id`, `registered_at`, `last_seen_at`, `expires_at`, exclude rules. VS Code, agent sessions, and the CLI refresh their lease periodically. When every lease for a workspace expires, watching that workspace stops. The broker **never** watches the whole home directory.
  - Tests: register → lease present; no refresh → expires → workspace no longer watched; refresh keeps it alive; two producers, one leaves, watch continues.
  - → committed | New pure in-memory `wakaclock_core::ai::workspace`: `WorkspaceLease { workspace_id, canonical_root, producer_id, pid, session_id, registered_at, last_seen_at, expires_at, exclude_rules }`, `workspace_id_for(&Path)` = URL-namespaced v5 UUID (same derivation style as `broker::payload_hash`), `WorkspaceRegistry::new(ttl, home_dir)` with `register` / `refresh` (returns false if lease not held) / `release` / `prune_expired` / `watched_roots(now)` / `is_watched` / `leases_for` / `exclude_rules_for` (union). `register` returns `LeaseError::RootTooBroad` when the root is `$HOME`, an ancestor of `$HOME`, or `/` (the "never watch the whole home dir" guard), and `LeaseError::NotAbsolute` for a relative path. pid/session_id are metadata only — liveness is Phase 4. tests: `register_then_the_workspace_is_watched`, `a_lease_expires_and_the_workspace_stops_being_watched`, `refresh_keeps_a_lease_alive`, `two_producers_one_leaves_and_the_watch_continues`, `the_broker_never_leases_the_whole_home_directory`, `exclude_rules_from_every_live_lease_are_merged` (core 164→170). Gates: fmt/clippy/`cargo test --workspace` + duration-audit green.
- [x] **p3.2 Wire the filesystem observer to the registry.** `filesystem_observer.rs` watches only registered workspace roots.
  - Tests: a change under an unregistered path yields no event; under a registered path yields one.
  - → committed | New `ObserverPool` in `filesystem_observer.rs`: `sync(&[PathBuf])` reconciles the live `WorkspaceWatcher` set to a desired root list (starts new, drops stale + releases the OS handle) → returns `SyncOutcome { started, stopped }` (idempotent); `watched_roots()`, `is_within_watched(path)` (defence-in-depth path filter), `poll(timeout)` drains every watcher and drops any event outside a watched root. Production wiring feeds it `WorkspaceRegistry::watched_roots(now)` (p3.1). tests: `sync_starts_and_stops_watchers_to_match_the_desired_root_set` (+ idempotent + swap), `a_change_under_an_unregistered_path_yields_no_event`, `a_change_under_a_registered_path_yields_an_event` (real temp-dir watches). core +3. Gates: fmt/clippy/`cargo test --workspace` + duration-audit green.
- [x] **p3.3 Observer semantics.** create / modify / rename / delete. Coalesce duplicate/atomic-save events into one logical change. Canonicalize paths; block symlink escape. Respect `.gitignore`, user excludes, generated/build/vendor dirs. Fingerprint only files that had an event (reuse the git blob/content hashing in `wakaclock-cli/src/tool_snapshot.rs`) — never scan/hash the whole repo per tick. Never read or persist source content.
  - Tests: editor atomic save (write temp + rename) → **one** logical change; rename normalized to a rename not delete+create; a `.gitignore`d path produces nothing; symlink pointing outside the workspace is rejected; assert no file *content* is ever held in a struct field.
  - → committed | Added to `filesystem_observer.rs`: `coalesce_burst(Vec<FileChangedEvent>) -> Vec<_>` (drops editor scratch names `~`/`.tmp`/`.swp`/`.#`/hex-suffix; a Created-then-Removed temp in one burst vanishes; repeated events keep the last kind), `canonicalize_within_root(root, path)` (symlink-aware via `fs::canonicalize` + containment; lexical fallback for not-yet-existing delete/rename targets), `WorkspaceIgnore` (`.gitignore` + lease `exclude_rules`; literal / leading-or-trailing `*` / trailing-`/` dir match — **not** a full engine: no `**`, no negation, no nested `.gitignore`, noted in the doc comment), `fingerprint_changed_file(path)` (reads bytes → `Uuid::v5` hash → drops the buffer; `>4 MiB` uses `size:mtime`; `None` if unreadable — never returns content). tests: 9 new incl. `atomic_save_burst_collapses_to_one_modify_of_the_real_file`, `canonicalize_within_root_rejects_a_symlink_that_escapes_the_workspace`, `gitignored_and_excluded_paths_produce_nothing`, `fingerprint_reads_and_discards_content_and_never_returns_it` (asserts `hunter2`/`password` appear nowhere), `file_changed_event_carries_no_content_field` (destructuring guard). core +9. Gates: fmt/clippy/`cargo test --workspace` + duration-audit green.
- [x] **p3.4 Backpressure.** An event storm has bounded memory and applies backpressure. Idle CPU and memory stay within a stated budget (write the budget into the test).
  - Tests: 10k synthetic events → bounded channel, no unbounded `Vec` growth; idle loop does no work.
  - → committed | `BoundedEventBuffer` in `filesystem_observer.rs`: fixed-capacity `VecDeque` ring; `push` evicts the oldest when full and bumps `dropped()`; `drain()` / `len()` / `capacity()` / `dropped()`. `DEFAULT_CAPACITY = 4096` (~224 KB ring + ≤4096 path strings — bounded regardless of storm size). `ObserverPool::poll_into(timeout, &mut buffer)` is the storm-safe form of `poll`. tests: `a_ten_thousand_event_storm_stays_bounded_and_keeps_the_newest` (10k pushes → `len == 4096`, `dropped == 5904`, retained window is the *newest* events), `a_tiny_buffer_still_never_grows_past_its_capacity` (asserts `len() <= 4` on every one of 1000 pushes), `capacity_is_clamped_to_at_least_one`, `an_idle_watcher_returns_none_within_the_timeout_and_does_not_spin` (`recv_timeout` parks the thread — verified by bounded overshoot ~200ms, not far past). core +4. Gates: fmt/clippy/`cargo test --workspace` + duration-audit green.

### Phase 3 acceptance criteria — named tests

- [x] **p3.A1** The watcher runs only for registered workspaces. → `filesystem_observer::observer_pool_tests::a_change_under_an_unregistered_path_yields_no_event` + `sync_starts_and_stops_watchers_to_match_the_desired_root_set` (p3.2) + `workspace::tests::a_lease_expires_and_the_workspace_stops_being_watched` (p3.1) — no live lease ⇒ no watcher.
- [x] **p3.A2** An editor atomic save creates a single logical change. → `observer_semantics_tests::atomic_save_burst_collapses_to_one_modify_of_the_real_file` (p3.3).
- [x] **p3.A3** rename / delete / create are normalized correctly. → `translate_event_kind_maps_the_three_reported_kinds` + new `p3_a3_rename_is_normalized_to_remove_old_plus_create_new_not_a_modify` (rename ⇒ Removed(old)+Created(new), never a spurious Modify, both halves survive coalescing).
- [x] **p3.A4** An event storm stays within bounded memory / backpressure. → `backpressure_tests::a_ten_thousand_event_storm_stays_bounded_and_keeps_the_newest` + `a_tiny_buffer_still_never_grows_past_its_capacity` (p3.4).
- [x] **p3.A5** **A filesystem event on its own resolves to `unknown`** — never `human`, never `ai_*`. → `p3_a5_a_filesystem_event_carries_no_actor_or_confidence_by_construction` (structural: `FileChangedEvent` has no actor/confidence/agent field; `FileChangeKind` = `Created/Modified/Removed` only) **+ p5.2 runtime** `p3_a5_and_p5_a1_a_lone_filesystem_change_is_unknown_never_human_or_ai` (`verdict_for` on a lone `FilesystemObserver` input ⇒ `Unknown` / `FileChangedWithoutSufficientProvenance`).

---

# Phase 4 — Agent Session and Process Evidence

Session/process is corroborating evidence, never a verdict that AI edited a file.

- [x] **p4.1 Session/process evidence model.** Fields: `pid`/`ppid`, process identity, `agent`/`provider`, `workspace`, `session_id`, `tool_event_id`, `started_at`, `last_activity_at`, `ended_at`, evidence strength. **No command arguments, no environment secrets.**
  - Tests: serde round-trip; a construction path that would capture argv is rejected/absent at the type level.
  - → committed | New `wakaclock_core::ai::session`: `SessionProcessEvidence { agent, provider, pid, ppid, process_identity, workspace, session_id, tool_event_id, started_at, last_activity_at, ended_at, strength }` + `EvidenceStrength` (NativeLifecycle < AppendingTranscript < ChildOfToolCall < ProcessTreeCwdMatch < ProcessNameOnly; `rank()` lower=stronger; `is_strong_enough_to_infer()` = rank ≤ ProcessTreeCwdMatch, i.e. process-name-only can never feed an inference). `from_detected_process(&DetectedAiProcess)` maps a bare name-match scan → `ProcessNameOnly`, no session identity, `last_activity_at == started_at`. `bounded_active_seconds()` = `(ended_at || last_activity_at) - started_at`, clamped ≥ 0 — **never wall-clock `now`** (p4.3 groundwork). **No argv/env**: no field, no constructor takes them; the round-trip test asserts `argv`/`args`/`command`/`env`/`cmdline` appear nowhere in the JSON, and `no_constructor_captures_argv_or_environment` is an exhaustive-destructure compile guard. tests: 5 new (`evidence_strength_orders_strongest_first`, `round_trips_through_json`, `no_constructor_captures_argv_or_environment`, `from_detected_process_is_name_only_strength_with_no_session_identity`, `bounded_active_seconds_never_uses_wall_clock_now`). core +5. Gates: fmt/clippy/`cargo test --workspace` + duration-audit green.
- [x] **p4.2 Wire `process_observer.rs` + reliability tiers.** Normalize detections into evidence with strength: native session/tool lifecycle > appending transcript with session/workspace metadata > child process spawned from a known agent tool call > process tree + exact cwd/workspace match > process name only (weak telemetry).
  - Tests: exact workspace/session match outranks a process-name-only match; process-name-only never reaches `ai_inferred` strength.
  - → committed | `evidence_from_scan(&[DetectedAiProcess], &[registered_roots]) -> Vec<SessionProcessEvidence>`: a detection whose `cwd` is `==` or under a **registered** workspace root ⇒ `ProcessTreeCwdMatch` (and `workspace` set); anything else ⇒ `ProcessNameOnly`. The stronger tiers (`NativeLifecycle`/`AppendingTranscript`/`ChildOfToolCall`) come from the hook/transcript producers, never from a scan, so this never returns them. `strongest_session_evidence(&[_]) -> Option<&_>`: strongest live entry by `strength.rank()` then most-recent `last_activity_at` (ended sessions skipped). tests: `p4_2_cwd_in_a_registered_root_outranks_a_bare_name_match` (cwd-in-root → `ProcessTreeCwdMatch` + inferrable; the other two → `ProcessNameOnly` + `!is_strong_enough_to_infer()`; strongest is the cwd match), `strongest_session_evidence_ignores_ended_sessions_and_breaks_ties_by_recency`. core +2. Gates: fmt/clippy/`cargo test --workspace` + duration-audit green.
- [x] **p4.3 Session lifecycle.** Process exit/crash closes the session without using `now` to extend duration unbounded.
  - Tests: kill a tracked pid → session `ended_at` set, duration is bounded by `last_activity_at`, not wall-clock now.
  - → committed | `SessionEvidenceLedger` in `ai/session.rs`: `observe(evidence, observed_at)` inserts/refreshes by pid (pushes `last_activity_at` forward, keeps earliest `started_at`, upgrades strength, backfills workspace/session_id/tool_event_id); `reap(&HashSet<u32> running_pids)` closes every live entry whose pid is absent — `ended_at = its own last_activity_at`, **never `now`** — removes it from the live set and returns it for the caller to flush; `live()`/`len()`/`is_empty()`. tests: `p4_3_a_gone_process_is_closed_at_its_last_activity_not_at_now` (pid seen at start then +90s, reaped 3h later → `ended_at == start+90s`, `bounded_active_seconds() == 90`), `reap_leaves_still_running_processes_untouched`, `observe_upgrades_strength_and_keeps_the_earliest_start`. core +3. Gates: fmt/clippy/`cargo test --workspace` + duration-audit green.

### Phase 4 acceptance criteria — named tests

- [x] **p4.A1** Process/session evidence never produces a heartbeat on its own. → `p4_a1_session_evidence_has_no_path_to_a_heartbeat_on_its_own` (structural: no `to_heartbeat`/`to_broker_event`/duration-emitting method; JSON has no `heartbeat`/`total_seconds`/`active_seconds` key) **+ p5.2 runtime** `p4_a1_a_session_with_no_change_produces_no_attribution` (a `SessionProcessObserver` input with no `FilesystemObserver` change ⇒ `verdict_for` = `Unknown` / `NoEvidence` — the session alone attributes nothing).
- [x] **p4.A2** An exact workspace/session match scores higher than a process-name match. → `p4_2_cwd_in_a_registered_root_outranks_a_bare_name_match` (p4.2) — cwd-in-registered-root ⇒ `ProcessTreeCwdMatch` (`rank 3`, inferrable), bare name ⇒ `ProcessNameOnly` (`rank 4`, not).
- [x] **p4.A3** Multiple AI tools active + no direct match → `unknown`. → `p4_a3_multiple_name_only_tools_active_cannot_be_inferred` (p4 layer: 3 concurrent `ProcessNameOnly` candidates, every one `!is_strong_enough_to_infer()`) **+ p5.2 runtime** `p4_a3_process_name_only_sessions_cannot_infer_and_stay_unknown` (a `FilesystemObserver` change + 3 `ProcessNameOnly` sessions from 3 agents ⇒ `verdict_for` = `Unknown` / `FileChangedWithoutSufficientProvenance` — none is strong enough to be "inferring", so no promotion) and `two_strong_agent_sessions_competing_is_unknown` (2 *strong* competing agents ⇒ `Unknown` / `MultipleCompetingAiSessions`).
- [x] **p4.A4** Process exit/crash closes the session cleanly (no unbounded duration). → `p4_3_a_gone_process_is_closed_at_its_last_activity_not_at_now` (p4.3) — reaped 3h after last activity ⇒ `ended_at == last_activity_at`, `bounded_active_seconds() == 90` not ~10800.

---

# Phase 5 — Universal Correlation Engine

The core that planai.md left "not built".

- [x] **p5.0 DECISION: named correlation windows.** → resolved in Decisions log: a `CorrelationWindows` value type, one named+reasoned field per evidence pair (`hook_to_transcript` 10s, `editor_to_ai_edit` 5s, `filesystem_to_agent_activity` 60s, `snapshot_to_hook` 30s, `filesystem_to_editor_input` 15s, `session_liveness_grace` 120s), the engine takes `&CorrelationWindows`, day/session clip is a separate hard clip. Committed `docs(planai2-p5.0)`.
- [x] **p5.1 Unified evidence intake.** New `ai/correlation_engine.rs`: `CorrelationInput` (one metadata-only record per producer — `EvidenceKind` ∈ {NativeHook, StructuredMcp, CompletedTranscriptToolCall, ToolSnapshot, FilesystemObserver, SessionProcessObserver, EditorInput}) with a verbatim `lineage_id`, and `CorrelationEngine::ingest` preserving lineage + insertion order. Landed `CorrelationWindows` (p5.0 table, six doc-commented fields, `DEFAULT`) with `between(a,b)` mapping a pair → its window order-independently. `correlation.rs` untouched; engine sits above it. Re-exported from `ai/mod.rs`. Commit `9f081ac`.
  - Tests: `every_producer_kind_can_be_ingested_and_keeps_its_lineage_id`, `entity_is_normalised_on_intake_and_grouping_uses_the_normal_form`, `correlation_windows_are_distinct_and_round_trip`, `between_maps_evidence_pairs_to_the_right_window_order_independently`, `a_correlation_input_carries_no_content_field`, `is_verified_ai_edit_only_for_the_direct_producers`. Gates: fmt/clippy/test --workspace green (207 core); duration-audit verify_port/golden(total_error 0.0)/verify_actor_migration ok.
- [x] **p5.2 Decision rules — exactly as planai2.md §5 states them.** `correlation_engine.rs`: `AiVerdict` (the four §5 outcomes; `system` is **not** one — p5.4 maps system actors to `Unknown` + a system `VerdictReason`), `VerdictReason` (which §5 clause fired), `Verdict {verdict, reason, supporting_lineage: Vec<lineage_id>}`, `CorrelationEngine::verdict_for(entity, at)`. §5 gives the four predicates with **no precedence** → precedence is the p5.2 DECISION (Decisions log 2026-09-01 — p5.2), pinned by the §5 ACs. `TimeWindowMatches` uses `windows.between(FilesystemObserver, candidate.kind)` per pair, fallback `filesystem_to_agent_activity` only where `between` is `None`. `RecentAgentToolOrSession` strength is evaluated **by the engine** via a new optional `CorrelationInput.evidence_strength: Option<EvidenceStrength>` + `EvidenceStrength::is_strong_enough_to_infer()` — a `ProcessNameOnly` session never counts. Commit `c45beca`.
  - `ai_verified` ⇐ `NativeHook(file)` OR `StructuredMcpWrite(file)` OR `CompletedStructuredToolCall(file)`.
  - `ai_inferred` ⇐ `FileChanged(file)` AND `RecentAgentToolOrSession(workspace)` AND `TimeWindowMatches` AND `FingerprintOrChangeShapeMatches` AND `NoCompetingAgentEvidence`. **Process name alone is insufficient.**
  - `human` ⇐ `PositiveEditorInput(file)` AND `CorrelationWindowClosed` AND `NoConflictingAiEvidence`.
  - `unknown` ⇐ `FileChangedWithoutSufficientProvenance` OR `ConflictingHumanAndAiEvidence` OR `MultipleCompetingAiSessions`.
  - Tests (15 new, core 207→222): `a_native_hook_for_the_file_is_ai_verified`, `two_agents_both_verified_for_one_file_is_unknown_competing`, `p5_a4_a_shell_change_from_an_active_verified_session_is_ai_inferred`, `p4_a3_process_name_only_sessions_cannot_infer_and_stay_unknown`, `p3_a5_and_p5_a1_a_lone_filesystem_change_is_unknown_never_human_or_ai`, `p4_a1_a_session_with_no_change_produces_no_attribution`, `positive_editor_input_after_the_window_closes_is_human`, `editor_input_while_the_window_is_still_open_is_unknown_not_yet_human`, `p5_a3_simultaneous_human_and_inferred_ai_edit_is_unknown_not_human`, `p5_a2_a_human_edit_just_before_an_ai_edit_keeps_its_own_human_verdict`, `two_strong_agent_sessions_competing_is_unknown`, `a_fingerprint_mismatch_blocks_ai_inferred`, `a_change_outside_every_window_is_unknown_no_evidence`, `confidence_comes_from_the_evidence_combination_not_the_agent_name`, `the_verdict_carries_the_lineage_that_backed_it_and_no_content`. Gates: fmt/clippy/test --workspace green; duration-audit verify_port/golden(total_error 0.0)/verify_actor_migration ok.
- [x] **p5.3 Boundary clipping.** `ClipBounds` (half-open `[start, end)` instant range) + `utc_day()` / `session(started_at, until)` / `contains` / `intersect`; `CorrelationEngine::verdict_for_within(entity, at, bounds)` runs the §5 ladder after **hard-dropping** every input outside `bounds` (not a `CorrelationWindows` tolerance — a real clip), `inputs_for_within()` exposes the survivors. `verdict_for` now delegates to a shared private `decide()`; un-clipped path unchanged. Commit `bd93fa5`.
  - Tests (4, core 222→226): `clip_bounds_utc_day_is_midnight_to_midnight_and_half_open`, `an_edit_spanning_midnight_is_attributed_to_each_day_separately` (day-1 clip ⇒ `AiInferred` from day-1 evidence only; day-2 clip ⇒ `Human` from the day-2 save only), `evidence_from_before_a_session_started_is_clipped_out` (pre-`started_at` change + sighting dropped ⇒ `Unknown`/`NoEvidence`), `clip_bounds_intersect_is_the_overlap_or_none`. Gates + duration-audit(total_error 0.0) green.
- [x] **p5.4 System actors.** `SystemActorKind` (Formatter / Build / VersionControl / Codegen) + optional `CorrelationInput.system_actor` a producer sets for a recognised formatter/build/VCS/codegen sweep. `verdict_for` rule 3 (between `ai_verified` and every conflict/inferred/human branch): any relevant input with `system_actor` set ⇒ `Unknown` / `VerdictReason::SystemActor`. A native hook still wins (rule 2); `system` stays a reason under `Unknown`, not a 5th `AiVerdict`. `decide()` is per-entity so system evidence for one file never suppresses a real agent edit on another. **Closes p5.A5.** Commit `aae2f6e`.
  - Tests (5, core 226→231): `p5_a5_a_formatter_write_burst_is_system_not_ai_inferred` (fmt sweep + live strong session ⇒ `Unknown`/`SystemActor`), `p5_a5_a_git_merge_touching_a_file_is_not_attributed_to_ai_or_human` (VCS change + concurrent editor input ⇒ `Unknown`/`SystemActor`), `a_verified_hook_still_wins_over_a_concurrent_formatter_pass`, `system_actor_evidence_for_one_file_does_not_suppress_a_real_ai_edit_on_another`, `system_actor_kind_round_trips_through_json`. Gates + duration-audit(total_error 0.0) green.
- [x] **p5.5 Confidence + lineage.** Confidence = `AiVerdict` itself (verified > inferred > unknown), reached by the evidence-combination ladder — never keyed on the agent name. `Verdict` is planai2.md §5's evidence-lineage record: grade + `VerdictReason` (the §5 clause) + `supporting_lineage` (producer `lineage_id`s the engine walked), no source content. Doc comment reframed to say so. Commit `08208a0`. **Phase 5 complete.**
  - Tests (2, core 231→233): `same_agent_different_evidence_sets_yield_different_verdicts` (one agent string; native-hook vs fs+strong-session vs fs+name-only-session ⇒ `AiVerified` / `AiInferred` / `Unknown`), `a_lineage_record_is_ids_plus_a_reason_and_never_file_content` (serialized `Verdict` = exact walked ids + machine-readable reason; asserts no content/diff/patch/prompt/source/text/body key, no fingerprint value, no path; round-trips). Gates + duration-audit(total_error 0.0) green.

### Phase 5 acceptance criteria — named tests

- [x] **p5.A1** `unknown` is never flipped to `human` by the mere absence of AI evidence. → `p3_a5_and_p5_a1_a_lone_filesystem_change_is_unknown_never_human_or_ai` (no AI + no editor input ⇒ `Unknown`, not `Human`); `human` requires a *positive* `EditorInput`.
- [x] **p5.A2** Human input just before an AI edit is not retroactively swallowed by the AI edit. → `p5_a2_a_human_edit_just_before_an_ai_edit_keeps_its_own_human_verdict` (`verdict_for` at the human's time ⇒ `Human`; at the later AI edit's time ⇒ `AiInferred` — each change keeps its own verdict, `verdict_for` is per-change).
- [x] **p5.A3** A simultaneous human/AI conflict is not auto-resolved to `human`. → `p5_a3_simultaneous_human_and_inferred_ai_edit_is_unknown_not_human` (`EditorInput` + strong session inside `editor_to_ai_edit` ⇒ `Unknown` / `ConflictingHumanAndAiEvidence`).
- [x] **p5.A4** A shell mutation from an active verified tool session is correctly inferred. → `p5_a4_a_shell_change_from_an_active_verified_session_is_ai_inferred` (`FilesystemObserver` + `ProcessTreeCwdMatch` session in-window ⇒ `AiInferred` / `InferredFromAgentActivity`).
- [x] **p5.A5** Formatter / git / build never become an AI false positive. → `p5_a5_a_formatter_write_burst_is_system_not_ai_inferred` + `p5_a5_a_git_merge_touching_a_file_is_not_attributed_to_ai_or_human` (p5.4: `system_actor` input ⇒ `Unknown`/`SystemActor`, ahead of the `ai_inferred`/conflict/human branches).

---

# Phase 6 — Dedup and Canonical Heartbeat Generator

**Every item here is duration-gated** (run the four `duration-audit` scripts).

- [x] **p6.1 Versioned canonical fingerprint.** New `ai/canonical.rs`: `CanonicalIdentity<'a>` {workspace, entity, change kind, `occurred_at_unix`, `content_fingerprint` OR `line_delta`, `session_or_tool_id`} + `CanonicalFingerprint::v1(&identity)` — UUIDv5 (broker.rs convention) over `scheme | workspace | normalized entity | change kind | time-bucket | (cf: else ld:) | id:`. **Transport-independent by construction**: `CanonicalIdentity` has no `EvidenceKind`/producer field, and the timestamp is bucketed to `FINGERPRINT_TIME_BUCKET_SECONDS` (10 s), so a hook + its transcript line hash identically. Scheme prefix explicit in the value (`caf1:<uuid>`, `FINGERPRINT_SCHEME_V1`, `.scheme()`) — a bump is a visible prefix change. Re-exported from `ai/mod.rs`. Commit `93d7b83`.
  - Tests (6): `same_logical_edit_from_two_transports_yields_one_fingerprint`, `a_fingerprint_scheme_version_is_explicit_in_the_value`, `timestamps_crossing_a_bucket_boundary_produce_a_different_fingerprint`, `entity_change_kind_workspace_and_identity_each_change_the_fingerprint`, `a_line_delta_is_used_only_when_no_content_fingerprint_is_present`, `entity_path_is_normalised_before_hashing`. Gates: fmt/clippy/test --workspace green (250 core); duration-audit verify_port/golden(total_error 0.0)/verify_actor_migration ok.
- [x] **p6.2 Canonical activity aggregates child evidence IDs.** `CanonicalActivity` in `ai/canonical.rs` — keyed by the p6.1 `CanonicalFingerprint`, holds `Vec<ChildEvidence { kind: EvidenceKind, lineage_id }>`. `add_child`/`with_child` idempotent per `(kind, lineage_id)`; `merge(&other)` unions two same-fingerprint activities (§6 "different event_id + same fingerprint → merge") and **panics** on a fingerprint mismatch. `child_lineage_ids()` / `evidence_kinds()` expose the aggregate. Ids + kinds only, no content/timestamps. `CanonicalFingerprint` gains `serde(transparent)`. Re-exported (`CanonicalActivity`, `ChildEvidence`). Commit `419e198`.
  - Tests (5): `a_canonical_activity_built_from_three_evidence_sources_lists_all_three_child_ids`, `folding_the_same_child_twice_is_idempotent`, `merging_two_activities_for_one_fingerprint_unions_their_children`, `merging_activities_with_different_fingerprints_panics`, `a_canonical_activity_serializes_to_ids_and_kinds_only`. Gates: fmt/clippy/test --workspace green (255 core); duration-audit (total_error 0.0) ok.
- [x] **p6.3 Dedup rules.** New `ai/dedup.rs`: `dedup(Vec<DedupObservation>) -> DedupOutcome { activities, total_active_seconds, conflicts, duplicates_dropped }`. Rule 1 same id+payload → counted duplicate, dropped. Rule 2 same id+diff payload → `DedupConflict{event_id, kept_payload_hash, rejected_payload_hash}`, first-seen stands (mirrors broker `ON CONFLICT … DO NOTHING`), no overwrite, no fresh activity. Rule 3 diff id + same `CanonicalFingerprint` → one merged activity, both events' children aggregated. Rule 4 `strongest_evidence` = `min_by(broker::evidence_rank_key)` — new `pub fn broker::evidence_rank_key(transport,&source,&confidence,occurred_at)`, private `evidence_rank(&BrokerEventV1)` now delegates to it (behaviour-preserving, broker tests untouched); **one ladder, reused**. Rules 5/6 duration = strongest source obs's `active_seconds` summed over activities (never over raw obs); with the ingress `spread_single_tool_interval`, 3-file and 1-file events of one interval both total T and a full replay still totals T. `DedupObservation` is a lean projection, **not** `BrokerEventV1` (DECISION: broker.rs concurrent-churned, no crate-public builder). `CanonicalActivity` gains `#[serde(default)] strongest_evidence: Option<ChildEvidence>`. Commit `9756d8a`.
  - Tests (7): `rule1_same_event_id_same_payload_is_a_silent_duplicate`, `rule2_same_event_id_different_payload_is_a_kept_conflict_not_an_overwrite`, `rule3_different_event_ids_same_fingerprint_merge_into_one_activity`, `rule4_verified_evidence_supersedes_inferred_for_the_strongest_pointer`, `rule5_a_multi_file_event_does_not_multiply_duration_by_file_count`, `rule6_replaying_the_same_multi_file_event_adds_no_duration`, `two_verified_events_for_one_fingerprint_still_yield_one_duration_point`. Gates: fmt/clippy/test --workspace green (262 core); duration-audit verify_port/golden(**total_error 0.0**)/verify_actor_migration ok.

### Phase 6 acceptance criteria — named tests

- [x] **p6.A1** Duplicate canonical activity rate < 0.1% over the test corpus (record it). → `p6_a1_duplicate_canonical_activity_rate_is_far_below_one_per_mille`: 500-edit synthetic corpus (hook + filesystem per edit, 30 exact hook redeliveries); `residual_duplicate_activities() == 0` ⇒ residual rate **0.0 < 0.1%**; recorded absorbed-replay rate `duplicate_rate() ≈ 2.9%`. New `DedupOutcome::{observations_in, duplicate_rate(), residual_duplicate_activities()}`.
- [x] **p6.A2** VS Code + hook + transcript + filesystem evidence for one edit → exactly one activity. → `p6_a2_vscode_hook_transcript_and_filesystem_evidence_for_one_edit_is_one_activity`: 4 `DedupObservation`s (EditorInput/NativeHook/CompletedTranscriptToolCall/FilesystemObserver), one shared fingerprint ⇒ `activities.len() == 1`, 4 children, strongest = NativeHook.
- [x] **p6.A3** Restart / replay adds no duration (re-run the dedup + duration gates). → `p6_a3_restart_and_replay_add_no_duration`: corpus once vs corpus++corpus ⇒ same `total_active_seconds` (`500 × 60 s`), same activity count, every second-copy obs dropped as a duplicate. Duration-audit re-run green.
- [x] **p6.A4** An evidence conflict is stored as a diagnostic, not silently overwritten. → `p6_a4_an_evidence_conflict_is_a_stored_diagnostic_not_an_overwrite`: same `event_id`, payload-A then payload-B ⇒ one `DedupConflict{kept: A, rejected: B}`, activity still reflects only the first-seen child/strongest — nothing replaced.
- [x] **p6.A5** `golden.py` still `total_error: 0.0`; `verify_port.py` still green. → gate, re-run at `4a30d35`: `verify_port` ok, `golden.py` `total_error 0.0`, `verify_actor_migration` ok. **Phase 6 complete.**

---

# Phase 7 — Observability, Shadow Mode and Rollout

Duration-gated **and** frontend-gated where it touches `frontend/app/`.

- [x] **p7.1 Pipeline stage model.** New `ai/pipeline.rs`: `PipelineStage` (AgentDetected → AdapterInstalled → EvidenceReceived → Correlated → AcceptedLocally → QueuedForDelivery → Delivered | Rejected) with `rank()`/`is_terminal()`/`can_advance_to()`; `PipelineTracker` holds one `AgentPipelineState` per agent (stage + `entered_stage_at` + full `history` + `rejection_reason`). `observe()` advances forward (skips OK), refuses equal/backward/out-of-terminal moves with `StageRegression` (agent untouched — p7.1 "no skipping backwards silently"); first sighting may start mid-chain; `reject()` is the terminal rejection from any non-terminal stage. `snapshot()` = the per-agent read model (stage + timestamps only, no evidence content) an API/CLI-`doctor`/editor panel returns. HTTP/CLI surfacing deferred (concurrent `wakaclock-cli/src/main.rs` churn) — the read model is the contract. Re-exported from `ai/mod.rs`. Commit `e9f5220`.
  - Tests (7, core 266→273): `pipeline_advances_through_the_chain_and_refuses_to_regress`, `the_snapshot_returns_the_current_stage_per_agent`, `a_rejection_is_reachable_from_any_non_terminal_stage_and_is_terminal`, `a_forward_skip_is_allowed_and_recorded_in_history`, `a_first_sighting_can_start_mid_chain`, `the_read_model_serializes_without_evidence_content`, `can_advance_to_encodes_the_transition_rules`. Gates: fmt/clippy/test --workspace green; duration-audit (total_error 0.0) ok.
- [x] **p7.2 Diagnostics UI + commands.** `AtoAxis: Test AI Detection`, `AtoAxis: Repair AI Integrations` (VS Code). Evidence source/confidence explainer (frontend dashboard). Broker-health panel + parser-lag / stale-adapter warnings split out to **p7.2c** (need local state the server never receives — see Decisions log 2026-09-02).
  - Tests: VS Code command registration test; frontend panel render test with a query key that includes `userId`; `npm run validate` green.
  - **VS Code half done** (`1de00d0`): `AtoAxis: Repair AI Integrations` + `AtoAxis: Show AI Broker Status` already existed; added `AtoAxis: Test AI Detection` → new `src/aiDetectionSelfTest.ts` (`runAiDetectionSelfTest(deps)` composes broker + adapter status into an `ok`/`degraded`/`failing` verdict with per-check severity: broker reachable/running, inbox draining, last-delivery error, 24h evidence freshness, agent detected/enabled; `formatAiDetectionReport`). Registered in `commands.ts`, contributed in `package.json`. 12 vitest cases (9 verdict logic + 3 registration). `npm run lint` clean, `npm test` 94 pass. `out/src/commands.js` regen owed (can't split from concurrent refactor's edits to the same generated file). Rust gates unchanged (no Rust touched).
  - **Frontend half done** (`40fba12`): new `components/wakaclock/ai-attribution-legend.tsx` — `AiAttributionLegend` states the §5 decision rule per class (verified = native hook/MCP named itself; inferred = agent activity in the correlation window, no competing editor input; human = positive editor keystroke/save, no agent in window; unknown = unproven or conflicting, never AI). Rendered on `ai/page.tsx` from the existing `wakaclockKeys.aiStats(userId, …)` query — no new endpoint. Metadata only: privacy test asserts none of `diff/patch/prompt/clipboard/content/source code` render. `test/wakaclock-ai-attribution-legend.test.tsx` (4 cases). `npm run validate` green (41 files, 217 tests, up from 40/213).
  - → `40fba12` | tests: `AiAttributionLegend` ×4 (class+rule render, per-class heartbeat share, privacy-vocabulary absence, userId-scoped key) | gates: `npm run validate` green
- [ ] **p7.2c Local AI diagnostics telemetry channel.** The broker-health panel (inbox pending/retry/dead-letter, running state) and parser-lag / stale-adapter warnings from p7.2's original text need broker inbox state and transcript-parser lag that live only on the client (`wakaclock doctor ai`) and never reach the hosted API. Requires: a client→server push of sanitized broker/parser/adapter-freshness metadata, a server read model + `GET` endpoint (handler→service→repository), then the dashboard panel + `userId`-keyed query + render test. **Not `[~]`** — no missing tool, this is unbuilt infrastructure. Blocks Run DoD until built or explicitly descoped by the user.
  - Tests: server round-trip over a fixture diagnostics payload asserting metadata-only (no prompt/diff/patch/source/argv/clipboard keys); frontend panel render test with a `userId`-scoped query key; `npm run validate` + backend gate suite green.
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

### 2026-09-01 — p5.0 — named correlation windows

Read: `correlation.rs` (`EXACT_MATCH_WINDOW = 5s`, editor↔AI-event, measured to an
`EditorObservation`'s *window* not a point) and `extensions/vscode/src/aiAttribution.ts`
(`CORRELATION_WINDOW_SECONDS = 15s`, point-to-point on the editor side).

**Decision: a `CorrelationWindows` value type with one named, individually-reasoned
field per evidence pair — never a single shared constant.** The Phase 5 engine
takes `&CorrelationWindows`, so tests (and a future config) can vary them;
`CorrelationWindows::DEFAULT` holds:

| pair (field) | window | reason |
|---|---|---|
| `hook_to_transcript` | **10 s** | the transcript is appended by the *same* tool moments after its hook fires; wider would merge two genuinely separate edits of one file into one canonical event |
| `editor_to_ai_edit` | **5 s** | unchanged — the existing `EXACT_MATCH_WINDOW`, measured to the editor flush *window*. The VS Code side's 15 s is point-to-point and deliberately not unified (`correlation.rs` doc) |
| `filesystem_to_agent_activity` | **60 s** | fs events lag (fsync, editor debounce, the atomic-save rename sequence); "an agent tool/session was active around this change" tolerates more slack than a line-level claim, but 60 s still excludes a formatter or `git` run minutes later |
| `snapshot_to_hook` | **30 s** | the before/after git-sweep brackets one shell/MCP tool call; its hook event fires inside that bracket — 30 s covers a slow multi-file `apply_patch` without reaching the next tool call |
| `filesystem_to_editor_input` | **15 s** | matches the VS Code extension's own `CORRELATION_WINDOW_SECONDS`; a human editor save emits an editor-buffer flush and an fs event within a few seconds of each other |
| `session_liveness_grace` | **120 s** | **not a point match** — a session/process counts as live at change time `t` when `started_at ≤ t ≤ ended_at` (or `last_activity_at + this grace` while still live). A scan cadence is seconds-to-a-minute, so ~90 s of prior liveness is still plausible causation; 5 min of silence is not |

The session/day boundary clip (p5.3) is a **hard clip**, not a window — kept
separate. Every window is a field with its own doc comment carrying the reason
above, so no future edit can collapse them into one number without deleting a
documented rationale.

Commit: `docs(planai2-p5.0)` (this file only).

---

### 2026-09-01 — p5.2 — verdict precedence order

Read: `planai2.md` §5 verbatim. It states the four predicates (`ai_verified`,
`ai_inferred`, `human`, `unknown`) as **independent boolean formulas with no
precedence**. `NativeHook(file)` alone satisfies `ai_verified`; a concurrent
`PositiveEditorInput` simultaneously satisfies `unknown`'s
`ConflictingHumanAndAiEvidence` disjunct. §5 does not say which wins — so the
order is a DECISION here, constrained by the §5 acceptance criteria: "unknown is
not turned into human by *absence* of AI evidence" and "a simultaneous human/AI
conflict is not *auto-resolved to human*" (neither forbids `ai_verified`).

**Decision — `verdict_for` evaluates the predicates in this fixed order, first
match wins:**

1. ≥2 distinct agents with **verified** evidence for the file, in-window → `Unknown` / `MultipleCompetingAiSessions`
2. ≥1 **verified** producer for the file, in-window → `AiVerified` / `DirectAiProducer` — the agent's own hook/tool-call is authoritative and outranks concurrent editor input; the conflict rule governs *inferred*-strength AI evidence, not verified
3. `PositiveEditorInput` **and** inferring AI evidence within `editor_to_ai_edit` of it → `Unknown` / `ConflictingHumanAndAiEvidence`
4. ≥2 distinct agents with **inferring** activity (each past the p4 strength bar), in-window → `Unknown` / `MultipleCompetingAiSessions`
5. `FileChanged` + exactly one agent's inferring activity + pair time-window matches (`between`) + `FingerprintOrChangeShapeMatches` + no editor input within `filesystem_to_editor_input` that would explain the change → `AiInferred` / `InferredFromAgentActivity`
6. `PositiveEditorInput` + `at ≥ latest_editor + editor_to_ai_edit` (window closed) → `Human` / `PositiveEditorInput`; window still open → `Unknown` / `CorrelationWindowStillOpen`
7. `FileChanged`, none of the above → `Unknown` / `FileChangedWithoutSufficientProvenance`
8. nothing relevant in-window → `Unknown` / `NoEvidence`

Supporting: `TimeWindowMatches` = `windows.between(FilesystemObserver, candidate.kind)`
per pair (fallback `filesystem_to_agent_activity` only where `between` is `None`) —
`between` is load-bearing, not decorative. `RecentAgentToolOrSession` strength is
judged **by the engine**: new optional `CorrelationInput.evidence_strength:
Option<EvidenceStrength>`; a `SessionProcessObserver` counts only if
`EvidenceStrength::is_strong_enough_to_infer()` (a bare `ProcessNameOnly` never
does — §5 "process name alone is not enough"); tool-call kinds
(`NativeHook`/`StructuredMcp`/`CompletedTranscriptToolCall`/`ToolSnapshot`)
always count. `FingerprintOrChangeShapeMatches`: exact fingerprint match if both
sides carry one, else change-kind match if both carry one, else not disprovable →
does not veto. `system` is **not** an `AiVerdict` variant — p5.4 maps system
actors to `Unknown` + a system `VerdictReason`.

Commit: `feat(planai2-p5.2)` (code) + this file.

---

### 2026-09-02 — p6.3 — dedup layer shape and conflict semantics

Read: `broker.rs` inbox ingest (`ON CONFLICT(event_id) DO NOTHING` →
`BrokerIngestOutcome::{Accepted,Duplicate,Conflict}`; a differing payload on a
seen `event_id` is **rejected, the first row kept**), `evidence_rank` /
`evidence_supersedes` / `strongest_evidence` (the p2.1 4-tuple ladder), and
`wakaclock-cli::spread_single_tool_interval` (p2.2 — a multi-file tool call's
interval is already put entirely on the first record at *ingress*).

**Decisions:**

1. **Lean `DedupObservation` input, not `BrokerEventV1`.** `broker.rs` is in the
   concurrent change set and `BrokerEventV1` is a 24-field struct with no
   crate-public test builder; coupling p6.3 to it would make every dedup test a
   24-field literal against a moving target. `DedupObservation` carries only what
   the six rules need: `event_id`, `payload_hash`, `CanonicalFingerprint`,
   `kind: EvidenceKind`, `lineage_id`, `active_seconds`, and the four ladder
   inputs (`transport`, `source`, `confidence`, `occurred_at`). Caller maps its
   events in.
2. **One ladder — reuse `broker`'s.** Add `pub fn broker::evidence_rank_key(transport, source, confidence, occurred_at) -> (u8,u8,u8,i64)`; the existing private `evidence_rank(&BrokerEventV1)` becomes a one-line delegate. p6.3 ranks with `evidence_rank_key`, never a second ladder (behaviour-preserving refactor; broker tests untouched).
3. **Conflict = first-seen stands, new payload recorded and dropped** — mirrors the broker's `DO NOTHING`. A conflicted `event_id` does **not** overwrite or replace anything and does **not** contribute a fresh canonical activity; it yields a `DedupConflict { event_id, kept_payload_hash, rejected_payload_hash }` diagnostic. (p5.2/advisor: "picking a winner and proceeding is still an overwrite".)
4. **Duration counted once per canonical activity** = the *strongest* source observation's `active_seconds`, summed over activities — never summed over raw observations. Combined with the ingress spread, a multi-file event (3 fingerprints, seconds `[T,0,0]`) and a single-file event (`[T]`) both total `T`; a replay (duplicate `event_id`s) drops the dups and still totals `T`.

New module `ai/dedup.rs` (keeps the `ai/mod.rs` staging dance to one `pub mod` +
one `pub use`). `CanonicalActivity` gains an `#[serde(default)]
strongest_evidence: Option<ChildEvidence>` (set by `dedup`, `null` for a
hand-built activity — p6.2 round-trip test still green).

Commit: `feat(planai2-p6.3)` (code: `ai/dedup.rs`, `ai/canonical.rs`,
`broker.rs` rank shim, `ai/mod.rs` my hunks) + this file.

### 2026-09-02 — p7.2 — evidence legend vs. broker-health panel: scope split

Read: `backend/api/src/handlers/v1/ai_stats.rs` + `services/ai_stats.rs` +
`model/ai_stats.rs` (the only server-side AI read model — per-agent
`actor_type` ∈ {ai_verified, ai_inferred, human, unknown}, daily verified/
inferred line split, provider/model, heartbeat counts + percentages; **no
per-source/transport breakdown, no per-agent last-seen timestamp**),
`frontend/app` endpoints (`/users/current/ai_stats`, `/status_bar/today` only).

**Decision: p7.2's frontend text is two different things; ship the one whose
data already reaches the server, split the other out.**

1. **Evidence source/confidence explainer → shipped as `feat(planai2-p7.2)`.**
   `AiAttributionLegend` is pure presentation over the existing
   `wakaclockKeys.aiStats(userId, …)` query — no new endpoint. It states the §5
   decision rule for each `actor_type` in the reader's terms. This is the
   "evidence source/confidence tooltip" line of p7.2 and it satisfies the named
   test (frontend panel render test with a `userId`-scoped key).
2. **Broker-health panel + parser-lag / stale-adapter warnings → new item
   p7.2c.** These need the broker inbox counters and transcript-parser lag that
   exist only in `wakaclock doctor ai` on the client; the hosted API has no
   representation of local broker state, so a `GET /ai/diagnostics` today would
   have nothing to serve. A server-side stale-adapter *inference* is also not
   cleanly possible: `ai_stats` exposes no per-source heartbeat mix over time.
3. **p7.2c is `[ ]`, not `[~]`.** planai2.md line 604 / Run DoD clause 2 reserve
   `[~]` for items blocked on a *tool not installed on this machine*. "Needs a
   telemetry channel we have not built" is unbuilt scope, not a missing tool —
   it stays a first-class `[ ]` that blocks Run DoD until built or the user
   descopes it. (Advisor concurred: marking it `[~]` would let the loop declare
   Done over real unbuilt work.)

Files: `frontend/app/components/wakaclock/ai-attribution-legend.tsx` (new),
`frontend/app/test/wakaclock-ai-attribution-legend.test.tsx` (new),
`frontend/app/app/dashboard/(auth)/wakaclock/ai/page.tsx`. Commit `40fba12`
+ this file.

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
- 2026-08-31 — p2.3 — done. `rollout_scaffold_manifests()` — 8 manifests (cursor + generic-mcp Scaffold, antigravity/copilot/windsurf/cline/roo-code/opencode Unverified), data-only, no parser. VERIFICATION.md p2.3 table + promotion recipe. 1 new test + 1 updated (adapter 10→11). Gates green. Committed `753969b`.
- 2026-08-31 — p2.A1–A4 — Phase 2 acceptance. p2.A1 `[~]` (fixture recall 100% via existing per-fixture parser tests; live ≥99% gate reserved). p2.A2/p2.A3 cited to existing server + parser tests. 1 new: `p2_a4_no_builtin_adapter_reports_a_verification_state_it_cannot_back` (all 11 manifests). **Phase 2 done.** Gates green. Committed `ec58587`.
- 2026-09-01 — p3.1 — done. New pure `wakaclock_core::ai::workspace` — `WorkspaceRegistry` (register/refresh/release/prune_expired/watched_roots/is_watched/exclude_rules_for) + `WorkspaceLease` + `LeaseError` (RootTooBroad guards $HOME/ancestors/`/`). 6 new tests (core 164→170). Gates + duration-audit green. Committed `261fb21`.
- 2026-09-01 — (interruption) concurrent "clipboard tracking / input-activity" feature (~1,780 lines, 48 files) appeared in the working tree during the loop. Verified the whole mixed tree green (backend + vscode 81 + frontend 213) and committed it on its own as `b40b4f4 feat(input-activity): …` so the planai2 history stays clean, then resumed.
- 2026-09-01 — p3.2 — done. `ObserverPool` in `filesystem_observer.rs` — `sync(&[roots])` reconciles the live `WorkspaceWatcher` set (returns `SyncOutcome{started,stopped}`, idempotent), `poll()` drains + drops out-of-scope events, `is_within_watched()`. Fed by `WorkspaceRegistry::watched_roots(now)`. 3 new tests (core +3). Gates + duration-audit green. Committed `83a16ac`.
- 2026-09-01 — p3.3 — done. `coalesce_burst()` (atomic-save + dedup), `canonicalize_within_root()` (symlink-escape guard), `WorkspaceIgnore` (.gitignore + lease excludes, simple matcher), `fingerprint_changed_file()` (uuid-v5 hash, discards bytes, size-capped). 9 new tests (core +9). Gates + duration-audit green. Committed `306e08f`.
- 2026-09-01 — p3.4 — done. `BoundedEventBuffer` (fixed-cap VecDeque ring, evict-oldest + `dropped()` counter, `DEFAULT_CAPACITY=4096`) + `ObserverPool::poll_into()`. 4 new tests incl. 10k-storm-stays-bounded + idle-watcher-doesn't-spin. core +4. Gates + duration-audit green. Committed `3320dcd`.
- 2026-09-01 — p3.A1–A5 — Phase 3 acceptance. p3.A1/A2/A4 cited to p3.1–p3.4 tests. 2 new: `p3_a3_rename_is_normalized_...` (Removed+Created, never Modify), `p3_a5_a_filesystem_event_carries_no_actor_or_confidence_by_construction` (structural). p3.A5 `[~]` — full lone-fs-event⇒`unknown` guarantee is Phase 5. **Phase 3 done.** core +2. Gates green. Committed `7f4b90e`.
- 2026-09-01 — p4.1 — done. New `ai::session` — `SessionProcessEvidence` (12 fields, **no argv/env**, structural + JSON guards) + `EvidenceStrength` (5-tier ladder, `is_strong_enough_to_infer` = name-only can't infer) + `from_detected_process()` + `bounded_active_seconds()` (never wall-clock now). 5 new tests (core +5). Gates + duration-audit green. Committed `faad03d`.
- 2026-09-01 — p4.2 — done. `evidence_from_scan()` (cwd in a registered root ⇒ `ProcessTreeCwdMatch`, else `ProcessNameOnly`; never returns the hook/transcript-only tiers) + `strongest_session_evidence()` (rank then recency, skips ended). 2 new tests (core +2). Gates + duration-audit green. Committed `62795bb`.
- 2026-09-01 — p4.3 — done. `SessionEvidenceLedger` — `observe()` (insert/refresh by pid) + `reap(&running_pids)` closes gone processes at `last_activity_at` (never `now`) and returns them. 3 new tests. core +3. Gates + duration-audit green. Committed `330ca78`.
- 2026-09-01 — p4.A1–A4 — Phase 4 acceptance. p4.A2/p4.A4 cited to p4.2/p4.3 tests. 2 new: `p4_a1_...has_no_path_to_a_heartbeat_on_its_own` (structural), `p4_a3_multiple_name_only_tools_active_cannot_be_inferred`. p4.A1/A3 `[~]` — runtime verdicts are Phase 5. **Phase 4 done.** core +2. Gates green. Committed `300648d`.
- 2026-09-01 — p5.0 — DECISION resolved (docs only). `CorrelationWindows` type, one named+reasoned window per evidence pair (10s hook↔transcript, 5s editor↔AI-edit, 60s fs↔agent-activity, 30s snapshot↔hook, 15s fs↔editor, 120s session-liveness grace), engine takes `&CorrelationWindows`, day/session clip separate. See Decisions log. Committed.
- 2026-09-01 — p5.1 — done. New `ai/correlation_engine.rs`: `EvidenceKind` (7 producers, strongest-first `Ord`), `CorrelationInput` (verbatim `lineage_id` + normalized entity + optional workspace/agent/change_kind/confidence/session/tool-event/fingerprint — **no content field**), `CorrelationEngine::ingest` (preserves lineage + order) + `for_entity`/`entities`. `CorrelationWindows` (p5.0 six fields + `DEFAULT` + `between(a,b)` order-independent). Re-exported from `ai/mod.rs`. 6 new tests (core 201→207). Fixed one self-bug: `between` match arms must be in sorted `EvidenceKind` order. Gates + duration-audit(total_error 0.0) green. Committed `9f081ac`.
- 2026-09-01 — p5.2 — done. §5 verdict pass: `AiVerdict` (4 outcomes, no `system`), `VerdictReason` (8 clauses), `Verdict {verdict, reason, supporting_lineage}`, `CorrelationEngine::verdict_for(entity, at)`. §5 has no stated precedence → 8-step fixed order recorded as a DECISION (Decisions log), constrained by the §5 ACs. `between()` drives `TimeWindowMatches`; new optional `CorrelationInput.evidence_strength` lets the engine (not the producer) apply `is_strong_enough_to_infer()`. 15 new tests (core 207→222). **Discharged** `[~]` p3.A5 / p4.A1 / p4.A3 (added runtime engine tests alongside the structural ones) and p5.A1–p5.A4; p5.A5 `[~]` → p5.4 (system actors). Gates + duration-audit(total_error 0.0) green. Committed `c45beca` (+ this tracker `<next>`).
- 2026-09-01 — p5.3 — done. `ClipBounds` half-open `[start,end)` + `utc_day`/`session`/`contains`/`intersect`; `verdict_for_within(entity, at, bounds)` hard-drops out-of-range inputs before the §5 ladder, `inputs_for_within` exposes survivors. `verdict_for` → shared private `decide()`. 4 new tests (core 222→226). Gates + duration-audit(total_error 0.0) green. Committed `bd93fa5` (+ tracker).
- 2026-09-01 — p5.4 — done. `SystemActorKind` (Formatter/Build/VersionControl/Codegen) + optional `CorrelationInput.system_actor`; `verdict_for` rule 3 (below `ai_verified`, above conflict/inferred/human): `system_actor` set on any relevant input ⇒ `Unknown`/`SystemActor`. Per-entity so it can't suppress a real edit on another file. **Closes p5.A5; all p5.A1–A5 now discharged.** 5 new tests (core 226→231). One clippy fixup (renumbered the doc-comment rule ladder — `doc_list_item` rejects `2b.`). Gates + duration-audit(total_error 0.0) green. Committed `aae2f6e` (+ tracker).
- 2026-09-01 — p5.5 — done. `Verdict` reframed as §5's evidence-lineage record (grade `AiVerdict` = confidence, `VerdictReason` = clause, `supporting_lineage` = producer ids, no content); doc comment updated. 2 new tests (core 231→233): same agent + 3 evidence sets ⇒ 3 different verdicts; lineage record is ids + reason only, no content/fingerprint/path leak, round-trips. **Phase 5 (Universal Correlation Engine) complete — p5.0–p5.5 + p5.A1–p5.A5.** Gates + duration-audit(total_error 0.0) green. Committed `08208a0` (+ tracker).
- 2026-09-02 — p6.1 — done. New `ai/canonical.rs`: `CanonicalIdentity` + `CanonicalFingerprint::v1` (UUIDv5 over workspace|normalized-entity|change-kind|10s-time-bucket|content-fp-or-line-delta|session/tool-id). Transport-independent by construction (no `EvidenceKind` field); explicit `caf1:` scheme prefix. 7 tests. core 233→250 (incl. concurrent `producer.rs` tests). Committed `93d7b83` (+ tracker). NOTE: concurrent feature (`ai/producer.rs` et al.) landed in-tree while paused — not staged/reverted; full gate suite green with it.
- 2026-09-02 — p6.3 — done. `ai/dedup.rs`: `dedup()` applies §6's 6 rules → `DedupOutcome{activities, total_active_seconds, conflicts, duplicates_dropped}`. Conflict = first-seen stands + diagnostic (mirrors broker `DO NOTHING`). Rule 4 reuses `broker::evidence_rank_key` (new pub fn; private `evidence_rank` delegates — behaviour-preserving). Duration = strongest obs's seconds per activity, summed over activities. `DedupObservation` lean (not `BrokerEventV1` — DECISION logged). `CanonicalActivity` += `strongest_evidence: Option<ChildEvidence>`. 7 tests. core 255→262. broker.rs + ai/mod.rs staged via save/restore dance (concurrent hunks kept out). Committed `9756d8a` (+ tracker).
- 2026-09-02 — p6.A1–A5 — done. `DedupOutcome` += `observations_in` / `duplicate_rate()` / `residual_duplicate_activities()`. 4 acceptance tests over a 500-edit synthetic corpus: residual duplicate-activity rate 0.0 (<0.1%), 4-source→1-activity, replay adds no duration (500×60s both ways), conflict is a stored diagnostic. p6.A5 = the duration gate (golden.py total_error 0.0, verify_port green). **Phase 6 complete.** core 262→266. Committed `4a30d35` (+ tracker). dedup.rs is fully mine — no staging dance needed.
- 2026-09-02 — p7.2 (VS Code half) — done. `AtoAxis: Test AI Detection` command: new `extensions/vscode/src/aiDetectionSelfTest.ts` (`runAiDetectionSelfTest` → ok/degraded/failing verdict over broker + adapter status; `formatAiDetectionReport`), registered in `commands.ts`, contributed in `package.json`. 12 vitest cases (vscode 82→94). lint clean. `out/src/commands.js` regen owed (concurrent refactor edits the same generated file). `commands.ts` staged via save/restore dance. Frontend half (broker-health panel + tooltip + parser-lag warnings) blocked on a non-existent backend diagnostics endpoint — see Current position. Committed `1de00d0` (+ tracker).
- 2026-09-02 — p7.2 (frontend half) — done. `AiAttributionLegend` on `ai/page.tsx`: per-class explainer of the §5 decision rule (verified = native hook/MCP; inferred = agent activity in the correlation window with no competing editor input; human = positive editor keystroke/save; unknown = unproven/conflicting, never AI), rendered from the existing `wakaclockKeys.aiStats(userId, …)` query — no new endpoint. Metadata-only privacy test. `test/wakaclock-ai-attribution-legend.test.tsx` ×4. `npm run validate` green (40/213 → 41/217). Scoped out the broker-health panel + parser-lag / stale-adapter warnings to new **p7.2c** — they need local broker/transcript state the hosted API never receives; `[ ]` not `[~]` (unbuilt infra, not a missing tool). Decision logged. **p7.2 now `[x]`.** Committed `40fba12` (+ tracker). Frontend files are outside the concurrent change set — staged directly, no dance.
