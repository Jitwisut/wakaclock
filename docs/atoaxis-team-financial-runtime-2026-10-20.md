# Guarded trial and observation transactions — 20 October 2026

Uncommitted work on `codex/team-closure-wip`, after `b4d68ec7`. Public trial,
production Checkout and Team production readiness remain disabled. This slice
integrates selected writers; it does not complete all commercial read/restore gates.

## Implemented behavior

`start_trial` now requires an explicit pinned independent guard. It verifies the
external predecessor while holding the billing/entitlement locks, including the
existing-trial retry path. Unknown scope, wrong namespace, pending transition,
restored missing DB entitlement or a mismatched state cannot start a fresh trial.
SQL/history/audit run before Prepare; Prepare is fsynced at the outer commit
boundary, followed by DB commit and exact external confirmation. A failed SQL
statement before Prepare leaves no external transition. A failed or uncertain
DB commit after Prepare retains the pending evidence and returns reconciliation
required. Confirmation failure after a successful DB commit returns the same
explicit state rather than clean activation.

Provider observation produces a guarded change plan, including unchanged/older
provider revisions. `TeamStripeRepository::complete_observation` performs its
snapshot/history/ACK writes, prepares the change, then checks the original lease
deadline again using a fresh clock after file fsync. If the lease expires after a
proposal was written, DB work rolls back and the caller receives
`financial_guard_commit_reconciliation_required`; ordinary `false` is reserved
for deferrals that did not write an external proposal. Completed DB effects and
external confirmation remain distinct, preserving evidence after response loss.
An enrolled DB state cannot use a repository with no independent guard.

## Explicit trial reconciliation

The internal `reconcile_trial` operation confirms external evidence only. It
requires a live authorized Owner, exact transition ID, canonical
`State::trial(package, original_start)`, matching already committed DB state,
revision-1 `trial_started` history and a matching trial audit. It can retry
idempotently without new DB records or changed trial timestamps.

Missing/mismatched DB state/history/audit is rejected. The operation never copies
a proposal into the database and never approves provider/payment transitions.
A genuinely failed DB commit with a pending proposal therefore remains blocked
for a separate explicit recovery decision; resetting the file/trial is not a
recovery procedure. The operation is internal only; authenticated API/operator
exposure and the associated management audit remain part of later work.

## Configuration boundary

- `ATOAXIS_TEAM_FINANCIAL_GUARD_PATH`: private absolute independent journal path.
- `ATOAXIS_TEAM_FINANCIAL_GUARD_NAMESPACE`: independently configured expected UUID.
- `ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED`: explicit true/1 or false/0; invalid values
  fail closed. Required without a complete valid configuration is an error.

`billing-reconciliation` validates configuration before provider requests.
Repository observations retain a safe configuration-error state instead of
silently treating an invalid guard as absent. A configured guard verifies its
namespace and journal durability; it does not initialize missing storage.

Absent configuration is reserved for explicitly precommercial deployments that
have never permitted enrollment. Any deployment permitting enrollment must require
the guard independently of DB contents; a restored no-row state must never turn
this requirement off. The launch/readiness integration enforcing that condition
across all entry points is still unfinished. The test runner removes these three
settings from inherited shell configuration and uses private per-test guards,
never real owner ledgers.

## Local verification

Native PostgreSQL suite now executes nine tests, including:

- successful/concurrent trial retry and history-write rollback;
- unknown scope/namespace, exact trial loss-of-confirmation reconciliation,
  missing history/audit and restored missing entitlement;
- a deferred SQL trigger that fails actual DB COMMIT after external Prepare;
- actual guarded repository snapshot/ACK commit, missing-guard rollback and lost
  external confirmation; trial recovery rejects its provider state;
- Prepare delayed past the actual worker lease deadline, leaving a pending
  transition and rolled-back DB snapshot/ACK with explicit reconciliation error;
- the existing signed ingress, invoice, quote/customer/Checkout and Team admission
  regressions. Fixtures are synthetic metadata; no real Stripe or Docker.

Use `financial-runtime-local.json` for dated hashes and exact broad test/Clippy/CLI
results. Older component evidence is preserved under its original scope/date and
must not be substituted for current-source proof.

## Work still required

1. Add guard checks/tokens to all Team legacy/paid readers, scans, admission,
   Copilot projections and final API/CSV/cache responses. Current SQL receipt
   views cannot establish legitimate legacy status after a pre-enrollment restore.
2. Enforce required guard configuration at every commercial activation/readiness
   entry point and add trusted new-organization roster creation/lifecycle.
3. Complete provider pending reconciliation from independent financial source
   heads: bindings/account/live scope, accepted quote terms, external customer/
   checkout outcomes, inbox failures, snapshots, reconciliation/ACK revisions and
   idempotency. Entitlement agreement alone cannot authorize those restored inputs.
4. Define the explicit resolution of a failed DB commit after Prepare, management
   audit, financial retention/deletion and independent storage version/restore
   drills. A checksum chain cannot detect a valid older independent-log prefix.
5. Continue trial/billing UI, package changes/prorate/downgrade/grace/portal and the
   separate owner/Cloud/provider/OS/pilot/canary gates in the full Team Goal.

Latest results: server **485 passed / 51 ignored**, guarded Stripe/trial native
suite **9 passed**, separate Copilot/restore native suite **5 passed**, focused
guard policy/file tests **10 passed**, strict workspace/all-target Clippy and the
freshly built operator CLI smoke passed. These are isolated synthetic tests; the
remaining ignored/external gates are not certified by them. Source hashes and
immutable fixture folders are in `financial-runtime-local.json`.

No Docker/provider account was opened. Both owned native PostgreSQL instances
ran sequentially and were stopped/removed, as was the CLI fixture. Reused active
Rust target: 17,465,676 → 17,480,908 KiB; no new worktree/target. The shared active
cache is retained above the 10 GiB review threshold for the continuing Goal.
No commit/push or main update was performed.

## Follow-up 22 October 2026

Selected read/final-response guards are now implemented; see [financial read fences](atoaxis-team-financial-read-2026-10-22.md) and `financial-read-local.json` for the newer scope and evidence. This does not retroactively broaden the 20 October writer results. Admission transaction guards, commercial configuration enforcement and full financial source restore remain open.
