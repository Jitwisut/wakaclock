# Atomic financial intent component — 25 October 2026

Branch `codex/team-closure-wip`, uncommitted after `19f703c0`. Continues the
[transaction inventory reader](atoaxis-team-transaction-inventory-2026-10-25.md).
This component records a complete independent intent for an eventual SQL
transaction. **It is not the production SQL coordinator**, a distributed commit,
payment proof, a real-account baseline, or financial restore certification.
Public trial, Checkout and production remain disabled.

## Implemented

`services/team_financial_transaction.rs` adds a typed journal event family:

- One namespace/account/livemode, 1–100 sources in strictly increasing org-ID
  order, optional enrollment changes for those orgs, and optional account ingress.
  All member transition IDs equal the immutable group ID. Predecessors and an
  observation hash bind account history, all its source evidence and participating
  enrollment heads. Inputs are not silently sorted or truncated.
- Prepare and Confirm apply all members to a clone of the entire guard snapshot
  and swap only when every member succeeds. A failed last member cannot leave an
  earlier member prepared/confirmed. Confirm takes only ID + proposal digest and
  uses the retained intent; it cannot substitute a different member set.
- Pending groups reserve both the account and every participating organization,
  including across different accounts and when ingress/enrollment themselves do
  not change. Ordinary member Prepare/Confirm, bootstrap, seed and dispatch paths
  cannot bypass the reservation. Old ingress-only operator recovery is blocked.
- Group IDs cannot be reused by standalone transitions, bootstrap plans, seed
  reviews or operator reviews. The reverse checks include legacy ingress seed
  review IDs and historical enrollment IDs after the enrollment head advances.
- `normal` mode requires ready source history across the account and cannot clear
  outcomes. `resolve_outcomes` requires explicitly retained outcome IDs and no new
  accepted create request anywhere in the group. A later matching outcome remains
  unapplied; unrelated late evidence is not silently added to the resolved set.
- Outcome/conflict/freeze appends and emergency quarantine/delete remain possible.
  Conflict/freeze/closure prevents whole-group confirmation and keeps the intent
  and reservations. Account-wide frozen or unrelated pending source evidence also
  blocks confirmation; it cannot be bypassed by choosing another member org.
- Exact historical retries do not replay member commits or rewind newer heads.
  The file API returns Prepared/Confirmed plus whether it appended. This is a
  journal disposition, **not current readiness or permission to replay SQL**.

History is retained, bounded by 10,000 groups and 768 KiB per serialized proposal,
plus the existing 1 MiB record / 64 MiB journal limits. Capacity fails closed;
there is no pruning/reset that erases pending or committed evidence.

## Persistence, reads and diagnostics

`FinancialGuard::record_transaction` uses the existing private append/fsync/file
lock/checksum chain; no SQL/provider await holds the file lock. One record contains
the complete intent or complete confirmation. Complete bytes after an interrupted
fsync are revalidated and made durable under the existing locked-read protocol.
Torn records are retained and rejected without truncation or success ACK.

Account readiness, organization verification, ordinary idempotent member methods,
inventory agreement and ingress recovery now recognize pending groups. Org/source
tokens include relevant group history; a source-only transaction cannot change
the token to pending and then back to the pre-transaction token. Unrelated orgs do
not lose their token just because another group changes.

The private operator `inspect` adds a `financial_transactions` object with counts
and reconciliation status. Ingress diagnostics identify transaction reconciliation;
inventory adds `financial_transaction_pending`. No group proposal, provider IDs,
root digest, credential or payload is exported by these additions. Existing fields
remain, including `financial_sources=unconfirmed` and disabled authorization.

Existing event serialization/checksums are unchanged. New readers can replay old
events plus this family; an older reader rejects the new family. Deploy compatible
receivers before any production writer emits it. Downgrade must not truncate the
journal, remove accepted intent, erase IDs or roll back additive migrations.

## Local evidence

Exact source/build/log hashes and final checks are in private
`output/team-closure-2026-10-13/financial-transaction-local.json`. It distinguishes
current uncommitted source from earlier delivery/candidate artifacts.

| Final check | Result |
|---|---|
| Server library | 519 passed; 57 opt-in tests ignored |
| Isolated native PostgreSQL financial/identity/intent | 15 commands passed |
| Native Copilot/privacy/report/restore | 5 commands passed |
| Strict workspace/all-target Clippy | Passed |
| Built operator CLI smoke | Passed |
| New domain / actual-file regressions | 13 / 3 passed within server suite |
| Fixture cleanup | Both passing runners stopped/removed their private instances |

New regressions cover atomic last-member failure, historical retries, cross-account
org reservations, reverse ID collisions, unknown contract/size/order rejection,
late outcomes, resolution mode, account-wide freeze and emergency closure.
Actual file tests cover restart, full-frame failed fsync/ACK, lost confirmation,
busy lock, torn tail, no-op member bypass and token ABA.

The native PostgreSQL fixture stages a real semantic write and matching canonical
checkpoint, then records the intent. It exercises both SQL rollback and SQL commit
with lost independent confirmation. Pending intent blocks read/ingress/operator
recovery, even when SQL/checkpoint match. Only the known-commit test subsequently
confirms and checks exact canonical agreement. It also invokes the actual built
operator and checks its output for prohibited identifiers/digests. This explicitly
arranged fixture is **not a production coordinator or a provider call**.

The first native run failed because the synthetic source-head INSERT omitted its
required `updated_at`. The fixture now supplies it; no schema/default or acceptance
criterion was weakened. Failed logs are retained separately from passing evidence.
Astra identified two asymmetric ID checks (bootstrap/review and legacy seed review);
both received fixes and direct regressions. Review is separate from executed tests.

## Still incomplete / next

1. Production coordinator with typed normal/resolution proofs, all affected-org
   discovery, account → sorted billing locks, canonical predecessor validation,
   own-transaction inventory/checkpoint updates, final token/deadline checks, SQL
   COMMIT and only then whole-intent Confirm.
2. Exact multi-head SQL recovery/readback for the retained next state. Rolled-back
   intents remain blocked. Do not automatically reapply owner terms, recreate a
   provider operation, release reservations or replay only the ingress member.
3. Wire every semantic writer: notifications, scheduler, reconciliation, customer,
   quote, Checkout/binding, enrollment and outcome-driven historical association.
   Record accepted requests, possible dispatch and provider outcomes around actual
   calls, including lost responses/expired leases. No real seed until coverage is
   complete; root semantics already include shared inbox/jobs.
4. Final source-aware read/admission/restore fences, approved historical baseline,
   independent versioned-store/retention policy and genuine restore/process-fault
   drills. A matching restored SQL/journal pair is not independently fresh proof.
5. G1–G6 external gates remain unchanged: clean/latest-main candidate and 8 client
   artifacts/native sessions, real GitHub/Copilot staging/second tester, 7 user
   workdays, Cloud, approved prices and pilots. No gate is inferred from fixtures.

No heartbeat/API-key/duration/timeout/overlap/schema change, service deployment,
real financial mutation, commit/push or `main` update is made. Docker is not used;
native runners stop/remove only their isolated fixtures. Source/evidence and the
shared bounded build cache are preserved.
