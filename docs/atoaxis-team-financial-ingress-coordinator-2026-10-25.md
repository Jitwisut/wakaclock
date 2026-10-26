# Signed financial ingress coordinator — 25 October 2026

Branch `codex/team-closure-wip`, uncommitted after `19f703c0`. Continues the
[atomic intent component](atoaxis-team-financial-transaction-2026-10-25.md) and
[identity/billing lock fix](atoaxis-team-financial-locks-2026-10-24.md).
This increment wires one actual semantic writer, signed webhook acceptance.
It does not complete all financial writers, initialize a real baseline, enable
payments, certify restore freshness, or close the original Team goals.

## Runtime behavior

`repository/team_financial_transaction.rs` owns the real SQL transaction for
bound signed ingress. It takes the account lock, discovers historical owners
with the same CTE as the canonical inventory, then locks affected organizations
in sorted billing-lock order. Customer operations, quotes, checkout history,
bindings, deletion tombstones and retained independent outcomes all participate
in ownership. Multiple owners are unresolved; current bindings cannot erase
historical ownership. Participants must agree with SQL enrollment and independent
canonical source predecessors, including the retained checkpoint transition ID.

The writer stages the allowlisted account receipt/job and account head, computes
the inventory on its own connection including those writes, and updates each
participant source checkpoint with predecessor CAS. It fsyncs the complete source
and ingress intent, checks the recorded group and observation again, commits its
owned SQL transaction, and only then confirms the complete independent group.
A caller cannot commit a different transaction using the returned observation.

The receiver preserves account-level durable receipt behavior for unbound events
and accounts that have no source protocol footprint. Any source evidence or SQL
source checkpoint selects strict source handling for associated events; missing,
restored-only or stale evidence never silently falls back to ingress-only writes.
An account source token is checked after ingress Prepare and before raw-path SQL
commit, including when source mode was absent at path selection. Ownership changes
at that boundary roll back SQL while retaining intent and independent evidence.

Closed unrelated organizations alone do not halt another active organization on
the same provider account. This exemption requires a known source head, no pending
transition or unapplied outcome, and exactly the organization-closed freeze. An
affected closed organization, conflicting/unknown evidence or other freezes still
blocks. Raw receipt acceptance is distinct from readiness to project into an org;
a duplicate account receipt is not evidence of complete org analytics.

## Exact-next recovery and limits

A retry of the same retained signed notification can finish lost group confirmation
only after every SQL source root/checkpoint/transition, account head and receipt/job
matches the complete retained next state, with unchanged ownership, enrollment and
independent evidence. Another event cannot resolve it. A rolled-back predecessor
is never replayed as a fresh event, nor are owner terms, accepted creates or generic
provider intents reconstructed by this recovery. The pending group remains blocked
for a future explicit operator recovery when exact-next proof is unavailable.

An old ingress-only pending intent cannot be replayed through normal acceptance
once source protocol evidence exists. General operator recovery and all other
semantic writers still require their own source-aware integration. No production
source seed is safe before that coverage is complete. Matching restored SQL and
journal copies remain insufficient independent freshness evidence.

## Verification and rollout

Executed results, source/build/log hashes and cleanup checks are recorded in private
`output/team-closure-2026-10-13/financial-coordinator-local.json`.
The new native PostgreSQL regression uses the real signed receiver and real file
journal, with only synthetic metadata and explicit fixture-only seeds. It covers
lost confirmation, exact retry, deferred commit failure, predecessor refusal,
concurrent duplicate calls, unbound receipts, unrelated closure, stale/missing/SQL-only
checkpoints, ambiguous historical ownership, and a deterministic outcome append
after durable ingress Prepare in both source-mode and no-source-mode cases.

| Local check | Final result |
|---|---|
| Server library | 520 passed; 58 external/opt-in tests ignored |
| Isolated native PostgreSQL financial/identity | 16 commands passed |
| Native Copilot/privacy/report/restore | 5 commands passed |
| Strict workspace/all-target Clippy | Passed |
| Built operator CLI smoke / targeted Rust format | Passed |

The first strict Clippy check rejected `std::sync::Mutex` in the new test-only
injection hook. It now uses the existing `parking_lot` dependency; no lint was
suppressed, production locking or acceptance criterion changed. Final suites run
on that exact source; the earlier failure and earlier successful test observations
remain retained separately. Native runners stop/remove their own synthetic data;
no Docker instance or new Cargo target/worktree is created. The shared build target
remains about 17.7 GiB, reviewed and retained for the active checkout.

Astra's read-only review confirmed the final-fence correction and reported no
further high-confidence finding in this increment. Review does not replace tests.
Local fixtures are not GitHub/Stripe/Cloud or client runtime certification.

Only the explicitly approved `UserService::sync_postgres_identity` delegation and
its helper/tests/module registration change protected identity code; the rest of
`user.rs` must remain byte-identical to HEAD. Heartbeat, API-key, duration, timeout
and schema semantics are unchanged. Existing event contracts are preserved.

Deploy compatible receivers before writers. Roll back by disabling the affected
feature/writer while retaining journal events, queue IDs, checkpoints and additive
migrations; an old reader must not truncate a journal with the new event family.
Trial, public Checkout and production remain disabled. No real provider call or
financial mutation, main update, commit or push is part of this increment.

Next priorities are scheduler/reconciliation, customer/quote/checkout/enrollment
and provider-outcome source transactions, then reviewed multi-head operator
recovery and independent restore/freshness proof. Original G1–G6 external gates
(clean/latest-main candidate, client artifacts/native sessions, GitHub second
account, user canary, Cloud, owner-approved prices and pilots) remain open.
