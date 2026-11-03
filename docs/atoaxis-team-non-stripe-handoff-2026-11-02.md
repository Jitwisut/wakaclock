# Team — non-Stripe development handoff, 2 November 2026

## Delivery boundary

Current Goal status: **paused at the owner's explicit request** to close this
round for now. The dedicated [test handoff](atoaxis-team-test-handoff-2026-11-02.md)
lists the unexecuted T1–T6 checks. Pausing does not complete Stripe or certify
the implementation. No tests or commit/push were started by this request.

**Source-level status: connected implementation — awaiting behavioral testing.**
This is the consolidated handoff for the non-Stripe scope, not an acceptance or
production certificate. The source inventory and bounded static reviews found no
new confirmed missing implementation in the rows below. They are not a
line-by-line audit of the whole system. A failing deferred test may expose a defect
that must be fixed before acceptance.

Branch: `codex/team-closure-wip`. Delivered base:
`1646cbf6549565b008e9dadebe6ff76ebe221258`. This delivery is **uncommitted**;
the companion `non-stripe-source-snapshot-2026-11-02.json` identifies the scoped
source by SHA-256. It is not a clean candidate/build SHA. Unrelated/private WIP
and the owner's paused Stripe work remain in the checkout.

Snapshot:828 source/build-configuration files, aggregate SHA-256
`c61cc5f8f92420486840f4a56723a6109995221a072b08d9ea2f7e195d26783a`.
It includes shared dependencies and frozen Stripe source for reproducibility;
inclusion is not a claim that the deferred Stripe code is complete. All hashes
in the final readiness compile receipt still match. Two files in the earlier
average receipt (`services/team_insights.rs` and `repository/mod.rs`) changed for
the later readiness increment and are covered by the final all-target check.
The GPT-6 Astra bounded read-only follow-up reported no newly confirmed
non-Stripe runtime code gap; it did not inspect every line or execute tests.

The owner deferred Stripe because no account is available and requested
development before broad verification. No tests, services, migrations, provider
requests, workflow dispatch, rollout, commit/push or deployment were started to
close this handoff. Checkout and production readiness remain closed. The overall
original G1–G6 Goal was **blocked** because its Stripe scope is deferred and
verification awaits the owner's instruction. The same blocker was revalidated
over three consecutive Goal turns; there is no live process being awaited. It is not
silently redefined as non-Stripe only.

## Source inventory against the original scope

Each row means its supporting code is connected, not that every behavior passes.
Evidence from an older commit does not certify this uncommitted snapshot.

