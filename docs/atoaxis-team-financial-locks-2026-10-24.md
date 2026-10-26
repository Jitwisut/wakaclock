# Financial writer lock order — 24 October 2026

Continues [ingress recovery](atoaxis-team-financial-recovery-2026-10-24.md) after
`19f703c0` on `codex/team-closure-wip`. This prerequisite closes known lock-order
and stale-clock gaps before organization financial-source writer integration.
It is **not financial-source recovery/restore certification**. No real Stripe
calls, baseline application, trial, Checkout or production activation are made.

## Changed behavior

`repository/team_financial_locks.rs` defines account → organization billing
serialization. Owner/scope checks precede operation/quote/Checkout/job row locks.
The helper proves no payment, enrollment, consent or financial-source root.

- Customer request/recovery/claim/complete/unresolved/fail use account and billing
  locks. Claim discovers without row locks, locks owner/scope, then revalidates
  the exact candidate. It checks the original idempotency window with a fresh
  clock after waits and creates the existing 180-second lease from that clock.
- Quote owner/customer proof takes account and billing before membership/user/org
  or customer/binding locks. Existing price/quote expiration/scope rules remain.
- Checkout request/read/recovery/claim/completion/failure use the same order.
  Claim revalidates operation/org/account/live/effective actor after discovery.
  Owner/customer proof locks precede the authoritative intent lock. The original
  lease deadline is checked again after writes and rolled back if expired.
- Customer completion likewise rejects expiry during owner waits, retaining no
  partially committed verified customer. Unresolved/failure updates become scoped
  transactions rather than standalone updates; a wrong account/live/org/revision
  cannot change a different operation merely by reusing its UUID and lease.
- Subscription reconciliation discovers a binding's organization without locking
  the job, takes billing, then revalidates the job/binding scope. Failure updates
  take the same locks. Retry intervals and Retry-After semantics remain unchanged;
  comparisons/lease starts after lock waits use `clock_timestamp()`, not the
  transaction's original `now()`.

These are transactional financial clocks, not activity duration/timeout changes.
Configured ingress/financial authority and existing entitlement fences remain in
force. Provider observations that cannot be applied after lease/owner changes
still require the unfinished independent outcome/source integration; this work
must not be described as retaining every external financial outcome.

## Owner-approved identity correction

Review also found a pre-existing cycle: `sync_postgres_identity` upserted user/org
rows before waiting on personal-org billing; billing held that advisory lock and
then requested owner user/org rows. The owner explicitly approved on 24 October
only `services/user.rs::sync_postgres_identity`, the new repository helper,
regression and module registration. The protected file's diff is limited to that
function delegating to `repository/user_identity_sync.rs`; no file-wide format,
heartbeat read, API-key path, counting baseline or schema was changed.

The helper resolves the personal-org ID without row locks, serializes the immutable
user ID, then takes the org billing lock before any user/credential/org write.
This prevents first-sync contenders with different candidate org locks from
racing on the same users PK/username indexes; usernames never determine identity. Concurrent first-sync may discover absence
and choose different candidate UUIDs. A conflicting org is inserted with
`ON CONFLICT DO NOTHING`; its actual ID/owner are read without a row lock. A
losing candidate rolls back all writes and retries, up to three transactions,
using the actual ID before writing. It never takes a second organization's
billing lock while holding user/org rows. Only a matching candidate may refresh
that org's `updated_at` and apply the existing seat/membership behavior.
Unexpected personal ownership fails closed and never grants an Owner seat.
The eight-way first-sync test exposed a real username-index race before the
per-user serialization was added. The earlier fixture-only FK ordering failure
and its logs are retained separately; no failure is counted as a passing run.

Using `DO UPDATE` for the conflict would still be unsafe: the loser could hold
the user row while waiting on an actual org held `FOR SHARE` by financial code,
which itself waits on that user. The explicit losing-candidate regression forces
that exact graph. Concurrent first-sync alone does not cover it.

## Local evidence

The private `output/team-closure-2026-10-13/financial-locks-local.json` identifies
exact source hashes, binary/commands, run directories and final checks. It is
local evidence, not a release artifact. Native tests use isolated PostgreSQL,
synthetic accounts and metadata, not production credentials or personal data.

New native cases cover:

- Customer owner wait without holding the operation row; crossing the unchanged
  23-hour safety window during the wait must stop create/retry authorization.
- Fresh customer and Checkout leases after billing waits; completion that expires
  during owner contention cannot become verified or retain a session binding.
- Wrong-scope unresolved/failure updates do not clear the correct record's lease.
- Subscription billing wait without holding the job row.
- Eight simultaneous first-sync calls observing no org, exact single membership
  and credential, normal login versus a held financial Owner transaction,
  losing-candidate versus actual-org SHARE lock, full rollback on membership
  failure, and rejection of a different personal owner.

Final local run:

| Check | Result |
|---|---|
| Server library | 503 passed; 56 opt-in tests ignored by this command |
| Isolated native PostgreSQL financial/identity suite | 14 commands passed |
| Native Copilot/report/restore/operator | 5 commands passed |
| Strict workspace/all-target Clippy | Passed |
| Protected-file diff | Only the approved identity function changed |

Customer/Checkout expiry also occurs inside an instrumented SQL write, and the
resulting semantic changes must roll back. This proves the final deadline check,
separately from rejecting an already-expired lease before the write.

Astra's read-only review confirmed the original inversions and the losing-org
conflict path. The latter was corrected with DO NOTHING/plain SELECT and a
specific regression. Follow-up found no additional high-confidence defect;
review is separate from executed test evidence.

## Not finished / next steps

1. Organization financial-source Prepare → SQL commit → Confirm across all
   semantic writers; accepted request/possible dispatch/provider outcome evidence
   must survive missing operations, lost responses, stale leases and restoration.
2. Source and account proof at final read/admission/restore boundaries; approved
   historical baseline, financial retention and independently versioned storage.
   Local matching journal/SQL cannot detect a matching old valid restored pair.
3. G1–G6 retain their original gates: latest-main integration, clean candidate and
   four-target artifacts/native/provider tests; real GitHub/Copilot staging and
   second tester; 7 actual user workdays; Cloud/prices/Stripe live/pilots.

The worktree remains on the task branch. New protected identity source is not
covered by the prior already-completed commit/push request; its delivery status
is recorded explicitly. No main push/merge is authorized. Rollback retains
queues, receipts, accepted events and additive migrations; this slice adds no
migration. No Docker was opened. Runners stop and remove only their private
fixture instances; the existing shared Rust target is reused and reviewed.
