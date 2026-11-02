# Reviewed financial transaction confirmation — 27 October 2026

Branch: `codex/team-closure-wip`, delivered base `1646cbf6`; this increment is
uncommitted development. It extends the existing ingress operator tool with
read-only exact-next inspection of retained **typed** financial writers.
It does not complete general financial recovery, restore freshness or Team G5/G6.

## Implemented flow

- `prepare-transaction-recovery` checks the original journal proposal, writer,
  account/live scope, every participating source SQL checkpoint/inventory,
  enrollment next-state/history and original immutable contract. It shares the
  worker's readback validator, including a clone-only preview of confirmation.
  Missing/predecessor SQL, unknown writers, frozen/conflicting sources and
  ambiguous state cannot produce an applicable plan. No SQL is reconstructed.
- A private, create-only plan expires after 15 minutes and binds the namespace,
  retained group/proposal digest, account/source/enrollment observation, SQL
  inventory, database/process descriptor and operator evidence-reference digest.
  Existing private plan checks apply: strict schema, bounded size, regular file,
  private permissions, single link, opened-descriptor verification and fsync.
- `apply-transaction-recovery` requires the exact reviewed digest and explicit
  `--acknowledge-readback-only`; ingress/bootstrap approval cannot authorize it.
  It repeats the original SQL readback and all fences. A successful read-only
  SQL COMMIT precedes a single durable `ConfirmReviewed` frame containing the
  confirmation and review metadata. No provider call, SQL replay, job increment,
  new Owner authorization, first-send window or baseline is created.
- The final observation and expiry are checked again under the append's file
  lock, after SQL has released its locks. Changed evidence leaves the retained
  transaction pending. No file lock spans a SQL await. Database/app clock
  disagreement fails conservatively.
- Exact Apply retry returns `already_recorded` only for the same retained review.
  This acknowledges the historical confirmation; it does not claim that current
  SQL still matches an old state. It does not rewind newer work or perform repair.
  A worker that already confirmed the group without this review requires fresh
  inspection, rather than retroactively attaching an approval.
- Review identity/digest/time remain in the journal. Review IDs cannot be reused
  as another transaction, source/ingress seed or transition. Existing ordinary
  Confirm records retain their serialization; the new variant is additive.

Account locks precede financial table fences and sorted organization locks.
Lock/statement timeouts are set before waiting for the account. This rare local
operator workflow can briefly block financial writers, including other accounts;
it is not an HTTP endpoint, automatic startup step or background repair loop.
Deploy readers that understand `ConfirmReviewed` before using the new command.
Rollback retains the journal and review records; older readers must fail closed
on the additive event rather than truncate it or silently skip it.

## Operator sequence

These are placeholder commands, not executed against a configured account during
development. Use the existing private authority and environment-based
`POSTGRES_URL`; never print credentials or financial rows in a transcript.

```sh
team-financial-guard prepare-transaction-recovery /private/operator/ledger.jsonl \
  --namespace <reviewed-namespace> --account <stripe-account-id> \
  --evidence-hash <sha256-of-reviewed-evidence-reference> \
  --output /private/operator/transaction-plan.json

# Inspect the immutable private plan and safe summary before approving.
team-financial-guard apply-transaction-recovery /private/operator/ledger.jsonl \
  --namespace <reviewed-namespace> --account <stripe-account-id> \
  --plan /private/operator/transaction-plan.json \
  --approve-plan <exact-plan-digest> --acknowledge-readback-only
```

Use `--live` on both commands only for that separately reviewed scope. If the
plan expires, the DB process changes, or evidence changes, prepare again. Do not
edit/re-sign a plan, delete pending evidence or restore predecessor rows by hand.
The original ingress recovery commands remain separate and retain their rules.

## Limits and verification still required

The evidence digest is an operator reference, **not an independent latest-state
attestation**. Matching SQL and a local journal cannot prove that neither was
rolled back. Independent restore freshness, general predecessor/unknown-state
resolution, financial retention/capacity and Cloud restore remain open. Untyped
or ingress-bearing groups are outside this command; existing ingress recovery
handles its own explicitly reviewed cases. Checkout/paid activation remains off.

Development checks compile all server targets and test code; behavioral suites
remain deferred under the owner's development-first instruction. Added regressions
cover approval separation, changed group/proposal/SQL/instance/scope, invalid or
reused review identity, old Confirm serialization and idempotent confirmation.
An isolated PostgreSQL fixture covers missing SQL, source freeze, expired plans,
lost confirmation and exact Apply retry without job increments. These tests have
not been executed for this increment. Additional acceptance work includes real
CLI/private-file flow, concurrent Apply/worker confirmation, account-lock expiry,
append/fsync failures and source changes at the final file-lock boundary.

No Docker, live provider request, production deployment, baseline initialization,
database migration or change to heartbeat/duration/capture is part of this work.

Development verification: `cargo check --all-targets -p wakaclock-server` passed
after the final shared-validator preview change. `git diff --check` and Python
AST parsing of both updated native-runner scripts passed; the scripts were not
executed. Reused `backend/api/target`: 18,612,024 → 18,612,176 KiB. This reviewed
cache remains for the active checkout; no separate target/worktree was created.
Source hashes and compile-only scope are in the private
`output/team-closure-2026-10-13/transaction-operator-development-2026-10-27*.json`
receipt. No runtime/certification gate changes from these results.
