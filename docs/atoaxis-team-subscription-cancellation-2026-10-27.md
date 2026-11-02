# End-period cancellation — receiver development, 27 October 2026

Branch `codex/team-closure-wip`, delivered base `1646cbf6`; new source is
uncommitted. This increment is the receiver-first contract/evidence component,
**not a usable cancellation API/UI or a completed subscription-change runtime**.

Follow-up in the same worktree now adds SQL acceptance infrastructure. See
[acceptance development](atoaxis-team-cancellation-acceptance-2026-10-27.md).
The remaining-work list below is the receiver checkpoint: schema/inventory and
typed acceptance/exact-next readback are now present; the sealed provider-read
factory is now implemented in the subsequent [preparation increment](atoaxis-team-cancellation-preparation-2026-10-27.md);
lifecycle/dispatch/projection/worker/API/UI still are not connected.

## Implemented

- `FrozenCancellation` binds the original operation, actor, organization/account/
  mode, Customer/subscription/item, binding/source revisions, existing price/
  currency/amount, exact observed period and original acceptance time. Its
  versioned request hash and idempotency key cannot acquire a new first-send
  window or actor through replay. The only provider body is
  `cancel_at_period_end=true`; no immediate DELETE, refund, arbitrary date or
  package mutation is represented. This metadata is not an Owner/dispatch grant.
- Explicit lifecycle parsing uses only allowlisted metadata from the pinned
  subscription shape. Missing schedule/pending-update/cancellation fields are
  unconfirmed, not safe null defaults. Competing provider changes, an expired
  expected period or changed terms block mutation preflight. Unknown prices or
  missing period evidence do not turn into guessed values.
- Dispositions distinguish not observed scheduled, provider-observed scheduled,
  effective at the expected boundary, and changed/unconfirmed. `canceled_at`
  alone does not prove effective cancellation: Stripe uses it for the schedule
  request time. Elapsed local time alone is also insufficient; an effective
  observation requires provider canceled state and confirmed `ended_at`/boundary.
  None of these dispositions adds/closes paid coverage or grants analytics.
- Additive `CancelAtPeriodEnd` request and `Subscription` identity plus
  `CancellationObservation` event/maps in the existing independent financial
  journal. No new transport, queue or provider request is introduced. The guard
  fsyncs the observation and linked normalized result in a single frame; exact
  retry preserves IDs/first observation time. Conflicts remain alongside the
  original and freeze authority.
- Result identity binds the **observation occurrence**: original operation,
  actor/revision/lease, an explicit per-HTTP-exchange ID, response-versus-read kind
  and normalized metadata. A new exchange must await reconciliation even if the provider state is the
  same; only exact retry of the original occurrence deduplicates. This deliberately
  conservative rule handles A → B → A after both earlier observations were
  projected. Hashing only resource identity or normalized state would incorrectly
  reuse an old applied result. No arrival-time proximity is used as identity.
  Actual Customer/subscription identity stays consistent across these separate
  evidence Outcomes; no duplicate provider resource is created. Repeated reads in
  one lease use distinct exchange IDs; replay keeps the original. The future
  dispatcher must persist the exchange ID before each request.
- The outer enrollment guard explicitly permits evidence-only retention after
  an unknown, quarantined or deleted organization. The existing closure freeze
  still blocks reads/dispatch. Unmatched/wrong Customer or subscription results
  are retained and frozen; they never initialize a missing source head.
- Historical ownership discovery includes subscription identities from these
  retained Outcomes. Empty maps are omitted/defaulted to preserve old source
  serialization/proof tokens before new events exist.

## Development checks and review

Rust all-target checks compile this component and its regression code; final
source hashes/check result are recorded in the private cancellation-development
receipt. **No behavioral tests were run**, following development-first steering.

Added regressions cover frozen identity/body/key, request-time versus actual end,
missing lifecycle/schedules/changed terms, metadata exclusion, real private-journal
restart/exact retry, independent freshness, unmatched/conflicting evidence, and
old-entry serialization, and A → B → A plus same-state/new-exchange occurrences after
source-only projections. Unknown/quarantined roster cases exercise the actual
guard/journal/reopen path; deletion exercises the outer snapshot boundary only,
not a production deletion/restore drill. A source-only simulated old projection
checks that a later state is pending again; it is not SQL projection evidence.

Astra read-only review found the missing outer evidence-only whitelist and then
the state-only ABA gap. Both were fixed and regression code added. Actual fault/fsync/SQL/provider behavior
remains unverified. No broad regression, Docker, real Stripe request, schema
migration, configuration activation, deployment or Git mutation was performed.

## Remaining development before any producer can be enabled

1. Add the canonical subscription-operation/authorization/audit schema, inventory
   and retention classification. Keep this separate from new-purchase Checkout.
2. Implement typed acceptance, FirstAttempt/Stop, recovery authorization and
   projection writers with the existing group coordinator. A reviewed request
   must be durable before ACK and exact committed-SQL recovery must not replay a
   predecessor or recreate a provider mutation.
3. Add sealed current-Owner/binding/source/lease claims and durable dispatch
   before HTTP including persisted per-exchange identity, immutable body/key/first-attempt time, per-request preflight,
   scoped normalized failures and resource-only recovery of unknown outcomes.
4. Project current matching observations only with the accepted revisions,
   preserving later bindings and recording evidence-only late results. Signed
   reconciliation remains the evidence for entitlement changes; scheduling a
   cancellation must not terminate existing paid coverage early.
5. Wire bounded worker, status/confirm/recover API and UI with explicit consent
   to the original effective boundary. Route approval remains separate if a
   protected file is touched. Activation stays disabled until the full path and
   required tests/configuration are ready.
6. Complete upgrade/proration settlement and end-period downgrade with explicit
   retained-seat handling as separate actions; cancellation does not remove them
   from the G5 goal or weaken the existing initial-payment validator.

Deploy compatible journal readers before enabling a new producer. Old entries
retain their representation, but an old reader cannot consume unknown new event
variants; rollback must disable the producer and preserve history, not delete
events or pretend the old binary understands them.

Official evidence: [end-period cancellation](https://docs.stripe.com/billing/subscriptions/cancel),
[pinned subscription object and canceled_at meaning](https://docs.stripe.com/api/subscriptions/object?api-version=2025-04-30.basil).
