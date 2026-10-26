# Customer dispatch and outcome retention — 25 October 2026

Continues the [acceptance coordinator](atoaxis-team-customer-acceptance-2026-10-25.md)
on `codex/team-closure-wip`, based on `19f703c0`. This supersedes that receipt's
temporary source-dispatch block. **Customer SQL outcome projection and recovery
authorization are still incomplete; this is not a completed provisioning flow
or production/customer certification.**

Later increment: [customer outcome resolution](atoaxis-team-customer-resolution-2026-10-25.md)
implements the deferred SQL projection described below. Recovery authorization
and Checkout remain open; this receipt records the earlier tested state.

## Implemented and locally verified

- Typed `CustomerLifecycle` transactions cover the first possible attempt and
  safe stops for Owner revocation or the original 23-hour idempotency window.
  Lifecycle intents must reference an independently committed accepted request.
  First-attempt writes require a final lease deadline; stop writes grant no
  provider authorization. Source root/checkpoint/SQL changes use the existing
  complete Prepare → SQL commit → Confirm coordinator.
- A source-backed claim is returned only after the immutable possible-dispatch
  receipt is fsynced. Retries keep its original operation, HTTP body/key and
  first-attempt time. Lost first-attempt confirmation is recovered only from
  exact SQL-next history. If SQL committed but Dispatch was not recorded, the
  original confirmed typed history is required before reconstructing that same
  Dispatch; SQL alone cannot reset the clock or authorize a new create.
- Opaque claim proof binds captured authority, scope, operation, actor, revision,
  lease and the original request. Immediately before customer HTTP, the client
  verifies matching authority, current Owner and exact SQL lease/row identity,
  canonical source/checkpoint and the independent Dispatch/token, then checks
  the fresh lease/23-hour deadline. PostgreSQL locks finish before HTTP starts.
  A stale, tampered or wrong-authority claim cannot reach the provider.
- The HTTP client retains normalized customer evidence before returning a result
  to its worker. Owner revocation, lease expiry or missing current SQL authority
  cannot erase an already observed result. Stable IDs exclude receipt time;
  retries under the same file lock reuse the first timestamp. Short file-lock
  contention is retried in memory for at most two seconds, without SQL/network
  locks. Storage failure returns an error and never a false durable ACK.
- `RejectedOutcome` retains an invalid provider result and its absorbing
  `RequestIdentityConflict` in **one** durable frame. Valid conflicting customer
  identities are both retained and freeze the source. Neither valid evidence nor
  a successful HTTP response proves a usable SQL customer, payment or enrollment.
- Source completion currently returns **deferred** after durable retention;
  canonical customer projection is not silently attempted through legacy SQL.
  Source failure/backoff updates use operational-only canonical checks and
  preserve existing Retry-After behavior.

## Baseline and compatibility policy

A configured financial authority does not authorize source-free customer create.
That claim records `financial_customer_baseline_required` and remains pending
without starting a first-attempt timer, acquiring a provider lease or calling
HTTP. This is an explicit reviewed-baseline prerequisite, not a transient network
failure, an automatically seeded baseline or a provider limitation.

Legacy lookup/read remains a rollout path. Normal source-free legacy completion
does not create an unknown source from its own result. Retention checks for a
concurrent source footprint **under the same file lock** and then retains a late
result as migration evidence. Guarded source-free lookup has no independent
outcome receipt when no footprint exists; unconfigured legacy runtime keeps its
previous behavior. These paths are not independent-source certification or
permission to enable commercial production. Historical migration and every
writer's missing-authority/read/admission/restore fences remain part of G5.

Receiver/readers must understand the additive lifecycle and rejected-outcome
events before their producers are enabled. An older reader must fail closed on
an unknown event; rollback preserves the ledger rather than deleting new records.
No real baseline, deployment, existing customer data or provider account was changed.

## Executed local evidence

| Check | Final result |
|---|---|
| Server library | 525 passed; 63 opt-in tests ignored by this command |
| Isolated PostgreSQL financial/identity runner | All 21 commands passed |
| Isolated Copilot/privacy/report/restore runner | All 5 commands passed |
| Strict workspace/all-target Clippy | Passed without suppressions |
| Targeted rustfmt, diff check and built operator CLI smoke | Passed |
| Protected identity scope | Outside approved method byte-identical to HEAD |

The new native fixture runs actual local HTTP: it revokes Owner and expires the
lease while a provider response is in flight, proves SQL locks are released,
checks retention after both changes, then reads the journal after reopening.
Invalid evidence increments the journal by one frame and is already frozen on
restart. Concurrent identical result retries retain one ID/time; conflicting
customer IDs remain separate. SQL `customer_id` is never granted by these tests.
Private response markers do not enter the journal.

Other cases cover lost first-attempt confirmation, original Dispatch reconstruction,
expired/tampered/wrong-authority claims with zero HTTP connections, explicit
synthetic reviewed historical evidence crossing the unchanged 23-hour window,
Owner stop before dispatch and the guarded source-free baseline gate. Existing
acceptance, seven mode-selection races, lock order, identity first-sync,
ingress/quote/worker, privacy and restore regressions also passed.

Earlier failed observations are retained: simultaneous retention initially hit a
nonblocking file lock; the response-preserving bounded wait fixed it. A legacy
race fixture initially reached the new wrong-authority fence instead of its
intended later race; it now uses a same-authority **lookup-only** claim and keeps
the original final-fence assertions. Astra's read-only review found two defects
(legacy self-transition and non-atomic rejection), both corrected; its follow-up
found no additional high-confidence defect. Review did not execute these tests.

Exact source/binary/log hashes and final receipts are in private
`output/team-closure-2026-10-13/customer-dispatch-local.json`. Native instances were
stopped and removed. No Docker, new target or worktree was created. The shared
active Rust target was reviewed at about 17.7 GiB and retained with `debug=1`,
`incremental=false`; no active cache or another task's data was removed.

## Not completed / next work

1. Implement outcome resolution and SQL customer projection using exact retained
   IDs and proof of all before/after associations, including newly associated
   inbox/jobs. Late outcomes stay pending; conflicts/rejections remain closed.
   A fresh live claim may be needed to grant a customer; retained provider identity
   by itself must not grant current Owner/lease authority.
2. Integrate source-backed recovery authorization/lookup, original request/actor
   versus current authorization revisions, and the remaining Checkout/binding
   writers. Complete missing-authority and final read/admission fences across
   writers; source-aware dispatch alone is insufficient.
3. Complete the remaining fault matrix, including dedicated Dispatch persistence
   interruption, provider response loss and cross-writer recovery, plus generic
   predecessor/multiple-head recovery, financial retention and independent restore
   freshness. A matching old SQL/journal pair still does not prove freshness.
4. Obtain approved real baseline/configuration and all original G1–G6 evidence:
   latest-main integration and clean candidate/eight artifacts; real GitHub/Copilot
   staging and second tester; Windows/provider/native sessions and seven actual
   workdays; Cloud, approved prices, live Stripe and three 14-day pilots.

No heartbeat, API-key, duration/timeout or schema changes were made. The goal
remains active, public Checkout/trial/production remain disabled, and no commit,
push, main update, signing or release was performed in this increment.
