# Work Session validation status — 2026-09-29

Status: experimental; not ready to start the seven-day observation gate or invite pilot users.

## Implemented

- Isolated Compose project with persistent PostgreSQL/ClickHouse volumes and loopback ports.
- Separate campaign/daily accounts, native agent profiles, collector HOME/queue and fixture workspaces.
- Production frontend lab build/CSP, source/binary/frontend manifest tooling and runtime inventory.
- Codex receipt campaign mode and Claude native campaign driver, both explicit `--execute`,
  one native call per scenario, timeouts, bounded in-memory output and no automatic model retry.
- Shared exact-session readback: delivered local usage → ClickHouse usage/canonical winners →
  receipt summary and every evidence page, including replay comparison.
- Independent fixture expectations captured before analytics; reports contain metadata only.
- Daily ground-truth/readback commands and readiness gate requiring both complete campaigns,
  reviewed P5 checks, seven elapsed days and ten unique reviewed daily sessions per agent.
- Real API production browser test and an independent-process feature-flag rollback check.

## Results established in this work session

| Check | Result | Scope / limitation |
|---|---|---|
| Rust release server + collector | Passed initial build | Existing CLI warnings retained; final manifest run is recorded under local evidence |
| Frontend production Webpack | Passed initial build | Turbopack worker port failed in this environment; Webpack used |
| Frontend typecheck | Passed after adding typed lab account fixture | No threshold changes |
| Targeted types lint | Passed | 14 existing sort errors fixed; other explicitly configured files are ignored by lint |
| Validation tooling Python tests | 13 passed | Includes redacted native quota/auth failure classification; not native runtime evidence |
| Existing AI coverage Python tests | 38 passed | Legacy campaign behavior retained |
| Actual PostgreSQL/ClickHouse receipt integration | 1 passed | Identity separation, replay, revisions/downgrade, intervals, scope and PG outcome cascade |
| Production frontend + actual API browser | 1 passed | Synthetic usage-only, null/zero, replay, owner mismatch, outcome withdrawal and export |
| Feature-flag rollback | Passed | Separate API process; ingest=200, receipt/outcome=503 while disabled; read=200 after restart |
| Whole frontend lint | Failed: 13 errors, 9 warnings | Outside this receipt change; duration timeline, tooltip, timeline sessions, presence media script |
| Whole frontend coverage command | Failed: 403 tests passed, 3 failed | Existing answer-guide expectations differ from current Thai marketing content; coverage gate not passed |

The lint/coverage failure files were unchanged by this receipt work. A concurrent presence
task is editing other files in the same checkout; do not revert those changes. A successful
compilation alone does not satisfy `release_checks` while lint/coverage remain failing.

Logs: `/tmp/atoaxis-phase2-{rust-build,frontend-webpack,lint,coverage,campaign-tests,db-test}.log`.
Private reproducible artifacts live under `.local/receipt-validation/evidence/`; browser
artifacts are under `.local/receipt-validation/browser-results/` and are not shareable bundles.

## Open work and ownership

1. Codex isolated login succeeded. The first controlled single-file native call returned
   `usage_limit_exceeded` before creating its fixture. No automatic model retry was made.
   Collector sync of that exact failed-session transcript exited successfully and delivered
   zero usage records, as expected when no measured usage was reported. This is controlled
   failure evidence, not a successful native receipt or a daily session.
   Claude's login command returned success, but a subsequent `auth status` in the same
   isolated environment returned `loggedIn=false`. This remains an authentication blocker.
   No account credentials were copied from primary profiles. An attempted diagnostic using
   normal HOME while retaining the isolated config was rejected by automatic approval review;
   user authorization is pending before attempting that diagnostic.
2. A manifest build completed with unchanged source during compilation. Lab API/UI were
   restarted from that build, and production-browser and flag-rollback checks passed again.
   Source changed subsequently (including concurrent presence work); evidence describes the
   manifest's binaries, not the current checkout. Refresh build binding before the observation
   gate. Both successful exact-session native readbacks and full scenarios remain pending.
3. Finish P5 coverage beyond current integration: native attribution combinations,
   offline/out-of-order capture, repair rollback, full asynchronous account deletion,
   session bounds/performance and runtime sleep/wake/resume cases. The existing database
   test's direct PG cascade does not establish the full account-deletion pipeline.
4. Resolve or explicitly review pre-existing global release failures without weakening checks.
5. Configure and verify VS Code/extension capture against the same runtime tuple. Transcript
   campaigns alone cannot establish editor/human activity coverage or agent execution time.
6. Only after the required checks pass, start the observation window. Daily work and manual
   ground-truth review still require actual usage for seven days / ten sessions per agent.

No real daily sessions, elapsed observation days, live native campaign passes or pilot
readiness are claimed by the synthetic integration results above. Neither agent is promoted.

Runbook: [work-session-validation-lab.md](../docs/work-session-validation-lab.md).
