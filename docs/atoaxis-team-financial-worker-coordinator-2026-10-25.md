# Source-aware scheduler and reconciliation — 25 October 2026

Branch `codex/team-closure-wip`, uncommitted after `19f703c0`. Continues the
[signed-ingress coordinator](atoaxis-team-financial-ingress-coordinator-2026-10-25.md).
This increment connects actual idle scheduling, provider leases, failure metadata
and subscription-observation completion to the shared `NormalWrite` coordinator.
It does not complete every financial writer or the original Team G1–G6 goals.
Public trial, Checkout, real-account source baselines and production remain disabled.

## Actual writers

| Path | Result in source mode | Still outside this increment |
|---|---|---|
| Signed notification | Existing whole source + account ingress group, preserved exact retry | Real provider certification |
| Idle scheduler | Exact bounded due batch, sorted billing locks, source-only group | Real operational canary |
| Claim / fail | Canonical predecessor + historical-owner verification; only operational fields commit without new root | Provider create/dispatch/outcome receipts |
| Complete observation | Snapshot, processed inbox, applied job revision and optional enrollment transition in one group | Independent storage freshness and complete restore certification |
| Customer / quote / Checkout / binding | Existing durable SQL paths remain | Source-aware writer, accepted dispatch/outcome coverage |
| General recovery / approved baselines | Pending complete intents retained | Explicit rollback-predecessor resolution and real baseline approval |

`NormalWrite` reuses the signed-ingress owner discovery, account → sorted billing
locks, canonical predecessor validation, own-transaction inventory, checkpoint CAS,
whole-intent fsync and post-COMMIT confirmation. It owns the actual SQL transaction.
It exposes no caller-supplied arbitrary root or independent transaction proof.

## Scheduling and operational fields

Scheduler selects up to 100 exact due subscription targets under the account lock,
with historical customer/subscription ownership checked through the inventory CTE.
It locks all participants before row mutation, rechecks identities and mutates only
those exact targets. It never uses a bulk UPDATE that can reach an unreserved org.
Queued jobs stop being due, so subsequent ticks can reach another bounded batch;
a count is this batch's result, not proof that an entire account is synchronized.

Only independently proven closed sources are excluded before LIMIT/candidate
selection: known head, no pending transition/unapplied outcome, exactly the
OrganizationClosed freeze and a quarantined/deleted roster entry. Their jobs and
source heads are preserved. Unknown/conflicting/missing closure evidence is not an
exemption and remains a failure requiring review.

Claim/fail change only the inventory's existing excluded fields (lease, retry,
attempts and enumerated error/status metadata). The shared writer checks that
canonical inventory and enrollment did not change. Claim checks its newly issued
lease again after final validation, with a fresh SQL clock, before returning it to
the provider caller. Actual provider HTTP requests remain outside transactions.
Legacy paths also fence independent account source changes before committing;
a source footprint never silently selects an unguarded associated write.

## Completion and exact-next recovery

Completion stages snapshot/payment assessment, processed inbox and applied job
revision using the existing scope, lease, binding and revision checks. The existing
entitlement calculator can stage a transition only for an already enrolled org.
`Change::source_group` transfers its exact predecessor/next state into the same
source intent; it does not emit a standalone enrollment Prepare/Confirm.

The coordinator checks staged canonical enrollment and its provider-observed
history, then prepares all source/enrollment members together. The original lease
deadline is checked with a fresh clock after durable Prepare. Expiry or SQL commit
failure rolls back SQL, retains the complete pending intent and requires recovery;
it cannot ACK an observation or return a normal false-success after Prepare.
Expiry before Prepare rolls back without reserving a new group.

Optional typed `Proposal.writer` distinguishes bounded scheduler and subscription
observation groups. It binds target identities, provider lease/revisions and an
observation digest to every source change. It cannot introduce an initial trial,
an unrelated org, provider creates, ingress-only confirmation or owner terms.
The field is omitted when absent so old event/checksum contracts are preserved;
new readers must precede producers, and older readers may reject new writer records.

Recovery confirms only retained exact SQL-next source roots/checkpoints/transition
IDs, unchanged account receipts, verified historical association and corresponding
enrollment state/history. A changed observation cannot resolve another worker's
intent. Completed SQL normally clears its lease; that expired/cleared lease is not
required again during exact-next readback. A rolled-back predecessor is never
replayed: the group remains pending for explicit reviewed recovery. These matching
copies still do not establish independent restore freshness.

## Local verification and review

Exact source/build/log hashes and final executed checks are in private
`output/team-closure-2026-10-13/financial-worker-local.json`. Fixtures use the actual
repositories, native PostgreSQL and real private file journals with synthetic
metadata and fixture-only reviewed baselines; no provider API or personal DB.

| Final local gate | Result |
|---|---|
| Server library | 522 passed; 60 opt-in/external tests ignored |
| Native financial/identity PostgreSQL | 18 commands passed |
| Native Copilot/privacy/report/restore | 5 commands passed |
| Strict workspace/all-target Clippy | Passed |
| Operator CLI / targeted Rust format / diff check | Passed |

The source receipt records the exact tested uncommitted source, not a clean
candidate SHA. Target storage grew about 5.5 MiB from the prior reviewed target;
no disposable compiler target or new worktree was created. Each native runner's
stop log and removed temporary directory are checked before recording cleanup.

New regression cases cover:

- Two-org scheduler batch and lost confirmation; exact-next retry does not add a
  second job revision. The account receipt head is unchanged by source-only work.
- Last participant predecessor failure and deferred SQL commit failure: no partial
  job survives and a retry cannot replay the retained predecessor.
- Closed enabled/due bindings and closed pending jobs cannot starve an active org;
  the closed job/source is unchanged.
- Operational leases/backoff preserve source roots and Retry-After; an untracked
  canonical revision change prevents the next provider lease.
- Atomic snapshot/inbox/job/enrollment commit, wrong observation rejection, missing
  enrollment history, exact retry after lease cleanup, and lease expiry after
  durable Prepare rolling back SQL while retaining all independent members.
- Optional writer serialization preserves old wire bytes; scheduler target order,
  scope and digest are validated; provider groups cannot create initial enrollment.

Astra found a real closed-org starvation issue during review; SQL now excludes
only the proven closed set before batching and lease selection, with direct native
regressions. Its final read-only review found no additional high-confidence issue.
Review remains separate from executed tests and external certification.

The first scheduler unit fixture accidentally included enrollment and ingress
members; it was corrected to a source-only scheduler fixture without weakening
validation. Strict Clippy found three needless borrows after helper extraction;
those were removed without suppressions. Earlier failure logs remain retained.

No heartbeat, API-key, duration, timeout, schema, public entitlement configuration,
real payment, commit/push or main update is made. The previously approved identity
method remains the only protected user.rs change. Native runners stop and remove
their own fixture instances, no Docker/new worktree/target is created, and the
shared roughly 17.7 GiB target is reviewed and retained for the active checkout.

Next: customer/quote/Checkout/binding accepted-request, dispatch and outcome source
coverage; reviewed multi-head recovery and independent freshness/restore proof;
then the unchanged external candidate, client, staging, canary, Cloud, price and
pilot gates. Rollback disables affected writers while preserving journal events,
SQL checkpoints, queue IDs, history and additive migrations.
