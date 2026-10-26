# Source-backed customer recovery authorization

Continues the [outcome resolver](atoaxis-team-customer-resolution-2026-10-25.md)
on `codex/team-closure-wip`. This closes the **Owner-confirmed authorization
transaction**, not the subsequent source-backed lookup/observation/projection
flow. Public Checkout, trial activation and production readiness remain disabled.

## Implemented scope

- The original accepted create operation, actor, timestamp, request hash and
  idempotency hash remain immutable. Source-backed status reads retrieve that
  identity from the independent ledger rather than reconstructing it from the
  current SQL recovery actor.
- `CustomerRecoveryAuthorization` binds the original request to the current Owner,
  expected SQL revision, next revision and exact authorization time. It can
  authorize lookup of an existing customer only. It cannot accept a new create,
  create a Dispatch, reset first-attempt time or widen the 23-hour create window.
- Runtime checks canonical predecessor, enrollment/account authority and current
  Owner. Customer mutation, existing authorization audit row and source checkpoint
  commit in one typed Prepare → SQL commit → Confirm group. Account and billing
  locks precede Owner/row locks; no provider request is made by this transaction.
- Revision CAS chooses one winner when two Owners authorize concurrently. A retry
  by the same Owner at the same expected revision is idempotent only with the exact
  independently confirmed authorization and matching SQL audit/root. A different
  actor or advanced revision fails closed.
- Lost Confirm is recovered from exact committed-next SQL audit and canonical
  source state, without replaying a predecessor. Historical confirmation can
  finish after its actor loses Owner access; the fresh request then fails current
  authorization. Audit/SQL rollback keeps the whole group pending for explicit
  recovery instead of inserting it again.
- Legacy/source selection captures its source token before the single mode check
  and checks it again before commit. A regression caught a double mode check in
  the first implementation; it was removed while preserving the original final
  source-fence assertions.

Receiver/readers must understand the new typed writer before enabling its
producer. Rollback preserves all journals, IDs, checkpoints, audit rows and
additive migrations. Older readers must fail closed on unfamiliar records.
No schema, heartbeat, API-key or duration/timeout change was introduced.

## Local evidence

The local release record is private
`output/team-closure-2026-10-13/customer-recovery-authorization-local.json`;
individual source hashes and retained logs identify the tested worktree.

| Check | Executed result |
|---|---|
| Server library | 527 passed, 66 opt-in tests ignored in that command |
| Isolated PostgreSQL financial/identity suite | 24 commands passed |
| Isolated Copilot/privacy/report/restore suite | 5 commands passed |
| Strict workspace/all-target Clippy | Passed without suppressions |
| Formatting, diff and built operator CLI checks | Passed |
| Protected identity method boundary | Outside `sync_postgres_identity` byte-identical to pre-change HEAD |

The new native fixture covers a different Owner authorizing recovery of the old
actor's request, lost Confirm after SQL commit, revoked recovery Owner, deferred
audit commit failure with atomic rollback, two concurrent Owners, wrong
organization/live mode/revision, idempotent retry and a stop before the original
first attempt. It verifies immutable request/Dispatch/outcome history, unchanged
customer/first timestamp, current actor/revision, audit count and canonical roots.
Pure protocol cases reject forged original identity, nil actor, overflow,
invalid authorization time and changed operation/key. These are synthetic tests;
they do not certify a real Stripe account or live recovery.

## Still open

1. Source-backed lookup claims/proofs, durable normalized lookup observations,
   negative/ambiguous/deleted dispositions, late response/revision fences and
   fresh authorized projection. The existing source lookup claim gate remains
   explicit; this report does not treat an accepted authorization as a working
   provider recovery flow.
2. Typed Checkout/binding writers and complete final authority/read/admission
   fences. Generic multi-head/predecessor recovery, financial retention and
   independent restore freshness remain pending.
3. Original G1–G6 external gates: clean candidate/eight native packages, real
   GitHub/Copilot staging, second tester, Windows/provider sessions, seven actual
   user workdays, Cloud/prices/live Stripe and three 14-day pilots.

The owner explicitly authorized committing and pushing the tested login/billing
and financial-coordinator work to this task branch, including the method-only
protected identity change. Owner configuration, credentials, private outputs and
build artifacts are excluded. This delivery does not update `main`, initialize a
real financial baseline or publish/activate commercial services.
