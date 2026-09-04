# Implementation progress — `planplugin.md`

Updated 2026-09-03. This ledger covers the complete Phase 0–9 implementation
pass. Code and automated gates for Phases 6–9 are in the worktree; live tool
certification remains honest about clients that are not installed or authenticated
on this host.

## Phase status

| Phase | Implementation status | Live verification status |
|---|---|---|
| 0 Runtime readiness | complete in worktree | broker process/auto-scan verified; managed LaunchAgent needs host-specific runtime confirmation |
| 1 Producer contract | complete in worktree | contract/unit/privacy tests pass |
| 2 Codex | complete in worktree | registry now reports `verified` for the exercised native hook; single-/multi-file native hook has real broker/backend evidence and native+transcript replay dedup; legacy-shell collision run remains |
| 3 Claude migration | complete in worktree | existing live baseline retained; fresh run attempted but blocked by expired OAuth |
| 4 Kilo Code | complete in worktree | scaffold; no Kilo executable is installed here |
| 5 Kimi Code CLI | complete in worktree | scaffold; no Kimi executable is installed here |
| 6 DeepSeek provider/client support | complete in worktree | provider mapping and host-client separation verified; standalone Deep Code remains unverified |
| 7 Correlation and cross-transport dedup | complete in worktree | canonical `caf1` fingerprint is shared by core/server; legacy `v1` fingerprints remain read-compatible; live legacy-shell collision still pending |
| 8 Setup, Doctor, Backend and Frontend health | complete in worktree | setup/status/uninstall, sanitized diagnostics push, backend validation, freshness ordering and dashboard health states are implemented and tested |
| 9 Certification, rollout and acceptance | complete in worktree; live matrix open | metadata-only artifacts and CI privacy/expiry gate pass; Kilo/Kimi/standalone Deep Code and Claude post-migration need external runs |

Phase 6–9 status is intentionally split: “complete in worktree” means the
implementation, tests, documentation and safety gates exist; it never promotes
an adapter from `scaffold`/`unverified` without a real client → broker → backend
run.

“Complete in worktree” means code, installer paths and automated checks are present;
it does not promote an adapter to `verified`. Promotion requires a real tool run and
broker/backend row inspection with version and timestamp evidence.

## Completed in this worktree

- Phase 0: existing broker/service/doctor baseline reviewed; CLI identity and
  native adapter state are now visible in `doctor ai --json`. A `tool-abort`
  command closes failed shell snapshots without emitting an edit. The broker
  worker now starts bounded transcript recovery automatically on every poll, so
  a missed native hook does not require a manual `ai sync`; the process-level
  regression test proves cursor resume, delivery and fail-open behavior. The
  singleton lock now uses an OS file lease held for the broker lifetime and
  retains the path across release, eliminating launchd restart delete/recreate
  races. macOS manifests explicitly pass the user's `HOME` because LaunchAgents
  otherwise start with no home environment; local launchd on this host still
  failed to reach userland for test binaries, so that OS-level health check is
  recorded as host-runtime evidence rather than claimed as verified.
- Phase 1: Rust producer contract (`ai::producer`) normalizes client/provider/model,
  builds stable per-file IDs, validates bounded metadata, and delegates attribution
  to the broker. `common/emit-event.sh` is the shell allowlist boundary; all native
  shell adapters use it with a legacy direct-CLI fallback.
- Phase 2: Codex `apply_patch` adapter now uses the common boundary, has per-file
  fixture/privacy coverage, and installs failure cleanup alongside the existing
  before/after shell snapshot hooks. The native integration is a managed
  `~/.codex/config.toml` hook; current PostToolUse payloads carry the patch DSL in
  `tool_input.command`. Single- and multi-file calls have reached the local broker
  through the installed bundle. Three-file rows were inspected in ClickHouse and a
  fresh native event was replayed from its exact transcript without increasing the
  backend count; only a deliberate legacy-shell collision run remains operational.
- Phase 3: Claude Code PostToolUse migration uses the common boundary; whole-file
  Write and notebook/edit line metadata remain in-memory. Shell failures release
  pending snapshots and the plugin fixture checks content privacy.
