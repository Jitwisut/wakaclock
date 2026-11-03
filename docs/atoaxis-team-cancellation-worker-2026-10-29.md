# Cancellation worker and observed status — 29 October 2026

Branch `codex/team-closure-wip`, delivered base `1646cbf6`. This is an
uncommitted development increment. It does not close the full Team goal.

## Connected code

- The existing `billing-reconciliation` process invokes a default-off bounded
  cancellation tick, using the existing financial authority, account lease,
  deployment identity and cooldown. It adds no process or service dependency.
- Each tick first reconciles exact accepted history and at most 100 retained
  result occurrences. Cold cleanup skips the exact still-live operation lease,
  including when its account lease expired first. Provider continuation allows
  at most two subscription exchanges; a monotonic ten-second budget prevents
  starting further HTTP, including ancillary account verification. An HTTP
  response already in flight is still normalized and retained after the budget.
- The normal sequence is actual resource read, confirmed projection, then the
  original immutable cancellation body/key. `provider_scheduled` remains eligible
  for read-only follow-up. A scheduling hint is never a provider permission;
  every boundary repeats the current captured authority and causal proof.
- Cleanup has an opaque original ticket and checks revision, operation lease and
  account lease. It updates only operational retry/error/lease fields, preserves
  Retry-After, never resolves a pending positive Outcome and never resets the
  original possible-send timestamp or read-only state. Unconfirmed source history
  fails closed; accepted evidence remains available for later reconciliation.
- A cold initial resource read can return to pending only with unchanged owner,
  original revision, no preceding observation, no first possible mutation and
  no retained or pending mutation exchange/dispatch/result/failure anywhere for
  that operation. It does not set a last observation and therefore cannot itself
  authorize a POST. Missing optional flags preserve the old historical projection
  behavior and serialization; old audit hashes are not reinterpreted.
- Saved status now exposes operational state, retry/error, read-only state,
  configuration observation and the original provider observation timestamp.
  Provider disposition requires the normalized actual receipt, applied Outcome,
  exact SQL audit, committed Current projection and exchange authorization.
  Accepted rows, empty queues and local elapsed time do not prove cancellation.
  More than five minutes without a fresh provider observation is stale. Unknown
  error text is replaced by a closed code. The existing final Owner/source/row
  recapture still precedes response delivery. Configuration is not worker liveness;
  `dispatch_available=false` remains a non-grant to the caller.

No new router registration, flag activation, provider request, migration execution,
Docker/service startup, heartbeat change, entitlement change or Git mutation was
performed by this increment. The protected router still contains only the three
previously authorized trial/portal additions. Cancellation API/UI remain code work.

## Compile-only evidence and deferred execution

The exact-source private receipt is stored under
`output/team-closure-2026-10-13/cancellation-worker-development-2026-10-29.json`.
Only Cargo all-target compile, Python AST and diff checks are authorized now.
No behavioral tests or local HTTP/SQL fixture was run for this increment.

New regression code covers the initial-read restart boundary and old serialization,
retained possible-send fencing despite missing SQL first-attempt, closed status
reasons, and an ignored isolated native worker flow. The native fixture asserts
read → original-key POST → scheduled read, exact provider/status evidence, sticky
first-attempt/read-only and stale account/operation ticket rejection. It uses a
synthetic local HTTP server and is not live Stripe evidence.

After the owner requests testing:

1. Run pure cancellation projection/status regressions with
   `cargo test -p wakaclock-server --lib cancellation_` in `backend/api`.
   They must preserve old-mode serialization, reject inadmissible resume, and
   distinguish stale/disabled/recovery state without promoting evidence.
2. On the isolated PostgreSQL runtime, run
   `python3 scripts/team-stripe-local-check.py` from the repository root.
   It creates only its synthetic `atoaxis_stripe_test` database and local provider
   fixtures, stops them on exit, and retains metadata/logs. The new worker filter
   is `financial_cancellation_worker_original_send_scheduled_read_and_ticket_fences`.
3. Extend and execute fault coverage for response loss, live-operation/expired-
   account races, cold prepared mutation, mixed retained outcomes, DB failures,
   Owner/config/source changes, 401/403/404/429/5xx, Retry-After and late response.
   The new native happy-flow/ticket fixture alone does not prove those cases.
4. Provider staging verification, actual period-end effective readback and
   integration/UI acceptance remain independent evidence requirements.

## Remaining development

- Cancellation status/acceptance/recovery API handlers and UI, followed by the
  separately approved minimal protected router registration.
- Upgrade/proration and retained-seat downgrade flows; broader operator recovery,
  financial retention and independently fresh restore evidence.
- Fresh organization onboarding/enrollment and remaining candidate/package
  tooling listed in the development-first inventory.

These are real development gaps. They are not renamed as deferred tests.
