# Financial admission transactions — 22 October 2026

Continuation of the [read fences](atoaxis-team-financial-read-2026-10-22.md).
Source remains uncommitted on `codex/team-closure-wip` after `b4d68ec7`.
The G1–G6 Goal is active. Trial/paid admission flags and production Checkout are
not enabled by this work; no real provider credentials or organization were changed.

## Implemented

| Path | Change | Local evidence |
|---|---|---|
| Usage admission | Capture exact independent enrollment/state proof under the existing billing/entitlement locks; revalidate after receipt/checkpoint writes, before the final commit decision | Native PostgreSQL usage fixture, plus real ClickHouse worker fixture |
| Usage scan | Claim uses an explicitly advisory `HintProof`; unknown/pending/closed scope is deferred with `financial_guard_unconfirmed`, with no authorizing receipt | Native claim/quarantine and original cursor/replay tests |
| Final deadlines | Fresh DB clock after file verification; retain the original locked scan lease deadline even after transactional checkpoint advancement releases the lease | Existing real lock-wait expiry/lease regressions |
| Cost fact reader | Verify independent agreement before interpreting the SQL no-entitlement fallback; revalidate the captured proof after filtering receipts | Joint cost/receipt/CSV regression |
| Copilot scheduling | Rotate the bounded global page as before, then schedule each organization transactionally with billing → entitlement → rollout/configuration locks and a final independent proof | Native 101-organization rotation and pending/recovery fixture |
| Copilot claims | Claims remain work reservations; failed independent verification releases/defer leases with a safe financial error code, and never authorizes data | Native pending/quarantine fixture |
| Copilot staging/mint | Recheck the authoritative proof under locks; receipt mint accepts `TransactionProof`, not `HintProof` or a caller-supplied entitlement state; revalidate before final clock/lease checks | Native actual fact-replacement lock waits for expiry, lease and pending-head changes |
| Normal quarantine | Internal authorized Owner operation serializes with admission on the same billing advisory lock, records a same-request-ID audit and durably closes the independent scope before SQL commit | Native Owner, audit failure, lock ordering and exact retry checks |

No new transport, personal heartbeat writer, canonical usage writer, duration
formula, timeout, overlap rule or receipt identity is introduced. Daily provider
counters stay whole UTC-day facts and are never allocated to session/PR cost.
The proof alone does not replace consent, repository scope, immutable admission,
five-contributor suppression, privacy generation or 12-calendar-month retention.

## Ordering and limits

`StateProof` is the private common verifier. `HintProof` can be used while holding
only a scan/job row, but cannot be passed to minting. `TransactionProof` requires
the caller's billing/entitlement locks until SQL commit. Claiming must not acquire
billing locks after the scan row: admission already acquires them in the opposite
order. Authoritative `admit_page` rechecks independently after claiming.

File locks remain short and never surround a PostgreSQL await. Normal quarantine
first takes the same organization billing lock, so either the admission commits
before the closure operation, or the next admission observes closure and rejects.
An audit-write failure before the file append rolls back without changing the
independent scope. An SQL commit failure after the file closes leaves the scope
closed and returns reconciliation required; retrying the same request ID can
finish the administrative audit without granting coverage or reopening the scope.

The raw infrastructure `FinancialGuard::quarantine` is explicitly **emergency
file-only** closure. It denies subsequent verified reads, but a transaction that
already passed its final proof check can still persist receipts/checkpoints. Those
rows remain inaccessible under the absorbing quarantine. This is not atomic
distributed revocation, and a future reopening procedure must reconcile such
in-flight evidence explicitly. No reopening operation is supplied here.

The coordinator is internal code, not an exposed HTTP/operator UI. Deployment
readiness, management workflow and independent financial source recovery remain
gated. An explicit namespace/checksum chain cannot detect replacement by a valid
older independent-log prefix; independently versioned operational storage remains
part of the restore gate.

## Verification and cleanup

`output/team-closure-2026-10-13/financial-admission-local.json` records current
source hashes, test commands/logs, native versions, cleanup and remaining work.

- Server: 485 passed, 51 opt-in integration tests ignored in the broad run.
- Native Stripe/trial/usage: nine test commands passed in an isolated PostgreSQL.
- Native Copilot/restore/coordinator: five test commands passed separately.
- Joint PostgreSQL/ClickHouse: independent five-contributor 500/1,000 micro-USD
  ledger, autonomous admission/delayed resweep, receipt, comparison and summary CSV
  regressions passed. This is service/DB evidence, not browser/provider acceptance.
- Strict workspace/all-target Clippy passed. Astra performed read-only lock and
  authority review; that review is separate from executed tests.

The first joint attempt did not reach test setup because Docker engine image
inspection failed; its cleanup then timed out querying Docker. Preserve that run
as failure evidence. The runner now bounds engine/command readiness, isolates
Docker cleanup failures and still removes only stopped private PostgreSQL data.
A distinct run after engine restart passed with one owned ClickHouse container.
Owned fixtures were stopped and their data removed; logs, volumes and unrelated
work were retained. Two mocked CLI fault checks additionally verify engine-timeout and cleanup-timeout
paths preserve the original failure and remove stopped private data. These checks
create no real resources and are not counted as product/native certification.
The existing shared Rust target changed from 18,433,752 KiB to 18,416,848 KiB. It remains above the 10 GiB
review threshold and is retained as the active checkout cache; no new target or
worktree was created.

## Still unfinished

1. Finish the remaining Team reader/activation/readiness audit and require the
   independent guard from deployment configuration even after a pre-enrollment
   DB restore. Unknown scopes must not auto-register as legacy.
2. Finish new-organization roster lifecycle, explicit provider/failed-commit
   reconciliation and the management API/UI around closure/recovery.
3. Recover and fence independent financial sources: account/live bindings,
   accepted quotes, external customer/Checkout outcomes, invoices, subscription
   failures, snapshots and acknowledgement/reconciliation revisions. Entitlement
   agreement alone cannot approve a restored payment source.
4. Financial retention/deletion and independently versioned storage restore drills;
   portal, package changes/prorate/downgrade/grace and final billing/trial UI.
5. Original clean candidate, real staging/GitHub second tester, four-target native
   packages, provider sessions, real canary, Cloud/approved prices and pilot gates.

There is no commit, push, main update, live activation or external certification
from these local results.
