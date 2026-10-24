# Financial-source protocol component — 23 October 2026

Continues the [deployment guard](atoaxis-team-financial-deployment-2026-10-23.md).
Source is uncommitted on `codex/team-closure-wip` after `b4d68ec7`.
Subsequent [read-only SQL inventory work](atoaxis-team-financial-inventory-2026-10-23.md)
has its own current evidence; the results below remain the dated component run.
This delivery implements the domain/storage component. **Financial-source SQL
and Stripe worker integration is unfinished.** There is no real baseline seed,
new HTTP endpoint, provider request, production activation or financial-restore
certification from these tests. `financial_sources` remains `unconfirmed`.

## Implemented and locally verified

| Component | Implemented behavior |
|---|---|
| Scope and source root | Organization/account/live scope, schema/revision/root/count and explicit reviewed seed. Unknown scopes have no inferred root; an outcome does not initialize them. A known scope cannot be seeded again to replace history. |
| Source transactions | Expected predecessor, unique transition identity, immutable accepted operation/request/key digests, pending proposal and exact commit identity. Used transition identities remain known across later transitions, preventing an old ACK from confirming new work under a reused ID. |
| External dispatch evidence | Only committed accepted requests can be recorded as possibly sent. The original first-attempt time and request/key digests cannot be replaced on retry. This is a storage acknowledgment, not permission to issue another HTTP create. |
| External outcomes | Retain allowlisted provider identities/digests even if the SQL row, lease, source head or organization access is unavailable. This does not create a usable customer/subscription binding or payment grant. |
| Conflicts | Check outcomes against committed **and pending** accepted requests. Unknown operations, hash/kind conflicts, differing outcome variants or contradictory provider identities freeze the scope. Preserve conflicting variants without overwriting the first receipt. |
| Outcome reconciliation | A retained unapplied outcome blocks root verification and further dispatch. A confirmed transition clears only the exact outcomes it incorporates; a later outcome remains unresolved. Replaying an already incorporated outcome does not reopen it. |
| Existing ledger | New additive event kind uses the same file, namespace pin, bounded parser, checksum chain, OS lock, append/fsync and retry rules. Separate source tokens avoid treating unrelated enrollment/source changes as the same proof. |
| Closure | Enrollment quarantine/deletion freezes known source scopes. Late evidence can still be retained; it cannot reopen the scope. Evidence for an unknown organization does not register it as legacy. |

New code is in `services/team_financial_source.rs`; event replay and storage are
integrated with `services/team_financial_guard.rs` and
`infrastructure/team_financial_guard.rs`. No production product call site emits
source events yet. The mixed old/new ledger exercised by the operator/native
test is private synthetic metadata and is deleted with its fixture.

The source root descriptor is **not** a canonical SQL inventory implementation.
The caller must eventually construct it from explicitly allowlisted facts, hold
the correct SQL locks, and issue Commit only after a known successful SQL commit.
The storage API itself cannot prove that SQL or Stripe succeeded.

## Evidence and limits

`output/team-closure-2026-10-13/financial-source-local.json` records exact source
hashes, native-run evidence paths, operator binary hash, validation and cleanup.
The broad server run includes eight new component regressions: six domain tests
and two actual filesystem tests. The latter reopen the ledger through a fresh
guard instance and inject fsync failure; they are not an OS power-loss or complete
worker process-crash certification.

Current results: server 494 passed / 51 ignored; isolated PostgreSQL Stripe nine
commands and Copilot/restore/operator five commands passed; operator CLI smoke
and strict workspace/all-target Clippy passed. Owned fixtures stopped and their
private data was removed; Docker was not opened and the complete process-name
check found no Docker engine/compiler/PostgreSQL process. The existing shared
target grew from 18,434,316 to 18,449,848 KiB; it is reviewed and retained for this
active checkout above the 10 GiB threshold. No new target/worktree was created.

Astra's read-only review found pending-request conflict and historical transition
ID reuse issues. Both were fixed with direct regressions and reviewed again.
Review is distinct from executed test evidence. The initial broad `source_` test
filter also selected an unrelated localhost HTTP test denied by the sandbox;
that failure log is retained. The authorized full run executes that fixture.

No source, diff, prompt/response, credential, raw idempotency key or hosted bearer
Checkout URL belongs in this component. Private financial IDs and immutable
digests are metadata; diagnostics must not export the ledger contents. Current
CLI verification continues to report enrollment-only scope and unconfirmed
financial sources even when it can parse source events.

Old enrollment-only records remain readable by the new reader. An old reader
will reject the new event kind, so deploy readers before enabling source writers.
Rollback must retain the ledger and use a compatible reader, never delete new
events to make an old binary appear healthy.

The existing 64 MiB journal / 1 MiB record limits fail closed. High-volume source
observation/inbox integration needs a reviewed capacity, retention and versioned
checkpoint policy before enablement; no proof is silently removed or compacted.
Hashes cannot detect replacement by a valid older log prefix plus a matching old
DB. Independent versioned storage and pinned deployment policy remain required.

## Unfinished work, in implementation order

1. **Canonical SQL inventory:** metadata allowlists for customer operations,
   authorizations, accepted quotes/frozen requests, Checkout outcomes, bindings,
   inbox/reconciliation revisions, failures, normalized subscriptions/invoices and
   deletion markers. Include first-attempt/lookup-only/disposition and observation
   times; exclude leases, attempts, cooldowns and incidental update timestamps.
2. **Transactional writers:** normalize lock ordering (billing before semantic
   rows; no billing lock after a claimed job-row lock), then wire source
   Prepare → SQL commit → source Commit across every semantic change. Lost or
   unknown SQL commit leaves reconciliation required.
3. **Provider boundary:** durably confirm the accepted request before create,
   record possible dispatch before HTTP, preserve the verified response before
   SQL completion even on stale lease, and retain the existing operation/key.
   Ambiguity or a missing SQL operation must not generate a new customer/session.
4. **Readers and restore:** compare canonical SQL/source roots through final
   response/coverage boundaries in addition to enrollment, consent and privacy
   fences. Retain read-only recovery evidence access without granting rights.
5. **Owner workflow and drills:** prepare a concrete baseline/recovery plan from
   independent evidence and obtain approval before applying it to real financial
   history. Provider readback cannot invent missing owner authorization or terms.
   Add actual DB restore/process-failure/race tests, financial retention and
   versioned-storage drills before enabling this pipeline.

All original G1–G6 gates remain separate: clean candidate/main integration, real
GitHub/Copilot staging and second tester, four-target native client artifacts,
provider sessions, seven real user workdays, Cloud/approved prices and pilots.
Public trial/Checkout/production readiness remain disabled.