- Phase 4: Kilo Code TypeScript server plugin, provider/model normalization, local
  plugin installer, VS Code detection/setup, metadata tests, shell snapshot lifecycle,
  and session created/updated/idle/error/deleted handling are present. The installer
  now exposes one top-level auto-discovered entrypoint and keeps helper modules in a
  managed subdirectory. Adapter-level event IDs also reject free-form/path-bearing
  values before delivery. Status remains `scaffold` pending a real Kilo CLI/VS Code run.
- Phase 5: Kimi Code Beta hook scripts, managed TOML installer/uninstaller, direct
  file-tool producer, shell snapshot/abort flow, SessionStart/SessionEnd plus
  Stop/StopFailure lifecycle cleanup, VS Code setup, and privacy tests are present.
  Status remains `scaffold` pending a real Kimi run.
- Phase 6: provider aliases and first-party endpoint hosts are normalized in one
  core module. DeepSeek is metadata under the host client (Codex/Kilo/Claude),
  never a replacement `client_id`; arbitrary compatible gateways and model names
  remain unknown. The registry includes a bounded `deep-code` manifest marked
  `unverified` with an explicit unsupported limitation.
- Phase 7: heartbeat ingestion now uses the shared versioned `caf1` fingerprint
  helper. Hook, transcript and other transports therefore converge on one
  privacy-safe identity; reads also query the previous `v1` scheme so upgrading
  cannot replay old rows. Existing explicit event-id and batch dedup layers remain
  in place, and the server/core fingerprint bridge has transport-independent tests.
- Phase 8: `wakaclock ai setup`, `ai uninstall`, `ai status --json` and the
  adapter-aware `doctor ai` report are wired to the same registry. A local
  `WAKACLOCK_DISABLED_AI_ADAPTERS` kill switch disables one client without
  stopping the broker or core heartbeat. Doctor pushes a bounded diagnostics
  snapshot when an API key is available, with a three-second fail-open timeout;
  the backend rejects unsafe metadata and ignores stale snapshots. The frontend
  AI integrations panel separates detection, verification, capture, delivery and
  disabled/unsupported states without exposing paths or source content.
- Phase 9: five metadata-only artifacts live under
  `certifications/ai-adapters/` (Codex/Claude verified from recorded live
  evidence; Kilo/Kimi scaffold; standalone Deep Code unverified). The Python
  verifier rejects unknown/forbidden fields, invalid counters, expired reports and
  false live claims, and runs as a CI gate. Rollout/kill-switch/rollback steps are
  documented in `docs/ai-adapter-rollout.md`.
- Standalone setup: `wakaclock ai setup <agent|--all>` now shares the adapter
  registry with `adapter list`, copies the tested bundle into a versioned managed
  directory, installs only AtoAxis-owned hook blocks, and returns per-adapter
  remediation when a CLI or service manager is unavailable. The VS Code setup
  wizard remains available for interactive consent and marketplace authentication.
- Portability/privacy hardening: shell event IDs use `shasum`, `sha256sum`, or
  POSIX `cksum` without exposing paths; the shared emitter accepts only scalar,
  bounded metadata and rejects JSON-looking nested values before invoking the CLI.
  The shared boundary and Rust broker now also rewrite legacy path-bearing event IDs
  to deterministic opaque IDs before delivery; Codex and Gemini transcript IDs use
  the same path-free UUIDv5 scheme. The installed managed bundle was refreshed after
  this change.
- Transport compatibility hardening: `filesystem_observer` is classified with the
  existing filesystem evidence bucket, `ide_telemetry` with the editor bucket, and
  `shell_hook` with `tool_snapshot`; `process_observer` stays at the weakest `Other`
  rank because process presence alone is never file-edit evidence.
- Final Codex smoke run through the refreshed bundle (`codex-cli 0.151.0-alpha.7.1`,
  session `01a05e55-85d6-74a3-9fd9-bf7766e7957e`, 2026-09-01T18:57:45Z) created
  one file and produced exactly one accepted metadata-only sidecar event; no source
  or tool-output field was present. The run also confirms the managed hook remains
  active after the portability/privacy changes.
- A second post-refresh Codex probe (2026-09-01T18:58:54Z) again produced exactly
  one `agent=codex`, `source=agent_hook`, `transport=native_plugin` event with one
  added line, confirming the installed bundle—not only the source tree—remains live.
