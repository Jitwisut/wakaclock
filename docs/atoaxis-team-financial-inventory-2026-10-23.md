# Financial SQL inventory preview — 23 October 2026

Continues the [source protocol component](atoaxis-team-financial-source-protocol-2026-10-23.md)
on `codex/team-closure-wip`, after `b4d68ec7`, with uncommitted source.
This is a read-only diagnostic component, **not runtime financial-source
authorization or restore certification**. Public trial, Checkout and production
readiness stay disabled. No real account baseline was seeded or reconciled.

## Implemented

- A single SQL statement observes allowlisted financial facts, schema
  classification, scope conflicts, checkpoint and coverage flags in one MVCC
  snapshot. Holding an organization billing lock alone would not fence the
  existing shared webhook inbox/reconciliation writers.
- Historical customer/subscription associations include customer operations,
  authorizations, accepted quotes, Checkout intents, disabled bindings,
  independent outcome variants and deletion markers. Inbox association uses
  customer **or** subscription; matching identities assigned to different
  organizations are flagged. Unknown account events/jobs remain unbound.
- Domain-separated table tag + primary-key identities, stable sorted records,
  duplicate rejection and scoped versioned root hashing. Integer amounts are
  never converted through floating point. Null is distinct from a missing key.
- Semantic controls include first attempt, lookup-only, actor/recovery
  authorization, dispositions, accepted terms, frozen requests, provider
  observations, invoice/payment metadata, binding/source revisions and earliest
  failure evidence. Leases, attempts, retry deadlines, transport error/status
  fields and scheduling success time are explicitly operational and excluded.
  This preview does not interpret operational errors as an authorization decision.
- SQL timestamps use exact UTC microseconds (PostgreSQL storage precision).
  JSONB `Invoice`/`Assessment` timestamps use exact integer `[seconds,nanoseconds]`
  pairs: offset-equivalent instants hash identically without truncating chrono's
  finer validity/observation timestamps. Arrays retain their order.
- Stored typed JSON must have the exact supported shape. Unknown keys or missing
  default/nullable fields are not silently discarded/invented. Frozen Checkout
  requests are validated against their digest and scoped quote context. Provider
  bodies, source, prompts, bearer Checkout URLs and credentials are not queried.
- Schema classification rejects unclassified columns. Limits fail explicitly at
  50,000 facts, 16 MiB of metadata, or 1 MiB per record; no truncated root is
  returned. Independent source observations are checked before/after SQL without
  holding the file lock across an await.
- Additive migration 055 creates **empty** source-head/tombstone scaffolding.
  No automatic seed, cleanup or backfill. Tombstones have no cascading
  organization FK so deletion evidence can outlive the live organization.

Core files:
`services/team_financial_inventory.rs`,
`repository/team_financial_inventory.rs`,
`repository/team_financial_inventory_tests.rs`, migration 055, and the existing
`team-financial-guard` operator binary. No HTTP route or worker emitter is added.

## Operator command

```sh
team-financial-guard inspect-inventory /private/operator/ledger.jsonl \
  --namespace <reviewed-namespace> --organization <organization-id> \
  --account <stripe-account-id>
```

The process uses its configured `POSTGRES_URL`; add `--live` only to inspect the
live namespace. Do not put credentials in command arguments or reports. This
command does not migrate, initialize, dispatch or change data. The independent
ledger and namespace must already be valid. Output contains counts/booleans and
safe statuses, not rows, IDs, root hashes, paths or account data. Errors are
generic. Missing migrations/configuration/evidence fail closed.

`checkpoint=matches_sql_observation` means only that the stored SQL checkpoint
matches that SQL snapshot. It does not establish an independent source head.
`independent_source_matches` checks an existing independent root and committed
transition as a separate diagnostic, including pending/frozen source rules.
Neither result grants product rights. Even when both match:

```json
{
  "account_ingress_proof": "unconfirmed",
  "writer_fencing": "not_integrated",
  "financial_sources": "unconfirmed",
  "product_authorization_enabled": false,
  "production_ready": false
}
```

An empty inventory with no checkpoint remains `uninitialized`. A restored SQL
head cannot initialize independent history. An independent late outcome can
recover an association but cannot manufacture owner authorization or payment.

## Validation and remaining gates

Exact commands, hashes, results, initial failures and cleanup are recorded in
`output/team-closure-2026-10-13/financial-inventory-local.json`. Native fixtures
use a private synthetic PostgreSQL instance and the actual built operator CLI;
they are not Stripe/GitHub/Cloud tests or native Windows certification.

The first fixture failed because its temporary path traversed a macOS symlink;
the existing guard correctly rejected it. The fixture now uses a private runner
directory; no ownership/symlink checks were weakened. Astra's read-only review
also identified sub-microsecond JSON timestamp truncation; the exact encoding
and a direct regression close that issue. Review is separate from test evidence.

Still required before runtime source verification:

1. Independent **account-level ingress journal** for accepted event IDs/hashes
   and revision assignments, including unbound/ignored events. An organization
   inventory cannot prove that an unknown or lost account event never existed.
2. One lock/transaction protocol across all semantic writers, then source
   Prepare → SQL commit → source Commit. Normalize lock order before changing
   claimed-job paths; no account/billing lock acquired after a job-row lock.
3. Accepted-request/possible-dispatch/verified-outcome evidence around actual
   provider calls; missing SQL operations must not create another customer/session.
4. Canonical read/receipt/coverage/restore fences using those verified roots,
   plus approved baseline/recovery workflows, capacity/retention/versioned-store
   policy and genuine restore/process-failure drills. New tables alone do not
   establish any of those protocols; no production writer populates them yet.
5. Separate G1–G6 external gates: clean candidate/latest-main integration,
   real staging/provider/second-tester results, four native client targets,
   user sessions/canary, Cloud configuration, approved prices and pilots.

Rollback preserves migration, checkpoint/tombstone rows, independent ledger,
queues, identities and evidence. Disable the feature/call sites; never erase
pending history or revert additive schema to make an older binary appear healthy.
