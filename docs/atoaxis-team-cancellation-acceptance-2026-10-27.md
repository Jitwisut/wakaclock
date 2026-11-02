# Cancellation SQL acceptance — development, 27 October 2026

Branch `codex/team-closure-wip`, base `1646cbf6`; uncommitted. This is the
next increment after the receiver, not a complete cancellation runtime.

Follow-up: the [sealed preparation factory](atoaxis-team-cancellation-preparation-2026-10-27.md)
now provides the production construction path through an actual scoped GET in
code. The no-factory statements below describe this acceptance checkpoint; the
remaining runtime/status/recovery/worker/UI work is still open. The native SQL
fixture deliberately continues using a test-only Synthetic seal and cannot
certify the provider-read path.

## Implemented code

- Additive migration057 registers operation, immutable initial authorization and
  administration-audit tables. The operation UUID is global; an account/mode/
  subscription has at most one unresolved cancellation, including owner-changed,
  recovery-required and provider-scheduled states. No age-based removal releases
  an ambiguous operation. Migration code is registered but has not been applied.
- The canonical financial inventory classifies every semantic/operational field
  in these tables, validates typed FrozenCancellation/ReadEvidence and their scope/
  hashes, and includes historical Customer/subscription ownership. Unknown JSON
  contracts fail with closed errors. Financial retention/deletion coordination
  still needs implementation; no cleanup policy is silently applied.
- `CancellationRepository::accept` uses account → billing → current Owner →
  semantic rows, current rollout and validated commercial/source authority.
  It requires exact captured account/enrollment tokens, canonical enabled binding,
  snapshot/item/period/terms, matching requested/applied source revision and a
  snapshot fresher than five minutes. DB clock after lock waits enforces the
  prepared read deadline (at most sixty seconds) and original effective boundary.
  Snapshot comparison alone does not prove provider lifecycle/schedule fields.
- The method consumes opaque `PreparedCancellation`, which is not deserializable
  and has **no production factory**. Only the private native test module can mint
  it in this increment. Ordinary FrozenCancellation/ReadEvidence constructors
  and a JSON request therefore cannot activate this SQL entrypoint. A future
  factory must seal an actual scoped provider GET and its predecessor/deadline.
- Operation, authorization, audit and source checkpoint are staged in one SQL
  transaction. Typed `Writer::CancellationRequest` allows exactly one scoped
  accepted request and no enrollment mutation. The existing group coordinator
  fsyncs Prepare, commits SQL, then confirms before acknowledging acceptance.
- Same operation/business selection returns the original frozen request/time/
  body/key; another server-assigned observation time cannot replace it. Changed
  scope, actor, revisions, terms or boundary conflicts. Existing unknown purchase
  and cancellation reservations block another operation; no member/seat removal,
  subscription mutation, paid coverage or analytics grant occurs.
- Historical exact-next readback validates the original operation, authorization,
  audit, source checkpoint and entire typed SQL next state. Missing SQL/audit/
  authorization is not reconstructed. Confirmation does not borrow a current
  Owner permission; a fresh product read/action must authorize separately. Row
  verification runs after account/billing locks. No HTTP or predecessor replay
  is performed during readback.
- Frozen acceptance time must have PostgreSQL microsecond precision **before**
  hashes are formed; nanosecond inputs are rejected. ReadEvidence is JSON and
  keeps its observation precision. No post-acceptance truncation rewrites IDs,
  request hashes or historical timestamps.

## Checks and evidence

`cargo check --all-targets -p wakaclock-server` passed, including newly written
test code. Formatting, diff checks and native-runner Python syntax are checked.
The first native-fixture compile exposed a missing Arc wrapper; it was corrected.
These are compile/static checks only, following development-first steering.

Written but **not executed**: typed inventory/hash/safe-error and precision/retry
regressions; one isolated PostgreSQL native fixture covering migration repetition,
canonical acceptance, stable retry, Viewer rejection, reservations, changed proof,
competing provider metadata, no entitlement change, lost Confirm, Owner revocation,
missing operation/audit/authorization without reinsertion, and concurrent intents.
Its preparation/provider observations and baseline approval are synthetic and
cannot be used as real provider, restore, privacy or durability certification.

The future financial native runner includes the new ignored fixture and source
hashes. No runner, PostgreSQL/Docker process, migration, real Stripe request,
provider configuration, deployment, feature activation or Git mutation ran here.

## Still required before any cancellation flow is usable

1. Sealed provider-read preparation factory, server-owned scope and user-confirmed
   binding/source revision/effective boundary. Do not replace this with a JSON
   deserializer, plain constructor or inference from old snapshot fields.
2. Typed lifecycle/FirstAttempt/Stop, recovery authorization and projection, with
   per-exchange IDs committed before actual requests, immutable first possible
   send/body/key and bounded original idempotency window. Unknown results switch
   to readback; they do not automatically create another operation or POST.
3. Scoped provider-failure retention, current-Owner/source/lease preflights,
   response-loss/restart recovery and bounded worker. Late evidence is retained
   without reviving a newer binding or granting a revoked Owner permission.
4. Status/confirm/recover API/UI and feature flags. Preserve scheduled versus
   effective semantics and signed reconciliation for entitlement. New protected
   route edits require their own approval; none was added in this increment.
5. Financial retention/tombstone/restore integration and the deferred behavioral,
   fault and real-provider checks. Production activation remains closed.
6. Upgrade/proration and end-period downgrade with owner-selected retained seats
   remain separate development. This acceptance component does not replace them.

Compatible receivers/migrations must be deployed before producers. Rollback
disables activation and keeps operations, audit, source evidence and additive
migration; it must not delete reservations or fabricate a new baseline.
