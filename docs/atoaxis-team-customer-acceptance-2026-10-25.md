# Customer acceptance coordinator — 25 October 2026

Continues `19f703c0` on `codex/team-closure-wip`. This closes the **customer
request acceptance** part of G5 locally. Customer dispatch, provider outcome
retention/application, Checkout/binding integration and independent restore
freshness remain incomplete. No real Stripe account, baseline seed, payment,
trial, public Checkout or production activation is performed.

## Implemented

- `services/team_stripe_customer_request.rs` defines one customer-create HTTP
  body/key contract used by both acceptance digests and the actual HTTP builder.
  The existing POST path, operation metadata and idempotency key are preserved.
  Its digest binds organization, account/mode, original actor, authorization
  revision one, operation, method/path, exact form and key digest. No mutable
  organization name, credential or arbitrary provider payload is journaled.
- `Writer::CustomerRequest` accepts exactly one matching immutable request in
  one source transaction, without enrollment or ingress changes. The explicit
  organization constructor checks roster/enrollment and the existing canonical
  root even before a customer/provider association exists. It never seeds a root.
- `CustomerRepository::request` takes account → billing → current Owner locks,
  verifies canonical predecessor evidence, inserts with a fresh acceptance time,
  stages the next SQL source checkpoint and fsyncs the complete independent intent
  before SQL commit. Confirmation follows known commit. A retry of an existing
  operation checks its original SQL actor/time against the retained request;
  concurrent requests by different current Owners cannot replace that actor or
  create a second operation/acceptance. Status is returned only after the final
  proof succeeds.
- Exact SQL-next readback can confirm a lost final response after restart. This
  historical step has no current Owner grant and never recreates a missing SQL
  row. Current response authorization remains separate: a revoked original Owner
  is denied even if immutable acceptance history was successfully confirmed.
  Deferred commit failure keeps the complete pending intent for reconciliation.
- The parent Stripe repository passes the same captured financial authority and
  configuration-error state into its customer child. Guarded request/read and
  legacy mutation paths capture the source token **before** selecting mode and
  recheck it before every successful SQL commit, including early returns.
- Source-backed `claim`, `complete`, `unresolved`, `authorize_recovery` and `fail`
  fail explicitly with `financial_customer_dispatch_integration_required` before
  mutation. This is a temporary development boundary, **not a completed customer
  provisioning flow**. It prevents the unfinished path from returning a provider
  claim or silently modifying canonical source data through the old implementation.

## Local verification

| Check | Final result |
|---|---|
| Server library | 525 passed; 62 opt-in tests ignored by this command |
| Isolated PostgreSQL financial/identity runner | All 20 commands passed |
| Isolated Copilot/privacy/report/restore runner | All 5 commands passed |
| Strict workspace/all-target Clippy | Passed without suppressions |
| Targeted formatting, diff check and built operator CLI smoke | Passed |
| Protected `user.rs` | Outside approved identity method byte-identical to HEAD |

New coverage includes the shared HTTP/key identity, typed request rejection,
concurrent two-Owner acceptance, preserved original actor, no dispatch while its
implementation is missing, tampered SQL, lost confirmation followed by Owner
revocation, deferred SQL commit failure and no predecessor replay. Seven actual
repository paths inject independent outcome evidence immediately after a false
mode selection; each rolls its SQL back while retaining the outcome and creates
no source baseline or transaction group. Configuration failure stays closed.

Earlier failed observations are retained. The restricted sandbox denied localhost
HTTP fixtures and PostgreSQL initialization; reruns with local fixture permission
passed. One earlier financial run failed an unchanged 400 ms fresh-lease check
while compilation overlapped. A serial rerun passed that same assertion; its
threshold and fixture were not weakened. Clippy found a manual range expression
in a new test; it was corrected without a suppression. Astra provided a read-only
design review; its final implementation review failed due to usage quota and is
not counted as a completed review.

Exact source/log/binary hashes and final runner receipts are in the private
`output/team-closure-2026-10-13/customer-acceptance-local.json`. This is tested
uncommitted source, not a clean candidate or release artifact. Native PostgreSQL
instances were stopped and removed. No Docker, separate target or worktree was
created. Shared Rust target storage was reviewed at about 17.7 GiB and retained
for the active task (`debug=1`, `incremental=false`); no active cache was deleted.

## Remaining work, in order

1. **Customer dispatch and outcome integration:** typed first-attempt/stop and
   reauthorization transactions, immutable possible-dispatch evidence, the fresh
   original 23-hour safety window, provider-boundary scope/lease/Owner/root proof,
   and durable late/orphan response retention before SQL projection. Dispatch
   must not be enabled merely because request acceptance now passes.
2. **Outcome resolution:** prove all before/after historical associations and
   exact retained outcome IDs, including newly associated inbox/jobs. Never mask
   unknown SQL changes with a generic outcome-exclusion switch. Keep later
   outcomes pending and preserve conflicts.
3. **Checkout/binding and read/admission/restore:** complete the same source
   protocol across their actual writers; reviewed real baseline and independently
   fresh ledger/storage remain gates. Matching an old restored SQL/journal pair
   does not prove freshness.
4. **Original G1–G6:** latest-main integration after preserving protected work,
   clean candidate/eight artifacts/native/provider evidence; real GitHub/Copilot
   staging and second tester; seven actual user workdays; Cloud/prices/Stripe
   live configuration/restore/security/performance and three 14-day pilots.

No heartbeat, API-key, duration/timeout or schema changes were made in this slice.
The earlier Owner approval covers identity edits only, not a new protected
commit/push. No commit, push, main update or production release was performed.
Rollback preserves source journals, accepted IDs, receipts, queues and additive
migrations; it must not delete pending evidence to make a service appear healthy.
