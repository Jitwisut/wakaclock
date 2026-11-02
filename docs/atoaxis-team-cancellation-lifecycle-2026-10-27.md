# Cancellation lifecycle controls — development increment, 27 October 2026

Branch `codex/team-closure-wip`, delivered HEAD `1646cbf6`, current changes
**uncommitted**. Goal milestone remains **กำลังพัฒนา** until the original scoped
code gaps close, then **พัฒนาครบ — รอทดสอบ**. No mutation worker, cancellation
route or feature activation was added by this increment.

## Connected code

- `Writer::CancellationLifecycle` retains the original frozen request and expected
  revision plus one typed stage: BeginExchange, Stop or RecoveryAuthorization.
  NormalWrite verifies the existing accepted request, complete inventory/root and
  exact SQL next state; it uses the existing Prepare → SQL commit → Confirm flow.
  Historical/operator readback invokes the same decoder after account/billing
  locks. Missing or changed SQL/auth/audit is not reinserted or replayed.
- Migration058 registers immutable prepared exchange rows and paired audit rows.
  Each exchange binds operation, authorization revision/digest, actor, operation
  lease, separate account lease, kind, prepared time, first possible mutation time
  and metadata hash. FK/PK constraints and canonical inventory include both new
  tables. The existing cancellation-audit action CHECK expands to include Stop;
  no data or column is dropped. Both migrations are unapplied in this development
  run. Deploy receivers/migrations before any producer; retain all records on
  rollback. An older reader may not understand the new writer variant.
- Preparing an exchange requires current Owner, enabled rollout/flag, exact
  original request/revision/auth, actual SQL operation/account leases, both
  cooldowns and a fresh DB-clock deadline. A mutation is confined to the original
  actor/revision1, non-read-only state, original first possible send +23 hours and
  accepted period end. Resource reads cannot set/reset the first mutation time.
  The original body/idempotency key never changes. Each actual future HTTP request
  needs a distinct exchange; prior group/observation/preparation exchange IDs stay
  reserved. Exact same-group retries remain idempotent.
- `apply_lifecycle` writes exchanges/audit and any first-time update in one typed
  group before returning. **Prepared does not mean sent**. It returns no sealed
  HTTP capability; a subsequent provider boundary must check Owner/source/leases
  again. Sleep, a role change, expiry or crash after commit does not grant a send.
- Stop preserves the captured first time, read-only status and recovery actor;
  it fences the captured operation lease/revision, appends audit, releases that
  lease and makes an explicit closed diagnostic state. It grants no access.
  Unresolved positive outcomes still block Mode Normal: reconcile them before
  any control change, rather than discarding evidence to make a Stop succeed.
- `BillingService::recover_team_cancellation` accepts only original operation,
  expected revision and explicit confirmation. The repository checks current
  Owner, source and row again under locks, refuses an active operation lease,
  appends a new authorization/audit revision and sets read-only irreversibly for
  that authorization. It preserves all original request fields and first time.
  Exact lost-response retry returns the retained original authorization; it does
  not mint another revision or renew a send window. Role revocation blocks the
  final status response. Future retry_at is retained with GREATEST, not reset by
  recovery. Resource read authority never permits POST.
- Global guard Prepare verifies original accepted request, original or committed
  recovery authorization/digest and new exchange identity. Historical Confirm
  remains a SQL-history action, not a current Owner/lease grant. Provider result
  receipts still use the original captured exchange after a Stop/new revision.

The provider-disposition DTO remains null/unconfirmed and dispatch availability
remains false until the missing client/worker/projection code is connected. No
cancellation, effective boundary, refund, paid coverage or seat/consent change is
claimed from these controls.

## Development checks and test handoff

Compile/typecheck/static checks are the development gate. Regression code was
added but **no behavioral tests were executed**. The first compile found a module
re-export visibility error; it was corrected, not suppressed. A later read-only
Astra review identified a backoff reset; recovery now preserves future retry_at,
and BeginExchange checks both account and operation cooldowns. This review is not
runtime/fault/privacy certification.

Run from the indicated directory only after the owner starts verification:

| Check | Command / prerequisites | Expected behavior |
|---|---|---|
| Pure lifecycle metadata | From `backend/api`: `cargo test -p wakaclock-server --lib services::team_subscription_cancellation::lifecycle::tests` | Distinct exchange IDs/leases affect digest; no sent/dispatch assertion; original 23h boundary, actor/revision and microsecond precision enforced; read-only recovery cannot become mutation |
| Typed source lifecycle | From `backend/api`: `cargo test -p wakaclock-server --lib cancellation_lifecycle_preserves_original_request_and_requires_own_authorization_and_new_exchange` | Same-group replay stable; exchange reuse or missing/foreign Owner authorization rejected; original accepted request preserved. Synthetic model only |
| Isolated SQL lifecycle | From repo root: `python3 scripts/team-stripe-local-check.py --target-dir backend/api/target` | Requires Homebrew PostgreSQL16, unused fixture port56442, isolated synthetic `atoaxis_stripe_test` only. Migration twice; extended native acceptance fixture covers exchange/audit, SQL commit/lost Confirm, no replacement exchange, active lease refusal, Viewer denial, unchanged first time, read-only recovery/retry and retained future backoff. No Stripe API |
| Additional lifecycle races/faults | Add/run actual PostgreSQL + sealed HTTP-stub cases with the next worker increment | Role/account/source changes after exchange commit; expired operation/account lease; exchange response loss/late response; worker restart; DB/fsync failure; Stop with pending positive evidence; exact old-history confirmation does not grant new HTTP; duplicate and changed auth/audit; diagnostics/outbound private markers |

The native runner now resolves `--target-dir` once before using different working
directories, so a relative cache path cannot create a nested second target.
No fixture DB, PostgreSQL/Docker/service, real provider request, feature flag,
commit, push or deployment was started by this increment. No temporary target or
worktree was created. The shared Rust target exceeds the reviewed10GiB threshold
and is retained for the active checkout.

Source hashes and actual check result are recorded in the private compile-only
receipt `output/team-closure-2026-10-13/cancellation-lifecycle-development-2026-10-27.json`.

## Remaining development

Production operation claims and sealed continuation proof; actual provider client
mutation/resource read with durable captured exchange retention; typed result
selection/projection; bounded worker and operational retry; session-only runtime
API/UI. Add these before claiming a complete cancellation flow. No missing code
is reclassified as an external test. Financial retention/restore freshness,
upgrade/proration and retained-seat downgrade remain separate original code gaps.