| Scope | Connected implementation / source anchors | Remaining acceptance |
|---|---|---|
| G1 candidate tooling | `.github/workflows/internal-client-candidate.yml`; `scripts/ai-coverage/{internal_candidate_preflight,native_candidate_smoke,native_vscode_smoke,verify_candidate_matrix}.py`; installed-VSIX harness | Clean authorized commit, eight actual artifacts, four native runner results, distinct rollback baseline and native VS Code prerequisites |
| G2 GitHub account and repository access | `infrastructure/app/init.rs` constructs the services; protected router calls child handlers; `services/team_github.rs` connects OAuth/install/selection/disconnect/resync, numeric identity and member-project binding; existing vault/token provider handles credentials | Actual App/HTTPS callback and permissions, second-person review/access, cross-account browser and token expiry/races |
| G2 sync and recovery | `services/team_github_sync.rs`, `team_github_redelivery.rs`, `bin/team-github-worker.rs`, `repository/team_github.rs`: durable inbox/jobs/checkpoints, 90-day changed work plus all open work, head-specific CI and observed lifecycle/relations | Expected ledger, pagination changes, missed100 recovery, rate limits/auth/private404, restart and response loss |
| G2 context and owner-confirmed links | `services/team_context.rs`; `team_github.rs::{context,sessions,suggestions,set_session_repository_binding,retry_contexts}`; `team_insights.rs::{propose,decide_revision,replace,history}`; owner UI | Out-of-order context/usage, native/user-confirmed provenance, reused branch/forks, ownership and concurrent replacement; never infer past context from current branch |
| G2 receipts and costs | `services/team_merged_cost.rs`, `team_cost_equations.rs`, `team_insights.rs`; `repository/team_trust.rs::release_cost_publication`; migration064; insights/summary UI and CSV | Independent numeric ledger, corrections, hidden/partial/unknown prices, consent races, equation-history inference and restore |
| G2 Copilot daily/weekly reports | Separate daily ingestion/projection and `services/copilot_reports.rs`; Team API/UI/CSV and durable provider checkpoints; weekly reporting remains Monday–Sunday **UTC**, separate from organization timezone | Provider/version/permission evidence, suggested/accepted/agent definitions, cohort4/5, withdrawal/retry/restore; never allocate daily totals to sessions or PRs |
| G3 client and service tooling | Existing `backend/api/crates` and `extensions` implementation remains unchanged in this increment; candidate tooling uses actual extracted binaries and installed VSIX | Native install/upgrade/rollback/uninstall, persistent Pause, login/sleep/wake, real four-tool/eight-OS-surface ledger; no native pass from cross-compile |
| G3 canary | `scripts/heartbeat-delivery-canary.py`: day-specific observations, immutable decision revisions, monitor-only exclusion and unconfirmed missing evidence | Seven completed actual user workdays, build/account/origin/timezone/cutoff evidence; no monitor/fixture days count |
| G4 organizations/onboarding | `services/organizations.rs`, `team_organization_birth.rs`; birth/confirmation repositories, migrations062/063, creation/recovery UI and transport | Concurrent creation/login/admission, ambiguous response, restored/missing proof, current Owner transfer and browser account switch |
| G4 no-card trial and pilot configuration | `services/team_trial.rs`, `repository/team_trial.rs`; existing approved trial routes and mounted UI; `team_pilot.rs` service/repository/bin; staging feature configuration/preflight | Fourteen-day transition and capacity races, current Owner/source fences, private Prepare/Apply expiry/retry, timezone locking and fresh isolated deployment |
| G4 improvement and reports | `services/team_actions.rs`, `team_comparison.rs`, `team_weekly_summary.rs`; Team handlers/UI/history/export | Before/after coverage and window definitions, action ownership/revisions, weekly JSON/CSV consistency and stale/error/account changes; no causal AI claim |
| G6 consent/privacy | Central Team projection, closed-week policy, contributor support, publication registry and final response/generation checks; source inventory below | Cross-org/team/repository and Owner/Admin cannot bypass consent; withdrawal during export, complementary groups and historical comparisons |
| G6 retention/restore | `repository/team_trust.rs::{cleanup_tick,reconcile_restore}`; `team_store_retention`; privacy worker; independent registry, birth/confirmation evidence and financial admission proof | Twelve-calendar-month boundaries, retry/checkpoint/crash, old backup plus latest revocation/deletion ledger; no personal canonical deletion; Cloud restore stays pending |
| G6 measurement/readiness/support | `services/team_trust.rs`, `team_release.rs`, read-only readiness snapshot; Trust/Owner evidence UI; staging preflight and support/runbooks | Pending/stale/auth/dead-letter/recovered, owner-only diagnostics, no small-group health leak, record metadata versus actual certification |

All backend anchors above are below `backend/api/src/` unless another root is
given. Frontend Team panels are below
`frontend/app/app/dashboard/(auth)/wakaclock/teams/` and use the shared session
transport. The snapshot contains exact filenames/hashes rather than credentials
or source contents.

## Important dispositions retained

- Observed PR average follows the owner's explicit decision: every **received**
  eligible confirmed-linked usage fact for that PR must be priced. The numerator,
  denominator and floored micro-USD average are explicit. Capture completeness
  stays `unconfirmed`; unknown is not zero and post-merge usage is excluded.
  Legacy completeness aliases remain unavailable for old clients. See the
  [observed-average contract](atoaxis-team-observed-pr-average-2026-11-01.md).
- Group capture/delivery diagnostics without safe contributor evidence remain
  withheld. Owners can inspect their own metadata. An empty queue or fresh
  snapshot never certifies complete capture. Missing provider data stays
  unavailable/evidence-pending according to its actual contract.
- Team provider certification covers Codex, Claude Code, Cursor IDE and Copilot
  VS Code as agreed per surface/metric. It does not certify all14 adapters.
  Deep Code/Windsurf owner decisions stay separate.
- GitHub merge is work-state evidence, not deployment or business value. File
  edits/time do not become employee rankings or causal savings.
- Existing accepted IDs, canonical personal usage/heartbeat, duration, timeout,
  overlap rules and additive migrations are preserved. The protected router
  still contains only its five previously approved added lines; protected
  identity synchronization is unchanged in this increment.

## Checks actually available for this source

- Final backend all-target check: `cargo check --all-targets -p wakaclock-server`,
  session34968, exit0, 25.92s. It compiled the new pure/ignored SQL test sources;
  **it did not execute them**.
- Final frontend TypeScript session91742 and scoped ESLint session67521 exited0;
  lint had zero warnings. Earlier average increment: Rust91590, TS47407,
  ESLint48816, all successful for their source at that point.
- Candidate tooling Python AST, JavaScript syntax and workflow YAML/structural
  checks passed. Staging metadata tooling AST/static checks passed. These do not
  execute a native runner, provider or service.
- `git diff --check` and metadata-only snapshot verification are delivery checks.
  No new source was changed after those compile checks except handoff documents.
