# Phase 8 implementation ledger

Updated 2026-09-03. This file records what is wired in the current worktree; a
local pass is not promoted to live-agent certification without a real tool and
backend row.

| Item | Status | Evidence / remaining caveat |
|---|---|---|
| p8.1 intake | implemented | `wakaclock-core::ai::intake` maps broker, filesystem, session and editor evidence; malformed paths are dropped with bounded diagnostics. |
| p8.2 correlation pass | implemented | broker poll joins pending inbox, process/session and filesystem evidence with the existing clipped correlation windows; observer input is bounded to 256 file events per tick. |
| p8.3 shadow gate | implemented | `observer.toml` is loaded from `~/.wakaclock`; observe-only persists bounded JSONL shadow records and leaves production actor/duration output unchanged. |
| p8.4 canonical emit | implemented | infer mode ranks transports and suppresses weaker canonical duplicates; observer-off/observe-only deliberately keep the legacy emit path. |
| p8.5 pipeline/diagnostics | implemented | pipeline stages are persisted to `~/.wakaclock/ai-pipeline.json`, exposed by broker status/doctor, and doctor pushes the sanitized diagnostics snapshot when a key exists. |
| p8.6 shadow report | implemented | `wakaclock ai shadow-report --json` reports inference precision and native recall separately; it stays `not_ready` until independently labelled records exist. |
| p8.7 auto-registration | implemented | detected process CWDs are resolved to bounded Git roots and leased with a 180-second TTL; `$HOME`, `/`, `/tmp` and non-Git paths are rejected by the registry. |
| p8.8 consented auto-setup | implemented | broker retries setup every ten minutes only for consented agents; per-agent opt-out and metadata-only audit log are persistent. |
| p8.9 extension onboarding | implemented | existing one-time prompt now honours `wakaclock.autoInstallAgentHooks`; consent is shared with the broker through `agent-hook-consent.json`. |
| p8.10 terminal installer | implemented | root `install.sh`, Homebrew formula and terminal install documentation register the per-user broker idempotently; release-host/live package availability still needs deployment. |

## Decisions closed during implementation

- **p8.D1:** the shadow log uses a bounded, private JSONL file at
  `~/.wakaclock/ai-shadow-log.jsonl`. Appends are rotated with an atomic rewrite,
  malformed tail records are ignored, and the default retention is 10,000 rows.
- **p8.D2:** consent is per agent in
  `~/.wakaclock/agent-hook-consent.json`; the extension prompt and CLI `--yes`
  are the only first-write paths. Opt-out is sticky until the user changes the
  local record, and writes append metadata-only audit rows.
- **p8.D3:** canonical suppression is enabled only in explicit `infer` mode;
  observer-off and `observe_only` retain the legacy emission path byte-for-byte.
- **p8.D4:** shadow records are retained locally and contain only attribution
  grades, opaque lineage/fingerprint values, paths and timestamps. No synthetic
  labels are generated; the precision gate therefore remains closed until an
  independently labelled corpus is captured.

## Gates run locally

- `cargo fmt --manifest-path backend/api/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path backend/api/Cargo.toml --workspace --all-targets -- -D warnings`
- `cargo test --manifest-path backend/api/Cargo.toml --workspace -- --test-threads=1` —
  28 `wakaclock-ast`, 54 CLI unit, 6 broker-process, 319 core, 8 LS and 170
  server tests passed; 7 database-backed tests remain intentionally ignored.
- Broker correlation tests: 13/13; filesystem observer tests: 22/22 (including
  process/FSEvents cases on the host-permission run).
- VS Code `npm run compile`, `npm run lint`, `npm test` — 96 tests passed;
  generated `out/` was rebuilt from TypeScript.
- Frontend `npm run validate` — 43 files / 228 tests passed.
- Audit gates passed: `verify_port.py`, `golden.py` (`total_error: 0.0`),
  `verify_actor_migration.py`, `verify_certification.py`,
  `verify_ai_certification.py certifications/ai-adapters` and the compatibility
  manifest check.
- Installer checks passed: `sh -n install.sh`, shell syntax checks for agent
  hooks and `ruby -c packaging/homebrew/wakaclock.rb`.

Implementation gates are green. Live acceptance is still intentionally separate:
the real Claude/Kilo/Kimi/Deep Code executables, production API/ClickHouse and a
labelled independent corpus are not available in this workspace. Consequently
`wakaclock ai shadow-report --json` correctly remains `not_ready`; observer mode
must stay `observe_only` until the precision gate has real labels. No fixture or
synthetic record is treated as live proof.

## Direction note (2026-09-04, out-of-plan)

See [`decision-accuracy-over-coverage.md`](decision-accuracy-over-coverage.md):
the user has decided, independently of this ledger, to prioritize accuracy over
coverage (WakaTime's native-hook-only model). This changes what "done" means
for this file's `observe_only` requirement above: it is no longer a temporary
gate pending a precision number — staying off `AttributionMode::Infer` in
production is now deliberate policy. Nothing in this ledger's implementation
status changes; this note only says a future session should not treat "the
precision gate got real labels" as automatic license to promote to `infer`
without first revisiting that decision file.

