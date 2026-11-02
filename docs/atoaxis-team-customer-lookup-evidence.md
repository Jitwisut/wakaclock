# Durable customer lookup evidence

Continues commit `1646cbf6` and the
[Owner-confirmed recovery authorization](atoaxis-team-customer-recovery-authorization.md).
This increment supplies the lookup **evidence/producer boundary**, not complete
source-backed recovery. The source lookup claim and typed projection gates remain
closed until the current authorization/lease and exact receipt are integrated.
No public activation or production certification follows from this component.

## Later development increment

The runtime claim/projection and idle recovery code has since been added. See
[development-first handoff](atoaxis-team-development-first-2026-10-26.md) for the
current code/deferred-verification split. The results below remain historical
foundation evidence, not a test pass for the later source.

## Implemented

- Additive `CustomerLookup` journal events retain a normalized attempt receipt and
  its optional positive Outcome atomically. Receipts bind original operation/hash,
  recovery actor/revision, authorization writer digest, lease and observed time.
  Closed dispositions are verified, not found, ambiguous, deleted and invalid.
  No raw customer response, prompt, credential or provider text is stored.
- A positive lookup reuses the original customer Outcome ID/hash across actors
  and leases. Its attempt receipt is separate freshness evidence, never a second
  customer fact. Exact retries preserve the first receipt/outcome timestamps.
  Empty new maps are omitted during serialization and default when reading old
  entries, preserving pre-lookup tokens and old journal checksums.
- Receipt and Outcome are applied on one clone and appended/fsynced in one frame.
  Same-attempt contradictory results and reused-ID payload conflicts retain the
  competing evidence with an absorbing freeze. Ambiguity and invalid identity
  also freeze atomically; unauthorized or unmatched lookup receipts cannot grant
  permission or initialize a reviewed source head.
- A committed recovery authorization is checked from independent typed history,
  including account/live, original request, current actor/revision and writer
  digest. Lookup maps participate in full source/account tokens even though they
  do not alter canonical SQL inventory by themselves.
- Receipt IDs do not independently establish provider ownership. Verified lookup
  identity comes through its linked Outcome exactly once, allowing the resolver's
  exact before-view exclusion to restore a predecessor. Negative/deleted receipts
  do not introduce a new SQL customer mapping; future projection must preserve
  any customer identity already known in SQL.
- Retention tests current source footprint under the same evidence file lock.
  Truly source-free guarded legacy lookups do not manufacture a source. If source
  migration races HTTP, the result is retained as unauthorized migration evidence
  and frozen, including a legacy revision-one lookup. No late result is silently
  discarded based on the mode captured before the request.
- The existing provider lookup path now retains normalized successful, negative,
  ambiguous, deleted and invalid observations before returning. Positive facts
  use the same retained-outcome mechanism. Search candidates require validated
  operation metadata and a fresh resource read; another preflight runs before that
  second request. Transport/auth/rate-limit failures keep their existing errors.
  This wiring does not bypass the still-closed source lookup claim gate.

## Local verification

Final machine-readable evidence is private:
`output/team-closure-2026-10-13/customer-lookup-evidence-local.json`.

| Check | Result |
|---|---|
| Server library | 528 passed; 67 opt-in tests ignored in that command |
| Native financial/identity PostgreSQL runner | 25 commands passed |
| Native Copilot/privacy/report/restore runner | 5 commands passed |
| Strict workspace/all-target Clippy | Passed without suppressions |
| Formatting, diff and built operator CLI | Passed |

The new native fixture checks stable first receipt/Outcome timestamps, restart
readback, two leases sharing one positive Outcome, same-lease contradiction,
negative/deleted/ambiguous/invalid dispositions, wrong authorization digest,
unchanged SQL and source-token changes. It also exercises an actual guarded
legacy claim before/after a reviewed synthetic migration and a newly observed
customer that brings previously unbound inbox/jobs into an exact resolver's scope.
A pure serialization test checks the empty-map legacy representation.

Astra's read-only review found the duplicated before-view ownership alias and
late-legacy early return; both were corrected and regression cases added. Its
follow-up found no additional high-confidence defect; it did not execute tests.
Early fixture read-comparison/compiler and unused-unit Clippy failures remain in
the logs and were corrected without weakening assertions or suppressing warnings.

These tests use synthetic metadata and private native PostgreSQL only, never a
real provider account or production database. Owned databases are stopped/removed;
no Docker, worktree or new target is created. The shared active Rust target is
reviewed above 10 GiB and retained with debug=1/incremental=false for ongoing work.
No heartbeat, identity/API-key, duration/timeout, schema or main-branch change was
made. New source remains uncommitted after `1646cbf6`.

## Remaining development, then external evidence

1. Source-backed lookup claims/proofs using the exact current authorization, with
   immutable original create identity and no new create Dispatch or reset clock.
2. Typed receipt-bound positive/negative projection. Already-applied Outcome is
   insufficient for Verified: require the current attempt's positive receipt,
   current Owner and exact live lease, plus final token/deadline checks. New positive
   Outcomes use explicit resolution; negative results retain the known SQL identity.
3. Exact-next lost-confirm recovery, stale revision/newer-lease protection and
   restart replay across that complete flow; then integrate Checkout/binding and
   all remaining writer/read/admission/retention/restore fences.
4. Original G1–G6 real staging, clean candidate/packages/native/provider sessions,
   Windows, seven actual user workdays, Cloud/prices/live Stripe, second tester and
   three 14-day pilots. Local receipts do not substitute for those gates.

Receiver/readers must understand these events before producer rollout. Rollback
keeps journals, IDs, checksums, checkpoints and additive migrations; old readers
must fail closed rather than delete unknown evidence. The goal stays active and
public Checkout/trial/production readiness stay false.
