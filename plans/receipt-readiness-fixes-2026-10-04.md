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
| Frontend typecheck/strict lint | passed | `frontend-typecheck.log`, `frontend-lint.log` |
| Production Webpack build/prerender | passed | `production-build.log`, `prerender.log`: 40 routes; intermediate build |
| Frontend full coverage | failed | 877 tests passed; statements 99.49%, branches 97.63%, functions 100%, lines 99.84%; 38 files / 88 branches / 6 lines remain. Thresholds unchanged. |
| Frontend production audit | passed | 0 high/critical, 1 moderate; full dependency tree still has 73 high development findings, 0 critical |
| Extension audit | passed | 0 findings |
| Adapter historical integrity | passed | All five adapters remain `not_certified`; dates unchanged |
| Current duration certification | blocked | Existing evidence older than 30 days; requires a fresh live comparison |
| K0 live integration | passed | `k0-final-attempt.log`: 11/11 scenarios. Earlier failures and interrupted attempts retained; no timeout increase. |
| K5 live integration | passed | `k5-matrix.log`: 6 scenarios, 2 initial facts, replay inserted 0, 1 DLQ record, 1 reconcile job, prompt count 3 |
| Codex final-build native campaign | blocked | Isolated auth previously passed; current source/build binding is stale |
| Claude final-build native campaign | blocked | Isolated auth not authenticated; normal login required |

## Observation gates — final manifest

All nine gates remain `not_run` against the final manifest: capture/identity, retry/revision, time, owner/scope, deletion, production browser, flag rollback, receipt limits, release checks. The intermediate passing database tests do not promote these gates automatically.

Remaining sequence:

1. Preserve the passing K0/K5 reports and rerun them if their source or runtime changes.
2. Close frontend coverage without reducing thresholds or adding exclusions; rerun strict checks/build.
3. Refresh duration evidence and current adapter evidence through their actual validation workflows; keep historical evidence unchanged.
4. Commit source, create a managed validation worktree, build one manifest, restart/bind all lab processes and VSIX collector.
5. Run the nine gates, both native campaigns, and both daily rehearsals on that manifest.
6. Run `check-ready`; start observation only if every required result is complete and valid.

## Local commits

- `6380451` — CI, bounded collector/database/K0 harnesses, historical certification inventory.
- `08fa155` — Next/Tiptap/VSCE dependency updates and packaging runtime.
- `2b2429f` — session hydration and heartbeat fixes, behavior coverage and proven redundant-code cleanup.
- `9890ec1` — safe lab failure diagnostics and tests.

No commit has been pushed. A clean checkpoint is not a release approval: coverage, fresh certification, final-manifest gates and native campaigns remain outstanding.
