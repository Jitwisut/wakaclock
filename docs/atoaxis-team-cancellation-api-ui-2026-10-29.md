# Cancellation API/UI development — 29 October 2026

Branch `codex/team-closure-wip`, delivered base `1646cbf6`; uncommitted increment.
The full Team development goal is still active.

## Connected source and approved route scope

The service, repository, handlers, client transport and mounted Owner UI now
implement subscription cancellation selection → explicit boundary confirmation →
immutable acceptance → saved status → explicit read-only recovery. The existing
worker handles actual provider requests. New handlers require session identity,
Team availability and the same current Owner/source/scope proofs as the services.
Responses are private/no-store and errors never echo private provider messages.

The owner explicitly approved only the following two protected router additions
on 29 October 2026, and they are now connected alongside the three previously
approved trial/portal additions:

```rust
.route("/organizations/:organization_id/billing/cancellation", get(team_stripe::cancellation_view).post(team_stripe::accept_cancellation))
.route("/organizations/:organization_id/billing/cancellation/recover", post(team_stripe::recover_cancellation))
```

The flow is connected in code. The earlier prepare-only compile reported five
unrouted-handler warnings; the post-route check is recorded separately in the
compile receipt, without suppressing them. Approval does not authorize
commit/push, activation, provider calls or a production deployment.

## Evidence and recovery semantics

- A new selection comes from the canonical bound subscription with applied
  reconciliation revision, complete single-item terms, confirmed future boundary
  and provider evidence less than five minutes old. Two locked captures plus the
  shared source/enrollment inventory and final checks precede release. It has no
  provider identity or mutation capability. Acceptance independently recaptures
  the same business revisions and obtains the existing sealed preparation proof.
- The latest-request locator is only a selection. Both explicit and latest
  operation responses still pass current Owner, original request/auth/audit,
  independent source and final response recapture. Existing acceptance can be
  read with the mutation flag off and without calling Stripe.
- The UI freezes request ID and revisions/boundary synchronously before sending.
  A missing/lost response preserves the same original identity and terms. Manual
  Reload resets only transient mutation errors; independent unresolved-original
  state preserves an explicitly confirmed retry after original-operation readback.
  It never silently creates a replacement ID or upgrades a GET failure to proof
  that nothing happened.
- Parent authority loss/loading/failure hides the previous details and controls.
  Child 401/403 propagates to the shared Owner boundary, with per-error reporting
  to avoid polling/render loops. Query keys and component state are scoped by
  account, organization and original operation. Confirmation also binds the
  parent's fresh observation and denial epoch. Read-only recovery uses the saved
  operation/revision and cannot authorize a new cancellation or undo one.
- Current authorization is separate from the original requester. A new Owner can
  explicitly authorize readback even if the old request is still `pending` and
  was never claimed; the UI does not wait for an automatic owner-changed stop.
  After that authorization is current it does not repeatedly offer takeover just
  because the original requester differs. Effective/withdrawn operations do not
  offer a new recovery action. Existing SQL revision/lease/current-Owner checks
  still control whether a read-only authorization can be accepted.
- SQL timestamp comparison normalizes retained provider time to microseconds,
  while the status DTO preserves original evidence precision. A regression with
  `.123456789` prevents a successful projection becoming unreadable solely due to
  PostgreSQL precision. It does not clamp or replace historical event time.

No duration, heartbeat, queue, paid capacity, seat selection, provider schedule,
flag activation or billing pricing has been changed by this increment.

## Checks and test handoff

Server all-target compile and frontend typecheck include the new regression code.
Scoped ESLint covers the new production UI/transport and changed parent panel.
Diff checks and exact source hashes are recorded in the private compile-only
receipt under `output/team-closure-2026-10-13/`.

Behavioral, PostgreSQL, HTTP-stub, browser, provider and migration runs remain
deferred under the owner's development-first instruction. Test source is not a
passing test result. After testing is requested:

1. Run `npm run test:run -- test/wakaclock-team-cancellation.test.tsx` from
   `frontend/app`, plus the existing billing setup/Checkout/trial/portal regressions.
   Expected: no mutation before explicit fresh boundary confirmation, same
   original nonce/terms after response loss and manual reload, authority loss
   immediately hides details, expired selections cannot submit, recovery keeps
   original revision and child auth denial propagates. Add/run actual browser
   account/org switch, delayed response, tab/window and reload lifecycle cases.
2. Run `cargo test -p wakaclock-server --lib cancellation_` in `backend/api`,
   including status timestamp precision and no-inference regressions.
3. Run the isolated PostgreSQL/native runner from the worker handoff. Extended
   saved-view assertions require latest/explicit lookup to refuse viewers and
   return the original accepted identity while mutations are disabled. The
   synthetic worker fixture requires actual confirmed scheduled evidence in the
   view. New-selection races/configuration/freshness still require execution.
4. Run authenticated full API/UI tests for
   default-off behavior, current Owner only, unknown/missing operations, request
   replay/body conflict, flag pause, loss of permissions and final source races.

Rollback disables the existing cancellation flag, preserving all accepted IDs,
source evidence and additive migrations. The UI never promises that local reset
or closing a panel revokes a provider action already started.

Remaining development includes upgrade/proration and retained-seat downgrade, broader financial recovery/retention/
restore freshness, onboarding and package/configuration tooling. This increment
does not declare the full Team development phase complete.
