# Enrollment and entitlement restore guard — 20 October 2026

Worktree: `codex/team-closure-wip`, uncommitted after `b4d68ec7`.
This is the independent evidence component and operator verifier. Product
read/write authorization is **not wired to it yet**; public activation remains off.
It is not a claim that full financial restore, G5, or Team is complete.

## Implemented

- Explicit organization roster: legacy, enrolled, quarantined, deleted. Unknown
  organizations fail closed. Missing entitlement is accepted as legacy only when
  the independent roster explicitly identifies that organization as legacy.
- Prepared and committed transitions remain distinct. A prepared state cannot
  grant access, restart a trial, or recreate a payment. Transition identity,
  predecessor, revision and original trial timestamps are checked. Quarantine and
  deletion retain history and prevent finalizing a former proposal.
- Private append-only JSONL file, schema/sequence/previous-hash/checksum validation,
  bounded records and file size, separate stable file lock, file and directory
  fsync. Torn/invalid input is retained and rejected; no automatic truncation.
- If a complete write's fsync failed, reads and exact retries reestablish durability
  under the lock before trusting it. Injected fsync-failure tests cover Prepare
  and Commit, including continued failure and eventual exact retry.
- Expected namespace is pinned for writes and DB verification. Organization tokens
  remain stable for unrelated organizations' appends. Concurrent proposals to
  different organizations are retained; one same-organization proposal wins.
- Read-only DB verifier checks a live organization row, optional entitlement
  revision/full state, and equal independent organization tokens before/after the
  observation. Missing/deleted organizations, unknown scope, namespace mismatch,
  pending transition and restored missing entitlement are denied.
- Explicit operator CLI: `team-financial-guard initialize`, `inspect`, and
  `verify-database`. Output is metadata only, excludes saved State/provider IDs,
  and declares product authorization disabled and financial sources unconfirmed.

## Operator workflow (internal development only)

Use a private existing canonical directory outside database backups. The tool
requires an absolute path, rejects symlink paths/files and overly broad Unix
permissions. Keep its `.lock` file; never replace it while any writer may run.

1. Review the organization roster against trusted evidence before initialization.
   The command requires `--acknowledge-reviewed-roster`, an explicit namespace,
   and explicit `--legacy-organization` IDs. It never scans a restored database
   and labels all missing rows legacy. Existing files are never overwritten.
2. `inspect <path>` verifies journal integrity and durability, returning only
   namespace, sequence and state counts. It is not an access decision.
3. `verify-database <path> --organization <uuid> --namespace <expected-uuid>` uses
   existing `POSTGRES_URL` from the process environment. It does not run migrations,
   create or modify an organization, start trial, contact Stripe, or grant access.
   A successful comparison covers that observation only.
4. On corruption, ambiguous ownership, stale/missing independent evidence, or a
   proposal ahead of the database, keep writes/reads quarantined and reconcile
   exact provider/transaction evidence. Do not reset the trial, truncate the file,
   or infer payment from a prepared State.

The current directory durability implementation is Unix. Windows server tooling
is not certified; the client Windows release gate remains separate.

## Trust assumptions and unfinished integration

A checksum chain detects malformed/torn/reordered bytes; it cannot detect a clean
older valid prefix or an attacker who controls the private directory. The ledger
must be independently retained/versioned and must not be restored with the old DB.
Namespace alone is not an external latest-head proof. Cloud/object-version and
freshness policy remain part of financial restore readiness.

Next implementation work:

1. Add writer coordination at outer transaction commit boundaries: billing →
   entitlement → rollout/other DB locks → short file lock. Release the file lock
   before DB commit. Preserve proposals on unknown commit outcomes, confirm only
   after exact committed DB evidence, and define explicit idempotent reconciliation.
2. Wire roster/namespace/current-head checks into trial (including existing-state
   paths), provider observation, usage scan/admission/retain, Copilot hints/stage/
   self-day/report and cached responses. Final response tokens must be checked.
   The SQL admitted-fact view alone cannot prove that a missing DB entitlement is
   legitimately legacy. New organization creation needs a trusted roster transition.
3. Independently reconcile Stripe bindings/account/live scope and revisions,
   accepted quotes/terms, customer/checkout operations and authorizations, provider
   outcomes, inbox failure episodes, reconcile heads/ACKs, snapshots and idempotency
   evidence. Entitlement agreement cannot restore those financial sources.
4. Finish financial retention, deletion markers, safe rotation/size-limit recovery,
   restore drills and Cloud independent storage certification before enabling use.

## Evidence

`output/team-closure-2026-10-13/financial-guard-local.log` records policy/file tests.
`copilot-admission-local.json` records five native PostgreSQL regressions, including
restoring a missing entitlement after an independently committed enrollment.
Current source hashes, CLI smoke, full server and strict Clippy results are
recorded separately in `financial-guard-development.json`; historical evidence is
not overwritten as proof of newer source. Synthetic tests are not live Stripe,
Cloud restore, browser acceptance or a completed Team Goal.

Latest local results: **9 guard policy/file tests**, **5 native PostgreSQL tests**,
**484 server library tests** (49 external/native tests remain ignored in that broad
command), strict workspace/all-target Clippy and built-CLI smoke all passed. The
native runner executes its five selected ignored tests explicitly; this does not
make the remaining ignored tests pass. Smoke confirms explicit acknowledgement,
initialization/inspection, refusal to overwrite, and corruption privacy/preservation.
No Docker or real provider was opened; the native fixture and CLI fixture were
stopped/removed. Reused `backend/api/target`: 16,777,316 → 17,465,676 KiB; this active
shared cache and the operator binary are retained above the 10 GiB review threshold.
No new target/worktree or disposable build cache was created.

| Item | Development | Local tests | Real certification | Next |
| --- | --- | --- | --- | --- |
| Immutable Copilot admission / shared report fence | implemented | native PG + expiry/lease + report/privacy passed | pending provider/staging | admission-backed export race and real provider |
| External roster / transition journal / durability | component implemented | 9 passed | independent Cloud storage pending | wire outer transactions and reconciliation |
| Operator inspector + exact DB enrollment comparison | implemented | native restored-row check + executable smoke passed | operational restore drill pending | actual dump/restore and independent version proof |
| Runtime commercial guard / final response fences | unfinished | not claimed | pending | all legacy and paid read/write paths |
| Full Stripe financial restoration/retention | unfinished | not claimed | pending | source heads, outcomes, retention and Cloud drill |

All code in this update remains uncommitted on `codex/team-closure-wip` after
`b4d68ec7`; it is not a clean candidate or production release.

Update: selected writer integration is now implemented; see
`atoaxis-team-financial-runtime-2026-10-20.md`. Trial and provider observation use
Prepare → DB commit → external confirmation, with exact internal trial recovery.
This advances the first integration item but does not close reader/final-response,
provider financial source, independent storage or public activation requirements.
