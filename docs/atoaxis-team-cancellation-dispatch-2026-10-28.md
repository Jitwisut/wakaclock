# Cancellation claim/provider boundary — development increment, 28 October 2026

Source `codex/team-closure-wip`, delivered HEAD `1646cbf6`, **uncommitted** current
work. Milestone remains **กำลังพัฒนา**, with **พัฒนาครบ — รอทดสอบ** as the
agreed development endpoint. No cancellation route/worker, live feature activation,
real provider request, database service or migration was started in this increment.

## Code connected

- `CancellationRepository::claim_next` uses a bounded candidate lookup and an
  opaque nonserializable reservation. Its initial eligibility filter excludes
  revoked/inactive Owners, deleted organizations and disabled rollouts; this
  locator is not authorization. It repeats account → billing → current Owner →
  row, exact original request/revision/auth, complete SQL/source and account lease
  checks before committing an operational lease. Pending source groups settle by
  exact historical readback; unknown/missing history is not initialized. A bad
  or stale authority does not grant HTTP or discard the operation.
- Each actual subscription request needs an opaque exchange proof minted only
  after typed BeginExchange Confirm, exact SQL exchange/audit and fresh locked
  capture. Mutation records original possible-dispatch provenance before the
  final capture. That provenance is not permission; the final and repeated
  preflight still checks Owner, captured identity, rollout, original request/auth,
  both leases, both SQL cooldowns, durable account Retry-After and exact source/
  enrollment pins. No SQL transaction spans HTTP.
- POST additionally needs the **current** last projected ResourceRead, exact
  observation/exchange/auth/original request, an applied Outcome with no pending
  or conflicting evidence, unchanged canonical binding/source/item/terms, a
  NotObservedScheduled disposition and a deadline at most60seconds after that
  real read. Recovery/read-only/revision>1 cannot POST. Readback cannot renew
  original first possible send +23hours or accepted period end. Preparing an
  exchange does not by itself prove a request ran.
- `StripeClient::execute_cancellation_exchange` uses the existing fixed-origin,
  no-redirect, bounded/version-pinned client. Ancillary account verification is
  not a subscription Outcome and does not set a first mutation time. It repeats
  authority after that network wait before preparing the subscription exchange.
  GET reads the frozen subscription ID; POST has only the original immutable
  body/key. No immediate delete, arbitrary date, refund or price mutation is added.
  Positive normalized evidence is fsynced before return, including wrong-resource
  or late results after a role/lease/source change. Wrong identity is retained/
  frozen and returns unconfirmed; it is not promoted to a binding or success.
- The returned nonserializable result contains only evidence references and a
  private proof correlation digest. It grants no current projection, cancellation,
  entitlement or payment. Owner revocation can still race after final preflight
  and before provider receipt; this boundary cannot retract an in-flight request.
  Late result retention and a separate current projection are therefore mandatory.
- Cancellation-specific negative receipts store a closed phase/code, captured
  request/actor/revision/lease/exchange, optional actual HTTP status and Retry-After.
  They are fsynced before returning the provider error. No raw response, URL,
  credential, prompt, source or description is stored. Account-check failures are
  ancillary metadata, never Subscription Outcomes or POST permission.
- Both outer and inner evidence fences permit these receipts during pending
  groups/closure while keeping dispatch/commit grants blocked. Exact retry keeps
  first receipt time; conflicts retain variants and freeze. Empty additive maps
  preserve old entry serialization. Global operation/exchange reservation includes
  their history. The existing account directive aggregator now derives a transport
  cooldown from both Checkout and cancellation receipts; it never rewrites the
  original receipt as a different operation kind. Scope/mode isolation and a
  stronger pending directive survive a new success or restart before SQL callback.
- Worker/DB clock disagreement no longer drops otherwise valid normalized
  cancellation evidence. The original observation time is retained unchanged and
  the source freezes with ObservationTimeUnconfirmed. It is not clamped, used for
  a current projected precondition or presented as effective cancellation.

Provider contract references checked during development:
[version-pinned update](https://docs.stripe.com/api/subscriptions/update?api-version=2025-04-30.basil),
[version-pinned retrieve](https://docs.stripe.com/api/subscriptions/retrieve?api-version=2025-04-30.basil),
and [period-end cancellation](https://docs.stripe.com/billing/subscriptions/cancel).
The parameter-expansion documentation URL was unavailable, so the guide was
consulted as the explicit period-end request reference. These are documentation
checks, not authenticated/test-mode provider execution or certification.

## Development checks and deferred verification

`cargo check --all-targets -p wakaclock-server` compiles the new source and
regression code. The first compile found a missing event-pattern scope binding;
it was corrected. The final compile-only receipt records actual result and source
hashes at `output/team-closure-2026-10-13/cancellation-dispatch-development-2026-10-28.json`.
Static diff/runner syntax checks are separate. **No behavioral tests ran**.

Astra earlier reviewed the architectural constraints: exact exchange binding,
proof mint after Confirm, fresh current projected read before POST and CAS of
observation/source during projection. The requested review of this final code
failed with a usage limit; it is pending and not a pass. Preserve this limitation
in the verification handoff.

| Check | How / prerequisites | Expected behavior |
|---|---|---|
| Negative receipt journal | From `backend/api`: `cargo test -p wakaclock-server --lib cancellation_failures_keep_retry_after_across_restart_and_clock_anomalies_keep_evidence_frozen` | Real private test journal/reopen preserves exact retry/Retry-After; account/live isolation; failures create no Subscription Outcomes; contradictory clock keeps original evidence and blocks readiness; marked private fixture fields absent |
| Claims/sealed preflight | From repo root: `python3 scripts/team-stripe-local-check.py --target-dir backend/api/target` | Existing isolated Homebrew PostgreSQL16 runner/fixture DB/serial tests. Added native metadata fixture claims one lease, denies POST without a projected read, confirms a readonly exchange, rejects another claim/preflight after role revocation, still retains a synthetic late response linked to exact exchange. It proves no real HTTP/provider behavior |
| Provider boundary | Add/run actual HTTP-stub + isolated SQL cases after projection/worker implementation | Exact method/origin/header/body/key, account mismatch, strict/missing fields, real observed status vs local deferral, no redirects, payload cap; Owner/source/config/lease change at each wait; response lost after provider acceptance, durable error before callback and stronger cooldown after success; no HTTP from an unconfirmed SQL-only exchange or stale/read-only proof |
| Mutation/projected read | Add/run typed projection/CAS cases with the next increment | Only exact last ResourceRead and exchange can authorize POST; applied history alone/late older read cannot overwrite a newer observation; no exclusions of own unresolved outcomes; expired60second read/original23hour window never renewed |

## Remaining development

The typed result selector/projection, operation success/failure scheduling and
bounded worker are still missing. In particular, no current code here projects
the read required for POST; the guard does not report success to mask that gap.
Session-only API/UI and actionable status then need wiring. Financial retention/
restore freshness and original upgrade/proration/retained-seat downgrade/tooling
work remain in the main ledger. No code gap is reclassified as an external test.

The protected router still has only the separately approved Trial2 + Portal1
lines, no new route or authorization inferred. No `user.rs`, heartbeat/duration,
queue ID, custom compiler profile, worktree or target change is included. The
reviewed active shared target is retained; no disposable cache was created.