- The user-scoped Claude marketplace install was upgraded from `atoaxis-heartbeat`
  1.0.1 to 1.0.2. A local smoke payload through the installed cache path reached the
  running broker and appended exactly one metadata-only sidecar event; the payload's
  content was not present. This verifies packaging/install wiring, but it is not a
  substitute for a real Claude API/tool run (which remains OAuth-blocked below).
- After separating Codex `tool_event_id` from each per-file `event_id`, a fresh real
  `codex-cli 0.151.0-alpha.7.1` run at 2026-09-01T19:18:51Z through the refreshed
  stable bundle created the requested file and produced exactly one matching sidecar
  event. The overall sidecar delta included one unrelated lifecycle/heartbeat row,
  but the target-file count was one and the command exited successfully.
- A follow-up real single-call three-file probe then produced three `apply_patch`
  broker rows with one shared native `tool_event_id` and three distinct file events;
  all three target files existed and the command exited successfully. This closes the
  prior multi-file tool-identity gap at the local-broker layer.
- The same live probes were found in the local ClickHouse backend under the API-key
  account: the three Codex rows are `actor_type=ai_verified`, `ai_source=agent_hook`,
  `user_agent=wakaclock-cli/ai-sync`, share the same `ai_change_id`, and each has one
  added line. The installed Claude smoke row also persisted as `ai_verified`; the
  query selected metadata columns only and did not read source/prompt fields.
- A fresh Codex edit was then replayed from its real transcript with
  `wakaclock ai sync --agent codex --transcript ... --from-start`. Backend inspection
  before/after replay stayed at one row, one event ID and one change ID, with
  `actor_type=ai_verified`/`source=agent_hook`; this is live native+transcript dedup,
  not a fixture. The broker remained free of retry/dead-letter rows.
- A real Codex shell-mutation attempt was also started in an isolated temporary
  workspace, but Codex stopped before executing the edit because the active workspace
  policy requires `apply_patch` for local file changes. The target file and broker
  state therefore remained unchanged; this is explicitly not promoted as shell live
  evidence, and the planned successful `sed` matrix case still needs an environment
  where that policy permits a controlled shell edit.
- The isolated ClickHouse keystroke-stats integration test now passes against the
  local 24.10 container. It exposed and fixed a ClickHouse alias-resolution bug in
  the project/daily filters (`copy_actions` could resolve to the aggregate alias and
  raise `ILLEGAL_AGGREGATION`); all raw heartbeat columns in these queries are now
  qualified with the `hb` table alias. The test covers nullable metrics, `NULL`/empty
  project grouping, actor filtering, totals, daily rows and clipboard coverage.

The Codex parser preserves `rename`/`previous_entity` for `*** Move to:` patches,
and failure cleanup tests cover both Codex and Claude shell hooks. Kilo plugin tests
cover successful tool/file-event deduplication, failed-tool suppression, shell snapshot
lifecycle, and bounded session lifecycle metadata; the Kimi installer test covers
idempotent managed blocks and preservation of user hooks. Legacy hook fallbacks now
convert the allowlisted producer object into the strict broker envelope, so an older
  bundle without `common/emit-event.sh` does not silently lose events.

The shared `common/tool-event-id.sh` helper now owns the deterministic identity used
by shell `BeforeTool`/`AfterTool` and abort hooks. This prevents a failed call from
leaving a snapshot behind when a hook exposes a raw call ID but the before/after path
uses a hashed identity. Cursor and Claude sweep fallbacks also pass through the same
allowlist boundary, and Kimi unknown tools/missing fields report bounded diagnostics
instead of guessing or forwarding arbitrary payload data.

## Verification run

The post-audit runtime changes were rechecked on 2026-09-02: formatting, full
workspace clippy (`-D warnings`), the full workspace test suite with process
permissions, all seven ignored backend integration tests against isolated local
containers, VS Code compile/lint/tests/resource generation, frontend validation,
Kilo/Kimi and shell privacy tests, and `git diff --check` all pass. The new broker
auto-scan process test and the OS-lock singleton test both pass independently.

The following pass locally:

