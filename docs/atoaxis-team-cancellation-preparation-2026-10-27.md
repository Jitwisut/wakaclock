# Sealed cancellation preparation — development, 27 October 2026

Branch `codex/team-closure-wip`, delivered base `1646cbf6`; uncommitted.
This closes the earlier no-production-factory gap in code. It does not make
cancellation usable end to end or certify a real Stripe request.

## Connected preparation code

- Strict default-off `ATOAXIS_TEAM_SUBSCRIPTION_CANCELLATION_ENABLED`. Owner
  selection contains only operation UUID, expected binding/source revisions,
  exact billing-period end and explicit confirmation. Actor, account/mode,
  Customer/subscription, price and URI are resolved by the server, not the body.
- The proof captures current enabled rollout, current locked Owner, configured
  Stripe account/mode, pinned commercial authority, canonical enabled binding,
  item/price/currency/amount/status/period, matching requested/applied source
  revision, independent source/enrollment tokens and a live account scope lease.
  Provider identities are validated before URI construction. SQL canonical
  observation must be within five minutes; the proof has a nonrenewable deadline
  at most sixty seconds, also bounded by the lease and selected period end.
- Each HTTP boundary repeats current proof checks. PostgreSQL transactions end
  before `/v1/account` and `/v1/subscriptions/:id` GETs. No cancellation POST or
  DELETE is implemented here. The fixed HTTPS client, pinned API version,
  response-size limit, no-redirect policy and shared account cooldown are reused.
- `CancellationResourceRead` has private fields and no Debug/Serialize/Deserialize
  constructor. Only the provider client can mint it after a successful scoped
  response and post-read proof validation. It carries normalized allowlisted
  lifecycle metadata, a per-read exchange UUID, observation time and exact proof
  hash; never raw response bodies, descriptions, credentials or hosted URLs.
- The repository factory consumes that opaque resource and original proof,
  validates repository/authority identity and resource/proof matching, then
  rechecks Owner/source/lease/canonical predecessor. Frozen acceptance time comes
  from the subsequent DB clock, before any request/body/key hash is formed.
  Backwards/inconsistent clocks or an expired deadline fail unconfirmed; no
  synthetic timestamp is substituted. Schedule/pending-update/lifecycle metadata
  is obtained from the actual provider-client path, not invented from old SQL.
- `BillingService::prepare_team_cancellation` connects flag/Owner/config checks,
  exact historical settlement, account-scope claim, provider read and factory.
  Local permission/config/SQL failures release the scope without poisoning
  provider-wide auth/backoff; provider failures retain existing classification
  and Retry-After handling. Scope completion must succeed before return.
- After lease release, the prepared action rechecks current Owner/config/source/
  predecessor without borrowing the released lease. Acceptance repeats that proof
  and its own locked SQL checks. Production preparations always carry Provider
  seal; the Synthetic alternative exists only under `cfg(test)` for the prior
  SQL fixture. Ordinary/deserialized FrozenCancellation or ReadEvidence is never
  provider authority.

## Deliberate boundaries

This is **readonly preparation**, not durable acceptance. Its pre-acceptance GET
has not promised to retain an operation and cannot change a subscription. The
exchange UUID can therefore be in memory until SQL acceptance. Once an operation
is accepted, the future mutation dispatcher must persist each actual exchange ID
before sending its request and preserve it during response replay.

The factory refuses existing operation IDs and active cancellation reservations;
callers must load saved status/recover the original operation, not prepare a
replacement. The follow-up [saved-status increment](atoaxis-team-cancellation-status-2026-10-27.md)
now connects the internal status/idempotent-acceptance services. Runtime routes,
recovery authorization and worker remain open. An unknown acceptance response
cannot be fixed by a new operation.

No runtime route is registered and no cancellation worker dispatch is enabled.
The internal service returns an opaque prepared action; it cannot be rendered as
an accepted-operation or payment/entitlement response. No capacity, paid coverage,
trial, consent or personal heartbeat state changes in preparation.

## Development checks and remaining verification

`cargo check --all-targets -p wakaclock-server` passed without warnings after
the final code, including the earlier native SQL fixture's Synthetic-seal update.
Formatting, static diff checks and future-runner Python syntax passed. New pure
regression code covers default-off/invalid flags and owner selection rejecting
client provider identity/extra fields. **No behavioral tests were executed.**

Astra read-only review found no high-confidence authority/atomicity defect in
this preparation slice. This is not a provider, race, durability or release pass.
The prior native fixture does not call the production factory and cannot prove
these HTTP/Owner/source guarantees. Actual PostgreSQL + HTTP-stub proof tests
still need to be added/run, then real test-mode evidence must be collected.

Required cases include current Owner/config/account changes during network waits,
scope lease/deadline expiry, mismatched resources, changed canonical terms/source,
stale/missing lifecycle fields, clock skew, provider auth/permission/429/5xx,
Retry-After, process/response loss and release failure. Logs/storage must exclude
marked provider private fields. This work has started no Docker/PostgreSQL process,
real provider request, credential/config creation, migration, deployment, Git
mutation or feature activation; the flag remains unchanged.

Next development after the saved-status increment: typed lifecycle/
dispatch/recovery authorization/projection, bounded worker, and session-only
confirm/status/recover API/UI; then financial retention/restore and separate
upgrade/proration/retained-seat downgrade flows. G1–G6 external gates stay open.