- No broad tests, strict Clippy run, package build, native smoke, database
  migration, restore drill, provider request or live canary was run in this
  development closure. Older runtime receipts certify only their own source.

Shared `backend/api/target` was retained as an active reusable cache (latest
measured19,833,004KiB), above the reviewed10GiB threshold. No disposable target,
worktree or Docker container was created for this handoff.

## Verification handoff — wait for owner instruction

Do not run every command below against production, the personal database or
installed user services. First approve a clean candidate and isolated runtime.
Fix failures without changing the locked duration baseline or weakening tests.

1. **Pure and UI regression.** In `backend/api`, run the scoped suites listed in
   the [average](atoaxis-team-observed-pr-average-2026-11-01.md),
   [readiness](atoaxis-team-readiness-evidence-2026-11-02.md),
   [organization recovery](atoaxis-team-organization-recovery-2026-10-31.md) and
   [pilot](atoaxis-team-pilot-control-2026-11-01.md) handoffs. In `frontend/app`,
   use `npm test -- --run test/wakaclock-team-insights.test.tsx test/wakaclock-team-summary.test.tsx test/wakaclock-team-readiness.test.tsx test/wakaclock-team-readiness-endpoints.test.ts`;
   then explicitly select organization creation/recovery, trial, Trust, actions
   and the shared transport/session suites without resuming Stripe suites.
   Expected: zero/unknown distinction, session fences,
   old-data closure, correct observed labels and no consent bypass. Run strict
   Clippy separately after these regressions; compilation alone is insufficient.
2. **Isolated PostgreSQL/ClickHouse.** Use disposable databases and private
   independent ledgers. Cost/readiness require `atoaxis_team_test`;
   birth/Owner recovery/pilot require `atoaxis_team_onboarding_test`; the no-card
   trial fixture retains its legacy `atoaxis_stripe_test` name without requiring
   Stripe HTTP. The ignored SQL suites require `POSTGRES_TEST_URL`; inspect each
   guard before execution. Run
   `repository::team_cost_equations_tests` and `repository::team_readiness_tests`
   with `--ignored --test-threads=1`, plus the earlier onboarding/trial/pilot and
   admission inventories. Expect atomic source/SQL evidence, exact original-ID
   retry, concurrent correction/withdrawal denial and no partial publication.
3. **Integrated reports and restore.** Inspect/run the isolated
   `scripts/team-{cost,actions,copilot-admission}-local-check.py` runners and
   `scripts/team-restore-drill.py --github` only after reviewing their exact
   prerequisites and source at the candidate. Use source/restore dependencies
   sequentially to limit containers; shut down task-owned services/Docker after
   completion and preserve volumes/evidence. Expect revoked data unreadable
   before opening Team, stale/missing ledger closed, no personal fact deletion.
4. **Authenticated staging UI.** Follow explicit
   [staging](atoaxis-team-staging-configuration-2026-11-01.md) and pilot preflight;
   never auto-initialize an existing authority. Exercise create/invite/consent,
   GitHub/repository/team selection, sync, mapping, unresolved session,
   confirm/change/withdraw/history, receipt, weekly summary/CSV, Trust and
   disconnect/reconnect. Compare independent expected ledgers, not only HTTP200.
5. **GitHub faults/live.** Actual App credentials belong in the vault. Check
   callback URL whenever tunnel changes. Exercise missed100, webhook≤5min,
   recovery≤10min under the agreed no-rate-limit conditions, lifecycle/head
   changes, permission removal and a real second reviewer when available.
   No second account means that gate remains pending.
6. **Client/native candidate.** Follow the
   [four-target/eight-artifact handoff](atoaxis-client-candidate-native-handoff-2026-11-01.md).
   Commit/build only with permission. Verify actual native lifecycle, services,
   persistent Pause, override/hook preservation and real provider sessions on
   macOS/Windows using the same candidate manifest. Windows and absent provider
   runtime/login remain pending; fixtures are not live session evidence.
7. **Canary/production gates.** Resume metadata-only canary when instructed,
   retaining day revisions and genuine user-activity evidence. Same-input
   tolerance does not apply to different WakaTime streams. Cloud restore,
   p95 performance, privacy review, three teams/14days, signing and general
   release remain their own gates, not failures of this source inventory.

## Deferred development and next decision

Stripe still has genuine unfinished code: provider preview/result projection,
confirmed upgrade/proration/change flow, retained-seat end-of-period downgrade
and broader financial operator/maintenance recovery. Keep these explicit in the
older billing inventory. Do not label them merely waiting for credentials or
testing, and do not resume them without the owner.

The non-Stripe handoff is ready for review. Next, the owner can authorize a
reviewed commit/push on this branch and then choose when to start verification.
Neither authorization is inferred from this document. Goal-wide completion and
production readiness are not claimed.