```text
cargo test -p wakaclock-core ai::producer::tests
cargo test -p wakaclock-core ai::adapter::tests
cargo test -p wakaclock-core broker::tests
cargo test --workspace -- --test-threads=1       # passes with process-test permission
cargo clippy --workspace --all-targets -- -D warnings
cargo clippy -p wakaclock-cli --all-targets -- -D warnings
npm run compile && npm test                 (extensions/vscode)
npm run validate                             (frontend/app)
npm test + npm run test:installer            (extensions/ai-agents/kilo-code; 11 unit tests)
find extensions/ai-agents -name '*.sh' -exec bash -n {} +
git diff --check
common/tests/emit-event.test.sh
codex/tests/heartbeat-hook.test.sh
plugins/atoaxis-heartbeat/tests/heartbeat.test.sh
kimi-code/tests/hooks.test.sh
```

After the workspace recovery, the same gates were rerun from the restored source.
The final local pass includes Rust format, workspace clippy (`-D warnings`), the
full workspace test suite with process permissions, VS Code compile plus 94 tests
and resource generation, frontend `npm run validate` (228 tests), Kilo's 11 tests,
all shell syntax/privacy tests, the certification/duration/actor audit scripts,
and `git diff --check`. The seven ignored database tests remain covered by the
isolated ClickHouse/PostgreSQL run recorded above; those services are not running
in this shell session, so no production database was touched. `wakaclock status
--json` also reports `ai_producer_v1` and `clipboard_metrics_v1`; its write path
was checked with runtime permission because the default sandbox presents the
user's SQLite queue as read-only.

The local acceptance gates pass for formatting, workspace clippy, the full
non-ignored workspace tests, VS Code compile/lint/tests plus resource bundling,
frontend validation, shell/Node privacy tests, and repository/audit scripts. All
seven ignored backend integration tests also pass single-threaded against the
isolated local ClickHouse 24.10/PostgreSQL containers when explicit
`CLICKHOUSE_TEST_URL` and `POSTGRES_TEST_URL` values are provided (including the
nullable keystroke-stats query and its project/daily coverage assertions). No
production database was used.
The remaining operational item is the live matrix: refresh Claude after
re-authentication and run actual Kilo and Kimi versions with a running broker/backend,
inspect broker/backend rows, then promote only adapters with recorded version/
timestamp evidence from `scaffold` to `verified`. Codex already has single- and
multi-file broker/backend evidence plus native/transcript replay dedup; only the
legacy-shell collision run remains open for that adapter.

## Phase 0 baseline ledger

The ledger below is intentionally explicit about what is evidence and what still
needs an external run. It records metadata-only checks, never prompt text, patch
bodies, command arguments or source content.

| Scenario | Current evidence | Status |
|---|---|---|
| Claude Code `Write` | Existing live transcript/broker verification in `ai/VERIFICATION.md`; migration/privacy fixture passes; 2026-09-02 isolated run could not authenticate | evidence retained; fresh post-migration run blocked by expired OAuth |
| Claude Code `Edit` | Existing live transcript run plus direct hook fixture | evidence retained; fresh post-migration run blocked by expired OAuth |
| Codex single-file `apply_patch` | 156 real transcript files parsed in dry-run; real `codex-cli 0.151.0-alpha.7.1` PostToolUse event reached local broker; refreshed-bundle smoke run produced one event; target row inspected in ClickHouse | native delivery and backend row verified |
| Codex multi-file `apply_patch` | One real `codex-cli 0.151.0-alpha.7.1` call created three isolated files, produced exactly three sidecar events with one shared tool ID, and rows were inspected in ClickHouse | native delivery/backend row verified; legacy-shell collision pending |
| VS Code human typing | Existing extension tests and attribution engine tests | automated only; no new external baseline claim |
| Human terminal `sed` | Before/after snapshot tests and broker process tests | automated only; no new external baseline claim |

No row is promoted to `verified` from a fixture. The missing live rows are an
operational prerequisite for Phase 0 exit, not a reason to fabricate a certification
artifact.

## Direction note (2026-09-04, out-of-plan)

See [`../decision-accuracy-over-coverage.md`](../decision-accuracy-over-coverage.md):
the user chose accuracy-over-coverage after comparing this project's
inferred/unknown tier against how WakaTime itself does AI attribution
(native-per-tool plugins only, no heuristic fallback). This does not change any
row above — Kilo Code / Kimi Code CLI / DeepSeek remain scaffold/unsupported —
but it does reprioritize *future* work: promoting gemini-cli and kilo-code to
`verified` (both have real, matching npm packages — see that file) is now
preferred over deepening the filesystem/process/correlation heuristic stack.

