# Source-aware immutable quotes — 25 October 2026

Branch `codex/team-closure-wip`, uncommitted after `19f703c0`. Continues the
[source-aware scheduler/reconciliation](atoaxis-team-financial-worker-coordinator-2026-10-25.md).
This increment wires quote save/read and exact historical confirmation through
`NormalWrite`. Customer request/authorization/dispatch/outcomes and Checkout/binding
source writers remain incomplete. This is neither a clean candidate, a real price
approval, payment activation nor completion of Team G1–G6.

## Implemented

`QuoteRepository` captures one financial authority/configuration-error state at
construction; it does not read a different environment authority mid-transaction.
It retains the current SQL billing Owner and verified customer proof checks. In
source mode it additionally requires the shared historical ownership query to
resolve exactly that org, a ready account ingress, matching canonical inventory,
SQL checkpoint transition and independent source/enrollment predecessors.

New quotes use the existing owned SQL coordinator and typed `Writer::Quote`.
The intent binds org/actor/quote ID, customer operation/revision/identity and a
hash of the full offer: package seats, price, product, amount, currency, tax,
catalog revision/hash and provider observation time at PostgreSQL microsecond
precision. It cannot contain provider creates, enrollment or ingress changes.
Quote SQL and source checkpoint commit before complete independent confirmation.

Created time is supplied from the fresh SQL clock after lock waits, rather than
the transaction-start default. The original immutable expiry is checked again
after durable Prepare. Expiry at that boundary rolls SQL back and retains the
complete intent with reconciliation-required. A lost/failed commit never becomes
a new quote insert or an extension of expired terms.

A retry of an existing quote ID compares the complete immutable offer and customer
proof, including product/tax/observation fields. An exact existing row performs a
canonical read/operational-only commit without advancing a source revision. A
conflicting actor, scope or offer fails rather than selecting the old row as success.
`get` and idempotent save check expiry with a fresh SQL clock after final inventory
validation before returning a currently usable quote. All Checkout flags remain false.

## Historical COMMIT proof is not permission to use a quote

A lost confirmation can leave an exact SQL-next quote after its expiry or its
original actor's loss of ownership. Before current response authorization, the
repository can confirm only that retained typed quote group's exact canonical
SQL-next/checkpoint/transition, immutable quote receipt and unchanged source/account
evidence. This historical confirmation does not require that the old quote still
be purchasable or that the old actor still be Owner; it never restores permissions,
renews expiry, replays terms or recreates a missing row.

Current Owner, verified customer, quote actor/catalog and expiry rules are then
checked for the requested response in a new transaction. A new Owner can allow
account progress without gaining access to the previous actor's quote, and the
revoked actor cannot retrieve it. A rolled-back predecessor remains pending for
future explicit reviewed recovery, which is still an open implementation gate.

## Source-free transition fence

Every customer-proof read, quote save and quote read captures its account source
token **before** selecting source mode and checks again before a source-free
commit. A new Source Seed/Outcome during selection cannot be adopted as a new
legacy baseline. The read/write fails, SQL rolls back where applicable, and
independent evidence remains intact without automatic initialization or repair.
This fence supplements the actual canonical proof required in source mode;
queue emptiness or a successful current request is not a restore-freshness proof.

## Local evidence

Executed checks and exact source/build/log hashes are in private
`output/team-closure-2026-10-13/financial-quote-local.json`. They refer to tested
uncommitted source, not a release/candidate SHA. Native PostgreSQL/file-journal
fixtures use only synthetic metadata and explicit fixture-only reviewed seeds.

| Final local check | Result |
|---|---|
| Server library | 523 passed; 61 opt-in/external tests ignored |
| Native financial/identity PostgreSQL | 19 commands passed |
| Native Copilot/privacy/report/restore | 5 commands passed |
| Strict workspace/all-target Clippy | Passed |
| Operator CLI, targeted Rust format and diff check | Passed |

Both native runners' stop logs and removed temporary roots are checked. Target
storage grew about 1.3 MiB from the prior reviewed shared target; source, evidence,
dependencies and active binaries are retained. No separate build cache is created.

New cases cover concurrent same-ID idempotency, product/tax conflicts, canonical
source readback, forbidden metadata markers, deferred SQL commit rollback without
predecessor replay, and lost confirmation followed by real fixture-clock expiry
and Owner revocation. A new Owner can confirm the old durable history while both
actors remain unable to use the expired old quote. Deterministic source-mode
boundary hooks separately exercise customer/save/get with retained unmatched
outcomes and no automatic source head or accepted SQL insert.

Astra's read-only review found the late source-token capture race. The fix moves
capture before path selection in all three paths and adds the exact boundary
regressions; final review confirms the fix without claiming executed tests.
Broader external provider, OS, client and Cloud gates remain pending.

No heartbeat, API-key, duration, timeout, schema, real payment, deployment, main
update or commit/push is made. user.rs outside the previously approved identity
method remains byte-identical to HEAD. Native runners stop/remove their own
fixtures; no Docker, worktree or separate Rust target is created. The reviewed
shared target remains approximately 17.7 GiB for this active checkout.

## Next

Customer `first_attempt_at`, revision/disposition and recovery authorization are
canonical facts, not operational lease fields. Their request/dispatch paths must
atomically record accepted request identities and first possible dispatch before
provider calls. Stale/orphaned outcomes must be retained independently before SQL
projection, with explicit association-aware resolution; quote coverage does not
complete those paths. Then integrate Checkout/binding, generic multi-head recovery,
approved real baselines and independent freshness/restore evidence. Clean/latest-main
candidate, 8 client artifacts/native sessions, GitHub/Copilot live staging/second
account, 7 real user workdays, Cloud, approved prices and pilots remain open.

Rollback disables affected writers while preserving journals, pending intent,
queue IDs, SQL checkpoints, history and additive migrations. New readers precede
new typed writer events; an older reader may reject those records and must not
truncate them. Public trial/Checkout and production readiness remain disabled.
