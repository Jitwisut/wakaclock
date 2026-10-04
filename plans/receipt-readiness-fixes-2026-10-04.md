# Receipt readiness fixes — local validation checkpoint

Status: in progress. Observation has **not started**. These local checks do not establish hosted CI success or final-build runtime readiness.

## Source and dependency order

- Branch: `codex/receipt-readiness-fixes`.
- Starting commit: `44f0fb44fadf1877656879cd85a673fc663948eb` (`origin/main`, PR #63 merge).
- Baseline: [main CI run 37109778939](https://github.com/Jitwisut/wakaclock/actions/runs/37109778939).
- Keep local commits in this order: CI/collector harness; dependency upgrades; frontend regressions/coverage; validation inventory and reports.
- No push, merge, deployment or pilot invitation is included in this checkpoint.

## CI baseline and current findings

| Job | Baseline failed step | Cause and local work |
| --- | --- | --- |
| Frontend validate/build | Passed | Recheck after Next/Tiptap updates; coverage is now an additional required CI step. |
| Frontend browser smoke | Passed | Must rerun production browser with final lab manifest. |
| Rust default | Formatting | Formatted source, resolved strict Clippy findings and retired unused daemon helpers. |
| Rust Kafka | Formatting | Strict Kafka checks and workspace tests executed locally after fixes. |
| K0/K5 | K0 matrix | Added Linux curl/SASL headers. Local execution also exposed missing account fixtures in K0 and IPv4/IPv6 endpoint inconsistency. |
| Extension | Dependency audit | Updated VSCE to 4; packaging workflows use Node 24. |
| Database | Ignored workspace tests | Separate server database tests from bounded collector process tests; provide ClickHouse and Presence test settings. |
| Duration baseline | Actor migration | Repair uses canonical actor attribution. A later check revealed expired duration certification, still blocked. |
| Phase 3 transports | LSP fake API | Delivery-status requests no longer count as heartbeats. |
| Compatibility/dependencies | Frontend audit | Next 16.3.6 and aligned Tiptap 3.30.5; audit levels unchanged. |
| Adapter certification | Expiry | Preserve original history; verify archive integrity separately from current live certification. |

## Implemented correctness fixes

- Preserve a valid stored session during initial hydration; regression first reproduced an anonymous overwrite.
- Disable bulk heartbeat submission when owner/timezone is missing, including sign-out while the dialog is open.
- Preserve unavailable/zero/partial semantics in additional analytics, tooltip and evidence tests.
- Job retry test now distinguishes an identical payload (deduplicated) from conflicting parameters (rejected without changing the original job/outbox).
- K0 creates real isolated owner records before exercising the production account guard. Its duplicate assertion now reports actual cardinality and disposition counts rather than calling zero rows “multiple rows.”
- Bounded collector tests exercise queue persistence, recovery and dedup across separate processes; no daemon discovery wait.
- Import chunk serialization uses its existing conservative 800 KB admission bound; removed a redundant full-body UTF-8 encoding. Tests include large plugin metadata, escaped Thai text, oversized records and reconstructed payload equality.
- Removed an unreachable pricing-copy fallback shadowed by `DOC_BLOCKS['/pricing#1']`; English/Thai rendered-page and text-export parity remains tested.
- Known local-lab blockers produce allowlisted status codes instead of raw exceptions containing private paths or credentials.
- Goal progress failures now show an unavailable state and retry instead of claiming no activity.
- A pointer gesture commits once even when pointer-up and pointer-cancel arrive together; the regression reproduced two writes before the fix.
- Presence editability is derived from the current account ID, preventing stale roster flags from granting movement controls for another member.
- Reading navigation omits headings with no readable title. Explicit marketing section factories preserve existing English/Thai copy and reject missing authored content during builds.
- Additional tests cover account switches, pending pagination, correction selection, absent timezone, optional marketing content and early-access navigation. Internal unreachable fallbacks were removed only where closed types or construction invariants prove they cannot occur.

## Local validation ledger

Raw logs and test accounts remain under ignored `.local/receipt-validation/readiness-fixes/`. Older command results are intermediate checkpoints, **not** final-manifest evidence. Final compilation, campaigns and gates must be bound again after source freeze.

| Check | Status | Evidence / samples |
| --- | --- | --- |
| Default Rust workspace tests | passed | `rust-tests.log`: 938 passed, 31 ignored |
| Kafka Rust workspace tests | passed | `kafka-tests.log`: 950 passed, 31 ignored |
| Rust formatting and default/Kafka strict Clippy | passed | `rust-format.log`, `rust-clippy.log`, `kafka-clippy.log` |
| Real server database suite | passed | `database-suite.log`: 30 passed; broker restart requires its separate controlled run |
| Collector bounded process tests | passed | `broker-tests.log`: 6 passed |
| External-process attribution harness | passed | `attribution-process.log`: 8 scenarios; not native-model certification |
| LSP process smoke | passed | `lsp-after.log` |
| Adapter inventory tests | passed | `ai-tools-tests.log`: 47 passed |
| Receipt validation tools | passed | `receipt-tools-tests.log`: 38 passed |
| Extension tests/package | passed | `extension-tests.log`: 165 tests; `extension-package.log`: VSIX built; bundled collector not yet final-manifest bound |
| Frontend typecheck/strict lint | passed | `frontend-typecheck-next.log`, `frontend-lint-next.log` |
| Production Webpack build/prerender | passed | `frontend-production-next.log`: Webpack build and 40 public pages passed; intermediate build |
| Frontend full coverage | passed | `frontend-coverage-next.log`: 103 files / 903 tests; statements 4311/4311, branches 3584/3584, functions 1498/1498, lines 3871/3871 (all 100%). Thresholds unchanged; final-manifest rerun required. |
| Frontend production audit | passed | 0 high/critical, 1 moderate; full dependency tree still has 73 high development findings, 0 critical |
| Extension audit | passed | 0 findings |
| Adapter historical integrity | passed | All five adapters remain `not_certified`; dates unchanged |
| Current duration certification | blocked | Existing evidence older than 30 days; requires a fresh live comparison |
| K0 live integration | passed | `k0-final-attempt.log`: 11/11 scenarios. Earlier failures and interrupted attempts retained; no timeout increase. |
| K5 live integration | passed | `k5-matrix.log`: 6 scenarios, 2 initial facts, replay inserted 0, 1 DLQ record, 1 reconcile job, prompt count 3 |
| Codex final-build native campaign | blocked | Normal isolated auth status passed again; current source/build binding is stale |
| Claude final-build native campaign | blocked | Isolated auth not authenticated; normal login required |

## Frozen candidate — final local evidence

- Validation source commit: `9f2b399d3c04c2e50d00d770f323e1bc35674429`.
- Managed worktree: `receipt-ready-validation`, detached at that commit. Use this checkout for lab commands; later documentation commits on the development branch do not change its source.
- Source snapshot: `430454a4bddadebd274a1764e6b72586f5ac348ce93b4edec09e7931773e087f`.
- Manifest SHA-256: `7de0b130aa228640c691002bd6a72615fb65225291e263bdf5f7140c2739761b`.
- Collector SHA-256: `59e438e90b653cb86f213683d0564ba7e1043b4bbc29c08d9774328a564154d9`.
- Artifacts live in ignored `.local/receipt-validation/evidence/`: `build-manifest.json`, `runtime.json`, both editor-profile reports and `release-checks-20261004T105714212361.json`.
- Final local release checks passed: frontend 903 tests, Rust 938, Python 87, extension 165; typecheck, strict lint, compatibility and production Webpack build also passed. Frontend coverage remains 100% in all four dimensions.
- Real database readback passed 4 tests. The limit queries took 493 ms for facts and 390 ms for operations in this run; these are local sample timings, not performance guarantees.
- Production browser passed 2 tests, including both viewport sizes, 26 evidence rows, Trust links, owner isolation, outcome withdrawal and export privacy. This is synthetic integration evidence, not a native-agent or daily session.
- Disposable-account deletion passed through the real API/outbox/workers, PostgreSQL, ClickHouse and local object store, including delayed API replay rejection. Flag/restart checks passed separately.
- Both isolated VS Code profiles have extension 0.2.0 with the final collector digest and loopback destination verified. Live editor capture remains untested.
- Source/build/process binding passed again after all checks. Packaging-generated tracked files were restored before checks; tracked extension output was synchronized in a separate local commit.
- Gate writers now resolve a symlinked lab directory before producing relative references. Two regression tests failed before the fix; the 40-test Receipt tool suite passes afterward.

## Observation gates — final manifest

| Gate | Status | Evidence / remaining work |
| --- | --- | --- |
| Capture/identity | blocked | Codex smoke on `e13c179` failed with `native_usage_limit_exceeded`; Claude preflight reported `isolated_agent_login_required`. Neither is current-build certification. Both complete native campaigns plus live editor/hook and attribution scenarios remain required. |
| Retry/revision | not_run | Final database duplicate/revision checks passed; live offline/retry, restart/resume and native repair rollback remain. |
| Time union | not_run | Final timezone, deterministic union and missing-interval checks passed; actual idle and scheduled physical sleep/wake evidence remain. |
| Owner/scope | passed | Current database and browser child reports, hashes and mandatory scenarios verified. |
| Account deletion | passed | `gates/account_deletion.json`, backed by the real disposable-account worker test. |
| Production browser | passed | `gates/production_browser.json`, backed by 2 executed integration tests. |
| Flag rollback | passed | `gates/flag_rollback.json`, backed by disabled ingest/read/write and restart persistence assertions. |
| Receipt limits | passed | `gates/receipt_limits.json`, backed by 10,000/10,001 facts and operations assertions. |
| Release checks | passed | `gates/release_checks.json`, backed by final release and production-build reports. |

`checks.json` retains the three incomplete gates. `readiness-current.json` reports `ready=false`, `window_started=false`, both campaigns missing for the current build, both daily profiles unauthenticated and both rehearsals incomplete. No model retry was performed after the quota failure. Native browser and native repair checks are also pending; synthetic browser success does not promote them.

## Resume runbook

Use the attached `receipt-ready-validation` worktree (find it with `git worktree list`). Lab secrets and transcripts stay in ignored state; never add that directory to Git. API/UI remain on loopback ports 18080/13000, with the four owned processes bound to the manifest above.

1. Run `python3 scripts/work-sessions/local_lab.py readiness`. A changed source, artifact or old process must be fixed before native calls.
2. Complete normal isolated login with `python3 scripts/work-sessions/local_lab.py login --tool claude-code`. Check only `auth-status`; do not use rejected credential diagnostics. Once the Codex quota is available, perform a new explicitly executed smoke attempt:

```sh
python3 scripts/ai-coverage/run_codex_cli_campaign.py --execute --timeout 180 --scenario-id single-file --receipt-output .local/receipt-validation/evidence/codex-smoke-current.json
python3 scripts/ai-coverage/run_claude_cli_campaign.py --execute --scenario single-file --output .local/receipt-validation/evidence/claude-smoke-current.json
```

Claude calls use the runner's bounded 300-second timeout. Inspect each report before proceeding; there is no automatic model retry. A smoke report is not a complete campaign.

3. After each agent's smoke passes, run its full five-scenario campaign in a new attempt:

```sh
python3 scripts/ai-coverage/run_codex_cli_campaign.py --execute --timeout 180 --receipt-output .local/receipt-validation/evidence/codex-campaign-current.json
python3 scripts/ai-coverage/run_claude_cli_campaign.py --execute --output .local/receipt-validation/evidence/claude-campaign-current.json
node scripts/work-sessions/check_native_browser.cjs codex-campaign-current.json
```

After reviewing the complete current Codex campaign, copy its metadata report to `.local/receipt-validation/evidence/codex-campaign-final.json`, then run `python3 scripts/work-sessions/check_repair.py`; this runner requires that filename and a passed create/delete/rename row. Keep `review_status=pending`, `promotable=false`; Receipt campaigns do not renew adapter certification automatically.

4. Complete runtime scenarios with `runtime_scenarios.py prepare`, `record`, then `verify`. Record ground truth before analytics. Human/editor, formatter, human-after-AI, two-agent, offline/retry, restart/resume, idle and sleep/wake must use actual capture sources. Never substitute transcript import for live hook/editor capture; never trigger sleep automatically.
5. Assemble the three remaining gates with `evidence_contract.py` only from complete current-build run reports, then review and register them with `checks.py`. Existing six passed gates do not cover missing scenarios.
6. Authenticate both daily profiles using `local_lab.py login --identity daily --tool codex` and the equivalent Claude command. Run `editor-status --identity daily` and confirm destination before rehearsal.
7. Rehearse each agent with `observation.py begin --rehearsal --agent AGENT --scenario bugfix --expected-result file_changes`, use a new native session, sync, inspect its Receipt, then `finish --observation ID --receipt ID --reviewed` and `report`. These sessions never count toward daily observation.
8. Run `observation.py check-ready --codex PATH --claude PATH --checks .local/receipt-validation/evidence/checks.json`. Use complete five-scenario campaign paths. Start the window only after this returns ready with all nine gates and both daily rehearsals complete. Any source change requires a new manifest and affected evidence again.

Fresh duration certification and live adapter evidence remain separate release blockers. Preserve expired artifacts unchanged; current catalog entries remain unverified until their actual validation workflows pass. Hosted CI success is still unknown because this branch has not been pushed.

## Local commits

- `6380451` — CI, bounded collector/database/K0 harnesses, historical certification inventory.
- `08fa155` — Next/Tiptap/VSCE dependency updates and packaging runtime.
- `2b2429f` — session hydration and heartbeat fixes, behavior coverage and proven redundant-code cleanup.
- `9890ec1` — safe lab failure diagnostics and tests.

- `36bff69` — full frontend coverage, goal error handling, drag dedup and presence owner regressions.
- `5cf4533` — synchronize tracked extension output.
- `e13c179` — complete pagination fixture usage/actor fields.
- `1b929f9` — production Trust drill-down on both viewport sizes.
- `9f2b399` — symlink-safe relative gate/evidence references and regressions; frozen candidate.

No commit has been pushed. A clean checkpoint is not a release approval: fresh certification, final-manifest checks/gates and native campaigns remain outstanding.
