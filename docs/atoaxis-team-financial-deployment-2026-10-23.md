# Team financial deployment guard — 23 October 2026

Continuation of the [admission transactions](atoaxis-team-financial-admission-2026-10-22.md).
Work remains uncommitted on `codex/team-closure-wip`, after merge `b4d68ec7`.
That historical merge includes `main` at `a49709f3`; no merge conflicts are
currently unresolved. Final verification found current local `main` at
`c4c51b61`, with 25 commits not included here. It has not been merged in this
slice; current tests do not certify that future integration. Preserve the dirty
Team source and unrelated owner changes before attempting another merge.
No remote-main update, public activation, real financial configuration or provider
certification is performed by this work. G1–G6 remain active.

## Implemented

| Area | Behavior |
|---|---|
| Deployment capability | `CommercialDeployment` requires explicit `ATOAXIS_TEAM_FINANCIAL_GUARD_REQUIRED=true/1`, an existing private journal and its pinned namespace. A raw `FinancialGuard` cannot be converted into activation authority by production callers. Test injection exists only under `cfg(test)`. |
| Trial and provider updates | Internal trial activation accepts this capability. Provider observations preserve configured journal authority separately, even when commercial activation is off. An enrolled SQL state additionally requires commercial capability. |
| Restored missing state | A configured external Enrolled head plus a restored SQL database without entitlement is rejected even with REQUIRED=false/absent. The writer must not discard that external authority and infer legacy from a missing SQL row. Observation/ACK writes roll back together. |
| Reads and minting | Enrolled Team reads and authoritative/advisory state proofs require commercial deployment configuration. Revalidation rejects changing only REQUIRED while leaving the same path/namespace. Exact organization state, consent, receipt and privacy fences still apply. |
| Worker entrypoints | Usage-admission, enabled Copilot ingestion and enabled Checkout worker entrypoints check deployment configuration before their database/provider work. Cleanup-only privacy and GitHub-only sync retain their separate responsibilities. |
| Readiness | Authorized launch-readiness includes `financial_deployment.status`: precommercial, commercial_guard_configured or unconfirmed. It exposes no ledger path, organization head, token or payment details. Financial source recovery remains unconfirmed; production/Checkout remain false. |
| Operator CLI | New `verify-deployment` validates explicit commercial configuration without DB/provider calls or initialization. `verify-database` now pins the requested namespace before repository inspection; actual executable positive/negative native DB tests cover this boundary. |
| Invalid configuration | Partial settings, invalid flags, invalid encoding, wrong namespace and missing/uninitialized evidence are rejected. Diagnostics never print the supplied setting or payload. |

The source changes do not introduce a new flag, daemon, transport or database
migration. Personal heartbeat/usage writing, capture, IDs and duration/timeout
rules remain unchanged. These are deployment prerequisites, not proof of payment
or a replacement for the independent financial-source restore gate.

## Verification

Authoritative commands, source hashes, binary hashes, immutable native-run log
paths and cleanup are recorded in
`output/team-closure-2026-10-13/financial-deployment-local.json`.

- Server: 486 passed, 51 opt-in tests ignored in the broad run.
- Native Stripe/trial/usage: nine test commands passed, including the restored
  missing-SQL/configured-Enrolled-roster rollback regression.
- Native Copilot/restore/operator: five test commands passed, including actual
  CLI database verification and REQUIRED-only changes during a captured proof.
- CLI-only configuration/preservation matrix and strict workspace/all-target
  Clippy passed. Native manifest source hashes match the current code.
- Owned PostgreSQL fixtures stopped and private data removed. Docker was not
  opened; a complete process-name inventory found no Docker engine or compiler.
  The existing shared Rust target changed from 18,416,848 to 18,434,316 KiB;
  it remains above the review threshold and is retained for the active checkout.
  No new target/worktree or disposable build tree was created.

The earlier joint ClickHouse cost/UI/queue evidence is historical, not a new
execution in this slice. No frontend code changed here.

Native tests use disposable PostgreSQL metadata only. The actual operator binary
is built by the native runner before its database checks; a direct repository
test alone would not detect a missing namespace pin in CLI argument handling.
The CLI-only matrix additionally checks initialization acknowledgment, corrupt
record preservation, configuration flags, invalid encoding, wrong namespace and
missing evidence without granting authorization.

Read-only Astra review identified the configured-ledger discard bypass; it was
fixed with a separate `FinancialObservation` authority and a native regression.
The follow-up review found no further high-confidence issue in that change. This
review is distinct from executed tests and external certification.

## Still unfinished / next priorities

1. Complete the commercial-management audit around customers, accepted quotes,
   Checkout outcomes/bindings, portal and package-change operations. The worker
   entrypoint preflight does not certify every underlying monetary API surface.
2. Fence and reconcile those financial sources against independently retained
   evidence, including failed/unknown external outcomes and SQL commits. An
   entitlement match alone cannot approve a restored payment source.
3. Finish organization-roster lifecycle and Owner management/recovery interfaces,
   financial retention/deletion and operational restore drills.
4. Complete the remaining billing/trial UI and portal, prorate/downgrade/cancel
   behavior, then produce a clean candidate and run the original external gates.

Operational limitation: removing all deployment settings and restoring both DB
and ledger to a valid earlier precommercial state cannot be distinguished from a
never-commercial deployment by local configuration/hash chains alone. Pin and
retain the deployment policy and independent log outside DB backups with versioned
storage. Never remove REQUIRED as a recovery procedure or reinitialize the roster
to make an unconfirmed scope appear healthy. No reopening/regrant workflow is
provided here.

Fixtures and the local executable checks are not real Stripe/GitHub acceptance,
Cloud restore, Windows/provider sessions, client artifact certification, pilots
or seven completed user workdays. Those gates keep their original pending state.
